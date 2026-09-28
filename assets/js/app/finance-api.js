import { backend } from './backend.js';

function buildQuery(table, params = {}) {
  const query = new URLSearchParams(params);
  return `${table}?${query.toString()}`;
}

async function insert(table, payload) {
  const rows = await backend.rest(table, {
    method: 'POST',
    body: payload,
    headers: { Prefer: 'return=representation' },
  });
  return rows?.[0] || null;
}

export const financeApi = Object.freeze({

  async getAdminRole(userId) {
    const rows = await backend.rest(buildQuery('app_admins', {
      select: 'role',
      user_id: `eq.${userId}`,
      limit: '1',
    }));
    return rows?.[0]?.role || null;
  },
  async getProfile(userId) {
    const rows = await backend.rest(buildQuery('profiles', {
      select: '*',
      user_id: `eq.${userId}`,
      limit: '1',
    }));
    return rows?.[0] || null;
  },

  async updateProfile(userId, patch) {
    const rows = await backend.rest(buildQuery('profiles', {
      user_id: `eq.${userId}`,
    }), {
      method: 'PATCH',
      body: patch,
      headers: { Prefer: 'return=representation' },
    });
    return rows?.[0] || null;
  },

  async listHouseholds() {
    return backend.rest(buildQuery('households', {
      select: '*',
      order: 'created_at.asc',
    }));
  },

  async createHousehold({ name, countryCode, baseCurrency, ownerUserId }) {
    return insert('households', {
      name,
      owner_user_id: ownerUserId,
      country_code: countryCode,
      base_currency: baseCurrency,
    });
  },

  async listAccounts(householdId) {
    return backend.rest(buildQuery('account_balances', {
      select: '*',
      household_id: `eq.${householdId}`,
      is_archived: 'eq.false',
      order: 'sort_order.asc,name.asc',
    }));
  },

  async createAccount(payload) {
    return insert('accounts', payload);
  },

  async listCategories(householdId) {
    return backend.rest(buildQuery('categories', {
      select: '*',
      household_id: `eq.${householdId}`,
      is_archived: 'eq.false',
      order: 'kind.asc,sort_order.asc,name.asc',
    }));
  },

  async createCategory(payload) {
    return insert('categories', payload);
  },

  async listTransactions(householdId, limit = 100) {
    return backend.rest(buildQuery('transactions', {
      select: 'id,household_id,account_id,category_id,occurred_at,amount,currency,description,counterparty,note,status,source,accounts(name),categories(name,kind)',
      household_id: `eq.${householdId}`,
      order: 'occurred_at.desc',
      limit: String(limit),
    }));
  },

  async createTransaction(payload) {
    return insert('transactions', payload);
  },
});
