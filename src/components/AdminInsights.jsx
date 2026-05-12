import { useState, useEffect, useMemo, useCallback, useRef } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MAIN_COUNSELLORS = [
  { key: "Jasmeet Kaur",   short: "Jasmeet" },
  { key: "Komal Pandey",   short: "Komal"   },
  { key: "Prerna Kaushik", short: "Prerna"  },
]
const ALL_COLS = [
  ...MAIN_COUNSELLORS,
  { key: "Others", short: "Others" },
]

// Calls History Col D raw values → normalized key
const NAME_MAP = {
  "Jasmeet Kaur": "Jasmeet Kaur",
  "Jasmeet":      "Jasmeet Kaur",
  "KOMAL":        "Komal Pandey",
  "Komal":        "Komal Pandey",
  "Prerna":       "Prerna Kaushik",
}

const SECTIONS = [
  { key: "all",    label: "All sections",        val: null             },
  { key: "appFU",  label: "App Start Followup",  val: "App Followup"  },
  { key: "appNew", label: "App Start New",        val: "App Start New" },
  { key: "leadFU", label: "Followup Leads",       val: "Followup Lead" },
  { key: "fresh",  label: "Fresh Leads",           val: "Fresh Lead"   },
]

const STAGE_ORDER = [
  "Counseled", "No Contact Established", "Not interested",
  "Not Eligible", "Untouched", "Intent dropped",
]

const URGENCY = {
  today:      { label: "Today",     bg: "#fcebeb", color: "#a32d2d" },
  "this-week":{ label: "This week", bg: "#faeeda", color: "#633806" },
  low:        { label: "Low",       bg: "#f1efe8", color: "#444441" },
}

const SENTIMENT_COLOR = { positive:"#3b6d11", mixed:"#854f0b", negative:"#a32d2d" }
const SENTIMENT_BG    = { positive:"#eaf3de", mixed:"#faeeda", negative:"#fcebeb" }

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
  if (stageType === "Lead")                                   return isUntouched ? "Fresh Lead"    : "Followup Lead"
  if (stageType === "App Start" || stageType === "Paid App")  return isUntouched ? "App Start New" : "App Followup"
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

// ─────────────────────────────────────────────────────────────────────────────
// DATA LAYER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build phone → subStage lookup map from Lead Dump + App Start Dump rows.
 * Lead Dump:     Col C (idx 2) = Mobile, Col W (idx 22) = Lead Sub Stage
 * App Start Dump: Col O (idx 14) = Mobile, Col AV (idx 47) = Application Sub Stage
 */
export function buildSubStageMap(leadDumpRows = [], appStartRows = []) {
  const map = {}
  leadDumpRows.slice(1).forEach(row => {
    const p = phone10(row[2])
    const s = (row[22] || "").trim()
    if (p && s) map[p] = s
  })
  appStartRows.slice(1).forEach(row => {
    const p = phone10(row[14])
    const s = (row[47] || "").trim()
    if (p && s && !map[p]) map[p] = s
  })
  return map
}

/**
 * Parse Calls History raw rows into call objects.
 * Calls History columns used:
 *   D=3  Employee Name       H=7  To Number      I=8  Call Type
 *   K=10 Call Date           M=12 Notes          O=14 Audio URL
 *   P=15 Stage (Lead/App)    T=19 Source         U=20 Lead/App Stage
 *   V=21 Call Duration Mins
 */
export function parseCallsHistory(rawRows, targetDate, subStageMap = {}) {
  const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate
  return rawRows.slice(1).map(row => {
    const p = phone10(row[7])
    return {
      empName:     normalizeName(row[3]),
      toNumber:    p,
      callType:    (row[8]  || "").trim(),
      callDate:    row[10],
      notes:       (row[12] || "").trim(),
      audioUrl:    row[14] || "",
      stageType:   (row[15] || "").trim(),
      source:      (row[19] || "").trim(),
      leadStage:   (row[20] || "").trim(),
      durationMins: parseFloat(row[21]) || 0,
      subStage:    subStageMap[p] || "",
    }
  })
  .filter(r => r.empName !== null)
  .filter(r => { const d = parseDate(r.callDate); return d && sameDay(d, target) })
  .map(r => ({ ...r, section: inferSection(r.stageType, r.leadStage) }))
}

