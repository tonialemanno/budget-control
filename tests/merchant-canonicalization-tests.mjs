import assert from 'node:assert/strict';
import { merchantFromTransaction, suggestKnownCategoryName } from '../assets/js/app/csv-import.js';
import { merchantFamilyKey, merchantSimilarity } from '../assets/js/app/duplicate-intelligence.js';

const uzonA=merchantFromTransaction({counterparty:'Uzon Immobilien AG;CH St. Gallen 9000'});
const uzonB=merchantFromTransaction({counterparty:'Uzon Immobilien AG;Sonneggstrasse 5; 9000 St. Gallen; CH'});
assert.equal(uzonA.name,'Uzon Immobilien AG');
assert.equal(uzonB.name,'Uzon Immobilien AG');
assert.equal(uzonA.key,'uzon immobilien ag');
assert.equal(uzonB.key,'uzon immobilien ag');

const wellauerA=merchantFromTransaction({counterparty:'Wellauer AG;0900 St. Gallen'});
const wellauerB=merchantFromTransaction({counterparty:'Wellauer AG;9000 St. Gallen'});
assert.equal(wellauerA.key,'wellauer ag');
assert.equal(wellauerB.key,'wellauer ag');

const cityA=merchantFromTransaction({counterparty:'Finanzen der Stadt St. Gallen;9001 St. Gallen'});
const cityB=merchantFromTransaction({counterparty:'Finanzen der Stadt St. Gallen;Raghaus; 9001 St. Gallen; CH'});
assert.equal(cityA.key,'finanzen der stadt st gallen');
assert.equal(cityB.key,'finanzen der stadt st gallen');

const mcA=merchantFromTransaction({counterparty:'MCDONALDS ST. GALLEN;0000 ST. GALLEN'});
const mcB=merchantFromTransaction({counterparty:'RAMOTA MCDONALDS RESTA;0000 ST. GALLEN'});
assert.equal(mcA.name,"McDonald's");
assert.equal(mcB.name,"McDonald's");
assert.equal(mcA.key,'mcdonalds');
assert.equal(mcB.key,'mcdonalds');

const prefixed=merchantFromTransaction({counterparty:'Kartenzahlung; Beispiel AG; 9000 St. Gallen'});
assert.equal(prefixed.name,'Beispiel AG');
assert.equal(prefixed.key,'beispiel ag');

console.log('Merchant canonicalization assertions OK');

const aldiMobileTx={description:'ALDI SUISSE MOBILE; Zahlung UBS 10.03.2026'};
const aldiMobile=merchantFromTransaction(aldiMobileTx);
assert.equal(aldiMobile.name,'ALDI SUISSE MOBILE');
assert.equal(aldiMobile.key,'aldi suisse mobile');
assert.equal(suggestKnownCategoryName(aldiMobileTx),'Telefon & Internet');

const aldiRetailTx={description:'ALDI SUISSE; Kartenzahlung 10.03.2026'};
const aldiRetail=merchantFromTransaction(aldiRetailTx);
assert.equal(aldiRetail.name,'Aldi Suisse');
assert.equal(aldiRetail.key,'aldi suisse');
assert.equal(suggestKnownCategoryName(aldiRetailTx),'Lebensmittel');
assert.notEqual(merchantFamilyKey(aldiMobile),merchantFamilyKey(aldiRetail));
assert.ok(merchantSimilarity(aldiMobile,aldiRetail)<0.5);
