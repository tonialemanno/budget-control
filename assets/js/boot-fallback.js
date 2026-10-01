window.setTimeout(() => {
  const authGate = document.querySelector('#authGate');
  const appShell = document.querySelector('#appShell');
  if (authGate?.hidden && appShell?.hidden) {
    authGate.hidden = false;
    authGate.innerHTML = '<div class="auth-card"><div class="auth-copy"><span class="eyebrow">Finance</span><h1>Start fehlgeschlagen</h1><p>Die Anwendung konnte nicht vollständig geladen werden. Bitte Seite neu laden. Wenn die Meldung bleibt, liegt ein technischer Startfehler vor.</p></div></div>';
  }
}, 2500);
