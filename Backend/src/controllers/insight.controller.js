import accountModel from '../models/account.model.js';
import { query } from '../config/db.js';

/**
 * Get monthly spending breakdown by category and month-over-month comparisons in PostgreSQL
 */
export async function getSpendingInsights(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const userAccounts = await accountModel.findByUserId(userId);
    const userAccountIds = userAccounts.map((a) => a.id);

    if (userAccountIds.length === 0) {
      return res.status(200).json({
        success: true,
        currentMonth: { totalSpending: 0, categories: [] },
        previousMonth: { totalSpending: 0, categories: [] },
        highlights: []
      });
    }

    const now = new Date();
    const currentYear = parseInt(req.query.year || now.getFullYear(), 10);
    const currentMonth = parseInt(req.query.month || (now.getMonth() + 1), 10);

    // Current month dates
    const startOfCurrent = new Date(currentYear, currentMonth - 1, 1);
    const endOfCurrent = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    // Previous month dates
    const prevMonthDate = new Date(currentYear, currentMonth - 2, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = prevMonthDate.getMonth() + 1;
    const startOfPrev = new Date(prevYear, prevMonth - 1, 1);
    const endOfPrev = new Date(prevYear, prevMonth, 0, 23, 59, 59, 999);

    const aggregateCategorySpend = async (startDate, endDate) => {
      const sql = `
        SELECT category, SUM(amount)::numeric AS amount, COUNT(*)::integer AS count
        FROM transactions
        WHERE from_account_id = ANY($1)
          AND status = 'COMPLETED'
          AND type != 'DEPOSIT'
          AND created_at >= $2 AND created_at <= $3
        GROUP BY category
        ORDER BY amount DESC;
      `;
      const result = await query(sql, [userAccountIds, startDate, endDate]);
      const categories = result.rows.map((r) => ({
        category: r.category,
        amount: parseFloat(r.amount),
        count: r.count
      }));
      const total = categories.reduce((acc, curr) => acc + curr.amount, 0);
      return { categories, total };
    };

    const [currentSpendData, prevSpendData] = await Promise.all([
      aggregateCategorySpend(startOfCurrent, endOfCurrent),
      aggregateCategorySpend(startOfPrev, endOfPrev)
    ]);

    // Compute highlights / comparisons
    const highlights = [];
    const prevCategoryMap = new Map(prevSpendData.categories.map((c) => [c.category, c.amount]));

    currentSpendData.categories.forEach((curr) => {
      const prevAmount = prevCategoryMap.get(curr.category) || 0;
      if (prevAmount > 0) {
        const deltaPercent = Math.round(((curr.amount - prevAmount) / prevAmount) * 100);
        if (deltaPercent > 0) {
          highlights.push({
            category: curr.category,
            type: 'INCREASE',
            percentage: deltaPercent,
            message: `You spent ${deltaPercent}% more on ${curr.category} than last month.`
          });
        } else if (deltaPercent < 0) {
          highlights.push({
            category: curr.category,
            type: 'DECREASE',
            percentage: Math.abs(deltaPercent),
            message: `You spent ${Math.abs(deltaPercent)}% less on ${curr.category} than last month.`
          });
        }
      }
    });

    res.status(200).json({
      success: true,
      period: {
        current: { month: currentMonth, year: currentYear },
        previous: { month: prevMonth, year: prevYear }
      },
      currentMonth: {
        totalSpending: currentSpendData.total,
        categories: currentSpendData.categories
      },
      previousMonth: {
        totalSpending: prevSpendData.total,
        categories: prevSpendData.categories
      },
      highlights
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get monthly cashflow (Income vs Expense) in PostgreSQL
 */
export async function getCashflowInsights(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const userAccounts = await accountModel.findByUserId(userId);
    const userAccountIds = userAccounts.map((a) => a.id);

    if (userAccountIds.length === 0) {
      return res.status(200).json({
        success: true,
        cashflow: { income: 0, expenses: 0, netSavings: 0, savingsRate: 0 }
      });
    }

    const now = new Date();
    const year = parseInt(req.query.year || now.getFullYear(), 10);
    const month = parseInt(req.query.month || (now.getMonth() + 1), 10);

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    // Total Income in Month: (toAccount in userAccountIds, and fromAccount not in userAccountIds, OR type is DEPOSIT)
    const incomeSql = `
      SELECT COALESCE(SUM(amount), 0)::numeric AS total
      FROM transactions
      WHERE to_account_id = ANY($1)
        AND status = 'COMPLETED'
        AND created_at >= $2 AND created_at <= $3
        AND (type = 'DEPOSIT' OR from_account_id != ALL($1));
    `;
    const incomeRes = await query(incomeSql, [userAccountIds, startOfMonth, endOfMonth]);

    // Total Expenses in Month: (fromAccount in userAccountIds, and toAccount not in userAccountIds)
    const expenseSql = `
      SELECT COALESCE(SUM(amount), 0)::numeric AS total
      FROM transactions
      WHERE from_account_id = ANY($1)
        AND status = 'COMPLETED'
        AND type != 'DEPOSIT'
        AND created_at >= $2 AND created_at <= $3
        AND to_account_id != ALL($1);
    `;
    const expenseRes = await query(expenseSql, [userAccountIds, startOfMonth, endOfMonth]);

    const totalIncome = parseFloat(incomeRes.rows[0]?.total || 0);
    const totalExpenses = parseFloat(expenseRes.rows[0]?.total || 0);
    const netSavings = totalIncome - totalExpenses;

    res.status(200).json({
      success: true,
      period: { month, year },
      cashflow: {
        income: totalIncome,
        expenses: totalExpenses,
        netSavings,
        savingsRate: totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
