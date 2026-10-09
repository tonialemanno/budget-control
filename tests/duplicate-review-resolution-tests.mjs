import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');

assert.match(main,/async function finishDuplicateMerge\(keep,duplicate,message\)/);
assert.match(main,/runtime\.transactions=\(runtime\.transactions\|\|\[\]\)\.filter\(\(row\)=>row\.id!==duplicate\.id\)/);
assert.match(main,/doc\?\.object_type==='transaction'&&doc\?\.object_id===duplicate\.id/);
assert.match(main,/await loadFinanceData\(\{generation,userId\}\);\s*assertActiveSession\(generation,userId\);\s*render\(\);/);

assert.match(main,/function finishDuplicateIgnore\(left,right,ignoredRow,message\)/);
assert.match(main,/runtime\.transactionDuplicateIgnores\.push/);
assert.match(main,/finishDuplicateIgnore\(left,right,ignored/);

const suggestedBlock=main.slice(
  main.indexOf("if (action === 'transaction-merge-suggested')"),
  main.indexOf("if (action === 'transaction-duplicate-ignore')")
);
assert.match(suggestedBlock,/await finishDuplicateMerge\(keep,duplicate/);
assert.doesNotMatch(suggestedBlock,/await refresh\(/);

const formBlock=main.slice(
  main.indexOf("if (id === 'transaction-merge')"),
  main.indexOf("if (id === 'transaction-create')")
);
assert.match(formBlock,/await finishDuplicateMerge\(keep,duplicate/);
assert.doesNotMatch(formBlock,/await refresh\(/);

console.log('duplicate review resolution assertions OK');
