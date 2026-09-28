import { accountCard, emptyState, formShell, metricCard, pageHeader } from '../app/components.js';
import { escapeHtml, money } from '../app/format.js';
import { icon } from '../app/icons.js';

export function renderAccounts({ accounts = [], household, profile } = {}) {
  const currency = household?.base_currency || 'CHF';
  const locale = profile?.locale || 'de-CH';
  const liquid = accounts.filter((a) => ['checking','savings','cash'].includes(a.account_type)).reduce((s,a) => s + Number(a.current_balance || 0), 0);
  const credit = accounts.filter((a) => a.account_type === 'credit_card').reduce((s,a) => s + Number(a.current_balance || 0), 0);

  const fields = `
    <label class="field"><span>Name</span><input class="text-control" name="name" required placeholder="z. B. UBS Lohnkonto"></label>
    <label class="field"><span>Kontotyp</span><select class="text-control" name="accountType" required>
      <option value="checking">Zahlungskonto</option><option value="savings">Sparkonto</option><option value="cash">Bargeld</option><option value="credit_card">Kreditkarte</option><option value="investment">Investmentkonto</option><option value="pension">Vorsorgekonto</option><option value="other">Sonstiges</option>
    </select></label>
    <label class="field"><span>Bank / Anbieter</span><input class="text-control" name="institutionName" placeholder="optional"></label>
    <label class="field"><span>Währung</span><input class="text-control" value="${escapeHtml(currency)}" disabled><small>Mehrwährung wird erst mit zentraler FX-Logik freigeschaltet.</small></label>
    <label class="field"><span>Kontostand jetzt</span><input class="text-control" name="balance" type="number" step="0.01" required value="0"></label>
    <label class="field"><span>Sichtbarkeit</span><select class="text-control" name="visibility"><option value="private">Privat</option><option value="household">Im Haushalt geteilt</option></select></label>
    <div class="field form-grid-span"><small>Der eingegebene Kontostand ist der verbindliche Stand jetzt. Historische Importe verändern diesen Wert nicht rückwirkend.</small></div>`;

  return `
    ${pageHeader({
      title: 'Konten',
      subtitle: 'Konten, Bargeld und Kreditkarten. Der aktuelle Stand wird als Saldo-Anker gespeichert.',
      actions: `<button class="action-button action-button--primary" type="button" data-action="show-form" data-target="account-create">${icon('plus')} Konto hinzufügen</button>`,
    })}
    ${formShell('account-create','Neues Konto','Aktuellen Stand erfassen',fields,{hidden:accounts.length>0,submitLabel:'Konto speichern'})}
    <div class="metric-grid" style="margin-bottom:16px">
      ${metricCard('Liquidität', money(liquid,{currency,locale}), `${accounts.length} Konten`)}
      ${metricCard('Kreditkarten-Saldo', money(credit,{currency,locale}), 'wird nicht zur Liquidität gezählt')}
      ${metricCard('Basiswährung', escapeHtml(currency), escapeHtml(household?.name || 'Privat'))}
    </div>
    ${accounts.length ? `<div class="grid-3">${accounts.map((a)=>accountCard(a,{locale})).join('')}</div>` : emptyState('wallet','Noch kein Konto','Erfasse zuerst dein Bankkonto mit dem Stand, den du heute tatsächlich siehst.')}
  `;
}
