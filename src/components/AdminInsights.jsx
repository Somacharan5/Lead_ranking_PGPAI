import { useState, useEffect, useMemo, useCallback, useRef } from "react"
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
  "Rahul":          "Rahul",
  "RAHUL":          "Rahul",
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
  return NAME_MAP[t] || "Others"
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
  const text = `${row.subStage || ""} ${row.notes || ""} ${row.priority || ""}`.toLowerCase()
  if (/(hot|high intent|very interested|will pay|payment|shortlist|visit|application|interview|callback today|priority 1)/.test(text)) return "hot"
  if (/(warm|interested|follow.?up|callback|thinking|discuss|parents|fees|scholarship|priority 2|priority 3)/.test(text)) return "warm"
  if (/(cold|not interested|not eligible|wrong number|invalid|dropped|low intent|priority 5)/.test(text)) return "cold"
  return "warm"
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
    }
    item.bucket = inferPipelineBucket(item)
    rows.push(item)
  }

  // TODO: paymentStatusIdx values need verification against the actual sheet columns.
  // Lead Dump col R (idx 17) and App Start Dump col C (idx 2) are not in the confirmed
  // column map. If wrong, converted leads will not be filtered out of the pipeline.
  leadDumpRows.slice(1).forEach(row => add(row, {
    type: "Lead", nameIdx: 0, emailIdx: 1, mobileIdx: 2, sourceIdx: 6,
    counsellorIdx: 20, stageIdx: 21, subStageIdx: 22, notesIdx: 33, priorityIdx: null, paymentStatusIdx: 17,
  }))
  followupLeadRows.slice(1).forEach(row => add(row, {
    type: "Lead", nameIdx: 0, emailIdx: 1, mobileIdx: 2, sourceIdx: 6,
    counsellorIdx: 20, stageIdx: 21, subStageIdx: 22, notesIdx: 33, priorityIdx: 74, paymentStatusIdx: 17,
  }))
  appStartRows.slice(1).forEach(row => add(row, {
    type: "App Start", nameIdx: 12, emailIdx: 13, mobileIdx: 14, sourceIdx: 18,
    counsellorIdx: 43, stageIdx: 46, subStageIdx: 47, notesIdx: 64, priorityIdx: null, paymentStatusIdx: 2,
  }))
  appFollowupRows.slice(1).forEach(row => add(row, {
    type: "App Start", nameIdx: 12, emailIdx: 13, mobileIdx: 14, sourceIdx: 18,
    counsellorIdx: 43, stageIdx: 46, subStageIdx: 47, notesIdx: 64, priorityIdx: 150, paymentStatusIdx: 2,
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

// Returns { subStageMap, notesMap } — both keyed by last-10-digit phone number.
// Lead Dump:      col C (idx 2) = Mobile, col W (idx 22) = SubStage, col AH (idx 33) = Notes
// App Start Dump: col O (idx 14) = Mobile, col AV (idx 47) = SubStage, col BM (idx 64) = Notes
export function buildLeadMaps(leadDumpRows = [], appStartRows = []) {
  const subStageMap = {}, notesMap = {}

  leadDumpRows.slice(1).forEach(row => {
    const p = phone10(row[2])
    if (!p) return
    const sub  = cellText(row[22])
    const note = cellText(row[33])
    if (sub)  subStageMap[p] = sub
    if (note) notesMap[p]    = note
  })

  appStartRows.slice(1).forEach(row => {
    const p = phone10(row[14])
    if (!p) return
    const sub  = cellText(row[47])
    const note = cellText(row[64])
    if (sub  && !subStageMap[p]) subStageMap[p] = sub
    if (note && !notesMap[p])    notesMap[p]    = note
  })

  return { subStageMap, notesMap }
}

// Keep for backward compat
export function buildSubStageMap(leadDumpRows = [], appStartRows = []) {
  return buildLeadMaps(leadDumpRows, appStartRows).subStageMap
}

export function parseCallsHistory(rawRows, targetDate, subStageMap = {}, notesMap = {}) {
  const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate
  return rawRows.slice(1).map(row => {
    const p = phone10(row[7])
    return {
      empName:      normalizeName(row[3]),
      toNumber:     p,
      callType:     cellText(row[8]),
      callDate:     row[10],
      // Notes from Lead Dump / App Start Dump (joined by phone) — CRM notes written
      // by the counsellor on the lead record, not the brief call-log note in col M.
      notes:        notesMap[p] || cellText(row[12]),
      audioUrl:     row[14] || "",
      stageType:    cellText(row[15]),
      source:       cellText(row[19]),
      leadStage:    cellText(row[20]),
      durationMins: parseFloat(row[21]) || 0,
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

function CallTypeDonut({ rows }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const types = ["Outgoing", "Incoming", "Missed", "Rejected"]
  const data = types.map(t => ({ name: t, value: rows.filter(r => r.callType === t).length })).filter(d => d.value > 0)
  if (!data.length) return null
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-gray-800">Call Type Breakdown</div>
        <InfoBadge text="Donut shows the split of all calls by type — outgoing (dialled by counsellor), incoming (lead called back), missed, and rejected. Hover a segment to see the count." />
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
               activeIndex={activeIdx} activeShape={renderActiveShape}
               onMouseEnter={(_, i) => setActiveIdx(i)}
               dataKey="value" paddingAngle={3}>
            {data.map((d) => (
              <Cell key={d.name} fill={CALL_TYPE_COLORS[d.name] || "#94a3b8"} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-1">
        {data.map(d => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="w-2 h-2 rounded-full" style={{ background: CALL_TYPE_COLORS[d.name] || "#94a3b8" }} />
            {d.name} ({d.value})
          </div>
        ))}
      </div>
    </div>
  )
}

function StageBarChart({ rows }) {
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
        <InfoBadge text="Counts all calls made today grouped by the lead's current CRM stage (e.g. Counseled, NCE, Not Interested). Helps see which stage is getting the most attention." />
      </div>
      <div className="space-y-3">
        {data.map(d => (
          <div key={d.fullName}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-gray-600 truncate max-w-[180px]" title={d.fullName}>{d.fullName}</span>
              <span className="text-xs font-semibold text-gray-800 ml-2 flex-shrink-0">{d.value}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                   style={{ width: `${(d.value / max) * 100}%`, background: d.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SourceBarChart({ rows }) {
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
        <InfoBadge text="Total calls made today to leads from each acquisition source (e.g. Facebook, Google, Organic). Useful to spot which source is driving the most activity." />
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
                  <div className="text-gray-600">{payload[0]?.value} calls</div>
                </div>
              )
            }}
            cursor={{ fill: "#f8fafc" }}
          />
          <Bar dataKey="value" name="Calls" radius={[4,4,0,0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={`hsl(${217 + i * 22}, 70%, ${55 + i * 3}%)`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ConnectedBySection({ rows }) {
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
        <InfoBadge text="Outgoing calls vs. connected calls (lead answered) split across the 4 dashboard tabs — App Followup, App New, Followup Leads, Fresh Leads. Shows where connection rates are strongest." />
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barGap={3} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={24} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
          <Bar dataKey="Outgoing"  fill="#93c5fd" radius={[3,3,0,0]} />
          <Bar dataKey="Connected" fill="#22c55e" radius={[3,3,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COUNSELED PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

function PipelineSection({ pipelineRows, pipelineChanges, callRows, date }) {
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
        <KPICard
          label="Active Counseled"
          value={counseledRows.length}
          sub={convertedCounseledCount ? `${convertedCounseledCount} converted excluded` : "current pipeline"}
          icon="🎯"
          color="#16a34a"
        />
        {PIPELINE_BUCKETS.map(b => (
          <div key={b.key} className={`rounded-xl border p-5 ${b.bg} ${b.border}`}>
            <div className={`text-xs font-medium uppercase tracking-wide ${b.text}`}>{b.label}</div>
            <div className={`text-3xl font-bold mt-2 ${b.text}`}>{bucketCounts[b.key] || 0}</div>
            <div className="text-xs text-gray-500 mt-1">counseled leads</div>
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
              <Bar key={b.key} dataKey={b.key} name={b.label} stackId="pipeline" fill={b.color} radius={[3,3,0,0]} />
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
                return (
                  <>
                    <tr key={row.type}
                        className="hover:bg-gray-50 cursor-pointer select-none"
                        onClick={() => setTypeOpen(p => ({ ...p, [row.type]: !p[row.type] }))}>
                      <td className="px-4 py-3 font-semibold" style={{ color: typeColor }}>
                        <span className="text-gray-400 text-xs mr-2">{isOpen ? "▼" : "▶"}</span>
                        {row.type}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{row.total}</td>
                      {ALL_COLS.map(c => (
                        <td key={c.key} className="px-4 py-3 text-right font-semibold"
                            style={{ color: row.byCol[c.key]?.total ? c.color : "#d1d5db" }}>
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
                        <td className="px-4 py-2.5 text-right text-xs text-gray-700 font-medium">
                          {row[b.key]}
                        </td>
                        {ALL_COLS.map(c => (
                          <td key={c.key} className="px-4 py-2.5 text-right text-xs text-gray-500">
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
                <td className="px-4 py-3 text-right font-bold text-gray-900">{counseledRows.length}</td>
                {ALL_COLS.map(c => (
                  <td key={c.key} className="px-4 py-3 text-right font-semibold"
                      style={{ color: counsellorTotals[c.key] ? c.color : "#d1d5db" }}>
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

function PivotTable({ rows }) {
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

  const DataRow = ({ label, getV, bold, indent = 0 }) => (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-2.5 text-sm border-b border-gray-100"
          style={{ paddingLeft: 16 + indent * 16, fontWeight: bold ? 600 : 400, color: indent ? "#6b7280" : "#1e293b" }}>
        {label}
      </td>
      <td className="px-4 py-2.5 text-sm text-right border-b border-gray-100 font-semibold text-gray-800">
        {allS ? getV(allS) ?? "—" : "—"}
      </td>
      {ALL_COLS.map(c => (
        <td key={c.key} className="px-4 py-2.5 text-sm text-right border-b border-gray-100"
            style={{ color: byCol[c.key] ? c.color : "#d1d5db", fontWeight: bold ? 600 : 400 }}>
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
          <DataRow label="Total calls"            getV={s=>s.total}    bold />
          <tr className="hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => setOutOpen(o => !o)}>
            <td className="px-4 py-2.5 text-sm border-b border-gray-100 text-gray-800 select-none">
              <span className="text-gray-400 text-xs mr-2">{outOpen ? "▼" : "▶"}</span>
              Outgoing
            </td>
            <td className="px-4 py-2.5 text-sm text-right border-b border-gray-100 font-semibold text-gray-800">
              {allS?.outgoing ?? "—"}
            </td>
            {ALL_COLS.map(c => (
              <td key={c.key} className="px-4 py-2.5 text-sm text-right border-b border-gray-100"
                  style={{ color: byCol[c.key] ? c.color : "#d1d5db" }}>
                {byCol[c.key]?.outgoing ?? 0}
              </td>
            ))}
          </tr>
          {outOpen && OUT_SECTIONS.map(sec => (
            <tr key={sec.val} className="bg-gray-50">
              <td className="py-2 text-xs text-gray-500 border-b border-gray-100" style={{ paddingLeft: 40 }}>
                {sec.label}
              </td>
              <td className="px-4 py-2 text-xs text-right border-b border-gray-100 text-gray-600">
                {allS?.outBySec?.[sec.val] ?? 0}
              </td>
              {ALL_COLS.map(c => (
                <td key={c.key} className="px-4 py-2 text-xs text-right border-b border-gray-100 text-gray-500">
                  {byCol[c.key]?.outBySec?.[sec.val] ?? 0}
                </td>
              ))}
            </tr>
          ))}
          <DataRow label="Incoming"               getV={s=>s.incoming} />
          <DataRow label="Missed / Rejected"      getV={s=>s.missed}   />
          <DataRow label="Unique numbers dialled" getV={s=>s.unique}   />

          <SectionRow label="Connection quality" color="#22c55e" />
          <DataRow label="Connected"   getV={s=>s.connected} bold />
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
              <tbody key={stage}>
                <tr className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => hasSubStages && setStageOpen(p => ({...p,[stage]:!p[stage]}))}>
                  <td className="px-4 py-2.5 text-sm border-b border-gray-100 font-medium" style={{ color: "#1e293b" }}>
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stageColor }} />
                      {stage}
                      {hasSubStages && (
                        <span className="text-gray-400 text-xs">{isOpen ? "▲" : "▼"}</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-right border-b border-gray-100 font-semibold text-gray-800">
                    {allS?.stages[stage] ?? 0}
                  </td>
                  {ALL_COLS.map(c => (
                    <td key={c.key} className="px-4 py-2.5 text-sm text-right border-b border-gray-100"
                        style={{ color: c.color }}>
                      {byCol[c.key]?.stages[stage] ?? 0}
                    </td>
                  ))}
                </tr>
                {isOpen && subKeys.map(sub => {
                  const tot = rows.filter(r => (r.leadStage||"Unknown")===stage && r.subStage===sub).length
                  return (
                    <tr key={sub} className="bg-gray-50">
                      <td className="py-2 text-xs text-gray-500 border-b border-gray-100" style={{ paddingLeft: 40 }}>
                        {sub}
                      </td>
                      <td className="px-4 py-2 text-xs text-right border-b border-gray-100 text-gray-600">{tot}</td>
                      {ALL_COLS.map(c => {
                        const v = rows.filter(r => r.empName===c.key && (r.leadStage||"Unknown")===stage && r.subStage===sub).length
                        return <td key={c.key} className="px-4 py-2 text-xs text-right border-b border-gray-100 text-gray-500">{v||0}</td>
                      })}
                    </tr>
                  )
                })}
              </tbody>
            )
          })}

          <SectionRow label="Duration (outgoing only)" color="#8b5cf6" />
          <DataRow label="Total (mins)"                  getV={s=>s.totalDur} bold />
          <DataRow label="Avg per connected call (mins)"  getV={s=>s.avgDur}  />
        </tbody>
      </table>
      <p className="text-xs text-gray-400 mt-3 px-4">Substage data from Lead Dump joined by phone number.</p>
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

function Detail({ date, setDate, allRows, pipelineRows, pipelineChanges, initialSubTab = "charts", onBack }) {
  const [mainTab, setMainTab] = useState("overall")
  const [section, setSection] = useState("all")
  const [source,  setSource]  = useState("all")
  const [subTab,  setSubTab]  = useState(initialSubTab)

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
        {[["charts","📊 Charts"], ["table","📋 Pivot Table"], ["pipeline","🎯 Pipeline"], ["ai","✦ AI Insights"]].map(([k,l]) => (
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
              <StageBarChart rows={visibleRows} />
              <SourceBarChart rows={visibleRows} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CallTypeDonut rows={visibleRows} />
              <ConnectedBySection rows={visibleRows} />
            </div>
          </>
        )}
        {subTab === "table" && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">Pivot Table</div>
              <InfoBadge text="Rows = metrics (volume, connection quality, stage breakdown, duration). Columns = Total + each counsellor. Click 'Outgoing' to expand by section. Click a stage row to expand substages." />
            </div>
            <PivotTable rows={visibleRows} />
          </div>
        )}
        {subTab === "pipeline" && (
          <PipelineSection pipelineRows={visiblePipelineRows} pipelineChanges={pipelineChanges} callRows={visibleRows} date={date} />
        )}
        {subTab === "ai" && (
          <AIInsightsPanel rows={visibleRows} counsellorName={counsellorNameForAI} dateStr={date} />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminInsights() {
  const [view,    setView]    = useState("overview")
  const [date,    setDate]    = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  })
  const [allRows, setAllRows] = useState([])
  const [pipelineRows, setPipelineRows] = useState([])
  const [pipelineChanges, setPipelineChanges] = useState({
    hasBaseline: false,
    gainedCounseled: [],
    lostCounseled: [],
    stageChanges: [],
    subStageChanges: [],
    netCounseled: 0,
  })
  const [detailSubTab, setDetailSubTab] = useState("charts")
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError("")
      try {
        const { fetchSheetData } = await import('../utils/sheetsApi')
        const [callsRaw, leadRaw, followupLeadRaw, appRaw, appFollowupRaw] = await Promise.all([
          fetchSheetData('Calls History', 'A:V'),
          fetchSheetData('Lead Dump', 'A:BW'),
          fetchSheetData('Followup Sheet - LEAD', 'A:BW'),
          fetchSheetData('App Start Dump', 'A:EU'),
          fetchSheetData('Followup sheet - App start', 'A:EU'),
        ])
        const { subStageMap, notesMap } = buildLeadMaps(leadRaw, appRaw)
        const rows = parseCallsHistory(callsRaw, new Date(date), subStageMap, notesMap)
        const pipeline = buildPipelineRows(leadRaw, followupLeadRaw, appRaw, appFollowupRaw)
        const activePipeline = pipeline.filter(row => !isPaymentCompleted(row.paymentStatus))
        const snapshotKey = "aias_admin_pipeline_snapshot_v1"
        let previous = null
        try {
          previous = JSON.parse(localStorage.getItem(snapshotKey) || "null")
        } catch {
          previous = null
        }
        const changes = comparePipelineSnapshots(previous?.rows, activePipeline)
        try {
          localStorage.setItem(snapshotKey, JSON.stringify({
            savedAt: new Date().toISOString(),
            rows: snapshotPipeline(activePipeline),
          }))
        } catch {}

        if (!cancelled) {
          setAllRows(rows)
          setPipelineRows(pipeline)
          setPipelineChanges(changes)
        }
      } catch (e) {
        if (!cancelled) setError("Failed to load: " + e.message)
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
    <div className="m-5 bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">{error}</div>
  )

  return view === "overview"
    ? <Overview
        date={date}
        setDate={setDate}
        allRows={allRows}
        pipelineRows={pipelineRows}
        pipelineChanges={pipelineChanges}
        onDrill={() => { setDetailSubTab("charts"); setView("detail") }}
        onOpenPipeline={() => { setDetailSubTab("pipeline"); setView("detail") }}
      />
    : <Detail   date={date} setDate={setDate} allRows={allRows} pipelineRows={pipelineRows} pipelineChanges={pipelineChanges} initialSubTab={detailSubTab} onBack={() => setView("overview")} />
}
