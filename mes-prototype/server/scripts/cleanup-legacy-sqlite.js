/**
 * Remove legacy SQLite files left after Postgres migration.
 * The running API never uses these — safe once migrate:from-sqlite has run.
 *
 *   node scripts/cleanup-legacy-sqlite.js
 *   node scripts/cleanup-legacy-sqlite.js --dry-run
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SERVER_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TO_REMOVE = ['mes.db', 'mes.db-wal', 'mes.db-shm'];

const dryRun = process.argv.includes('--dry-run');

for (const name of TO_REMOVE) {
  const file = path.join(SERVER_DIR, name);
  if (!fs.existsSync(file)) continue;
  const size = fs.statSync(file).size;
  if (dryRun) {
    console.log(`would remove ${name} (${size} bytes)`);
  } else {
    fs.unlinkSync(file);
    console.log(`removed ${name} (${size} bytes)`);
  }
}

const backups = fs.readdirSync(SERVER_DIR).filter((n) => /^mes\.db(\.migrated\.|\.migrated)/.test(n));
if (backups.length) {
  console.log(`Backup(s) kept for reference: ${backups.join(', ')}`);
}

if (!dryRun) {
  console.log('Done. Live database is PostgreSQL (see server/.env).');
}
