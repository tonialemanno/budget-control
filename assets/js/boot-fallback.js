window.setTimeout(() => {
  if (window.__FINANCE_BOOT_COMPLETE__ === true) return;
  const authGate = document.querySelector('#authGate');
  const appShell = document.querySelector('#appShell');
  if (!appShell || appShell.hidden) {
    if (authGate) {
      authGate.hidden = false;
      authGate.innerHTML = '<div class="auth-card"><div class="auth-copy"><span class="eyebrow">Spendy</span><h1>Start fehlgeschlagen</h1><p>Die Anwendung konnte nicht vollständig geladen werden. Bitte Seite neu laden. Wenn die Meldung bleibt, liegt ein technischer Startfehler vor.</p></div></div>';
    }
  }
}, 22000);
