import { fetchSheetData, getCol } from './sheetsApi'

// ============================================================================
// COLUMN REFERENCE — verified against Lead_Ranking_3Sheets_10.xlsx
// ============================================================================
//
// LEAD DUMP & FOLLOWUP SHEET - LEAD (same schema):
//   A   Name                          U   Counsellor
//   B   Email                         V   Lead Stage
//   C   Mobile                        W   Lead Sub Stage
//   G   Primary Source                AC  Counsellor Last Activity Date
//   H   Primary Medium                AH  Notes
//   I   Primary Campaign              BV  Total Lead Score
//   O   User Type                     BW  Followup Priority (Followup sheet only)
//   S   Registered On
//
// NEW - APP START & FOLLOWUP SHEET - APP START (same schema):
//   M   Name                          AV  Application Sub Stage
//   N   Email                         BG  Counsellor Last Activity Date
//   O   Mobile                        BM  Notes
//   Q   Registered On                 ET  Total Score
//   S   Source                        EU  Followup Priority
//   T   Medium
//   U   Campaign
//   AR  Counsellor
//   AU  Application Stage
//
// ============================================================================

// ============================================================================
// DATE HELPERS
// ============================================================================

function parseDate(dateStr) {
  if (dateStr === null || dateStr === undefined || dateStr === '') return null
  const s = String(dateStr).trim()
  if (!s) return null

  // ── Excel / Google Sheets serial number ───────────────────────────────────
  // PRIMARY PATH: with valueRenderOption=UNFORMATTED_VALUE, the Sheets API
  // returns all date cells as float serial numbers (e.g. 46152.79).
  // Range 40000–60000 covers roughly 2009–2064 — safe for all CRM dates.
  const numVal = Number(s)
  if (!isNaN(numVal) && numVal > 40000 && numVal < 60000) {
    // Floor strips the fractional time component so IST timezone doesn't shift
    // a late-evening UTC record into the next calendar day
    return new Date((Math.floor(numVal) - 25569) * 86400 * 1000)
  }

  // ── ISO 8601: YYYY-MM-DD (unambiguous — try before slash formats) ─────────
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]))
  }

  // ── Slash/dash separated: DD/MM/YYYY or MM/DD/YYYY ───────────────────────
  // Disambiguate by value: if the first number is > 12 it must be the day;
  // if the second number is > 12 it must be the day (so first = month).
  // When both ≤ 12 (truly ambiguous), assume DD/MM/YYYY (Indian CRM default).
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) {
    const p1 = parseInt(dmy[1]), p2 = parseInt(dmy[2]), year = parseInt(dmy[3])
    if (p1 > 12) return new Date(year, p2 - 1, p1)  // must be DD/MM/YYYY
    if (p2 > 12) return new Date(year, p1 - 1, p2)  // must be MM/DD/YYYY
    return new Date(year, p2 - 1, p1)                 // ambiguous → assume DD/MM
  }

  // ── DD MMM YYYY (e.g. "22 Feb 2026") ─────────────────────────────────────
  const dmy2 = s.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/)
  if (dmy2) {
    return new Date(`${dmy2[2]} ${dmy2[1]}, ${dmy2[3]}`)
  }

  // ── ISO 8601 with time / everything else — let JS try ────────────────────
  const d = new Date(s)
  if (!isNaN(d)) return d

  return null
}

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function daysDiff(date1, date2) {
  const d1 = startOfDay(date1)
  const d2 = startOfDay(date2)
  return Math.floor((d1 - d2) / (1000 * 60 * 60 * 24))
}

// Yesterday or older — any date that is NOT today
function isYesterdayOrOlder(dateStr) {
  const d = parseDate(dateStr)
  if (!d) return false
  return daysDiff(new Date(), d) >= 1
}

// 3 or more days ago
function daysAgoOrMore(dateStr, days) {
  const d = parseDate(dateStr)
  if (!d) return false
  return daysDiff(new Date(), d) >= days
}

// Is this date today (local timezone)?
function isToday(dateStr) {
  const d = parseDate(dateStr)
  if (!d) return false
  return daysDiff(new Date(), d) === 0
}

// Empty / missing last activity = never contacted → include (do NOT exclude).
function spokeToday(lastActivityStr) {
  if (!lastActivityStr) return false
  return isToday(lastActivityStr)
}

