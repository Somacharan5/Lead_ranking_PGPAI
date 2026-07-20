import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Sector,
} from "recharts"

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MAIN_COUNSELLORS = [
  { key: "Jasmeet Kaur", short: "Jasmeet", color: "#3b82f6", bg: "#eff6ff", ring: "#93c5fd" },
  { key: "Komal Pandey", short: "Komal", color: "#8b5cf6", bg: "#f5f3ff", ring: "#c4b5fd" },
  { key: "Prerna Kaushik", short: "Prerna", color: "#ec4899", bg: "#fdf2f8", ring: "#f9a8d4" },
  // TODO: update key values to match exact CRM column U / column AR values once confirmed
  { key: "Harsha Vardhini Pirupilli", short: "Harsha", color: "#14b8a6", bg: "#f0fdfa", ring: "#5eead4" },
  { key: "Drishti Majumdar", short: "Drishti", color: "#f59e0b", bg: "#fffbeb", ring: "#fcd34d" },
  { key: "Ishan Ali", short: "Ishan", color: "#d946ef", bg: "#fdf4ff", ring: "#e879f9" },
  { key: "Sunny Singh", short: "Sunny", color: "#f43f5e", bg: "#fff1f2", ring: "#fda4af" },
  { key: "Aniket Singh", short: "Aniket", color: "#06b6d4", bg: "#ecfeff", ring: "#67e8f9" },
  { key: "Devam Chandna", short: "Devam", color: "#6366f1", bg: "#eef2ff", ring: "#a5b4fc" },
  { key: "Aprajita", short: "Aprajita", color: "#10b981", bg: "#ecfdf5", ring: "#6ee7b7" },
  { key: "Simran Mishra", short: "Simran", color: "#0ea5e9", bg: "#f0f9ff", ring: "#7dd3fc" },
]
// "Others" is only ever used for genuinely blank/garbage counsellor cells.
// Any real counsellor name found in the data gets its own column (see orderCols).
const OTHERS_COL = { key: "Others", short: "Others", color: "#94a3b8", bg: "#f8fafc", ring: "#cbd5e1" }
const KNOWN_BY_KEY = Object.fromEntries(MAIN_COUNSELLORS.map(c => [c.key, c]))

// Deterministic palette for counsellors not in the known list above, so a given
// name always renders with the same colour everywhere.
const EXTRA_PALETTE = [
  { color: "#0ea5e9", bg: "#f0f9ff", ring: "#7dd3fc" },
  { color: "#a855f7", bg: "#faf5ff", ring: "#d8b4fe" },
  { color: "#ef4444", bg: "#fef2f2", ring: "#fca5a5" },
  { color: "#84cc16", bg: "#f7fee7", ring: "#bef264" },
  { color: "#f97316", bg: "#fff7ed", ring: "#fdba74" },
  { color: "#0d9488", bg: "#f0fdfa", ring: "#5eead4" },
  { color: "#eab308", bg: "#fefce8", ring: "#fde047" },
  { color: "#7c3aed", bg: "#f5f3ff", ring: "#c4b5fd" },
]

// Column descriptor for any counsellor key (known, unknown, or "Others").
function makeCol(key) {
  if (key === "Others") return OTHERS_COL
  if (KNOWN_BY_KEY[key]) return KNOWN_BY_KEY[key]
  const pal = EXTRA_PALETTE[parseInt(hashText(key), 36) % EXTRA_PALETTE.length] || EXTRA_PALETTE[0]
  return { key, short: key.split(/\s+/)[0], ...pal }
}

// Build the ordered column list from whatever counsellor names appear in the data:
// known counsellors first (in canonical order), then any extra real names found
// (alphabetical), and "Others" last — only if blank cells actually exist.
function orderCols(keys) {
  const present = new Set([].concat(...keys).filter(Boolean))
  const known = MAIN_COUNSELLORS.filter(c => present.has(c.key))
  const extras = [...present]
    .filter(k => k !== "Others" && !KNOWN_BY_KEY[k])
    .sort()
    .map(makeCol)
  const cols = [...known, ...extras]
  if (present.has("Others")) cols.push(OTHERS_COL)
  return cols
}

const NAME_MAP = {
  "Jasmeet Kaur": "Jasmeet Kaur",
  "Jasmeet": "Jasmeet Kaur",
  "KOMAL": "Komal Pandey",
  "Komal": "Komal Pandey",
  "Komal Pandey": "Komal Pandey",
  "Prerna": "Prerna Kaushik",
  "Prerna Kaushik": "Prerna Kaushik",
  "PRERNA": "Prerna Kaushik",
  // TODO: update these to match exact CRM column values once confirmed
  // CRM + Callyzer both use her full name; the older short "Harsha" maps to it too.
  "Harsha": "Harsha Vardhini Pirupilli",
  "HARSHA": "Harsha Vardhini Pirupilli",
  "Harsha Vardhini Pirupilli": "Harsha Vardhini Pirupilli",
  "HARSHA VARDHINI PIRUPILLI": "Harsha Vardhini Pirupilli",
  "Drishti Majumdar": "Drishti Majumdar",
  "Drishti": "Drishti Majumdar",
  "DRISHTI": "Drishti Majumdar",
  "Ishan Ali": "Ishan Ali",
  "Ishan": "Ishan Ali",
  "ISHAN": "Ishan Ali",
  "Sunny Singh": "Sunny Singh",
  "Sunny": "Sunny Singh",
  "SUNNY": "Sunny Singh",
  "Aniket Singh": "Aniket Singh",
  "Aniket": "Aniket Singh",
  "ANIKET": "Aniket Singh",
  "Aniketh": "Aniket Singh",
  "Devam Chandna": "Devam Chandna",
  "Devam": "Devam Chandna",
  "DEVAM": "Devam Chandna",
  "Aprajita": "Aprajita",
  "APRAJITA": "Aprajita",
  "Simran Mishra": "Simran Mishra",
  "Simran": "Simran Mishra",
  "SIMRAN": "Simran Mishra",
}

const SECTIONS = [
  { key: "all", label: "All sections", val: null },
  { key: "appFU", label: "App Start Followup", val: "App Followup" },
  { key: "appNew", label: "App Start New", val: "App Start New" },
  { key: "leadFU", label: "Followup Leads", val: "Followup Lead" },
  { key: "fresh", label: "Fresh Leads", val: "Fresh Lead" },
]

const STAGE_ORDER = [
  "Counseled", "No Contact Established", "Not interested",
  "Not Eligible", "Untouched", "Intent dropped",
]

const STAGE_COLORS = {
  "Counseled": "#22c55e",
  "No Contact Established": "#f59e0b",
  "Not interested": "#ef4444",
  "Not Eligible": "#6b7280",
  "Untouched": "#3b82f6",
  "Intent dropped": "#8b5cf6",
}

const CALL_TYPE_COLORS = {
  Outgoing: "#3b82f6",
  Incoming: "#22c55e",
  Missed: "#ef4444",
  Rejected: "#f97316",
}

