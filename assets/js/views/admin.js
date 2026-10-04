import { pageHeader, statusPill } from '../app/components.js';
import { dateLabel, escapeHtml } from '../app/format.js';
import { icon } from '../app/icons.js';

const PAGE_SIZE=20;

const ACTIVITY_MODULE_LABELS={
  overview:'Übersicht',
  accounts:'Konten',
  transactions:'Transaktionen',
  categories:'Kategorien',
  merchants:'Händler',
  imports:'Import',
  'import-history':'Import-Historie',
  recurring:'Wiederkehrend',
  'fixed-costs':'Fixkosten',
  documents:'Dokumente',
  budget:'Budget',
  bills:'Rechnungen',
  goals:'Ziele',
  'tax-advisor':'Steuern',
  debts:'Schulden & Kredite',
  receivables:'Forderungen',
  legal:'Rechtliches',
  family:'Familie',
  wealth:'Vermögen',
  property:'Liegenschaften',
  vehicles:'Fahrzeuge',
  insurance:'Versicherungen',
  investments:'Investments',
  pension:'Vorsorge',
  intelligence:'Finance Intelligence',
  settings:'Einstellungen',
  other:'Sonstiges',
};
const ACTIVITY_ACTION_LABELS={create:'erstellt',update:'geändert',delete:'gelöscht'};

function activityModuleLabel(key){ return ACTIVITY_MODULE_LABELS[key]||key||'Unbekannt'; }
function activityActionLabel(key){ return ACTIVITY_ACTION_LABELS[key]||key||'aktiv'; }
function activityDateTime(value){
  if(!value) return 'noch nie';
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) return 'unbekannt';
  return new Intl.DateTimeFormat('de-CH',{dateStyle:'short',timeStyle:'short'}).format(d);
}

function matchesUser(user,query){
  const needle=String(query||'').trim().toLowerCase();
  if(!needle) return true;
  return [user.display_name,user.email].filter(Boolean).some((value)=>String(value).toLowerCase().includes(needle));
}

export function presenceState(user,now=Date.now()){
  const raw=user?.presence?.last_seen_at;
  if(!raw) return {state:'offline',online:false,active:false,idle:false,label:'Offline',detail:'Noch kein Live-Signal'};
  const seen=new Date(raw);
  const seconds=Math.max(0,(Number(now)-seen.getTime())/1000);
  const heartbeatFresh=seconds<=95;
  if(!heartbeatFresh){
    const minutes=Math.floor(seconds/60);
    let label='Offline';
    if(minutes<60) label=`Offline · vor ${Math.max(1,minutes)} Min.`;
    else if(minutes<1440) label=`Offline · vor ${Math.floor(minutes/60)} Std.`;
    else label=`Offline · vor ${Math.floor(minutes/1440)} Tag${Math.floor(minutes/1440)===1?'':'en'}`;
    return {
      state:'offline',online:false,active:false,idle:false,label,
      detail:[user.presence?.device_label,user.presence?.app_version].filter(Boolean).join(' · ')||'Kein aktuelles Live-Signal'
    };
  }

  const interactionRaw=user?.presence?.last_interaction_at;
  const interaction=interactionRaw?new Date(interactionRaw):null;
  const interactionMinutes=interaction&&!Number.isNaN(interaction.getTime())
    ? Math.max(0,Math.floor((Number(now)-interaction.getTime())/60000))
    : null;
  const idle=user?.presence?.activity_state==='idle'||(interactionMinutes!==null&&interactionMinutes>=5);
  const state=idle?'idle':'active';
  const label=idle?'Inaktiv':'Aktiv';
  const interactionDetail=idle&&interactionMinutes!==null
    ? `letzte Bedienung vor ${Math.max(1,interactionMinutes)} Min.`
    : 'aktive Bedienung';
  return {
    state,online:true,active:!idle,idle,label,
    detail:[interactionDetail,user.presence?.device_label,user.presence?.app_version].filter(Boolean).join(' · ')
  };
}

