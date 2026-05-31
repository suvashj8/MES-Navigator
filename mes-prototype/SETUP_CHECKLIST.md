# PostgreSQL Database Setup - Complete Checklist

## ? What Has Been Created

### Files Created (6 items)

- [x] **server/schema.sql** - PostgreSQL database schema (15 tables)
- [x] **server/db-postgres.js** - PostgreSQL connection and helper functions
- [x] **server/db-setup.js** - Automated database creation script
- [x] **server/.env.example** - Environment configuration template
- [x] **POSTGRES_SETUP.md** - Comprehensive setup guide
- [x] **DATABASE_SETUP_SUMMARY.md** - Overview and summary
- [x] **MIGRATION_GUIDE.md** - SQLite to PostgreSQL migration instructions

### Files Modified (1 item)

- [x] **server/package.json** 
  - Removed: `better-sqlite3` (SQLite driver)
  - Added: `pg` (PostgreSQL driver)
  - Added: `dotenv` (Environment management)
  - Added: `npm run db:setup` script

---

## ?? Next Steps (In Order)

### Step 1: Prerequisites ? CHECK
- [ ] PostgreSQL installed (https://www.postgresql.org/download/)
- [ ] PostgreSQL service is running
- [ ] Node.js v16+ installed
- [ ] Git or file access to project directory

**On Windows:**
```bash
# Start PostgreSQL service
net start postgresql-x64-xx
# or use Services app
```

**On Mac:**
```bash
brew services start postgresql
```

**On Linux:**
```bash
sudo systemctl start postgresql
```

### Step 2: Install Dependencies
```bash
cd "C:\Users\rakesh\Desktop\Suvash project\new project\mes-prototype"
cd server
npm install
```

Expected packages to install:
- pg ^8.12.0
- dotenv ^16.4.5
- Express, bcryptjs, jsonwebtoken, etc.

### Step 3: Configure Environment
```bash
# Copy template to .env
cp .env.example .env

# Edit .env (optional if using defaults)
# nano .env  or  code .env
```

Default configuration (usually works):
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mes_prototype
DB_USER=postgres
DB_PASSWORD=postgres
```

### Step 4: Create Database
```bash
npm run db:setup
```

Expected output:
```
? Connected to PostgreSQL server
? Dropped existing database "mes_prototype"
? Created database "mes_prototype"
? Connected to database "mes_prototype"
? Database schema initialized successfully
? Created 15 tables
? Database setup completed successfully!
```

**If error occurs:**
- [ ] PostgreSQL is running? ? Start service
- [ ] Credentials correct? ? Update .env
- [ ] Port available? ? Check other services on 5432
- [ ] Firewall blocking? ? Allow PostgreSQL port

### Step 5: Verify Database

Option A - Using Command Line:
```bash
# On Windows (in PowerShell)
psql -h localhost -U postgres -d mes_prototype

# Then in psql:
\dt   -- List all tables
\d staff  -- Describe staff table
SELECT COUNT(*) FROM staff;
```

Option B - Using pgAdmin GUI:
- Open pgAdmin (installed with PostgreSQL)
- Connect to localhost
- Navigate to Databases > mes_prototype
- Verify tables exist

### Step 6: Update Your Code

Edit your Express routes to use async/await:

For each route file:
- [ ] Import from `db-postgres.js` instead of `db.js`
- [ ] Add `async` to route handlers
- [ ] Change `?` parameters to `$1, $2, etc.`
- [ ] Await all database calls
- [ ] Update result access: `result.rows[0]` instead of direct return
- [ ] Add try/catch error handling
- [ ] Test each endpoint

Example:
```javascript
// OLD
app.get('/staff/:id', (req, res) => {
  const staff = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
  res.json(staff);
});

// NEW
app.get('/staff/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM staff WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

See **MIGRATION_GUIDE.md** for more examples.

### Step 7: Test the Server

```bash
# Start development server
npm run dev

# Should output something like:
# Server running on http://localhost:3000
```

### Step 8: Test Database Endpoints

Use curl or Postman to test:

```bash
# Get all staff
curl http://localhost:3000/api/staff

# Create staff
curl -X POST http://localhost:3000/api/staff \
  -H "Content-Type: application/json" \
  -d '{"regNo":1,"name":"John Doe","department":"Production"}'

# Get daily grading
curl http://localhost:3000/api/daily-grading/2024-05-29
```

---

## ?? Documentation Files Reference

| File | Purpose | Read If... |
|------|---------|-----------|
| **POSTGRES_SETUP.md** | Setup and troubleshooting guide | You have questions during setup |
| **DATABASE_SETUP_SUMMARY.md** | Overview of what was created | You want a quick overview |
| **MIGRATION_GUIDE.md** | How to update your code | Migrating from SQLite |
| **schema.sql** | Database table definitions | You need to understand the schema |
| **.env.example** | Configuration template | You need to set environment variables |

---

## ?? Database Tables Created (15 total)

**Core Tables:**
- [ ] staff - Employee records
- [ ] users - System users for authentication
- [ ] activities - Activity definitions
- [ ] articles - Product articles

**Grading System:**
- [ ] grading_standards - Product grading specifications
- [ ] daily_grading - Daily grading entries
- [ ] daily_grading_audit - Audit trail

**Product Management:**
- [ ] product_master - Main product catalog
- [ ] products - Product definitions
- [ ] product_components - Component breakdowns
- [ ] product_account_mapping - Accounting mappings
- [ ] product_excise_mappings - Tax mappings

**Organization:**
- [ ] cost_centers - Cost center definitions
- [ ] activity_cost_center_maps - Activity to cost center links

---

## ?? Important Reminders

1. **No Existing Data** - This is a fresh database, start with clean data
2. **Async/Await Required** - All database operations now return Promises
3. **Parameter Syntax** - Use `$1, $2` instead of `?` for placeholders
4. **Error Handling** - Always wrap database calls in try/catch
5. **Environment Variables** - Create .env file before running db:setup
6. **PostgreSQL Running** - Service must be running for setup to work

---

## ?? Troubleshooting Checklist

### "Connection refused" Error
- [ ] PostgreSQL service is running
- [ ] Port 5432 is not blocked
- [ ] Check .env credentials
- [ ] Try: `psql -h localhost -U postgres`

### "Database already exists" Error
- [ ] Run script again (it auto-drops existing database)
- [ ] Check if using wrong database name in .env

### "Authentication failed" Error
- [ ] Wrong password in .env
- [ ] Check PostgreSQL pg_hba.conf settings
- [ ] Try default password: "postgres"

### "Table does not exist" Error
- [ ] Run `npm run db:setup` again
- [ ] Check database was created with `\dt` in psql
- [ ] Verify schema.sql was executed

### "Cannot find module 'pg'" Error
- [ ] Run `npm install` in server directory
- [ ] Check package.json has pg dependency
- [ ] Try: `npm install pg --save`

### Async/Await Errors in Routes
- [ ] Mark route handler with `async`: `app.get('/path', async (req, res) => {}`
- [ ] Await database calls: `await db.query(...)`
- [ ] Add try/catch blocks
- [ ] Use `result.rows[0]` for single row, `result.rows` for multiple

---

## ?? Quick Status Check

```bash
# Run these commands to verify everything is working

# 1. Check PostgreSQL is running
psql --version

# 2. Check npm dependencies installed
npm list pg dotenv

# 3. Check database exists
psql -l | grep mes_prototype

# 4. Check tables are created
psql -d mes_prototype -c "\dt"

# 5. Check server starts without errors
npm run dev
```

---

## ?? Success Criteria

Your PostgreSQL setup is complete when:

- ? PostgreSQL service is running
- ? Database `mes_prototype` exists
- ? All 15 tables are created
- ? `npm install` completed successfully
- ? `.env` file is configured
- ? `npm run db:setup` runs without errors
- ? `npm run dev` starts the server
- ? API endpoints respond correctly
- ? Database connections work

---

## ?? Support Resources

**For PostgreSQL Issues:**
- PostgreSQL Documentation: https://www.postgresql.org/docs/
- pgAdmin Community: https://www.pgadmin.org/

**For Node.js/Express Issues:**
- Express Guide: https://expressjs.com/
- Node.js Docs: https://nodejs.org/docs/

**For This Project:**
- See POSTGRES_SETUP.md for detailed troubleshooting
- See MIGRATION_GUIDE.md for code migration examples
- Review schema.sql for database structure

---

## ? What's Next?

After successful setup:

1. **Import Data** (if you have existing data):
   - Use seed.js to import from Excel
   - Or use API endpoints to create records

2. **Update API Routes**:
   - Use examples from MIGRATION_GUIDE.md
   - Test each endpoint

3. **Development**:
   - Start with `npm run dev`
   - Watch for console errors
   - Test with curl or Postman

4. **Deployment**:
   - Use production PostgreSQL server
   - Update .env for production database
   - Run `npm run db:setup` on production
   - Deploy application

---

**Created:** 2024-05-29  
**Version:** 1.0.0  
**Status:** Ready for Setup ?

For questions or issues, refer to the documentation files in the project root.
