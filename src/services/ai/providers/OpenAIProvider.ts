import { AIProvider, AIAnalysisResult, AIFinanceReviewResult, AIDocumentAnalysisResult, AIRiskResult } from '../types';

export class OpenAIProvider implements AIProvider {
  name = 'OpenAI';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o') {
    this.apiKey = apiKey;
    this.model = model;
  }

  private async callOpenAI(systemPrompt: string, userPrompt: string): Promise<any> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          response_format: { type: "json_object" } 
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API Error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      return JSON.parse(content);
    } catch (error) {
      console.error('AI Service Error:', error);
      throw error;
    }
  }

  async generateText(prompt: string): Promise<string> {
    // Simple text generation (non-JSON mode for this one maybe? or just wrap)
    // For now reusing the JSON structure for consistency in error handling
    return "Not implemented for raw text in this strict mode"; 
  }

  async analyzeCase(caseData: any): Promise<AIAnalysisResult> {
    const systemPrompt = `You are a legal AI assistant. Analyze the case data and return a JSON object with:
    - summary: A brief summary of the case.
    - riskLevel: 'Low', 'Medium', or 'High'.
    - nextSteps: An array of recommended next steps.
    - tags: An array of relevant tags.`;
    
    const userPrompt = JSON.stringify(caseData);
    return this.callOpenAI(systemPrompt, userPrompt);
  }

  async reviewFinance(financeData: any): Promise<AIFinanceReviewResult> {
    const systemPrompt = `You are a financial auditor AI. Review the transaction data and return JSON with:
    - auditStatus: 'Clean', 'Flagged', or 'Review Required'.
    - issues: Array of potential issues found.
    - suggestions: Array of suggestions for correction.`;

    const userPrompt = JSON.stringify(financeData);
    return this.callOpenAI(systemPrompt, userPrompt);
  }

  async analyzeDocument(documentText: string): Promise<AIDocumentAnalysisResult> {
    const systemPrompt = `You are a legal document analyzer. Extract key information and return JSON with:
    - summary: Document summary.
    - category: Document category (e.g., Contract, Court Order).
    - extractedData: Key-value pairs of extracted entities (dates, names, amounts).`;

    const userPrompt = documentText;
    return this.callOpenAI(systemPrompt, userPrompt);
  }

  async detectRisk(text: string): Promise<AIRiskResult> {
    const systemPrompt = `Analyze the text for legal risks. Return JSON with:
    - riskScore: 0-100 score.
    - riskFactors: Array of risk factors identified.
    - mitigationStrategies: Array of mitigation strategies.`;

    const userPrompt = text;
    return this.callOpenAI(systemPrompt, userPrompt);
  }
}
