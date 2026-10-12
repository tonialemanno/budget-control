import assert from 'node:assert/strict';
import { buildStatisticsModel } from '../assets/js/app/statistics-model.js';
import { renderCashflowChart } from '../assets/js/app/charts.js';
import { renderStatistics } from '../assets/js/views/statistics.js';
import { routeDefinition, routeFromPath } from '../assets/js/app/router.js';
import { base } from './render-rich.mjs';

const model=buildStatisticsModel({...base,now:new Date(),cycles:12,categoryLimit:8});
assert.equal(model.currency,base.household.base_currency);
assert.equal(model.series.length,12);
assert.ok(model.current);
assert.ok(Array.isArray(model.categories));
assert.ok(Array.isArray(model.budgetRows));
assert.ok(model.budgetRows.every((row)=>Array.isArray(row.transactionIds)),'budget drill-down must carry exact transaction ids');
assert.ok(Array.isArray(model.accounts));
assert.ok(model.annualIncome);

const html=renderStatistics(base);
assert.match(html,/Statistik/);
assert.match(html,/statistics-metric-grid/);
assert.match(html,/Einnahmen & Ausgaben/);
assert.match(html,/Ausgaben nach Kategorien/);
assert.match(html,/Budgetfortschritt/);
assert.match(html,/data-transaction-ids=/);
assert.match(html,/Kontostände/);
assert.match(html,/data-action="overview-drilldown-income"/);
assert.doesNotMatch(html,/\bundefined\b|\bNaN\b|\$\{/);

const chart=renderCashflowChart({
  series:[{
    start:new Date('2026-09-25T00:00:00'),
    endExclusive:new Date('2026-10-25T00:00:00'),
    date:new Date('2026-09-25T00:00:00'),
    income:3000,
    expenses:1200,
    net:1800,
    coverage:'full',
  }],
  currency:'EUR',
  locale:'de-DE',
  interactive:true,
});
assert.match(chart,/cashflow-hit/);
assert.match(chart,/data-drilldown="transactions-range"/);
assert.match(chart,/data-direction="income"/);
assert.match(chart,/data-direction="expense"/);
assert.match(chart,/data-from="2026-09-25"/);
assert.match(chart,/data-to="2026-10-24"/);

assert.equal(routeDefinition('statistics')?.path,'/statistics');
assert.equal(routeFromPath('/finance/statistics')?.route,'statistics');

console.log('statistics dashboard assertions OK');
