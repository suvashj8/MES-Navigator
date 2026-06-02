# MES Navigator — Navigator Bead for Life

Manufacturing execution system (MES) prototype for **daily worker performance**, **production grading** (C / B / A / A+), and **Product Master** management.

Built from the business requirements in [`bead for life.xlsx`](bead%20for%20life.xlsx) (source spreadsheet in this repo).

## Repository layout

| Path | Description |
|------|-------------|
| [`mes-prototype/`](mes-prototype/) | Full application — React UI, Express API, PostgreSQL |
| [`bead for life.xlsx`](bead%20for%20life.xlsx) | Original spec / reference data |

All setup, features, roles, and database docs live in **[mes-prototype/README.md](mes-prototype/README.md)**.

## Features (summary)

- **Dashboard** — grade distribution, department summary, trends  
- **Daily grading & floor entry** — quantity in → grade out  
- **Product Master** — catalog, stock, accounts, excise  
- **Grading rules** — product × work station standards  
- **Reports / scorecards** — weekly, monthly, custom range (CSV / PDF)  
- **Staff & users** — roles: Operator, Supervisor, Admin  
- **Nepali (BS) dates** — Bikram Sambat calendar alongside AD  
- **Themes** — dark and light UI  
- **PWA / Capacitor** — mobile-friendly floor entry  

## Quick start

**Prerequisites:** [Node.js](https://nodejs.org/) 18+, [PostgreSQL](https://www.postgresql.org/)

```bash
git clone https://github.com/suvashj8/MES-Navigator.git
cd MES-Navigator/mes-prototype

cd server
cp .env.example .env
# Edit .env — database name, user, password, JWT_SECRET (32+ chars)

npm install
npm run db:setup

cd ..
npm install
npm run seed
npm run dev
```

- **UI:** http://localhost:5173  
- **API:** http://localhost:3001  

**Demo logins** (change before production): `admin` / `admin123`, `supervisor` / `super123`, `operator` / `oper123`

See [mes-prototype/README.md](mes-prototype/README.md) for dev scripts, migrations, environment variables, and permissions.

## Tech stack

- **Frontend:** React, Vite, Tailwind CSS, PWA  
- **Backend:** Express, PostgreSQL (`pg`), JWT auth  
- **Exports:** PDFKit, CSV  

## Documentation

| Guide | Topic |
|-------|--------|
| [mes-prototype/README.md](mes-prototype/README.md) | Main developer guide |
| [mes-prototype/DATABASE.md](mes-prototype/DATABASE.md) | PostgreSQL schema & audit |
| [mes-prototype/POSTGRES_SETUP.md](mes-prototype/POSTGRES_SETUP.md) | Database install |
| [mes-prototype/START_HERE.md](mes-prototype/START_HERE.md) | Onboarding checklist |

## License

Private / internal prototype for Navigator Bead for Life. Contact the repository owner for use outside this project.
