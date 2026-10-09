import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const tx = read('assets/js/views/transactions.js');
const controller = read('assets/js/app/receipt-controller.js');
const api = read('assets/js/app/finance-api.js');
const config = read('assets/js/app/config.js');
const headers = read('_headers');
const index = read('index.html');
const css = read('assets/css/receipt.css');

assert.match(config, /version:\s*'2\.4\.16'/);
assert.match(tx, /data-action="receipt-camera"/);
assert.match(tx, /id="receiptCameraInput"[^>]+capture="environment"/);
assert.match(tx, /id="receipt-create"/);
assert.match(tx, /id="receiptRememberMerchant"/);
assert.match(controller, /analyzeReceiptImage/);
assert.match(controller, /findReceiptMatches/);
assert.match(controller, /Kassenbeleg · Fotoerfassung/);
assert.match(controller, /financeApi\.createDocument/);
assert.match(api, /notes:\s*'ilike\.\*Fotoerfassung\*'/);
assert.match(api, /external_reference/);
assert.match(headers, /tessdata\.projectnaptha\.com/);
assert.match(headers, /cdn\.jsdelivr\.net/);
assert.match(index, /assets\/css\/receipt\.css/);
assert.match(index, /assets\/js\/app\/receipt-controller\.js/);
assert.match(css, /@media \(max-width: 660px\)/);
console.log('receipt integration assertions OK');
