import { fetchSheetData } from './sheetsApi'

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL

// Get the latest refresh signal timestamp from the Config sheet
export async function getRefreshSignal() {
  try {
    const rows = await fetchSheetData('Config', 'A1:B2')
    if (!rows || rows.length < 2) return null
    // B2 should contain the timestamp
    const timestamp = rows[1]?.[1]
    return timestamp ? new Date(timestamp).getTime() : null
  } catch (error) {
    console.error('Error reading refresh signal:', error)
    return null
  }
}

// Trigger a refresh (admin only).
// The critical action is busting the server-side sheet cache so every dashboard
// re-reads fresh from Sheets on its next load — this runs FIRST and its result
// determines success. Pinging the Apps Script (a legacy signal that nudges other
// open dashboards to reload via the Config-sheet timestamp) is best-effort:
// fire-and-forget so a down / 403 / slow Apps Script can never block or fail the
// actual refresh. (Previously the cache-bust was gated behind the Apps Script
// call, so a dead Apps Script deployment silently broke the whole button.)
export async function triggerGlobalRefresh() {
  let invalidated = false
  try {
    const r = await fetch('/api/sheets?action=invalidate_all', { method: 'POST' })
    invalidated = r.ok
  } catch (error) {
    return { success: false, error: `Cache refresh failed: ${error.message}` }
  }

  // Best-effort cross-dashboard signal — intentionally NOT awaited.
  if (APPS_SCRIPT_URL) {
    fetch(APPS_SCRIPT_URL, { method: 'GET', mode: 'no-cors' }).catch(() => {})
  }

  return invalidated
    ? { success: true }
    : { success: false, error: 'Cache refresh endpoint returned an error' }
}
