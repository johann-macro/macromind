/* ============================================================
   MacroMind – ui-core.js
   Gemeinsame UI-Bausteine: Seiten-Mounting, Topbar, Bottom-Nav,
   Modals (eigene, keine nativen Dialoge!), Toasts, Rang-Badges.
   ============================================================ */
window.MM = window.MM || {};

(function () {
  'use strict';
  const U = MM.util;
  const t = (k, p) => MM.t(k, p);

  MM.views = {};

  const ui = {};
  MM.ui = ui;

  /** Seite rendern; nav = Bottom-Navigation anzeigen */
  ui.mount = function (html, opts) {
    const app = document.getElementById('app');
    const withNav = !opts || opts.nav !== false;
    app.className = 'app' + (withNav ? '' : ' no-nav');
    app.innerHTML = html + (withNav ? ui.bottomNav(opts && opts.active) : '');
    window.scrollTo(0, 0);
  };

  ui.topbar = function () {
    return '<div class="topbar">' +
      '<div class="brand">MacroMind</div>' +
      '<div class="topbar-actions">' +
      '<button class="icon-btn" data-go="profile" aria-label="' + t('nav.profile') + '">👤</button>' +
      '<button class="icon-btn" data-go="settings" aria-label="' + t('set.title') + '">⚙️</button>' +
      '</div></div>';
  };

  ui.bottomNav = function (active) {
    const items = [
      { id: 'home', ico: '🏠', label: t('nav.home') },
      { id: 'history', ico: '🕘', label: t('nav.history') },
      { id: 'stats', ico: '📈', label: t('nav.stats') },
      { id: 'profile', ico: '👤', label: t('nav.profile') }
    ];
    return '<nav class="bottom-nav"><div class="bottom-nav-inner">' +
      items.map(i =>
        '<button class="nav-item' + (active === i.id ? ' active' : '') + '" data-go="' + i.id + '">' +
        '<span class="nav-ico">' + i.ico + '</span><span>' + i.label + '</span></button>'
      ).join('') +
      '</div></nav>';
  };

  // ---------- Modals ----------
  ui.modal = function (html) {
    const root = document.getElementById('modal-root');
    root.innerHTML = '<div class="modal-backdrop"><div class="modal">' + html + '</div></div>';
    const backdrop = root.querySelector('.modal-backdrop');
    backdrop.addEventListener('click', e => {
      if (e.target === backdrop) ui.closeModal();
    });
    return root.querySelector('.modal');
  };

  ui.closeModal = function () {
    document.getElementById('modal-root').innerHTML = '';
  };

  /** Eigener Bestätigungsdialog (bewusst KEIN natives confirm()) */
  ui.confirm = function (opts) {
    const m = ui.modal(
      '<div class="modal-title">' + U.esc(opts.title) + '</div>' +
      '<div class="modal-text">' + U.esc(opts.text) + '</div>' +
      '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" id="mm-confirm-yes">' +
      U.esc(opts.confirmLabel || t('common.confirm')) + '</button>' +
      '<button class="btn btn-ghost" id="mm-confirm-no">' + t('common.cancel') + '</button>'
    );
    m.querySelector('#mm-confirm-yes').addEventListener('click', () => {
      ui.closeModal();
      opts.onConfirm();
    });
    m.querySelector('#mm-confirm-no').addEventListener('click', ui.closeModal);
  };

  // ---------- Toasts ----------
  let toastTimer = null;
  ui.toast = function (msg, type) {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' toast-' + type : '');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.4s'; }, 2600);
    setTimeout(() => el.remove(), 3100);
  };

  /** Achievement-Toasts nacheinander anzeigen */
  ui.achToasts = function (ids) {
    if (!ids || !ids.length) return;
    ids.forEach((id, i) => {
      const a = MM.ACHIEVEMENTS.find(x => x.id === id);
      setTimeout(() => {
        ui.toast((a ? a.icon + ' ' : '🏆 ') + t('result.unlocked') + ': ' + t('ach.' + id + '.n'), 'ach');
      }, i * 900);
    });
  };

  // ---------- Rang-Badge ----------
  ui.rankBadge = function (rank, big) {
    return '<span class="rank-badge ' + rank.cls + (big ? ' big' : '') + '">' +
      '<span>' + rank.icon + '</span><span>' + U.esc(rank.name) + '</span></span>';
  };

  ui.scoreClass = function (score, total) {
    const pct = total > 0 ? score / total : 0;
    return pct >= 0.7 ? 'good' : (pct >= 0.4 ? 'mid' : 'bad');
  };

  /** Label für einen Historieneintrag */
  ui.roundLabel = function (r) {
    if (r.type === 'daily') return t('level.' + r.level);
    if (r.type === 'check') return t('hist.check');
    if (r.type === 'challenge') {
      return t('hist.challenge') + (r.challenger && r.challenger.name ? ' · vs. ' + r.challenger.name : '');
    }
    if (r.type === 'replay') {
      return t('hist.replay') + (r.level ? ' · ' + t('level.short.' + r.level) : '');
    }
    return r.type;
  };

  ui.roundIcon = function (r) {
    return { daily: '📅', check: '🔁', challenge: '⚔️', replay: '🔄' }[r.type] || '❓';
  };

  // ---------- Clipboard ----------
  ui.copyText = async function (text) {
    try {
      if (navigator.clipboard && window.isSecureContext !== false) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* Fallback unten */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) {
      return false;
    }
  };

  // ---------- Theme ----------
  ui.applyTheme = function () {
    const theme = (MM.Store.data && MM.Store.data.settings.theme) || 'dark';
    document.body.className = theme === 'light' ? 'theme-light' : 'theme-dark';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f2f4f9' : '#0b0e14');
  };
})();
