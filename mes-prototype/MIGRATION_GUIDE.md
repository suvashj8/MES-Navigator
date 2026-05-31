# Migration Guide: SQLite to PostgreSQL

> **Superseded for data migration.** The app already uses PostgreSQL. To copy old `mes.db` data, run:
> `cd server && npm run migrate:from-sqlite` — see [DATABASE.md](DATABASE.md).
>
> The notes below are historical (code migration reference only).

This guide helps you update your Express routes from SQLite (`better-sqlite3`) to PostgreSQL (`pg`).

## Key Differences

### SQLite (Old - Synchronous)
```javascript
import Database from 'better-sqlite3';

const db = new Database('mes.db');
const stmt = db.prepare('SELECT * FROM staff WHERE id = ?');
const staff = stmt.get(staffId);
```

### PostgreSQL (New - Asynchronous)
```javascript
import pg from 'pg';

const db = new pg.Pool({ /* config */ });
const result = await db.query('SELECT * FROM staff WHERE id = $1', [staffId]);
const staff = result.rows[0];
```

---

## Common Patterns to Update

### 1. Single Row Queries

**Before (SQLite):**
```javascript
app.get('/staff/:id', (req, res) => {
  const stmt = db.prepare('SELECT * FROM staff WHERE id = ?');
  const staff = stmt.get(req.params.id);
  res.json(staff);
});
```

