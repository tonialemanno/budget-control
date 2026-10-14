// Client-side merchant review draft. No bank rows or preferences change before a single Save.
export function merchantReviewPairKey(a,b) {
  return [String(a||''),String(b||'')].sort().join(':');
}

export function validateMerchantReviewDraft(items=[]) {
  const pairKeys=new Set(), merged=new Map(), canonicalIds=new Set(), ignored=[];
  for(const row of items){
    const canonicalId=String(row?.canonicalId||'');
    const duplicateId=String(row?.duplicateId||'');
    const choice=String(row?.choice||'');
    if(!canonicalId||!duplicateId||canonicalId===duplicateId||!['merge','ignore'].includes(choice)){
      throw new Error('Ungültige Händlerentscheidung. Bitte die Auswahl prüfen.');
    }
    const key=merchantReviewPairKey(canonicalId,duplicateId);
    if(pairKeys.has(key))throw new Error('Ein Händlervergleich wurde mehrfach vorgemerkt.');
    pairKeys.add(key);
    if(choice==='merge'){
      if(merged.has(duplicateId) && merged.get(duplicateId)!==canonicalId){
        throw new Error('Ein Händler soll in zwei unterschiedliche Zielhändler zusammengeführt werden. Bitte eine Entscheidung zurücknehmen.');
      }
      merged.set(duplicateId,canonicalId);
      canonicalIds.add(canonicalId);
    }else ignored.push([canonicalId,duplicateId]);
  }
  for(const duplicateId of merged.keys()){
    if(canonicalIds.has(duplicateId)){
      throw new Error('Ein vorgemerkter Zielhändler soll zugleich selbst zusammengeführt werden. Bitte diese Gruppe zuerst separat bearbeiten.');
    }
  }
  for(const [left,right] of ignored){
    if(merged.has(left)||merged.has(right)){
      throw new Error('Für einen Händler wurden gleichzeitig Zusammenführen und Nicht identisch vorgemerkt. Bitte eine Entscheidung zurücknehmen.');
    }
  }
  return {
    mergeCount:merged.size,
    ignoreCount:ignored.length,
    total:items.length,
  };
}

export function updateMerchantReviewDraft(draft,decision) {
  const next=new Map(draft);
  const key=merchantReviewPairKey(decision.canonicalId,decision.duplicateId);
  const current=next.get(key);
  if(current?.choice===decision.choice)next.delete(key);
  else next.set(key,{canonicalId:String(decision.canonicalId),duplicateId:String(decision.duplicateId),choice:decision.choice});
  validateMerchantReviewDraft([...next.values()]);
  return next;
}

export function stageMerchantReviewGroup(draft,items=[],choice='merge') {
  let next=new Map(draft);
  for(const row of items){
    const key=merchantReviewPairKey(row.canonicalId,row.duplicateId);
    next.set(key,{canonicalId:String(row.canonicalId),duplicateId:String(row.duplicateId),choice});
  }
  validateMerchantReviewDraft([...next.values()]);
  return next;
}