// ============================================================================
// SECTION 1: Fresh Leads — from "Lead Dump"
// ============================================================================
//
// FILTER:
//   O  (User Type)                  = "lead"
//   V  (Lead Stage)                 = "Untouched"
//   U  (Counsellor)                 = [logged-in counsellor]
//   S  (Registered On)              ≤ yesterday
//   AC (Counsellor Last Activity)   ≠ today        ← v3 lag-window fix
//
// WHY AC ≠ today:
//   When a counsellor calls, the CRM stamps AC immediately. But V (Lead Stage)
//   may not flip from "Untouched" until the counsellor manually updates it.
//   Without this check, a just-called lead keeps reappearing all day.
//   Leads skipped today carry forward automatically (AC is still empty or old
//   tomorrow, so they pass the filter again).
// ============================================================================
export function getFreshLeads(leadDumpRows, counsellorName) {
  const dataRows = leadDumpRows.slice(1)

  const allMatching = dataRows.filter(row => {
    const userType = (getCol(row, 'O') || '').toLowerCase().trim()
    const leadStage = (getCol(row, 'V') || '').trim()
    const counsellor = (getCol(row, 'U') || '').trim()
    const regOn = getCol(row, 'S')
    return (
      userType === 'lead' &&
      leadStage === 'Untouched' &&
      counsellor === counsellorName &&
      isYesterdayOrOlder(regOn)
    )
  })

  const spokenToday = []
  const actionable = []
  allMatching.forEach(row => {
    const bucket = spokeToday(getCol(row, 'AC')) ? spokenToday : actionable
    bucket.push(row)
  })

  const mapped = actionable.map(row => ({
    name: getCol(row, 'A'),
    email: getCol(row, 'B'),
    mobile: getCol(row, 'C'),
    source: getCol(row, 'G'),
    registeredOn: getCol(row, 'S'),
    medium: getCol(row, 'H'),
    counsellorLastActivity: getCol(row, 'AC'),
    campaign: getCol(row, 'I'),
    stage: getCol(row, 'V'),
    subStage: getCol(row, 'W'),
    notes: getCol(row, 'AH'),
    score: parseFloat(getCol(row, 'BV')) || 0,
    counsellor: getCol(row, 'U'),
    priority: '',
    category: 'Fresh Lead',
  }))

  return { leads: mapped, spokenTodayCount: spokenToday.length }
}

// ============================================================================
// SECTION 2: Followup Leads — from "Followup Sheet - LEAD"
// ============================================================================
//
// FILTER:
//   O  (User Type)  = "lead"
//   U  (Counsellor) = [logged-in counsellor]
//   IF V = "Counseled"              → AC ≥ 3 days ago
//   IF V = "No Contact Established" → AC ≤ yesterday OR AC is empty
//
// FIX: NCE leads with NO last activity (never contacted) were previously
// excluded because isYesterdayOrOlder(null) = false. A lead that has NEVER
// been contacted is highest priority — it must always be included.
//
// IMPORTANT: AC in this sheet arrives as Excel serial floats (e.g. 46142.65).
// parseDate() handles this via the serial-number branch above.
// ============================================================================
export function getFollowupLeads(followupLeadRows, counsellorName) {
  const dataRows = followupLeadRows.slice(1)

  let spokenTodayCount = 0
  const actionable = []

  dataRows.forEach(row => {
    const counsellor = (getCol(row, 'U') || '').trim()
    const userType = (getCol(row, 'O') || '').toLowerCase().trim()
    const leadStage = (getCol(row, 'V') || '').trim()
    const lastAct = getCol(row, 'AC')

    if (counsellor !== counsellorName || userType !== 'lead') return

    // Defensive guard: if somehow AC = today, count and skip.
    if (spokeToday(lastAct)) {
      if (leadStage === 'Counseled' || leadStage === 'No Contact Established') {
        spokenTodayCount++
      }
      return
    }

    if (leadStage === 'Counseled' && daysAgoOrMore(lastAct, 3)) {
      actionable.push(row)
    } else if (leadStage === 'No Contact Established') {
      // FIX: include if lastAct is empty (never contacted) OR old enough
      if (!lastAct || isYesterdayOrOlder(lastAct)) {
        actionable.push(row)
      }
    }
  })

  const mapped = actionable
    .map(row => ({
      name: getCol(row, 'A'),
      email: getCol(row, 'B'),
      mobile: getCol(row, 'C'),
      source: getCol(row, 'G'),
      registeredOn: getCol(row, 'S'),
      medium: getCol(row, 'H'),
      counsellorLastActivity: getCol(row, 'AC'),
      campaign: getCol(row, 'I'),
      stage: getCol(row, 'V'),
      subStage: getCol(row, 'W'),
      notes: getCol(row, 'AH'),
      score: parseFloat(getCol(row, 'BV')) || 0,
      counsellor: getCol(row, 'U'),
      priority: getCol(row, 'BW'),
      category: 'Followup Lead',
    }))
    .filter(lead => lead.priority !== 'Priority 5')

  return { leads: mapped, spokenTodayCount }
}

