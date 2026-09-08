import pg from 'pg';
import config from './config.js';
import { runMigrations } from '../db/migrate.js';

const poolConfig = config.DATABASE_URL
  ? { connectionString: config.DATABASE_URL }
  : {
      user: config.PGUSER,
      host: config.PGHOST,
      database: config.PGDATABASE,
      password: config.PGPASSWORD,
      port: config.PGPORT,
    };

export const pool = new pg.Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

/**
 * Execute a parameterized query using the pool
 * @param {string} text - SQL query string
 * @param {Array} params - Parameter array
 */
export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // Optional query profiling
  // console.log('executed query', { text, duration, rows: res.rowCount });
  return res;
}

/**
 * Execute operations inside an isolated ACID database transaction
 * @param {Function} callback - Async function receiving the transactional pg client
 */
export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Connect to PostgreSQL, test connectivity and apply pending migrations
 */
async function connectDB() {
  try {
    const res = await pool.query('SELECT NOW() as current_time, current_database() as db_name');
    console.log(` Connected to PostgreSQL Database: [${res.rows[0].db_name}] at ${res.rows[0].current_time}`);
    
    // Automatically apply any pending migrations
    await runMigrations();
  } catch (err) {
    console.error(' Error connecting to PostgreSQL DB:', err.message);
    console.error('💡 Please check your PostgreSQL service and connection credentials in .env');
    throw err;
  }
}

export default connectDB;