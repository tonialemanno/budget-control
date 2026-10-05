import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCategoryMlModel, predictCategoryMl, CATEGORY_ML_MODEL_VERSION } from '../assets/js/app/ml-categorization.js';
import { buildCategorizationGroups, categorizationSourceLabel } from '../assets/js/app/categorization.js';

const categories=[
  {id:'food',name:'Lebensmittel',kind:'expense',is_archived:false},
  {id:'restaurant',name:'Restaurant & Café',kind:'expense',is_archived:false},
  {id:'salary',name:'Lohn',kind:'income',is_archived:false},
  {id:'refund',name:'Rückerstattung',kind:'income',is_archived:false},
];

function tx(id,categoryId,counterparty,description,amount,currency='CHF'){
  return {id,category_id:categoryId,counterparty,description,amount,currency,status:'booked',source:'import',cashflow_type:'standard',transfer_group_id:null};
}

const history=[];
for(let i=0;i<12;i+=1) history.push(tx(`f${i}`,'food','Vendor Orion',`Serie Orion ${i}`,-45-(i%4)));
for(let i=0;i<12;i+=1) history.push(tx(`r${i}`,'restaurant','Vendor Luna',`Serie Luna ${i}`,-28-(i%3)));
for(let i=0;i<6;i+=1) history.push(tx(`s${i}`,'salary','Company Nova',`Payroll Nova ${i}`,6200+i));
for(let i=0;i<6;i+=1) history.push(tx(`i${i}`,'refund','Insurer Vega',`Refund Vega ${i}`,120+i));

const model=buildCategoryMlModel({transactions:history,categories});
assert.equal(model.version,CATEGORY_ML_MODEL_VERSION);
assert.equal(model.trainingExamples,36);

const cafe=predictCategoryMl(model,tx('new',null,'Vendor Luna','Serie Luna neu',-31));
assert.equal(cafe?.categoryId,'restaurant');
assert.ok(cafe.confidence>=0.62);
assert.ok(cafe.support>=5);

const market=predictCategoryMl(model,tx('new2',null,'Vendor Orion','Serie Orion neu',-52));
assert.equal(market?.categoryId,'food');

const income=predictCategoryMl(model,tx('new3',null,'Company Nova','Payroll Nova neu',6400));
assert.equal(income?.categoryId,'salary');
assert.equal(income?.kind,'income');

const tiny=buildCategoryMlModel({transactions:history.slice(0,4),categories});
assert.equal(predictCategoryMl(tiny,tx('x',null,'Vendor Orion','Serie Orion',-40)),null,'Too little history must not produce ML guesses.');

const corrected=history
  .map((row)=>row.counterparty==='Vendor Luna'?{...row,category_id:'food'}:row)
  .concat(Array.from({length:8},(_,i)=>tx(`rr${i}`,'restaurant','Vendor Sol',`Serie Sol ${i}`,-35-(i%3))));
const correctedModel=buildCategoryMlModel({transactions:corrected,categories});
const correctedPrediction=predictCategoryMl(correctedModel,tx('new4',null,'Vendor Luna','Serie Luna neu',-31));
assert.equal(correctedPrediction?.categoryId,'food','User-corrected category history must alter the next model.');

const groups=buildCategorizationGroups({
  transactions:[...history,tx('open',null,'Vendor Luna','Serie Luna offen',-19)],
  categories,
  merchants:[],
  aliases:[],
  rules:[],
});
const openGroup=groups.find((group)=>group.rows.some((row)=>row.id==='open'));
assert.equal(openGroup?.suggestion?.source,'ml');
assert.equal(openGroup?.suggestion?.categoryId,'restaurant');
assert.match(categorizationSourceLabel('ml',openGroup.suggestion.confidence),/^Machine Learning · \d+ %$/);

const source=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
assert.match(source,/buildCategoryMlModel/);
assert.match(source,/predictCategoryMl/);
assert.match(source,/mlPrediction\?\.safe/);

console.log('ML categorization assertions OK');
