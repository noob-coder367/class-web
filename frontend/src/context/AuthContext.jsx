import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import * as authService from '../services/authService.js'
import { setSessionSnapshot } from '../services/apiClient.js'
import { isAdminRole } from '../lib/roles.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [authReady, setAuthReady] = useState(false)

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
      setAuthReady(true)
      if (currentSession?.user) await loadProfile(currentSession)
    }
    void initialize()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      setSessionSnapshot(nextSession)
      if (nextSession?.user) {
        if (event !== 'TOKEN_REFRESHED') void loadProfile(nextSession)
      } else {
        setProfile(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } finally {
      setSession(null)
      setProfile(null)
      setSessionSnapshot(null)
    }
  }, [])

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
