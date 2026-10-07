const DEFINITIONS = [
  { route:'overview', path:'/', aliases:['/overview'], title:'Übersicht', eyebrow:'ALEMANNO BUCHHALTUNG', label:'Übersicht', mobileLabel:'Übersicht', icon:'home', group:'Start', module:'core', primary:true, section:'overview' },
  { route:'review', path:'/review', title:'Zu prüfen', eyebrow:'ALEMANNO BUCHHALTUNG', label:'Prüfen', mobileLabel:'Prüfen', icon:'check-circle', group:'Start', module:'core', primary:true, section:'review' },
  { route:'search', path:'/search', title:'Suchen', eyebrow:'ALEMANNO BUCHHALTUNG', section:'settings' },

  { route:'money', path:'/finance', aliases:['/money'], title:'Geld', eyebrow:'ALEMANNO BUCHHALTUNG', label:'Geld', mobileLabel:'Geld', icon:'wallet', group:'Start', module:'core', primary:true, section:'money' },
  { route:'accounts', path:'/finance/accounts', title:'Konten', eyebrow:'Geld', label:'Konten', icon:'wallet', group:'Geld', module:'money', section:'money' },
  { route:'transactions', path:'/finance/transactions', title:'Transaktionen', eyebrow:'Geld', label:'Transaktionen', icon:'list', group:'Geld', module:'money', section:'money' },
  { route:'imports', path:'/finance/imports', title:'Datenimport', eyebrow:'Geld', label:'Datenimport', icon:'arrow-down-left', group:'Geld', module:'money', section:'money' },
  { route:'import-history', path:'/finance/imports/history', title:'Import-Historie', eyebrow:'Geld', section:'money' },
  { route:'documents', path:'/finance/documents', title:'Dokumente', eyebrow:'Geld', label:'Dokumente', icon:'receipt', group:'Geld', module:'core', section:'money' },
  { route:'projects', path:'/finance/projects', title:'Anlässe & Projekte', eyebrow:'Geld', label:'Anlässe & Projekte', icon:'folder', group:'Geld', module:'core', section:'money' },
  { route:'debts', path:'/finance/debts', title:'Schulden & Kredite', eyebrow:'Geld', label:'Schulden & Kredite', icon:'credit-card', group:'Geld', module:'debts', section:'money' },
  { route:'receivables', path:'/finance/receivables', title:'Forderungen', eyebrow:'Geld', label:'Forderungen', icon:'banknote', group:'Geld', module:'debts', section:'money' },
  { route:'legal', path:'/finance/legal', title:'Mahnung / Betreibung', eyebrow:'Geld', label:'Mahnung / Betreibung', icon:'shield', group:'Geld', module:'legal', section:'money' },

  { route:'planning', path:'/planning', title:'Planung', eyebrow:'ALEMANNO BUCHHALTUNG', label:'Planung', mobileLabel:'Planung', icon:'target', group:'Start', module:'core', primary:true, section:'planning' },
  { route:'budget', path:'/planning/budget', title:'Budget', eyebrow:'Planung', label:'Budget', icon:'chart', group:'Planung', module:'budget', section:'planning' },
  { route:'fixed-costs', path:'/planning/fixed-costs', title:'Feste Zahlungen', eyebrow:'Planung', label:'Feste Zahlungen', icon:'receipt', group:'Planung', module:'money', section:'planning' },
  { route:'recurring', path:'/planning/automation', aliases:['/planning/recurring'], title:'Automatik im Detail', eyebrow:'Planung', label:'Automatik im Detail', icon:'repeat', group:'Planung', module:'money', section:'planning' },
  { route:'bills', path:'/planning/bills', title:'Zu zahlende Rechnungen & Verträge', eyebrow:'Planung', label:'Zu zahlende Rechnungen & Verträge', icon:'receipt', group:'Planung', module:'bills', section:'planning' },
  { route:'sales-documents', path:'/planning/invoices', aliases:['/planning/sales-documents'], title:'Rechnungen / Offerten', eyebrow:'Planung', label:'Rechnungen / Offerten', icon:'receipt', group:'Planung', module:'bills', section:'planning' },
  { route:'goals', path:'/planning/goals', title:'Sparziele', eyebrow:'Planung', label:'Sparziele', icon:'target', group:'Planung', module:'goals', section:'planning' },
  { route:'tax-advisor', path:'/planning/taxes', aliases:['/planning/tax-advisor'], title:'Steuern', eyebrow:'Planung', label:'Steuern', icon:'receipt', group:'Planung', module:'tax', section:'planning' },
  { route:'family', path:'/planning/family', title:'Familie & Haushalt', eyebrow:'Planung', label:'Familie & Haushalt', icon:'heart-pulse', group:'Weitere Bereiche', module:'family', section:'planning' },
  { route:'wealth', path:'/planning/wealth', title:'Vermögen', eyebrow:'Planung', label:'Vermögen', icon:'sparkles', group:'Weitere Bereiche', module:'wealth', section:'planning' },
  { route:'property', path:'/planning/property', title:'Immobilien', eyebrow:'Planung', label:'Immobilien', icon:'home', group:'Weitere Bereiche', module:'property', section:'planning' },
  { route:'vehicles', path:'/planning/vehicles', title:'Fahrzeuge', eyebrow:'Planung', label:'Fahrzeuge', icon:'train', group:'Weitere Bereiche', module:'vehicles', section:'planning' },
  { route:'insurance', path:'/planning/insurance', title:'Versicherungen', eyebrow:'Planung', label:'Versicherungen', icon:'shield', group:'Weitere Bereiche', module:'insurance', section:'planning' },
  { route:'investments', path:'/planning/investments', title:'Investments', eyebrow:'Planung', label:'Investments', icon:'chart', group:'Weitere Bereiche', module:'investments', section:'planning' },
  { route:'pension', path:'/planning/pension', title:'Vorsorge', eyebrow:'Planung', label:'Vorsorge', icon:'piggy-bank', group:'Weitere Bereiche', module:'pension', section:'planning' },
  { route:'intelligence', path:'/planning/intelligence', title:'ALEMANNO BUCHHALTUNG Intelligence', eyebrow:'Planung', label:'ALEMANNO BUCHHALTUNG Intelligence', icon:'sparkles', group:'Weitere Bereiche', module:'intelligence', section:'planning' },

  { route:'profile', path:'/selfservice/profile', aliases:['/profile','/selfservice','/SelfService'], title:'Mein Profil', eyebrow:'ALEMANNO BUCHHALTUNG', section:'settings' },
  { route:'settings', path:'/selfservice/settings', aliases:['/settings'], title:'Einstellungen', eyebrow:'ALEMANNO BUCHHALTUNG', section:'settings' },
  { route:'categories', path:'/selfservice/categories', aliases:['/categories'], title:'Kategorien & Regeln', eyebrow:'Einstellungen', section:'settings' },
  { route:'merchants', path:'/selfservice/merchants', aliases:['/merchants'], title:'Händler', eyebrow:'Einstellungen', section:'settings' },
  { route:'setup', path:'/setup', title:'Einrichtung', eyebrow:'ALEMANNO BUCHHALTUNG', section:'settings' },

  { route:'admin', path:'/admin', aliases:['/Admin','/admin/users','/admin/activity','/admin/modules'], title:'Administration', eyebrow:'System', label:'Admin', icon:'shield', group:'Administration', module:'admin', adminOnly:true, section:'settings' },
];

