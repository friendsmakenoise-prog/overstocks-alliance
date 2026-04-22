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
      return true
    } catch (err) {
      console.error('loadProfile error:', err)
      setProfile(null)
      return false
    }
  }

  useEffect(() => {
    let mounted = true

    // onAuthStateChange fires reliably on every page load, including
    // after Stripe redirects and browser back/forward navigation.
    // INITIAL_SESSION is the event we get when Supabase restores a
    // saved session — we wait for this before setting loading=false.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        if (session?.user) {
          setUser(session.user)
          // Load profile on initial session restore and sign in
          // Skip on token refresh to avoid unnecessary re-renders
          if (event !== 'TOKEN_REFRESHED') {
            await loadProfile(session.user.id)
          }
        } else {
          setUser(null)
          setProfile(null)
        }

        // Mark loading complete after first auth event fires
        // This covers both "has session" and "no session" cases
        if (mounted) setLoading(false)
      }
    )

    // Backstop — if onAuthStateChange never fires (e.g. network issue)
    // stop the spinner after 10 seconds so user isn't stuck forever
    const backstop = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 10000)

    return () => {
      mounted = false
      clearTimeout(backstop)
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    // onAuthStateChange will fire SIGNED_IN and load the profile
    // but we also load it here so the UI updates immediately
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
