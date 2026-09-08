import transactionModel from '../models/transaction.model.js';
import ledgerModel from '../models/ledger.model.js';
import accountModel from '../models/account.model.js';
import userModel from '../models/user.model.js';
import notificationModel from '../models/notification.model.js';
import { withTransaction } from '../config/db.js';
import * as emailService from '../services/email.service.js';

function generateTxnId() {
  const digits = Math.floor(10000 + Math.random() * 90000);
  return `TXN-${digits}`;
}

/**
 * Create a new transfer transaction using PostgreSQL ACID transaction
 */
export async function createTransaction(req, res) {
  const {
    fromAccount,
    toAccount,
    toAccountNumber,
    toEmail,
    amount,
    category = 'Transfer',
    description = 'Transfer',
    idempotencyKey
  } = req.body;

  const userId = req.user.id || req.user._id;
  const numAmount = Number(amount);

  if (!fromAccount || (!toAccount && !toAccountNumber && !toEmail) || !numAmount || !idempotencyKey) {
    return res.status(400).json({
      success: false,
      message: 'From account, recipient (account or email), amount and idempotency key are required.'
    });
  }

  if (numAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Amount must be greater than zero.'
    });
  }

  // 1. Idempotency check
  const existingTxn = await transactionModel.findByIdempotencyKey(idempotencyKey);
  if (existingTxn) {
    if (existingTxn.status === 'COMPLETED') {
      return res.status(200).json({
        success: true,
        message: 'Transaction already processed',
        transaction: existingTxn
      });
    }
    if (existingTxn.status === 'PENDING' || existingTxn.status === 'PROCESSING') {
      return res.status(200).json({
        success: true,
        message: 'Transaction is currently processing',
        transaction: existingTxn
      });
    }
    if (existingTxn.status === 'FAILED') {
      return res.status(400).json({
        success: false,
        message: 'Previous attempt failed. Please generate a new request.',
        transaction: existingTxn
      });
    }
  }

  // 2. Validate From Account
  const fromUserAccount = await accountModel.findById(fromAccount);

  if (!fromUserAccount || fromUserAccount.user !== userId) {
    return res.status(404).json({
      success: false,
      message: 'Source account not found or does not belong to you.'
    });
  }

  if (fromUserAccount.status !== 'ACTIVE') {
    return res.status(400).json({
      success: false,
      message: 'Source account is not active.'
    });
  }

  // 3. Resolve Destination Account
  let destAccount = null;
  if (toAccount) {
    destAccount = await accountModel.findById(toAccount);
  } else if (toAccountNumber) {
    destAccount = await accountModel.findByAccountNumber(toAccountNumber);
  } else if (toEmail) {
    const destUser = await userModel.findByEmail(toEmail);
    if (destUser) {
      const destAccounts = await accountModel.findByUserId(destUser.id);
      destAccount = destAccounts.find((a) => a.status === 'ACTIVE') || null;
    }
  }

  if (!destAccount) {
    return res.status(404).json({
      success: false,
      message: 'Recipient account could not be found. Please check details.'
    });
  }

  if (String(destAccount.id) === String(fromUserAccount.id)) {
    return res.status(400).json({
      success: false,
      message: 'Source and destination accounts cannot be identical.'
    });
  }

  if (destAccount.status !== 'ACTIVE') {
    return res.status(400).json({
      success: false,
      message: 'Recipient account is not active.'
    });
  }

  // 4. Check sender balance
  const currentBalance = await accountModel.getAccountBalance(fromUserAccount.id);
  if (currentBalance < numAmount) {
    return res.status(400).json({
      success: false,
      message: `Insufficient funds. Your current balance is ₹${currentBalance.toLocaleString()}, but ₹${numAmount.toLocaleString()} is required.`
    });
  }

  const txnRefId = generateTxnId();

  try {
    // 5. Execute transfer atomically inside a PostgreSQL Transaction
    const transaction = await withTransaction(async (client) => {
      // 5a. Create Transaction row
      const txn = await transactionModel.createTransaction(
        {
          fromAccountId: fromUserAccount.id,
          toAccountId: destAccount.id,
          amount: numAmount,
          idempotencyKey,
          category,
          description: description || `Transfer to ${destAccount.accountNumber || 'account'}`,
          type: 'TRANSFER',
          transactionId: txnRefId,
          status: 'PROCESSING',
          metadata: {
            fromAccountNumber: fromUserAccount.accountNumber,
            toAccountNumber: destAccount.accountNumber
          }
        },
        client
      );

      // 5b. Double-entry ledger: DEBIT sender
      await ledgerModel.createLedgerEntry(
        {
          accountId: fromUserAccount.id,
          transactionId: txn.id,
          amount: numAmount,
          type: 'DEBIT'
        },
        client
      );

      // 5c. Double-entry ledger: CREDIT recipient
      await ledgerModel.createLedgerEntry(
        {
          accountId: destAccount.id,
          transactionId: txn.id,
          amount: numAmount,
          type: 'CREDIT'
        },
        client
      );

      // 5d. Mark transaction COMPLETED
      const completedTxn = await transactionModel.updateTransactionStatus(
        txn.id,
        'COMPLETED',
        null,
        client
      );

      return completedTxn;
    });

    // 6. Post-transaction notifications & email (async non-blocking)
    (async () => {
      try {
        await notificationModel.createNotification({
          userId,
          title: 'Transfer Successful',
          message: `₹${numAmount.toLocaleString()} sent to ${
            destAccount.accountNumber ? '•••• ' + destAccount.accountNumber.slice(-4) : 'recipient'
          } successfully.`,
          type: 'SUCCESS',
          data: { transactionId: txnRefId, amount: numAmount }
        });

        // Recipient notification
        await notificationModel.createNotification({
          userId: destAccount.user,
          title: 'Funds Received',
          message: `You received ₹${numAmount.toLocaleString()} from ${req.user.name || 'a sender'}.`,
          type: 'SUCCESS',
          data: { transactionId: txnRefId, amount: numAmount }
        });

        await emailService.sendTransactionEmail(
          req.user.email,
          req.user.name,
          numAmount,
          destAccount.accountNumber || destAccount.id
        );
      } catch (err) {
        console.warn('Post-transaction notification failed:', err.message);
      }
    })();

    return res.status(201).json({
      success: true,
      message: 'Transfer completed successfully',
      transaction
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: `We couldn't complete your ₹${numAmount.toLocaleString()} transfer. Your account balance has not been affected.`,
      transactionId: txnRefId,
      error: error.message
    });
  }
}

