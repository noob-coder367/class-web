import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import AuthPage from './pages/AuthPage.jsx'
import HomePage from './pages/HomePage.jsx'
import './App.css'

function AuthRoute({ mode }) {
  const { authReady, isLoggedIn } = useAuth()
  if (!authReady) return <main className="route-loading" aria-label="Đang tải phiên đăng nhập"><span /></main>
  if (isLoggedIn) return <Navigate to="/" replace />
  return <AuthPage mode={mode} />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/dang-nhap" element={<AuthRoute mode="login" />} />
      <Route path="/dang-ky" element={<AuthRoute mode="register" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
