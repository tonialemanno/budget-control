import { financeApi } from './finance-api.js';
import { analyzeReceiptImage, findReceiptMatches } from './receipt-ocr.js';
import { normalizeMerchantKey } from './csv-import.js';
import { dateInputValue, financeEventTimestamp } from './format.js';
import { getLocale, t } from './i18n.js';

const state = {
  file: null,
  previewUrl: null,
  analysis: null,
  context: null,
  matches: [],
  busy: false,
  generation: 0,
  geo: null,
};

function toast(message, tone = 'success') {
  document.querySelector('.receipt-toast')?.remove();
  const node = document.createElement('div');
  node.className = `toast toast--${tone} receipt-toast`;
  node.textContent = message;
  document.body.appendChild(node);
  requestAnimationFrame(() => node.classList.add('toast--visible'));
  window.setTimeout(() => {
    node.classList.remove('toast--visible');
    window.setTimeout(() => node.remove(), 220);
  }, 3600);
}

function resetState({ hide = true } = {}) {
  state.generation += 1;
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.file = null;
  state.previewUrl = null;
  state.analysis = null;
  state.context = null;
  state.matches = [];
  state.busy = false;
  state.geo = null;
  const input = document.querySelector('#receiptCameraInput');
  if (input) input.value = '';
  if (hide) document.querySelector('#receipt-create')?.setAttribute('hidden', '');
}

function formatMoney(value, currency = 'CHF') {
  try { return new Intl.NumberFormat(getLocale(), { style: 'currency', currency }).format(Number(value || 0)); }
  catch { return `${Number(value || 0).toFixed(2)} ${currency}`; }
}

function setProgress(status, progress = 0) {
  const statusNode = document.querySelector('#receiptOcrStatus');
  const textNode = document.querySelector('#receiptOcrProgressText');
  const bar = document.querySelector('#receiptOcrProgressBar');
  if (statusNode) statusNode.textContent = t(status || 'Analyse');
  if (textNode) textNode.textContent = progress >= 1 ? t('Analyse abgeschlossen') : `${Math.round(Math.max(0, Math.min(1, progress)) * 100)} %`;
  if (bar) bar.style.width = `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`;
}

async function loadContext() {
  const households = await financeApi.listHouseholds();
  const household = households?.[0];
  if (!household) throw new Error(t('Haushalt wurde nicht gefunden.'));
  const [accounts, categories, merchants, transactions, documents] = await Promise.all([
    financeApi.listAccounts(household.id),
    financeApi.listCategories(household.id),
    financeApi.listMerchants(household.id),
    financeApi.listTransactions(household.id),
    financeApi.listDocuments(household.id),
  ]);
  const receiptTransactionIds = new Set((documents || []).filter((row) => row.object_type === 'transaction' && /Fotoerfassung/i.test(row.notes || '')).map((row) => row.object_id));
  return { household, accounts: accounts || [], categories: categories || [], merchants: merchants || [], transactions: transactions || [], receiptTransactionIds };
}

function selectedValues() {
  return {
    merchant: String(document.querySelector('#receiptMerchant')?.value || '').trim(),
    amount: Math.abs(Number(document.querySelector('#receiptAmount')?.value || 0)),
    currency: String(document.querySelector('#receiptCurrency')?.value || 'CHF'),
    date: String(document.querySelector('#receiptDate')?.value || ''),
  };
}

function updateAccountChoices(currency) {
  const select = document.querySelector('#receiptAccount');
  if (!select || !state.context) return;
  let firstAllowed = '';
  for (const option of [...select.options]) {
    if (!option.value) continue;
    const account = state.context.accounts.find((row) => row.account_id === option.value);
    const allowed = account?.currency === currency;
    option.disabled = !allowed;
    option.hidden = !allowed;
    if (allowed && !firstAllowed) firstAllowed = option.value;
  }
  if (select.value && select.selectedOptions[0]?.disabled) select.value = '';
  if (!select.value) {
    const allowed = state.context.accounts.filter((row) => row.currency === currency);
    if (allowed.length === 1) select.value = allowed[0].account_id;
    else if (firstAllowed) select.value = firstAllowed;
  }
}

function setMode(mode) {
  const link = mode === 'link';
  const accountField = document.querySelector('#receiptAccountField');
  const matchField = document.querySelector('#receiptMatchField');
  if (accountField) accountField.hidden = link;
  if (matchField) matchField.hidden = !link;
}

