import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import AuthPage from './pages/AuthPage.jsx'
import HomePage from './pages/HomePage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import { ROUTES } from './lib/routes.js'
import './App.css'
import './account.css'

function RouteLoading() {
  return <main className="route-loading" aria-label="Đang tải phiên đăng nhập"><span /></main>
}

function AuthRoute({ mode }) {
  const { authReady, isLoggedIn } = useAuth()
  if (!authReady) return <RouteLoading />
  if (isLoggedIn) return <Navigate to={ROUTES.home} replace />
  return <AuthPage key={mode} mode={mode} />
}

function ProtectedRoute({ children }) {
  const { authReady, isLoggedIn } = useAuth()
  if (!authReady) return <RouteLoading />
  if (!isLoggedIn) return <Navigate to={ROUTES.login} replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.home} element={<HomePage />} />
      <Route path={ROUTES.login} element={<AuthRoute mode="login" />} />
      <Route path={ROUTES.register} element={<AuthRoute mode="register" />} />
      <Route path={ROUTES.profile} element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ToastProvider>
  )
}
