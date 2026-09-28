import { money, dateLabel, escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';
import { emptyState, pageHeader } from '../app/components.js';

function accountTypeLabel(type) {
  return {
    checking: 'Zahlungskonto',
    savings: 'Sparkonto',
    cash: 'Bargeld',
    investment: 'Investment',
    pension: 'Vorsorge',
    other: 'Sonstiges',
  }[type] || 'Konto';
}

function renderAccount(account) {
  return `
    <article class="card account-card">
      <div class="account-card-head">
        <div>
          <div class="account-name">${escapeHtml(account.name)}</div>
          <div class="account-kind">${escapeHtml(account.institution_name || accountTypeLabel(account.account_type))}</div>
        </div>
        <span class="list-row-leading">${icon(account.account_type === 'cash' ? 'banknote' : 'wallet')}</span>
      </div>
      <div class="account-balance">${money(account.current_balance, { currency: account.currency })}</div>
      <div class="account-change">Aktueller Anker · ${dateLabel(account.balance_anchor_at)}</div>
    </article>`;
}

export function renderAccounts({ accounts = [], household } = {}) {
  const currency = household?.base_currency || 'CHF';
  const total = accounts
    .filter((account) => ['checking', 'savings', 'cash'].includes(account.account_type))
    .reduce((sum, account) => sum + Number(account.current_balance || 0), 0);

  return `
    ${pageHeader({
      title: 'Konten',
      subtitle: 'Der von dir eingetragene Kontostand gilt als verbindlicher aktueller Stand. Frühere Importe werden rückwärts davon rekonstruiert.',
    })}

    <div class="page-actions">
      <button class="action-button action-button--primary" id="accountFormToggle" type="button">${icon('plus')} Konto hinzufügen</button>
    </div>

    <form class="card card-padding form-card" id="accountForm" ${accounts.length ? 'hidden' : ''}>
      <div class="card-heading">
        <div><h3 class="card-title">Neues Konto</h3><p class="card-subtitle">Aktuellen Stand erfassen</p></div>
      </div>

      <div class="form-grid form-grid--2">
        <label class="field">
          <span>Name</span>
          <input class="text-control" name="name" autocomplete="off" required placeholder="z. B. UBS Lohnkonto">
        </label>

        <label class="field">
          <span>Kontotyp</span>
          <select class="text-control" name="accountType" required>
            <option value="checking">Zahlungskonto</option>
            <option value="savings">Sparkonto</option>
            <option value="cash">Bargeld</option>
            <option value="other">Sonstiges</option>
          </select>
        </label>

        <label class="field">
          <span>Bank / Anbieter</span>
          <input class="text-control" name="institutionName" autocomplete="off" placeholder="optional">
        </label>

        <label class="field">
          <span>Währung</span>
          <input class="text-control" value="${escapeHtml(currency)}" disabled>
          <input name="currency" type="hidden" value="${escapeHtml(currency)}">
          <small>Mehrwährung wird erst zusammen mit einer zentralen FX-Logik freigeschaltet.</small>
        </label>

        <label class="field form-grid-span">
          <span>Kontostand jetzt</span>
          <input class="text-control" name="balance" type="number" step="0.01" inputmode="decimal" required placeholder="0.00">
          <small>Dieser Betrag wird nicht durch später importierte ältere Transaktionen verändert.</small>
        </label>
      </div>

      <div class="form-actions">
        <button class="action-button action-button--primary" type="submit">Konto speichern</button>
        <button class="action-button action-button--secondary" id="accountFormCancel" type="button">Abbrechen</button>
      </div>
    </form>

    ${accounts.length
      ? `<div class="grid-3">${accounts.map(renderAccount).join('')}</div>
         <div class="grid-2" style="margin-top:16px">
           <article class="card card-padding">
             <div class="card-heading"><div><h3 class="card-title">Liquidität gesamt</h3><p class="card-subtitle">Zahlungskonten, Sparen und Bargeld</p></div></div>
             <div class="hero-value" style="font-size:36px">${money(total, { currency })}</div>
           </article>
           <article class="card card-padding">
             <div class="card-heading"><div><h3 class="card-title">Datenbasis</h3><p class="card-subtitle">Finance Core V1.2</p></div></div>
             <div class="chip-row"><span class="chip chip--active">Manuell</span><span class="chip">CSV später</span><span class="chip">Banking Provider später</span></div>
           </article>
         </div>`
      : emptyState('wallet', 'Dein erstes Konto', 'Trage den Stand ein, den du heute tatsächlich auf dem Konto hast.')}
  `;
}
