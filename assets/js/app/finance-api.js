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
  return backend.rest(table, { method: 'POST', body: payload, headers: { Prefer: 'return=representation' } });
}

async function update(table, id, patch) {
  const rows = await backend.rest(buildQuery(table, { id: `eq.${id}` }), {
    method: 'PATCH', body: patch, headers: { Prefer: 'return=representation' },
  });
  return rows?.[0] || null;
}

async function remove(table, id) {
  await backend.rest(buildQuery(table, { id: `eq.${id}` }), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
}

async function listByHousehold(table, householdId, { select = '*', order = 'created_at.desc', limit = 500, extra = {} } = {}) {
  return backend.rest(buildQuery(table, { select, household_id: `eq.${householdId}`, order, limit: String(limit), ...extra }));
}

export const financeApi = Object.freeze({
  async getProfile(userId) { const rows = await backend.rest(buildQuery('profiles', { select: '*', user_id: `eq.${userId}`, limit: '1' })); return rows?.[0] || null; },
  async updateProfile(userId, patch) { const rows = await backend.rest(buildQuery('profiles', { user_id: `eq.${userId}` }), { method: 'PATCH', body: patch, headers: { Prefer: 'return=representation' } }); return rows?.[0] || null; },
  async getAdminRole(userId) { const rows = await backend.rest(buildQuery('app_admins', { select: 'role', user_id: `eq.${userId}`, limit: '1' })); return rows?.[0]?.role || null; },
  listProductModules() { return backend.rest(buildQuery('product_modules', { select: '*', order: 'sort_order.asc' })); },
  async listUserModules(userId) { const rows = await backend.rest(buildQuery('user_module_access', { select: 'module_key,enabled', user_id: `eq.${userId}` })); return Object.fromEntries((rows || []).map((row) => [row.module_key, Boolean(row.enabled)])); },
  listHouseholds() { return backend.rest(buildQuery('households', { select: '*', order: 'created_at.asc' })); },
  listMasterDataHouseholds: () => backend.rpc('list_master_data_households', {}),
  listCountryCategoryCatalog(countryCode) { return backend.rest(buildQuery('country_category_catalog', { select: '*', country_code: `eq.${countryCode}`, active: 'eq.true', order: 'kind.asc,sort_order.asc,name.asc' })); },
  listCountryMerchantCatalog(countryCode) { return backend.rest(buildQuery('country_merchant_catalog', { select: '*,country_category_catalog(name,kind,normalized_key)', country_code: `eq.${countryCode}`, active: 'eq.true', order: 'name.asc' })); },
  installCountryMasterData: (householdId) => backend.rpc('install_country_master_data', { p_household_id: householdId }),
  copyHouseholdMasterData: (sourceHouseholdId,targetHouseholdId) => backend.rpc('copy_household_master_data', { p_source_household_id: sourceHouseholdId, p_target_household_id: targetHouseholdId }),
  promoteMerchantToCountryCatalog: (merchantId) => backend.rpc('promote_merchant_to_country_catalog', { p_merchant_id: merchantId }),
  promoteCategoryToCountryCatalog: (categoryId) => backend.rpc('promote_category_to_country_catalog', { p_category_id: categoryId }),
  async createHousehold({ name, countryCode, baseCurrency, ownerUserId }) { return insert('households', { name, owner_user_id: ownerUserId, country_code: countryCode, base_currency: baseCurrency }); },
  updateHousehold: (id, patch) => update('households', id, patch),
  getFxRates: () => backend.fxRates(),
  async listHouseholdMembers(householdId) { const result = await backend.householdMembers({ action: 'list', householdId }); return result?.members || []; },
  addHouseholdMember(householdId, email, role) { return backend.householdMembers({ action: 'add', householdId, email, role }); },
  removeHouseholdMember(householdId, userId) { return backend.householdMembers({ action: 'remove', householdId, userId }); },
  listAccounts(householdId) { return backend.rest(buildQuery('account_balances', { select: '*', household_id: `eq.${householdId}`, is_archived: 'eq.false', order: 'sort_order.asc,name.asc' })); },
  createAccount: (payload) => insert('accounts', payload), updateAccount: (id, patch) => update('accounts', id, patch), deleteAccount: (id) => remove('accounts', id),
  listCategories(householdId) { return listByHousehold('categories', householdId, { order: 'kind.asc,sort_order.asc,name.asc', extra: { is_archived: 'eq.false' } }); },
  createCategory: (payload) => insert('categories', payload), createCategories: (payload) => insertMany('categories', payload), updateCategory: (id, patch) => update('categories', id, patch), deleteCategory: (id) => remove('categories', id),
  listCategorizationRules(householdId) { return listByHousehold('categorization_rules', householdId, { select: '*,categories(name,kind)', order: 'priority.asc,created_at.asc' }); },
  createCategorizationRule: (payload) => insert('categorization_rules', payload), deleteCategorizationRule: (id) => remove('categorization_rules', id),
  async listTransactions(householdId) {
    const select = 'id,household_id,account_id,category_id,merchant_id,import_batch_id,occurred_at,amount,currency,description,counterparty,note,status,source,transfer_group_id,external_reference,tax_relevant,tax_category,tax_year,tax_section_key,tax_treatment,cashflow_type,income_kind,analytics_excluded,accounts(name),categories(name,kind,parent_id),merchants(name,normalized_key,default_category_id)';
    const pageSize = 1000; const rows = [];
    for (let offset = 0; ; offset += pageSize) { const page = await listByHousehold('transactions', householdId, { select, order: 'occurred_at.desc,created_at.desc', limit: pageSize, extra: { offset: String(offset) } }); rows.push(...(page || [])); if (!page || page.length < pageSize) break; }
    return rows;
  },
  createTransaction: (payload) => insert('transactions', payload), createTransactions: (payload) => insertMany('transactions', payload),
  async importTransactions(payload) {
    const prepared = Array.isArray(payload) ? payload : [payload];
    const filtered = [];
    const receiptTransactions = new Map();
    const householdIds = [...new Set(prepared.map((row) => row.household_id).filter(Boolean))];

    // A receipt photo may have created a manual transaction before the bank export
    // exists. Only transactions with our linked receipt document participate in this
    // reconciliation. This keeps ordinary manual entries out of automatic matching.
    for (const householdId of householdIds) {
      const documents = await backend.rest(buildQuery('documents', {
        select: 'object_id', household_id: `eq.${householdId}`, object_type: 'eq.transaction',
        notes: 'ilike.*Fotoerfassung*', limit: '1000',
      })).catch(() => []);
      const ids = [...new Set((documents || []).map((row) => row.object_id).filter(Boolean))];
      const candidates = [];
      for (let index = 0; index < ids.length; index += 80) {
        const chunk = ids.slice(index, index + 80);
        const rows = await backend.rest(buildQuery('transactions', {
          select: 'id,household_id,account_id,merchant_id,occurred_at,amount,currency,status,external_reference',
          household_id: `eq.${householdId}`, id: `in.(${chunk.join(',')})`, limit: '100',
        })).catch(() => []);
        candidates.push(...(rows || []));
      }
      receiptTransactions.set(householdId, candidates);
    }

    const dayDistance = (left, right) => {
      const a = new Date(left); const b = new Date(right);
      if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 999;
      return Math.abs(a.getTime() - b.getTime()) / 86400000;
    };

    for (const row of prepared) {
      const candidates = (receiptTransactions.get(row.household_id) || []).filter((tx) =>
        tx.status === 'booked'
        && tx.account_id === row.account_id
        && tx.currency === row.currency
        && Boolean(tx.merchant_id) && tx.merchant_id === row.merchant_id
        && Math.abs(Number(tx.amount) - Number(row.amount)) < 0.005
        && dayDistance(tx.occurred_at, row.occurred_at) <= 2
      ).sort((a, b) => dayDistance(a.occurred_at, row.occurred_at) - dayDistance(b.occurred_at, row.occurred_at));

      // Ambiguous matches are deliberately not merged. If exactly one receipt-backed
      // transaction fits, keep that transaction and attach the bank fingerprint so
      // later imports remain idempotent.
      if (candidates.length === 1) {
        const match = candidates[0];
        if (!match.external_reference && row.external_reference) {
          await update('transactions', match.id, { external_reference: row.external_reference }).catch(() => null);
        }
        continue;
      }
      filtered.push(row);
    }

    if (!filtered.length) return [];
    const rows = await backend.rest(buildQuery('transactions', { on_conflict: 'household_id,external_reference' }), {
      method: 'POST', body: filtered, headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    });
    return rows || [];
  },
  updateTransaction: (id, patch) => update('transactions', id, patch),
  async bulkUpdateTransactions(ids, patch) { const unique = [...new Set((ids || []).filter(Boolean))]; for (let index = 0; index < unique.length; index += 80) { const chunk = unique.slice(index, index + 80); await backend.rest(buildQuery('transactions', { id: `in.(${chunk.join(',')})` }), { method: 'PATCH', body: patch, headers: { Prefer: 'return=minimal' } }); } },
  deleteTransaction: (id) => remove('transactions', id),
  createTransfer: (payload) => backend.rpc('create_transfer_v2', payload),
  deleteTransfer: (householdId, transferGroupId) => backend.rpc('delete_transfer_v2', { p_household_id: householdId, p_transfer_group_id: transferGroupId }),
  convertTransactionToTransfer: ({ householdId, transactionId, toAccountId, toAmount = null, description = null }) => backend.rpc('convert_transaction_to_transfer', { p_household_id: householdId, p_transaction_id: transactionId, p_to_account_id: toAccountId, p_to_amount: toAmount, p_description: description }),
  listImportBatches(householdId) { return listByHousehold('import_batches', householdId, { select: '*,accounts(name,currency)', order: 'created_at.desc', limit: 100 }); },
  createImportBatch: (payload) => insert('import_batches', payload), updateImportBatch: (id, patch) => update('import_batches', id, patch),
  listMerchants(householdId) { return listByHousehold('merchants', householdId, { select: '*', order: 'name.asc', limit: 1000 }); },
  async upsertMerchant(payload) { const rows = await backend.rest(buildQuery('merchants', { on_conflict: 'household_id,normalized_key' }), { method: 'POST', body: payload, headers: { Prefer: 'resolution=merge-duplicates,return=representation' } }); return rows?.[0] || null; },
  updateMerchant: (id, patch) => update('merchants', id, { ...patch, updated_at: new Date().toISOString() }),
  listRecurringRules(householdId) { return listByHousehold('recurring_rules', householdId, { select: '*,accounts!recurring_rules_account_id_fkey(name,currency),destination_account:accounts!recurring_rules_destination_account_id_fkey(name,currency),categories(name,kind),merchants(name,normalized_key,default_category_id)', order: 'next_date.asc,created_at.asc' }); },
  createRecurringRule: (payload) => insert('recurring_rules', payload), updateRecurringRule: (id, patch) => update('recurring_rules', id, patch), deleteRecurringRule: (id) => remove('recurring_rules', id),
  listBudgets(householdId) { return listByHousehold('budgets', householdId, { select: '*,categories(name,kind),merchants(name)', order: 'month_start.desc,created_at.asc' }); },
  async upsertBudget(payload) { const scope = payload.merchant_id ? { merchant_id: `eq.${payload.merchant_id}`, category_id: 'is.null' } : { category_id: `eq.${payload.category_id}`, merchant_id: 'is.null' }; const existing = await backend.rest(buildQuery('budgets', { select: 'id', household_id: `eq.${payload.household_id}`, month_start: `eq.${payload.month_start}`, ...scope, limit: '1' })); if (existing?.[0]?.id) return update('budgets', existing[0].id, payload); return insert('budgets', payload); },
  deleteBudget: (id) => remove('budgets', id),
  listBills(householdId) { return listByHousehold('bills', householdId, { select: '*,accounts(name),categories(name,kind)', order: 'due_date.asc,created_at.asc' }); },
  createBill: (payload) => insert('bills', payload), updateBill: (id, patch) => update('bills', id, patch),
  payBill: ({ householdId, billId, source, paidAt = null, accountId = null, transactionId = null }) => backend.rpc('pay_bill_v2', { p_household_id:householdId, p_bill_id:billId, p_source:source, p_paid_at:paidAt, p_account_id:accountId, p_transaction_id:transactionId }),
  unpayBill: ({ householdId, billId }) => backend.rpc('unpay_bill_v2', { p_household_id:householdId, p_bill_id:billId }), deleteBill: (id) => remove('bills', id),
  listContracts(householdId) { return listByHousehold('contracts', householdId, { select: '*,categories(name,kind),accounts(name,currency)', order: 'next_payment_date.asc.nullslast,created_at.desc' }); },
  createContract: (payload) => insert('contracts', payload), updateContract: (id, patch) => update('contracts', id, patch), deleteContract: (id) => remove('contracts', id),
  listGoals(householdId) { return listByHousehold('savings_goals', householdId, { select: '*,accounts(name,currency)', order: 'status.asc,target_date.asc.nullslast,created_at.desc' }); },
  createGoal: (payload) => insert('savings_goals', payload), updateGoal: (id, patch) => update('savings_goals', id, patch), deleteGoal: (id) => remove('savings_goals', id),
  listGoalSources(householdId) { return listByHousehold('savings_goal_sources', householdId, { order: 'created_at.asc', limit: 1000 }); }, createGoalSource: (payload) => insert('savings_goal_sources', payload), deleteGoalSource: (id) => remove('savings_goal_sources', id),
  listDebts(householdId) { return listByHousehold('debts', householdId, { order: 'status.asc,next_payment_date.asc.nullslast,created_at.desc' }); },
  createDebt: (payload) => insert('debts', payload), updateDebt: (id, patch) => update('debts', id, patch), deleteDebt: (id) => remove('debts', id),
  async listDebtPayments(householdId) { const select = '*,debts(name,creditor,currency),transactions(id,description,amount,currency,occurred_at,accounts(name))'; const pageSize = 1000; const rows = []; for (let offset = 0; ; offset += pageSize) { const page = await listByHousehold('debt_payments', householdId, { select, order: 'paid_at.desc,created_at.desc', limit: pageSize, extra: { offset: String(offset) } }); rows.push(...(page || [])); if (!page || page.length < pageSize) break; } return rows; },
  createDebtPayment: (payload) => insert('debt_payments', payload), reverseDebtPayment: (id) => update('debt_payments', id, { reversed_at: new Date().toISOString() }),
  listReceivables(householdId) { return listByHousehold('receivables', householdId, { order: 'status.asc,due_date.asc.nullslast,created_at.desc', limit: 1000 }); },
  listReceivablePayments(householdId) { return listByHousehold('receivable_payments', householdId, { order: 'paid_at.desc,created_at.desc', limit: 1000 }); },
  createReceivable({ householdId, debtor, reason, originalAmount, currency, lentAt, dueDate=null, notes=null, sourceAccountId=null, createTransaction=false }) {
    return backend.rpc('create_receivable_v2', { p_household_id:householdId, p_debtor:debtor, p_reason:reason, p_original_amount:originalAmount, p_currency:currency, p_lent_at:lentAt, p_due_date:dueDate, p_notes:notes, p_source_account_id:sourceAccountId, p_create_transaction:createTransaction });
  },
  recordReceivablePayment({ householdId, receivableId, amount, paidAt, note=null, source='created_transaction', paymentAccountId=null, transactionId=null }) {
    return backend.rpc('record_receivable_payment_v3', {
      p_household_id:householdId, p_receivable_id:receivableId, p_amount:amount, p_paid_at:paidAt,
      p_note:note, p_source:source, p_payment_account_id:paymentAccountId, p_transaction_id:transactionId
    });
  },
  reverseReceivablePayment: (paymentId) => backend.rpc('reverse_receivable_payment_v2', { p_payment_id:paymentId }),
  deleteReceivable: ({ householdId, receivableId }) => backend.rpc('delete_receivable_v2', { p_household_id:householdId, p_receivable_id:receivableId }),
  touchPresence: ({ route=null, appVersion=null, deviceLabel=null }={}) => backend.rpc('touch_user_presence', { p_route:route, p_app_version:appVersion, p_device_label:deviceLabel }),
  clearPresence: () => backend.rpc('clear_user_presence'),
  listLegalCases(householdId) { return listByHousehold('legal_cases', householdId, { order: 'status.asc,next_action_date.asc.nullslast,created_at.desc' }); }, createLegalCase: (payload) => insert('legal_cases', payload), updateLegalCase: (id, patch) => update('legal_cases', id, patch), deleteLegalCase: (id) => remove('legal_cases', id),
  listLegalEvents(householdId) { return listByHousehold('legal_case_events', householdId, { order: 'event_date.desc,created_at.desc' }); }, createLegalEvent: (payload) => insert('legal_case_events', payload), deleteLegalEvent: (id) => remove('legal_case_events', id),
  listAssets(householdId) { return listByHousehold('assets', householdId, { order: 'created_at.desc' }); }, createAsset: (payload) => insert('assets', payload), updateAsset: (id, patch) => update('assets', id, patch), deleteAsset: (id) => remove('assets', id),
  listProperties(householdId) { return listByHousehold('properties', householdId, { order: 'created_at.desc' }); }, createProperty: (payload) => insert('properties', payload), updateProperty: (id, patch) => update('properties', id, patch), deleteProperty: (id) => remove('properties', id),
  listVehicles(householdId) { return listByHousehold('vehicles', householdId, { order: 'created_at.desc' }); }, createVehicle: (payload) => insert('vehicles', payload), updateVehicle: (id, patch) => update('vehicles', id, patch), deleteVehicle: (id) => remove('vehicles', id),
  listInsurance(householdId) { return listByHousehold('insurance_policies', householdId, { select: '*,accounts(name,currency),categories(name,kind)', order: 'status.asc,next_payment_date.asc.nullslast,created_at.desc' }); }, createInsurance: (payload) => insert('insurance_policies', payload), updateInsurance: (id, patch) => update('insurance_policies', id, patch), deleteInsurance: (id) => remove('insurance_policies', id),
  listInvestments(householdId) { return listByHousehold('investments', householdId, { order: 'created_at.desc' }); }, createInvestment: (payload) => insert('investments', payload), updateInvestment: (id, patch) => update('investments', id, patch), deleteInvestment: (id) => remove('investments', id), listInvestmentTransactions(householdId) { return listByHousehold('investment_transactions', householdId, { order: 'trade_date.desc,created_at.desc', limit: 1000 }); }, recordInvestmentTrade: (payload) => backend.rpc('record_investment_trade', payload),
  listPensions(householdId) { return listByHousehold('pension_accounts', householdId, { order: 'created_at.desc' }); }, createPension: (payload) => insert('pension_accounts', payload), updatePension: (id, patch) => update('pension_accounts', id, patch), deletePension: (id) => remove('pension_accounts', id),
  listTaxRuleVersions() { return backend.rest(buildQuery('tax_rule_versions', { select: '*', active: 'eq.true', order: 'tax_year.asc' })); },
  listTaxCases(householdId) { return listByHousehold('tax_cases', householdId, { select: '*,tax_rule_versions(version,status,source_url,notes)', order: 'tax_year.asc' }); },
  listTaxPeople(householdId) { return listByHousehold('tax_people', householdId, { order: 'tax_case_id.asc,person_no.asc' }); },
  createTaxPerson: (payload) => insert('tax_people', payload), updateTaxPerson: (id, patch) => update('tax_people', id, patch), deleteTaxPerson: (id) => remove('tax_people', id),
  listTaxChildren(householdId) { return listByHousehold('tax_children', householdId, { order: 'birth_date.asc,created_at.asc' }); },
  createTaxChild: (payload) => insert('tax_children', payload), updateTaxChild: (id, patch) => update('tax_children', id, patch), deleteTaxChild: (id) => remove('tax_children', id),
  listTaxEmployments(householdId) { return listByHousehold('tax_employments', householdId, { select: '*,tax_people(first_name,last_name,person_no)', order: 'period_from.asc.nullsfirst,created_at.asc' }); },
  createTaxEmployment: (payload) => insert('tax_employments', payload), updateTaxEmployment: (id, patch) => update('tax_employments', id, patch), deleteTaxEmployment: (id) => remove('tax_employments', id),
  ensureTaxCase: ({householdId,taxYear,countryCode='CH',cantonCode='SG'}) => backend.rpc('ensure_tax_case', { p_household_id:householdId, p_tax_year:taxYear, p_country_code:countryCode, p_canton_code:cantonCode }),
  updateTaxCase: (id, patch) => update('tax_cases', id, patch),
  listTaxCaseSections(householdId) { return listByHousehold('tax_case_sections', householdId, { order: 'section_key.asc' }); },
  upsertTaxCaseSection(payload) { return backend.rest(buildQuery('tax_case_sections', { on_conflict: 'tax_case_id,section_key' }), { method: 'POST', body: payload, headers: { Prefer: 'resolution=merge-duplicates,return=representation' } }).then((rows)=>rows?.[0]||null); },
  listTaxItems(householdId) { return listByHousehold('tax_items', householdId, { order: 'occurred_on.desc.nullslast,created_at.desc', limit: 2000 }); },
  createTaxItem: (payload) => insert('tax_items', payload), updateTaxItem: (id, patch) => update('tax_items', id, patch), deleteTaxItem: (id) => remove('tax_items', id),
  listTaxObligations(householdId) { return listByHousehold('tax_obligations', householdId, { order: 'due_date.asc.nullslast,created_at.asc', limit: 1000 }); },
  createTaxObligation: (payload) => insert('tax_obligations', payload), updateTaxObligation: (id, patch) => update('tax_obligations', id, patch), deleteTaxObligation: (id) => remove('tax_obligations', id),
  listTaxPayments(householdId) { return listByHousehold('tax_payments', householdId, { order: 'paid_at.desc,created_at.desc', limit: 1000 }); },
  createTaxPayment: (payload) => insert('tax_payments', payload),
  recordTaxPayment: ({ householdId, taxCaseId, obligationId = null, paymentType = 'payment', amount, paidAt, reference = null, notes = null, source = 'created_transaction', accountId = null, transactionId = null }) => backend.rpc('record_tax_payment_v2', {
    p_household_id:householdId, p_tax_case_id:taxCaseId, p_obligation_id:obligationId,
    p_payment_type:paymentType, p_amount:amount, p_paid_at:paidAt, p_reference:reference,
    p_notes:notes, p_source:source, p_account_id:accountId, p_transaction_id:transactionId,
  }),
  reverseTaxPayment: ({ householdId, paymentId }) => backend.rpc('reverse_tax_payment_v2', { p_household_id:householdId, p_payment_id:paymentId }),
  deleteTaxPayment: (id) => remove('tax_payments', id),
  listDocuments(householdId) { return listByHousehold('documents', householdId, { order: 'created_at.desc', limit: 200 }); }, createDocument: (payload) => insert('documents', payload), updateDocument: (id, patch) => update('documents', id, patch),
  deleteDocument: async (document) => { if (document?.storage_path) await backend.storageDelete('finance-documents', [document.storage_path]); return remove('documents', document.id); },
  uploadDocument(householdId, file) { const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120); const path = `${householdId}/${crypto.randomUUID()}-${safeName}`; return backend.storageUpload('finance-documents', path, file).then(() => path); },
  deleteStoredDocument: (path) => backend.storageDelete('finance-documents', [path]),
  downloadDocument: (path) => backend.storageDownload('finance-documents', path),
});
