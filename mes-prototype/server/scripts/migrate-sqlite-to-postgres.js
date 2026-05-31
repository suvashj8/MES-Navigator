#!/usr/bin/env node
/**
 * One-time migration: legacy SQLite mes.db → PostgreSQL (mes_prototype).
 *
 * - better-sqlite3 is devDependency ONLY for this script (not used at runtime).
 * - After success, renames mes.db → mes.db.migrated.<timestamp>.bak
 *
 * Usage:
 *   node scripts/migrate-sqlite-to-postgres.js
 *   node scripts/migrate-sqlite-to-postgres.js --dry-run
 *   node scripts/migrate-sqlite-to-postgres.js --sqlite-path ./mes.db --keep-sqlite
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import { pool, initSchema } from '../db.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.join(__dirname, '..');
const DEFAULT_SQLITE = path.join(SERVER_DIR, 'mes.db');

const TABLES_IN_ORDER = [
  'staff',
  'activities',
  'articles',
  'cost_centers',
  'users',
  'products',
  'product_master',
  'product_account_mapping',
  'product_excise_mappings',
  'grading_standards',
  'activity_cost_center_maps',
  'daily_grading',
  'daily_grading_audit',
  'missing_standards',
  'product_components',
];

const SERIAL_TABLES = [
  'staff',
  'activities',
  'articles',
  'product_master',
  'product_account_mapping',
  'product_excise_mappings',
  'grading_standards',
  'activity_cost_center_maps',
  'daily_grading',
  'daily_grading_audit',
  'missing_standards',
  'product_components',
  'users',
];

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    keepSqlite: args.includes('--keep-sqlite'),
    sqlitePath: (() => {
      const i = args.indexOf('--sqlite-path');
      return i >= 0 ? path.resolve(args[i + 1]) : DEFAULT_SQLITE;
    })(),
  };
}

function sqliteTableExists(sqlite, name) {
  const row = sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
    .get(name);
  return Boolean(row);
}

function sqliteColumns(sqlite, table) {
  return sqlite.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
}

async function postgresColumns(table) {
  const r = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
  return r.rows.map((row) => row.column_name);
}

function normalizeValue(col, value) {
  if (value === undefined) return null;
  if (value === '') {
    if (col === 'effective_date') return null;
  }
  return value;
}

async function copyTable(sqlite, table, { dryRun }) {
  if (!sqliteTableExists(sqlite, table)) {
    return { table, skipped: true, reason: 'not in SQLite', rows: 0 };
  }

  const pgCols = await postgresColumns(table);
  if (!pgCols.length) {
    return { table, skipped: true, reason: 'not in PostgreSQL schema', rows: 0 };
  }

  const slCols = sqliteColumns(sqlite, table);
  const cols = pgCols.filter((c) => slCols.includes(c));
  if (!cols.length) {
    return { table, skipped: true, reason: 'no shared columns', rows: 0 };
  }

  const rows = sqlite.prepare(`SELECT ${cols.map((c) => `"${c}"`).join(', ')} FROM "${table}"`).all();
  if (!rows.length) {
    return { table, skipped: false, rows: 0 };
  }

  if (dryRun) {
    return { table, skipped: false, rows: rows.length, dryRun: true };
  }

  const colList = cols.map((c) => `"${c}"`).join(', ');
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      const values = cols.map((c) => normalizeValue(c, row[c]));
      await client.query(sql, values);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw new Error(`${table}: ${e.message}`);
  } finally {
    client.release();
  }

  return { table, skipped: false, rows: rows.length };
}

async function resetSerialSequences() {
  for (const table of SERIAL_TABLES) {
    if (!TABLES_IN_ORDER.includes(table)) continue;
    try {
      const seq = await pool.query(`SELECT pg_get_serial_sequence($1, 'id') AS seq`, [table]);
      const seqName = seq.rows[0]?.seq;
      if (!seqName) continue;
      await pool.query(`SELECT setval($1::regclass, COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`, [
        seqName,
      ]);
    } catch {
      // table may not use serial id
    }
  }
}

async function truncatePostgres() {
  await pool.query(`
    TRUNCATE TABLE
      activity_cost_center_maps,
      daily_grading_audit,
      daily_grading,
      missing_standards,
      grading_standards,
      product_components,
      product_account_mapping,
      product_excise_mappings,
      product_master,
      products,
      articles,
      activities,
      staff,
      cost_centers,
      users
    RESTART IDENTITY CASCADE
  `);
}

function backupSqliteFile(sqlitePath) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = `${sqlitePath}.migrated.${stamp}.bak`;
  try {
    fs.renameSync(sqlitePath, backup);
  } catch (e) {
    if (e.code !== 'EBUSY' && e.code !== 'EPERM') throw e;
    fs.copyFileSync(sqlitePath, backup);
    console.warn(`  (mes.db locked — copied to backup; delete mes.db manually when nothing is using it)`);
  }
  return backup;
}

async function main() {
  const { dryRun, keepSqlite, sqlitePath } = parseArgs();

  if (process.env.USE_SQLITE === '1' || process.env.USE_SQLITE === 'true') {
    console.error('USE_SQLITE is set — remove it. This project uses PostgreSQL only.');
    process.exit(1);
  }

  if (!fs.existsSync(sqlitePath)) {
    console.error(`SQLite file not found: ${sqlitePath}`);
    console.error('Nothing to migrate. Ensure Postgres is configured and run npm run seed if needed.');
    process.exit(1);
  }

  console.log('MES: SQLite → PostgreSQL migration');
  console.log(`  Source: ${sqlitePath}`);
  console.log(`  Target: ${process.env.DATABASE_URL || `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`}`);
  if (dryRun) console.log('  Mode: DRY RUN (no writes)\n');
  else console.log('');

  await pool.query('SELECT 1');
  const sqlite = new Database(sqlitePath, { readonly: true });

  try {
    if (!dryRun) {
      await initSchema();
      console.log('PostgreSQL schema ready.');
      console.log('Truncating existing PostgreSQL data…');
      await truncatePostgres();
    }

    const report = [];
    for (const table of TABLES_IN_ORDER) {
      const result = await copyTable(sqlite, table, { dryRun });
      report.push(result);
      const label = result.skipped
        ? `skip (${result.reason})`
        : dryRun
          ? `would copy ${result.rows}`
          : `copied ${result.rows}`;
      console.log(`  ${table}: ${label}`);
    }

    if (!dryRun) {
      console.log('\nResetting ID sequences…');
      await resetSerialSequences();

      await pool.query(`
        UPDATE grading_standards
        SET product_master_id = (
          SELECT id FROM product_master WHERE code = grading_standards.prod_code
        )
        WHERE product_master_id IS NULL
          AND EXISTS (SELECT 1 FROM product_master WHERE code = grading_standards.prod_code)
      `);

      const manifest = {
        migratedAt: new Date().toISOString(),
        sqliteSource: sqlitePath,
        tables: report,
      };
      const manifestPath = path.join(SERVER_DIR, 'postgres-migration-manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`\nWrote ${manifestPath}`);

      if (!keepSqlite) {
        const backup = backupSqliteFile(sqlitePath);
        console.log(`\nSQLite file archived (not used by the app):`);
        console.log(`  ${backup}`);
      } else {
        console.log('\n--keep-sqlite: mes.db left in place (app still ignores it).');
      }

      console.log('\nMigration complete. Start the API with PostgreSQL (.env) — not mes.db.');
    } else {
      console.log('\nDry run finished. Re-run without --dry-run to apply.');
    }
  } finally {
    sqlite.close();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('\nMigration failed:', e.message);
  process.exit(1);
});
