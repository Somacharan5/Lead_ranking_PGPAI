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
  { key: "Jasmeet Kaur",   short: "Jasmeet", color: "#3b82f6", bg: "#eff6ff", ring: "#93c5fd" },
  { key: "Komal Pandey",   short: "Komal",   color: "#8b5cf6", bg: "#f5f3ff", ring: "#c4b5fd" },
  { key: "Prerna Kaushik", short: "Prerna",  color: "#ec4899", bg: "#fdf2f8", ring: "#f9a8d4" },
  // TODO: update key values to match exact CRM column U / column AR values once confirmed
  { key: "Sanjana",        short: "Sanjana", color: "#14b8a6", bg: "#f0fdfa", ring: "#5eead4" },
]
const ALL_COLS = [
  ...MAIN_COUNSELLORS,
  { key: "Others", short: "Others", color: "#94a3b8", bg: "#f8fafc", ring: "#cbd5e1" },
]

const NAME_MAP = {
  "Jasmeet Kaur":   "Jasmeet Kaur",
  "Jasmeet":        "Jasmeet Kaur",
  "KOMAL":          "Komal Pandey",
  "Komal":          "Komal Pandey",
  "Komal Pandey":   "Komal Pandey",
  "Prerna":         "Prerna Kaushik",
  "Prerna Kaushik": "Prerna Kaushik",
  "PRERNA":         "Prerna Kaushik",
  // TODO: update these to match exact CRM column values once confirmed
  "Sanjana":        "Sanjana",
  "SANJANA":        "Sanjana",
}

const SECTIONS = [
  { key: "all",    label: "All sections",       val: null            },
  { key: "appFU",  label: "App Start Followup", val: "App Followup"  },
  { key: "appNew", label: "App Start New",       val: "App Start New" },
  { key: "leadFU", label: "Followup Leads",      val: "Followup Lead" },
  { key: "fresh",  label: "Fresh Leads",          val: "Fresh Lead"   },
]

const STAGE_ORDER = [
  "Counseled", "No Contact Established", "Not interested",
  "Not Eligible", "Untouched", "Intent dropped",
]

const STAGE_COLORS = {
  "Counseled":                "#22c55e",
  "No Contact Established":   "#f59e0b",
  "Not interested":           "#ef4444",
  "Not Eligible":             "#6b7280",
  "Untouched":                "#3b82f6",
  "Intent dropped":           "#8b5cf6",
}

const CALL_TYPE_COLORS = {
  Outgoing: "#3b82f6",
  Incoming: "#22c55e",
  Missed:   "#ef4444",
  Rejected: "#f97316",
}