// ============================================================================
// SECTION 3: New App Starts — from "New - App start"
// ============================================================================
//
// FILTER:
//   AR (Counsellor)            = [logged-in counsellor]
//   AU (Application Stage)     = "Untouched"
//   Q  (Registered On)         ≤ yesterday
//   BG (Counsellor Last Activ) ≠ today        ← v3 lag-window fix
//
// (Same lag-window rationale as Section 1.)
// ============================================================================
export function getNewAppStart(newAppStartRows, counsellorName) {
  const dataRows = newAppStartRows.slice(1)

  const allMatching = dataRows.filter(row => {
    const counsellor = (getCol(row, 'AR') || '').trim()
    const appStage   = (getCol(row, 'AU') || '').trim()
    const regOn      = getCol(row, 'Q')

    if (counsellor !== counsellorName) return false
    return appStage === 'Untouched' && isYesterdayOrOlder(regOn)
  })

  const spokenToday = [], actionable = []
  allMatching.forEach(row => {
    const lastAct = getCol(row, 'BG')
    const bucket = spokeToday(lastAct) ? spokenToday : actionable
    bucket.push(row)
  })

  const mapped = actionable
    .map(row => ({
      name: getCol(row, 'M'),
      email: getCol(row, 'N'),
      mobile: getCol(row, 'O'),
      source: getCol(row, 'S'),
      registeredOn: getCol(row, 'Q'),
      medium: getCol(row, 'T'),
      counsellorLastActivity: getCol(row, 'BG'),
      campaign: getCol(row, 'U'),
      stage: getCol(row, 'AU'),
      subStage: getCol(row, 'AV'),
      notes: getCol(row, 'BM'),
      score: parseFloat(getCol(row, 'ET')) || 0,
      counsellor: getCol(row, 'AR'),
      priority: '',
      category: 'New App Start',
    }))
    .filter(lead => lead.priority !== 'Priority 5')

  return { leads: mapped, spokenTodayCount: spokenToday.length }
}

// ============================================================================
// SECTION 4: App Followups — from "Followup sheet - App start"
// ============================================================================
//
// FILTER:
//   AR (Counsellor)        = [logged-in counsellor]
//   IF AU = "Counseled"              → BG ≥ 3 days ago
//   IF AU = "No Contact Established" → BG ≤ yesterday OR BG is empty
//
// FIX: NCE leads with NO last activity (never contacted) were previously
// excluded. Same fix as Section 2 — always include never-contacted leads.
// ============================================================================
export function getAppFollowup(appFollowupRows, counsellorName) {
  const dataRows = appFollowupRows.slice(1)

  let spokenTodayCount = 0
  const actionable = []

  dataRows.forEach(row => {
    const counsellor = (getCol(row, 'AR') || '').trim()
    const appStage = (getCol(row, 'AU') || '').trim()
    const lastAct = getCol(row, 'BG')

    if (counsellor !== counsellorName) return

    if (spokeToday(lastAct)) {
      if (appStage === 'Counseled' || appStage === 'No Contact Established') {
        spokenTodayCount++
      }
      return
    }

    if (appStage === 'Counseled' && daysAgoOrMore(lastAct, 3)) {
      actionable.push(row)
    } else if (appStage === 'No Contact Established') {
      // FIX: include if lastAct is empty (never contacted) OR old enough
      if (!lastAct || isYesterdayOrOlder(lastAct)) {
        actionable.push(row)
      }
    }
  })

  const mapped = actionable
    .map(row => ({
      name: getCol(row, 'M'),
      email: getCol(row, 'N'),
      mobile: getCol(row, 'O'),
      source: getCol(row, 'S'),
      registeredOn: getCol(row, 'Q'),
      medium: getCol(row, 'T'),
      counsellorLastActivity: getCol(row, 'BG'),
      campaign: getCol(row, 'U'),
      stage: getCol(row, 'AU'),
      subStage: getCol(row, 'AV'),
      notes: getCol(row, 'BM'),
      score: parseFloat(getCol(row, 'ET')) || 0,
      counsellor: getCol(row, 'AR'),
      priority: getCol(row, 'EU'),
      category: 'App Followup',
    }))
    .filter(lead => lead.priority !== 'Priority 5')

  return { leads: mapped, spokenTodayCount }
}

