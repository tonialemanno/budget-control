const EURO_COUNTRIES=new Set(['AT','BE','HR','CY','EE','FI','FR','DE','GR','IE','IT','LV','LT','LU','MT','NL','PT','SK','SI','ES']);
export async function onRequestGet(context) {
  const request=context.request;
  const country=String(request.cf?.country||request.headers.get('CF-IPCountry')||'').toUpperCase()||null;
  let currency=null;
  if(country==='CH'||country==='LI') currency='CHF';
  else if(country&&EURO_COUNTRIES.has(country)) currency='EUR';
  return new Response(JSON.stringify({country,currency}),{
    status:200,
    headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, max-age=0'}
  });
}
