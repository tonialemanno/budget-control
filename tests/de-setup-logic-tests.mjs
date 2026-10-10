import assert from 'node:assert/strict';
import fs from 'node:fs';

import { DE } from '../assets/js/country/de.js';
import { renderSetupGuide } from '../assets/js/views/setup.js';
import { renderFixedCosts } from '../assets/js/views/fixed-costs.js';
import { renderRecurring } from '../assets/js/views/recurring.js';
import { renderAccounts } from '../assets/js/views/accounts.js';
import { renderInsurance } from '../assets/js/views/insurance.js';
import { renderLegal } from '../assets/js/views/legal.js';
import { renderPension } from '../assets/js/views/pension.js';
import { renderSettings } from '../assets/js/views/settings.js';

const requiredIncome=['Gehalt','Unterhalt / Unterhaltsvorschuss','Kindergeld','Kinderzuschlag','Elterngeld','Sozialleistungen'];
for(const name of requiredIncome) assert.ok(DE.starterCategories.some(([n,kind])=>n===name&&kind==='income'),`missing DE income category ${name}`);
assert.ok(DE.starterCategories.some(([n,kind])=>n==='Familie & Kinder'&&kind==='expense'));
for(const [name,parent] of [
  ['Unterhaltszahlungen','Familie & Kinder'],
  ['Kinderbetreuung / Kita','Familie & Kinder'],
  ['Schule & Ausbildung','Familie & Kinder'],
  ['Kinderkosten','Familie & Kinder'],
  ['Strom & Energie','Wohnen'],
  ['Rundfunkbeitrag','Wohnen'],
  ['Privathaftpflicht','Versicherungen'],
  ['Kfz-Versicherung','Versicherungen'],
]) assert.ok(DE.starterSubcategories.some(([n,p,kind])=>n===name&&p===parent&&kind==='expense'),`missing DE expense category ${name}`);
assert.ok(DE.starterMerchantCategories.some(([merchant,category])=>merchant==='ARD ZDF Deutschlandradio Beitragsservice'&&category==='Rundfunkbeitrag'));

const categories=[
  {id:'inc-salary',name:'Gehalt',kind:'income',parent_id:null},
  {id:'inc-support',name:'Unterhalt / Unterhaltsvorschuss',kind:'income',parent_id:null},
  {id:'exp-home',name:'Wohnen',kind:'expense',parent_id:null},
  {id:'exp-rent',name:'Miete',kind:'expense',parent_id:'exp-home'},
  {id:'exp-health',name:'Krankenversicherung',kind:'expense',parent_id:null},
  {id:'exp-family',name:'Familie & Kinder',kind:'expense',parent_id:null},
  {id:'exp-support',name:'Unterhaltszahlungen',kind:'expense',parent_id:'exp-family'},
];
const accounts=[{account_id:'ing',name:'ING',currency:'EUR',account_type:'checking',current_balance:1000,is_archived:false}];
const household={id:'de-house',name:'Privat',country_code:'DE',base_currency:'EUR'};
const profile={locale:'de-DE',preferences:{}};

const setup=renderSetupGuide({
  accounts,categories,merchants:[],categorizationRules:[],recurringRules:[],
  budgets:[],goals:[],debts:[],receivables:[],taxCases:[],
  household,profile,canWrite:true,moduleAccess:{tax:true,budget:true},hiddenModules:[],
});
assert.match(setup,/Zahler \/ Quelle der Einnahme/);
assert.match(setup,/Eingang auf Konto/);
assert.match(setup,/Gehalt/);
assert.match(setup,/Krankenversicherung/);
assert.doesNotMatch(setup,/Krankenkasse/);
assert.doesNotMatch(setup,/#\/tax-advisor/);
assert.doesNotMatch(setup,/UBS/);

const fixed=renderFixedCosts({recurringRules:[],accounts,categories,merchants:[],household,profile,fxRates:[],canWrite:true});
assert.match(fixed,/Feste Einnahme \/ Gehalt/);
assert.doesNotMatch(fixed,/<option value="inc-salary">Gehalt<\/option>/);
assert.match(fixed,/Art der Gegenpartei/);

const recurring=renderRecurring({recurringRules:[],accounts,categories,contracts:[],insurance:[],debts:[],goalSources:[],household,profile,canWrite:true});
assert.doesNotMatch(recurring,/<option value="inc-salary">Gehalt<\/option>/);
assert.match(recurring,/Gehalt, Leistungen/);

const accountsHtml=renderAccounts({accounts:[],recurringRules:[],household,profile,canWrite:true,fxRates:[]});
assert.match(accountsHtml,/ING Girokonto/);
assert.match(accountsHtml,/ING, DKB, Sparkasse, Revolut/);
assert.match(accountsHtml,/DE89 3704/);
assert.doesNotMatch(accountsHtml,/UBS Lohnkonto/);

const insurance=renderInsurance({insurance:[],accounts,categories,documents:[],household,profile,fxRates:[],canWrite:true});
assert.match(insurance,/Krankenversicherung, Haftpflicht, Hausrat/);
assert.match(insurance,/<option value="EUR" selected>EUR<\/option>/);

const legal=renderLegal({legalCases:[],legalEvents:[],household,profile});
assert.match(legal,/Mahnung \/ Inkasso \/ Zwangsvollstreckung/);
assert.doesNotMatch(legal,/Mahnung \/ Betreibung \/ Inkasso/);

const pension=renderPension({pensions:[],household,profile,fxRates:[]});
assert.match(pension,/Betriebliche Altersvorsorge/);
assert.doesNotMatch(pension,/placeholder="z\. B\. Säule 3a VIAC"/);

const settings=renderSettings({
  household,profile,user:{email:'ana@example.com'},adminRole:null,householdRole:'owner',
  moduleAccess:{tax:true,budget:true},productModules:[
    {key:'core',label:'Core',is_core:true},{key:'tax',label:'Steuern',is_core:false},{key:'budget',label:'Budget',is_core:false}
  ],
  hiddenModules:[],accounts,categories,merchants:[],categorizationRules:[],recurringRules:[],
  budgets:[],goals:[],debts:[],receivables:[],taxCases:[],masterDataHouseholds:[],countryMasterCategories:[],countryMasterMerchants:[],
});
assert.doesNotMatch(settings,/value="tax"/);
assert.match(settings,/REWE, EDEKA/);
assert.match(settings,/Kategorien aktuell im Haushalt/);

const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
assert.match(main,/moduleKey === 'tax' && runtime\.household\?\.country_code !== 'CH'/);
assert.match(main,/requestedCategoryId=nullValue\(data,'categoryId'\)/);
assert.match(main,/fallbackName=runtime\.household\?\.country_code==='DE'\?'gehalt':'lohn'/);
assert.match(main,/Für eine Einnahme bitte eine Einnahmen-Kategorie wählen/);
assert.match(main,/Für eine Ausgabe bitte eine Ausgaben-Kategorie wählen/);
assert.match(main,/counterpartyKind==='merchant'/);
assert.match(main,/seedStarterCategoriesForHousehold\(runtime\.household\.id,runtime\.household\.country_code,runtime\.categories\)/);

console.log('DE setup and country-logic audit assertions OK');
