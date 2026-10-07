import { merchantFromTransaction, normalizeMerchantKey } from './csv-import.js';

export const CATEGORY_ML_MODEL_VERSION = 'category-nb-v1';

const MIN_TRAINING_EXAMPLES = 10;
const MIN_CLASSES = 2;
const MIN_CLASS_SUPPORT = 2;
const REVIEW_CONFIDENCE = 0.62;

const STOP_WORDS = new Set([
  'zahlung','belastung','gutschrift','buchung','bezug','karte','card','debit','credit',
  'twint','ubs','sumup','ecommerce','commerce','transaction','transaktion','ref','referenz',
  'chf','eur','usd','gbp','ag','gmbh','sa','srl','spa','und','der','die','das','von','an',
]);

function transactionKind(tx) {
  return Number(tx?.amount) < 0 ? 'expense' : 'income';
}

function eligibleTransaction(tx, categoryById) {
  if (!tx || tx.status !== 'booked' || tx.transfer_group_id) return null;
  if (['debt_payment','receivable_principal'].includes(tx.cashflow_type)) return null;
  const category = categoryById.get(tx.category_id);
  if (!category || category.is_archived) return null;
  const kind = transactionKind(tx);
  return category.kind === kind ? { category, kind } : null;
}

function addFeature(features, key, weight = 1) {
  if (!key || !(weight > 0)) return;
  features.set(key, (features.get(key) || 0) + weight);
}

function normalizedTokens(value) {
  return normalizeMerchantKey(value)
    .split(' ')
    .filter((token) => token.length >= 2 && token.length <= 32 && !/^\d+$/.test(token) && !STOP_WORDS.has(token));
}

function amountBucket(value) {
  const amount = Math.abs(Number(value) || 0);
  if (amount < 10) return 'lt10';
  if (amount < 25) return '10-24';
  if (amount < 50) return '25-49';
  if (amount < 100) return '50-99';
  if (amount < 250) return '100-249';
  if (amount < 500) return '250-499';
  if (amount < 1000) return '500-999';
  if (amount < 2500) return '1000-2499';
  return '2500plus';
}

export function transactionMlFeatures(tx = {}) {
  const features = new Map();
  const merchant = merchantFromTransaction(tx);

  if (merchant?.key && merchant.key !== 'unbekannt') addFeature(features, `merchant:${merchant.key}`, 4);
  if (merchant?.paymentProcessor) addFeature(features, `processor:${normalizeMerchantKey(merchant.paymentProcessor)}`, 0.5);
  if (tx.currency) addFeature(features, `currency:${String(tx.currency).toUpperCase()}`, 0.4);
  addFeature(features, `amount:${amountBucket(tx.amount)}`, 0.7);

  const tokens = [...new Set(normalizedTokens([
    tx.description,
    tx.counterparty,
    tx.note,
    merchant?.name,
  ].filter(Boolean).join(' ')))].slice(0, 40);

  for (const token of tokens) addFeature(features, `word:${token}`, 1);
  for (let index = 0; index < tokens.length - 1 && index < 20; index += 1) {
    addFeature(features, `bigram:${tokens[index]}_${tokens[index + 1]}`, 0.65);
  }

  return features;
}

function emptyKindState() {
  return { totalDocuments: 0, classes: new Map(), vocabulary: new Set() };
}

export function buildCategoryMlModel({ transactions = [], categories = [] } = {}) {
  const categoryById = new Map(categories.filter((category) => !category.is_archived).map((category) => [category.id, category]));
  const kinds = { expense: emptyKindState(), income: emptyKindState() };

  for (const tx of transactions) {
    const eligible = eligibleTransaction(tx, categoryById);
    if (!eligible) continue;
    const state = kinds[eligible.kind];
    const features = transactionMlFeatures(tx);
    if (!features.size) continue;

    let classState = state.classes.get(eligible.category.id);
    if (!classState) {
      classState = { categoryId: eligible.category.id, documentCount: 0, featureWeight: 0, featureCounts: new Map() };
      state.classes.set(eligible.category.id, classState);
    }

    state.totalDocuments += 1;
    classState.documentCount += 1;
    for (const [feature, weight] of features) {
      classState.featureCounts.set(feature, (classState.featureCounts.get(feature) || 0) + weight);
      classState.featureWeight += weight;
      state.vocabulary.add(feature);
    }
  }

  return {
    version: CATEGORY_ML_MODEL_VERSION,
    trainedAt: new Date().toISOString(),
    kinds,
    trainingExamples: kinds.expense.totalDocuments + kinds.income.totalDocuments,
  };
}

function softmaxProbabilities(scored) {
  if (!scored.length) return [];
  const maximum = Math.max(...scored.map((row) => row.logScore));
  const exp = scored.map((row) => Math.exp(row.logScore - maximum));
  const total = exp.reduce((sum, value) => sum + value, 0) || 1;
  return scored.map((row, index) => ({ ...row, probability: exp[index] / total }))
    .sort((a, b) => b.probability - a.probability);
}

export function predictCategoryMl(model, tx, { minimumConfidence = REVIEW_CONFIDENCE } = {}) {
  const kind = transactionKind(tx);
  const state = model?.kinds?.[kind];
  if (!state || state.totalDocuments < MIN_TRAINING_EXAMPLES || state.classes.size < MIN_CLASSES) return null;

  const features = transactionMlFeatures(tx);
  if (!features.size) return null;

  const vocabularySize = Math.max(1, state.vocabulary.size);
  const alpha = 0.5;
  const classCount = state.classes.size;
  const scored = [];

  for (const classState of state.classes.values()) {
    const prior = (classState.documentCount + 1) / (state.totalDocuments + classCount);
    let logScore = Math.log(prior);
    const denominator = classState.featureWeight + alpha * vocabularySize;
    for (const [feature, weight] of features) {
      const count = classState.featureCounts.get(feature) || 0;
      logScore += weight * Math.log((count + alpha) / denominator);
    }
    scored.push({ categoryId: classState.categoryId, support: classState.documentCount, logScore });
  }

  const ranked = softmaxProbabilities(scored);
  const best = ranked[0];
  if (!best || best.support < MIN_CLASS_SUPPORT) return null;

  const totalFeatureWeight = [...features.values()].reduce((sum, weight) => sum + weight, 0) || 1;
  const knownFeatureWeight = [...features].reduce((sum, [feature, weight]) => sum + (state.vocabulary.has(feature) ? weight : 0), 0);
  const coverage = Math.min(1, knownFeatureWeight / totalFeatureWeight);
  const supportFactor = Math.min(1, best.support / 5);
  const confidence = best.probability * (0.65 + 0.35 * coverage) * (0.8 + 0.2 * supportFactor);
  const second = ranked[1]?.probability || 0;
  const margin = best.probability - second;

  if (coverage < 0.2 || confidence < minimumConfidence) return null;

  const safe = state.totalDocuments >= 20
    && best.support >= 5
    && best.probability >= 0.94
    && confidence >= 0.88
    && margin >= 0.55
    && coverage >= 0.4;

  return {
    categoryId: best.categoryId,
    kind,
    confidence,
    rawConfidence: best.probability,
    margin,
    coverage,
    support: best.support,
    trainingExamples: state.totalDocuments,
    safe,
    modelVersion: model.version || CATEGORY_ML_MODEL_VERSION,
  };
}