export function renderAdmin({adminUsers=[],productModules=[],adminQuery='',adminPage=1,adminExpandedUserId=null,demoCredentials=null}={}){
  const moduleList=productModules.filter((m)=>!m.is_core&&!['admin'].includes(m.key));
  const filtered=adminUsers.filter((user)=>matchesUser(user,adminQuery));
  const pageCount=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const safePage=Math.min(Math.max(Number(adminPage)||1,1),pageCount);
  const start=(safePage-1)*PAGE_SIZE;
  const visibleUsers=filtered.slice(start,start+PAGE_SIZE);
  const activeCount=adminUsers.filter((user)=>presenceState(user).active).length;
  const idleCount=adminUsers.filter((user)=>presenceState(user).idle).length;

  const rows=visibleUsers.map((user)=>{
    const expanded=adminExpandedUserId===user.id;
    const presence=presenceState(user);
    const activity=user.activity||{};
    const lastActivity=activity.last_at?activityDateTime(activity.last_at):'noch keine Eintragung';
    const lastActivityModule=activity.last_module?activityModuleLabel(activity.last_module):'—';
    const lastRoute=user.presence?.route?activityModuleLabel(user.presence.route):'—';
    const activityModules=(activity.modules||[]).slice(0,8);
    const recentActivity=(activity.recent||[]).slice(0,8);
    return `<article class="card admin-user-row ${expanded?'admin-user-row--expanded':''}">
      <div class="admin-user-summary">
        <div class="admin-user-identity"><span class="profile-avatar">${escapeHtml((user.display_name||user.email||'B').charAt(0).toUpperCase())}</span><div><strong>${escapeHtml(user.display_name||'Ohne Anzeigename')}</strong><span>${escapeHtml(user.email||'')}</span></div></div>
        <div class="admin-user-meta"><span>Status <strong>${presence.active?statusPill('active','Aktiv'):presence.idle?statusPill('pending','Inaktiv'):escapeHtml(presence.label)}</strong><small class="table-meta">${escapeHtml(presence.detail)}</small></span><span>Letzter Login <strong>${user.last_sign_in_at?dateLabel(user.last_sign_in_at):'noch nie'}</strong></span><span>Letzte Eintragung <strong>${escapeHtml(lastActivity)}</strong><small class="table-meta">${escapeHtml(lastActivityModule)}</small></span>${statusPill(user.confirmed_at?'active':'pending',user.confirmed_at?'Aktiv':'Unbestätigt')}</div>
        <button class="table-action" type="button" data-action="admin-user-toggle-details" data-user-id="${user.id}">${expanded?'Schliessen':'Details'}</button>
      </div>
      ${expanded?`<div class="admin-user-details">
        <div class="card activity-audit-card" style="margin-bottom:16px">
          <div class="card-heading"><div><h3 class="card-title">Nutzung & Aktivität</h3><p class="card-subtitle">Nur Metadaten: Bereich, Aktion und Zeitpunkt. Keine Beträge, Beschreibungen, Händler oder Inhalte.</p></div></div>
          <div class="metric-grid">
            <div class="metric-card"><span>Letzte Eintragung</span><strong>${escapeHtml(lastActivity)}</strong><small>${escapeHtml(lastActivityModule)} · ${escapeHtml(activityActionLabel(activity.last_action))}</small></div>
            <div class="metric-card"><span>Letzter App-Bereich</span><strong>${escapeHtml(lastRoute)}</strong><small>${user.presence?.last_seen_at?escapeHtml(activityDateTime(user.presence.last_seen_at)):'noch kein Live-Signal'}</small></div>
            <div class="metric-card"><span>Aktivitäten · 30 Tage</span><strong>${Number(activity.last_30_days||0)}</strong><small>zusammengefasste Änderungen</small></div>
          </div>
          <div class="grid-main-aside" style="margin-top:14px">
            <div>
              <h4 class="card-title">Bereiche · letzte 30 Tage</h4>
              <div class="stack" style="margin-top:8px">${activityModules.length?activityModules.map((entry)=>`<div class="settings-row"><div class="settings-row-copy"><strong>${escapeHtml(activityModuleLabel(entry.module_key))}</strong><span>zuletzt ${escapeHtml(activityDateTime(entry.last_at))}</span></div><span class="status-pill status-pill--active">${Number(entry.count||0)}×</span></div>`).join(''):'<p class="card-subtitle">Keine Eintragungen in den letzten 30 Tagen.</p>'}</div>
            </div>
            <div>
              <h4 class="card-title">Letzte Aktivitäten</h4>
              <div class="stack" style="margin-top:8px">${recentActivity.length?recentActivity.map((entry)=>`<div class="settings-row"><div class="settings-row-copy"><strong>${escapeHtml(activityModuleLabel(entry.module_key))}</strong><span>${escapeHtml(activityActionLabel(entry.action_kind))}</span></div><small class="table-meta">${escapeHtml(activityDateTime(entry.occurred_at))}</small></div>`).join(''):'<p class="card-subtitle">Noch keine Eintragung protokolliert.</p>'}</div>
            </div>
          </div>
        </div>
        <div class="card-heading"><div><h3 class="card-title">Benutzer & Zugriff</h3><p class="card-subtitle">Sprache und Module dieses Benutzers verwalten.</p></div></div><div class="settings-row"><div class="settings-row-copy"><strong>Sprache & Region</strong><span>Sprache der Oberfläche sowie Datums-, Zahlen- und Regionsformat.</span></div><select class="select-control" data-action="admin-set-locale" data-user-id="${user.id}"><option value="de-CH" ${user.locale==='de-CH'?'selected':''}>Deutsch · Schweiz</option><option value="de-DE" ${user.locale==='de-DE'?'selected':''}>Deutsch · Deutschland</option><option value="it-CH" ${user.locale==='it-CH'?'selected':''}>Italiano · Svizzera</option><option value="it-IT" ${user.locale==='it-IT'?'selected':''}>Italiano · Italia</option><option value="en-CH" ${user.locale==='en-CH'?'selected':''}>English · Switzerland</option><option value="en-GB" ${user.locale==='en-GB'?'selected':''}>English · United Kingdom</option></select></div><div class="admin-module-grid">${moduleList.map((m)=>`<label class="module-toggle"><input type="checkbox" data-action="admin-toggle-module" data-user-id="${user.id}" data-module-key="${m.key}" ${user.modules?.[m.key]===true?'checked':''}><span><strong>${escapeHtml(m.label)}</strong><small>${escapeHtml(m.group_name||'')}</small></span></label>`).join('')}</div><div class="card-footer-actions"><button class="table-action" type="button" data-action="admin-password" data-user-id="${user.id}">Passwort setzen</button><button class="table-action" type="button" data-action="admin-finance-reset" data-user-id="${user.id}" data-user-email="${escapeHtml(user.email||'')}">Finance-Daten zurücksetzen</button></div><p class="admin-search-hint">Der Reset entfernt die Finance-Daten unwiderruflich und führt den Benutzer zurück ins Onboarding. Login, Admin-Rolle und Modulfreigaben bleiben bestehen.</p></div>`:''}
    </article>`;
  }).join('');

  const pager=pageCount>1?`<div class="admin-pager"><button class="table-action" type="button" data-action="admin-page" data-page="${safePage-1}" ${safePage<=1?'disabled':''}>Zurück</button><span>Seite ${safePage} von ${pageCount}</span><button class="table-action" type="button" data-action="admin-page" data-page="${safePage+1}" ${safePage>=pageCount?'disabled':''}>Weiter</button></div>`:'';

  return `
    ${pageHeader({title:'Administration',subtitle:`${activeCount} aktiv · ${idleCount} inaktiv · ${adminUsers.length} Benutzer. Aktiv = Bedienung in den letzten 5 Minuten; Inaktiv = Seite offen ohne Bedienung; danach Offline.`,actions:'<button class="action-button action-button--secondary" type="button" data-action="admin-refresh-presence">Status aktualisieren</button>'})}
    <div class="grid-main-aside">
      <form class="card card-padding" id="admin-demo-create" data-form="admin-demo-create">
        <div class="card-heading"><div><h3 class="card-title">Demo-Instanz</h3><p class="card-subtitle">Isolierter Demo-Haushalt mit synthetischen Daten und allen Modulen.</p></div><span class="list-row-leading">${icon('sparkles')}</span></div>
        <div class="form-grid">
          <label class="field"><span>Demo-E-Mail</span><input class="text-control" name="email" type="email" value="demo@example.com" required></label>
          <label class="field"><span>Sprache</span><select class="text-control" name="locale"><option value="de-CH">Deutsch · Schweiz</option><option value="it-CH">Italiano · Svizzera</option><option value="en-CH">English · Switzerland</option></select></label>
        </div>
        <p class="admin-search-hint">Erstellt oder setzt nur die Demo-Instanz zurück. Echte Benutzer- und Finanzdaten werden nicht kopiert oder verändert.</p>
        <div class="form-actions"><button class="action-button action-button--primary" type="submit">${icon('repeat')} Demo erstellen / zurücksetzen</button></div>
        ${demoCredentials?`<div class="inline-alert" style="margin-top:14px"><strong>Demo-Zugang bereit</strong><span>Die Zugangsdaten wurden neu gesetzt. Beim nächsten Zurücksetzen wird ein neues Passwort erzeugt.</span></div>
        <div class="form-grid" style="margin-top:12px">
          <label class="field"><span>E-Mail</span><input class="text-control" value="${escapeHtml(demoCredentials.email||'')}" readonly></label>
          <label class="field"><span>Passwort</span><input class="text-control" value="${escapeHtml(demoCredentials.password||'')}" readonly></label>
        </div>
        <div class="form-actions"><button class="action-button action-button--secondary" type="button" data-action="admin-demo-copy" data-email="${escapeHtml(demoCredentials.email||'')}" data-password="${escapeHtml(demoCredentials.password||'')}">Zugang kopieren</button></div>`:``}
      </form>
      <form class="card card-padding" id="admin-user-create" data-form="admin-user-create">
        <div class="card-heading"><div><h3 class="card-title">Benutzer anlegen</h3><p class="card-subtitle">Direkt bestätigt, keine E-Mail-Bestätigung nötig</p></div><span class="list-row-leading">${icon('shield')}</span></div>
        <div class="form-grid"><label class="field"><span>Name</span><input class="text-control" name="displayName" required placeholder="z. B. Ana"></label><label class="field"><span>E-Mail</span><input class="text-control" name="email" type="email" required></label><label class="field"><span>Region & Format</span><select class="text-control" name="locale"><option value="de-CH">Deutsch · Schweiz</option><option value="de-DE">Deutsch · Deutschland</option><option value="it-CH">Italiano · Svizzera</option><option value="it-IT">Italiano · Italia</option><option value="en-CH">English · Switzerland</option><option value="en-GB">English · United Kingdom</option></select></label><label class="field"><span>Temporäres Passwort</span><input class="text-control" name="password" type="password" minlength="8" required autocomplete="new-password"></label></div>
        <div class="form-actions"><button class="action-button action-button--primary" type="submit">${icon('plus')} Benutzer erstellen</button></div>
      </form>
      <article class="card card-padding"><div class="card-heading"><div><h3 class="card-title">Benutzerübersicht</h3><p class="card-subtitle">${adminUsers.length} Benutzer · ${filtered.length} Treffer</p></div></div><label class="field"><span>Suche</span><input class="text-control" id="adminUserSearch" type="search" value="${escapeHtml(adminQuery)}" placeholder="Name, Vorname oder E-Mail" autocomplete="off"></label><p class="admin-search-hint">Ein Suchbegriff reicht. Es wird gleichzeitig in Anzeigename und E-Mail gesucht.</p></article>
    </div>
    <div class="admin-user-list" style="margin-top:16px">${rows||'<div class="card empty-state empty-state--compact"><h3>Keine Benutzer gefunden</h3><p>Passe den Suchbegriff an.</p></div>'}${pager}</div>`;
}
