import { fetchSheetData, getCol } from './sheetsApi'

// ============================================================================
// COLUMN REFERENCE — new compact sheet (2 main sheets only)
// ============================================================================
//
// LEAD DUMP (fresh + followup leads in one sheet):
//   A   Name                          AG  User Type
//   B   Email                         BA  Registered On
//   C   Mobile                        BC  Counsellor
//   G   Primary Source                BD  Lead Stage
//   H   Primary Medium                BE  Lead Sub Stage
//   I   Primary Campaign              BK  Counsellor Last Activity Date
//                                     BP  Notes
//                                     CF  Total Lead Score
//                                     CG  Priority
//
// APP START DUMP (new + followup app starts in one sheet):
//   B   Application Number            AT  Lead Stage
//   C   Payment Status                AU  Application Stage
//   M   Name                          AV  Application Sub Stage
//   N   Email                         BG  Counsellor Last Activity Date
//   O   Mobile                        BM  Notes
//   Q   Registered On                 ET  Total Score
//   S   Source                        EU  Followup Priority
//   T   Medium
//   U   Campaign
//   W   Primary Medium
//   AR  Counsellor
//
// ============================================================================

// ============================================================================
// VALID SUB-STAGES FOR FOLLOWUP INCLUSION
// ============================================================================

const LEAD_COUNSELED_SUBSTAGES  = new Set(['hot', 'warm', 'cold'])
const LEAD_NCE_SUBSTAGES        = new Set(['call later', 'disconnected', 'dnp', 'dnp2', 'not reachable'])
const APP_COUNSELED_SUBSTAGES   = new Set(['hot', 'warm', 'cold'])
const APP_NCE_SUBSTAGES         = new Set(['call later', 'dnp', 'dnp2'])

// ============================================================================
// CAMPAIGN BLACKOUT HELPERS
// ============================================================================

export function parseBlackouts(rows) {
  if (!rows || rows.length < 2) return []
  return rows.slice(1)
    .map(row => ({
      campaign:  String(row[0] || '').trim(),
      source:    String(row[1] || '').trim(),
      startDate: row[2] ? String(row[2]).trim() : '',
      endDate:   row[3] ? String(row[3]).trim() : '',
    }))
    .filter(b => b.campaign)
}

function isBlackedOut(lead, blackouts) {
  if (!blackouts || blackouts.length === 0) return false
  const today = startOfDayBlackout(new Date())
  const leadCampaign = String(lead.blackoutCampaign || lead.campaign || '').trim().toLowerCase()
  const leadSource   = String(lead.source || '').trim().toLowerCase()
  return blackouts.some(b => {
    if (b.campaign && leadCampaign !== b.campaign.toLowerCase()) return false
    if (b.source   && leadSource   !== b.source.toLowerCase())   return false
    const start = b.startDate ? parseDateBlackout(b.startDate) : null
    const end   = b.endDate   ? parseDateBlackout(b.endDate)   : null
    if (start && today < startOfDayBlackout(start)) return false
    if (end   && today > startOfDayBlackout(end))   return false
    return true
  })
}

function parseDateBlackout(val) {
  if (!val) return null
  const s = String(val).trim()
  const n = Number(s)
  if (!isNaN(n) && n > 40000 && n < 60000) return new Date((Math.floor(n) - 25569) * 86400 * 1000)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]))
  const d = new Date(s)
  return isNaN(d) ? null : d
}
function startOfDayBlackout(date) {
  const d = new Date(date); d.setHours(0, 0, 0, 0); return d
}

// ============================================================================
// DATE HELPERS
// ============================================================================

function parseDate(dateStr) {
  if (dateStr === null || dateStr === undefined || dateStr === '') return null
  const s = String(dateStr).trim()
  if (!s) return null

  // PRIMARY PATH: serial number from UNFORMATTED_VALUE (e.g. 46152.79)
  const numVal = Number(s)
  if (!isNaN(numVal) && numVal > 40000 && numVal < 60000) {
    return new Date((Math.floor(numVal) - 25569) * 86400 * 1000)
  }

  // ISO 8601: YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]))
  }

  // DD/MM/YYYY or MM/DD/YYYY — disambiguate by value
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) {
    const p1 = parseInt(dmy[1]), p2 = parseInt(dmy[2]), year = parseInt(dmy[3])
    if (p1 > 12) return new Date(year, p2 - 1, p1)
    if (p2 > 12) return new Date(year, p1 - 1, p2)
    return new Date(year, p2 - 1, p1)
  }

  // DD MMM YYYY (e.g. "22 Feb 2026")
  const dmy2 = s.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/)
  if (dmy2) {
    return new Date(`${dmy2[2]} ${dmy2[1]}, ${dmy2[3]}`)
  }

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

