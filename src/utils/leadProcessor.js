import { fetchSheetData, getCol } from './sheetsApi'

// ============================================================================
// DATE HELPERS
// ============================================================================

function parseDate(dateStr) {
  if (!dateStr && dateStr !== 0) return null
  const s = String(dateStr).trim()

  // DD/MM/YYYY or DD-MM-YYYY (Indian CRM format)
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) {
    return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]))
  }

  // DD MMM YYYY (e.g. "22 Feb 2026")
  const dmy2 = s.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/)
  if (dmy2) {
    return new Date(`${dmy2[2]} ${dmy2[1]}, ${dmy2[3]}`)
  }

  // ISO and everything else — let JS try
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

// Yesterday or older — i.e., NOT today (any past date)
function isYesterdayOrOlder(dateStr) {
  const d = parseDate(dateStr)
  if (!d) return false
  const today = new Date()
  return daysDiff(today, d) >= 1
}

// 3 or more days ago
function daysAgoOrMore(dateStr, days) {
  const d = parseDate(dateStr)
  if (!d) return false
  const today = new Date()
  return daysDiff(today, d) >= days
}

// 🔑 NEW IN v3: Is this date today (in local timezone)?
// Used to detect "counsellor already spoke to this lead today".
// If `Counsellor Last Activity Date` is today, the lead is excluded —
// regardless of whether the CRM has updated the Stage column yet.
function isToday(dateStr) {
  const d = parseDate(dateStr)
  if (!d) return false
  return daysDiff(new Date(), d) === 0
}

// Empty / missing last activity is treated as "never contacted" → include.
function spokeToday(lastActivityStr) {
  if (!lastActivityStr) return false
  return isToday(lastActivityStr)
}

// ============================================================================
// SECTION 1: Fresh Leads from Lead Dump
// ============================================================================
//
// FILTER:
//   - User Type = "lead"
//   - Lead Stage = "Untouched"
//   - Counsellor = [logged-in user]
//   - Registered On <= yesterday
//   - Counsellor Last Activity != today  <-- v3
//
// WHY THE LAST CHECK:
//   When a counsellor calls a lead, the CRM logs an activity (BK gets
//   stamped with the call time) but the Stage column may not flip from
//   "Untouched" to "Counseled"/"NCE" until the counsellor manually updates
//   it. Without the v3 check, the lead would keep appearing in this tab
//   throughout the day even though it's already been contacted.
//
//   Leads not contacted today carry forward automatically: tomorrow, the
//   same filter still passes (last activity will be from a previous day,
//   not today), so the lead reappears.
// ============================================================================
export function getFreshLeads(leadDumpRows, counsellorName) {
  const dataRows = leadDumpRows.slice(1)
  const allMatching = dataRows.filter(row => {
    const userType = (getCol(row, 'AG') || '').toLowerCase().trim()
    const leadStage = (getCol(row, 'BD') || '').trim()
    const counsellor = (getCol(row, 'BC') || '').trim()
    const registeredOn = getCol(row, 'BA')
    return (
      userType === 'lead' &&
      leadStage === 'Untouched' &&
      counsellor === counsellorName &&
      isYesterdayOrOlder(registeredOn)
    )
  })

  // Split into "spoken today" (excluded) vs "actionable" (included).
  const spokenToday = []
  const actionable = []
  allMatching.forEach(row => {
    const target = spokeToday(getCol(row, 'BK')) ? spokenToday : actionable
    target.push(row)
  })

  const mapped = actionable.map(row => ({
    name: getCol(row, 'A'),
    email: getCol(row, 'B'),
    mobile: getCol(row, 'C'),
    source: getCol(row, 'G'),
    registeredOn: getCol(row, 'BA'),
    medium: getCol(row, 'H'),
    counsellorLastActivity: getCol(row, 'BK'),
    campaign: getCol(row, 'I'),
    stage: getCol(row, 'BD'),
    subStage: getCol(row, 'BE'),
    notes: getCol(row, 'BP'),
    score: parseFloat(getCol(row, 'BV')) || 0,
    counsellor: getCol(row, 'BC'),
    priority: '',
    category: 'Fresh Lead'
  }))

  return { leads: mapped, spokenTodayCount: spokenToday.length }
}

