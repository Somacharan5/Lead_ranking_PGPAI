/**
 * api/paidapp-classify.js — Admin classification of completed paid apps
 *
 * GET                                  → { map: { [application_number]: 'counseled'|'inbound' } }
 * POST { application_number, classification, classified_by? }
 *        classification ∈ 'counseled' | 'inbound' | 'pending'
 *        'pending' deletes the row (back to unclassified → excluded from leaderboard)
 *
 * Pending (no row) = excluded from the leaderboard.
 * Counseled = credited to the assigned counsellor. Inbound = never counted.
 */

import { sql } from './db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    // ── READ all classifications ───────────────────────────────────────────────
    if (req.method === 'GET') {
      const rows = await sql`SELECT application_number, classification FROM paidapp_classification`
      const map = {}
      for (const r of rows) map[r.application_number] = r.classification
      return res.json({ map })
    }

    // ── WRITE / clear one classification ───────────────────────────────────────
    if (req.method === 'POST') {
      const { application_number, classification, classified_by } = req.body || {}
      if (!application_number) return res.status(400).json({ error: 'application_number is required' })

      // 'pending' (or empty) clears the row → back to unclassified
      if (!classification || classification === 'pending') {
        await sql`DELETE FROM paidapp_classification WHERE application_number = ${String(application_number)}`
        return res.json({ ok: true, application_number, classification: 'pending' })
      }

      if (classification !== 'counseled' && classification !== 'inbound') {
        return res.status(400).json({ error: "classification must be 'counseled', 'inbound', or 'pending'" })
      }

      await sql`
        INSERT INTO paidapp_classification (application_number, classification, classified_by, classified_at)
        VALUES (${String(application_number)}, ${classification}, ${classified_by || null}, NOW())
        ON CONFLICT (application_number) DO UPDATE SET
          classification = EXCLUDED.classification,
          classified_by  = EXCLUDED.classified_by,
          classified_at  = NOW()`

      return res.json({ ok: true, application_number, classification })
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('[api/paidapp-classify]', e.message)
    res.status(500).json({ error: e.message })
  }
}
