import { all } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requirePermission } from '../middleware.js';
import { resolveDepartment } from '../scope.js';
import { adToBs, bsToAd, todayPair } from '../nepaliDate.js';

export function registerReferenceRoutes(app) {
app.get('/api/nepali-date', asyncHandler(async (req, res) => {
  const { ad, bs } = req.query;
  if (ad) return res.json(adToBs(ad));
  if (bs) return res.json(bsToAd(bs));
  res.json(todayPair());
}));
app.get('/api/activities', requirePermission('reports:read'), asyncHandler(async (_, res) => {
  res.json(await all('SELECT * FROM activities ORDER BY code', []));
}));

// Articles ---
app.get('/api/articles', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (q) {
    return res.json(
      await all('SELECT * FROM articles WHERE display LIKE ? OR code LIKE ? LIMIT 50', [`%${q}%`, `%${q}%`])
    );
  }
  res.json(await all('SELECT * FROM articles ORDER BY code LIMIT 200', []));
}));

// Cost centers ---
app.get('/api/cost-centers', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const { activity_id } = req.query;
  if (activity_id) {
    return res.json(
      await all(`
        SELECT c.code, c.name FROM activity_cost_center_maps m
        JOIN cost_centers c ON c.code = m.cost_center_code
        WHERE m.activity_id = ?
        ORDER BY c.name
      `, [activity_id])
    );
  }
  res.json(await all('SELECT code, name FROM cost_centers ORDER BY name', []));
}));
app.get('/api/departments', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const scope = resolveDepartment(req, req.query.department);
  if (scope.locked && scope.department) {
    return res.json([scope.department]);
  }
  const deptRows = await all('SELECT DISTINCT department FROM staff ORDER BY department', []);
  res.json(deptRows.map((r) => r.department));
}));

}
