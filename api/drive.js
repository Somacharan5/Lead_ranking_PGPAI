import { createSign }   from 'crypto'
import { readFileSync }  from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))

// Service account credentials: prefer the GOOGLE_SERVICE_ACCOUNT_JSON env var
// (set this in Vercel). Falls back to a local api/sa.json for local dev — that
// file holds a private key and is gitignored, never committed.
// Loaded lazily so a missing credential returns a clear 500 message via the
// handler's try/catch instead of crashing the function at module load.
let _sa = null
function getServiceAccount() {
  if (_sa) return _sa
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    _sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
    return _sa
  }
  try {
    _sa = JSON.parse(readFileSync(join(__dir, 'sa.json'), 'utf8'))
    return _sa
  } catch {
    throw new Error(
      'Google service account credentials missing. Set the GOOGLE_SERVICE_ACCOUNT_JSON ' +
      'environment variable in Vercel (Settings → Environment Variables) with the full ' +
      'service-account JSON, then redeploy.'
    )
  }
}

const ROOT_ID = '0AMdCjnS24RycUk9PVA'

// ── Google JWT auth ───────────────────────────────────────────────────────────

async function getAccessToken() {
  const sa  = getServiceAccount()
  const now = Math.floor(Date.now() / 1000)
  const hdr = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const cla = Buffer.from(JSON.stringify({
    iss:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now,
  })).toString('base64url')

  const input  = `${hdr}.${cla}`
  const signer = createSign('RSA-SHA256')
  signer.update(input)
  const sig = signer.sign(sa.private_key, 'base64url')
  const jwt = `${input}.${sig}`

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const d = await r.json()
  if (!d.access_token) throw new Error(`Auth failed: ${d.error_description || d.error || JSON.stringify(d)}`)
  return d.access_token
}

// ── Drive API helpers ─────────────────────────────────────────────────────────

async function gList(token, parentId, opts = {}) {
  let q = `'${parentId}' in parents and trashed=false`
  if (opts.mime)     q += ` and mimeType='${opts.mime}'`
  if (opts.name)     q += ` and name='${opts.name}'`
  if (opts.nameLike) q += ` and name contains '${opts.nameLike}'`

  const url = new URL('https://www.googleapis.com/drive/v3/files')
  url.searchParams.set('q',                        q)
  url.searchParams.set('fields',                   'files(id,name)')
  url.searchParams.set('pageSize',                 '1000')
  url.searchParams.set('supportsAllDrives',         'true')
  url.searchParams.set('includeItemsFromAllDrives', 'true')

  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const d = await r.json()
  if (d.error) throw new Error(`Drive list: ${d.error.message}`)
  return d.files || []
}

// Folder name "Komal" should match counsellor filter "Komal Pandey", etc.
function folderMatchesCounsellor(folderName, counsellorFilter) {
  if (!counsellorFilter || counsellorFilter === 'all') return true
  const fLow = folderName.toLowerCase()
  const cLow = counsellorFilter.toLowerCase()
  if (fLow === cLow) return true
  // folder = first name only; check against first token of full CRM name
  const firstName = cLow.split(' ')[0]
  return fLow === firstName
}

async function gRead(token, fileId) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) throw new Error(`Drive read ${fileId}: ${r.status} ${r.statusText}`)
  return r.text()
}

// Returns a set of folder-name variants for an ISO date (e.g. "2026-05-26")
function dateVariants(iso) {
  const [y, m, d] = iso.split('-')
  return new Set([iso, `${d}-${m}-${y}`, `${y}${m}${d}`, `${d}/${m}/${y}`])
}

// ── Request handler ───────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { action, date, month, counsellor, fileId } = req.query

  try {
    const token = await getAccessToken()

    // ── LIST: return transcript file metadata for a date/counsellor ──────────
    if (action === 'list') {
      const FOLDER_MIME = 'application/vnd.google-apps.folder'

      // List all counsellor folders, then client-side filter by first-name
      // (Drive folder "Komal" must match CRM name "Komal Pandey")
      const allCFolders = await gList(token, ROOT_ID, { mime: FOLDER_MIME })
      const cFolders = allCFolders.filter(f => folderMatchesCounsellor(f.name, counsellor))

      const files     = []
      const variants  = date ? dateVariants(date) : null
      // month = "YYYY-MM" — match all date subfolders starting with that prefix
      const monthPfx  = (!date && month) ? (month + '-') : null

      // Parallel: for each counsellor folder, check its date subfolders
      await Promise.all(cFolders.map(async cFolder => {
        const dFolders = await gList(token, cFolder.id, { mime: FOLDER_MIME })
        await Promise.all(dFolders.map(async dFolder => {
          if (variants && !variants.has(dFolder.name)) return
          if (monthPfx  && !dFolder.name.startsWith(monthPfx)) return
          const txts = await gList(token, dFolder.id, { nameLike: '.txt' })
          txts.forEach(f => {
            // filename: counsellorPhone_customerPhone_YYYYMMDD_HHMMSS.txt
            const base  = f.name.replace(/\.txt$/i, '')
            const parts = base.split('_')
            files.push({
              fileId:          f.id,
              name:            f.name,
              counsellor:      cFolder.name,
              counsellorPhone: parts[0] || '',
              customerPhone:   (parts[1] || '').slice(-10),
              fileDate:        parts[2] || '',
              fileTime:        parts[3] || '',
            })
          })
        }))
      }))

      return res.json({ files })
    }

    // ── READ: return raw text of a transcript file ───────────────────────────
    if (action === 'read') {
      if (!fileId) return res.status(400).json({ error: 'fileId is required' })
      const text = await gRead(token, fileId)
      return res.json({ text })
    }

    res.status(400).json({ error: 'action must be "list" or "read"' })
  } catch (e) {
    console.error('[api/drive]', e.message)
    res.status(500).json({ error: e.message })
  }
}
