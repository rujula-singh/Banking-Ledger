import budgetModel from '../models/budget.model.js';
import accountModel from '../models/account.model.js';

/**
 * Get budgets with real-time calculated spend for the current month
 */
export async function getBudgetsController(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const now = new Date();
    const month = parseInt(req.query.month || (now.getMonth() + 1), 10);
    const year = parseInt(req.query.year || now.getFullYear(), 10);

    const userAccounts = await accountModel.findByUserId(userId);
    const userAccountIds = userAccounts.map((a) => a.id);

    const budgets = await budgetModel.findBudgetsByUserAndPeriod(userId, month, year);

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    // Compute actual spending per category in this month
    const categorySpendAgg = await budgetModel.getCategorySpendingInMonth(
      userAccountIds,
      startOfMonth,
      endOfMonth
    );

    const spendMap = new Map(categorySpendAgg.map((c) => [c.category, c.spent]));

    const enrichedBudgets = budgets.map((b) => {
      const spent = spendMap.get(b.category) || 0;
      const remaining = Math.max(0, b.monthlyLimit - spent);
      const percentageUsed = Math.min(100, Math.round((spent / b.monthlyLimit) * 100));
      const isOverBudget = spent > b.monthlyLimit;
      const isWarning = percentageUsed >= 80;

      let alertMessage = null;
      if (isOverBudget) {
        alertMessage = `🚨 You've exceeded your ${b.category} budget by ₹${(spent - b.monthlyLimit).toLocaleString()}!`;
      } else if (isWarning) {
        alertMessage = `⚠️ You've used ${percentageUsed}% of your ${b.category} budget.`;
      }

      return {
        id: b.id,
        _id: b.id,
        category: b.category,
        monthlyLimit: b.monthlyLimit,
        spent,
        remaining,
        percentageUsed,
        isOverBudget,
        isWarning,
        alertMessage,
        periodMonth: b.periodMonth,
        periodYear: b.periodYear
      };
    });

    res.status(200).json({
      success: true,
      period: { month, year },
      budgets: enrichedBudgets
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Create or update category budget in PostgreSQL
 */
export async function setBudgetController(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const { category, monthlyLimit, month, year } = req.body;
    const now = new Date();
    const periodMonth = parseInt(month || (now.getMonth() + 1), 10);
    const periodYear = parseInt(year || now.getFullYear(), 10);

    if (!category || !monthlyLimit || Number(monthlyLimit) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid category and positive monthly limit are required.'
      });
    }

    const budget = await budgetModel.upsertBudget({
      userId,
      category,
      monthlyLimit: Number(monthlyLimit),
      periodMonth,
      periodYear
    });

    res.status(200).json({
      success: true,
      message: `${category} budget updated to ₹${Number(monthlyLimit).toLocaleString()}`,
      budget
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Delete a budget in PostgreSQL
 */
export async function deleteBudgetController(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;

    const deleted = await budgetModel.deleteBudget(id, userId);

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Budget not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Budget removed successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
