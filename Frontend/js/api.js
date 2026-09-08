/**
 * Nexus Ledger - API Client
 */

const API_BASE = window.location.port === '5173' ? 'http://localhost:3000/api' : '/api';

export function getToken() {
  return localStorage.getItem('nexus_token');
}

export function setToken(token) {
  localStorage.setItem('nexus_token', token);
}

export function removeToken() {
  localStorage.removeItem('nexus_token');
  localStorage.removeItem('nexus_user');
  localStorage.removeItem('nexus_session_id');
}

export function getStoredUser() {
  const u = localStorage.getItem('nexus_user');
  return u ? JSON.parse(u) : null;
}

export function setStoredUser(user, sessionId) {
  localStorage.setItem('nexus_user', JSON.stringify(user));
  if (sessionId) {
    localStorage.setItem('nexus_session_id', sessionId);
  }
}

export function getSessionId() {
  return localStorage.getItem('nexus_session_id') || 'SES-CURRENT';
}

export function generateIdempotencyKey() {
  return 'IDEM-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

export async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
    credentials: 'include'
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);

    // If downloading a file like CSV
    if (options.isBlob) {
      if (!response.ok) throw new Error('File download failed');
      return await response.blob();
    }

    const data = await response.json();

    if (!response.ok) {
      // If unauthorized, clear session
      if (response.status === 401 && !endpoint.includes('/auth/login')) {
        removeToken();
        window.dispatchEvent(new CustomEvent('nexus:auth-required'));
      }
      throw new Error(data.message || 'API request failed');
    }

    return data;
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error);
    throw error;
  }
}

/* Auth APIs */
export const authApi = {
  register: (body) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
  getProfile: () => apiRequest('/auth/me'),
  getSessions: () => apiRequest('/auth/sessions'),
  revokeOthers: (currentSessionId) =>
    apiRequest('/auth/sessions/revoke-others', {
      method: 'POST',
      body: JSON.stringify({ currentSessionId })
    })
};

/* Accounts APIs */
export const accountApi = {
  getAll: () => apiRequest('/accounts'),
  create: (accountType, name) =>
    apiRequest('/accounts', {
      method: 'POST',
      body: JSON.stringify({ accountType, name })
    }),
  getBalance: (accountId) => apiRequest(`/accounts/balance/${accountId}`),
  getStatement: (accountId, month, year) =>
    apiRequest(`/accounts/statement/${accountId}?month=${month}&year=${year}`),
  downloadStatementCSV: async (accountId, month, year) => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/accounts/statement/${accountId}?month=${month}&year=${year}&format=csv`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to download CSV');
    return await res.text();
  }
};

/* Transactions APIs */
export const transactionApi = {
  createTransfer: (payload) =>
    apiRequest('/transactions', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  deposit: (accountId, amount, description, category) =>
    apiRequest('/transactions/deposit', {
      method: 'POST',
      body: JSON.stringify({ accountId, amount, description, category })
    }),
  getAll: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/transactions?${query}`);
  },
  getById: (id) => apiRequest(`/transactions/${id}`)
};

/* Insights & Budgets APIs */
export const insightApi = {
  getSpending: (month, year) => apiRequest(`/insights/spending?month=${month}&year=${year}`),
  getCashflow: (month, year) => apiRequest(`/insights/cashflow?month=${month}&year=${year}`)
};

export const budgetApi = {
  getAll: (month, year) => apiRequest(`/budgets?month=${month}&year=${year}`),
  set: (category, monthlyLimit, month, year) =>
    apiRequest('/budgets', {
      method: 'POST',
      body: JSON.stringify({ category, monthlyLimit, month, year })
    }),
  delete: (id) => apiRequest(`/budgets/${id}`, { method: 'DELETE' })
};

/* Notifications APIs */
export const notificationApi = {
  getAll: () => apiRequest('/notifications'),
  markRead: (id) => apiRequest(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => apiRequest('/notifications/read-all', { method: 'POST' })
};
