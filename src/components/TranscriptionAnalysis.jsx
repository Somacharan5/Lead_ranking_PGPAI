import { useState, useEffect, useMemo } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const URGENCY_STYLE = {
  today:       { bg: "#fcebeb", color: "#a32d2d", label: "Today"     },
  "this-week": { bg: "#faeeda", color: "#633806", label: "This week" },
  low:         { bg: "#f1efe8", color: "#444441", label: "Low"       },
}

const SPEED_STYLE = {
  fast:   { bg: "#eaf3de", color: "#27500a" },
  medium: { bg: "#faeeda", color: "#633806" },
  slow:   { bg: "#fcebeb", color: "#a32d2d" },
}

const CONFIDENCE_STYLE = {
  high:   { bg: "#eaf3de", color: "#27500a" },
  medium: { bg: "#faeeda", color: "#633806" },
  low:    { bg: "#f1efe8", color: "#444441" },
}

const PERSONA_COLORS = [
  { accent: "#3b6d11", bg: "#eaf3de", border: "#a8d06a" },
  { accent: "#0c447c", bg: "#e6f1fb", border: "#85b7eb" },
  { accent: "#633806", bg: "#faeeda", border: "#f09535" },
  { accent: "#533ab7", bg: "#f0edfb", border: "#b49fe8" },
  { accent: "#a32d2d", bg: "#fcebeb", border: "#f09595" },
]

