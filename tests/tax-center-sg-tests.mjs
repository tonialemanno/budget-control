import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderTaxAdvisor } from '../assets/js/views/tax-advisor.js';

const household={id:'h1',country_code:'CH',tax_region_code:'SG',base_currency:'CHF'};
const profile={locale:'de-CH'};
const rules=[
  {id:'r25',country_code:'CH',canton_code:'SG',tax_year:2025,version:'SG-2025',status:'official',notes:'official'},
  {id:'r26',country_code:'CH',canton_code:'SG',tax_year:2026,version:'SG-2026',status:'partial',notes:'partial'},
  {id:'r27',country_code:'CH',canton_code:'SG',tax_year:2027,version:'SG-2027',status:'pending',notes:'pending'},
];
const taxCases=[
  {id:'c25',household_id:'h1',tax_year:2025,country_code:'CH',canton_code:'SG',status:'open',currency:'CHF',expected_tax_amount:12000,assessed_tax_amount:null,tax_rule_versions:rules[0]},
  {id:'c26',household_id:'h1',tax_year:2026,country_code:'CH',canton_code:'SG',status:'collecting',currency:'CHF',expected_tax_amount:15000,assessed_tax_amount:null,tax_rule_versions:rules[1]},
  {id:'c27',household_id:'h1',tax_year:2027,country_code:'CH',canton_code:'SG',status:'open',currency:'CHF',expected_tax_amount:16000,assessed_tax_amount:null,tax_rule_versions:rules[2]},
];
const obligations=[
  {id:'o25',tax_case_id:'c25',amount:12000,currency:'CHF',status:'open',obligation_type:'provisional',label:'Provisorische Steuer 2025',due_date:'2026-03-31'},
  {id:'o26',tax_case_id:'c26',amount:15000,currency:'CHF',status:'open',obligation_type:'provisional',label:'Provisorische Steuer 2026',due_date:'2026-12-31'},
  {id:'o27',tax_case_id:'c27',amount:16000,currency:'CHF',status:'open',obligation_type:'provisional',label:'Plan Steuer 2027',due_date:'2027-12-31'},
];
const payments=[
  {id:'p25',tax_case_id:'c25',amount:8000,currency:'CHF',payment_type:'payment',paid_at:'2026-06-01'},
  {id:'p26',tax_case_id:'c26',amount:5000,currency:'CHF',payment_type:'payment',paid_at:'2026-08-01'},
];
const html=renderTaxAdvisor({
  household,profile,taxYear:2026,canWrite:true,taxRuleVersions:rules,taxCases,
  taxPeople:[{id:'tp1',tax_case_id:'c26',person_no:1,role:'taxpayer',first_name:'Demo',last_name:'Person',birth_date:'1988-05-12',occupation:'Expert',employer_name:'Demo AG'}],
  taxChildren:[{id:'tc1',tax_case_id:'c26',first_name:'Demo-Kind',last_name:'Muster',birth_date:'2015-04-22',education_status:'school',school_or_training:'Primarschule',childcare_costs:1200,currency:'CHF',assignment_status:'review'}],
  taxEmployments:[{id:'te1',tax_case_id:'c26',tax_person_id:'tp1',employer_name:'Demo AG',work_location:'St. Gallen',period_from:'2026-01-01',period_to:'2026-12-31',gross_income:78000,currency:'CHF',work_days:220,homeoffice_days:50,vacation_days:25,sick_days:3,field_service_days:12,commuting_distance_km:8.4,transport_mode:'ÖV'}],
  taxCaseSections:[{tax_case_id:'c26',section_key:'income',status:'complete'}],
  taxItems:[{id:'i1',tax_case_id:'c26',section_key:'income',item_type:'salary_certificate',title:'Lohnausweis Demo',currency:'CHF',verification_status:'verified',occurred_on:'2026-12-31',source_type:null,source_id:null}],
  taxObligations:obligations,taxPayments:payments,
  transactions:[{id:'tx1',status:'booked',transfer_group_id:null,cashflow_type:'standard',occurred_at:'2026-08-01T10:00:00Z',amount:-5000,currency:'CHF',description:'Steuerzahlung 2026'}],
  debtPayments:[],documents:[],accounts:[],pensions:[],debts:[],receivables:[],insurance:[],investments:[],properties:[],vehicles:[],bills:[],fxRates:null,
});

