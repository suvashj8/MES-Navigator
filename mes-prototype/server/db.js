import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Runtime guard: this codebase must not run against SQLite. */
function assertPostgresOnly() {
  const useSqlite = String(process.env.USE_SQLITE || '').toLowerCase();
  if (useSqlite === '1' || useSqlite === 'true' || useSqlite === 'yes') {
    throw new Error(
      'USE_SQLITE is set but this project uses PostgreSQL only. Remove USE_SQLITE from .env.'
    );
  }
  if (String(process.env.DB_DRIVER || '').toLowerCase() === 'sqlite') {
    throw new Error('DB_DRIVER=sqlite is not supported. Configure PostgreSQL in .env.');
  }
}

assertPostgresOnly();

function poolConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'mes_prototype',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  };
}

export const pool = new pg.Pool(poolConfig());

export const GRADE_POINTS = { C: 1, B: 2, A: 3, AA: 4 };

/** Convert SQLite ? placeholders to PostgreSQL $1, $2, … */
export function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/** Normalize SQLite-specific SQL for PostgreSQL */
export function adaptSql(sql) {
  let s = sql.replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP');

  if (/INSERT OR IGNORE INTO cost_centers/i.test(s)) {
    return s
      .replace(/INSERT OR IGNORE/i, 'INSERT')
      .replace(/;\s*$/, '')
      .concat(' ON CONFLICT (code) DO NOTHING');
  }
  if (/INSERT OR IGNORE INTO articles/i.test(s)) {
    return s
      .replace(/INSERT OR IGNORE/i, 'INSERT')
      .replace(/;\s*$/, '')
      .concat(' ON CONFLICT (display) DO NOTHING');
  }
  if (/INSERT OR IGNORE INTO activity_cost_center_maps/i.test(s)) {
    return s
      .replace(/INSERT OR IGNORE/i, 'INSERT')
      .replace(/;\s*$/, '')
      .concat(' ON CONFLICT (activity_id, cost_center_code) DO NOTHING');
  }
  if (/INSERT OR REPLACE INTO cost_centers/i.test(s)) {
    return s
      .replace(/INSERT OR REPLACE/i, 'INSERT')
      .replace(/;\s*$/, '')
      .concat(' ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name');
  }

  return s.replace(/INSERT OR IGNORE/gi, 'INSERT').replace(/INSERT OR REPLACE/gi, 'INSERT');
}

function withReturningId(sql) {
  const trimmed = sql.trim();
  if (!/^INSERT/i.test(trimmed)) return sql;
  if (/RETURNING/i.test(trimmed)) return sql;
  // ON CONFLICT inserts must not use RETURNING id (e.g. cost_centers PK is code, not id)
  if (/ON CONFLICT/i.test(trimmed)) return sql;
  return `${trimmed} RETURNING id`;
}

export async function query(sql, params = []) {
  const text = toPg(adaptSql(sql));
  return pool.query(text, params);
}

export async function one(sql, params = []) {
  const result = await query(sql, params);
  return result.rows[0] ?? null;
}

export async function all(sql, params = []) {
  const result = await query(sql, params);
  return result.rows;
}

export async function run(sql, params = []) {
  const text = toPg(withReturningId(adaptSql(sql)));
  const result = await pool.query(text, params);
  const row = result.rows[0];
  return {
    changes: result.rowCount ?? 0,
    lastInsertRowid: row?.id ?? null,
  };
}

function makeTx(client) {
  const txQuery = async (sql, params = []) => {
    const text = toPg(adaptSql(sql));
    return client.query(text, params);
  };
  return {
    query: txQuery,
    one: async (sql, params) => (await txQuery(sql, params)).rows[0] ?? null,
    all: async (sql, params) => (await txQuery(sql, params)).rows,
    run: async (sql, params) => {
      const text = toPg(withReturningId(adaptSql(sql)));
      const result = await client.query(text, params);
      const row = result.rows[0];
      return {
        changes: result.rowCount ?? 0,
        lastInsertRowid: row?.id ?? null,
      };
    },
  };
}

export async function transaction(fn) {
  const client = await pool.connect();
  const tx = makeTx(client);
  try {
    await client.query('BEGIN');
    const result = await fn(tx);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function execSchemaFile() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  const statements = schema
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (e) {
      if (!String(e.message).includes('already exists')) throw e;
    }
  }
}

async function syncCostCentersFromStandards() {
  const rows = await all(
    'SELECT DISTINCT cost_center_code AS code, cost_center_name AS name FROM grading_standards'
  );
  for (const r of rows) {
    await run('INSERT OR IGNORE INTO cost_centers (code, name) VALUES (?, ?)', [r.code, r.name]);
  }
}

async function linkGradingStandardsProductMasterIds() {
  await run(`
    UPDATE grading_standards
    SET product_master_id = (
      SELECT id FROM product_master WHERE code = grading_standards.prod_code
    )
    WHERE product_master_id IS NULL
      AND EXISTS (SELECT 1 FROM product_master WHERE code = grading_standards.prod_code)
  `);
}

export async function initSchema() {
  assertPostgresOnly();
  await pool.query('SELECT 1');
  await execSchemaFile();
  await syncCostCentersFromStandards();
  await linkGradingStandardsProductMasterIds();
}

/** Alias for modules that still import `{ db }` — always PostgreSQL. */
export const db = { one, all, run, query, transaction };
