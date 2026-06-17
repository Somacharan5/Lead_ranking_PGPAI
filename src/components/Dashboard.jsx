import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getLeadsForCounsellor } from '../utils/leadProcessor'
import { getRefreshSignal, triggerGlobalRefresh } from '../utils/refreshSignal'
import LeadTable from './LeadTable'

const COUNSELLORS = ['Jasmeet Kaur', 'Komal Pandey', 'Prerna Kaushik', 'Sanjana', 'Drishti Majumdar', 'Ishan Ali', 'Sunny Singh']
const POLL_INTERVAL_MS = 60 * 1000 // Check refresh signal every 60 seconds
const REFRESH_HOURS = [8, 12, 16, 19] // 8 AM, 12 PM, 4 PM, 7 PM

function lastScheduledRefresh() {
  const now = new Date()
  const passed = REFRESH_HOURS
    .map(h => { const d = new Date(now); d.setHours(h, 0, 0, 0); return d })
    .filter(t => t <= now)
  if (passed.length > 0) return passed[passed.length - 1]
  // Before 8 AM — last valid window was yesterday 7 PM
  const prev = new Date(now); prev.setDate(prev.getDate() - 1); prev.setHours(19, 0, 0, 0)
  return prev
}

function isCacheValid(cacheTime) {
  if (!cacheTime) return false
  return new Date(cacheTime) >= lastScheduledRefresh()
}

