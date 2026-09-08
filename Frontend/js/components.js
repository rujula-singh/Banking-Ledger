/**
 * Nexus Ledger - UI Components & Render Helpers
 */

export function formatINR(val) {
  const num = Number(val) || 0;
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function formatDateTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `<strong>${icon}</strong> <span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/**
 * Render Multi-Account Cards (Section 2 & 12)
 */
export function renderAccountCards(accounts, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!accounts || accounts.length === 0) {
    container.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 2.5rem;">
        <p style="color: var(--text-muted); margin-bottom: 1rem;">No bank accounts found.</p>
        <button class="btn btn-primary btn-sm" id="btn-empty-create-acc">Create Your First Account</button>
      </div>
    `;
    return;
  }

  container.innerHTML = accounts
    .map((acc) => {
      const isChecking = acc.accountType === 'CHECKING';
      const cardClass = isChecking ? 'checking' : 'savings';
      const typeLabel = isChecking ? 'Checking' : 'Savings';
      const masked = acc.accountNumber
        ? `•••• ${acc.accountNumber.slice(-4)}`
        : `•••• ${String(acc._id).slice(-4)}`;

      return `
        <div class="account-card ${cardClass}" data-account-id="${acc._id}">
          <div class="acc-card-header">
            <span class="acc-type-pill ${cardClass}">${typeLabel}</span>
            <span class="acc-number-mask">${masked}</span>
          </div>

          <div class="acc-name">${acc.name || (isChecking ? 'Checking Account' : 'Savings Account')}</div>

          <div class="acc-balance-row">
            <span class="acc-currency">₹</span>
            <span class="acc-balance">${formatINR(acc.balance)}</span>
          </div>

          <div class="acc-actions">
            <button class="acc-btn btn-acc-send" data-id="${acc._id}" title="Send from this account">Send</button>
            <button class="acc-btn btn-acc-deposit" data-id="${acc._id}" title="Add money to this account">Deposit</button>
            <button class="acc-btn btn-acc-stmt" data-id="${acc._id}" title="View account statement">Statement</button>
          </div>
        </div>
      `;
    })
    .join('');
}

/**
 * Render Dashboard Recent Transactions
 */
export function renderRecentTransactions(transactions, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!transactions || transactions.length === 0) {
    container.innerHTML = `
      <div style="padding: 2.5rem; text-align: center; color: var(--text-muted);">
        No recent transactions found. Try sending money or making a deposit!
      </div>
    `;
    return;
  }

  container.innerHTML = transactions
    .slice(0, 6)
    .map((tx) => {
      const isIncome = tx.userDirection === 'INCOME';
      const isTransfer = tx.userDirection === 'TRANSFER';
      const arrowIcon = isIncome ? '↑' : isTransfer ? '⇄' : '↓';
      const badgeClass = isIncome ? 'income' : isTransfer ? 'transfer' : 'expense';
      const sign = isIncome ? '+' : '-';

      return `
        <div class="tx-item" data-id="${tx._id}">
          <div class="tx-direction-badge ${badgeClass}">${arrowIcon}</div>
          <div class="tx-details">
            <div class="tx-title">${escapeHtml(tx.description || tx.category || 'Transfer')}</div>
            <div class="tx-sub">
              <span>${formatDate(tx.createdAt)}</span>
              <span>•</span>
              <span class="badge badge-neutral">${tx.category || 'General'}</span>
            </div>
          </div>
          <div class="tx-amount-col">
            <div class="tx-amount ${isIncome ? 'income' : 'expense'}">
              ${sign}₹${formatINR(tx.amount)}
            </div>
            <div class="tx-status-tag ${tx.status.toLowerCase()}">${tx.status}</div>
          </div>
        </div>
      `;
    })
    .join('');
}

/**
 * Render Full Transactions Table
 */
