import { knownMerchantSuggestion, normalizeMerchantKey, suggestKnownCategoryName } from './csv-import.js';

const TESSERACT_VERSION='5.1.1';
const TESSERACT_BASE=`https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist`;
const TESSERACT_SCRIPT=`${TESSERACT_BASE}/tesseract.min.js`;
const TESSERACT_WORKER=`${TESSERACT_BASE}/worker.min.js`;
const TESSERACT_CORE=`https://cdn.jsdelivr.net/npm/tesseract.js-core@${TESSERACT_VERSION}`;
const TESSERACT_CORE_IOS_COMPAT=`${TESSERACT_CORE}/tesseract-core-lstm.wasm.js`;
const TESSERACT_LANG_PATH='https://tessdata.projectnaptha.com/4.0.0';
const OCR_SCRIPT_TIMEOUT_MS=15000;
const OCR_WORKER_TIMEOUT_MS=30000;
const OCR_WORKER_TIMEOUT_IOS_MS=18000;
const OCR_RECOGNIZE_TIMEOUT_MS=60000;
let tesseractPromise=null;

function withTimeout(promise,ms,message){
  return new Promise((resolve,reject)=>{
    const timer=window.setTimeout(()=>reject(new Error(message)),ms);
    Promise.resolve(promise).then(
      (value)=>{window.clearTimeout(timer);resolve(value);},
      (error)=>{window.clearTimeout(timer);reject(error);}
    );
  });
}

function appleMobile(){
  return /iPhone|iPad|iPod/i.test(navigator.userAgent||'');
}

function normalizeSpaces(value){ return String(value||'').replace(/[\u00a0\t]+/g,' ').replace(/\s+/g,' ').trim(); }
function safeDate(year,month,day){ const d=new Date(year,month-1,day,12); return d.getFullYear()===year&&d.getMonth()===month-1&&d.getDate()===day?d:null; }
function isoDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

function dateCandidates(text){
  const source=String(text||''), found=[];
  const patterns=[/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})\b/g,/\b(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})\b/g];
  for(const pattern of patterns){
    let m;
    while((m=pattern.exec(source))){
      let year,month,day;
      if(String(m[1]).length===4){year=Number(m[1]);month=Number(m[2]);day=Number(m[3]);}
      else{day=Number(m[1]);month=Number(m[2]);year=Number(m[3]);if(year<100)year+=2000;}
      const date=safeDate(year,month,day);
      if(date) found.push({date,index:m.index,raw:m[0]});
    }
  }
  return found;
}

