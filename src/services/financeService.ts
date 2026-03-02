
import { supabase } from '../lib/supabaseClient'

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

export interface GLAccount {
    code: string;
    name: string;
    type: AccountType;
    balance?: number; 
}

export const financeService = {
    // Fetch Chart of Accounts
    getAccounts: async () => {
        const { data, error } = await supabase
            .from('chart_of_accounts')
            .select('*')
            .order('code', { ascending: true })
        
        if (error) {
            console.error('Error fetching CoA:', error)
            return []
        }
        return data
    },

    // Fetch Balances (Aggregated from GL Lines)
    getAccountBalances: async () => {
        // 1. Get Accounts
        const { data: accounts } = await supabase.from('chart_of_accounts').select('*')
        if (!accounts) return []

        // 2. Get All GL Lines (Optimized: In real app, use a Postgres View for Sums)
        const { data: lines } = await supabase.from('gl_lines').select('account_code, debit, credit')
        
        if (!lines) return accounts.map(a => ({ ...a, balance: 0 }))

        // 3. Aggregate
        const balances: Record<string, number> = {}
        lines.forEach(line => {
            if (!balances[line.account_code]) balances[line.account_code] = 0
            
            // Logic:
            // Asset/Expense: Dr + / Cr -
            // Liability/Equity/Revenue: Cr + / Dr -
            // BUT: Usually we store raw Dr/Cr and calculate based on Type. 
            // Let's store Net Debit (Dr - Cr) for everything, then interpret based on Type.
            balances[line.account_code] += (line.debit || 0) - (line.credit || 0)
        })

        return accounts.map(acc => {
            let net = balances[acc.code] || 0
            // Flip sign for Credit-normal accounts for display purposes (Positive = Normal Balance)
            if (['Liability', 'Equity', 'Revenue'].includes(acc.type)) {
                net = net * -1
            }
            return { ...acc, balance: net }
        })
    },

    // Reports
    getPL: async () => {
        const accounts = await financeService.getAccountBalances()
        
        const revenue = accounts
            .filter((a: any) => a.type === 'Revenue')
            .reduce((sum: number, a: any) => sum + a.balance, 0)
            
        const expense = accounts
            .filter((a: any) => a.type === 'Expense')
            .reduce((sum: number, a: any) => sum + a.balance, 0)
            
        return { revenue, expense, netProfit: revenue - expense }
    },

    getBalanceSheet: async () => {
        const accounts = await financeService.getAccountBalances()

        const assets = accounts
            .filter((a: any) => a.type === 'Asset')
            .reduce((sum: number, a: any) => sum + a.balance, 0)

        const liabilities = accounts
            .filter((a: any) => a.type === 'Liability')
            .reduce((sum: number, a: any) => sum + a.balance, 0)

        const equity = accounts
            .filter((a: any) => a.type === 'Equity')
            .reduce((sum: number, a: any) => sum + a.balance, 0)

        return { assets, liabilities, equity }
    },

    getSSTReport: async () => {
        // Fetch GL lines for SST Payable Account (2001)
        const { data } = await supabase
            .from('gl_lines')
            .select(`
                *,
                gl_entries (date, description, reference_id)
            `)
            .eq('account_code', '2001') // SST Payable
            .gt('credit', 0) // Only Credits (Liability Increases)
        
        if (!data) return []

        return data.map(line => ({
            date: line.gl_entries?.date,
            description: line.gl_entries?.description,
            referenceId: line.gl_entries?.reference_id,
            amount: line.credit
        }))
    },

    // Manual Posting (Optional, for adjustments)
    postManualEntry: async (entry: any) => {
        const { error } = await supabase.from('gl_entries').insert(entry)
        return !error
    },

    postTransaction: async (debitCode: string, creditCode: string, amount: number, description: string, refId: string, source: string) => {
        // Create Entry
        const { data: entry, error } = await supabase.from('gl_entries').insert({
            date: new Date().toISOString(),
            description,
            reference_id: refId,
            // source_module: source, // might not exist
            status: 'Posted'
        }).select().single()

        if (error || !entry) {
            console.error('GL Post Error:', error)
            return false
        }

        // Debit Line
        await supabase.from('gl_lines').insert({
            entry_id: entry.id,
            account_code: debitCode,
            debit: amount,
            credit: 0
        })

        // Credit Line
        await supabase.from('gl_lines').insert({
            entry_id: entry.id,
            account_code: creditCode,
            debit: 0,
            credit: amount
        })

        return true
    },

    // Export Trigger
    exportData: async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return
            
            const response = await fetch('/api/accounting-export', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            })
            
            if (response.ok) {
                const blob = await response.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `ledger_export_${new Date().toISOString().split('T')[0]}.csv`
                document.body.appendChild(a)
                a.click()
                a.remove()
            } else {
                alert('Export failed')
            }
        } catch (e) {
            console.error(e)
            alert('Export error')
        }
    }
}
