import { query } from '../config/db.js';

export function formatNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    user: row.user_id,
    title: row.title,
    message: row.message,
    type: row.type,
    isRead: row.is_read,
    data: row.data || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function createNotification(
  { userId, title, message, type = 'INFO', data = {} },
  client = null
) {
  const sql = `
    INSERT INTO notifications (user_id, title, message, type, data)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  const params = [userId, title, message, type, JSON.stringify(data)];
  const res = client ? await client.query(sql, params) : await query(sql, params);
  return formatNotification(res.rows[0]);
}

export async function getNotificationsByUser(userId, limit = 30) {
  const sql = `
    SELECT * FROM notifications
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2;
  `;
  const res = await query(sql, [userId, limit]);
  return res.rows.map(formatNotification);
}

export async function getUnreadCount(userId) {
  const sql = `
    SELECT COUNT(*)::integer AS unread_count
    FROM notifications
    WHERE user_id = $1 AND is_read = FALSE;
  `;
  const res = await query(sql, [userId]);
  return res.rows[0]?.unread_count || 0;
}

export async function markAsRead(id, userId) {
  const sql = `
    UPDATE notifications
    SET is_read = TRUE, updated_at = NOW()
    WHERE id = $1 AND user_id = $2
    RETURNING *;
  `;
  const res = await query(sql, [id, userId]);
  return formatNotification(res.rows[0]);
}

export async function markAllAsRead(userId) {
  const sql = `
    UPDATE notifications
    SET is_read = TRUE, updated_at = NOW()
    WHERE user_id = $1 AND is_read = FALSE;
  `;
  const res = await query(sql, [userId]);
  return res.rowCount;
}

export default {
  createNotification,
  getNotificationsByUser,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  formatNotification
};
