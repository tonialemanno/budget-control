import assert from 'node:assert/strict';
import fs from 'node:fs';
import { categoryUsageStats, rankCategoriesByUsage } from '../assets/js/app/category-ranking.js';

const categories=[
  {id:'food',name:'Lebensmittel',kind:'expense',sort_order:20},
  {id:'transport',name:'Mobilität',kind:'expense',sort_order:10},
  {id:'restaurant',name:'Restaurant & Café',kind:'expense',sort_order:30},
  {id:'salary',name:'Lohn',kind:'income',sort_order:10},
];
const transactions=[
  {id:'1',status:'booked',category_id:'restaurant',amount:-20,occurred_at:'2026-10-01T10:00:00Z'},
  {id:'2',status:'booked',category_id:'restaurant',amount:-25,occurred_at:'2026-10-02T10:00:00Z'},
  {id:'3',status:'booked',category_id:'restaurant',amount:-30,occurred_at:'2026-10-03T10:00:00Z'},
  {id:'4',status:'booked',category_id:'food',amount:-50,occurred_at:'2026-10-04T10:00:00Z'},
  {id:'5',status:'booked',category_id:'salary',amount:5000,occurred_at:'2026-10-01T10:00:00Z'},
  {id:'6',status:'booked',category_id:'food',amount:-100,occurred_at:'2026-10-05T10:00:00Z',transfer_group_id:'transfer-1'},
  {id:'7',status:'booked',category_id:'food',amount:-100,occurred_at:'2026-10-05T10:00:00Z',semantic_type:'debt_repayment'},
];

const stats=categoryUsageStats(transactions);
assert.equal(stats.get('restaurant').count,3);
assert.equal(stats.get('food').count,1,'transfers and debt repayments must not inflate usage ranking');

const expense=rankCategoriesByUsage(categories,transactions,{kind:'expense'});
assert.deepEqual(expense.map((row)=>row.id),['restaurant','food','transport']);

const income=rankCategoriesByUsage(categories,transactions,{kind:'income'});
assert.deepEqual(income.map((row)=>row.id),['salary']);

const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
const view=fs.readFileSync(new URL('../assets/js/views/transactions.js',import.meta.url),'utf8');
assert.match(main,/function syncSmartCategoryForForm/);
assert.match(main,/suggestedCategoryIdForTransaction/);
assert.match(main,/category\.dataset\.userSelected==='true'/);
assert.match(main,/target\.name==='description'/);
assert.match(view,/rankCategoriesByUsage/);
assert.match(view,/Häufig verwendete Kategorien stehen oben/);

console.log('category ranking assertions OK');
