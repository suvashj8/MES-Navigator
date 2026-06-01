# Database — PostgreSQL only

This project **does not use SQLite** at runtime. All API, seed, and import scripts talk to **PostgreSQL** via `pg` (`server/db.js`).

On startup the server logs `Database: PostgreSQL — …`. If a code review flags `mes.db-wal`, that is a **leftover file on disk**, not the live database — remove it with `cd server && npm run cleanup:legacy-sqlite` after migration.

## Staff photos

Photos are stored as files under `server/uploads/staff/` (gitignored). The database keeps only `photo_path`. List APIs never return base64 blobs. Serve via `GET /api/staff/:id/photo` (authenticated).

To move existing `photo_data` from Postgres to disk once:

```bash
cd server
npm run migrate:staff-photos
```

| Item | Location |
|------|----------|
| Connection | `server/.env` — `DATABASE_URL` or `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` |
| Schema | `server/schema.sql` |
| Pool / queries | `server/db.js` |

## First-time setup

```powershell
cd mes-prototype\server
copy .env.example .env
# Edit .env with your Postgres credentials
npm install
npm run db:setup
cd ..
npm run seed
```

## Migrate old SQLite data (one time)

If you have a legacy `server/mes.db` from before the Postgres switch:

```powershell
cd mes-prototype\server
npm install
# Postgres must be running and .env configured
npm run migrate:from-sqlite
```

This copies all tables into PostgreSQL, resets ID sequences, then **renames** `mes.db` to `mes.db.migrated.<timestamp>.bak` so it cannot be mistaken for the live database.

Options:

- `--dry-run` — show row counts only
- `--keep-sqlite` — do not rename `mes.db` after copy
- `--sqlite-path <file>` — custom SQLite path

`better-sqlite3` is a **devDependency** used only by the migration script, not by the running server.

## Do not use

- `server/mes.db` as the app database (archived after migration)
- `USE_SQLITE` or `DB_DRIVER=sqlite` in `.env` (startup will fail)
- `better-sqlite3` in application code

## Verify

```powershell
cd mes-prototype\server
node scripts/db-audit.js
```
