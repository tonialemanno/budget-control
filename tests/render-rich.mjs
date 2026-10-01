import { pathToFileURL } from 'node:url';
import {renderOverview} from '../assets/js/views/overview.js';
import {renderAccounts} from '../assets/js/views/accounts.js';
import {renderTransactions} from '../assets/js/views/transactions.js';
import {renderCategories} from '../assets/js/views/categories.js';
import {renderImports} from '../assets/js/views/imports.js';
import {renderImportHistory} from '../assets/js/views/import-history.js';
import {renderRecurring} from '../assets/js/views/recurring.js';
import {renderFixedCosts} from '../assets/js/views/fixed-costs.js';
import {renderMerchants} from '../assets/js/views/merchants.js';
import {renderDocuments} from '../assets/js/views/documents.js';
import {renderBudget} from '../assets/js/views/budget.js';
import {renderBills} from '../assets/js/views/bills.js';
import {renderGoals} from '../assets/js/views/goals.js';
import {renderTaxAdvisor} from '../assets/js/views/tax-advisor.js';
import {renderDebts} from '../assets/js/views/debts.js';
import {renderReceivables} from '../assets/js/views/receivables.js';
import {renderLegal} from '../assets/js/views/legal.js';
import {renderFamily} from '../assets/js/views/family.js';
import {renderWealth} from '../assets/js/views/wealth.js';
import {renderProperty} from '../assets/js/views/property.js';
import {renderVehicles} from '../assets/js/views/vehicles.js';
import {renderInsurance} from '../assets/js/views/insurance.js';
import {renderInvestments} from '../assets/js/views/investments.js';
import {renderPension} from '../assets/js/views/pension.js';
import {renderIntelligence} from '../assets/js/views/intelligence.js';
import {renderSettings} from '../assets/js/views/settings.js';
import {renderAdmin} from '../assets/js/views/admin.js';
const now=new Date(), iso=now.toISOString(), day=iso.slice(0,10), month=iso.slice(0,7);
const household={id:'h1',name:'Privat',base_currency:'CHF',country_code:'CH',tax_region_code:'SG'};
const profile={user_id:'u1',display_name:'Test User',locale:'de-CH',preferences:{}};
const fxRates={base:'CHF',rates:{CHF:1,EUR:1.07,USD:1.25,GBP:1.4},updated_at:iso,source:'test'};
const accounts=[
 {account_id:'a1',id:'a1',household_id:'h1',name:'Lohnkonto',account_type:'checking',currency:'CHF',current_balance:5000,visibility:'private'},
 {account_id:'a2',id:'a2',household_id:'h1',name:'Sparkonto',account_type:'savings',currency:'CHF',current_balance:2000,visibility:'household'},
 {account_id:'a3',id:'a3',household_id:'h1',name:'Euro Kasse',account_type:'cash',currency:'EUR',current_balance:100,visibility:'private'}
];
const categories=[{id:'c1',name:'Lebensmittel',kind:'expense'},{id:'c2',name:'Lohn',kind:'income'},{id:'c3',name:'Zins',kind:'expense'}];
const merchants=[{id:'m1',name:'Migros',normalized_key:'migros',default_category_id:'c1'}];
const transactions=[
 {id:'t1',household_id:'h1',account_id:'a1',category_id:'c2',merchant_id:null,occurred_at:iso,amount:5000,currency:'CHF',description:'Lohn',counterparty:'Arbeitgeber',status:'booked',source:'manual',transfer_group_id:null,cashflow_type:'standard',accounts:{name:'Lohnkonto'},categories:{name:'Lohn',kind:'income'},merchants:null,tax_relevant:false},
 {id:'t2',household_id:'h1',account_id:'a1',category_id:'c1',merchant_id:'m1',occurred_at:iso,amount:-120.5,currency:'CHF',description:'Migros Einkauf',counterparty:'Migros',status:'booked',source:'import',transfer_group_id:null,cashflow_type:'standard',accounts:{name:'Lohnkonto'},categories:{name:'Lebensmittel',kind:'expense'},merchants:{name:'Migros',normalized_key:'migros',default_category_id:'c1'},tax_relevant:true,tax_category:'Berufskosten'},
 {id:'t3',household_id:'h1',account_id:'a1',category_id:null,merchant_id:null,occurred_at:iso,amount:-300,currency:'CHF',description:'Schuldenzahlung: Andy',counterparty:'Andy',status:'booked',source:'manual',transfer_group_id:null,cashflow_type:'debt_payment',accounts:{name:'Lohnkonto'},categories:null,merchants:null,tax_relevant:false},
 {id:'t4',household_id:'h1',account_id:'a1',category_id:null,merchant_id:null,occurred_at:iso,amount:-500,currency:'CHF',description:'Umbuchung',counterparty:null,status:'booked',source:'manual',transfer_group_id:'g1',cashflow_type:'standard',accounts:{name:'Lohnkonto'},categories:null,merchants:null,tax_relevant:false},
 {id:'t5',household_id:'h1',account_id:'a2',category_id:null,merchant_id:null,occurred_at:iso,amount:500,currency:'CHF',description:'Umbuchung',counterparty:null,status:'booked',source:'manual',transfer_group_id:'g1',cashflow_type:'standard',accounts:{name:'Sparkonto'},categories:null,merchants:null,tax_relevant:false},
];
const debtPayments=[{id:'dp1',household_id:'h1',debt_id:'d1',transaction_id:'t3',payment_account_id:'a1',paid_at:day,amount:300,principal_amount:280,interest_amount:15,fee_amount:5,currency:'CHF',source:'created_transaction',outstanding_before:5000,outstanding_after:4720,debt_status_before:'active',next_payment_date_before:day,next_payment_date_after:day,advance_next_date:true,reversed_at:null,created_at:iso,debts:{name:'Andy',creditor:'Andy',currency:'CHF'},transactions:{id:'t3',description:'Schuldenzahlung: Andy',amount:-300,currency:'CHF',occurred_at:iso,accounts:{name:'Lohnkonto'}}}];
const budgets=[{id:'b1',household_id:'h1',category_id:'c1',merchant_id:null,month_start:month+'-01',amount:500,categories:{name:'Lebensmittel',kind:'expense'},merchants:null}];
const bills=[{id:'bill1',household_id:'h1',account_id:'a1',category_id:'c1',name:'Strom',provider:'Stadtwerk',amount:100,currency:'CHF',due_date:day,status:'open',accounts:{name:'Lohnkonto'},categories:{name:'Lebensmittel',kind:'expense'}}];
const contracts=[{id:'con1',household_id:'h1',account_id:'a1',category_id:'c1',name:'Internet',provider:'ISP',contract_type:'telecom',amount:80,currency:'CHF',billing_cadence:'monthly',next_payment_date:day,status:'active',accounts:{name:'Lohnkonto',currency:'CHF'},categories:{name:'Lebensmittel',kind:'expense'}}];
const recurringRules=[{id:'r1',household_id:'h1',account_id:'a1',category_id:'c1',direction:'expense',description:'Internet',counterparty:'ISP',amount:80,currency:'CHF',cadence:'monthly',next_date:day,active:true,accounts:{name:'Lohnkonto'},categories:{name:'Lebensmittel',kind:'expense'}}];
const goals=[{id:'goal1',household_id:'h1',name:'Notgroschen',target_amount:10000,current_amount:2500,monthly_amount:300,currency:'CHF',target_date:`${now.getFullYear()+1}-12-31`,goal_type:'emergency',status:'active'}];
const goalSources=[{id:'gs1',household_id:'h1',goal_id:'goal1',source_type:'fixed',label:'Extra',amount:100,recurring_rule_id:null,active:true}];
const debts=[{id:'d1',household_id:'h1',debt_type:'private',creditor:'Andy',name:'Privatschuld',original_amount:5000,outstanding_amount:4720,currency:'CHF',interest_rate:0,installment_amount:300,payment_cadence:'monthly',payment_account_id:'a1',recurring_rule_id:null,next_payment_date:day,start_date:day,end_date:null,status:'active',notes:'Test'}];
const legalCases=[{id:'l1',household_id:'h1',case_type:'collection',creditor:'Firma',reference:'REF',original_amount:500,outstanding_amount:400,currency:'CHF',status:'open',next_action_date:day,notes:'x'}];
const legalEvents=[{id:'le1',case_id:'l1',household_id:'h1',event_date:day,event_type:'Notiz',title:'Kontakt',notes:'Test'}];
const assets=[{id:'as1',household_id:'h1',asset_type:'valuable',name:'Uhr',current_value:1000,currency:'CHF',acquired_date:day,notes:null}];
const properties=[{id:'p1',household_id:'h1',name:'Wohnung',property_type:'home',current_value:500000,currency:'CHF',purchase_price:450000,purchase_date:day,monthly_running_cost:500,renovation_reserve:100}];
const vehicles=[{id:'v1',household_id:'h1',name:'Auto',vehicle_type:'car',current_value:10000,currency:'CHF',purchase_price:15000,purchase_date:day,monthly_running_cost:250,license_plate:'SG 1',mileage_km:50000}];
const insurance=[{id:'i1',household_id:'h1',name:'Hausrat',provider:'Versicherung',policy_number:'P1',insurance_type:'household',premium_amount:300,currency:'CHF',billing_cadence:'annual',next_payment_date:day,last_payment_date:day,status:'active',account_id:'a1',category_id:'c1',accounts:{name:'Lohnkonto',currency:'CHF'},categories:{name:'Lebensmittel',kind:'expense'}}];
const investments=[{id:'inv1',household_id:'h1',name:'ETF',investment_type:'etf',symbol:'ABC',quantity:10,avg_cost:100,current_price:110,current_value:1100,currency:'CHF',provider:'Broker'}];
const investmentTransactions=[{id:'it1',household_id:'h1',investment_id:'inv1',trade_date:day,side:'buy',quantity:1,unit_price:100,fees:1,currency:'CHF',notes:null}];
const pensions=[{id:'pen1',household_id:'h1',country_code:'CH',pension_type:'pillar_3a',provider:'Bank',name:'Säule 3a',current_value:20000,currency:'CHF',annual_contribution:7000}];
const documents=[{id:'doc1',household_id:'h1',object_type:'transaction',object_id:'t2',name:'beleg.pdf',storage_path:'h1/x.pdf',mime_type:'application/pdf',file_size:1000,document_date:day,notes:null,tax_relevant:true,tax_year:now.getFullYear(),tax_category:'Berufskosten',created_at:iso}];
const importBatches=[{id:'ib1',household_id:'h1',account_id:'a1',file_name:'test.csv',row_count:1,imported_count:1,skipped_count:0,status:'completed',created_at:iso,accounts:{name:'Lohnkonto',currency:'CHF'}}];
transactions[1].import_batch_id='ib1';
const categorizationRules=[{id:'cr1',household_id:'h1',category_id:'c1',field_name:'description',match_type:'contains',match_value:'Migros',priority:100,active:true,categories:{name:'Lebensmittel',kind:'expense'}}];
const householdMembers=[{user_id:'u1',email:'test@example.com',display_name:'Test User',role:'owner'},{user_id:'u2',email:'view@example.com',display_name:'Viewer',role:'viewer'}];
const moduleAccess={core:true,money:true,budget:true,bills:true,goals:true,tax:true,debts:true,legal:true,family:true,wealth:true,property:true,vehicles:true,insurance:true,investments:true,pension:true,intelligence:true};
const productModules=Object.keys(moduleAccess).map((key,i)=>({key,label:key,group_name:'Test',sort_order:i,is_core:['core','money'].includes(key),is_available:true}));
const adminUsers=[{id:'u1',email:'test@example.com',display_name:'Test User',created_at:iso,last_sign_in_at:iso,modules:moduleAccess},{id:'u2',email:'view@example.com',display_name:'Viewer',created_at:iso,last_sign_in_at:null,modules:{core:true,money:true}}];
export const base={household,profile,fxRates,accounts,categories,merchants,transactions,debtPayments,budgets,bills,contracts,recurringRules,goals,goalSources,debts,legalCases,legalEvents,assets,properties,vehicles,insurance,investments,investmentTransactions,pensions,documents,importBatches,categorizationRules,householdMembers,moduleAccess,productModules,adminUsers,canWrite:true,canAdminHousehold:true,householdRole:'owner',depth:'expert',taxYear:now.getFullYear(),transactionView:'details',transactionPeriod:'all',transactionQuery:'',transactionCategory:'all',transactionAccount:'all',transactionFrom:'',transactionTo:'',transactionPage:1,categorizationOpen:true,categorizationFilter:'action',categorizationPage:1,debtExpandedId:'d1',adminQuery:'',adminPage:1,adminExpandedUserId:'u1',hiddenModules:[],privacyEnabled:false};
export const tests={overview:renderOverview,accounts:renderAccounts,transactions:renderTransactions,categories:renderCategories,imports:renderImports,'import-history':renderImportHistory,recurring:renderRecurring,'fixed-costs':renderFixedCosts,merchants:renderMerchants,documents:renderDocuments,budget:renderBudget,bills:renderBills,goals:renderGoals,'tax-advisor':renderTaxAdvisor,debts:renderDebts,receivables:renderReceivables,legal:renderLegal,family:renderFamily,wealth:renderWealth,property:renderProperty,vehicles:renderVehicles,insurance:renderInsurance,investments:renderInvestments,pension:renderPension,intelligence:renderIntelligence,settings:renderSettings,admin:renderAdmin};
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  let fail=0;
  for (const [name,fn] of Object.entries(tests)) {
    try {
      const out=fn(base);
      if(typeof out!=='string'||!out.includes('<')) throw new Error('invalid html');
      console.log('OK',name,out.length);
    } catch(e) {
      fail++;
      console.error('FAIL',name,e.stack);
    }
  }
  if(fail) process.exit(1);
}
