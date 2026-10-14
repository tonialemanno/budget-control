import assert from 'node:assert/strict';
import fs from 'node:fs';
import {renderMerchants} from '../assets/js/views/merchants.js';
import {merchantReviewPairKey,updateMerchantReviewDraft,stageMerchantReviewGroup,validateMerchantReviewDraft} from '../assets/js/app/merchant-review-draft.js';

const id1='00000000-0000-4000-8000-000000000001';
const id2='00000000-0000-4000-8000-000000000002';
const id3='00000000-0000-4000-8000-000000000003';
const id4='00000000-0000-4000-8000-000000000004';
const id5='00000000-0000-4000-8000-000000000005';
assert.equal(merchantReviewPairKey(id1,id2),merchantReviewPairKey(id2,id1));
let draft=new Map();
draft=updateMerchantReviewDraft(draft,{canonicalId:id1,duplicateId:id2,choice:'merge'});
assert.equal(validateMerchantReviewDraft([...draft.values()]).mergeCount,1);
draft=updateMerchantReviewDraft(draft,{canonicalId:id3,duplicateId:id4,choice:'ignore'});
assert.deepEqual(validateMerchantReviewDraft([...draft.values()]),{mergeCount:1,ignoreCount:1,total:2});
draft=updateMerchantReviewDraft(draft,{canonicalId:id3,duplicateId:id4,choice:'merge'});
assert.deepEqual(validateMerchantReviewDraft([...draft.values()]),{mergeCount:2,ignoreCount:0,total:2});
draft=updateMerchantReviewDraft(draft,{canonicalId:id3,duplicateId:id4,choice:'merge'});
assert.equal(draft.size,1,'Tapping the selected decision again cancels it without a reload');
assert.throws(()=>updateMerchantReviewDraft(draft,{canonicalId:id5,duplicateId:id1,choice:'merge'}),/zugleich/);
assert.equal(draft.size,1,'Invalid edits do not modify the previous draft');
assert.throws(()=>updateMerchantReviewDraft(draft,{canonicalId:id5,duplicateId:id2,choice:'ignore'}),/gleichzeitig/);
assert.throws(()=>stageMerchantReviewGroup(draft,[{canonicalId:id1,duplicateId:id3},{canonicalId:id4,duplicateId:id2}]),/gleichzeitig|zugleich|zwei unterschiedliche/);
const staged=stageMerchantReviewGroup(draft,[{canonicalId:id1,duplicateId:id3},{canonicalId:id1,duplicateId:id4}]);
assert.equal(staged.size,3);
assert.equal(validateMerchantReviewDraft([...staged.values()]).mergeCount,3);

const merchants=[
{id:id1,name:'PIZZERIA ALPENBL',normalized_key:'pizzeria alpenbl'},
{id:id2,name:'PIZZERIA ALPENBL 25.04.2026',normalized_key:'pizzeria alpenbl 25 04 2026'},
{id:id3,name:'ZALANDO',normalized_key:'zalando'},
{id:id4,name:'ZALANDO STORE FREIBURG',normalized_key:'zalando store freiburg'},
];
const props={merchants,merchantAliases:[],transactions:[],recurringRules:[],budgets:[],canWrite:true,merchantReviewChoices:[...draft.values()]};
const html=renderMerchants(props);
assert.ok(html.includes('data-merchant-review-root'));
assert.ok(html.includes('data-action="merchant-review-choice"'));
assert.ok(html.includes('data-action="merchant-review-save"'));
assert.ok(html.includes('data-action="merchant-review-clear"'));
assert.ok(html.includes('data-action="merchant-review-group"')||html.includes('data-merchant-review-pair'));
assert.ok(html.includes('Zusammenführen vorgemerkt'));
assert.ok(html.includes('Alle Entscheidungen speichern'));
assert.doesNotMatch(html,/data-action="merchant-duplicate-ignore"/);
const viewer=renderMerchants({...props,canWrite:false});
assert.doesNotMatch(viewer,/data-action="merchant-review-save"/);
const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
assert.match(main,/function syncMerchantReviewUi\(/);
assert.match(main,/if \(action === 'merchant-review-choice'\)/);
assert.match(main,/if \(action === 'merchant-review-group'\)/);
assert.match(main,/if \(action === 'merchant-review-save'\)/);
assert.match(main,/reviewMerchantDecisionsBatch\(\{householdId:runtime\.household\.id,decisions\}\)/);
assert.match(main,/await refresh\(/);
const api=fs.readFileSync(new URL('../assets/js/app/finance-api.js',import.meta.url),'utf8');
assert.match(api,/review_merchants_batch_v1/);
const migration=fs.readFileSync(new URL('../supabase/migrations/20261014142000_merchant_review_batch.sql',import.meta.url),'utf8');
for(const needle of ['security invoker','private.can_write_household','merge_merchants_v2','merchant_duplicate_ignores','for update','raise exception','revoke all on function','grant execute'])assert.ok(migration.includes(needle),needle);
console.log('Merchant batch review: 1-save selection, conflict prevention, UI and atomic API contracts OK');
