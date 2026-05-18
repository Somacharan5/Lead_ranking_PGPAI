import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const EMPLOYEE_BY_NUMBER = {
  '7835857413': 'Prerna',
  '7835804746': 'Komal',
  '7835079902': 'Jasmeet',
  '7835013391': 'Amandeep Kaur',
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

function parseMeta(filePath) {
  const base = path.basename(filePath, path.extname(filePath))
  const [employeeNumber, customerNumber, date, time] = base.split('_')
  return {
    employeeNumber,
    employeeName: EMPLOYEE_BY_NUMBER[employeeNumber] || 'Unknown',
    customerNumber,
    date,
    time,
  }
}

async function getApiKey() {
  if (process.env.SARVAM_API_KEY) return process.env.SARVAM_API_KEY
  const rl = createInterface({ input, output })
  const key = await rl.question('Sarvam API key: ')
  rl.close()
  return key.trim()
}

async function transcribe(filePath, apiKey) {
  const bytes = await fs.readFile(filePath)
  const form = new FormData()
  form.append('file', new Blob([bytes], { type: 'audio/mpeg' }), path.basename(filePath))
  form.append('model', 'saaras:v3')
  form.append('mode', 'transcribe')
  form.append('language_code', 'unknown')

  const response = await fetch('https://api.sarvam.ai/speech-to-text', {
    method: 'POST',
    headers: { 'api-subscription-key': apiKey },
    body: form,
  })

  const text = await response.text()
  let data = null
  try { data = JSON.parse(text) } catch {}

  if (!response.ok) {
    const message = data?.detail || data?.message || text || response.statusText
    throw new Error(`Sarvam ${response.status}: ${message}`)
  }

  return data?.transcript || ''
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const root = process.argv[2]
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='))
  const delayArg = process.argv.find(arg => arg.startsWith('--delay-ms='))
  const retriesArg = process.argv.find(arg => arg.startsWith('--retries='))
  const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity
  const delayMs = delayArg ? Number(delayArg.split('=')[1]) : 5000
  const retries = retriesArg ? Number(retriesArg.split('=')[1]) : 3

  if (!root) {
    throw new Error('Usage: node scripts/transcribe-sarvam.mjs <recordings-root> [--limit=10] [--delay-ms=5000] [--retries=3]')
  }

  const apiKey = await getApiKey()
  const mp3s = (await walk(root)).sort()
  const pending = []
  for (const mp3 of mp3s) {
    const txt = mp3.replace(/\.mp3$/i, '.txt')
    try {
      await fs.access(txt)
    } catch {
      pending.push({ mp3, txt })
    }
  }

  console.log(`Found ${mp3s.length} mp3 files. Pending transcripts: ${pending.length}.`)

  let done = 0
  let failed = 0
  for (const item of pending.slice(0, limit)) {
    const meta = parseMeta(item.mp3)
    try {
      console.log(`[${done + failed + 1}/${Math.min(pending.length, limit)}] ${meta.employeeName} -> ${meta.customerNumber} ${meta.date} ${meta.time}`)
      let transcript = ''
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          transcript = await transcribe(item.mp3, apiKey)
          break
        } catch (error) {
          const isRateLimit = error.message.includes('Sarvam 429')
          if (!isRateLimit || attempt === retries) throw error
          const waitMs = Math.max(delayMs, 30000 * (attempt + 1))
          console.log(`Rate limited. Waiting ${Math.round(waitMs / 1000)}s before retry ${attempt + 1}/${retries}...`)
          await sleep(waitMs)
        }
      }
      await fs.writeFile(item.txt, transcript.trim() + '\n', 'utf8')
      done += 1
      if (delayMs > 0) await sleep(delayMs)
    } catch (error) {
      failed += 1
      console.error(`FAILED ${item.mp3}`)
      console.error(error.message)
    }
  }

  console.log(`Complete. Wrote ${done} transcript(s). Failed ${failed}.`)
}

main().catch(error => {
  console.error(error.message)
  process.exit(1)
})
