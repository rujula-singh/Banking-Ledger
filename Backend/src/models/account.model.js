import { query } from '../config/db.js';

export function formatAccount(row, balance = 0) {
  if (!row) return null;
  const numBalance = parseFloat(balance) || 0;
  return {
    id: row.id,
    _id: row.id,
    user: row.user_id,
    name: row.name,
    accountType: row.account_type,
    accountNumber: row.account_number,
    status: row.status,
    currency: row.currency || 'INR',
    balance: numBalance,
    maskedNumber: row.account_number
      ? `•••• ${row.account_number.slice(-4)}`
      : `•••• ${String(row.id).slice(-4)}`,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function createAccount({ userId, accountType = 'SAVINGS', accountNumber, name, currency = 'INR' }, client = null) {
  const sql = `
    INSERT INTO accounts (user_id, account_type, account_number, name, currency, status)
    VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
    RETURNING *;
  `;
  const params = [userId, accountType, accountNumber, name || 'Primary Account', currency];
  const res = client ? await client.query(sql, params) : await query(sql, params);
  return formatAccount(res.rows[0], 0);
}

export async function findByUserId(userId) {
  const res = await query(
    `SELECT * FROM accounts WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId]
  );
  return Promise.all(
    res.rows.map(async (row) => {
      const bal = await getAccountBalance(row.id);
      return formatAccount(row, bal);
    })
  );
}

export async function findById(id, client = null) {
  if (!id) return null;
  const sql = `SELECT * FROM accounts WHERE id = $1 LIMIT 1`;
  const res = client ? await client.query(sql, [id]) : await query(sql, [id]);
  if (res.rows.length === 0) return null;
  const bal = await getAccountBalance(res.rows[0].id, client);
  return formatAccount(res.rows[0], bal);
}

export async function findByAccountNumber(accountNumber, client = null) {
  if (!accountNumber) return null;
  const sql = `SELECT * FROM accounts WHERE account_number = $1 LIMIT 1`;
  const res = client ? await client.query(sql, [accountNumber]) : await query(sql, [accountNumber]);
  if (res.rows.length === 0) return null;
  const bal = await getAccountBalance(res.rows[0].id, client);
  return formatAccount(res.rows[0], bal);
}

export async function getAccountBalance(accountId, client = null) {
  const sql = `
    SELECT COALESCE(SUM(
      CASE 
        WHEN type = 'CREDIT' THEN amount 
        WHEN type = 'DEBIT' THEN -amount 
        ELSE 0 
      END
    ), 0)::numeric AS balance
    FROM ledger_entries
    WHERE account_id = $1;
  `;
  const res = client ? await client.query(sql, [accountId]) : await query(sql, [accountId]);
  return parseFloat(res.rows[0]?.balance || 0);
}

export default {
  createAccount,
  findByUserId,
  findById,
  findByAccountNumber,
  getAccountBalance,
  formatAccount
};