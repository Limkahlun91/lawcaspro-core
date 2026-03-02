'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Role, useRole, currentRole } from '../context/RoleContext'

interface RoleGateProps {
  roles: Role[]
  children: React.ReactNode
}

export default function RoleGate({ roles, children }: RoleGateProps) {
  const roleState = useRole()
  const r = currentRole(roleState)
  const { t } = useTranslation()
  
  if (!roles.includes(r)) {
    return <div className="text-red-600 p-4">{t('noAccess') || 'Access Denied'}</div>
  }
  
  return children
}