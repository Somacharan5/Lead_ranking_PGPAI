import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './components/HomePage'

// Code-split the heavy routes so a counsellor's dashboard doesn't download the
// admin analytics suite (AdminInsights + TranscriptionAnalysis + recharts).
const Dashboard     = lazy(() => import('./components/Dashboard'))
const AdminOverview = lazy(() => import('./components/AdminOverview'))

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/jasmeet" element={<Dashboard counsellorName="Jasmeet Kaur" isAdmin={false} />} />
          <Route path="/komal" element={<Dashboard counsellorName="Komal Pandey" isAdmin={false} />} />
          <Route path="/prerna" element={<Dashboard counsellorName="Prerna Kaushik" isAdmin={false} />} />
          <Route path="/harsha" element={<Dashboard counsellorName="Harsha" isAdmin={false} />} />
          <Route path="/drishti" element={<Dashboard counsellorName="Drishti Majumdar" isAdmin={false} />} />
          <Route path="/ishan" element={<Dashboard counsellorName="Ishan Ali" isAdmin={false} />} />
          <Route path="/sunny" element={<Dashboard counsellorName="Sunny Singh" isAdmin={false} />} />
          <Route path="/aniket" element={<Dashboard counsellorName="Aniket Singh" isAdmin={false} />} />
          <Route path="/devam" element={<Dashboard counsellorName="Devam Chandna" isAdmin={false} />} />
          <Route path="/aprajita" element={<Dashboard counsellorName="Aprajita" isAdmin={false} />} />
          <Route path="/simran" element={<Dashboard counsellorName="Simran Mishra" isAdmin={false} />} />
          <Route path="/admin" element={<Dashboard counsellorName="Jasmeet Kaur" isAdmin={true} />} />
          <Route path="/admin/overview" element={<AdminOverview />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
