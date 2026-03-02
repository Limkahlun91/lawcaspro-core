import { supabase } from '../../lib/supabaseClient';
import { AIProvider, AIConfig, AIAnalysisResult, AIFinanceReviewResult, AIDocumentAnalysisResult, AIRiskResult } from './types';
import { OpenAIProvider } from './providers/OpenAIProvider';

export class AIGatewayService {
  private provider: AIProvider;
  private config: AIConfig;

  constructor() {
    this.config = {
      provider: 'openai',
      apiKey: import.meta.env.VITE_OPENAI_API_KEY || '', // In production, this should be handled securely!
      model: 'gpt-4o'
    };
    
    this.provider = new OpenAIProvider(this.config.apiKey!, this.config.model);
  }

  /**
   * Main Gateway Method: Analyze Case
   * 1. Check Quota
   * 2. Call Provider
   * 3. Log Usage
   * 4. Save Suggestion (Pending Review)
   */
  async analyzeCase(caseData: any, userId: string, firmId: string): Promise<AIAnalysisResult | null> {
    const estimatedTokens = 1000; // Rough estimate for check
    
    // 1. Quota Check
    const canProceed = await this.checkQuota(firmId, estimatedTokens);
    if (!canProceed) {
      console.warn(`Firm ${firmId} has exceeded AI quota or is disabled.`);
      throw new Error('AI Quota Exceeded or Service Disabled');
    }

    // 2. Call Provider
    try {
      const result = await this.provider.analyzeCase(caseData);
      
      // 3. Log Usage & Update Quota
      // Use actual usage if available, else estimate
      const actualTokens = result.usage?.total_tokens || estimatedTokens;
      await this.logUsage(firmId, userId, 'case', 'gpt-4o', result.usage?.prompt_tokens || 500, result.usage?.completion_tokens || 500);
      await this.updateQuota(firmId, actualTokens);

      // 4. Save Suggestion (Buffer)
      await this.saveSuggestion(firmId, 'case', caseData.id, 'case_analysis', result, userId);

      return result;
    } catch (error) {
      console.error('AI Gateway Error:', error);
      throw error;
    }
  }

  async reviewFinance(financeData: any, userId: string, firmId: string): Promise<AIFinanceReviewResult | null> {
    const estimatedTokens = 500;
    if (!(await this.checkQuota(firmId, estimatedTokens))) throw new Error('Quota Exceeded');

    const result = await this.provider.reviewFinance(financeData);
    const actualTokens = result.usage?.total_tokens || estimatedTokens;
    
    await this.logUsage(firmId, userId, 'finance', 'gpt-4o', result.usage?.prompt_tokens || 300, result.usage?.completion_tokens || 200);
    await this.updateQuota(firmId, actualTokens);
    await this.saveSuggestion(firmId, 'finance', financeData.id, 'finance_review', result, userId);

    return result;
  }

  async analyzeDocument(documentText: string, docId: string, userId: string, firmId: string): Promise<AIDocumentAnalysisResult | null> {
    const estimatedTokens = 2000;
    if (!(await this.checkQuota(firmId, estimatedTokens))) throw new Error('Quota Exceeded');

    const result = await this.provider.analyzeDocument(documentText);
    const actualTokens = result.usage?.total_tokens || estimatedTokens;

    await this.logUsage(firmId, userId, 'document', 'gpt-4o', result.usage?.prompt_tokens || 1500, result.usage?.completion_tokens || 500);
    await this.updateQuota(firmId, actualTokens);
    await this.saveSuggestion(firmId, 'document', docId, 'document_analysis', result, userId);

    return result;
  }

  // --- Suggestion Management ---

  async acceptSuggestion(suggestionId: string, userId: string): Promise<boolean> {
    // 1. Update Suggestion Status
    const { error: updateError } = await supabase
      .from('ai_suggestions')
      .update({ 
        status: 'accepted',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', suggestionId);

    if (updateError) {
      console.error('Failed to accept suggestion:', updateError);
      return false;
    }

    // 2. Log Action
    const { error: logError } = await supabase
      .from('ai_action_logs')
      .insert({
        action_taken: 'accepted',
        user_id: userId,
        suggestion_id: suggestionId,
        firm_id: (await this.getSuggestionFirmId(suggestionId))
      });

    if (logError) console.error('Failed to log action:', logError);
    
    return true;
  }

  async rejectSuggestion(suggestionId: string, userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('ai_suggestions')
      .update({ 
        status: 'rejected',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', suggestionId);
    
    if (error) return false;

    await supabase.from('ai_action_logs').insert({
        action_taken: 'rejected',
        user_id: userId,
        suggestion_id: suggestionId,
        firm_id: (await this.getSuggestionFirmId(suggestionId))
    });

    return true;
  }

  // --- Private Helpers ---

  private async checkQuota(firmId: string, estimatedTokens: number): Promise<boolean> {
    const { data, error } = await supabase.rpc('check_ai_quota', {
      p_firm_id: firmId,
      p_estimated_tokens: estimatedTokens
    });
    
    if (error) {
      console.error('Quota check failed:', error);
      return false; // Fail safe
    }
    return data;
  }

  private async updateQuota(firmId: string, tokens: number) {
    const { error } = await supabase.rpc('increment_ai_usage', {
      p_firm_id: firmId,
      p_tokens: tokens
    });
    if (error) console.error('Failed to update quota:', error);
  }

  private async logUsage(firmId: string, userId: string, module: string, model: string, input: number, output: number) {
    const cost = (input / 1000 * 0.03) + (output / 1000 * 0.06); // GPT-4o pricing approx
    
    await supabase.from('ai_usage_logs').insert({
      firm_id: firmId,
      user_id: userId,
      module,
      model,
      tokens_input: input,
      tokens_output: output,
      cost_estimate: cost
    });
  }

  private async saveSuggestion(firmId: string, module: string, entityId: string, type: string, data: any, userId: string) {
    await supabase.from('ai_suggestions').insert({
      firm_id: firmId,
      module,
      entity_id: entityId,
      suggestion_type: type,
      suggestion_data: data,
      status: 'pending',
      created_at: new Date().toISOString()
    });
  }

  private async getSuggestionFirmId(suggestionId: string): Promise<string> {
      const { data } = await supabase.from('ai_suggestions').select('firm_id').eq('id', suggestionId).single();
      return data?.firm_id;
  }
}

export const aiGateway = new AIGatewayService();
