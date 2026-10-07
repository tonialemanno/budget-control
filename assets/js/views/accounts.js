import { accountCard, emptyState, formShell, metricCard, pageHeader } from '../app/components.js';
import { escapeHtml, money } from '../app/format.js';
import { icon } from '../app/icons.js';
import { convertAmount, fxLabel } from '../app/fx.js';
import { buildAccountProjection } from '../app/projections.js';
import { primaryAccountPreferenceId } from '../app/user-preferences.js';

const ACCOUNT_TYPES = [
  ['checking','Zahlungskonto'], ['savings','Sparkonto'], ['cash','Bargeld'], ['credit_card','Kreditkarte'],
  ['wallet','Onlinekonto / Wallet'], ['investment','Investmentkonto'], ['pension','Vorsorgekonto'], ['other','Sonstiges'],
];
const CURRENCIES = ['CHF','EUR','USD','GBP'];

function typeOptions() {
  return ACCOUNT_TYPES.map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
}

function currencyOptions(selected = 'CHF') {
  return CURRENCIES.map((currency)=>`<option value="${currency}" ${currency===selected?'selected':''}>${currency}</option>`).join('');
}

export function renderAccounts({ accounts = [], recurringRules = [], household, profile, canWrite = false, fxRates } = {}) {
  const baseCurrency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const primaryAccountId = primaryAccountPreferenceId(profile,household?.id,accounts);
  const liquidTypes = new Set(['checking','savings','cash','wallet']);
  const baseLiquid = accounts
    .filter((a) => liquidTypes.has(a.account_type))
    .reduce((s,a) => s + (convertAmount(a.current_balance,a.currency,baseCurrency,fxRates) ?? 0), 0);
  const baseCredit = accounts
    .filter((a) => a.account_type === 'credit_card')
    .reduce((s,a) => s + (convertAmount(a.current_balance,a.currency,baseCurrency,fxRates) ?? 0), 0);
  const foreign = new Map();
  for (const account of accounts.filter((a)=>a.currency !== baseCurrency && liquidTypes.has(a.account_type))) {
    foreign.set(account.currency, (foreign.get(account.currency) || 0) + Number(account.current_balance || 0));
  }
  const foreignSummary = [...foreign.entries()].map(([currency,value])=>money(value,{currency,locale})).join(' · ') || 'Keine';

  const createFields = `
    <label class="field"><span>Name</span><input class="text-control" name="name" required placeholder="z. B. UBS Lohnkonto oder Revolut EUR"></label>
    <label class="field"><span>Kontotyp</span><select class="text-control" name="accountType" required>${typeOptions()}</select></label>
    <label class="field"><span>Bank / Anbieter</span><input class="text-control" name="institutionName" placeholder="z. B. UBS, Revolut"></label>
    <label class="field"><span>IBAN / Kontokennung</span><input class="text-control" name="externalAccountRef" placeholder="optional · z. B. CH93 0076 …"><small>Hilft Spendy, eigene Konten bei Bankimporten automatisch als Umbuchung zu erkennen. Wird nicht für Zahlungen verwendet.</small></label>
    <label class="field"><span>Kontowährung</span><select class="text-control" name="currency" required>${currencyOptions(baseCurrency)}</select><small>Die Kontowährung ist unabhängig vom Wohnland und von der Basiswährung des Haushalts.</small></label>
    <label class="field"><span>Kontostand jetzt</span><input class="text-control" name="balance" type="number" step="0.01" required value="0"><small>Negative Salden mit Minus eingeben, z. B. -1250.40.</small></label>
    <label class="field"><span>Sichtbarkeit</span><select class="text-control" name="visibility"><option value="private">Privat</option><option value="household">Im Haushalt geteilt</option></select></label>
    <div class="field form-grid-span"><small>Der eingegebene Betrag ist der verbindliche Stand jetzt. Historische Importe vor diesem Zeitpunkt verändern ihn nicht rückwirkend. Für ein Multiwährungs-Wallet wird pro Währung ein Konto geführt, z. B. Revolut CHF und Revolut EUR.</small></div>`;

  const editFields = `
    <input type="hidden" name="accountId" id="accountEditId">
    <label class="field"><span>Name</span><input class="text-control" name="name" id="accountEditName" required></label>
    <label class="field"><span>Kontotyp</span><select class="text-control" name="accountType" id="accountEditType" required>${typeOptions()}</select></label>
    <label class="field"><span>Bank / Anbieter</span><input class="text-control" name="institutionName" id="accountEditInstitution"></label>
    <label class="field"><span>IBAN / Kontokennung</span><input class="text-control" name="externalAccountRef" id="accountEditExternalRef" placeholder="optional"><small>Nur zur Erkennung eigener Gegenkonten in Importen.</small></label>
    <label class="field"><span>Kontowährung</span><select class="text-control" name="currency" id="accountEditCurrency" required>${currencyOptions(baseCurrency)}</select><small>Nach der ersten Buchung bleibt die Kontowährung aus Integritätsgründen fix.</small></label>
    <label class="field"><span>Sichtbarkeit</span><select class="text-control" name="visibility" id="accountEditVisibility"><option value="private">Privat</option><option value="household">Im Haushalt geteilt</option></select></label>
    <label class="field"><span>Kontostand jetzt korrigieren</span><input class="text-control" name="balanceCorrection" id="accountEditBalance" type="number" step="0.01" placeholder="leer = nicht verändern"><small>Wenn du hier einen Betrag einträgst, wird er als neuer Stand jetzt verankert. Auch negative Werte sind erlaubt.</small></label>
    <div class="field form-grid-span"><small>Eine Saldo-Korrektur löscht keine historischen Buchungen. Sie setzt lediglich einen neuen Balance-Anker zum jetzigen Zeitpunkt.</small></div>`;

  return `
    ${pageHeader({
      title: 'Konten',
      subtitle: 'Konten, Bargeld, Kreditkarten und Multiwährungs-Wallets. Jeder Saldo bleibt in seiner Originalwährung.',
      actions: canWrite ? `<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="account-create">${icon('plus')} Konto hinzufügen</button>` : '',
    })}
    ${canWrite ? formShell('account-create','Neues Konto','Aktuellen Stand erfassen',createFields,{hidden:accounts.length>0,submitLabel:'Konto speichern'}) : ''}
    ${canWrite ? formShell('account-edit','Konto bearbeiten','Stammdaten oder aktuellen Stand korrigieren',editFields,{hidden:true,submitLabel:'Änderungen speichern'}) : ''}
    ${foreign.size ? `<div class="inline-alert inline-alert--success"><strong>Fremdwährungen werden automatisch umgerechnet.</strong><span>${escapeHtml(fxLabel(fxRates,baseCurrency))}. Originalwährungen bleiben auf den Konten sichtbar.</span></div>` : ''}
    <div class="metric-grid" style="margin-bottom:16px">
      ${metricCard(`Liquidität ${baseCurrency}`, money(baseLiquid,{currency:baseCurrency,locale}), `${accounts.length} Konten gesamt · ${fxLabel(fxRates,baseCurrency)}`)}
      ${metricCard(`Kreditkarten ${baseCurrency}`, money(baseCredit,{currency:baseCurrency,locale}), 'nicht zur Liquidität gezählt')}
      ${metricCard('Fremdwährungen', foreignSummary, foreign.size ? `${foreign.size} Währung${foreign.size===1?'':'en'}` : 'keine Fremdwährungskonten')}
    </div>
    ${accounts.length ? `<div class="grid-3">${accounts.map((a)=>accountCard(a,{locale,canWrite,projection:buildAccountProjection(a,recurringRules,accounts),isPrimary:a.account_id===primaryAccountId})).join('')}</div>` : emptyState('wallet','Noch kein Konto','Erfasse zuerst ein Konto mit dem Stand, den du heute tatsächlich siehst.')}
  `;
}
