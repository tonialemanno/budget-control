import { applyCategoryRules, merchantFromTransaction, resolveCanonicalMerchant, suggestAccountCategory, suggestKnownCategoryCandidates } from './csv-import.js';

function validCategory(categoryId, kind, categoryById) {
  const category = categoryById.get(categoryId);
  return category && category.kind === kind ? category : null;
}

function uniform(values) {
  const unique = [...new Set(values.filter(Boolean))];
  return unique.length === 1 ? unique[0] : null;
}

export function buildCategorizationGroups({
  transactions = [],
  categories = [],
  merchants = [],
  aliases = [],
  rules = [],
  accounts = [],
} = {}) {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const merchantById = new Map(merchants.map((merchant) => [merchant.id, merchant]));
  const merchantByKey = new Map(merchants.map((merchant) => [merchant.normalized_key, merchant]));
  const accountById = new Map(accounts.map((account) => [account.account_id || account.id, account]));
  const groups = new Map();

  for (const tx of transactions) {
    if (tx.status !== 'booked' || tx.transfer_group_id || ['debt_payment','receivable_principal'].includes(tx.cashflow_type)) continue;
    const kind = Number(tx.amount) < 0 ? 'expense' : 'income';
    const directMerchant = (tx.merchant_id && merchantById.get(tx.merchant_id))
      || (tx.merchants?.normalized_key && merchantByKey.get(tx.merchants.normalized_key))
      || null;
    const parsed=merchantFromTransaction(tx);
    const detected = parsed?.genericPaymentRail
      ? parsed
      : directMerchant
        ? { name: directMerchant.name, key: directMerchant.normalized_key, aliasKey:directMerchant.normalized_key }
        : parsed;
    const genericPaymentRail=Boolean(detected?.genericPaymentRail);
    const linkedMerchant = genericPaymentRail ? null : (directMerchant || resolveCanonicalMerchant(detected,{merchants,aliases}));
    const account=accountById.get(tx.account_id)||null;
    const accountCategory=genericPaymentRail?suggestAccountCategory(tx,{account,categories}):null;
    const unknownScope=accountCategory
      ? `${tx.account_id||'konto'}:purpose`
      : (tx.id||`${tx.account_id||'konto'}:${tx.occurred_at||''}:${Number(tx.amount||0).toFixed(2)}`);
    const merchantKey = genericPaymentRail
      ? `unbekannt:${detected.paymentProcessor||'zahlung'}:${unknownScope}`
      : (detected.key || 'unbekannt');
    const key = `${kind}:${merchantKey}`;
    const group = groups.get(key) || {
      key,
      merchantKey,
      merchantId: genericPaymentRail ? null : (linkedMerchant?.id || tx.merchant_id || null),
      merchant: linkedMerchant || null,
      name: genericPaymentRail ? (detected.name || 'Zahlungsweg') : (linkedMerchant?.name || detected.name || 'Unbekannter Händler'),
      kind,
      genericPaymentRail,
      paymentProcessor:detected?.paymentProcessor||null,
      accountId:tx.account_id||null,
      accountCategoryId:accountCategory?.id||null,
      rows: [],
    };
    group.rows.push(tx);
    if (!group.merchantId && tx.merchant_id) group.merchantId = tx.merchant_id;
    groups.set(key, group);
  }

  const result = [];
  for (const group of groups.values()) {
    const currentIds = group.rows.map((row) => validCategory(row.category_id, group.kind, categoryById)?.id).filter(Boolean);
    const currentCategoryId = uniform(currentIds);
    const mixed = new Set(currentIds).size > 1;
    const unassignedRows = group.rows.filter((row) => !validCategory(row.category_id, group.kind, categoryById));

    let suggestion = null;
    const rememberedId = group.merchant?.default_category_id
      || group.rows.map((row) => row.merchants?.default_category_id).find(Boolean)
      || null;
    const remembered = validCategory(rememberedId, group.kind, categoryById);
    if (remembered) suggestion = { categoryId: remembered.id, source: 'remembered', safe: true };

    if (!suggestion) {
      const ruleIds = group.rows.map((row) => {
        const id = applyCategoryRules(row, rules);
        return validCategory(id, group.kind, categoryById)?.id || null;
      }).filter(Boolean);
      const ruleId = uniform(ruleIds);
      if (ruleId) suggestion = { categoryId: ruleId, source: 'rule', safe: true };
    }

    if (!suggestion) {
      const knownIds = group.rows.map((row) => {
        const names=suggestKnownCategoryCandidates(row);
        if (!names.length) return null;
        return names.map((name)=>categories.find((category)=>category.kind===group.kind&&category.name.toLowerCase()===name.toLowerCase())?.id||null).find(Boolean)||null;
      }).filter(Boolean);
      const knownId = uniform(knownIds);
      if (knownId) suggestion = { categoryId: knownId, source: 'known', safe: true };
    }

    if (!suggestion && group.genericPaymentRail) {
      const accountCategory=group.accountCategoryId
        ? categoryById.get(group.accountCategoryId)
        : suggestAccountCategory(group.rows[0],{account:accountById.get(group.accountId),categories});
      if(accountCategory) suggestion={categoryId:accountCategory.id,source:'account',safe:true};
    }

    // Bestehende, einheitliche Benutzerzuordnungen sind ein Vorschlag, aber nie Teil der sicheren Sammelautomatik.
    if (!suggestion && currentCategoryId && unassignedRows.length) {
      suggestion = { categoryId: currentCategoryId, source: 'history', safe: false };
    }

    const selectedCategoryId = suggestion?.categoryId || currentCategoryId || '';
    result.push({
      ...group,
      currentCategoryId,
      currentCategory: currentCategoryId ? categoryById.get(currentCategoryId) : null,
      mixed,
      unassignedRows,
      unassignedCount: unassignedRows.length,
      suggestion: suggestion ? { ...suggestion, category: categoryById.get(suggestion.categoryId) } : null,
      selectedCategoryId,
      needsAttention: unassignedRows.length > 0 || mixed,
    });
  }

  const rank = (group) => {
    if (group.unassignedCount && group.suggestion?.safe) return 0;
    if (group.unassignedCount && group.suggestion) return 1;
    if (group.unassignedCount) return 2;
    if (group.mixed) return 3;
    return 4;
  };

  return result.sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank) return byRank;
    return b.rows.length - a.rows.length || a.name.localeCompare(b.name, 'de');
  });
}

export function categorizationSourceLabel(source) {
  return ({
    remembered: 'Gemerkte Händlerkategorie',
    rule: 'Kategorisierungsregel',
    known: 'Eindeutiger Händler',
    history: 'Bisherige Zuordnung',
    account: 'Kontozweck',
  })[source] || 'Vorschlag';
}
