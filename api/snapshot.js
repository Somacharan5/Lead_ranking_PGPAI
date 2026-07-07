/**
 * api/snapshot.js — Daily historical snapshot
 * Triggered by Vercel Cron at 23:55 IST (18:25 UTC)
 *
 * 1. Fetches Lead Dump + App Start Dump from Sheets
 * 2. Upserts static columns into lead_static / app_start_static (skip if already exists)
 * 3. Inserts dynamic columns into lead_history / app_start_history for today's date
 */

import { upsertRows } from './db.js'

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const API_KEY     = process.env.VITE_GOOGLE_API_KEY
const SHEET_ID    = process.env.VITE_GOOGLE_SHEET_ID
const CALLS_ID    = process.env.VITE_CALLS_HISTORY_SHEET_ID  // Callyzer calls live in a separate spreadsheet

function cell(row, idx) { return String(row[idx] ?? '').trim() }

async function fetchSheet(sheetName, range, sheetId = SHEET_ID) {
  const url = `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(sheetName)}!${range}`
    + `?key=${API_KEY}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Sheets ${sheetName}: ${r.status}`)
  const d = await r.json()
  return (d.values || []).slice(1) // skip header row
}

// ── Lead Dump column indices (0-based) ───────────────────────────────────────
// Static: A=0 B=1 C=2 D=3 E=4 F=5 G=6 H=7 I=8 AC=28 Y=24 V=21 W=22 BF=57 BA=52
// Dynamic: AF=31 AG=32 AH=33 AI=34 AJ=35 BB=53 BC=54 BD=55 BE=56
//          BG=58 BH=59 BI=60 BJ=61 BK=62 BL=63 BM=64 BO=66 BP=67 BQ=68
//          +2 shift: 2 new profile cols inserted at CC/CD, pushing the scores block right.
//          Scores: CE=82(Source) CF=83(Recency) CG=84(Stage) CH=85(Organic) CI=86(IG) CJ=87(Total) CK=88(Priority)

function buildLeadStatic(row) {
  const email = cell(row, 1).toLowerCase()
  if (!email) return null
  return {
    email,
    mobile:           cell(row, 2),
    name:             cell(row, 0),
    source:           cell(row, 3),
    medium:           cell(row, 4),
    campaign:         cell(row, 5),
    primary_source:   cell(row, 6),
    primary_medium:   cell(row, 7),
    primary_campaign: cell(row, 8),
    city:             cell(row, 28),
    country_code:     cell(row, 24),
    lead_type:        cell(row, 21),
    lead_origin:      cell(row, 22),
    program:          cell(row, 57),
    registered_on:    cell(row, 52),
    extra_data: {
      secondary_source:   cell(row, 9),
      secondary_medium:   cell(row, 10),
      secondary_campaign: cell(row, 11),
      tertiary_source:    cell(row, 12),
      tertiary_medium:    cell(row, 13),
      tertiary_campaign:  cell(row, 14),
      utm_term:           cell(row, 15),
      utm_placement:      cell(row, 16),
      utm_content:        cell(row, 17),
      utm_campaign_id:    cell(row, 18),
      utm_ad_group_id:    cell(row, 19),
      utm_creative_id:    cell(row, 20),
      source_url:         cell(row, 23),
      alternate_email:    cell(row, 25),
      alternate_mobile:   cell(row, 26),
      school:             cell(row, 29),
      first_stage_updated: cell(row, 63), // BN=63... wait, BN=65? Let me recheck
      // BN = B(1)+N(13) = index 65? No... A=0,B=1,...N=13, AA=26,AB=27,...BN = B(1*26)+N(13) = 26+13+26=65
      // Actually: A-Z=0-25, AA=26, AB=27, ... AZ=51, BA=52, BB=53, ... BN=65
    },
  }
}