function isYesterdayOrOlder(dateStr) {
  const d = parseDate(dateStr)
  if (!d) return false
  return daysDiff(new Date(), d) >= 1
}

function daysAgoOrMore(dateStr, days) {
  const d = parseDate(dateStr)
  if (!d) return false
  return daysDiff(new Date(), d) >= days
}

function isToday(dateStr) {
  const d = parseDate(dateStr)
  if (!d) return false
  return daysDiff(new Date(), d) === 0
}

// Empty / missing last activity = never contacted → do NOT skip.
function spokeToday(lastActivityStr) {
  if (!lastActivityStr) return false
  return isToday(lastActivityStr)
}

// ============================================================================
// SECTION 1: Fresh Leads — from "Lead Dump" where Lead Stage = "Untouched"
// ============================================================================
//
// FILTER:
//   AG (User Type)              = "lead"
//   AJ (Payment Status)         ≠ "Completed"
//   BD (Lead Stage)             = "Untouched"
//   BC (Counsellor)             = [logged-in counsellor]
//   BA (Registered On)          ≤ yesterday
//   BK (Counsellor Last Activ)  ≠ today   ← lag-window: just-called leads stay
//                                           hidden until tomorrow
// ============================================================================
export function getFreshLeads(leadDumpRows, counsellorName) {
  const normName = counsellorName.toLowerCase()
  const dataRows = leadDumpRows.slice(1)

  const allMatching = dataRows.filter(row => {
    const userType      = (getCol(row, 'AG') || '').toLowerCase().trim()
    const paymentStatus = (getCol(row, 'AJ') || '').toLowerCase().trim()
    const leadStage     = (getCol(row, 'BD') || '').toLowerCase().trim()
    const counsellor    = (getCol(row, 'BC') || '').trim().toLowerCase()
    const regOn         = getCol(row, 'BA')
    return (
      userType === 'lead' &&
      paymentStatus !== 'completed' &&
      leadStage === 'untouched' &&
      counsellor === normName &&
      isYesterdayOrOlder(regOn)
    )
  })

  const spokenToday = []
  const actionable  = []
  allMatching.forEach(row => {
    const bucket = spokeToday(getCol(row, 'BK')) ? spokenToday : actionable
    bucket.push(row)
  })

  const mapped = actionable.map(row => ({
    name:                   getCol(row, 'A'),
    email:                  getCol(row, 'B'),
    mobile:                 getCol(row, 'C'),
    source:                 getCol(row, 'G'),
    registeredOn:           getCol(row, 'BA'),
    medium:                 getCol(row, 'H'),
    counsellorLastActivity: getCol(row, 'BK'),
    campaign:               getCol(row, 'I'),
    blackoutCampaign:       getCol(row, 'H'),
    stage:                  getCol(row, 'BD'),
    subStage:               getCol(row, 'BE'),
    notes:                  getCol(row, 'BP'),
    score:                  parseFloat(getCol(row, 'CF')) || 0,
    counsellor:             getCol(row, 'BC'),
    priority:               '',
    category:               'Fresh Lead',
  }))

  return { leads: mapped, spokenTodayCount: spokenToday.length }
}

