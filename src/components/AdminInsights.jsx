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
  const t = (raw || "").trim()
  if (!t) return null
  return NAME_MAP[t] || "Others"
}

function inferSection(stageType, leadStage) {
  const isUntouched = (leadStage || "").trim() === "Untouched"
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

function colMeta(key) {
  return ALL_COLS.find(c => c.key === key) || { color: "#94a3b8", bg: "#f8fafc", short: key }
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
    const sub  = (row[22] || "").trim()
    const note = (row[33] || "").trim()
    if (sub)  subStageMap[p] = sub
    if (note) notesMap[p]    = note
  })

  appStartRows.slice(1).forEach(row => {
    const p = phone10(row[14])
    if (!p) return
    const sub  = (row[47] || "").trim()
    const note = (row[64] || "").trim()
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
      callType:     (row[8]  || "").trim(),
      callDate:     row[10],
      // Notes from Lead Dump / App Start Dump (joined by phone) — CRM notes written
      // by the counsellor on the lead record, not the brief call-log note in col M.
      notes:        notesMap[p] || (row[12] || "").trim(),
      audioUrl:     row[14] || "",
      stageType:    (row[15] || "").trim(),
      source:       (row[19] || "").trim(),
      leadStage:    (row[20] || "").trim(),
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
  const stages = {}, subStages = {}
  rows.forEach(r => {
    const st = r.leadStage || "Unknown"
    stages[st] = (stages[st] || 0) + 1
    if (r.subStage) {
      if (!subStages[st]) subStages[st] = {}
      subStages[st][r.subStage] = (subStages[st][r.subStage] || 0) + 1
    }
  })
  return {
    total: rows.length, outgoing: out.length, incoming: inc.length,
    missed: miss.length, unique: uniq, connected: conn.length,
    connPct: out.length ? Math.round(conn.length / out.length * 100) : null,
    totalDur: r2(dur), avgDur: r2(conn.length ? dur / conn.length : 0),
    stages, subStages,
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

Return ONLY a valid JSON object with EXACTLY this structure — no preamble, no markdown fences:
{
  "topThemes": [
    { "theme": "max 6 words", "count": 0, "example": "short quote" }
  ],
  "topObjections": [
    { "objection": "short phrase", "count": 0, "howHandled": "one sentence" }
  ],
  "objectionsBySource": [
    { "source": "name", "topObjection": "short phrase", "count": 0 }
  ],
  "overallSentiment": "positive",
  "sentimentReason": "1–2 sentence summary",
  "leadClassifications": [
    { "callIndex": 1, "interest": "hot", "reason": "one sentence" }
  ],
  "followupFlags": [
    { "callIndex": 1, "action": "what to do", "urgency": "today", "signal": "exact phrase from notes" }
  ]
}

interest values: "hot" | "warm" | "cold"
urgency values: "today" | "this-week" | "low"
hot = clear interest, asked about fees/dates/next steps
warm = some interest but hesitations or needs more time
cold = disinterested, not reachable, or irrelevant profile`

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
  const text = raw.replace(/```json|```/g, "").trim()
  try {
    return JSON.parse(text)
  } catch {
    // Strip control characters and retry
    const fixed = text.replace(/[\x00-\x1f]/g, " ")
    return JSON.parse(fixed)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

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
      <div className="text-sm font-semibold text-gray-800 mb-4">Calls by Counsellor</div>
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
      <div className="text-sm font-semibold text-gray-800 mb-2">Call Type Breakdown</div>
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
      <div className="text-sm font-semibold text-gray-800 mb-4">Stage Breakdown</div>
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
      <div className="text-sm font-semibold text-gray-800 mb-4">Calls by Source</div>
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
      <div className="text-sm font-semibold text-gray-800 mb-4">Connected by Section</div>
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
// PIVOT TABLE
// ─────────────────────────────────────────────────────────────────────────────

function PivotTable({ rows }) {
  const [stageOpen, setStageOpen] = useState({})

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
      <td colSpan={6} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider"
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
          <DataRow label="Outgoing"               getV={s=>s.outgoing} />
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

  const notesRows = useMemo(() => rows.filter(r => r.notes && r.notes.trim().length > 5), [rows])
  const cacheKey  = `${counsellorName}__${dateStr}`

  const run = useCallback(async () => {
    if (notesRows.length === 0) { setStatus("no-notes"); return }
    if (cacheRef.current[cacheKey]) {
      setInsights(cacheRef.current[cacheKey]); setStatus("done"); return
    }
    setStatus("loading")
    try {
      const result = await fetchAIInsights(notesRows, counsellorName, dateStr)
      if (!result) throw new Error("Empty response from AI")
      cacheRef.current[cacheKey] = result
      setInsights(result)
      setStatus("done")
    } catch (e) {
      setErrMsg(e.message); setStatus("error")
    }
  }, [notesRows, cacheKey, counsellorName, dateStr])

  if (status === "idle" && notesRows.length === 0) return (
    <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
      <div className="text-3xl mb-3">📭</div>
      <div className="text-sm font-medium text-gray-700 mb-1">No call notes on this date</div>
      <div className="text-xs text-gray-400">{rows.length} calls found but none have notes (Col M in Calls History).</div>
    </div>
  )

  if (status === "idle") return (
    <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
      <div className="text-3xl mb-3">✦</div>
      <div className="text-sm font-semibold text-gray-800 mb-1">AI Insights ready</div>
      <div className="text-xs text-gray-500 mb-5">
        {notesRows.length} calls with notes · Claude will analyse themes, objections, interest levels &amp; follow-up flags
      </div>
      <button onClick={run}
              className="px-6 py-2.5 bg-gray-900 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition">
        ✦ Analyse with Claude
      </button>
    </div>
  )

  if (status === "loading") return (
    <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
      <div className="inline-block w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mb-4" />
      <div className="text-sm text-gray-600">Analysing {notesRows.length} call notes…</div>
      <div className="text-xs text-gray-400 mt-1">Claude is reading themes, objections and classifying leads</div>
    </div>
  )

  if (status === "error") return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6">
      <div className="text-sm text-red-700 font-medium mb-2">AI call failed: {errMsg}</div>
      <button onClick={run} className="text-xs text-red-600 underline">Retry</button>
    </div>
  )

  if (status === "no-notes") return (
    <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
      <div className="text-sm text-gray-500">No notes found — AI insights unavailable for this selection.</div>
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
                      <div className="text-xs text-gray-400 italic mt-0.5">"{f.signal}"</div>
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

function Overview({ date, setDate, allRows, onDrill }) {
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
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <div className="text-4xl mb-4">📭</div>
          <div className="text-gray-500">No calls found on {date}. Try a different date.</div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL VIEW
// ─────────────────────────────────────────────────────────────────────────────

function Detail({ date, setDate, allRows, onBack }) {
  const [mainTab, setMainTab] = useState("overall")
  const [section, setSection] = useState("all")
  const [source,  setSource]  = useState("all")
  const [subTab,  setSubTab]  = useState("charts")

  const filtered = useMemo(() => {
    const secVal = SECTIONS.find(s => s.key === section)?.val
    return allRows
      .filter(r => !secVal || r.section === secVal)
      .filter(r => source === "all" || r.source === source)
  }, [allRows, section, source])

  const visibleRows = mainTab === "overall"
    ? filtered
    : filtered.filter(r => r.empName === mainTab)

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
        {[["charts","📊 Charts"], ["table","📋 Pivot Table"], ["ai","✦ AI Insights"]].map(([k,l]) => (
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
            <PivotTable rows={visibleRows} />
          </div>
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
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError("")
      try {
        const { fetchSheetData } = await import('../utils/sheetsApi')
        const [callsRaw, leadRaw, appRaw] = await Promise.all([
          fetchSheetData('Calls History', 'A:V'),
          fetchSheetData('Lead Dump',     'A:AH'),  // col AH (idx 33) = Notes
          fetchSheetData('App Start Dump','A:BM'),  // col BM (idx 64) = Notes
        ])
        const { subStageMap, notesMap } = buildLeadMaps(leadRaw, appRaw)
        const rows = parseCallsHistory(callsRaw, new Date(date), subStageMap, notesMap)
        if (!cancelled) setAllRows(rows)
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
    ? <Overview date={date} setDate={setDate} allRows={allRows} onDrill={() => setView("detail")} />
    : <Detail   date={date} setDate={setDate} allRows={allRows} onBack={() => setView("overview")} />
}
