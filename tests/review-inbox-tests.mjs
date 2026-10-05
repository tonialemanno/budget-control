import assert from 'node:assert/strict';
import { buildReviewQueue, transferCandidatesFor } from '../assets/js/app/review-queue.js';
import { renderReview } from '../assets/js/views/review.js';

const accounts=[
  {account_id:'a',name:'Lohnkonto',currency:'CHF'},
  {account_id:'b',name:'Sparkonto',currency:'CHF'},
];
const categories=[{id:'food',name:'Lebensmittel',kind:'expense'}];
const transactions=[
  {id:'t1',account_id:'a',status:'booked',cashflow_type:'standard',category_id:null,transfer_group_id:null,occurred_at:'2026-10-03T10:00:00Z',created_at:'2026-10-03T10:00:00Z',amount:-100,currency:'CHF',description:'Umbuchung Sparen'},
  {id:'t2',account_id:'b',status:'booked',cashflow_type:'standard',category_id:null,transfer_group_id:null,occurred_at:'2026-10-03T10:03:00Z',created_at:'2026-10-03T10:03:00Z',amount:100,currency:'CHF',description:'Gutschrift'},
  {id:'t3',account_id:'a',status:'booked',cashflow_type:'standard',category_id:null,transfer_group_id:null,occurred_at:'2026-10-04T10:00:00Z',created_at:'2026-10-04T10:00:00Z',amount:-50,currency:'CHF',description:'Unbekannte Ausgabe'},
  {id:'t4',account_id:'a',status:'booked',cashflow_type:'standard',category_id:null,transfer_group_id:null,occurred_at:'2026-10-04T11:00:00Z',created_at:'2026-10-04T11:00:00Z',amount:80,currency:'CHF',description:'Unbekannter Eingang'},
  {id:'t5',account_id:'a',status:'booked',cashflow_type:'standard',category_id:'food',transfer_group_id:null,occurred_at:'2026-10-04T12:00:00Z',created_at:'2026-10-04T12:00:00Z',amount:-30,currency:'CHF',description:'Bereits erledigt'},
];
const bills=[{id:'b1',name:'Rechnung',amount:20,currency:'CHF',due_date:'2026-10-10',status:'open'}];

assert.equal(transferCandidatesFor(transactions[0],{transactions}).length,1);
assert.equal(transferCandidatesFor(transactions[4],{transactions}).length,0,'categorized rows are resolved and must not reappear as transfer work');

const queue=buildReviewQueue({
  transactions,accounts,categories,bills,merchants:[],previousVisitAt:'2026-10-01T00:00:00Z',now:new Date('2026-10-05T12:00:00Z'),
});
assert.equal(queue.possibleTransfers.length,1);
assert.equal(queue.uncategorizedExpenses.length,1);
assert.equal(queue.unknownIncoming.length,1);
assert.equal(queue.dueBills.length,1);
assert.equal(queue.openCount,4);
assert.equal(queue.openTransactions.some((row)=>row.id==='t5'),false);
assert.equal(queue.sinceLastVisit.length,5);

const html=renderReview({
  transactions,accounts,categories,bills,merchants:[],household:{base_currency:'CHF'},profile:{locale:'de-CH'},
  previousVisitAt:'2026-10-01T00:00:00Z',
  changeHistory:[{id:'c1',type:'category_bulk',label:'2 Buchungen → Lebensmittel',before:[],after:[],undoable:true,undone:false,at:'2026-10-05T10:00:00Z'}],
  canWrite:true,
});
assert.match(html,/Zu prüfen/);
assert.match(html,/Lohnkonto → Sparkonto/);
assert.match(html,/Als Umbuchung verbinden/);
assert.match(html,/Rückgängig/);
assert.doesNotMatch(html,/Bereits erledigt/);

console.log('review inbox assertions OK');
