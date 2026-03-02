// Generate
import genCreate from '../../_controllers/docs/generate/create.js';
import genList from '../../_controllers/docs/generate/list.js';

// Governance
import govDashboard from '../../_controllers/docs/governance/dashboard.js';
import govDictionary from '../../_controllers/docs/governance/dictionary.js';
import govVerify from '../../_controllers/docs/governance/verify-integrity.js';
import govWorkflow from '../../_controllers/docs/governance/workflow.js';

// PDF
import pdfMappings from '../../_controllers/docs/pdf/mappings.js';

// Templates
import tmplConfirm from '../../_controllers/docs/templates/confirm-variables.js';
import tmplDelete from '../../_controllers/docs/templates/delete.js';
import tmplList from '../../_controllers/docs/templates/list.js';
import tmplUpload from '../../_controllers/docs/templates/upload.js';

export default async function handler(req, res) {
  const { route } = req.query;
  const path = route ? route.join('/') : '';

  switch (path) {
    // Generate
    case 'generate/create': return genCreate(req, res);
    case 'generate/list': return genList(req, res);
    
    // Governance
    case 'governance/dashboard': return govDashboard(req, res);
    case 'governance/dictionary': return govDictionary(req, res);
    case 'governance/verify-integrity': return govVerify(req, res);
    case 'governance/workflow': return govWorkflow(req, res);

    // PDF
    case 'pdf/mappings': return pdfMappings(req, res);

    // Templates
    case 'templates/confirm-variables': return tmplConfirm(req, res);
    case 'templates/delete': return tmplDelete(req, res);
    case 'templates/list': return tmplList(req, res);
    case 'templates/upload': return tmplUpload(req, res);
    
    default: return res.status(404).json({ error: 'Not Found' });
  }
}
