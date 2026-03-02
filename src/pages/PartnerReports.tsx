'use client'

import { useTranslation } from 'react-i18next'

export default function PartnerReports() {
  const { t } = useTranslation()
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">{t('nav.partnerReports')}</h2>
      <div className="rounded border p-3">Financial reports</div>
    </div>
  )
}