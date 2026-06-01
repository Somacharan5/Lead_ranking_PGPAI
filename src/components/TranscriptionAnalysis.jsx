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
// PAID APPS — HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 }

function serialToDate(serial) {
  if (!serial && serial !== 0) return null

  // Numeric Excel serial (e.g. 46201.79)
  const n = Number(serial)
  if (!isNaN(n) && n > 1) return new Date((n - 25569) * 86400000)

  // String format: "31 Dec 2025, 04:23 PM"
  if (typeof serial === "string") {
    const m = serial.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})(?:,\s*(\d{1,2}):(\d{2})\s*(AM|PM))?/i)
    if (m) {
      const day = parseInt(m[1])
      const mon = MONTHS[m[2].toLowerCase()]
      const yr  = parseInt(m[3])
      if (mon === undefined) return null
      let hr = m[4] ? parseInt(m[4]) : 0
      const mn = m[5] ? parseInt(m[5]) : 0
      if (m[6]) {
        if (m[6].toUpperCase() === "PM" && hr !== 12) hr += 12
        if (m[6].toUpperCase() === "AM" && hr === 12) hr = 0
      }
      return new Date(yr, mon, day, hr, mn)
    }
    // Fallback: let JS try
    const d = new Date(serial)
    return isNaN(d.getTime()) ? null : d
  }

  return null
}

function getWeekMonday(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d
}

function getDefaultWeekStart() {
  const mon = getWeekMonday(new Date())
  mon.setDate(mon.getDate() - 7)
  return mon
}

function fmtDate(date) {
  if (!date) return "—"
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

function formatWeekLabel(weekStart) {
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 5)
  return `${fmtDate(weekStart)} – ${fmtDate(end)}`
}

const DAYS_BUCKET_ORDER = ["Same day", "1–3 days", "4–7 days", "8–14 days", "15–30 days", "30+ days", "Unknown"]

function getDaysBucket(days) {
  if (days === null || days === undefined || isNaN(days)) return "Unknown"
  if (days <= 0)  return "Same day"
  if (days <= 3)  return "1–3 days"
  if (days <= 7)  return "4–7 days"
  if (days <= 14) return "8–14 days"
  if (days <= 30) return "15–30 days"
  return "30+ days"
}

function getWorkStatus(gradYear) {
  const year = parseInt(gradYear)
  if (isNaN(year)) return "Unknown"
  const now = new Date().getFullYear()
  if (year < now)  return "Working Professional"
  if (year === now) return "Fresher"
  return "Student"
}

function normalizeCounsellorPaid(raw) {
  const n = (raw || "").trim().toLowerCase()
  if (n.startsWith("jasmeet")) return "Jasmeet Kaur"
  if (n.startsWith("komal"))   return "Komal Pandey"
  if (n.startsWith("prerna"))  return "Prerna Kaushik"
  return (raw || "").trim() || "Unknown"
}

function parsePaidRow(row) {
  if (!row) return null
  const status = (row[2] || "").trim().toLowerCase()
  if (status !== "completed") return null

  const registeredOn = serialToDate(row[16])                        // Q — Registered On
  const paidOn       = serialToDate(row[59])                        // BH — "31 Dec 2025, 04:23 PM"
                    || serialToDate(row[58])                        // BG — Last Activity (fallback)
                    || registeredOn                                 // Q  — last resort
  if (!paidOn) return null

  const daysToConvert = (registeredOn && paidOn)
    ? Math.round((paidOn - registeredOn) / 86400000)
    : null

  const gradYear = parseInt(row[86]) || null

  return {
    name:        (row[12] || "").trim(),
    email:       (row[13] || "").trim(),
    mobile:      (row[14] || "").trim(),
    source:      (row[18] || "").trim() || "Unknown",
    medium:      (row[19] || "").trim() || "Unknown",
    campaign:    (row[20] || "").trim() || "Unknown",
    counsellor:  normalizeCounsellorPaid(row[43]),
    registeredOn,
    paidOn,
    daysToConvert,
    daysBucket:  getDaysBucket(daysToConvert),
    state:       (row[74] || "").trim() || "Unknown",
    city:        (row[75] || "").trim() || "Unknown",
    gradYear:    gradYear ? String(gradYear) : "Unknown",
    workStatus:  getWorkStatus(gradYear),
    college:     (row[105] || "").trim() || "Unknown",
    degree:      (row[107] || "").trim() || "Unknown",
    company:     (row[134] || "").trim() || "Unknown",
    role:        (row[135] || "").trim() || "Unknown",
  }
}

