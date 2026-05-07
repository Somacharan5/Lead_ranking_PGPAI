import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getLeadsForCounsellor } from '../utils/leadProcessor'
import { triggerGlobalRefresh } from '../utils/refreshSignal'

const COUNSELLORS = ['Jasmeet Kaur', 'Komal Pandey', 'Prerna Kaushik']

const SECTION_META = [
  { key: 'freshLeads',    label: '🆕 Fresh',       color: 'green'  },
  { key: 'followupLeads', label: '🔄 Followup',     color: 'orange' },
  { key: 'newAppStart',   label: '📝 New App',      color: 'purple' },
  { key: 'appFollowup',   label: '📞 App Followup', color: 'pink'   },
]

const COLOR = {
  green:  { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200'  },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  pink:   { bg: 'bg-pink-50',   text: 'text-pink-700',   border: 'border-pink-200'   },
}

export default function AdminOverview() {
  const navigate = useNavigate()
  const [rows, setRows] = useState(
    COUNSELLORS.map(name => ({ name, data: null, loading: true, error: false }))
  )
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMessage, setRefreshMessage] = useState('')

  useEffect(() => {
    COUNSELLORS.forEach((name, i) => loadOne(name, i))
  }, [])

  const loadOne = async (name, i, force = false) => {
    setRows(prev => {
      const next = [...prev]
      next[i] = { ...next[i], loading: true, error: false }
      return next
    })

    const cacheKey = `aias_leads_${name}`
    const cacheTimeKey = `aias_cache_time_${name}`

    if (!force) {
      const cached = localStorage.getItem(cacheKey)
      const cachedTime = localStorage.getItem(cacheTimeKey)
      if (cached && cachedTime && isCacheValid(cachedTime)) {
        setRows(prev => {
          const next = [...prev]
          next[i] = { name, data: JSON.parse(cached), loading: false, error: false }
          return next
        })
        return
      }
    }

    try {
      const data = await getLeadsForCounsellor(name)
      const now = new Date()
      localStorage.setItem(cacheKey, JSON.stringify(data))
      localStorage.setItem(cacheTimeKey, now.toISOString())
      setRows(prev => {
        const next = [...prev]
        next[i] = { name, data, loading: false, error: false }
        return next
      })
    } catch {
      setRows(prev => {
        const next = [...prev]
        next[i] = { name, data: null, loading: false, error: true }
        return next
      })
    }
  }

  const handleRefreshAll = () => {
    COUNSELLORS.forEach((name, i) => loadOne(name, i, true))
  }

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

  const totalAll = rows.reduce((sum, r) => sum + (r.data?.total ?? 0), 0)
  const spokenAll = rows.reduce((sum, r) => sum + (r.data?.spokenToday?.total ?? 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="bg-amber-500 text-white w-10 h-10 rounded-full flex items-center justify-center text-xl">🛡️</div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Admin Overview</h1>
              <p className="text-sm text-gray-500">All counsellors — today's allocation</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {refreshMessage && (
              <span className="text-sm text-amber-700">{refreshMessage}</span>
            )}
            <button
              onClick={handleRefreshAll}
              className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition"
            >
              🔄 Refresh All
            </button>
            <button
              onClick={handleForceRefreshAll}
              disabled={refreshing}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {refreshing ? 'Triggering...' : '⚡ Force Refresh All'}
            </button>
            <button
              onClick={() => navigate('/admin')}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition"
            >
              📋 Detailed View
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition"
            >
              🏠
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        {/* Summary bar */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total leads today</p>
            <p className="text-3xl font-bold text-blue-700">{totalAll}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Counsellors</p>
            <p className="text-3xl font-bold text-gray-800">{COUNSELLORS.length}</p>
          </div>
          {spokenAll > 0 && (
            <div className="ml-auto bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-sm text-emerald-800">
              ✅ <span className="font-semibold">{spokenAll}</span> leads already contacted today (hidden from queues)
            </div>
          )}
        </div>

        {/* Per-counsellor cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {rows.map((row, i) => (
            <CounsellorCard key={row.name} row={row} onDrillDown={() => navigate('/admin', { state: { counsellor: row.name } })} />
          ))}
        </div>

        {/* Section-level breakdown table */}
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
                  const total = counts.every(c => c !== null) ? counts.reduce((s, c) => s + c, 0) : null
                  const c = COLOR[sec.color]
                  return (
                    <tr key={sec.key} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${c.bg} ${c.text} border ${c.border}`}>
                          {sec.label}
                        </span>
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
        <button
          onClick={onDrillDown}
          className="text-xs text-blue-600 hover:underline"
        >
          View →
        </button>
      </div>

      <div className="p-5">
        {loading && (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <div className="spinner w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full mr-2"></div>
            Loading…
          </div>
        )}
        {error && (
          <p className="text-center text-red-500 text-sm py-6">Failed to load</p>
        )}
        {data && (
          <>
            <div className="text-center mb-4">
              <span className="text-4xl font-bold text-blue-700">{data.total}</span>
              <span className="text-sm text-gray-500 ml-1">/ 200 leads</span>
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

function isCacheValid(cacheTime) {
  if (!cacheTime) return false
  const cached = new Date(cacheTime)
  const now = new Date()
  const today1030 = new Date()
  today1030.setHours(10, 30, 0, 0)
  if (cached.toDateString() === now.toDateString() && cached >= today1030) return true
  if (now < today1030 && cached.toDateString() === new Date(now - 86400000).toDateString()) return true
  return false
}
