import { supabase } from '../../lib/supabaseClient';
import { AIProvider, AIConfig, AIAnalysisResult, AIFinanceReviewResult, AIDocumentAnalysisResult, AIRiskResult } from './types';
import { OpenAIProvider } from './providers/OpenAIProvider';

class AIService {
  private provider: AIProvider;
  private config: AIConfig;

  constructor() {
    // In a real app, load config from env or secure storage
    // For now, defaulting to OpenAI with a placeholder key (USER MUST CONFIGURE)
    this.config = {
      provider: 'openai',
      apiKey: import.meta.env.VITE_OPENAI_API_KEY || 'YOUR_OPENAI_KEY',
      model: 'gpt-4o'
    };
    
    this.provider = new OpenAIProvider(this.config.apiKey!, this.config.model);
  }

  // Abstraction methods that delegate to the provider
  
  async analyzeCase(caseData: any, userId: string, firmId: string): Promise<AIAnalysisResult> {
    const result = await this.provider.analyzeCase(caseData);
    await this.logUsage(firmId, userId, 'case', 500, 200); // Estimate tokens for now
    return result;
  }

  async reviewFinance(financeData: any, userId: string, firmId: string): Promise<AIFinanceReviewResult> {
    const result = await this.provider.reviewFinance(financeData);
    await this.logUsage(firmId, userId, 'finance', 300, 150);
    return result;
  }

  async analyzeDocument(documentText: string, userId: string, firmId: string): Promise<AIDocumentAnalysisResult> {
    const result = await this.provider.analyzeDocument(documentText);
    await this.logUsage(firmId, userId, 'document', 1000, 300);
    return result;
  }

  async detectRisk(text: string, userId: string, firmId: string): Promise<AIRiskResult> {
    const result = await this.provider.detectRisk(text);
    await this.logUsage(firmId, userId, 'risk_detection', 200, 100);
    return result;
  }

  // Token Usage Logging
  private async logUsage(firmId: string, userId: string, module: string, tokensInput: number, tokensOutput: number) {
    try {
      // Simple cost estimation logic (e.g. $0.03/1k input, $0.06/1k output for GPT-4)
      // This should be configurable per model
      const inputCost = (tokensInput / 1000) * 0.03;
      const outputCost = (tokensOutput / 1000) * 0.06;
      const totalCost = inputCost + outputCost;

      await supabase.from('ai_usage_logs').insert({
        firm_id: firmId,
        user_id: userId,
        module: module,
        model: this.config.model || 'unknown',
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        cost_estimate: totalCost
      });
    } catch (error) {
      console.error('Failed to log AI usage:', error);
      // Don't fail the main operation if logging fails
    }
  }
}

export const aiService = new AIService();
