import { useState, useEffect, useMemo } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────

const PERSONA_PALETTE = [
  { accent: "#4F46E5", light: "#EEF2FF", mid: "#C7D2FE", dark: "#3730A3", dot: "#818CF8" },
  { accent: "#0891B2", light: "#ECFEFF", mid: "#A5F3FC", dark: "#0E7490", dot: "#22D3EE" },
  { accent: "#059669", light: "#ECFDF5", mid: "#A7F3D0", dark: "#047857", dot: "#34D399" },
  { accent: "#D97706", light: "#FFFBEB", mid: "#FDE68A", dark: "#B45309", dot: "#FBBF24" },
  { accent: "#DC2626", light: "#FEF2F2", mid: "#FECACA", dark: "#B91C1C", dot: "#F87171" },
]

const URGENCY = {
  today:       { label: "Today",     bg: "#FEF2F2", text: "#991B1B", border: "#FECACA", dot: "#EF4444", barColor: "#EF4444" },
  "this-week": { label: "This week", bg: "#FFFBEB", text: "#92400E", border: "#FDE68A", dot: "#F59E0B", barColor: "#F59E0B" },
  low:         { label: "Low",       bg: "#F8FAFC", text: "#475569", border: "#E2E8F0", dot: "#94A3B8", barColor: "#94A3B8" },
}

const CONFIDENCE = {
  high:   { label: "High",   bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  medium: { label: "Medium", bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  low:    { label: "Low",    bg: "#F8FAFC", text: "#475569", border: "#E2E8F0" },
}

// ─────────────────────────────────────────────────────────────────────────────
// ATOMS
// ─────────────────────────────────────────────────────────────────────────────

function Badge({ bg, text, border, children, style = {} }) {
  return (
    <span style={{
      background: bg, color: text,
      border: `1px solid ${border || bg}`,
      borderRadius: 20, fontSize: 11, fontWeight: 600,
      padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 4,
      letterSpacing: ".2px", whiteSpace: "nowrap",
      ...style,
    }}>
      {children}
    </span>
  )
}

function Dot({ color, size = 7 }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size,
      borderRadius: "50%", background: color, flexShrink: 0,
    }} />
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "1px",
      color: "#94A3B8", textTransform: "uppercase", marginBottom: 6,
    }}>
      {children}
    </div>
  )
}

function Card({ children, style = {}, padding = 20 }) {
  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid #E2E8F0",
      borderRadius: 14,
      padding,
      boxShadow: "0 1px 3px rgba(0,0,0,.04), 0 1px 2px rgba(0,0,0,.03)",
      ...style,
    }}>
      {children}
    </div>
  )
}