// ============================================================================
// SECTION 2: Followup Leads — from "Lead Dump" where Lead Stage ≠ "Untouched"
// ============================================================================
//
// FILTER (stage + sub-stage gate replaces separate Followup sheet):
//   AG (User Type)   = "lead"
//   BC (Counsellor)  = [logged-in counsellor]
//
//   Counseled path:
//     BD = "Counseled" AND BE ∈ [Hot, Warm, Cold] AND BK ≥ 3 days ago
//
//   NCE path:
//     BD = "No Contact Established"
//     AND BE ∈ [Call later, Disconnected, DNP, DNP2, Not Reachable]
//     AND (BK empty OR BK ≤ yesterday)
//
// Score → CF   Priority → CG   (Priority 5 excluded)
// ============================================================================
export function getFollowupLeads(leadDumpRows, counsellorName) {
  const normName = counsellorName.toLowerCase()
  const dataRows = leadDumpRows.slice(1)

  let spokenTodayCount = 0
  const actionable = []

  dataRows.forEach(row => {
    const counsellor    = (getCol(row, 'BC') || '').trim().toLowerCase()
    const userType      = (getCol(row, 'AG') || '').toLowerCase().trim()
    const paymentStatus = (getCol(row, 'AJ') || '').toLowerCase().trim()
    const leadStage     = (getCol(row, 'BD') || '').toLowerCase().trim()
    const subStage      = (getCol(row, 'BE') || '').toLowerCase().trim()
    const lastAct       = getCol(row, 'BK')

    if (counsellor !== normName || userType !== 'lead') return
    if (paymentStatus === 'completed') return

    if (spokeToday(lastAct)) {
      if (leadStage === 'counseled' || leadStage === 'no contact established') {
        spokenTodayCount++
      }
      return
    }

    if (leadStage === 'counseled' && LEAD_COUNSELED_SUBSTAGES.has(subStage) && daysAgoOrMore(lastAct, 3)) {
      actionable.push(row)
    } else if (leadStage === 'no contact established' && LEAD_NCE_SUBSTAGES.has(subStage)) {
      if (!lastAct || isYesterdayOrOlder(lastAct)) {
        actionable.push(row)
      }
    }
  })

  const mapped = actionable
    .map(row => ({
      name:                   getCol(row, 'A'),
      email:                  getCol(row, 'B'),
      mobile:                 getCol(row, 'C'),
      source:                 getCol(row, 'G'),
      registeredOn:           getCol(row, 'BA'),
      medium:                 getCol(row, 'H'),
      counsellorLastActivity: getCol(row, 'BK'),
      campaign:               getCol(row, 'I'),
      blackoutCampaign:       getCol(row, 'H'),
      stage:                  getCol(row, 'BD'),
      subStage:               getCol(row, 'BE'),
      notes:                  getCol(row, 'BP'),
      score:                  parseFloat(getCol(row, 'CF')) || 0,
      counsellor:             getCol(row, 'BC'),
      priority:               getCol(row, 'CG'),
      category:               'Followup Lead',
    }))
    .filter(lead => (lead.priority || '').toLowerCase() !== 'priority 5')

  return { leads: mapped, spokenTodayCount }
}

// ============================================================================
// SECTION 3: New App Starts — from "App Start Dump" where AU = "Untouched"
// ============================================================================
//
// FILTER:
//   AR (Counsellor)        = [logged-in counsellor]
//   AU (Application Stage) = "Untouched"
//   AT (Lead Stage)        ≠ "Paid" AND ≠ "Counseled"
//   C  (Payment Status)    ≠ "Completed"
//   S  (Source)            ≠ "pmax"  — EXCEPT if pmax AND B (App Number) > 0
//   Q  (Registered On)     ≤ yesterday
//   BG (Counsellor Last Activ) ≠ today   ← lag-window fix
// ============================================================================
export function getNewAppStart(appStartDumpRows, counsellorName) {
  const normName = counsellorName.toLowerCase()
  const dataRows = appStartDumpRows.slice(1)

  const allMatching = dataRows.filter(row => {
    const counsellor    = (getCol(row, 'AR') || '').trim().toLowerCase()
    const appStage      = (getCol(row, 'AU') || '').toLowerCase().trim()
    const leadStage     = (getCol(row, 'AT') || '').toLowerCase().trim()
    const paymentStatus = (getCol(row, 'C')  || '').toLowerCase().trim()
    const source        = (getCol(row, 'S')  || '').toLowerCase().trim()
    const appNumber     = parseFloat(getCol(row, 'B')) || 0
    const regOn         = getCol(row, 'Q')

    if (counsellor !== normName)                          return false
    if (appStage !== 'untouched')                         return false
    if (leadStage === 'paid' || leadStage === 'counseled') return false
    if (paymentStatus === 'completed')                    return false
    // pmax excluded unless Application Number > 0
    if (source === 'pmax' && appNumber <= 0)     return false

    return isYesterdayOrOlder(regOn)
  })

  const spokenToday = []
  const actionable  = []
  allMatching.forEach(row => {
    const lastAct = getCol(row, 'BG')
    const bucket  = spokeToday(lastAct) ? spokenToday : actionable
    bucket.push(row)
  })

  const mapped = actionable.map(row => ({
    name:                   getCol(row, 'M'),
    email:                  getCol(row, 'N'),
    mobile:                 getCol(row, 'O'),
    source:                 getCol(row, 'S'),
    registeredOn:           getCol(row, 'Q'),
    medium:                 getCol(row, 'T'),
    counsellorLastActivity: getCol(row, 'BG'),
    campaign:               getCol(row, 'U'),
    blackoutCampaign:       getCol(row, 'W'),
    stage:                  getCol(row, 'AU'),
    subStage:               getCol(row, 'AV'),
    notes:                  getCol(row, 'BM'),
    score:                  parseFloat(getCol(row, 'ET')) || 0,
    counsellor:             getCol(row, 'AR'),
    priority:               '',
    category:               'New App Start',
  }))

  return { leads: mapped, spokenTodayCount: spokenToday.length }
}

