import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { ROUTES } from './lib/routes.js'
import './App.css'
import './account.css'
import './admin-accounts.css'
import './admin-extensions.css'
import './responsive.css'

const AuthPage = lazy(() => import('./pages/AuthPage.jsx'))
const CreateQuizPage = lazy(() => import('./pages/CreateQuizPage.jsx'))
const HomePage = lazy(() => import('./pages/HomePage.jsx'))
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'))
const AdminAccountsPage = lazy(() => import('./pages/AdminAccountsPage.jsx'))
const CreateRoomPage = lazy(() => import('./pages/CreateRoomPage.jsx'))
const RoomPage = lazy(() => import('./pages/RoomPage.jsx'))
const QuizPartyRoomPage = lazy(() => import('./pages/QuizPartyRoomPage.jsx'))
const GameModePickerPage = lazy(() => import('./pages/GameModePickerPage.jsx'))
const PetPage = lazy(() => import('./pages/PetPage.jsx'))
const BoltSortGamePage = lazy(() => import('./pages/BoltSortGamePage.jsx'))

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
    <Suspense fallback={<RouteLoading />}>
      <Routes>
      <Route path={ROUTES.home} element={<HomePage />} />
      <Route path={ROUTES.login} element={<AuthRoute mode="login" />} />
      <Route path={ROUTES.register} element={<AuthRoute mode="register" />} />
      <Route path={ROUTES.profile} element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path={ROUTES.adminAccounts} element={<ProtectedRoute><AdminAccountsPage /></ProtectedRoute>} />
      <Route path={ROUTES.play} element={<GameModePickerPage />} />
      <Route path={ROUTES.pet} element={<PetPage />} />
      <Route path={ROUTES.boltSort} element={<BoltSortGamePage />} />
      <Route path={ROUTES.createRoom} element={<ProtectedRoute><CreateRoomPage /></ProtectedRoute>} />
      <Route path={ROUTES.createQuiz} element={<ProtectedRoute><CreateQuizPage /></ProtectedRoute>} />
      <Route path={`${ROUTES.createQuiz}/:quizId`} element={<ProtectedRoute><CreateQuizPage /></ProtectedRoute>} />
      <Route path={`${ROUTES.room}/:code`} element={<ProtectedRoute><RoomPage /></ProtectedRoute>} />
      <Route path={`${ROUTES.quizParty}/:code`} element={<ProtectedRoute><QuizPartyRoomPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
      </Routes>
    </Suspense>
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
