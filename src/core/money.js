(function(){
  'use strict';
  const formatters=new Map();
  function ctx(){return window.AioneContext?window.AioneContext.get():{baseCurrency:'CHF',language:'de-CH',eurToChf:null}}
  function locale(){const l=ctx().language||'de-CH';return l==='en'?'en-CH':l}
  function currency(code){return String(code||ctx().baseCurrency||'CHF').toUpperCase()}
  function format(value,code){
    const c=currency(code),key=locale()+'|'+c;
    if(!formatters.has(key))formatters.set(key,new Intl.NumberFormat(locale(),{style:'currency',currency:c}));
    return formatters.get(key).format(Number(value||0));
  }
  function convert(value,from,to,eurToChf){
    const amount=Number(value||0),a=currency(from),b=currency(to);if(a===b)return amount;
    const rate=Number(eurToChf||ctx().eurToChf||0);
    if(!(rate>0))return null;
    if(a==='EUR'&&b==='CHF')return amount*rate;
    if(a==='CHF'&&b==='EUR')return amount/rate;
    return null;
  }
  function formatBase(value,from,eurToChf){
    const target=currency(ctx().baseCurrency),converted=convert(value,from,target,eurToChf);
    return converted==null?format(value,from):format(converted,target);
  }
  function baseCurrency(){return currency(ctx().baseCurrency)}
  if(window.AioneContext)window.AioneContext.onChange(()=>formatters.clear());
  window.AioneMoney={format,convert,formatBase,baseCurrency};
})();