export default function Dashboard({ counsellorName: initialCounsellor, isAdmin }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('newapp')
  // Admin can drill in from the Overview page with a pre-selected counsellor
  const [selectedCounsellor, setSelectedCounsellor] = useState(
    location.state?.counsellor || initialCounsellor
  )
  const [lastRefresh, setLastRefresh] = useState(null)
  const [copyMessage, setCopyMessage] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMessage, setRefreshMessage] = useState('')
  const lastSignalRef       = useRef(null)
  const silentRefreshingRef = useRef(false)

  useEffect(() => {
    loadLeads()
  }, [selectedCounsellor])

  // Poll every 60s: handle admin force-refresh signal + scheduled silent auto-refresh
  useEffect(() => {
    const checkSignal = async () => {
      const signal = await getRefreshSignal()
      if (signal && lastSignalRef.current && signal > lastSignalRef.current) {
        lastSignalRef.current = signal
        loadLeads(true)
        return // loadLeads handles the refresh; skip silent check this tick
      } else if (signal && !lastSignalRef.current) {
        lastSignalRef.current = signal
      }

      // Silent auto-refresh: if cache is stale relative to scheduled windows, fetch quietly
      const cacheKey     = `aias_leads_${selectedCounsellor}`
      const cacheTimeKey = `aias_cache_time_${selectedCounsellor}`
      if (!isCacheValid(localStorage.getItem(cacheTimeKey)) && !silentRefreshingRef.current) {
        silentRefreshingRef.current = true
        try {
          const result = await getLeadsForCounsellor(selectedCounsellor)
          const now = new Date()
          localStorage.setItem(cacheKey, JSON.stringify(result))
          localStorage.setItem(cacheTimeKey, now.toISOString())
          setData(result)
          setLastRefresh(now)
        } catch {
          // Silent fail — counsellor keeps working with existing data
        } finally {
          silentRefreshingRef.current = false
        }
      }
    }

    checkSignal()
    const interval = setInterval(checkSignal, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [selectedCounsellor])

  const loadLeads = async (forceRefresh = false) => {
    setLoading(true)
    setError('')
    
    const cacheKey = `aias_leads_${selectedCounsellor}`
    const cacheTimeKey = `aias_cache_time_${selectedCounsellor}`
    
    if (!forceRefresh) {
      const cachedData = localStorage.getItem(cacheKey)
      const cachedTime = localStorage.getItem(cacheTimeKey)
      
      if (cachedData && isCacheValid(cachedTime)) {
        setData(JSON.parse(cachedData))
        setLastRefresh(new Date(cachedTime))
        setLoading(false)
        return
      }
    }
    
    try {
      const result = await getLeadsForCounsellor(selectedCounsellor)
      const now = new Date()

      localStorage.setItem(cacheKey, JSON.stringify(result))
      localStorage.setItem(cacheTimeKey, now.toISOString())

      setData(result)
      setLastRefresh(now)
    } catch (err) {
      // API down — fall back to any cached data so counsellors can still work
      const staleCached = localStorage.getItem(cacheKey)
      const staleTime   = localStorage.getItem(cacheTimeKey)
      if (staleCached && staleTime) {
        setData(JSON.parse(staleCached))
        setLastRefresh(new Date(staleTime))
        setError('⚠️ Live data unavailable — showing cached leads from ' + new Date(staleTime).toLocaleString('en-IN') + '. Refresh to retry.')
      } else {
        setError('Google Sheets is temporarily unavailable. No cached data found. Please try again in a few minutes.')
      }
    }
    setLoading(false)
  }

  const handleAdminForceRefresh = async () => {
    if (!confirm('This will trigger a refresh for ALL counsellor dashboards. Continue?')) return
    
    setRefreshing(true)
    setRefreshMessage('')
    
    // Trigger Apps Script
    const result = await triggerGlobalRefresh()
    
    if (result.success) {
      setRefreshMessage('✓ Refresh signal sent to all counsellors')
      // Refresh own data
      await loadLeads(true)
      setTimeout(() => setRefreshMessage(''), 5000)
    } else {
      setRefreshMessage(`⚠ ${result.error}`)
    }
    setRefreshing(false)
  }

  const copyAllEmails = () => {
    if (!data) return
    
    const leadsMap = {
      fresh: data.freshLeads,
      followup: data.followupLeads,
      newapp: data.newAppStart,
      appfollowup: data.appFollowup,
      mycounselling: data.myCounselling || [],
    }
    const leads = leadsMap[activeTab] || []
    const emails = leads.map(l => l.email).filter(Boolean).join(', ')
    
    if (emails) {
      navigator.clipboard.writeText(emails)
      setCopyMessage(`✓ Copied ${leads.filter(l => l.email).length} emails`)
      setTimeout(() => setCopyMessage(''), 3000)
    } else {
      setCopyMessage('No emails to copy')
      setTimeout(() => setCopyMessage(''), 3000)
    }
  }

  const getCurrentLeads = () => {
    if (!data) return []
    if (activeTab === 'fresh') return data.freshLeads
    if (activeTab === 'followup') return data.followupLeads
    if (activeTab === 'newapp') return data.newAppStart
    if (activeTab === 'appfollowup') return data.appFollowup
    if (activeTab === 'mycounselling') return data.myCounselling || []
    return []
  }

  const handleCounsellorSwitch = (newCounsellor) => {
    setSelectedCounsellor(newCounsellor)
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="spinner w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading leads from Google Sheets...</p>
          <p className="text-sm text-gray-400 mt-1">Counsellor: {selectedCounsellor}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between gap-2">
          {/* Logo + title */}
          <div className="flex items-center space-x-3 min-w-0">
            <div className="bg-blue-600 text-white w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-lg">🎯</div>
            <div className="min-w-0">
              <h1 className="text-base md:text-xl font-bold text-gray-800 leading-tight">AIAS Dashboard</h1>
              <p className="text-xs text-gray-500 truncate">
                {isAdmin ? `🛡️ ${selectedCounsellor}` : `Welcome, ${selectedCounsellor.split(' ')[0]}`}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <select
                value={selectedCounsellor}
                onChange={(e) => handleCounsellorSwitch(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded-lg bg-white text-xs font-medium hidden sm:block"
              >
                {COUNSELLORS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}

            {lastRefresh && (
              <span className="text-xs text-gray-500 hidden lg:inline">
                {lastRefresh.toLocaleTimeString()}
              </span>
            )}

            <button
              onClick={() => loadLeads(true)}
              disabled={loading}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition disabled:opacity-50"
            >
              🔄 <span className="hidden sm:inline">Refresh</span>
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={() => navigate('/admin/overview')}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium transition hidden sm:block"
                >
                  📊 Overview
                </button>
                <button
                  onClick={handleAdminForceRefresh}
                  disabled={refreshing}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition disabled:opacity-50 hidden sm:block"
                >
                  {refreshing ? '...' : '⚡ Force Refresh'}
                </button>
              </>
            )}

            {isAdmin && (
              <button
                onClick={() => navigate('/')}
                className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition"
              >
                🏠
              </button>
            )}
          </div>
        </div>

        {/* Mobile admin row */}
        {isAdmin && (
          <div className="sm:hidden px-4 pb-2 flex items-center gap-2 flex-wrap">
            <select
              value={selectedCounsellor}
              onChange={(e) => handleCounsellorSwitch(e.target.value)}
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg bg-white text-xs font-medium"
            >
              {COUNSELLORS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              onClick={() => navigate('/admin/overview')}
              className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium"
            >
              📊 Overview
            </button>
            <button
              onClick={handleAdminForceRefresh}
              disabled={refreshing}
              className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-medium disabled:opacity-50"
            >
              {refreshing ? '...' : '⚡ Force'}
            </button>
          </div>
        )}

        {refreshMessage && (
          <div className="bg-amber-50 border-t border-amber-200 px-4 py-2 text-amber-700 text-xs text-center">
            {refreshMessage}
          </div>
        )}
      </header>

      <main className="max-w-[1400px] mx-auto px-3 md:px-6 py-4 md:py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* SPOKEN-TODAY INDICATOR (v3) */}
            {data.spokenToday && data.spokenToday.total > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <span className="text-emerald-700">✅</span>
                  <span className="text-emerald-800">
                    <span className="font-semibold">{data.spokenToday.total} lead{data.spokenToday.total === 1 ? '' : 's'}</span> already contacted today
                    <span className="text-emerald-600"> — hidden from your queue</span>
                  </span>
                </div>
                <div className="text-xs text-emerald-600 hidden md:flex items-center space-x-3">
                  {data.spokenToday.fresh > 0 && <span>🆕 {data.spokenToday.fresh}</span>}
                  {data.spokenToday.followup > 0 && <span>🔄 {data.spokenToday.followup}</span>}
                  {data.spokenToday.newApp > 0 && <span>📝 {data.spokenToday.newApp}</span>}
                  {data.spokenToday.appFollowup > 0 && <span>📞 {data.spokenToday.appFollowup}</span>}
                </div>
              </div>
            )}

            {/* TAB NAVIGATION */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 overflow-hidden">
              <div className="grid grid-cols-3 md:grid-cols-5">
                <TabButton
                  active={activeTab === 'newapp'}
                  onClick={() => setActiveTab('newapp')}
                  label="📝 New App"
                  fullLabel="📝 New App Starts"
                  count={data.newAppStart.length}
                  color="purple"
                />
                <TabButton
                  active={activeTab === 'appfollowup'}
                  onClick={() => setActiveTab('appfollowup')}
                  label="📞 App FU"
                  fullLabel="📞 App Followups"
                  count={data.appFollowup.length}
                  color="pink"
                />
                <TabButton
                  active={activeTab === 'followup'}
                  onClick={() => setActiveTab('followup')}
                  label="🔄 Followup"
                  fullLabel="🔄 Followup Leads"
                  count={data.followupLeads.length}
                  color="orange"
                />
                <TabButton
                  active={activeTab === 'fresh'}
                  onClick={() => setActiveTab('fresh')}
                  label="🆕 Fresh"
                  fullLabel="🆕 Fresh Leads"
                  count={data.freshLeads.length}
                  color="green"
                />
                <TabButton
                  active={activeTab === 'mycounselling'}
                  onClick={() => setActiveTab('mycounselling')}
                  label="🤝 Counselling"
                  fullLabel="🤝 My Counselling"
                  count={(data.myCounselling || []).length}
                  color="teal"
                />
              </div>
            </div>

            {/* TOTAL LEADS BAR */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 md:p-4 mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs md:text-sm text-gray-500">Today's allocation: </span>
                <span className="text-base md:text-lg font-bold text-blue-700">{data.total} / 300</span>
              </div>
              <div className="flex items-center gap-2">
                {copyMessage && (
                  <span className="text-green-600 text-xs font-medium">{copyMessage}</span>
                )}
                <button
                  onClick={copyAllEmails}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs md:text-sm font-medium transition"
                >
                  📧 Copy Emails
                </button>
              </div>
            </div>

            <LeadTable
              key={activeTab}
              leads={getCurrentLeads()}
              defaultSortKey={activeTab === 'followup' || activeTab === 'appfollowup' ? 'priority' : 'score'}
              defaultSortDir={activeTab === 'followup' || activeTab === 'appfollowup' ? 'asc' : 'desc'}
              colorByBucket={activeTab === 'mycounselling'}
            />
          </>
        )}
      </main>
    </div>
  )
}

function TabButton({ active, onClick, label, fullLabel, count, color }) {
  const colors = {
    green:  { bg: 'bg-green-50',  text: 'text-green-700',  activeBg: 'bg-green-100',  border: 'border-green-500'  },
    orange: { bg: 'bg-orange-50', text: 'text-orange-700', activeBg: 'bg-orange-100', border: 'border-orange-500' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', activeBg: 'bg-purple-100', border: 'border-purple-500' },
    pink:   { bg: 'bg-pink-50',   text: 'text-pink-700',   activeBg: 'bg-pink-100',   border: 'border-pink-500'   },
    teal:   { bg: 'bg-teal-50',   text: 'text-teal-700',   activeBg: 'bg-teal-100',   border: 'border-teal-500'   },
  }
  const c = colors[color]

  return (
    <button
      onClick={onClick}
      className={`px-3 md:px-6 py-3 md:py-4 text-left transition border-b-4 ${
        active
          ? `${c.activeBg} ${c.border}`
          : `bg-white border-transparent hover:${c.bg}`
      }`}
    >
      <p className={`text-xs md:text-sm font-medium ${active ? c.text : 'text-gray-600'}`}>
        <span className="md:hidden">{label}</span>
        <span className="hidden md:inline">{fullLabel}</span>
      </p>
      <p className={`text-xl md:text-2xl font-bold mt-1 ${active ? c.text : 'text-gray-800'}`}>{count}</p>
    </button>
  )
}
