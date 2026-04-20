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
      console.error('loadProfile error full details:', JSON.stringify(err))
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      setUser(session?.user || null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        setUser(session?.user || null)
        if (session?.user) {
          await loadProfile(session.user.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    // Safety net — never spin forever
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 8000)

    return () => {
      mounted = false
      clearTimeout(timeout)
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
    setLoading(false)
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
