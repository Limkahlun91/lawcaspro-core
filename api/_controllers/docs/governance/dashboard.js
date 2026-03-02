import { createClient } from '@supabase/supabase-js'
import { verifyUser } from '../../../_utils/auth.js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { profile, firmId } = await verifyUser(req)
    
    // In a real SaaS, we would have a specific 'SuperAdmin' role or a specific firm_id for the platform owner.
    // For this Level 5 demo, we treat 'Founder' as having potential Platform Oversight capabilities.
    const isPlatformOverviewAllowed = profile.role === 'Founder' || profile.role === 'Admin';

    // ==========================================
    // LAYER 1: FIRM AUTONOMY (Local Governance)
    // ==========================================
    
    // 1. Firm Generation Stats
    const { count: firmTotal } = await supabase
      .from('generated_documents')
      .select('*', { count: 'exact', head: true })
      .eq('firm_id', firmId)

    const { count: firmSuccess } = await supabase
      .from('generated_documents')
      .select('*', { count: 'exact', head: true })
      .eq('firm_id', firmId)
      .eq('status', 'completed')

    const { count: firmFailed } = await supabase
      .from('generated_documents')
      .select('*', { count: 'exact', head: true })
      .eq('firm_id', firmId)
      .neq('status', 'completed')

    // 2. Firm Recent Activity
    const { data: recentActivity } = await supabase
      .from('generated_documents')
      .select(`
        id,
        generated_at,
        status,
        template:firm_templates(name),
        generated_by
      `)
      .eq('firm_id', firmId)
      .order('generated_at', { ascending: false })
      .limit(5)

    // 3. Firm Pending Approvals
    const { count: pendingApprovals } = await supabase
      .from('firm_templates')
      .select('*', { count: 'exact', head: true })
      .eq('firm_id', firmId)
      .eq('status', 'submitted')

    // 4. Firm Risk Alerts
    const { data: firmRiskTemplates } = await supabase
        .from('generated_documents')
        .select(`
            template_id,
            template:firm_templates(name)
        `)
        .eq('firm_id', firmId)
        .neq('status', 'completed')
        .order('generated_at', { ascending: false })
        .limit(5)

    const firmView = {
        stats: {
            total: firmTotal || 0,
            success_rate: firmTotal ? Math.round((firmSuccess / firmTotal) * 100) : 0,
            failed: firmFailed || 0,
            pending_approvals: pendingApprovals || 0
        },
        recent_activity: recentActivity || [],
        risk_alerts: firmRiskTemplates ? firmRiskTemplates.map(t => ({
            template_id: t.template_id,
            template_name: t.template?.name,
            reason: 'Generation Failed (Firm Level)'
        })) : []
    };

    // ==========================================
    // LAYER 2: FOUNDER PLATFORM OVERSIGHT
    // ==========================================
    let platformView = null;

    if (isPlatformOverviewAllowed) {
        // 1. Global Stats
        const { count: globalTotal } = await supabase
            .from('generated_documents')
            .select('*', { count: 'exact', head: true })
        
        // 2. Firm Health Check (Identify "Problematic" Firms)
        // Fetch all firms and their recent doc counts (Simplified for demo)
        const { data: firms } = await supabase
            .from('firms')
            .select('id, name')
            .limit(10) // Top 10 firms for dashboard

        const firmHealth = [];
        
        for (const firm of (firms || [])) {
            // Get failure count for this firm
            const { count: fFail } = await supabase
                .from('generated_documents')
                .select('*', { count: 'exact', head: true })
                .eq('firm_id', firm.id)
                .neq('status', 'completed')
            
            // Get variable count (Risk of Explosion)
            const { count: varCount } = await supabase
                .from('variable_dictionary')
                .select('*', { count: 'exact', head: true })
                .eq('firm_id', firm.id)

            firmHealth.push({
                firm_name: firm.name,
                failures: fFail || 0,
                variable_count: varCount || 0,
                status: fFail > 5 ? 'Critical' : (fFail > 0 ? 'Warning' : 'Healthy')
            });
        }

        platformView = {
            global_total: globalTotal || 0,
            firm_health: firmHealth.sort((a, b) => b.failures - a.failures) // Most critical first
        };
    }

    res.status(200).json({
        role: profile.role,
        firm_view: firmView,
        platform_view: platformView
    })

  } catch (error) {
    console.error('Dashboard Error:', error)
    res.status(500).json({ error: error.message })
  }
}
