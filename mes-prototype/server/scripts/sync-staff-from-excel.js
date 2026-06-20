/**
 * Sync staff registration numbers and departments from Excel sheet "1".
 * Usage: node scripts/sync-staff-from-excel.js [--excel path] [--dry-run]
 */
import path from 'path';
import { initSchema, all, transaction } from '../db.js';
import { loadStaffFromExcel, normalizeStaffName, DEFAULT_STAFF_EXCEL } from '../lib/staffExcel.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const excelArg = args.find((a) => a.startsWith('--excel='));
const excelPath = excelArg ? path.resolve(excelArg.split('=').slice(1).join('=')) : DEFAULT_STAFF_EXCEL;

async function main() {
  await initSchema();
  const excelStaff = loadStaffFromExcel(excelPath);
  const dbStaff = await all('SELECT id, reg_no, name, department FROM staff');

  const byName = new Map(dbStaff.map((s) => [normalizeStaffName(s.name), s]));
  const updates = [];
  const inserts = [];

  for (const row of excelStaff) {
    const existing = byName.get(row.normName);
    if (existing) {
      if (existing.reg_no !== row.regNo || existing.department !== row.department) {
        updates.push({ id: existing.id, name: row.name, regNo: row.regNo, department: row.department });
      }
    } else {
      inserts.push(row);
    }
  }

  const excelNames = new Set(excelStaff.map((r) => r.normName));
  const notInExcel = dbStaff.filter((s) => !excelNames.has(normalizeStaffName(s.name)));

  console.log(`Excel: ${excelPath}`);
  console.log(`Staff in Excel: ${excelStaff.length}`);
  console.log(`Updates: ${updates.length}, Inserts: ${inserts.length}, Not in Excel: ${notInExcel.length}`);

  for (const u of updates) {
    console.log(`  update reg ${u.regNo} — ${u.name} (${u.department})`);
  }
  for (const ins of inserts) {
    console.log(`  insert reg ${ins.regNo} — ${ins.name} (${ins.department})`);
  }
  for (const extra of notInExcel) {
    console.log(`  (unchanged, not in Excel) reg ${extra.reg_no} — ${extra.name}`);
  }

  if (dryRun) {
    console.log('Dry run — no database changes.');
    return;
  }

  await transaction(async (tx) => {
    for (const u of updates) {
      await tx.run('UPDATE staff SET reg_no = ? WHERE id = ?', [-u.id, u.id]);
    }
    for (const u of updates) {
      await tx.run('UPDATE staff SET reg_no = ?, department = ? WHERE id = ?', [
        u.regNo,
        u.department,
        u.id,
      ]);
    }
    for (const ins of inserts) {
      await tx.run('INSERT INTO staff (reg_no, name, department) VALUES (?, ?, ?)', [
        ins.regNo,
        ins.name,
        ins.department,
      ]);
    }
  });

  console.log('Staff sync completed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
