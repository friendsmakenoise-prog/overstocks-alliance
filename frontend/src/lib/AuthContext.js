import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId) {
    console.log('loadProfile: starting for', userId)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, role, status, anonymous_handle, created_at')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('loadProfile: user_profiles query failed', error)
        throw error
      }

      console.log('loadProfile: got profile', data?.role)

      const { data: permissions, error: permError } = await supabase
        .from('brand_permissions')
        .select('brand_id, brands(id, name, slug)')
        .eq('user_id', userId)
        .is('revoked_at', null)

      if (permError) console.warn('loadProfile: permissions query failed', permError)

      setProfile({
        ...data,
        approvedBrands: permissions?.map(p => p.brands) || []
      })
      console.log('loadProfile: complete')
    } catch (err) {
      console.error('loadProfile: error', err)
      setProfile(null)
    }
  }

  useEffect(() => {
    let mounted = true
    console.log('AuthContext: init starting')

    async function init() {
      try {
        console.log('AuthContext: calling getSession')
        const { data: { session }, error } = await supabase.auth.getSession()
        console.log('AuthContext: getSession returned', { hasSession: !!session, error })

        if (!mounted) return

        if (error) {
          console.error('AuthContext: session error', error)
          setUser(null)
          setProfile(null)
          setLoading(false)
          return
        }

        if (session?.user) {
          console.log('AuthContext: found session, loading profile')
          setUser(session.user)
          await loadProfile(session.user.id)
        } else {
          console.log('AuthContext: no session found')
          setUser(null)
          setProfile(null)
        }
      } catch (err) {
        console.error('AuthContext: init error', err)
        if (mounted) {
          setUser(null)
          setProfile(null)
        }
      } finally {
        console.log('AuthContext: setting loading false')
        if (mounted) setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AuthContext: auth state change', event)
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
