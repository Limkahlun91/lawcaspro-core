import React, { createContext, useContext, useMemo, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'

export type Role = 'Founder' | 'Partner' | 'Senior Clerk' | 'Junior Clerk' | 'Runner' | 'Purchaser' | 'Senior Lawyer' | 'Junior Lawyer' | 'Admin' | 'Account'

type RoleState = {
  actualRole: Role
  impersonatedRole?: Role
  setActualRole: (r: Role) => void
  setImpersonatedRole: (r?: Role) => void
}

const RoleCtx = createContext<RoleState | undefined>(undefined)

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [actualRole, setActualRole] = useState<Role>('Founder')
  const [impersonatedRole, setImpersonatedRole] = useState<Role | undefined>()
  const { profile, loading } = useAuth()

  useEffect(() => {
    if (!loading && profile?.role) {
      setActualRole(profile.role)
    }
  }, [profile, loading])

  const value = useMemo(   () => ({
      actualRole,
      impersonatedRole,
      setActualRole,
      setImpersonatedRole,
    }),
    [actualRole, impersonatedRole]
  )

  return <RoleCtx.Provider value={value}>{children}</RoleCtx.Provider>
}

export function useRole() {
  const ctx = useContext(RoleCtx)
  if (!ctx) throw new Error('RoleContext not found')
  return ctx
}

export function currentRole(state: RoleState): Role {
  return state.impersonatedRole ?? state.actualRole
}
