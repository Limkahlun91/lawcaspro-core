import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import { Loader2, AlertTriangle, ShieldAlert, Activity } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface FirmUsage {
  id: string;
  name: string;
  ai_plan: string;
  ai_monthly_quota: number;
  ai_tokens_used: number;
  ai_enabled: boolean;
  ai_status: string;
}

export default function AIControlCenter() {
  const [firms, setFirms] = useState<FirmUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemStatus, setSystemStatus] = useState<'operational' | 'emergency_stop'>('operational');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('firms')
        .select('id, name, ai_plan, ai_monthly_quota, ai_tokens_used, ai_enabled, ai_status')
        .order('ai_tokens_used', { ascending: false });

      if (error) throw error;
      setFirms(data || []);
    } catch (error) {
      console.error('Error fetching AI usage:', error);
      toast.error('Failed to load AI usage data');
    } finally {
      setLoading(false);
    }
  };

  const toggleFirmAI = async (firmId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('firms')
        .update({ ai_enabled: !currentStatus })
        .eq('id', firmId);

      if (error) throw error;
      toast.success(`AI ${!currentStatus ? 'Enabled' : 'Disabled'} for firm`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update firm status');
    }
  };

  const emergencyKillSwitch = async () => {
    if (!confirm('EMERGENCY: This will DISABLE AI for ALL firms. Are you sure?')) return;
    
    try {
      // In a real app, this might update a global config table.
      // For now, we'll simulate by disabling all firms (or use a global flag if we had one)
      // Since we don't have a global config table yet, we'll iterate update (inefficient but works for prototype)
      // OR better: Update all firms
      const { error } = await supabase
        .from('firms')
        .update({ ai_enabled: false });

      if (error) throw error;
      
      setSystemStatus('emergency_stop');
      toast.error('EMERGENCY KILL SWITCH ACTIVATED - AI DISABLED SYSTEM-WIDE');
      fetchData();
    } catch (error) {
      toast.error('Failed to execute Kill Switch');
    }
  };

  const totalTokens = firms.reduce((acc, firm) => acc + (firm.ai_tokens_used || 0), 0);
  const totalCost = (totalTokens / 1000) * 0.03; // Approx cost

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="h-6 w-6 text-indigo-600" />
            AI Control Center
          </h1>
          <p className="text-slate-500">Monitor usage, quotas, and manage AI access.</p>
        </div>
        <Button 
          variant="destructive" 
          onClick={emergencyKillSwitch}
          className="bg-red-600 hover:bg-red-700 text-white flex gap-2"
        >
          <ShieldAlert className="h-4 w-4" />
          EMERGENCY KILL SWITCH
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Token Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTokens.toLocaleString()}</div>
            <p className="text-xs text-slate-500">System-wide consumption</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Estimated Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCost.toFixed(2)}</div>
            <p className="text-xs text-slate-500">Based on GPT-4o pricing</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${systemStatus === 'operational' ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="font-bold uppercase">{systemStatus}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Firm Usage & Quotas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Firm Name</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Usage / Quota</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {firms.map((firm) => {
                const percentage = (firm.ai_tokens_used / (firm.ai_monthly_quota || 1)) * 100;
                const isOverLimit = percentage >= 100;

                return (
                  <TableRow key={firm.id}>
                    <TableCell className="font-medium">{firm.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase">{firm.ai_plan}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{firm.ai_tokens_used.toLocaleString()}</span>
                          <span className="text-slate-400">/ {firm.ai_monthly_quota?.toLocaleString()}</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${isOverLimit ? 'bg-red-500' : percentage > 80 ? 'bg-yellow-500' : 'bg-green-500'}`} 
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {firm.ai_enabled ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Active</Badge>
                      ) : (
                        <Badge variant="destructive">Disabled</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => toggleFirmAI(firm.id, firm.ai_enabled)}
                        className={firm.ai_enabled ? 'text-red-600' : 'text-green-600'}
                      >
                        {firm.ai_enabled ? 'Disable' : 'Enable'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