// ============================================================================
// SECTION 2: Followup Leads from Followup Sheet - LEAD
// ============================================================================
//
// FILTER:
//   - Counsellor = [logged-in user]
//   - User Type = "lead"
//   - IF Stage = "Counseled"            -> Last Activity >= 3 days ago
//   - IF Stage = "No Contact Established" -> Last Activity <= yesterday
//
// NOTE ON "SPOKEN TODAY":
//   The two date conditions above mathematically exclude today by definition
//   ("3 days ago" and "yesterday or older" both reject today). So no
//   additional v3 check is needed here -- the section is self-correcting.
//   We still count any edge-case rows where last activity is today for
//   UI transparency.
// ============================================================================
export function getFollowupLeads(followupLeadRows, counsellorName) {
  const dataRows = followupLeadRows.slice(1)

  let spokenTodayCount = 0
  const actionable = []

  dataRows.forEach(row => {
    const counsellor = (getCol(row, 'BC') || '').trim()
    const userType = (getCol(row, 'AG') || '').toLowerCase().trim()
    const leadStage = (getCol(row, 'BD') || '').trim()
    const lastActivity = getCol(row, 'BK')

    if (counsellor !== counsellorName || userType !== 'lead') return

    // Defensive: if last activity is today, count and skip (covers any
    // future filter relaxation; current date filters already exclude this).
    if (spokeToday(lastActivity)) {
      const isRelevantStage =
        leadStage === 'Counseled' || leadStage === 'No Contact Established'
      if (isRelevantStage) spokenTodayCount += 1
      return
    }

    if (leadStage === 'Counseled' && daysAgoOrMore(lastActivity, 3)) {
      actionable.push(row)
    } else if (
      leadStage === 'No Contact Established' &&
      isYesterdayOrOlder(lastActivity)
    ) {
      actionable.push(row)
    }
  })

  const mapped = actionable.map(row => ({
    name: getCol(row, 'A'),
    email: getCol(row, 'B'),
    mobile: getCol(row, 'C'),
    source: getCol(row, 'G'),
    registeredOn: getCol(row, 'BA'),
    medium: getCol(row, 'H'),
    counsellorLastActivity: getCol(row, 'BK'),
    campaign: getCol(row, 'I'),
    stage: getCol(row, 'BD'),
    subStage: getCol(row, 'BE'),
    notes: getCol(row, 'BP'),
    score: parseFloat(getCol(row, 'BV')) || 0,
    counsellor: getCol(row, 'BC'),
    priority: getCol(row, 'BW'),
    category: 'Followup Lead'
  }))

  return { leads: mapped, spokenTodayCount }
}

// ============================================================================
// SECTION 3: New App Starts from "New - App start"
// ============================================================================
//
// FILTER:
//   - Counsellor = [logged-in user]
//   - Application Stage = "Untouched"
//   - Form Started <= yesterday
//   - Counsellor Last Activity != today  <-- v3
//
// (Same lag-window rationale as Section 1.)
// ============================================================================
export function getNewAppStart(newAppStartRows, counsellorName) {
  const dataRows = newAppStartRows.slice(1)

const allMatching = dataRows.filter(row => {
    const counsellor = (getCol(row, 'AR') || '').trim()
    const appStage = (getCol(row, 'AU') || '').trim()
    const formStart = getCol(row, 'Q')
    return (
      counsellor === counsellorName &&
      appStage === 'Untouched' &&
      isYesterdayOrOlder(formStart)
    )
  })

  const spokenToday = []
  const actionable = []
  allMatching.forEach(row => {
    const target = spokeToday(getCol(row, 'BG')) ? spokenToday : actionable
    target.push(row)
  })

  const mapped = actionable.map(row => ({
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
    category: 'New App Start'
  }))

  return { leads: mapped, spokenTodayCount: spokenToday.length }
}

