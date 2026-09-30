import { knownMerchantSuggestion, normalizeMerchantKey, suggestKnownCategoryName } from './csv-import.js';

const TESSERACT_VERSION = '5.1.1';
const TESSERACT_BASE = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist`;
const TESSERACT_SCRIPT = `${TESSERACT_BASE}/tesseract.min.js`;
const TESSERACT_WORKER = `${TESSERACT_BASE}/worker.min.js`;

let tesseractPromise = null;

function normalizeSpaces(value) {
  return String(value || '').replace(/[\u00a0\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function safeDate(year, month, day) {
  const date = new Date(year, month - 1, day, 12, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateCandidates(text) {
  const found = [];
  const source = String(text || '');
  const patterns = [
    /\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})\b/g,
    /\b(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})\b/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source))) {
      let year;
      let month;
      let day;
      if (String(match[1]).length === 4) {
        year = Number(match[1]); month = Number(match[2]); day = Number(match[3]);
      } else {
        day = Number(match[1]); month = Number(match[2]); year = Number(match[3]);
        if (year < 100) year += 2000;
      }
      const date = safeDate(year, month, day);
      if (date) found.push({ date, index: match.index });
    }
  }
  return found;
}

function parseMoney(value) {
  let source = String(value || '').trim();
  if (!source) return null;
  source = source
    .replace(/\b(?:CHF|EUR|USD|GBP|SFR|FR)\.?\b/gi, '')
    .replace(/[’'\s]/g, '')
    .replace(/[^0-9,.-]/g, '');
  if (!source || !/\d/.test(source)) return null;
  const lastComma = source.lastIndexOf(',');
  const lastDot = source.lastIndexOf('.');
  if (lastComma > lastDot) source = source.replace(/\./g, '').replace(',', '.');
  else if (lastDot > lastComma) source = source.replace(/,/g, '');
  else source = source.replace(',', '.');
  const number = Number(source);
  return Number.isFinite(number) ? Math.abs(number) : null;
}

function amountCandidates(lines) {
  const result = [];
  const amountPattern = /(?:\b(?:CHF|EUR|USD|GBP|SFR|FR)\.?\s*)?\d{1,6}(?:[’'\s.]\d{3})*(?:[.,]\d{2})\b/gi;
  lines.forEach((line, lineIndex) => {
    let match;
    while ((match = amountPattern.exec(line))) {
      const amount = parseMoney(match[0]);
      if (!amount || amount > 1_000_000) continue;
      const lower = line.toLowerCase();
      let score = (lineIndex / Math.max(1, lines.length - 1)) * 2;
      if (/\b(total|gesamt|summe|endbetrag|zu\s+zahlen|zahlbetrag|amount\s+due|grand\s+total)\b/i.test(line)) score += 12;
      if (/\b(kartenzahlung|visa|mastercard|maestro|twint|payment|bezahlt|betrag)\b/i.test(line)) score += 3;
      if (/\b(chf|eur|usd|gbp|sfr|fr\.)\b/i.test(line)) score += 2;
      if (/\b(mwst|ust|vat|steuer|tax|wechselgeld|r[uü]ckgeld|change|gegeben|cash\s+received|bar\s+gegeben|subtotal|zwischensumme)\b/i.test(lower)) score -= 8;
      result.push({ amount, line, lineIndex, score });
    }
  });
  return result;
}

function currencyFromText(text, fallback = 'CHF') {
  const source = String(text || '');
  if (/\b(?:CHF|SFR|Fr\.)\b/i.test(source)) return 'CHF';
  if (/\bEUR\b|€/i.test(source)) return 'EUR';
  if (/\bUSD\b|\$/i.test(source)) return 'USD';
  if (/\bGBP\b|£/i.test(source)) return 'GBP';
  return fallback;
}

function fallbackMerchant(lines) {
  const ignored = /^(beleg|quittung|receipt|rechnung|invoice|kassenbon|danke|thank\s+you|www\.|tel\.?|telefon|datum|date|zeit|time|filiale|store)\b/i;
  for (const raw of lines.slice(0, 10)) {
    const line = normalizeSpaces(raw);
    if (line.length < 3 || line.length > 70) continue;
    if (ignored.test(line)) continue;
    if (!/[A-Za-zÄÖÜäöüß]{3}/.test(line)) continue;
    if (/\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}/.test(line)) continue;
    if (/^[\d\s.,:'’-]+$/.test(line)) continue;
    return line.replace(/\s{2,}/g, ' ').slice(0, 70);
  }
  return 'Unbekannter Händler';
}

function tokenSimilarity(a, b) {
  const left = new Set(normalizeMerchantKey(a).split(' ').filter((token) => token.length > 1));
  const right = new Set(normalizeMerchantKey(b).split(' ').filter((token) => token.length > 1));
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return overlap / Math.max(left.size, right.size);
}

function dateDistanceDays(a, b) {
  const left = new Date(`${a}T12:00:00`);
  const right = new Date(b);
  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return 999;
  return Math.abs(left.getTime() - right.getTime()) / 86_400_000;
}

async function loadTesseract() {
  if (globalThis.Tesseract?.createWorker) return globalThis.Tesseract;
  if (!tesseractPromise) {
    tesseractPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-finance-tesseract]');
      if (existing) {
        existing.addEventListener('load', () => resolve(globalThis.Tesseract), { once: true });
        existing.addEventListener('error', () => reject(new Error('OCR-Bibliothek konnte nicht geladen werden.')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = TESSERACT_SCRIPT;
      script.async = true;
      script.dataset.financeTesseract = 'true';
      script.onload = () => globalThis.Tesseract?.createWorker ? resolve(globalThis.Tesseract) : reject(new Error('OCR-Bibliothek ist nicht verfügbar.'));
      script.onerror = () => reject(new Error('OCR-Bibliothek konnte nicht geladen werden.'));
      document.head.appendChild(script);
    });
  }
  return tesseractPromise;
}

async function loadImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;

    if (typeof image.decode === 'function') {
      try { await image.decode(); }
      catch {
        // Safari/iPhone can reject decode() for a freshly captured image even
        // though the normal image loader can still display and draw it.
      }
    }

    if (!image.complete || !image.naturalWidth) {
      await new Promise((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Das iPhone-Foto konnte nicht gelesen werden.'));
      });
    }
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Das Belegfoto konnte nicht dekodiert werden.');
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function prepareImage(file) {
  const image = await loadImage(file);
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longest > 1800 ? 1800 / longest : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  if ('filter' in context) context.filter = 'grayscale(1) contrast(1.18)';
  context.drawImage(image, 0, 0, width, height);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.9));
}

export function parseReceiptText(text, { fallbackCurrency = 'CHF' } = {}) {
  const rawText = String(text || '').replace(/\r/g, '');
  const lines = rawText.split('\n').map(normalizeSpaces).filter(Boolean);
  const known = knownMerchantSuggestion({ description: rawText, counterparty: '' });
  const merchant = known?.name || fallbackMerchant(lines);
  const suggestedCategoryName = known?.category || suggestKnownCategoryName({ description: rawText, counterparty: merchant }) || null;

  const amounts = amountCandidates(lines).sort((a, b) => b.score - a.score || b.amount - a.amount);
  const amount = amounts[0]?.amount || null;
  const currency = currencyFromText(rawText, fallbackCurrency);

  const dates = dateCandidates(rawText);
  const now = new Date();
  const futureLimit = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 23, 59, 59);
  const pastLimit = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
  const plausibleDates = dates.filter(({ date }) => date <= futureLimit && date >= pastLimit);
  plausibleDates.sort((a, b) => Math.abs(now - a.date) - Math.abs(now - b.date));
  const date = plausibleDates[0]?.date ? isoDate(plausibleDates[0].date) : null;

  let confidence = 0;
  if (known) confidence += 0.35;
  else if (merchant && merchant !== 'Unbekannter Händler') confidence += 0.18;
  if (amount) confidence += amounts[0]?.score >= 8 ? 0.4 : 0.22;
  if (date) confidence += 0.2;
  if (currency) confidence += 0.05;

  return {
    merchant,
    merchantKey: normalizeMerchantKey(merchant),
    suggestedCategoryName,
    amount,
    currency,
    date,
    confidence: Math.min(1, confidence),
    rawText,
    amountEvidence: amounts[0]?.line || null,
  };
}

export function findReceiptMatches({
  transactions = [],
  amount,
  currency,
  date,
  merchant,
  limit = 5,
} = {}) {
  const targetAmount = Number(amount);
  if (!(targetAmount > 0) || !currency || !date) return [];
  const matches = [];
  for (const tx of transactions) {
    if (tx.status !== 'booked' || Number(tx.amount) >= 0 || tx.transfer_group_id || tx.cashflow_type === 'debt_payment') continue;
    if (tx.currency !== currency) continue;
    const delta = Math.abs(Math.abs(Number(tx.amount)) - targetAmount);
    const amountTolerance = Math.max(0.02, targetAmount * 0.002);
    if (delta > amountTolerance) continue;
    const days = dateDistanceDays(date, tx.occurred_at);
    if (days > 5) continue;
    const searchable = `${tx.merchants?.name || ''} ${tx.counterparty || ''} ${tx.description || ''}`;
    const receiptKnown = knownMerchantSuggestion({ description:merchant, counterparty:'' });
    const transactionKnown = knownMerchantSuggestion({ description:searchable, counterparty:'' });
    const merchantSimilarity = receiptKnown && transactionKnown && receiptKnown.key === transactionKnown.key
      ? 1
      : tokenSimilarity(merchant, searchable);
    let score = 50;
    if (delta <= 0.01) score += 20;
    score += Math.max(0, 20 - days * 4);
    score += merchantSimilarity * 20;
    matches.push({ tx, score, days, amountDelta: delta, merchantSimilarity });
  }
  return matches
    .sort((a, b) => b.score - a.score || a.days - b.days)
    .slice(0, limit)
    .map((entry) => ({ ...entry, highConfidence: entry.score >= 86 && entry.merchantSimilarity >= 0.34 }));
}

export async function analyzeReceiptImage(file, {
  fallbackCurrency = 'CHF',
  onProgress = () => {},
} = {}) {
  if (!(file instanceof Blob) || !file.size) throw new Error('Bitte ein Belegfoto auswählen.');
  if (!String(file.type || '').startsWith('image/')) throw new Error('Für die Belegerkennung wird ein Foto bzw. Bild benötigt.');
  const tesseract = await loadTesseract();
  onProgress({ status: 'Bild wird vorbereitet', progress: 0.05 });
  const prepared = await prepareImage(file);

  let worker = null;
  let lastError = null;
  for (const languages of ['deu+eng', 'deu', 'eng']) {
    try {
      worker = await tesseract.createWorker(languages, 1, {
        workerPath: TESSERACT_WORKER,
        logger: (message) => {
          if (message?.status === 'recognizing text') onProgress({ status: 'Text wird erkannt', progress: Number(message.progress || 0) });
          else if (message?.status) onProgress({ status: message.status, progress: Number(message.progress || 0) });
        },
      });
      break;
    } catch (error) {
      lastError = error;
      worker = null;
    }
  }
  if (!worker) throw lastError || new Error('OCR konnte nicht gestartet werden.');

  try {
    const result = await worker.recognize(prepared);
    const parsed = parseReceiptText(result?.data?.text || '', { fallbackCurrency });
    return {
      ...parsed,
      ocrConfidence: Number(result?.data?.confidence || 0) / 100,
    };
  } finally {
    await worker.terminate();
  }
}
