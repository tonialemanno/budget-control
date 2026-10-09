import { buildCategoryMlModel, predictCategoryMl } from './ml-categorization.js';

export function buildLearningSummary({
  transactions = [],
  categories = [],
  merchants = [],
  merchantAliases = [],
} = {}) {
  const model = buildCategoryMlModel({ transactions, categories });
  const open = transactions.filter((tx) =>
    tx?.status === 'booked'
    && !tx?.transfer_group_id
    && !['debt_payment','receivable_principal'].includes(tx?.cashflow_type)
    && !tx?.category_id
  );
  const predictions = open
    .map((tx) => ({ tx, prediction: predictCategoryMl(model, tx) }))
    .filter((row) => row.prediction)
    .sort((a,b) => b.prediction.confidence - a.prediction.confidence);
  return {
    trainingExamples: Number(model?.trainingExamples || 0),
    learnedMerchants: merchants.filter((merchant) => merchant?.default_category_id).length,
    merchantCount: merchants.length,
    aliasCount: merchantAliases.length,
    openCount: open.length,
    safeCount: predictions.filter((row) => row.prediction.safe).length,
    reviewCount: predictions.filter((row) => !row.prediction.safe).length,
    examples: predictions.slice(0,5),
  };
}
