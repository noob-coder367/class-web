import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import * as authService from '../services/authService.js'
import { saveAccessToken } from '../services/apiClient.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const profileRef = useRef(null)

  useEffect(() => {
    profileRef.current = profile
  }, [profile])

  /**
   * apiClient tự lấy access_token mới nhất từ supabase.auth.getSession()
   * trước mỗi request. Khi /auth/me lỗi tạm thời (token sắp hết hạn, mạng),
   * KHÔNG xóa profile cũ để tránh mất nút Vô lớp / Admin.
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

    const tryFetch = async () => {
      const { profile: p } = await authService.fetchMe()
      setProfile(p)
      return p
    }

    try {
      return await tryFetch()
    } catch (err) {
      console.warn('Lỗi lấy profile (lần 1):', err?.message || err)

      // Token hết hạn / không hợp lệ → refresh rồi thử lại
      if (err?.status === 401) {
        try {
          const { data, error } = await supabase.auth.refreshSession()
          if (!error && data?.session) {
            saveAccessToken(data.session.access_token)
            setSession(data.session)
            try {
              return await tryFetch()
            } catch (err2) {
              console.warn('Lỗi lấy profile sau refresh:', err2?.message || err2)
            }
          }
        } catch (refreshErr) {
          console.warn('Refresh session thất bại:', refreshErr?.message || refreshErr)
        }
      }

      // Giữ profile cũ nếu còn session — tránh mất nút Vô lớp / Admin
      if (profileRef.current) {
        return profileRef.current
      }
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
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return
      setSession(newSession)
      if (newSession?.user) {
        // TOKEN_REFRESHED: cập nhật token, chỉ reload profile nếu chưa có
        if (event === 'TOKEN_REFRESHED' && profileRef.current) {
          if (newSession.access_token) {
            saveAccessToken(newSession.access_token)
          }
          return
        }
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
