/* ============================================================
   MacroMind – app.js
   Boot + einfacher View-Router. Automatischer Login über die
   gespeicherte Session; Mitternachts-Erkennung (Europe/Berlin)
   beim Zurückkehren in den Tab.
   ============================================================ */
window.MM = window.MM || {};

(function () {
  'use strict';

  let currentView = null;
  let currentArg = null;
  // Merkt sich pro Overlay-View (Profil/Einstellungen), von wo sie geöffnet wurde
  const returnTo = { profile: null, settings: null };

  /** Zentrale Navigation */
  MM.go = function (view, arg) {
    const fn = MM.views[view];
    if (!fn) { console.error('Unbekannte View:', view); return; }
    currentView = view;
    currentArg = arg;
    fn(arg);
  };

  // Delegierte Navigation. Profil/Einstellungen (Topbar) wirken als Umschalter:
  // erneutes Antippen führt zurück zur Ansicht, von der aus geöffnet wurde.
  document.addEventListener('click', e => {
    const tgl = e.target.closest('[data-toggle-view]');
    if (tgl) {
      const v = tgl.getAttribute('data-toggle-view');
      if (currentView === v) {
        const ret = returnTo[v];
        if (ret && ret.view && ret.view !== v && MM.views[ret.view]) MM.go(ret.view, ret.arg);
        else MM.go('home');
      } else {
        returnTo[v] = { view: currentView, arg: currentArg };
        MM.go(v);
      }
      return;
    }
    const el = e.target.closest('[data-go]');
    if (el) MM.go(el.getAttribute('data-go'));
  });

  // Tageswechsel erkennen: Wenn die App im Hintergrund war und in Berlin
  // inzwischen ein neuer Kalendertag begonnen hat, Home-Ansicht aktualisieren.
  let lastSeenDay = null;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Beim Verlassen/Wechseln sofort in die Cloud schreiben
      MM.Store.flushNow();
      return;
    }
    if (document.visibilityState === 'visible' && MM.Store.data) {
      const now = MM.util.dateKey();
      if (lastSeenDay && now !== lastSeenDay && currentView === 'home') {
        MM.ui.toast(MM.t('home.newDay'));
        MM.go('home');
      }
      lastSeenDay = now;
    }
  });
  // Zusätzliches Sicherheitsnetz für das Wegschreiben beim Schließen
  window.addEventListener('pagehide', () => MM.Store.flushNow());

  /** Kurzer Ladebildschirm, während Firebase die Session wiederherstellt */
  function showSplash() {
    document.body.className = 'theme-dark';
    document.getElementById('app').className = 'app no-nav';
    document.getElementById('app').innerHTML =
      '<div class="auth-wrap" style="text-align:center">' +
      '<div class="auth-logo">' + MM.ui.logoMark('logo-lg') + '</div>' +
      '<div class="auth-title">MacroMind</div>' +
      '<div class="auth-sub" style="margin-top:18px">' + MM.t('auth.splash') + '</div>' +
      '</div>';
  }

  async function boot() {
    MM.initLang();
    MM.engine.buildIndex();
    lastSeenDay = MM.util.dateKey();
    MM.Store.initCloud();

    // Splash nur zeigen, wenn ein Account wiederhergestellt werden muss
    const raw = (function () {
      try { return JSON.parse(localStorage.getItem('mm_session_v1')); } catch (e) { return null; }
    })();
    if (raw && raw.type === 'account') showSplash();

    let ok = false;
    try { ok = await MM.Store.restoreSession(); } catch (e) { ok = false; }

    if (ok) {
      MM.ui.applyTheme();
      MM.go('home');
    } else {
      document.body.className = 'theme-dark';
      MM.go('auth');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
