import { backend } from './backend.js';

function buildQuery(table, params = {}) {
  const query = new URLSearchParams(params);
  return `${table}?${query.toString()}`;
}

async function insert(table, payload, { returning = true } = {}) {
  const result = await backend.rest(table, {
    method: 'POST',
    body: payload,
    headers: { Prefer: returning ? 'return=representation' : 'return=minimal' },
  });
  if (!returning) return null;
  return Array.isArray(result) ? result[0] || null : result;
}

async function insertMany(table, payload) {
  return backend.rest(table, {
    method: 'POST',
    body: payload,
    headers: { Prefer: 'return=representation' },
  });
}

async function update(table, id, patch) {
  const rows = await backend.rest(buildQuery(table, { id: `eq.${id}` }), {
    method: 'PATCH',
    body: patch,
    headers: { Prefer: 'return=representation' },
  });
  return rows?.[0] || null;
}

async function remove(table, id) {
  await backend.rest(buildQuery(table, { id: `eq.${id}` }), {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
}

async function listByHousehold(table, householdId, { select = '*', order = 'created_at.desc', limit = 500, extra = {} } = {}) {
  return backend.rest(buildQuery(table, {
    select,
    household_id: `eq.${householdId}`,
    order,
    limit: String(limit),
    ...extra,
  }));
}

export const financeApi = Object.freeze({
  async getProfile(userId) {
    const rows = await backend.rest(buildQuery('profiles', { select: '*', user_id: `eq.${userId}`, limit: '1' }));
    return rows?.[0] || null;
  },

  async updateProfile(userId, patch) {
    const rows = await backend.rest(buildQuery('profiles', { user_id: `eq.${userId}` }), {
      method: 'PATCH',
      body: patch,
      headers: { Prefer: 'return=representation' },
    });
    return rows?.[0] || null;
  },

  async getAdminRole(userId) {
    const rows = await backend.rest(buildQuery('app_admins', { select: 'role', user_id: `eq.${userId}`, limit: '1' }));
    return rows?.[0]?.role || null;
  },

  listProductModules() {
    return backend.rest(buildQuery('product_modules', { select: '*', order: 'sort_order.asc' }));
  },

  async listUserModules(userId) {
    const rows = await backend.rest(buildQuery('user_module_access', {
      select: 'module_key,enabled',
      user_id: `eq.${userId}`,
    }));
    return Object.fromEntries((rows || []).map((row) => [row.module_key, Boolean(row.enabled)]));
  },

  listHouseholds() {
    return backend.rest(buildQuery('households', { select: '*', order: 'created_at.asc' }));
  },

  async createHousehold({ name, countryCode, baseCurrency, ownerUserId }) {
    return insert('households', {
      name,
      owner_user_id: ownerUserId,
      country_code: countryCode,
      base_currency: baseCurrency,
    });
  },
  updateHousehold: (id, patch) => update('households', id, patch),
  getFxRates: () => backend.fxRates(),

  async listHouseholdMembers(householdId) {
    const result = await backend.householdMembers({ action: 'list', householdId });
    return result?.members || [];
  },

  addHouseholdMember(householdId, email, role) {
    return backend.householdMembers({ action: 'add', householdId, email, role });
  },

  removeHouseholdMember(householdId, userId) {
    return backend.householdMembers({ action: 'remove', householdId, userId });
  },

  listAccounts(householdId) {
    return backend.rest(buildQuery('account_balances', {
      select: '*',
      household_id: `eq.${householdId}`,
      is_archived: 'eq.false',
      order: 'sort_order.asc,name.asc',
    }));
  },
  createAccount: (payload) => insert('accounts', payload),
  updateAccount: (id, patch) => update('accounts', id, patch),
  deleteAccount: (id) => remove('accounts', id),

  listCategories(householdId) {
    return listByHousehold('categories', householdId, { order: 'kind.asc,sort_order.asc,name.asc', extra: { is_archived: 'eq.false' } });
  },
  createCategory: (payload) => insert('categories', payload),
  updateCategory: (id, patch) => update('categories', id, patch),
  deleteCategory: (id) => remove('categories', id),

  listCategorizationRules(householdId) {
    return listByHousehold('categorization_rules', householdId, {
      select: '*,categories(name,kind)',
      order: 'priority.asc,created_at.asc',
    });
  },
  createCategorizationRule: (payload) => insert('categorization_rules', payload),
  deleteCategorizationRule: (id) => remove('categorization_rules', id),

  listTransactions(householdId, limit = 500) {
    return listByHousehold('transactions', householdId, {
      select: 'id,household_id,account_id,category_id,merchant_id,import_batch_id,occurred_at,amount,currency,description,counterparty,note,status,source,transfer_group_id,external_reference,tax_relevant,tax_category,accounts(name),categories(name,kind),merchants(name,normalized_key,default_category_id)',
      order: 'occurred_at.desc,created_at.desc',
      limit,
    });
  },
  createTransaction: (payload) => insert('transactions', payload),
  createTransactions: (payload) => insertMany('transactions', payload),
  async importTransactions(payload) {
    const rows = await backend.rest(buildQuery('transactions', { on_conflict: 'household_id,external_reference' }), {
      method: 'POST',
      body: payload,
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    });
    return rows || [];
  },
  updateTransaction: (id, patch) => update('transactions', id, patch),
  deleteTransaction: (id) => remove('transactions', id),
  createTransfer: (payload) => backend.rpc('create_transfer_v2', payload),
  deleteTransfer: (householdId, transferGroupId) => backend.rpc('delete_transfer_v2', { p_household_id: householdId, p_transfer_group_id: transferGroupId }),
  convertTransactionToTransfer: ({ householdId, transactionId, toAccountId, toAmount = null, description = null }) => backend.rpc('convert_transaction_to_transfer', { p_household_id: householdId, p_transaction_id: transactionId, p_to_account_id: toAccountId, p_to_amount: toAmount, p_description: description }),

  listImportBatches(householdId) {
    return listByHousehold('import_batches', householdId, { select: '*,accounts(name,currency)', order: 'created_at.desc', limit: 100 });
  },
  createImportBatch: (payload) => insert('import_batches', payload),
  updateImportBatch: (id, patch) => update('import_batches', id, patch),

  listMerchants(householdId) {
    return listByHousehold('merchants', householdId, { select: '*', order: 'name.asc', limit: 1000 });
  },
  async upsertMerchant(payload) {
    const rows = await backend.rest(buildQuery('merchants', { on_conflict: 'household_id,normalized_key' }), {
      method: 'POST',
      body: payload,
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    });
    return rows?.[0] || null;
  },
  updateMerchant: (id, patch) => update('merchants', id, { ...patch, updated_at: new Date().toISOString() }),

  listRecurringRules(householdId) {
    return listByHousehold('recurring_rules', householdId, {
      select: '*,accounts(name),categories(name,kind)',
      order: 'next_date.asc,created_at.asc',
    });
  },
  createRecurringRule: (payload) => insert('recurring_rules', payload),
  updateRecurringRule: (id, patch) => update('recurring_rules', id, patch),
  deleteRecurringRule: (id) => remove('recurring_rules', id),

  listBudgets(householdId) {
    return listByHousehold('budgets', householdId, {
      select: '*,categories(name,kind),merchants(name)',
      order: 'month_start.desc,created_at.asc',
    });
  },
  async upsertBudget(payload) {
    const scope = payload.merchant_id
      ? { merchant_id: `eq.${payload.merchant_id}`, category_id: 'is.null' }
      : { category_id: `eq.${payload.category_id}`, merchant_id: 'is.null' };
    const existing = await backend.rest(buildQuery('budgets', {
      select: 'id', household_id: `eq.${payload.household_id}`, month_start: `eq.${payload.month_start}`, ...scope, limit: '1',
    }));
    if (existing?.[0]?.id) return update('budgets', existing[0].id, payload);
    return insert('budgets', payload);
  },
  deleteBudget: (id) => remove('budgets', id),

  listBills(householdId) {
    return listByHousehold('bills', householdId, {
      select: '*,accounts(name),categories(name,kind)',
      order: 'due_date.asc,created_at.asc',
    });
  },
  createBill: (payload) => insert('bills', payload),
  updateBill: (id, patch) => update('bills', id, patch),
  deleteBill: (id) => remove('bills', id),

  listContracts(householdId) {
    return listByHousehold('contracts', householdId, {
      select: '*,categories(name,kind),accounts(name,currency)',
      order: 'next_payment_date.asc.nullslast,created_at.desc',
    });
  },
  createContract: (payload) => insert('contracts', payload),
  updateContract: (id, patch) => update('contracts', id, patch),
  deleteContract: (id) => remove('contracts', id),

  listGoals(householdId) { return listByHousehold('savings_goals', householdId, { order: 'status.asc,target_date.asc.nullslast,created_at.desc' }); },
  createGoal: (payload) => insert('savings_goals', payload),
  updateGoal: (id, patch) => update('savings_goals', id, patch),
  deleteGoal: (id) => remove('savings_goals', id),

  listDebts(householdId) { return listByHousehold('debts', householdId, { order: 'status.asc,next_payment_date.asc.nullslast,created_at.desc' }); },
  createDebt: (payload) => insert('debts', payload),
  updateDebt: (id, patch) => update('debts', id, patch),
  deleteDebt: (id) => remove('debts', id),

  listLegalCases(householdId) { return listByHousehold('legal_cases', householdId, { order: 'status.asc,next_action_date.asc.nullslast,created_at.desc' }); },
  createLegalCase: (payload) => insert('legal_cases', payload),
  updateLegalCase: (id, patch) => update('legal_cases', id, patch),
  deleteLegalCase: (id) => remove('legal_cases', id),
  listLegalEvents(householdId) { return listByHousehold('legal_case_events', householdId, { order: 'event_date.desc,created_at.desc' }); },
  createLegalEvent: (payload) => insert('legal_case_events', payload),
  deleteLegalEvent: (id) => remove('legal_case_events', id),

  listAssets(householdId) { return listByHousehold('assets', householdId, { order: 'created_at.desc' }); },
  createAsset: (payload) => insert('assets', payload),
  updateAsset: (id, patch) => update('assets', id, patch),
  deleteAsset: (id) => remove('assets', id),

  listProperties(householdId) { return listByHousehold('properties', householdId, { order: 'created_at.desc' }); },
  createProperty: (payload) => insert('properties', payload),
  updateProperty: (id, patch) => update('properties', id, patch),
  deleteProperty: (id) => remove('properties', id),

  listVehicles(householdId) { return listByHousehold('vehicles', householdId, { order: 'created_at.desc' }); },
  createVehicle: (payload) => insert('vehicles', payload),
  updateVehicle: (id, patch) => update('vehicles', id, patch),
  deleteVehicle: (id) => remove('vehicles', id),

  listInsurance(householdId) { return listByHousehold('insurance_policies', householdId, { select: '*,accounts(name,currency),categories(name,kind)', order: 'status.asc,next_payment_date.asc.nullslast,created_at.desc' }); },
  createInsurance: (payload) => insert('insurance_policies', payload),
  updateInsurance: (id, patch) => update('insurance_policies', id, patch),
  deleteInsurance: (id) => remove('insurance_policies', id),

  listInvestments(householdId) { return listByHousehold('investments', householdId, { order: 'created_at.desc' }); },
  createInvestment: (payload) => insert('investments', payload),
  updateInvestment: (id, patch) => update('investments', id, patch),
  deleteInvestment: (id) => remove('investments', id),
  listInvestmentTransactions(householdId) { return listByHousehold('investment_transactions', householdId, { order: 'trade_date.desc,created_at.desc', limit: 1000 }); },
  recordInvestmentTrade: (payload) => backend.rpc('record_investment_trade', payload),

  listPensions(householdId) { return listByHousehold('pension_accounts', householdId, { order: 'created_at.desc' }); },
  createPension: (payload) => insert('pension_accounts', payload),
  updatePension: (id, patch) => update('pension_accounts', id, patch),
  deletePension: (id) => remove('pension_accounts', id),

  listDocuments(householdId) { return listByHousehold('documents', householdId, { order: 'created_at.desc', limit: 200 }); },
  createDocument: (payload) => insert('documents', payload),
  updateDocument: (id, patch) => update('documents', id, patch),
  deleteDocument: async (document) => {
    if (document?.storage_path) await backend.storageDelete('finance-documents', [document.storage_path]);
    return remove('documents', document.id);
  },

  uploadDocument(householdId, file) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120);
    const path = `${householdId}/${crypto.randomUUID()}-${safeName}`;
    return backend.storageUpload('finance-documents', path, file).then(() => path);
  },
  downloadDocument: (path) => backend.storageDownload('finance-documents', path),
});