function refreshMatches({ chooseBest = false } = {}) {
  if (!state.context) return;
  const values = selectedValues();
  state.matches = findReceiptMatches({
    transactions: state.context.transactions.filter((tx) => !state.context.receiptTransactionIds?.has(tx.id)),
    amount: values.amount,
    currency: values.currency,
    date: values.date,
    merchant: values.merchant,
    limit: 6,
  });

  const select = document.querySelector('#receiptMatch');
  if (select) {
    const previous = select.value;
    select.replaceChildren(new Option(t('Bitte wählen'), ''));
    for (const match of state.matches) {
      const tx = match.tx;
      const date = dateInputValue(new Date(tx.occurred_at));
      const label = `${date} · ${tx.accounts?.name || t('Konto')} · ${tx.merchants?.name || tx.counterparty || tx.description} · ${formatMoney(Math.abs(Number(tx.amount)), tx.currency)}`;
      select.add(new Option(label, tx.id));
    }
    if (previous && state.matches.some((entry) => entry.tx.id === previous)) select.value = previous;
  }

  const high = state.matches.filter((entry) => entry.highConfidence);
  const alert = document.querySelector('#receiptMatchAlert');
  const mode = document.querySelector('#receiptMode');
  if (alert) {
    if (high.length === 1) {
      alert.hidden = false;
      alert.innerHTML = `<strong>${t('Passende Bankbuchung gefunden.')}</strong><span>${t('Finance kann den Beleg verknüpfen, statt eine zweite Ausgabe anzulegen.')}</span>`;
    } else if (state.matches.length) {
      alert.hidden = false;
      alert.innerHTML = `<strong>${t('Mögliche Bankbuchung gefunden.')}</strong><span>${t('Bitte prüfen. Finance verknüpft unklare Treffer nicht automatisch.')}</span>`;
    } else {
      alert.hidden = true;
      alert.textContent = '';
    }
  }
  if (chooseBest && high.length === 1 && mode && select) {
    mode.value = 'link';
    select.value = high[0].tx.id;
    setMode('link');
  }
}

function selectSuggestedCategory(analysis) {
  const select = document.querySelector('#receiptCategory');
  if (!select || !state.context) return;
  const key = normalizeMerchantKey(analysis.merchant);
  const remembered = state.context.merchants.find((row) => row.normalized_key === key)?.default_category_id;
  let id = remembered || '';
  if (!id && analysis.suggestedCategoryName) {
    id = state.context.categories.find((row) => row.kind === 'expense' && row.name.toLowerCase() === analysis.suggestedCategoryName.toLowerCase())?.id || '';
  }
  if (id && [...select.options].some((option) => option.value === id)) select.value = id;
}

async function detectGeoCurrency(fallbackCurrency='CHF') {
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),3500);
  try {
    const response=await fetch('/api/geo',{cache:'no-store',signal:controller.signal});
    if(!response.ok) throw new Error('geo unavailable');
    const data=await response.json();
    return {
      country:data?.country||null,
      currency:['CHF','EUR','USD','GBP'].includes(data?.currency)?data.currency:fallbackCurrency,
    };
  } catch {
    return {country:null,currency:fallbackCurrency};
  } finally {
    window.clearTimeout(timer);
  }
}

