function parseRecords(text, delimiter) {
  const rows = [];
  let row = [];
  let current = '';
  let quoted = false;
  const source = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { current += '"'; i += 1; }
      else quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      row.push(current.trim());
      current = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(current.trim());
      current = '';
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      continue;
    }
    current += char;
  }
  row.push(current.trim());
  if (row.some((value) => String(value).trim())) rows.push(row);
  return rows;
}

function detectDelimiter(text) {
  const candidates = [';', ',', '\t'];
  let best = ';';
  let bestScore = -1;
  for (const delimiter of candidates) {
    const records = parseRecords(text, delimiter).slice(0, 12).filter((row) => row.length > 1);
    if (!records.length) continue;
    const widths = records.map((row) => row.length);
    const frequency = new Map();
    for (const width of widths) frequency.set(width, (frequency.get(width) || 0) + 1);
    const consistency = Math.max(...frequency.values());
    const columns = widths.reduce((sum, width) => sum + width, 0) / widths.length;
    const score = consistency * 10 + columns;
    if (score > bestScore) { best = delimiter; bestScore = score; }
  }
  return best;
}

export function parseCsv(text) {
  const normalized = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!normalized) return { headers: [], rows: [], delimiter: ';' };
  const delimiter = detectDelimiter(normalized);
  const records = parseRecords(normalized, delimiter);
  if (!records.length) return { headers: [], rows: [], delimiter };

  let headerIndex = 0;
  const financeHeader = /(buchungsdatum|abschlussdatum|datum|date|belastung|gutschrift|betrag|amount|beschreibung|description)/i;
  const candidate = records.findIndex((row) => financeHeader.test(row.join(' ')) && row.length > 1);
  if (candidate >= 0) headerIndex = candidate;

  const headers = records[headerIndex].map((header, index) => String(header || '').trim() || `Spalte ${index + 1}`);
  const rows = records.slice(headerIndex + 1).map((values) => (
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  )).filter((row) => Object.values(row).some((value) => String(value).trim()));

  return { headers, rows, delimiter };
}

export function guessMapping(headers) {
  const find = (...patterns) => headers.find((h) => patterns.some((p) => p.test(h))) || '';
  return {
    date: find(/buchungsdatum/i, /abschlussdatum/i, /^datum$/i, /date/i, /valuta/i),
    description: find(/beschreibung1/i, /beschreibung/i, /description/i, /text/i, /details/i),
    counterparty: find(/auftraggeber/i, /beguenst/i, /begünst/i, /counterparty/i, /empfaenger/i, /empfänger/i),
    counterpartyAccount: find(/gegenkonto/i, /gegen.*iban/i, /empfaenger.*iban/i, /empfänger.*iban/i, /auftraggeber.*iban/i, /^iban$/i, /account.*iban/i, /counterparty.*account/i),
    bankReference: find(/referenz/i, /reference/i, /zahlungszweck/i, /mitteilung/i, /meldung/i, /purpose/i),
    sourcePage: find(/pdf.*seite/i, /^seite$/i, /source.*page/i),
    rawData: find(/original/i, /raw/i),
    debit: find(/belastung/i, /debit/i, /soll/i),
    credit: find(/gutschrift/i, /credit/i, /haben/i),
    amount: find(/^betrag$/i, /amount/i),
  };
}

