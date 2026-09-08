import { query } from '../config/db.js';

export async function blacklistToken(token) {
  if (!token) return null;
  const sql = `
    INSERT INTO token_blacklist (token, blacklisted_at)
    VALUES ($1, NOW())
    ON CONFLICT (token) DO NOTHING
    RETURNING *;
  `;
  const res = await query(sql, [token]);
  return res.rows[0];
}

export async function isTokenBlacklisted(token) {
  if (!token) return false;
  const sql = `SELECT id FROM token_blacklist WHERE token = $1 LIMIT 1;`;
  const res = await query(sql, [token]);
  return res.rows.length > 0;
}

export default {
  blacklistToken,
  isTokenBlacklisted
};