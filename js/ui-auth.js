/* ============================================================
   MacroMind – ui-auth.js
   Willkommens-, Login- und Registrierungs-Screens.
   Benutzername + 4-stellige PIN (gehasht), plus Gast-Modus.
   ============================================================ */
window.MM = window.MM || {};

(function () {
  'use strict';
  const U = MM.util;
  const t = (k, p) => MM.t(k, p);
  const ui = MM.ui;

  MM.views.auth = function () {
    ui.mount(
      '<div class="auth-wrap">' +
      '<div class="auth-logo">' + ui.logoMark('logo-lg') + '</div>' +
      '<div class="auth-title">MacroMind</div>' +
      '<div class="auth-sub">' + t('auth.sub') + '</div>' +
      '<button class="btn btn-primary" id="btn-register">' + t('auth.register') + '</button>' +
      '<button class="btn" id="btn-login">' + t('auth.login') + '</button>' +
      '<button class="btn btn-ghost" id="btn-guest">' + t('auth.guest') + '</button>' +
      '<p class="auth-links small muted" style="margin-top:22px">' + t('auth.guestNote') + '</p>' +
      langPicker() +
      '</div>',
      { nav: false }
    );
    document.getElementById('btn-register').addEventListener('click', () => MM.go('register'));
    document.getElementById('btn-login').addEventListener('click', () => MM.go('login'));
    document.getElementById('btn-guest').addEventListener('click', () => {
      MM.Store.loginGuest();
      ui.applyTheme();
      MM.go('home');
    });
    bindLangPicker('auth');
  };

  function langPicker() {
    return '<div class="center" style="margin-top:18px">' +
      '<select class="select" id="auth-lang" style="max-width:200px;margin:0 auto">' +
      MM.LANGS.map(l =>
        '<option value="' + l.code + '"' + (MM.lang === l.code ? ' selected' : '') + '>' + l.label + '</option>'
      ).join('') +
      '</select></div>';
  }

  function bindLangPicker(view) {
    const sel = document.getElementById('auth-lang');
    if (sel) {
      sel.addEventListener('change', () => {
        MM.setLang(sel.value);
        MM.go(view);
      });
    }
  }

  MM.views.register = function () {
    ui.mount(
      '<div class="auth-wrap">' +
      '<div class="auth-title" style="font-size:1.5rem">' + t('auth.registerTitle') + '</div>' +
      '<div class="field"><label>' + t('auth.username') + '</label>' +
      '<input class="input" id="reg-user" maxlength="20" autocomplete="username"></div>' +
      '<div class="field"><label>' + t('auth.pin') + '</label>' +
      '<input class="input" id="reg-pin" inputmode="numeric" pattern="[0-9]*" maxlength="4" type="password" autocomplete="new-password"></div>' +
      '<div class="field"><label>' + t('auth.pin2') + '</label>' +
      '<input class="input" id="reg-pin2" inputmode="numeric" pattern="[0-9]*" maxlength="4" type="password" autocomplete="new-password"></div>' +
      '<div class="form-error" id="reg-error"></div>' +
      '<button class="btn btn-primary" id="reg-submit">' + t('auth.register') + '</button>' +
      '<p class="small muted" style="margin-top:14px">' + t('auth.registerNote') + '</p>' +
      '<div class="auth-links">' + t('auth.haveAccount') + ' <button id="to-login">' + t('auth.login') + '</button></div>' +
      '<div class="auth-links"><button id="to-welcome">' + t('common.back') + '</button></div>' +
      '</div>',
      { nav: false }
    );
    document.getElementById('to-login').addEventListener('click', () => MM.go('login'));
    document.getElementById('to-welcome').addEventListener('click', () => MM.go('auth'));
    const doRegister = async () => {
      const user = document.getElementById('reg-user').value;
      const pin = document.getElementById('reg-pin').value;
      const pin2 = document.getElementById('reg-pin2').value;
      const err = document.getElementById('reg-error');
      const btn = document.getElementById('reg-submit');
      err.textContent = '';
      if (pin !== pin2) { err.textContent = t('auth.err.pinMismatch'); return; }
      const label = btn.textContent;
      btn.disabled = true; btn.textContent = t('auth.working');
      const res = await MM.Store.register(user, pin);
      btn.disabled = false; btn.textContent = label;
      if (!res.ok) { err.textContent = t(res.error); return; }
      ui.applyTheme();
      MM.go('home');
    };
    document.getElementById('reg-submit').addEventListener('click', doRegister);
    document.getElementById('reg-pin2').addEventListener('keydown', e => {
      if (e.key === 'Enter') doRegister();
    });
  };

  MM.views.login = function () {
    ui.mount(
      '<div class="auth-wrap">' +
      '<div class="auth-title" style="font-size:1.5rem">' + t('auth.loginTitle') + '</div>' +
      '<div class="field"><label>' + t('auth.username') + '</label>' +
      '<input class="input" id="log-user" maxlength="20" autocomplete="username"></div>' +
      '<div class="field"><label>' + t('auth.pin') + '</label>' +
      '<input class="input" id="log-pin" inputmode="numeric" pattern="[0-9]*" maxlength="4" type="password" autocomplete="current-password"></div>' +
      '<div class="form-error" id="log-error"></div>' +
      '<button class="btn btn-primary" id="log-submit">' + t('auth.login') + '</button>' +
      '<div class="auth-links">' + t('auth.noAccount') + ' <button id="to-register">' + t('auth.register') + '</button></div>' +
      '<div class="auth-links"><button id="to-welcome">' + t('common.back') + '</button></div>' +
      '</div>',
      { nav: false }
    );
    document.getElementById('to-register').addEventListener('click', () => MM.go('register'));
    document.getElementById('to-welcome').addEventListener('click', () => MM.go('auth'));
    const submit = async () => {
      const user = document.getElementById('log-user').value;
      const pin = document.getElementById('log-pin').value;
      const err = document.getElementById('log-error');
      const btn = document.getElementById('log-submit');
      err.textContent = '';
      const label = btn.textContent;
      btn.disabled = true; btn.textContent = t('auth.working');
      const res = await MM.Store.login(user, pin);
      btn.disabled = false; btn.textContent = label;
      if (!res.ok) { err.textContent = t(res.error); return; }
      ui.applyTheme();
      MM.go('home');
    };
    document.getElementById('log-submit').addEventListener('click', submit);
    document.getElementById('log-pin').addEventListener('keydown', e => {
      if (e.key === 'Enter') submit();
    });
  };
})();
