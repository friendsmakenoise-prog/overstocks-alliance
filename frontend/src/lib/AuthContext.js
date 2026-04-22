import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, role, status, anonymous_handle, created_at')
        .eq('id', userId)
        .single()

      if (error) throw error

      const { data: permissions } = await supabase
        .from('brand_permissions')
        .select('brand_id, brands(id, name, slug)')
        .eq('user_id', userId)
        .is('revoked_at', null)

      setProfile({
        ...data,
        approvedBrands: permissions?.map(p => p.brands) || []
      })
    } catch (err) {
      console.error('loadProfile error:', err)
      setProfile(null)
    }
  }

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (!mounted) return

        if (error) {
          // Clear any stale/corrupt session data
          await supabase.auth.signOut()
          setUser(null)
          setProfile(null)
          setLoading(false)
          return
        }

        if (session?.user) {
          // Check if token is expired
          const now = Math.floor(Date.now() / 1000)
          if (session.expires_at && session.expires_at < now) {
            // Token expired — try to refresh it
            const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
            if (refreshError || !refreshed.session) {
              // Refresh failed — clear session
              await supabase.auth.signOut()
              setUser(null)
              setProfile(null)
              setLoading(false)
              return
            }
            setUser(refreshed.session.user)
            await loadProfile(refreshed.session.user.id)
          } else {
            setUser(session.user)
            await loadProfile(session.user.id)
          }
        } else {
          setUser(null)
          setProfile(null)
        }
      } catch (err) {
        console.error('Auth init error:', err)
        if (mounted) {
          setUser(null)
          setProfile(null)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        if (session?.user) {
          setUser(session.user)
          if (event !== 'TOKEN_REFRESHED') {
            await loadProfile(session.user.id)
          }
        } else {
          setUser(null)
          setProfile(null)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    await loadProfile(data.user.id)
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, loadProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