export function parseAmount(value) {
  let text = String(value ?? '').trim();
  if (!text) return null;
  text = text.replace(/[A-Z]{3}/gi, '').replace(/[\s']/g, '');
  const comma = text.lastIndexOf(',');
  const dot = text.lastIndexOf('.');
  if (comma > dot) text = text.replace(/\./g, '').replace(',', '.');
  else if (dot > comma && comma >= 0) text = text.replace(/,/g, '');
  else text = text.replace(',', '.');
  text = text.replace(/[^0-9+\-.]/g, '');
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function parseDate(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const iso = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12).toISOString();
  const eu = text.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/);
  if (eu) {
    let year = Number(eu[3]);
    if (year < 100) year += 2000;
    return new Date(year, Number(eu[2]) - 1, Number(eu[1]), 12).toISOString();
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function rowToTransaction(row, mapping) {
  const date = parseDate(row[mapping.date]);
  const description = String(row[mapping.description] || '').trim() || 'Importierte Transaktion';
  const counterparty = mapping.counterparty ? String(row[mapping.counterparty] || '').trim() : '';
  const counterpartyAccountRef = mapping.counterpartyAccount ? String(row[mapping.counterpartyAccount] || '').trim() : '';
  const bankReference = mapping.bankReference ? String(row[mapping.bankReference] || '').trim() : '';
  const sourcePageRaw = mapping.sourcePage ? String(row[mapping.sourcePage] || '').trim() : '';
  const sourcePage = Number(sourcePageRaw);
  const importedRaw = mapping.rawData ? String(row[mapping.rawData] || '').trim() : '';

  let amount = null;
  if (mapping.amount) amount = parseAmount(row[mapping.amount]);
  else {
    const credit = mapping.credit ? parseAmount(row[mapping.credit]) : null;
    const debit = mapping.debit ? parseAmount(row[mapping.debit]) : null;
    if (credit !== null && credit !== 0) amount = Math.abs(credit);
    else if (debit !== null && debit !== 0) amount = -Math.abs(debit);
  }

  if (!date || amount === null || amount === 0) return null;
  return {
    occurred_at: date,
    amount,
    description,
    counterparty: counterparty || null,
    counterparty_account_ref: counterpartyAccountRef || null,
    bank_reference: bankReference || null,
    import_source_page: Number.isInteger(sourcePage)&&sourcePage>0 ? sourcePage : null,
    import_raw_data: {
      row: row && typeof row==='object' ? {...row} : row,
      raw_text: importedRaw || null,
    },
  };
}

export function applyCategoryRules(tx, rules) {
  for (const rule of rules || []) {
    if (!rule.active) continue;
    const source = String(tx[rule.field_name] || '').toLowerCase();
    const match = String(rule.match_value || '').toLowerCase();
    let ok = false;
    if (rule.match_type === 'exact') ok = source === match;
    else if (rule.match_type === 'starts_with') ok = source.startsWith(match);
    else ok = source.includes(match);
    if (ok) return rule.category_id;
  }
  return null;
}

export async function transactionFingerprint(accountId, tx) {
  const raw = `${accountId}|${tx.occurred_at}|${Number(tx.amount).toFixed(2)}|${tx.description}|${tx.counterparty || ''}`;
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function normalizeMerchantKey(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' und ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function stripPaymentProcessor(value, rawContext='') {
  let text=String(value||'').trim();
  let paymentProcessor=/\btwint\b/i.test(String(rawContext||value||''))?'TWINT':null;

  const sumup=text.match(/(?:^|\b)(?:bezug\s+)?sumup\s*\*\s*(.+)$/i);
  if(sumup?.[1]){
    paymentProcessor='SumUp';
    text=sumup[1].trim();
  }

  const twintPrefix=text.match(/^(?:ubs\s+)?twint\s*[:*\-]?\s*(.+)$/i);
  if(twintPrefix?.[1]) {
    paymentProcessor='TWINT';
    text=twintPrefix[1].trim();
  }

  text=text
    .replace(/\s*(?:[-/]|\s)\s*(?:ubs\s+)?twint\b.*$/i,'')
    .replace(/\s*\b(?:zahlung|belastung|gutschrift|eingang|ausgang|uebertrag|übertrag)\b\s+(?:ubs\s+)?twint\b.*$/i,'')
    .trim();

  return {text,paymentProcessor};
}

function isPaymentNoisePart(value) {
  const text=String(value||'').trim();
  if(!text) return true;
  if(/^bezug\s+sumup\s*\*/i.test(text)) return false;
  return /^(?:zahlung|belastung|gutschrift|eingang|ausgang|uebertrag|übertrag|buchung|kartenzahlung|karten(?:zahlung)?|debit\s*card|credit\s*card|maestro|mastercard|visa|pos|e-?commerce|bezug|ubs(?:\s+twint)?|twint)(?:\b|\s)/i.test(text);
}

function stripVolatileMerchantSuffix(value) {
  let text=String(value||'').trim();
  let previous='';
  while(text && text!==previous){
    previous=text;
    text=text
      .replace(/(?:\s+|[,;\-–]\s*)\b(?:0?[1-9]|[12]\d|3[01])[.\/-](?:0?[1-9]|1[0-2])[.\/-](?:19|20)\d{2}\b(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?\s*$/i,'')
      .replace(/(?:\s+|[,;\-–]\s*)\b(?:19|20)\d{2}[.\/-](?:0?[1-9]|1[0-2])[.\/-](?:0?[1-9]|[12]\d|3[01])\b(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?\s*$/i,'')
      .replace(/\s+/g,' ')
      .trim();
  }
  return text;
}

function canonicalMerchantIdentity(name) {
  const text=String(name||'').trim();
  if(/migros\s+(?:restaurant|take\s*away|gastronomie)|(?:restaurant|take\s*away|gastronomie).*migros/i.test(text)) return {name:'Migros Restaurant',key:'migros restaurant'};
  if(/coop\s+(?:restaurant|take\s*away|gastronomie)|(?:restaurant|take\s*away|gastronomie).*coop/i.test(text)) return {name:'Coop Restaurant',key:'coop restaurant'};
  if(/\bsbb\b|\bcff\b|\bffs\b/i.test(text)) return {name:'SBB',key:'sbb'};
  if(/\bedeka\b|\bedk\*/i.test(text)) return {name:'EDEKA',key:'edeka'};
  if(/\bmigros\b/i.test(text)) return {name:'Migros',key:'migros'};
  if(/\bcoop\b/i.test(text)) return {name:'Coop',key:'coop'};
  if(/\bdenner\b/i.test(text)) return {name:'Denner',key:'denner'};
  if(/\baldi\b(?:\s+suisse)?\s+mobile\b/i.test(text)) return {name:'ALDI SUISSE MOBILE',key:'aldi suisse mobile'};
  if(/\baldi\b/i.test(text)) return {name:'Aldi Suisse',key:'aldi suisse'};
  if(/\blidl\b/i.test(text)) return {name:'Lidl',key:'lidl'};
  if(/\bparkingpay\b/i.test(text)) return {name:'ParkingPay',key:'parkingpay'};
  if(/\bswisslos\b|euro\s*millions?|eurodreams?/i.test(text)) return {name:'Swisslos',key:'swisslos'};
  if(/\belvetino\b/i.test(text)) return {name:'Elvetino',key:'elvetino'};
  if(/\bserafe\b/i.test(text)) return {name:'Serafe',key:'serafe'};
  if(/\bsp\s+motori\b/i.test(text)) return {name:'SP Motori',key:'sp motori'};
  return null;
}

export function merchantFromTransaction(tx) {
  const raw = String(tx?.counterparty || tx?.description || '').trim();
  const parts = raw.split(';').map((part)=>part.trim()).filter(Boolean);
  let merchantRaw = parts[0] || raw;

  if(parts.length>1){
    const meaningful=parts.find((part)=>!isPaymentNoisePart(part));
    if(isPaymentNoisePart(merchantRaw) && meaningful) merchantRaw=meaningful;
    else if(
      !/^bezug\s+sumup\b/i.test(merchantRaw)
      && /^(kartenzahlung|karten(?:zahlung)?|debit\s*card|credit\s*card|maestro|mastercard|visa|pos|e-?commerce|zahlung|belastung|gutschrift|eingang|ausgang|bezug)\b/i.test(merchantRaw)
    ) merchantRaw=meaningful||parts[1]||merchantRaw;
  }

  const processor=stripPaymentProcessor(merchantRaw,raw);
  merchantRaw=processor.text||merchantRaw;

  let name = merchantRaw
    .replace(/^(kartenzahlung|karten(?:zahlung)?|debit\s*card|credit\s*card|maestro|mastercard|visa|pos|e-?commerce|bezug)\s*[:\-–]?\s*/i, '')
    .replace(/\b(?:terminal|term|beleg|referenz|reference|ref|transaktion|transaction|auth|karte|card)\s*[:#]?\s*[A-Z0-9*\-]{5,}\b/gi, ' ')
    .replace(/\b\d{8,}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!name) name = merchantRaw || raw || 'Unbekannter Händler';
  const rawName=name.length>120 ? name.slice(0,120).trim() : name;
  name=stripVolatileMerchantSuffix(name) || rawName;
  if (name.length > 80) name = name.slice(0, 80).trim();

  const canonical=canonicalMerchantIdentity(name);
  if(canonical){
    return {
      ...canonical,
      rawName,
      aliasKey:normalizeMerchantKey(rawName),
      sourceField:tx?.counterparty ? 'counterparty' : 'description',
      paymentProcessor:processor.paymentProcessor,
      known:true,
    };
  }

  const known = knownMerchantSuggestion({...tx,counterparty:name,description:name});
  if (known && !known.generic) {
    return {
      name:known.name,
      key:known.key,
      rawName,
      aliasKey:normalizeMerchantKey(rawName),
      sourceField:tx?.counterparty ? 'counterparty' : 'description',
      paymentProcessor:processor.paymentProcessor,
      known:true,
    };
  }

  return {
    name,
    key: normalizeMerchantKey(name) || normalizeMerchantKey(merchantRaw) || normalizeMerchantKey(raw) || 'unbekannt',
    rawName,
    aliasKey:normalizeMerchantKey(rawName),
    sourceField: tx?.counterparty ? 'counterparty' : 'description',
    paymentProcessor:processor.paymentProcessor,
  };
}

export function resolveCanonicalMerchant(detected,{merchants=[],aliases=[]}={}) {
  if(!detected) return null;
  const aliasKey=detected.aliasKey||detected.key;
  const alias=aliases.find((row)=>row.normalized_key===aliasKey||row.normalized_key===detected.key);
  if(alias){
    const merchant=merchants.find((row)=>row.id===alias.merchant_id);
    if(merchant) return merchant;
  }
  const exact=merchants.find((row)=>row.normalized_key===detected.key);
  if(exact) return exact;

  const canonical=canonicalMerchantIdentity(detected.name);
  if(canonical){
    const brand=merchants.find((row)=>row.normalized_key===canonical.key);
    if(brand) return brand;
  }
  return null;
}

const KNOWN_MERCHANT_LIBRARY = Object.freeze([
  { pattern:/\bswisslos\b|euro\s*millions?|eurodreams?/i, name:'Swisslos', key:'swisslos', category:'Lotterie & Gewinnspiele' },
  { pattern:/\belvetino\b/i, name:'Elvetino', key:'elvetino', category:'Restaurant & Café' },
  { pattern:/\bedeka\b|\bedk\*/i, name:'EDEKA', key:'edeka', category:'Lebensmittel' },
  { pattern:/\bserafe\b/i, name:'Serafe', key:'serafe', category:'Haushaltsabgaben' },
  { pattern:/\bsp\s+motori\b/i, name:'SP Motori', key:'sp motori', category:'Mietfahrzeug' },
  { pattern:/\b(?:restaurant|ristorante|pizzeria|kebab|imbiss|cafe|café|smashburger|barliner)\b/i, name:null, key:null, category:'Restaurant & Café' },
  { pattern:/\b(?:garage|officina|werkstatt|reparatur|riparazione|pneu|reifen)\b/i, name:null, key:null, category:'Wartung & Reparatur' },
  { pattern:/\b(?:noleggio|mietroller|rollermiete|scooter\s*rental|rent\s*a\s*scooter|mietfahrzeug)\b/i, name:null, key:null, category:'Mietfahrzeug' },
  { pattern:/\b(?:blumen|florist|fiori|grabpflege|gedenken)\b/i, name:null, key:null, category:'Geschenke & Gedenken' },
  { pattern:/migros\s+(?:restaurant|take\s*away|gastronomie)|(?:restaurant|take\s*away|gastronomie).*migros/i, name:'Migros Restaurant', key:'migros restaurant', category:'Restaurant & Café' },
  { pattern:/coop\s+(?:restaurant|take\s*away|gastronomie)|(?:restaurant|take\s*away|gastronomie).*coop/i, name:'Coop Restaurant', key:'coop restaurant', category:'Restaurant & Café' },
  { pattern:/\bmcdonald['’]?s?\b|\bmcdonalds\b/i, name:"McDonald's", key:'mcdonalds', category:'Restaurant & Café' },
  { pattern:/\bmigros\b/i, name:'Migros', key:'migros', category:'Lebensmittel' },
  { pattern:/\bcoop\b/i, name:'Coop', key:'coop', category:'Lebensmittel' },
  { pattern:/\bdenner\b/i, name:'Denner', key:'denner', category:'Lebensmittel' },
  { pattern:/\baldi\b(?:\s+suisse)?\s+mobile\b/i, name:'ALDI SUISSE MOBILE', key:'aldi suisse mobile', category:'Telefon & Internet' },
  { pattern:/\baldi\b/i, name:'Aldi Suisse', key:'aldi suisse', category:'Lebensmittel' },
  { pattern:/\blidl\b/i, name:'Lidl', key:'lidl', category:'Lebensmittel' },
  { pattern:/media\s*markt|mediamarkt/i, name:'MediaMarkt', key:'mediamarkt', category:'Shopping' },
  { pattern:/\bdigitec\b/i, name:'Digitec', key:'digitec', category:'Shopping' },
  { pattern:/\bgalaxus\b/i, name:'Galaxus', key:'galaxus', category:'Shopping' },
  { pattern:/\bsanitas\b/i, name:'Sanitas', key:'sanitas', category:'Krankenkasse' },
  { pattern:/groupe\s+mutuel|avenir\s+assurance\s+maladie/i, name:'Groupe Mutuel / Avenir', key:'groupe mutuel avenir', category:'Krankenkasse' },
  { pattern:/\bhelsana\b/i, name:'Helsana', key:'helsana', category:'Krankenkasse' },
  { pattern:/\bswica\b/i, name:'Swica', key:'swica', category:'Krankenkasse' },
  { pattern:/\bsbb\b|\bcff\b|\bffs\b/i, name:'SBB', key:'sbb', category:'Mobilität' },
  { pattern:/\bvbsg\b|verkehrsbetriebe\s+st\.?\s*gall/i, name:'VBSG / Verkehrsbetriebe', key:'vbsg', category:'Mobilität' },
  { pattern:/parkingpay/i, name:'ParkingPay', key:'parkingpay', category:'Mobilität' },
  { pattern:/\bwellauer\b/i, name:'Wellauer AG', key:'wellauer ag', category:'Tabak' },
  { pattern:/\bnetflix\b/i, name:'Netflix', key:'netflix', category:'Abos & Verträge' },
  { pattern:/\bsunrise\b|\byallo\b/i, name:'Sunrise / Yallo', key:'sunrise yallo', category:'Abos & Verträge' },
]);

export function knownMerchantSuggestion(tx) {
  const raw=`${tx?.counterparty||''} ${tx?.description||''}`.trim();
  const match=KNOWN_MERCHANT_LIBRARY.find((entry)=>entry.pattern.test(raw)) || null;
  if(!match) return null;
  if(match.name&&match.key) return match;
  const detected=stripPaymentProcessor(raw).text||raw;
  return {
    ...match,
    name:detected.replace(/\s+/g,' ').trim().slice(0,80),
    key:normalizeMerchantKey(detected),
    generic:true,
  };
}

export function suggestKnownCategoryCandidates(tx) {
  const detected=merchantFromTransaction(tx);
  const purpose=[detected?.name||tx?.counterparty||tx?.description||'',tx?.note||''].filter(Boolean).join(' ');
  const probe={...tx,counterparty:detected?.name||tx?.counterparty,description:purpose};
  const category=knownMerchantSuggestion(probe)?.category||null;
  if(!category) return [];
  const fallback={
    'Restaurant & Café':['Restaurant & Café','Restaurant','Freizeit'],
    'Haushaltsabgaben':['Haushaltsabgaben','Wohnen'],
    'Mietfahrzeug':['Mietfahrzeug','Mobilität'],
    'Wartung & Reparatur':['Wartung & Reparatur','Mobilität'],
    'Geschenke & Gedenken':['Geschenke & Gedenken','Freizeit'],
    'Lotterie & Gewinnspiele':['Lotterie & Gewinnspiele','Freizeit'],
  };
  return fallback[category]||[category];
}

export function suggestKnownCategoryName(tx) {
  return suggestKnownCategoryCandidates(tx)[0]||null;
}
