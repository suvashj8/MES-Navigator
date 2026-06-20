# MES Prototype — Daily Worker Performance & Grading

Prototype for **Navigator Bead for Life** manufacturing (based on [`bead for life.xlsx`](../bead%20for%20life.xlsx) in the repo root).

## Features

| Module | Description |
|--------|-------------|
| **Auth & Roles** | Operator, Supervisor, Admin with role-based access |
| **Dashboard** | Daily grade distribution, department summary, 7-day trend |
| **Daily Grading** | Record quantity → auto-calculate grade |
| **Floor Entry** | Mobile-friendly grading screen (`/floor`) |
| **Scorecards** | Weekly, monthly, or custom date range |
| **Product Master** | ERP-style product catalog (Basic, Stock, Account mapping, Excise) |
| **Grading Rules** | Product × cost center standards (requires Product Master) |
| **Activity Mapping** | Link activities to cost centers (admin) |
| **Staff Master** | Browse workers; add staff (admin) |
| **User Management** | Create/edit users & roles (admin) |
| **Exports** | CSV/PDF scorecards, daily grading CSV, Product Master CSV/PDF |
| **Print** | Product Master form (sections only, no action bar) |
| **Nepali (BS) dates** | AD ↔ Bikram Sambat on date fields |
| **Supervisor scope** | Supervisors see only their department |
| **Themes** | Dark (default) and light (sage/mint accents) |

## Product Master flow

1. Add products under **Setup → Product master** (supervisor/admin can save), **or** use **Grading rules → Create missing products & link all** to import codes from existing rules.
2. Create **Grading rules** using products from Product Master (each rule stores `product_master_id`).
3. **Daily grading** / **Floor entry** only accepts products that exist in Product Master.

**Linking:** On Grading rules, unlinked rows show when `prod_code` has no matching Product Master code. Use **Create missing products & link all** to auto-create master records from rule names, or **Link matching codes only** if products already exist with the same code.

Saves are **atomic**: product row + account mapping + excise mapping commit in one database transaction.

## Roles & Permissions

| Action | Operator | Supervisor | Admin |
|--------|:--------:|:----------:|:-----:|
| Daily grading entry | ✓ | ✓ | ✓ |
| Delete daily entries | | ✓ | ✓ |
| View reports/scorecards | ✓ | ✓ | ✓ |
| View Product Master | ✓ | ✓ | ✓ |
| Edit Product Master | | ✓ | ✓ |
| View grading rules | ✓ | ✓ | ✓ |
| Add/edit/delete grading rules | | ✓ | ✓ |
| Activity ↔ cost center mapping | | | ✓ |
| User management | | | ✓ |
| Add staff | | | ✓ |
| Export reports / Product Master | ✓ | ✓ | ✓ |

### Demo logins (change before production)

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin123` | Admin |
| `supervisor` | `super123` | Supervisor |
| `operator` | `oper123` | Operator |

## Grading Formula

1. **Per Day Qty** = `Std_Qty` · **Working Min** = `B_Value`
2. **C Time Min** = Working Min ÷ Per Day Qty · **P Hour** = 60 ÷ C Time Min
3. **W Hour** = Quantity × (C Time Min ÷ 60) · **W Min** = W Hour × 60
4. **Grade:** W Min &lt; B → C · B–A → B · A–A+ → A · ≥ A+ → AA

**Scorecard rating:** Avg score (C=1, B=2, A=3, AA=4) → Excellent / Good / Average / Needs Improvement

## Docker (full stack)

Run the UI, API, and PostgreSQL together:

```powershell
cd mes-prototype
copy .env.docker.example .env.docker
# Edit JWT_SECRET and CORS_ORIGINS if needed (defaults work for localhost:6001)
npm run docker:up
```

- **Web UI:** http://localhost:6001 (nginx serves the SPA; `/api` proxied to the API container)
- **API (direct):** http://localhost:6002/api/... (curl, Postman, or browser)
- **API (internal container port):** 6000
- **Postgres on host:** **5432** (default; `MES_DB_PORT` in `.env.docker`)
- **First start:** seeds staff, grading rules, and demo users from `bead for life (1).xlsx` when the database is empty (`MES_AUTO_SEED=1`)
- **Login:** `admin` / `admin123`

| Command | Purpose |
|---------|---------|
| `npm run docker:up` | Build and start mes-web + mes-api + mes-postgres |
| `npm run docker:down` | Stop all containers |
| `npm run docker:logs` | Follow container logs |
| `npm run docker:seed` | Re-run seed inside the API container (destructive truncate) |
| `npm run db:docker` | Postgres only — for `npm run dev` on the host |

Staff photos persist in the `mes_staff_uploads` Docker volume.

## Quick Start (local dev)

**Requires PostgreSQL** (no SQLite). Create a database, then configure the server:

```powershell
cd mes-prototype
cd server
copy .env.example .env
# Edit .env with your Postgres host, user, password, and DB_NAME=mes_prototype
npm install
npm run db:setup
cd ..
npm install
npm run seed
npm run dev
```

`npm run db:setup` creates the `mes_prototype` database and applies `server/schema.sql`. On startup, the API also runs `initSchema()` (idempotent).

**Dev scripts**

| Command | Use when |
|---------|----------|
| `npm run dev` | UI + API together (default) |
| `npm run dev:ui` | Frontend only — API already running in another terminal |
| `npm run dev:api` | API with selective reload (ignores `scripts/`, uploads) |
| `cd server && npm run dev:stable` | API with **no** auto-restart while you edit the UI |

If login shows “API is restarting”, wait until the API terminal prints `MES API running on http://localhost:3001` and try again (the client auto-retries once after 2s).

- **UI:** http://localhost:5174  
- **API:** http://localhost:3001  

## Database

The app uses **PostgreSQL only** (via `pg`). Configure `server/.env` from `.env.example` (`DATABASE_URL` or `DB_HOST` / `DB_NAME` / etc.).

On server start, `initSchema()` applies `server/schema.sql` (idempotent) and syncs cost centers from grading rules.

**Product code rename:** Updating a Product Master code automatically updates linked grading rules and daily grading entries.

Run `node server/scripts/db-audit.js` to verify tables and row counts.

### Migrating from old `mes.db` (SQLite)

If you still have `server/mes.db` from an earlier install, run **once** after Postgres is configured:

```powershell
cd mes-prototype\server
npm run migrate:from-sqlite
```

See [DATABASE.md](DATABASE.md) for details. The app never reads `mes.db` after migration; the file is renamed to `.bak`.

## Environment (optional)

Copy `server/.env.example` to `server/.env` for production overrides:

| Variable | Notes |
|----------|--------|
| `JWT_SECRET` | **Required** (min 32 chars; server exits on startup if missing or weak) |
| `CORS_ORIGINS` | **Required in production** — comma-separated browser UI origins (e.g. `https://mes.example.com`). Dev allows `localhost:5173–5176` plus any values you add here. |
| `PORT` | Example file shows 3000; dev server uses **3001** unless you change `server/index.js` |

## Tech Stack

- React + Vite + Tailwind (frontend, PWA-capable)
- Express + **PostgreSQL (pg)** + JWT (backend)
- PDFKit for PDF exports

## Project layout

```
mes-prototype/
  client/          React UI
  server/          Express API + schema.sql
  README.md        This file
```

Other `*.md` guides in the repo may describe Postgres or older APIs; trust this README for day-to-day dev.
