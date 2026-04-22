import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId) {
    console.log('loadProfile: fetching', userId)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, role, status, anonymous_handle, created_at')
        .eq('id', userId)
        .single()

      console.log('loadProfile: result', { data, error })
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
      console.log('loadProfile: done')
    } catch (err) {
      console.error('loadProfile: failed', err)
      setProfile(null)
    }
  }

  useEffect(() => {
    console.log('AuthContext: setting up listener')

    // Use ONLY onAuthStateChange — no getSession call
    // Supabase fires INITIAL_SESSION immediately on mount
    // with the stored session if one exists
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AuthContext: event', event, 'hasSession', !!session)

        if (session?.user) {
          setUser(session.user)
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            await loadProfile(session.user.id)
          }
        } else {
          setUser(null)
          setProfile(null)
        }

        // Always stop loading after first event
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
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
