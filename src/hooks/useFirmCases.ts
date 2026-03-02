import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

// Global in-memory cache for search results
// Key: keyword, Value: { data: any[], timestamp: number }
const searchCache = new Map<string, { data: any[], timestamp: number }>()
const CACHE_TTL = 60 * 1000 // 60 seconds

export function useFirmCases() {
  const { profile } = useAuth()
  const [cases, setCases] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchCases = useCallback(async (keyword: string) => {
    if (!profile?.firm_id) return
    
    // Clear results if keyword is too short
    if (!keyword || keyword.length < 2) {
        setCases([])
        return
    }

    // Check Cache
    const cached = searchCache.get(keyword)
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        setCases(cached.data)
        return
    }

    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('id, client, fileRef, purchaser_name, purchaser_nric, loan_amount, bank_name, property_address, spa_date, developer_name, status, created_at')
        .eq('firm_id', profile.firm_id)
        .is('deleted_at', null)
        .or(`client.ilike.%${keyword}%,fileRef.ilike.%${keyword}%`)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      
      const results = data || []
      setCases(results)
      
      // Update Cache
      searchCache.set(keyword, { data: results, timestamp: Date.now() })
      
    } catch (err: any) {
      console.error('Firm Cases Search Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [profile?.firm_id])

  return { cases, loading, error, searchCases }
}
