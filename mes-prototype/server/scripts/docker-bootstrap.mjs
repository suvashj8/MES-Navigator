#!/usr/bin/env node
/**
 * Docker startup: wait for Postgres, optionally seed an empty database.
 * Controlled by MES_AUTO_SEED (default 1). Set MES_AUTO_SEED=0 to skip seeding.
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { one, pool } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.join(__dirname, '..');

async function waitForDb(maxAttempts = 60, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await pool.query('SELECT 1');
      console.log('PostgreSQL is ready.');
      return;
    } catch (err) {
      console.log(`Waiting for PostgreSQL (${attempt}/${maxAttempts})…`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('PostgreSQL did not become ready in time.');
}

function runSeed() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['seed.js'], {
      cwd: SERVER_ROOT,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`seed.js exited with code ${code}`));
    });
  });
}

async function main() {
  await waitForDb();

  const autoSeed = String(process.env.MES_AUTO_SEED ?? '1') !== '0';
  if (!autoSeed) {
    console.log('MES_AUTO_SEED=0 — skipping automatic seed.');
    return;
  }

  const users = (await one('SELECT COUNT(*)::int AS c FROM users'))?.c ?? 0;
  if (users > 0) {
    console.log(`Database already has ${users} user(s) — skipping seed.`);
    return;
  }

  console.log('Empty database detected — running seed from Excel workbook…');
  await runSeed();
  console.log('Bootstrap complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
