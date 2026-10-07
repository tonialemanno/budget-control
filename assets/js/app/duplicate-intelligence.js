const LEGAL_AND_GEO_TOKENS=new Set([
  'ag','gmbh','sa','sarl','srl','srls','ltd','inc','llc',
  'suisse','schweiz','switzerland','deutschland','germany','italia','italy',
  'store','stores','filiale','branch'
]);
const SEMANTIC_TOKENS=new Set(['restaurant','ristorante','cafe','café','gastronomie','takeaway','take','away']);

function norm(value){
  return String(value||'')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,' ')
    .trim()
    .replace(/\s+/g,' ');
}

function merchantText(value){
  return String(value?.merchants?.name||value?.name||value?.counterparty||value?.description||value||'').trim();
}

function significantTokens(value){
  return norm(value).split(' ').filter(Boolean).filter((token)=>!LEGAL_AND_GEO_TOKENS.has(token));
}

function semanticSignature(value){
  const tokens=new Set(significantTokens(value));
  return [...SEMANTIC_TOKENS].filter((token)=>tokens.has(token)).sort().join(':');
}

function knownBrand(value){
  const text=norm(value);
  if(/\baldi\b(?:\s+suisse)?\s+mobile\b/.test(text)) return 'aldi-mobile';
  if(/\baldi\b/.test(text)) return 'aldi';
  if(/\bedeka\b|\bedk\b/.test(text)) return 'edeka';
  if(/\bmigros\b/.test(text)) return 'migros';
  if(/\bcoop\b/.test(text)) return 'coop';
  if(/\bdenner\b/.test(text)) return 'denner';
  if(/\blidl\b/.test(text)) return 'lidl';
  if(/\belvetino\b/.test(text)) return 'elvetino';
  if(/\bserafe\b/.test(text)) return 'serafe';
  if(/\bmediamarkt\b|\bmedia markt\b/.test(text)) return 'mediamarkt';
  if(/\bmcdonalds\b|\bmc donalds\b/.test(text)) return 'mcdonalds';
  return '';
}

export function merchantFamilyKey(value){
  const text=merchantText(value);
  if(!text) return null;
  const brand=knownBrand(text);
  const semantic=semanticSignature(text);
  if(brand) return `brand:${brand}:${semantic||'retail'}`;
  const stripped=significantTokens(text).filter((token)=>!SEMANTIC_TOKENS.has(token));
  if(!stripped.length) return null;
  const key=stripped.join(' ');
  return key.length>=4?`name:${key}:${semantic||'base'}`:null;
}

export function merchantSimilarity(left,right){
  const a=merchantText(left), b=merchantText(right);
  const na=norm(a), nb=norm(b);
  if(!na||!nb) return 0;
  if(na===nb) return 1;

  const semanticA=semanticSignature(a), semanticB=semanticSignature(b);
  if(Boolean(semanticA)!==Boolean(semanticB)) return 0.2;
  if(semanticA&&semanticB&&semanticA!==semanticB) return 0.2;

  const brandA=knownBrand(a), brandB=knownBrand(b);
  if(brandA&&brandB&&brandA!==brandB) return 0.2;
  if(brandA&&brandA===brandB) return 0.99;

  const ta=[...new Set(significantTokens(a).filter((token)=>!SEMANTIC_TOKENS.has(token)))];
  const tb=[...new Set(significantTokens(b).filter((token)=>!SEMANTIC_TOKENS.has(token)))];
  if(!ta.length||!tb.length) return 0;
  const sb=new Set(tb);
  const intersection=ta.filter((token)=>sb.has(token)).length;
  const union=new Set([...ta,...tb]).size;
  const subset=intersection===Math.min(ta.length,tb.length);
  const shortest=ta.length<=tb.length?ta:tb;
  if(subset&&shortest.every((token)=>token.length>=4)) return 0.9;
  return union?intersection/union:0;
}

function receiptTransactionIds(documents){
  return new Set((documents||[])
    .filter((doc)=>doc?.object_type==='transaction'&&doc?.object_id&&(/fotoerfassung|kassenbeleg|receipt/i.test(String(doc.notes||''))||String(doc.mime_type||'').startsWith('image/')))
    .map((doc)=>doc.object_id));
}

