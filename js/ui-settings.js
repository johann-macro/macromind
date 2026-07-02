/* ============================================================
   MacroMind – ui-settings.js
   Einstellungen: Theme, Sprache, Fragen-Reset, Challenge-Code,
   Sync-Export/-Import, Abmelden, Alle Daten löschen.
   ============================================================ */
window.MM = window.MM || {};

(function () {
  'use strict';
  const U = MM.util;
  const t = (k, p) => MM.t(k, p);
  const ui = MM.ui;

  MM.views.settings = function () {
    const data = MM.Store.data;
    const isDark = data.settings.theme !== 'light';

    let html = ui.topbar() + '<div class="page">' +
      '<div class="page-title glow">' + t('set.title') + '</div>';

    // Konto
    html += '<div class="section-label">' + t('set.account') + '</div>' +
      '<div class="setting-row"><span class="set-ico">' + (MM.Store.isGuest() ? '👻' : '🔐') + '</span>' +
      '<span class="set-info"><span class="set-title">' +
      (MM.Store.isGuest()
        ? t('set.guestMode')
        : t('set.loggedInAs') + ': ' + U.esc(MM.Store.session.username || data.name)) +
      '</span>' +
      (MM.Store.isCloudAccount()
        ? '<span class="set-sub">☁️ ' + t('set.cloudSynced') + '</span>'
        : (MM.Store.isGuest() ? '' : '<span class="set-sub">' + t('set.localOnly') + '</span>')) +
      '</span></div>';

    // App
    html += '<div class="section-label">' + t('set.app') + '</div>';
    html += '<div class="setting-row"><span class="set-ico">🌙</span>' +
      '<span class="set-info"><span class="set-title">' + t('set.darkmode') + '</span>' +
      '<span class="set-sub">' + t('set.darkmodeSub') + '</span></span>' +
      '<button class="toggle' + (isDark ? ' on' : '') + '" id="theme-toggle" aria-label="' + t('set.darkmode') + '"></button></div>';

    html += '<div class="setting-row"><span class="set-ico">🌍</span>' +
      '<span class="set-info"><span class="set-title">' + t('set.language') + '</span>' +
      '<span class="set-sub">' + t('set.languageSub') + '</span></span>' +
      '<select class="select" id="lang-select" style="flex:0 0 130px">' +
      MM.LANGS.map(l => '<option value="' + l.code + '"' + (MM.lang === l.code ? ' selected' : '') + '>' + l.label + '</option>').join('') +
      '</select></div>';

    html += '<button class="setting-row" id="btn-refresh"><span class="set-ico">🔄</span>' +
      '<span class="set-info"><span class="set-title">' + t('set.refreshQ') + '</span>' +
      '<span class="set-sub">' + t('set.refreshQSub') + '</span></span></button>';

    html += '<button class="setting-row" id="btn-code"><span class="set-ico">⚔️</span>' +
      '<span class="set-info"><span class="set-title">' + t('set.enterCode') + '</span>' +
      '<span class="set-sub">' + t('set.enterCodeSub') + '</span></span></button>';

    // Daten
    html += '<div class="section-label">' + t('set.data') + '</div>';
    html += '<button class="setting-row" id="btn-export"><span class="set-ico">📤</span>' +
      '<span class="set-info"><span class="set-title">' + t('set.export') + '</span>' +
      '<span class="set-sub">' + t('set.exportSub') + '</span></span></button>';

    html += '<button class="setting-row" id="btn-import"><span class="set-ico">📥</span>' +
      '<span class="set-info"><span class="set-title">' + t('set.import') + '</span>' +
      '<span class="set-sub">' + t('set.importSub') + '</span></span></button>';

    html += '<button class="setting-row" id="btn-logout"><span class="set-ico">🚪</span>' +
      '<span class="set-info"><span class="set-title">' + t('set.logout') + '</span>' +
      '<span class="set-sub">' + t('set.logoutSub') + '</span></span></button>';

    html += '<button class="setting-row" id="btn-delete" style="border-color:var(--bad)"><span class="set-ico">🗑️</span>' +
      '<span class="set-info"><span class="set-title" style="color:var(--bad)">' + t('set.deleteAll') + '</span>' +
      '<span class="set-sub">' + t('set.deleteAllSub') + '</span></span></button>';

    html += '</div>';
    ui.mount(html, { active: null });

    // Listener
    document.getElementById('theme-toggle').addEventListener('click', () => {
      data.settings.theme = data.settings.theme === 'light' ? 'dark' : 'light';
      MM.Store.save();
      ui.applyTheme();
      MM.go('settings');
    });

    document.getElementById('lang-select').addEventListener('change', e => {
      data.settings.lang = e.target.value;
      MM.Store.save();
      MM.setLang(e.target.value);
      MM.go('settings');
    });

    document.getElementById('btn-refresh').addEventListener('click', () => {
      ui.confirm({
        title: t('set.refreshQTitle'),
        text: t('set.refreshQText'),
        onConfirm: () => {
          MM.engine.refreshQuestions();
          ui.toast(t('set.refreshDone'));
          MM.go('settings');
        }
      });
    });

    document.getElementById('btn-code').addEventListener('click', () => ui.enterChallengeModal());

    document.getElementById('btn-export').addEventListener('click', showExport);
    document.getElementById('btn-import').addEventListener('click', showImport);

    document.getElementById('btn-logout').addEventListener('click', () => {
      MM.Store.logout();
      MM.go('auth');
    });

    document.getElementById('btn-delete').addEventListener('click', () => {
      ui.confirm({
        title: t('set.deleteTitle'),
        text: t('set.deleteText'),
        confirmLabel: t('common.delete'),
        danger: true,
        onConfirm: async () => {
          await MM.Store.deleteCurrentUser();
          MM.go('auth');
        }
      });
    });
  };

  function showExport() {
    const code = MM.Store.exportCode();
    const m = ui.modal(
      '<div class="modal-title">📤 ' + t('set.exportTitle') + '</div>' +
      '<div class="modal-text">' + t('set.exportHint') + '</div>' +
      '<div class="code-box">' + U.esc(code) + '</div>' +
      '<div class="spacer"></div>' +
      '<button class="btn btn-primary" id="exp-copy">📋 ' + t('common.copy') + '</button>' +
      '<button class="btn btn-ghost" id="exp-close">' + t('common.close') + '</button>'
    );
    m.querySelector('#exp-close').addEventListener('click', ui.closeModal);
    m.querySelector('#exp-copy').addEventListener('click', async () => {
      const ok = await ui.copyText(code);
      if (ok) ui.toast(t('common.copied'));
    });
  }

  function showImport() {
    const m = ui.modal(
      '<div class="modal-title">📥 ' + t('set.importTitle') + '</div>' +
      '<div class="modal-text">' + t('set.importText') + '</div>' +
      '<textarea class="input" id="imp-code" rows="4" placeholder="MMS1." style="resize:vertical"></textarea>' +
      '<div class="form-error" id="imp-error"></div>' +
      '<button class="btn btn-primary" id="imp-submit">' + t('common.confirm') + '</button>' +
      '<button class="btn btn-ghost" id="imp-cancel">' + t('common.cancel') + '</button>'
    );
    m.querySelector('#imp-cancel').addEventListener('click', ui.closeModal);
    m.querySelector('#imp-submit').addEventListener('click', () => {
      const res = MM.Store.importCode(m.querySelector('#imp-code').value);
      if (!res.ok) {
        m.querySelector('#imp-error').textContent = t('set.importInvalid');
        return;
      }
      ui.closeModal();
      ui.applyTheme();
      ui.toast(t('set.importDone'));
      MM.go('home');
    });
  }
})();