assert.match(html,/Tax Center · St\.Gallen/);
assert.match(html,/Steuerkonto 2025–2027/);
assert.match(html,/Steuerjahr 2025/);
assert.match(html,/Steuerjahr 2026/);
assert.match(html,/Steuerjahr 2027/);
assert.match(html,/CHF 8['’]000\.00|CHF 8,000\.00|CHF 8\.000,00/);
assert.match(html,/CHF 4['’]000\.00|CHF 4,000\.00|CHF 4\.000,00/);
assert.match(html,/CHF 5['’]000\.00|CHF 5,000\.00|CHF 5\.000,00/);
assert.match(html,/CHF 10['’]000\.00|CHF 10,000\.00|CHF 10\.000,00/);
assert.match(html,/Personen &amp; Haushalt/);
assert.match(html,/Banken &amp; Wertschriften/);
assert.match(html,/Kryptowährungen/);
assert.match(html,/Erbschaften &amp; Schenkungen/);
assert.match(html,/Steuerposition erfassen/);
assert.match(html,/tax-obligation-create/);
assert.match(html,/tax-payment-create/);
assert.match(html,/tax-section-status/);
assert.match(html,/Steuerdaten 2026 exportieren/);
assert.match(html,/Person 1/);
assert.match(html,/Demo AG/);
assert.match(html,/Homeoffice-Tage/);
assert.match(html,/Pendeltage/);
assert.match(html,/Kind erfassen/);
assert.match(html,/Finance-Quelle/);
assert.match(html,/taxItemDocumentInput/);
assert.match(html,/taxPaymentTransaction/);

const api=fs.readFileSync(new URL('../assets/js/app/finance-api.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/20261002_finance_tax_center_core_sg.sql',import.meta.url),'utf8');
const peopleMigration=fs.readFileSync(new URL('../supabase/migrations/20261002_finance_tax_center_people_work_sg.sql',import.meta.url),'utf8');
const integrityMigration=fs.readFileSync(new URL('../supabase/migrations/20261002_finance_tax_center_link_integrity.sql',import.meta.url),'utf8');

for(const method of ['listTaxRuleVersions','listTaxCases','listTaxPeople','createTaxPerson','listTaxChildren','createTaxChild','listTaxEmployments','createTaxEmployment','ensureTaxCase','listTaxCaseSections','upsertTaxCaseSection','listTaxItems','createTaxItem','listTaxObligations','createTaxObligation','listTaxPayments','createTaxPayment']){
  assert.match(api,new RegExp(method));
}
assert.match(main,/tax-case-settings/);
assert.match(main,/tax-item-create/);
assert.match(main,/tax-obligation-create/);
assert.match(main,/tax-payment-create/);
assert.match(main,/tax-case-select/);
assert.match(migration,/create table if not exists public\.tax_cases/);
assert.match(migration,/create table if not exists public\.tax_items/);
assert.match(migration,/create table if not exists public\.tax_obligations/);
assert.match(migration,/create table if not exists public\.tax_payments/);
assert.match(migration,/private\.has_module_access\('tax'\)/);
assert.match(migration,/SG-2025/);
assert.match(migration,/SG-2026/);
assert.match(migration,/SG-2027/);
assert.match(peopleMigration,/create table if not exists public\.tax_people/);
assert.match(peopleMigration,/create table if not exists public\.tax_children/);
assert.match(peopleMigration,/create table if not exists public\.tax_employments/);
assert.match(peopleMigration,/homeoffice_days/);
assert.match(integrityMigration,/validate_tax_item_source/);
assert.match(integrityMigration,/validate_tax_payment_links/);

console.log('SG tax center assertions OK');
