# MES Prototype - PostgreSQL Database Setup

This guide walks you through setting up the PostgreSQL database for the MES Prototype project.

## Prerequisites

1. **PostgreSQL installed** - Download from https://www.postgresql.org/download/
2. **Node.js installed** - Version 16 or higher
3. **PostgreSQL running** - Make sure the PostgreSQL service is running

## Setup Steps

### Step 1: Install Dependencies

```bash
cd server
npm install
```

### Step 2: Configure Environment Variables

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and update the PostgreSQL credentials if needed:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mes_prototype
DB_USER=postgres
DB_PASSWORD=postgres
```

### Step 3: Create the Database

Run the database setup script. This will:
- Create a new PostgreSQL database
- Initialize all tables
- Set up indexes for performance

```bash
npm run db:setup
```

You should see output like:
```
? Connected to PostgreSQL server
? Dropped existing database "mes_prototype"
? Created database "mes_prototype"
? Connected to database "mes_prototype"
? Database schema initialized successfully
? Created 15 tables:
  - activities
  - articles
  - cost_centers
  - daily_grading
  - daily_grading_audit
  - product_account_mapping
  - product_components
  - product_excise_mappings
  - product_master
  - products
  - staff
  - activity_cost_center_maps
  - grading_standards
  - users

? Database setup completed successfully!
```

### Step 4: Seed Data (Optional)

If you have seed data in Excel format, you can populate the database:

```bash
npm run seed
```

**Note:** The database is created fresh without any data. You can add your own data through:
- Excel import via the seed script
- API endpoints
- Manual SQL inserts

## Database Schema

The PostgreSQL database includes the following tables:

- **staff** - Employee/staff records
- **activities** - Activity codes and names
- **articles** - Article/product articles
- **cost_centers** - Cost center definitions
- **grading_standards** - Product grading standards
- **daily_grading** - Daily grading records
- **daily_grading_audit** - Audit trail for grading changes
- **users** - System users for authentication
- **product_master** - Product master data
- **products** - Product definitions
- **product_components** - Product component mappings
- **product_account_mapping** - Product accounting mappings
- **product_excise_mappings** - Excise tax mappings

## Running the Application

### Development Mode

```bash
npm run dev
```

This will start both the server and client in development mode.

### Server Only

```bash
npm run dev:server
```

The server will run on `http://localhost:3000` by default.

## Troubleshooting

### Connection refused error

**Problem:** `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solution:**
1. Make sure PostgreSQL is running
2. Check the connection details in `.env`
3. On Windows, start PostgreSQL service:
   ```bash
   net start postgresql-x64-xx
   ```

### Database already exists

**Problem:** `error: database "mes_prototype" already exists`

**Solution:** The setup script will automatically drop the existing database. If you want to keep data, back it up first.

### Permission denied error

**Problem:** `FATAL: Ident authentication failed for user "postgres"`

**Solution:**
1. Edit `pg_hba.conf` (usually in `C:\Program Files\PostgreSQL\xx\data\`)
2. Change `ident` to `md5` or `trust` for local connections
3. Restart PostgreSQL

## Database Connection Details

After setup, you can connect to the database using any PostgreSQL client:

```
Host: localhost
Port: 5432
Database: mes_prototype
User: postgres
Password: (as configured in .env)
```

## API Usage

The server provides RESTful API endpoints for all database operations. Check the `index.js` file for available endpoints.

## Need Help?

- Check the logs in the terminal for error messages
- Verify PostgreSQL is running and accessible
- Ensure all environment variables are correctly set
- Review the schema.sql file for database structure

## Notes

- This is a fresh database setup with **no data included**
- All previous SQLite data (mes.db) should be migrated if needed
- Foreign key constraints are enabled for data integrity
- Soft delete functionality is supported for audit trails
