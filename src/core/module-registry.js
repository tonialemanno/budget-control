(function(){
  'use strict';
  const modules=[
    {key:'overview',label:'nav.home',view:'dashboard',feature:'dashboard',group:'overview'},
    {key:'accounts',label:'nav.accounts',view:'accounts',feature:'accounts',group:'money'},
    {key:'transactions',label:'nav.transactions',view:'transactions',feature:'transactions',group:'money'},
    {key:'planned',label:'nav.planning',view:'planned',feature:'recurring',group:'money'},
    {key:'reconcile',label:'nav.reconciliation',view:'reconcile',feature:'bank_reconciliation',group:'money'},
    {key:'bankImport',label:'nav.bankImport',view:'csv',feature:'csv_import',group:'money'},
    {key:'categories',label:'nav.categories',view:'categoryDashboard',feature:'categories',group:'money'},
    {key:'wealth',label:'nav.wealth',view:'wealth',feature:'net_worth',group:'money'},
    {key:'tax',label:'nav.taxes',view:'tax',feature:'taxes',group:'obligations'},
    {key:'debtEnforcement',label:'nav.debtEnforcement',view:'debtEnforcement',feature:null,group:'obligations',country:'CH'},
    {key:'receivables',label:'nav.receivables',view:'receivables',feature:'claims',group:'obligations'},
    {key:'documents',label:'nav.documents',view:'documents',feature:'documents',group:'documents'},
    {key:'analysis',label:'nav.analysis',view:'analysis',feature:'year_archive',group:'insights'},
    {key:'cockpit',label:'nav.cockpit',view:'financeOS',feature:'cockpit',group:'insights'},
    {key:'support',label:'nav.support',view:'support',feature:'support',group:'settings'},
    {key:'settings',label:'nav.settings',view:'settings',feature:null,group:'settings'},
    {key:'admin',label:'nav.admin',view:'admin',feature:'admin',group:'admin'}
  ];
  const groups=[
    {key:'overview',label:'nav.home',defaultModule:'overview'},
    {key:'money',label:'nav.money',defaultModule:'accounts'},
    {key:'obligations',label:'nav.obligations',defaultModule:'tax'},
    {key:'documents',label:'nav.documents',defaultModule:'documents'},
    {key:'planner',label:'nav.planner',special:'planner'},
    {key:'insights',label:'nav.insights',defaultModule:'analysis'},
    {key:'settings',label:'nav.settings',defaultModule:'settings'},
    {key:'admin',label:'nav.admin',defaultModule:'admin',feature:'admin'}
  ];
  function featureState(feature){
    if(!feature)return'enabled';const b=window.AioneLegacyBridge;const c=b&&b.getContext?b.getContext():{};return(c.features&&c.features[feature])||'hidden';
  }
  function visible(item){const ctx=window.AioneContext?window.AioneContext.get():{};if(item.country&&ctx.country!==item.country)return false;const f=item.feature;if(!f)return true;return['enabled','read_only'].includes(featureState(f))}
  function groupModules(group){return modules.filter(m=>m.group===group&&visible(m))}
  window.AioneModules={modules,groups,visible,groupModules,featureState};
})();
