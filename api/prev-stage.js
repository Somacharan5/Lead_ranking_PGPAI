/**
 * api/prev-stage.js — "previous stage" of leads called on a given date.
 *
 *   GET ?date=YYYY-MM-DD → { prevDate, map: { <phone10>: {stage, subStage} }, hasSnapshot }
 *
 * For calls made on `date`, reports where each lead stood the DAY BEFORE — i.e.
 * from the end-of-day snapshot in lead_history / app_start_history for date-1
 * (the stage before that day's calls). Joins snapshot rows to a phone number via
 * the *_static tables, App-Start taking precedence over Lead (same rule as the
 * live substage join in AdminInsights).
 *
 * The prev-day snapshot is immutable, so the full phone→stage map is cached
 * forever in sheet_cache under `prevstage:<prevDate>`. The response is filtered
 * to only the numbers actually called on `date`, keeping the payload small.
 * Leads with no prior-day snapshot are simply absent from the map (the client
 * buckets them as "New / no prior day").
 */
import { sql } from './db.js'

const phone10 = v => String(v || '').replace(/\D/g, '').slice(-10)

function prevDateOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

async function loadPrevMap(prev) {
  const cacheKey = `prevstage:${prev}`
  const cached = await sql`SELECT data FROM sheet_cache WHERE sheet_name = ${cacheKey} LIMIT 1`
  if (cached[0]) return cached[0].data

  const [lead, app] = await Promise.all([
    sql(`SELECT ls.mobile, lh.lead_stage AS stage, lh.lead_sub_stage AS substage
         FROM lead_history lh JOIN lead_static ls ON ls.email = lh.email
         WHERE lh.snapshot_date = $1`, [prev]),
    sql(`SELECT aps.mobile, ah.application_stage AS stage, ah.application_sub_stage AS substage
         FROM app_start_history ah JOIN app_start_static aps ON aps.application_number = ah.application_number
         WHERE ah.snapshot_date = $1`, [prev]),
  ])

  const map = {}
  for (const r of lead) { const p = phone10(r.mobile); if (p) map[p] = { stage: r.stage || '', subStage: r.substage || '' } }
  for (const r of app)  { const p = phone10(r.mobile); if (p) map[p] = { stage: r.stage || '', subStage: r.substage || '' } } // App-Start overrides Lead

  // Cache only when the snapshot actually exists (don't cache an empty map for a
  // day we simply haven't snapshotted yet — it may exist later).
  if (lead.length || app.length) {
    await sql`INSERT INTO sheet_cache (sheet_name, data, fetched_at, row_count)
              VALUES (${cacheKey}, ${JSON.stringify(map)}::jsonb, ${new Date().toISOString()}, ${Object.keys(map).length})
              ON CONFLICT (sheet_name) DO UPDATE SET
                data = EXCLUDED.data, fetched_at = EXCLUDED.fetched_at, row_count = EXCLUDED.row_count`
  }
  return map
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { date } = req.query
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date is required in YYYY-MM-DD form' })
  }
  const prev = prevDateOf(date)

  try {
    // No calls for this date yet (e.g. today before the nightly cron) → nothing
    // to map. Short-circuit before the (potentially expensive) snapshot join.
    const calledRows = await sql(`SELECT DISTINCT to_number FROM call_history WHERE call_date = $1`, [date])
    if (calledRows.length === 0) {
      return res.json({ prevDate: prev, map: {}, hasSnapshot: false })
    }

    const fullMap = await loadPrevMap(prev)
    const hasSnapshot = fullMap && Object.keys(fullMap).length > 0

    // Filter the full prev-day map down to just the numbers called on `date`.
    const map = {}
    for (const r of calledRows) {
      const p = phone10(r.to_number)
      if (p && fullMap[p]) map[p] = fullMap[p]
    }
    return res.json({ prevDate: prev, map, hasSnapshot })
  } catch (e) {
    console.error('[api/prev-stage]', e.message)
    return res.status(500).json({ error: e.message })
  }
}
