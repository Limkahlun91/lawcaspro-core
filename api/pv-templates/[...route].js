import get from '../../_controllers/pv-templates/get.js';
import list from '../../_controllers/pv-templates/list.js';

export default async function handler(req, res) {
  const { route } = req.query;
  const action = route ? route[0] : null;

  switch (action) {
    case 'get': return get(req, res);
    case 'list': return list(req, res);
    default: return res.status(404).json({ error: 'Not Found' });
  }
}
