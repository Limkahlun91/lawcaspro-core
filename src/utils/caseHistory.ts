// Helper for LocalStorage Recent Cases with Usage Scoring
// Score = (Recency * 0.5) + (Usage Count * 0.3) + (Created Time * 0.2)
// Simplified implementation for "Smart Suggestions"

interface StoredCase {
    id: number
    client: string
    fileRef: string
    purchaser_nric?: string
    lastAccessed: number // timestamp
    accessCount: number
    createdAt: number // timestamp
}

const STORAGE_KEY = 'lawcase_smart_history'
const MAX_HISTORY = 20

// Heuristic Scoring Algorithm
// Returns a number (higher is better)
function calculateScore(item: StoredCase, now: number): number {
    // 1. Recency Score (0-50 points)
    // 1 hour ago = 50, 24 hours ago = 25, 1 week ago = 5
    const hoursSinceAccess = (now - item.lastAccessed) / (1000 * 60 * 60)
    const recencyScore = 50 * Math.exp(-hoursSinceAccess / 24) // Decay over 24h
    
    // 2. Usage Frequency (Logarithmic Scale)
    // 1 use -> ~7 pts, 5 uses -> ~18 pts, 20 uses -> ~30 pts, 100 uses -> ~46 pts
    // Prevents old frequent cases from permanently dominating new ones
    const frequencyScore = Math.log(item.accessCount + 1) * 10
    
    // 3. "Freshness" (Created recently?) (0-20 points)
    // If created within last 7 days, give bonus
    const daysOld = (now - item.createdAt) / (1000 * 60 * 60 * 24)
    const freshnessScore = daysOld < 7 ? 20 * ((7 - daysOld) / 7) : 0
    
    return recencyScore + frequencyScore + freshnessScore
}

export const CaseHistory = {
    // Add or Update a case in history
    trackAccess: (caseData: any) => {
        try {
            const historyStr = localStorage.getItem(STORAGE_KEY)
            let history: StoredCase[] = historyStr ? JSON.parse(historyStr) : []

            const existingIndex = history.findIndex(h => h.id === caseData.id)
            const now = Date.now()

            if (existingIndex >= 0) {
                // Update existing
                history[existingIndex].lastAccessed = now
                history[existingIndex].accessCount = (history[existingIndex].accessCount || 1) + 1
                // Update basic info in case it changed
                history[existingIndex].client = caseData.client
                history[existingIndex].fileRef = caseData.fileRef
                history[existingIndex].purchaser_nric = caseData.purchaser_nric
            } else {
                // Add new
                history.push({
                    id: caseData.id,
                    client: caseData.client,
                    fileRef: caseData.fileRef,
                    purchaser_nric: caseData.purchaser_nric,
                    lastAccessed: now,
                    accessCount: 1,
                    createdAt: new Date(caseData.created_at || now).getTime()
                })
            }

            // Save back
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
        } catch (e) {
            console.error('Failed to track case history', e)
        }
    },

    // Get sorted suggestions based on Smart Scoring
    getSuggestions: (): StoredCase[] => {
        try {
            const historyStr = localStorage.getItem(STORAGE_KEY)
            if (!historyStr) return []
            
            const history: StoredCase[] = JSON.parse(historyStr)
            const now = Date.now()
            
            return history.sort((a, b) => {
                const scoreA = calculateScore(a, now)
                const scoreB = calculateScore(b, now)
                return scoreB - scoreA // Descending
            }).slice(0, 10) // Top 10
            
        } catch (e) {
            console.error('Failed to get suggestions', e)
            return []
        }
    }
}