/** Compute pivot stats from a set of call rows */
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

  const notesBlock = notesRows.map((r, i) =>
    `Call ${i + 1} (${r.section}, Source: ${r.source || "unknown"}, Stage: ${r.leadStage || "unknown"}, ` +
    `Type: ${r.callType}, Duration: ${r.durationMins ? r.durationMins.toFixed(1) + "m" : "N/A"}): "${r.notes}"`
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
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!response.ok) throw new Error(`API ${response.status}: ${response.statusText}`)
  const data = await response.json()
  const text = data.content.map(b => b.text || "").join("")
  return JSON.parse(text.replace(/```json|```/g, "").trim())
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED STYLES
// ─────────────────────────────────────────────────────────────────────────────

const ss = {
  sel: {
    border: "0.5px solid var(--color-border-secondary)", borderRadius: 6, padding: "5px 8px",
    fontSize: 12, background: "var(--color-background-primary)",
    color: "var(--color-text-primary)", fontFamily: "var(--font-sans)",
  },
  tabBtn: (a) => ({
    padding: "8px 14px", border: "none", background: "none", cursor: "pointer",
    fontSize: 13, color: a ? "var(--color-text-primary)" : "var(--color-text-secondary)",
    borderBottom: a ? "2px solid var(--color-text-primary)" : "2px solid transparent",
    fontWeight: a ? 500 : 400, fontFamily: "var(--font-sans)", whiteSpace: "nowrap",
  }),
  stBtn: (a) => ({
    padding: "5px 10px", border: "0.5px solid",
    borderColor: a ? "var(--color-border-secondary)" : "var(--color-border-tertiary)",
    borderRadius: 6, fontSize: 12,
    background: a ? "var(--color-background-secondary)" : "none",
    cursor: "pointer", color: a ? "var(--color-text-primary)" : "var(--color-text-secondary)",
    fontFamily: "var(--font-sans)",
  }),
  card: {
    border: "0.5px solid var(--color-border-tertiary)",
    borderRadius: 12, padding: 14,
  },
  badge: (bg, color) => ({
    background: bg, color, fontSize: 11, fontWeight: 500,
    padding: "2px 8px", borderRadius: 20, display: "inline-block",
  }),
}

// ─────────────────────────────────────────────────────────────────────────────
// PIVOT TABLE
// ─────────────────────────────────────────────────────────────────────────────

