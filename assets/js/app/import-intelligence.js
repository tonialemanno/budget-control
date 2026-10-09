function sourceText(tx = {}) {
  return [tx.description, tx.counterparty, tx.bank_reference, tx.note]
    .filter(Boolean).join(' ').toLowerCase();
}

function containsAny(text, values) {
  return values.some((value) => text.includes(value));
}

export const IMPORT_SEMANTIC_OPTIONS = Object.freeze([
  ['', 'Automatisch erkennen'],
  ['earned_income', 'Verdienst / Lohn'],
  ['other_income', 'Sonstige echte Einnahme'],
  ['refund', 'Rückerstattung / Gutschrift'],
  ['receivable_repayment', 'Rückzahlung einer Forderung'],
  ['debt_repayment', 'Schuldentilgung / Darlehensrückzahlung'],
  ['tax_payment', 'Steuerzahlung'],
  ['asset_acquisition', 'Vermögenskauf / Fahrzeugkauf'],
  ['ignored', 'Nicht auswerten'],
]);

export function suggestImportSemantic(tx = {}) {
  const text = sourceText(tx);
  const amount = Number(tx.amount || 0);

  if (amount > 0) {
    if (containsAny(text, ['lohn','gehalt','salär','salary','stipendio','abacus umantis'])) {
      return { value:'earned_income', label:'Verdienst / Lohn', reason:'Lohnhinweis im Banktext' };
    }
    if (containsAny(text, ['rückerstattung','rueckerstattung','refund','retoure','storno','cashback'])) {
      return { value:'refund', label:'Rückerstattung / Gutschrift', reason:'Rückerstattungshinweis im Banktext' };
    }
    if (containsAny(text, ['rückzahlung','rueckzahlung','darlehen zurück','darlehen zurueck'])) {
      return { value:'receivable_repayment', label:'Rückzahlung einer Forderung', reason:'Rückzahlungshinweis im Banktext' };
    }
    return null;
  }

  if (amount < 0) {
    if (containsAny(text, ['staatssteuer','gemeindesteuer','bundessteuer','steuerzahlung',' tax '])) {
      return { value:'tax_payment', label:'Steuerzahlung', reason:'Steuerhinweis im Banktext' };
    }
    if (containsAny(text, ['tilgung','darlehensrate','kreditrate','loan repayment'])) {
      return { value:'debt_repayment', label:'Schuldentilgung / Darlehensrückzahlung', reason:'Tilgungshinweis im Banktext' };
    }
    if (containsAny(text, ['fahrzeugkauf','autokauf','rollerkauf','scooterkauf','motorradkauf'])) {
      return { value:'asset_acquisition', label:'Vermögenskauf / Fahrzeugkauf', reason:'Kaufhinweis im Banktext' };
    }
  }

  return null;
}
