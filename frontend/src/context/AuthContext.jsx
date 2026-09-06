import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import * as authService from '../services/authService.js'
import { saveAccessToken } from '../services/apiClient.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  /**
   * apiClient tự lấy access_token mới nhất từ supabase.auth.getSession()
   * trước mỗi request (xem apiClient.js::getFreshAccessToken), nên ở đây
   * chỉ cần biết có user đang đăng nhập hay không rồi gọi backend.
   */
  const loadProfile = useCallback(async (currentSession) => {
    let activeSession = currentSession
    if (activeSession === undefined) {
      const {
        data: { session: latest },
      } = await supabase.auth.getSession()
      activeSession = latest
    }

    if (!activeSession?.user) {
      setProfile(null)
      return null
    }
    try {
      const { profile: p } = await authService.fetchMe()
      setProfile(p)
      return p
    } catch (err) {
      console.error('Lỗi lấy profile:', err)
      setProfile(null)
      return null
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const init = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      if (!mounted) return
      setSession(currentSession)

      if (currentSession?.user) {
        await loadProfile(currentSession)
      }
      setAuthReady(true)
    }

    init()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return
      setSession(newSession)
      if (newSession?.user) {
        await loadProfile(newSession)
      } else {
        saveAccessToken(null)
        setProfile(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const logout = useCallback(async () => {
    await authService.logout()
    setSession(null)
    setProfile(null)
  }, [])

  const value = {
    session,
    profile,
    authReady,
    isLoggedIn: !!session,
    isAdmin: profile?.role === 'admin',
    isMember: !!profile?.is_member,
    reloadProfile: loadProfile,
    setSession,
    setProfile,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải được dùng bên trong <AuthProvider>')
  return ctx
}
