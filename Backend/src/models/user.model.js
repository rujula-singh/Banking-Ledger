import bcryptjs from 'bcryptjs';
import { query } from '../config/db.js';

export function formatUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    email: row.email,
    name: row.name,
    password: row.password,
    systemUser: row.is_system_user,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sessions: row.sessions || []
  };
}

export async function findByEmail(email, includePassword = false) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  const selectCols = includePassword
    ? 'id, email, name, password, is_system_user, created_at, updated_at'
    : 'id, email, name, is_system_user, created_at, updated_at';

  const res = await query(
    `SELECT ${selectCols} FROM users WHERE LOWER(email) = $1 LIMIT 1`,
    [normalizedEmail]
  );

  if (res.rows.length === 0) return null;
  return formatUser(res.rows[0]);
}

export async function findById(id, includePassword = false) {
  if (!id) return null;
  const selectCols = includePassword
    ? 'id, email, name, password, is_system_user, created_at, updated_at'
    : 'id, email, name, is_system_user, created_at, updated_at';

  const res = await query(
    `SELECT ${selectCols} FROM users WHERE id = $1 LIMIT 1`,
    [id]
  );

  if (res.rows.length === 0) return null;
  return formatUser(res.rows[0]);
}

export async function createUser({ email, password, name, systemUser = false }, client = null) {
  const normalizedEmail = (email || '').toLowerCase().trim();
  const hashedPassword = await bcryptjs.hash(password, 10);

  const sql = `
    INSERT INTO users (email, name, password, is_system_user)
    VALUES ($1, $2, $3, $4)
    RETURNING id, email, name, is_system_user, created_at, updated_at;
  `;
  const params = [normalizedEmail, name, hashedPassword, systemUser];

  const res = client ? await client.query(sql, params) : await query(sql, params);
  return formatUser(res.rows[0]);
}

export async function comparePassword(candidatePassword, hashedPassword) {
  return await bcryptjs.compare(candidatePassword, hashedPassword);
}

export async function addSession(userId, { sessionId, device, browser, location, ip }, client = null) {
  const sql = `
    INSERT INTO user_sessions (user_id, session_id, device, browser, location, ip, last_active)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (session_id) 
    DO UPDATE SET last_active = NOW(), ip = EXCLUDED.ip
    RETURNING *;
  `;
  const params = [
    userId,
    sessionId,
    device || 'Desktop / Web',
    browser || 'Chrome',
    location || 'India',
    ip || '127.0.0.1'
  ];

  const res = client ? await client.query(sql, params) : await query(sql, params);
  return res.rows[0];
}

export async function getUserSessions(userId) {
  const res = await query(
    `SELECT id, session_id AS "sessionId", device, browser, location, ip, 
            last_active AS "lastActive", created_at AS "createdAt"
     FROM user_sessions 
     WHERE user_id = $1 
     ORDER BY last_active DESC 
     LIMIT 10`,
    [userId]
  );
  return res.rows;
}

export async function revokeOtherSessions(userId, currentSessionId) {
  const res = await query(
    `DELETE FROM user_sessions WHERE user_id = $1 AND session_id != $2`,
    [userId, currentSessionId]
  );
  return res.rowCount;
}

export default {
  findByEmail,
  findById,
  createUser,
  comparePassword,
  addSession,
  getUserSessions,
  revokeOtherSessions,
  formatUser
};