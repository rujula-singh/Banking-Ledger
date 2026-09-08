import dotenv from 'dotenv';
dotenv.config();

const config = {
  DATABASE_URL: process.env.DATABASE_URL,
  PGUSER: process.env.PGUSER || 'postgres',
  PGHOST: process.env.PGHOST || 'localhost',
  PGDATABASE: process.env.PGDATABASE || 'nexus_ledger',
  PGPASSWORD: process.env.PGPASSWORD || 'postgres',
  PGPORT: parseInt(process.env.PGPORT || '5432', 10),
  JWT_SECRET: process.env.JWT_SECRET || 'nexus_default_jwt_secret_key_change_in_prod',
  EMAIL_USER: process.env.EMAIL_USER,
  CLIENT_ID: process.env.CLIENT_ID,
  CLIENT_SECRET: process.env.CLIENT_SECRET,
  REFRESH_TOKEN: process.env.REFRESH_TOKEN,
};

export default config;