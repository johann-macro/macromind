/* ============================================================
   MacroMind – charts.js
   Fortschritts-Chart als reines SVG (keine externe Bibliothek).
   Drei Linien (Level 1–3) in EINEM Chart, Metrik: % korrekt,
   Granularität: Tag / Woche / Monat.
   ============================================================ */
window.MM = window.MM || {};

(function () {
  'use strict';
  const U = MM.util;

  const COLORS = { 1: '#22d3ee', 2: '#8b5cf6', 3: '#f59e0b' };

  /** Perioden-Schlüssel + Labels für die Zeitachse erzeugen */
  function periods(granularity) {
    const t = U.dateKey();
    const list = [];
    if (granularity === 'day') {
      for (let i = 13; i >= 0; i--) {
        const k = U.shiftKey(t, -i);
        const p = U.keyParts(k);
        list.push({ key: k, label: String(p.d).padStart(2, '0') + '.' + String(p.m).padStart(2, '0') + '.' });
      }
    } else if (granularity === 'week') {
      const seen = new Set();
      for (let i = 7 * 9; i >= 0; i--) {
        const k = U.shiftKey(t, -i);
        const wk = U.weekKey(k);
        if (!seen.has(wk)) {
          seen.add(wk);
          list.push({ key: wk, label: 'W' + wk.split('-W')[1] });
        }
      }
      while (list.length > 10) list.shift();
    } else {
      const months = MM.monthsShort();
      const p = U.keyParts(t);
      for (let i = 5; i >= 0; i--) {
        let m = p.m - i, y = p.y;
        while (m < 1) { m += 12; y--; }
        list.push({ key: y + '-' + String(m).padStart(2, '0'), label: months[m - 1] });
      }
    }
    return list;
  }

  /** dateKey einer Runde -> Perioden-Schlüssel */
  function periodOf(dateKey, granularity) {
    if (granularity === 'day') return dateKey;
    if (granularity === 'week') return U.weekKey(dateKey);
    return U.monthKey(dateKey);
  }

  /**
   * Serien berechnen: pro Level Array aus (0–100 | null) je Periode.
   * Basis: reguläre Tagesrunden.
   */
  function buildSeries(data, granularity) {
    const pers = periods(granularity);
    const idx = new Map(pers.map((p, i) => [p.key, i]));
    const agg = {};
    for (const lvl of [1, 2, 3]) {
      agg[lvl] = pers.map(() => ({ c: 0, n: 0 }));
    }
    let any = false;
    for (const r of data.rounds) {
      if (r.type !== 'daily') continue;
      const i = idx.get(periodOf(r.dateKey, granularity));
      if (i == null) continue;
      agg[r.level][i].c += r.score;
      agg[r.level][i].n += r.answers.length;
      any = true;
    }
    const series = {};
    for (const lvl of [1, 2, 3]) {
      series[lvl] = agg[lvl].map(a => (a.n > 0 ? Math.round(100 * a.c / a.n) : null));
    }
    return { periods: pers, series: series, hasData: any };
  }

  /** SVG-String für das Linien-Chart erzeugen */
  function renderChart(data, granularity) {
    const { periods: pers, series, hasData } = buildSeries(data, granularity);
    if (!hasData) return null;

    const W = 420, H = 230;
    const padL = 34, padR = 10, padT = 12, padB = 26;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const n = pers.length;
    const x = i => padL + (n === 1 ? plotW / 2 : (plotW * i) / (n - 1));
    const y = v => padT + plotH * (1 - v / 100);

    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">';

    // Gitterlinien + Y-Labels
    for (const val of [0, 25, 50, 75, 100]) {
      const yy = y(val);
      svg += '<line x1="' + padL + '" y1="' + yy + '" x2="' + (W - padR) + '" y2="' + yy +
        '" stroke="var(--border)" stroke-width="1"/>' +
        '<text x="' + (padL - 6) + '" y="' + (yy + 3.5) + '" text-anchor="end" font-size="9" fill="var(--muted)">' + val + '</text>';
    }

    // X-Labels (bei vielen Punkten nur jedes zweite)
    const step = n > 8 ? 2 : 1;
    for (let i = 0; i < n; i += step) {
      svg += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="9" fill="var(--muted)">' +
        pers[i].label + '</text>';
    }

    // Linien + Punkte pro Level
    for (const lvl of [1, 2, 3]) {
      const vals = series[lvl];
      let d = '', pen = false;
      for (let i = 0; i < n; i++) {
        if (vals[i] == null) { pen = false; continue; }
        d += (pen ? ' L ' : ' M ') + x(i).toFixed(1) + ' ' + y(vals[i]).toFixed(1);
        pen = true;
      }
      if (d) {
        svg += '<path d="' + d + '" fill="none" stroke="' + COLORS[lvl] +
          '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
      }
      for (let i = 0; i < n; i++) {
        if (vals[i] != null) {
          svg += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(vals[i]).toFixed(1) +
            '" r="3.2" fill="' + COLORS[lvl] + '"/>';
        }
      }
    }

    svg += '</svg>';
    return svg;
  }

  MM.charts = { renderChart: renderChart, COLORS: COLORS };
})();