const ss = {
  card: {
    border: "0.5px solid var(--color-border-tertiary)",
    borderRadius: 12, padding: 16,
    background: "var(--color-background-primary)",
  },
  tabBtn: (a) => ({
    padding: "8px 16px", border: "none", background: "none", cursor: "pointer",
    fontSize: 13, color: a ? "var(--color-text-primary)" : "var(--color-text-secondary)",
    borderBottom: a ? "2px solid var(--color-text-primary)" : "2px solid transparent",
    fontWeight: a ? 500 : 400, fontFamily: "var(--font-sans)", whiteSpace: "nowrap",
  }),
  badge: (bg, color) => ({
    background: bg, color, fontSize: 11, fontWeight: 500,
    padding: "2px 9px", borderRadius: 20, display: "inline-block",
  }),
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: "var(--color-background-secondary)", borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, color: color || "var(--color-text-primary)" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function PersonaCard({ persona, colorScheme, index }) {
  const [expanded, setExpanded] = useState(false)
  const speedStyle = SPEED_STYLE[persona.conversion_speed] || SPEED_STYLE.medium

  return (
    <div style={{
      ...ss.card,
      borderLeft: `4px solid ${colorScheme.border}`,
      background: colorScheme.bg,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: colorScheme.accent, fontWeight: 600, letterSpacing: ".5px", marginBottom: 2 }}>
            PERSONA {index}
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: colorScheme.accent }}>
            {persona.persona_name}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span style={ss.badge(speedStyle.bg, speedStyle.color)}>
            {persona.conversion_speed}
          </span>
          <span style={{
            ...ss.badge("var(--color-background-primary)", colorScheme.accent),
            border: `0.5px solid ${colorScheme.border}`,
          }}>
            {persona.customer_count || "?"} customers
          </span>
        </div>
      </div>

      {/* Description */}
      <div style={{ fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.5, marginBottom: 10 }}>
        {persona.description}
      </div>

      {/* Key stats row */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: 8, marginBottom: 10,
      }}>
        <div style={{ background: "var(--color-background-primary)", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginBottom: 3 }}>PRIMARY OBJECTION</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#a32d2d" }}>{persona.primary_objection}</div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>
            {persona.specific_objection_pattern}
          </div>
        </div>
        <div style={{ background: "var(--color-background-primary)", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginBottom: 3 }}>CONVERSION TRIGGER</div>
          <div style={{ fontSize: 12, fontWeight: 500, color: colorScheme.accent }}>
            {persona.conversion_trigger}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 2 }}>
            avg {persona.avg_calls_to_convert} calls
          </div>
        </div>
      </div>

      {/* Emotional arc */}
      {persona.emotional_arc && (
        <div style={{
          background: "var(--color-background-primary)", borderRadius: 8,
          padding: "7px 10px", marginBottom: 10, fontSize: 12,
          color: "var(--color-text-secondary)",
        }}>
          <span style={{ fontWeight: 500, color: "var(--color-text-primary)" }}>Arc: </span>
          {persona.emotional_arc}
        </div>
      )}

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 12, color: colorScheme.accent, padding: 0,
          fontFamily: "var(--font-sans)", fontWeight: 500,
        }}
      >
        {expanded ? "▲ Less" : "▼ Counsellor playbook & example"}
      </button>

      {expanded && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ background: "var(--color-background-primary)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginBottom: 5, letterSpacing: ".5px" }}>
              COUNSELLOR PLAYBOOK
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--color-text-primary)" }}>
              {persona.counsellor_playbook}
            </div>
          </div>
          {persona.do_not_do && (
            <div style={{
              background: "#fcebeb", borderRadius: 8, padding: "8px 12px",
              borderLeft: "3px solid #f09595",
            }}>
              <div style={{ fontSize: 10, color: "#a32d2d", marginBottom: 3, letterSpacing: ".5px", fontWeight: 600 }}>
                DON'T DO THIS
              </div>
              <div style={{ fontSize: 12, color: "#a32d2d", lineHeight: 1.5 }}>{persona.do_not_do}</div>
            </div>
          )}
          {persona.example_journey_summary && (
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", fontStyle: "italic", paddingLeft: 4 }}>
              Example: "{persona.example_journey_summary}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MatchRow({ match, personas }) {
  const [expanded, setExpanded] = useState(false)
  const urgency = URGENCY_STYLE[match.urgency] || URGENCY_STYLE.low
  const conf    = CONFIDENCE_STYLE[match.match_confidence] || CONFIDENCE_STYLE.low
  const persona = personas.find(p => String(p.persona_id) === String(match.matched_persona_id))
  const pColor  = persona ? PERSONA_COLORS[(Number(persona.persona_id) - 1) % PERSONA_COLORS.length] : PERSONA_COLORS[0]

  return (
    <div style={{
      borderBottom: "0.5px solid var(--color-border-tertiary)",
      padding: "10px 0",
    }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Urgency */}
        <span style={{ ...ss.badge(urgency.bg, urgency.color), flexShrink: 0, minWidth: 70, textAlign: "center" }}>
          {urgency.label}
        </span>

        {/* Name + phone */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
            {match.name || "Unknown"}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
            ...{(match.mobile || "").slice(-4)} · {match.app_stage}{match.app_sub_stage ? ` / ${match.app_sub_stage}` : ""} · {match.calls_on_record || 0} calls
          </div>
        </div>

        {/* Matched persona */}
        <div style={{
          ...ss.badge(pColor.bg, pColor.accent),
          border: `0.5px solid ${pColor.border}`,
          maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          flexShrink: 0,
        }}>
          {match.matched_persona || "?"}
        </div>

        {/* Confidence */}
        <span style={{ ...ss.badge(conf.bg, conf.color), flexShrink: 0 }}>
          {match.match_confidence || "?"}
        </span>

        <span style={{ fontSize: 10, color: "var(--color-text-tertiary)", flexShrink: 0 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, marginLeft: 80, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginBottom: 4, letterSpacing: ".5px" }}>
              WHY THIS PERSONA MATCHES
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-primary)", lineHeight: 1.5 }}>
              {match.match_reason}
            </div>
          </div>
          <div style={{
            background: "#eaf3de", borderRadius: 8, padding: "10px 12px",
            borderLeft: "3px solid #a8d06a",
          }}>
            <div style={{ fontSize: 10, color: "#27500a", marginBottom: 4, letterSpacing: ".5px", fontWeight: 600 }}>
              NEXT NUDGE
            </div>
            <div style={{ fontSize: 12, color: "var(--color-text-primary)", lineHeight: 1.6 }}>
              {match.next_nudge}
            </div>
          </div>
          {match.what_to_avoid && (
            <div style={{
              background: "#fcebeb", borderRadius: 8, padding: "8px 12px",
              borderLeft: "3px solid #f09595",
            }}>
              <div style={{ fontSize: 10, color: "#a32d2d", marginBottom: 3, letterSpacing: ".5px", fontWeight: 600 }}>
                AVOID
              </div>
              <div style={{ fontSize: 12, color: "#a32d2d" }}>{match.what_to_avoid}</div>
            </div>
          )}
          {match.predicted_outcome && (
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
              Predicted: <strong>{match.predicted_outcome}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW TAB
// ─────────────────────────────────────────────────────────────────────────────

function OverviewTab({ summary, personas, matches }) {
  const urgencyBreakdown = useMemo(() => {
    const b = { today: 0, "this-week": 0, low: 0 }
    matches.forEach(m => { if (b[m.urgency] !== undefined) b[m.urgency]++ })
    return b
  }, [matches])

  const personaDistribution = useMemo(() => {
    const b = {}
    matches.forEach(m => {
      const name = m.matched_persona || "Unknown"
      b[name] = (b[name] || 0) + 1
    })
    return Object.entries(b).sort((a, b) => b[1] - a[1])
  }, [matches])

  const total = matches.length || 1

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        <StatCard label="Recordings analyzed" value={summary.total_recordings_analyzed || "—"} sub="paid customers" />
        <StatCard label="Unique customers" value={summary.unique_paid_customers || "—"} sub="who converted" />
        <StatCard label="Avg calls to convert" value={summary.avg_calls_to_convert || "—"} sub="across all paid journeys" />
        <StatCard label="Personas found" value={summary.num_personas || "—"} sub="conversion archetypes" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Live lead urgency */}
        <div style={ss.card}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Live lead action urgency</div>
          {[
            ["today", urgencyBreakdown.today],
            ["this-week", urgencyBreakdown["this-week"]],
            ["low", urgencyBreakdown.low],
          ].map(([key, count]) => {
            const style = URGENCY_STYLE[key]
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ ...ss.badge(style.bg, style.color), minWidth: 80, textAlign: "center" }}>
                  {style.label}
                </span>
                <div style={{
                  flex: 1, height: 8, borderRadius: 4,
                  background: "var(--color-background-secondary)", overflow: "hidden",
                }}>
                  <div style={{
                    width: `${Math.round(count / total * 100)}%`,
                    height: "100%", background: style.color, borderRadius: 4,
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, minWidth: 28, textAlign: "right" }}>{count}</span>
              </div>
            )
          })}
        </div>

        {/* Persona distribution */}
        <div style={ss.card}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Live leads by matched persona</div>
          {personaDistribution.map(([name, count], i) => {
            const pColor = PERSONA_COLORS[i % PERSONA_COLORS.length]
            return (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{
                  ...ss.badge(pColor.bg, pColor.accent),
                  border: `0.5px solid ${pColor.border}`,
                  minWidth: 110, textAlign: "center",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {name}
                </span>
                <div style={{
                  flex: 1, height: 8, borderRadius: 4,
                  background: "var(--color-background-secondary)", overflow: "hidden",
                }}>
                  <div style={{
                    width: `${Math.round(count / total * 100)}%`,
                    height: "100%", background: pColor.accent, borderRadius: 4,
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, minWidth: 28, textAlign: "right" }}>{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top objection + generated info */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={ss.card}>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 4 }}>
            MOST COMMON OBJECTION BEFORE CONVERSION
          </div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{summary.top_objection_type || "—"}</div>
          <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
            These objections were overcome to achieve conversion — personas show how.
          </div>
        </div>
        <div style={ss.card}>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 4 }}>
            ANALYSIS STATUS
          </div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>
            {summary.live_leads_matched || "—"} live leads matched
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 4 }}>
            Last run: {summary.generated_at || "Unknown"}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>
            Re-run Python pipeline to refresh
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function TranscriptionAnalysis() {
  const [tab,      setTab]      = useState("overview")
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState("")
  const [summary,  setSummary]  = useState({})
  const [personas, setPersonas] = useState([])
  const [matches,  setMatches]  = useState([])

  // Matches filters
  const [urgencyFilter,  setUrgencyFilter]  = useState("all")
  const [personaFilter,  setPersonaFilter]  = useState("all")
  const [counsellorFilter, setCounsellorFilter] = useState("all")
  const [searchText, setSearchText] = useState("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError("")
      try {
        const [summaryRes, personasRes, matchesRes] = await Promise.all([
          fetch("/analysis/summary.json"),
          fetch("/analysis/personas.json"),
          fetch("/analysis/live_matches.json"),
        ])
        if (!summaryRes.ok || !personasRes.ok || !matchesRes.ok)
          throw new Error("Analysis files not found — run the Python pipeline first")

        const [summary, personas, matches] = await Promise.all([
          summaryRes.json(),
          personasRes.json(),
          matchesRes.json(),
        ])

        if (cancelled) return
        setSummary(summary)
        setPersonas(personas)
        setMatches(matches)
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      if (urgencyFilter !== "all" && m.urgency !== urgencyFilter) return false
      if (personaFilter !== "all" && m.matched_persona !== personaFilter) return false
      if (counsellorFilter !== "all" && m.counsellor !== counsellorFilter) return false
      if (searchText && !m.name?.toLowerCase().includes(searchText.toLowerCase()) &&
          !m.mobile?.includes(searchText)) return false
      return true
    }).sort((a, b) => {
      const order = { today: 0, "this-week": 1, low: 2 }
      return (order[a.urgency] ?? 3) - (order[b.urgency] ?? 3)
    })
  }, [matches, urgencyFilter, personaFilter, counsellorFilter, searchText])

  const uniquePersonaNames = useMemo(() =>
    [...new Set(matches.map(m => m.matched_persona).filter(Boolean))], [matches])
  const uniqueCounsellors  = useMemo(() =>
    [...new Set(matches.map(m => m.counsellor).filter(Boolean))], [matches])

  const selStyle = {
    border: "0.5px solid var(--color-border-secondary)", borderRadius: 6, padding: "5px 8px",
    fontSize: 12, background: "var(--color-background-primary)",
    color: "var(--color-text-primary)", fontFamily: "var(--font-sans)",
  }

  if (loading) return (
    <div style={{
      padding: 60, textAlign: "center",
      color: "var(--color-text-secondary)", fontFamily: "var(--font-sans)", fontSize: 13,
    }}>
      Loading transcription analysis data…
    </div>
  )

  if (error) return (
    <div style={{ padding: 20, fontFamily: "var(--font-sans)" }}>
      <div style={{ color: "#a32d2d", fontSize: 13, marginBottom: 8 }}>{error}</div>
      <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
        Make sure the Python pipeline has been run and pushed data to Google Sheets.
        Expected tabs: TA_Summary, TA_Personas, TA_Matches.
      </div>
    </div>
  )

  const noData = personas.length === 0 && matches.length === 0

  return (
    <div style={{ fontFamily: "var(--font-sans)", color: "var(--color-text-primary)" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
        <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", letterSpacing: ".5px", marginBottom: 2 }}>
          ADMIN · TRANSCRIPTION ANALYSIS
        </div>
        <div style={{ fontSize: 18, fontWeight: 500 }}>Paid customer journey insights</div>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
          Conversion patterns from {summary.unique_paid_customers || "—"} paid customers ·{" "}
          {summary.num_personas || "—"} personas · {summary.live_leads_matched || "—"} live matches
        </div>
      </div>

      {noData ? (
        <div style={{ padding: 60, textAlign: "center", color: "var(--color-text-secondary)", fontSize: 13 }}>
          <div style={{ fontSize: 15, marginBottom: 8 }}>No analysis data yet</div>
          <div>Run the Python pipeline to generate conversion personas and live lead matches.</div>
          <div style={{ marginTop: 8, fontFamily: "monospace", fontSize: 11, color: "var(--color-text-tertiary)" }}>
            python run_paid_pipeline.py
          </div>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div style={{
            borderBottom: "0.5px solid var(--color-border-tertiary)",
            padding: "0 20px", display: "flex", overflowX: "auto",
          }}>
            {[
              ["overview",  "Overview"],
              ["personas",  `Personas (${personas.length})`],
              ["matches",   `Live matches (${matches.length})`],
            ].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} style={ss.tabBtn(tab === k)}>{l}</button>
            ))}
          </div>

          <div style={{ padding: 20 }}>
            {/* OVERVIEW */}
            {tab === "overview" && (
              <OverviewTab summary={summary} personas={personas} matches={matches} />
            )}

            {/* PERSONAS */}
            {tab === "personas" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                  These {personas.length} personas were discovered by analyzing {summary.unique_paid_customers || "?"} customers
                  who completed payment. Each persona represents a distinct journey archetype — use them to
                  recognize a lead type early and apply the right conversion approach.
                </div>
                {personas.map((p, i) => (
                  <PersonaCard
                    key={p.persona_id || i}
                    persona={p}
                    colorScheme={PERSONA_COLORS[i % PERSONA_COLORS.length]}
                    index={i + 1}
                  />
                ))}
              </div>
            )}

            {/* LIVE MATCHES */}
            {tab === "matches" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Filters */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    type="text"
                    placeholder="Search name or phone…"
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    style={{ ...selStyle, minWidth: 180 }}
                  />
                  <select value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value)} style={selStyle}>
                    <option value="all">All urgency</option>
                    <option value="today">Today</option>
                    <option value="this-week">This week</option>
                    <option value="low">Low</option>
                  </select>
                  <select value={personaFilter} onChange={e => setPersonaFilter(e.target.value)} style={selStyle}>
                    <option value="all">All personas</option>
                    {uniquePersonaNames.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <select value={counsellorFilter} onChange={e => setCounsellorFilter(e.target.value)} style={selStyle}>
                    <option value="all">All counsellors</option>
                    {uniqueCounsellors.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
                    {filteredMatches.length} of {matches.length}
                  </span>
                </div>

                {/* Legend */}
                <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", display: "flex", gap: 12 }}>
                  <span>Urgency: action priority for next call</span>
                  <span>·</span>
                  <span>Click any row to see recommended nudge</span>
                </div>

                {/* Rows */}
                <div style={ss.card}>
                  {filteredMatches.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 32, color: "var(--color-text-secondary)", fontSize: 13 }}>
                      No matches for selected filters.
                    </div>
                  ) : (
                    filteredMatches.map((m, i) => (
                      <MatchRow key={m.mobile || i} match={m} personas={personas} />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
