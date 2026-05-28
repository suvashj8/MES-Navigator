# MES Prototype — Daily Worker Performance & Grading

Prototype for **Bed for Life** manufacturing, based on `bed for life.xlsx`.

## Features

| Module | Description |
|--------|-------------|
| **Auth & Roles** | Operator, Supervisor, Admin with role-based access |
| **Dashboard** | Daily grade distribution & department summary |
| **Daily Grading** | Record quantity → auto-calculate grade |
| **Scorecards** | Weekly & monthly worker performance reports |
| **Grading Standards** | View/add/edit/delete product × cost center rules |
| **Activity Mapping** | Link activities to cost centers (admin) |
| **Staff Master** | Browse & add workers (admin) |
| **User Management** | Create/edit users & roles (admin) |
| **CSV Export** | Download scorecard & daily grading reports |
| **Custom date range** | Scorecards for any from–to period |
| **Worker detail** | Per-worker printable scorecard with entry list |
| **Dashboard trend** | 7-day grading activity chart |
| **Profile** | Change your password & display name |
| **PDF Reports** | Download scorecards & worker detail as PDF |
| **Nepali (BS) dates** | AD ↔ Bikram Sambat on date fields |
| **Supervisor scope** | Supervisors see only their department |
| **Floor Entry** | Mobile-friendly grading screen (`/floor`) |

## Roles & Permissions

| Action | Operator | Supervisor | Admin |
|--------|:--------:|:----------:|:-----:|
| Daily grading entry | ✓ | ✓ | ✓ |
| Delete daily entries | | ✓ | ✓ |
| View reports/scorecards | ✓ | ✓ | ✓ |
| View grading standards | ✓ | ✓ | ✓ |
| Add/edit/delete standards | | ✓ | ✓ |
| Activity ↔ cost center mapping | | | ✓ |
| User management | | | ✓ |
| Add staff | | | ✓ |
| Export scorecards CSV | ✓ | ✓ | ✓ |

### Demo logins

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

## Quick Start

```powershell
cd "C:\Users\rakesh\Desktop\Suvash project\new project\mes-prototype"
npm install
cd server; npm install; cd ..
npm run seed
npm run dev
```

- **UI:** http://localhost:5173
- **API:** http://localhost:3001

## Tech Stack

- React + Vite + Tailwind (frontend)
- Express + SQLite + JWT (backend)
