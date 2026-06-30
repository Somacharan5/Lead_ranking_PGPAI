/**
 * api/ai-cache.js — Permanent AI analysis result cache
 *
 * GET  ?key=transcript_overview:Jasmeet:2026-06-08   → returns cached result or null
 * POST body: { key, result }                          → saves result permanently
 *
 * Key conventions:
 *   transcript_overview:{counsellor}:{date}
 *   transcript_lead:{fileId}
 *   call_notes_insights:{counsellor}:{date}
 */

import { sql } from './db.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    // ── READ ──────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const { key } = req.query
      if (!key) return res.status(400).json({ error: 'key is required' })

      const rows = await sql`
        SELECT result, created_at FROM ai_cache WHERE cache_key = ${key} LIMIT 1`
      const data = rows[0]

      if (!data) return res.json({ hit: false, result: null })
      return res.json({ hit: true, result: data.result, cachedAt: data.created_at })
    }

    // ── WRITE ─────────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { key, result } = req.body || {}
      if (!key || !result) return res.status(400).json({ error: 'key and result are required' })

      await sql`
        INSERT INTO ai_cache (cache_key, result, created_at)
        VALUES (${key}, ${JSON.stringify(result)}::jsonb, ${new Date().toISOString()})
        ON CONFLICT (cache_key) DO UPDATE SET
          result     = EXCLUDED.result,
          created_at = EXCLUDED.created_at`

      return res.json({ ok: true })
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    console.error('[api/ai-cache]', e.message)
    res.status(500).json({ error: e.message })
  }
}
