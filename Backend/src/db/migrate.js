import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbName = process.env.PGDATABASE || 'nexus_ledger';
const user = process.env.PGUSER || 'postgres';
const host = process.env.PGHOST || 'localhost';
const password = process.env.PGPASSWORD || 'postgres';
const port = parseInt(process.env.PGPORT || '5432', 10);

/**
 * Ensure the target database exists; if not, create it via maintenance database 'postgres'
 */
async function ensureDatabaseExists() {
  const maintenancePool = new pg.Pool({
    user,
    host,
    password,
    port,
    database: 'postgres' // default maintenance database
  });

  const client = await maintenancePool.connect();
  try {
    const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (res.rowCount === 0) {
      console.log(`📦 Database "${dbName}" does not exist. Creating it now...`);
      // CREATE DATABASE cannot run inside a transaction block
      await client.query(`CREATE DATABASE "${dbName}";`);
      console.log(`✅ Database "${dbName}" created successfully.`);
    }
  } finally {
    client.release();
    await maintenancePool.end();
  }
}

export async function runMigrations() {
  await ensureDatabaseExists();

  const poolConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : { user, host, database: dbName, password, port };

  const pool = new pg.Pool(poolConfig);
  const client = await pool.connect();

  try {
    console.log(`🔄 Checking database migrations for [${dbName}]...`);

    // 1. Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Read all .sql files in migrations directory
    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('📁 No migrations directory found.');
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    // 3. Fetch already applied migrations
    const { rows: appliedRows } = await client.query(
      'SELECT name FROM schema_migrations'
    );
    const appliedSet = new Set(appliedRows.map((r) => r.name));

    // 4. Apply pending migrations sequentially
    for (const file of files) {
      if (!appliedSet.has(file)) {
        console.log(`➡️  Applying migration: ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');

        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query(
            'INSERT INTO schema_migrations (name) VALUES ($1)',
            [file]
          );
          await client.query('COMMIT');
          console.log(`✅ Applied migration: ${file}`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`❌ Migration failed for ${file}:`, err.message);
          throw err;
        }
      } else {
        console.log(`✔️  Already applied: ${file}`);
      }
    }

    console.log('✨ All migrations are up to date.');
  } finally {
    client.release();
    await pool.end();
  }
}

// Allow direct execution via CLI `node src/db/migrate.js`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => {
      console.log('🏁 Migration process completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('💥 Migration runner error:', err);
      process.exit(1);
    });
}
