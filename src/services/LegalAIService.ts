import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabase } from '../lib/supabaseClient'

// Access API Key from env
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || ''
const genAI = new GoogleGenerativeAI(API_KEY)
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

export interface AIStructuredResult {
  [key: string]: {
    value: string
    confidence: number
  }
}

export interface AIAnalysisResult {
  summary: string
  risk_areas: string[]
  missing_clauses: string[]
  unusual_conditions: string[]
}

class LegalAIService {

  // --- PIPELINE A: Structured Extraction (Vertex AI via Gateway) ---
  
  async extractStructuredData(fileText: string, fileType: 'IC' | 'LO'): Promise<AIStructuredResult> {
    try {
      const response = await fetch('http://localhost:3000/api/ai/extract-structured', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}` // Pass JWT
        },
        body: JSON.stringify({ text: fileText, type: fileType })
      })

      if (!response.ok) throw new Error('AI Gateway Error')
      return await response.json()
    } catch (err) {
      console.error('AI Extraction Failed', err)
      throw new Error('AI Service Unavailable')
    }
  }

  // --- PIPELINE B: Full Document Analysis (Vertex AI via Gateway) ---

  async analyzeDocument(fileText: string, type: 'SPA' | 'LO'): Promise<AIAnalysisResult> {
    try {
      const response = await fetch('http://localhost:3000/api/ai/analyze-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({ text: fileText, type })
      })

      if (!response.ok) throw new Error('AI Analysis Error')
      return await response.json()
    } catch (err) {
      console.error('AI Analysis Failed', err)
      throw new Error('AI Analysis Service Unavailable')
    }
  }
}

export const legalAIService = new LegalAIService()
