export interface AIProvider {
  name: string;
  generateText(prompt: string, context?: any): Promise<string>;
  analyzeCase(caseData: any): Promise<AIAnalysisResult>;
  reviewFinance(financeData: any): Promise<AIFinanceReviewResult>;
  analyzeDocument(documentText: string): Promise<AIDocumentAnalysisResult>;
  detectRisk(text: string): Promise<AIRiskResult>;
}

export interface AIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface AIAnalysisResult {
  summary: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  nextSteps: string[];
  tags: string[];
  usage?: AIUsage;
}

export interface AIFinanceReviewResult {
  auditStatus: 'Clean' | 'Flagged' | 'Review Required';
  issues: string[];
  suggestions: string[];
  usage?: AIUsage;
}

export interface AIDocumentAnalysisResult {
  summary: string;
  category: string;
  extractedData: Record<string, any>;
  usage?: AIUsage;
}

export interface AIRiskResult {
  riskScore: number;
  riskFactors: string[];
  mitigationStrategies: string[];
  usage?: AIUsage;
}

export interface AIConfig {
  provider: 'openai' | 'claude' | 'gemini' | 'local';
  apiKey?: string;
  model?: string;
}
