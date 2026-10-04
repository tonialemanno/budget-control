import { merchantFromTransaction, normalizeMerchantKey } from './csv-import.js';

export function resolvedMerchantForTransaction(tx,{merchants=[],aliases=[]}={}) {
  if(tx?.merchant_id){
    const direct=merchants.find((row)=>row.id===tx.merchant_id);
    if(direct) return {merchant:direct,detected:null,via:'linked'};
  }

  const detected=merchantFromTransaction(tx);
  const alias=aliases.find((row)=>row.normalized_key===detected.key);
  if(alias){
    const merchant=merchants.find((row)=>row.id===alias.merchant_id);
    if(merchant) return {merchant,detected,via:'alias',alias};
  }

  const exact=merchants.find((row)=>row.normalized_key===detected.key);
  if(exact) return {merchant:exact,detected,via:'key'};

  return {merchant:null,detected,via:'detected'};
}

export function merchantDuplicateGroups(merchants=[]){
  const groups=new Map();
  for(const merchant of merchants){
    const canonical=merchantFromTransaction({description:merchant.name,counterparty:null});
    const key=canonical?.key||normalizeMerchantKey(merchant.name);
    const group=groups.get(key)||{key,name:canonical?.name||merchant.name,rows:[]};
    group.rows.push(merchant);
    groups.set(key,group);
  }
  return [...groups.values()]
    .filter((group)=>group.rows.length>1)
    .sort((a,b)=>b.rows.length-a.rows.length||a.name.localeCompare(b.name,'de'));
}

export function recurringRuleSimilarity(tx,rule,{categories=[]}={}){
  if(!tx||!rule||rule.active===false) return 0;
  const direction=Number(tx.amount)<0?'expense':'income';
  if(rule.direction!==direction) return 0;
  if(rule.currency&&tx.currency&&rule.currency!==tx.currency) return 0;

  let score=0;
  if(rule.account_id&&rule.account_id===tx.account_id) score+=2;
  if(rule.merchant_id&&rule.merchant_id===tx.merchant_id) score+=7;
  if(rule.category_id&&rule.category_id===tx.category_id) score+=3;

  const expected=Math.abs(Number(rule.amount||0));
  const actual=Math.abs(Number(tx.amount||0));
  if(expected>0&&actual>0){
    const delta=Math.abs(expected-actual);
    if(delta<=Math.max(0.5,expected*.01)) score+=6;
    else if(delta<=Math.max(2,expected*.05)) score+=3;
  }

  const text=normalizeMerchantKey([tx.merchants?.name,tx.counterparty,tx.description].filter(Boolean).join(' '));
  for(const candidate of [rule.merchants?.name,rule.counterparty,rule.description]){
    const key=normalizeMerchantKey(candidate);
    if(key.length>=4&&(text.includes(key)||key.includes(text))) { score+=5; break; }
  }

  if(rule.next_date&&tx.occurred_at){
    const due=new Date(`${rule.next_date}T12:00:00`);
    const event=new Date(tx.occurred_at);
    if(!Number.isNaN(due.getTime())&&!Number.isNaN(event.getTime())){
      const days=Math.abs(due-event)/86400000;
      if(days<=5) score+=3;
      else if(days<=12) score+=1;
    }
  }
  return score;
}

export function matchingRecurringRules(tx,rules=[],options={}){
  return rules
    .map((rule)=>({rule,score:recurringRuleSimilarity(tx,rule,options)}))
    .filter((row)=>row.score>=8)
    .sort((a,b)=>b.score-a.score);
}

export function normalizeCounterpartyKey(value){
  return normalizeMerchantKey(value);
}

export function transactionContextLabel(tx,contexts=[]){
  const context=contexts.find((row)=>row.id===tx?.context_id);
  return context?.name||'';
}
