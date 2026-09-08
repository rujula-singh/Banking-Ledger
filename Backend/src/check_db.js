import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'nexus_ledger',
  password: process.env.PGPASSWORD || 'postgres',
  port: parseInt(process.env.PGPORT || '5432', 10),
});

async function check() {
  const client = await pool.connect();
  try {
    const currentDb = await client.query('SELECT current_database(), current_user, inet_server_port();');
    console.log('📌 Connected to:', currentDb.rows[0]);

    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('\n📋 Tables in public schema:');
    for (const row of tablesRes.rows) {
      const countRes = await client.query(`SELECT count(*)::int as count FROM "${row.table_name}";`);
      console.log(`  - ${row.table_name.padEnd(20)} (rows: ${countRes.rows[0].count})`);
    }
  } catch (err) {
    console.error('Error querying DB:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

check();
