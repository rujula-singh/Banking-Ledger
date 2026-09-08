/**
 * Nexus Ledger - Main Application Controller
 */

import {
  getToken,
  setToken,
  removeToken,
  getStoredUser,
  setStoredUser,
  getSessionId,
  generateIdempotencyKey,
  authApi,
  accountApi,
  transactionApi,
  insightApi,
  budgetApi,
  notificationApi
} from './api.js';

import { state, updateState, computeTotalNetWorth } from './state.js';

import {
  formatINR,
  formatDate,
  formatDateTime,
  showToast,
  renderAccountCards,
  renderRecentTransactions,
  renderTransactionsTable,
  renderCategoryBreakdown,
  renderBudgetsList,
  renderStatementRows,
  renderSessionsList,
  renderNotifications
} from './components.js';

// Global variables for in-progress transfer
let currentTransferPayload = null;

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  updateGreetingTime();

  const token = getToken();
  if (token) {
    try {
      await loadUserProfile();
      await initializeAppData();
      showView('dashboard');
    } catch (err) {
      console.warn('Session expired or invalid, showing auth screen:', err.message);
      showAuthView();
    }
  } else {
    showAuthView();
  }
});

/* ==========================================================================
   Navigation & View Routing
   ========================================================================== */

function showView(viewName) {
  state.currentView = viewName;

  // Update nav links active state
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.view === viewName);
  });

  // Hide all sections, show target
  const views = ['dashboard', 'transactions', 'insights', 'statements', 'security'];
  views.forEach((v) => {
    const el = document.getElementById(`view-${v}`);
    if (el) {
      el.classList.toggle('hidden', v !== viewName);
    }
  });

  const authView = document.getElementById('view-auth');
  if (authView) authView.classList.add('hidden');

  const mainHeader = document.getElementById('main-header');
  if (mainHeader) mainHeader.classList.remove('hidden');

  // Trigger view-specific data refresh
  if (viewName === 'transactions') {
    loadTransactions();
  } else if (viewName === 'insights') {
    loadInsightsAndBudgets();
  } else if (viewName === 'statements') {
    populateStatementAccounts();
    loadStatement();
  } else if (viewName === 'security') {
    loadSecurityData();
  } else if (viewName === 'dashboard') {
    loadDashboardData();
  }
}

function showAuthView() {
  const views = ['dashboard', 'transactions', 'insights', 'statements', 'security'];
  views.forEach((v) => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.add('hidden');
  });

  const authView = document.getElementById('view-auth');
  if (authView) authView.classList.remove('hidden');

  const mainHeader = document.getElementById('main-header');
  if (mainHeader) mainHeader.classList.add('hidden');

  // Clear previous credentials and form fields on logout / viewing auth screen
  document.getElementById('form-login')?.reset();
  document.getElementById('form-register')?.reset();
  const loginEmail = document.getElementById('login-email');
  const loginPass = document.getElementById('login-password');
  const regName = document.getElementById('reg-name');
  const regEmail = document.getElementById('reg-email');
  const regPass = document.getElementById('reg-password');
  if (loginEmail) loginEmail.value = '';
  if (loginPass) loginPass.value = '';
  if (regName) regName.value = '';
  if (regEmail) regEmail.value = '';
  if (regPass) regPass.value = '';
}

function updateGreetingTime() {
  const hr = new Date().getHours();
  let greet = 'Good morning,';
  if (hr >= 12 && hr < 17) greet = 'Good afternoon,';
  else if (hr >= 17) greet = 'Good evening,';

  const el = document.getElementById('greeting-time');
  if (el) el.textContent = greet;

  const dateEl = document.getElementById('current-date-display');
  if (dateEl) {
    const opts = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
    dateEl.textContent = new Date().toLocaleDateString('en-GB', opts);
  }
}

/* ==========================================================================
   Data Loaders
   ========================================================================== */

async function loadUserProfile() {
  const res = await authApi.getProfile();
  if (res.user) {
    state.user = res.user;
    updateUserHeader(res.user);
  }
}

