import { one, all } from '../db.js';
import { asyncHandler } from '../asyncHandler.js';
import { requirePermission } from '../middleware.js';
import { resolveDepartment } from '../scope.js';
import { getDashboardTrend, getScorecards, getPeriodRange } from '../reports.js';

export function registerDashboardRoutes(app) {
app.get('/api/dashboard', requirePermission('reports:read'), asyncHandler(async (req, res) => {
  const { date, not_graded_offset, not_graded_limit } = req.query;
  const today = date || new Date().toISOString().slice(0, 10);
  const { department } = resolveDepartment(req, req.query.department);
  const gradeDist = await all(
    'SELECT grade, COUNT(*) as count FROM daily_grading WHERE deleted_at IS NULL AND entry_date = ? GROUP BY grade'
  , [today]);
  const deptSummary = await all(`
    SELECT s.department, dg.grade, COUNT(*) as count
    FROM daily_grading dg JOIN staff s ON s.id = dg.staff_id
    WHERE dg.deleted_at IS NULL AND dg.entry_date = ? GROUP BY s.department, dg.grade
  `, [today]);

  const byFamily = await all(`
    SELECT COALESCE(p.family, '—') as family, COUNT(*) as count
    FROM daily_grading dg
    LEFT JOIN products p ON p.code = dg.prod_code
    WHERE dg.deleted_at IS NULL AND dg.entry_date = ?${department ? ' AND EXISTS (SELECT 1 FROM staff s WHERE s.id = dg.staff_id AND s.department = ?)' : ''}
    GROUP BY COALESCE(p.family, '—')
    ORDER BY count DESC
    LIMIT 10
  `, [...(department ? [today, department] : [today])]);

  const byGroup = await all(`
    SELECT COALESCE(p.group_name, '—') as group_name, COUNT(*) as count
    FROM daily_grading dg
    LEFT JOIN products p ON p.code = dg.prod_code
    WHERE dg.deleted_at IS NULL AND dg.entry_date = ?${department ? ' AND EXISTS (SELECT 1 FROM staff s WHERE s.id = dg.staff_id AND s.department = ?)' : ''}
    GROUP BY COALESCE(p.group_name, '—')
    ORDER BY count DESC
    LIMIT 10
  `, [...(department ? [today, department] : [today])]);
  const weekSummary = await getScorecards(getPeriodRange('weekly', today));

  const allStaff = await all(
    `SELECT id, reg_no, name, department FROM staff WHERE is_active=1${department ? ' AND department = ?' : ''} ORDER BY reg_no`
  , [...(department ? [department] : [])]);
  const gradedRows = await all(
    `SELECT DISTINCT dg.staff_id as id
     FROM daily_grading dg
     JOIN staff s ON s.id = dg.staff_id
     WHERE dg.deleted_at IS NULL AND dg.entry_date = ?${department ? ' AND s.department = ?' : ''}`,
    [...(department ? [today, department] : [today])]
  );
  const gradedIds = new Set(gradedRows.map((r) => r.id));
  const allNotGraded = allStaff.filter((s) => !gradedIds.has(s.id));
  const offset = Math.max(0, Number(not_graded_offset || 0) || 0);
  const limit = Math.min(50, Math.max(1, Number(not_graded_limit || 10) || 10));
  const workersNotGradedToday = allNotGraded.slice(offset, offset + limit);

  const productMasterCount = (await one('SELECT COUNT(*) as c FROM product_master', []))?.c ?? 0;
  const productsWithoutRulesCount =
    (await one(
      `
    SELECT COUNT(*) as c FROM product_master pm
    WHERE NOT EXISTS (
      SELECT 1 FROM grading_standards gs WHERE gs.prod_code = pm.code
    )
  `,
      []
    ))?.c ?? 0;

  res.json({
    date: today,
    todayEntries:
      (await one('SELECT COUNT(*) as c FROM daily_grading WHERE deleted_at IS NULL AND entry_date = ?', [today]))?.c ?? 0,
    staffCount: (await one('SELECT COUNT(*) as c FROM staff WHERE is_active=1', []))?.c ?? 0,
    standardsCount: (await one('SELECT COUNT(*) as c FROM grading_standards', []))?.c ?? 0,
    productMasterCount,
    productsWithoutRulesCount,
    gradeDist,
    deptSummary,
    byFamily,
    byGroup,
    trend: await getDashboardTrend(today, 7),
    weekWorkersGraded: weekSummary.length,
    weekEntries: weekSummary.reduce((s, c) => s + c.total_entries, 0),
    workersNotGradedToday,
    workersNotGradedTotal: allNotGraded.length,
    workersNotGradedOffset: offset,
    workersNotGradedLimit: limit,
  });
}));
}