export const ROUTE_REGISTRY = Object.freeze(DEFINITIONS.map((row)=>Object.freeze({
  ...row,
  aliases:Object.freeze([...(row.aliases||[])]),
})));

const BY_ROUTE = new Map(ROUTE_REGISTRY.map((row)=>[row.route,row]));
const BY_PATH = new Map();
for(const row of ROUTE_REGISTRY){
  BY_PATH.set(row.path,row);
  for(const alias of row.aliases) BY_PATH.set(alias,row);
}

function normalizePath(pathname='/'){
  const raw=String(pathname||'/').split('?')[0].split('#')[0]||'/';
  const withSlash=raw.startsWith('/')?raw:`/${raw}`;
  if(withSlash==='/') return '/';
  return withSlash.replace(/\/+$/,'')||'/';
}

export function routeDefinition(route){
  return BY_ROUTE.get(String(route||''))||null;
}

export function routeFromPath(pathname){
  return BY_PATH.get(normalizePath(pathname))||null;
}

export function routeKeyFromPath(pathname){
  return routeFromPath(pathname)?.route||null;
}

export function routeHref(route, params=null){
  const definition=routeDefinition(route)||routeDefinition('overview');
  const search=params instanceof URLSearchParams
    ? params.toString()
    : typeof params==='string'
      ? params.replace(/^\?/,'')
      : params && typeof params==='object'
        ? new URLSearchParams(Object.entries(params).filter(([,value])=>value!==undefined&&value!==null&&value!=='')).toString()
        : '';
  return `${definition.path}${search?`?${search}`:''}`;
}