/**
 * Deposit funds / Add Money simulation
 */
export async function depositFunds(req, res) {
  const { accountId, amount, description = 'Account Deposit', category = 'Salary' } = req.body;
  const userId = req.user.id || req.user._id;
  const numAmount = Number(amount);

  if (!accountId || !numAmount || numAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid account ID and positive amount are required.'
    });
  }

  const account = await accountModel.findById(accountId);

  if (!account || account.user !== userId) {
    return res.status(404).json({ success: false, message: 'Account not found.' });
  }

  const txnRefId = generateTxnId();
  const idempotencyKey = `DEP-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  try {
    const transaction = await withTransaction(async (client) => {
      // Create deposit transaction
      const txn = await transactionModel.createTransaction(
        {
          fromAccountId: account.id,
          toAccountId: account.id,
          amount: numAmount,
          idempotencyKey,
          category,
          description,
          type: 'DEPOSIT',
          transactionId: txnRefId,
          status: 'COMPLETED'
        },
        client
      );

      // Ledger entry: CREDIT to user account
      await ledgerModel.createLedgerEntry(
        {
          accountId: account.id,
          transactionId: txn.id,
          amount: numAmount,
          type: 'CREDIT'
        },
        client
      );

      return txn;
    });

    // Create notification
    await notificationModel.createNotification({
      userId,
      title: 'Funds Added',
      message: `₹${numAmount.toLocaleString()} deposited to ${account.name || 'account'} successfully.`,
      type: 'SUCCESS'
    });

    const newBalance = await accountModel.getAccountBalance(account.id);

    return res.status(201).json({
      success: true,
      message: `₹${numAmount.toLocaleString()} deposited successfully.`,
      transaction,
      newBalance
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Deposit failed: ' + error.message
    });
  }
}

/**
 * Get searchable and filterable transaction history
 */
export async function getTransactionsController(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const {
      search,
      category,
      type, // ALL | INCOME | EXPENSE | TRANSFERS
      month,
      year,
      page = 1,
      limit = 20,
      accountId
    } = req.query;

    const userAccounts = await accountModel.findByUserId(userId);
    const userAccountIds = userAccounts.map((a) => a.id);

    if (userAccountIds.length === 0) {
      return res.status(200).json({
        success: true,
        transactions: [],
        total: 0,
        page: 1,
        pages: 0
      });
    }

    let startDate = null;
    let endDate = null;
    if (month && year) {
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59, 999);
    }

    const pageNum = parseInt(page, 10);
    const take = parseInt(limit, 10);
    const offset = (pageNum - 1) * take;

    const [transactions, totalCount] = await Promise.all([
      transactionModel.findTransactions({
        userAccountIds,
        search,
        category,
        startDate,
        endDate,
        accountId,
        limit: take,
        offset
      }),
      transactionModel.countTransactions({
        userAccountIds,
        search,
        category,
        startDate,
        endDate,
        accountId
      })
    ]);

    // Format for user perspective: is it Income (+), Expense (-), or Internal Transfer?
    const formattedTxns = transactions.map((t) => {
      const fromId = t.fromAccount?.id || t.fromAccount?._id;
      const toId = t.toAccount?.id || t.toAccount?._id;

      const isFromUser = userAccountIds.some((id) => id === fromId);
      const isToUser = userAccountIds.some((id) => id === toId);

      let userDirection = 'EXPENSE';
      if (t.type === 'DEPOSIT') {
        userDirection = 'INCOME';
      } else if (isFromUser && isToUser) {
        userDirection = 'TRANSFER';
      } else if (isToUser && !isFromUser) {
        userDirection = 'INCOME';
      } else {
        userDirection = 'EXPENSE';
      }

      return {
        ...t,
        userDirection,
        formattedAmount: `${userDirection === 'INCOME' ? '+' : '-'}₹${t.amount.toLocaleString()}`,
        statusBadge: t.status === 'COMPLETED' ? 'COMPLETED' : t.status === 'PROCESSING' ? 'PROCESSING' : 'FAILED'
      };
    });

    // Optional post-filter for type tabs: INCOME, EXPENSE, TRANSFERS
    let filteredResults = formattedTxns;
    if (type && type.toUpperCase() !== 'ALL') {
      const targetType = type.toUpperCase();
      filteredResults = formattedTxns.filter((t) => {
        if (targetType === 'INCOME') return t.userDirection === 'INCOME';
        if (targetType === 'EXPENSE') return t.userDirection === 'EXPENSE';
        if (targetType === 'TRANSFERS') return t.userDirection === 'TRANSFER';
        return true;
      });
    }

    res.status(200).json({
      success: true,
      transactions: filteredResults,
      total: totalCount,
      page: pageNum,
      pages: Math.ceil(totalCount / take)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get transaction receipt details by ID
 */
export async function getTransactionByIdController(req, res) {
  try {
    const { id } = req.params;
    const transaction = await transactionModel.findById(id);

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    res.status(200).json({
      success: true,
      transaction
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * System endpoint for initial seed funds
 */
export async function createInitialFundsTransaction(req, res) {
  const { toAccount, amount, idempotencyKey } = req.body;
  const userId = req.user.id || req.user._id;
  const numAmount = Number(amount);

  if (!toAccount || !numAmount || !idempotencyKey) {
    return res.status(400).json({
      message: 'toAccount, amount and idempotencyKey are required'
    });
  }

  const toUserAccount = await accountModel.findById(toAccount);
  if (!toUserAccount) {
    return res.status(400).json({ message: 'Invalid toAccount' });
  }

  const fromAccounts = await accountModel.findByUserId(userId);
  const fromUserAccount = fromAccounts[0];
  if (!fromUserAccount) {
    return res.status(400).json({ message: 'System user account not found' });
  }

  try {
    const transaction = await withTransaction(async (client) => {
      const txn = await transactionModel.createTransaction(
        {
          fromAccountId: fromUserAccount.id,
          toAccountId: toUserAccount.id,
          amount: numAmount,
          idempotencyKey,
          status: 'COMPLETED',
          type: 'DEPOSIT',
          category: 'Salary',
          description: 'Initial Seed Funds',
          transactionId: generateTxnId()
        },
        client
      );

      await ledgerModel.createLedgerEntry(
        {
          accountId: fromUserAccount.id,
          transactionId: txn.id,
          amount: numAmount,
          type: 'DEBIT'
        },
        client
      );

      await ledgerModel.createLedgerEntry(
        {
          accountId: toUserAccount.id,
          transactionId: txn.id,
          amount: numAmount,
          type: 'CREDIT'
        },
        client
      );

      return txn;
    });

    return res.status(201).json({
      message: 'Initial funds transaction completed successfully',
      transaction
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}