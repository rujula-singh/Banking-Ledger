import ledgerModel from '../models/ledger.model.js';

/**
 * Generate monthly statement for an account using PostgreSQL ledger entries
 */
export async function generateMonthlyStatement(accountId, year, month) {
  const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  // 1. Calculate opening balance (all ledger entries strictly prior to startOfMonth)
  const openingBalance = await ledgerModel.getOpeningBalance(accountId, startOfMonth);

  // 2. Fetch all entries within the target month with transaction details
  const monthLedgerEntries = await ledgerModel.getMonthEntriesWithTransactions(
    accountId,
    startOfMonth,
    endOfMonth
  );

  let totalMoneyIn = 0;
  let totalMoneyOut = 0;
  let runningBalance = openingBalance;

  const transactions = monthLedgerEntries.map((entry) => {
    const isCredit = entry.type === 'CREDIT';
    const amount = parseFloat(entry.amount);

    if (isCredit) {
      totalMoneyIn += amount;
      runningBalance += amount;
    } else {
      totalMoneyOut += amount;
      runningBalance -= amount;
    }

    return {
      date: entry.txn_created_at || entry.created_at || new Date(),
      transactionId: entry.txn_code || `TXN-${String(entry.id).slice(-6).toUpperCase()}`,
      description: entry.txn_description || (isCredit ? 'Credit Transfer' : 'Debit Payment'),
      category: entry.txn_category || 'Other',
      type: entry.type,
      amount,
      runningBalance: parseFloat(runningBalance.toFixed(2))
    };
  });

  const closingBalance = parseFloat((openingBalance + totalMoneyIn - totalMoneyOut).toFixed(2));

  return {
    accountId,
    period: {
      month,
      year,
      monthName: new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' })
    },
    openingBalance: parseFloat(openingBalance.toFixed(2)),
    totalMoneyIn: parseFloat(totalMoneyIn.toFixed(2)),
    totalMoneyOut: parseFloat(totalMoneyOut.toFixed(2)),
    closingBalance,
    transactions
  };
}

/**
 * Format statement as CSV text for download
 */
export function formatStatementCSV(statementData, accountDetails) {
  const lines = [
    `Personal Banking Platform - Account Statement`,
    `Account Number,${accountDetails.accountNumber || accountDetails.id || accountDetails._id}`,
    `Account Type,${accountDetails.accountType || 'SAVINGS'}`,
    `Statement Period,${statementData.period.monthName} ${statementData.period.year}`,
    ``,
    `Summary`,
    `Opening Balance,₹${statementData.openingBalance.toFixed(2)}`,
    `Total Money In,₹${statementData.totalMoneyIn.toFixed(2)}`,
    `Total Money Out,₹${statementData.totalMoneyOut.toFixed(2)}`,
    `Closing Balance,₹${statementData.closingBalance.toFixed(2)}`,
    ``,
    `Transaction Date,Transaction ID,Description,Category,Type,Amount (INR),Running Balance (INR)`
  ];

  statementData.transactions.forEach((tx) => {
    const dateFormatted = new Date(tx.date).toISOString().replace('T', ' ').substring(0, 19);
    const desc = `"${(tx.description || '').replace(/"/g, '""')}"`;
    lines.push(
      `${dateFormatted},${tx.transactionId},${desc},${tx.category},${tx.type},${tx.amount},${tx.runningBalance}`
    );
  });

  return lines.join('\n');
}
