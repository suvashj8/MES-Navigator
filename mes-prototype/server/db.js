import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'mes.db');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const GRADE_POINTS = { C: 1, B: 2, A: 3, AA: 4 };

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reg_no INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      department TEXT NOT NULL,
      photo_data TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      display TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS cost_centers (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_cost_center_maps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      cost_center_code TEXT NOT NULL REFERENCES cost_centers(code) ON DELETE CASCADE,
      UNIQUE(activity_id, cost_center_code)
    );

    CREATE TABLE IF NOT EXISTS grading_standards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prod_code TEXT NOT NULL,
      prod_name TEXT NOT NULL,
      cost_center_code TEXT NOT NULL,
      cost_center_name TEXT NOT NULL,
      standard_min INTEGER DEFAULT 420,
      std_qty REAL NOT NULL,
      c_value REAL NOT NULL,
      b_value REAL NOT NULL,
      a_value REAL NOT NULL,
      aplus_value REAL NOT NULL,
      effective_date TEXT,
      created_by TEXT,
      updated_by TEXT,
      UNIQUE(prod_code, cost_center_code, effective_date)
    );

    CREATE TABLE IF NOT EXISTS daily_grading (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_date TEXT NOT NULL,
      staff_id INTEGER NOT NULL REFERENCES staff(id),
      prod_code TEXT NOT NULL,
      cost_center_code TEXT NOT NULL,
      quantity REAL NOT NULL,
      per_day_qty REAL,
      working_min REAL,
      c_time_min REAL,
      p_hour REAL,
      w_hour REAL,
      w_min REAL,
      grade TEXT,
      remarks TEXT,
      entered_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT,
      updated_by TEXT,
      deleted_at TEXT,
      deleted_by TEXT,
      UNIQUE(entry_date, staff_id, prod_code, cost_center_code)
    );

    CREATE TABLE IF NOT EXISTS daily_grading_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER REFERENCES daily_grading(id),
      action TEXT NOT NULL CHECK(action IN ('create','update','delete','restore','hard_delete')),
      actor TEXT,
      at TEXT DEFAULT (datetime('now')),
      old_values TEXT,
      new_values TEXT
    );

    CREATE TABLE IF NOT EXISTS missing_standards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_date TEXT NOT NULL,
      department TEXT,
      staff_id INTEGER REFERENCES staff(id),
      staff_name TEXT,
      activity_id INTEGER,
      activity_name TEXT,
      cost_center_code TEXT,
      cost_center_name TEXT,
      prod_code TEXT,
      prod_name TEXT,
      reported_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('operator', 'supervisor', 'admin')),
      display_name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1
    );
  `);

  migrateStaffPhoto();
  migrateDailyGradingSoftDelete();
  migrateDailyGradingDeletedBy();
  migrateDailyGradingUpdatedFields();
  migrateDailyGradingAudit();
  migrateUsersDepartment();
  syncCostCentersFromStandards();
}

function migrateDailyGradingSoftDelete() {
  const cols = db.prepare('PRAGMA table_info(daily_grading)').all();
  if (!cols.some((c) => c.name === 'deleted_at')) {
    db.exec('ALTER TABLE daily_grading ADD COLUMN deleted_at TEXT');
  }
}

function migrateDailyGradingDeletedBy() {
  const cols = db.prepare('PRAGMA table_info(daily_grading)').all();
  if (!cols.some((c) => c.name === 'deleted_by')) {
    db.exec('ALTER TABLE daily_grading ADD COLUMN deleted_by TEXT');
  }
}

function migrateDailyGradingUpdatedFields() {
  const cols = db.prepare('PRAGMA table_info(daily_grading)').all();
  if (!cols.some((c) => c.name === 'updated_at')) {
    db.exec('ALTER TABLE daily_grading ADD COLUMN updated_at TEXT');
  }
  if (!cols.some((c) => c.name === 'updated_by')) {
    db.exec('ALTER TABLE daily_grading ADD COLUMN updated_by TEXT');
  }
}

function migrateDailyGradingAudit() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_grading_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER REFERENCES daily_grading(id),
      action TEXT NOT NULL CHECK(action IN ('create','update','delete','restore','hard_delete')),
      actor TEXT,
      at TEXT DEFAULT (datetime('now')),
      old_values TEXT,
      new_values TEXT
    );
  `);
}

function migrateStaffPhoto() {
  const cols = db.prepare('PRAGMA table_info(staff)').all();
  if (!cols.some((c) => c.name === 'photo_data')) {
    db.exec('ALTER TABLE staff ADD COLUMN photo_data TEXT');
  }
}

function migrateUsersDepartment() {
  const cols = db.prepare('PRAGMA table_info(users)').all();
  if (!cols.some((c) => c.name === 'department')) {
    db.exec('ALTER TABLE users ADD COLUMN department TEXT');
  }
}

function syncCostCentersFromStandards() {
  const rows = db.prepare(
    'SELECT DISTINCT cost_center_code as code, cost_center_name as name FROM grading_standards'
  ).all();
  const insert = db.prepare(
    'INSERT OR IGNORE INTO cost_centers (code, name) VALUES (?, ?)'
  );
  for (const r of rows) insert.run(r.code, r.name);
}

export { GRADE_POINTS };
