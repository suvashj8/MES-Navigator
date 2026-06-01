import { asyncHandler } from '../asyncHandler.js';
import { requirePermission } from '../middleware.js';
import { resolveDepartment } from '../scope.js';
import { getScorecards, getPeriodRange, getWorkerDetail } from '../reports.js';
import { streamScorecardsPdf, streamWorkerPdf } from '../pdf.js';

export function registerReportsRoutes(app) {
app.get('/api/reports/scorecards', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const { period = 'weekly', anchor, from, to, staff_id } = req.query;
  const family = req.query.family ? String(req.query.family) : '';
  const group_name = req.query.group_name ? String(req.query.group_name) : '';
  const { department } = resolveDepartment(req, req.query.department);
  let range;
  if (from && to) {
    range = { from, to, label: `${from} to ${to}` };
  } else {
    range = getPeriodRange(period, anchor);
  }
  const cards = await getScorecards({
    from: range.from,
    to: range.to,
    department: department || undefined,
    staff_id: staff_id ? Number(staff_id) : undefined,
    family: family || undefined,
    group_name: group_name || undefined,
  });
  res.json({ period, ...range, scorecards: cards, scope: resolveDepartment(req, req.query.department) });
}));

app.get('/api/reports/worker/:staffId', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const { from, to, period = 'weekly', anchor } = req.query;
  const family = req.query.family ? String(req.query.family) : '';
  const group_name = req.query.group_name ? String(req.query.group_name) : '';
  let range;
  if (from && to) range = { from, to };
  else range = getPeriodRange(period, anchor);
  const detail = await getWorkerDetail(Number(req.params.staffId), {
    ...range,
    family: family || undefined,
    group_name: group_name || undefined,
  });
  if (!detail) return res.status(404).json({ error: 'Worker not found' });
  res.json(detail);
}));
app.get('/api/reports/scorecards/export', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const { period = 'weekly', anchor, from, to, staff_id } = req.query;
  const { department } = resolveDepartment(req, req.query.department);
  let range;
  if (from && to) range = { from, to, label: `${from} to ${to}` };
  else range = getPeriodRange(period, anchor);
  const cards = await getScorecards({
    from: range.from,
    to: range.to,
    department: department || undefined,
    staff_id: staff_id ? Number(staff_id) : undefined,
  });
  const header = ['Reg No', 'Staff Name', 'Department', 'Entries', 'Days Worked', 'Total Qty', 'Avg Score', 'Rating', 'Grade C', 'Grade B', 'Grade A', 'Grade AA'];
  const rows = cards.map((c) => [
    c.reg_no, c.staff_name, c.department, c.total_entries, c.days_worked, c.total_quantity,
    c.avg_score, c.rating,
    c.grade_distribution.find((g) => g.grade === 'C')?.count ?? 0,
    c.grade_distribution.find((g) => g.grade === 'B')?.count ?? 0,
    c.grade_distribution.find((g) => g.grade === 'A')?.count ?? 0,
    c.grade_distribution.find((g) => g.grade === 'AA')?.count ?? 0,
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="scorecards-${range.from}-${range.to}.csv"`);
  res.send(csv);
}));

// PDF export scorecards ---
app.get('/api/reports/scorecards/export.pdf', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const { period = 'weekly', anchor, from, to, staff_id } = req.query;
  const { department } = resolveDepartment(req, req.query.department);
  let range;
  if (from && to) range = { from, to, label: `${from} to ${to}` };
  else range = getPeriodRange(period, anchor);
  const cards = await getScorecards({
    from: range.from,
    to: range.to,
    department: department || undefined,
    staff_id: staff_id ? Number(staff_id) : undefined,
  });
  streamScorecardsPdf(res, { ...range, scorecards: cards });
}));

app.get('/api/reports/worker/:staffId/export.pdf', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const { from, to, period = 'weekly', anchor } = req.query;
  let range;
  if (from && to) range = { from, to };
  else range = getPeriodRange(period, anchor);
  const detail = await getWorkerDetail(Number(req.params.staffId), range);
  if (!detail) return res.status(404).json({ error: 'Worker not found' });
  if (req.user.role === 'supervisor' && req.user.department && detail.staff.department !== req.user.department) {
    return res.status(403).json({ error: 'Access denied for this department' });
  }
  streamWorkerPdf(res, detail);
}));
}
