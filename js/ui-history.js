/* ============================================================
   MacroMind – ui-history.js
   Historie aller Runden mit Sortierung, Detailansicht und
   „Nochmal spielen". Wiederholung referenziert IMMER die konkret
   angeklickte Runde über ihre ID – unabhängig von der Sortierung.
   ============================================================ */
window.MM = window.MM || {};

(function () {
  'use strict';
  const U = MM.util;
  const t = (k, p) => MM.t(k, p);
  const ui = MM.ui;

  let sortMode = 'newest';

  MM.views.history = function () {
    const data = MM.Store.data;
    const rounds = sortedRounds(data.rounds);

    let html = ui.topbar() + '<div class="page">' +
      '<div class="page-title glow">' + t('hist.title') + '</div>';

    if (rounds.length === 0) {
      html += '<div class="empty-state"><span class="es-ico">🕘</span>' + t('hist.empty') + '</div>';
    } else {
      html += '<div class="sort-row"><select class="select" id="hist-sort">' +
        ['newest', 'oldest', 'best', 'worst'].map(s =>
          '<option value="' + s + '"' + (sortMode === s ? ' selected' : '') + '>' + t('hist.sort.' + s) + '</option>'
        ).join('') + '</select></div>';

      html += rounds.map(r =>
        '<button class="hist-item" data-round="' + r.id + '">' +
        '<span class="hist-ico">' + ui.roundIcon(r) + '</span>' +
        '<span class="hist-info">' +
        '<span class="hist-title">' + U.esc(ui.roundLabel(r)) + '</span>' +
        '<span class="hist-sub" style="display:block">' + U.fmtDate(r.dateKey) + ' · ' + U.fmtDuration(r.durationMs) + '</span>' +
        '</span>' +
        '<span class="hist-score ' + ui.scoreClass(r.score, r.total) + '">' + r.score + '/' + r.total + '</span>' +
        '</button>'
      ).join('');
    }

    html += '</div>';
    ui.mount(html, { active: 'history' });

    const sel = document.getElementById('hist-sort');
    if (sel) {
      sel.addEventListener('change', () => {
        sortMode = sel.value;
        MM.go('history');
      });
    }
    document.querySelectorAll('[data-round]').forEach(el => {
      el.addEventListener('click', () => MM.go('histDetail', { roundId: el.getAttribute('data-round') }));
    });
  };

  function sortedRounds(rounds) {
    const list = rounds.slice();
    const byTime = (a, b) => (a.finishedAt || '').localeCompare(b.finishedAt || '');
    if (sortMode === 'newest') list.sort((a, b) => byTime(b, a));
    else if (sortMode === 'oldest') list.sort(byTime);
    else if (sortMode === 'best') {
      list.sort((a, b) => (b.score / Math.max(1, b.total)) - (a.score / Math.max(1, a.total)) || byTime(b, a));
    } else {
      list.sort((a, b) => (a.score / Math.max(1, a.total)) - (b.score / Math.max(1, b.total)) || byTime(b, a));
    }
    return list;
  }

  MM.views.histDetail = function (arg) {
    const data = MM.Store.data;
    const r = data.rounds.find(x => x.id === (arg && arg.roundId));
    if (!r) { MM.go('history'); return; }

    let html = ui.topbar() + '<div class="page">' +
      '<button class="back-btn" id="hd-back">‹ ' + t('common.back') + '</button>' +
      '<div class="page-title">' + U.esc(ui.roundLabel(r)) + '</div>' +
      '<div class="chips">' +
      '<span class="chip">📅 ' + U.fmtDate(r.dateKey) + '</span>' +
      '<span class="chip ' + '">' + r.score + '/' + r.total + '</span>' +
      '<span class="chip">⏱️ ' + U.fmtDuration(r.durationMs) + '</span>' +
      '</div>' +
      '<button class="btn btn-primary" id="hd-replay" style="margin-top:12px">🔄 ' + t('hist.replayBtn') + '</button>';

    html += r.answers.map((a, i) => {
      const q = MM.qById.get(a.q);
      if (!q) return '';
      return '<div class="detail-q">' +
        '<div class="dq-head"><span class="dq-mark">' + (a.correct ? '✅' : '❌') + '</span>' +
        '<span class="dq-text">' + (i + 1) + '. ' + U.esc(q.q) + '</span></div>' +
        '<div class="dq-row"><b>' + t('hist.yourAnswer') + ':</b> ' +
        '<span class="' + (a.correct ? 'dq-chosen-right' : 'dq-chosen-wrong') + '">' + U.esc(q.o[a.chosen]) + '</span></div>' +
        (!a.correct
          ? '<div class="dq-row"><b>' + t('hist.correctAnswer') + ':</b> <span class="dq-correct">' + U.esc(q.o[q.c]) + '</span></div>'
          : '') +
        '<div class="dq-expl">' + U.esc(q.e) + '</div>' +
        '</div>';
    }).join('');

    html += '</div>';
    ui.mount(html, { active: 'history' });

    document.getElementById('hd-back').addEventListener('click', () => MM.go('history'));
    document.getElementById('hd-replay').addEventListener('click', () => {
      // Referenz über die Runden-ID – nie über eine Listenposition
      const rp = MM.engine.startReplay(r.id);
      if (rp) MM.go('quiz', { key: 'replay' });
    });
  };
})();
