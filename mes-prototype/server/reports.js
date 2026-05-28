import { GRADE_POINTS } from './db.js';

const GRADE_ORDER = ['AA', 'A', 'B', 'C'];

function ratingFromAvg(avg) {
  if (avg >= 3.5) return 'Excellent';
  if (avg >= 2.5) return 'Good';
  if (avg >= 1.5) return 'Average';
  return 'Needs Improvement';
}

export function getScorecards(db, { from, to, department, staff_id }) {
  let sql = `
    SELECT
      s.id as staff_id,
      s.reg_no,
      s.name as staff_name,
      s.department,
      COUNT(dg.id) as total_entries,
      COUNT(DISTINCT dg.entry_date) as days_worked,
      SUM(dg.quantity) as total_quantity,
      SUM(dg.w_min) as total_w_min,
      AVG(CASE dg.grade
        WHEN 'AA' THEN 4 WHEN 'A' THEN 3 WHEN 'B' THEN 2 WHEN 'C' THEN 1 ELSE NULL END
      ) as avg_score,
      SUM(CASE WHEN dg.grade = 'C' THEN 1 ELSE 0 END) as grade_c,
      SUM(CASE WHEN dg.grade = 'B' THEN 1 ELSE 0 END) as grade_b,
      SUM(CASE WHEN dg.grade = 'A' THEN 1 ELSE 0 END) as grade_a,
      SUM(CASE WHEN dg.grade = 'AA' THEN 1 ELSE 0 END) as grade_aa
    FROM staff s
    INNER JOIN daily_grading dg ON dg.staff_id = s.id
    WHERE dg.deleted_at IS NULL AND dg.entry_date >= ? AND dg.entry_date <= ?
  `;
  const params = [from, to];
  if (department) { sql += ' AND s.department = ?'; params.push(department); }
  if (staff_id) { sql += ' AND s.id = ?'; params.push(staff_id); }
  sql += ' GROUP BY s.id ORDER BY avg_score DESC, s.reg_no';

  const rows = db.prepare(sql).all(...params);

  return rows.map((r) => {
    const total = r.total_entries || 0;
    const avg = r.avg_score ?? 0;
    const dist = {
      C: r.grade_c,
      B: r.grade_b,
      A: r.grade_a,
      AA: r.grade_aa,
    };
    const pct = (g) => (total ? Math.round((dist[g] / total) * 100) : 0);
    return {
      staff_id: r.staff_id,
      reg_no: r.reg_no,
      staff_name: r.staff_name,
      department: r.department,
      total_entries: total,
      days_worked: r.days_worked,
      total_quantity: r.total_quantity,
      total_w_min: round(r.total_w_min, 2),
      avg_score: round(avg, 2),
      rating: ratingFromAvg(avg),
      grade_distribution: GRADE_ORDER.map((g) => ({
        grade: g,
        count: dist[g],
        percent: pct(g),
      })),
      top_grade: GRADE_ORDER.find((g) => dist[g] > 0) || '—',
    };
  });
}

export function getPeriodRange(period, anchor) {
  const d = anchor ? new Date(anchor) : new Date();
  if (period === 'weekly') {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      from: monday.toISOString().slice(0, 10),
      to: sunday.toISOString().slice(0, 10),
      label: `Week of ${monday.toISOString().slice(0, 10)}`,
    };
  }
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    label: from.toLocaleString('default', { month: 'long', year: 'numeric' }),
  };
}

export function getWorkerDetail(db, staffId, { from, to }) {
  const staff = db.prepare('SELECT * FROM staff WHERE id = ?').get(staffId);
  if (!staff) return null;

  const summary = getScorecards(db, { from, to, staff_id: staffId })[0] || null;

  const entries = db.prepare(`
    SELECT dg.*, gs.prod_name, gs.cost_center_name
    FROM daily_grading dg
    LEFT JOIN grading_standards gs
      ON gs.prod_code = dg.prod_code AND gs.cost_center_code = dg.cost_center_code
    WHERE dg.deleted_at IS NULL AND dg.staff_id = ? AND dg.entry_date >= ? AND dg.entry_date <= ?
    ORDER BY dg.entry_date DESC, dg.id DESC
  `).all(staffId, from, to);

  return { staff, summary, entries, from, to };
}

export function getDashboardTrend(db, endDate, days = 7) {
  const end = new Date(endDate + 'T12:00:00');
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  const from = start.toISOString().slice(0, 10);
  const to = end.toISOString().slice(0, 10);

  const rows = db.prepare(`
    SELECT entry_date, grade, COUNT(*) as count
    FROM daily_grading
    WHERE deleted_at IS NULL AND entry_date >= ? AND entry_date <= ?
    GROUP BY entry_date, grade
    ORDER BY entry_date
  `).all(from, to);

  const byDate = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    byDate[key] = { date: key, total: 0, grades: { C: 0, B: 0, A: 0, AA: 0 } };
  }
  for (const r of rows) {
    if (!byDate[r.entry_date]) continue;
    byDate[r.entry_date].grades[r.grade] = r.count;
    byDate[r.entry_date].total += r.count;
  }
  return { from, to, days: Object.values(byDate) };
}

function round(n, d) {
  if (n == null) return 0;
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
