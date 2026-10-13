import assert from 'node:assert/strict';
import fs from 'node:fs';
import {renderYearClosing,yearCloseBlockers} from '../assets/js/views/year-closing.js';
import {routeFromPath} from '../assets/js/app/router.js';

const base={
  yearCloseYear:2025, household:{id:'h1',base_currency:'CHF'},
  profile:{locale:'de-CH'},canAdminHousehold:true,yearClosures:[],
  yearCloseOverview:{
    year:2025,status:'open',revision:0,can_close:false,hidden_accounts:0,
    unconfirmed_accounts:1,mismatched_accounts:0,pending_transactions:0,unclassified_transactions:1,
    accounts:[{id:'a1',name:'Sparkonto',currency:'CHF',calculated_balance:4500,
      statement_balance:null,statement_through:null,matches:false}],
  }
};
assert.equal(routeFromPath('/planning/year-closing').route,'year-closing');
const pending=renderYearClosing(base);
assert.match(pending,/Bankkonten abstimmen/);
assert.match(pending,/31\.12\.2025/);
assert.match(pending,/Noch nicht bestätigt/);
assert.match(pending,/nicht klassifizierte Buchungen/);
assert.match(pending,/Jahr 2025 verbindlich abschliessen/);
assert.match(pending,/type="submit" class="action-button action-button--primary" disabled/);
assert.match(pending,/type="checkbox" name="confirmed" required/);
assert.deepEqual(yearCloseBlockers(base.yearCloseOverview).length,2);

const historical=renderYearClosing({...base,yearCloseOverview:{...base.yearCloseOverview,
  accounts:[{...base.yearCloseOverview.accounts[0],calculated_balance:null}]}});
assert.match(historical,/Historischer Saldo nicht automatisch berechenbar/);
assert.match(historical,/data-form="year-close-account"/,'Historical accounts must remain signable from a statement');

const ready={...base,yearCloseOverview:{...base.yearCloseOverview,can_close:true,unconfirmed_accounts:0,unclassified_transactions:0,
  accounts:[{...base.yearCloseOverview.accounts[0],matches:true,statement_balance:4500,statement_through:'2025-12-31'}]}};
const open=renderYearClosing(ready);
assert.doesNotMatch(open,/name="accept" required disabled/);
assert.match(open,/Alle verbindlichen Prüfungen sind erfüllt/);
const closed=renderYearClosing({...ready,yearCloseOverview:{...ready.yearCloseOverview,status:'closed',revision:2}});
assert.match(closed,/Abgeschlossen · Schreibschutz/);
assert.match(closed,/Version 2/);
assert.match(closed,/year-close-reopen/);
assert.doesNotMatch(closed,/year-close-finalize/);
const denied=renderYearClosing({...ready,canAdminHousehold:false});
assert.match(denied,/Keine Berechtigung/);
assert.doesNotMatch(denied,/statementBalance/);
assert.match(renderYearClosing({...ready,yearCloseOverview:null,yearCloseError:'RPC failed'}),/Datenbankfehler/);

const sql=fs.readFileSync(new URL('../supabase/migrations/20261014003000_year_closing_archive.sql',import.meta.url),'utf8');
for(const phrase of ['create table if not exists public.year_closures','year_closure_versions','year_closure_events','enable row level security',
  'private.can_admin_household','year_close_overview','year_confirm_account','year_close_finalize','year_close_reopen',
  'pg_advisory_xact_lock','year_closure_tx_guard','year_closure_account_guard',
  "raise exception 'Das Jahr % ist abgeschlossen",
  "and coalesce(changed.updated_at,changed.created_at)>c.checked_at"]){
  assert.ok(sql.includes(phrase),'Missing yearly protection: '+phrase);
}
assert.ok(!/update\s+public\.accounts\s+set\s+balance_anchor_amount/i.test(sql),'Never reset account balance anchors');
const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
assert.match(main,/if\(importedClosedYearCandidates\.size&&canAdminHousehold\(\)\)/);
assert.match(main,/Jetzt den Jahresabschluss prüfen/);
assert.match(main,/yearCloseFinalize\(runtime\.household\.id,year\)/);
assert.match(main,/yearCloseReopen\(runtime\.household\.id,year,reason\)/);
console.log('Year-closing UI, permission, import prompt and SQL contract smoke checks passed');
