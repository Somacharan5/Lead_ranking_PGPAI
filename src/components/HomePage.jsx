import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-2xl w-full">
        <div className="text-center mb-10">
          <div className="inline-block bg-blue-600 text-white w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold mb-4">
            🎯
          </div>
          <h1 className="text-3xl font-bold text-gray-800">AIAS Counsellor Dashboard</h1>
          <p className="text-gray-500 mt-2">Masters Union | PG AIAS Programme</p>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-gray-600 mb-4 font-medium">Direct Access Links:</p>
          
          <Link to="/jasmeet" className="block p-4 bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 rounded-lg transition">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-blue-700">👤 Jasmeet Kaur</span>
              <span className="text-xs text-blue-500">/jasmeet →</span>
            </div>
          </Link>
          
          <Link to="/komal" className="block p-4 bg-green-50 hover:bg-green-100 border-2 border-green-200 rounded-lg transition">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-green-700">👤 Komal Pandey</span>
              <span className="text-xs text-green-500">/komal →</span>
            </div>
          </Link>
          
          <Link to="/prerna" className="block p-4 bg-purple-50 hover:bg-purple-100 border-2 border-purple-200 rounded-lg transition">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-purple-700">👤 Prerna Kaushik</span>
              <span className="text-xs text-purple-500">/prerna →</span>
            </div>
          </Link>
          
          <Link to="/sanjana" className="block p-4 bg-teal-50 hover:bg-teal-100 border-2 border-teal-200 rounded-lg transition">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-teal-700">👤 Sanjana</span>
              <span className="text-xs text-teal-500">/sanjana →</span>
            </div>
          </Link>

          <Link to="/drishti" className="block p-4 bg-orange-50 hover:bg-orange-100 border-2 border-orange-200 rounded-lg transition">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-orange-700">👤 Drishti Majumdar</span>
              <span className="text-xs text-orange-500">/drishti →</span>
            </div>
          </Link>

          <Link to="/ishan" className="block p-4 bg-fuchsia-50 hover:bg-fuchsia-100 border-2 border-fuchsia-200 rounded-lg transition">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-fuchsia-700">👤 Ishan Ali</span>
              <span className="text-xs text-fuchsia-500">/ishan →</span>
            </div>
          </Link>

          <Link to="/sunny" className="block p-4 bg-rose-50 hover:bg-rose-100 border-2 border-rose-200 rounded-lg transition">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-rose-700">👤 Sunny Singh</span>
              <span className="text-xs text-rose-500">/sunny →</span>
            </div>
          </Link>

          <Link to="/admin" className="block p-4 bg-amber-50 hover:bg-amber-100 border-2 border-amber-200 rounded-lg transition">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-amber-700">👨‍💼 Admin — Detailed View</span>
              <span className="text-xs text-amber-500">/admin →</span>
            </div>
          </Link>

          <Link to="/admin/overview" className="block p-4 bg-indigo-50 hover:bg-indigo-100 border-2 border-indigo-200 rounded-lg transition">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-indigo-700">📊 Admin — Overview (All Counsellors)</span>
              <span className="text-xs text-indigo-500">/admin/overview →</span>
            </div>
          </Link>
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          Bookmark your dashboard URL for quick access
        </p>
      </div>
    </div>
  )
}
