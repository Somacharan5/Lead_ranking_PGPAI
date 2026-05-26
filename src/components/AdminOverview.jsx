import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getLeadsForCounsellor, parseBlackouts } from '../utils/leadProcessor'
import { triggerGlobalRefresh } from '../utils/refreshSignal'
import AdminInsights from './AdminInsights'

const COUNSELLORS = ['Jasmeet Kaur', 'Komal Pandey', 'Prerna Kaushik']

const SECTION_META = [
  { key: 'newAppStart',   label: '📝 New App',      color: 'purple' },
  { key: 'appFollowup',   label: '📞 App Followup', color: 'pink'   },
  { key: 'followupLeads', label: '🔄 Followup',     color: 'orange' },
  { key: 'freshLeads',    label: '🆕 Fresh',        color: 'green'  },
]

const COLOR = {
  green:  { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200'  },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  pink:   { bg: 'bg-pink-50',   text: 'text-pink-700',   border: 'border-pink-200'   },
}

// ─── Blackout utilities ───────────────────────────────────────────────────────

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL

const STATUS_STYLE = {
  active:   { row: 'bg-red-50 text-red-700 border-red-200',     badge: 'bg-red-100 text-red-700'     },
  upcoming: { row: 'bg-amber-50 text-amber-700 border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  expired:  { row: 'bg-gray-50 text-gray-400 border-gray-200',  badge: 'bg-gray-100 text-gray-500'   },
}
const STATUS_LABEL = { active: 'LIVE', upcoming: 'Upcoming', expired: 'Expired' }

function fmtDate(val) {
  if (!val) return '—'
  const s = String(val).trim()
  const n = Number(s)
  if (!isNaN(n) && n > 40000) {
    const d = new Date((Math.floor(n) - 25569) * 86400 * 1000)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-')
    return new Date(+y, +m - 1, +d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  return s
}

function blackoutStatus(startDate, endDate) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const parse = v => {
    if (!v) return null
    const s = String(v).trim()
    const n = Number(s)
    if (!isNaN(n) && n > 40000) { const d = new Date((Math.floor(n) - 25569) * 86400 * 1000); d.setHours(0, 0, 0, 0); return d }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y, m, d] = s.split('-'); return new Date(+y, +m - 1, +d) }
    return null
  }
  const start = parse(startDate)
  const end   = parse(endDate)
  if (end && today > end)    return 'expired'
  if (start && today < start) return 'upcoming'
  return 'active'
}

function bustCounsellorCaches() {
  COUNSELLORS.forEach(name => localStorage.removeItem(`aias_cache_time_${name}`))
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function AdminOverview() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const view = params.get('tab') || 'overview'
  const [selectedBlackout, setSelectedBlackout] = useState(null)
  const [rows,             setRows]             = useState(
    COUNSELLORS.map(name => ({ name, data: null, loading: true, error: false }))
  )
  const [refreshing,     setRefreshing]     = useState(false)
  const [refreshMessage, setRefreshMessage] = useState('')
  const [blackouts,      setBlackouts]      = useState([])
  const [blackoutsLoading, setBlackoutsLoading] = useState(true)

  // Lifted blackout loader — also feeds the summary bar badge
  const loadBlackouts = useCallback(async () => {
    setBlackoutsLoading(true)
    try {
      const { fetchSheetData } = await import('../utils/sheetsApi')
      const rows = await fetchSheetData('Campaign Blackouts', 'A:D').catch(() => [])
      setBlackouts(parseBlackouts(rows).map((b, i) => ({ ...b, rowIndex: i + 1 })))
    } finally {
      setBlackoutsLoading(false)
    }
  }, [])

  useEffect(() => {
    COUNSELLORS.forEach((name, i) => loadOne(name, i))
    loadBlackouts()
  }, [])

  useEffect(() => {
    if (view === 'blackouts') loadBlackouts()
  }, [view])

  const loadOne = async (name, i, force = false) => {
    setRows(prev => {
      const next = [...prev]; next[i] = { ...next[i], loading: true, error: false }; return next
    })
    const cacheKey     = `aias_leads_${name}`
    const cacheTimeKey = `aias_cache_time_${name}`
    if (!force) {
      const cached     = localStorage.getItem(cacheKey)
      const cachedTime = localStorage.getItem(cacheTimeKey)
      if (cached && cachedTime && isCacheValid(cachedTime)) {
        setRows(prev => {
          const next = [...prev]; next[i] = { name, data: JSON.parse(cached), loading: false, error: false }; return next
        })
        return
      }
    }
    try {
      const data = await getLeadsForCounsellor(name)
      const now  = new Date()
      localStorage.setItem(cacheKey, JSON.stringify(data))
      localStorage.setItem(cacheTimeKey, now.toISOString())
      setRows(prev => {
        const next = [...prev]; next[i] = { name, data, loading: false, error: false }; return next
      })
    } catch {
      setRows(prev => {
        const next = [...prev]; next[i] = { name, data: null, loading: false, error: true }; return next
      })
    }
  }

  const handleRefreshAll = () => COUNSELLORS.forEach((name, i) => loadOne(name, i, true))

  const handleForceRefreshAll = async () => {
    if (!confirm('This will trigger a refresh signal for ALL counsellor dashboards. Continue?')) return
    setRefreshing(true)
    const result = await triggerGlobalRefresh()
    if (result.success) {
      setRefreshMessage('✓ Refresh signal sent')
      handleRefreshAll()
      setTimeout(() => setRefreshMessage(''), 5000)
    } else {
      setRefreshMessage(`⚠ ${result.error}`)
    }
    setRefreshing(false)
  }

  const switchView = (v) => {
    const next = view === v ? 'overview' : v
    setParams(p => {
      const n = new URLSearchParams(p)
      if (next === 'overview') n.delete('tab')
      else n.set('tab', next)
      return n
    }, { replace: true })
    setSelectedBlackout(null)
  }

  const totalAll      = rows.reduce((sum, r) => sum + (r.data?.total ?? 0), 0)
  const spokenAll     = rows.reduce((sum, r) => sum + (r.data?.spokenToday?.total ?? 0), 0)
  const activeBlackouts = blackouts.filter(b => blackoutStatus(b.startDate, b.endDate) === 'active')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Sticky header ── */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="bg-amber-500 text-white w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-lg">🛡️</div>
            <div>
              <h1 className="text-base md:text-xl font-bold text-gray-800">Admin Overview</h1>
              <p className="text-xs text-gray-500 hidden sm:block">All counsellors — today's allocation</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {refreshMessage && <span className="text-xs text-amber-700 hidden sm:inline">{refreshMessage}</span>}
            <button onClick={handleRefreshAll}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition">
              🔄 <span className="hidden sm:inline">Refresh All</span>
            </button>
            <button onClick={handleForceRefreshAll} disabled={refreshing}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition disabled:opacity-50 hidden sm:block">
              {refreshing ? '...' : '⚡ Force Refresh'}
            </button>
            <button onClick={() => switchView('blackouts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${view === 'blackouts' ? 'bg-red-600 text-white' : 'bg-red-50 hover:bg-red-100 text-red-700'}`}>
              🚫 <span className="hidden sm:inline">Blackouts{activeBlackouts.length > 0 ? ` (${activeBlackouts.length})` : ''}</span>
            </button>
            <button onClick={() => switchView('insights')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${view === 'insights' ? 'bg-violet-600 text-white' : 'bg-violet-50 hover:bg-violet-100 text-violet-700'}`}>
              📊 <span className="hidden sm:inline">Insights</span>
            </button>
            <button onClick={() => navigate('/admin')}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition">
              📋 <span className="hidden sm:inline">Detailed View</span>
            </button>
            <button onClick={() => navigate('/')}
              className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition">
              🏠
            </button>
          </div>
        </div>
      </header>

      {/* ── View: Insights ── */}
      {view === 'insights' && (
        <div className="max-w-[1400px] mx-auto">
          <AdminInsights />
        </div>
      )}

      {/* ── View: Blackout list ── */}
      {view === 'blackouts' && !selectedBlackout && (
        <BlackoutListPage
          blackouts={blackouts}
          loading={blackoutsLoading}
          onBack={() => setView('overview')}
          onSelect={setSelectedBlackout}
          onReload={loadBlackouts}
          onBlackoutChange={handleRefreshAll}
        />
      )}

      {/* ── View: Blackout detail ── */}
      {view === 'blackouts' && selectedBlackout && (
        <BlackoutDetailPage
          blackout={selectedBlackout}
          onBack={() => setSelectedBlackout(null)}
        />
      )}

      {/* ── View: Overview (hidden when another view is active) ── */}
      <main className={`max-w-[1400px] mx-auto px-3 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6 ${view !== 'overview' ? 'hidden' : ''}`}>
        {/* Summary bar */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total leads today</p>
            <p className="text-3xl font-bold text-blue-700">{totalAll} <span className="text-base font-normal text-gray-400">/ {COUNSELLORS.length * 300}</span></p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Per counsellor</p>
            <p className="text-3xl font-bold text-gray-800">300</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {activeBlackouts.length > 0 && (
              <button onClick={() => switchView('blackouts')}
                className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-800 text-left hover:bg-red-100 transition">
                <div className="font-semibold mb-0.5">🚫 {activeBlackouts.length} active blackout{activeBlackouts.length > 1 ? 's' : ''}</div>
                {activeBlackouts.map((b, i) => (
                  <div key={i} className="text-xs text-red-600 font-mono truncate max-w-xs">{b.campaign}{b.source ? ` · ${b.source}` : ''}</div>
                ))}
              </button>
            )}
            {spokenAll > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-sm text-emerald-800">
                ✅ <span className="font-semibold">{spokenAll}</span> leads contacted today (hidden)
              </div>
            )}
          </div>
        </div>

        {/* Per-counsellor cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {rows.map((row) => (
            <CounsellorCard key={row.name} row={row}
              onDrillDown={() => navigate('/admin', { state: { counsellor: row.name } })} />
          ))}
        </div>

        {/* Section breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-800">Section Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Section</th>
                  {COUNSELLORS.map(c => (
                    <th key={c} className="px-4 py-3 text-center font-semibold text-gray-700">{c.split(' ')[0]}</th>
                  ))}
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {SECTION_META.map(sec => {
                  const counts = rows.map(r => r.data?.[sec.key]?.length ?? null)
                  const total  = counts.every(c => c !== null) ? counts.reduce((s, c) => s + c, 0) : null
                  const c = COLOR[sec.color]
                  return (
                    <tr key={sec.key} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${c.bg} ${c.text} border ${c.border}`}>{sec.label}</span>
                      </td>
                      {counts.map((count, i) => (
                        <td key={i} className="px-4 py-3 text-center font-semibold text-gray-800">
                          {rows[i].loading ? <span className="text-gray-300">—</span> : count ?? <span className="text-red-400">err</span>}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-center font-bold text-blue-700">
                        {total !== null ? total : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  )
                })}
                <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                  <td className="px-4 py-3 text-gray-700">Total</td>
                  {rows.map((r, i) => (
                    <td key={i} className="px-4 py-3 text-center text-blue-700">
                      {r.loading ? <span className="text-gray-300">—</span> : (r.data?.total ?? <span className="text-red-400">err</span>)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center text-blue-700">{totalAll || '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

// ─── Counsellor card ──────────────────────────────────────────────────────────

function CounsellorCard({ row, onDrillDown }) {
  const { name, data, loading, error } = row
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 text-blue-700 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm">
            {name.split(' ').map(w => w[0]).join('')}
          </div>
          <div>
            <p className="font-semibold text-gray-800">{name}</p>
            {data?.spokenToday?.total > 0 && (
              <p className="text-xs text-emerald-600">✅ {data.spokenToday.total} spoken today</p>
            )}
          </div>
        </div>
        <button onClick={onDrillDown} className="text-xs text-blue-600 hover:underline">View →</button>
      </div>
      <div className="p-5">
        {loading && (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-2" />
            Loading…
          </div>
        )}
        {error && <p className="text-center text-red-500 text-sm py-6">Failed to load</p>}
        {data && (
          <>
            <div className="text-center mb-4">
              <span className="text-4xl font-bold text-blue-700">{data.total}</span>
              <span className="text-sm text-gray-500 ml-1">/ 300 leads</span>
            </div>
            <div className="space-y-2">
              {SECTION_META.map(sec => {
                const count = data[sec.key]?.length ?? 0
                const c = COLOR[sec.color]
                return (
                  <div key={sec.key} className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${c.text}`}>{sec.label}</span>
                    <span className="font-semibold text-gray-800">{count}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Blackout list page ───────────────────────────────────────────────────────

function BlackoutListPage({ blackouts, loading, onBack, onSelect, onReload, onBlackoutChange }) {
  const [saving, setSaving] = useState(false)
  const [msg,    setMsg]    = useState('')
  const [form,   setForm]   = useState({ campaign: '', source: '', startDate: '', endDate: '' })

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 5000) }

  const handleAdd = async () => {
    if (!form.campaign.trim())              { flash('Campaign name is required.'); return }
    if (!form.startDate || !form.endDate)   { flash('Both start and end dates are required.'); return }
    if (form.startDate > form.endDate)      { flash('Start date must be before end date.'); return }
    setSaving(true)
    try {
      const { fetchSheetData } = await import('../utils/sheetsApi')
      const before = await fetchSheetData('Campaign Blackouts', 'A:D').catch(() => [])
      const beforeCount = before.length

      if (!APPS_SCRIPT_URL) {
        flash('VITE_APPS_SCRIPT_URL is not set in .env — blackout cannot be saved.')
        return
      }

      const url = `${APPS_SCRIPT_URL}?action=addBlackout`
        + `&campaign=${encodeURIComponent(form.campaign.trim())}`
        + `&source=${encodeURIComponent(form.source.trim())}`
        + `&startDate=${encodeURIComponent(form.startDate)}`
        + `&endDate=${encodeURIComponent(form.endDate)}`
      await fetch(url, { method: 'GET', mode: 'no-cors' })
      await new Promise(r => setTimeout(r, 3000))

      const after = await fetchSheetData('Campaign Blackouts', 'A:D').catch(() => [])
      if (after.length <= beforeCount) {
        flash('⚠️ Apps Script did not write the row. Go to Apps Script → Deploy → Manage deployments → Edit → New version → Deploy, then try again.')
        return
      }

      bustCounsellorCaches()
      await onReload()
      onBlackoutChange()
      setForm({ campaign: '', source: '', startDate: '', endDate: '' })
      flash('Blackout saved. Counsellor queues will update on next refresh.')
    } catch (e) {
      flash('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (b) => {
    if (!confirm(`Remove blackout for "${b.campaign}"?`)) return
    setSaving(true)
    try {
      if (APPS_SCRIPT_URL) {
        const url = `${APPS_SCRIPT_URL}?action=deleteBlackout&rowIndex=${b.rowIndex}`
        await fetch(url, { method: 'GET', mode: 'no-cors' })
        await new Promise(r => setTimeout(r, 3000))
      }
      bustCounsellorCaches()
      await onReload()
      onBlackoutChange()
      flash('Blackout removed. Leads will reappear on next counsellor refresh.')
    } catch (e) {
      flash('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const sorted = [...blackouts].sort((a, b) => {
    const order = { active: 0, upcoming: 1, expired: 2 }
    return order[blackoutStatus(a.startDate, a.endDate)] - order[blackoutStatus(b.startDate, b.endDate)]
  })

  return (
    <div className="max-w-[1400px] mx-auto px-3 md:px-6 py-4 md:py-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack}
            className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition">
            ← Back
          </button>
          <div>
            <h2 className="text-lg font-bold text-gray-800">Blackout Logs</h2>
            <p className="text-xs text-gray-500">Campaign holds — leads are hidden during the window and reappear automatically after it ends</p>
          </div>
        </div>
        {msg && (
          <span className="text-xs font-medium px-3 py-1.5 rounded-lg border bg-blue-50 border-blue-200 text-blue-700">{msg}</span>
        )}
      </div>

      {/* Blackout table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            <span className="text-sm">Loading blackout logs…</span>
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3">🚫</div>
            <p className="text-sm font-medium text-gray-600">No blackout windows yet</p>
            <p className="text-xs text-gray-400 mt-1">Add one below to suppress a campaign during a webinar or event.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Campaign</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Source</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide">Window</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((b, i) => {
                const status = blackoutStatus(b.startDate, b.endDate)
                const s = STATUS_STYLE[status]
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${s.badge}`}>
                        {STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-800 max-w-[220px]">
                      <span className="truncate block">{b.campaign}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{b.source || <span className="italic text-gray-400">Any</span>}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      {fmtDate(b.startDate)} → {fmtDate(b.endDate)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {status !== 'expired' && (
                          <button onClick={() => onSelect(b)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium transition">
                            View leads →
                          </button>
                        )}
                        <button onClick={() => handleRemove(b)} disabled={saving}
                          className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-500 transition disabled:opacity-40">
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add new blackout */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="font-semibold text-gray-800 mb-1">Add blackout window</h3>
        <p className="text-xs text-gray-500 mb-4">Leads from this campaign will be hidden from all counsellor queues during the window.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Campaign name <span className="text-red-500">*</span></label>
            <input type="text" placeholder="PGP_DSAI_Web_Conv_…"
              value={form.campaign} onChange={e => setForm(f => ({ ...f, campaign: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Source <span className="text-gray-400">(blank = any)</span></label>
            <input type="text" placeholder="IG / Google / Meta…"
              value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Start date <span className="text-red-500">*</span></label>
            <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">End date <span className="text-red-500">*</span></label>
            <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <button onClick={handleAdd} disabled={saving}
          className="px-5 py-2 bg-gray-900 hover:bg-gray-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50">
          {saving ? 'Saving…' : '+ Add Blackout Window'}
        </button>
        {!APPS_SCRIPT_URL && (
          <p className="text-xs text-amber-600 mt-2">Apps Script URL not configured — add the row directly in the "Campaign Blackouts" Google Sheet tab.</p>
        )}
      </div>
    </div>
  )
}

// ─── Blackout detail page ─────────────────────────────────────────────────────

function extractBlackoutLeads(rows, campaign, source, type) {
  const isLead    = type === 'Lead'
  const campIdx   = isLead ? 7  : 22   // col H for Lead Dump, col W for App Start
  const srcIdx    = isLead ? 6  : 18
  const nameIdx   = isLead ? 0  : 12
  const emailIdx  = isLead ? 1  : 13
  const mobileIdx = isLead ? 2  : 14
  const cslrIdx   = isLead ? 20 : 43
  const stageIdx  = isLead ? 21 : 46
  const regIdx    = isLead ? 18 : 16

  const campLower = campaign.toLowerCase()
  const srcLower  = (source || '').toLowerCase()

  return rows.slice(1).filter(row => {
    if (String(row[campIdx] || '').trim().toLowerCase() !== campLower) return false
    if (source && String(row[srcIdx] || '').trim().toLowerCase() !== srcLower) return false
    return true
  }).map(row => ({
    name:        String(row[nameIdx]   || '').trim(),
    email:       String(row[emailIdx]  || '').trim(),
    mobile:      String(row[mobileIdx] || '').trim(),
    counsellor:  String(row[cslrIdx]   || '').trim() || 'Unassigned',
    stage:       String(row[stageIdx]  || '').trim() || '—',
    source:      String(row[srcIdx]    || '').trim() || '—',
    registeredOn: row[regIdx],
    type,
  }))
}

function BlackoutDetailPage({ blackout, onBack }) {
  const [leads,      setLeads]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [activeTab,  setActiveTab]  = useState('All')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError('')
      try {
        const { fetchSheetData } = await import('../utils/sheetsApi')
        const results = await Promise.allSettled([
          fetchSheetData('Lead Dump',                  'A:BW'),
          fetchSheetData('Followup Sheet - LEAD',      'A:BW'),
          fetchSheetData('New - App start',            'A:EU'),
          fetchSheetData('Followup sheet - App start', 'A:EU'),
        ])
        const [leadDump, followupLead, appStart, appFollowup] = results.map(r =>
          r.status === 'fulfilled' ? r.value : []
        )
        const { campaign, source } = blackout
        const all = [
          ...extractBlackoutLeads(leadDump,    campaign, source, 'Lead'),
          ...extractBlackoutLeads(followupLead, campaign, source, 'Lead'),
          ...extractBlackoutLeads(appStart,    campaign, source, 'App Start'),
          ...extractBlackoutLeads(appFollowup, campaign, source, 'App Start'),
        ]
        // Deduplicate by mobile (last 10 digits), then email
        const seen = new Set()
        const deduped = all.filter(l => {
          const key = l.mobile.replace(/\D/g, '').slice(-10) || l.email.toLowerCase()
          if (!key || seen.has(key)) return false
          seen.add(key); return true
        })
        if (!cancelled) setLeads(deduped)
      } catch (e) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [blackout.campaign, blackout.source])

  const counsellors   = ['All', ...Array.from(new Set(leads.map(l => l.counsellor))).sort()]
  const visibleLeads  = activeTab === 'All' ? leads : leads.filter(l => l.counsellor === activeTab)
  const status        = blackoutStatus(blackout.startDate, blackout.endDate)
  const s             = STATUS_STYLE[status]

  return (
    <div className="max-w-[1400px] mx-auto px-3 md:px-6 py-4 md:py-6 space-y-5">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition shrink-0">
          ← Blackout logs
        </button>
        <h2 className="text-lg font-bold text-gray-800 truncate">Leads filtered by blackout</h2>
      </div>

      {/* Blackout summary card */}
      <div className={`rounded-xl border p-4 flex flex-wrap gap-4 items-start ${s.row}`}>
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${s.badge}`}>{STATUS_LABEL[status]}</span>
        <div className="flex-1 min-w-0">
          <p className="font-mono font-semibold text-sm break-all">{blackout.campaign}</p>
          <p className="text-xs mt-0.5 opacity-70">
            Source: {blackout.source || 'Any'} &nbsp;·&nbsp; {fmtDate(blackout.startDate)} → {fmtDate(blackout.endDate)}
          </p>
        </div>
        {!loading && (
          <div className="text-right shrink-0">
            <span className="text-2xl font-bold">{leads.length}</span>
            <p className="text-xs opacity-70">leads affected</p>
          </div>
        )}
      </div>

      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 py-20 flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          <span className="text-sm">Fetching leads…</span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">{error}</div>
      )}

      {!loading && !error && leads.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 py-20 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-sm font-medium text-gray-600">No leads found for this campaign</p>
          <p className="text-xs text-gray-400 mt-1">The campaign name must match exactly what's in the CRM (col H for leads, col W for app starts).</p>
        </div>
      )}

      {!loading && !error && leads.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Counsellor tabs */}
          <div className="flex gap-1 px-4 pt-4 pb-0 border-b border-gray-100 overflow-x-auto">
            {counsellors.map(c => (
              <button key={c} onClick={() => setActiveTab(c)}
                className={`px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 whitespace-nowrap transition ${
                  activeTab === c
                    ? 'border-blue-600 text-blue-700 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {c} {c === 'All' ? `(${leads.length})` : `(${leads.filter(l => l.counsellor === c).length})`}
              </button>
            ))}
          </div>

          {/* Lead table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Name', 'Mobile', 'Counsellor', 'Type', 'Stage', 'Source', 'Registered On'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleLeads.map((l, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800 text-xs">{l.name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600 font-mono">{l.mobile || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{l.counsellor}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${l.type === 'Lead' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                        {l.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{l.stage}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{l.source}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(l.registeredOn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Cache validity ───────────────────────────────────────────────────────────

const REFRESH_HOURS = [8, 12, 16, 19] // 8 AM, 12 PM, 4 PM, 7 PM

function lastScheduledRefresh() {
  const now = new Date()
  const passed = REFRESH_HOURS
    .map(h => { const d = new Date(now); d.setHours(h, 0, 0, 0); return d })
    .filter(t => t <= now)
  if (passed.length > 0) return passed[passed.length - 1]
  const prev = new Date(now); prev.setDate(prev.getDate() - 1); prev.setHours(19, 0, 0, 0)
  return prev
}

function isCacheValid(cacheTime) {
  if (!cacheTime) return false
  return new Date(cacheTime) >= lastScheduledRefresh()
}
