/**
 * api/calls.js — DB-only read of Callyzer calls for one date.
 *
 *   GET ?date=YYYY-MM-DD  → { rows: [[...25 cols in sheet A:Y order...], …], count }
 *
 * Reads exclusively from the call_history table (populated nightly by
 * api/snapshot.js). A date with no rows yet (e.g. today, before the nightly
 * cron runs) returns an empty list — by design, no live-sheet fallback.
 *
 * Rows are returned as arrays in the exact Callyzer sheet column order (A→Y) so
 * AdminInsights can prepend its CALLS_HEADER and feed parseCallsHistory
 * unchanged.
 */
import { sql } from './db.js'

// call_history column → position in the sheet's A:Y layout (0-indexed)
const SHEET_ORDER = [
  'sr_no', 'emp_code', 'emp_tags', 'employee_name', 'employee_number', 'to_name',
  'country_code', 'to_number', 'call_type', 'call_method', 'call_mode', 'duration',
  'call_date', 'call_time', 'notes', 'uniqueid', 'audio_url', 'call_transcript',
  'stage', 'app_form_completed_pct', 'payment_initiated', 'app_form_initiated',
  'source', 'lead_app_start_stage', 'call_duration_mins',
]

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { date } = req.query
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date is required in YYYY-MM-DD form' })
  }

  try {
    const rows = await sql(
      `SELECT sr_no, emp_code, emp_tags, employee_name, employee_number, to_name,
              country_code, to_number, call_type, call_method, call_mode, duration,
              to_char(call_date,'YYYY-MM-DD') AS call_date, call_time, notes, uniqueid,
              audio_url, call_transcript, stage, app_form_completed_pct, payment_initiated,
              app_form_initiated, source, lead_app_start_stage, call_duration_mins
       FROM call_history
       WHERE call_date = $1
       ORDER BY call_time`,
      [date]
    )
    const arr = rows.map(r => SHEET_ORDER.map(c => (r[c] === null || r[c] === undefined ? '' : r[c])))
    // When the requested date is empty, report the latest date we DO have so the
    // UI can offer to jump there (e.g. today before the nightly cron has run).
    let latestAvailable = null
    if (arr.length === 0) {
      const m = await sql`SELECT to_char(MAX(call_date),'YYYY-MM-DD') AS d FROM call_history`
      latestAvailable = m[0]?.d || null
    }
    return res.json({ rows: arr, count: arr.length, latestAvailable })
  } catch (e) {
    console.error('[api/calls]', e.message)
    return res.status(500).json({ error: e.message })
  }
}
