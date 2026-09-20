import { useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { WeatherProvider } from './context/WeatherContext.jsx'
import HomePage from './pages/HomePage.jsx'
import OceanScrollBackground from './components/OceanScrollBackground.jsx'
import LocationPermissionModal from './components/LocationPermissionModal.jsx'
import GlobalRefreshButton from './components/GlobalRefreshButton.jsx'
import { ROUTES } from './lib/routes.js'
import './App.css'

function AppShell() {
  const location = useLocation()
  // Yêu cầu: nền Ocean Scroll KHÔNG được xuất hiện ở /vo-lop và các sub-route
  // của nó (để giảm lag) — mọi route khác (trang chủ, đăng nhập...) giữ nguyên.
  const hideOcean = location.pathname.startsWith(ROUTES.classRoot)

  return (
    <>
      {!hideOcean && <OceanScrollBackground />}
      <HomePage />
      <LocationPermissionModal />
      <GlobalRefreshButton />
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <WeatherProvider>
        <AppShell />
      </WeatherProvider>
    </AuthProvider>
  )
}
