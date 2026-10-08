import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import AuthPage from './pages/AuthPage.jsx'
import CreateQuizPage from './pages/CreateQuizPage.jsx'
import HomePage from './pages/HomePage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import AdminAccountsPage from './pages/AdminAccountsPage.jsx'
import CreateRoomPage from './pages/CreateRoomPage.jsx'
import RoomPage from './pages/RoomPage.jsx'
import GameModePickerPage from './pages/GameModePickerPage.jsx'
import PetPage from './pages/PetPage.jsx'
import { ROUTES } from './lib/routes.js'
import './App.css'
import './account.css'
import './admin-accounts.css'

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
  const location = useLocation()
  const { authReady, isLoggedIn, profile } = useAuth()
  if (authReady && isLoggedIn && profile?.needs_display_name && location.pathname !== ROUTES.profile) {
    return <Navigate to={ROUTES.profile} replace />
  }
  return (
    <Routes>
      <Route path={ROUTES.home} element={<HomePage />} />
      <Route path={ROUTES.login} element={<AuthRoute mode="login" />} />
      <Route path={ROUTES.register} element={<AuthRoute mode="register" />} />
      <Route path={ROUTES.profile} element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path={ROUTES.adminAccounts} element={<ProtectedRoute><AdminAccountsPage /></ProtectedRoute>} />
      <Route path={ROUTES.play} element={<GameModePickerPage />} />
      <Route path={ROUTES.pet} element={<PetPage />} />
      <Route path={ROUTES.createRoom} element={<ProtectedRoute><CreateRoomPage /></ProtectedRoute>} />
      <Route path={ROUTES.createQuiz} element={<ProtectedRoute><CreateQuizPage /></ProtectedRoute>} />
      <Route path={`${ROUTES.createQuiz}/:quizId`} element={<ProtectedRoute><CreateQuizPage /></ProtectedRoute>} />
      <Route path={`${ROUTES.room}/:code`} element={<ProtectedRoute><RoomPage /></ProtectedRoute>} />
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