function bankEvidence(tx){
  return Boolean(
    tx?.source==='import'
    || tx?.external_reference
    || tx?.bank_reference
    || tx?.import_batch_id
  );
}

function safeAccountPair(left,right,receiptIds){
  if(left?.account_id===right?.account_id) return true;
  return Boolean(
    (receiptIds.has(left?.id)&&bankEvidence(right))
    || (receiptIds.has(right?.id)&&bankEvidence(left))
  );
}

function mergeEligible(tx){
  return Boolean(tx&&tx.status==='booked'&&!tx.transfer_group_id&&tx.cashflow_type==='standard');
}

export function transactionMergeCandidates(base,transactions=[],{documents=[]}={}){
  if(!mergeEligible(base)) return [];
  const amount=Math.abs(Number(base.amount)||0);
  const tolerance=Math.max(0.02,amount*0.002);
  const at=new Date(base.occurred_at).getTime();
  const receiptIds=receiptTransactionIds(documents);
  return (transactions||[])
    .filter((row)=>{
      if(!mergeEligible(row)||row.id===base.id) return false;
      if(row.currency!==base.currency) return false;
      if(!safeAccountPair(base,row,receiptIds)) return false;
      if(Math.sign(Number(row.amount)||0)!==Math.sign(Number(base.amount)||0)) return false;
      if(Math.abs(Math.abs(Number(row.amount)||0)-amount)>tolerance) return false;
      const bt=new Date(row.occurred_at).getTime();
      return Number.isFinite(at)&&Number.isFinite(bt)&&Math.abs(bt-at)<=7*86400000;
    })
    .sort((a,b)=>{
      const accountPenalty=(a.account_id===base.account_id?0:1)-(b.account_id===base.account_id?0:1);
      if(accountPenalty) return accountPenalty;
      return Math.abs(new Date(a.occurred_at)-new Date(base.occurred_at))-Math.abs(new Date(b.occurred_at)-new Date(base.occurred_at));
    });
}

export function preferredTransactionToKeep(left,right,documents=[]){
  const receiptIds=receiptTransactionIds(documents);
  const score=(tx)=>{
    let value=0;
    if(tx?.source==='import') value+=100;
    if(tx?.external_reference) value+=60;
    if(tx?.bank_reference) value+=20;
    if(receiptIds.has(tx?.id)) value-=10;
    return value;
  };
  return score(right)>score(left)?right:left;
}

export function likelyTransactionDuplicates(transactions=[],{documents=[],limit=8}={}){
  const rows=(transactions||[]).filter(mergeEligible);
  const receiptIds=receiptTransactionIds(documents);
  const pairs=[];
  for(let i=0;i<rows.length;i++){
    const left=rows[i];
    for(let j=i+1;j<rows.length;j++){
      const right=rows[j];
      if(left.currency!==right.currency) continue;
      if(!safeAccountPair(left,right,receiptIds)) continue;
      if(Math.sign(Number(left.amount)||0)!==Math.sign(Number(right.amount)||0)) continue;
      const amount=Math.abs(Number(left.amount)||0);
      const tolerance=Math.max(0.02,amount*0.002);
      const delta=Math.abs(Math.abs(Number(right.amount)||0)-amount);
      if(delta>tolerance) continue;
      const days=Math.abs(new Date(left.occurred_at)-new Date(right.occurred_at))/86400000;
      if(!Number.isFinite(days)||days>5) continue;
      let score=40;
      if(delta<=0.01) score+=20;
      score+=days<=1?15:days<=3?8:3;
      if(left.source!==right.source&&[left.source,right.source].includes('import')) score+=18;
      if(receiptIds.has(left.id)!==receiptIds.has(right.id)) score+=12;
      if(left.account_id!==right.account_id&&safeAccountPair(left,right,receiptIds)) score+=10;
      const similarity=merchantSimilarity(left,right);
      score+=similarity>=0.98?20:similarity>=0.85?14:similarity>=0.55?7:0;
      if(norm(left.description)===norm(right.description)) score+=8;
      if(score>=75) pairs.push({left,right,score:Math.min(100,score),days,merchantSimilarity:similarity});
    }
  }
  return pairs.sort((a,b)=>b.score-a.score||a.days-b.days).slice(0,limit);
}
