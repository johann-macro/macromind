/* ============================================================
   MacroMind – ui-profile.js
   Profil: Name (änderbar mit Validierung), Rang mit vollem
   visuellem Effekt, Statistiken (nur Tagesrunden!), Rang-
   Übersicht und Achievements.
   ============================================================ */
window.MM = window.MM || {};

(function () {
  'use strict';
  const U = MM.util;
  const t = (k, p) => MM.t(k, p);
  const ui = MM.ui;

  MM.views.profile = function () {
    const data = MM.Store.data;
    const stats = MM.engine.computeStats(data);
    const rank = MM.rankFor(stats.correctDaily);
    const next = MM.nextRank(stats.correctDaily);
    const initials = data.name.trim().slice(0, 2).toUpperCase();

    let html = ui.topbar() + '<div class="page">';

    // Kopf
    html += '<div class="profile-head">' +
      '<div class="avatar">' + U.esc(initials) + '</div>' +
      '<div class="profile-name-row">' +
      '<span class="profile-name">' + U.esc(data.name) + '</span>' +
      '<button class="edit-btn" id="edit-name" aria-label="' + t('profile.editName') + '">✏️</button>' +
      '</div>' +
      (MM.Store.isGuest() ? '<span class="guest-tag">' + t('profile.guest') + '</span>' : '') +
      '<div style="margin-top:12px">' + ui.rankBadge(rank, true) + '</div>' +
      '</div>';

    // Rang-Fortschritt
    if (next) {
      const span = next.min - rank.min;
      const done = stats.correctDaily - rank.min;
      html += '<div class="card rank-progress">' +
        '<div class="rank-progress-bar"><div style="width:' + Math.round(100 * done / span) + '%"></div></div>' +
        '<div class="rank-progress-label">' +
        t('profile.nextRank', { n: next.min - stats.correctDaily, rank: next.name }) + '</div></div>';
    } else {
      html += '<div class="card rank-progress"><div class="rank-progress-label">🎉 ' + t('profile.maxRank') + '</div></div>';
    }

    // Statistiken (nur reguläre Tagesrunden)
    html += '<div class="stat-grid">' +
      tile(stats.answeredDaily, t('profile.answered')) +
      tile(stats.hitrate + '%', t('profile.hitrate')) +
      tile(stats.correctDaily, t('profile.correct')) +
      tile('🔥 ' + stats.dayStreak, t('profile.dayStreak')) +
      '</div>';

    // Alle Ränge
    html += '<div class="section-label">' + t('profile.ranks') + '</div>';
    html += MM.RANKS.map(rk => {
      const reached = stats.correctDaily >= rk.min;
      const current = rk.n === rank.n;
      // Farbklasse IMMER anwenden – gesperrte Ränge zeigen Farbe/Animation
      // gedämpft durch .locked (Graustufen + Transparenz), ohne Emojis
      return '<div class="rank-row' + (reached ? '' : ' locked') + (current ? ' current' : '') + '">' +
        '<span class="rank-num">' + (reached ? rk.n : '🔒') + '</span>' +
        '<span class="rank-name ' + rk.cls + '">' + U.esc(rk.name) + '</span>' +
        '<span class="rank-req">' + t('profile.correctLabel', { n: rk.min }) + '</span>' +
        '</div>';
    }).join('');

    // Achievements
    const unlockedCount = Object.keys(data.ach).length;
    html += '<div class="section-label">' + t('profile.achievements') + ' (' + unlockedCount + '/' + MM.ACHIEVEMENTS.length + ')</div>';
    html += '<div class="ach-grid">' + MM.ACHIEVEMENTS.map(a => {
      const unlockedAt = data.ach[a.id];
      return '<div class="ach-tile' + (unlockedAt ? '' : ' locked') + '">' +
        '<div class="ach-ico">' + (unlockedAt ? a.icon : '🔒') + '</div>' +
        '<div class="ach-name">' + t('ach.' + a.id + '.n') + '</div>' +
        '<div class="ach-desc">' + t('ach.' + a.id + '.d') + '</div>' +
        (unlockedAt ? '<div class="ach-date">' + t('profile.unlockedAt', { date: U.fmtDate(unlockedAt) }) + '</div>' : '') +
        '</div>';
    }).join('') + '</div>';

    html += '</div>';
    ui.mount(html, { active: 'profile' });

    document.getElementById('edit-name').addEventListener('click', editNameModal);
  };

  function tile(val, label) {
    return '<div class="stat-tile"><div class="st-val">' + val + '</div>' +
      '<div class="st-label">' + label + '</div></div>';
  }

  function editNameModal() {
    const data = MM.Store.data;
    const m = ui.modal(
      '<div class="modal-title">' + t('profile.editName') + '</div>' +
      '<div class="field"><label>' + t('profile.nameLabel') + '</label>' +
      '<input class="input" id="name-input" maxlength="20" value="' + U.esc(data.name) + '"></div>' +
      '<p class="small muted" style="margin-top:8px">' + t('profile.nameRules') + '</p>' +
      '<div class="form-error" id="name-error"></div>' +
      '<button class="btn btn-primary" id="name-save">' + t('common.save') + '</button>' +
      '<button class="btn btn-ghost" id="name-cancel">' + t('common.cancel') + '</button>'
    );
    m.querySelector('#name-cancel').addEventListener('click', ui.closeModal);
    m.querySelector('#name-save').addEventListener('click', () => {
      const val = m.querySelector('#name-input').value.trim();
      const check = MM.names.validateName(val);
      if (!check.ok) {
        m.querySelector('#name-error').textContent = t('profile.err.' + check.reason);
        return;
      }
      data.name = val;
      MM.Store.save();
      ui.closeModal();
      MM.go('profile');
    });
  }
})();
