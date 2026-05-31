#!/usr/bin/env node
import dotenv from 'dotenv';
import { pool, initSchema } from '../db.js';

dotenv.config();

async function columnNames(table) {
  const r = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
  return r.rows.map((row) => row.column_name);
}

async function count(table) {
  const r = await pool.query(`SELECT COUNT(*)::int AS c FROM ${table}`);
  return r.rows[0]?.c ?? 0;
}

async function main() {
  await initSchema();

  const gsCols = await columnNames('grading_standards');
  const pmCols = await columnNames('product_master');

  console.log('grading_standards columns:', gsCols.join(', '));
  console.log('product_master columns:', pmCols.join(', '));
  console.log('product_master_id on grading_standards:', gsCols.includes('product_master_id'));

  const counts = {
    staff: await count('staff'),
    grading_standards: await count('grading_standards'),
    product_master: await count('product_master'),
    daily_grading: await count('daily_grading'),
    users: await count('users'),
  };
  console.log('\nRow counts:', counts);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
