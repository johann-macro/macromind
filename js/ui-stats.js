/* ============================================================
   MacroMind – ui-stats.js
   Fortschritts-Chart (Tag/Woche/Monat, 3 Level-Linien in einem
   Chart) + Statistik-Kacheln.
   ============================================================ */
window.MM = window.MM || {};

(function () {
  'use strict';
  const t = (k, p) => MM.t(k, p);
  const ui = MM.ui;

  let granularity = 'week';

  MM.views.stats = function () {
    const data = MM.Store.data;
    const stats = MM.engine.computeStats(data);
    const chartSvg = MM.charts.renderChart(data, granularity);

    let html = ui.topbar() + '<div class="page">' +
      '<div class="page-title glow">' + t('stats.title') + '</div>' +
      '<div class="seg-control">' +
      [['week', 'stats.week'], ['month', 'stats.month'], ['year', 'stats.year']].map(g =>
        '<button class="seg-btn' + (granularity === g[0] ? ' active' : '') + '" data-gran="' + g[0] + '">' +
        t(g[1]) + '</button>'
      ).join('') + '</div>';

    html += '<div class="card chart-card">' +
      '<div class="section-label" style="margin:0 8px 8px">' + t('stats.chartTitle') + '</div>';
    if (chartSvg) {
      html += chartSvg +
        '<div class="chart-legend">' +
        [1, 2, 3].map(l =>
          '<span class="legend-item"><span class="legend-dot" style="background:' + MM.charts.COLORS[l] + '"></span>' +
          t('level.short.' + l) + '</span>'
        ).join('') + '</div>';
    } else {
      html += '<div class="chart-empty">📈<br>' + t('stats.empty') + '</div>';
    }
    html += '</div>';

    html += '<div class="stat-grid">' +
      statTile(stats.answeredDaily, t('stats.totalQ')) +
      statTile(stats.hitrate + '%', t('stats.hitrate')) +
      statTile(stats.roundsTotal, t('stats.rounds')) +
      statTile('🔥 ' + stats.bestAnswerStreak, t('stats.bestStreak')) +
      '</div>';

    // Themen-Analyse: Trefferquote je Themengebiet (pro Profil)
    const topics = MM.engine.computeTopicStats(data);
    if (topics.length > 0) {
      html += '<div class="section-label">' + t('stats.topics') + '</div>';
      html += topics.map(tp => {
        const cls = ui.scoreClass(tp.correct, tp.answered);
        return '<div class="topic-row">' +
          '<div class="topic-head">' +
          '<span class="topic-name">' + topicLabel(tp.topic) + '</span>' +
          '<span class="topic-meta">' +
          (tp.answered === 1 ? t('stats.nQuestion1') : t('stats.nQuestions', { n: tp.answered })) +
          ' · <b class="tp-' + cls + '">' + tp.pct + '%</b></span>' +
          '</div>' +
          '<div class="topic-bar"><div class="tb-' + cls + '" style="width:' + tp.pct + '%"></div></div>' +
          '</div>';
      }).join('');
    }

    html += '</div>';

    ui.mount(html, { active: 'stats' });

    document.querySelectorAll('[data-gran]').forEach(btn => {
      btn.addEventListener('click', () => {
        granularity = btn.getAttribute('data-gran');
        MM.go('stats');
      });
    });
  };

  function statTile(val, label) {
    return '<div class="stat-tile"><div class="st-val">' + val + '</div>' +
      '<div class="st-label">' + label + '</div></div>';
  }

  /** Übersetztes Themen-Label; unbekannte Topics erscheinen als Rohwert */
  function topicLabel(topic) {
    const key = 'topic.' + topic;
    const s = t(key);
    return s === key ? topic : s;
  }
})();
