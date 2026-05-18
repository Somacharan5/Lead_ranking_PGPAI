/**
 * transcribe-sarvam-batch.mjs
 *
 * Transcribes long MP3 call recordings using Sarvam's Batch API (supports up to 1 hour).
 * For each .mp3 without a matching .txt, submits a batch job (up to 20 files each),
 * polls for completion, then writes transcripts as .txt alongside the .mp3.
 *
 * Usage:
 *   SARVAM_API_KEY=sk_xxx node scripts/transcribe-sarvam-batch.mjs <recordings-root>
 *   node scripts/transcribe-sarvam-batch.mjs <recordings-root>   # prompts for key
 *
 * Options:
 *   --batch-size=20     Max files per job (default 20, Sarvam limit)
 *   --poll-interval=15  Seconds between status polls (default 15)
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const BASE_URL = 'https://api.sarvam.ai/speech-to-text/job/v1'

// ─── helpers ────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await walk(full))
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mp3')) files.push(full)
  }
  return files
}

async function getApiKey() {
  if (process.env.SARVAM_API_KEY) return process.env.SARVAM_API_KEY
  const rl = createInterface({ input, output })
  const key = await rl.question('Sarvam API key: ')
  rl.close()
  return key.trim()
}

function chunk(arr, size) {
  const chunks = []
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size))
  return chunks
}

// ─── Batch API calls ─────────────────────────────────────────────────────────

async function createJob(apiKey) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'api-subscription-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      job_parameters: { mode: 'transcribe', language_code: 'unknown' },
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Create job failed ${res.status}: ${JSON.stringify(data)}`)
  return data // { job_id, ... }
}

async function uploadFiles(apiKey, jobId, mp3Paths) {
  // 1. Get presigned upload URLs from Sarvam
  const filenames = mp3Paths.map(p => path.basename(p))
  const res = await fetch(`${BASE_URL}/upload-files`, {
    method: 'POST',
    headers: {
      'api-subscription-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      job_id: jobId,
      files: filenames
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Get upload URLs failed ${res.status}: ${JSON.stringify(data)}`)

  const uploadUrls = data.upload_urls || {}

  // 2. Upload each file directly to its Azure presigned URL
  for (const p of mp3Paths) {
    const filename = path.basename(p)
    const urlObj = uploadUrls[filename]
    if (!urlObj || !urlObj.file_url) throw new Error(`No upload URL returned for ${filename}`)
    
    const bytes = await fs.readFile(p)
    const putRes = await fetch(urlObj.file_url, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': 'audio/mpeg'
      },
      body: bytes
    })
    
    if (!putRes.ok) {
      const text = await putRes.text()
      throw new Error(`Azure upload failed for ${filename} (${putRes.status}): ${text}`)
    }
  }
}

async function startJob(apiKey, jobId) {
  const res = await fetch(`${BASE_URL}/${jobId}/start`, {
    method: 'POST',
    headers: {
      'api-subscription-key': apiKey,
      'Content-Type': 'application/json',
    },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Start job failed ${res.status}: ${JSON.stringify(data)}`)
  return data
}

async function pollStatus(apiKey, jobId, pollIntervalMs) {
  while (true) {
    await sleep(pollIntervalMs)
    const res = await fetch(`${BASE_URL}/${jobId}/status`, {
      headers: { 'api-subscription-key': apiKey },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Status check failed ${res.status}: ${JSON.stringify(data)}`)
    const status = data.status || data.job_status
    console.log(`  Job ${jobId} status: ${status}`)
    if (status === 'completed' || status === 'COMPLETED') return data
    if (status === 'failed' || status === 'FAILED') throw new Error(`Job ${jobId} failed: ${JSON.stringify(data)}`)
  }
}

async function getResults(apiKey, jobId) {
  const res = await fetch(`${BASE_URL}/${jobId}/download-results`, {
    headers: { 'api-subscription-key': apiKey },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Download results failed ${res.status}: ${JSON.stringify(data)}`)
  return data // array of { filename, transcript, ... }
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  const root = process.argv[2]
  const batchSizeArg = process.argv.find(a => a.startsWith('--batch-size='))
  const pollArg = process.argv.find(a => a.startsWith('--poll-interval='))
  const batchSize = batchSizeArg ? Number(batchSizeArg.split('=')[1]) : 20
  const pollIntervalMs = (pollArg ? Number(pollArg.split('=')[1]) : 15) * 1000

  if (!root) {
    throw new Error(
      'Usage: node scripts/transcribe-sarvam-batch.mjs <recordings-root> [--batch-size=20] [--poll-interval=15]'
    )
  }

  const apiKey = await getApiKey()

  // Find all mp3s without a matching txt
  const allMp3s = (await walk(root)).sort()
  const pending = []
  for (const mp3 of allMp3s) {
    const txt = mp3.replace(/\.mp3$/i, '.txt')
    try {
      await fs.access(txt)
      // txt exists — already transcribed
    } catch {
      pending.push({ mp3, txt })
    }
  }

  console.log(`\nFound ${allMp3s.length} mp3 files. Pending transcription: ${pending.length}.\n`)
  if (pending.length === 0) {
    console.log('Nothing to do. All mp3s are already transcribed! ✅')
    return
  }

  // Split into batches of up to batchSize
  const batches = chunk(pending, batchSize)
  console.log(`Will process in ${batches.length} batch job(s) of up to ${batchSize} files each.\n`)

  let totalDone = 0
  let totalFailed = 0

  for (let bIdx = 0; bIdx < batches.length; bIdx++) {
    const batch = batches[bIdx]
    console.log(`── Batch ${bIdx + 1}/${batches.length} (${batch.length} files) ──────────────────`)

    try {
      // 1. Create job
      process.stdout.write('  Creating job...')
      const jobData = await createJob(apiKey)
      const jobId = jobData.job_id || jobData.id
      console.log(` job_id=${jobId}`)

      // 2. Upload files
      process.stdout.write(`  Uploading ${batch.length} files...`)
      await uploadFiles(apiKey, jobId, batch.map(b => b.mp3))
      console.log(' done.')

      // 3. Start job
      process.stdout.write('  Starting job...')
      await startJob(apiKey, jobId)
      console.log(' started.')

      // 4. Poll until done
      console.log(`  Polling every ${pollIntervalMs / 1000}s for completion...`)
      const resultData = await pollStatus(apiKey, jobId, pollIntervalMs)

      // 5. Get results
      let results
      try {
        results = await getResults(apiKey, jobId)
      } catch {
        // Some APIs embed results in the status response
        results = resultData.results || resultData.transcriptions || []
      }

      // 6. Write transcripts — match by filename
      const resultMap = {}
      const resultArr = Array.isArray(results) ? results : results.results || []
      for (const r of resultArr) {
        const name = r.filename || r.file_name || r.name || ''
        resultMap[name] = r.transcript || r.transcription || ''
      }

      for (const item of batch) {
        const basename = path.basename(item.mp3)
        const transcript = resultMap[basename]
        if (transcript !== undefined) {
          await fs.writeFile(item.txt, transcript.trim() + '\n', 'utf8')
          console.log(`  ✅ ${basename}`)
          totalDone++
        } else {
          console.warn(`  ⚠️  No transcript returned for ${basename}`)
          totalFailed++
        }
      }
    } catch (err) {
      console.error(`  ❌ Batch ${bIdx + 1} failed: ${err.message}`)
      totalFailed += batch.length
    }

    console.log()
  }

  console.log(`\n══ Complete ══`)
  console.log(`  Transcribed: ${totalDone}`)
  console.log(`  Failed:      ${totalFailed}`)
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