function PivotTable({ rows }) {
  const [stageOpen, setStageOpen] = useState({})

  const allS = computeStats(rows)
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
    <div style={{ textAlign:"center", padding:40, color:"var(--color-text-secondary)", fontSize:13 }}>
      No calls for the selected filters.
    </div>
  )

  const TH = ({ children, left }) => (
    <th style={{
      padding:"9px 12px", fontSize:11, fontWeight:500,
      color:"var(--color-text-secondary)", background:"var(--color-background-secondary)",
      borderBottom:"0.5px solid var(--color-border-secondary)",
      borderRight:"0.5px solid var(--color-border-tertiary)",
      textAlign: left ? "left" : "right", whiteSpace:"nowrap",
    }}>{children}</th>
  )

  const TD = ({ val, bold, dim, indent=0, bg }) => (
    <td style={{
      padding:"7px 12px", paddingLeft: 12 + indent*14, fontSize:12,
      fontWeight: bold ? 500 : 400,
      color: dim || val === 0 ? "var(--color-text-tertiary)" : "var(--color-text-primary)",
      borderBottom:"0.5px solid var(--color-border-tertiary)",
      borderRight:"0.5px solid var(--color-border-tertiary)",
      background: bg || "transparent",
    }}>{val ?? "—"}</td>
  )

  const TDN = ({ val, bold, bg }) => (
    <td style={{
      padding:"7px 12px", textAlign:"right", fontSize:12,
      fontWeight: bold ? 500 : 400,
      color: (!val && val !== 0) || val === 0 ? "var(--color-text-tertiary)" : "var(--color-text-primary)",
      borderBottom:"0.5px solid var(--color-border-tertiary)",
      borderRight:"0.5px solid var(--color-border-tertiary)",
      background: bg || "transparent",
    }}>{val ?? "—"}</td>
  )

  const DivRow = ({ label, color }) => (
    <tr>
      <td colSpan={6} style={{
        padding:"5px 12px", fontSize:11, fontWeight:500, color,
        background: color + "14",
        borderTop:"0.5px solid var(--color-border-tertiary)",
        borderBottom:"0.5px solid var(--color-border-tertiary)",
        letterSpacing:".3px",
      }}>{label}</td>
    </tr>
  )

  const Row = ({ label, getV, bold, dim, indent=0 }) => (
    <tr>
      <TD val={label} bold={bold} dim={dim} indent={indent} />
      <TDN val={allS ? getV(allS) : null} bold={bold} />
      {ALL_COLS.map(c => <TDN key={c.key} val={byCol[c.key] ? getV(byCol[c.key]) : 0} bold={bold} />)}
    </tr>
  )

  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", minWidth:580 }}>
        <thead>
          <tr>
            <TH left>Metric</TH>
            <TH>Total</TH>
            {ALL_COLS.map(c => <TH key={c.key}>{c.short}</TH>)}
          </tr>
        </thead>
        <tbody>
          <DivRow label="Volume" color="#185fa5" />
          <Row label="Total calls"         getV={s=>s.total}    bold />
          <Row label="Outgoing"             getV={s=>s.outgoing} />
          <Row label="Incoming"             getV={s=>s.incoming} />
          <Row label="Missed / Rejected"    getV={s=>s.missed}   />
          <Row label="Unique numbers dialled" getV={s=>s.unique} />

          <DivRow label="Connection quality" color="#0f6e56" />
          <Row label="Connected"            getV={s=>s.connected} bold />
          <Row label="Connected %"          getV={s=>s.connPct !== null ? s.connPct+"%" : "—"} />

          <DivRow label="Stage breakdown (click to expand substages)" color="#854f0b" />
          {allStages.map(stage => {
            const isOpen = stageOpen[stage]
            const bg = isOpen ? "var(--color-background-secondary)" : "transparent"

            // Collect all substages for this stage across all rows
            const subMap = {}
            rows.filter(r => (r.leadStage || "Unknown") === stage && r.subStage).forEach(r => {
              subMap[r.subStage] = (subMap[r.subStage] || 0) + 1
            })
            const subKeys = Object.entries(subMap).sort((a,b)=>b[1]-a[1]).map(([k])=>k)
            const hasSubStages = subKeys.length > 0

            return (
              <tbody key={stage}>
                <tr style={{ cursor: hasSubStages ? "pointer" : "default" }}
                    onClick={() => hasSubStages && setStageOpen(p => ({...p,[stage]:!p[stage]}))}>
                  <td style={{
                    padding:"7px 12px", fontSize:12, fontWeight:500,
                    color:"var(--color-text-primary)", background:bg,
                    borderBottom:"0.5px solid var(--color-border-tertiary)",
                    borderRight:"0.5px solid var(--color-border-tertiary)",
                    userSelect:"none",
                  }}>
                    {hasSubStages && (
                      <span style={{ fontSize:9, marginRight:7, opacity:.55 }}>
                        {isOpen ? "▼" : "▶"}
                      </span>
                    )}
                    {stage}
                    {!hasSubStages && (
                      <span style={{ fontSize:10, color:"var(--color-text-tertiary)", marginLeft:6 }}>
                        (no substage data)
                      </span>
                    )}
                  </td>
                  <TDN val={allS?.stages[stage] ?? 0} bold bg={bg} />
                  {ALL_COLS.map(c => (
                    <TDN key={c.key} val={byCol[c.key]?.stages[stage] ?? 0} bg={bg} />
                  ))}
                </tr>

                {isOpen && subKeys.map(sub => {
                  const totSub = rows.filter(r =>
                    (r.leadStage||"Unknown")===stage && r.subStage===sub
                  ).length
                  return (
                    <tr key={sub} style={{ background:"var(--color-background-secondary)" }}>
                      <TD val={sub} dim indent={2}
                          bg="var(--color-background-secondary)" />
                      <TDN val={totSub} bg="var(--color-background-secondary)" />
                      {ALL_COLS.map(c => {
                        const v = rows.filter(r =>
                          r.empName===c.key &&
                          (r.leadStage||"Unknown")===stage &&
                          r.subStage===sub
                        ).length
                        return <TDN key={c.key} val={v||0}
                                    bg="var(--color-background-secondary)" />
                      })}
                    </tr>
                  )
                })}
              </tbody>
            )
          })}

          <DivRow label="Duration (outgoing calls only)" color="#533ab7" />
          <Row label="Total (mins)"                  getV={s=>s.totalDur} bold />
          <Row label="Avg per connected call (mins)"  getV={s=>s.avgDur}  />
        </tbody>
      </table>
      <p style={{ fontSize:11, color:"var(--color-text-tertiary)", marginTop:8 }}>
        Substage data from Lead Dump Col W joined by phone number. "Others" = Leena, AMANDEEP KAUR, etc.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AI INSIGHTS PANEL
