(function(){
  'use strict';

  const genericMerchantHints=[
    {words:['netflix','spotify','disney+','disney plus','apple.com/bill','google play','youtube premium'],categories:['freizeit','abo','abonnement','streaming'],confidence:.82,reason:'Digitales Abonnement erkannt.'},
    {words:['shell','esso','bp ','tankstelle','tanken'],categories:['mobilität','auto','transport'],confidence:.78,reason:'Tankstelle oder Fahrzeugkosten erkannt.'},
    {words:['arzt','praxis','apotheke','klinik','zahnarzt'],categories:['gesundheit','krankenkasse'],confidence:.80,reason:'Gesundheitsbezug erkannt.'}
  ];

  const countries={
    CH:{
      code:'CH',
      categories:[
        {name:'Lohn',direction:'income',sort_order:10},
        {name:'Weitere Einnahmen',direction:'income',sort_order:20},
        {name:'Wohnen',direction:'expense',sort_order:30},
        {name:'Lebensmittel & Haushalt',direction:'expense',sort_order:40},
        {name:'Mobilität',direction:'expense',sort_order:50},
        {name:'Telefon & Internet',direction:'expense',sort_order:60},
        {name:'Versicherungen',direction:'expense',sort_order:70},
        {name:'Krankenkasse & Gesundheit',direction:'expense',sort_order:80},
        {name:'Familie & Kinder',direction:'expense',sort_order:90},
        {name:'Freizeit & Abos',direction:'expense',sort_order:100},
        {name:'Steuern',direction:'expense',sort_order:110},
        {name:'Kreditkosten & Schulden',direction:'expense',sort_order:120},
        {name:'Sonstiges',direction:'both',sort_order:130}
      ],
      merchantHints:[
        {words:['migros','coop','denner','aldi suisse','lidl schweiz','volg','spar schweiz'],categories:['lebensmittel','haushalt'],confidence:.90,reason:'Schweizer Lebensmittelhändler erkannt.'},
        {words:['swisscom','sunrise','salt mobile','salt.ch','wingo','yallo'],categories:['telefon','internet','kommunikation','abo'],confidence:.90,reason:'Schweizer Telekommunikationsanbieter erkannt.'},
        {words:['sbb','cff','ffs','bls','postauto','vbz','tpg'],categories:['mobilität','transport','öV','oev'],confidence:.91,reason:'Schweizer ÖV-Anbieter erkannt.'},
        {words:['css versicherung','helsana','swica','sanitas','concordia','groupe mutuel'],categories:['krankenkasse','gesundheit'],confidence:.90,reason:'Schweizer Krankenversicherung erkannt.'},
        {words:['die mobiliar','mobiliar','axa','zurich versicherung','helvetia'],categories:['versicherung'],confidence:.84,reason:'Schweizer Versicherungsanbieter erkannt.'},
        {words:['migrol','avia'],categories:['mobilität','auto','transport'],confidence:.83,reason:'Schweizer Tankstellen-/Mobilitätsanbieter erkannt.'}
      ],
      debtTypes:[
        {value:'mortgage',label:'Hypothek'},
        {value:'loan',label:'Privatkredit / Darlehen'},
        {value:'credit_card',label:'Kreditkarte / Teilzahlung'},
        {value:'private_debt',label:'Private Schuld'},
        {value:'debt_enforcement',label:'Betreibung'},
        {value:'other_liability',label:'Andere Schuld'}
      ]
    },
    DE:{
      code:'DE',
      categories:[
        {name:'Gehalt',direction:'income',sort_order:10},
        {name:'Weitere Einnahmen',direction:'income',sort_order:20},
        {name:'Wohnen',direction:'expense',sort_order:30},
        {name:'Lebensmittel & Haushalt',direction:'expense',sort_order:40},
        {name:'Mobilität',direction:'expense',sort_order:50},
        {name:'Telefon & Internet',direction:'expense',sort_order:60},
        {name:'Versicherungen',direction:'expense',sort_order:70},
        {name:'Gesundheit & Krankenversicherung',direction:'expense',sort_order:80},
        {name:'Familie & Kinder',direction:'expense',sort_order:90},
        {name:'Freizeit & Abos',direction:'expense',sort_order:100},
        {name:'Steuern & Abgaben',direction:'expense',sort_order:110},
        {name:'Kreditkosten & Schulden',direction:'expense',sort_order:120},
        {name:'Sonstiges',direction:'both',sort_order:130}
      ],
      merchantHints:[
        {words:['rewe','edeka','kaufland','netto marken-discount','aldi nord','aldi süd','aldi sued','lidl','penny markt'],categories:['lebensmittel','haushalt'],confidence:.90,reason:'Deutscher Lebensmittelhändler erkannt.'},
        {words:['deutsche telekom','telekom','vodafone','telefonica','o2','1&1','1und1'],categories:['telefon','internet','kommunikation','abo'],confidence:.90,reason:'Deutscher Telekommunikationsanbieter erkannt.'},
        {words:['deutsche bahn','db vertrieb','bahn.de','bvg','mvg','hvv'],categories:['mobilität','transport'],confidence:.91,reason:'Deutscher ÖV-Anbieter erkannt.'},
        {words:['aok','techniker krankenkasse','tk krankenkasse','barmer','dak gesundheit'],categories:['gesundheit','krankenversicherung'],confidence:.90,reason:'Deutsche Krankenversicherung erkannt.'},
        {words:['allianz','huk-coburg','huk coburg','ergo versicherung','axa versicherung'],categories:['versicherung'],confidence:.84,reason:'Deutscher Versicherungsanbieter erkannt.'},
        {words:['aral'],categories:['mobilität','auto','transport'],confidence:.83,reason:'Deutscher Tankstellen-/Mobilitätsanbieter erkannt.'}
      ],
      debtTypes:[
        {value:'mortgage',label:'Immobiliendarlehen / Baufinanzierung'},
        {value:'loan',label:'Ratenkredit / Darlehen'},
        {value:'credit_card',label:'Kreditkarte / Teilzahlung'},
        {value:'private_debt',label:'Private Schuld'},
        {value:'collection',label:'Inkasso / Vollstreckung'},
        {value:'other_liability',label:'Andere Schuld'}
      ]
    }
  };

  function country(code){return countries[String(code||'CH').toUpperCase()]||countries.CH}
  function starterCategories(code){return country(code).categories.map(x=>Object.assign({},x))}
  function merchantHints(code){return country(code).merchantHints.concat(genericMerchantHints).map(x=>Object.assign({},x,{words:[...x.words],categories:[...x.categories]}))}
  function debtTypes(code){return country(code).debtTypes.map(x=>Object.assign({},x))}

  window.AioneCountryFinance={country,starterCategories,merchantHints,debtTypes};
})();