function groupRank(leads, field, topN = 8) {
  const counts = {}
  for (const l of leads) {
    const v = (l[field] || "Unknown") || "Unknown"
    counts[v] = (counts[v] || 0) + 1
  }
  const sorted = Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
  if (sorted.length <= topN) return sorted
  const top = sorted.slice(0, topN)
  const rest = sorted.slice(topN).reduce((s, x) => s + x.count, 0)
  return [...top, { label: "Others", count: rest }]
}

function groupDaysBuckets(leads) {
  const counts = {}
  for (const l of leads) counts[l.daysBucket] = (counts[l.daysBucket] || 0) + 1
  return DAYS_BUCKET_ORDER.filter(b => counts[b]).map(b => ({ label: b, count: counts[b] }))
}

// ─────────────────────────────────────────────────────────────────────────────
// PAID APPS — WEEK NAV
// ─────────────────────────────────────────────────────────────────────────────

function WeekNav({ weekStart, onChange }) {
  const thisMonday = getWeekMonday(new Date())
  const atPresent  = weekStart >= thisMonday

  function shift(n) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + n * 7)
    onChange(d)
  }

  const BTN = (dir) => ({
    width: 34, height: 34, borderRadius: 8, border: "1px solid #E2E8F0",
    background: dir === 1 && atPresent ? "#F8FAFC" : "#FFFFFF",
    cursor: dir === 1 && atPresent ? "not-allowed" : "pointer",
    fontSize: 16, color: dir === 1 && atPresent ? "#CBD5E1" : "#475569",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "inherit", flexShrink: 0,
  })

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      background: "#FFFFFF", border: "1px solid #E2E8F0",
      borderRadius: 12, padding: "12px 18px", marginBottom: 4,
    }}>
      <button style={BTN(-1)} onClick={() => shift(-1)}>‹</button>
      <div style={{ flex: 1, textAlign: "center" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", letterSpacing: "1px", marginBottom: 3 }}>
          WEEK · MON – SAT
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>
          {formatWeekLabel(weekStart)}
        </div>
      </div>
      <button style={BTN(1)} onClick={() => !atPresent && shift(1)}>›</button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAID APPS — ATTRIBUTION CARD
// ─────────────────────────────────────────────────────────────────────────────

function AttributionCard({ title, icon, data, total, accent = "#4F46E5" }) {
  if (!data || data.length === 0) return (
    <Card>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", marginBottom: 12 }}>
        {icon} {title}
      </div>
      <div style={{ fontSize: 12, color: "#94A3B8" }}>No data for this week</div>
    </Card>
  )
  const maxCount = Math.max(...data.map(d => d.count), 1)
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{icon} {title}</div>
        <span style={{
          fontSize: 10, fontWeight: 700, color: "#94A3B8",
          background: "#F8FAFC", border: "1px solid #E2E8F0",
          borderRadius: 6, padding: "2px 8px",
        }}>{total} total</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {data.map(({ label, count }) => {
          const pct    = Math.round(count / total * 100)
          const barPct = Math.round(count / maxCount * 100)
          const isOther = label === "Others"
          return (
            <div key={label}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <span style={{
                  fontSize: 12, color: "#334155", fontWeight: isOther ? 400 : 500,
                  fontStyle: isOther ? "italic" : "normal",
                  flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8,
                }}>{label}</span>
                <div style={{ display: "flex", gap: 5, flexShrink: 0, alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{count}</span>
                  <span style={{ fontSize: 11, color: "#94A3B8", minWidth: 30, textAlign: "right" }}>{pct}%</span>
                </div>
              </div>
              <div style={{ height: 5, borderRadius: 5, background: "#F1F5F9", overflow: "hidden" }}>
                <div style={{
                  width: `${barPct}%`, height: "100%", borderRadius: 5,
                  background: isOther ? "#CBD5E1" : accent,
                  transition: "width .35s ease",
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAID APPS — DRILL-DOWN DRAWER
// ─────────────────────────────────────────────────────────────────────────────

const TH_STYLE = {
  padding: "10px 12px", textAlign: "left",
  fontSize: 10, fontWeight: 700, color: "#64748B",
  letterSpacing: ".5px", textTransform: "uppercase",
  borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap",
  background: "#F8FAFC",
}

function DrillDrawer({ leads, weekLabel, onClose }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,.45)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "absolute", right: 0, top: 0, bottom: 0,
          width: "min(1020px, 96vw)",
          background: "#FFFFFF", display: "flex", flexDirection: "column",
          boxShadow: "-8px 0 32px rgba(0,0,0,.18)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "18px 24px", borderBottom: "1px solid #E2E8F0", flexShrink: 0,
          background: "linear-gradient(135deg, #1E1B4B, #312E81)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#A5B4FC", letterSpacing: "1px", marginBottom: 4 }}>
              PAID APPS · DRILL-DOWN
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF" }}>
              {leads.length} paid app{leads.length !== 1 ? "s" : ""} &nbsp;·&nbsp; {weekLabel}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: 8, border: "none",
            background: "rgba(255,255,255,.15)", color: "#E0E7FF",
            fontSize: 20, cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>

        {/* Table */}
        <div style={{ overflow: "auto", flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["#", "Name", "Counsellor", "Source", "Medium", "City", "State",
                  "College", "Degree", "Grad Yr", "Work Status", "Company", "Role",
                  "Paid On", "Days to Convert"].map(h => (
                  <th key={h} style={TH_STYLE}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((l, i) => {
                const wsColor = l.workStatus === "Working Professional"
                  ? { bg: "#ECFDF5", text: "#065F46" }
                  : l.workStatus === "Fresher"
                  ? { bg: "#EEF2FF", text: "#3730A3" }
                  : { bg: "#F8FAFC", text: "#64748B" }
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#FFF" : "#FAFAFA" }}>
                    <td style={{ padding: "9px 12px", color: "#94A3B8", fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ padding: "9px 12px", fontWeight: 600, color: "#0F172A", whiteSpace: "nowrap" }}>{l.name || "—"}</td>
                    <td style={{ padding: "9px 12px", color: "#475569", whiteSpace: "nowrap" }}>{l.counsellor}</td>
                    <td style={{ padding: "9px 12px", color: "#475569" }}>{l.source}</td>
                    <td style={{ padding: "9px 12px", color: "#475569" }}>{l.medium}</td>
                    <td style={{ padding: "9px 12px", color: "#475569" }}>{l.city}</td>
                    <td style={{ padding: "9px 12px", color: "#475569" }}>{l.state}</td>
                    <td style={{ padding: "9px 12px", color: "#475569", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.college}</td>
                    <td style={{ padding: "9px 12px", color: "#475569" }}>{l.degree}</td>
                    <td style={{ padding: "9px 12px", color: "#475569", textAlign: "center" }}>{l.gradYear}</td>
                    <td style={{ padding: "9px 12px" }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                        background: wsColor.bg, color: wsColor.text,
                      }}>{l.workStatus}</span>
                    </td>
                    <td style={{ padding: "9px 12px", color: "#475569", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.company}</td>
                    <td style={{ padding: "9px 12px", color: "#475569", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.role}</td>
                    <td style={{ padding: "9px 12px", color: "#475569", whiteSpace: "nowrap" }}>{fmtDate(l.paidOn)}</td>
                    <td style={{ padding: "9px 12px", textAlign: "center", fontWeight: 600,
                      color: l.daysToConvert <= 3 ? "#059669" : l.daysToConvert <= 14 ? "#D97706" : "#DC2626" }}>
                      {l.daysToConvert !== null ? `${l.daysToConvert}d` : "—"}
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

// ─────────────────────────────────────────────────────────────────────────────
// PAID APPS TAB
// ─────────────────────────────────────────────────────────────────────────────

function PaidAppsTab() {
  const [weekStart,   setWeekStart]   = useState(() => getDefaultWeekStart())
  const [allPaid,     setAllPaid]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState("")
  const [drawerOpen,  setDrawerOpen]  = useState(false)
  const [debug,       setDebug]       = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(""); setDebug(null)
      try {
        const { fetchSheetData } = await import('../utils/sheetsApi')
        const rows = await fetchSheetData('App Start Dump', 'A:EF')
        if (cancelled) return

        const dataRows   = (rows || []).slice(1)
        const totalRows  = dataRows.length

        // Stage 1: rows where Payment Status (col C, idx 2) = "completed"
        const completedRows = dataRows.filter(r => (r[2] || "").trim().toLowerCase() === "completed")

        // Sample status values for diagnosis
        const statusSample = [...new Set(dataRows.slice(0, 200).map(r => (r[2] || "").trim()))].slice(0, 8)

        // Stage 2: of completed rows, how many have a valid BH (idx 59) paid date
        const withPaidDate = completedRows.filter(r =>
          serialToDate(r[59]) || serialToDate(r[58]) || serialToDate(r[16])
        )

        // Stage 3: final parsed set
        const paid = dataRows.map(parsePaidRow).filter(Boolean)

        console.log('[PaidApps] Total rows:', totalRows)
        console.log('[PaidApps] Status values (sample):', statusSample)
        console.log('[PaidApps] Completed rows:', completedRows.length)
        console.log('[PaidApps] Completed WITH paid date (BH):', withPaidDate.length)
        console.log('[PaidApps] Final parsed paid:', paid.length)
        if (completedRows.length > 0) {
          console.log('[PaidApps] Sample completed row BH (idx 59):', completedRows[0][59])
          console.log('[PaidApps] Sample completed row length:', completedRows[0].length)
        }

        setDebug({
          totalRows,
          statusSample,
          completedRows: completedRows.length,
          withPaidDate:  withPaidDate.length,
          finalParsed:   paid.length,
        })
        setAllPaid(paid)
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const weekLeads = useMemo(() => {
    const start = new Date(weekStart); start.setHours(0, 0, 0, 0)
    const end   = new Date(weekStart); end.setDate(end.getDate() + 5); end.setHours(23, 59, 59, 999)
    return allPaid.filter(l => l.paidOn >= start && l.paidOn <= end)
  }, [allPaid, weekStart])

  const total = weekLeads.length

  const attrs = useMemo(() => ({
    source:      groupRank(weekLeads, "source"),
    medium:      groupRank(weekLeads, "medium"),
    campaign:    groupRank(weekLeads, "campaign"),
    counsellor:  groupRank(weekLeads, "counsellor"),
    workStatus:  groupRank(weekLeads, "workStatus"),
    city:        groupRank(weekLeads, "city"),
    state:       groupRank(weekLeads, "state"),
    gradYear:    groupRank(weekLeads, "gradYear"),
    degree:      groupRank(weekLeads, "degree"),
    college:     groupRank(weekLeads, "college"),
    company:     groupRank(weekLeads, "company"),
    role:        groupRank(weekLeads, "role"),
    daysBucket:  groupDaysBuckets(weekLeads),
  }), [weekLeads])

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 80 }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #E2E8F0", borderTopColor: "#4F46E5", animation: "spin 0.8s linear infinite" }} />
      <div style={{ fontSize: 13, color: "#64748B" }}>Loading App Start Dump…</div>
    </div>
  )

  if (error) return (
    <Card style={{ borderLeft: "4px solid #EF4444", maxWidth: 540 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <span style={{ fontSize: 20 }}>⚠️</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>Failed to load data</div>
          <div style={{ fontSize: 12, color: "#64748B" }}>{error}</div>
        </div>
      </div>
    </Card>
  )

  const weekLabel = formatWeekLabel(weekStart)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <WeekNav weekStart={weekStart} onChange={setWeekStart} />

      {/* ── Diagnostic panel — visible when data is missing ── */}
      {debug && (debug.finalParsed === 0 || total === 0) && (
        <Card style={{ borderLeft: "4px solid #F59E0B", background: "#FFFBEB" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E", marginBottom: 10 }}>
            🔍 Diagnostic — where records are being filtered
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              ["App Start Dump rows fetched",                debug.totalRows,      "#0F172A"],
              ["Rows with Payment Status = completed",       debug.completedRows,  debug.completedRows > 0 ? "#059669" : "#DC2626"],
              ["Completed rows WITH any date (BH→BG→Q fallback)", debug.withPaidDate, debug.withPaidDate > 0 ? "#059669" : "#DC2626"],
              ["Final parsed paid records (allPaid)",        debug.finalParsed,    debug.finalParsed > 0   ? "#059669" : "#DC2626"],
              ["In selected week",                           total,                total > 0               ? "#059669" : "#DC2626"],
            ].map(([label, val, color]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#78350F" }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color }}>{val}</span>
              </div>
            ))}
            {debug.statusSample.length > 0 && (
              <div style={{ marginTop: 6, padding: "8px 10px", background: "#FEF3C7", borderRadius: 6 }}>
                <span style={{ fontSize: 11, color: "#92400E", fontWeight: 600 }}>Status values seen in col C: </span>
                <span style={{ fontSize: 11, color: "#78350F" }}>{debug.statusSample.join(" · ") || "empty"}</span>
              </div>
            )}
            {debug.finalParsed > 0 && total === 0 && (
              <div style={{ marginTop: 6, padding: "8px 10px", background: "#DCFCE7", borderRadius: 6, fontSize: 11, color: "#166534" }}>
                ✅ {debug.finalParsed} paid records found — none fall in {weekLabel}. Try navigating to a different week.
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Total hero card — click to drill down */}
      <div
        onClick={() => total > 0 && setDrawerOpen(true)}
        style={{
          background: total > 0
            ? "linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)"
            : "#F8FAFC",
          border: total > 0 ? "none" : "1px solid #E2E8F0",
          borderRadius: 16, padding: "28px 32px",
          cursor: total > 0 ? "pointer" : "default",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          transition: "filter .15s",
        }}
        onMouseEnter={e => total > 0 && (e.currentTarget.style.filter = "brightness(1.07)")}
        onMouseLeave={e => (e.currentTarget.style.filter = "none")}
      >
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", marginBottom: 10,
            color: total > 0 ? "#A5B4FC" : "#94A3B8",
          }}>
            PAID APPS THIS WEEK
          </div>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, color: total > 0 ? "#FFFFFF" : "#CBD5E1" }}>
            {total}
          </div>
          <div style={{ fontSize: 13, marginTop: 10, color: total > 0 ? "#C7D2FE" : "#94A3B8" }}>
            {weekLabel}
          </div>
        </div>
        {total > 0 ? (
          <div style={{
            background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.25)",
            borderRadius: 12, padding: "14px 22px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          }}>
            <div style={{ fontSize: 22 }}>📋</div>
            <div style={{ fontSize: 12, color: "#E0E7FF", fontWeight: 600 }}>View all {total}</div>
            <div style={{ fontSize: 11, color: "#A5B4FC" }}>raw data →</div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "#94A3B8" }}>No paid apps in this period</div>
        )}
      </div>

      {/* Attribution grid — only shown when there's data */}
      {total > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 14 }}>
          <AttributionCard title="Source"            icon="🌐" data={attrs.source}      total={total} accent="#4F46E5" />
          <AttributionCard title="Medium / Channel"  icon="📡" data={attrs.medium}      total={total} accent="#0891B2" />
          <AttributionCard title="Campaign"          icon="🎯" data={attrs.campaign}    total={total} accent="#7C3AED" />
          <AttributionCard title="Counsellor"        icon="🧑‍💼" data={attrs.counsellor}  total={total} accent="#059669" />
          <AttributionCard title="Work Status"       icon="💼" data={attrs.workStatus}  total={total} accent="#D97706" />
          <AttributionCard title="Days to Convert"   icon="⏱️" data={attrs.daysBucket}  total={total} accent="#DC2626" />
          <AttributionCard title="City"              icon="🏙️" data={attrs.city}        total={total} accent="#0891B2" />
          <AttributionCard title="State"             icon="📍" data={attrs.state}       total={total} accent="#475569" />
          <AttributionCard title="Graduation Year"   icon="🎓" data={attrs.gradYear}    total={total} accent="#7C3AED" />
          <AttributionCard title="Degree"            icon="📜" data={attrs.degree}      total={total} accent="#059669" />
          <AttributionCard title="College"           icon="🏛️" data={attrs.college}     total={total} accent="#D97706" />
          <AttributionCard title="Company"           icon="🏢" data={attrs.company}     total={total} accent="#334155" />
          <AttributionCard title="Role / Designation" icon="👤" data={attrs.role}       total={total} accent="#4F46E5" />
        </div>
      )}

      {drawerOpen && (
        <DrillDrawer leads={weekLeads} weekLabel={weekLabel} onClose={() => setDrawerOpen(false)} />
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
        <div style={{ display: "flex", gap: 4, marginTop: 20, flexWrap: "wrap" }}>
          {[
            ["overview",   "📊 Overview"],
            ["personas",   `🧠 Personas (${personas.length})`],
            ["matches",    `🎯 Live Matches (${matches.length})`],
            ["paid-apps",  "📅 Paid Apps"],
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
        {/* Paid Apps tab is independent of static JSON — always render it */}
        {tab === "paid-apps" && <PaidAppsTab />}

        {noData && tab !== "paid-apps" ? (
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
        ) : tab !== "paid-apps" && (
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
