import create from '../../_controllers/cases/create.js';
import del from '../../_controllers/cases/delete.js';
import list from '../../_controllers/cases/list.js';
import search from '../../_controllers/cases/search.js';
import update from '../../_controllers/cases/update.js';

export default async function handler(req, res) {
  const { route } = req.query;
  const action = route ? route[0] : null;

  switch (action) {
    case 'create': return create(req, res);
    case 'delete': return del(req, res);
    case 'list': return list(req, res);
    case 'search': return search(req, res);
    case 'update': return update(req, res);
    default: return res.status(404).json({ error: 'Not Found' });
  }
}