export function legacyHashToHref(hash){
  const raw=String(hash||'');
  if(!raw.startsWith('#/')) return null;
  const [legacyPath,query='']=raw.slice(2).split('?');
  const route=legacyPath||'overview';
  return routeHref(route,query);
}

export function currentRouteLocation(locationLike=globalThis.location){
  const legacy=legacyHashToHref(locationLike?.hash||'');
  const url=new URL(legacy||`${locationLike?.pathname||'/'}${locationLike?.search||''}`,'https://router.local');
  const definition=routeFromPath(url.pathname);
  return {
    route:definition?.route||null,
    definition,
    pathname:url.pathname,
    search:url.search,
    params:url.searchParams,
    legacy:Boolean(legacy),
    href:`${url.pathname}${url.search}`,
  };
}

export function migrateLegacyHash({locationLike=globalThis.location,historyLike=globalThis.history}={}){
  const href=legacyHashToHref(locationLike?.hash||'');
  if(!href) return false;
  historyLike?.replaceState?.(null,'',href);
  return true;
}

export function navigateToRoute(route, params=null, {replace=false, historyLike=globalThis.history}={}){
  const href=routeHref(route,params);
  const method=replace?'replaceState':'pushState';
  historyLike?.[method]?.(null,'',href);
  return href;
}

export function rewriteLegacyRouteLinks(root){
  if(!root?.querySelectorAll) return 0;
  let changed=0;
  for(const anchor of root.querySelectorAll('a[href^="#/"]')){
    const href=legacyHashToHref(anchor.getAttribute('href'));
    if(!href) continue;
    anchor.setAttribute('href',href);
    changed+=1;
  }
  return changed;
}

export function isKnownRouteUrl(urlLike,base='https://router.local'){
  try{
    const url=urlLike instanceof URL?urlLike:new URL(String(urlLike||''),base);
    return Boolean(routeFromPath(url.pathname));
  }catch{
    return false;
  }
}

export const NAV_ITEMS = Object.freeze(
  ROUTE_REGISTRY
    .filter((row)=>row.label&&row.icon&&row.module)
    .map((row)=>Object.freeze({
      route:row.route,label:row.label,mobileLabel:row.mobileLabel,icon:row.icon,group:row.group,module:row.module,
      primary:Boolean(row.primary),adminOnly:Boolean(row.adminOnly),section:row.section,path:row.path,
    }))
);

export const PAGE_META = Object.freeze(Object.fromEntries(
  ROUTE_REGISTRY.map((row)=>[row.route,Object.freeze({title:row.title,eyebrow:row.eyebrow,path:row.path})])
));
