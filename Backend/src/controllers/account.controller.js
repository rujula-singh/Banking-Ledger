import accountModel from '../models/account.model.js';
import { generateMonthlyStatement, formatStatementCSV } from '../services/statement.service.js';

function generateAccountNumber() {
  const prefix = '4821';
  const randomPart = Math.floor(10000000 + Math.random() * 90000000).toString();
  return `${prefix}${randomPart}`;
}

/**
 * Create a new bank account (Savings / Checking)
 */
export async function createAccountController(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const { accountType = 'SAVINGS', name } = req.body;

    const validatedType = ['SAVINGS', 'CHECKING'].includes((accountType || '').toUpperCase())
      ? accountType.toUpperCase()
      : 'SAVINGS';

    const accountName = name || (validatedType === 'CHECKING' ? 'Checking Account' : 'Savings Account');
    const accountNumber = generateAccountNumber();

    const account = await accountModel.createAccount({
      userId,
      accountType: validatedType,
      accountNumber,
      name: accountName
    });

    res.status(201).json({
      success: true,
      account
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get all accounts of the logged-in user with calculated balances
 */
export async function getUserAccountController(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const accounts = await accountModel.findByUserId(userId);

    res.status(200).json({
      success: true,
      accounts
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get single account balance
 */
export async function getAccountBalanceController(req, res) {
  try {
    const { accountId } = req.params;
    const userId = req.user.id || req.user._id;

    const account = await accountModel.findById(accountId);

    if (!account || account.user !== userId) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    const balance = await accountModel.getAccountBalance(accountId);

    res.status(200).json({
      success: true,
      accountId: account.id,
      _id: account.id,
      accountNumber: account.accountNumber,
      maskedNumber: account.maskedNumber,
      balance
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get monthly statement for account (JSON or CSV)
 */
export async function getAccountStatementController(req, res) {
  try {
    const { accountId } = req.params;
    const userId = req.user.id || req.user._id;
    const now = new Date();
    const month = parseInt(req.query.month || (now.getMonth() + 1), 10);
    const year = parseInt(req.query.year || now.getFullYear(), 10);
    const format = (req.query.format || 'json').toLowerCase();

    const account = await accountModel.findById(accountId);

    if (!account || account.user !== userId) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    const statement = await generateMonthlyStatement(accountId, year, month);

    if (format === 'csv') {
      const csv = formatStatementCSV(statement, account);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="statement-${account.accountNumber || accountId}-${year}-${month}.csv"`
      );
      return res.send(csv);
    }

    res.status(200).json({
      success: true,
      statement,
      account
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