// ============================================================================
// SORTING & ALLOCATION
// ============================================================================

function sortLeads(leads) {
  return leads.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    // Parse "Priority 1" / "1" / "" etc. — fall back to 99 (lowest priority)
    const aPrio = parseInt((a.priority || '').replace(/\D/g, '')) || 99
    const bPrio = parseInt((b.priority || '').replace(/\D/g, '')) || 99
    return aPrio - bPrio
  })
}

export function allocateLeads(fresh, followup, newApp, appFollowup, totalTarget = 300) {
  const ratios = { fresh: 0.295, followup: 0.243, newApp: 0.183, appFollowup: 0.279 }

  const sortedFresh = sortLeads([...fresh])
  const sortedFollowup = sortLeads([...followup])
  const sortedNewApp = sortLeads([...newApp])
  const sortedAppFollowup = sortLeads([...appFollowup])

  const targetFresh = Math.round(totalTarget * ratios.fresh)         // 89
  const targetFollowup = Math.round(totalTarget * ratios.followup)   // 73
  const targetNewApp = Math.round(totalTarget * ratios.newApp)       // 55
  const targetAppFollowup = totalTarget - targetFresh - targetFollowup - targetNewApp // 83

  const allocFresh = sortedFresh.slice(0, targetFresh)
  const allocFollowup = sortedFollowup.slice(0, targetFollowup)
  const allocNewApp = sortedNewApp.slice(0, targetNewApp)
  const allocAppFollowup = sortedAppFollowup.slice(0, targetAppFollowup)

  // Shortfall: fill from leftover leads sorted by score
  const shortfall =
    totalTarget -
    (allocFresh.length + allocFollowup.length + allocNewApp.length + allocAppFollowup.length)

  if (shortfall > 0) {
    const remainder = [
      ...sortedFresh.slice(targetFresh),
      ...sortedFollowup.slice(targetFollowup),
      ...sortedNewApp.slice(targetNewApp),
      ...sortedAppFollowup.slice(targetAppFollowup),
    ]
    sortLeads(remainder).slice(0, shortfall).forEach(lead => {
      if (lead.category === 'Fresh Lead') allocFresh.push(lead)
      else if (lead.category === 'Followup Lead') allocFollowup.push(lead)
      else if (lead.category === 'New App Start') allocNewApp.push(lead)
      else allocAppFollowup.push(lead)
    })
  }

  return {
    freshLeads: allocFresh,
    followupLeads: allocFollowup,
    newAppStart: allocNewApp,
    appFollowup: allocAppFollowup,
    total: allocFresh.length + allocFollowup.length + allocNewApp.length + allocAppFollowup.length,
  }
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================
export async function getLeadsForCounsellor(counsellorName) {
  const [leadDump, followupLead, newAppStart, appFollowup] = await Promise.all([
    fetchSheetData('Lead Dump', 'A:BW'),
    fetchSheetData('Followup Sheet - LEAD', 'A:BW'),
    fetchSheetData('New - App start', 'A:EU'),
    fetchSheetData('Followup sheet - App start', 'A:EU'),
  ])

  const fresh = getFreshLeads(leadDump, counsellorName)
  const followup = getFollowupLeads(followupLead, counsellorName)
  const newApp = getNewAppStart(newAppStart, counsellorName)
  const appFu = getAppFollowup(appFollowup, counsellorName)

  const allocation = allocateLeads(
    fresh.leads,
    followup.leads,
    newApp.leads,
    appFu.leads,
    300  // 300 leads per day (89 fresh / 73 followup / 55 new app / 83 app followup)
  )

  // Surface "spoken today" counts so the UI can show counsellors exactly
  // how many leads were filtered out and why the count is what it is.
  const spokenToday = {
    fresh: fresh.spokenTodayCount,
    followup: followup.spokenTodayCount,
    newApp: newApp.spokenTodayCount,
    appFollowup: appFu.spokenTodayCount,
    total:
      fresh.spokenTodayCount +
      followup.spokenTodayCount +
      newApp.spokenTodayCount +
      appFu.spokenTodayCount,
  }

  return { ...allocation, spokenToday }
}
