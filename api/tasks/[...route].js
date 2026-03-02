import create from '../../_controllers/tasks/create.js';
import list from '../../_controllers/tasks/list.js';
import update from '../../_controllers/tasks/update.js';

export default async function handler(req, res) {
  const { route } = req.query;
  const action = route ? route[0] : null;

  switch (action) {
    case 'create': return create(req, res);
    case 'list': return list(req, res);
    case 'update': return update(req, res);
    default: return res.status(404).json({ error: 'Not Found' });
  }
}