// ─────────────────────────────────────────────────────────────────────────────

function AIInsightsPanel({ rows, counsellorName, dateStr }) {
  const [status, setStatus]   = useState("idle")  // idle | loading | done | error | no-notes
  const [insights, setInsights] = useState(null)
  const [errMsg,  setErrMsg]  = useState("")
  const cacheRef = useRef({})

  const notesRows = useMemo(() =>
    rows.filter(r => r.notes && r.notes.trim().length > 5), [rows])

  const cacheKey = `${counsellorName}__${dateStr}`

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
      setErrMsg(e.message)
      setStatus("error")
    }
  }, [notesRows, cacheKey, counsellorName, dateStr])

  // No notes state
  if (status === "idle" && notesRows.length === 0) return (
    <div style={{...ss.card, textAlign:"center", padding:32, color:"var(--color-text-secondary)"}}>
      <div style={{fontSize:15, marginBottom:8}}>No call notes on this date</div>
      <div style={{fontSize:12}}>
        {rows.length} calls found but no notes (Col M in Calls History). 
        Encourage counsellors to add notes during calls.
      </div>
    </div>
  )

  // Idle — show launch button
  if (status === "idle") return (
    <div style={{...ss.card, textAlign:"center", padding:32}}>
      <div style={{fontSize:14, color:"var(--color-text-primary)", marginBottom:6}}>
        AI Insights ready
      </div>
      <div style={{fontSize:12, color:"var(--color-text-secondary)", marginBottom:16}}>
        {notesRows.length} calls with notes · Claude will analyze themes, objections,
        interest levels & follow-up flags
      </div>
      <button onClick={run} style={{
        background:"var(--color-text-primary)", color:"var(--color-background-primary)",
        border:"none", borderRadius:8, padding:"9px 22px", fontSize:13,
        fontFamily:"var(--font-sans)", cursor:"pointer", fontWeight:500,
      }}>
        ✦ Analyse with Claude
      </button>
    </div>
  )

  if (status === "loading") return (
    <div style={{...ss.card, textAlign:"center", padding:40, color:"var(--color-text-secondary)"}}>
      <div style={{fontSize:13}}>Analyzing {notesRows.length} call notes…</div>
      <div style={{fontSize:11, marginTop:6, color:"var(--color-text-tertiary)"}}>
        Claude is reading themes, objections and classifying each lead
      </div>
    </div>
  )

  if (status === "error") return (
    <div style={{...ss.card, padding:20, borderColor:"#ffa39e"}}>
      <div style={{color:"#a32d2d", fontSize:13, marginBottom:8}}>AI call failed: {errMsg}</div>
      <button onClick={run} style={{...ss.stBtn(false), cursor:"pointer"}}>Retry</button>
    </div>
  )

  if (status === "no-notes") return (
    <div style={{...ss.card, textAlign:"center", padding:32, color:"var(--color-text-secondary)"}}>
      <div style={{fontSize:13}}>No notes found — AI insights unavailable for this selection.</div>
    </div>
  )

  // ── DONE — render insights ──
  const { topThemes, topObjections, objectionsBySource,
          overallSentiment, sentimentReason,
          leadClassifications, followupFlags } = insights

  const classified = {
    hot:  (leadClassifications||[]).filter(l=>l.interest==="hot"),
    warm: (leadClassifications||[]).filter(l=>l.interest==="warm"),
    cold: (leadClassifications||[]).filter(l=>l.interest==="cold"),
  }

  const LeadCard = ({ cl }) => {
    const row = notesRows[cl.callIndex - 1]
    return (
      <div style={{ background:"var(--color-background-secondary)", borderRadius:6, padding:"7px 10px", marginBottom:5 }}>
        <div style={{ fontSize:12, fontWeight:500 }}>{row?.source || `Call ${cl.callIndex}`}</div>
        <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:2 }}>{cl.reason}</div>
        {row?.notes && (
          <div style={{ fontSize:10, color:"var(--color-text-tertiary)", marginTop:3, fontStyle:"italic" }}>
            "{row.notes.slice(0, 80)}{row.notes.length > 80 ? "…" : ""}"
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

      {/* Sentiment + summary */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:12 }}>
        <div style={{...ss.card, display:"flex", flexDirection:"column", gap:8 }}>
          <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>Overall sentiment</div>
          <div style={{
            ...ss.badge(SENTIMENT_BG[overallSentiment], SENTIMENT_COLOR[overallSentiment]),
            fontSize:13, padding:"4px 12px",
          }}>
            {overallSentiment}
          </div>
          <div style={{ fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.5 }}>
            {sentimentReason}
          </div>
        </div>
        <div style={{...ss.card}}>
          <div style={{ fontSize:12, fontWeight:500, marginBottom:8 }}>Top themes in notes</div>
          {(topThemes||[]).map(({ theme, count, example }) => (
            <div key={theme} style={{
              display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"5px 0", borderBottom:"0.5px solid var(--color-border-tertiary)",
            }}>
              <div>
                <div style={{ fontSize:12 }}>{theme}</div>
                {example && <div style={{ fontSize:10, color:"var(--color-text-tertiary)", marginTop:1, fontStyle:"italic" }}>
                  "{example}"
                </div>}
              </div>
              <div style={{ ...ss.badge("var(--color-background-secondary)","var(--color-text-secondary)"),
                            minWidth:24, textAlign:"center" }}>
                {count}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Objections */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <div style={{...ss.card}}>
          <div style={{ fontSize:12, fontWeight:500, marginBottom:8 }}>Objections & how handled</div>
          {(topObjections||[]).map(({ objection, count, howHandled }) => (
            <div key={objection} style={{ borderLeft:"2px solid #f09595", paddingLeft:10, marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:12, fontWeight:500 }}>"{objection}"</span>
                <span style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{count}×</span>
              </div>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:2 }}>→ {howHandled}</div>
            </div>
          ))}
        </div>
        <div style={{...ss.card}}>
          <div style={{ fontSize:12, fontWeight:500, marginBottom:8 }}>Objections by source</div>
          {(objectionsBySource||[]).map(({ source, topObjection, count }) => (
            <div key={source} style={{
              display:"flex", justifyContent:"space-between", alignItems:"flex-start",
              padding:"5px 0", borderBottom:"0.5px solid var(--color-border-tertiary)",
            }}>
              <div>
                <div style={{ fontSize:12, fontWeight:500 }}>{source}</div>
                <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:1 }}>{topObjection}</div>
              </div>
              <span style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{count}×</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hot / Warm / Cold */}
      <div>
        <div style={{ fontSize:12, fontWeight:500, marginBottom:8 }}>Lead interest classification</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
          {[
            { label:"Hot",  leads: classified.hot,  bc:"#fac775", bg:"#faeeda", tc:"#633806" },
            { label:"Warm", leads: classified.warm, bc:"#85b7eb", bg:"#e6f1fb", tc:"#0c447c" },
            { label:"Cold", leads: classified.cold, bc:"#B4B2A9", bg:"#f1efe8", tc:"#444441" },
          ].map(({ label, leads, bc, bg, tc }) => (
            <div key={label} style={{ border:`1.5px solid ${bc}`, borderRadius:8, padding:10 }}>
              <div style={{ ...ss.badge(bg, tc), marginBottom:8 }}>
                {label} — {leads.length}
              </div>
              {leads.length > 0
                ? leads.map(cl => <LeadCard key={cl.callIndex} cl={cl} />)
                : <div style={{ fontSize:11, color:"var(--color-text-tertiary)" }}>None</div>
              }
            </div>
          ))}
        </div>
      </div>

      {/* Follow-up flags */}
      {(followupFlags||[]).length > 0 && (
        <div style={{...ss.card}}>
          <div style={{ fontSize:12, fontWeight:500, marginBottom:10 }}>Follow-up flags</div>
          {[...followupFlags]
            .sort((a,b) => ["today","this-week","low"].indexOf(a.urgency) - ["today","this-week","low"].indexOf(b.urgency))
            .map((f, i) => {
              const u = URGENCY[f.urgency] || URGENCY.low
              const row = notesRows[f.callIndex - 1]
              return (
                <div key={i} style={{
                  display:"flex", alignItems:"flex-start", gap:10,
                  padding:"8px 0", borderBottom:"0.5px solid var(--color-border-tertiary)",
                }}>
                  <span style={{ ...ss.badge(u.bg, u.color), whiteSpace:"nowrap", flexShrink:0 }}>
                    {u.label}
                  </span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, fontWeight:500 }}>
                      {row?.source || `Call ${f.callIndex}`}
                    </div>
                    <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:2 }}>{f.action}</div>
                    <div style={{ fontSize:10, color:"var(--color-text-tertiary)", marginTop:3, fontStyle:"italic" }}>
                      "{f.signal}"
                    </div>
                  </div>
                  <span style={{
                    border:"0.5px solid var(--color-border-tertiary)",
                    borderRadius:20, fontSize:10, padding:"2px 7px",
                    color:"var(--color-text-secondary)", flexShrink:0,
                  }}>{row?.section || ""}</span>
                </div>
              )
            })
          }
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
    <div style={{ padding:20, fontFamily:"var(--font-sans)", color:"var(--color-text-primary)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
        <div>
          <div style={{ fontSize:11, color:"var(--color-text-tertiary)", letterSpacing:".5px", marginBottom:2 }}>
            ADMIN · INSIGHTS
          </div>
          <div style={{ fontSize:18, fontWeight:500 }}>Daily summary</div>
        </div>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={ss.sel} />
      </div>

      {s ? (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10, marginBottom:16 }}>
            {[
              ["Total calls",    s.total,         "all counsellors",    ""],
              ["Connected",      `${s.connected} (${s.connPct??0}%)`, "of outgoing",
               s.connPct>=40?"#3b6d11":s.connPct>=20?"#854f0b":"#a32d2d"],
              ["Total duration", `${s.totalDur} min`, "outgoing calls", ""],
              ["Avg / call",     `${s.avgDur} min`,   "connected only", ""],
            ].map(([l,v,sub,c])=>(
              <div key={l} style={{ background:"var(--color-background-secondary)", borderRadius:8, padding:"12px 14px" }}>
                <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:4 }}>{l}</div>
                <div style={{ fontSize:22, fontWeight:500, color:c||"var(--color-text-primary)" }}>{v}</div>
                <div style={{ fontSize:11, color:"var(--color-text-tertiary)", marginTop:2 }}>{sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10, marginBottom:16 }}>
            {ALL_COLS.map(c => {
              const cs = computeStats(allRows.filter(r=>r.empName===c.key))
              return (
                <div key={c.key} style={{...ss.card}}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <span style={{ fontWeight:500, fontSize:13 }}>{c.short}</span>
                    {cs
                      ? <span style={{...ss.badge("#eaf3de","#27500a")}}>{cs.outgoing} out</span>
                      : <span style={{ fontSize:11, color:"var(--color-text-tertiary)" }}>no calls</span>
                    }
                  </div>
                  {cs ? (
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4, fontSize:11 }}>
                      {[
                        ["Connected",`${cs.connected} (${cs.connPct??0}%)`],
                        ["Duration",`${cs.totalDur}m`],
                        ["Avg",`${cs.avgDur}m`],
                        ["Missed",cs.missed],
                      ].map(([l,v])=>(
                        <>
                          <div style={{color:"var(--color-text-secondary)"}}>{l}</div>
                          <div style={{textAlign:"right",fontWeight:500}}>{v}</div>
                        </>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize:11, color:"var(--color-text-tertiary)" }}>No data for {date}</div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <div style={{ textAlign:"center", padding:48, color:"var(--color-text-secondary)", fontSize:13 }}>
          No calls found on {date}. Try a different date.
        </div>
      )}

      <div style={{ display:"flex", justifyContent:"center" }}>
        <button onClick={onDrill} style={{
          background:"var(--color-text-primary)", color:"var(--color-background-primary)",
          border:"none", borderRadius:8, padding:"10px 28px", fontSize:14,
          fontFamily:"var(--font-sans)", cursor:"pointer", fontWeight:500,
        }}>
          View detailed analysis →
        </button>
      </div>
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
  const [subTab,  setSubTab]  = useState("table")

  const filtered = useMemo(() => {
    const secVal = SECTIONS.find(s=>s.key===section)?.val
    return allRows
      .filter(r => !secVal || r.section === secVal)
      .filter(r => source === "all" || r.source === source)
  }, [allRows, section, source])

  const visibleRows = mainTab === "overall"
    ? filtered
    : filtered.filter(r => r.empName === mainTab)

  const vs = computeStats(visibleRows)

  const sources = useMemo(() => {
    const s = new Set(allRows.map(r=>r.source).filter(Boolean))
    return [...Array.from(s).sort()]
  }, [allRows])

  const counsellorNameForAI = mainTab === "overall"
    ? "All counsellors"
    : mainTab

  return (
    <div style={{ fontFamily:"var(--font-sans)", color:"var(--color-text-primary)" }}>
      {/* header */}
      <div style={{
        padding:"10px 16px", borderBottom:"0.5px solid var(--color-border-tertiary)",
        display:"flex", justifyContent:"space-between", alignItems:"center",
        background:"var(--color-background-primary)", flexWrap:"wrap", gap:8,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={onBack} style={{
            background:"none", border:"none", cursor:"pointer",
            fontSize:13, color:"var(--color-text-secondary)", fontFamily:"var(--font-sans)",
          }}>← Overview</button>
          <span style={{ color:"var(--color-border-secondary)" }}>|</span>
          <span style={{ fontWeight:500, fontSize:13 }}>Insights — {date}</span>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={ss.sel} />
          <select value={section} onChange={e=>setSection(e.target.value)} style={ss.sel}>
            {SECTIONS.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select value={source} onChange={e=>setSource(e.target.value)} style={ss.sel}>
            <option value="all">All sources</option>
            {sources.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* counsellor tabs */}
      <div style={{
        borderBottom:"0.5px solid var(--color-border-tertiary)",
        padding:"0 16px", display:"flex", overflowX:"auto",
      }}>
        {[["overall","Overall"],...ALL_COLS.map(c=>[c.key,c.short])].map(([k,l])=>(
          <button key={k} onClick={()=>{setMainTab(k);setSubTab("table")}}
                  style={ss.tabBtn(mainTab===k)}>{l}</button>
        ))}
      </div>

      {/* summary banner */}
      {vs && (
        <div style={{
          padding:"7px 16px", background:"var(--color-background-secondary)",
          borderBottom:"0.5px solid var(--color-border-tertiary)",
          display:"flex", gap:14, flexWrap:"wrap", fontSize:12, alignItems:"center",
        }}>
          <span><strong>{vs.outgoing}</strong> outgoing</span>
          <span style={{color:"var(--color-border-secondary)"}}>·</span>
          <span>
            <strong>{vs.connected}</strong> connected
            <span style={{color:"var(--color-text-tertiary)"}}> ({vs.connPct??0}%)</span>
          </span>
          <span style={{color:"var(--color-border-secondary)"}}>·</span>
          <span><strong>{vs.totalDur}</strong> min total</span>
          <span style={{color:"var(--color-border-secondary)"}}>·</span>
          <span>avg <strong>{vs.avgDur}</strong> min/call</span>
          <span style={{color:"var(--color-border-secondary)"}}>·</span>
          <span><strong>{vs.unique}</strong> unique numbers</span>
        </div>
      )}

      {/* sub-tabs */}
      <div style={{
        padding:"10px 16px", display:"flex", gap:6, flexWrap:"wrap",
        borderBottom:"0.5px solid var(--color-border-tertiary)",
      }}>
        {[["table","Pivot table"],["ai","✦ AI insights"]].map(([k,l])=>(
          <button key={k} onClick={()=>setSubTab(k)} style={ss.stBtn(subTab===k)}>{l}</button>
        ))}
      </div>

      <div style={{ padding:16 }}>
        {subTab === "table" && <PivotTable rows={visibleRows} />}
        {subTab === "ai" && (
          <AIInsightsPanel
            rows={visibleRows}
            counsellorName={counsellorNameForAI}
            dateStr={date}
          />
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
    return d.toISOString().slice(0,10)
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
          fetchSheetData('Lead Dump',     'A:W'),
          fetchSheetData('App Start Dump','A:AV'),
        ])
        const subMap = buildSubStageMap(leadRaw, appRaw)
        const rows   = parseCallsHistory(callsRaw, new Date(date), subMap)
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
    <div style={{ padding:48, textAlign:"center", color:"var(--color-text-secondary)",
                  fontFamily:"var(--font-sans)", fontSize:13 }}>
      Loading calls for {date}…
    </div>
  )
  if (error) return (
    <div style={{ padding:20, color:"#a32d2d", fontFamily:"var(--font-sans)", fontSize:13 }}>{error}</div>
  )

  return view === "overview"
    ? <Overview date={date} setDate={setDate} allRows={allRows} onDrill={()=>setView("detail")} />
    : <Detail   date={date} setDate={setDate} allRows={allRows} onBack={()=>setView("overview")} />
}
