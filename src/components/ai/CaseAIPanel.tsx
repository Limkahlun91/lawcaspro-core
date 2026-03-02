import React, { useState, useEffect } from 'react';
import { aiGateway } from '../../services/ai/AIGatewayService';
import { supabase } from '../../lib/supabaseClient';
import { AIAnalysisResult } from '../../services/ai/types';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Loader2, Sparkles, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useRole } from '../../context/RoleContext';

interface CaseAIPanelProps {
  caseId?: string;
  caseData: any;
  onAccept?: (data: any) => void;
}

export default function CaseAIPanel({ caseId, caseData, onAccept }: CaseAIPanelProps) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<any>(null); // DB record
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null); // Parsed JSON
  const { actualRole } = useRole(); // User ID needed

  useEffect(() => {
    if (caseId) {
      fetchLatestSuggestion();
    }
  }, [caseId]);

  const fetchLatestSuggestion = async () => {
    if (!caseId) return;
    
    const { data, error } = await supabase
      .from('ai_suggestions')
      .select('*')
      .eq('entity_id', caseId)
      .eq('module', 'case')
      .eq('suggestion_type', 'case_analysis')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setSuggestion(data);
      setAnalysis(data.suggestion_data);
    }
  };

  const runAnalysis = async () => {
    setLoading(true);
    try {
      // Get current user ID (mock or from context)
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      
      // Get Firm ID (mock or from context)
      // In real app, we get this from profile
      const { data: profile } = await supabase.from('profiles').select('firm_id').eq('id', userId).single();
      const firmId = profile?.firm_id;

      if (!userId || !firmId) {
        toast.error('User or Firm not identified');
        return;
      }

      // Prepare Case Data (remove sensitive/large fields if needed)
      const cleanData = { ...caseData };
      
      // Call Gateway
      const result = await aiGateway.analyzeCase(cleanData, userId, firmId);
      
      if (result) {
        toast.success('AI Analysis Complete');
        fetchLatestSuggestion(); // Reload from DB to get the ID and status
      }
    } catch (error: any) {
      console.error('Analysis failed:', error);
      toast.error(error.message || 'Analysis Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!suggestion) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const success = await aiGateway.acceptSuggestion(suggestion.id, user.id);
      if (success) {
        toast.success('Suggestion Accepted');
        // Notify parent to update form/state
        if (onAccept && analysis) {
          onAccept(analysis);
        }
        fetchLatestSuggestion();
      } else {
        toast.error('Failed to accept');
      }
    } catch (error) {
      toast.error('Error accepting suggestion');
    }
  };

  const handleReject = async () => {
    if (!suggestion) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const success = await aiGateway.rejectSuggestion(suggestion.id, user.id);
      if (success) {
        toast.success('Suggestion Rejected');
        fetchLatestSuggestion();
      }
    } catch (error) {
      toast.error('Error rejecting');
    }
  };

  if (!caseId) {
    return (
      <div className="w-80 border-l border-gray-200 bg-white p-4 flex flex-col items-center justify-center text-gray-400">
        <Sparkles className="mb-2" />
        <p className="text-sm text-center">Save case first to enable AI analysis</p>
      </div>
    );
  }

  return (
    <div className="w-80 border-l border-gray-200 bg-white flex flex-col h-full overflow-y-auto shadow-inner">
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
        <h3 className="font-bold text-indigo-900 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-600" />
          AI Insight Panel
        </h3>
        <p className="text-xs text-indigo-700 mt-1">Powered by GPT-4o</p>
      </div>

      <div className="p-4 flex-1 space-y-4">
        {!analysis ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 mb-4">No analysis yet.</p>
            <Button 
              onClick={runAnalysis} 
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Run Analysis
            </Button>
          </div>
        ) : (
          <>
            {/* Status Badge */}
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-gray-500">STATUS</span>
              {suggestion?.status === 'pending' && <Badge className="bg-yellow-100 text-yellow-800">Pending Review</Badge>}
              {suggestion?.status === 'accepted' && <Badge className="bg-green-100 text-green-800">Accepted</Badge>}
              {suggestion?.status === 'rejected' && <Badge className="bg-red-100 text-red-800">Rejected</Badge>}
            </div>

            {/* Risk Level */}
            <Card className="border-l-4 border-l-indigo-500">
              <CardContent className="p-3">
                <div className="text-xs font-bold text-gray-500 uppercase">Risk Level</div>
                <div className={`text-lg font-bold flex items-center gap-2 ${
                  analysis.riskLevel === 'High' ? 'text-red-600' : 
                  analysis.riskLevel === 'Medium' ? 'text-orange-500' : 'text-green-600'
                }`}>
                  {analysis.riskLevel === 'High' && <AlertTriangle className="h-5 w-5" />}
                  {analysis.riskLevel}
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <div className="space-y-1">
              <div className="text-xs font-bold text-gray-500 uppercase">Summary</div>
              <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded border border-gray-100 leading-relaxed">
                {analysis.summary}
              </p>
            </div>

            {/* Next Steps */}
            <div className="space-y-1">
              <div className="text-xs font-bold text-gray-500 uppercase">Recommended Steps</div>
              <ul className="space-y-1">
                {analysis.nextSteps?.map((step, i) => (
                  <li key={i} className="text-xs text-gray-600 flex gap-2 items-start">
                    <span className="text-indigo-400">•</span> {step}
                  </li>
                ))}
              </ul>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1 mt-2">
              {analysis.tags?.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
              ))}
            </div>

            {/* Actions */}
            {suggestion?.status === 'pending' && (
              <div className="pt-4 flex gap-2">
                <Button onClick={handleReject} variant="outline" size="sm" className="flex-1 text-red-600 hover:bg-red-50">
                  <XCircle className="mr-1 h-4 w-4" /> Reject
                </Button>
                <Button onClick={handleAccept} size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                  <CheckCircle className="mr-1 h-4 w-4" /> Accept
                </Button>
              </div>
            )}

            {suggestion?.status !== 'pending' && (
               <div className="pt-4">
                 <Button onClick={runAnalysis} variant="outline" size="sm" className="w-full">
                   <Sparkles className="mr-2 h-4 w-4" /> Re-run Analysis
                 </Button>
               </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
