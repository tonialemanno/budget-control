const currencyByCountry = Object.freeze({
  CH: 'CHF',
  DE: 'EUR',
  AT: 'EUR',
  IT: 'EUR',
});

export async function onRequestGet(context) {
  const country = String(context.request.cf?.country || '').toUpperCase();
  const payload = {
    country: country || null,
    currency: currencyByCountry[country] || null,
    source: country ? 'cloudflare' : 'unknown',
  };
  return new Response(JSON.stringify(payload), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, no-store, max-age=0',
    },
  });
}
