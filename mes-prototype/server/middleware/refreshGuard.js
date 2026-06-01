import { refreshAuthSession } from '../auth.js';

export async function refreshHandler(req, res) {
  const refreshToken = req.body?.refreshToken;
  if (!refreshToken || typeof refreshToken !== 'string') {
    return res.status(400).json({ error: 'refreshToken is required' });
  }

  const session = await refreshAuthSession(refreshToken);
  if (!session) {
    return res.status(401).json({ error: 'Refresh token invalid or expired. Please sign in again.' });
  }

  return res.json(session);
}
