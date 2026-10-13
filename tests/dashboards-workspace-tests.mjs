import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderDashboards, DASHBOARD_PANELS } from '../assets/js/views/dashboards.js';
import { base } from './render-rich.mjs';
import { routeDefinition, routeFromPath } from '../assets/js/app/router.js';
import { setLocale, t } from '../assets/js/app/i18n.js';

const expected=['cockpit','cashflow','expenses','budget','wealth','goals'];
assert.deepEqual(DASHBOARD_PANELS.map(row=>row.key),expected);
assert.equal(routeDefinition('dashboards')?.path,'/dashboards');
assert.equal(routeFromPath('/finance/dashboards')?.route,'dashboards');

for(const view of expected){
  const html=renderDashboards({...base,dashboardView:view});
  assert.match(html,/dashboard-workspace/);
  assert.match(html,/dash-tabs/);
  assert.match(html,new RegExp('href="/dashboards\\?view='+view+'" class="dash-tab is-active"'));
  if(['cockpit','cashflow','expenses'].includes(view)) assert.match(html,/data-drilldown="transactions-range"/);
  if(view==='budget') assert.match(html,/href="\/planning\/budget"/);
  if(view==='wealth') assert.match(html,/data-drilldown="account-edit"/);
  if(view==='goals') assert.match(html,/href="\/planning\/goals"/);
  assert.doesNotMatch(html,/\bundefined\b|\bNaN\b|\$\{/);
  assert.equal((html.match(/class="dash-tab /g)||[]).length,6);
  assert.match(html,/Finanzmonat/);
}
const cockpit=renderDashboards({...base,dashboardView:'cockpit'});
assert.match(cockpit,/cashflow-svg/);
assert.match(cockpit,/donut-svg/);
assert.match(cockpit,/data-action="overview-drilldown-expense"/);
assert.match(cockpit,/data-action="statistics-drilldown-budget"/);

const cashflow=renderDashboards({...base,dashboardView:'cashflow'});
assert.match(cashflow,/data-direction="income"/);
assert.match(cashflow,/data-direction="expense"/);
assert.match(cashflow,/Finanzmonate im Vergleich/);

const wealth=renderDashboards({...base,dashboardView:'wealth'});
assert.match(wealth,/data-drilldown="account-edit"/);
assert.match(wealth,/Nettovermögen/);
const withoutFx=renderDashboards({...base,fxRates:null,dashboardView:'wealth'});
assert.match(withoutFx,/Nicht berechenbar/);
assert.match(withoutFx,/Ein Wechselkurs fehlt/);

const goals=renderDashboards({...base,dashboardView:'goals'});
assert.match(goals,/goal1|Notgroschen/);
assert.match(goals,/Sparziele/);
assert.match(goals,/Monatsplan/);
const privateHtml=renderDashboards({...base,privacyEnabled:true,dashboardView:'cockpit'});
assert.match(privateHtml,/•••/);
assert.doesNotMatch(privateHtml,/CHF 5'000|CHF 2'000/);

const empty={...base,accounts:[],transactions:[],budgets:[],goals:[],recurringRules:[],debts:[],assets:[],properties:[],vehicles:[],investments:[],pensions:[],receivables:[]};
for(const view of expected){
  const html=renderDashboards({...empty,dashboardView:view});
  assert.ok(html.includes('dash-tabs'));
  assert.doesNotMatch(html,/\bundefined\b|\bNaN\b|\$\{/);
}
for(const locale of ['it-CH','en-CH']){
  setLocale(locale);
  for(const key of ['Dashboards','Cockpit','Geldfluss','Ziele & Planung','Ein Wechselkurs fehlt. Kontosummen sind nicht berechenbar.']){
    assert.notEqual(t(key,locale),key,'Missing '+locale+' translation '+key);
  }
}
setLocale('de-CH');
const app=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
assert.match(app,/dashboards: renderDashboards/);
assert.match(app,/data-route="dashboards"/);
const styles=fs.readFileSync(new URL('../assets/css/components.css',import.meta.url),'utf8');
assert.match(styles,/\.dash-kpis/);
assert.match(styles,/@media\(max-width:600px\)/);
console.log('Six financial dashboard panels, data scenarios, mobile wiring and translations OK');
