import assert from 'node:assert/strict';
import fs from 'node:fs';

const recurring=fs.readFileSync(new URL('../assets/js/views/recurring.js',import.meta.url),'utf8');
const fixed=fs.readFileSync(new URL('../assets/js/views/fixed-costs.js',import.meta.url),'utf8');

assert.match(recurring,/primaryAccountPreferenceId/);
assert.match(recurring,/primaryOperatingAccount/);
assert.match(recurring,/defaultAccountId/);
assert.match(recurring,/!edit&&a\.account_id===defaultAccountId\?'selected':''/);
assert.match(recurring,/destinationAccountOptions/);

assert.match(fixed,/primaryAccountPreferenceId/);
assert.match(fixed,/primaryOperatingAccount/);
assert.match(fixed,/defaultAccountId/);
assert.match(fixed,/!edit&&a\.account_id===defaultAccountId\?'selected':''/);
assert.match(fixed,/destinationAccountOptions/);

console.log('recurring-primary-account-tests: ok');
