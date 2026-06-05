import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import HomePage from './components/HomePage'
import AdminOverview from './components/AdminOverview'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/jasmeet" element={<Dashboard counsellorName="Jasmeet Kaur" isAdmin={false} />} />
        <Route path="/komal" element={<Dashboard counsellorName="Komal Pandey" isAdmin={false} />} />
        <Route path="/prerna" element={<Dashboard counsellorName="Prerna Kaushik" isAdmin={false} />} />
        <Route path="/sanjana" element={<Dashboard counsellorName="Sanjana" isAdmin={false} />} />
        <Route path="/drishti" element={<Dashboard counsellorName="Drishti Majumdar" isAdmin={false} />} />
        <Route path="/megha" element={<Dashboard counsellorName="Megha Saini" isAdmin={false} />} />
        <Route path="/admin" element={<Dashboard counsellorName="Jasmeet Kaur" isAdmin={true} />} />
        <Route path="/admin/overview" element={<AdminOverview />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