async function analyzeFile(file) {
  if (!file) return;
  if (!String(file.type || '').startsWith('image/')) throw new Error(t('Bitte ein Foto oder Bild des Belegs auswählen.'));
  if (file.size > 10 * 1024 * 1024) throw new Error(t('Das Belegfoto ist grösser als 10 MB.'));

  resetState({ hide: false });
  const generation = state.generation;
  state.file = file;
  state.previewUrl = URL.createObjectURL(file);
  const form = document.querySelector('#receipt-create');
  const preview = document.querySelector('#receiptPreview');
  if (preview) preview.src = state.previewUrl;
  form?.removeAttribute('hidden');
  form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setProgress(t('Beleg wird vorbereitet'), 0.03);

  state.context = await loadContext();
  state.geo = await detectGeoCurrency(state.context.household.base_currency || 'CHF');
  const presetCurrency=document.querySelector('#receiptCurrency');
  if(presetCurrency) presetCurrency.value=state.geo.currency;
  const accountHint=document.querySelector('#receiptAccountHint');
  if(accountHint && state.geo.country) accountHint.textContent=`${t('Standort')} ${state.geo.country}: ${state.geo.currency} ${t('vorgeschlagen. Eine erkannte Belegwährung hat Vorrang.')}`;
  let analysisResult;
  try {
    analysisResult = await analyzeReceiptImage(file, {
      fallbackCurrency: state.geo.currency,
      onProgress: ({ status, progress }) => setProgress(status === 'recognizing text' ? t('Text wird erkannt') : status, progress),
    });
  } catch (error) {
    if (generation !== state.generation) return;
    analysisResult = {
      merchant: '', amount: null, currency: state.geo?.currency || state.context.household.base_currency || 'CHF',
      date: dateInputValue(), suggestedCategoryName: null, rawText: '', confidence: 0, ocrConfidence: 0,
    };
    toast(`${t('OCR nicht verfügbar')}: ${String(error?.message || error)}. ${t('Du kannst den Beleg trotzdem manuell erfassen.')}`, 'error');
  }
  if (generation !== state.generation) return;
  state.analysis = analysisResult;

  const analysis = state.analysis;
  const merchant = document.querySelector('#receiptMerchant');
  const amount = document.querySelector('#receiptAmount');
  const currency = document.querySelector('#receiptCurrency');
  const date = document.querySelector('#receiptDate');
  const ocrText = document.querySelector('#receiptOcrText');
  const note = document.querySelector('#receiptNote');
  if (merchant) merchant.value = analysis.merchant || '';
  if (amount) amount.value = analysis.amount ? Number(analysis.amount).toFixed(2) : '';
  if (currency) currency.value = analysis.currency || state.context.household.base_currency || 'CHF';
  if (date) date.value = analysis.date || dateInputValue();
  if (ocrText) ocrText.textContent = analysis.rawText || '';
  if (note && !note.value && analysis.paymentMethod) note.value = `Zahlung: ${analysis.paymentMethod}`;
  selectSuggestedCategory(analysis);
  updateAccountChoices(currency?.value || state.context.household.base_currency || 'CHF');
  refreshMatches({ chooseBest: true });
  setProgress('Erkennung abgeschlossen', 1);

  if (!analysis.amount || !analysis.date || !analysis.merchant || analysis.merchant === 'Unbekannter Händler') {
    const alert = document.querySelector('#receiptMatchAlert');
    if (alert && alert.hidden) {
      alert.hidden = false;
      alert.innerHTML = `<strong>${t('Bitte kurz prüfen.')}</strong><span>${t('Nicht alle Belegdaten konnten eindeutig erkannt werden. Korrigiere die Felder vor dem Speichern.')}</span>`;
    }
  }
}

async function ensureMerchant(context, merchantName, categoryId, remember) {
  const key = normalizeMerchantKey(merchantName);
  if (!key) return null;
  let merchant = context.merchants.find((row) => row.normalized_key === key) || null;
  if (!merchant) {
    merchant = await financeApi.upsertMerchant({
      household_id: context.household.id,
      name: merchantName,
      normalized_key: key,
      default_category_id: remember && categoryId ? categoryId : null,
    });
  } else if (remember && categoryId && merchant.default_category_id !== categoryId) {
    merchant = await financeApi.updateMerchant(merchant.id, { name: merchantName, default_category_id: categoryId });
  }
  return merchant;
}

