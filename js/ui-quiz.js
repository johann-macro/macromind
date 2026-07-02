/* ============================================================
   MacroMind – ui-quiz.js
   Quiz-Ablauf (alle Modi) + Ergebnis-Screen.
   Der X-Button führt IMMER zuverlässig zur Startseite zurück –
   der Fortschritt ist zu diesem Zeitpunkt bereits persistiert
   (nach jeder Antwort), es gibt keinen nativen Bestätigungsdialog.
   ============================================================ */
window.MM = window.MM || {};

(function () {
  'use strict';
  const U = MM.util;
  const t = (k, p) => MM.t(k, p);
  const ui = MM.ui;

  let curKey = null;

  MM.views.quiz = function (arg) {
    curKey = arg && arg.key;
    // resumeState setzt shownAt zurück, damit Abwesenheitszeit nicht als
    // Antwortzeit zählt (relevant beim Fortsetzen einer Runde)
    const state = MM.engine.resumeState(curKey);
    if (!state) { MM.go('home'); return; }
    // Sicherheitsnetz: Runde referenziert Fragen, die es nach einem
    // Pool-Update nicht mehr gibt → Runde verwerfen statt abzustürzen
    if (state.qIds.some(id => !MM.qById.has(id))) {
      delete MM.Store.data.inProgress[curKey];
      MM.Store.save();
      MM.go('home');
      return;
    }
    if (state.idx >= state.qIds.length) {
      // Sollte nicht vorkommen – Sicherheitsnetz: Runde sauber abschließen
      const result = MM.engine.finishRound(state);
      MM.go('result', result);
      return;
    }
    renderQuestion(state);
  };

  function modeTitle(state) {
    if (state.mode === 'daily') return t('level.' + state.level);
    if (state.mode === 'check') return t('check.title');
    if (state.mode === 'challenge') {
      return t('hist.challenge') + (state.meta.challenger ? ' · vs. ' + state.meta.challenger.name : '');
    }
    if (state.mode === 'replay') {
      return t('hist.replay') + (state.level ? ' · ' + t('level.short.' + state.level) : '');
    }
    return '';
  }

  function renderQuestion(state) {
    const qid = state.qIds[state.idx];
    const q = MM.qById.get(qid);
    const perm = state.perms[state.idx];
    const total = state.qIds.length;

    let html = '<div class="quiz-header">' +
      '<button class="icon-btn" id="qz-close" aria-label="' + t('common.close') + '">✕</button>' +
      '<div class="quiz-title">' + U.esc(modeTitle(state)) + '</div>' +
      (state.curStreak >= 2 ? '<div class="quiz-streak">🔥 ' + state.curStreak + '</div>' : '') +
      '<div class="quiz-counter">' + (state.idx + 1) + '/' + total + '</div>' +
      '</div>' +
      '<div class="progress-bar"><div style="width:' + Math.round(100 * state.idx / total) + '%"></div></div>';

    html += '<div class="q-card">' +
      '<span class="q-type-tag">' + t('qtype.' + q.type) + '</span>' +
      (q.asOf ? '<span class="q-asof">' + t('quiz.asOf', { date: U.fmtAsOf(q.asOf) }) + '</span>' : '') +
      '<div class="q-text">' + U.esc(q.q) + '</div>' +
      '</div>';

    html += '<div class="answers">';
    const letters = ['A', 'B', 'C', 'D'];
    perm.forEach((origIdx, dispIdx) => {
      html += '<button class="answer-btn" data-idx="' + dispIdx + '">' +
        '<span class="answer-letter">' + letters[dispIdx] + '</span>' +
        '<span>' + U.esc(q.o[origIdx]) + '</span></button>';
    });
    html += '</div>';

    html += '<div id="qz-after"></div><div class="quiz-footer" id="qz-footer"></div>';

    ui.mount(html, { nav: false });

    document.getElementById('qz-close').addEventListener('click', () => {
      // Fortschritt ist bereits gespeichert – einfach und zuverlässig zurück
      if (state.answers.length > 0) ui.toast(t('quiz.savedToast'));
      MM.go('home');
    });

    document.querySelectorAll('.answer-btn').forEach(btn => {
      btn.addEventListener('click', () => onAnswer(state, parseInt(btn.getAttribute('data-idx'), 10)));
    });
  }

  function onAnswer(state, dispIdx) {
    const qid = state.qIds[state.idx];
    const q = MM.qById.get(qid);
    const perm = state.perms[state.idx];
    const res = MM.engine.answer(state, dispIdx);

    // Buttons einfärben und sperren
    document.querySelectorAll('.answer-btn').forEach(btn => {
      const i = parseInt(btn.getAttribute('data-idx'), 10);
      btn.classList.add('disabled');
      const origIdx = perm[i];
      if (origIdx === q.c) btn.classList.add('correct');
      else if (i === dispIdx) btn.classList.add('wrong');
      else btn.classList.add('dimmed');
    });

    // Streak-Anzeige aktualisieren
    const header = document.querySelector('.quiz-header');
    const streakEl = header.querySelector('.quiz-streak');
    if (state.curStreak >= 2) {
      if (streakEl) streakEl.textContent = '🔥 ' + state.curStreak;
      else header.querySelector('.quiz-title').insertAdjacentHTML('afterend',
        '<div class="quiz-streak">🔥 ' + state.curStreak + '</div>');
    } else if (streakEl) {
      streakEl.remove();
    }

    // Erklärung einblenden
    const after = document.getElementById('qz-after');
    let afterHtml = '<div class="explain-card">' +
      '<div class="explain-label">' + (res.correct ? '✅ ' + t('quiz.correct') : '❌ ' + t('quiz.wrong')) +
      ' · ' + t('quiz.explanation') + '</div>' + U.esc(q.e) + '</div>';

    // Wissens-Check: Vergleich zur damaligen Antwort
    if (state.mode === 'check' && state.meta.past && state.meta.past[qid]) {
      const past = state.meta.past[qid];
      afterHtml += '<div class="past-compare">' +
        (past.correct ? '🟢 ' : '🔴 ') +
        t(past.correct ? 'quiz.pastRight' : 'quiz.pastWrong', { date: U.fmtDate(past.dateKey) }) +
        '</div>';
    }
    after.innerHTML = afterHtml;

    // Weiter- bzw. Abschluss-Button
    const isLast = state.idx + 1 >= state.qIds.length;
    document.getElementById('qz-footer').innerHTML =
      '<button class="btn btn-primary" id="qz-next">' +
      (isLast ? t('quiz.finish') : t('common.next')) + '</button>';
    const nextBtn = document.getElementById('qz-next');
    nextBtn.addEventListener('click', () => onNext(state));
    nextBtn.scrollIntoView({ behavior: 'smooth', block: 'end' });

    // Fortschrittsbalken (beantwortete Fragen)
    const bar = document.querySelector('.progress-bar > div');
    if (bar) bar.style.width = Math.round(100 * state.answers.length / state.qIds.length) + '%';

    ui.achToasts(res.unlocked);
  }

  function onNext(state) {
    MM.engine.advance(state);
    if (state.idx >= state.qIds.length) {
      const result = MM.engine.finishRound(state);
      MM.go('result', result);
    } else {
      renderQuestion(state);
    }
  }

  // ---------- Ergebnis-Screen ----------

  MM.views.result = function (arg) {
    if (!arg || !arg.record) { MM.go('home'); return; }
    const r = arg.record;
    const pct = r.total > 0 ? r.score / r.total : 0;
    const circumference = 2 * Math.PI * 62;

    let html = '<div class="result-wrap">';

    // Challenge-Vergleich
    if (r.type === 'challenge' && r.challenger) {
      const verdictCls = r.outcome === 'win' ? 'win' : (r.outcome === 'draw' ? 'draw' : 'lose');
      const verdictTxt = r.outcome === 'win' ? t('result.win') : (r.outcome === 'draw' ? t('result.draw') : t('result.lose'));
      html += '<div class="result-title">' + U.esc(modeRecordTitle(r)) + '</div>' +
        '<div class="vs-verdict ' + verdictCls + '" style="margin-top:14px">' + verdictTxt + '</div>' +
        '<div class="vs-box">' +
        '<div class="vs-side' + (r.outcome === 'win' ? ' winner' : '') + '">' +
        '<div class="vs-name">' + t('result.you') + '</div><div class="vs-score">' + r.score + '/' + r.total + '</div></div>' +
        '<div class="vs-mid">VS</div>' +
        '<div class="vs-side' + (r.outcome === 'lose' ? ' winner' : '') + '">' +
        '<div class="vs-name">' + U.esc(r.challenger.name) + '</div><div class="vs-score">' + r.challenger.score + '/' + r.total + '</div></div>' +
        '</div>';
    } else {
      html += '<div class="score-ring">' +
        '<svg width="150" height="150" viewBox="0 0 150 150">' +
        '<circle cx="75" cy="75" r="62" fill="none" stroke="var(--border)" stroke-width="10"/>' +
        '<circle cx="75" cy="75" r="62" fill="none" stroke="url(#rg)" stroke-width="10" stroke-linecap="round" ' +
        'stroke-dasharray="' + circumference.toFixed(1) + '" stroke-dashoffset="' + (circumference * (1 - pct)).toFixed(1) + '"/>' +
        '<defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent2)"/>' +
        '</linearGradient></defs></svg>' +
        '<div class="score-num"><span class="score-big">' + r.score + '/' + r.total + '</span>' +
        '<span class="score-small">' + t('result.correctOf', { s: r.score, n: r.total }) + '</span></div></div>' +
        '<div class="result-title">' + (r.type === 'check' ? t('result.checkDone') : t('result.done')) + '</div>' +
        '<div class="result-sub">' + U.esc(modeRecordTitle(r)) + '</div>';
    }

    // Kennzahlen
    html += '<div class="result-stats">' +
      '<div class="result-stat"><div class="rs-val">' + U.fmtDuration(r.durationMs) + '</div><div class="rs-label">' + t('result.time') + '</div></div>' +
      '<div class="result-stat"><div class="rs-val">🔥 ' + r.bestStreak + '</div><div class="rs-label">' + t('result.bestStreak') + '</div></div>' +
      '<div class="result-stat"><div class="rs-val">' + Math.round(pct * 100) + '%</div><div class="rs-label">' + t('result.accuracy') + '</div></div>' +
      '</div>';

    // Rang-Aufstieg
    if (arg.rankUp) {
      html += '<div class="unlock-list"><div class="unlock-item">🎖️ ' + t('result.rankUp') + ' ' +
        ui.rankBadge(arg.rankUp) + '</div></div>';
    }

    // Freigeschaltete Erfolge
    if (arg.unlocked && arg.unlocked.length) {
      html += '<div class="unlock-list">' + arg.unlocked.map(id => {
        const a = MM.ACHIEVEMENTS.find(x => x.id === id);
        return '<div class="unlock-item">' + (a ? a.icon : '🏆') + ' <b>' + t('result.unlocked') + ':</b> ' +
          t('ach.' + id + '.n') + '</div>';
      }).join('') + '</div>';
    }

    if (r.type === 'check') html += '<p class="small muted">' + t('result.checkNote') + '</p>';
    if (r.type === 'replay') html += '<p class="small muted">' + t('result.replayNote') + '</p>';

    html += '<div class="spacer"></div>' +
      '<button class="btn btn-primary" id="res-challenge">⚔️ ' + t('result.challengeBtn') + '</button>' +
      '<button class="btn" id="res-replay">🔄 ' + t('result.replay') + '</button>' +
      '<button class="btn btn-ghost" id="res-home">' + t('result.home') + '</button>' +
      '</div>';

    ui.mount(html, { nav: false });

    document.getElementById('res-home').addEventListener('click', () => MM.go('home'));
    document.getElementById('res-replay').addEventListener('click', () => {
      const rp = MM.engine.startReplay(r.id);
      if (rp) MM.go('quiz', { key: 'replay' });
    });
    document.getElementById('res-challenge').addEventListener('click', () => showChallengeCode(r));
  };

  function modeRecordTitle(r) {
    if (r.type === 'daily') return t('level.' + r.level);
    if (r.type === 'check') return t('check.title');
    if (r.type === 'challenge') return t('hist.challenge');
    if (r.type === 'replay') return t('hist.replay') + (r.level ? ' · ' + t('level.short.' + r.level) : '');
    return '';
  }

  /** Challenge-Code anzeigen. Der Code wird SYNCHRON vollständig erzeugt,
      BEVOR das Modal ihn anzeigt – keine Race Condition möglich. */
  function showChallengeCode(record) {
    const result = MM.engine.encodeChallenge(record, MM.Store.data.name);
    const code = result.code;
    const m = ui.modal(
      '<div class="modal-title">⚔️ ' + t('result.challengeTitle') + '</div>' +
      '<div class="modal-text">' + t('result.challengeHint') + '</div>' +
      '<div class="code-box" id="ch-code-box">' + U.esc(code) + '</div>' +
      '<div class="spacer"></div>' +
      '<button class="btn btn-primary" id="ch-copy">📋 ' + t('common.copy') + '</button>' +
      '<button class="btn btn-ghost" id="ch-close">' + t('common.close') + '</button>'
    );
    m.querySelector('#ch-close').addEventListener('click', ui.closeModal);
    m.querySelector('#ch-copy').addEventListener('click', async () => {
      const ok = await ui.copyText(code);
      if (ok) ui.toast(t('common.copied'));
    });
    ui.achToasts(result.unlocked);
  }
})();
