import * as overview from '../assets/js/views/overview.js';
import * as accounts from '../assets/js/views/accounts.js';
import * as transactions from '../assets/js/views/transactions.js';
import * as categories from '../assets/js/views/categories.js';
import * as imports from '../assets/js/views/imports.js';
import * as ih from '../assets/js/views/import-history.js';
import * as recurring from '../assets/js/views/recurring.js';
import * as fixedCosts from '../assets/js/views/fixed-costs.js';
import * as merchants from '../assets/js/views/merchants.js';
import * as docs from '../assets/js/views/documents.js';
import * as budget from '../assets/js/views/budget.js';
import * as bills from '../assets/js/views/bills.js';
import * as goals from '../assets/js/views/goals.js';
import * as tax from '../assets/js/views/tax-advisor.js';
import * as debts from '../assets/js/views/debts.js';
import * as receivables from '../assets/js/views/receivables.js';
import * as legal from '../assets/js/views/legal.js';
import * as family from '../assets/js/views/family.js';
import * as wealth from '../assets/js/views/wealth.js';
import * as property from '../assets/js/views/property.js';
import * as vehicles from '../assets/js/views/vehicles.js';
import * as insurance from '../assets/js/views/insurance.js';
import * as investments from '../assets/js/views/investments.js';
import * as pension from '../assets/js/views/pension.js';
import * as intelligence from '../assets/js/views/intelligence.js';
import * as settings from '../assets/js/views/settings.js';
import * as admin from '../assets/js/views/admin.js';
const mods={overview,accounts,transactions,categories,imports,ih,recurring,fixedCosts,merchants,docs,budget,bills,goals,tax,debts,receivables,legal,family,wealth,property,vehicles,insurance,investments,pension,intelligence,settings,admin};
let failed=0;
for (const [name,m] of Object.entries(mods)) {
  const fn=Object.values(m).find(v=>typeof v==='function' && /^render/.test(v.name));
  try { const out=fn({}); console.log('OK',name,typeof out,out?.length); }
  catch(e){ failed++; console.error('FAIL',name,e.stack); }
}
if(failed) process.exit(1);