// ============================================================================
// SECTION 4: App Followups — from "App Start Dump" where AU ≠ "Untouched"
// ============================================================================
//
// PRE-FILTERS (applied to all paths):
//   C (Payment Status) ≠ "Completed"
//   S (Source)         ≠ "pmax"
//   AR (Counsellor)    = [logged-in counsellor]
//
// Counseled path:
//   AU = "Counseled" AND AV ∈ [Hot, Warm, Cold] AND BG ≥ 3 days ago
//
// NCE path:
//   AU = "No Contact Established"
//   AND AV ∈ [Call later, DNP, DNP2]
//   AND (BG empty OR BG ≤ yesterday)
//
// Lead Stage path:
//   AT = "Counseled" AND BG ≥ 3 days ago
//
// Priority 5 (EU) excluded.
// ============================================================================
export function getAppFollowup(appStartDumpRows, counsellorName) {
  const normName = counsellorName.toLowerCase()
  const dataRows = appStartDumpRows.slice(1)

  let spokenTodayCount = 0
  const actionable = []

  dataRows.forEach(row => {
    const counsellor    = (getCol(row, 'AR') || '').trim().toLowerCase()
    const appStage      = (getCol(row, 'AU') || '').toLowerCase().trim()
    const appSubStage   = (getCol(row, 'AV') || '').toLowerCase().trim()
    const leadStage     = (getCol(row, 'AT') || '').toLowerCase().trim()
    const paymentStatus = (getCol(row, 'C')  || '').toLowerCase().trim()
    const source        = (getCol(row, 'S')  || '').toLowerCase().trim()
    const lastAct       = getCol(row, 'BG')

    if (counsellor !== normName)  return
    if (paymentStatus === 'completed')  return
    if (source === 'pmax')              return

    if (spokeToday(lastAct)) {
      if (
        appStage === 'counseled' ||
        appStage === 'no contact established' ||
        leadStage === 'counseled'
      ) spokenTodayCount++
      return
    }

    if (appStage === 'counseled' && APP_COUNSELED_SUBSTAGES.has(appSubStage) && daysAgoOrMore(lastAct, 3)) {
      actionable.push(row)
    } else if (appStage === 'no contact established' && APP_NCE_SUBSTAGES.has(appSubStage)) {
      if (!lastAct || isYesterdayOrOlder(lastAct)) {
        actionable.push(row)
      }
    } else if (leadStage === 'counseled' && daysAgoOrMore(lastAct, 3)) {
      actionable.push(row)
    }
  })

  const mapped = actionable
    .map(row => ({
      name:                   getCol(row, 'M'),
      email:                  getCol(row, 'N'),
      mobile:                 getCol(row, 'O'),
      source:                 getCol(row, 'S'),
      registeredOn:           getCol(row, 'Q'),
      medium:                 getCol(row, 'T'),
      counsellorLastActivity: getCol(row, 'BG'),
      campaign:               getCol(row, 'U'),
      blackoutCampaign:       getCol(row, 'W'),
      stage:                  getCol(row, 'AU'),
      subStage:               getCol(row, 'AV'),
      notes:                  getCol(row, 'BM'),
      score:                  parseFloat(getCol(row, 'ET')) || 0,
      counsellor:             getCol(row, 'AR'),
      priority:               getCol(row, 'EU'),
      category:               'App Followup',
    }))
    .filter(lead => (lead.priority || '').toLowerCase() !== 'priority 5')

  return { leads: mapped, spokenTodayCount }
}

