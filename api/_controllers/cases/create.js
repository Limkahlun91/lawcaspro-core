import { createClient } from '@supabase/supabase-js';
import { verifyUser } from '../../_utils/auth.js';
import { logAudit } from '../../_utils/audit.js';
import { encrypt } from '../../_utils/crypto.js';
import { z } from 'zod';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

// Enterprise Core V2 Schema
const CreateCaseSchema = z.object({
  // Basic Info
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  fileRef: z.string().optional(),
  status: z.enum(['Open', 'Closed', 'Archived']).default('Open'),
  
  // Project Info
  project_id: z.string().optional(),
  developer_id: z.string().optional(), // New
  
  // Case Governance
  purchase_mode: z.enum(['CASH', 'LOAN', 'OTHERS']).optional(),
  unit_category: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL']).optional(),
  spa_price: z.number().optional(),
  apdl_price: z.number().optional(), // New
  developer_discount: z.number().optional(), // New
  is_bumiputra: z.boolean().default(false), // New
  approved_purchase_price: z.number().optional(), // New
  
  // Legacy fields (for backward compatibility until frontend full switch)
  client_name: z.string().optional(),
  client_ic: z.string().optional(),
  unit_no: z.string().optional(),

  // New Engines Data (Optional for now, strictly validated if present)
  properties: z.object({
    developer_parcel_no: z.string().optional(),
    building_type: z.string().optional(),
    unit_type: z.string().optional(),
    land_area: z.number().optional(),
    build_up_area: z.number().optional(),
    parcel_area: z.number().optional(),
    storey_no: z.string().optional(),
    building_no: z.string().optional(),
    car_park_no: z.string().optional(),
    car_park_level: z.string().optional(),
    accessory_parcel_no: z.string().optional(),
    share_units: z.string().optional()
  }).optional(),

  purchasers: z.array(z.object({
    sequence_no: z.number().default(1),
    name: z.string(),
    id_no: z.string().optional(),
    is_company: z.boolean().default(false),
    tin_no: z.string().optional(),
    contact_no: z.string().optional(),
    email: z.string().email().optional(),
    address_line_1: z.string().optional(),
    address_line_2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postcode: z.string().optional(),
    country: z.string().default('Malaysia')
  })).optional()
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Zero Trust: Verify User
    const { user, firmId, userId } = await verifyUser(req);

    // 2. Validate Inputs
    const validationResult = CreateCaseSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation Error',
        details: validationResult.error.format()
      });
    }

    const { 
      title, description, fileRef, status,
      project_id, developer_id,
      purchase_mode, unit_category, spa_price, apdl_price, developer_discount, is_bumiputra, approved_purchase_price,
      client_name, client_ic, unit_no, // Legacy
      properties, purchasers
    } = validationResult.data;

    // 3. Encrypt Sensitive Data (Legacy Support)
    const client_ic_encrypted = client_ic ? encrypt(client_ic) : null;

    // 4. Initialize Supabase
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.authorization },
      },
    });

    // 5. Transaction: Create Case + Related Engines (RPC)
    // Level 6 Security: Use RPC to ensure atomicity and strict RLS/Permission checks
    const { data: result, error: rpcError } = await supabase.rpc('create_full_case', {
        p_title: title,
        p_description: description || null,
        p_file_ref: fileRef || null,
        p_status: status,
        p_project_id: project_id ? parseInt(project_id) : null,
        p_developer_id: developer_id ? parseInt(developer_id) : null,
        p_purchase_mode: purchase_mode || null,
        p_unit_category: unit_category || null,
        p_spa_price: spa_price || null,
        p_apdl_price: apdl_price || null,
        p_developer_discount: developer_discount || null,
        p_is_bumiputra: is_bumiputra || false,
        p_approved_purchase_price: approved_purchase_price || null,
        p_client_name_legacy: client_name || (purchasers && purchasers.length > 0 ? purchasers[0].name : 'Unknown'),
        p_client_ic_encrypted_legacy: client_ic_encrypted || null,
        p_unit_no_legacy: unit_no || (properties ? properties.developer_parcel_no : null),
        p_properties: properties || null,
        p_purchasers: purchasers || null
    });

    if (rpcError) throw rpcError;
    const caseId = result.case_id;

    // 6. Audit Log
    await logAudit({
      action: 'CREATE_ENTERPRISE_CASE',
      tableName: 'cases',
      recordId: caseId,
      newData: { title, firmId, engines_activated: ['core', 'property', 'purchaser'], mode: 'RPC_STRICT' },
      userId,
      firmId,
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });

    return res.status(201).json({ success: true, case: { id: caseId, ...result } });

  } catch (error) {
    console.error('Create Enterprise Case Error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('token')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
