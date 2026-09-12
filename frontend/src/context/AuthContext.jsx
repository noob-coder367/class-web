import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import * as authService from '../services/authService.js'
import { saveAccessToken } from '../services/apiClient.js'
import { capabilitiesFor, hasCapability, isAdminRole } from '../lib/roles.js'

const AuthContext = createContext(null)
const PROFILE_CACHE_KEY = 'classweb_profile_cache_v1'

function readCachedProfile(userId) {
  if (!userId) return null
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.id === userId && parsed?.profile) return parsed.profile
  } catch {
    /* ignore */
  }
  return null
}

function writeCachedProfile(userId, profile) {
  if (!userId || !profile) return
  try {
    localStorage.setItem(
      PROFILE_CACHE_KEY,
      JSON.stringify({ id: userId, profile, at: Date.now() })
    )
  } catch {
    /* ignore */
  }
}

function clearCachedProfile() {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY)
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const profileRef = useRef(null)

  useEffect(() => {
    profileRef.current = profile
  }, [profile])

  const applyProfile = useCallback((p, userId) => {
    setProfile(p)
    if (p && userId) writeCachedProfile(userId, p)
    return p
  }, [])

  /**
   * Khi /auth/me lỗi tạm: giữ profile cache / profile cũ để nút Vô lớp / Admin không biến mất.
   */
  const loadProfile = useCallback(
    async (currentSession) => {
      let activeSession = currentSession
      if (activeSession === undefined) {
        const {
          data: { session: latest },
        } = await supabase.auth.getSession()
        activeSession = latest
      }

      if (!activeSession?.user) {
        setProfile(null)
        clearCachedProfile()
        return null
      }

      const userId = activeSession.user.id

      // Hiện ngay từ cache trong lúc gọi API (tránh mất nút)
      if (!profileRef.current) {
        const cached = readCachedProfile(userId)
        if (cached) setProfile(cached)
      }

      const tryFetch = async () => {
        const { profile: p } = await authService.fetchMe()
        return applyProfile(p, userId)
      }

      try {
        return await tryFetch()
      } catch (err) {
        console.warn('Lỗi lấy profile (lần 1):', err?.message || err)

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

        if (profileRef.current) return profileRef.current
        const cached = readCachedProfile(userId)
        if (cached) {
          setProfile(cached)
          return cached
        }
        return null
      }
    },
    [applyProfile]
  )

  useEffect(() => {
    let mounted = true
    let retryTimer = null

    const init = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      if (!mounted) return
      setSession(currentSession)

      if (currentSession?.user) {
        // Hiện cache ngay trước khi await API
        const cached = readCachedProfile(currentSession.user.id)
        if (cached) setProfile(cached)
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
        clearCachedProfile()
      }
    })

    // Session còn mà profile null → retry định kỳ (mạng/backend chậm)
    retryTimer = setInterval(() => {
      if (!mounted) return
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (s?.user && !profileRef.current) {
          loadProfile(s)
        }
      })
    }, 8000)

    return () => {
      mounted = false
      subscription.unsubscribe()
      if (retryTimer) clearInterval(retryTimer)
    }
  }, [loadProfile])

  const logout = useCallback(async () => {
    await authService.logout()
    setSession(null)
    setProfile(null)
    clearCachedProfile()
  }, [])

  const value = {
    session,
    profile,
    authReady,
    isLoggedIn: !!session,
    isAdmin: isAdminRole(profile?.role),
    isMember: !!profile?.is_member,
    capabilities: capabilitiesFor(profile?.role),
    canManageEvents: hasCapability(profile?.role, 'events'),
    canManageHomework: hasCapability(profile?.role, 'homework'),
    canManageRules: hasCapability(profile?.role, 'rules'),
    canManageAnnouncements: hasCapability(profile?.role, 'announcements'),
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