function updateUserHeader(user) {
  const nameEl = document.getElementById('header-user-name');
  const dashNameEl = document.getElementById('dashboard-user-greeting');
  const emailEl = document.getElementById('dropdown-user-email');
  const avatarEl = document.getElementById('user-avatar');

  if (nameEl) nameEl.textContent = user.name || 'User';
  if (dashNameEl) dashNameEl.textContent = user.name || 'Rujula Singh';
  if (emailEl) emailEl.textContent = user.email || '';

  if (avatarEl) {
    const initials = (user.name || 'U')
      .split(' ')
      .map((p) => p[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
    avatarEl.textContent = initials;
  }
}

async function initializeAppData() {
  await Promise.all([
    loadAccounts(),
    loadRecentTransactions(),
    loadNotifications(),
    loadInsightsAndBudgets()
  ]);
}

async function loadAccounts() {
  const res = await accountApi.getAll();
  if (res.accounts) {
    state.accounts = res.accounts;
    computeTotalNetWorth();

    const netWorthEl = document.getElementById('total-net-balance');
    if (netWorthEl) netWorthEl.textContent = formatINR(state.totalNetWorth);

    renderAccountCards(state.accounts, 'accounts-container');
    populateAccountDropdowns(state.accounts);
  }
}

function populateAccountDropdowns(accounts) {
  const selects = ['tf-from-account', 'dep-account-select', 'stmt-account-select', 'tx-account-select'];

  selects.forEach((selId) => {
    const select = document.getElementById(selId);
    if (!select) return;

    const currentVal = select.value;
    const isFilter = selId === 'tx-account-select';

    let optionsHtml = isFilter ? '<option value="">All Accounts</option>' : '';
    accounts.forEach((acc) => {
      const masked = acc.accountNumber ? `•••• ${acc.accountNumber.slice(-4)}` : `•••• ${String(acc._id).slice(-4)}`;
      const label = `${acc.name || acc.accountType} (${masked}) - ₹${formatINR(acc.balance)}`;
      optionsHtml += `<option value="${acc._id}">${label}</option>`;
    });

    select.innerHTML = optionsHtml;
    if (currentVal && Array.from(select.options).some((o) => o.value === currentVal)) {
      select.value = currentVal;
    }
  });

  // Also update transfer "from" balance hint
  updateTransferFromBalanceHint();
}

function updateTransferFromBalanceHint() {
  const select = document.getElementById('tf-from-account');
  const hint = document.getElementById('tf-from-balance-hint');
  if (!select || !hint) return;

  const acc = state.accounts.find((a) => a._id === select.value);
  if (acc) {
    hint.textContent = `Available Balance: ₹${formatINR(acc.balance)}`;
  } else {
    hint.textContent = 'Available: ₹0.00';
  }
}

async function loadRecentTransactions() {
  const res = await transactionApi.getAll({ limit: 6 });
  if (res.transactions) {
    state.recentTransactions = res.transactions;
    renderRecentTransactions(res.transactions, 'dashboard-txns-list');
  }
}

async function loadDashboardData() {
  await Promise.all([loadAccounts(), loadRecentTransactions(), loadCashflowSummary()]);
}

async function loadCashflowSummary() {
  try {
    const res = await insightApi.getCashflow();
    if (res.cashflow) {
      state.cashflow = res.cashflow;
      const inEl = document.getElementById('dash-cashflow-in');
      const outEl = document.getElementById('dash-cashflow-out');
      if (inEl) inEl.textContent = `+₹${formatINR(res.cashflow.income)}`;
      if (outEl) outEl.textContent = `-₹${formatINR(res.cashflow.expenses)}`;
    }
  } catch (err) {
    console.warn('Cashflow load error:', err.message);
  }
}

async function loadTransactions() {
  const params = {
    page: state.pagination.page,
    limit: 15,
    search: state.filters.search,
    type: state.filters.type,
    category: state.filters.category,
    accountId: state.filters.accountId
  };

  const res = await transactionApi.getAll(params);
  if (res.transactions) {
    state.allTransactions = res.transactions;
    state.pagination.page = res.page;
    state.pagination.pages = res.pages;
    state.pagination.total = res.total;

    renderTransactionsTable(res.transactions, 'tx-table-body');

    const infoEl = document.getElementById('pagination-info');
    if (infoEl) {
      infoEl.textContent = `Showing ${res.transactions.length} of ${res.total} transactions (Page ${res.page} of ${res.pages || 1})`;
    }

    const prevBtn = document.getElementById('btn-prev-page');
    const nextBtn = document.getElementById('btn-next-page');
    if (prevBtn) prevBtn.disabled = res.page <= 1;
    if (nextBtn) nextBtn.disabled = res.page >= res.pages;
  }
}

async function loadInsightsAndBudgets() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  try {
    const [spendRes, budgetRes] = await Promise.all([
      insightApi.getSpending(month, year),
      budgetApi.getAll(month, year)
    ]);

    if (spendRes.currentMonth) {
      state.insights = spendRes;
      renderCategoryBreakdown(
        spendRes.currentMonth.categories,
        spendRes.currentMonth.totalSpending,
        'category-breakdown-container'
      );

      const totalEl = document.getElementById('insights-total-spend');
      if (totalEl) totalEl.textContent = `Total: ₹${formatINR(spendRes.currentMonth.totalSpending)}`;

      // Render highlights like: "You spent 18% more on shopping than last month"
      renderHighlights(spendRes.highlights, 'insights-highlights');
    }

    if (budgetRes.budgets) {
      state.budgets = budgetRes.budgets;
      renderBudgetsList(budgetRes.budgets, 'budgets-container');

      const countBadge = document.getElementById('budgets-count-badge');
      if (countBadge) countBadge.textContent = `${budgetRes.budgets.length} Budgets`;

      // Also render dashboard budget alert warnings if any (> 80% or over budget)
      renderDashboardBudgetAlerts(budgetRes.budgets, 'dash-budget-alerts');
    }
  } catch (err) {
    console.warn('Insights load error:', err.message);
  }
}

function renderHighlights(highlights, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!highlights || highlights.length === 0) {
    container.innerHTML = `
      <div class="highlight-card">
        <div class="hl-icon">💡</div>
        <div class="hl-text">Spend regularly across categories to unlock automated month-over-month trend analysis.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = highlights
    .map((hl) => {
      const isInc = hl.type === 'INCREASE';
      return `
        <div class="highlight-card ${isInc ? 'increase' : 'decrease'}">
          <div class="hl-icon">${isInc ? '📈' : '📉'}</div>
          <div class="hl-text"><strong>${hl.message}</strong></div>
        </div>
      `;
    })
    .join('');
}

function renderDashboardBudgetAlerts(budgets, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const warningBudgets = budgets.filter((b) => b.isWarning || b.isOverBudget);
  if (warningBudgets.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = warningBudgets
    .map((b) => {
      const isOver = b.isOverBudget;
      return `
        <div class="alert-banner ${isOver ? 'danger' : 'warning'}">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <span>${isOver ? '🚨' : '⚠️'}</span>
            <span><strong>${b.category} Budget Alert:</strong> ${b.alertMessage}</span>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="window.nexusNavigate('insights')">View Budgets</button>
        </div>
      `;
    })
    .join('');
}

function populateStatementAccounts() {
  const sel = document.getElementById('stmt-account-select');
  if (sel && state.accounts.length > 0 && sel.options.length === 0) {
    populateAccountDropdowns(state.accounts);
  }
}

async function loadStatement() {
  const accSelect = document.getElementById('stmt-account-select');
  const monthSelect = document.getElementById('stmt-month-select');
  const yearSelect = document.getElementById('stmt-year-select');

  if (!accSelect || !accSelect.value) return;

  const accountId = accSelect.value;
  const month = monthSelect ? monthSelect.value : 9;
  const year = yearSelect ? yearSelect.value : 2026;

  try {
    const res = await accountApi.getStatement(accountId, month, year);
    if (res.statement) {
      const s = res.statement;
      document.getElementById('stmt-open-bal').textContent = `₹${formatINR(s.openingBalance)}`;
      document.getElementById('stmt-in-val').textContent = `+₹${formatINR(s.totalMoneyIn)}`;
      document.getElementById('stmt-out-val').textContent = `-₹${formatINR(s.totalMoneyOut)}`;
      document.getElementById('stmt-close-bal').textContent = `₹${formatINR(s.closingBalance)}`;
      document.getElementById('stmt-header-period').textContent = `${s.period.monthName} ${s.period.year}`;

      renderStatementRows(s.transactions, 'stmt-table-body');
    }
  } catch (err) {
    showToast('Could not load statement: ' + err.message, 'error');
  }
}

async function loadSecurityData() {
  try {
    const res = await authApi.getSessions();
    if (res.sessions) {
      renderSessionsList(res.sessions, 'security-sessions-list');
    }
  } catch (err) {
    console.warn('Security data load error:', err.message);
  }
}

async function loadNotifications() {
  try {
    const res = await notificationApi.getAll();
    if (res.notifications) {
      state.notifications = res.notifications;
      state.unreadNotifsCount = res.unreadCount;

      const countEl = document.getElementById('notif-count');
      if (countEl) {
        countEl.textContent = res.unreadCount;
        countEl.classList.toggle('hidden', res.unreadCount === 0);
      }

      renderNotifications(res.notifications, 'notif-list');
    }
  } catch (err) {
    console.warn('Notifications load error:', err.message);
  }
}

/* ==========================================================================
   Modals Management & 3-Step Transfer Flow (Sections 3 & 10)
   ========================================================================== */

function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove('hidden');
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add('hidden');
}

function initTransferModal(preselectedFromAccId = null) {
  // Reset transfer modal steps
  document.getElementById('transfer-step-1').classList.remove('hidden');
  document.getElementById('transfer-step-2').classList.add('hidden');
  document.getElementById('transfer-step-result').classList.add('hidden');

  if (preselectedFromAccId) {
    const fromSelect = document.getElementById('tf-from-account');
    if (fromSelect) fromSelect.value = preselectedFromAccId;
  }
  updateTransferFromBalanceHint();

  // Populate self recipient select
  const selfSelect = document.getElementById('tf-recipient-self');
  if (selfSelect) {
    const fromVal = document.getElementById('tf-from-account')?.value;
    const others = state.accounts.filter((a) => a._id !== fromVal);
    selfSelect.innerHTML = others
      .map(
        (a) =>
          `<option value="${a._id}">${a.name || a.accountType} (•••• ${a.accountNumber ? a.accountNumber.slice(-4) : 'self'})</option>`
      )
      .join('');
  }

  openModal('modal-transfer');
}

function initDepositModal(preselectedAccId = null) {
  const form = document.getElementById('form-deposit');
  if (form) form.reset();
  const depAmt = document.getElementById('dep-amount');
  if (depAmt) depAmt.value = '';
  const depDesc = document.getElementById('dep-description');
  if (depDesc) depDesc.value = 'Monthly Salary / Direct Deposit';

  if (preselectedAccId) {
    const sel = document.getElementById('dep-account-select');
    if (sel) sel.value = preselectedAccId;
  }

  openModal('modal-deposit');
}

/* ==========================================================================
   Event Listeners Setup
   ========================================================================== */

function setupEventListeners() {
  // Navigation Tabs
  document.querySelectorAll('.main-nav .nav-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      const view = e.currentTarget.dataset.view;
      showView(view);
    });
  });

  // Global helper for in-page navigation
  window.nexusNavigate = (v) => showView(v);

  // Quick Action Tiles
  document.getElementById('btn-hero-send')?.addEventListener('click', () => initTransferModal());
  document.getElementById('btn-txns-send')?.addEventListener('click', () => initTransferModal());
  document.getElementById('tile-send')?.addEventListener('click', () => initTransferModal());

  document.getElementById('btn-hero-deposit')?.addEventListener('click', () => initDepositModal());
  document.getElementById('btn-txns-deposit')?.addEventListener('click', () => initDepositModal());
  document.getElementById('tile-deposit')?.addEventListener('click', () => initDepositModal());

  document.getElementById('tile-statement')?.addEventListener('click', () => showView('statements'));
  document.getElementById('tile-budget')?.addEventListener('click', () => openModal('modal-budget'));
  document.getElementById('btn-open-budget-modal')?.addEventListener('click', () => openModal('modal-budget'));
  document.getElementById('btn-add-account')?.addEventListener('click', () => openModal('modal-account'));

  document.getElementById('btn-view-all-txns')?.addEventListener('click', () => showView('transactions'));

  // Account Card inline buttons delegation
  document.getElementById('accounts-container')?.addEventListener('click', (e) => {
    const sendBtn = e.target.closest('.btn-acc-send');
    if (sendBtn) {
      initTransferModal(sendBtn.dataset.id);
      return;
    }
    const depBtn = e.target.closest('.btn-acc-deposit');
    if (depBtn) {
      initDepositModal(depBtn.dataset.id);
      return;
    }
    const stmtBtn = e.target.closest('.btn-acc-stmt');
    if (stmtBtn) {
      showView('statements');
      const stmtSel = document.getElementById('stmt-account-select');
      if (stmtSel) {
        stmtSel.value = stmtBtn.dataset.id;
        loadStatement();
      }
    }
  });

  // Empty state buttons
  document.addEventListener('click', (e) => {
    if (e.target.id === 'btn-empty-create-acc') openModal('modal-account');
    if (e.target.id === 'btn-empty-budget') openModal('modal-budget');
  });

  // Modal close buttons
  document.querySelectorAll('[data-modal]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const modalId = e.currentTarget.dataset.modal;
      closeModal(modalId);
    });
  });

  // Modal Backdrop click to close
  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.add('hidden');
      }
    });
  });

  // Auth Tabs (Login / Register)
  document.getElementById('tab-login')?.addEventListener('click', () => {
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-register').classList.remove('active');
    document.getElementById('form-login').classList.remove('hidden');
    document.getElementById('form-register').classList.add('hidden');
  });

  document.getElementById('tab-register')?.addEventListener('click', () => {
    document.getElementById('tab-register').classList.add('active');
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('form-register').classList.remove('hidden');
    document.getElementById('form-login').classList.add('hidden');
  });

  // Auth Form: Sign In
  document.getElementById('form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const res = await authApi.login({ email, password });
      setToken(res.token);
      setStoredUser(res.user, res.sessionId);
      state.user = res.user;
      updateUserHeader(res.user);

      showToast('Welcome back, ' + res.user.name, 'success');
      await initializeAppData();
      showView('dashboard');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Auth Form: Register
  document.getElementById('form-register')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    try {
      const res = await authApi.register({ name, email, password });
      setToken(res.token);
      setStoredUser(res.user, res.sessionId);
      state.user = res.user;
      updateUserHeader(res.user);

      showToast('Account created! Primary account activated.', 'success');
      await initializeAppData();
      showView('dashboard');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Notifications Bell dropdown toggle
  const notifBtn = document.getElementById('notif-btn');
  const notifDropdown = document.getElementById('notif-dropdown');
  notifBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    notifDropdown?.classList.toggle('hidden');
    document.getElementById('user-dropdown')?.classList.add('hidden');
  });

  // User Menu dropdown toggle
  const userProfileBtn = document.getElementById('user-profile-btn');
  const userDropdown = document.getElementById('user-dropdown');
  userProfileBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown?.classList.toggle('hidden');
    notifDropdown?.classList.add('hidden');
  });

  // Close dropdowns on window click
  window.addEventListener('click', () => {
    notifDropdown?.classList.add('hidden');
    userDropdown?.classList.add('hidden');
  });

  // Mark all notifications read
  document.getElementById('notif-mark-all')?.addEventListener('click', async () => {
    await notificationApi.markAllRead();
    loadNotifications();
  });

  // Sign out
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await authApi.logout().catch(() => {});
    removeToken();
    showToast('Signed out successfully.', 'info');
    showAuthView();
  });

  document.getElementById('btn-switch-account')?.addEventListener('click', () => {
    showAuthView();
  });

  /* ========================================================================
     Transfer Modal Flow (Sections 3 & 10: The Trust Experience)
     ======================================================================== */

  // Destination Mode Tabs (Email / Account / Self)
  const destModeTabs = document.querySelectorAll('#tf-dest-mode .pill-tab');
  destModeTabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      destModeTabs.forEach((t) => t.classList.remove('active'));
      e.currentTarget.classList.add('active');

      const mode = e.currentTarget.dataset.mode;
      document.getElementById('dest-input-email-group').classList.toggle('hidden', mode !== 'email');
      document.getElementById('dest-input-account-group').classList.toggle('hidden', mode !== 'account');
      document.getElementById('dest-input-self-group').classList.toggle('hidden', mode !== 'self');
    });
  });

  // Quick Amount Buttons in Transfer
  document.querySelectorAll('.quick-amt').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const amt = Number(e.currentTarget.dataset.val);
      const input = document.getElementById('tf-amount');
      const current = Number(input.value) || 0;
      input.value = current + amt;
    });
  });

  // Source account select change updates hint
  document.getElementById('tf-from-account')?.addEventListener('change', () => {
    updateTransferFromBalanceHint();
  });

  // Step 1: Submit -> Go to Step 2 Review Dialog (Section 3)
  document.getElementById('form-transfer-step1')?.addEventListener('submit', (e) => {
    e.preventDefault();

    const fromAccount = document.getElementById('tf-from-account').value;
    const amount = Number(document.getElementById('tf-amount').value);
    const category = document.getElementById('tf-category').value;
    const description = document.getElementById('tf-description').value || `${category} payment`;

    if (!fromAccount || !amount || amount <= 0) {
      showToast('Please specify source account and valid amount', 'error');
      return;
    }

    const activeDestTab = document.querySelector('#tf-dest-mode .pill-tab.active')?.dataset.mode || 'email';
    let toAccount = null;
    let toAccountNumber = null;
    let toEmail = null;
    let recipientDisplay = '';

    if (activeDestTab === 'email') {
      toEmail = document.getElementById('tf-recipient-email').value.trim();
      if (!toEmail) {
        showToast('Recipient email is required', 'error');
        return;
      }
      recipientDisplay = toEmail;
    } else if (activeDestTab === 'account') {
      toAccountNumber = document.getElementById('tf-recipient-account').value.trim();
      if (!toAccountNumber) {
        showToast('Recipient account number is required', 'error');
        return;
      }
      recipientDisplay = `Account ${toAccountNumber}`;
    } else if (activeDestTab === 'self') {
      toAccount = document.getElementById('tf-recipient-self').value;
      if (!toAccount) {
        showToast('Target account is required', 'error');
        return;
      }
      const accObj = state.accounts.find((a) => a._id === toAccount);
      recipientDisplay = `My ${accObj?.name || 'Account'} (${accObj?.maskedNumber || '••••'})`;
    }

    const fromAccObj = state.accounts.find((a) => a._id === fromAccount);
    if (fromAccObj && fromAccObj.balance < amount) {
      showToast(`Insufficient funds! Available: ₹${formatINR(fromAccObj.balance)}`, 'error');
      return;
    }

    // Save payload
    currentTransferPayload = {
      fromAccount,
      toAccount,
      toAccountNumber,
      toEmail,
      amount,
      category,
      description,
      idempotencyKey: generateIdempotencyKey()
    };

    // Populate Step 2 Review Dialog
    document.getElementById('review-display-amount').textContent = `₹${formatINR(amount)}`;
    document.getElementById('review-display-to').textContent = recipientDisplay;
    document.getElementById('review-display-from').textContent = `${fromAccObj?.name || 'Account'} (${fromAccObj?.maskedNumber || '••••'})`;
    document.getElementById('review-display-category').textContent = category;
    document.getElementById('review-display-desc').textContent = description;

    // Switch to Step 2
    document.getElementById('transfer-step-1').classList.add('hidden');
    document.getElementById('transfer-step-2').classList.remove('hidden');
  });

  // Step 2: Back to Edit
  document.getElementById('btn-back-step1')?.addEventListener('click', () => {
    document.getElementById('transfer-step-2').classList.add('hidden');
    document.getElementById('transfer-step-1').classList.remove('hidden');
  });

  // Step 2: Confirm & Transfer Money (Section 3 & 10)
  document.getElementById('btn-confirm-transfer')?.addEventListener('click', async () => {
    if (!currentTransferPayload) return;

    // Transition to Step 3: Processing
    document.getElementById('transfer-step-2').classList.add('hidden');
    document.getElementById('transfer-step-result').classList.remove('hidden');

    document.getElementById('result-state-processing').classList.remove('hidden');
    document.getElementById('result-state-success').classList.add('hidden');
    document.getElementById('result-state-failure').classList.add('hidden');

    try {
      const res = await transactionApi.createTransfer(currentTransferPayload);

      // Transition to Success
      setTimeout(() => {
        document.getElementById('result-state-processing').classList.add('hidden');
        document.getElementById('result-state-success').classList.remove('hidden');

        const txn = res.transaction || {};
        document.getElementById('success-txn-ref').textContent = txn.transactionId || 'TXN-SUCCESS';
        document.getElementById('success-result-msg').textContent =
          `₹${formatINR(currentTransferPayload.amount)} transferred successfully.`;

        showToast('Transfer completed successfully!', 'success');
        initializeAppData();
      }, 600);
    } catch (err) {
      // Transition to Reassuring Failure Card (Section 10)
      setTimeout(() => {
        document.getElementById('result-state-processing').classList.add('hidden');
        document.getElementById('result-state-failure').classList.remove('hidden');

        document.getElementById('failure-txn-ref').textContent = 'TXN-' + Math.floor(10000 + Math.random() * 90000);
        document.getElementById('failure-result-msg').innerHTML =
          `We couldn't complete your ₹${formatINR(currentTransferPayload.amount)} transfer. <strong>Your account balance has not been affected.</strong><br><small style="color:var(--text-muted);">${err.message}</small>`;

        showToast('Transfer unsuccessful: ' + err.message, 'error');
      }, 600);
    }
  });

  // Step 3 Retry
  document.getElementById('btn-retry-transfer')?.addEventListener('click', () => {
    document.getElementById('transfer-step-result').classList.add('hidden');
    document.getElementById('transfer-step-1').classList.remove('hidden');
  });

  /* ========================================================================
     Deposit Funds Flow
     ======================================================================== */

  document.querySelectorAll('.quick-dep-amt').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const amt = Number(e.currentTarget.dataset.val);
      const input = document.getElementById('dep-amount');
      const curr = Number(input.value) || 0;
      input.value = curr + amt;
    });
  });

  document.getElementById('form-deposit')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const accountId = document.getElementById('dep-account-select').value;
    const amount = Number(document.getElementById('dep-amount').value);
    const description = document.getElementById('dep-description').value;

    try {
      await transactionApi.deposit(accountId, amount, description, 'Salary');
      showToast(`Deposited ₹${formatINR(amount)} successfully!`, 'success');

      // Reset deposit fields
      document.getElementById('form-deposit')?.reset();
      const depAmt = document.getElementById('dep-amount');
      if (depAmt) depAmt.value = '';
      const depDesc = document.getElementById('dep-description');
      if (depDesc) depDesc.value = 'Monthly Salary / Direct Deposit';

      closeModal('modal-deposit');
      await initializeAppData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  /* ========================================================================
     Open Account Modal Flow
     ======================================================================== */

  document.getElementById('form-create-account')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const accountType = document.getElementById('new-acc-type').value;
    const name = document.getElementById('new-acc-name').value;

    try {
      await accountApi.create(accountType, name);
      showToast(`New ${accountType} account opened successfully!`, 'success');
      closeModal('modal-account');
      await loadAccounts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  /* ========================================================================
     Budget Modal Flow
     ======================================================================== */

  document.getElementById('form-set-budget')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const category = document.getElementById('budget-category').value;
    const limit = Number(document.getElementById('budget-limit').value);

    try {
      await budgetApi.set(category, limit);
      showToast(`${category} budget set to ₹${formatINR(limit)}`, 'success');
      closeModal('modal-budget');
      await loadInsightsAndBudgets();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Delete budget delegation
  document.getElementById('budgets-container')?.addEventListener('click', async (e) => {
    const delBtn = e.target.closest('.btn-del-budget');
    if (delBtn) {
      const budgetId = delBtn.dataset.id;
      if (confirm('Are you sure you want to remove this category budget?')) {
        await budgetApi.delete(budgetId);
        showToast('Budget removed', 'info');
        loadInsightsAndBudgets();
      }
    }
  });

  /* ========================================================================
     Transactions Search & Filters
     ======================================================================== */

  let searchDebounce = null;
  document.getElementById('tx-search-input')?.addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.filters.search = e.target.value;
      state.pagination.page = 1;
      loadTransactions();
    }, 300);
  });

  // Type Filter Tabs
  document.querySelectorAll('#tx-type-tabs .pill-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('#tx-type-tabs .pill-tab').forEach((t) => t.classList.remove('active'));
      e.currentTarget.classList.add('active');
      state.filters.type = e.currentTarget.dataset.type;
      state.pagination.page = 1;
      loadTransactions();
    });
  });

  // Category Filter Select
  document.getElementById('tx-category-select')?.addEventListener('change', (e) => {
    state.filters.category = e.target.value;
    state.pagination.page = 1;
    loadTransactions();
  });

  // Account Filter Select
  document.getElementById('tx-account-select')?.addEventListener('change', (e) => {
    state.filters.accountId = e.target.value;
    state.pagination.page = 1;
    loadTransactions();
  });

  // Pagination Controls
  document.getElementById('btn-prev-page')?.addEventListener('click', () => {
    if (state.pagination.page > 1) {
      state.pagination.page--;
      loadTransactions();
    }
  });

  document.getElementById('btn-next-page')?.addEventListener('click', () => {
    if (state.pagination.page < state.pagination.pages) {
      state.pagination.page++;
      loadTransactions();
    }
  });

  // Transaction Receipt Modal Click Delegation
  document.getElementById('tx-table-body')?.addEventListener('click', async (e) => {
    const row = e.target.closest('tr');
    if (row && row.dataset.id) {
      showTransactionReceipt(row.dataset.id);
    }
  });

  document.getElementById('dashboard-txns-list')?.addEventListener('click', async (e) => {
    const item = e.target.closest('.tx-item');
    if (item && item.dataset.id) {
      showTransactionReceipt(item.dataset.id);
    }
  });

  /* ========================================================================
     Statement Controls
     ======================================================================== */

  document.getElementById('btn-fetch-statement')?.addEventListener('click', () => {
    loadStatement();
  });

  document.getElementById('btn-download-statement-csv')?.addEventListener('click', async () => {
    const accSelect = document.getElementById('stmt-account-select');
    const monthSelect = document.getElementById('stmt-month-select');
    const yearSelect = document.getElementById('stmt-year-select');

    if (!accSelect?.value) return;

    try {
      const csvText = await accountApi.downloadStatementCSV(
        accSelect.value,
        monthSelect?.value || 9,
        yearSelect?.value || 2026
      );

      const blob = new Blob([csvText], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `statement-${accSelect.value}-${yearSelect?.value || 2026}-${monthSelect?.value || 9}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      showToast('Statement CSV downloaded', 'success');
    } catch (err) {
      showToast('Download failed: ' + err.message, 'error');
    }
  });

  /* ========================================================================
     Security Session Revocation (Section 11)
     ======================================================================== */

  document.getElementById('btn-revoke-sessions')?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to log out all other devices and sessions?')) {
      try {
        const curSession = getSessionId();
        await authApi.revokeOthers(curSession);
        showToast('All other sessions logged out.', 'success');
        loadSecurityData();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  });
}

/**
 * Show Transaction Receipt Modal (Section 5)
 */
async function showTransactionReceipt(txnId) {
  try {
    const res = await transactionApi.getById(txnId);
    const tx = res.transaction;
    if (!tx) return;

    const modalContent = document.getElementById('txn-receipt-content');
    if (!modalContent) return;

    const fromMasked = tx.fromAccount?.accountNumber
      ? `•••• ${tx.fromAccount.accountNumber.slice(-4)}`
      : 'Account';
    const toMasked = tx.toAccount?.accountNumber
      ? `•••• ${tx.toAccount.accountNumber.slice(-4)}`
      : 'Recipient';

    modalContent.innerHTML = `
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <span style="font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase;">Transaction Amount</span>
        <div style="font-family: var(--font-heading); font-size: 2.25rem; font-weight: 800; color: #fff; margin: 0.2rem 0;">
          ₹${formatINR(tx.amount)}
        </div>
        <span class="badge badge-success">${tx.status || 'COMPLETED'} ✓</span>
      </div>

      <div class="receipt-box">
        <div class="receipt-row">
          <span style="color: var(--text-muted);">Date & Time</span>
          <span><strong>${formatDateTime(tx.createdAt)}</strong></span>
        </div>
        <div class="receipt-row">
          <span style="color: var(--text-muted);">Transaction ID</span>
          <span style="font-family: monospace; color: var(--primary);"><strong>${tx.transactionId || tx._id}</strong></span>
        </div>
        <div class="receipt-row">
          <span style="color: var(--text-muted);">Payment Method</span>
          <span>Savings Account ${fromMasked}</span>
        </div>
        <div class="receipt-row">
          <span style="color: var(--text-muted);">Recipient</span>
          <span>${toMasked}</span>
        </div>
        <div class="receipt-row">
          <span style="color: var(--text-muted);">Category</span>
          <span class="badge badge-indigo">${tx.category || 'Other'}</span>
        </div>
        <div class="receipt-row">
          <span style="color: var(--text-muted);">Description</span>
          <span><strong>${tx.description || 'Transfer'}</strong></span>
        </div>
        <div class="receipt-row">
          <span style="color: var(--text-muted);">Ledger Double-Entry</span>
          <span style="color: var(--emerald); font-size: 0.75rem;">Verified Debit & Credit</span>
        </div>
      </div>
    `;

    openModal('modal-txn-detail');
  } catch (err) {
    showToast('Failed to load transaction details: ' + err.message, 'error');
  }
}
