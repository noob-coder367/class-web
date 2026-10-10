import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { clearAuthRedirectFromUrl, initialAuthRedirect, supabase } from '../lib/supabaseClient.js'
import { useToast } from './ToastContext.jsx'
import * as authService from '../services/authService.js'
import { setSessionSnapshot } from '../services/apiClient.js'
import { isAdminRole } from '../lib/roles.js'

const AuthContext = createContext(null)
let redirectErrorHandled = false

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const toast = useToast()

  const loadProfile = useCallback(async (currentSession) => {
    let activeSession = currentSession
    if (activeSession === undefined) {
      const { data: { session: latestSession } } = await supabase.auth.getSession()
      activeSession = latestSession
    }
    if (!activeSession?.user) {
      setProfile(null)
      return null
    }
    try {
      const { profile: nextProfile } = await authService.fetchMe()
      setProfile(nextProfile || null)
      return nextProfile || null
    } catch (error) {
      console.warn('[auth] Không tải được hồ sơ:', error?.message || error)
      setProfile(null)
      return null
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const initialize = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(currentSession)
      setSessionSnapshot(currentSession)
      if (currentSession?.user) await loadProfile(currentSession)
      if (mounted) setAuthReady(true)
    }
    void initialize()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      setSessionSnapshot(nextSession)
      if (nextSession?.user) {
        if (event === 'SIGNED_IN' && authService.consumeOAuthPending()) toast.success('Đăng nhập bằng Google thành công')
        if (event !== 'TOKEN_REFRESHED') {
          setAuthReady(false)
          void loadProfile(nextSession).finally(() => { if (mounted) setAuthReady(true) })
        }
      } else {
        setProfile(null)
        setAuthReady(true)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile, toast])

  // Link email / OAuth quay về với lỗi trên URL (vd: người dùng huỷ Google, link hết hạn)
  useEffect(() => {
    const { error } = initialAuthRedirect
    if (!error || redirectErrorHandled) return
    redirectErrorHandled = true
    const fromGoogle = authService.consumeOAuthPending()
    clearAuthRedirectFromUrl()
    if (error.expired) toast.error('Liên kết đã hết hạn. Vui lòng thử lại.')
    else if (fromGoogle) toast.error('Đăng nhập bằng Google không thành công. Vui lòng thử lại.')
    else toast.error('Không thể hoàn tất yêu cầu. Vui lòng thử lại.')
  }, [toast])

  const logout = useCallback(async () => {
    try {
      await authService.logout()
      toast.success('Đăng xuất thành công')
    } catch {
      toast.error('Không thể đăng xuất hoàn toàn. Vui lòng thử lại.')
    } finally {
      setSession(null)
      setProfile(null)
      setSessionSnapshot(null)
    }
  }, [toast])

  const value = {
    session,
    profile,
    authReady,
    isLoggedIn: Boolean(session?.user),
    isAdmin: isAdminRole(profile?.role),
    setSession,
    setProfile,
    reloadProfile: loadProfile,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth phải được dùng bên trong <AuthProvider>')
  return context
}
