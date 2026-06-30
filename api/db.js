/**
 * api/db.js — Neon Postgres client (replaces api/supabase.js)
 *
 * Uses the serverless HTTP driver (@neondatabase/serverless) so each query is a
 * single fetch — ideal for Vercel functions. Exposes:
 *   sql`...`                  → tagged-template queries (returns array of row objects)
 *   sql(text, params)         → parameterised dynamic queries ($1, $2, …)
 *   upsertRows(...)           → batched multi-row INSERT ... ON CONFLICT
 */

import { neon } from '@neondatabase/serverless'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('Missing DATABASE_URL')

export const sql = neon(connectionString)

export const SHEET_CACHE_TTL_MINUTES = 120

/**
 * Batched multi-row upsert.
 *
 * @param {string}   table          table name
 * @param {object[]} rows           array of plain objects (keys = column names)
 * @param {string|string[]} conflictCols  conflict target, e.g. 'email' or 'snapshot_date,email'
 * @param {{ignoreDuplicates?: boolean}} opts  if ignoreDuplicates, conflicts DO NOTHING
 * @returns {Promise<number>} number of rows sent
 */
export async function upsertRows(table, rows, conflictCols, { ignoreDuplicates = false } = {}) {
  if (!rows || rows.length === 0) return 0

  const cols = Object.keys(rows[0])
  const colList = cols.map(c => `"${c}"`).join(', ')
  const conflictList = (Array.isArray(conflictCols) ? conflictCols : conflictCols.split(','))
    .map(c => c.trim())
  const conflictSet = new Set(conflictList)

  const onConflict = ignoreDuplicates
    ? `ON CONFLICT (${conflictList.join(', ')}) DO NOTHING`
    : `ON CONFLICT (${conflictList.join(', ')}) DO UPDATE SET ` +
      cols.filter(c => !conflictSet.has(c)).map(c => `"${c}" = EXCLUDED."${c}"`).join(', ')

  const BATCH = 500
  let total = 0

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const params = []
    const valuesSql = chunk.map(row => {
      const placeholders = cols.map(c => {
        let v = row[c]
        // JSONB columns arrive as objects/arrays — serialise so the text param
        // coerces into jsonb at the target column.
        if (v !== null && typeof v === 'object') v = JSON.stringify(v)
        params.push(v === undefined ? null : v)
        return `$${params.length}`
      })
      return `(${placeholders.join(', ')})`
    }).join(', ')

    const text = `INSERT INTO ${table} (${colList}) VALUES ${valuesSql} ${onConflict}`
    await sql(text, params)
    total += chunk.length
  }

  return total
}
