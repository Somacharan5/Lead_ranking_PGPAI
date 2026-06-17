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

// Trigger a refresh (admin only) - calls Apps Script web app + busts server-side sheet cache
export async function triggerGlobalRefresh() {
  if (!APPS_SCRIPT_URL) {
    return { success: false, error: 'Apps Script URL not configured' }
  }

  try {
    // Use no-cors mode since Apps Script may not return CORS headers
    await fetch(APPS_SCRIPT_URL, { method: 'GET', mode: 'no-cors' })
    // Also bust the server-side Supabase sheet cache so everyone gets fresh data
    await fetch('/api/sheets?action=invalidate_all', { method: 'POST' }).catch(() => {})
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
