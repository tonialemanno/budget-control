const PDFJS_VERSION = '4.10.38';
const PDFJS_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;
let pdfJsPromise = null;

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import(`${PDFJS_BASE}/pdf.min.mjs`).then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.mjs`;
      return pdfjs;
    });
  }
  return pdfJsPromise;
}

function parsePdfDate(text) {
  const value = normalize(text);
  let match = value.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/);
  if (match) {
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    const month = Number(match[2]);
    const day = Number(match[1]);
    if (year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${String(day).padStart(2,'0')}.${String(month).padStart(2,'0')}.${year}`;
    }
  }
  match = value.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${String(day).padStart(2,'0')}.${String(month).padStart(2,'0')}.${year}`;
    }
  }
  return null;
}

function parsePdfAmount(text) {
  let value = normalize(text);
  if (!value) return null;
  const explicitNegative = /^\(.*\)$/.test(value) || /^-/.test(value) || /-$/.test(value) || /\b(?:DR|SOLL)\b/i.test(value);
  const explicitPositive = /^\+/.test(value) || /\b(?:CR|HABEN)\b/i.test(value);
  value = value
    .replace(/[()]/g, '')
    .replace(/\b(?:CHF|EUR|USD|GBP|DR|CR|SOLL|HABEN)\b/gi, '')
    .replace(/[+\-]/g, '')
    .replace(/[\s'’‘]/g, '');
  if (!/^\d{1,3}(?:[.,]\d{3})*[.,]\d{2}$/.test(value) && !/^\d+[.,]\d{2}$/.test(value)) return null;
  const comma = value.lastIndexOf(',');
  const dot = value.lastIndexOf('.');
  if (comma > dot) value = value.replace(/\./g, '').replace(',', '.');
  else value = value.replace(/,/g, '');
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return { amount: explicitNegative ? -number : number, explicitSign: explicitNegative || explicitPositive };
}

function lineGroups(items) {
  const groups = [];
  const tolerance = 2.5;
  for (const item of items) {
    const str = normalize(item.str);
    if (!str) continue;
    const x = Number(item.transform?.[4] || 0);
    const y = Number(item.transform?.[5] || 0);
    let group = groups.find((entry) => Math.abs(entry.y - y) <= tolerance);
    if (!group) {
      group = { y, items: [] };
      groups.push(group);
    }
    group.items.push({ str, x, y, width: Number(item.width || 0) });
  }
  groups.sort((a,b) => b.y - a.y);
  for (const group of groups) group.items.sort((a,b) => a.x - b.x);
  return groups;
}

export function detectColumns(lines) {
  const tests = {
    debit: /^(?:belastung|debit|soll)$/i,
    credit: /^(?:gutschrift|credit|haben)$/i,
    amount: /^(?:betrag|amount)$/i,
    balance: /^(?:saldo|balance|kontostand)$/i,
  };

  // Column names must come from a real table header. Transaction descriptions
  // can contain words such as "Belastung UBS TWINT" or "Gutschrift UBS TWINT";
  // counting those as headers shifts the detected columns and causes unsigned
  // credits to be discarded.
  const headerCandidates = (lines || []).map((line) => {
    const matched = {};
    for (const item of line.items || []) {
      const value = normalize(item.str);
      for (const [key, regex] of Object.entries(tests)) {
        if (regex.test(value) && matched[key] === undefined) matched[key] = item.x;
      }
    }
    const keys = Object.keys(matched);
    const hasFlowColumn = matched.debit !== undefined || matched.credit !== undefined || matched.amount !== undefined;
    const score = keys.length
      + (matched.debit !== undefined && matched.credit !== undefined ? 4 : 0)
      + (matched.balance !== undefined ? 2 : 0);
    return { matched, keys, hasFlowColumn, score };
  }).filter((entry) => entry.hasFlowColumn && entry.keys.length >= 2);

  headerCandidates.sort((a,b) => b.score - a.score);
  const header = headerCandidates[0]?.matched || null;
  if (header) {
    return {
      debit: header.debit ?? null,
      credit: header.credit ?? null,
      amount: header.amount ?? null,
      balance: header.balance ?? null,
    };
  }

  // Conservative fallback for simpler statements: only accept exact, standalone
  // header labels. This deliberately ignores prose in transaction descriptions.
  const positions = { debit: [], credit: [], amount: [], balance: [] };
  for (const line of lines || []) {
    for (const item of line.items || []) {
      const value = normalize(item.str);
      for (const [key, regex] of Object.entries(tests)) {
        if (regex.test(value)) positions[key].push(item.x);
      }
    }
  }
  const median = (values) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a,b)=>a-b);
    return sorted[Math.floor(sorted.length/2)];
  };
  return Object.fromEntries(Object.entries(positions).map(([key,values])=>[key,median(values)]));
}

function distance(a,b) {
  return a === null || b === null ? Number.POSITIVE_INFINITY : Math.abs(a-b);
}

export function chooseAmount(line, columns) {
  const candidates = line.items
    .map((item,index)=>({ item, index, parsed:parsePdfAmount(item.str) }))
    .filter((entry)=>entry.parsed);
  if (!candidates.length) return null;

  const signed = candidates.filter((entry)=>entry.parsed.explicitSign);
  if (signed.length === 1) return { ...signed[0], amount:signed[0].parsed.amount };

  const columnChoices = [];
  for (const candidate of candidates) {
    if (columns.debit !== null) columnChoices.push({ candidate, distance:distance(candidate.item.x,columns.debit), sign:-1 });
    if (columns.credit !== null) columnChoices.push({ candidate, distance:distance(candidate.item.x,columns.credit), sign:1 });
    if (columns.amount !== null) columnChoices.push({ candidate, distance:distance(candidate.item.x,columns.amount), sign:null });
  }
  columnChoices.sort((a,b)=>a.distance-b.distance);
  const best = columnChoices[0];
  if (best && best.distance <= 45) {
    const raw = Math.abs(best.candidate.parsed.amount);
    if (best.sign !== null) return { ...best.candidate, amount:raw * best.sign };
    if (best.candidate.parsed.explicitSign) return { ...best.candidate, amount:best.candidate.parsed.amount };
  }

  const text = line.items.map((item)=>item.str).join(' ');
  if (candidates.length === 1) {
    const only = candidates[0];
    if (/\b(belastung|debit|soll)\b/i.test(text)) return { ...only, amount:-Math.abs(only.parsed.amount) };
    if (/\b(gutschrift|credit|haben)\b/i.test(text)) return { ...only, amount:Math.abs(only.parsed.amount) };
  }
  return null;
}

function descriptionFor(line, dateIndex, amountIndex, columns) {
  return normalize(line.items
    .filter((item,index)=>{
      if (index === dateIndex || index === amountIndex) return false;
      if (columns.balance !== null && Math.abs(item.x-columns.balance) <= 45 && parsePdfAmount(item.str)) return false;
      if (/^(CHF|EUR|USD|GBP)$/i.test(item.str)) return false;
      return true;
    })
    .map((item)=>item.str)
    .join(' '));
}

function pdfLineText(line) {
  return normalize((line?.items||[]).map((item)=>item.str).join(' '));
}

function looksLikePdfHeader(text) {
  return /^(?:buchungsdatum|datum|beschreibung|belastung|gutschrift|valuta|saldo|kontostand|betrag|debit|credit|soll|haben)(?:\s|$)/i.test(normalize(text));
}

function extractIban(text) {
  const compact=String(text||'').toUpperCase().replace(/\s+/g,' ');
  const matches=compact.match(/\b[A-Z]{2}\d{2}(?:[ \t]?[A-Z0-9]){11,30}\b/g)||[];
  return matches.map((value)=>value.replace(/\s+/g,'')).find((value)=>value.length>=15&&value.length<=34)||'';
}

function extractBankReference(text) {
  const raw=String(text||'');
  const patterns=[
    /(?:referenz|reference|ref\.?|zahlungszweck|mitteilung|meldung|purpose)\s*[:#-]?\s*([^\n]{3,160})/i,
    /\b(?:QR[- ]?Referenz|SCOR)\s*[:#-]?\s*([^\n]{3,160})/i,
  ];
  for(const pattern of patterns){
    const match=raw.match(pattern);
    if(match?.[1]) return normalize(match[1]);
  }
  return '';
}

function continuationLines(allLines,startIndex,endIndex,page) {
  const rows=[];
  for(let index=startIndex+1; index<endIndex && rows.length<10; index+=1){
    const line=allLines[index];
    if(line.page!==page) break;
    const text=pdfLineText(line);
    if(!text||looksLikePdfHeader(text)) continue;
    const dateCount=(line.items||[]).filter((item)=>parsePdfDate(item.str)).length;
    const amountCount=(line.items||[]).filter((item)=>parsePdfAmount(item.str)).length;
    if(dateCount>=1 && amountCount>=1) break;
    if(amountCount>=2 && text.length<80) continue;
    rows.push(text);
  }
  return rows;
}

export function buildBankRowsFromLines(allLines,columns=detectColumns(allLines)) {
  const candidates=[];
  let ambiguous=0;
  for(let index=0; index<allLines.length; index+=1){
    const line=allLines[index];
    const dateEntry=(line.items||[]).map((item,itemIndex)=>({index:itemIndex,item,date:parsePdfDate(item.str)})).find((entry)=>entry.date);
    if(!dateEntry) continue;
    const amountEntry=chooseAmount(line,columns);
    if(!amountEntry || !Number.isFinite(amountEntry.amount) || amountEntry.amount===0){
      ambiguous+=1;
      continue;
    }
    candidates.push({lineIndex:index,line,dateEntry,amountEntry});
  }

  const rows=[];
  for(let position=0; position<candidates.length; position+=1){
    const current=candidates[position];
    const next=candidates[position+1];
    const endIndex=next?.lineIndex ?? allLines.length;
    const mainDescription=descriptionFor(current.line,current.dateEntry.index,current.amountEntry.index,columns)||'PDF-Import';
    const continuations=continuationLines(allLines,current.lineIndex,endIndex,current.line.page);
    const rawParts=[pdfLineText(current.line),...continuations].filter(Boolean);
    const rawText=rawParts.join('\n');
    const iban=extractIban(rawText);
    const reference=extractBankReference(rawText);
    const counterpartyCandidate=continuations.find((value)=>
      !/\b(?:iban|referenz|reference|valuta|saldo|kontostand|buchungsnummer|transaktionsnummer)\b/i.test(value)
      && !/^\d[\d\s.+-]*$/.test(value)
    )||'';
    rows.push({
      Datum:current.dateEntry.date,
      Beschreibung:mainDescription,
      Gegenpartei:counterpartyCandidate,
      Gegenkonto:iban,
      Referenz:reference,
      Original:rawText,
      'PDF-Seite':String(current.line.page||''),
      Betrag:current.amountEntry.amount.toFixed(2),
    });
  }
  return {rows,ambiguous};
}

export async function parseBankPdf(file) {
  if (!file) throw new Error('Keine PDF-Datei ausgewählt.');
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const allLines = [];
  for (let pageNumber=1; pageNumber<=pdf.numPages; pageNumber+=1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    allLines.push(...lineGroups(content.items).map((line)=>({ ...line, page:pageNumber })));
  }
  const columns = detectColumns(allLines);
  const parsed=buildBankRowsFromLines(allLines,columns);
  const rows=parsed.rows;
  if (!rows.length) {
    throw new Error('Im PDF konnten keine eindeutig signierten Buchungszeilen erkannt werden. Unterstützt werden textbasierte Kontoauszüge; gescannte PDFs benötigen OCR.');
  }
  return {
    headers:['Datum','Beschreibung','Gegenpartei','Gegenkonto','Referenz','Original','PDF-Seite','Betrag'],
    rows,
    delimiter:'PDF',
    format:'pdf',
    meta:{
      pages:pdf.numPages,
      recognized:rows.length,
      ambiguous:parsed.ambiguous,
      credits:rows.filter((row)=>Number(row.Betrag)>0).length,
      debits:rows.filter((row)=>Number(row.Betrag)<0).length,
      enriched:rows.filter((row)=>row.Gegenkonto||row.Referenz||String(row.Original||'').includes('\n')).length,
    },
  };
}