async function saveReceipt(form) {
  if (state.busy) return;
  if (!state.file) throw new Error(t('Bitte zuerst einen Beleg fotografieren oder auswählen.'));
  state.busy = true;
  const submit = form.querySelector('[type="submit"]');
  if (submit) submit.disabled = true;

  let createdTransaction = null;
  let uploadedPath = null;
  let createdDocument = null;
  try {
    const data = new FormData(form);
    const context = state.context || await loadContext();
    const merchantName = String(data.get('merchant') || '').trim();
    const amount = Math.abs(Number(data.get('amount') || 0));
    const currency = String(data.get('currency') || context.household.base_currency || 'CHF');
    const receiptDate = String(data.get('receiptDate') || '');
    const categoryId = String(data.get('categoryId') || '') || null;
    const note = String(data.get('note') || '').trim() || null;
    const remember = data.get('rememberMerchant') === 'on';
    const mode = String(data.get('mode') || 'new');

    if (!merchantName) throw new Error(t('Bitte den Händler angeben.'));
    if (!(amount > 0)) throw new Error(t('Bitte einen gültigen Betrag angeben.'));
    if (!receiptDate) throw new Error('Bitte das Belegdatum angeben.');
    if (categoryId && !context.categories.some((row) => row.id === categoryId && row.kind === 'expense')) throw new Error(t('Bitte eine Ausgabenkategorie auswählen.'));

    const merchant = await ensureMerchant(context, merchantName, categoryId, remember);
    let transaction;
    let linked = false;

    if (mode === 'link') {
      const transactionId = String(data.get('transactionId') || '');
      transaction = context.transactions.find((row) => row.id === transactionId);
      if (!transaction) throw new Error(t('Bitte eine passende Bankbuchung auswählen.'));
      const amountOk = Math.abs(Math.abs(Number(transaction.amount)) - amount) <= Math.max(0.02, amount * 0.002);
      if (transaction.status !== 'booked' || Number(transaction.amount) >= 0 || transaction.transfer_group_id || transaction.cashflow_type === 'debt_payment' || transaction.currency !== currency || !amountOk) {
        throw new Error(t('Die ausgewählte Bankbuchung passt nicht sicher zu diesem Beleg.'));
      }
      linked = true;
    } else {
      const accountId = String(data.get('accountId') || '');
      const account = context.accounts.find((row) => row.account_id === accountId);
      if (!account) throw new Error(t('Bitte ein Zahlungskonto auswählen.'));
      if (account.currency !== currency) throw new Error(t('Kontowährung und Belegwährung müssen übereinstimmen.'));

      const duplicates = findReceiptMatches({ transactions: context.transactions.filter((tx) => !context.receiptTransactionIds?.has(tx.id)), amount, currency, date: receiptDate, merchant: merchantName, limit: 6 });
      const safe = duplicates.filter((entry) => entry.highConfidence);
      if (safe.length === 1 && !confirm(t('Es gibt bereits eine sehr ähnliche Bankbuchung. Trotzdem eine neue Ausgabe anlegen?'))) return;

      transaction = await financeApi.createTransaction({
        household_id: context.household.id,
        account_id: account.account_id,
        category_id: categoryId,
        merchant_id: merchant?.id || null,
        occurred_at: financeEventTimestamp(receiptDate),
        amount: -amount,
        currency,
        description: merchantName,
        counterparty: merchantName,
        note,
        status: 'booked',
        source: 'manual',
      });
      createdTransaction = transaction;
    }

    uploadedPath = await financeApi.uploadDocument(context.household.id, state.file);
    createdDocument = await financeApi.createDocument({
      household_id: context.household.id,
      object_type: 'transaction',
      object_id: transaction.id,
      name: state.file.name || `beleg-${receiptDate}.jpg`,
      storage_path: uploadedPath,
      mime_type: state.file.type || 'image/jpeg',
      file_size: state.file.size,
      document_date: receiptDate,
      notes: 'Kassenbeleg · Fotoerfassung',
    });

    if (linked) {
      const patch = {};
      if (categoryId && !transaction.category_id) patch.category_id = categoryId;
      if (merchant?.id && !transaction.merchant_id) patch.merchant_id = merchant.id;
      if (!transaction.counterparty) patch.counterparty = merchantName;
      if (Object.keys(patch).length) {
        try {
          await financeApi.updateTransaction(transaction.id, patch);
        } catch (error) {
          if (createdDocument) await financeApi.deleteDocument(createdDocument).catch(() => null);
          createdDocument = null; uploadedPath = null;
          throw error;
        }
      }
    }

    resetState();
    toast(t(linked ? 'Beleg mit der vorhandenen Bankbuchung verknüpft.' : 'Beleg erkannt und Ausgabe gespeichert.'));
    // main.js owns the in-memory finance context. A short reload is the cleanest
    // way to refresh that context without duplicating its private state here.
    window.setTimeout(() => window.location.reload(), 550);
  } catch (error) {
    if (uploadedPath && !createdDocument) await financeApi.deleteStoredDocument(uploadedPath).catch(() => null);
    if (createdTransaction?.id) await financeApi.deleteTransaction(createdTransaction.id).catch(() => null);
    throw error;
  } finally {
    state.busy = false;
    if (submit) submit.disabled = false;
  }
}

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-action="receipt-camera"], [data-action="receipt-cancel"]');
  if (!trigger) return;
  if (trigger.dataset.action === 'receipt-camera') {
    event.preventDefault();
    document.querySelector('#receiptCameraInput')?.click();
  } else {
    event.preventDefault();
    resetState();
  }
});

document.addEventListener('change', async (event) => {
  const target = event.target;
  try {
    if (target.id === 'receiptCameraInput') {
      const file = target.files?.[0];
      if (file) await analyzeFile(file);
      return;
    }
    if (target.id === 'receiptMode') { setMode(target.value); return; }
    if (['receiptMerchant','receiptAmount','receiptCurrency','receiptDate'].includes(target.id)) {
      if (target.id === 'receiptCurrency') updateAccountChoices(target.value);
      refreshMatches();
    }
  } catch (error) {
    setProgress(t('Analyse fehlgeschlagen'), 0);
    toast(String(error?.message || error), 'error');
  }
});

document.addEventListener('submit', async (event) => {
  const form = event.target.closest('#receipt-create');
  if (!form) return;
  event.preventDefault();
  event.stopPropagation();
  try { await saveReceipt(form); }
  catch (error) { toast(String(error?.message || error), 'error'); }
});

window.addEventListener('hashchange', () => {
  if (!location.hash.startsWith('#/transactions')) resetState();
});
