import { VertexAI, GenerativeModel } from '@google-cloud/vertexai'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase Admin Client (Service Role)
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
)

// Initialize Vertex AI
const vertexAI = new VertexAI({
  project: process.env.GCP_PROJECT_ID || 'mock-project-id',
  location: process.env.GCP_LOCATION || 'asia-southeast1',
})

// Models
const modelPro = vertexAI.getGenerativeModel({ model: 'gemini-1.5-pro-preview-0409' })
const modelFlash = vertexAI.getGenerativeModel({ model: 'gemini-1.5-flash-preview-0514' })

export class AIService {
  
  // Log Usage
  private async logUsage(firmId: string, userId: string, action: string, model: string, inputTokens: number, outputTokens: number) {
    // Estimate cost (Mock logic)
    const cost = (inputTokens * 0.000125 + outputTokens * 0.000375) / 1000 
    
    await supabase.from('ai_logs').insert({
      firm_id: firmId,
      user_id: userId,
      action,
      model,
      tokens_input: inputTokens,
      tokens_output: outputTokens,
      cost_estimate: cost,
      status: 'success'
    })
  }

  // Extract Structured Data (IC / LO)
  async extractStructured(userId: string, firmId: string, text: string, type: 'IC' | 'LO') {
    const modelName = type === 'IC' ? 'gemini-1.5-flash' : 'gemini-1.5-pro'
    const model = type === 'IC' ? modelFlash : modelPro
    
    const prompt = type === 'IC' 
      ? `Extract fields from Malaysian IC text: Purchaser Name, NRIC, Address. JSON format only.`
      : `Extract fields from Loan Offer: Bank Name, Loan Amount, Property Address, Facility Type. JSON format only.`

    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt + '\n\n' + text }] }]
      })
      
      const response = await result.response
      const output = response.candidates[0].content.parts[0].text
      
      // Log Audit
      await this.logUsage(firmId, userId, 'EXTRACT_STRUCTURED', modelName, text.length / 4, output.length / 4)

      // Clean JSON
      const jsonStr = output.replace(/```json/g, '').replace(/```/g, '').trim()
      return JSON.parse(jsonStr)

    } catch (err) {
      console.error('Vertex AI Error', err)
      throw new Error('AI Service Error')
    }
  }

  // Analyze Document (SPA / LO)
  async analyzeDocument(userId: string, firmId: string, text: string, type: 'SPA' | 'LO') {
    const modelName = 'gemini-1.5-pro'
    const prompt = `
      You are a Malaysian conveyancing legal assistant.
      Analyse the following ${type} document text.
      Provide output in JSON format:
      {
        "summary": "Brief summary",
        "risk_areas": ["Risk 1", "Risk 2"],
        "missing_clauses": ["Clause 1"],
        "unusual_conditions": ["Condition 1"]
      }
      Document Text:
      ${text.substring(0, 50000)}
    `

    try {
      const result = await modelPro.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      })
      
      const response = await result.response
      const output = response.candidates[0].content.parts[0].text

      // Log Audit
      await this.logUsage(firmId, userId, 'ANALYZE_DOCUMENT', modelName, text.length / 4, output.length / 4)

      const jsonStr = output.replace(/```json/g, '').replace(/```/g, '').trim()
      return JSON.parse(jsonStr)

    } catch (err) {
      console.error('Vertex AI Error', err)
      throw new Error('AI Analysis Error')
    }
  }
}

export const aiService = new AIService()