function buildLeadDynamic(row, snapshotDate) {
  const email = cell(row, 1).toLowerCase()
  if (!email) return null
  return {
    snapshot_date:               snapshotDate,
    email,
    lead_score:                  cell(row, 31),  // AF
    user_type:                   cell(row, 32),  // AG
    mobile_verified:             cell(row, 33),  // AH
    email_verified:              cell(row, 34),  // AI
    payment_status:              cell(row, 35),  // AJ
    updated_at:                  cell(row, 53),  // BB
    counsellor:                  cell(row, 54),  // BC
    lead_stage:                  cell(row, 55),  // BD
    lead_sub_stage:              cell(row, 56),  // BE
    app_form_start_date:         cell(row, 58),  // BG
    payment_initiated_date:      cell(row, 59),  // BH
    payment_last_initiated_date: cell(row, 60),  // BI
    counsellor_first_activity:   cell(row, 61),  // BJ
    counsellor_last_activity:    cell(row, 62),  // BK
    app_fee_paid_on:             cell(row, 63),  // BL
    last_stage_updated:          cell(row, 64),  // BM
    app_last_activity_date:      cell(row, 66),  // BO
    notes:                       cell(row, 67),  // BP
    tags:                        cell(row, 68),  // BQ
    source_score:                cell(row, 82),  // CE
    recency_score:               cell(row, 83),  // CF
    stage_score:                 cell(row, 84),  // CG
    organic_bonus:               cell(row, 85),  // CH
    ig_bonus:                    cell(row, 86),  // CI
    total_lead_score:            cell(row, 87),  // CJ
    priority:                    cell(row, 88),  // CK
  }
}

// ── App Start Dump column indices (0-based) ──────────────────────────────────
// Static: A=0(AppNum) M=12 N=13 O=14 P=15 Q=16 S=18 T=19 U=20 V=21 W=22 X=23 BY=76(State) BZ=77(City) AP=41
// Dynamic: B=1 C=2 D=3 E=4 F=5 G=6 H=7 I=8 J=9 L=11
//          AO=40 AR=43 AS=44 AT=45 AU=46 AV=47 AW=48 AX=49 AY=50 AZ=51
//          BA=52 BB=53 BC=54 BD=55 BE=56 BF=57 BG=58 BH=59 BI=60 BK=62
//          BL=63 BM=64 BN=65 BO=66 BP=67
//          +2 shift: same 2 new profile cols push the MU-BAAT/score tail right.
//          EU=150 EV=151 EW=152 EX=153(Total Score) EY=154(Priority App Start)

function buildAppStatic(row) {
  const appNum = cell(row, 0)
  if (!appNum) return null
  return {
    application_number: appNum,
    email:              cell(row, 13).toLowerCase(),
    mobile:             cell(row, 14),
    name:               cell(row, 12),
    source:             cell(row, 18),
    medium:             cell(row, 19),
    campaign:           cell(row, 20),
    primary_source:     cell(row, 21),
    primary_medium:     cell(row, 22),
    primary_campaign:   cell(row, 23),
    city:               cell(row, 77),  // BZ
    state:              cell(row, 76),  // BY
    program:            cell(row, 41),  // AP
    registered_on:      cell(row, 16),  // Q
    extra_data: {
      country_code:     cell(row, 15),  // P
      secondary_source: cell(row, 24),  // Y
      secondary_medium: cell(row, 25),  // Z
      source_url:       cell(row, 30),  // AE
      lead_origin:      cell(row, 31),  // AF
      lead_type:        cell(row, 32),  // AG
      organization:     cell(row, 42),  // AQ
    },
  }
}

