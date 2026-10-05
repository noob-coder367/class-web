import { Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { WeatherProvider } from './context/WeatherContext.jsx'
import HomePage from './pages/HomePage.jsx'
import ClassMembersPage from './pages/ClassMembersPage.jsx'
import OceanScrollBackground from './components/OceanScrollBackground.jsx'
import LocationPermissionModal from './components/LocationPermissionModal.jsx'
import GlobalRefreshButton from './components/GlobalRefreshButton.jsx'
import { ROUTES, classTabPath, isClassMembersPath } from './lib/routes.js'
import './App.css'

function AppShell() {
  const location = useLocation()
  // Yêu cầu: nền Ocean Scroll KHÔNG được xuất hiện ở /vo-lop và các sub-route
  // của nó (để giảm lag) — mọi route khác (trang chủ, đăng nhập...) giữ nguyên.
  const isMembersPage = isClassMembersPath(location.pathname)
  const hideOcean = location.pathname.startsWith(ROUTES.classRoot) || isMembersPage

  return (
    <>
      {!hideOcean && <OceanScrollBackground />}
      {isMembersPage ? <ClassMembersPage /> : location.pathname === ROUTES.resources ? <Navigate to={classTabPath('resources')} replace /> : <HomePage />}
      {!isMembersPage && <LocationPermissionModal />}
      {!isMembersPage && <GlobalRefreshButton />}
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