const PIPELINE_BUCKETS = [
  { key: "hot",  label: "Hot",  color: "#ef4444", bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200" },
  { key: "warm", label: "Warm", color: "#f59e0b", bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200" },
  { key: "cold", label: "Cold", color: "#64748b", bg: "bg-slate-50",  text: "text-slate-700",  border: "border-slate-200" },
]

const URGENCY = {
  today:       { label: "Today",     bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200"   },
  "this-week": { label: "This week", bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200" },
  low:         { label: "Low",       bg: "bg-gray-50",   text: "text-gray-600",   border: "border-gray-200"  },
}
const SENTIMENT = {
  positive: { bg: "bg-green-50",  text: "text-green-700",  label: "Positive" },
  mixed:    { bg: "bg-amber-50",  text: "text-amber-700",  label: "Mixed"    },
  negative: { bg: "bg-red-50",    text: "text-red-700",    label: "Negative" },
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function normalizeName(raw) {
  const t = cellText(raw)
  if (!t) return null
  const titled = t.replace(/\b\w/g, c => c.toUpperCase())
  return NAME_MAP[titled] || NAME_MAP[t] || "Others"
}

function inferSection(stageType, leadStage) {
  const isUntouched = cellText(leadStage) === "Untouched"
  if (stageType === "Lead")                                  return isUntouched ? "Fresh Lead"    : "Followup Lead"
  if (stageType === "App Start" || stageType === "Paid App") return isUntouched ? "App Start New" : "App Followup"
  return "Unknown"
}

function parseDate(val) {
  if (!val && val !== 0) return null
  const n = Number(val)
  if (!isNaN(n) && n > 40000 && n < 60000) return new Date((n - 25569) * 86400 * 1000)
  const d = new Date(val)
  return isNaN(d) ? null : d
}

function sameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth()    === d2.getMonth()    &&
         d1.getDate()     === d2.getDate()
}

function r2(n) { return typeof n === "number" ? Math.round(n * 100) / 100 : 0 }
function phone10(v) { return String(v || "").replace(/\D/g, "").slice(-10) }
function cellText(v) { return v === null || v === undefined ? "" : String(v).trim() }
function parseDurationMins(v) {
  const s = String(v || "").trim()
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
  return ALL_COLS.find(c => c.key === key) || { color: "#94a3b8", bg: "#f8fafc", short: key }
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

    const item = {
      id: key,
      type: cfg.type,
      name: cellText(row[cfg.nameIdx]),
      email,
      phone,
      counsellor: normalizeName(row[cfg.counsellorIdx]) || "Others",
      stage: normalizeStage(row[cfg.stageIdx]),
      subStage: cellText(row[cfg.subStageIdx]) || "No substage",
      source: cellText(row[cfg.sourceIdx]) || "Unknown",
      notes: cellText(row[cfg.notesIdx]),
      priority: cfg.priorityIdx !== null ? cellText(row[cfg.priorityIdx]) : "",
      paymentStatus: cfg.paymentStatusIdx !== null ? cellText(row[cfg.paymentStatusIdx]) : "",
      registeredOn: fmtSerial(row[cfg.registeredOnIdx]),
      lastActivity: fmtSerial(row[cfg.lastActivityIdx]),
    }
    item.bucket = inferPipelineBucket(item)
    rows.push(item)
  }

  // Lead Dump — all leads (fresh + followup) in one sheet
  // BC(54)=Counsellor, BD(55)=Stage, BE(56)=SubStage, BP(67)=Notes, AJ(35)=PaymentStatus, CG(84)=Priority
  // BA(52)=Registered On, BK(62)=Last Activity
  leadDumpRows.slice(1).forEach(row => add(row, {
    type: "Lead", nameIdx: 0, emailIdx: 1, mobileIdx: 2, sourceIdx: 6,
    counsellorIdx: 54, stageIdx: 55, subStageIdx: 56, notesIdx: 67, priorityIdx: 84, paymentStatusIdx: 35,
    registeredOnIdx: 52, lastActivityIdx: 62,
  }))
  // followupLeadRows is the same sheet — deduplication by phone/email prevents double-counting
  followupLeadRows.slice(1).forEach(row => add(row, {
    type: "Lead", nameIdx: 0, emailIdx: 1, mobileIdx: 2, sourceIdx: 6,
    counsellorIdx: 54, stageIdx: 55, subStageIdx: 56, notesIdx: 67, priorityIdx: 84, paymentStatusIdx: 35,
    registeredOnIdx: 52, lastActivityIdx: 62,
  }))
  // App Start Dump — all app starts (new + followup) in one sheet
  // Q(16)=Registered On, BG(58)=Last Activity
  appStartRows.slice(1).forEach(row => add(row, {
    type: "App Start", nameIdx: 12, emailIdx: 13, mobileIdx: 14, sourceIdx: 18,
    counsellorIdx: 43, stageIdx: 46, subStageIdx: 47, notesIdx: 64, priorityIdx: null, paymentStatusIdx: 2,
    registeredOnIdx: 16, lastActivityIdx: 58,
  }))
  appFollowupRows.slice(1).forEach(row => add(row, {
    type: "App Start", nameIdx: 12, emailIdx: 13, mobileIdx: 14, sourceIdx: 18,
    counsellorIdx: 43, stageIdx: 46, subStageIdx: 47, notesIdx: 64, priorityIdx: 150, paymentStatusIdx: 2,
    registeredOnIdx: 16, lastActivityIdx: 58,
  }))

  return rows
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
    const sub   = cellText(row[56])
    const note  = cellText(row[67])
    const stage = cellText(row[55])
    const src   = cellText(row[6])
    if (sub)   subStageMap[p]  = sub
    if (note)  notesMap[p]     = note
    stageTypeMap[p] = 'Lead'
    if (stage) leadStageMap[p] = stage
    if (src)   sourceMap[p]    = src
  })

  appStartRows.slice(1).forEach(row => {
    const p = phone10(row[14])
    if (!p) return
    const sub   = cellText(row[47])
    const note  = cellText(row[64])
    const stage = cellText(row[46])
    const src   = cellText(row[18])
    if (sub)  subStageMap[p]  = sub
    if (note) notesMap[p]     = note
    stageTypeMap[p] = 'App Start'
    if (stage) leadStageMap[p] = stage
    if (src)   sourceMap[p]    = src
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
      empName:      normalizeName(row[3]),
      toNumber:     p,
      callType:     cellText(row[8]),
      callDate:     row[10],
      notes:        notesMap[p] || cellText(row[12]),
      audioUrl:     row[14] || "",
      stageType:    stageTypeMap[p]  || cellText(row[15]),
      source:       sourceMap[p]     || cellText(row[19]),
      leadStage:    leadStageMap[p]  || cellText(row[20]),
      durationMins: parseDurationMins(row[9]),
      subStage:     subStageMap[p] || "",
    }
  })
  .filter(r => r.empName !== null)
  .filter(r => { const d = parseDate(r.callDate); return d && sameDay(d, target) })
  .map(r => ({ ...r, section: inferSection(r.stageType, r.leadStage) }))
}

