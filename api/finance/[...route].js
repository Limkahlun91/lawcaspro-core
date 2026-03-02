import revenue from '../../_controllers/finance/revenue.js';

export default async function handler(req, res) {
  const { route } = req.query;
  const action = route ? route[0] : null;

  switch (action) {
    case 'revenue': return revenue(req, res);
    default: return res.status(404).json({ error: 'Not Found' });
  }
}
