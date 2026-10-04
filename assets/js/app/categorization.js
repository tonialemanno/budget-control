import { applyCategoryRules, merchantFromTransaction, suggestKnownCategoryName } from './csv-import.js';

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
} = {}) {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const merchantById = new Map(merchants.map((merchant) => [merchant.id, merchant]));
  const merchantByKey = new Map(merchants.map((merchant) => [merchant.normalized_key, merchant]));
  const aliasByKey = new Map(aliases.map((alias)=>[alias.normalized_key,alias]));
  const groups = new Map();

  for (const tx of transactions) {
    if (tx.status !== 'booked' || tx.transfer_group_id || ['debt_payment','receivable_principal'].includes(tx.cashflow_type)) continue;
    const kind = Number(tx.amount) < 0 ? 'expense' : 'income';
    const detectedRaw=merchantFromTransaction(tx);
    const alias=detectedRaw?.key ? aliasByKey.get(detectedRaw.key) : null;
    const linkedMerchant = (tx.merchant_id && merchantById.get(tx.merchant_id))
      || (tx.merchants?.normalized_key && merchantByKey.get(tx.merchants.normalized_key))
      || (alias?.merchant_id && merchantById.get(alias.merchant_id))
      || (detectedRaw?.key && merchantByKey.get(detectedRaw.key))
      || null;
    const detected = linkedMerchant
      ? { name: linkedMerchant.name, key: linkedMerchant.normalized_key }
      : detectedRaw;
    const merchantKey = detected.key || 'unbekannt';
    const key = `${kind}:${merchantKey}`;
    const group = groups.get(key) || {
      key,
      merchantKey,
      merchantId: linkedMerchant?.id || tx.merchant_id || null,
      merchant: linkedMerchant || null,
      name: linkedMerchant?.name || detected.name || 'Unbekannter Händler',
      kind,
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
        const name = suggestKnownCategoryName(row);
        if (!name) return null;
        return categories.find((category) => category.kind === group.kind && category.name.toLowerCase() === name.toLowerCase())?.id || null;
      }).filter(Boolean);
      const knownId = uniform(knownIds);
      if (knownId) suggestion = { categoryId: knownId, source: 'known', safe: true };
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
  })[source] || 'Vorschlag';
}
