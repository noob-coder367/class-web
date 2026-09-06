import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import * as authService from '../services/authService.js'
import { getAccessToken, saveAccessToken } from '../services/apiClient.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  /**
   * Đăng nhập bằng username/password hoặc OTP sẽ tự lưu access_token
   * qua applySession() trong authService. Nhưng đăng nhập Google (OAuth)
   * đi thẳng qua supabase.auth.signInWithOAuth và KHÔNG chạy qua
   * applySession(), nên access_token dùng để gọi backend
   * (localStorage 'class-web:access_token') không bao giờ được set.
   * => loadProfile() luôn thấy "chưa có token" và bỏ qua gọi /api/auth/me,
   * khiến profile luôn null và mất quyền admin dù DB đúng.
   *
   * Sửa: mỗi khi có session Supabase hợp lệ, luôn đồng bộ access_token
   * của session đó vào localStorage trước khi gọi backend, bất kể
   * người dùng đăng nhập bằng cách nào.
   */
  const loadProfile = useCallback(async (currentSession) => {
    const sbToken = currentSession?.access_token
    if (sbToken && sbToken !== getAccessToken()) {
      saveAccessToken(sbToken)
    }

    if (!getAccessToken()) {
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