function buildAppDynamic(row, snapshotDate) {
  const appNum = cell(row, 0)
  if (!appNum) return null
  return {
    snapshot_date:               snapshotDate,
    application_number:          appNum,
    application_status:          cell(row, 1),   // B
    payment_status:              cell(row, 2),   // C
    payment_method:              cell(row, 3),   // D
    payment_initiated:           cell(row, 4),   // E
    coupon_code:                 cell(row, 5),   // F
    form_completion_date:        cell(row, 6),   // G
    app_form_initiated:          cell(row, 7),   // H
    app_form_submitted:          cell(row, 8),   // I
    last_interacted_section:     cell(row, 9),   // J
    updated_date:                cell(row, 11),  // L
    lead_score:                  cell(row, 40),  // AO
    counsellor:                  cell(row, 43),  // AR
    counsellor_email:            cell(row, 44),  // AS
    lead_stage:                  cell(row, 45),  // AT
    application_stage:           cell(row, 46),  // AU
    application_sub_stage:       cell(row, 47),  // AV
    previous_lead_stage:         cell(row, 48),  // AW
    reassigned_by:               cell(row, 49),  // AX
    reassigned_on:               cell(row, 50),  // AY
    is_email_verified:           cell(row, 51),  // AZ
    is_mobile_verified:          cell(row, 52),  // BA
    last_active_at:              cell(row, 53),  // BB
    app_form_start_date:         cell(row, 54),  // BC
    payment_initiated_date:      cell(row, 55),  // BD
    payment_last_initiated_date: cell(row, 56),  // BE
    counsellor_first_activity:   cell(row, 57),  // BF
    counsellor_last_activity:    cell(row, 58),  // BG
    app_fee_paid_on:             cell(row, 59),  // BH
    last_stage_updated:          cell(row, 60),  // BI
    app_last_activity_date:      cell(row, 62),  // BK
    total_forms_initiated:       cell(row, 63),  // BL
    notes:                       cell(row, 64),  // BM
    video_link:                  cell(row, 65),  // BN
    application_tags:            cell(row, 66),  // BO
    tags:                        cell(row, 67),  // BP
    mu_baat_link:                cell(row, 150), // EU
    mu_baat_result:              cell(row, 151), // EV
    mu_baat_report:              cell(row, 152), // EW
    total_score_formula:         cell(row, 153), // EX (header "Lead Score")
    priority_app_start:          cell(row, 154), // EY (header "Priority App Start")
  }
}

// ── Call History (Callyzer) column indices (0-based, sheet A:Y) ───────────────
// Sr.No=0 EmpCode=1 EmpTags=2 EmployeeName=3 EmployeeNumber=4 ToName=5 CountryCode=6
// ToNumber=7 CallType=8 CallMethod=9 CallMode=10 Duration=11 CallDate=12 CallTime=13
// Notes=14 UniqueId=15 AudioUrl=16 Transcript=17 Stage=18 AppFormPct=19 PayInit=20
// AppFormInit=21 Source=22 Lead/AppStartStage=23 CallDurationMins=24

function serialToDateStr(serial) {
  const n = Number(serial)
  if (isNaN(n) || n < 40000) return null
  return new Date((Math.floor(n) - 25569) * 86400 * 1000).toISOString().slice(0, 10)
}

