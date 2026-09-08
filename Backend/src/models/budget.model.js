import { query } from '../config/db.js';

export function formatBudget(row) {
  if (!row) return null;
  return {
    id: row.id,
    _id: row.id,
    user: row.user_id,
    category: row.category,
    monthlyLimit: parseFloat(row.monthly_limit),
    periodMonth: row.period_month,
    periodYear: row.period_year,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function findBudgetsByUserAndPeriod(userId, month, year) {
  const sql = `
    SELECT * FROM budgets
    WHERE user_id = $1 AND period_month = $2 AND period_year = $3
    ORDER BY category ASC;
  `;
  const res = await query(sql, [userId, month, year]);
  return res.rows.map(formatBudget);
}

export async function upsertBudget({ userId, category, monthlyLimit, periodMonth, periodYear }) {
  const sql = `
    INSERT INTO budgets (user_id, category, monthly_limit, period_month, period_year)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (user_id, category, period_month, period_year)
    DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit, updated_at = NOW()
    RETURNING *;
  `;
  const params = [userId, category, monthlyLimit, periodMonth, periodYear];
  const res = await query(sql, params);
  return formatBudget(res.rows[0]);
}

export async function deleteBudget(id, userId) {
  const sql = `DELETE FROM budgets WHERE id = $1 AND user_id = $2 RETURNING id;`;
  const res = await query(sql, [id, userId]);
  return res.rowCount > 0;
}

export async function getCategorySpendingInMonth(userAccountIds, startDate, endDate) {
  if (!userAccountIds || userAccountIds.length === 0) return [];

  const sql = `
    SELECT category, SUM(amount)::numeric AS spent, COUNT(*)::integer AS count
    FROM transactions
    WHERE from_account_id = ANY($1)
      AND status = 'COMPLETED'
      AND type != 'DEPOSIT'
      AND created_at >= $2 
      AND created_at <= $3
    GROUP BY category
    ORDER BY spent DESC;
  `;
  const res = await query(sql, [userAccountIds, startDate, endDate]);
  return res.rows.map((r) => ({
    category: r.category,
    spent: parseFloat(r.spent),
    count: r.count
  }));
}

export default {
  findBudgetsByUserAndPeriod,
  upsertBudget,
  deleteBudget,
  getCategorySpendingInMonth,
  formatBudget
};
