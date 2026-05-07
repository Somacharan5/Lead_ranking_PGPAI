import { useState } from 'react'

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const COLUMNS = [
  { key: 'index',                   label: '#',              sortable: false },
  { key: 'category',                label: 'Category',       sortable: false },
  { key: 'score',                   label: 'Score',          sortable: true  },
  { key: 'priority',                label: 'Priority',       sortable: true  },
  { key: 'name',                    label: 'Name',           sortable: true  },
  { key: 'email',                   label: 'Email',          sortable: false },
  { key: 'mobile',                  label: 'Mobile',         sortable: false },
  { key: 'source',                  label: 'Source',         sortable: true  },
  { key: 'registeredOn',            label: 'Registered On',  sortable: true  },
  { key: 'medium',                  label: 'Medium',         sortable: false },
  { key: 'counsellorLastActivity',  label: 'Last Activity',  sortable: true  },
  { key: 'campaign',                label: 'Campaign',       sortable: false },
  { key: 'stage',                   label: 'Stage',          sortable: true  },
  { key: 'subStage',                label: 'Sub Stage',      sortable: false },
  { key: 'notes',                   label: 'Notes',          sortable: false },
  { key: 'counsellor',              label: 'Counsellor',     sortable: false },
]

function sortValue(lead, key) {
  if (key === 'priority') {
    return parseInt((lead.priority || '').replace(/\D/g, '')) || 99
  }
  if (key === 'registeredOn' || key === 'counsellorLastActivity') {
    const d = new Date(lead[key])
    return isNaN(d) ? 0 : d.getTime()
  }
  return lead[key] ?? ''
}

export default function LeadTable({ leads }) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('score')
  const [sortDir, setSortDir] = useState('desc')

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'score' ? 'desc' : 'asc')
    }
  }

  const filtered = search
    ? leads.filter(l =>
        Object.values(l).some(v =>
          String(v).toLowerCase().includes(search.toLowerCase())
        )
      )
    : leads

  const filteredLeads = [...filtered].sort((a, b) => {
    const av = sortValue(a, sortKey)
    const bv = sortValue(b, sortKey)
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <div className="text-5xl mb-4">📭</div>
        <p className="text-gray-500 text-lg">No leads in this category</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Search */}
      <div className="p-4 border-b border-gray-200">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search leads by name, email, mobile..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-2">
          Showing {filteredLeads.length} of {leads.length} leads
        </p>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden divide-y divide-gray-100">
        {filteredLeads.map((lead, idx) => (
          <MobileCard key={idx} lead={lead} idx={idx} />
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
            <tr>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className={`px-3 py-3 text-left font-semibold text-gray-700 whitespace-nowrap ${col.sortable ? 'cursor-pointer select-none hover:bg-gray-100' : ''}`}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  {col.label}
                  {col.sortable && (
                    <span className="ml-1 text-gray-400">
                      {sortKey === col.key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredLeads.map((lead, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition">
                <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                <td className="px-3 py-2"><CategoryBadge category={lead.category} /></td>
                <td className="px-3 py-2 font-bold text-blue-700">{lead.score}</td>
                <td className="px-3 py-2">
                  {lead.priority && <PriorityBadge priority={lead.priority} />}
                </td>
                <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{lead.name}</td>
                <td className="px-3 py-2 text-gray-600">{lead.email}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {lead.mobile
                    ? <a href={`tel:${lead.mobile}`} className="text-blue-600 hover:underline">{lead.mobile}</a>
                    : ''}
                </td>
                <td className="px-3 py-2 text-gray-600">{lead.source}</td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs">{formatDate(lead.registeredOn)}</td>
                <td className="px-3 py-2 text-gray-600">{lead.medium}</td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs">{formatDate(lead.counsellorLastActivity)}</td>
                <td className="px-3 py-2 text-gray-600 max-w-[200px] truncate" title={lead.campaign}>{lead.campaign}</td>
                <td className="px-3 py-2 text-gray-600">{lead.stage}</td>
                <td className="px-3 py-2 text-gray-600">{lead.subStage}</td>
                <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate" title={lead.notes}>{lead.notes}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{lead.counsellor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MobileCard({ lead, idx }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="p-4">
      {/* Top row: number + category + score + priority */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 font-medium">#{idx + 1}</span>
          <CategoryBadge category={lead.category} />
          {lead.priority && <PriorityBadge priority={lead.priority} />}
        </div>
        <span className="text-lg font-bold text-blue-700 ml-2">{lead.score}</span>
      </div>

      {/* Name */}
      <p className="font-semibold text-gray-900 text-base">{lead.name}</p>

      {/* Phone + Email */}
      <div className="flex flex-wrap gap-3 mt-1">
        {lead.mobile && (
          <a href={`tel:${lead.mobile}`} className="text-blue-600 text-sm font-medium flex items-center gap-1">
            📞 {lead.mobile}
          </a>
        )}
        {lead.email && (
          <span className="text-gray-500 text-sm truncate max-w-[200px]">{lead.email}</span>
        )}
      </div>

      {/* Stage + Last Activity */}
      <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
        {lead.stage && <span>Stage: <span className="text-gray-700 font-medium">{lead.stage}</span></span>}
        {lead.counsellorLastActivity && (
          <span>Last activity: <span className="text-gray-700 font-medium">{formatDate(lead.counsellorLastActivity)}</span></span>
        )}
        {lead.registeredOn && (
          <span>Registered: <span className="text-gray-700 font-medium">{formatDate(lead.registeredOn)}</span></span>
        )}
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="mt-2 text-xs text-blue-500 hover:underline"
      >
        {expanded ? 'Show less ▲' : 'Show more ▼'}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 space-y-1 text-xs text-gray-600 bg-gray-50 rounded-lg p-3">
          {lead.source      && <p><span className="text-gray-400">Source:</span> {lead.source}</p>}
          {lead.medium      && <p><span className="text-gray-400">Medium:</span> {lead.medium}</p>}
          {lead.campaign    && <p><span className="text-gray-400">Campaign:</span> {lead.campaign}</p>}
          {lead.subStage    && <p><span className="text-gray-400">Sub Stage:</span> {lead.subStage}</p>}
          {lead.notes       && <p><span className="text-gray-400">Notes:</span> {lead.notes}</p>}
          {lead.counsellor  && <p><span className="text-gray-400">Counsellor:</span> {lead.counsellor}</p>}
        </div>
      )}
    </div>
  )
}

function CategoryBadge({ category }) {
  const styles = {
    'Fresh Lead':    'bg-green-100 text-green-700',
    'Followup Lead': 'bg-orange-100 text-orange-700',
    'New App Start': 'bg-purple-100 text-purple-700',
    'App Followup':  'bg-pink-100 text-pink-700'
  }
  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap ${styles[category] || 'bg-gray-100 text-gray-700'}`}>
      {category}
    </span>
  )
}

function PriorityBadge({ priority }) {
  const num = parseInt((priority || '').replace(/\D/g, '')) || 0
  const colors = {
    1: 'bg-red-100 text-red-700',
    2: 'bg-orange-100 text-orange-700',
    3: 'bg-yellow-100 text-yellow-700',
    4: 'bg-blue-100 text-blue-700',
    5: 'bg-gray-100 text-gray-700'
  }
  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap ${colors[num] || 'bg-gray-100 text-gray-700'}`}>
      P{num}
    </span>
  )
}
