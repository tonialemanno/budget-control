(function(){
  'use strict';
  const countries={
    CH:{code:'CH',name:'Schweiz',defaultCurrency:'CHF',regionLabel:'Kanton',municipalityLabel:'Wohngemeinde'},
    DE:{code:'DE',name:'Deutschland',defaultCurrency:'EUR',regionLabel:'Bundesland',municipalityLabel:'Wohnort / Gemeinde'}
  };
  const regions={
    CH:[
      ['AG','Aargau'],['AI','Appenzell Innerrhoden'],['AR','Appenzell Ausserrhoden'],['BE','Bern'],['BL','Basel-Landschaft'],['BS','Basel-Stadt'],['FR','Freiburg'],['GE','Genf'],['GL','Glarus'],['GR','Graubünden'],['JU','Jura'],['LU','Luzern'],['NE','Neuenburg'],['NW','Nidwalden'],['OW','Obwalden'],['SG','St. Gallen'],['SH','Schaffhausen'],['SO','Solothurn'],['SZ','Schwyz'],['TG','Thurgau'],['TI','Tessin'],['UR','Uri'],['VD','Waadt'],['VS','Wallis'],['ZG','Zug'],['ZH','Zürich']
    ].map(([code,name])=>({code,name,taxData:['SG','TG'].includes(code)?'foundation-ready':'planned'})),
    DE:[
      ['BW','Baden-Württemberg'],['BY','Bayern'],['BE','Berlin'],['BB','Brandenburg'],['HB','Bremen'],['HH','Hamburg'],['HE','Hessen'],['MV','Mecklenburg-Vorpommern'],['NI','Niedersachsen'],['NW','Nordrhein-Westfalen'],['RP','Rheinland-Pfalz'],['SL','Saarland'],['SN','Sachsen'],['ST','Sachsen-Anhalt'],['SH','Schleswig-Holstein'],['TH','Thüringen']
    ].map(([code,name])=>({code,name,taxData:'planned'}))
  };
  function normalizeCountry(raw){
    const v=String(raw||'').trim().toLowerCase();
    if(['de','deutschland','germany'].includes(v))return'DE';
    if(['ch','schweiz','suisse','svizzera','switzerland'].includes(v))return'CH';
    return String(raw||'CH').trim().toUpperCase().slice(0,2)||'CH';
  }
  function country(code){return countries[normalizeCountry(code)]||countries.CH}
  function list(code){return (regions[normalizeCountry(code)]||[]).map(x=>Object.assign({},x))}
  function get(code,regionCode){return list(code).find(x=>x.code===String(regionCode||'').toUpperCase())||null}
  function taxStatus(code,regionCode){const r=get(code,regionCode);return r?r.taxData:'planned'}
  window.AioneRegions={countries,regions,normalizeCountry,country,list,get,taxStatus};
})();
