window.setTimeout(() => {
  if (window.__FINANCE_BOOT_COMPLETE__ === true) return;
  const authGate = document.querySelector('#authGate');
  const appShell = document.querySelector('#appShell');
  if (!appShell || appShell.hidden) {
    if (authGate) {
      authGate.hidden = false;
      authGate.innerHTML = '<div class="auth-card"><div class="auth-brand auth-brand--financeapp"><img class="auth-brand-logo" src="/assets/brand/financeapp-mark.svg?v=20261009-r69" alt="FinanceApp"><div class="auth-brand-lockup"><strong><span>Finance</span><em>App</em></strong><small>by ALEMANN0</small></div></div><div class="auth-copy"><span class="eyebrow">ALEMANNO BUCHHALTUNG</span><h1>Start fehlgeschlagen</h1><p>Die Anwendung konnte nicht vollständig geladen werden. Bitte Seite neu laden. Wenn die Meldung bleibt, liegt ein technischer Startfehler vor.</p></div></div>';
    }
  }
}, 22000);