function computeStats(rows) {
  if (!rows || rows.length === 0) return null
  const out  = rows.filter(r => r.callType === "Outgoing")
  const inc  = rows.filter(r => r.callType === "Incoming")
  const miss = rows.filter(r => r.callType === "Missed" || r.callType === "Rejected")
  const conn = out.filter(r => r.durationMins > 0)
  const uniq = new Set(out.map(r => r.toNumber).filter(Boolean)).size
  const dur  = out.reduce((s, r) => s + r.durationMins, 0)
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
  const raw  = data.content.map(b => b.text || "").join("")
  const text = raw.replace(/```json[\s\S]*?```|```/g, "").trim()
  return robustJSONParse(text)
}

function robustJSONParse(text) {
  // 1. Direct parse
  try { return JSON.parse(text) } catch {}

  // 2. Strip control characters
  try { return JSON.parse(text.replace(/[\x00-\x1f\x7f]/g, " ")) } catch {}

  // 3. Extract outermost { ... } block
  const objMatch = text.match(/\{[\s\S]*\}/)
  if (objMatch) {
    try { return JSON.parse(objMatch[0]) } catch {}
    try { return JSON.parse(objMatch[0].replace(/[\x00-\x1f\x7f]/g, " ")) } catch {}
  }

  // 4. Truncate at last complete top-level field and close the object
  // Walk backwards to find the last comma that separates top-level keys
  const base = objMatch ? objMatch[0] : text
  const lastComma = base.lastIndexOf(',"follow')  // followupFlags is always last
  if (lastComma > 0) {
    try {
      return JSON.parse(base.slice(0, lastComma) + "}")
    } catch {}
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
  const data = MAIN_COUNSELLORS.map(c => {
    const rows = allRows.filter(r => r.empName === c.key)
    const out  = rows.filter(r => r.callType === "Outgoing")
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
          <Bar dataKey="Outgoing"  fill="#3b82f6" radius={[4,4,0,0]} />
          <Bar dataKey="Connected" fill="#22c55e" radius={[4,4,0,0]} />
          <Bar dataKey="Missed"    fill="#fca5a5" radius={[4,4,0,0]} />
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

function StageBarChart({ rows, onDrill }) {
  const allStages = useMemo(() => {
    const set = new Set(rows.map(r => r.leadStage || "Unknown"))
    return [
      ...STAGE_ORDER.filter(s => set.has(s)),
      ...[...set].filter(s => !STAGE_ORDER.includes(s) && s !== "Unknown").sort(),
    ]
  }, [rows])

  const data = allStages.map(s => ({
    name: s.length > 22 ? s.slice(0, 20) + "…" : s,
    fullName: s,
    value: rows.filter(r => (r.leadStage || "Unknown") === s).length,
    color: STAGE_COLORS[s] || "#94a3b8",
  })).sort((a, b) => b.value - a.value)

  const max = Math.max(...data.map(d => d.value), 1)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-gray-800">Stage Breakdown</div>
        <InfoBadge text="Counts all calls made today grouped by the lead's current CRM stage. Click a bar to see raw calls for that stage." />
      </div>
      <div className="space-y-3">
        {data.map(d => (
          <div key={d.fullName}
               className={onDrill ? "cursor-pointer group" : ""}
               onClick={() => onDrill?.(d.fullName, rows.filter(r => (r.leadStage || "Unknown") === d.fullName))}>
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
          <Bar dataKey="value" name="Calls" radius={[4,4,0,0]}
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
    const out  = r.filter(x => x.callType === "Outgoing")
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
          <Bar dataKey="Outgoing"  fill="#93c5fd" radius={[3,3,0,0]}
               onClick={onDrill ? (d) => onDrill(d.fullName + " — outgoing", rows.filter(r => r.section === d.fullName && r.callType === "Outgoing")) : undefined}
               style={onDrill ? { cursor: "pointer" } : {}} />
          <Bar dataKey="Connected" fill="#22c55e" radius={[3,3,0,0]}
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

  const byCounsellor = useMemo(() => {
    return ALL_COLS.map(c => {
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
  }, [counseledRows])

  const bucketCounts = PIPELINE_BUCKETS.reduce((acc, b) => {
    acc[b.key] = counseledRows.filter(r => r.bucket === b.key).length
    return acc
  }, {})

  const typeRows = useMemo(() => {
    return ["Lead", "App Start"].map(type => {
      const typeFiltered = counseledRows.filter(r => r.type === type)
      const byCol = {}
      ALL_COLS.forEach(c => {
        const cRows = typeFiltered.filter(r => r.counsellor === c.key)
        byCol[c.key] = {
          hot:   cRows.filter(r => r.bucket === "hot").length,
          warm:  cRows.filter(r => r.bucket === "warm").length,
          cold:  cRows.filter(r => r.bucket === "cold").length,
          total: cRows.length,
        }
      })
      return {
        type,
        hot:   typeFiltered.filter(r => r.bucket === "hot").length,
        warm:  typeFiltered.filter(r => r.bucket === "warm").length,
        cold:  typeFiltered.filter(r => r.bucket === "cold").length,
        total: typeFiltered.length,
        byCol,
      }
    })
  }, [counseledRows])

  const counsellorTotals = useMemo(() => {
    const out = {}
    ALL_COLS.forEach(c => { out[c.key] = counseledRows.filter(r => r.counsellor === c.key).length })
    return out
  }, [counseledRows])

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
            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${
              net > 0 ? "bg-green-50 text-green-700 border-green-200" :
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
              <Bar key={b.key} dataKey={b.key} name={b.label} stackId="pipeline" fill={b.color} radius={[3,3,0,0]}
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
                {ALL_COLS.map(c => (
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
                      {ALL_COLS.map(c => (
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
                        {ALL_COLS.map(c => (
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
                {ALL_COLS.map(c => (
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
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${
                  isGain ? "bg-green-50 text-green-700 border-green-200" :
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
        <div className={`rounded-lg border p-4 ${
          net > 0 ? "bg-green-50 border-green-200" :
          net < 0 ? "bg-red-50 border-red-200" :
          "bg-gray-50 border-gray-200"
        }`}>
          <div className={`text-xs uppercase tracking-wide ${
            net > 0 ? "text-green-700" : net < 0 ? "text-red-700" : "text-gray-500"
          }`}>Change</div>
          <div className={`text-2xl font-bold mt-1 ${
            net > 0 ? "text-green-700" : net < 0 ? "text-red-700" : "text-gray-700"
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
  { val: "App Followup",  label: "App Start Followup" },
  { val: "App Start New", label: "App Start New"       },
  { val: "Followup Lead", label: "Followup Leads"      },
  { val: "Fresh Lead",    label: "Fresh Leads"         },
]

function PivotTable({ rows, onDrill }) {
  const [stageOpen, setStageOpen] = useState({})
  const [outOpen,   setOutOpen]   = useState(false)

  const allS  = computeStats(rows)
  const byCol = useMemo(() => {
    const m = {}
    ALL_COLS.forEach(c => { m[c.key] = computeStats(rows.filter(r => r.empName === c.key)) })
    return m
  }, [rows])

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
      <td colSpan={2 + ALL_COLS.length} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider"
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
      {ALL_COLS.map(c => (
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
            {ALL_COLS.map(c => <TH key={c.key} right>{c.short}</TH>)}
          </tr>
        </thead>
        <tbody>
          <SectionRow label="Volume" color="#3b82f6" />
          <DataRow label="Total calls"            getV={s=>s.total}    bold getRows={makeFilter(null)} />
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
            {ALL_COLS.map(c => (
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
              {ALL_COLS.map(c => (
                <td key={c.key} className={`px-4 py-2 text-xs text-right border-b border-gray-100 text-gray-500 ${drillCls}`}
                    onClick={onDrill ? () => onDrill(`Outgoing → ${sec.label} — ${c.short}`, rows.filter(r => r.callType === "Outgoing" && r.section === sec.val && r.empName === c.key), "calls") : undefined}>
                  {byCol[c.key]?.outBySec?.[sec.val] ?? 0}
                </td>
              ))}
            </tr>
          ))}
          <DataRow label="Incoming"               getV={s=>s.incoming} getRows={makeFilter(r => r.callType === "Incoming")} />
          <DataRow label="Missed / Rejected"      getV={s=>s.missed}   getRows={makeFilter(r => r.callType === "Missed" || r.callType === "Rejected")} />
          <DataRow label="Unique numbers dialled" getV={s=>s.unique}   />

          <SectionRow label="Connection quality" color="#22c55e" />
          <DataRow label="Connected"   getV={s=>s.connected} bold getRows={makeFilter(r => r.callType === "Outgoing" && r.durationMins > 0)} />
          <DataRow label="Connected %" getV={s=>s.connPct !== null ? s.connPct + "%" : "—"} />

          <SectionRow label="Stage breakdown" color="#f59e0b" />
          {allStages.map(stage => {
            const isOpen   = stageOpen[stage]
            const subMap   = {}
            rows.filter(r => (r.leadStage || "Unknown") === stage && r.subStage).forEach(r => {
              subMap[r.subStage] = (subMap[r.subStage] || 0) + 1
            })
            const subKeys    = Object.entries(subMap).sort((a,b)=>b[1]-a[1]).map(([k])=>k)
            const hasSubStages = subKeys.length > 0
            const stageColor   = STAGE_COLORS[stage] || "#94a3b8"
            return (
              <React.Fragment key={stage}>
                <tr className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => hasSubStages && setStageOpen(p => ({...p,[stage]:!p[stage]}))}>
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
                      onClick={onDrill ? (e) => { e.stopPropagation(); onDrill(`Stage: ${stage}`, rows.filter(r => (r.leadStage||"Unknown") === stage), "calls") } : undefined}>
                    {allS?.stages[stage] ?? 0}
                  </td>
                  {ALL_COLS.map(c => {
                    const v = byCol[c.key]?.stages[stage] ?? 0
                    return (
                      <td key={c.key} className={`px-4 py-2.5 text-sm text-right border-b border-gray-100 ${drillCls}`}
                          style={{ color: v > 0 ? c.color : "#d1d5db" }}
                          onClick={onDrill ? (e) => { e.stopPropagation(); onDrill(`Stage: ${stage} — ${c.short}`, rows.filter(r => (r.leadStage||"Unknown") === stage && r.empName === c.key), "calls") } : undefined}>
                        {v}
                      </td>
                    )
                  })}
                </tr>
                {isOpen && subKeys.map(sub => {
                  const tot = rows.filter(r => (r.leadStage||"Unknown")===stage && r.subStage===sub).length
                  return (
                    <tr key={sub} className="bg-amber-50/40">
                      <td className="py-2 text-xs text-gray-500 border-b border-gray-100"
                          style={{ paddingLeft: 44, borderLeft: `3px solid ${stageColor}40` }}>
                        {sub}
                      </td>
                      <td className={`px-4 py-2 text-xs text-right border-b border-gray-100 text-gray-600 font-medium ${drillCls}`}
                          onClick={onDrill ? () => onDrill(`${stage} / ${sub}`, rows.filter(r => (r.leadStage||"Unknown")===stage && r.subStage===sub), "calls") : undefined}>
                        {tot}
                      </td>
                      {ALL_COLS.map(c => {
                        const v = rows.filter(r => r.empName===c.key && (r.leadStage||"Unknown")===stage && r.subStage===sub).length
                        return (
                          <td key={c.key} className={`px-4 py-2 text-xs text-right border-b border-gray-100 ${drillCls}`}
                              style={{ color: v > 0 ? c.color : "#d1d5db" }}
                              onClick={onDrill ? () => onDrill(`${stage} / ${sub} — ${c.short}`, rows.filter(r => r.empName===c.key && (r.leadStage||"Unknown")===stage && r.subStage===sub), "calls") : undefined}>
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
          <DataRow label="Total (mins)"                  getV={s=>s.totalDur} bold getRows={makeFilter(r => r.callType === "Outgoing")} />
          <DataRow label="Avg per connected call (mins)"  getV={s=>s.avgDur}  />
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
  const [status,   setStatus]   = useState("idle")
  const [insights, setInsights] = useState(null)
  const [errMsg,   setErrMsg]   = useState("")
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
    } catch {}
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
    } catch {}
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
    hot:  (leadClassifications||[]).filter(l=>l.interest==="hot"),
    warm: (leadClassifications||[]).filter(l=>l.interest==="warm"),
    cold: (leadClassifications||[]).filter(l=>l.interest==="cold"),
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
            {(topThemes||[]).slice(0,5).map(({ theme, count, example }) => (
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
            {(topObjections||[]).map(({ objection, count, howHandled }) => (
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
            {(objectionsBySource||[]).map(({ source, topObjection, count }) => (
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
            { label:"🔥 Hot",  leads: classified.hot,  border:"border-amber-300",  bg:"bg-amber-50",  text:"text-amber-800"  },
            { label:"🌤 Warm", leads: classified.warm, border:"border-blue-300",   bg:"bg-blue-50",   text:"text-blue-800"   },
            { label:"❄ Cold",  leads: classified.cold, border:"border-gray-200",   bg:"bg-gray-50",   text:"text-gray-600"   },
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
      {(followupFlags||[]).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-sm font-semibold text-gray-800 mb-3">Follow-up Flags</div>
          <div className="space-y-3">
            {[...followupFlags]
              .sort((a,b) => ["today","this-week","low"].indexOf(a.urgency) - ["today","this-week","low"].indexOf(b.urgency))
              .map((f, i) => {
                const u   = URGENCY[f.urgency] || URGENCY.low
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
    { key: "empName",      label: "Counsellor" },
    { key: "toNumber",     label: "Phone"       },
    { key: "callType",     label: "Type"        },
    { key: "durationMins", label: "Dur (min)",  fmt: v => v ? r2(v) : "—" },
    { key: "section",      label: "Section"     },
    { key: "leadStage",    label: "Stage"       },
    { key: "subStage",     label: "Sub-stage"   },
    { key: "source",       label: "Source"      },
    { key: "notes",        label: "Notes"       },
  ]

  const LEADS_COLS = [
    { key: "name",         label: "Name"          },
    { key: "phone",        label: "Phone"         },
    { key: "counsellor",   label: "Counsellor"    },
    { key: "stage",        label: "Stage"         },
    { key: "subStage",     label: "Sub-stage"     },
    { key: "bucket",       label: "Bucket"        },
    { key: "source",       label: "Source"        },
    { key: "type",         label: "Type"          },
    { key: "registeredOn", label: "Registered On" },
    { key: "lastActivity", label: "Last Activity" },
    { key: "notes",        label: "Notes"         },
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

const PA_MONTHS = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 }

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
  if (days <= 0)  return "Same day"
  if (days <= 3)  return "1–3 days"
  if (days <= 7)  return "4–7 days"
  if (days <= 14) return "8–14 days"
  if (days <= 30) return "15–30 days"
  return "30+ days"
}

function paidGetWorkStatus(gradYear) {
  const yr = parseInt(gradYear)
  if (isNaN(yr)) return "Unknown"
  const now = new Date().getFullYear()
  if (yr < now)  return "Working Professional"
  if (yr === now) return "Fresher"
  return "Student"
}

function parsePaidAppRow(row) {
  if (!row) return null
  const status = (row[2] || "").trim().toLowerCase()
  if (status !== "completed") return null
  const registeredOn = paidSerialToDate(row[16])
  const paidOn = paidSerialToDate(row[59]) || registeredOn || null
  const daysToConvert = (registeredOn && paidOn) ? Math.round((paidOn - registeredOn) / 86400000) : null
  const gradYear = parseInt(row[86]) || null
  return {
    name:        cellText(row[12]),
    email:       cellText(row[13]),
    mobile:      cellText(row[14]),
    source:      cellText(row[18]) || "Unknown",
    medium:      cellText(row[19]) || "Unknown",
    campaign:    cellText(row[20]) || "Unknown",
    counsellor:  normalizeName(row[43]) || cellText(row[43]) || "Unknown",
    registeredOn,
    paidOn,
    daysToConvert,
    daysBucket:  paidGetDaysBucket(daysToConvert),
    state:       cellText(row[74]) || "Unknown",
    city:        cellText(row[75]) || "Unknown",
    gradYear:    gradYear ? String(gradYear) : "Unknown",
    workStatus:  paidGetWorkStatus(gradYear),
    college:     cellText(row[105]) || "Unknown",
    degree:      cellText(row[107]) || "Unknown",
    company:     cellText(row[134]) || "Unknown",
    role:        cellText(row[135]) || "Unknown",
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
  "Jasmeet Kaur":   { color: "#3b82f6", bg: "#eff6ff" },
  "Komal Pandey":   { color: "#8b5cf6", bg: "#f5f3ff" },
  "Prerna Kaushik": { color: "#ec4899", bg: "#fdf2f8" },
}

const PA_ATTR_CONFIGS = [
  { field: "source",     title: "Source",           icon: "🌐", accent: "#4F46E5" },
  { field: "medium",     title: "Medium / Channel", icon: "📡", accent: "#0891B2" },
  { field: "counsellor", title: "Counsellor",       icon: "🧑‍💼", accent: "#059669" },
  { field: "workStatus", title: "Work Status",      icon: "💼", accent: "#D97706" },
  { field: "daysBucket", title: "Days to Convert",  icon: "⏱️", accent: "#DC2626" },
  { field: "city",       title: "City",             icon: "🏙️", accent: "#0891B2" },
  { field: "state",      title: "State",            icon: "📍", accent: "#475569" },
  { field: "gradYear",   title: "Graduation Year",  icon: "🎓", accent: "#7C3AED" },
  { field: "degree",     title: "Degree",           icon: "📜", accent: "#059669" },
  { field: "college",    title: "College",          icon: "🏛️", accent: "#D97706" },
  { field: "company",    title: "Company",          icon: "🏢", accent: "#334155" },
  { field: "role",       title: "Role",             icon: "👤", accent: "#4F46E5" },
]

function PaidAttrList({ items, total, accent }) {
  return (
    <div className="flex flex-col divide-y divide-gray-50">
      {items.map(({ label, count }, i) => {
        const pct     = total ? Math.round(count / total * 100) : 0
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
  const [viewMode,   setViewMode]   = useState("overall")
  const [weekStart,  setWeekStart]  = useState(() => paidGetDefaultWeekStart())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drillAttr,  setDrillAttr]  = useState(null)

  const allPaid = useMemo(() =>
    (appRows || []).slice(1).map(row => { try { return parsePaidAppRow(row) } catch { return null } }).filter(Boolean)
  , [appRows])

  const weekLeads = useMemo(() => {
    if (viewMode === "overall") return allPaid
    const start = new Date(weekStart); start.setHours(0, 0, 0, 0)
    const end   = new Date(weekStart); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999)
    return allPaid.filter(l => l.paidOn && l.paidOn >= start && l.paidOn <= end)
  }, [allPaid, weekStart, viewMode])

  const total = weekLeads.length

  const weeklyTrend = useMemo(() => {
    const thisMonday = paidGetWeekMonday(new Date())
    const weeks = []
    for (let i = 7; i >= 0; i--) {
      const start = new Date(thisMonday); start.setDate(start.getDate() - i * 7); start.setHours(0, 0, 0, 0)
      const end   = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59, 999)
      const count = allPaid.filter(l => l.paidOn && l.paidOn >= start && l.paidOn <= end).length
      weeks.push({ name: fmtPaidDate(start).slice(0, -5), count })
    }
    return weeks
  }, [allPaid])

  const attrs = useMemo(() => ({
    source:     paidGroupRank(weekLeads, "source"),
    medium:     paidGroupRank(weekLeads, "medium"),
    counsellor: paidGroupRank(weekLeads, "counsellor"),
    workStatus: paidGroupRank(weekLeads, "workStatus"),
    city:       paidGroupRank(weekLeads, "city"),
    state:      paidGroupRank(weekLeads, "state"),
    gradYear:   paidGroupRank(weekLeads, "gradYear"),
    degree:     paidGroupRank(weekLeads, "degree"),
    college:    paidGroupRank(weekLeads, "college"),
    company:    paidGroupRank(weekLeads, "company"),
    role:       paidGroupRank(weekLeads, "role"),
    daysBucket: paidGroupDaysBuckets(weekLeads),
  }), [weekLeads])

  const counsellorSplit = useMemo(() => {
    const map = {}
    for (const l of weekLeads) map[l.counsellor] = (map[l.counsellor] || 0) + 1
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [weekLeads])

  const thisMonday = paidGetWeekMonday(new Date())
  const atPresent  = weekStart >= thisMonday
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
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      viewMode === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
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
                    className={`w-7 h-7 flex items-center justify-center rounded-lg transition text-lg font-bold ${
                      atPresent ? "text-gray-300 cursor-not-allowed" : "hover:bg-gray-100 text-gray-600"
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
            <KPICard label="Total Calls"    value={s.total}         sub="all counsellors"    icon="📞" />
            <KPICard label="Connected"      value={`${s.connected} (${s.connPct ?? 0}%)`}
                     sub="of outgoing"
                     color={s.connPct >= 40 ? "#16a34a" : s.connPct >= 20 ? "#d97706" : "#dc2626"}
                     icon="✅" />
            <KPICard label="Total Duration" value={`${s.totalDur}m`} sub="outgoing calls"  icon="⏱" />
            <KPICard label="Avg / Call"     value={`${s.avgDur}m`}   sub="connected only"  icon="📊" />
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
            {MAIN_COUNSELLORS.map(c => {
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
                        <StatChip label="Total calls" value={cs.total}        color={c.color} />
                        <StatChip label="Missed"      value={cs.missed}       color="#ef4444" />
                        <StatChip label="Duration"    value={`${cs.totalDur}m`} color="#64748b" />
                        <StatChip label="Avg / call"  value={`${cs.avgDur}m`}   color="#64748b" />
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
// DETAIL VIEW
// ─────────────────────────────────────────────────────────────────────────────

function Detail({ date, setDate, allRows, pipelineRows, pipelineChanges, initialSubTab = "charts", onBack, appRows }) {
  const [mainTab, setMainTab] = useState("overall")
  const [section, setSection] = useState("all")
  const [source,  setSource]  = useState("all")
  const [subTab,  setSubTab]  = useState(initialSubTab)
  const [drill,   setDrill]   = useState(null)

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
        {[["overall","Overall"], ...ALL_COLS.map(c => [c.key, c.short])].map(([k, l]) => {
          const meta = k !== "overall" ? colMeta(k) : null
          const isActive = mainTab === k
          return (
            <button key={k}
                    onClick={() => { setMainTab(k); setSubTab("charts") }}
                    className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      isActive ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-600"
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
        {[["charts","📊 Charts"], ["table","📋 Pivot Table"], ["pipeline","🎯 Pipeline"], ["ai","✦ AI Insights"], ["paid-apps","💰 Paid Apps"]].map(([k,l]) => (
          <button key={k} onClick={() => setSubTab(k)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    subTab === k
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
      </div>

      <DrillDrawer drill={drill} onClose={() => setDrill(null)} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminInsights() {
  const [params, setParams] = useSearchParams()
  const DEFAULT_DATE = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) })()
  const view         = params.get('ai_view')   || 'overview'
  const date         = params.get('ai_date')   || DEFAULT_DATE
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
  const [error,   setError]   = useState("")
  const [diag,    setDiag]    = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(""); setDiag(null)
      try {
        const { fetchSheetData } = await import('../utils/sheetsApi')
        const [callsRaw, leadRaw] = await Promise.all([
          fetchSheetData('Call history', 'A:AZ'),
          fetchSheetData('Lead Dump',    'A:CG'),
        ])
        const appRaw = await fetchSheetData('App Start Dump', 'A:EU').catch(e => {
          console.warn('App Start Dump fetch failed:', e.message)
          return []
        })
        if (callsRaw.length === 0) throw new Error("Call history sheet returned no data — check the sheet name, sharing settings, and API key.")
        const { subStageMap, notesMap, stageTypeMap, leadStageMap, sourceMap } = buildLeadMaps(leadRaw, appRaw)
        const rows = parseCallsHistory(callsRaw, new Date(date), subStageMap, notesMap, stageTypeMap, leadStageMap, sourceMap)
        const pipeline = buildPipelineRows(leadRaw, leadRaw, appRaw, appRaw)
        const activePipeline = pipeline.filter(row => !isPaymentCompleted(row.paymentStatus))
        const snapshotKey = "aias_admin_pipeline_snapshot_v1"
        let previous = null
        try { previous = JSON.parse(localStorage.getItem(snapshotKey) || "null") } catch { previous = null }
        const changes = comparePipelineSnapshots(previous?.rows, activePipeline)
        try { localStorage.setItem(snapshotKey, JSON.stringify({ savedAt: new Date().toISOString(), rows: snapshotPipeline(activePipeline) })) } catch {}

        // Collect diagnostic info
        const empCounts = {}
        callsRaw.slice(1).forEach(r => {
          const n = normalizeName(r[3]) || `raw:"${String(r[3] || '').slice(0, 20)}"`
          empCounts[n] = (empCounts[n] || 0) + 1
        })
        const headerRow  = callsRaw[0] || []
        const sampleCall = callsRaw[1] || []

        if (!cancelled) {
          setAllRows(rows)
          setAppStartRaw(appRaw)
          setPipelineRows(pipeline)
          setPipelineChanges(changes)
          setDiag({
            callsTotal: callsRaw.length - 1,
            leadTotal:  leadRaw.length  - 1,
            appTotal:   appRaw.length   - 1,
            callsForDate: rows.length,
            filterDate: date,
            empCounts,
            headerRow: headerRow.slice(0, 25),
            sampleCall: sampleCall.slice(0, 25),
            sampleLen: sampleCall.length,
          })
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
    <div className="m-5 space-y-3">
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700 font-semibold">❌ {error}</div>
      <div className="bg-slate-800 text-slate-100 rounded-xl p-4 text-xs font-mono">
        <div className="font-bold mb-1 text-slate-300">Diagnostic — fetch failed</div>
        <div>Tried sheet: <b>"Call history"</b> range A:AZ</div>
        <div>Date being loaded: <b>{date}</b></div>
        <div className="text-red-300 mt-1">If the sheet name is wrong, share the exact tab name from your Google Sheet.</div>
      </div>
    </div>
  )

  return (
    <>
      {diag && (
        <div className="m-4 bg-slate-800 text-slate-100 rounded-xl p-4 text-xs font-mono space-y-1">
          <div className="font-bold text-slate-300 text-sm mb-2">🔍 Admin Insights Diagnostic</div>
          <div>Call history rows: <b className={diag.callsTotal === 0 ? "text-red-300" : "text-green-300"}>{diag.callsTotal}</b></div>
          <div>Lead Dump rows: <b>{diag.leadTotal}</b> &nbsp;|&nbsp; App Start Dump rows: <b>{diag.appTotal}</b></div>
          <div>Filtering for date: <b className="text-yellow-300">{diag.filterDate}</b> → calls found: <b className={diag.callsForDate === 0 ? "text-red-300" : "text-green-300"}>{diag.callsForDate}</b></div>
          <div className="mt-1">Employee name breakdown (all dates):
            {Object.entries(diag.empCounts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([n,c]) =>
              <span key={n} className="ml-2 bg-slate-700 rounded px-1">"{n}" ×{c}</span>
            )}
          </div>
          <div className="mt-1">Header row (first 25 cols):
            {diag.headerRow.map((h, i) => <span key={i} className="ml-1 bg-slate-700 rounded px-1">[{i}]{String(h||'').slice(0,18)}</span>)}
          </div>
          <div className="mt-1 text-slate-400">Sample data row (first 25 cols, rowLen:{diag.sampleLen}):
            {diag.sampleCall.map((v, i) => <span key={i} className="ml-1 bg-slate-900 rounded px-1">[{i}]{String(v||'').slice(0,12)}</span>)}
          </div>
        </div>
      )}
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
