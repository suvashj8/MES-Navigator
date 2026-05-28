import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, initSchema } from './db.js';
import { seedDefaultUsers } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const excelPath = path.join(__dirname, '..', '..', 'bed for life.xlsx');

function parseArticle(display) {
  const s = String(display || '').trim();
  const idx = s.indexOf('-');
  if (idx > 0) return { code: s.slice(0, idx).trim(), name: s.slice(idx + 1).trim() };
  return { code: s, name: s };
}

function fmtDate(v) {
  if (!v) return null;
  if (v instanceof Date && v.getFullYear() > 1901) return v.toISOString().slice(0, 10);
  return null;
}

initSchema();

const tables = ['activity_cost_center_maps', 'daily_grading', 'grading_standards', 'articles', 'activities', 'staff'];
for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();
db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('staff','activities','articles','grading_standards','daily_grading','activity_cost_center_maps')").run();

const wb = XLSX.readFile(excelPath);

// Staff (sheet '1')
const staffRows = XLSX.utils.sheet_to_json(wb.Sheets['1'], { header: 1 });
const insertStaff = db.prepare('INSERT INTO staff (reg_no, name, department) VALUES (?, ?, ?)');
let regCounter = 100;
for (let i = 1; i < staffRows.length; i++) {
  const [reg, name, dept] = staffRows[i];
  if (!name) continue;
  const regNo = reg != null && reg !== '' ? Number(reg) : ++regCounter;
  insertStaff.run(regNo, String(name).trim(), String(dept || 'General').trim());
}

// Activities (sheet '2')
const actRows = XLSX.utils.sheet_to_json(wb.Sheets['2'], { header: 1 });
const insertAct = db.prepare('INSERT INTO activities (code, name) VALUES (?, ?)');
for (let i = 1; i < actRows.length; i++) {
  const [code, name] = actRows[i];
  if (code == null || !name) continue;
  insertAct.run(Number(code), String(name).trim());
}

// Articles (sheet '3')
const artRows = XLSX.utils.sheet_to_json(wb.Sheets['3'], { header: 1 });
const insertArt = db.prepare('INSERT INTO articles (code, name, display) VALUES (?, ?, ?)');
const seen = new Set();
for (let i = 1; i < artRows.length; i++) {
  const display = artRows[i][0];
  if (!display) continue;
  const d = String(display).trim();
  if (seen.has(d)) continue;
  seen.add(d);
  const { code, name } = parseArticle(d);
  insertArt.run(code, name, d);
}

// Grading standards (sheet '4')
const stdRows = XLSX.utils.sheet_to_json(wb.Sheets['4'], { header: 1 });
const headers = stdRows[0];
const insertStd = db.prepare(`
  INSERT INTO grading_standards (
    prod_code, prod_name, cost_center_code, cost_center_name,
    standard_min, std_qty, c_value, b_value, a_value, aplus_value, effective_date
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
for (let i = 1; i < stdRows.length; i++) {
  const row = stdRows[i];
  if (!row || !row[1]) continue;
  const [
    , prodCode, prodName, ccCode, ccName, stdMin, stdQty,
    cVal, bVal, aVal, aplus, effDate,
  ] = row;
  insertStd.run(
    String(prodCode).trim(),
    String(prodName).trim(),
    String(ccCode).trim(),
    String(ccName).trim(),
    Number(stdMin) || 420,
    Number(stdQty),
    Number(cVal),
    Number(bVal),
    Number(aVal),
    Number(aplus),
    fmtDate(effDate)
  );
}

// Sync cost centers from standards
const ccRows = db.prepare('SELECT DISTINCT cost_center_code as code, cost_center_name as name FROM grading_standards').all();
const insertCc = db.prepare('INSERT OR IGNORE INTO cost_centers (code, name) VALUES (?, ?)');
for (const cc of ccRows) insertCc.run(cc.code, cc.name);

// Activity ↔ cost center mappings (heuristic from names)
db.prepare('DELETE FROM activity_cost_center_maps').run();
const activities = db.prepare('SELECT * FROM activities').all();
const costCenters = db.prepare('SELECT * FROM cost_centers').all();
const insertMap = db.prepare('INSERT OR IGNORE INTO activity_cost_center_maps (activity_id, cost_center_code) VALUES (?, ?)');

const rules = [
  { activity: /bead/i, center: /bead/i },
  { activity: /ball/i, center: /ball/i },
  { activity: /potay|pote/i, center: /pote/i },
  { activity: /stone/i, center: /stone/i },
  { activity: /braid/i, center: /braid/i },
  { activity: /finish/i, center: /finish/i },
  { activity: /check/i, center: /check|quality/i },
  { activity: /pack|count/i, center: /pack|count/i },
  { activity: /barcode/i, center: /barcode/i },
  { activity: /hangtag|tag/i, center: /tag|hang/i },
  { activity: /making/i, center: /production|making/i },
];

for (const act of activities) {
  for (const cc of costCenters) {
    const matched = rules.some(
      (r) => r.activity.test(act.name) && r.center.test(cc.name)
    );
    if (matched) insertMap.run(act.id, cc.code);
  }
}

seedDefaultUsers();

console.log('Seed complete:');
console.log('  Staff:', db.prepare('SELECT COUNT(*) as c FROM staff').get().c);
console.log('  Activities:', db.prepare('SELECT COUNT(*) as c FROM activities').get().c);
console.log('  Articles:', db.prepare('SELECT COUNT(*) as c FROM articles').get().c);
console.log('  Grading standards:', db.prepare('SELECT COUNT(*) as c FROM grading_standards').get().c);
console.log('  Cost centers:', db.prepare('SELECT COUNT(*) as c FROM cost_centers').get().c);
console.log('  Activity mappings:', db.prepare('SELECT COUNT(*) as c FROM activity_cost_center_maps').get().c);