function parseMoney(value){
  let source=String(value||'').trim();
  if(!source) return null;
  source=source.replace(/\b(?:CHF|EUR|USD|GBP|SFR|FR)\.?\b/gi,'').replace(/[’'\s]/g,'').replace(/[^0-9,.-]/g,'');
  if(!source||!/\d/.test(source)) return null;
  const comma=source.lastIndexOf(','), dot=source.lastIndexOf('.');
  if(comma>dot) source=source.replace(/\./g,'').replace(',','.');
  else if(dot>comma) source=source.replace(/,/g,'');
  else source=source.replace(',','.');
  const n=Number(source);
  return Number.isFinite(n)?Math.abs(n):null;
}

function amountCandidates(lines){
  const result=[];
  const amountPattern=/(?:\b(?:CHF|EUR|USD|GBP|SFR|FR)\.?\s*)?\d{1,6}(?:[’'\s.]\d{3})*(?:[.,]\d{2})\b/gi;
  lines.forEach((line,lineIndex)=>{
    let match;
    while((match=amountPattern.exec(line))){
      const amount=parseMoney(match[0]);
      if(!amount||amount>1_000_000) continue;
      let score=(lineIndex/Math.max(1,lines.length-1))*2;
      if(/\b(total|gesamt|summe|endbetrag|zu\s+zahlen|zahlbetrag|amount\s+due|grand\s+total|lidl\s+preis)\b/i.test(line)) score+=14;
      if(/\b(kartenzahlung|visa|mastercard|maestro|twint|payment|bezahlt|betrag|eft)\b/i.test(line)) score+=3;
      if(/\b(chf|eur|usd|gbp|sfr|fr\.)\b/i.test(line)) score+=2;
      if(/\b(mwst|ust|vat|steuer|tax|wechselgeld|r[uü]ckgeld|change|gegeben|cash\s+received|subtotal|zwischensumme|punkte|punktestand)\b/i.test(line)) score-=10;
      result.push({amount,line,lineIndex,score});
    }
  });
  return result;
}

function currencyFromText(text,fallback='CHF'){
  const source=String(text||'');
  if(/\b(?:CHF|SFR|Fr\.)\b/i.test(source)) return 'CHF';
  if(/\bEUR\b|€/i.test(source)) return 'EUR';
  if(/\bUSD\b|\$/i.test(source)) return 'USD';
  if(/\bGBP\b|£/i.test(source)) return 'GBP';
  return fallback;
}

function fallbackMerchant(lines){
  const ignored=/^(beleg|quittung|receipt|rechnung|invoice|kassenbon|danke|thank\s+you|www\.|tel\.?|telefon|datum|date|zeit|time|filiale|store)\b/i;
  for(const raw of lines.slice(0,14)){
    const line=normalizeSpaces(raw);
    if(line.length<3||line.length>70||ignored.test(line)||!/[A-Za-zÄÖÜäöüß]{3}/.test(line)) continue;
    if(/\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}/.test(line)||/^[\d\s.,:'’-]+$/.test(line)) continue;
    return line.slice(0,70);
  }
  return 'Unbekannter Händler';
}

function merchantProfile(rawText,lines){
  const text=String(rawText||'');
  if(/\b(?:migros|genossenschaft\s+migros)\b/i.test(text)){
    const restaurant=/\bMR\s+[A-ZÄÖÜ][\wÄÖÜäöüß-]*/m.test(text)||/\bmigros\s+restaurant\b/i.test(text)||/\bbuffet\s+(?:warm|kalt)\b/i.test(text)||/restaur\w*/i.test(text);
    return {name:restaurant?'Migros Restaurant':'Migros',key:restaurant?'migros restaurant':'migros',category:restaurant?'Restaurant':'Lebensmittel'};
  }
  if(/\bcoop\b/i.test(text)){
    const restaurant=/\bcoop\s+restaurant\b/i.test(text)||/restaur\w*/i.test(text)||/\bbuffet\b/i.test(text);
    return {name:restaurant?'Coop Restaurant':'Coop',key:restaurant?'coop restaurant':'coop',category:restaurant?'Restaurant':'Lebensmittel'};
  }
  if(/\blidl\b/i.test(text)) return {name:'Lidl',key:'lidl',category:'Lebensmittel'};
  if(/\bdenner\b/i.test(text)) return {name:'Denner',key:'denner',category:'Lebensmittel'};
  if(/\b(?:mcdonald'?s|mc\s*donald'?s)\b/i.test(text)) return {name:"McDonald's",key:'mcdonalds',category:'Restaurant'};
  const known=knownMerchantSuggestion({description:text,counterparty:''});
  if(known) return known;
  const name=fallbackMerchant(lines);
  return {name,key:normalizeMerchantKey(name),category:suggestKnownCategoryName({description:text,counterparty:name})||null};
}

function explicitTotal(rawText){
  const text=String(rawText||'').replace(/[\t\u00a0]+/g,' ');
  const patterns=[
    /\btotal\s*(?:-?eft\s*)?(?:chf|eur|usd|gbp|sfr|fr\.)?\s*[:=]?\s*(\d{1,6}[.,]\d{2})\b/i,
    /\b(?:summe|gesamt|endbetrag|zahlbetrag)\s*(?:chf|eur|usd|gbp|sfr|fr\.)?\s*[:=]?\s*(\d{1,6}[.,]\d{2})\b/i,
    /\bdein\s+lidl\s+preis\s*(\d{1,6}[.,]\d{2})\b/i,
    /\b(?:visadebit|visa\s*debit|twint\s*qr)\s*(?:chf|eur)?\s*[:=]?\s*(\d{1,6}[.,]\d{2})\b/i,
  ];
  for(const p of patterns){
    const m=text.match(p), amount=m?.[1]?parseMoney(m[1]):null;
    if(amount) return {amount,evidence:m[0]};
  }
  return null;
}

function bestDate(rawText){
  const dates=dateCandidates(rawText);
  if(!dates.length) return null;
  const now=new Date(), future=new Date(now.getFullYear(),now.getMonth(),now.getDate()+2,23,59,59), past=new Date(now.getFullYear()-10,now.getMonth(),now.getDate());
  const source=String(rawText||'');
  return dates.filter((x)=>x.date<=future&&x.date>=past).map((entry)=>{
    const around=source.slice(Math.max(0,entry.index-100),Math.min(source.length,entry.index+130));
    let score=0;
    if(/\b(buchung|transaktion|transaction|beleg|bon|datum|date|kasse)\b/i.test(around)) score+=10;
    if(/\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(around)) score+=4;
    if(/punktestand|verfall|gültig|gueltig|per\s+\d/i.test(around)) score-=14;
    score-=Math.abs(now-entry.date)/86_400_000/3650;
    return {...entry,score};
  }).sort((a,b)=>b.score-a.score)[0]?.date||null;
}

function paymentMethodFromText(text){
  const s=String(text||'');
  if(/twint\s*qr|\btwint\b/i.test(s)) return 'TWINT';
  if(/visadebit|visa\s*debit/i.test(s)) return 'Visa Debit';
  if(/mastercard/i.test(s)) return 'Mastercard';
  if(/\bvisa\b/i.test(s)) return 'Visa';
  if(/\bmaestro\b/i.test(s)) return 'Maestro';
  if(/\bkarte\b|card\s*payment/i.test(s)) return 'Karte';
  if(/\bbar\b|cash/i.test(s)) return 'Bar';
  return null;
}

function tokenSimilarity(a,b){
  const left=new Set(normalizeMerchantKey(a).split(' ').filter((t)=>t.length>1)), right=new Set(normalizeMerchantKey(b).split(' ').filter((t)=>t.length>1));
  if(!left.size||!right.size) return 0;
  let overlap=0; for(const t of left) if(right.has(t)) overlap+=1;
  return overlap/Math.max(left.size,right.size);
}
function dateDistanceDays(a,b){
  const left=new Date(`${a}T12:00:00`), right=new Date(b);
  return Number.isNaN(left.getTime())||Number.isNaN(right.getTime())?999:Math.abs(left-right)/86_400_000;
}

async function loadTesseract(){
  if(globalThis.Tesseract?.createWorker) return globalThis.Tesseract;
  if(!tesseractPromise){
    const loader=new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-finance-tesseract]');
      const ready=()=>globalThis.Tesseract?.createWorker?resolve(globalThis.Tesseract):reject(new Error('OCR-Bibliothek ist nicht verfügbar.'));
      const failed=()=>reject(new Error('OCR-Bibliothek konnte nicht geladen werden.'));
      if(existing){
        existing.addEventListener('load',ready,{once:true});
        existing.addEventListener('error',failed,{once:true});
        return;
      }
      const script=document.createElement('script');
      script.src=TESSERACT_SCRIPT;
      script.async=true;
      script.crossOrigin='anonymous';
      script.dataset.financeTesseract='true';
      script.onload=ready;
      script.onerror=failed;
      document.head.appendChild(script);
    });
    tesseractPromise=withTimeout(loader,OCR_SCRIPT_TIMEOUT_MS,'OCR konnte auf diesem Gerät nicht rechtzeitig geladen werden.')
      .catch((error)=>{tesseractPromise=null;throw error;});
  }
  return tesseractPromise;
}

async function loadImage(file){
  const url=URL.createObjectURL(file);
  try{
    const image=new Image();
    image.decoding='async';
    image.src=url;
    if(typeof image.decode==='function'){
      try{await withTimeout(image.decode(),12000,'Das Belegfoto konnte nicht rechtzeitig dekodiert werden.');}catch{}
    }
    if(!image.complete||!image.naturalWidth){
      await withTimeout(new Promise((resolve,reject)=>{
        image.onload=resolve;
        image.onerror=()=>reject(new Error('Das Belegfoto konnte nicht gelesen werden.'));
      }),12000,'Das Belegfoto konnte nicht rechtzeitig geladen werden.');
    }
    if(!image.naturalWidth||!image.naturalHeight) throw new Error('Das Belegfoto konnte nicht dekodiert werden.');
    return image;
  } finally { URL.revokeObjectURL(url); }
}

async function prepareImage(file,{binary=false}={}){
  const image=await loadImage(file);
  const longest=Math.max(image.naturalWidth,image.naturalHeight);
  const maxLongest=appleMobile()?1600:2200;
  const scale=longest>maxLongest?maxLongest/longest:1;
  const width=Math.max(1,Math.round(image.naturalWidth*scale)), height=Math.max(1,Math.round(image.naturalHeight*scale));
  const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height;
  const ctx=canvas.getContext('2d',{alpha:false,willReadFrequently:binary});
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,width,height);
  if('filter' in ctx) ctx.filter=binary?'grayscale(1) contrast(1.45)':'grayscale(1) contrast(1.22)';
  ctx.drawImage(image,0,0,width,height);
  if(binary){
    const data=ctx.getImageData(0,0,width,height);
    const px=data.data;
    for(let i=0;i<px.length;i+=4){
      const v=px[i]*0.299+px[i+1]*0.587+px[i+2]*0.114;
      const out=v>184?255:0;
      px[i]=px[i+1]=px[i+2]=out; px[i+3]=255;
    }
    ctx.putImageData(data,0,0);
  }
  return new Promise((resolve)=>canvas.toBlob((blob)=>resolve(blob||file),'image/jpeg',0.92));
}

export function parseReceiptText(text,{fallbackCurrency='CHF'}={}){
  const rawText=String(text||'').replace(/\r/g,'');
  const lines=rawText.split('\n').map(normalizeSpaces).filter(Boolean);
  const merchantInfo=merchantProfile(rawText,lines);
  const explicit=explicitTotal(rawText);
  const amounts=amountCandidates(lines).sort((a,b)=>b.score-a.score||b.amount-a.amount);
  const amount=explicit?.amount||amounts[0]?.amount||null;
  const currency=currencyFromText(rawText,fallbackCurrency);
  const chosenDate=bestDate(rawText);
  const date=chosenDate?isoDate(chosenDate):null;
  const paymentMethod=paymentMethodFromText(rawText);

  let confidence=0;
  if(merchantInfo.name&&merchantInfo.name!=='Unbekannter Händler') confidence+=0.3;
  if(amount) confidence+=explicit?0.4:(amounts[0]?.score>=8?0.3:0.2);
  if(date) confidence+=0.2;
  if(currency) confidence+=0.05;
  if(paymentMethod) confidence+=0.05;

  return {
    merchant:merchantInfo.name||'Unbekannter Händler',
    merchantKey:merchantInfo.key||normalizeMerchantKey(merchantInfo.name),
    suggestedCategoryName:merchantInfo.category||null,
    amount,currency,date,paymentMethod,
    confidence:Math.min(1,confidence),
    rawText,
    amountEvidence:explicit?.evidence||amounts[0]?.line||null,
  };
}

export function findReceiptMatches({transactions=[],amount,currency,date,merchant,limit=5}={}){
  const targetAmount=Number(amount);
  if(!(targetAmount>0)||!currency||!date) return [];
  const matches=[];
  for(const tx of transactions){
    if(tx.status!=='booked'||Number(tx.amount)>=0||tx.transfer_group_id||['debt_payment','receivable_principal'].includes(tx.cashflow_type)) continue;
    if(tx.currency!==currency) continue;
    const delta=Math.abs(Math.abs(Number(tx.amount))-targetAmount), tolerance=Math.max(0.02,targetAmount*0.002);
    if(delta>tolerance) continue;
    const days=dateDistanceDays(date,tx.occurred_at); if(days>5) continue;
    const searchable=`${tx.merchants?.name||''} ${tx.counterparty||''} ${tx.description||''}`;
    const receiptKnown=knownMerchantSuggestion({description:merchant,counterparty:''}), transactionKnown=knownMerchantSuggestion({description:searchable,counterparty:''});
    const similarity=receiptKnown&&transactionKnown&&receiptKnown.key===transactionKnown.key?1:tokenSimilarity(merchant,searchable);
    let score=50; if(delta<=0.01)score+=20; score+=Math.max(0,20-days*4); score+=similarity*20;
    matches.push({tx,score,days,amountDelta:delta,merchantSimilarity:similarity});
  }
  return matches.sort((a,b)=>b.score-a.score||a.days-b.days).slice(0,limit).map((x)=>({...x,highConfidence:x.score>=86&&x.merchantSimilarity>=0.34}));
}

export async function analyzeReceiptImage(file,{fallbackCurrency='CHF',onProgress=()=>{}}={}){
  if(!(file instanceof Blob)||!file.size) throw new Error('Bitte ein Belegfoto auswählen.');
  if(!String(file.type||'').startsWith('image/')) throw new Error('Für die Belegerkennung wird ein Foto bzw. Bild benötigt.');

  onProgress({status:'OCR wird geladen',progress:0.06});
  const tesseract=await loadTesseract();
  onProgress({status:'Bild wird vorbereitet',progress:0.12});
  const normal=await withTimeout(prepareImage(file,{binary:false}),15000,'Das Belegfoto konnte nicht rechtzeitig vorbereitet werden.');

  let worker=null,recognitionPass=1,workerError=null;
  const isAppleMobile=appleMobile();
  const logger=(m)=>{
    const p=Math.max(0,Math.min(1,Number(m?.progress||0)));
    const status=String(m?.status||'');
    if(status==='loading tesseract core') onProgress({status:'OCR-Engine wird geladen',progress:0.16+p*0.06});
    else if(status==='initializing tesseract') onProgress({status:isAppleMobile?'OCR-Engine wird gestartet · iPhone-Modus':'OCR-Engine wird gestartet',progress:0.22+p*0.06});
    else if(status==='loading language traineddata') onProgress({status:'Sprachmodell wird geladen',progress:0.28+p*0.10});
    else if(status==='initializing api') onProgress({status:'Texterkennung wird vorbereitet',progress:0.38+p*0.07});
    else if(status==='recognizing text'){
      const start=recognitionPass===1?0.45:0.76;
      const span=recognitionPass===1?0.28:0.15;
      onProgress({status:recognitionPass===1?'Text wird erkannt':'Zweiter OCR-Lauf',progress:start+p*span});
    }
  };

  // iOS/WebKit can stall while instantiating the automatically selected WASM core.
  // Use the LSTM-only, non-SIMD core on Apple mobile as a conservative compatibility
  // path. It is slower, but avoids a class of WebAssembly/SIMD initialization stalls.
  // Do not start multiple workers after a timeout: createWorker can remain pending on
  // initialization failures, which would otherwise leak another worker on each retry.
  const languages=isAppleMobile?'deu':'deu+eng';
  const workerOptions={
    workerPath:TESSERACT_WORKER,
    corePath:isAppleMobile?TESSERACT_CORE_IOS_COMPAT:TESSERACT_CORE,
    langPath:TESSERACT_LANG_PATH,
    logger,
    errorHandler:(error)=>{ workerError=error; },
  };
  onProgress({status:isAppleMobile?'OCR-Engine wird gestartet · iPhone-Modus':'OCR-Engine wird gestartet',progress:0.15});
  try{
    worker=await withTimeout(
      tesseract.createWorker(languages,1,workerOptions),
      isAppleMobile?OCR_WORKER_TIMEOUT_IOS_MS:OCR_WORKER_TIMEOUT_MS,
      isAppleMobile
        ? 'OCR-Engine konnte auf dem iPhone nicht gestartet werden.'
        : 'OCR-Engine reagiert auf diesem Gerät nicht.'
    );
  }catch(error){
    const detail=String(workerError?.message||workerError||'').trim();
    throw new Error(detail ? `${error.message} (${detail})` : error.message);
  }
  if(!worker) throw new Error('OCR konnte nicht gestartet werden.');

  try{
    await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});
    recognitionPass=1;
    const first=await withTimeout(worker.recognize(normal),OCR_RECOGNIZE_TIMEOUT_MS,'Die Texterkennung dauert zu lange.');
    let parsed=parseReceiptText(first?.data?.text||'',{fallbackCurrency});
    let ocrConfidence=Number(first?.data?.confidence||0)/100;

    if(!parsed.amount||!parsed.date||!parsed.merchant||parsed.merchant==='Unbekannter Händler'||parsed.confidence<0.82){
      onProgress({status:'Zweiter OCR-Lauf wird vorbereitet',progress:0.74});
      try{
        const binary=await withTimeout(prepareImage(file,{binary:true}),15000,'Das Belegfoto konnte nicht für den zweiten Lauf vorbereitet werden.');
        await worker.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'});
        recognitionPass=2;
        const second=await withTimeout(worker.recognize(binary),OCR_RECOGNIZE_TIMEOUT_MS,'Der zweite OCR-Lauf dauert zu lange.');
        const parsedSecond=parseReceiptText(second?.data?.text||'',{fallbackCurrency});
        const secondConfidence=Number(second?.data?.confidence||0)/100;
        const quality=(p,c)=>p.confidence*0.8+c*0.2;
        if(quality(parsedSecond,secondConfidence)>quality(parsed,ocrConfidence)){parsed=parsedSecond;ocrConfidence=secondConfidence;}
      }catch{}
    }
    onProgress({status:'Belegdaten werden geprüft',progress:0.95});
    return {...parsed,ocrConfidence};
  } finally {
    try{await worker.terminate();}catch{}
  }
}
