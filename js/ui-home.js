/* ============================================================
   MacroMind – ui-home.js
   Startseite: 3 Level-Kacheln mit Tagesfortschritt, Resume-
   Hinweise (Vervollständigungsanzeige, KEIN Score!), Wissens-
   Check und Challenge-Code-Einstieg.
   ============================================================ */
window.MM = window.MM || {};

(function () {
  'use strict';
  const U = MM.util;
  const t = (k, p) => MM.t(k, p);
  const ui = MM.ui;

  MM.views.home = function () {
    const data = MM.Store.data;
    const stats = MM.engine.computeStats(data);
    const rank = MM.rankFor(stats.correctDaily);

    let html = ui.topbar() + '<div class="page">';

    // Begrüßung + Chips
    html += '<div class="hello-row"><div class="hello-name">' + t('home.hello') + ', ' + U.esc(data.name) + '</div></div>';
    html += '<div class="chips">' + ui.rankBadge(rank);
    if (stats.dayStreak > 0) {
      html += '<span class="chip"><span class="chip-ico">🔥</span>' + t('home.dayStreak', { n: stats.dayStreak }) + '</span>';
    }
    html += '</div>';

    // Laufende Sonder-Runden (Wissens-Check / Challenge / Wiederholung)
    for (const key of ['check', 'challenge', 'replay']) {
      const st = data.inProgress[key];
      if (st) {
        const label = key === 'check' ? t('check.title') :
          key === 'challenge' ? (t('hist.challenge') + (st.meta.challenger ? ' · vs. ' + U.esc(st.meta.challenger.name) : '')) :
          t('hist.replay');
        html += '<button class="mini-card resume-banner" data-resume="' + key + '">' +
          '<span class="mini-ico">⏸️</span><span class="mini-info">' +
          '<span class="mini-title">' + t('home.resumeBanner') + ' · ' + label + '</span>' +
          '<span class="mini-sub">' + t('home.resumeSub', { done: st.answers.length, total: st.qIds.length }) + '</span>' +
          '</span><span class="level-arrow">›</span></button>';
      }
    }

    // Level-Kacheln
    html += '<div class="section-label">' + t('home.levels') + '</div>';
    for (const lvl of [1, 2, 3]) {
      html += levelTile(data, lvl);
    }

    // Mehr
    html += '<div class="section-label">' + t('home.more') + '</div>';
    const checkable = MM.engine.canCheck();
    html += '<button class="mini-card" id="btn-check"' + (checkable ? '' : ' style="opacity:0.55"') + '>' +
      '<span class="mini-ico">🔁</span><span class="mini-info">' +
      '<span class="mini-title">' + t('home.check') + '</span>' +
      '<span class="mini-sub">' + (checkable ? t('home.checkSub') : t('home.checkLocked')) + '</span>' +
      '</span><span class="level-arrow">›</span></button>';

    html += '<button class="mini-card" id="btn-code">' +
      '<span class="mini-ico">⚔️</span><span class="mini-info">' +
      '<span class="mini-title">' + t('home.enterCode') + '</span>' +
      '<span class="mini-sub">' + t('home.enterCodeSub') + '</span>' +
      '</span><span class="level-arrow">›</span></button>';

    html += '</div>';
    ui.mount(html, { active: 'home' });

    // Listener
    for (const lvl of [1, 2, 3]) {
      const el = document.getElementById('tile-l' + lvl);
      if (el) el.addEventListener('click', () => onLevelClick(lvl));
    }
    document.querySelectorAll('[data-resume]').forEach(el => {
      el.addEventListener('click', () => MM.go('quiz', { key: el.getAttribute('data-resume') }));
    });
    document.getElementById('btn-check').addEventListener('click', onCheckClick);
    document.getElementById('btn-code').addEventListener('click', () => ui.enterChallengeModal());
  };

  function levelTile(data, lvl) {
    const inProg = data.inProgress['d' + lvl];
    const doneRound = MM.engine.todayDailyRound(lvl);
    let stateHtml, extra = '';

    if (inProg) {
      // Fortsetzen: bewusst als Vervollständigungs-Anzeige formuliert (kein Score!)
      stateHtml = '<div class="level-state state-resume">⏸️ ' + t('home.resume') + ' · ' +
        t('home.resumeSub', { done: inProg.answers.length, total: inProg.qIds.length }) + '</div>';
      extra = '<div class="tile-progress"><div style="width:' +
        Math.round(100 * inProg.answers.length / inProg.qIds.length) + '%"></div></div>';
    } else if (doneRound) {
      stateHtml = '<div class="level-state state-done">✅ ' + t('home.done') + ' · ' +
        t('home.doneScore', { s: doneRound.score }) + '</div>';
    } else {
      stateHtml = '<div class="level-state state-new">✨ ' + t('home.startNew') + '</div>';
    }

    return '<button class="level-tile" id="tile-l' + lvl + '">' +
      '<span class="level-badge l' + lvl + '">L' + lvl + '</span>' +
      '<span class="level-info">' +
      '<span class="level-name">' + t('level.' + lvl) + '</span>' +
      '<span class="level-sub" style="display:block">' + t('level.sub.' + lvl) + '</span>' +
      stateHtml + extra +
      '</span><span class="level-arrow">›</span></button>';
  }

  function onLevelClick(lvl) {
    const data = MM.Store.data;
    if (data.inProgress['d' + lvl]) {
      MM.go('quiz', { key: 'd' + lvl });
      return;
    }
    const doneRound = MM.engine.todayDailyRound(lvl);
    if (doneRound) {
      MM.go('histDetail', { roundId: doneRound.id });
      return;
    }
    const res = MM.engine.startDaily(lvl);
    if (res) MM.go('quiz', { key: 'd' + lvl });
  }

  function onCheckClick() {
    if (!MM.engine.canCheck()) {
      ui.toast(t('check.notEnough'), 'error');
      return;
    }
    const res = MM.engine.startCheck();
    if (!res) {
      ui.toast(t('check.notEnough'), 'error');
      return;
    }
    MM.go('quiz', { key: 'check' });
  }

  /** Challenge-Code-Eingabe (von Home UND Einstellungen genutzt) */
  ui.enterChallengeModal = function () {
    const m = ui.modal(
      '<div class="modal-title">' + t('home.enterCode') + '</div>' +
      '<div class="modal-text">' + t('home.enterCodeSub') + '</div>' +
      '<textarea class="input" id="ch-code" rows="4" placeholder="' + t('challenge.paste') + '" style="resize:vertical"></textarea>' +
      '<div class="form-error" id="ch-error"></div>' +
      '<button class="btn btn-primary" id="ch-submit">' + t('common.next') + '</button>' +
      '<button class="btn btn-ghost" id="ch-cancel">' + t('common.cancel') + '</button>'
    );
    m.querySelector('#ch-cancel').addEventListener('click', ui.closeModal);
    m.querySelector('#ch-submit').addEventListener('click', () => {
      const code = m.querySelector('#ch-code').value;
      const payload = MM.engine.decodeChallenge(code);
      if (!payload) {
        m.querySelector('#ch-error').textContent = t('challenge.invalid');
        return;
      }
      ui.closeModal();
      acceptChallengeModal(payload);
    });
  };

  function acceptChallengeModal(payload) {
    const levelLabel = payload.l ? t('level.short.' + payload.l) : t('hist.challenge');
    const m = ui.modal(
      '<div class="modal-title">⚔️ ' + t('challenge.acceptTitle', { name: U.esc(payload.n) }) + '</div>' +
      '<div class="modal-text">' + t('challenge.acceptText', { level: levelLabel, name: U.esc(payload.n), s: payload.s }) + '</div>' +
      '<button class="btn btn-primary" id="ch-accept">' + t('challenge.accept') + '</button>' +
      '<button class="btn btn-ghost" id="ch-decline">' + t('common.cancel') + '</button>'
    );
    m.querySelector('#ch-decline').addEventListener('click', ui.closeModal);
    m.querySelector('#ch-accept').addEventListener('click', () => {
      ui.closeModal();
      MM.engine.startChallenge(payload);
      MM.go('quiz', { key: 'challenge' });
    });
  }
})();
