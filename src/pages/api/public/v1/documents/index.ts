import { NextApiRequest, NextApiResponse } from 'next';
import { apiMiddleware, AuthenticatedRequest } from '../../../../../../modules/api-gateway/middleware/auth.middleware';
import { financialService } from '../../../../../../modules/financial/financial.service';
import { usageService } from '../../../../../../modules/billing/usage.service';
import { featureFlagService } from '../../../../../../modules/infra/feature-flag.service';

export default async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  // 1. API Key Validation Middleware
  await new Promise<void>((resolve) => apiMiddleware.validateApiKey(req, res, () => resolve()));
  if (res.writableEnded) return;

  // 2. Request ID
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', requestId);

  // 3. Method Router
  if (req.method === 'POST') {
    return createDocument(req, res);
  } else {
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } });
  }
}

async function createDocument(req: AuthenticatedRequest, res: NextApiResponse) {
  try {
    const { firmId } = req;
    
    // 4. Feature Flag Check
    if (!(await featureFlagService.isEnabled(firmId!, 'public_api_v1'))) {
      return res.status(403).json({ success: false, error: { code: 'FEATURE_DISABLED', message: 'Public API access is disabled for your plan' } });
    }

    // 5. Quota Check (Rate Limit assumed handled in middleware or Redis)
    // Here we check functional quota (e.g. document storage limit)
    // For creating doc, maybe not strictly quota unless tiered.
    
    const dto = req.body;
    
    // 6. Validation (Zod schema ideally)
    if (!dto.client_id || !dto.items) {
       return res.status(400).json({ success: false, error: { code: 'INVALID_PAYLOAD', message: 'Missing required fields' } });
    }

    // 7. Execute Service
    // We inject user_id as 'API_USER' or derive from API Key owner
    const doc = await financialService.createDocument({
      ...dto,
      firm_id: firmId!,
      user_id: dto.user_id || 'system_api' // Should be mapped from API Key created_by
    });

    // 8. Log Usage (Billing)
    // await usageService.incrementUsage(firmId!, 'api_document_create');

    // 9. Standard Response
    return res.status(201).json({
      success: true,
      data: doc,
      meta: { request_id: res.getHeader('X-Request-ID') }
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
}
