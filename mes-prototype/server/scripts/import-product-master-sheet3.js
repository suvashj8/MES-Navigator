/**
 * Import sample products from "bead for life.xlsx" sheet 3 into product_master.
 */
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { one, all, run, initSchema } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const excelPath = path.join(__dirname, '..', '..', '..', 'bead for life.xlsx');
const PER_GROUP = 10;
const replace = process.argv.includes('--replace');

function parseBL(line) {
  const s = String(line).trim();
  const m = s.match(/^(BL\d+)-(.+)$/i);
  if (!m) return null;
  return { code: m[1].toUpperCase(), description: m[2].trim(), display: s, group: null };
}

function parseOBO(line) {
  const s = String(line).trim();
  const m = s.match(/^(OBO)-(\d+)-(.+)$/i);
  if (!m) return null;
  return {
    code: `${m[1].toUpperCase()}-${m[2]}`,
    description: m[3].trim(),
    display: s,
    group: 'OBO',
  };
}

function bucketSheet3Rows(rawLines) {
  const buckets = { BL: [], OBO: [], SS26: [], NOOS: [] };
  let section = 'BL';

  for (const line of rawLines) {
    const s = String(line).trim();
    if (!s) continue;
    if (/^-?SS26$/i.test(s)) {
      section = 'SS26';
      continue;
    }
    if (/^-?NOOS$/i.test(s)) {
      section = 'NOOS';
      continue;
    }
    if (s.toUpperCase() === 'OBO') {
      section = 'OBO';
      continue;
    }
    buckets[section].push(s);
  }
  return buckets;
}

function takeParsed(bucket, parser, groupTag, limit = PER_GROUP) {
  const out = [];
  const seenCodes = new Set();
  for (const line of bucket) {
    if (out.length >= limit) break;
    const row = parser(line);
    if (!row) continue;
    if (seenCodes.has(row.code)) continue;
    seenCodes.add(row.code);
    out.push({ ...row, group: groupTag || row.group });
  }
  return out;
}

function readSheet3() {
  const wb = XLSX.readFile(excelPath);
  const sheet = wb.Sheets['3'];
  if (!sheet) throw new Error('Sheet "3" not found in workbook');
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const lines = [];
  for (let i = 1; i < rows.length; i++) {
    const cell = rows[i][0];
    if (cell != null && String(cell).trim()) lines.push(String(cell).trim());
  }
  return lines;
}

async function main() {
  await initSchema();

  if (replace) {
    await run('DELETE FROM product_excise_mappings');
    await run('DELETE FROM product_account_mapping');
    await run('DELETE FROM product_master');
    console.log('Cleared product_master (and mappings).');
  }

  const lines = readSheet3();
  const buckets = bucketSheet3Rows(lines);

  const toImport = [
    ...takeParsed(buckets.BL, parseBL, 'BL'),
    ...takeParsed(buckets.OBO, parseOBO, 'OBO'),
    ...takeParsed(buckets.SS26, parseBL, 'SS26'),
    ...takeParsed(buckets.NOOS, parseBL, 'NOOS'),
  ];

  const existingRows = await all('SELECT code FROM product_master');
  const existing = new Set(existingRows.map((r) => r.code));

  let inserted = 0;
  let skipped = 0;

  for (const row of toImport) {
    const tag = `IMPORT:${row.group}`;
    if (existing.has(row.code)) {
      skipped++;
      console.log(`  skip (exists): ${row.code}`);
      continue;
    }
    try {
      await run(
        `
        INSERT INTO product_master (
          code, description,
          base_uom, type, product_type, product_nature,
          vat_category,
          additional_desc1,
          created_at, updated_at, created_by, updated_by
        ) VALUES (
          ?, ?,
          'pcs', 'Stock', 'TradingGoods', 'Normal',
          'standard_13',
          ?,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'import-sheet3', 'import-sheet3'
        )
        `,
        [row.code, row.description, tag]
      );
      await run('INSERT OR IGNORE INTO articles (code, name, display) VALUES (?, ?, ?)', [
        row.code,
        row.description,
        row.display,
      ]);
      existing.add(row.code);
      inserted++;
      console.log(
        `  + ${row.code}  |  ${row.description.slice(0, 55)}${row.description.length > 55 ? '…' : ''}  [${row.group}]`
      );
    } catch (e) {
      console.error(`  ! failed ${row.code}:`, e.message);
    }
  }

  const total = (await one('SELECT COUNT(*)::int AS c FROM product_master'))?.c ?? 0;
  console.log('\n--- Summary ---');
  console.log(`Sheet 3 lines read: ${lines.length}`);
  console.log(
    `Bucket sizes: BL=${buckets.BL.length} OBO=${buckets.OBO.length} SS26=${buckets.SS26.length} NOOS=${buckets.NOOS.length}`
  );
  console.log(`Target import: ${toImport.length} (${PER_GROUP} per group)`);
  console.log(`Inserted: ${inserted}, skipped (duplicate): ${skipped}`);
  console.log(`Product Master total: ${total}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
