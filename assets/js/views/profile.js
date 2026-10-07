import { pageHeader, statusPill } from '../app/components.js';
import { escapeHtml, money, shortDate } from '../app/format.js';
import { icon } from '../app/icons.js';
import { financeCycleLabel, inFinanceCycle, resolveFinanceCycle } from '../app/finance-cycle.js';
import { financeMonthMode } from '../app/user-preferences.js';

function roleLabel(role) {
  return ({owner:'Owner',admin:'Haushalt-Admin',editor:'Editor',viewer:'Nur lesen'})[role] || 'Benutzer';
}

export function renderProfile({
  user, profile, household, householdRole, adminRole, accounts=[], transactions=[],
  moduleAccess={}, productModules=[], hiddenModules=[],
}={}) {
  const locale=profile?.locale||'de-CH';
  const currency=household?.base_currency||'CHF';
  const name=profile?.display_name||user?.email?.split('@')[0]||'ALEMANNO BUCHHALTUNG Benutzer';
  const initial=name.trim().charAt(0).toUpperCase()||'F';
  const selectedFinanceMonthMode=financeMonthMode(profile);
  const monthCycle=resolveFinanceCycle({now:new Date(),fallbackDay:25,mode:selectedFinanceMonthMode});
  const monthTransactions=transactions.filter((tx)=>tx.status==='booked'&&inFinanceCycle(tx,monthCycle));
  const monthPeriodLabel=financeCycleLabel(monthCycle,locale);
  const monthOut=monthTransactions.filter((tx)=>Number(tx.amount)<0&&!tx.transfer_group_id&&tx.cashflow_type!=='receivable_principal')
    .reduce((sum,tx)=>sum+Math.abs(Number(tx.amount||0)),0);
  const entitled=(productModules||[]).filter((m)=>m.is_core||moduleAccess[m.key]===true);
  const hidden=new Set(hiddenModules||[]);
  const visible=entitled.filter((m)=>!hidden.has(m.key));
  const since=profile?.created_at||user?.created_at||null;

  return `
    ${pageHeader({title:'Mein Profil',subtitle:'Login, Rolle und persönlicher ALEMANNO BUCHHALTUNG-Zugriff auf einen Blick.'})}

    <article class="card profile-hero-card">
      <div class="profile-hero-avatar">${escapeHtml(initial)}</div>
      <div class="profile-hero-copy">
        <h3>${escapeHtml(name)}</h3>
        <span>${escapeHtml(user?.email||'')}</span>
        <div class="chip-row">
          <span class="chip chip--active">${escapeHtml(roleLabel(householdRole))}</span>
          ${adminRole?'<span class="chip chip--active">App-Admin</span>':''}
        </div>
      </div>
      <div class="profile-hero-actions"><a class="action-button action-button--secondary" href="#/settings">${icon('settings')} Einstellungen</a>${adminRole?'<a class="action-button action-button--secondary" href="#/admin">'+icon('shield')+' Admin</a>':''}</div>
    </article>

    <div class="profile-stat-grid">
      <article class="card profile-stat"><span>Konten</span><strong>${accounts.length}</strong><small>${escapeHtml(currency)} als Basiswährung</small></article>
      <article class="card profile-stat"><span>Buchungen · ${selectedFinanceMonthMode==='calendar'?'Monat':'Finanzmonat'}</span><strong>${monthTransactions.length}</strong><small>${money(monthOut,{currency,locale})} Abgänge · ${escapeHtml(monthPeriodLabel)}</small></article>
      <article class="card profile-stat"><span>Bereiche</span><strong>${visible.length}</strong><small>${entitled.length} freigeschaltet</small></article>
      <article class="card profile-stat"><span>Mitglied seit</span><strong>${since?escapeHtml(shortDate(new Date(since),locale)):'—'}</strong><small>${escapeHtml(household?.name||'Haushalt')}</small></article>
    </div>

    <div class="grid-main-aside">
      <article class="card card-padding">
        <div class="card-heading"><div><h3 class="card-title">Mein Zugriff</h3><p class="card-subtitle">Was dein Login aktuell sehen und bearbeiten darf</p></div></div>
        <div class="mini-detail-list">
          <span>Haushalt <strong>${escapeHtml(household?.name||'—')}</strong></span>
          <span>Rolle <strong>${escapeHtml(roleLabel(householdRole))}</strong></span>
          <span>Systemrolle <strong>${escapeHtml(adminRole?`App-${adminRole}`:'Benutzer')}</strong></span>
          <span>Land <strong>${escapeHtml(household?.country_code||'—')}</strong></span>
          <span>Sprache <strong>${escapeHtml(profile?.locale||'—')}</strong></span>
          <span>Basiswährung <strong>${escapeHtml(currency)}</strong></span>
        </div>
      </article>
      <article class="card card-padding">
        <div class="card-heading"><div><h3 class="card-title">Freigeschaltete Module</h3><p class="card-subtitle">Persönlich ausgeblendete Module bleiben freigeschaltet</p></div><span>${statusPill('active',`${visible.length} sichtbar`)}</span></div>
        <div class="chip-row">${entitled.map((module)=>`<span class="chip ${hidden.has(module.key)?'':'chip--active'}">${escapeHtml(module.label||module.key)}${hidden.has(module.key)?' · ausgeblendet':''}</span>`).join('')}</div>
      </article>
    </div>
  `;
}