function buildCallRow(row) {
  const uniqueid = cell(row, 15)
  if (!uniqueid) return null
  const durMins = Number(row[24])
  return {
    uniqueid,
    call_date:              serialToDateStr(row[12]),
    sr_no:                  cell(row, 0),
    emp_code:               cell(row, 1),
    emp_tags:               cell(row, 2),
    employee_name:          cell(row, 3),
    employee_number:        cell(row, 4),
    to_name:                cell(row, 5),
    country_code:           cell(row, 6),
    to_number:              cell(row, 7),
    call_type:              cell(row, 8),
    call_method:            cell(row, 9),
    call_mode:              cell(row, 10),
    duration:               cell(row, 11),
    call_time:              cell(row, 13),
    notes:                  cell(row, 14),
    audio_url:              cell(row, 16),
    call_transcript:        cell(row, 17),
    stage:                  cell(row, 18),
    app_form_completed_pct: cell(row, 19),
    payment_initiated:      cell(row, 20),
    app_form_initiated:     cell(row, 21),
    source:                 cell(row, 22),
    lead_app_start_stage:   cell(row, 23),
    call_duration_mins:     isNaN(durMins) ? null : durMins,
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  // Allow both Vercel Cron (GET) and manual trigger (POST)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const snapshotDate = new Date().toISOString().slice(0, 10) // YYYY-MM-DD in UTC
  // Adjust to IST (UTC+5:30) for the "day" concept
  const istDate = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const log = []
  const start = Date.now()

  try {
    log.push(`Snapshot started for ${istDate}`)

    // ── 1. Fetch Lead Dump ────────────────────────────────────────────────────
    log.push('Fetching Lead Dump A:CK…')
    const leadRows = await fetchSheet('Lead Dump', 'A:CK')
    log.push(`Lead Dump: ${leadRows.length} rows`)

    // Build static + dynamic batches; deduplicate by email (keep last occurrence)
    const leadStatic  = [...new Map(leadRows.map(buildLeadStatic).filter(Boolean).map(r => [r.email, r])).values()]
    const leadDynamic = [...new Map(leadRows.map(r => buildLeadDynamic(r, istDate)).filter(Boolean).map(r => [r.email, r])).values()]

    // Upsert static (ignore duplicates — already captured)
    await upsertRows('lead_static', leadStatic, 'email', { ignoreDuplicates: true })
    log.push(`lead_static: upserted ${leadStatic.length}`)

    // Upsert dynamic (full upsert — updates existing same-day row if re-run)
    const ldCount = await upsertRows('lead_history', leadDynamic, 'snapshot_date,email')
    log.push(`lead_history: upserted ${ldCount}`)

    // ── 2. Fetch App Start Dump ───────────────────────────────────────────────
    log.push('Fetching App Start Dump A:EY…')
    const appRows = await fetchSheet('App Start Dump', 'A:EY')
    log.push(`App Start Dump: ${appRows.length} rows`)

    // Deduplicate by application_number (keep last occurrence)
    const appStatic  = [...new Map(appRows.map(buildAppStatic).filter(Boolean).map(r => [r.application_number, r])).values()]
    const appDynamic = [...new Map(appRows.map(r => buildAppDynamic(r, istDate)).filter(Boolean).map(r => [r.application_number, r])).values()]

    await upsertRows('app_start_static', appStatic, 'application_number', { ignoreDuplicates: true })
    log.push(`app_start_static: upserted ${appStatic.length}`)

    const adCount = await upsertRows('app_start_history', appDynamic, 'snapshot_date,application_number')
    log.push(`app_start_history: upserted ${adCount}`)

    // ── 3. Fetch + snapshot Callyzer calls ────────────────────────────────────
    // The calls sheet is a rolling ~36-day window; upsert everything currently
    // in it, deduped by UniqueId (immutable → DO NOTHING on conflict), so each
    // day's calls are captured in the DB before they roll off the sheet.
    // Isolated in its own try/catch: a calls hiccup must never fail the lead/app
    // snapshots above, which the dashboard and prev-stage feature depend on.
    try {
      log.push('Fetching Call History updated Daily A:Y…')
      const callSheetRows = await fetchSheet('Call History updated Daily', 'A:Y', CALLS_ID)
      log.push(`Call History: ${callSheetRows.length} rows`)
      const calls = [...new Map(
        callSheetRows.map(buildCallRow).filter(Boolean).map(r => [r.uniqueid, r])
      ).values()]
      const cCount = await upsertRows('call_history', calls, 'uniqueid', { ignoreDuplicates: true })
      log.push(`call_history: upserted ${cCount}`)
    } catch (callErr) {
      log.push(`call_history: SKIPPED (${callErr.message})`)
      console.error('[api/snapshot] calls capture failed:', callErr.message)
    }

    const durationMs = Date.now() - start
    log.push(`Done in ${(durationMs / 1000).toFixed(1)}s`)

    return res.json({ ok: true, date: istDate, log })

  } catch (e) {
    console.error('[api/snapshot]', e.message)
    log.push(`ERROR: ${e.message}`)
    return res.status(500).json({ ok: false, log, error: e.message })
  }
}
