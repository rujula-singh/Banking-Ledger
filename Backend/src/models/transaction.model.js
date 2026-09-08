import { query } from '../config/db.js';

export function formatTransaction(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    transactionId: row.transaction_id,
    fromAccount: row.from_account_id
      ? {
          id: row.from_account_id,
          _id: row.from_account_id,
          name: row.from_account_name || 'Account',
          accountNumber: row.from_account_number,
          accountType: row.from_account_type
        }
      : row.fromAccount,
    toAccount: row.to_account_id
      ? {
          id: row.to_account_id,
          _id: row.to_account_id,
          name: row.to_account_name || 'Account',
          accountNumber: row.to_account_number,
          accountType: row.to_account_type
        }
      : row.toAccount,
    type: row.type,
    category: row.category,
    description: row.description,
    status: row.status,
    amount: parseFloat(row.amount),
    idempotencyKey: row.idempotency_key,
    failureReason: row.failure_reason,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function findByIdempotencyKey(key, client = null) {
  if (!key) return null;
  const sql = `
    SELECT t.*, 
           fa.name as from_account_name, fa.account_number as from_account_number, fa.account_type as from_account_type,
           ta.name as to_account_name, ta.account_number as to_account_number, ta.account_type as to_account_type
    FROM transactions t
    LEFT JOIN accounts fa ON t.from_account_id = fa.id
    LEFT JOIN accounts ta ON t.to_account_id = ta.id
    WHERE t.idempotency_key = $1
    LIMIT 1;
  `;
  const res = client ? await client.query(sql, [key]) : await query(sql, [key]);
  if (res.rows.length === 0) return null;
  return formatTransaction(res.rows[0]);
}

export async function createTransaction(
  {
    fromAccountId,
    toAccountId,
    amount,
    type = 'TRANSFER',
    category = 'Other',
    description = 'Transfer',
    status = 'PENDING',
    transactionId,
    idempotencyKey,
    metadata = {},
    failureReason = null
  },
  client = null
) {
  const sql = `
    INSERT INTO transactions (
      from_account_id, to_account_id, amount, type, category,
      description, status, transaction_id, idempotency_key,
      metadata, failure_reason
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *;
  `;
  const params = [
    fromAccountId,
    toAccountId,
    amount,
    type,
    category,
    description,
    status,
    transactionId,
    idempotencyKey,
    JSON.stringify(metadata),
    failureReason
  ];

  const res = client ? await client.query(sql, params) : await query(sql, params);
  return formatTransaction(res.rows[0]);
}

export async function updateTransactionStatus(id, status, failureReason = null, client = null) {
  const sql = `
    UPDATE transactions
    SET status = $2, failure_reason = $3, updated_at = NOW()
    WHERE id = $1
    RETURNING *;
  `;
  const res = client
    ? await client.query(sql, [id, status, failureReason])
    : await query(sql, [id, status, failureReason]);
  return formatTransaction(res.rows[0]);
}

export async function findById(id) {
  if (!id) return null;
  const sql = `
    SELECT t.*, 
           fa.name as from_account_name, fa.account_number as from_account_number, fa.account_type as from_account_type,
           ta.name as to_account_name, ta.account_number as to_account_number, ta.account_type as to_account_type
    FROM transactions t
    LEFT JOIN accounts fa ON t.from_account_id = fa.id
    LEFT JOIN accounts ta ON t.to_account_id = ta.id
    WHERE t.id = $1 OR t.transaction_id = $1
    LIMIT 1;
  `;
  const res = await query(sql, [id]);
  if (res.rows.length === 0) return null;
  return formatTransaction(res.rows[0]);
}

export async function findTransactions({
  userAccountIds = [],
  search,
  category,
  startDate,
  endDate,
  accountId,
  limit = 20,
  offset = 0
}) {
  if (userAccountIds.length === 0) return [];

  const values = [];
  let paramIdx = 1;
  const conditions = [];

  if (accountId) {
    conditions.push(`(t.from_account_id = $${paramIdx} OR t.to_account_id = $${paramIdx})`);
    values.push(accountId);
    paramIdx++;
  } else {
    conditions.push(`(t.from_account_id = ANY($${paramIdx}) OR t.to_account_id = ANY($${paramIdx}))`);
    values.push(userAccountIds);
    paramIdx++;
  }

  if (category && category !== 'All') {
    conditions.push(`t.category = $${paramIdx}`);
    values.push(category);
    paramIdx++;
  }

  if (search) {
    conditions.push(`(t.description ILIKE $${paramIdx} OR t.transaction_id ILIKE $${paramIdx})`);
    values.push(`%${search}%`);
    paramIdx++;
  }

  if (startDate) {
    conditions.push(`t.created_at >= $${paramIdx}`);
    values.push(startDate);
    paramIdx++;
  }

  if (endDate) {
    conditions.push(`t.created_at <= $${paramIdx}`);
    values.push(endDate);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT t.*, 
           fa.name as from_account_name, fa.account_number as from_account_number, fa.account_type as from_account_type,
           ta.name as to_account_name, ta.account_number as to_account_number, ta.account_type as to_account_type
    FROM transactions t
    LEFT JOIN accounts fa ON t.from_account_id = fa.id
    LEFT JOIN accounts ta ON t.to_account_id = ta.id
    ${whereClause}
    ORDER BY t.created_at DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1};
  `;
  values.push(limit, offset);

  const res = await query(sql, values);
  return res.rows.map(formatTransaction);
}

export async function countTransactions({
  userAccountIds = [],
  search,
  category,
  startDate,
  endDate,
  accountId
}) {
  if (userAccountIds.length === 0) return 0;

  const values = [];
  let paramIdx = 1;
  const conditions = [];

  if (accountId) {
    conditions.push(`(t.from_account_id = $${paramIdx} OR t.to_account_id = $${paramIdx})`);
    values.push(accountId);
    paramIdx++;
  } else {
    conditions.push(`(t.from_account_id = ANY($${paramIdx}) OR t.to_account_id = ANY($${paramIdx}))`);
    values.push(userAccountIds);
    paramIdx++;
  }

  if (category && category !== 'All') {
    conditions.push(`t.category = $${paramIdx}`);
    values.push(category);
    paramIdx++;
  }

  if (search) {
    conditions.push(`(t.description ILIKE $${paramIdx} OR t.transaction_id ILIKE $${paramIdx})`);
    values.push(`%${search}%`);
    paramIdx++;
  }

  if (startDate) {
    conditions.push(`t.created_at >= $${paramIdx}`);
    values.push(startDate);
    paramIdx++;
  }

  if (endDate) {
    conditions.push(`t.created_at <= $${paramIdx}`);
    values.push(endDate);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT COUNT(*)::integer as count FROM transactions t ${whereClause};`;

  const res = await query(sql, values);
  return res.rows[0]?.count || 0;
}

export default {
  createTransaction,
  updateTransactionStatus,
  findByIdempotencyKey,
  findById,
  findTransactions,
  countTransactions,
  formatTransaction
};