export function renderTransactionsTable(transactions, tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  if (!transactions || transactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center" style="padding: 3rem; color: var(--text-muted);">
          No transactions match your search or filter criteria.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = transactions
    .map((tx) => {
      const isIncome = tx.userDirection === 'INCOME';
      const isTransfer = tx.userDirection === 'TRANSFER';
      const sign = isIncome ? '+' : '-';
      const statusClass = tx.status === 'COMPLETED' ? 'completed' : tx.status === 'PROCESSING' ? 'processing' : 'failed';
      const accNumber = tx.fromAccount?.accountNumber
        ? `•••• ${tx.fromAccount.accountNumber.slice(-4)}`
        : 'Self';

      return `
        <tr data-id="${tx._id}">
          <td style="color: var(--text-muted); font-size: 0.8rem;">${formatDateTime(tx.createdAt)}</td>
          <td>
            <strong>${escapeHtml(tx.description || tx.category)}</strong>
            <div style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace;">${tx.transactionId || ''}</div>
          </td>
          <td><span class="badge badge-indigo">${tx.category || 'Other'}</span></td>
          <td style="font-family: monospace; font-size: 0.82rem; color: var(--text-secondary);">${accNumber}</td>
          <td><span class="badge badge-${statusClass === 'completed' ? 'success' : statusClass === 'processing' ? 'warning' : 'danger'}">${tx.status}</span></td>
          <td class="text-right" style="font-family: var(--font-heading); font-weight: 700; color: ${isIncome ? 'var(--emerald)' : 'var(--text-primary)'};">
            ${sign}₹${formatINR(tx.amount)}
          </td>
          <td class="text-right">
            <button class="btn btn-secondary btn-sm btn-view-receipt" data-id="${tx._id}" title="View Receipt">Receipt</button>
          </td>
        </tr>
      `;
    })
    .join('');
}

/**
 * Render Category Breakdown Progress Bars (Section 7)
 */
export function renderCategoryBreakdown(categories, totalSpend, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!categories || categories.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); padding: 1.5rem 0;">No spending recorded for this period.</p>`;
    return;
  }

  const colors = ['indigo', 'emerald', 'cyan', 'amber', 'rose'];

  container.innerHTML = categories
    .map((cat, idx) => {
      const pct = totalSpend > 0 ? Math.round((cat.amount / totalSpend) * 100) : 0;
      const color = colors[idx % colors.length];

      return `
        <div class="cat-bar-item">
          <div class="cat-bar-header">
            <span class="cat-name">${cat.category}</span>
            <span class="cat-amount">₹${formatINR(cat.amount)} <span style="font-size: 0.75rem; color: var(--text-muted);">(${pct}%)</span></span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${color}" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    })
    .join('');
}

/**
 * Render Budgets Tracking Bars with Threshold Alerts (Section 8)
 */
export function renderBudgetsList(budgets, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!budgets || budgets.length === 0) {
    container.innerHTML = `
      <div style="padding: 1.5rem 0; text-align: center; color: var(--text-muted);">
        <p>No monthly budgets configured yet.</p>
        <button class="btn btn-secondary btn-sm mt-sm" id="btn-empty-budget">Set Your First Budget</button>
      </div>
    `;
    return;
  }

  container.innerHTML = budgets
    .map((b) => {
      const pct = b.percentageUsed || 0;
      let color = 'emerald';
      if (pct >= 90) color = 'rose';
      else if (pct >= 75) color = 'amber';

      return `
        <div class="budget-bar-item" data-id="${b._id}">
          <div class="budget-bar-header">
            <span class="budget-name">${b.category}</span>
            <span class="budget-amount">
              ₹${formatINR(b.spent)} <span style="color: var(--text-muted); font-size: 0.8rem;">/ ₹${formatINR(b.monthlyLimit)}</span>
            </span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${color}" style="width: ${Math.min(pct, 100)}%;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="budget-alert-text ${pct >= 90 ? 'danger' : pct >= 80 ? 'warn' : ''}">
              ${b.alertMessage || `${pct}% of monthly limit used`}
            </span>
            <button class="text-btn btn-del-budget" data-id="${b._id}" title="Remove budget">Remove</button>
          </div>
        </div>
      `;
    })
    .join('');
}

/**
 * Render Statement Itemized Rows (Section 6)
 */
export function renderStatementRows(transactions, tbodyId) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  if (!transactions || transactions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-lg" style="color: var(--text-muted);">No transactions recorded in this statement period.</td></tr>`;
    return;
  }

  tbody.innerHTML = transactions
    .map((tx) => {
      const isCredit = tx.type === 'CREDIT';
      return `
        <tr>
          <td style="color: var(--text-muted);">${formatDate(tx.date)}</td>
          <td style="font-family: monospace; font-size: 0.8rem;">${tx.transactionId}</td>
          <td><strong>${escapeHtml(tx.description)}</strong></td>
          <td><span class="badge badge-neutral">${tx.category}</span></td>
          <td><span class="badge ${isCredit ? 'badge-success' : 'badge-neutral'}">${tx.type}</span></td>
          <td class="text-right" style="font-family: var(--font-heading); font-weight: 700; color: ${isCredit ? 'var(--emerald)' : 'var(--rose)'};">
            ${isCredit ? '+' : '-'}₹${formatINR(tx.amount)}
          </td>
          <td class="text-right" style="font-family: var(--font-heading); font-weight: 700;">
            ₹${formatINR(tx.runningBalance)}
          </td>
        </tr>
      `;
    })
    .join('');
}

/**
 * Render Active Sessions (Section 11)
 */
export function renderSessionsList(sessions, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!sessions || sessions.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted);">No active sessions found.</p>`;
    return;
  }

  container.innerHTML = sessions
    .map((s, idx) => {
      const isCurrent = idx === 0;
      return `
        <div class="session-item">
          <div class="session-info">
            <div class="session-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </div>
            <div>
              <div class="session-name">${escapeHtml(s.browser)} on ${escapeHtml(s.device)} ${isCurrent ? '<span class="badge badge-indigo">Current</span>' : ''}</div>
              <div class="session-meta">${escapeHtml(s.location || 'India')} • IP ${escapeHtml(s.ip || '127.0.0.1')} • Last active ${formatDateTime(s.lastActive)}</div>
            </div>
          </div>
          <div>
            <span class="badge badge-success">Authorized</span>
          </div>
        </div>
      `;
    })
    .join('');
}

/**
 * Render Notification Drawer Items
 */
export function renderNotifications(notifications, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!notifications || notifications.length === 0) {
    container.innerHTML = `<p class="empty-state" style="padding: 1rem; color: var(--text-muted); text-align: center;">No notifications yet.</p>`;
    return;
  }

  container.innerHTML = notifications
    .map((n) => {
      const unreadClass = n.isRead ? '' : 'unread';
      const icon = n.type === 'SUCCESS' ? '🟢' : n.type === 'WARNING' ? '⚠️' : 'ℹ️';

      return `
        <div class="notif-item ${unreadClass}" data-id="${n._id}">
          <div class="notif-icon">${icon}</div>
          <div class="notif-body">
            <h5>${escapeHtml(n.title)}</h5>
            <p>${escapeHtml(n.message)}</p>
            <span>${formatDateTime(n.createdAt)}</span>
          </div>
        </div>
      `;
    })
    .join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