// ============================================================================
// SECTION 4: App Followups from "Followup sheet - App start"
// ============================================================================
//
// Same shape as Section 2, applied to application-side data.
// Existing date filters mathematically exclude today; we still count
// today-activity rows for UI transparency.
// ============================================================================
export function getAppFollowup(appFollowupRows, counsellorName) {
  const dataRows = appFollowupRows.slice(1)

  let spokenTodayCount = 0
  const actionable = []

  dataRows.forEach(row => {
    const counsellor = (getCol(row, 'AR') || '').trim()
    const appStage = (getCol(row, 'AU') || '').trim()
    const lastActivity = getCol(row, 'BG')

    if (counsellor !== counsellorName) return

    if (spokeToday(lastActivity)) {
      const isRelevantStage =
        appStage === 'Counseled' || appStage === 'No Contact Established'
      if (isRelevantStage) spokenTodayCount += 1
      return
    }

    if (appStage === 'Counseled' && daysAgoOrMore(lastActivity, 3)) {
      actionable.push(row)
    } else if (
      appStage === 'No Contact Established' &&
      isYesterdayOrOlder(lastActivity)
    ) {
      actionable.push(row)
    }
  })

  const mapped = actionable.map(row => ({
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
    category: 'App Followup'
  }))

  return { leads: mapped, spokenTodayCount }
}

// ============================================================================
// SORTING & ALLOCATION
// ============================================================================

function sortLeads(leads) {
  return leads.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const aPrio = parseInt((a.priority || '').replace(/\D/g, '')) || 99
    const bPrio = parseInt((b.priority || '').replace(/\D/g, '')) || 99
    return aPrio - bPrio
  })
}

export function allocateLeads(fresh, followup, newApp, appFollowup, totalTarget = 200) {
  const ratios = { fresh: 0.295, followup: 0.243, newApp: 0.183, appFollowup: 0.279 }

  const sortedFresh = sortLeads([...fresh])
  const sortedFollowup = sortLeads([...followup])
  const sortedNewApp = sortLeads([...newApp])
  const sortedAppFollowup = sortLeads([...appFollowup])

  let targetFresh = Math.round(totalTarget * ratios.fresh)
  let targetFollowup = Math.round(totalTarget * ratios.followup)
  let targetNewApp = Math.round(totalTarget * ratios.newApp)
  let targetAppFollowup = totalTarget - targetFresh - targetFollowup - targetNewApp

  const allocFresh = sortedFresh.slice(0, targetFresh)
  const allocFollowup = sortedFollowup.slice(0, targetFollowup)
  const allocNewApp = sortedNewApp.slice(0, targetNewApp)
  const allocAppFollowup = sortedAppFollowup.slice(0, targetAppFollowup)

  const shortfall =
    totalTarget -
    (allocFresh.length +
      allocFollowup.length +
      allocNewApp.length +
      allocAppFollowup.length)

  if (shortfall > 0) {
    const remainder = [
      ...sortedFresh.slice(targetFresh),
      ...sortedFollowup.slice(targetFollowup),
      ...sortedNewApp.slice(targetNewApp),
      ...sortedAppFollowup.slice(targetAppFollowup)
    ]
    const fillUp = sortLeads(remainder).slice(0, shortfall)
    fillUp.forEach(lead => {
      if (lead.category === 'Fresh Lead') allocFresh.push(lead)
      else if (lead.category === 'Followup Lead') allocFollowup.push(lead)
      else if (lead.category === 'New App Start') allocNewApp.push(lead)
      else if (lead.category === 'App Followup') allocAppFollowup.push(lead)
    })
  }

  return {
    freshLeads: allocFresh,
    followupLeads: allocFollowup,
    newAppStart: allocNewApp,
    appFollowup: allocAppFollowup,
    total:
      allocFresh.length +
      allocFollowup.length +
      allocNewApp.length +
      allocAppFollowup.length
  }
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================
export async function getLeadsForCounsellor(counsellorName) {
  const [leadDump, followupLead, newAppStart, appFollowup] = await Promise.all([
    fetchSheetData('Lead Dump', 'A:BZ'),
    fetchSheetData('Followup Sheet - LEAD', 'A:BZ'),
    fetchSheetData('New - App start', 'A:EU'),
    fetchSheetData('Followup sheet - App start', 'A:EU')
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
    300
  )

  // v3: also surface "spoken today" counts so the UI can show counsellors
  // exactly how many leads were filtered out today and trust the dashboard.
  const spokenToday = {
    fresh: fresh.spokenTodayCount,
    followup: followup.spokenTodayCount,
    newApp: newApp.spokenTodayCount,
    appFollowup: appFu.spokenTodayCount,
    total:
      fresh.spokenTodayCount +
      followup.spokenTodayCount +
      newApp.spokenTodayCount +
      appFu.spokenTodayCount
  }

  return { ...allocation, spokenToday }
}
