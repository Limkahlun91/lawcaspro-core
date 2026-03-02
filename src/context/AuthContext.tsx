import { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
interface AuthContextType {
  session: Session | null
  user: User | null
  profile: any | null
  loading: boolean
  isFounder: boolean
  firmSettings: {
    security_level: string
    founder_pin_required: boolean
    consent_required: boolean
  } | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<any | null>(null)
  const [firmSettings, setFirmSettings] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Global Safety Timeout: Force loading false after 7s no matter what
    const safety = setTimeout(() => {
        setLoading((current) => {
            if (current) console.warn('Auth Safety Timeout Triggered')
            return false
        })
    }, 7000)

    return () => clearTimeout(safety)
  }, [])

  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        // Race Condition Protection: Force resolve after 5s
        const timeoutPromise = new Promise<{ data: { session: Session | null }, error: any }>((resolve) => 
          setTimeout(() => resolve({ data: { session: null }, error: 'Timeout' }), 5000)
        )

        const { data, error } = await Promise.race([
            supabase.auth.getSession(),
            timeoutPromise
        ])

        if (error) {
             console.error("Auth error:", error)
        }

        if (mounted) {
             const session = data?.session ?? null
             setSession(session)
             setUser(session?.user ?? null)
             
             if (session?.user) {
                const profileData = await fetchProfile(session.user.id)
                if (profileData?.firm_id) {
                    await fetchFirmSettings(profileData.firm_id)
                }
             }
        }
      } catch (err) {
        console.error("Auth exception:", err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (mounted) {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
           const profileData = await fetchProfile(session.user.id)
           if (profileData?.firm_id) {
               await fetchFirmSettings(profileData.firm_id)
           }
        } else {
           setProfile(null)
           setFirmSettings(null)
        }
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      if (error) {
        console.error('Profile Fetch Error:', error)
        return null
      }

      setProfile(data)
      return data
      
      // Role sync is now handled by RoleContext observing AuthContext
    } catch (error) {
      console.error('Profile Fetch Exception:', error)
      return null
    }
  }

  const fetchFirmSettings = async (firmId: string) => {
    try {
      const { data, error } = await supabase
        .from('firms')
        .select('security_level, founder_pin_required, consent_required')
        .eq('id', firmId)
        .single()
      
      if (error) {
        console.error('Firm Settings Fetch Error:', error)
        return
      }

      setFirmSettings(data)
    } catch (error) {
      console.error('Firm Settings Fetch Exception:', error)
    }
  }

  // Security: Founder check strictly via DB profile or hardcoded fallback ONLY for dev
  // In production, remove the 'is_founder_logged_in' fallback entirely.
  // For now, we prioritize DB role, but keep local storage as secondary fallback if needed during transition,
  // BUT user requested to fix the vulnerability, so we should prefer DB.
  // However, to avoid locking the user out if they haven't set up DB roles yet:
  const isFounder = profile?.role === 'Founder'

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, isFounder, firmSettings }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
