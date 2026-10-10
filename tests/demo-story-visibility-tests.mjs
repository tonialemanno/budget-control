import assert from 'node:assert/strict';
import {base} from './render-rich.mjs';
import {renderFamily} from '../assets/js/views/family.js';
import {renderGoals} from '../assets/js/views/goals.js';
import {renderVehicles} from '../assets/js/views/vehicles.js';

const demoProfile={
 ...base.profile,
 preferences:{
  demo_family:{
   fictional:true,location:'Zug, Schweiz',
   adults:[{name:'Maximilian Müller',relationship:'Vater',employer:'Glencore'},{name:'Petra Müller',relationship:'Mutter',employer:'Swisscom'}],
   children:[{name:'Peter Müller',born:'2015-04-22',stage:'Primarschule'},{name:'Lukas Müller',born:'2019-06-18',stage:'Tagesstruktur'}],
   pets:[{name:'Bruno',type:'Hund'},{name:'Nala',type:'Katze'}]
  }
 }
};
const family=renderFamily({...base,profile:demoProfile});
for(const name of ['Maximilian Müller','Petra Müller','Peter Müller','Lukas Müller','Bruno','Nala','App-Zugänge'])
 assert.ok(family.includes(name),'Demo family panel missing: '+name);

const account={...base.accounts[1],account_id:'demo-goal-account',current_balance:3500,currency:'CHF'};
const saving={...base.goals[0],name:'Ferien Italien',start_date:'2025-09-01',account_id:account.account_id,current_amount:3500,monthly_amount:250};
const transfer={id:'tr-demo',account_id:account.account_id,occurred_at:'2026-09-07T12:00:00Z',transfer_group_id:'tg-1',
 amount:250,currency:'CHF',status:'booked',description:'Sparen: Ferien Italien'};
const goals=renderGoals({...base,profile:demoProfile,accounts:[account],goals:[saving],transactions:[transfer],goalSources:[]});
for(const needle of ['Sparverlauf aus','Einzahlungen seit Beginn','Aktueller Kontostand','Sparbeginn'])
 assert.ok(goals.includes(needle),'Missing savings detail: '+needle);

const vehicle={...base.vehicles[0],id:'demo-car',name:'Škoda Kodiaq',purchase_price:31000,purchase_date:'2025-10-01'};
const carDebt={...base.debts[0],name:'Škoda Kodiaq Leasing',start_date:'2025-10-01',installment_amount:420};
const leasePayment={id:'lease-1',vehicle_id:'demo-car',occurred_at:'2026-09-05T10:00:00Z',status:'booked',
 cashflow_type:'debt_payment',currency:'CHF',amount:-420};
const vehicles=renderVehicles({...base,vehicles:[vehicle],debts:[carDebt],transactions:[leasePayment]});
for(const needle of ['Kaufpreis','Leasingbeginn','Monatliche Rate','Bereits bezahlt','Monatliche Zahlungen'])
 assert.ok(vehicles.includes(needle),'Missing vehicle story: '+needle);

console.log('Demo family, 14-month savings, and vehicle payment stories rendered correctly');
