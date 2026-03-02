import create from '../../_controllers/pv/create.js';
import del from '../../_controllers/pv/delete.js';
import list from '../../_controllers/pv/list.js';
import update from '../../_controllers/pv/update.js';
import approve from '../../_controllers/pv/approve.js';
import assignCategory from '../../_controllers/pv/assign-category.js';
import markPaid from '../../_controllers/pv/mark-paid.js';

export default async function handler(req, res) {
  const { route } = req.query;
  const action = route ? route[0] : null;

  switch (action) {
    case 'create': return create(req, res);
    case 'delete': return del(req, res);
    case 'list': return list(req, res);
    case 'update': return update(req, res);
    case 'approve': return approve(req, res);
    case 'assign-category': return assignCategory(req, res);
    case 'mark-paid': return markPaid(req, res);
    default: return res.status(404).json({ error: 'Not Found' });
  }
}
