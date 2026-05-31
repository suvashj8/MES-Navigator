#!/usr/bin/env node
/**
 * Database Setup Script for PostgreSQL
 * Run this script to create the PostgreSQL database and initialize the schema
 * 
 * Usage: node db-setup.js
 * 
 * Make sure PostgreSQL is running and you have admin credentials
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 5432;
const DB_NAME = process.env.DB_NAME || 'mes_prototype';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

const DEFAULT_DB = 'postgres'; // Default PostgreSQL database

async function setupDatabase() {
  let adminPool;
  let appPool;

  try {
    // Step 1: Connect to default postgres database as admin
    console.log('Step 1: Connecting to PostgreSQL server...');
    adminPool = new Pool({
      host: DB_HOST,
      port: DB_PORT,
      database: DEFAULT_DB,
      user: DB_USER,
      password: DB_PASSWORD,
    });

    // Test connection
    await adminPool.query('SELECT NOW()');
    console.log('? Connected to PostgreSQL server');

    // Step 2: Drop existing database if it exists
    console.log(`\nStep 2: Checking for existing database "${DB_NAME}"...`);
    try {
      await adminPool.query(`DROP DATABASE IF EXISTS ${DB_NAME};`);
      console.log(`? Dropped existing database "${DB_NAME}"`);
    } catch (error) {
      console.log(`? Database "${DB_NAME}" did not exist`);
    }

    // Step 3: Create new database
    console.log(`\nStep 3: Creating new database "${DB_NAME}"...`);
    await adminPool.query(`CREATE DATABASE ${DB_NAME};`);
    console.log(`? Created database "${DB_NAME}"`);

    // Step 4: Connect to the new database
    console.log(`\nStep 4: Connecting to new database...`);
    appPool = new Pool({
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      password: DB_PASSWORD,
    });

    // Test connection
    await appPool.query('SELECT NOW()');
    console.log(`? Connected to database "${DB_NAME}"`);

    // Step 5: Initialize schema
    console.log('\nStep 5: Initializing database schema...');
    const schemaPath = path.join(__dirname, 'schema.sql');

    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }

    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Split schema by semicolons and execute each statement
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    for (const statement of statements) {
      try {
        await appPool.query(statement);
      } catch (error) {
        // Some statements might fail if they already exist, which is fine
        if (!error.message.includes('already exists')) {
          console.error('Error executing statement:', statement);
          throw error;
        }
      }
    }

    console.log('? Database schema initialized successfully');

    // Step 6: Verify tables
    console.log('\nStep 6: Verifying tables...');
    const tablesResult = await appPool.query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = 'public' 
       ORDER BY table_name;`
    );

    const tables = tablesResult.rows.map(row => row.table_name);
    console.log(`? Created ${tables.length} tables:`);
    tables.forEach(table => console.log(`  - ${table}`));

    console.log('\n? Database setup completed successfully!');
    console.log(`\nConnection string: postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`);
    console.log(`\nNext steps:`);
    console.log(`1. Copy .env.example to .env`);
    console.log(`2. Update .env with your PostgreSQL credentials`);
    console.log(`3. Run "npm run dev" to start the server`);
    console.log(`4. Run "npm run seed" to populate initial data`);

  } catch (error) {
    console.error('\n? Database setup failed:');
    console.error(error.message);
    process.exit(1);
  } finally {
    // Close connections
    if (adminPool) {
      await adminPool.end();
    }
    if (appPool) {
      await appPool.end();
    }
  }
}

setupDatabase();