// ============================================================================
// SECTION 5: My Counselling — all Counseled records for this counsellor
//   App Start rows first (AU = "Counseled", not Completed)
//   Lead rows after   (BD = "Counseled", not Completed)
//   Each group sorted by score desc, preserving table order within group.
// ============================================================================
export function getMyCounselling(leadDumpRows, appStartDumpRows, counsellorName) {
  const normName = counsellorName.toLowerCase()
  const DISQUALIFIED = new Set(['not interested', 'not eligible', 'intent dropped'])

  // App Start counsellings
  // Bug 4 fix: include rows where either AU (Application Stage) OR AT (Lead Stage) = "Counseled"
  // Anomaly fix: if either stage is a disqualified stage, the lead is NOT counseled regardless.
  const appRows = appStartDumpRows.slice(1)
    .filter(row => {
      const counsellor    = (getCol(row, 'AR') || '').trim().toLowerCase()
      const appStage      = (getCol(row, 'AU') || '').toLowerCase().trim()
      const leadStageAT   = (getCol(row, 'AT') || '').toLowerCase().trim()
      const paymentStatus = (getCol(row, 'C')  || '').toLowerCase().trim()
      return (
        counsellor === normName &&
        (appStage === 'counseled' || leadStageAT === 'counseled') &&
        !DISQUALIFIED.has(appStage) &&
        !DISQUALIFIED.has(leadStageAT) &&
        paymentStatus !== 'completed'
      )
    })
    .map(row => {
      const appStage = (getCol(row, 'AU') || '').toLowerCase().trim()
      return {
        name:                   getCol(row, 'M'),
        email:                  getCol(row, 'N'),
        mobile:                 getCol(row, 'O'),
        source:                 getCol(row, 'S'),
        registeredOn:           getCol(row, 'Q'),
        medium:                 getCol(row, 'T'),
        counsellorLastActivity: getCol(row, 'BG'),
        campaign:               getCol(row, 'U'),
        blackoutCampaign:       getCol(row, 'W'),
        stage:                  appStage === 'counseled' ? getCol(row, 'AU') : getCol(row, 'AT'),
        subStage:               getCol(row, 'AV'),
        notes:                  getCol(row, 'BM'),
        score:                  parseFloat(getCol(row, 'ET')) || 0,
        counsellor:             getCol(row, 'AR'),
        priority:               getCol(row, 'EU'),
        category:               'App Counselling',
        bucket:                 (getCol(row, 'AV') || '').toLowerCase().trim(),
      }
    })
    .sort((a, b) => b.score - a.score)

  // Lead counsellings (AG="lead" filter already present — Bug 2 already correct)
  const leadRows = leadDumpRows.slice(1)
    .filter(row => {
      const counsellor    = (getCol(row, 'BC') || '').trim().toLowerCase()
      const userType      = (getCol(row, 'AG') || '').toLowerCase().trim()
      const leadStage     = (getCol(row, 'BD') || '').toLowerCase().trim()
      const paymentStatus = (getCol(row, 'AJ') || '').toLowerCase().trim()
      return (
        counsellor === normName &&
        userType === 'lead' &&
        leadStage === 'counseled' &&
        paymentStatus !== 'completed'
      )
    })
    .map(row => ({
      name:                   getCol(row, 'A'),
      email:                  getCol(row, 'B'),
      mobile:                 getCol(row, 'C'),
      source:                 getCol(row, 'G'),
      registeredOn:           getCol(row, 'BA'),
      medium:                 getCol(row, 'H'),
      counsellorLastActivity: getCol(row, 'BK'),
      campaign:               getCol(row, 'I'),
      blackoutCampaign:       getCol(row, 'H'),
      stage:                  getCol(row, 'BD'),
      subStage:               getCol(row, 'BE'),
      notes:                  getCol(row, 'BP'),
      score:                  parseFloat(getCol(row, 'CF')) || 0,
      counsellor:             getCol(row, 'BC'),
      priority:               getCol(row, 'CG'),
      category:               'Lead Counselling',
      bucket:                 (getCol(row, 'BE') || '').toLowerCase().trim(),
    }))
    .sort((a, b) => b.score - a.score)

  // Bug 1 fix: cross-type dedup by phone/email — App Start wins over Lead for same person
  const seen = new Set()
  return [...appRows, ...leadRows].filter(row => {
    const phone = String(row.mobile || '').replace(/\D/g, '').slice(-10)
    const key   = phone || (row.email || '').toLowerCase()
    if (!key) return true
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
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

export function allocateLeads(fresh, followup, newApp, appFollowup, totalTarget = 300) {
  const ratios = { fresh: 0.295, followup: 0.243, newApp: 0.183, appFollowup: 0.279 }

  const sortedFresh       = sortLeads([...fresh])
  const sortedFollowup    = sortLeads([...followup])
  const sortedNewApp      = sortLeads([...newApp])
  const sortedAppFollowup = sortLeads([...appFollowup])

  const targetFresh       = Math.round(totalTarget * ratios.fresh)        // 89
  const targetFollowup    = Math.round(totalTarget * ratios.followup)     // 73
  const targetNewApp      = Math.round(totalTarget * ratios.newApp)       // 55
  const targetAppFollowup = totalTarget - targetFresh - targetFollowup - targetNewApp // 83

  const allocFresh       = sortedFresh.slice(0, targetFresh)
  const allocFollowup    = sortedFollowup.slice(0, targetFollowup)
  const allocNewApp      = sortedNewApp.slice(0, targetNewApp)
  const allocAppFollowup = sortedAppFollowup.slice(0, targetAppFollowup)

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
      if (lead.category === 'Fresh Lead')     allocFresh.push(lead)
      else if (lead.category === 'Followup Lead')  allocFollowup.push(lead)
      else if (lead.category === 'New App Start')  allocNewApp.push(lead)
      else allocAppFollowup.push(lead)
    })
  }

  return {
    freshLeads:   allocFresh,
    followupLeads: allocFollowup,
    newAppStart:  allocNewApp,
    appFollowup:  allocAppFollowup,
    total: allocFresh.length + allocFollowup.length + allocNewApp.length + allocAppFollowup.length,
  }
}

