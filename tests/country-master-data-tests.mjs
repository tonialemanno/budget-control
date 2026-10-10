import assert from 'node:assert/strict';
import fs from 'node:fs';

import { merchantFromTransaction, suggestKnownCategoryCandidates, suggestKnownCategoryName } from '../assets/js/app/csv-import.js';
import { DE } from '../assets/js/country/de.js';
import { CH } from '../assets/js/country/ch.js';
import { renderSettings } from '../assets/js/views/settings.js';
import { renderMerchants } from '../assets/js/views/merchants.js';
import { renderCategories } from '../assets/js/views/categories.js';

const migration=fs.readFileSync('supabase/migrations/20261001_finance_country_master_data.sql','utf8');
const api=fs.readFileSync('assets/js/app/finance-api.js','utf8');
const main=fs.readFileSync('assets/js/main.js','utf8');

assert.match(migration,/country_category_catalog/);
assert.match(migration,/country_merchant_catalog/);
assert.match(migration,/install_country_master_data/);
assert.match(migration,/copy_household_master_data/);
assert.match(migration,/promote_merchant_to_country_catalog/);
assert.match(migration,/Wellauer AG/);
assert.doesNotMatch(migration,/public\.transactions/);
assert.match(api,/installCountryMasterData/);
assert.match(api,/copyHouseholdMasterData/);
assert.match(api,/promoteMerchantToCountryCatalog/);
assert.match(main,/masterdata-install-country/);
assert.match(main,/masterdata-copy/);

for(const name of ['Unterhalt / Unterhaltsvorschuss','Kindergeld','Kinderzuschlag','Elterngeld','Sozialleistungen']){
  assert.ok(DE.starterCategories.some(([category,kind])=>category===name&&kind==='income'),`DE income master data missing ${name}`);
}
for(const name of ['Unterhalt / Alimente','Familien- / Kinderzulagen','Sozialleistungen']){
  assert.ok(CH.starterCategories.some(([category,kind])=>category===name&&kind==='income'),`CH income master data missing ${name}`);
}
assert.equal(suggestKnownCategoryCandidates({description:'Unterhaltsvorschuss Oktober',amount:355})[0],'Unterhalt / Unterhaltsvorschuss');
assert.equal(suggestKnownCategoryCandidates({description:'Kindergeld Oktober',amount:259})[0],'Kindergeld');
assert.equal(suggestKnownCategoryCandidates({description:'Kinderzuschlag',amount:200})[0],'Kinderzuschlag');
assert.equal(suggestKnownCategoryCandidates({description:'Elterngeld',amount:500})[0],'Elterngeld');
assert.equal(suggestKnownCategoryCandidates({description:'Bürgergeld',amount:700})[0],'Sozialleistungen');

const wellauer=merchantFromTransaction({counterparty:'WELLAUER AG ST. GALLEN 9000'});
assert.equal(wellauer.name,'Wellauer AG');
assert.equal(wellauer.key,'wellauer ag');
assert.equal(suggestKnownCategoryName({counterparty:'Wellauer AG St. Gallen'}),'Tabak');

const household={id:'h-target',name:'Schwager',country_code:'CH',base_currency:'CHF'};
const masterCategories=[
  {id:'cc1',country_code:'CH',name:'Tabak',kind:'expense',normalized_key:'tabak'},
  {id:'cc2',country_code:'CH',name:'Mobilität',kind:'expense',normalized_key:'mobilitat'},
];
const masterMerchants=[
  {id:'cm1',country_code:'CH',name:'Wellauer AG',normalized_key:'wellauer ag'},
];
const settingsHtml=renderSettings({
  household,
  canWrite:true,
  adminRole:'admin',
  productModules:[],
  moduleAccess:{},
  hiddenModules:[],
  countryMasterCategories:masterCategories,
  countryMasterMerchants:masterMerchants,
  masterDataHouseholds:[
    {id:'h-source',name:'Mein Haushalt',country_code:'CH',base_currency:'CHF'},
    {id:'h-target',name:'Schwager',country_code:'CH',base_currency:'CHF'},
  ],
});
assert.match(settingsHtml,/CH-Standard installieren \/ aktualisieren/);
assert.match(settingsHtml,/0 Kategorien aktuell im Haushalt/);
assert.match(settingsHtml,/Länderstandard und geprüfte Händler werden ergänzt/);
assert.match(settingsHtml,/name="sourceHouseholdId"/);
assert.match(settingsHtml,/name="targetHouseholdId"/);
assert.match(settingsHtml,/Keine Buchungen, Konten, Salden, Fixkosten oder Beträge/);

const merchantHtml=renderMerchants({
  household,
  canWrite:true,
  adminRole:'admin',
  categories:[{id:'cat-tabak',name:'Tabak',kind:'expense'}],
  merchants:[
    {id:'m1',name:'Wellauer AG',normalized_key:'wellauer ag',default_category_id:'cat-tabak'},
    {id:'m2',name:'Lokaler Händler',normalized_key:'lokaler handler',default_category_id:'cat-tabak'},
  ],
  countryMasterMerchants:masterMerchants,
});
assert.match(merchantHtml,/Wellauer AG/);
assert.match(merchantHtml,/CH-Standard/);
assert.match(merchantHtml,/merchant-promote-master/);
assert.equal((merchantHtml.match(/merchant-promote-master/g)||[]).length,1);

const categoryHtml=renderCategories({
  household,
  canWrite:true,
  adminRole:'admin',
  categories:[
    {id:'c1',name:'Tabak',kind:'expense',parent_id:null},
    {id:'c2',name:'Eigene Kategorie',kind:'expense',parent_id:null},
  ],
  countryMasterCategories:masterCategories,
});
assert.match(categoryHtml,/category-promote-master/);
assert.match(categoryHtml,/CH-Standard/);

console.log('Country master data assertions OK');
