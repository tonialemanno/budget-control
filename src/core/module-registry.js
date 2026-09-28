(function(){
  'use strict';
  const modules=[
    {key:'overview',label:'nav.home',view:'dashboard',feature:'dashboard',group:'overview'},

    {key:'accounts',label:'nav.accounts',view:'accounts',feature:'accounts',group:'money'},
    {key:'transactions',label:'nav.transactions',view:'transactions',feature:'transactions',group:'money'},
    {key:'bankImport',label:'nav.bankImport',view:'csv',feature:'csv_import',group:'money'},
    {key:'reconcile',label:'nav.reconciliation',view:'reconcile',feature:'bank_reconciliation',group:'money',navVisible:false},
    {key:'categories',label:'nav.categories',view:'categoryDashboard',feature:'categories',group:'money',navVisible:false},

    {key:'planned',label:'nav.planning',view:'planned',feature:'recurring',group:'planning'},
    {key:'planner',label:'nav.planner',special:'planner',group:'planning'},

    {key:'documents',label:'nav.documents',view:'documents',feature:'documents',group:'documents'},

    {key:'wealth',label:'nav.wealth',view:'wealth',feature:'net_worth',group:'more'},
    {key:'tax',label:'nav.taxes',view:'tax',feature:'taxes',group:'more'},
    {key:'debtEnforcement',label:'nav.debtEnforcement',view:'debtEnforcement',feature:null,group:'more',country:'CH'},
    {key:'receivables',label:'nav.receivables',view:'receivables',feature:'claims',group:'more'},
    {key:'analysis',label:'nav.analysis',view:'analysis',feature:'year_archive',group:'more'},
    {key:'cockpit',label:'nav.cockpit',view:'financeOS',feature:'cockpit',group:'more',navVisible:false},
    {key:'support',label:'nav.support',view:'support',feature:'support',group:'more'},
    {key:'settings',label:'nav.settings',view:'settings',feature:null,group:'more'},
    {key:'admin',label:'nav.admin',view:'admin',feature:'admin',group:'more'}
  ];

  const groups=[
    {key:'overview',label:'nav.home',defaultModule:'overview'},
    {key:'money',label:'nav.money',defaultModule:'accounts'},
    {key:'planning',label:'nav.plan',defaultModule:'planned'},
    {key:'documents',label:'nav.documents',defaultModule:'documents'},
    {key:'more',label:'nav.more',defaultModule:'wealth'}
  ];

  function featureState(feature){
    if(!feature)return'enabled';
    const b=window.AioneLegacyBridge,c=b&&b.getContext?b.getContext():{};
    return(c.features&&c.features[feature])||'hidden';
  }
  function visible(item){
    const ctx=window.AioneContext?window.AioneContext.get():{};
    if(item.country&&ctx.country!==item.country)return false;
    if(item.special)return true;
    if(!item.feature)return true;
    return['enabled','read_only'].includes(featureState(item.feature));
  }
  function groupModules(group){return modules.filter(m=>m.group===group&&visible(m))}
  function navModules(group){return groupModules(group).filter(m=>m.navVisible!==false)}

  window.AioneModules={modules,groups,visible,groupModules,navModules,featureState};
})();