// ============================================================================
// MAIN ENTRY POINT — fetches 2 sheets (was 4)
// ============================================================================
async function fetchCached(sheet, range) {
  try {
    const params = new URLSearchParams({ action: 'fetch', sheet, range })
    const r = await fetch(`/api/sheets?${params}`)
    if (!r.ok) throw new Error(`${r.status}`)
    const d = await r.json()
    return d.rows || []
  } catch {
    // Fallback: direct Sheets API if server cache is unavailable
    return fetchSheetData(sheet, range)
  }
}

export async function getLeadsForCounsellor(counsellorName) {
  const [leadDump, appStartDump, blackoutsRaw] = await Promise.all([
    fetchCached('Lead Dump',          'A:CG'),
    fetchCached('App Start Dump',     'A:EU'),
    fetchCached('Campaign Blackouts', 'A:D').catch(() => []),
  ])

  const blackouts     = parseBlackouts(blackoutsRaw)
  const applyBlackout = leads => leads.filter(l => !isBlackedOut(l, blackouts))

  const fresh    = getFreshLeads(leadDump,      counsellorName)
  const followup = getFollowupLeads(leadDump,   counsellorName)
  const newApp   = getNewAppStart(appStartDump, counsellorName)
  const appFu    = getAppFollowup(appStartDump, counsellorName)

  const allocation = allocateLeads(
    applyBlackout(fresh.leads),
    applyBlackout(followup.leads),
    applyBlackout(newApp.leads),
    applyBlackout(appFu.leads),
    300
  )

  const spokenToday = {
    fresh:       fresh.spokenTodayCount,
    followup:    followup.spokenTodayCount,
    newApp:      newApp.spokenTodayCount,
    appFollowup: appFu.spokenTodayCount,
    total:
      fresh.spokenTodayCount +
      followup.spokenTodayCount +
      newApp.spokenTodayCount +
      appFu.spokenTodayCount,
  }

  const myCounselling = getMyCounselling(leadDump, appStartDump, counsellorName)

  return { ...allocation, spokenToday, myCounselling }
}