**After (PostgreSQL):**
```javascript
app.get('/staff/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM staff WHERE id = $1', [req.params.id]);
    const staff = result.rows[0];
    res.json(staff);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 2. Multiple Row Queries

**Before (SQLite):**
```javascript
app.get('/staff', (req, res) => {
  const stmt = db.prepare('SELECT * FROM staff ORDER BY name');
  const staff = stmt.all();
  res.json(staff);
});
```

**After (PostgreSQL):**
```javascript
app.get('/staff', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM staff ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 3. Insert Operations

**Before (SQLite):**
```javascript
app.post('/staff', (req, res) => {
  const { regNo, name, department } = req.body;
  const stmt = db.prepare('INSERT INTO staff (reg_no, name, department) VALUES (?, ?, ?)');
  const info = stmt.run(regNo, name, department);
  res.json({ id: info.lastID });
});
```

**After (PostgreSQL):**
```javascript
app.post('/staff', async (req, res) => {
  try {
    const { regNo, name, department } = req.body;
    const result = await db.query(
      'INSERT INTO staff (reg_no, name, department) VALUES ($1, $2, $3) RETURNING id',
      [regNo, name, department]
    );
    res.json({ id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 4. Update Operations

**Before (SQLite):**
```javascript
app.put('/staff/:id', (req, res) => {
  const { name, department } = req.body;
  const stmt = db.prepare('UPDATE staff SET name = ?, department = ? WHERE id = ?');
  stmt.run(name, department, req.params.id);
  res.json({ success: true });
});
```

**After (PostgreSQL):**
```javascript
app.put('/staff/:id', async (req, res) => {
  try {
    const { name, department } = req.body;
    const result = await db.query(
      'UPDATE staff SET name = $1, department = $2 WHERE id = $3 RETURNING *',
      [name, department, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 5. Delete Operations

**Before (SQLite):**
```javascript
app.delete('/staff/:id', (req, res) => {
  const stmt = db.prepare('DELETE FROM staff WHERE id = ?');
  stmt.run(req.params.id);
  res.json({ success: true });
});
```

**After (PostgreSQL):**
```javascript
app.delete('/staff/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM staff WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 6. Transactions

**Before (SQLite):**
```javascript
function transferData() {
  try {
    db.exec('BEGIN TRANSACTION');
    // operations...
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
  }
}
```

**After (PostgreSQL):**
```javascript
async function transferData() {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // operations...
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
}
```

---

## Import Changes

### Update your import statements

**Old (SQLite):**
```javascript
import Database from 'better-sqlite3';
import { initSchema, getStaff, createStaff } from './db.js';

const db = new Database('mes.db');
```

**New (PostgreSQL):**
```javascript
import { db, initSchema, getStaff, createStaff } from './db-postgres.js';
```

---

## Middleware Updates

If you have middleware that accesses the database:

**Before:**
```javascript
function authMiddleware(req, res, next) {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  const user = stmt.get(req.email);
  req.user = user;
  next();
}
```

**After:**
```javascript
async function authMiddleware(req, res, next) {
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [req.email]);
    req.user = result.rows[0];
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

---

## Parameter Binding

### Important: Use Numbered Placeholders

PostgreSQL uses **numbered placeholders** (`$1, $2, etc.`) instead of `?`

**Incorrect:**
```javascript
await db.query('SELECT * FROM staff WHERE id = ? AND name = ?', [id, name]);
```

**Correct:**
```javascript
await db.query('SELECT * FROM staff WHERE id = $1 AND name = $2', [id, name]);
```

---

## Error Handling

PostgreSQL may throw different errors. Common ones:

```javascript
try {
  await db.query(query, params);
} catch (error) {
  if (error.code === '23505') {
    // Unique constraint violation
    res.status(409).json({ error: 'Record already exists' });
  } else if (error.code === '23503') {
    // Foreign key constraint violation
    res.status(400).json({ error: 'Referenced record not found' });
  } else {
    res.status(500).json({ error: error.message });
  }
}
```

---

## Example: Converting Daily Grading Endpoints

### Before (SQLite):
```javascript
app.post('/daily-grading', (req, res) => {
  const data = req.body;
  const stmt = db.prepare(`
    INSERT INTO daily_grading (
      entry_date, staff_id, prod_code, cost_center_code, quantity,
      per_day_qty, working_min, c_time_min, p_hour, w_hour, w_min,
      grade, remarks, entered_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    data.entry_date, data.staff_id, data.prod_code, data.cost_center_code,
    data.quantity, data.per_day_qty, data.working_min, data.c_time_min,
    data.p_hour, data.w_hour, data.w_min, data.grade, data.remarks, data.entered_by
  );
  res.json({ id: info.lastID });
});
```

### After (PostgreSQL):
```javascript
app.post('/daily-grading', async (req, res) => {
  try {
    const data = req.body;
    const result = await db.query(
      `INSERT INTO daily_grading (
        entry_date, staff_id, prod_code, cost_center_code, quantity,
        per_day_qty, working_min, c_time_min, p_hour, w_hour, w_min,
        grade, remarks, entered_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
      [
        data.entry_date, data.staff_id, data.prod_code, data.cost_center_code,
        data.quantity, data.per_day_qty, data.working_min, data.c_time_min,
        data.p_hour, data.w_hour, data.w_min, data.grade, data.remarks, data.entered_by
      ]
    );
    res.json({ id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## Using Helper Functions from db-postgres.js

The new `db-postgres.js` provides helper functions for common operations:

```javascript
import { getStaff, createStaff, getDailyGrading, createDailyGrading } from './db-postgres.js';

// Get all staff
app.get('/staff', async (req, res) => {
  const staff = await getStaff();
  res.json(staff);
});

// Create staff
app.post('/staff', async (req, res) => {
  const staff = await createStaff(req.body.regNo, req.body.name, req.body.department);
  res.json(staff);
});

// Get daily grading for a date
app.get('/daily-grading/:date', async (req, res) => {
  const grading = await getDailyGrading(req.params.date);
  res.json(grading);
});
```

---

## Testing Your Migration

1. Start with simple SELECT queries
2. Test INSERT operations
3. Test UPDATE operations
4. Test DELETE operations
5. Test transactions
6. Test error handling

```bash
# Run your server
npm run dev

# Test endpoints with curl or Postman
curl http://localhost:3000/staff
curl -X POST http://localhost:3000/staff \
  -H "Content-Type: application/json" \
  -d '{"regNo": 1, "name": "John", "department": "Production"}'
```

---

## Rollback Plan

If you need to revert:
1. The old `mes.db` SQLite file is still in the server directory
2. Keep the old `db.js` file backed up
3. Revert `package.json` and switch imports if needed

---

## Need Help?

- Review `db-postgres.js` for function signatures
- Check error logs in terminal
- Verify database connection with `npm run db:setup`
- Test individual routes with curl or Postman

---

**Status:** Ready to migrate! ??
