import { query } from '../config/db.js';

export function formatLedgerEntry(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    account: row.account_id,
    transaction: row.transaction_id,
    amount: parseFloat(row.amount),
    type: row.type,
    createdAt: row.created_at
  };
}

export async function createLedgerEntry(
  { accountId, transactionId, amount, type },
  client = null
) {
  if (!['CREDIT', 'DEBIT'].includes(type)) {
    throw new Error('Ledger entry type must be CREDIT or DEBIT');
  }
  if (amount <= 0) {
    throw new Error('Ledger entry amount must be positive');
  }

  const sql = `
    INSERT INTO ledger_entries (account_id, transaction_id, amount, type)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const params = [accountId, transactionId, amount, type];
  const res = client ? await client.query(sql, params) : await query(sql, params);
  return formatLedgerEntry(res.rows[0]);
}

export async function getOpeningBalance(accountId, beforeDate) {
  const sql = `
    SELECT COALESCE(SUM(
      CASE 
        WHEN type = 'CREDIT' THEN amount 
        WHEN type = 'DEBIT' THEN -amount 
        ELSE 0 
      END
    ), 0)::numeric AS opening_balance
    FROM ledger_entries
    WHERE account_id = $1 AND created_at < $2;
  `;
  const res = await query(sql, [accountId, beforeDate]);
  return parseFloat(res.rows[0]?.opening_balance || 0);
}

export async function getMonthEntriesWithTransactions(accountId, startDate, endDate) {
  const sql = `
    SELECT le.*, 
           t.transaction_id as txn_code,
           t.description as txn_description,
           t.category as txn_category,
           t.type as txn_type,
           t.created_at as txn_created_at
    FROM ledger_entries le
    LEFT JOIN transactions t ON le.transaction_id = t.id
    WHERE le.account_id = $1 
      AND le.created_at >= $2 
      AND le.created_at <= $3
    ORDER BY le.created_at ASC, le.id ASC;
  `;
  const res = await query(sql, [accountId, startDate, endDate]);
  return res.rows;
}

export default {
  createLedgerEntry,
  getOpeningBalance,
  getMonthEntriesWithTransactions,
  formatLedgerEntry
};