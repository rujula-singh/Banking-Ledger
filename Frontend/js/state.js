/**
 * Nexus Ledger - Global Application State
 */

export const state = {
  user: null,
  sessionId: null,
  accounts: [],
  selectedAccountId: null,
  totalNetWorth: 0,
  recentTransactions: [],
  allTransactions: [],
  budgets: [],
  insights: null,
  cashflow: null,
  notifications: [],
  unreadNotifsCount: 0,
  currentView: 'dashboard',
  pagination: {
    page: 1,
    pages: 1,
    total: 0
  },
  filters: {
    search: '',
    type: 'ALL',
    category: 'All',
    accountId: ''
  }
};

export function updateState(partial) {
  Object.assign(state, partial);
  window.dispatchEvent(new CustomEvent('nexus:state-changed', { detail: partial }));
}

export function computeTotalNetWorth() {
  state.totalNetWorth = state.accounts.reduce((acc, curr) => acc + (curr.balance || 0), 0);
  return state.totalNetWorth;
}
