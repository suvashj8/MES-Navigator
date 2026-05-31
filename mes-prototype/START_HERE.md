# PostgreSQL Database Setup

> **Single source of truth:** [DATABASE.md](DATABASE.md) — PostgreSQL only at runtime.  
> **One-time data import from old SQLite:** `cd server && npm run migrate:from-sqlite`

## What You Need to Know

Your MES Prototype project uses **PostgreSQL only** (not `mes.db` at runtime). This is a completely new setup for your new organization - no existing data is included.

---

## ?? New Files Created

In your project root:
- ?? **POSTGRES_SETUP.md** - Detailed setup instructions
- ?? **DATABASE_SETUP_SUMMARY.md** - Overview of what was created
- ?? **MIGRATION_GUIDE.md** - How to update your code from SQLite
- ?? **SETUP_CHECKLIST.md** - Step-by-step checklist to follow

In `server/` folder:
- ?? **schema.sql** - PostgreSQL database schema (15 tables)
- ?? **db-postgres.js** - Database connection and helper functions
- ?? **db-setup.js** - Automated database initialization script
- ?? **.env.example** - Environment configuration template

In `server/` also updated:
- ?? **package.json** - Now includes PostgreSQL driver (`pg`)

---

## ?? Quick Start (3 Steps)

### Step 1: Install Dependencies
```bash
cd server
npm install
```

### Step 2: Create .env File
```bash
cp .env.example .env
```
(No changes needed if using default localhost credentials)

### Step 3: Initialize Database
```bash
npm run db:setup
```

That's it! Your PostgreSQL database is ready to use.

---

## ?? Which Document Should I Read?

| Document | When to Read | Content |
|----------|-------------|---------|
| **SETUP_CHECKLIST.md** | First! To get started | Step-by-step checklist, next steps |
| **POSTGRES_SETUP.md** | For detailed guide | Complete instructions, troubleshooting |
| **DATABASE_SETUP_SUMMARY.md** | For overview | What was created, features, tables |
| **MIGRATION_GUIDE.md** | Before coding | How to update your Express routes |

---

## ??? Database Structure

15 tables created:
- Staff management
- User authentication  
- Activities and cost centers
- Grading standards and daily entries
- Product master data
- Audit trails

See **DATABASE_SETUP_SUMMARY.md** for complete table list.

---

## ? Key Changes from SQLite

| Aspect | SQLite | PostgreSQL |
|--------|--------|-----------|
| **Driver** | better-sqlite3 | pg |
| **Sync/Async** | Synchronous | Async/Await |
| **Parameters** | `?` | `$1, $2, ...` |
| **Results** | Direct object | `result.rows[0]` |
| **Transactions** | `db.exec()` | `await pool.query()` |

See **MIGRATION_GUIDE.md** for code examples.

---

## ?? Important Notes

? **Fresh Database** - No existing data. Start clean.  
? **PostgreSQL Required** - Must have PostgreSQL installed and running.  
? **Async Code** - All database calls now return Promises.  
? **Secure** - Use .env for database credentials.  
?? **Update Code** - Express routes need to use async/await.  

---

## ?? If Something Goes Wrong

1. **Can't connect?** ? Start PostgreSQL service
2. **Tables missing?** ? Run `npm run db:setup` again
3. **Code not working?** ? Check MIGRATION_GUIDE.md for syntax changes
4. **Module not found?** ? Run `npm install` again

See **POSTGRES_SETUP.md** for detailed troubleshooting.

---

## ?? Commands You'll Need

```bash
# Install dependencies
npm install

# Setup database
npm run db:setup

# Start development server
npm run dev

# Seed data (if using Excel import)
npm run seed

# Start PostgreSQL (Windows PowerShell)
net start postgresql-x64-xx

# Connect to database directly
psql -h localhost -U postgres -d mes_prototype
```

---

## ? Next Steps

1. ? Read **SETUP_CHECKLIST.md** for detailed steps
2. ? Run the setup script: `npm run db:setup`
3. ? Update your Express routes using **MIGRATION_GUIDE.md**
4. ? Test your API endpoints
5. ? Start development: `npm run dev`

---

## ?? By the Numbers

- **15** database tables created
- **6** new/updated files
- **0** data included (fresh database)
- **1** command to setup: `npm run db:setup`

---

**Status:** ? Ready to Setup  
**Database:** PostgreSQL  
**Organization:** New Project  
**Start With:** SETUP_CHECKLIST.md

Good luck with your new MES project! ??