function ProgressBar({ pct, color, height = 6 }) {
  return (
    <div style={{
      flex: 1, height, borderRadius: height,
      background: "#F1F5F9", overflow: "hidden",
    }}>
      <div style={{
        width: `${Math.min(100, Math.max(0, pct))}%`,
        height: "100%", background: color, borderRadius: height,
        transition: "width .4s ease",
      }} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARDS
// ─────────────────────────────────────────────────────────────────────────────

const STAT_META = [
  { key: "total_recordings_analyzed", label: "Recordings analyzed",   sub: "paid customers",       icon: "🎙️", accent: "#4F46E5" },
  { key: "unique_paid_customers",     label: "Converted customers",   sub: "completed payment",     icon: "✅", accent: "#059669" },
  { key: "avg_calls_to_convert",      label: "Avg calls to close",    sub: "across all journeys",   icon: "📞", accent: "#0891B2" },
  { key: "num_personas",              label: "Conversion personas",   sub: "buyer archetypes found", icon: "🧠", accent: "#D97706" },
]

function HeroStats({ summary }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
      {STAT_META.map(({ key, label, sub, icon, accent }) => (
        <Card key={key} padding={18} style={{ position: "relative", overflow: "hidden" }}>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 3,
            background: accent, borderRadius: "14px 14px 0 0",
          }} />
          <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#0F172A", lineHeight: 1 }}>
            {summary[key] ?? "—"}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#334155", marginTop: 4 }}>{label}</div>
          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{sub}</div>
        </Card>
      ))}
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

  const personaDist = useMemo(() => {
    const b = {}
    matches.forEach(m => { const n = m.matched_persona || "Unknown"; b[n] = (b[n] || 0) + 1 })
    return Object.entries(b).sort((a, b) => b[1] - a[1])
  }, [matches])

  const total = matches.length || 1

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <HeroStats summary={summary} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Urgency breakdown */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>
            Action urgency
          </div>
          <div style={{ fontSize: 12, color: "#64748B", marginBottom: 16 }}>
            Priority distribution across {matches.length} live leads
          </div>
          {Object.entries(URGENCY).map(([key, u]) => {
            const count = urgencyBreakdown[key] || 0
            const pct   = Math.round(count / total * 100)
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 90 }}>
                  <Dot color={u.dot} size={8} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#334155" }}>{u.label}</span>
                </div>
                <ProgressBar pct={pct} color={u.barColor} />
                <div style={{ display: "flex", gap: 4, minWidth: 50, justifyContent: "flex-end", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{count}</span>
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>{pct}%</span>
                </div>
              </div>
            )
          })}
        </Card>

        {/* Persona distribution */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>
            Live leads by persona
          </div>
          <div style={{ fontSize: 12, color: "#64748B", marginBottom: 16 }}>
            Which conversion archetype each live lead maps to
          </div>
          {personaDist.map(([name, count], i) => {
            const p   = PERSONA_PALETTE[i % PERSONA_PALETTE.length]
            const pct = Math.round(count / total * 100)
            return (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: p.light, border: `1px solid ${p.mid}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, color: p.accent,
                }}>
                  {i + 1}
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 500, color: "#334155",
                  flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {name}
                </span>
                <ProgressBar pct={pct} color={p.accent} />
                <div style={{ display: "flex", gap: 4, minWidth: 44, justifyContent: "flex-end", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{count}</span>
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>{pct}%</span>
                </div>
              </div>
            )
          })}
        </Card>
      </div>

      {/* Bottom row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card style={{ borderLeft: "4px solid #EF4444" }}>
          <SectionLabel>Most common objection before conversion</SectionLabel>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>
            {summary.top_objection_type || "—"}
          </div>
          <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.6 }}>
            This objection appeared in most paid journeys — your personas show exactly how successful counsellors resolved it.
          </div>
        </Card>
        <Card style={{ borderLeft: "4px solid #10B981" }}>
          <SectionLabel>Live matches snapshot</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            {[
              ["Score range",         summary.score_range || "80–100"],
              ["Leads matched",       summary.live_leads_matched || "—"],
              ["With call notes",     summary.leads_with_notes != null ? `${summary.leads_with_notes} / ${summary.live_leads_matched}` : "—"],
              ["Action today",        summary.urgency_today || "—"],
              ["Action this week",    summary.urgency_this_week || "—"],
              ["Last refreshed",      summary.generated_at || "Unknown"],
            ].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#64748B" }}>{l}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>{v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSONA CARD
// ─────────────────────────────────────────────────────────────────────────────

function PersonaCard({ persona, palette, index }) {
  const [open, setOpen] = useState(false)

  const speedMeta = {
    fast:   { label: "Fast converter",   bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
    medium: { label: "Medium converter", bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
    slow:   { label: "Slow converter",   bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
  }[persona.conversion_speed] || { label: persona.conversion_speed, bg: "#F8FAFC", text: "#475569", border: "#E2E8F0" }

  return (
    <Card padding={0} style={{ overflow: "hidden" }}>
      {/* Colored top bar */}
      <div style={{ height: 4, background: `linear-gradient(90deg, ${palette.accent}, ${palette.dot})` }} />

      <div style={{ padding: 20 }}>
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, flexShrink: 0,
              background: palette.light, border: `1.5px solid ${palette.mid}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 800, color: palette.accent,
            }}>
              {index}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: palette.dot, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 2 }}>
                PERSONA {index}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#0F172A" }}>
                {persona.persona_name}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <Badge {...speedMeta}>{speedMeta.label}</Badge>
            <Badge bg={palette.light} text={palette.accent} border={palette.mid}>
              {persona.customer_count || "?"} customers
            </Badge>
          </div>
        </div>

        {/* Description */}
        <div style={{
          fontSize: 13, color: "#475569", lineHeight: 1.65,
          marginBottom: 16, paddingBottom: 16,
          borderBottom: "1px solid #F1F5F9",
        }}>
          {persona.description}
        </div>

        {/* 2-col info grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div style={{
            background: "#FEF2F2", border: "1px solid #FECACA",
            borderRadius: 10, padding: "10px 12px",
          }}>
            <SectionLabel>Primary Objection</SectionLabel>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#991B1B", marginBottom: 3 }}>
              {persona.primary_objection}
            </div>
            <div style={{ fontSize: 11, color: "#DC2626", lineHeight: 1.5 }}>
              {persona.specific_objection_pattern}
            </div>
          </div>
          <div style={{
            background: palette.light, border: `1px solid ${palette.mid}`,
            borderRadius: 10, padding: "10px 12px",
          }}>
            <SectionLabel>Conversion Trigger</SectionLabel>
            <div style={{ fontSize: 13, fontWeight: 600, color: palette.accent, marginBottom: 3 }}>
              {persona.conversion_trigger}
            </div>
            <div style={{ fontSize: 11, color: palette.dark }}>
              avg {persona.avg_calls_to_convert} calls to close
            </div>
          </div>
        </div>

        {/* Emotional arc */}
        {persona.emotional_arc && (
          <div style={{
            background: "#F8FAFC", borderRadius: 8, padding: "8px 12px",
            marginBottom: 14, display: "flex", gap: 8, alignItems: "flex-start",
          }}>
            <span style={{ fontSize: 14 }}>📈</span>
            <div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>Journey arc: </span>
              <span style={{ fontSize: 12, color: "#334155" }}>{persona.emotional_arc}</span>
            </div>
          </div>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            width: "100%", padding: "9px 12px",
            background: open ? palette.light : "#F8FAFC",
            border: `1px solid ${open ? palette.mid : "#E2E8F0"}`,
            borderRadius: 8, cursor: "pointer",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            fontFamily: "inherit",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 600, color: open ? palette.accent : "#475569" }}>
            {open ? "Hide playbook" : "View counsellor playbook & example"}
          </span>
          <span style={{ fontSize: 11, color: open ? palette.accent : "#94A3B8" }}>
            {open ? "▲" : "▼"}
          </span>
        </button>

        {open && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Playbook */}
            <div style={{
              background: "#F0FDF4", border: "1px solid #BBF7D0",
              borderRadius: 10, padding: "12px 14px",
            }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ fontSize: 16 }}>📋</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#166534", letterSpacing: ".5px", marginBottom: 5 }}>
                    COUNSELLOR PLAYBOOK
                  </div>
                  <div style={{ fontSize: 12, color: "#14532D", lineHeight: 1.7 }}>
                    {persona.counsellor_playbook}
                  </div>
                </div>
              </div>
            </div>

            {/* Don't do */}
            {persona.do_not_do && (
              <div style={{
                background: "#FEF2F2", border: "1px solid #FECACA",
                borderRadius: 10, padding: "12px 14px",
              }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 16 }}>🚫</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#991B1B", letterSpacing: ".5px", marginBottom: 5 }}>
                      AVOID THIS
                    </div>
                    <div style={{ fontSize: 12, color: "#7F1D1D", lineHeight: 1.6 }}>{persona.do_not_do}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Example */}
            {persona.example_journey_summary && (
              <div style={{
                background: "#FAFAFA", border: "1px solid #E2E8F0",
                borderRadius: 8, padding: "10px 14px",
                display: "flex", gap: 8,
              }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>💬</span>
                <div style={{ fontSize: 12, color: "#475569", fontStyle: "italic", lineHeight: 1.6 }}>
                  "{persona.example_journey_summary}"
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCH ROW
// ─────────────────────────────────────────────────────────────────────────────

function MatchRow({ match, personas }) {
  const [open, setOpen] = useState(false)
  const urgency  = URGENCY[match.urgency]     || URGENCY.low
  const conf     = CONFIDENCE[match.match_confidence] || CONFIDENCE.low
  const pidx     = personas.findIndex(p => String(p.persona_id) === String(match.matched_persona_id))
  const palette  = PERSONA_PALETTE[(pidx >= 0 ? pidx : 0) % PERSONA_PALETTE.length]
  const initials = (match.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()

  return (
    <div style={{
      borderLeft: `3px solid ${urgency.dot}`,
      borderRadius: 10,
      background: open ? "#FAFBFF" : "#FFFFFF",
      border: `1px solid ${open ? "#C7D2FE" : "#E2E8F0"}`,
      borderLeftColor: urgency.dot,
      marginBottom: 8,
      overflow: "hidden",
      transition: "all .15s ease",
    }}>
      {/* Row header */}
      <div
        style={{ padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
        onClick={() => setOpen(o => !o)}
      >
        {/* Avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: palette.light, border: `1px solid ${palette.mid}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, color: palette.accent,
        }}>
          {initials}
        </div>

        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>
              {match.name || "Unknown"}
            </span>
            {match.lead_score && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: "#4F46E5",
                background: "#EEF2FF", border: "1px solid #C7D2FE",
                borderRadius: 6, padding: "1px 6px",
              }}>
                Score {match.lead_score}
              </span>
            )}
            {(match.notes_count > 0) && (
              <span style={{
                fontSize: 10, fontWeight: 600, color: "#059669",
                background: "#ECFDF5", border: "1px solid #A7F3D0",
                borderRadius: 6, padding: "1px 6px",
              }}>
                {match.notes_count} note{match.notes_count === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
            ···{(match.mobile || "").slice(-4)} &nbsp;·&nbsp;
            {match.counsellor} &nbsp;·&nbsp;
            {match.lead_stage}{match.sub_stage ? ` / ${match.sub_stage}` : ""} &nbsp;·&nbsp;
            {match.source}
          </div>
        </div>

        {/* Urgency badge */}
        <Badge bg={urgency.bg} text={urgency.text} border={urgency.border}>
          <Dot color={urgency.dot} size={6} />
          {urgency.label}
        </Badge>

        {/* Persona badge */}
        <Badge bg={palette.light} text={palette.accent} border={palette.mid}
          style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
          {match.matched_persona || "Unknown"}
        </Badge>

        {/* Confidence */}
        <Badge bg={conf.bg} text={conf.text} border={conf.border}>
          {conf.label}
        </Badge>

        {/* Chevron */}
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          background: open ? "#EEF2FF" : "#F8FAFC",
          border: `1px solid ${open ? "#C7D2FE" : "#E2E8F0"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, color: open ? "#4F46E5" : "#94A3B8",
          fontSize: 10, transition: "all .15s",
        }}>
          {open ? "▲" : "▼"}
        </div>
      </div>

      {/* Expanded panel */}
      {open && (
        <div style={{
          padding: "0 16px 16px",
          borderTop: "1px solid #EEF2FF",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
            {/* Match reason */}
            <div style={{
              background: "#F8FAFC", border: "1px solid #E2E8F0",
              borderRadius: 10, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "1px", marginBottom: 6 }}>
                WHY THIS PERSONA
              </div>
              <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.65 }}>
                {match.match_reason}
              </div>
            </div>

            {/* Next nudge */}
            <div style={{
              background: "#F0FDF4", border: "1px solid #BBF7D0",
              borderRadius: 10, padding: "12px 14px",
            }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12 }}>🎯</span>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#166534", letterSpacing: "1px" }}>
                  NEXT NUDGE
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#14532D", lineHeight: 1.65 }}>
                {match.next_nudge}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
            {/* Avoid */}
            {match.what_to_avoid && (
              <div style={{
                background: "#FEF2F2", border: "1px solid #FECACA",
                borderRadius: 10, padding: "10px 14px",
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#991B1B", letterSpacing: "1px", marginBottom: 4 }}>
                  🚫 AVOID
                </div>
                <div style={{ fontSize: 12, color: "#7F1D1D", lineHeight: 1.6 }}>{match.what_to_avoid}</div>
              </div>
            )}

            {/* Predicted outcome */}
            {match.predicted_outcome && (
              <div style={{
                background: "#FAFAFA", border: "1px solid #E2E8F0",
                borderRadius: 10, padding: "10px 14px",
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: "1px", marginBottom: 4 }}>
                  PREDICTED OUTCOME
                </div>
                <div style={{ fontSize: 12, color: "#334155", fontWeight: 500, lineHeight: 1.6 }}>
                  {match.predicted_outcome}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const INPUT_STYLE = {
  border: "1px solid #E2E8F0", borderRadius: 8, padding: "7px 12px",
  fontSize: 12, background: "#FFFFFF", color: "#0F172A",
  fontFamily: "inherit", outline: "none",
  boxShadow: "0 1px 2px rgba(0,0,0,.04)",
}

export default function TranscriptionAnalysis() {
  const [tab,      setTab]      = useState("overview")
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState("")
  const [summary,  setSummary]  = useState({})
  const [personas, setPersonas] = useState([])
  const [matches,  setMatches]  = useState([])

  const [urgencyFilter,    setUrgencyFilter]    = useState("all")
  const [personaFilter,    setPersonaFilter]    = useState("all")
  const [counsellorFilter, setCounsellorFilter] = useState("all")
  const [searchText,       setSearchText]       = useState("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError("")
      try {
        const [sRes, pRes, mRes] = await Promise.all([
          fetch("/analysis/summary.json"),
          fetch("/analysis/personas.json"),
          fetch("/analysis/live_matches.json"),
        ])
        if (!sRes.ok || !pRes.ok || !mRes.ok)
          throw new Error("Analysis files not found — run the Python pipeline first")
        const [s, p, m] = await Promise.all([sRes.json(), pRes.json(), mRes.json()])
        if (cancelled) return
        setSummary(s); setPersonas(p); setMatches(m)
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
      if (urgencyFilter !== "all"    && m.urgency !== urgencyFilter)             return false
      if (personaFilter !== "all"    && m.matched_persona !== personaFilter)     return false
      if (counsellorFilter !== "all" && m.counsellor !== counsellorFilter)       return false
      if (searchText && !m.name?.toLowerCase().includes(searchText.toLowerCase()) &&
          !(m.mobile || "").includes(searchText)) return false
      return true
    }).sort((a, b) => {
      const urgOrd = { today: 0, "this-week": 1, low: 2 }
      const uDiff  = (urgOrd[a.urgency] ?? 3) - (urgOrd[b.urgency] ?? 3)
      if (uDiff !== 0) return uDiff
      return (b.lead_score || 0) - (a.lead_score || 0)
    })
  }, [matches, urgencyFilter, personaFilter, counsellorFilter, searchText])

  const uniquePersonas    = useMemo(() => [...new Set(matches.map(m => m.matched_persona).filter(Boolean))], [matches])
  const uniqueCounsellors = useMemo(() => [...new Set(matches.map(m => m.counsellor).filter(Boolean))], [matches])

  // ── Loading ──
  if (loading) return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 14, padding: 80,
      fontFamily: "inherit",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: "50%",
        border: "3px solid #E2E8F0", borderTopColor: "#4F46E5",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ fontSize: 13, color: "#64748B" }}>Loading analysis data…</div>
    </div>
  )

  // ── Error ──
  if (error) return (
    <div style={{ padding: 40, fontFamily: "inherit" }}>
      <Card style={{ borderLeft: "4px solid #EF4444", maxWidth: 540 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>
              Analysis not available
            </div>
            <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.6, marginBottom: 10 }}>
              {error}
            </div>
            <code style={{
              display: "block", background: "#F8FAFC", border: "1px solid #E2E8F0",
              borderRadius: 6, padding: "6px 10px", fontSize: 11, color: "#475569",
            }}>
              python run_paid_pipeline.py
            </code>
          </div>
        </div>
      </Card>
    </div>
  )

  const noData = personas.length === 0 && matches.length === 0

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", color: "#0F172A", background: "#F8FAFC", minHeight: "100vh" }}>

      {/* ── Hero header ── */}
      <div style={{
        background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)",
        padding: "28px 28px 24px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,.12)", borderRadius: 20,
              padding: "3px 10px", marginBottom: 10,
            }}>
              <span style={{ fontSize: 11 }}>🎙️</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#C7D2FE", letterSpacing: "1px" }}>
                TRANSCRIPTION ANALYSIS
              </span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#FFFFFF", marginBottom: 6 }}>
              Paid customer journey insights
            </div>
            <div style={{ fontSize: 13, color: "#A5B4FC", lineHeight: 1.5 }}>
              Patterns extracted from {summary.unique_paid_customers || "—"} converted customers ·{" "}
              {summary.num_personas || "—"} buyer personas · {summary.live_leads_matched || "—"} live leads matched
            </div>
          </div>
          <div style={{
            background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.15)",
            borderRadius: 10, padding: "8px 14px", textAlign: "right",
          }}>
            <div style={{ fontSize: 10, color: "#A5B4FC", marginBottom: 2 }}>Last refreshed</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#E0E7FF" }}>
              {summary.generated_at || "—"}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, marginTop: 20 }}>
          {[
            ["overview",  "📊 Overview"],
            ["personas",  `🧠 Personas (${personas.length})`],
            ["matches",   `🎯 Live Matches (${matches.length})`],
          ].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding: "8px 16px", borderRadius: 8, border: "none",
              background: tab === k ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.1)",
              color: tab === k ? "#312E81" : "#C7D2FE",
              fontWeight: tab === k ? 700 : 500,
              fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              transition: "all .15s",
            }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: 24 }}>
        {noData ? (
          <Card style={{ textAlign: "center", padding: 60, maxWidth: 480, margin: "40px auto" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🎙️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>
              No analysis data yet
            </div>
            <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, marginBottom: 16 }}>
              Run the Python pipeline to generate conversion personas and live lead matches.
            </div>
            <code style={{
              display: "block", background: "#F8FAFC", border: "1px solid #E2E8F0",
              borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#475569",
            }}>
              python run_paid_pipeline.py
            </code>
          </Card>
        ) : (
          <>
            {tab === "overview" && (
              <OverviewTab summary={summary} personas={personas} matches={matches} />
            )}

            {tab === "personas" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Intro banner */}
                <div style={{
                  background: "linear-gradient(135deg, #EEF2FF, #E0E7FF)",
                  border: "1px solid #C7D2FE", borderRadius: 12,
                  padding: "14px 18px", display: "flex", gap: 12, alignItems: "center",
                }}>
                  <span style={{ fontSize: 20 }}>🧠</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#312E81", marginBottom: 2 }}>
                      {personas.length} conversion archetypes discovered
                    </div>
                    <div style={{ fontSize: 12, color: "#4338CA", lineHeight: 1.5 }}>
                      Clustered from {summary.unique_paid_customers || "?"} paid customer journeys.
                      Recognise the archetype early on call 1 — then follow the playbook.
                    </div>
                  </div>
                </div>

                {/* 2-col grid on wide, 1-col on narrow */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(480px, 1fr))", gap: 16 }}>
                  {personas.map((p, i) => (
                    <PersonaCard
                      key={p.persona_id || i}
                      persona={p}
                      palette={PERSONA_PALETTE[i % PERSONA_PALETTE.length]}
                      index={i + 1}
                    />
                  ))}
                </div>
              </div>
            )}

            {tab === "matches" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Filter bar */}
                <Card padding={14}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
                      <span style={{
                        position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                        fontSize: 13, color: "#94A3B8", pointerEvents: "none",
                      }}>🔍</span>
                      <input
                        type="text" placeholder="Search by name or phone…"
                        value={searchText} onChange={e => setSearchText(e.target.value)}
                        style={{ ...INPUT_STYLE, width: "100%", paddingLeft: 32, boxSizing: "border-box" }}
                      />
                    </div>
                    <select value={urgencyFilter} onChange={e => setUrgencyFilter(e.target.value)} style={INPUT_STYLE}>
                      <option value="all">All urgency</option>
                      <option value="today">🔴 Today</option>
                      <option value="this-week">🟡 This week</option>
                      <option value="low">⚪ Low</option>
                    </select>
                    <select value={personaFilter} onChange={e => setPersonaFilter(e.target.value)} style={INPUT_STYLE}>
                      <option value="all">All personas</option>
                      {uniquePersonas.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <select value={counsellorFilter} onChange={e => setCounsellorFilter(e.target.value)} style={INPUT_STYLE}>
                      <option value="all">All counsellors</option>
                      {uniqueCounsellors.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <div style={{
                      padding: "7px 12px", background: "#EEF2FF", border: "1px solid #C7D2FE",
                      borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#4338CA", whiteSpace: "nowrap",
                    }}>
                      {filteredMatches.length} / {matches.length}
                    </div>
                  </div>
                </Card>

                {/* Legend pills */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {Object.entries(URGENCY).map(([k, u]) => (
                    <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Dot color={u.dot} size={8} />
                      <span style={{ fontSize: 11, color: "#64748B" }}>
                        {u.label} — left border color
                      </span>
                    </div>
                  ))}
                  <span style={{ fontSize: 11, color: "#CBD5E1" }}>·</span>
                  <span style={{ fontSize: 11, color: "#64748B" }}>Click row to expand nudge</span>
                </div>

                {/* Match rows */}
                {filteredMatches.length === 0 ? (
                  <Card style={{ textAlign: "center", padding: 40 }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
                    <div style={{ fontSize: 13, color: "#64748B" }}>No leads match the selected filters.</div>
                  </Card>
                ) : (
                  filteredMatches.map((m, i) => (
                    <MatchRow key={m.mobile || i} match={m} personas={personas} />
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
