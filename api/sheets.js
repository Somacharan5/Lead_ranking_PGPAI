/**
 * api/sheets.js — Cached Google Sheets proxy
 *
 * Actions:
 *   GET ?action=fetch&sheet=Lead+Dump&range=A:CK          → returns cached or fresh sheet data
 *   GET ?action=fetch&sheet=Calls+History&range=A:V&date=2026-06-08  → date-keyed cache
 *   POST ?action=invalidate&sheet=Lead+Dump               → busts cache (force-refresh)
 *   POST ?action=invalidate_all                           → busts all sheet caches
 *
 * Cache key format:
 *   sheet_name         → e.g. "Lead Dump"
 *   sheet_name:date    → e.g. "Calls History:2026-06-08"  (past dates cache forever)
 */

import { sql, SHEET_CACHE_TTL_MINUTES } from './db.js'

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const API_KEY     = process.env.VITE_GOOGLE_API_KEY
const SHEET_ID    = process.env.VITE_GOOGLE_SHEET_ID
const CALLS_ID    = process.env.VITE_CALLS_HISTORY_SHEET_ID

async function fetchFromSheets(sheetId, sheetName, range) {
  const url = `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(sheetName)}!${range}`
    + `?key=${API_KEY}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Sheets API ${r.status}: ${r.statusText}`)
  const d = await r.json()
  return d.values || []
}

function isCacheStale(fetchedAt) {
  const ageMs = Date.now() - new Date(fetchedAt).getTime()
  return ageMs > SHEET_CACHE_TTL_MINUTES * 60 * 1000
}

function isPastDate(dateStr) {
  if (!dateStr) return false
  const today = new Date().toISOString().slice(0, 10)
  return dateStr < today
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { action, sheet, range, date, sheetId: customSheetId } = req.query

  try {
    // ── INVALIDATE ────────────────────────────────────────────────────────────
    if (req.method === 'POST' && action === 'invalidate_all') {
      await sql`DELETE FROM sheet_cache`
      return res.json({ ok: true, message: 'All sheet caches cleared' })
    }

    if (req.method === 'POST' && action === 'invalidate') {
      const key = date ? `${sheet}:${date}` : sheet
      await sql`DELETE FROM sheet_cache WHERE sheet_name = ${key}`
      return res.json({ ok: true, message: `Cache cleared for: ${key}` })
    }

    // ── FETCH (with cache) ────────────────────────────────────────────────────
    if (action !== 'fetch') {
      return res.status(400).json({ error: 'action must be fetch, invalidate, or invalidate_all' })
    }
    if (!sheet || !range) {
      return res.status(400).json({ error: 'sheet and range are required' })
    }

    const cacheKey    = date ? `${sheet}:${date}` : sheet
    const foreverKey  = isPastDate(date)  // past dates: never expire

    // 1. Check cache
    const cachedRows = await sql`
      SELECT data, fetched_at, row_count FROM sheet_cache WHERE sheet_name = ${cacheKey} LIMIT 1`
    const cached = cachedRows[0]

    if (cached) {
      const stale = !foreverKey && isCacheStale(cached.fetched_at)
      if (!stale) {
        return res.json({ rows: cached.data, rowCount: cached.row_count, fromCache: true, cachedAt: cached.fetched_at })
      }
    }

    // 2. Cache miss / stale — fetch from Sheets
    const targetSheetId = customSheetId || (sheet === 'Call History updated Daily' ? CALLS_ID : SHEET_ID)
    const rows = await fetchFromSheets(targetSheetId, sheet, range)

    // 3. Upsert into cache
    await sql`
      INSERT INTO sheet_cache (sheet_name, data, fetched_at, row_count)
      VALUES (${cacheKey}, ${JSON.stringify(rows)}::jsonb, ${new Date().toISOString()}, ${rows.length})
      ON CONFLICT (sheet_name) DO UPDATE SET
        data       = EXCLUDED.data,
        fetched_at = EXCLUDED.fetched_at,
        row_count  = EXCLUDED.row_count`

    return res.json({ rows, rowCount: rows.length, fromCache: false })

  } catch (e) {
    console.error('[api/sheets]', e.message)
    res.status(500).json({ error: e.message })
  }
}