const PIPELINE_BUCKETS = [
  { key: "hot", label: "Hot", color: "#ef4444", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  { key: "warm", label: "Warm", color: "#f59e0b", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  { key: "cold", label: "Cold", color: "#64748b", bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
]

const URGENCY = {
  today: { label: "Today", bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  "this-week": { label: "This week", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  low: { label: "Low", bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" },
}
const SENTIMENT = {
  positive: { bg: "bg-green-50", text: "text-green-700", label: "Positive" },
  mixed: { bg: "bg-amber-50", text: "text-amber-700", label: "Mixed" },
  negative: { bg: "bg-red-50", text: "text-red-700", label: "Negative" },
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function normalizeName(raw) {
  const t = cellText(raw)
  if (!t) return null
  const titled = t.replace(/\b\w/g, c => c.toUpperCase())
  // Canonicalise known aliases; otherwise keep the real (title-cased) name so the
  // counsellor gets their own column instead of being lumped into "Others".
  return NAME_MAP[titled] || NAME_MAP[t] || titled
}

function inferSection(stageType, leadStage) {
  const isUntouched = cellText(leadStage) === "Untouched"
  if (stageType === "Lead") return isUntouched ? "Fresh Lead" : "Followup Lead"
  if (stageType === "App Start" || stageType === "Paid App") return isUntouched ? "App Start New" : "App Followup"
  return "Unknown"
}

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }

function parseDate(val) {
  if (!val && val !== 0) return null
  const n = Number(val)
  if (!isNaN(n) && n > 40000 && n < 60000) return new Date((n - 25569) * 86400 * 1000)
  const s = String(val).trim()
  // "23 Mar 2026" or "23-Mar-2026" — DD MMM YYYY format used by the calls sheet
  const m = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[\s-](\d{4})$/)
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()]
    if (mo !== undefined) return new Date(+m[3], mo, +m[1])
  }
  const d = new Date(s)
  return isNaN(d) ? null : d
}

function sameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
}

function r2(n) { return typeof n === "number" ? Math.round(n * 100) / 100 : 0 }
function phone10(v) { return String(v || "").replace(/\D/g, "").slice(-10) }
function cellText(v) { return v === null || v === undefined ? "" : String(v).trim() }
function parseDurationMins(v) {
  if (v === null || v === undefined || v === "") return 0
  const n = Number(v)
  if (!isNaN(n)) return n  // already a float (col V: "Call Duration in Mins")
  const s = String(v).trim()
  const m = s.match(/(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/)
  if (!m || !s) return 0
  return (parseInt(m[1] || 0) * 60) + parseInt(m[2] || 0) + (parseInt(m[3] || 0) / 60)
}
function hashText(text) {
  let h = 0
  for (let i = 0; i < text.length; i++) h = Math.imul(31, h) + text.charCodeAt(i) | 0
  return Math.abs(h).toString(36)
}

function colMeta(key) {
  return makeCol(key)
}

function normalizeStage(raw) {
  return cellText(raw)
}

function isCounseled(raw) {
  return normalizeStage(raw).toLowerCase() === "counseled"
}

function isPaymentCompleted(raw) {
  return cellText(raw).toLowerCase() === "completed"
}

function inferPipelineBucket(row) {
  const sub = (row.subStage || "").toLowerCase().trim()
  if (sub === "hot") return "hot"
  if (sub === "cold") return "cold"
  return "warm"
}

function fmtSerial(val) {
  const d = parseDate(val)
  if (!d) return ""
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

const DISQUALIFIED_STAGES = new Set(["not interested", "not eligible", "intent dropped"])

function buildPipelineRows(leadDumpRows = [], followupLeadRows = [], appStartRows = [], appFollowupRows = []) {
  const rows = []
  const seen = new Set()

  const add = (row, cfg) => {
    const mobile = row[cfg.mobileIdx]
    const phone = phone10(mobile)
    const email = cellText(row[cfg.emailIdx]).toLowerCase()
    const key = `${cfg.type}:${phone || email}`
    if ((!phone && !email) || seen.has(key)) return
    seen.add(key)

    // Resolve effective stage:
    // - If either AU (appStage) or AT (leadStage) is a disqualified stage (Not Interested / Not Eligible /
    //   Intent Dropped), that takes priority — the lead is not considered Counseled regardless of the other stage.
    // - Otherwise, if either stage is "Counseled", treat the lead as Counseled (Bug 4 fix preserved).
    const rawStage = normalizeStage(row[cfg.stageIdx])
    const rawLeadStage = cfg.leadStageIdx !== undefined ? normalizeStage(row[cfg.leadStageIdx]) : ""
    const rawStageLower = rawStage.toLowerCase()
    const rawLeadStageLower = rawLeadStage.toLowerCase()
    const disqStage = DISQUALIFIED_STAGES.has(rawLeadStageLower) ? rawLeadStage
      : DISQUALIFIED_STAGES.has(rawStageLower) ? rawStage
        : null
    const stage = disqStage
      ? disqStage
      : (rawStageLower === "counseled" || rawLeadStageLower === "counseled")
        ? "Counseled"
        : rawStage

    const item = {
      id: key,
      type: cfg.type,
      name: cellText(row[cfg.nameIdx]),
      email,
      phone,
      counsellor: normalizeName(row[cfg.counsellorIdx]) || "Others",
      stage,
      subStage: cellText(row[cfg.subStageIdx]) || "No substage",
      source: cellText(row[cfg.sourceIdx]) || "Unknown",
      notes: cellText(row[cfg.notesIdx]),
      priority: cfg.priorityIdx !== null ? cellText(row[cfg.priorityIdx]) : "",
      paymentStatus: cfg.paymentStatusIdx !== null ? cellText(row[cfg.paymentStatusIdx]) : "",
      registeredOn: fmtSerial(row[cfg.registeredOnIdx]),
      lastActivity: fmtSerial(row[cfg.lastActivityIdx]),
      city: cfg.cityIdx !== undefined ? (cellText(row[cfg.cityIdx]) || "") : "",
      state: cfg.stateIdx !== undefined ? (cellText(row[cfg.stateIdx]) || "") : "",
    }
    item.bucket = inferPipelineBucket(item)
    rows.push(item)
  }

  // Bug 2 fix: Lead Dump — only include user type "lead" (AG=32), exclude "applicant" rows
  // BC(54)=Counsellor, BD(55)=Stage, BE(56)=SubStage, BP(67)=Notes, CK(88)=Priority (moved CI→CK, +2)
  // BA(52)=Registered On, BK(62)=Last Activity
  const LEAD_CFG = {
    type: "Lead", nameIdx: 0, emailIdx: 1, mobileIdx: 2, sourceIdx: 6,
    counsellorIdx: 54, stageIdx: 55, subStageIdx: 56, notesIdx: 67, priorityIdx: 88, paymentStatusIdx: 35,
    registeredOnIdx: 52, lastActivityIdx: 62,
  }
  leadDumpRows.slice(1).forEach(row => {
    if (cellText(row[32]).toLowerCase() !== "lead") return
    add(row, LEAD_CFG)
  })
  followupLeadRows.slice(1).forEach(row => {
    if (cellText(row[32]).toLowerCase() !== "lead") return
    add(row, LEAD_CFG)
  })

  // App Start Dump — leadStageIdx:45 = AT (Lead Stage) used alongside stageIdx:46 = AU (Application Stage)
  // Bug 4 fix: counseled if either AT or AU = "Counseled"
  // Q(16)=Registered On, BG(58)=Last Activity
  const APP_CFG_BASE = {
    type: "App Start", nameIdx: 12, emailIdx: 13, mobileIdx: 14, sourceIdx: 18,
    counsellorIdx: 43, stageIdx: 46, leadStageIdx: 45, subStageIdx: 47, notesIdx: 64, paymentStatusIdx: 2,
    registeredOnIdx: 16, lastActivityIdx: 58, stateIdx: 76, cityIdx: 77,
  }
  // EY(154) = "Priority App Start" (moved EW→EY, +2)
  appStartRows.slice(1).forEach(row => add(row, { ...APP_CFG_BASE, priorityIdx: null }))
  appFollowupRows.slice(1).forEach(row => add(row, { ...APP_CFG_BASE, priorityIdx: 154 }))

  // Bug 1 fix: cross-type dedup — if same phone/email appears as both Lead and App Start,
  // keep App Start only (it's further in the funnel; Lead entry double-counts the person)
  const phonePref = new Map()
  const emailPref = new Map()
  for (const row of rows) {
    if (row.phone) {
      if (!phonePref.has(row.phone) || row.type === "App Start") phonePref.set(row.phone, row)
    } else if (row.email) {
      if (!emailPref.has(row.email) || row.type === "App Start") emailPref.set(row.email, row)
    }
  }
  return rows.filter(row => {
    if (row.phone) return phonePref.get(row.phone) === row
    if (row.email) return emailPref.get(row.email) === row
    return false
  })
}

function snapshotPipeline(rows) {
  const out = {}
  rows.forEach(r => {
    out[r.id] = {
      id: r.id,
      counsellor: r.counsellor,
      type: r.type,
      stage: r.stage || "Unknown",
      subStage: r.subStage || "No substage",
      bucket: r.bucket,
      name: r.name,
      phone: r.phone,
      source: r.source,
    }
  })
  return out
}

function comparePipelineSnapshots(prevMap, currentRows) {
  if (!prevMap || Object.keys(prevMap).length === 0) {
    return { hasBaseline: false, gainedCounseled: [], lostCounseled: [], stageChanges: [], subStageChanges: [], netCounseled: 0 }
  }

  const currentMap = snapshotPipeline(currentRows)
  const gainedCounseled = []
  const lostCounseled = []
  const stageChanges = []
  const subStageChanges = []

  Object.values(currentMap).forEach(curr => {
    const prev = prevMap[curr.id]
    if (!prev) return
    const wasCounseled = isCounseled(prev.stage)
    const nowCounseled = isCounseled(curr.stage)

    if (prev.stage !== curr.stage) {
      const change = { ...curr, fromStage: prev.stage, toStage: curr.stage, fromSubStage: prev.subStage, toSubStage: curr.subStage }
      stageChanges.push(change)
      if (!wasCounseled && nowCounseled) gainedCounseled.push(change)
      if (wasCounseled && !nowCounseled) lostCounseled.push(change)
    } else if (nowCounseled && prev.subStage !== curr.subStage) {
      subStageChanges.push({ ...curr, fromSubStage: prev.subStage, toSubStage: curr.subStage })
    }
  })

  return {
    hasBaseline: true,
    gainedCounseled,
    lostCounseled,
    stageChanges,
    subStageChanges,
    netCounseled: gainedCounseled.length - lostCounseled.length,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA LAYER
// ─────────────────────────────────────────────────────────────────────────────

// Returns { subStageMap, notesMap, stageTypeMap, leadStageMap, sourceMap }
// keyed by last-10-digit phone number.
// Call history cols P/T/U (stage/source/leadStage) are not always populated by
// the call system, so we join from Lead Dump + App Start by phone instead.
//
// Lead Dump:  col C(2)=Mobile, col G(6)=Source, col BD(55)=Stage, col BE(56)=SubStage, col BP(67)=Notes
// App Start:  col O(14)=Mobile, col S(18)=Source, col AU(46)=Stage, col AV(47)=SubStage, col BM(64)=Notes
// App Start takes priority over Lead if same phone appears in both (higher funnel stage).
export function buildLeadMaps(leadDumpRows = [], appStartRows = []) {
  const subStageMap = {}, notesMap = {}, stageTypeMap = {}, leadStageMap = {}, sourceMap = {}

  leadDumpRows.slice(1).forEach(row => {
    const p = phone10(row[2])
    if (!p) return
    const sub = cellText(row[56])
    const note = cellText(row[67])
    const stage = cellText(row[55])
    const src = cellText(row[6])
    if (sub) subStageMap[p] = sub
    if (note) notesMap[p] = note
    stageTypeMap[p] = 'Lead'
    if (stage) leadStageMap[p] = stage
    if (src) sourceMap[p] = src
  })

  appStartRows.slice(1).forEach(row => {
    const p = phone10(row[14])
    if (!p) return
    const sub = cellText(row[47])
    const note = cellText(row[64])
    const stage = cellText(row[46])
    const src = cellText(row[18])
    if (sub) subStageMap[p] = sub
    if (note) notesMap[p] = note
    stageTypeMap[p] = 'App Start'
    if (stage) leadStageMap[p] = stage
    if (src) sourceMap[p] = src
  })

  return { subStageMap, notesMap, stageTypeMap, leadStageMap, sourceMap }
}

// Keep for backward compat
export function buildSubStageMap(leadDumpRows = [], appStartRows = []) {
  return buildLeadMaps(leadDumpRows, appStartRows).subStageMap
}

export function parseCallsHistory(rawRows, targetDate, subStageMap = {}, notesMap = {}, stageTypeMap = {}, leadStageMap = {}, sourceMap = {}) {
  const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate
  return rawRows.slice(1).map(row => {
    const p = phone10(row[7])
    return {
      empName: normalizeName(row[3]),
      toNumber: p,
      callType: cellText(row[8]),
      callDate: row[12],
      notes: notesMap[p] || cellText(row[14]),
      audioUrl: row[16] || "",
      stageType: stageTypeMap[p] || cellText(row[18]),
      source: sourceMap[p] || cellText(row[22]),
      leadStage: leadStageMap[p] || cellText(row[23]),
      // Prefer col Y "Call Duration in Mins" (row[24]); fall back to raw "Duration"
      // (row[11], e.g. "0h 0m 16s"). NOTE: use `||` not `??` — api/calls.js coerces
      // NULLs to "", and "" ?? x keeps "", so `??` never falls back. col Y is currently
      // NULL in the DB, so the raw Duration column is what actually carries the data.
      durationMins: parseDurationMins(cellText(row[24]) || cellText(row[11])),
      subStage: subStageMap[p] || "",
    }
  })
    .filter(r => r.empName !== null)
    .filter(r => { const d = parseDate(r.callDate); return d && sameDay(d, target) })
    .map(r => ({ ...r, section: inferSection(r.stageType, r.leadStage) }))
}

function computeStats(rows) {
  if (!rows || rows.length === 0) return null
  const out = rows.filter(r => r.callType === "Outgoing")
  const inc = rows.filter(r => r.callType === "Incoming")
  const miss = rows.filter(r => r.callType === "Missed" || r.callType === "Rejected")
  const conn = out.filter(r => r.durationMins > 0)
  const uniq = new Set(out.map(r => r.toNumber).filter(Boolean)).size
  const dur = out.reduce((s, r) => s + r.durationMins, 0)
  const stages = {}, subStages = {}, outBySec = {}
  rows.forEach(r => {
    const st = r.leadStage || "Unknown"
    stages[st] = (stages[st] || 0) + 1
    if (r.subStage) {
      if (!subStages[st]) subStages[st] = {}
      subStages[st][r.subStage] = (subStages[st][r.subStage] || 0) + 1
    }
  })
  out.forEach(r => {
    const sec = r.section || "Unknown"
    outBySec[sec] = (outBySec[sec] || 0) + 1
  })
  return {
    total: rows.length, outgoing: out.length, incoming: inc.length,
    missed: miss.length, unique: uniq, connected: conn.length,
    connPct: out.length ? Math.round(conn.length / out.length * 100) : null,
    totalDur: r2(dur), avgDur: r2(conn.length ? dur / conn.length : 0),
    stages, subStages, outBySec,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CLAUDE AI INSIGHTS
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAIInsights(notesRows, counsellorName, dateStr) {
  if (!notesRows || notesRows.length === 0) return null

  const clean = (s) => (s || "")
    .replace(/[\r\n\t]+/g, " ")   // newlines/tabs → space
    .replace(/"/g, "'")            // double quotes → single (prevents JSON breakage)
    .replace(/\\/g, " ")           // backslashes → space
    .replace(/[\x00-\x1f]/g, "")  // strip other control chars
    .trim()
    .slice(0, 250)

  const notesBlock = notesRows.map((r, i) =>
    `Call ${i + 1} (${r.section}, Source: ${r.source || "unknown"}, Stage: ${r.leadStage || "unknown"}, ` +
    `Type: ${r.callType}, Duration: ${r.durationMins ? r.durationMins.toFixed(1) + "m" : "N/A"}): "${clean(r.notes)}"`
  ).join("\n")

  const prompt =
    `You are analyzing call notes from ${counsellorName}, an admissions counsellor at a business school.
Date: ${dateStr}
Total calls with notes: ${notesRows.length}

=== CALL NOTES ===
${notesBlock}

Notes may be in English, Hindi, or mixed. Analyze as-is.

CRITICAL JSON RULES — failure to follow these will break parsing:
- Return ONLY raw JSON. No markdown, no code fences, no preamble.
- Every string value must use ONLY double quotes.
- Any double-quote character INSIDE a string value must be escaped as \\"
- No newlines inside string values — use a space instead.
- Keep every string field under 80 characters.
- topThemes: max 5 items. topObjections: max 5. objectionsBySource: max 5.
- leadClassifications: only the 8 most interesting calls (hot/warm only — skip cold unless < 8 total).
- followupFlags: max 5 items, urgency "today" first.

Return this exact structure:
{
  "topThemes": [{ "theme": "max 6 words", "count": 0, "example": "brief" }],
  "topObjections": [{ "objection": "short phrase", "count": 0, "howHandled": "one sentence" }],
  "objectionsBySource": [{ "source": "name", "topObjection": "short phrase", "count": 0 }],
  "overallSentiment": "positive",
  "sentimentReason": "1-2 sentences",
  "leadClassifications": [{ "callIndex": 1, "interest": "hot", "reason": "one sentence" }],
  "followupFlags": [{ "callIndex": 1, "action": "what to do", "urgency": "today" }]
}

interest: "hot" | "warm" | "cold"
urgency: "today" | "this-week" | "low"`

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!response.ok) throw new Error(`API ${response.status}: ${response.statusText}`)
  const data = await response.json()
  const raw = data.content.map(b => b.text || "").join("")
  const text = raw.replace(/```json[\s\S]*?```|```/g, "").trim()
  return robustJSONParse(text)
}

function robustJSONParse(text) {
  // 1. Direct parse
  try { return JSON.parse(text) } catch { }

  // 2. Strip control characters
  try { return JSON.parse(text.replace(/[\x00-\x1f\x7f]/g, " ")) } catch { }

  // 3. Extract outermost { ... } block
  const objMatch = text.match(/\{[\s\S]*\}/)
  if (objMatch) {
    try { return JSON.parse(objMatch[0]) } catch { }
    try { return JSON.parse(objMatch[0].replace(/[\x00-\x1f\x7f]/g, " ")) } catch { }
  }

  // 4. Truncate at last complete top-level field and close the object
  // Walk backwards to find the last comma that separates top-level keys
  const base = objMatch ? objMatch[0] : text
  const lastComma = base.lastIndexOf(',"follow')  // followupFlags is always last
  if (lastComma > 0) {
    try {
      return JSON.parse(base.slice(0, lastComma) + "}")
    } catch { }
  }

  throw new Error("Could not parse AI response as JSON")
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

function InfoBadge({ text }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative inline-block flex-shrink-0">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className="w-5 h-5 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-200 text-gray-400 hover:text-gray-600 text-xs font-semibold flex items-center justify-center transition-colors leading-none"
        title="What does this show?"
      >i</button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-7 z-20 w-72 bg-gray-900 text-white text-xs rounded-xl px-3.5 py-2.5 shadow-xl leading-relaxed">
            <div className="absolute -top-1.5 right-2 w-3 h-3 bg-gray-900 rotate-45 rounded-sm" />
            {text}
          </div>
        </>
      )}
    </div>
  )
}

function KPICard({ label, value, sub, color, icon }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <div className="text-3xl font-bold" style={{ color: color || "#1e293b" }}>{value ?? "—"}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

function ProgressBar({ pct, color }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(pct || 0, 100)}%`, background: color }} />
    </div>
  )
}

function StatChip({ label, value, color }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-semibold" style={{ color }}>{value ?? "—"}</span>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <div className="font-semibold text-gray-700 mb-2">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-semibold text-gray-800">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// Active shape for donut chart hover
const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value, percent } = props
  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#1e293b" fontSize={22} fontWeight={700}>{value}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#94a3b8" fontSize={11}>{payload.name}</text>
      <text x={cx} y={cy + 28} textAnchor="middle" fill="#94a3b8" fontSize={11}>{(percent * 100).toFixed(0)}%</text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 4} outerRadius={innerRadius - 2}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CHARTS
// ─────────────────────────────────────────────────────────────────────────────

function CallsBarChart({ allRows }) {
  const data = orderCols(allRows.map(r => r.empName)).map(c => {
    const rows = allRows.filter(r => r.empName === c.key)
    const out = rows.filter(r => r.callType === "Outgoing")
    const conn = out.filter(r => r.durationMins > 0)
    return { name: c.short, Outgoing: out.length, Connected: conn.length, Missed: rows.filter(r => r.callType === "Missed" || r.callType === "Rejected").length }
  })
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-gray-800">Calls by Counsellor</div>
        <InfoBadge text="Compares outgoing, connected (answered), and missed/rejected calls per counsellor for the selected date." />
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barGap={4} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="Outgoing" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Connected" fill="#22c55e" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Missed" fill="#fca5a5" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function CallTypeDonut({ rows, onDrill }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const types = ["Outgoing", "Incoming", "Missed", "Rejected"]
  const data = types.map(t => ({ name: t, value: rows.filter(r => r.callType === t).length })).filter(d => d.value > 0)
  if (!data.length) return null
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-gray-800">Call Type Breakdown</div>
        <InfoBadge text="Donut shows the split of all calls by type — outgoing (dialled by counsellor), incoming (lead called back), missed, and rejected. Click a segment or legend to see raw calls." />
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
            activeIndex={activeIdx} activeShape={renderActiveShape}
            onMouseEnter={(_, i) => setActiveIdx(i)}
            onClick={onDrill ? (d) => onDrill(d.name, rows.filter(r => r.callType === d.name)) : undefined}
            style={onDrill ? { cursor: "pointer" } : {}}
            dataKey="value" paddingAngle={3}>
            {data.map((d) => (
              <Cell key={d.name} fill={CALL_TYPE_COLORS[d.name] || "#94a3b8"} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-1">
        {data.map(d => (
          <div key={d.name}
            className={`flex items-center gap-1.5 text-xs text-gray-600 ${onDrill ? "cursor-pointer hover:text-gray-900" : ""}`}
            onClick={() => onDrill?.(d.name, rows.filter(r => r.callType === d.name))}>
            <span className="w-2 h-2 rounded-full" style={{ background: CALL_TYPE_COLORS[d.name] || "#94a3b8" }} />
            {d.name} ({d.value})
          </div>
        ))}
      </div>
    </div>
  )
}

function StageBarChart({ rows, onDrill, stageKey = "leadStage", title = "Stage Breakdown",
                         info = "Counts all calls made today grouped by the lead's current CRM stage. Click a bar to see raw calls for that stage." }) {
  const allStages = useMemo(() => {
    const set = new Set(rows.map(r => r[stageKey] || "Unknown"))
    return [
      ...STAGE_ORDER.filter(s => set.has(s)),
      ...[...set].filter(s => !STAGE_ORDER.includes(s) && s !== "Unknown").sort(),
    ]
  }, [rows, stageKey])

  const data = allStages.map(s => ({
    name: s.length > 22 ? s.slice(0, 20) + "…" : s,
    fullName: s,
    value: rows.filter(r => (r[stageKey] || "Unknown") === s).length,
    color: STAGE_COLORS[s] || "#94a3b8",
  })).sort((a, b) => b.value - a.value)

  const max = Math.max(...data.map(d => d.value), 1)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-gray-800">{title}</div>
        <InfoBadge text={info} />
      </div>
      <div className="space-y-3">
        {data.map(d => (
          <div key={d.fullName}
            className={onDrill ? "cursor-pointer group" : ""}
            onClick={() => onDrill?.(d.fullName, rows.filter(r => (r[stageKey] || "Unknown") === d.fullName))}>
            <div className="flex justify-between items-center mb-1">
              <span className={`text-xs truncate max-w-[180px] ${onDrill ? "text-gray-700 group-hover:text-gray-900" : "text-gray-600"}`}
                title={d.fullName}>{d.fullName}</span>
              <span className={`text-xs font-semibold ml-2 flex-shrink-0 ${onDrill ? "group-hover:underline" : ""}`}
                style={{ color: d.color }}>{d.value}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${onDrill ? "group-hover:opacity-80" : ""}`}
                style={{ width: `${(d.value / max) * 100}%`, background: d.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SourceBarChart({ rows, onDrill }) {
  const data = useMemo(() => {
    const map = {}
    rows.forEach(r => { if (r.source) map[r.source] = (map[r.source] || 0) + 1 })
    return Object.entries(map)
      .map(([name, value]) => ({ name: name.length > 14 ? name.slice(0, 12) + "…" : name, fullName: name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [rows])

  if (!data.length) return null
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-gray-800">Calls by Source</div>
        <InfoBadge text="Total calls made today to leads from each acquisition source. Click a bar to see raw calls for that source." />
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barCategoryGap="35%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
          <Tooltip
            formatter={(v, _, p) => [v, p.payload.fullName]}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
                  <div className="font-semibold text-gray-700 mb-1">{payload[0]?.payload?.fullName || label}</div>
                  <div className="text-gray-600">{payload[0]?.value} calls{onDrill ? " — click to drill" : ""}</div>
                </div>
              )
            }}
            cursor={{ fill: "#f8fafc" }}
          />
          <Bar dataKey="value" name="Calls" radius={[4, 4, 0, 0]}
            onClick={onDrill ? (d) => onDrill(d.fullName, rows.filter(r => r.source === d.fullName)) : undefined}
            style={onDrill ? { cursor: "pointer" } : {}}>
            {data.map((_, i) => (
              <Cell key={i} fill={`hsl(${217 + i * 22}, 70%, ${55 + i * 3}%)`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ConnectedBySection({ rows, onDrill }) {
  const sections = ["App Followup", "App Start New", "Followup Lead", "Fresh Lead"]
  const data = sections.map(sec => {
    const r = rows.filter(x => x.section === sec)
    const out = r.filter(x => x.callType === "Outgoing")
    const conn = out.filter(x => x.durationMins > 0)
    return {
      name: sec.replace("App ", "App\n").replace("Followup", "FU").replace("Fresh Lead", "Fresh"),
      fullName: sec,
      Outgoing: out.length,
      Connected: conn.length,
    }
  }).filter(d => d.Outgoing > 0)

  if (!data.length) return null
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-gray-800">Connected by Section</div>
        <InfoBadge text="Outgoing vs. connected calls split across sections. Click a bar to see raw calls for that section." />
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barGap={3} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={24} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
          <Bar dataKey="Outgoing" fill="#93c5fd" radius={[3, 3, 0, 0]}
            onClick={onDrill ? (d) => onDrill(d.fullName + " — outgoing", rows.filter(r => r.section === d.fullName && r.callType === "Outgoing")) : undefined}
            style={onDrill ? { cursor: "pointer" } : {}} />
          <Bar dataKey="Connected" fill="#22c55e" radius={[3, 3, 0, 0]}
            onClick={onDrill ? (d) => onDrill(d.fullName + " — connected", rows.filter(r => r.section === d.fullName && r.durationMins > 0)) : undefined}
            style={onDrill ? { cursor: "pointer" } : {}} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COUNSELED PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

function PipelineSection({ pipelineRows, pipelineChanges, callRows, date, onDrill }) {
  const [typeOpen, setTypeOpen] = useState({})

  const allCounseledRows = useMemo(
    () => pipelineRows.filter(r => isCounseled(r.stage)),
    [pipelineRows]
  )
  const counseledRows = useMemo(
    () => allCounseledRows.filter(r => !isPaymentCompleted(r.paymentStatus)),
    [allCounseledRows]
  )
  const convertedCounseledCount = allCounseledRows.length - counseledRows.length

  const cols = useMemo(() => orderCols(counseledRows.map(r => r.counsellor)), [counseledRows])

  const byCounsellor = useMemo(() => {
    return cols.map(c => {
      const rows = counseledRows.filter(r => r.counsellor === c.key)
      return {
        name: c.short,
        fullName: c.key,
        hot: rows.filter(r => r.bucket === "hot").length,
        warm: rows.filter(r => r.bucket === "warm").length,
        cold: rows.filter(r => r.bucket === "cold").length,
        total: rows.length,
      }
    }).filter(r => r.total > 0 || r.fullName !== "Others")
  }, [cols, counseledRows])

  const bucketCounts = PIPELINE_BUCKETS.reduce((acc, b) => {
    acc[b.key] = counseledRows.filter(r => r.bucket === b.key).length
    return acc
  }, {})

  const typeRows = useMemo(() => {
    return ["Lead", "App Start"].map(type => {
      const typeFiltered = counseledRows.filter(r => r.type === type)
      const byCol = {}
      cols.forEach(c => {
        const cRows = typeFiltered.filter(r => r.counsellor === c.key)
        byCol[c.key] = {
          hot: cRows.filter(r => r.bucket === "hot").length,
          warm: cRows.filter(r => r.bucket === "warm").length,
          cold: cRows.filter(r => r.bucket === "cold").length,
          total: cRows.length,
        }
      })
      return {
        type,
        hot: typeFiltered.filter(r => r.bucket === "hot").length,
        warm: typeFiltered.filter(r => r.bucket === "warm").length,
        cold: typeFiltered.filter(r => r.bucket === "cold").length,
        total: typeFiltered.length,
        byCol,
      }
    })
  }, [cols, counseledRows])

  const counsellorTotals = useMemo(() => {
    const out = {}
    cols.forEach(c => { out[c.key] = counseledRows.filter(r => r.counsellor === c.key).length })
    return out
  }, [cols, counseledRows])

  const movementRows = [
    ...pipelineChanges.gainedCounseled.map(r => ({ ...r, kind: "gained" })),
    ...pipelineChanges.lostCounseled.map(r => ({ ...r, kind: "lost" })),
    ...pipelineChanges.subStageChanges.map(r => ({ ...r, kind: "substage" })),
  ].slice(0, 12)

  const spokenPipeline = useMemo(() => {
    const pipelineByPhone = {}
    allCounseledRows.forEach(row => {
      if (row.phone) pipelineByPhone[row.phone] = row
    })

    const byPhone = {}
    callRows
      .filter(row => row.durationMins > 0 && row.toNumber && pipelineByPhone[row.toNumber])
      .forEach(call => {
        const lead = pipelineByPhone[call.toNumber]
        if (!byPhone[call.toNumber]) {
          byPhone[call.toNumber] = {
            ...lead,
            calls: [],
            totalDuration: 0,
            paidAppSignal: false,
            latestNote: "",
          }
        }
        byPhone[call.toNumber].calls.push(call)
        byPhone[call.toNumber].totalDuration += call.durationMins
        byPhone[call.toNumber].paidAppSignal = byPhone[call.toNumber].paidAppSignal || call.stageType === "Paid App"
        if (call.notes) byPhone[call.toNumber].latestNote = call.notes
      })

    return Object.values(byPhone).sort((a, b) => {
      if (a.paidAppSignal !== b.paidAppSignal) return a.paidAppSignal ? -1 : 1
      const bucketOrder = { hot: 0, warm: 1, cold: 2 }
      return (bucketOrder[a.bucket] ?? 9) - (bucketOrder[b.bucket] ?? 9)
    })
  }, [callRows, allCounseledRows])

  const spokenCounts = PIPELINE_BUCKETS.reduce((acc, b) => {
    acc[b.key] = spokenPipeline.filter(r => r.bucket === b.key).length
    return acc
  }, {})

  const net = pipelineChanges.netCounseled || 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={onDrill ? "cursor-pointer hover:shadow-md rounded-xl transition-shadow" : ""}
          onClick={() => onDrill?.("All active counseled leads", counseledRows, "leads")}>
          <KPICard
            label="Active Counseled"
            value={counseledRows.length}
            sub={convertedCounseledCount ? `${convertedCounseledCount} converted excluded` : "click to view all"}
            icon="🎯"
            color="#16a34a"
          />
        </div>
        {PIPELINE_BUCKETS.map(b => (
          <div key={b.key}
            className={`rounded-xl border p-5 ${b.bg} ${b.border} ${onDrill ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
            onClick={() => onDrill?.(`${b.label} counseled leads`, counseledRows.filter(r => r.bucket === b.key), "leads")}>
            <div className={`text-xs font-medium uppercase tracking-wide ${b.text}`}>{b.label}</div>
            <div className={`text-3xl font-bold mt-2 ${b.text}`}>{bucketCounts[b.key] || 0}</div>
            <div className="text-xs text-gray-500 mt-1">counseled leads{onDrill ? " — click to view" : ""}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-sm font-semibold text-gray-800">Pipeline by Counsellor</div>
            <div className="text-xs text-gray-400 mt-0.5">Hot, warm and cold split for active counselled leads</div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <InfoBadge text="Stacked bar showing each counsellor's active counselled leads split into Hot / Warm / Cold. Hot = strong signals in notes/substage, Cold = low intent. Converted leads are excluded." />
            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${net > 0 ? "bg-green-50 text-green-700 border-green-200" :
                net < 0 ? "bg-red-50 text-red-700 border-red-200" :
                  "bg-gray-50 text-gray-600 border-gray-200"
              }`}>
              Counselled {net > 0 ? `+${net}` : net}
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={byCounsellor} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            {PIPELINE_BUCKETS.map(b => (
              <Bar key={b.key} dataKey={b.key} name={b.label} stackId="pipeline" fill={b.color} radius={[3, 3, 0, 0]}
                onClick={onDrill ? (d) => onDrill(`${d.fullName || d.name} — ${b.label} leads`, counseledRows.filter(r => r.counsellor === d.fullName && r.bucket === b.key), "leads") : undefined}
                style={onDrill ? { cursor: "pointer" } : {}} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-800">Pipeline Type Bifurcation</div>
            <div className="text-xs text-gray-400 mt-0.5">Active counselled leads by type and interest bucket — click a row to expand</div>
          </div>
          <InfoBadge text="Shows counselled leads split by record type (Lead vs App Start) and interest level. Click Lead or App Start to reveal Hot / Warm / Cold counts per counsellor. Total row sums across both types." />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-40">Type / Bucket</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Total</th>
                {cols.map(c => (
                  <th key={c.key} className="px-4 py-3 text-right text-xs font-semibold text-gray-500"
                    style={{ color: c.color }}>{c.short}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {typeRows.map(row => {
                const isOpen = typeOpen[row.type]
                const typeColor = row.type === "App Start" ? "#8b5cf6" : "#3b82f6"
                const drillCls = onDrill ? "cursor-pointer hover:underline" : ""
                return (
                  <>
                    <tr key={row.type}
                      className="hover:bg-gray-50 cursor-pointer select-none"
                      onClick={() => setTypeOpen(p => ({ ...p, [row.type]: !p[row.type] }))}>
                      <td className="px-4 py-3 font-semibold" style={{ color: typeColor }}>
                        <span className="text-gray-400 text-xs mr-2">{isOpen ? "▼" : "▶"}</span>
                        {row.type}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold text-gray-900 ${drillCls}`}
                        onClick={onDrill ? (e) => { e.stopPropagation(); onDrill(`${row.type} — all counsellors`, counseledRows.filter(r => r.type === row.type), "leads") } : undefined}>
                        {row.total}
                      </td>
                      {cols.map(c => (
                        <td key={c.key} className={`px-4 py-3 text-right font-semibold ${drillCls}`}
                          style={{ color: row.byCol[c.key]?.total ? c.color : "#d1d5db" }}
                          onClick={onDrill ? (e) => { e.stopPropagation(); onDrill(`${row.type} — ${c.short}`, counseledRows.filter(r => r.type === row.type && r.counsellor === c.key), "leads") } : undefined}>
                          {row.byCol[c.key]?.total ?? 0}
                        </td>
                      ))}
                    </tr>
                    {isOpen && PIPELINE_BUCKETS.map(b => (
                      <tr key={`${row.type}-${b.key}`} className="bg-gray-50">
                        <td className="py-2.5 text-xs font-medium" style={{ paddingLeft: 36 }}>
                          <span className={`px-2 py-0.5 rounded-full border text-xs ${b.bg} ${b.text} ${b.border}`}>
                            {b.label}
                          </span>
                        </td>
                        <td className={`px-4 py-2.5 text-right text-xs text-gray-700 font-medium ${drillCls}`}
                          onClick={onDrill ? () => onDrill(`${row.type} – ${b.label}`, counseledRows.filter(r => r.type === row.type && r.bucket === b.key), "leads") : undefined}>
                          {row[b.key]}
                        </td>
                        {cols.map(c => (
                          <td key={c.key} className={`px-4 py-2.5 text-right text-xs text-gray-500 ${drillCls}`}
                            onClick={onDrill ? () => onDrill(`${row.type} – ${b.label} — ${c.short}`, counseledRows.filter(r => r.type === row.type && r.bucket === b.key && r.counsellor === c.key), "leads") : undefined}>
                            {row.byCol[c.key]?.[b.key] ?? 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                )
              })}
              <tr className="bg-gray-50 border-t border-gray-200">
                <td className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Total</td>
                <td className={`px-4 py-3 text-right font-bold text-gray-900 ${onDrill ? "cursor-pointer hover:underline" : ""}`}
                  onClick={onDrill ? () => onDrill("All counseled leads", counseledRows, "leads") : undefined}>
                  {counseledRows.length}
                </td>
                {cols.map(c => (
                  <td key={c.key} className={`px-4 py-3 text-right font-semibold ${onDrill ? "cursor-pointer hover:underline" : ""}`}
                    style={{ color: counsellorTotals[c.key] ? c.color : "#d1d5db" }}
                    onClick={onDrill ? () => onDrill(`All counseled — ${c.short}`, counseledRows.filter(r => r.counsellor === c.key), "leads") : undefined}>
                    {counsellorTotals[c.key] ?? 0}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-gray-800">Spoken Today</div>
            <div className="text-xs text-gray-400 mt-0.5">Connected calls from active counselled pipeline on {date}</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <InfoBadge text="Counselled leads (including already-converted) who had at least one connected call today. Ranked by Paid App signal first, then Hot → Warm → Cold. Max 20 shown." />
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
              {spokenPipeline.length} spoken
            </span>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
              {spokenPipeline.filter(r => r.paidAppSignal).length} paid app signals
            </span>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-50 text-gray-600 border border-gray-200">
              includes converted
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 border-b border-gray-200">
          {PIPELINE_BUCKETS.map(b => (
            <div key={b.key} className={`px-5 py-4 border-r last:border-r-0 ${b.bg}`}>
              <div className={`text-xs uppercase tracking-wide ${b.text}`}>{b.label}</div>
              <div className={`text-2xl font-bold mt-1 ${b.text}`}>{spokenCounts[b.key] || 0}</div>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Lead</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Bucket</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Substage</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Counsellor</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Calls</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Mins</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Notes / Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {spokenPipeline.slice(0, 20).map(row => {
                const bucketMeta = PIPELINE_BUCKETS.find(b => b.key === row.bucket) || PIPELINE_BUCKETS[1]
                return (
                  <tr key={row.id} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800 max-w-[180px] truncate" title={row.name || row.phone}>{row.name || row.phone}</div>
                      <div className="text-xs text-gray-400">{row.type} · {row.source}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${bucketMeta.bg} ${bucketMeta.text} ${bucketMeta.border}`}>
                        {bucketMeta.label}
                      </span>
                      {row.paidAppSignal && (
                        <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                          Paid App
                        </span>
                      )}
                      {isPaymentCompleted(row.paymentStatus) && (
                        <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                          Converted
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate" title={row.subStage}>{row.subStage}</td>
                    <td className="px-4 py-3 text-gray-600">{row.counsellor}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{row.calls.length}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{r2(row.totalDuration)}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[280px]">
                      <div className="line-clamp-2" title={row.latestNote || row.notes}>
                        {row.latestNote || row.notes || <span className="text-gray-300">No notes</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {spokenPipeline.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                    No active counselled leads were spoken to on this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {spokenPipeline.length > 20 && (
          <div className="px-5 py-3 text-xs text-gray-400 border-t border-gray-100">
            Showing first 20 spoken counselled leads, prioritised by Paid App signal and bucket.
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-800">Pipeline Changes</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {pipelineChanges.hasBaseline ? "Compared with last saved admin snapshot" : "Baseline saved. Changes will appear after the next data update."}
            </div>
          </div>
          <InfoBadge text="+1 = lead newly moved into Counseled. −1 = lead moved out of Counseled. 'sub' = substage changed within Counseled. Compared against the snapshot saved on your last page load." />
        </div>
        <div className="divide-y divide-gray-100">
          {movementRows.map((r, i) => {
            const isGain = r.kind === "gained"
            const isLoss = r.kind === "lost"
            return (
              <div key={`${r.id}_${i}`} className="px-5 py-3 flex items-start gap-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${isGain ? "bg-green-50 text-green-700 border-green-200" :
                    isLoss ? "bg-red-50 text-red-700 border-red-200" :
                      "bg-blue-50 text-blue-700 border-blue-200"
                  }`}>
                  {isGain ? "+1" : isLoss ? "-1" : "sub"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-800 truncate">{r.name || r.phone || "Unknown lead"}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {r.kind === "substage"
                      ? `${r.stage}: ${r.fromSubStage} → ${r.toSubStage}`
                      : `${r.fromStage} → ${r.toStage}`}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{r.counsellor} · {r.type} · {r.source}</div>
                </div>
              </div>
            )
          })}
          {movementRows.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              {pipelineChanges.hasBaseline ? "No counselled stage or substage changes detected." : "Snapshot baseline created for future comparison."}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PipelineSummary({ pipelineRows, pipelineChanges, onOpenPipeline }) {
  const allCounseledPipeline = pipelineRows.filter(r => isCounseled(r.stage))
  const counseledPipeline = allCounseledPipeline.filter(r => !isPaymentCompleted(r.paymentStatus))
  const convertedCount = allCounseledPipeline.length - counseledPipeline.length
  const net = pipelineChanges.netCounseled || 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <div className="text-sm font-semibold text-gray-800">Counselled Pipeline</div>
          <div className="text-xs text-gray-400 mt-0.5">
            Active hot, warm and cold pipeline from current lead/app dumps
            {convertedCount ? ` · ${convertedCount} converted excluded` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <InfoBadge text="Count of leads currently in the Counseled stage across Lead Dump and App Start sheets. Converted (payment completed) leads are excluded. Hot/Warm/Cold inferred from substage and notes keywords." />
          <button onClick={onOpenPipeline}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition">
            Open Pipeline
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="text-xs text-green-700 uppercase tracking-wide">Active</div>
          <div className="text-2xl font-bold text-green-700 mt-1">{counseledPipeline.length}</div>
        </div>
        {PIPELINE_BUCKETS.map(b => (
          <div key={b.key} className={`rounded-lg border p-4 ${b.bg} ${b.border}`}>
            <div className={`text-xs uppercase tracking-wide ${b.text}`}>{b.label}</div>
            <div className={`text-2xl font-bold mt-1 ${b.text}`}>
              {counseledPipeline.filter(r => r.bucket === b.key).length}
            </div>
          </div>
        ))}
        <div className={`rounded-lg border p-4 ${net > 0 ? "bg-green-50 border-green-200" :
            net < 0 ? "bg-red-50 border-red-200" :
              "bg-gray-50 border-gray-200"
          }`}>
          <div className={`text-xs uppercase tracking-wide ${net > 0 ? "text-green-700" : net < 0 ? "text-red-700" : "text-gray-500"
            }`}>Change</div>
          <div className={`text-2xl font-bold mt-1 ${net > 0 ? "text-green-700" : net < 0 ? "text-red-700" : "text-gray-700"
            }`}>{net > 0 ? `+${net}` : net}</div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PIVOT TABLE
// ─────────────────────────────────────────────────────────────────────────────

const OUT_SECTIONS = [
  { val: "App Followup", label: "App Start Followup" },
  { val: "App Start New", label: "App Start New" },
  { val: "Followup Lead", label: "Followup Leads" },
  { val: "Fresh Lead", label: "Fresh Leads" },
]

function PivotTable({ rows, onDrill }) {
  const [stageOpen, setStageOpen] = useState({})
  const [outOpen, setOutOpen] = useState(false)

  const allS = computeStats(rows)
  const cols = useMemo(() => orderCols(rows.map(r => r.empName)), [rows])
  const byCol = useMemo(() => {
    const m = {}
    cols.forEach(c => { m[c.key] = computeStats(rows.filter(r => r.empName === c.key)) })
    return m
  }, [cols, rows])

  const allStages = useMemo(() => {
    const set = new Set(rows.map(r => r.leadStage || "Unknown"))
    return [
      ...STAGE_ORDER.filter(s => set.has(s)),
      ...[...set].filter(s => !STAGE_ORDER.includes(s) && s !== "Unknown").sort(),
    ]
  }, [rows])

  // Returns a function: colKey → filtered rows (null colKey = Total column)
  const makeFilter = (rowFilter) => (colKey) => {
    const base = colKey ? rows.filter(r => r.empName === colKey) : rows
    return rowFilter ? base.filter(rowFilter) : base
  }

  if (!allS) return (
    <div className="text-center py-12 text-gray-400 text-sm">No calls for the selected filters.</div>
  )

  const TH = ({ children, right }) => (
    <th className={`px-4 py-3 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-200 whitespace-nowrap ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  )

  const SectionRow = ({ label, color }) => (
    <tr>
      <td colSpan={2 + cols.length} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider"
        style={{ background: color + "12", color, borderTop: `1px solid ${color}30` }}>
        {label}
      </td>
    </tr>
  )

  const drillCls = onDrill ? "cursor-pointer hover:underline" : ""

  const DataRow = ({ label, getV, getRows, bold, indent = 0 }) => (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-2.5 text-sm border-b border-gray-100"
        style={{ paddingLeft: 16 + indent * 16, fontWeight: bold ? 600 : 400, color: indent ? "#6b7280" : "#1e293b" }}>
        {label}
      </td>
      <td className={`px-4 py-2.5 text-sm text-right border-b border-gray-100 font-semibold text-gray-800 ${getRows && onDrill ? drillCls : ""}`}
        onClick={getRows && onDrill ? () => onDrill(`${label} — Total`, getRows(null), "calls") : undefined}>
        {allS ? getV(allS) ?? "—" : "—"}
      </td>
      {cols.map(c => (
        <td key={c.key}
          className={`px-4 py-2.5 text-sm text-right border-b border-gray-100 ${getRows && onDrill ? drillCls : ""}`}
          style={{ color: byCol[c.key] ? c.color : "#d1d5db", fontWeight: bold ? 600 : 400 }}
          onClick={getRows && onDrill ? () => onDrill(`${label} — ${c.short}`, getRows(c.key), "calls") : undefined}>
          {byCol[c.key] ? (getV(byCol[c.key]) ?? "—") : "0"}
        </td>
      ))}
    </tr>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr>
            <TH>Metric</TH>
            <TH right>Total</TH>
            {cols.map(c => <TH key={c.key} right>{c.short}</TH>)}
          </tr>
        </thead>
        <tbody>
          <SectionRow label="Volume" color="#3b82f6" />
          <DataRow label="Total calls" getV={s => s.total} bold getRows={makeFilter(null)} />
          <tr className="hover:bg-gray-50 transition-colors cursor-pointer"
            onClick={() => setOutOpen(o => !o)}>
            <td className="px-4 py-2.5 text-sm border-b border-gray-100 text-gray-800 select-none">
              <span className="text-gray-400 text-xs mr-2">{outOpen ? "▼" : "▶"}</span>
              Outgoing
            </td>
            <td className={`px-4 py-2.5 text-sm text-right border-b border-gray-100 font-semibold text-gray-800 ${drillCls}`}
              onClick={onDrill ? (e) => { e.stopPropagation(); onDrill("Outgoing — Total", rows.filter(r => r.callType === "Outgoing"), "calls") } : undefined}>
              {allS?.outgoing ?? "—"}
            </td>
            {cols.map(c => (
              <td key={c.key} className={`px-4 py-2.5 text-sm text-right border-b border-gray-100 ${drillCls}`}
                style={{ color: byCol[c.key] ? c.color : "#d1d5db" }}
                onClick={onDrill ? (e) => { e.stopPropagation(); onDrill(`Outgoing — ${c.short}`, rows.filter(r => r.callType === "Outgoing" && r.empName === c.key), "calls") } : undefined}>
                {byCol[c.key]?.outgoing ?? 0}
              </td>
            ))}
          </tr>
          {outOpen && OUT_SECTIONS.map(sec => (
            <tr key={sec.val} className="bg-gray-50">
              <td className="py-2 text-xs text-gray-500 border-b border-gray-100" style={{ paddingLeft: 40 }}>
                {sec.label}
              </td>
              <td className={`px-4 py-2 text-xs text-right border-b border-gray-100 text-gray-600 ${drillCls}`}
                onClick={onDrill ? () => onDrill(`Outgoing → ${sec.label}`, rows.filter(r => r.callType === "Outgoing" && r.section === sec.val), "calls") : undefined}>
                {allS?.outBySec?.[sec.val] ?? 0}
              </td>
              {cols.map(c => (
                <td key={c.key} className={`px-4 py-2 text-xs text-right border-b border-gray-100 text-gray-500 ${drillCls}`}
                  onClick={onDrill ? () => onDrill(`Outgoing → ${sec.label} — ${c.short}`, rows.filter(r => r.callType === "Outgoing" && r.section === sec.val && r.empName === c.key), "calls") : undefined}>
                  {byCol[c.key]?.outBySec?.[sec.val] ?? 0}
                </td>
              ))}
            </tr>
          ))}
          <DataRow label="Incoming" getV={s => s.incoming} getRows={makeFilter(r => r.callType === "Incoming")} />
          <DataRow label="Missed / Rejected" getV={s => s.missed} getRows={makeFilter(r => r.callType === "Missed" || r.callType === "Rejected")} />
          <DataRow label="Unique numbers dialled" getV={s => s.unique} />

          <SectionRow label="Connection quality" color="#22c55e" />
          <DataRow label="Connected" getV={s => s.connected} bold getRows={makeFilter(r => r.callType === "Outgoing" && r.durationMins > 0)} />
          <DataRow label="Connected %" getV={s => s.connPct !== null ? s.connPct + "%" : "—"} />

          <SectionRow label="Stage breakdown" color="#f59e0b" />
          {allStages.map(stage => {
            const isOpen = stageOpen[stage]
            const subMap = {}
            rows.filter(r => (r.leadStage || "Unknown") === stage && r.subStage).forEach(r => {
              subMap[r.subStage] = (subMap[r.subStage] || 0) + 1
            })
            const subKeys = Object.entries(subMap).sort((a, b) => b[1] - a[1]).map(([k]) => k)
            const hasSubStages = subKeys.length > 0
            const stageColor = STAGE_COLORS[stage] || "#94a3b8"
            return (
              <React.Fragment key={stage}>
                <tr className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => hasSubStages && setStageOpen(p => ({ ...p, [stage]: !p[stage] }))}>
                  <td className="px-4 py-2.5 text-sm border-b border-gray-100 font-medium" style={{ color: "#1e293b" }}>
                    <span className="inline-flex items-center gap-2">
                      {hasSubStages
                        ? <span className="text-gray-400 text-xs w-3 text-center">{isOpen ? "▼" : "▶"}</span>
                        : <span className="w-3" />
                      }
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stageColor }} />
                      {stage}
                    </span>
                  </td>
                  <td className={`px-4 py-2.5 text-sm text-right border-b border-gray-100 font-semibold text-gray-800 ${drillCls}`}
                    onClick={onDrill ? (e) => { e.stopPropagation(); onDrill(`Stage: ${stage}`, rows.filter(r => (r.leadStage || "Unknown") === stage), "calls") } : undefined}>
                    {allS?.stages[stage] ?? 0}
                  </td>
                  {cols.map(c => {
                    const v = byCol[c.key]?.stages[stage] ?? 0
                    return (
                      <td key={c.key} className={`px-4 py-2.5 text-sm text-right border-b border-gray-100 ${drillCls}`}
                        style={{ color: v > 0 ? c.color : "#d1d5db" }}
                        onClick={onDrill ? (e) => { e.stopPropagation(); onDrill(`Stage: ${stage} — ${c.short}`, rows.filter(r => (r.leadStage || "Unknown") === stage && r.empName === c.key), "calls") } : undefined}>
                        {v}
                      </td>
                    )
                  })}
                </tr>
                {isOpen && subKeys.map(sub => {
                  const tot = rows.filter(r => (r.leadStage || "Unknown") === stage && r.subStage === sub).length
                  return (
                    <tr key={sub} className="bg-amber-50/40">
                      <td className="py-2 text-xs text-gray-500 border-b border-gray-100"
                        style={{ paddingLeft: 44, borderLeft: `3px solid ${stageColor}40` }}>
                        {sub}
                      </td>
                      <td className={`px-4 py-2 text-xs text-right border-b border-gray-100 text-gray-600 font-medium ${drillCls}`}
                        onClick={onDrill ? () => onDrill(`${stage} / ${sub}`, rows.filter(r => (r.leadStage || "Unknown") === stage && r.subStage === sub), "calls") : undefined}>
                        {tot}
                      </td>
                      {cols.map(c => {
                        const v = rows.filter(r => r.empName === c.key && (r.leadStage || "Unknown") === stage && r.subStage === sub).length
                        return (
                          <td key={c.key} className={`px-4 py-2 text-xs text-right border-b border-gray-100 ${drillCls}`}
                            style={{ color: v > 0 ? c.color : "#d1d5db" }}
                            onClick={onDrill ? () => onDrill(`${stage} / ${sub} — ${c.short}`, rows.filter(r => r.empName === c.key && (r.leadStage || "Unknown") === stage && r.subStage === sub), "calls") : undefined}>
                            {v}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </React.Fragment>
            )
          })}

          <SectionRow label="Duration (outgoing only)" color="#8b5cf6" />
          <DataRow label="Total (mins)" getV={s => s.totalDur} bold getRows={makeFilter(r => r.callType === "Outgoing")} />
          <DataRow label="Avg per connected call (mins)" getV={s => s.avgDur} />
        </tbody>
      </table>
      <p className="text-xs text-gray-400 mt-3 px-4">Click any number to see raw calls. Substage data joined from Lead Dump by phone.</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AI INSIGHTS PANEL
// ─────────────────────────────────────────────────────────────────────────────

function AIInsightsPanel({ rows, counsellorName, dateStr }) {
  const [status, setStatus] = useState("idle")
  const [insights, setInsights] = useState(null)
  const [errMsg, setErrMsg] = useState("")
  const cacheRef = useRef({})
  const requestKeyRef = useRef("")

  const notesRows = useMemo(() => rows.filter(r => r.notes && r.notes.trim().length > 5), [rows])
  const notesSignature = useMemo(() => {
    const compact = notesRows.map(r => [
      r.toNumber,
      r.empName,
      r.section,
      r.source,
      r.leadStage,
      r.subStage,
      r.durationMins,
      r.notes,
    ].join("~")).join("|")
    return hashText(compact)
  }, [notesRows])
  const cacheKey = `aias_ai_insights_v2__${dateStr}__${counsellorName}__${notesRows.length}__${notesSignature}`

  const readCached = useCallback((key) => {
    if (cacheRef.current[key]) return cacheRef.current[key]
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "null")
      if (stored?.insights) {
        cacheRef.current[key] = stored.insights
        return stored.insights
      }
    } catch { }
    return null
  }, [])

  const writeCached = useCallback((key, value) => {
    cacheRef.current[key] = value
    try {
      localStorage.setItem(key, JSON.stringify({
        savedAt: new Date().toISOString(),
        date: dateStr,
        counsellorName,
        notesCount: notesRows.length,
        insights: value,
      }))
    } catch { }
  }, [counsellorName, dateStr, notesRows.length])

  const run = useCallback(async (force = false) => {
    requestKeyRef.current = cacheKey
    setErrMsg("")

    if (notesRows.length === 0) {
      setInsights(null)
      setStatus("no-notes")
      return
    }

    if (!force) {
      const cached = readCached(cacheKey)
      if (cached) {
        setInsights(cached)
        setStatus("done")
        return
      }
    }

    setStatus("loading")
    try {
      const result = await fetchAIInsights(notesRows, counsellorName, dateStr)
      if (!result) throw new Error("Empty response from AI")
      if (requestKeyRef.current !== cacheKey) return
      writeCached(cacheKey, result)
      setInsights(result)
      setStatus("done")
    } catch (e) {
      if (requestKeyRef.current !== cacheKey) return
      setErrMsg(e.message)
      setStatus("error")
    }
  }, [notesRows, cacheKey, counsellorName, dateStr, readCached, writeCached])

  useEffect(() => {
    run(false)
  }, [run])

  if (status === "idle" || status === "loading") return (
    <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
      <div className="inline-block w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mb-4" />
      <div className="text-sm text-gray-600">Analysing {notesRows.length} call notes…</div>
      <div className="text-xs text-gray-400 mt-1">Stored date-wise for this counsellor and selected filters</div>
    </div>
  )

  if (status === "no-notes") return (
    <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
      <div className="text-3xl mb-3">📭</div>
      <div className="text-sm font-medium text-gray-700 mb-1">No call notes on this date</div>
      <div className="text-xs text-gray-400">{rows.length} calls found but none have notes (Col M in Calls History).</div>
    </div>
  )

  if (status === "error") return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6">
      <div className="text-sm text-red-700 font-medium mb-2">AI call failed: {errMsg}</div>
      <button onClick={() => run(true)} className="text-xs text-red-600 underline">Retry</button>
    </div>
  )

  const { topThemes, topObjections, objectionsBySource,
    overallSentiment, sentimentReason,
    leadClassifications, followupFlags } = insights

  const classified = {
    hot: (leadClassifications || []).filter(l => l.interest === "hot"),
    warm: (leadClassifications || []).filter(l => l.interest === "warm"),
    cold: (leadClassifications || []).filter(l => l.interest === "cold"),
  }
  const sent = SENTIMENT[overallSentiment] || SENTIMENT.mixed

  return (
    <div className="space-y-4">
      {/* Sentiment + themes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`rounded-xl border p-5 flex flex-col gap-2 ${sent.bg} border-opacity-50`}>
          <div className="text-xs text-gray-500 uppercase tracking-wide">Overall Sentiment</div>
          <div className={`text-xl font-bold capitalize ${sent.text}`}>{overallSentiment}</div>
          <div className="text-xs text-gray-600 leading-relaxed">{sentimentReason}</div>
        </div>
        <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-semibold text-gray-800 mb-3">Top Themes</div>
          <div className="space-y-2">
            {(topThemes || []).slice(0, 5).map(({ theme, count, example }) => (
              <div key={theme} className="flex items-start justify-between gap-3 py-1.5 border-b border-gray-100 last:border-0">
                <div>
                  <div className="text-sm text-gray-800">{theme}</div>
                  {example && <div className="text-xs text-gray-400 italic mt-0.5">"{example}"</div>}
                </div>
                <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex-shrink-0">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Objections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-semibold text-gray-800 mb-3">Objections &amp; How Handled</div>
          <div className="space-y-3">
            {(topObjections || []).map(({ objection, count, howHandled }) => (
              <div key={objection} className="border-l-2 border-red-300 pl-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-800">"{objection}"</span>
                  <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{count}×</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">→ {howHandled}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-semibold text-gray-800 mb-3">Objections by Source</div>
          <div className="space-y-2">
            {(objectionsBySource || []).map(({ source, topObjection, count }) => (
              <div key={source} className="flex justify-between items-start py-1.5 border-b border-gray-100 last:border-0">
                <div>
                  <div className="text-sm font-medium text-gray-700">{source}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{topObjection}</div>
                </div>
                <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{count}×</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hot / Warm / Cold */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="text-sm font-semibold text-gray-800 mb-3">Lead Interest Classification</div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "🔥 Hot", leads: classified.hot, border: "border-amber-300", bg: "bg-amber-50", text: "text-amber-800" },
            { label: "🌤 Warm", leads: classified.warm, border: "border-blue-300", bg: "bg-blue-50", text: "text-blue-800" },
            { label: "❄ Cold", leads: classified.cold, border: "border-gray-200", bg: "bg-gray-50", text: "text-gray-600" },
          ].map(({ label, leads, border, bg, text }) => (
            <div key={label} className={`rounded-lg border ${border} p-3`}>
              <div className={`text-xs font-semibold mb-2 ${text}`}>{label} — {leads.length}</div>
              {leads.length > 0 ? leads.map(cl => {
                const row = notesRows[cl.callIndex - 1]
                return (
                  <div key={cl.callIndex} className={`${bg} rounded-md p-2 mb-1.5 last:mb-0`}>
                    <div className="text-xs font-medium text-gray-700">{row?.source || `Call ${cl.callIndex}`}</div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-tight">{cl.reason}</div>
                    {row?.notes && (
                      <div className="text-xs text-gray-400 mt-1 italic">
                        "{row.notes.slice(0, 60)}{row.notes.length > 60 ? "…" : ""}"
                      </div>
                    )}
                  </div>
                )
              }) : <div className="text-xs text-gray-400">None</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Follow-up flags */}
      {(followupFlags || []).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-semibold text-gray-800 mb-3">Follow-up Flags</div>
          <div className="space-y-3">
            {[...followupFlags]
              .sort((a, b) => ["today", "this-week", "low"].indexOf(a.urgency) - ["today", "this-week", "low"].indexOf(b.urgency))
              .map((f, i) => {
                const u = URGENCY[f.urgency] || URGENCY.low
                const row = notesRows[f.callIndex - 1]
                return (
                  <div key={i} className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${u.bg} ${u.text} ${u.border}`}>
                      {u.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800">{row?.source || `Call ${f.callIndex}`}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{f.action}</div>
                    </div>
                    <span className="text-xs text-gray-400 border border-gray-200 rounded-full px-2 py-0.5 flex-shrink-0">
                      {row?.section || ""}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DRILL DRAWER — raw data slide-in panel
// ─────────────────────────────────────────────────────────────────────────────

function DrillDrawer({ drill, onClose }) {
  if (!drill) return null

  const CALLS_COLS = [
    { key: "empName", label: "Counsellor" },
    { key: "toNumber", label: "Phone" },
    { key: "callType", label: "Type" },
    { key: "durationMins", label: "Dur (min)", fmt: v => v ? r2(v) : "—" },
    { key: "section", label: "Section" },
    { key: "leadStage", label: "Stage" },
    { key: "subStage", label: "Sub-stage" },
    { key: "prevStage", label: "Prev Stage" },
    { key: "prevSubStage", label: "Prev Sub-stage" },
    { key: "source", label: "Source" },
    { key: "notes", label: "Notes" },
  ]

  const LEADS_COLS = [
    { key: "name", label: "Name" },
    { key: "phone", label: "Phone" },
    { key: "counsellor", label: "Counsellor" },
    { key: "stage", label: "Stage" },
    { key: "subStage", label: "Sub-stage" },
    { key: "bucket", label: "Bucket" },
    { key: "source", label: "Source" },
    { key: "type", label: "Type" },
    { key: "registeredOn", label: "Registered On" },
    { key: "lastActivity", label: "Last Activity" },
    { key: "notes", label: "Notes" },
  ]

  const cols = drill.type === "calls" ? CALLS_COLS : LEADS_COLS

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-3xl bg-white z-50 shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <div className="text-sm font-semibold text-gray-800">{drill.title}</div>
            <div className="text-xs text-gray-400 mt-0.5">{drill.rows.length} record{drill.rows.length !== 1 ? "s" : ""}</div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition text-xl leading-none">
            ×
          </button>
        </div>
        <div className="overflow-auto flex-1">
          {drill.rows.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-400">No records for this selection.</div>
          ) : (
            <table className="w-full text-xs min-w-[700px]">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                <tr>
                  {cols.map(c => (
                    <th key={c.key} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {drill.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {cols.map(c => {
                      const raw = row[c.key]
                      const val = c.fmt ? c.fmt(raw) : (raw || "—")
                      return (
                        <td key={c.key}
                          className={`px-3 py-2 text-gray-700 truncate ${c.key === "notes" ? "max-w-[260px]" : "max-w-[150px]"}`}
                          title={String(raw ?? "")}>
                          {val}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAID APPS — HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const PA_MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }

function paidSerialToDate(serial) {
  if (!serial && serial !== 0) return null
  const n = Number(serial)
  if (!isNaN(n) && n > 1) return new Date((n - 25569) * 86400000)
  if (typeof serial === "string") {
    const m = serial.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})(?:,\s*(\d{1,2}):(\d{2})\s*(AM|PM))?/i)
    if (m) {
      const day = parseInt(m[1]), mon = PA_MONTHS[m[2].toLowerCase()], yr = parseInt(m[3])
      if (mon === undefined) return null
      let hr = m[4] ? parseInt(m[4]) : 0
      const mn2 = m[5] ? parseInt(m[5]) : 0
      if (m[6]) {
        if (m[6].toUpperCase() === "PM" && hr !== 12) hr += 12
        if (m[6].toUpperCase() === "AM" && hr === 12) hr = 0
      }
      return new Date(yr, mon, day, hr, mn2)
    }
    const d = new Date(serial)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

function paidGetWeekMonday(date) {
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  const day = d.getDay(); d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); return d
}

function paidGetDefaultWeekStart() {
  const mon = paidGetWeekMonday(new Date()); mon.setDate(mon.getDate() - 7); return mon
}

function fmtPaidDate(date) {
  if (!date) return "—"
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function fmtPaidWeekLabel(weekStart) {
  const end = new Date(weekStart); end.setDate(end.getDate() + 6)
  return `${fmtPaidDate(weekStart)} – ${fmtPaidDate(end)}`
}

const PA_DAYS_BUCKET_ORDER = ["Same day", "1–3 days", "4–7 days", "8–14 days", "15–30 days", "30+ days", "Unknown"]

function paidGetDaysBucket(days) {
  if (days === null || days === undefined || isNaN(days)) return "Unknown"
  if (days <= 0) return "Same day"
  if (days <= 3) return "1–3 days"
  if (days <= 7) return "4–7 days"
  if (days <= 14) return "8–14 days"
  if (days <= 30) return "15–30 days"
  return "30+ days"
}

function paidGetWorkStatus(gradYear) {
  const yr = parseInt(gradYear)
  if (isNaN(yr)) return "Unknown"
  const now = new Date().getFullYear()
  if (yr < now) return "Working Professional"
  if (yr === now) return "Fresher"
  return "Student"
}

function parsePaidAppRow(row) {
  if (!row) return null
  const status = (row[2] || "").trim().toLowerCase()
  if (status !== "completed") return null
  // Column indices (0-based) per current App Start Dump layout:
  // C(2)=Payment Status, Q(16)=Registered On, BH(59)=Application Fee Paid On,
  // M(12)=Name, N(13)=Email, O(14)=Mobile, S(18)=Source, T(19)=Medium, U(20)=Campaign,
  // AR(43)=Counsellor, BY(76)=State, BZ(77)=City, CK(88)=Graduation year (before insert, unchanged),
  // DE(108)=Undergrad university, DH(111)=Undergrad degree,
  // EA(130)=Current/most recent organization, EG(136)=Designation  (all +2 from the 2 new profile cols)
  const registeredOn = paidSerialToDate(row[16])
  const paidOn = paidSerialToDate(row[59]) || registeredOn || null
  const daysToConvert = (registeredOn && paidOn) ? Math.round((paidOn - registeredOn) / 86400000) : null
  const gradYear = parseInt(row[88]) || null
  return {
    applicationNumber: cellText(row[1]),  // B = Application Number (classification key)
    name: cellText(row[12]),
    email: cellText(row[13]),
    mobile: cellText(row[14]),
    source: cellText(row[18]) || "Unknown",
    medium: cellText(row[19]) || "Unknown",
    campaign: cellText(row[20]) || "Unknown",
    counsellor: normalizeName(row[43]) || cellText(row[43]) || "Unknown",
    registeredOn,
    paidOn,
    daysToConvert,
    daysBucket: paidGetDaysBucket(daysToConvert),
    state: cellText(row[76]) || "Unknown",
    city: cellText(row[77]) || "Unknown",
    gradYear: gradYear ? String(gradYear) : "Unknown",
    workStatus: paidGetWorkStatus(gradYear),
    college: cellText(row[108]) || "Unknown",
    degree: cellText(row[111]) || "Unknown",
    company: cellText(row[130]) || "Unknown",
    role: cellText(row[136]) || "Unknown",
  }
}

function paidGroupRank(leads, field, topN = 8) {
  const counts = {}
  for (const l of leads) { const v = (l[field] || "Unknown") || "Unknown"; counts[v] = (counts[v] || 0) + 1 }
  const sorted = Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
  if (sorted.length <= topN) return sorted
  const top = sorted.slice(0, topN)
  const rest = sorted.slice(topN).reduce((s, x) => s + x.count, 0)
  return [...top, { label: "Others", count: rest }]
}

function paidGroupRankFull(leads, field) {
  const counts = {}
  for (const l of leads) { const v = (l[field] || "Unknown") || "Unknown"; counts[v] = (counts[v] || 0) + 1 }
  return Object.entries(counts).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
}

function paidGroupDaysBuckets(leads) {
  const counts = {}
  for (const l of leads) counts[l.daysBucket] = (counts[l.daysBucket] || 0) + 1
  return PA_DAYS_BUCKET_ORDER.filter(b => counts[b]).map(b => ({ label: b, count: counts[b] }))
}

// ─────────────────────────────────────────────────────────────────────────────
// PAID APPS — COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const PA_COUNSELLOR_COLORS = {
  "Jasmeet Kaur": { color: "#3b82f6", bg: "#eff6ff" },
  "Komal Pandey": { color: "#8b5cf6", bg: "#f5f3ff" },
  "Prerna Kaushik": { color: "#ec4899", bg: "#fdf2f8" },
}

const PA_ATTR_CONFIGS = [
  { field: "source", title: "Source", icon: "🌐", accent: "#4F46E5" },
  { field: "medium", title: "Medium / Channel", icon: "📡", accent: "#0891B2" },
  { field: "counsellor", title: "Counsellor", icon: "🧑‍💼", accent: "#059669" },
  { field: "workStatus", title: "Work Status", icon: "💼", accent: "#D97706" },
  { field: "daysBucket", title: "Days to Convert", icon: "⏱️", accent: "#DC2626" },
  { field: "city", title: "City", icon: "🏙️", accent: "#0891B2" },
  { field: "state", title: "State", icon: "📍", accent: "#475569" },
  { field: "gradYear", title: "Graduation Year", icon: "🎓", accent: "#7C3AED" },
  { field: "degree", title: "Degree", icon: "📜", accent: "#059669" },
  { field: "college", title: "College", icon: "🏛️", accent: "#D97706" },
  { field: "company", title: "Company", icon: "🏢", accent: "#334155" },
  { field: "role", title: "Role", icon: "👤", accent: "#4F46E5" },
]

function PaidAttrList({ items, total, accent }) {
  return (
    <div className="flex flex-col divide-y divide-gray-50">
      {items.map(({ label, count }, i) => {
        const pct = total ? Math.round(count / total * 100) : 0
        const isOther = label === "Others"
        return (
          <div key={label} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
            <span className="w-5 text-xs font-bold flex-shrink-0 text-right"
              style={{ color: isOther ? "#CBD5E1" : accent }}>
              {i + 1}
            </span>
            <span className={`flex-1 text-xs truncate min-w-0 ${isOther ? "text-gray-400 italic" : "text-gray-700"}`}
              title={label}>
              {label}
            </span>
            <span className="text-sm font-bold text-gray-900 flex-shrink-0">{count}</span>
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0 tabular-nums w-10 text-center"
              style={{
                background: isOther ? "#F1F5F9" : `${accent}18`,
                color: isOther ? "#94A3B8" : accent,
              }}>
              {pct}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

function PaidAttrDrillDrawer({ title, icon, field, leads, total, accent, onClose }) {
  const fullList = useMemo(() => {
    if (field === "daysBucket") return paidGroupDaysBuckets(leads)
    return paidGroupRankFull(leads, field)
  }, [leads, field])

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full z-50 bg-white shadow-2xl flex flex-col"
        style={{ width: "min(440px, 95vw)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div>
            <div className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: accent }}>
              {icon} {title} · Full Breakdown
            </div>
            <div className="text-base font-bold text-gray-900">
              {fullList.length} unique value{fullList.length !== 1 ? "s" : ""} · {total} total
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-500 text-xl transition">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex flex-col divide-y divide-gray-50">
            {fullList.map(({ label, count }, i) => {
              const pct = total ? Math.round(count / total * 100) : 0
              return (
                <div key={label} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="w-7 text-xs font-bold flex-shrink-0 text-right" style={{ color: accent }}>
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm text-gray-700 min-w-0 truncate" title={label}>
                    {label}
                  </span>
                  <span className="text-sm font-bold text-gray-900 flex-shrink-0">{count}</span>
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0 tabular-nums w-12 text-center"
                    style={{ background: `${accent}18`, color: accent }}>
                    {pct}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

function PaidAppsDrawer({ leads, label, onClose }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full z-50 bg-white shadow-2xl flex flex-col"
        style={{ width: "min(1060px, 95vw)" }}
        onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 flex-shrink-0 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #1E1B4B, #312E81)", borderBottom: "1px solid rgba(255,255,255,.1)" }}>
          <div>
            <div className="text-xs font-bold tracking-widest mb-1" style={{ color: "#A5B4FC" }}>
              PAID APPS · DRILL-DOWN
            </div>
            <div className="text-base font-bold text-white">
              {leads.length} paid app{leads.length !== 1 ? "s" : ""} · {label}
            </div>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-xl leading-none transition"
            style={{ background: "rgba(255,255,255,.15)", color: "#E0E7FF", border: "none", cursor: "pointer" }}>
            ×
          </button>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-xs min-w-[1000px] border-collapse">
            <thead className="sticky top-0 bg-gray-50 border-b-2 border-gray-200">
              <tr>
                {["#", "Name", "Counsellor", "Source", "Medium", "City", "State", "College", "Degree",
                  "Grad Yr", "Work Status", "Company", "Role", "Paid On", "Days to Convert"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-bold text-gray-500 whitespace-nowrap uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((l, i) => {
                const wsColors = l.workStatus === "Working Professional"
                  ? "bg-emerald-50 text-emerald-700"
                  : l.workStatus === "Fresher"
                    ? "bg-indigo-50 text-indigo-700"
                    : "bg-gray-50 text-gray-600"
                return (
                  <tr key={i} className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                    <td className="px-3 py-2 text-gray-400 font-semibold">{i + 1}</td>
                    <td className="px-3 py-2 font-semibold text-gray-900 whitespace-nowrap">{l.name || "—"}</td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{l.counsellor}</td>
                    <td className="px-3 py-2 text-gray-600">{l.source}</td>
                    <td className="px-3 py-2 text-gray-600">{l.medium}</td>
                    <td className="px-3 py-2 text-gray-600">{l.city}</td>
                    <td className="px-3 py-2 text-gray-600">{l.state}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-[160px] truncate" title={l.college}>{l.college}</td>
                    <td className="px-3 py-2 text-gray-600">{l.degree}</td>
                    <td className="px-3 py-2 text-gray-600 text-center">{l.gradYear}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${wsColors}`}>
                        {l.workStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 max-w-[140px] truncate" title={l.company}>{l.company}</td>
                    <td className="px-3 py-2 text-gray-600 max-w-[140px] truncate" title={l.role}>{l.role}</td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtPaidDate(l.paidOn)}</td>
                    <td className="px-3 py-2 text-center font-bold whitespace-nowrap"
                      style={{ color: l.daysToConvert === null ? "#94a3b8" : l.daysToConvert <= 3 ? "#059669" : l.daysToConvert <= 14 ? "#D97706" : "#DC2626" }}>
                      {l.daysToConvert !== null ? `${l.daysToConvert}d` : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function PaidAppsPanel({ appRows }) {
  const [viewMode, setViewMode] = useState("overall")
  const [weekStart, setWeekStart] = useState(() => paidGetDefaultWeekStart())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drillAttr, setDrillAttr] = useState(null)

  const allPaid = useMemo(() =>
    (appRows || []).slice(1).map(row => { try { return parsePaidAppRow(row) } catch { return null } }).filter(Boolean)
    , [appRows])

  const weekLeads = useMemo(() => {
    if (viewMode === "overall") return allPaid
    const start = new Date(weekStart); start.setHours(0, 0, 0, 0)
    const end = new Date(weekStart); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999)
    return allPaid.filter(l => l.paidOn && l.paidOn >= start && l.paidOn <= end)
  }, [allPaid, weekStart, viewMode])

  const total = weekLeads.length

  const weeklyTrend = useMemo(() => {
    const thisMonday = paidGetWeekMonday(new Date())
    const weeks = []
    for (let i = 7; i >= 0; i--) {
      const start = new Date(thisMonday); start.setDate(start.getDate() - i * 7); start.setHours(0, 0, 0, 0)
      const end = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999)
      const count = allPaid.filter(l => l.paidOn && l.paidOn >= start && l.paidOn <= end).length
      weeks.push({ name: fmtPaidDate(start).slice(0, -5), count })
    }
    return weeks
  }, [allPaid])

  const attrs = useMemo(() => ({
    source: paidGroupRank(weekLeads, "source"),
    medium: paidGroupRank(weekLeads, "medium"),
    counsellor: paidGroupRank(weekLeads, "counsellor"),
    workStatus: paidGroupRank(weekLeads, "workStatus"),
    city: paidGroupRank(weekLeads, "city"),
    state: paidGroupRank(weekLeads, "state"),
    gradYear: paidGroupRank(weekLeads, "gradYear"),
    degree: paidGroupRank(weekLeads, "degree"),
    college: paidGroupRank(weekLeads, "college"),
    company: paidGroupRank(weekLeads, "company"),
    role: paidGroupRank(weekLeads, "role"),
    daysBucket: paidGroupDaysBuckets(weekLeads),
  }), [weekLeads])

  const counsellorSplit = useMemo(() => {
    const map = {}
    for (const l of weekLeads) map[l.counsellor] = (map[l.counsellor] || 0) + 1
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [weekLeads])

  const thisMonday = paidGetWeekMonday(new Date())
  const atPresent = weekStart >= thisMonday
  function shiftWeek(n) { const d = new Date(weekStart); d.setDate(d.getDate() + n * 7); setWeekStart(d) }

  const viewLabel = viewMode === "overall" ? "All Time" : fmtPaidWeekLabel(weekStart)

  if ((appRows || []).length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 gap-2 text-sm text-gray-400">
      <div className="text-2xl">📋</div>
      <div className="font-semibold text-gray-600">App Start Dump not loaded</div>
      <div className="text-xs text-center max-w-xs">
        The sheet named <span className="font-mono bg-gray-100 px-1 rounded">App Start Dump</span> could not be fetched.
        Check the sheet name and sharing settings.
      </div>
    </div>
  )

  return (
    <div className="p-5 space-y-5">

      {/* View toggle + week nav */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {[["weekly", "📅 Weekly"], ["overall", "🌍 Overall"]].map(([k, l]) => (
            <button key={k} onClick={() => setViewMode(k)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}>
              {l}
            </button>
          ))}
        </div>

        {viewMode === "weekly" && (
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm">
            <button onClick={() => shiftWeek(-1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 transition text-lg font-bold">
              ‹
            </button>
            <span className="text-sm font-semibold text-gray-800 px-2 whitespace-nowrap">
              {fmtPaidWeekLabel(weekStart)}
            </span>
            <button onClick={() => !atPresent && shiftWeek(1)}
              className={`w-7 h-7 flex items-center justify-center rounded-lg transition text-lg font-bold ${atPresent ? "text-gray-300 cursor-not-allowed" : "hover:bg-gray-100 text-gray-600"
                }`}>
              ›
            </button>
          </div>
        )}
      </div>

      {/* Hero card */}
      <div onClick={() => total > 0 && setDrawerOpen(true)}
        className="rounded-2xl p-7 flex items-center justify-between transition-all"
        style={{
          background: total > 0
            ? "linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)"
            : "#F8FAFC",
          border: total > 0 ? "none" : "1px solid #E2E8F0",
          cursor: total > 0 ? "pointer" : "default",
          filter: "brightness(1)",
        }}
        onMouseEnter={e => total > 0 && (e.currentTarget.style.filter = "brightness(1.06)")}
        onMouseLeave={e => (e.currentTarget.style.filter = "brightness(1)")}>
        <div>
          <div className="text-xs font-bold tracking-widest mb-3"
            style={{ color: total > 0 ? "#A5B4FC" : "#94A3B8" }}>
            {viewMode === "overall" ? "ALL TIME · PAID APPS" : "PAID APPS THIS WEEK"}
          </div>
          <div className="text-6xl font-extrabold leading-none"
            style={{ color: total > 0 ? "#FFFFFF" : "#CBD5E1" }}>
            {total}
          </div>
          <div className="text-sm mt-3" style={{ color: total > 0 ? "#C7D2FE" : "#94A3B8" }}>
            {viewLabel}
          </div>
        </div>

        {total > 0 ? (
          <div className="flex flex-col gap-2.5 items-end">
            <div className="flex flex-col gap-1.5">
              {counsellorSplit.slice(0, 3).map(([name, count]) => {
                const meta = PA_COUNSELLOR_COLORS[name]
                return (
                  <div key={name} className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                    style={{ background: "rgba(255,255,255,.15)" }}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: meta?.color || "#a5b4fc" }} />
                    <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,.8)" }}>
                      {name.split(" ")[0]}
                    </span>
                    <span className="text-sm font-bold text-white">{count}</span>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: "rgba(255,255,255,.2)", color: "#E0E7FF" }}>
              📋 View {total} records →
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-400">No paid apps in this period</div>
        )}
      </div>

      {/* Trend chart — weekly mode only */}
      {viewMode === "weekly" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="text-sm font-semibold text-gray-800 mb-4">Weekly Trend (last 8 weeks)</div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={weeklyTrend} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
              <Bar dataKey="count" name="Paid Apps" fill="#4338CA" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Attribution grid */}
      {total > 0 ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))" }}>
          {PA_ATTR_CONFIGS.map(({ field, title, icon, accent }) => {
            const data = field === "daysBucket" ? attrs.daysBucket : attrs[field]
            if (!data || data.length === 0) return null
            return (
              <div key={field}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all"
                onClick={() => setDrillAttr({ field, title, icon, accent })}>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-semibold text-gray-800">{icon} {title}</div>
                  <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-md px-2 py-0.5">
                    {total} total · click to expand
                  </span>
                </div>
                <PaidAttrList items={data} total={total} accent={accent} />
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center">
          <div className="text-3xl mb-3">💳</div>
          <div className="text-sm font-semibold text-gray-700 mb-1">No paid apps in this period</div>
          <div className="text-xs text-gray-400">
            {viewMode === "weekly" ? "Try navigating to a different week." : "No completed app starts found."}
          </div>
          {allPaid.length > 0 && viewMode === "weekly" && (
            <div className="mt-3 text-xs text-indigo-600 font-medium">
              {allPaid.length} total paid apps exist — use the week nav to find them.
            </div>
          )}
        </div>
      )}

      {drawerOpen && (
        <PaidAppsDrawer leads={weekLeads} label={viewLabel} onClose={() => setDrawerOpen(false)} />
      )}

      {drillAttr && (
        <PaidAttrDrillDrawer
          title={drillAttr.title}
          icon={drillAttr.icon}
          field={drillAttr.field}
          leads={weekLeads}
          total={total}
          accent={drillAttr.accent}
          onClose={() => setDrillAttr(null)}
        />
      )}

    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────

function Overview({ date, setDate, allRows, pipelineRows, pipelineChanges, onDrill, onOpenPipeline }) {
  const s = computeStats(allRows)

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Admin · Insights</div>
          <div className="text-2xl font-bold text-gray-900">Daily Summary</div>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={onDrill}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition">
            Detailed Analysis →
          </button>
        </div>
      </div>

      {s ? (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Total Calls" value={s.total} sub="all counsellors" icon="📞" />
            <KPICard label="Connected" value={`${s.connected} (${s.connPct ?? 0}%)`}
              sub="of outgoing"
              color={s.connPct >= 40 ? "#16a34a" : s.connPct >= 20 ? "#d97706" : "#dc2626"}
              icon="✅" />
            <KPICard label="Total Duration" value={`${s.totalDur}m`} sub="outgoing calls" icon="⏱" />
            <KPICard label="Avg / Call" value={`${s.avgDur}m`} sub="connected only" icon="📊" />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <CallsBarChart allRows={allRows} />
            </div>
            <CallTypeDonut rows={allRows} />
          </div>

          <PipelineSummary pipelineRows={pipelineRows} pipelineChanges={pipelineChanges} onOpenPipeline={onOpenPipeline} />

          {/* Counsellor cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {orderCols(allRows.map(r => r.empName)).map(c => {
              const cs = computeStats(allRows.filter(r => r.empName === c.key))
              return (
                <div key={c.key} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={onDrill}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white"
                      style={{ background: c.color }}>
                      {c.short[0]}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">{c.short}</div>
                      <div className="text-xs text-gray-400">{c.key}</div>
                    </div>
                    {cs && (
                      <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: c.bg, color: c.color }}>
                        {cs.outgoing} out
                      </span>
                    )}
                  </div>
                  {cs ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Connected</span>
                        <span className="font-semibold" style={{ color: c.color }}>
                          {cs.connected} / {cs.outgoing} ({cs.connPct ?? 0}%)
                        </span>
                      </div>
                      <ProgressBar pct={cs.connPct} color={c.color} />
                      <div className="pt-2 space-y-1">
                        <StatChip label="Total calls" value={cs.total} color={c.color} />
                        <StatChip label="Missed" value={cs.missed} color="#ef4444" />
                        <StatChip label="Duration" value={`${cs.totalDur}m`} color="#64748b" />
                        <StatChip label="Avg / call" value={`${cs.avgDur}m`} color="#64748b" />
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 py-4 text-center">No calls on {date}</div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <PipelineSummary pipelineRows={pipelineRows} pipelineChanges={pipelineChanges} onOpenPipeline={onOpenPipeline} />
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
            <div className="text-4xl mb-4">📭</div>
            <div className="text-gray-500">No calls found on {date}. Try a different date.</div>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LEADERBOARD
// ─────────────────────────────────────────────────────────────────────────────

// Week = Monday → Sunday. Returns the Monday 00:00 of the week containing `d`.
function lbMonday(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0)
  const day = (x.getDay() + 6) % 7  // Mon=0 … Sun=6
  x.setDate(x.getDate() - day)
  return x
}
function lbYmd(d) {  // local 'YYYY-MM-DD' (avoid UTC shift from toISOString)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
function lbWeekKey(d) { return lbYmd(lbMonday(d)) }  // the Monday of d's week
function lbWeekLabel(mondayKey) {
  if (!mondayKey) return "—"
  const s = new Date(mondayKey + "T00:00:00")
  const e = new Date(s); e.setDate(e.getDate() + 6)
  const f = dt => dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
  return `${f(s)} – ${f(e)}, ${e.getFullYear()}`
}
function lbTopKey(counts) {
  let best = null, bestN = 0
  for (const [k, n] of Object.entries(counts)) if (n > bestN) { best = k; bestN = n }
  return best || "—"
}

function lbEsc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
function lbFmtMins(mins) {
  const m = Math.round(mins || 0)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60), r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

// Minimalist "Masters Union" email — indigo header band, soft stat cards, clean table.
function lbEmailHtml(rows, periodLabel, totals) {
  const isOverall = periodLabel === "Overall"
  const INDIGO = "#2b2f9e"
  const statCard = (value, label, color, bg, border) => `
    <td width="33.33%" style="padding:0 5px;" valign="top">
      <div style="background:${bg};border:1px solid ${border};border-radius:12px;padding:16px 8px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:${color};line-height:1.2;">${value}</div>
        <div style="font-size:10px;font-weight:700;letter-spacing:.06em;color:#6b7280;text-transform:uppercase;margin-top:6px;">${label}</div>
      </div>
    </td>`

  const body = rows.map((r, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1)
    const bg = i === 0 ? "#fffbeb" : "#ffffff"
    return `
    <tr style="background:${bg};">
      <td style="padding:13px 16px;border-bottom:1px solid #eef0f4;text-align:center;font-size:15px;width:46px;">${medal}</td>
      <td style="padding:13px 16px;border-bottom:1px solid #eef0f4;font-weight:600;color:#1f2333;">${lbEsc(r.counsellor)}</td>
      <td style="padding:13px 16px;border-bottom:1px solid #eef0f4;text-align:center;font-weight:800;color:${INDIGO};">${r.paidApps}</td>
      <td style="padding:13px 16px;border-bottom:1px solid #eef0f4;text-align:center;color:#475467;white-space:nowrap;">${lbFmtMins(r.mins)}</td>
      <td style="padding:13px 16px;border-bottom:1px solid #eef0f4;color:#5b6072;">${lbEsc(r.topCity)}</td>
    </tr>`
  }).join("")

  return `<div style="background:#f0f2f8;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(16,24,40,.08);">
    <tr><td style="background:${INDIGO};padding:30px 40px;">
      <div style="font-size:12px;font-weight:700;letter-spacing:.14em;color:rgba(255,255,255,.6);text-transform:uppercase;">Masters Union</div>
      <div style="font-size:26px;font-weight:800;color:#ffffff;margin-top:8px;">🏆 ${isOverall ? "Leaderboard" : "Weekly Leaderboard"}</div>
      <div style="font-size:14px;color:rgba(255,255,255,.75);margin-top:4px;">${lbEsc(periodLabel)}</div>
    </td></tr>
    <tr><td style="padding:30px 40px;">
      <p style="margin:0 0 4px;font-size:15px;color:#1f2333;">Hi team,</p>
      <p style="margin:0 0 24px;font-size:14px;color:#5b6072;line-height:1.6;">Here's the ${isOverall ? "" : "weekly "}leaderboard${isOverall ? "" : ` for <strong>${lbEsc(periodLabel)}</strong>`}. Ranked by <strong>counseled paid apps</strong> — inbound and unclassified are excluded.</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;"><tr>
        ${statCard(totals.paid, "Paid Apps", "#2b54e0", "#eff4ff", "#dbe6ff")}
        ${statCard(lbFmtMins(totals.mins), "Total Talk Time", "#7c3aed", "#f5f3ff", "#e9e2ff")}
        ${statCard(totals.top ? lbEsc(totals.top.counsellor.split(" ")[0]) : "—", "Top Performer", "#059669", "#ecfdf5", "#d1fae5")}
      </tr></table>

      <div style="font-size:12px;font-weight:700;letter-spacing:.08em;color:#1f2333;text-transform:uppercase;border-bottom:2px solid #eef0f4;padding-bottom:8px;margin:0 0 4px;">Leaderboard</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
        <thead><tr style="background:#f7f8fc;">
          <th style="padding:10px 16px;text-align:center;font-size:10px;letter-spacing:.06em;color:#8a90a2;text-transform:uppercase;border-bottom:1px solid #eef0f4;">#</th>
          <th style="padding:10px 16px;text-align:left;font-size:10px;letter-spacing:.06em;color:#8a90a2;text-transform:uppercase;border-bottom:1px solid #eef0f4;">Counsellor</th>
          <th style="padding:10px 16px;text-align:center;font-size:10px;letter-spacing:.06em;color:#8a90a2;text-transform:uppercase;border-bottom:1px solid #eef0f4;">Paid Apps</th>
          <th style="padding:10px 16px;text-align:center;font-size:10px;letter-spacing:.06em;color:#8a90a2;text-transform:uppercase;border-bottom:1px solid #eef0f4;">Talk Time</th>
          <th style="padding:10px 16px;text-align:left;font-size:10px;letter-spacing:.06em;color:#8a90a2;text-transform:uppercase;border-bottom:1px solid #eef0f4;">Top City</th>
        </tr></thead>
        <tbody>${body || `<tr><td colspan="5" style="padding:24px;text-align:center;color:#9aa0b0;">No counseled paid apps in this period.</td></tr>`}</tbody>
      </table>

      <p style="margin:24px 0 0;font-size:12px;color:#aab0c0;">Sent from AIAS Admin · Counseled paid apps only · inbound excluded.</p>
    </td></tr>
  </table>
</div>`
}

function LeaderboardPanel({ appRows }) {
  const [tab, setTab] = useState("overall")          // 'overall' | 'weekly'
  const [selectedWeek, setSelectedWeek] = useState("")
  const [classMap, setClassMap] = useState(null)     // { [appNum]: 'counseled'|'inbound' }
  const [calls, setCalls] = useState(null)           // [{ emp, date(Date), mins }]
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")
  const [savingKey, setSavingKey] = useState(null)
  const [reviewFilter, setReviewFilter] = useState("pending")  // pending | counseled | inbound
  const [email, setEmail] = useState({ sending: false, msg: "" })

  // Completed paid apps, keyed for classification, tagged with their Mon–Sun week.
  const paidApps = useMemo(() =>
    (appRows || []).slice(1)
      .map(r => { try { return parsePaidAppRow(r) } catch { return null } })
      .filter(Boolean)
      .filter(a => a.applicationNumber)
      .map(a => ({ ...a, week: a.paidOn ? lbWeekKey(a.paidOn) : null }))
  , [appRows])

  // Load classification map + full (cumulative) call history once.
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setErr("")
      try {
        const params = new URLSearchParams({ action: "fetch", sheet: "Call History updated Daily", range: "A2:Y" })
        const [cls, callsRes] = await Promise.all([
          fetch("/api/paidapp-classify").then(r => r.ok ? r.json() : { map: {} }).catch(() => ({ map: {} })),
          fetch(`/api/sheets?${params}`).then(r => { if (!r.ok) throw new Error(`Call History fetch failed (${r.status})`); return r.json() }),
        ])
        if (cancelled) return
        const parsed = (callsRes.rows || []).slice(1).map(row => {
          const emp = normalizeName(row[3])
          const dt = parseDate(row[12])
          const mins = parseDurationMins(row[24] ?? row[11])
          return emp && dt ? { emp, date: dt, mins: mins || 0 } : null
        }).filter(Boolean)
        setClassMap(cls.map || {})
        setCalls(parsed)
      } catch (e) {
        if (!cancelled) setErr(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Past weeks present in the data (newest first), default to the most recent.
  const weeks = useMemo(() => {
    const set = new Set()
    paidApps.forEach(a => a.week && set.add(a.week))
    ;(calls || []).forEach(c => set.add(lbWeekKey(c.date)))
    return [...set].sort().reverse()
  }, [paidApps, calls])

  useEffect(() => { if (!selectedWeek && weeks.length) setSelectedWeek(weeks[0]) }, [weeks, selectedWeek])

  // Leaderboard rows for the active period.
  const board = useMemo(() => {
    if (!classMap || !calls) return []
    const inWeek = tab === "weekly" ? selectedWeek : null
    const byC = {}
    const ensure = name => (byC[name] ||= { counsellor: name, paidApps: 0, mins: 0, cityCounts: {} })

    paidApps
      .filter(a => classMap[a.applicationNumber] === "counseled")
      .filter(a => !inWeek || a.week === inWeek)
      .forEach(a => {
        if (!a.counsellor || a.counsellor === "Unknown") return
        const e = ensure(a.counsellor)
        e.paidApps++
        if (a.city && a.city !== "Unknown") e.cityCounts[a.city] = (e.cityCounts[a.city] || 0) + 1
      })

    calls
      .filter(c => !inWeek || lbWeekKey(c.date) === inWeek)
      .forEach(c => { if (c.emp && c.emp !== "Others") ensure(c.emp).mins += c.mins })

    return Object.values(byC)
      .map(e => ({ counsellor: e.counsellor, paidApps: e.paidApps, mins: Math.round(e.mins), topCity: lbTopKey(e.cityCounts) }))
      .sort((a, b) => b.paidApps - a.paidApps || b.mins - a.mins || a.counsellor.localeCompare(b.counsellor))
  }, [classMap, calls, paidApps, tab, selectedWeek])

  const pendingCount = useMemo(() => classMap ? paidApps.filter(a => !classMap[a.applicationNumber]).length : 0, [classMap, paidApps])

  const totals = useMemo(() => ({
    paid: board.reduce((s, r) => s + r.paidApps, 0),
    mins: board.reduce((s, r) => s + r.mins, 0),
    top:  board.find(r => r.paidApps > 0) || null,
  }), [board])

  const reviewList = useMemo(() => {
    if (!classMap) return []
    return paidApps
      .filter(a => (classMap[a.applicationNumber] || "pending") === reviewFilter)
      .sort((a, b) => (b.paidOn?.getTime() || 0) - (a.paidOn?.getTime() || 0))
      .slice(0, 200)
  }, [classMap, paidApps, reviewFilter])

  async function classify(appNum, classification) {
    setSavingKey(appNum)
    try {
      const r = await fetch("/api/paidapp-classify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_number: appNum, classification, classified_by: "admin" }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "save failed")
      setClassMap(prev => {
        const next = { ...prev }
        if (classification === "pending") delete next[appNum]
        else next[appNum] = classification
        return next
      })
    } catch (e) {
      alert("Could not save: " + e.message)
    } finally {
      setSavingKey(null)
    }
  }

  async function sendEmail() {
    setEmail({ sending: true, msg: "" })
    try {
      const periodLabel = tab === "weekly" ? lbWeekLabel(selectedWeek) : "Overall"
      const html = lbEmailHtml(board, periodLabel, totals)
      const subject = tab === "weekly" ? `🏆 Weekly Leaderboard — ${periodLabel}` : "🏆 Leaderboard — Overall"
      const r = await fetch("/api/leaderboard-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, html, week: selectedWeek }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || "send failed")
      setEmail({ sending: false, msg: `✓ Sent to ${d.recipients?.length ?? ""} recipient(s)` })
    } catch (e) {
      setEmail({ sending: false, msg: "⚠ " + e.message })
    }
    setTimeout(() => setEmail(s => ({ ...s, msg: "" })), 6000)
  }

  if (loading) return (
    <div className="py-20 flex flex-col items-center gap-3 text-gray-400">
      <div className="w-8 h-8 border-2 border-gray-300 border-t-[#2b2f9e] rounded-full animate-spin" />
      <span className="text-sm">Loading leaderboard…</span>
    </div>
  )
  if (err) return <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">{err}</div>

  const seg = (active) => `px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${active ? "bg-white shadow-sm text-[#2b2f9e]" : "text-gray-500 hover:text-gray-700"}`
  const medal = i => i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1
  const initials = n => n.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
  const periodLabel = tab === "weekly" ? lbWeekLabel(selectedWeek) : "All time"

  return (
    <div className="space-y-5">
      {/* ── Header band (matches the email) ── */}
      <div className="rounded-2xl bg-[#2b2f9e] px-6 py-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold tracking-[0.14em] text-white/55 uppercase">Masters Union</div>
          <div className="text-2xl font-extrabold text-white mt-1">🏆 Leaderboard</div>
          <div className="text-sm text-white/70 mt-0.5">{periodLabel} · counseled paid apps only</div>
        </div>
        <div className="flex items-center gap-2">
          {email.msg && <span className="text-xs text-white/80">{email.msg}</span>}
          <button onClick={sendEmail} disabled={email.sending || board.length === 0}
            className="px-4 py-2 bg-white text-[#2b2f9e] rounded-lg text-xs font-bold transition hover:bg-white/90 disabled:opacity-50">
            {email.sending ? "Sending…" : "📧 Email leaderboard"}
          </button>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button onClick={() => setTab("overall")} className={seg(tab === "overall")}>Overall</button>
          <button onClick={() => setTab("weekly")} className={seg(tab === "weekly")}>Weekly</button>
        </div>
        {tab === "weekly" && (
          <select value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#2b2f9e]">
            {weeks.length === 0 && <option value="">No weeks</option>}
            {weeks.map(w => <option key={w} value={w}>{lbWeekLabel(w)}</option>)}
          </select>
        )}
      </div>

      {/* ── Summary stat cards ── */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard value={totals.paid} label="Paid Apps" color="#2b54e0" bg="bg-blue-50" border="border-blue-100" />
        <StatCard value={lbFmtMins(totals.mins)} label="Total Talk Time" color="#7c3aed" bg="bg-violet-50" border="border-violet-100" />
        <StatCard value={totals.top ? totals.top.counsellor.split(" ")[0] : "—"} label="Top Performer" color="#059669" bg="bg-emerald-50" border="border-emerald-100" />
      </div>

      {/* ── Leaderboard table ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide w-16">Rank</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Counsellor</th>
                <th className="px-5 py-3 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Paid Apps</th>
                <th className="px-5 py-3 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Talk Time</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Top City</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {board.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400 text-sm">No counseled paid apps in this period yet. Approve some below ↓</td></tr>
              )}
              {board.map((r, i) => (
                <tr key={r.counsellor} className={`hover:bg-gray-50 transition ${i === 0 ? "bg-amber-50/40" : ""}`}>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`inline-flex items-center justify-center ${i < 3 ? "text-xl" : "w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-xs font-bold"}`}>{medal(i)}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 shrink-0 rounded-full bg-[#2b2f9e]/10 text-[#2b2f9e] flex items-center justify-center text-[11px] font-bold">{initials(r.counsellor)}</span>
                      <span className="font-semibold text-gray-800">{r.counsellor}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="inline-block min-w-[2rem] px-2.5 py-1 rounded-lg bg-[#2b2f9e]/8 text-[#2b2f9e] font-extrabold tabular-nums">{r.paidApps}</span>
                  </td>
                  <td className="px-5 py-3.5 text-center text-gray-600 tabular-nums whitespace-nowrap">{lbFmtMins(r.mins)}</td>
                  <td className="px-5 py-3.5 text-gray-600">{r.topCity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Classification review ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            Classify paid apps
            {pendingCount > 0 && <span className="text-[11px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{pendingCount} pending</span>}
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {[["pending", "Pending"], ["counseled", "Counseled"], ["inbound", "Inbound"]].map(([k, l]) => (
              <button key={k} onClick={() => setReviewFilter(k)} className={seg(reviewFilter === k)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 border-b border-gray-200">
              <tr>
                {["Name", "Counsellor", "City", "Paid On", "Source", "Action"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reviewList.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">Nothing here.</td></tr>
              )}
              {reviewList.map(a => {
                const current = classMap[a.applicationNumber] || "pending"
                const busy = savingKey === a.applicationNumber
                return (
                  <tr key={a.applicationNumber} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800 text-xs">{a.name || "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{a.counsellor}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{a.city}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {a.paidOn ? a.paidOn.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{a.source}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => classify(a.applicationNumber, "counseled")} disabled={busy}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition disabled:opacity-40 ${current === "counseled" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}>
                          Counseled
                        </button>
                        <button onClick={() => classify(a.applicationNumber, "inbound")} disabled={busy}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition disabled:opacity-40 ${current === "inbound" ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                          Inbound
                        </button>
                        {current !== "pending" && (
                          <button onClick={() => classify(a.applicationNumber, "pending")} disabled={busy}
                            className="px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-gray-700 transition disabled:opacity-40" title="Reset to pending">
                            ↺
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ value, label, color, bg, border }) {
  return (
    <div className={`${bg} border ${border} rounded-xl px-3 py-4 text-center`}>
      <div className="text-2xl font-extrabold leading-tight truncate" style={{ color }}>{value}</div>
      <div className="text-[10px] font-bold tracking-wide text-gray-500 uppercase mt-1.5">{label}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL VIEW
// ─────────────────────────────────────────────────────────────────────────────

function Detail({ date, setDate, allRows, pipelineRows, pipelineChanges, initialSubTab = "charts", onBack, appRows }) {
  const [mainTab, setMainTab] = useState("overall")
  const [section, setSection] = useState("all")
  const [source, setSource] = useState("all")
  const [subTab, setSubTab] = useState(initialSubTab)
  const [drill, setDrill] = useState(null)

  const openDrill = useCallback((title, rows, type) => setDrill({ title, rows, type }), [])

  const filtered = useMemo(() => {
    const secVal = SECTIONS.find(s => s.key === section)?.val
    return allRows
      .filter(r => !secVal || r.section === secVal)
      .filter(r => source === "all" || r.source === source)
  }, [allRows, section, source])

  const visibleRows = mainTab === "overall"
    ? filtered
    : filtered.filter(r => r.empName === mainTab)

  const visiblePipelineRows = mainTab === "overall"
    ? pipelineRows
    : pipelineRows.filter(r => r.counsellor === mainTab)

  const vs = computeStats(visibleRows)

  const sources = useMemo(() => {
    const s = new Set(allRows.map(r => r.source).filter(Boolean))
    return [...s].sort()
  }, [allRows])

  const counsellorNameForAI = mainTab === "overall" ? "All counsellors" : mainTab
  const activeColMeta = mainTab !== "overall" ? colMeta(mainTab) : null

  const selClass = "border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"

  return (
    <div className="flex flex-col min-h-0">
      {/* Sticky header */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between flex-wrap gap-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack}
            className="text-xs text-gray-500 hover:text-gray-800 transition flex items-center gap-1">
            ← Overview
          </button>
          <span className="text-gray-200">|</span>
          <span className="text-sm font-semibold text-gray-800">Insights — {date}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={selClass} />
          <select value={section} onChange={e => setSection(e.target.value)} className={selClass}>
            {SECTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select value={source} onChange={e => setSource(e.target.value)} className={selClass}>
            <option value="all">All sources</option>
            {sources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Counsellor tabs */}
      <div className="bg-white border-b border-gray-200 px-5 flex gap-1 overflow-x-auto">
        {[["overall", "Overall"], ...orderCols([allRows.map(r => r.empName), pipelineRows.map(r => r.counsellor)]).map(c => [c.key, c.short])].map(([k, l]) => {
          const meta = k !== "overall" ? colMeta(k) : null
          const isActive = mainTab === k
          return (
            <button key={k}
              onClick={() => { setMainTab(k); setSubTab("charts") }}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${isActive ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              style={isActive && meta ? { borderColor: meta.color, color: meta.color } : {}}>
              {l}
            </button>
          )
        })}
      </div>

      {/* Summary banner */}
      {vs && (
        <div className="bg-gray-50 border-b border-gray-200 px-5 py-2.5 flex items-center gap-4 flex-wrap text-xs">
          <span className="text-gray-500"><strong className="text-gray-800">{vs.outgoing}</strong> outgoing</span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-500">
            <strong className="text-gray-800">{vs.connected}</strong> connected
            <span className="text-gray-400"> ({vs.connPct ?? 0}%)</span>
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-500"><strong className="text-gray-800">{vs.totalDur}</strong> min total</span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-500">avg <strong className="text-gray-800">{vs.avgDur}</strong> min/call</span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-500"><strong className="text-gray-800">{vs.unique}</strong> unique numbers</span>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="bg-white border-b border-gray-200 px-5 flex gap-2 py-2.5">
        {[["charts", "📊 Charts"], ["table", "📋 Pivot Table"], ["pipeline", "🎯 Pipeline"], ["ai", "✦ AI Insights"], ["paid-apps", "💰 Paid Apps"], ["transcripts", "🎙️ Transcripts"], ["objections", "🚩 Objections"], ["leaderboard", "🏆 Leaderboard"]].map(([k, l]) => (
          <button key={k} onClick={() => setSubTab(k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${subTab === k
                ? "bg-gray-900 text-white"
                : "bg-gray-100 hover:bg-gray-200 text-gray-600"
              }`}>
            {l}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        {subTab === "charts" && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <StageBarChart rows={visibleRows} onDrill={(label, rows) => openDrill(`Stage: ${label}`, rows, "calls")} />
              <SourceBarChart rows={visibleRows} onDrill={(label, rows) => openDrill(`Source: ${label}`, rows, "calls")} />
            </div>
            <div className="grid grid-cols-1 gap-4">
              <StageBarChart rows={visibleRows} stageKey="prevStage"
                title="Previous lead stage breakdown of called leads"
                info="For leads called on this date, the stage they were in the DAY BEFORE — from that day's end-of-day snapshot, i.e. before this day's calls. Click a bar to see the raw calls. Leads with no prior-day snapshot show as 'New / no prior day'."
                onDrill={(label, rows) => openDrill(`Prev stage: ${label}`, rows, "calls")} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CallTypeDonut rows={visibleRows} onDrill={(label, rows) => openDrill(`Call type: ${label}`, rows, "calls")} />
              <ConnectedBySection rows={visibleRows} onDrill={(label, rows) => openDrill(label, rows, "calls")} />
            </div>
          </>
        )}
        {subTab === "table" && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Pivot Table</div>
              <InfoBadge text="Rows = metrics (volume, connection quality, stage breakdown, duration). Columns = Total + each counsellor. Click any number to see raw calls." />
            </div>
            <PivotTable rows={visibleRows} onDrill={openDrill} />
          </div>
        )}
        {subTab === "pipeline" && (
          <PipelineSection pipelineRows={visiblePipelineRows} pipelineChanges={pipelineChanges} callRows={visibleRows} date={date} onDrill={openDrill} />
        )}
        {subTab === "ai" && (
          <AIInsightsPanel rows={visibleRows} counsellorName={counsellorNameForAI} dateStr={date} />
        )}
        {subTab === "paid-apps" && (
          <PaidAppsPanel appRows={appRows} />
        )}
        {subTab === "transcripts" && (
          <TranscriptionsPanel date={date} mainTab={mainTab} pipelineRows={pipelineRows} />
        )}
        {subTab === "objections" && (
          <ObjectionsBucketPanel date={date} mainTab={mainTab} pipelineRows={pipelineRows} />
        )}
        {subTab === "leaderboard" && (
          <LeaderboardPanel appRows={appRows} />
        )}
      </div>

      <DrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSCRIPTIONS — Claude helpers
// ─────────────────────────────────────────────────────────────────────────────

// Merge multiple batch overview results into one unified result
function mergeOverviewResults(results) {
  const valid = results.filter(Boolean)
  if (!valid.length) return null
  if (valid.length === 1) return valid[0]

  // Scorecards — weighted average per counsellor across batches
  const cMap = new Map()
  for (const r of valid) {
    for (const s of (r.scorecard || [])) {
      const prev = cMap.get(s.counsellor)
      if (!prev) { cMap.set(s.counsellor, { ...s }); continue }
      const total = prev.calls + s.calls
      const w1 = prev.calls / total, w2 = s.calls / total
      const avg = f => +(prev[f] * w1 + s[f] * w2).toFixed(1)
      prev.discovery = avg('discovery')
      prev.listening = avg('listening')
      prev.objHandling = avg('objHandling')
      prev.nextStep = avg('nextStep')
      prev.ethics = avg('ethics')
      prev.avgOverall = avg('avgOverall')
      prev.calls = total
      const a = prev.avgOverall
      prev.grade = a >= 4.5 ? 'A' : a >= 3.5 ? 'B' : a >= 2.5 ? 'C' : a >= 1.5 ? 'D' : 'F'
    }
  }

  // Red flags — combine all batches, worst first, no cap
  const qOrder = { Bad: 0, Partially: 1, Good: 2, Excellent: 3 }
  const topRedFlags = valid.flatMap(r => r.topRedFlags || [])
    .sort((a, b) => (qOrder[a.quality] ?? 4) - (qOrder[b.quality] ?? 4))

  // Sentiment — majority vote
  const sentCount = {}
  for (const r of valid) { const s = r.overallSentiment || 'neutral'; sentCount[s] = (sentCount[s] || 0) + 1 }
  const overallSentiment = Object.entries(sentCount).sort((a, b) => b[1] - a[1])[0][0]

  // Objections + themes — sum counts, deduplicate, top 5
  const mergeList = (key) => {
    const m = new Map()
    for (const r of valid) for (const item of (r[key] || [])) {
      const k = (item.objection || item.theme || '').toLowerCase()
      if (!k) continue
      const prev = m.get(k)
      if (!prev) m.set(k, { ...item })
      else prev.count += item.count
    }
    return [...m.values()].sort((a, b) => b.count - a.count).slice(0, 5)
  }

  return {
    scorecard: [...cMap.values()],
    topRedFlags,
    overallSentiment,
    topObjections: mergeList('topObjections'),
    keyThemes: mergeList('keyThemes'),
  }
}

async function fetchTranscriptOverview(transcripts, texts, dateStr) {
  if (!texts.length) return null

  const block = transcripts.slice(0, texts.length).map((t, i) => {
    const info = t.leadInfo
    const name = info?.name || t.customerPhone
    const source = info?.source || 'Unknown'
    const stage = info?.stage || 'Unknown'
    const text = (texts[i] || '').replace(/[\r\n]+/g, ' ').slice(0, 600)
    return `--- Call ${i + 1}: ${name} | Counsellor: ${t.counsellor} | Source: ${source} | Stage: ${stage} ---\n${text}`
  }).join('\n\n')

  const prompt =
    `You are a senior admissions quality analyst reviewing calls from Masters Union (AI & Advanced Analytics program, ₹22.65L fee).
Period: ${dateStr}. Total calls: ${texts.length}.

${block}

Return ONLY raw JSON (no markdown, no code fences):
{
  "scorecard": [
    {
      "counsellor": "exact name from calls",
      "calls": 0,
      "discovery": 0.0,
      "listening": 0.0,
      "objHandling": 0.0,
      "nextStep": 0.0,
      "ethics": 0.0,
      "avgOverall": 0.0,
      "grade": "D"
    }
  ],
  "topRedFlags": [
    {
      "callIndex": 1,
      "customer": "customer name",
      "counsellor": "counsellor first name",
      "category": "Fee",
      "objection": "exact concern the customer raised",
      "howHandled": "what the counsellor actually said or did",
      "quality": "Bad",
      "betterResponse": "ideal response in 1–2 sentences"
    }
  ],
  "overallSentiment": "neutral",
  "topObjections": [{ "objection": "short phrase", "count": 0, "resolution": "brief" }],
  "keyThemes": [{ "theme": "short phrase", "count": 0 }]
}

Scoring rules (1.0–5.0 per dimension):
  Discovery    = asked relevant questions about background, goals, current role before pitching
  Listening    = acknowledged customer concerns, did not interrupt or ignore responses
  Obj Handling = addressed objections with specific facts/evidence, not vague claims
  Next Step    = clearly confirmed a follow-up action/time at end of call
  Ethics       = no false urgency, no inflated scholarship claims, no pressure tactics
  avgOverall   = average of all 5 · grade: A(≥4.5) B(≥3.5) C(≥2.5) D(≥1.5) F(<1.5)

Red flag rules:
  Only include quality=Bad or Partially · include ALL instances (no limit)
  category must be one of: Fee | Intent | Timing | Program fit | Scholarship threshold | Family gatekeeper | Trust | Operational | Other
  quality: Excellent | Good | Partially | Bad
  IMPORTANT: Do NOT flag calls where the counsellor ended or shortened the call because the lead was weak in English or communicated only in Hindi. English proficiency is a basic requirement for the ₹25L PGP program in Gurgaon — staging such leads as "language barrier" and not pursuing them is correct protocol, not a red flag.
  topObjections max 5 · keyThemes max 5 · overallSentiment: positive | neutral | negative`

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!r.ok) throw new Error(`Claude ${r.status}: ${r.statusText}`)
  const d = await r.json()
  const raw = d.content.map(b => b.text || '').join('').replace(/```json|```/g, '').trim()
  const parsed = robustJSONParse(raw)
  // Attach the customer phone number to each red flag via its callIndex,
  // so admins can look the customer up in the CRM.
  if (parsed && Array.isArray(parsed.topRedFlags)) {
    parsed.topRedFlags = parsed.topRedFlags.map(f => ({
      ...f,
      customerPhone: transcripts[f.callIndex - 1]?.customerPhone || '',
    }))
  }
  return parsed
}

async function fetchTranscriptLeadAnalysis(text, leadInfo) {
  const name = leadInfo?.name || 'Unknown'
  const source = leadInfo?.source || 'Unknown'
  const stage = leadInfo?.stage || 'Unknown'

  const prompt =
    `You are a senior admissions quality analyst. Analyse this Masters Union call transcript.
Lead: ${name} | Source: ${source} | Stage: ${stage}

TRANSCRIPT:
${text.slice(0, 3000)}

Return ONLY raw JSON (no markdown):
{
  "summary": "2–3 sentences describing the call",
  "intentLevel": "high",
  "conversionLikelihood": 0,
  "conversionSignals": ["signal 1"],
  "actionRecommendation": "one sentence next action for this lead",
  "scorecard": {
    "discovery": 0.0,
    "listening": 0.0,
    "objHandling": 0.0,
    "nextStep": 0.0,
    "ethics": 0.0,
    "avgOverall": 0.0,
    "grade": "D"
  },
  "redFlags": [
    {
      "category": "Fee",
      "objection": "exact concern the customer raised",
      "howHandled": "what the counsellor actually said or did",
      "quality": "Bad",
      "betterResponse": "ideal response in 1–2 sentences"
    }
  ]
}
intentLevel: high|medium|low. conversionLikelihood: 0–100.
Scores 1.0–5.0:
  Discovery=did they ask background/goals before pitching
  Listening=acknowledged concerns without interrupting
  Obj Handling=addressed objections with specific facts (not vague)
  Next Step=confirmed clear follow-up time/action at end
  Ethics=no false urgency, inflated scholarship claims, or pressure
grade: A(≥4.5) B(≥3.5) C(≥2.5) D(≥1.5) F(<1.5)
category: Fee|Intent|Timing|Program fit|Scholarship threshold|Family gatekeeper|Trust|Operational|Other
quality: Excellent|Good|Partially|Bad — only include redFlags where quality=Bad or Partially
IMPORTANT: Do NOT flag calls where the counsellor ended or shortened the call because the lead was weak in English or communicated only in Hindi. English proficiency is a basic requirement for the ₹25L PGP program in Gurgaon — staging such leads as "language barrier" and not pursuing them is correct protocol, not a red flag.`

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!r.ok) throw new Error(`Claude ${r.status}: ${r.statusText}`)
  const d = await r.json()
  const raw = d.content.map(b => b.text || '').join('').replace(/```json|```/g, '').trim()
  return robustJSONParse(raw)
}

// ─────────────────────────────────────────────────────────────────────────────
// OBJECTIONS BUCKET — taxonomy + classifier
// ─────────────────────────────────────────────────────────────────────────────
//
// 8 admin-defined objection categories, each with fixed sub-categories. Claude
// classifies each call's transcript into EVERY distinct category the LEAD raises
// (multiple allowed — decision), forcing the closest sub-category (decision).
// Calls with no objection are dropped (decision). Results cache per day in Neon
// under objection_buckets:v3:{counsellor}:{date} — fresh per date, computed on demand.
// Every objection must carry a verbatim quote that is verified to occur in that
// call's own transcript; ungrounded ones are dropped (precision over coverage).

const OBJECTION_TAXONOMY = [
  {
    key: "Fee & Affordability", short: "Fee",
    color: "bg-red-100 text-red-700 border-red-200",
    subs: [
      { key: "Sticker shock – absolute price", hint: "Immediate reaction to the ₹22.65L number without context on ROI or EMI" },
      { key: "Comparative price objection", hint: "Benchmarking against cheaper alternatives like IIT certs, online courses, or free YouTube" },
      { key: "Self-funding strain", hint: "Sole earner, family financial obligations, or existing loan EMIs making investment feel impossible" },
      { key: "Free-course expectation", hint: "Enrolled expecting a workshop or free resource — programme cost comes as a surprise" },
    ],
  },
  {
    key: "Low / No Intent", short: "Low Intent",
    color: "bg-orange-100 text-orange-700 border-orange-200",
    subs: [
      { key: "Job-first, course-later", hint: "Wants a job before upskilling — not opposed to the programme, just sequencing it differently" },
      { key: "Casual explorer / accidental form fill", hint: "Low commitment — browsing, curious, or form filled by someone else" },
      { key: "Already upskilling elsewhere", hint: "Currently enrolled in another AI or tech programme — sees no immediate need" },
      { key: "Actively disinterested / repeated no", hint: "Clear, firm rejection with no openness — should be tagged DND and deprioritised" },
      { key: "Career direction mismatch", hint: "Wants MBA, CAT, product management, or a different domain entirely — not AI-focused" },
    ],
  },
  {
    key: "Timing & Availability", short: "Timing",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    subs: [
      { key: "In-call unavailability", hint: "In a meeting, driving, in class — timing of the call is wrong, not the intent" },
      { key: "Life-stage too early", hint: "Still in B.Tech, just started internship, or planning post-grad in 2-3 years — future cohort candidate" },
      { key: "Personal constraint", hint: "Marriage, relocation, family care, health, or travel making commitment difficult right now" },
      { key: "Competing exam / programme prep", hint: "Focused on CAT, GATE, or campus placements — AI upskilling is secondary priority currently" },
      { key: "Long programme duration", hint: "15-month commitment feels too long — comparing with shorter cert courses or MBA timelines" },
    ],
  },
  {
    key: "Programme Fit", short: "Programme Fit",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    subs: [
      { key: "Non-tech / no coding background", hint: "No Python or programming foundation — worried they will not keep up with curriculum" },
      { key: "Already overqualified", hint: "Has M.Tech, PhD, or is already working as an AI engineer — does not see curriculum value" },
      { key: "Wrong programme type", hint: "Looking for MBA, supply chain, data science degree, or PGDM — not applied AI specifically" },
      { key: "Location / attendance constraint", hint: "Cannot relocate to Gurugram for campus — unaware of or sceptical about online track" },
      { key: "Certification vs degree ambiguity", hint: "Unclear if UGC-approved certification has same value as a degree for jobs or PhD eligibility" },
    ],
  },
  {
    key: "Trust & Credibility", short: "Trust",
    color: "bg-pink-100 text-pink-700 border-pink-200",
    subs: [
      { key: "Brand / accreditation doubt", hint: "Questions UGC registration, first-batch risk, or university affiliation before committing" },
      { key: "Placement claim scepticism", hint: "Doubts the 33 LPA average placement figure — wants receipts, not a pitch" },
      { key: "Privacy / data concern", hint: "Upset about being contacted — disputes ever applying or questions how their number was obtained" },
      { key: "Worried about personal failure", hint: "Fears being the weakest in the batch or not getting placed — needs a concrete support safety net" },
    ],
  },
  {
    key: "Family Gatekeeper", short: "Family",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    subs: [
      { key: "Parental veto on fees", hint: "Parents are the financial approver and are sceptical of a ₹22L certification for their child" },
      { key: "Family business pressure", hint: "Parents expect the candidate to join the family business — AI is seen as irrelevant to their path" },
      { key: "Spouse / peer influence", hint: "Partner or friends are pushing towards a different institute or path — needs comparative reassurance" },
    ],
  },
  {
    key: "Scholarship Threshold", short: "Scholarship",
    color: "bg-cyan-100 text-cyan-700 border-cyan-200",
    subs: [
      { key: "Needs minimum % before applying", hint: "Will not go through the admission process unless they know what scholarship band they can expect" },
      { key: "Placement guarantee before committing", hint: "Wants assurance of placement outcome before paying even a scholarship-reduced fee" },
    ],
  },
  {
    key: "Operational / Logistical", short: "Operational",
    color: "bg-slate-100 text-slate-700 border-slate-200",
    subs: [
      { key: "Language barrier (Hindi / regional)", hint: "Not comfortable in English — call ends with no engagement; needs Hindi or regional language support" },
      { key: "NOC / work permission concern", hint: "Worried about quitting their job or needing employer approval to attend the programme" },
    ],
  },
]

const OBJ_CAT_BY_LOWER = Object.fromEntries(OBJECTION_TAXONOMY.map(c => [c.key.toLowerCase(), c]))

// Calls shorter than this can't hold a real objection conversation — excluded
// before any AI work. Joined from call_history by phone (transcripts have no duration).
const MIN_CALL_SECONDS = 30

// Snap a raw {category, subCategory} from the model onto the fixed taxonomy.
// Category must match a real category (case-insensitive) or the objection is dropped.
// Sub-category is forced to the closest listed sub (exact → substring → first sub).
function snapObjection(o) {
  const cat = OBJ_CAT_BY_LOWER[String(o?.category || "").trim().toLowerCase()]
  if (!cat) return null
  const subLower = String(o?.subCategory || "").trim().toLowerCase()
  let sub = cat.subs.find(s => s.key.toLowerCase() === subLower)
  if (!sub && subLower) {
    // No exact match → pick the sub with the most shared words ("force closest").
    const words = new Set(subLower.split(/[^a-z0-9]+/).filter(w => w.length > 2))
    let bestScore = 0
    cat.subs.forEach(s => {
      const score = s.key.toLowerCase().split(/[^a-z0-9]+/).reduce((n, w) => n + (w.length > 2 && words.has(w) ? 1 : 0), 0)
      if (score > bestScore) { bestScore = score; sub = s }
    })
  }
  if (!sub) sub = cat.subs[0]   // still nothing in common → first sub
  return { category: cat.key, subCategory: sub.key, evidence: String(o?.evidence || "").trim().slice(0, 300) }
}

// Normalise text for evidence matching: lowercase, drop punctuation, collapse
// whitespace. Lets a quote match even if the model differs on commas/casing,
// while still requiring the same words in the same order.
//
// MUST be Unicode-aware: these transcripts are largely Devanagari (Hindi, and
// English spoken in Hindi). An [^a-z0-9] strip deletes 100% of that text, which
// made every quote fail to match and silently emptied every bucket.
// \p{L}\p{N} keeps letters/digits in ANY script and drops only punctuation.
function normForMatch(s) {
  return String(s || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim()
}

// Truncation-tolerant recovery of classification entries. Scans from the
// "classifications" array's open bracket and returns every complete top-level
// { ... } object it can JSON.parse — so a response cut off mid-array still yields
// all entries before the cut. (robustJSONParse's truncation branch is tuned to the
// overview schema, so it can't recover this one.)
function salvageClassifications(raw) {
  const start = raw.indexOf("[")
  if (start < 0) return []
  const out = []
  let depth = 0, objStart = -1, inStr = false, esc = false
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === "\\") esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') { inStr = true; continue }
    if (ch === "{") { if (depth === 0) objStart = i; depth++ }
    else if (ch === "}") {
      if (depth > 0) {
        depth--
        if (depth === 0 && objStart >= 0) {
          try { out.push(JSON.parse(raw.slice(objStart, i + 1))) } catch { /* skip a partial object */ }
          objStart = -1
        }
      }
    }
  }
  return out
}

// Classify one batch of transcripts. Returns [{ fileId, name, email, phone,
// counsellor, source, objections:[{category, subCategory}] }] — no-objection
// calls and unmatched categories are already filtered out.
async function fetchObjectionClassification(transcripts, texts) {
  if (!texts.length) return []

  const taxonomyBlock = OBJECTION_TAXONOMY.map((cat, ci) =>
    `${ci + 1}. ${cat.key}\n` + cat.subs.map(s => `     - ${s.key} (${s.hint})`).join("\n")
  ).join("\n")

  const block = transcripts.map((t, i) => {
    const name = t.leadInfo?.name || t.customerPhone
    const text = (texts[i] || "").replace(/[\r\n]+/g, " ").slice(0, 1500)
    return `--- Call ${i + 1}: ${name} | Counsellor: ${t.counsellor} ---\n${text}`
  }).join("\n\n")

  const prompt =
    `You are an admissions analyst for Masters Union (AI & Advanced Analytics programme, ₹22.65L fee). For each call transcript, classify the OBJECTIONS the LEAD (the customer — not the counsellor) raises.

OBJECTION TAXONOMY — 8 main categories, each with fixed sub-categories:
${taxonomyBlock}

LANGUAGE: These transcripts are mostly HINDI written in Devanagari script (including English words spelled in Devanagari, e.g. "आई एम कॉलिंग फ्रॉम मास्टर्स यूनियन"). Read and understand them as-is. The "evidence" quote MUST be copied in the ORIGINAL script exactly as it appears — never transliterate it to Latin letters and never translate it to English.

RULES — BE STRICT. A wrong bucket is far worse than a missing one:
- Include a category ONLY if the LEAD explicitly says it in THIS call's transcript. If you are not certain, leave it out.
- Every objection MUST include "evidence": a VERBATIM quote copied character-for-character from THIS call's transcript showing the lead raising it. Never paraphrase, transliterate, translate, summarise or invent the quote. If you cannot copy an exact quote, DO NOT include the objection.
- Many calls are gatekeepers, wrong numbers, voicemail greetings or "call me later" pleasantries with no real objection — OMIT those.
- Do NOT infer objections from the lead's name, source, stage, or from what a typical lead might say. Only what is actually spoken in this transcript.
- Each call is INDEPENDENT. Never carry an objection from one call over to another.
- Classify only what the LEAD expresses; ignore the counsellor's pitch. The counsellor mentioning the fee is NOT a Fee objection — only the lead pushing back on it is.
- A call may raise multiple categories. Within a category, pick the SINGLE best-fitting sub-category from the list. "Force the closest match" applies ONLY to choosing the sub-category AFTER you have already confirmed the category from the transcript — it is NEVER a reason to include a category.
- If a call has NO real objection (positive, neutral, only info-gathering, wrong number, no answer, or too short to tell), OMIT that call from the output entirely.
- "Language barrier (Hindi / regional)" under Operational IS a valid bucket here — use it when the lead says they are not comfortable in English (quote them).

Return ONLY raw JSON (no markdown, no code fences):
{
  "classifications": [
    { "call": 1, "objections": [ { "category": "exact main category name", "subCategory": "exact sub-category name", "evidence": "exact verbatim quote from THIS call" } ] }
  ]
}
Include ONLY calls where the lead raises at least one QUOTABLE objection — skip all others. No commentary.`

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    }),
  })
  if (!r.ok) {
    // Surface the API's own message — r.statusText is just "Bad Request", which
    // hides the actionable cause (e.g. "Your credit balance is too low…").
    let detail = r.statusText
    try {
      const err = await r.json()
      if (err?.error?.message) detail = err.error.message
    } catch { /* non-JSON error body — keep statusText */ }
    throw new Error(`Claude ${r.status}: ${detail}`)
  }
  const d = await r.json()
  const raw = d.content.map(b => b.text || "").join("").replace(/```json|```/g, "").trim()
  let list = []
  try {
    const parsed = robustJSONParse(raw)
    if (parsed && Array.isArray(parsed.classifications)) list = parsed.classifications
  } catch { /* fall through to salvage */ }
  // Salvage path: if the JSON was truncated (large batch) or wrapped in prose,
  // recover every COMPLETE { call, objections } object — a cut-off tail just drops
  // its last entry instead of losing the whole batch. Never throw here: an
  // unparseable batch contributes nothing rather than sinking the entire run.
  if (!list.length) list = salvageClassifications(raw)

  const out = []
  list.forEach(c => {
    const idx = (c.call || 0) - 1
    const t = transcripts[idx]
    if (!t) return
    // GROUNDING CHECK: the quote must actually occur in THIS call's transcript.
    // This is what stops hallucinated buckets and cross-call bleed within a batch —
    // a quote borrowed from another call simply won't be found here, so it's dropped.
    const haystack = normForMatch(texts[idx] || "")
    const seenCat = new Set()
    const objections = []
    ;(Array.isArray(c.objections) ? c.objections : []).forEach(o => {
      const ev = normForMatch(o?.evidence)
      if (ev.length < 12 || !haystack.includes(ev)) return   // unquotable / ungrounded → drop
      const snapped = snapObjection(o)
      if (!snapped || seenCat.has(snapped.category)) return   // one sub per category
      seenCat.add(snapped.category)
      objections.push(snapped)
    })
    if (!objections.length) return   // exclude no-objection calls
    const info = t.leadInfo
    out.push({
      fileId:     t.fileId,
      name:       info?.name || `···${String(t.customerPhone || "").slice(-4)}`,
      email:      info?.email || "",
      phone:      t.customerPhone || info?.phone || "",
      counsellor: t.counsellor || info?.counsellor || "",
      source:     info?.source || "",
      objections,
    })
  })
  return out
}

// Group classified leads into { [category]: { total, leads[], subs:{[sub]:leads[]} } }.
// A person (phone→email→fileId key) is counted once per category and once per sub.
function buildObjectionBuckets(leads) {
  const buckets = {}
  OBJECTION_TAXONOMY.forEach(cat => {
    buckets[cat.key] = {
      total: 0, leads: [], subs: Object.fromEntries(cat.subs.map(s => [s.key, []])),
      _catSeen: new Set(), _subSeen: {},
    }
  })
  const idOf = l => (String(l.phone || "").replace(/\D/g, "").slice(-10)) || (l.email || "").toLowerCase() || l.fileId
  leads.forEach(lead => {
    const id = idOf(lead)
    lead.objections.forEach(o => {
      const b = buckets[o.category]
      if (!b) return
      if (!b._catSeen.has(id)) { b._catSeen.add(id); b.leads.push(lead) }
      if (!b.subs[o.subCategory]) b.subs[o.subCategory] = []
      if (!b._subSeen[o.subCategory]) b._subSeen[o.subCategory] = new Set()
      if (!b._subSeen[o.subCategory].has(id)) { b._subSeen[o.subCategory].add(id); b.subs[o.subCategory].push(lead) }
    })
  })
  Object.values(buckets).forEach(b => { b.total = b.leads.length })
  return buckets
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSCRIPTIONS — constants
// ─────────────────────────────────────────────────────────────────────────────

const QUALITY_META = {
  Excellent: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  Good: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  Partially: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  Bad: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
}

const GRADE_META = {
  A: { bg: 'bg-green-100', text: 'text-green-800' },
  B: { bg: 'bg-blue-100', text: 'text-blue-800' },
  C: { bg: 'bg-amber-100', text: 'text-amber-800' },
  D: { bg: 'bg-orange-100', text: 'text-orange-800' },
  F: { bg: 'bg-red-100', text: 'text-red-800' },
}

const SCORE_FIELDS = [
  { key: 'discovery', label: 'Discovery' },
  { key: 'listening', label: 'Listening' },
  { key: 'objHandling', label: 'Obj Handling' },
  { key: 'nextStep', label: 'Next Step' },
  { key: 'ethics', label: 'Ethics' },
]

const CAT_COLOR = {
  'Fee': 'bg-red-100 text-red-700',
  'Intent': 'bg-orange-100 text-orange-700',
  'Timing': 'bg-amber-100 text-amber-700',
  'Program fit': 'bg-purple-100 text-purple-700',
  'Scholarship threshold': 'bg-cyan-100 text-cyan-700',
  'Family gatekeeper': 'bg-blue-100 text-blue-700',
  'Trust': 'bg-pink-100 text-pink-700',
  'Operational': 'bg-gray-100 text-gray-700',
  'Other': 'bg-slate-100 text-slate-700',
}

function scoreColor(v) {
  if (v == null) return 'text-gray-400'
  return v >= 4 ? 'text-green-700' : v >= 3 ? 'text-blue-700' : v >= 2 ? 'text-amber-700' : 'text-red-700'
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSCRIPTIONS — Lead card (expandable)
// ─────────────────────────────────────────────────────────────────────────────

function TranscriptCard({ t, onAnalyse, analysis, readText }) {
  const [expanded, setExpanded] = useState(false)
  const [analysing, setAnalysing] = useState(false)

  const info = t.leadInfo
  const name = info?.name || `···${t.customerPhone.slice(-4)}`
  const source = info?.source || '—'
  const stage = info?.stage || '—'
  const intentClr = { high: '#16a34a', medium: '#d97706', low: '#6b7280' }
  const fmtTime = s => (s && s.length >= 6) ? `${s.slice(0, 2)}:${s.slice(2, 4)}` : (s || '')

  const handleExpand = async () => {
    const nowOpen = !expanded
    setExpanded(nowOpen)
    if (nowOpen && !analysis && !analysing) {
      setAnalysing(true)
      try { await onAnalyse(t.fileId) } finally { setAnalysing(false) }
    }
  }

  const likelihood = analysis?.conversionLikelihood
  const lhColor = likelihood >= 60 ? '#16a34a' : likelihood >= 35 ? '#d97706' : '#6b7280'
  const sc = analysis?.scorecard
  const gm = sc?.grade ? GRADE_META[sc.grade] || GRADE_META.D : null

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition" onClick={handleExpand}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-800 truncate max-w-[200px]" title={name}>{name}</span>
              {analysis && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: `${intentClr[analysis.intentLevel]}18`, color: intentClr[analysis.intentLevel] }}>
                  {(analysis.intentLevel || '').toUpperCase()} intent
                </span>
              )}
              {gm && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${gm.bg} ${gm.text}`}>
                  Grade {sc.grade} · {sc.avgOverall?.toFixed(1)}
                </span>
              )}
              {analysis?.redFlags?.length > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                  {analysis.redFlags.length} flag{analysis.redFlags.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {t.counsellor.split(' ')[0]} · {source} · {stage} · {fmtTime(t.fileTime)}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {likelihood != null && (
              <div className="text-right">
                <div className="text-xs text-gray-400">Likelihood</div>
                <div className="text-sm font-bold" style={{ color: lhColor }}>{likelihood}%</div>
              </div>
            )}
            <div className="text-gray-300 text-sm">{expanded ? '▲' : '▼'}</div>
          </div>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {analysing && (
            <div className="py-6 text-center">
              <div className="inline-block w-5 h-5 border-2 border-gray-700 border-t-transparent rounded-full animate-spin mb-2" />
              <div className="text-xs text-gray-400">Analysing transcript with AI…</div>
            </div>
          )}

          {analysis && !analysing && (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-gray-600 leading-relaxed">{analysis.summary}</p>

              {/* Scorecard */}
              {sc && (
                <div className="bg-gray-50 rounded-lg border border-gray-100 p-3">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Call Scorecard</span>
                    {gm && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${gm.bg} ${gm.text}`}>
                        Grade {sc.grade} · {sc.avgOverall?.toFixed(2)} / 5
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {SCORE_FIELDS.map(({ key, label }) => (
                      <div key={key} className="text-center">
                        <div className="text-xs text-gray-400 mb-1 leading-tight">{label}</div>
                        <div className={`text-sm font-bold ${scoreColor(sc[key])}`}>
                          {sc[key] != null ? sc[key].toFixed(1) : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversion signals */}
              {analysis.conversionSignals?.length > 0 && (
                <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                  <div className="text-xs font-semibold text-green-700 mb-2 uppercase tracking-wide">Conversion Signals</div>
                  {analysis.conversionSignals.map((s, i) => (
                    <div key={i} className="text-xs text-green-700 flex gap-1.5 mb-1 last:mb-0">
                      <span className="flex-shrink-0 mt-0.5">✓</span>{s}
                    </div>
                  ))}
                </div>
              )}

              {/* Next action */}
              {analysis.actionRecommendation && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 flex gap-2">
                  <span className="text-blue-500 flex-shrink-0">→</span>
                  <div>
                    <span className="text-xs font-semibold text-blue-700">Next action: </span>
                    <span className="text-xs text-blue-700">{analysis.actionRecommendation}</span>
                  </div>
                </div>
              )}

              {/* Red flags */}
              {analysis.redFlags?.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Red Flags ({analysis.redFlags.length})
                  </div>
                  {analysis.redFlags.map((f, i) => {
                    const qm = QUALITY_META[f.quality] || QUALITY_META.Partially
                    const cat = CAT_COLOR[f.category] || 'bg-gray-100 text-gray-700'
                    return (
                      <div key={i} className={`rounded-lg border p-3 ${qm.bg} ${qm.border}`}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cat}`}>{f.category}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${qm.bg} ${qm.text} ${qm.border}`}>{f.quality}</span>
                        </div>
                        <div className={`text-xs font-medium ${qm.text} mb-1`}>"{f.objection}"</div>
                        <div className="text-xs text-gray-600"><span className="font-medium">Handled: </span>{f.howHandled}</div>
                        {f.betterResponse && (
                          <div className="text-xs text-gray-700 mt-1.5 bg-white/70 rounded px-2 py-1 border border-gray-200">
                            <span className="font-semibold text-gray-800">✦ Better: </span>{f.betterResponse}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {readText && (
            <details className="mt-3">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">View full transcript</summary>
              <pre className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap overflow-auto max-h-56 font-sans leading-relaxed border border-gray-100">
                {readText}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSCRIPTIONS — Main panel
// ─────────────────────────────────────────────────────────────────────────────

function TranscriptionsPanel({ date: propDate, mainTab, pipelineRows }) {
  const [viewMode, setViewMode] = useState('daily')   // 'daily' | 'monthly'
  const [dateFilter, setDateFilter] = useState(propDate)
  const [monthFilter, setMonthFilter] = useState(() => propDate.slice(0, 7))
  const [counsellorFilter, setCounsellorFilter] = useState(mainTab !== 'overall' ? mainTab : 'all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [detailSearch, setDetailSearch] = useState('')
  const [viewTab, setViewTab] = useState('overview')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [transcripts, setTranscripts] = useState([])
  const [readCache, setReadCache] = useState({})
  const [overviewInsights, setOverviewInsights] = useState(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [overviewErr, setOverviewErr] = useState('')
  const [perLeadCache, setPerLeadCache] = useState({})

  // Auto-load whenever active date/month, counsellor, or mode changes
  useEffect(() => {
    loadTranscripts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, dateFilter, monthFilter, counsellorFilter])

  // phone → pipeline row (for lead enrichment)
  const leadPhoneMap = useMemo(() => {
    const m = {}
    pipelineRows.forEach(r => { if (r.phone) m[r.phone] = r })
    return m
  }, [pipelineRows])

  // Apply source filter on top of the loaded transcript list
  const filtered = useMemo(() => {
    if (sourceFilter === 'all') return transcripts
    return transcripts.filter(t => t.leadInfo?.source === sourceFilter)
  }, [transcripts, sourceFilter])

  const sources = useMemo(() => {
    const s = new Set(transcripts.map(t => t.leadInfo?.source).filter(Boolean))
    return [...s].sort()
  }, [transcripts])

  // Detailed-view list: source-filtered transcripts, further narrowed by a
  // phone-number (or name) search so an admin can read one customer's calls.
  const detailFiltered = useMemo(() => {
    const q = detailSearch.trim().toLowerCase()
    if (!q) return filtered
    return filtered.filter(t =>
      (t.customerPhone || '').toLowerCase().includes(q) ||
      (t.leadInfo?.name || '').toLowerCase().includes(q)
    )
  }, [filtered, detailSearch])

  // Quick stats from enriched transcript list (no AI needed)
  const quickStats = useMemo(() => {
    const topOf = (key) => {
      const counts = {}
      filtered.forEach(t => {
        const v = key === 'counsellor' ? t.counsellor : t.leadInfo?.[key]
        if (v && v !== 'Unknown' && v !== '') counts[v] = (counts[v] || 0) + 1
      })
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
      return top ? { label: top[0], count: top[1] } : null
    }
    return {
      topSource: topOf('source'),
      topCounsellor: topOf('counsellor'),
      topCity: topOf('city'),
    }
  }, [filtered])

  // ── AI cache helpers ──────────────────────────────────────────────────────
  async function aiCacheGet(key) {
    try {
      const r = await fetch(`/api/ai-cache?key=${encodeURIComponent(key)}`)
      const d = await r.json()
      return d.hit ? d.result : null
    } catch { return null }
  }
  async function aiCacheSet(key, result) {
    try {
      await fetch('/api/ai-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, result }),
      })
    } catch { /* non-fatal */ }
  }

  // ── Load transcript list from Drive ────────────────────────────────────────
  async function loadTranscripts() {
    setLoading(true)
    setError('')
    setTranscripts([])
    setOverviewInsights(null)
    setPerLeadCache({})
    setReadCache({})
    try {
      const ps = new URLSearchParams({ action: 'list' })
      if (viewMode === 'monthly') ps.set('month', monthFilter)
      else ps.set('date', dateFilter)
      if (counsellorFilter !== 'all') ps.set('counsellor', counsellorFilter)
      const r = await fetch(`/api/drive?${ps}`)
      if (!r.ok) {
        const msg = r.status === 404
          ? 'API route not found — deploy to Vercel first.'
          : `Drive API error (${r.status})`
        throw new Error(msg)
      }
      const { files, error: apiErr } = await r.json()
      if (apiErr) throw new Error(apiErr)
      const enriched = (files || []).map(f => ({
        ...f,
        leadInfo: leadPhoneMap[f.customerPhone] || null,
      }))
      setTranscripts(enriched)

      // Auto-load cached insights for this date — no button needed if already analysed
      if (enriched.length) {
        const label = viewMode === 'monthly' ? monthFilter : dateFilter
        const cKey = `transcript_overview:${counsellorFilter}:${label}`
        const cached = await aiCacheGet(cKey)
        if (cached) setOverviewInsights(cached)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Overview: check cache first, then read transcripts + call Claude ───────
  async function runOverview(skipCache = false) {
    if (!filtered.length) return
    setOverviewLoading(true)
    setOverviewErr('')
    setOverviewInsights(null)
    try {
      const label = viewMode === 'monthly' ? monthFilter : dateFilter
      const cKey = `transcript_overview:${counsellorFilter}:${label}`

      // 1. Check permanent AI cache (skipped when Re-analyse is clicked)
      if (!skipCache) {
        const cached = await aiCacheGet(cKey)
        if (cached) {
          setOverviewInsights(cached)
          setOverviewLoading(false)
          return
        }
      }

      // 2. Cache miss — read ALL transcripts, batch 50 at a time, merge results
      const BATCH = 50
      const allTexts = await Promise.all(filtered.map(async t => {
        if (readCache[t.fileId]) return readCache[t.fileId]
        const r = await fetch(`/api/drive?action=read&fileId=${t.fileId}`)
        const d = await r.json()
        const txt = d.text || ''
        setReadCache(c => ({ ...c, [t.fileId]: txt }))
        return txt
      }))

      const batches = []
      for (let i = 0; i < filtered.length; i += BATCH) {
        batches.push({ transcripts: filtered.slice(i, i + BATCH), texts: allTexts.slice(i, i + BATCH) })
      }

      const batchResults = await Promise.all(
        batches.map(b => fetchTranscriptOverview(b.transcripts, b.texts, label))
      )
      const result = mergeOverviewResults(batchResults)
      setOverviewInsights(result)

      // 3. Save to permanent cache
      await aiCacheSet(cKey, result)
    } catch (e) {
      setOverviewErr(e.message)
    } finally {
      setOverviewLoading(false)
    }
  }

  // ── Per-lead: check cache first, then lazy read + Claude ──────────────────
  async function analyseOneLead(fileId) {
    if (perLeadCache[fileId]) return
    const t = filtered.find(x => x.fileId === fileId)
    if (!t) return

    // 1. Check permanent AI cache
    const cKey = `transcript_lead:${fileId}`
    const cached = await aiCacheGet(cKey)
    if (cached) {
      setPerLeadCache(c => ({ ...c, [fileId]: cached }))
      return
    }

    let text = readCache[fileId]
    if (!text) {
      const r = await fetch(`/api/drive?action=read&fileId=${fileId}`)
      const d = await r.json()
      text = d.text || ''
      setReadCache(c => ({ ...c, [fileId]: text }))
    }
    const analysis = await fetchTranscriptLeadAnalysis(text, t.leadInfo)
    setPerLeadCache(c => ({ ...c, [fileId]: analysis }))
    // Save to permanent cache
    await aiCacheSet(cKey, analysis)
  }

  const selCls = "border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"

  return (
    <div className="space-y-4">

      {/* ── Filter bar ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-gray-700">🎙️ Transcriptions</span>
        {/* Daily / Monthly toggle */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {[['daily', 'Daily'], ['monthly', 'Monthly']].map(([k, l]) => (
            <button key={k} onClick={() => setViewMode(k)}
              className={`px-3 py-1.5 text-xs font-medium transition ${viewMode === k ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-50 text-gray-600'
                }`}>
              {l}
            </button>
          ))}
        </div>
        {viewMode === 'daily'
          ? <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className={selCls} />
          : <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className={selCls} />
        }
        <select value={counsellorFilter} onChange={e => setCounsellorFilter(e.target.value)} className={selCls}>
          <option value="all">All counsellors</option>
          {MAIN_COUNSELLORS.map(c => <option key={c.key} value={c.key}>{c.short}</option>)}
        </select>
        {sources.length > 0 && (
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className={selCls}>
            <option value="all">All sources</option>
            {sources.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <span className="ml-auto text-xs text-gray-400">
          {loading ? 'Loading…' : transcripts.length > 0 ? `${filtered.length} transcripts` : ''}
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      )}

      {/* ── Content once transcripts are loaded ── */}
      {transcripts.length > 0 && (
        <>
          {/* Sub-view toggle */}
          <div className="flex gap-2">
            {[['overview', '📊 Overview'], ['detailed', '📋 Detailed View']].map(([k, l]) => (
              <button key={k} onClick={() => setViewTab(k)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${viewTab === k ? 'bg-emerald-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                  }`}>
                {l}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW ── */}
          {viewTab === 'overview' && (
            <div className="space-y-4">
              {/* Quick stats: total · top source · top counsellor · top city */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Calls</div>
                  <div className="text-2xl font-bold text-gray-900">{filtered.length}</div>
                  <div className="text-xs text-gray-400">{dateFilter}</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Top Source</div>
                  <div className="text-lg font-bold text-gray-900 truncate">{quickStats.topSource?.label || '—'}</div>
                  <div className="text-xs text-gray-400">{quickStats.topSource ? `${quickStats.topSource.count} calls` : 'no data'}</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Top Counsellor</div>
                  <div className="text-lg font-bold text-gray-900 truncate">{quickStats.topCounsellor?.label || '—'}</div>
                  <div className="text-xs text-gray-400">{quickStats.topCounsellor ? `${quickStats.topCounsellor.count} calls` : 'no data'}</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Top City</div>
                  <div className="text-lg font-bold text-gray-900 truncate">{quickStats.topCity?.label || '—'}</div>
                  <div className="text-xs text-gray-400">{quickStats.topCity ? `${quickStats.topCity.count} calls` : 'no data'}</div>
                </div>
              </div>

              {/* AI Analysis block */}
              {!overviewInsights && !overviewLoading && (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <div className="text-2xl mb-3">🤖</div>
                  <div className="text-sm font-semibold text-gray-800 mb-1">AI Overview Analysis</div>
                  <div className="text-xs text-gray-400 mb-5">
                    Read and analyse all {filtered.length} transcripts with Claude — objections, themes, counselling performance
                  </div>
                  <button onClick={runOverview}
                    className="px-5 py-2 bg-gray-900 hover:bg-gray-700 text-white rounded-lg text-xs font-semibold transition">
                    ✦ Load Insights
                  </button>
                </div>
              )}

              {overviewLoading && (
                <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
                  <div className="inline-block w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mb-4" />
                  <div className="text-sm text-gray-600">Reading & analysing transcripts…</div>
                  <div className="text-xs text-gray-400 mt-1">{filtered.length} transcripts · batched in parallel · may take 30–60 seconds</div>
                </div>
              )}

              {overviewErr && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                  {overviewErr}
                  <button onClick={runOverview} className="ml-3 underline text-xs">Retry</button>
                </div>
              )}

              {overviewInsights && (
                <div className="space-y-5">

                  {/* ── Counsellor Scorecard ── */}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800">Counsellor Scorecard</span>
                      <span className="text-xs text-gray-400">{viewMode === 'monthly' ? monthFilter : dateFilter} · scores out of 5</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide text-center">
                            <th className="px-4 py-2.5 text-left">#</th>
                            <th className="px-4 py-2.5 text-left">Counsellor</th>
                            <th className="px-4 py-2.5">Calls</th>
                            <th className="px-4 py-2.5">Discovery</th>
                            <th className="px-4 py-2.5">Listening</th>
                            <th className="px-4 py-2.5">Obj Handling</th>
                            <th className="px-4 py-2.5">Next Step</th>
                            <th className="px-4 py-2.5">Ethics</th>
                            <th className="px-4 py-2.5">Avg Overall</th>
                            <th className="px-4 py-2.5">Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(overviewInsights.scorecard || []).map((s, i) => {
                            const gm = GRADE_META[s.grade] || GRADE_META.D
                            return (
                              <tr key={i} className="border-t border-gray-50 hover:bg-gray-50 text-center">
                                <td className="px-4 py-3 text-left text-gray-400">{i + 1}</td>
                                <td className="px-4 py-3 text-left font-semibold text-gray-800 whitespace-nowrap">{s.counsellor}</td>
                                <td className="px-4 py-3 font-medium text-gray-700">{s.calls}</td>
                                <td className={`px-4 py-3 font-medium ${scoreColor(s.discovery)}`}>{s.discovery?.toFixed(1)}</td>
                                <td className={`px-4 py-3 font-medium ${scoreColor(s.listening)}`}>{s.listening?.toFixed(1)}</td>
                                <td className={`px-4 py-3 font-medium ${scoreColor(s.objHandling)}`}>{s.objHandling?.toFixed(1)}</td>
                                <td className={`px-4 py-3 font-medium ${scoreColor(s.nextStep)}`}>{s.nextStep?.toFixed(1)}</td>
                                <td className={`px-4 py-3 font-medium ${scoreColor(s.ethics)}`}>{s.ethics?.toFixed(1)}</td>
                                <td className={`px-4 py-3 font-bold ${scoreColor(s.avgOverall)}`}>{s.avgOverall?.toFixed(2)}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${gm.bg} ${gm.text}`}>{s.grade}</span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ── Red Flag Category Matrix ── */}
                  {(overviewInsights.topRedFlags || []).length > 0 && (() => {
                    const ALL_CATS = ['Fee', 'Intent', 'Timing', 'Program fit', 'Scholarship threshold', 'Family gatekeeper', 'Trust', 'Operational', 'Other']
                    const flags = overviewInsights.topRedFlags || []
                    // Collect unique counsellors from flags
                    const counsellors = [...new Set(flags.map(f => f.counsellor).filter(Boolean))].sort()
                    // Build count matrix
                    const matrix = {}
                    ALL_CATS.forEach(cat => {
                      matrix[cat] = {}
                      counsellors.forEach(c => { matrix[cat][c] = 0 })
                      matrix[cat].__total = 0
                    })
                    flags.forEach(f => {
                      const cat = ALL_CATS.includes(f.category) ? f.category : 'Other'
                      const c = f.counsellor
                      if (!matrix[cat]) return
                      if (c && matrix[cat][c] !== undefined) matrix[cat][c]++
                      matrix[cat].__total++
                    })
                    // Only show categories that have at least one flag
                    const activeRows = ALL_CATS.filter(cat => matrix[cat].__total > 0)
                    if (!activeRows.length) return null
                    const colTotal = {}
                    counsellors.forEach(c => { colTotal[c] = activeRows.reduce((s, cat) => s + (matrix[cat][c] || 0), 0) })
                    const grandTotal = activeRows.reduce((s, cat) => s + matrix[cat].__total, 0)
                    const cellBg = n => n === 0 ? '' : n === 1 ? 'bg-amber-50 text-amber-700' : n <= 3 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                    return (
                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-800">🔎 Red Flag Category Breakdown by Counsellor</span>
                          <span className="text-xs text-gray-400">{grandTotal} total flags</span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                                <th className="px-4 py-2.5 text-left">Category</th>
                                {counsellors.map(c => <th key={c} className="px-4 py-2.5 text-center whitespace-nowrap">{c}</th>)}
                                <th className="px-4 py-2.5 text-center font-bold text-gray-700">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeRows.map(cat => (
                                <tr key={cat} className="border-t border-gray-50 hover:bg-gray-50">
                                  <td className="px-4 py-2.5 font-medium text-gray-700 whitespace-nowrap">
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${CAT_COLOR[cat] || 'bg-gray-100 text-gray-700'}`}>{cat}</span>
                                  </td>
                                  {counsellors.map(c => {
                                    const n = matrix[cat][c] || 0
                                    return <td key={c} className={`px-4 py-2.5 text-center font-medium rounded ${cellBg(n)}`}>{n || '—'}</td>
                                  })}
                                  <td className="px-4 py-2.5 text-center font-bold text-gray-800">{matrix[cat].__total}</td>
                                </tr>
                              ))}
                              <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold text-gray-700">
                                <td className="px-4 py-2.5">Total</td>
                                {counsellors.map(c => <td key={c} className="px-4 py-2.5 text-center">{colTotal[c]}</td>)}
                                <td className="px-4 py-2.5 text-center text-gray-900">{grandTotal}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })()}

                  {/* ── Red Flags Detail Table ── */}
                  {(overviewInsights.topRedFlags || []).length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-5 py-3 border-b border-gray-100">
                        <span className="text-sm font-semibold text-gray-800">🚩 Red Flags — All Concerning Moments</span>
                        <span className="text-xs text-gray-400">{overviewInsights.topRedFlags.length} flags</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 text-gray-500 uppercase tracking-wide">
                              <th className="px-4 py-2.5 text-left">Customer</th>
                              <th className="px-4 py-2.5 text-left">Customer Number</th>
                              <th className="px-4 py-2.5 text-left">Counsellor</th>
                              <th className="px-4 py-2.5 text-left">Category</th>
                              <th className="px-4 py-2.5 text-left">Objection / Moment</th>
                              <th className="px-4 py-2.5 text-left">How Handled</th>
                              <th className="px-4 py-2.5 text-left">Better Response</th>
                              <th className="px-4 py-2.5 text-center">Quality</th>
                            </tr>
                          </thead>
                          <tbody>
                            {overviewInsights.topRedFlags.map((f, i) => {
                              const qm = QUALITY_META[f.quality] || QUALITY_META.Partially
                              const cat = CAT_COLOR[f.category] || 'bg-gray-100 text-gray-700'
                              return (
                                <tr key={i} className="border-t border-gray-50 hover:bg-gray-50 align-top">
                                  <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{f.customer}</td>
                                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono">{f.customerPhone || '—'}</td>
                                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{f.counsellor}</td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${cat}`}>{f.category}</span>
                                  </td>
                                  <td className="px-4 py-3 text-gray-700 max-w-[200px]">{f.objection}</td>
                                  <td className="px-4 py-3 text-gray-500 max-w-[200px]">{f.howHandled}</td>
                                  <td className="px-4 py-3 text-gray-700 max-w-[220px] italic">{f.betterResponse}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`px-2 py-0.5 rounded-full font-semibold border whitespace-nowrap ${qm.bg} ${qm.text} ${qm.border}`}>{f.quality}</span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ── Monthly extras: Sentiment + Objections + Themes ── */}
                  {viewMode === 'monthly' && (
                    <>
                      {overviewInsights.overallSentiment && (
                        <div className={`rounded-xl border p-5 ${SENTIMENT[overviewInsights.overallSentiment]?.bg || 'bg-gray-50'}`}>
                          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Overall Sentiment ({monthFilter})</div>
                          <div className={`text-xl font-bold capitalize ${SENTIMENT[overviewInsights.overallSentiment]?.text || 'text-gray-800'}`}>
                            {overviewInsights.overallSentiment}
                          </div>
                        </div>
                      )}

                      {(overviewInsights.topObjections || []).length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 p-5">
                          <div className="text-sm font-semibold text-gray-800 mb-3">Top Objections (Monthly)</div>
                          <div className="space-y-3">
                            {overviewInsights.topObjections.map(({ objection, count, resolution }, i) => (
                              <div key={i} className="border-l-2 border-red-300 pl-3">
                                <div className="flex justify-between items-start">
                                  <span className="text-sm text-gray-800">"{objection}"</span>
                                  <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{count}×</span>
                                </div>
                                {resolution && <div className="text-xs text-gray-500 mt-0.5">→ {resolution}</div>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(overviewInsights.keyThemes || []).length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 p-5">
                          <div className="text-sm font-semibold text-gray-800 mb-3">Key Themes (Monthly)</div>
                          <div className="flex flex-wrap gap-2">
                            {overviewInsights.keyThemes.map(({ theme, count }, i) => (
                              <span key={i} className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 rounded-full px-3 py-1 text-xs font-medium">
                                {theme}<span className="text-gray-400">·{count}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="text-right">
                    <button onClick={() => runOverview(true)} className="text-xs text-gray-400 hover:text-gray-600 underline">Re-analyse</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── DETAILED VIEW ── */}
          {viewTab === 'detailed' && (
            <div className="space-y-3">
              <div className="relative max-w-xs">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
                <input
                  type="text"
                  value={detailSearch}
                  onChange={e => setDetailSearch(e.target.value)}
                  placeholder="Search by customer number or name…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                />
              </div>
              <div className="text-xs text-gray-400 px-1">
                {detailFiltered.length} transcripts{detailSearch.trim() ? ` matching “${detailSearch.trim()}”` : ''} · click any card to expand — AI analysis runs on first open
              </div>
              {detailFiltered.map(t => (
                <TranscriptCard
                  key={t.fileId}
                  t={t}
                  onAnalyse={analyseOneLead}
                  analysis={perLeadCache[t.fileId]}
                  readText={readCache[t.fileId]}
                />
              ))}
              {detailFiltered.length === 0 && (
                <div className="text-sm text-gray-400 px-1 py-6 text-center">
                  No transcripts match “{detailSearch.trim()}”.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && transcripts.length === 0 && !error && (
        <div className="bg-white rounded-xl border border-gray-200 p-14 text-center">
          <div className="text-3xl mb-3">🎙️</div>
          <div className="text-sm font-semibold text-gray-700 mb-1">No transcripts loaded</div>
          <div className="text-xs text-gray-400">No transcripts found for this date / counsellor</div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// OBJECTIONS BUCKET — panel (main-category → sub-category segregation)
// ─────────────────────────────────────────────────────────────────────────────

function ObjectionsBucketPanel({ date: propDate, mainTab, pipelineRows }) {
  const [dateFilter, setDateFilter] = useState(propDate)
  const [counsellorFilter, setCounsellorFilter] = useState(mainTab !== "overall" ? mainTab : "all")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [transcripts, setTranscripts] = useState([])
  const [classifiedLeads, setClassifiedLeads] = useState(null)
  const [classifying, setClassifying] = useState(false)
  const [classifyErr, setClassifyErr] = useState("")
  const [builtAt, setBuiltAt] = useState("")

  const [activeCat, setActiveCat] = useState(null)
  const [activeSub, setActiveSub] = useState("all")
  const [copyMsg, setCopyMsg] = useState("")
  const [skipStats, setSkipStats] = useState(null)

  // phone → pipeline row — the exact same join transcripts use for enrichment.
  // Gives us each lead's email (looked up from Lead / App-Start dump) plus name/source.
  const leadPhoneMap = useMemo(() => {
    const m = {}
    pipelineRows.forEach(r => { if (r.phone) m[r.phone] = r })
    return m
  }, [pipelineRows])

  async function aiCacheGet(key) {
    try { const r = await fetch(`/api/ai-cache?key=${encodeURIComponent(key)}`); const d = await r.json(); return d.hit ? d.result : null } catch { return null }
  }
  async function aiCacheSet(key, result) {
    try { await fetch("/api/ai-cache", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, result }) }) } catch { /* non-fatal */ }
  }

  useEffect(() => { loadForDate() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [dateFilter, counsellorFilter])

  // Load the day's transcript list from Drive + any saved buckets for this date.
  // Transcripts carry no duration, so we join them to call_history by phone to
  // enforce the MIN_CALL_SECONDS gate — a very short call cannot hold a real
  // objection conversation.
  async function loadForDate() {
    setLoading(true); setError(""); setTranscripts([]); setClassifiedLeads(null); setActiveCat(null); setBuiltAt(""); setSkipStats(null)
    try {
      const ps = new URLSearchParams({ action: "list", date: dateFilter })
      if (counsellorFilter !== "all") ps.set("counsellor", counsellorFilter)
      const [r, callsResp] = await Promise.all([
        fetch(`/api/drive?${ps}`),
        fetch(`/api/calls?date=${dateFilter}`).then(x => (x.ok ? x.json() : { rows: [] })).catch(() => ({ rows: [] })),
      ])
      if (!r.ok) throw new Error(r.status === 404 ? "API route not found — deploy to Vercel first." : `Drive API error (${r.status})`)
      const { files, error: apiErr } = await r.json()
      if (apiErr) throw new Error(apiErr)

      // phone → longest call that day, in seconds (a number may be dialled twice)
      const secsByPhone = {}
      ;(callsResp.rows || []).forEach(row => {
        const p = phone10(row[7])
        if (!p) return
        const secs = Math.round(parseDurationMins(cellText(row[24]) || cellText(row[11])) * 60)
        if (!(p in secsByPhone) || secs > secsByPhone[p]) secsByPhone[p] = secs
      })

      const enriched = (files || []).map(f => ({
        ...f,
        leadInfo: leadPhoneMap[f.customerPhone] || null,
        callSeconds: f.customerPhone in secsByPhone ? secsByPhone[f.customerPhone] : null,
      }))
      // Drop short calls. An unmatched transcript (no call row to join) is KEPT —
      // a failed join shouldn't silently delete data — but it still has to clear the
      // transcript-length and evidence-grounding checks downstream.
      const eligible = enriched.filter(t => t.callSeconds === null || t.callSeconds >= MIN_CALL_SECONDS)
      setTranscripts(eligible)
      setSkipStats({
        found:      enriched.length,
        tooShort:   enriched.filter(t => t.callSeconds !== null && t.callSeconds < MIN_CALL_SECONDS).length,
        noDuration: enriched.filter(t => t.callSeconds === null).length,
      })

      const cached = await aiCacheGet(`objection_buckets:v3:${counsellorFilter}:${dateFilter}`)
      if (cached && Array.isArray(cached.leads)) { setClassifiedLeads(cached.leads); setBuiltAt(cached.builtAt || "") }
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  // Read every transcript, classify in batches via Claude, save the day's buckets.
  async function runClassification(skipCache = false) {
    if (!transcripts.length) return
    setClassifying(true); setClassifyErr("")
    try {
      const cKey = `objection_buckets:v3:${counsellorFilter}:${dateFilter}`
      if (!skipCache) {
        const cached = await aiCacheGet(cKey)
        if (cached && Array.isArray(cached.leads)) { setClassifiedLeads(cached.leads); setBuiltAt(cached.builtAt || ""); setClassifying(false); return }
      }
      const texts = await Promise.all(transcripts.map(async t => {
        const r = await fetch(`/api/drive?action=read&fileId=${t.fileId}`); const d = await r.json(); return d.text || ""
      }))
      // A call with (almost) no transcript cannot contain a spoken objection —
      // unanswered / 0-second calls would otherwise sit in the prompt inviting a guess.
      const MIN_TRANSCRIPT_CHARS = 80
      const usable = transcripts
        .map((t, i) => ({ t, text: texts[i] || "" }))
        .filter(p => p.text.trim().length >= MIN_TRANSCRIPT_CHARS)
      const BATCH = 15
      const batches = []
      for (let i = 0; i < usable.length; i += BATCH) {
        const slice = usable.slice(i, i + BATCH)
        batches.push({ ts: slice.map(p => p.t), tx: slice.map(p => p.text) })
      }
      // Nothing to classify — fail loudly instead of caching a misleading
      // "0 leads with objections", which reads as "no objections found".
      if (batches.length === 0) {
        throw new Error(
          `None of the ${transcripts.length} transcripts had at least ${MIN_TRANSCRIPT_CHARS} characters of text — nothing to classify. ` +
          `Check that the transcript files actually contain conversation text.`
        )
      }
      // allSettled so one failed/unparseable batch can't sink the whole day's run.
      const settled = await Promise.allSettled(batches.map(b => fetchObjectionClassification(b.ts, b.tx)))
      const all = settled.flatMap(s => (s.status === "fulfilled" ? s.value : []))
      const failed = settled.filter(s => s.status === "rejected")
      if (all.length === 0 && failed.length) throw new Error(failed[0].reason?.message || "Classification failed")
      const stamp = new Date().toISOString()
      setClassifiedLeads(all); setBuiltAt(stamp)
      await aiCacheSet(cKey, { leads: all, builtAt: stamp })
    } catch (e) { setClassifyErr(e.message) } finally { setClassifying(false) }
  }

  const buckets = useMemo(() => (classifiedLeads ? buildObjectionBuckets(classifiedLeads) : null), [classifiedLeads])
  const totalObjectionLeads = useMemo(() => {
    if (!classifiedLeads) return 0
    const ids = new Set(classifiedLeads.map(l => String(l.phone || "").replace(/\D/g, "").slice(-10) || (l.email || "").toLowerCase() || l.fileId))
    return ids.size
  }, [classifiedLeads])

  // Default to the first non-empty category whenever buckets change.
  useEffect(() => {
    if (!buckets) { setActiveCat(null); return }
    setActiveCat(prev => (prev && buckets[prev]?.total > 0) ? prev : (OBJECTION_TAXONOMY.find(c => buckets[c.key].total > 0)?.key || OBJECTION_TAXONOMY[0].key))
    setActiveSub("all")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buckets])

  function copyEmails(leadArr, label) {
    const emails = [...new Set(leadArr.map(l => (l.email || "").trim().toLowerCase()).filter(Boolean))]
    if (!emails.length) { setCopyMsg("No emails found"); setTimeout(() => setCopyMsg(""), 2500); return }
    navigator.clipboard.writeText(emails.join(", "))
    setCopyMsg(`✓ Copied ${emails.length} email${emails.length === 1 ? "" : "s"}${label ? " · " + label : ""}`)
    setTimeout(() => setCopyMsg(""), 2500)
  }

  const selCls = "border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
  const activeMeta   = activeCat ? OBJECTION_TAXONOMY.find(c => c.key === activeCat) : null
  const activeBucket = activeCat && buckets ? buckets[activeCat] : null
  const shownLeads   = !activeBucket ? [] : (activeSub === "all" ? activeBucket.leads : (activeBucket.subs[activeSub] || []))

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-gray-700">🚩 Objections Bucket</span>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className={selCls} />
        <select value={counsellorFilter} onChange={e => setCounsellorFilter(e.target.value)} className={selCls}>
          <option value="all">All counsellors</option>
          {MAIN_COUNSELLORS.map(c => <option key={c.key} value={c.key}>{c.short}</option>)}
        </select>
        <span className="ml-auto text-xs text-gray-400">
          {loading ? "Loading…" : skipStats ? (
            <>
              <strong className="text-gray-600">{transcripts.length}</strong> eligible of {skipStats.found}
              {skipStats.tooShort > 0 && <span> · {skipStats.tooShort} skipped &lt;{MIN_CALL_SECONDS}s</span>}
              {skipStats.noDuration > 0 && <span> · {skipStats.noDuration} no duration</span>}
            </>
          ) : ""}
        </span>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>}

      {!loading && transcripts.length === 0 && !error && (
        <div className="bg-white rounded-xl border border-gray-200 p-14 text-center">
          <div className="text-3xl mb-3">🚩</div>
          <div className="text-sm font-semibold text-gray-700 mb-1">No transcripts for this date</div>
          <div className="text-xs text-gray-400">Pick another date or counsellor</div>
        </div>
      )}

      {transcripts.length > 0 && !classifiedLeads && !classifying && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-2xl mb-3">🤖</div>
          <div className="text-sm font-semibold text-gray-800 mb-1">Bucket objections for {dateFilter}</div>
          <div className="text-xs text-gray-400 mb-5">Read {transcripts.length} transcripts and segregate leads into objection categories &amp; sub-categories</div>
          <button onClick={() => runClassification(false)} className="px-5 py-2 bg-gray-900 hover:bg-gray-700 text-white rounded-lg text-xs font-semibold transition">✦ Bucket Objections</button>
        </div>
      )}

      {classifying && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <div className="inline-block w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mb-4" />
          <div className="text-sm text-gray-600">Reading &amp; bucketing transcripts…</div>
          <div className="text-xs text-gray-400 mt-1">{transcripts.length} transcripts · batched · may take 30–60 seconds</div>
        </div>
      )}

      {classifyErr && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {classifyErr}
          <button onClick={() => runClassification(true)} className="ml-3 underline text-xs">Retry</button>
        </div>
      )}

      {buckets && !classifying && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs text-gray-500">
              <strong className="text-gray-800">{totalObjectionLeads}</strong> lead{totalObjectionLeads === 1 ? "" : "s"} with objections
              {builtAt && <span className="text-gray-400"> · bucketed {new Date(builtAt).toLocaleString("en-IN")}</span>}
            </div>
            <div className="flex items-center gap-2">
              {copyMsg && <span className="text-emerald-600 text-xs font-medium">{copyMsg}</span>}
              <button onClick={() => runClassification(true)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition">🔄 Re-bucket</button>
            </div>
          </div>

          {/* Main category tabs */}
          <div className="flex flex-wrap gap-2">
            {OBJECTION_TAXONOMY.map(cat => {
              const n = buckets[cat.key].total
              const active = activeCat === cat.key
              return (
                <button key={cat.key} disabled={n === 0}
                  onClick={() => { setActiveCat(cat.key); setActiveSub("all") }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${active ? "bg-gray-900 text-white border-gray-900" : n === 0 ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed" : "bg-white hover:bg-gray-50 text-gray-700 border-gray-200"}`}>
                  {cat.short} <span className={active ? "text-gray-300" : "text-gray-400"}>({n})</span>
                </button>
              )
            })}
          </div>

          {activeMeta && activeBucket && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Category header + copy-all-category */}
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${activeMeta.color}`}>{activeMeta.key}</span>
                  <span className="text-xs text-gray-400 ml-2">{activeBucket.total} lead{activeBucket.total === 1 ? "" : "s"}</span>
                </div>
                <button onClick={() => copyEmails(activeBucket.leads, activeMeta.short)} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition">📧 Copy category emails ({activeBucket.total})</button>
              </div>

              {/* Sub-category tabs */}
              <div className="px-5 py-2.5 border-b border-gray-100 flex flex-wrap gap-2 bg-gray-50">
                <button onClick={() => setActiveSub("all")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${activeSub === "all" ? "bg-red-600 text-white" : "bg-white hover:bg-gray-100 text-gray-600 border border-gray-200"}`}>
                  All ({activeBucket.total})
                </button>
                {activeMeta.subs.map(s => {
                  const n = (activeBucket.subs[s.key] || []).length
                  return (
                    <button key={s.key} disabled={n === 0} onClick={() => setActiveSub(s.key)} title={s.hint}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${activeSub === s.key ? "bg-red-600 text-white" : n === 0 ? "bg-white text-gray-300 border border-gray-100 cursor-not-allowed" : "bg-white hover:bg-gray-100 text-gray-600 border border-gray-200"}`}>
                      {s.key} ({n})
                    </button>
                  )
                })}
              </div>

              {/* Shown-list header + copy-current-view */}
              <div className="px-5 py-2 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">{activeSub === "all" ? "All sub-categories" : activeSub} · {shownLeads.length} lead{shownLeads.length === 1 ? "" : "s"}</span>
                <button onClick={() => copyEmails(shownLeads, activeSub === "all" ? activeMeta.short : activeSub)} className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-medium transition">📧 Copy these ({shownLeads.length})</button>
              </div>

              {/* Leads table: name / email / number */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 w-10">#</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Email</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Number</th>
                      {activeSub === "all" && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Sub-category</th>}
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Why (their words)</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Counsellor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {shownLeads.map((l, i) => {
                      const objForThis  = l.objections.find(o => o.category === activeCat)
                      const subForThis  = objForThis?.subCategory || ""
                      const evidForThis = objForThis?.evidence || ""
                      return (
                        <tr key={l.fileId + "_" + i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                          <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">{l.name}</td>
                          <td className="px-4 py-2 text-gray-600">{l.email || <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-2 whitespace-nowrap">{l.phone ? <a href={`tel:${l.phone}`} className="text-blue-600 hover:underline">{l.phone}</a> : "—"}</td>
                          {activeSub === "all" && <td className="px-4 py-2 text-gray-500">{subForThis}</td>}
                          <td className="px-4 py-2 text-gray-500 italic max-w-[340px] truncate" title={evidForThis}>
                            {evidForThis ? `“${evidForThis}”` : <span className="text-gray-300 not-italic">—</span>}
                          </td>
                          <td className="px-4 py-2 text-gray-600 whitespace-nowrap">{l.counsellor}</td>
                        </tr>
                      )
                    })}
                    {shownLeads.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-xs">No leads in this sub-category</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminInsights() {
  const [params, setParams] = useSearchParams()
  const DEFAULT_DATE = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) })()
  const view = params.get('ai_view') || 'overview'
  const date = params.get('ai_date') || DEFAULT_DATE
  const detailSubTab = params.get('ai_subtab') || 'charts'

  const setView = useCallback((v) => setParams(p => {
    const n = new URLSearchParams(p)
    if (v === 'overview') n.delete('ai_view'); else n.set('ai_view', v)
    return n
  }, { replace: true }), [setParams])

  const setDate = useCallback((v) => setParams(p => {
    const n = new URLSearchParams(p); n.set('ai_date', v); return n
  }, { replace: true }), [setParams])

  const [allRows, setAllRows] = useState([])
  const [appStartRaw, setAppStartRaw] = useState([])
  const [pipelineRows, setPipelineRows] = useState([])
  const [pipelineChanges, setPipelineChanges] = useState({
    hasBaseline: false,
    gainedCounseled: [],
    lostCounseled: [],
    stageChanges: [],
    subStageChanges: [],
    netCounseled: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [diagInfo, setDiagInfo] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(""); setDiagInfo(null)
      try {
        // Route all sheet fetches through /api/sheets (server-side cache, 20-min TTL)
        async function fetchCached(sheet, range) {
          const params = new URLSearchParams({ action: 'fetch', sheet, range })
          const r = await fetch(`/api/sheets?${params}`)
          if (!r.ok) throw new Error(`Sheet fetch failed: ${sheet} ${r.status}`)
          const d = await r.json()
          return d.rows || []
        }

        // Calls now come from the DB (call_history) one date at a time via
        // /api/calls — no live-sheet pull. A date not yet snapshotted (e.g. today
        // before the nightly cron) returns []. Previous-day stage comes from
        // /api/prev-stage (the day-before snapshot joined to the called number).
        const fetchJson = async (url) => {
          const r = await fetch(url)
          if (!r.ok) throw new Error(`${url} → ${r.status}`)
          return r.json()
        }
        const [callsResp, prevResp, leadRaw] = await Promise.all([
          fetchJson(`/api/calls?date=${date}`),
          fetchJson(`/api/prev-stage?date=${date}`).catch(e => { console.warn('prev-stage failed:', e.message); return { map: {} } }),
          fetchCached('Lead Dump', 'A:CK'),
        ])
        const callsDataRaw = callsResp.rows || []
        const prevMap = prevResp.map || {}
        // Prepend synthetic header so parseCallsHistory's slice(1) works correctly.
        // Must match the Callyzer A–Y column layout exactly (0-indexed).
        const CALLS_HEADER = ["Sr. No.", "Emp. Code", "Emp. Tags", "Employee Name", "Employee Number", "To Name", "Country Code", "To Number", "Call Type", "Call Method", "Call Mode", "Duration", "Call Date", "Call Time", "Notes", "UniqueId", "Audio Url", "Call Transcript", "Stage", "Application Form Completed %", "Payment Initiated", "Application Form Initiated", "Source", "Lead/App Start Stage", "Call Duration in Mins"]
        const callsRaw = [CALLS_HEADER, ...callsDataRaw]
        const appRaw = await fetchCached('App Start Dump', 'A:EY').catch(e => {
          console.warn('App Start Dump fetch failed:', e.message)
          return []
        })
        const { subStageMap, notesMap, stageTypeMap, leadStageMap, sourceMap } = buildLeadMaps(leadRaw, appRaw)
        let rows = parseCallsHistory(callsRaw, new Date(date), subStageMap, notesMap, stageTypeMap, leadStageMap, sourceMap)
        // Attach each called lead's PREVIOUS-day stage/substage (before this day's calls).
        rows = rows.map(r => {
          const pv = prevMap[r.toNumber]
          return { ...r, prevStage: pv ? (pv.stage || "Unknown") : "New / no prior day", prevSubStage: pv ? (pv.subStage || "") : "" }
        })
        // Diagnostics: matched rows + the latest date actually present in the DB
        // (so the "no calls" banner can offer to jump there).
        if (!cancelled) setDiagInfo({
          rawRows: callsDataRaw.length,
          matched: rows.length,
          sampleDate: callsDataRaw[0]?.[12] ?? "—",
          latestDate: callsResp.latestAvailable || (callsDataRaw.length ? date : "—"),
        })
        const pipeline = buildPipelineRows(leadRaw, leadRaw, appRaw, appRaw)
        const activePipeline = pipeline.filter(row => !isPaymentCompleted(row.paymentStatus))
        const snapshotKey = "aias_admin_pipeline_snapshot_v1"
        let previous = null
        try { previous = JSON.parse(localStorage.getItem(snapshotKey) || "null") } catch { previous = null }
        const changes = comparePipelineSnapshots(previous?.rows, activePipeline)
        try { localStorage.setItem(snapshotKey, JSON.stringify({ savedAt: new Date().toISOString(), rows: snapshotPipeline(activePipeline) })) } catch { }

        if (!cancelled) {
          setAllRows(rows)
          setAppStartRaw(appRaw)
          setPipelineRows(pipeline)
          setPipelineChanges(changes)
        }
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [date])

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-10 h-10 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      <div className="text-sm text-gray-500">Loading calls for {date}…</div>
    </div>
  )

  if (error) return (
    <div className="m-5 bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">❌ {error}</div>
  )

  const noCallsBanner = !loading && !error && allRows.length === 0 && diagInfo ? (
    <div className="mx-5 mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
      <div className="text-sm text-amber-800">
        <span className="font-semibold">No calls on {date}</span>
        {diagInfo.latestDate !== "—" && (
          <span className="text-xs text-amber-600 ml-2">(latest data: {diagInfo.latestDate})</span>
        )}
      </div>
      {diagInfo.latestDate !== "—" && (
        <button
          onClick={() => setDate(diagInfo.latestDate)}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition shrink-0">
          Go to {diagInfo.latestDate}
        </button>
      )}
    </div>
  ) : null

  return (
    <>
      {noCallsBanner}
      {view === "overview"
        ? <Overview
          date={date}
          setDate={setDate}
          allRows={allRows}
          pipelineRows={pipelineRows}
          pipelineChanges={pipelineChanges}
          onDrill={() => setParams(p => { const n = new URLSearchParams(p); n.delete('ai_subtab'); n.set('ai_view', 'detail'); return n }, { replace: true })}
          onOpenPipeline={() => setParams(p => { const n = new URLSearchParams(p); n.set('ai_subtab', 'pipeline'); n.set('ai_view', 'detail'); return n }, { replace: true })}
        />
        : <Detail date={date} setDate={setDate} allRows={allRows} pipelineRows={pipelineRows} pipelineChanges={pipelineChanges} initialSubTab={detailSubTab} onBack={() => setView("overview")} appRows={appStartRaw} />
      }
    </>
  )
}
