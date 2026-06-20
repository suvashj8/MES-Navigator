import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { one, all, run, initSchema } from './db.js';
import { seedDefaultUsers } from './auth.js';
import { linkGradingStandardsToProductMaster } from './productMasterLink.js';
import { loadStaffFromExcel } from './lib/staffExcel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { resolveExcelPath } from './lib/excelPath.js';

const excelPath = resolveExcelPath();

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

async function main() {
  await initSchema();

  await run(`
    TRUNCATE TABLE
      activity_cost_center_maps,
      daily_grading,
      daily_grading_audit,
      missing_standards,
      grading_standards,
      product_components,
      product_account_mapping,
      product_excise_mappings,
      product_master,
      articles,
      activities,
      staff,
      cost_centers
    RESTART IDENTITY CASCADE
  `);

  const wb = XLSX.readFile(excelPath);

  for (const row of loadStaffFromExcel(excelPath)) {
    await run('INSERT INTO staff (reg_no, name, department) VALUES (?, ?, ?)', [
      row.regNo,
      row.name,
      row.department,
    ]);
  }

  const actRows = XLSX.utils.sheet_to_json(wb.Sheets['2'], { header: 1 });
  for (let i = 1; i < actRows.length; i++) {
    const [code, name] = actRows[i];
    if (code == null || !name) continue;
    await run('INSERT INTO activities (code, name) VALUES (?, ?)', [Number(code), String(name).trim()]);
  }

  const artRows = XLSX.utils.sheet_to_json(wb.Sheets['3'], { header: 1 });
  const seen = new Set();
  for (let i = 1; i < artRows.length; i++) {
    const display = artRows[i][0];
    if (!display) continue;
    const d = String(display).trim();
    if (seen.has(d)) continue;
    seen.add(d);
    const { code, name } = parseArticle(d);
    await run('INSERT INTO articles (code, name, display) VALUES (?, ?, ?)', [code, name, d]);
  }

  const stdRows = XLSX.utils.sheet_to_json(wb.Sheets['4'], { header: 1 });
  for (let i = 1; i < stdRows.length; i++) {
    const row = stdRows[i];
    if (!row || !row[1]) continue;
    const [, prodCode, prodName, ccCode, ccName, stdMin, stdQty, cVal, bVal, aVal, aplus, effDate] = row;
    await run(
      `
      INSERT INTO grading_standards (
        prod_code, prod_name, cost_center_code, cost_center_name,
        standard_min, std_qty, c_value, b_value, a_value, aplus_value, aa_value, effective_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
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
        Number(aplus),
        fmtDate(effDate),
      ]
    );
  }

  const ccRows = await all(
    'SELECT DISTINCT cost_center_code AS code, cost_center_name AS name FROM grading_standards'
  );
  for (const cc of ccRows) {
    await run('INSERT OR IGNORE INTO cost_centers (code, name) VALUES (?, ?)', [cc.code, cc.name]);
  }

  await run('DELETE FROM activity_cost_center_maps');
  const activities = await all('SELECT * FROM activities');
  const costCenters = await all('SELECT * FROM cost_centers');

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
      const matched = rules.some((r) => r.activity.test(act.name) && r.center.test(cc.name));
      if (matched) {
        await run('INSERT OR IGNORE INTO activity_cost_center_maps (activity_id, cost_center_code) VALUES (?, ?)', [
          act.id,
          cc.code,
        ]);
      }
    }
  }

  await seedDefaultUsers();

  const linkResult = await linkGradingStandardsToProductMaster({
    createMissing: true,
    createdBy: 'seed',
  });

  const pmCount = (await one('SELECT COUNT(*)::int AS c FROM product_master'))?.c ?? 0;
  console.log(
    `  Product Master: ${pmCount} (${linkResult.productsCreated} created from rules)`
  );
  console.log(`  Grading rules linked: ${linkResult.linkedRules}/${linkResult.totalRules}`);

  console.log('Seed complete:');
  console.log('  Staff:', (await one('SELECT COUNT(*)::int AS c FROM staff'))?.c);
  console.log('  Activities:', (await one('SELECT COUNT(*)::int AS c FROM activities'))?.c);
  console.log('  Articles:', (await one('SELECT COUNT(*)::int AS c FROM articles'))?.c);
  console.log('  Grading standards:', (await one('SELECT COUNT(*)::int AS c FROM grading_standards'))?.c);
  console.log('  Cost centers:', (await one('SELECT COUNT(*)::int AS c FROM cost_centers'))?.c);
  console.log('  Activity mappings:', (await one('SELECT COUNT(*)::int AS c FROM activity_cost_center_maps'))?.c);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
