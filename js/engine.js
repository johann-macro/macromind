/* ============================================================
   MacroMind – engine.js
   Spiellogik: tägliche Fragenauswahl (Rotation ohne Wiederholung,
   Tagesmix-Pflicht), Runden-Zustandsmaschine mit kontinuierlicher
   Persistenz (kein Fortschrittsverlust bei Navigation), EINE
   zentrale finishRound-Funktion für alle Modi, selbstenthaltene
   Challenge-Codes (kein asynchroner Speichervorgang nötig →
   Race Condition strukturell unmöglich), Wissens-Check-Auswahl,
   Achievements- und Rang-Auswertung.
   ============================================================ */
window.MM = window.MM || {};

(function () {
  'use strict';
  const U = MM.util;

  // Frage-Index (wird nach dem Laden der Datendateien aufgebaut)
  MM.qById = new Map();
  function buildIndex() {
    MM.qById.clear();
    for (const q of MM.QUESTIONS) MM.qById.set(q.id, q);
  }

  function S() { return MM.Store.data; }
  function save() { MM.Store.save(); }
  function today() { return U.dateKey(); }

  // ---------- Tägliche Fragenauswahl ----------

  function idsForLevel(level) {
    return MM.QUESTIONS.filter(q => q.level === level).map(q => q.id);
  }

  /**
   * Zieht 10 Fragen für ein Level aus der Rotation.
   * Tagesmix-Pflicht: mind. 1 Schätz-, 1 Definitions-, 1 Konzeptfrage
   * (sofern in der verbleibenden Rotation vorhanden).
   * Steckbrief-Fragen ('profile') sind bewusst selten: höchstens 1 pro Set.
   */
  function drawDailySet(data, level) {
    const all = idsForLevel(level);
    let rot = Array.isArray(data.rotation[level]) ? data.rotation[level] : U.shuffle(all);
    // Sicherheit: nur noch existierende IDs behalten (z. B. nach Pool-Updates)
    rot = rot.filter(id => MM.qById.has(id));
    // Pool erschöpft? Mit neu gemischten, nicht enthaltenen Fragen auffüllen
    if (rot.length < 10) {
      const inRot = new Set(rot);
      rot = rot.concat(U.shuffle(all.filter(id => !inRot.has(id))));
    }

    const picked = [];
    for (const type of ['est', 'def', 'concept']) {
      const idx = rot.findIndex(id => MM.qById.get(id).type === type && picked.indexOf(id) === -1);
      if (idx >= 0) picked.push(rot[idx]);
    }
    for (const id of rot) {
      if (picked.length >= 10) break;
      if (picked.indexOf(id) !== -1) continue;
      // Steckbrief-Fragen: höchstens eine pro Tages-Set
      if (MM.qById.get(id).type === 'profile' &&
          picked.some(p => MM.qById.get(p).type === 'profile')) continue;
      picked.push(id);
    }
    // Sicherheitsnetz: falls der Filter zu wenige übrig lässt, ohne Cap auffüllen
    for (const id of rot) {
      if (picked.length >= 10) break;
      if (picked.indexOf(id) === -1) picked.push(id);
    }

    data.rotation[level] = rot.filter(id => picked.indexOf(id) === -1);
    return U.shuffle(picked);
  }

  /** Heutiges 10er-Set für ein Level (lazy erzeugt, für den Tag stabil) */
  function ensureDailySet(data, level) {
    const key = today();
    if (!data.daily[key]) data.daily[key] = {};
    if (!Array.isArray(data.daily[key][level])) {
      data.daily[key][level] = drawDailySet(data, level);
      // alte Tage aufräumen (Historie bleibt vollständig in rounds erhalten)
      for (const k of Object.keys(data.daily)) {
        if (U.daysBetween(k, key) > 3) delete data.daily[k];
      }
      save();
    }
    return data.daily[key][level];
  }

  /** Manueller Reset der Rotation („Fragen aktualisieren") */
  function refreshQuestions() {
    const data = S();
    data.rotation = {};
    const key = today();
    if (data.daily[key]) delete data.daily[key];
    // laufende Tagesrunden verwerfen (im Bestätigungsdialog angekündigt)
    for (const k of ['d1', 'd2', 'd3']) delete data.inProgress[k];
    save();
  }

  // ---------- Runden-Zustandsmaschine ----------
  // Modi: 'daily' | 'check' | 'challenge' | 'replay'
  // inProgress-Schlüssel: d1/d2/d3 (daily), 'check', 'challenge', 'replay'

  function progressKey(mode, level) {
    return mode === 'daily' ? 'd' + level : mode;
  }

  /** Zufällige Antwort-Reihenfolge pro Frage (im Zustand gespeichert,
      damit Resume/Historie exakt dieselbe Darstellung zeigen) */
  function makePerms(qIds) {
    return qIds.map(id => {
      const n = MM.qById.get(id).o.length;
      return U.shuffle([...Array(n).keys()]);
    });
  }

  function newRoundState(mode, level, qIds, meta) {
    return {
      id: U.uuid(),
      mode: mode,
      level: level || 0,
      dateKey: today(),
      qIds: qIds,
      perms: makePerms(qIds),
      idx: 0,
      answers: [],          // { q, chosen (Original-Index), correct, ms }
      startedAt: Date.now(),
      shownAt: Date.now(),
      curStreak: 0,
      bestStreak: 0,
      meta: meta || {}
    };
  }

  /** Tagesrunde starten oder fortsetzen. Gibt {state, resumed} oder null zurück. */
  function startDaily(level) {
    const data = S();
    const key = progressKey('daily', level);
    if (data.inProgress[key]) {
      const st = data.inProgress[key];
      st.shownAt = Date.now();
      save();
      return { state: st, resumed: true };
    }
    if (completedDailyToday(level)) return null; // UI verhindert das bereits
    const qIds = ensureDailySet(data, level);
    const st = newRoundState('daily', level, qIds.slice());
    data.inProgress[key] = st;
    save();
    return { state: st, resumed: false };
  }

  function completedDailyToday(level) {
    const key = today();
    return S().rounds.some(r => r.type === 'daily' && r.level === level && r.dateKey === key);
  }

  function todayDailyRound(level) {
    const key = today();
    return S().rounds.find(r => r.type === 'daily' && r.level === level && r.dateKey === key) || null;
  }

  /** Wissens-Check-Runde bauen (Fragen aus der eigenen Historie,
      möglichst 1 Frage pro Tag, zeitgebundene Fragen weitgehend raus) */
  function startCheck() {
    const data = S();
    if (data.inProgress.check) {
      const st = data.inProgress.check;
      st.shownAt = Date.now();
      save();
      return { state: st, resumed: true };
    }
    const pool = buildCheckPool(data);
    if (pool.length === 0) return null;
    const picked = pool.slice(0, 10);
    const st = newRoundState('check', 0, picked.map(p => p.qid));
    st.meta.past = {};
    for (const p of picked) st.meta.past[p.qid] = p.info;
    data.inProgress.check = st;
    save();
    return { state: st, resumed: false };
  }

  /**
   * Spaced-Repetition-Auswahl für den Wissens-Check (pro Profil, abgeleitet
   * aus data.rounds – der Historie des eingeloggten Nutzers).
   * Priorität je Frage:
   *   +4  wenn die LETZTE Antwort falsch war (dringend wiederholen)
   *   +0–2 historische Fehlerquote (öfter falsch = öfter wiederholen)
   *   +0–2 Zeit seit der letzten Begegnung (Spacing: lange her = fällig)
   *   +0–0,5 Zufall (Abwechslung)
   * Antworten aus ALLEN Modi zählen als Lernsignal (auch Wissens-Check:
   * wer eine Frage dort richtig wiederholt hat, bekommt sie seltener).
   * Tages-Streuung bleibt als Zweitkriterium erhalten.
   */
  function buildCheckPool(data) {
    const tKey = today();
    // Lernstand je Frage aus der kompletten Historie ableiten
    // (rounds ist chronologisch → der letzte Eintrag gewinnt bei lastKey/lastCorrect)
    const learn = new Map(); // qid -> { right, wrong, lastKey, lastCorrect }
    for (const r of data.rounds) {
      for (const a of r.answers) {
        if (!MM.qById.has(a.q)) continue;
        let s = learn.get(a.q);
        if (!s) { s = { right: 0, wrong: 0, lastKey: r.dateKey, lastCorrect: a.correct }; learn.set(a.q, s); }
        if (a.correct) s.right++; else s.wrong++;
        s.lastKey = r.dateKey;
        s.lastCorrect = a.correct;
      }
    }

    let entries = [...learn.entries()].map(([qid, s]) => {
      const days = Math.max(0, U.daysBetween(s.lastKey, tKey));
      const errorRate = s.wrong / (s.wrong + s.right);
      let score = 2 * errorRate + Math.min(days / 7, 2) + Math.random() * 0.5;
      if (!s.lastCorrect) score += 4;
      // Heute bereits gesehenes Material dämpfen (kein Doppel-Drill am selben
      // Tag) – heutige FEHLER bleiben durch das +4 trotzdem klar vorn
      if (days < 1) score -= 3;
      return { qid, info: { correct: s.lastCorrect, dateKey: s.lastKey }, score: score };
    });

    // Zeitgebundene Fragen weitgehend ausschließen (lieber zu wenige als zu viele)
    const evergreen = entries.filter(e => !MM.qById.get(e.qid).asOf);
    if (evergreen.length >= 10) entries = evergreen;

    entries.sort((a, b) => b.score - a.score);

    // 1. Durchgang: höchste Priorität, aber möglichst verschiedene Tage;
    // 2. Durchgang: verbleibende Plätze rein nach Priorität auffüllen
    const picked = [];
    const usedDays = new Set();
    for (const e of entries) {
      if (picked.length >= 10) break;
      if (usedDays.has(e.info.dateKey)) continue;
      usedDays.add(e.info.dateKey);
      picked.push(e);
    }
    for (const e of entries) {
      if (picked.length >= 10) break;
      if (picked.indexOf(e) === -1) picked.push(e);
    }
    return picked;
  }

  function canCheck() {
    return S().rounds.some(r => r.type === 'daily');
  }

  /** Wiederholungsrunde: referenziert IMMER die konkret gewählte Runde per ID
      (nie eine Listen-Position → Sortierungs-Bug strukturell unmöglich) */
  function startReplay(roundId) {
    const data = S();
    const src = data.rounds.find(r => r.id === roundId);
    if (!src) return null;
    const qIds = src.qIds.filter(id => MM.qById.has(id));
    if (qIds.length === 0) return null;
    const st = newRoundState('replay', src.level || 0, qIds.slice());
    st.meta.refRoundId = src.id;
    st.meta.refType = src.type;
    data.inProgress.replay = st; // Replay ersetzt ggf. ein altes angefangenes Replay
    save();
    return { state: st, resumed: false };
  }

  /** Challenge-Runde aus dekodiertem Code starten */
  function startChallenge(payload) {
    const data = S();
    const st = newRoundState('challenge', payload.l || 0, payload.q.slice());
    st.meta.challenger = { name: payload.n, score: payload.s, bits: payload.a };
    data.inProgress.challenge = st;
    save();
    return { state: st, resumed: false };
  }

  function resumeState(key) {
    const st = S().inProgress[key];
    if (st) {
      // Falls die aktuelle Frage schon beantwortet wurde (Verlassen vor
      // „Weiter"): zur nächsten unbeantworteten Frage springen. Verhindert
      // Doppel-Antworten und das Anschauen bereits beantworteter Fragen.
      if (st.idx < st.answers.length) st.idx = st.answers.length;
      st.shownAt = Date.now();
      save();
    }
    return st || null;
  }

  /**
   * Antwort verarbeiten. displayedIdx ist der Index in der ANGEZEIGTEN
   * (permutierten) Reihenfolge; intern wird der Original-Index gespeichert.
   * Persistiert sofort → Fortschritt kann nie verloren gehen.
   */
  function answer(state, displayedIdx) {
    const data = S();
    const qid = state.qIds[state.idx];
    const q = MM.qById.get(qid);
    const originalIdx = state.perms[state.idx][displayedIdx];
    const correct = originalIdx === q.c;
    const ms = Math.max(0, Math.min(Date.now() - state.shownAt, 10 * 60 * 1000));

    state.answers.push({ q: qid, chosen: originalIdx, correct: correct, ms: ms });
    if (correct) {
      state.curStreak++;
      state.bestStreak = Math.max(state.bestStreak, state.curStreak);
    } else {
      state.curStreak = 0;
    }

    // Globale Antwort-Serie (nur reguläre Tagesrunden)
    let unlocked = [];
    if (state.mode === 'daily') {
      const c = data.counters;
      if (correct) {
        c.answerStreakCur++;
        c.answerStreakBest = Math.max(c.answerStreakBest, c.answerStreakCur);
      } else {
        c.answerStreakCur = 0;
      }
      unlocked = evaluateAchievements(data);
    }

    save();
    return { correct: correct, originalIdx: originalIdx, unlocked: unlocked };
  }

  /** Zur nächsten Frage weiterschalten (persistiert Position) */
  function advance(state) {
    state.idx++;
    state.shownAt = Date.now();
    save();
  }

  /**
   * ZENTRALE Abschlussfunktion für ALLE Modi (daily/check/challenge/replay).
   * Erstellt den Historieneintrag, wertet Achievements & Rang aus,
   * räumt den inProgress-Zustand auf. Ein einziger Codepfad – kein
   * Monkey-Patching, keine Duplikate.
   */
  function finishRound(state) {
    const data = S();
    const score = state.answers.filter(a => a.correct).length;
    const durationMs = state.answers.reduce((s, a) => s + a.ms, 0);
    const rankBefore = MM.rankFor(computeStats(data).correctDaily);

    const record = {
      id: state.id,
      type: state.mode,        // 'daily' | 'check' | 'challenge' | 'replay'
      level: state.level || 0,
      dateKey: today(),        // Abschlusstag (Berlin)
      finishedAt: new Date().toISOString(),
      qIds: state.qIds.slice(),
      perms: state.perms,
      answers: state.answers.slice(),
      score: score,
      total: state.qIds.length,
      durationMs: durationMs,
      bestStreak: state.bestStreak
    };

    // Modus-spezifische Abschlusslogik
    if (state.mode === 'challenge') {
      const ch = state.meta.challenger || {};
      record.challenger = { name: ch.name, score: ch.score, bits: ch.bits };
      record.outcome = score > ch.score ? 'win' : (score === ch.score ? 'draw' : 'lose');
      // Gespielte Fragen aus der Rotation nehmen → tauchen später nicht doppelt auf
      const played = new Set(state.qIds);
      for (const lvl of [1, 2, 3]) {
        if (Array.isArray(data.rotation[lvl])) {
          data.rotation[lvl] = data.rotation[lvl].filter(id => !played.has(id));
        }
      }
    }
    if (state.mode === 'check') {
      record.past = state.meta.past || {};
    }
    if (state.mode === 'replay') {
      record.refRoundId = state.meta.refRoundId || null;
      record.refType = state.meta.refType || null;
    }

    data.rounds.push(record);
    delete data.inProgress[progressKey(state.mode, state.level)];

    const unlocked = evaluateAchievements(data);
    const rankAfter = MM.rankFor(computeStats(data).correctDaily);
    const rankUp = rankAfter.n > rankBefore.n ? rankAfter : null;

    save();
    return { record: record, unlocked: unlocked, rankUp: rankUp };
  }

  // ---------- Challenge-Codes (selbstenthaltend, synchron) ----------

  function encodeChallenge(record, senderName) {
    const payload = {
      v: 1,
      n: String(senderName).slice(0, 20),
      l: record.level || 0,
      q: record.qIds,
      s: record.score,
      a: record.answers.map(a => (a.correct ? '1' : '0')).join(''),
      d: record.dateKey
    };
    const json = JSON.stringify(payload);
    // Zähler für das Achievement „Herausforderer"
    const data = S();
    data.counters.challengesSent++;
    const unlocked = evaluateAchievements(data);
    save();
    return {
      code: 'MMC1.' + U.b64urlEncode(json) + '.' + U.checksum(json),
      unlocked: unlocked
    };
  }

  function decodeChallenge(code) {
    try {
      const parts = String(code).trim().split('.');
      if (parts.length !== 3 || parts[0] !== 'MMC1') return null;
      const json = U.b64urlDecode(parts[1]);
      if (U.checksum(json) !== parts[2]) return null;
      const p = JSON.parse(json);
      if (!p || !Array.isArray(p.q) || p.q.length === 0) return null;
      if (typeof p.s !== 'number' || p.s < 0 || p.s > p.q.length) return null;
      // Alle Fragen müssen in dieser App-Version existieren
      for (const id of p.q) {
        if (!MM.qById.has(id)) return null;
      }
      return p;
    } catch (e) {
      return null;
    }
  }

  // ---------- Statistik & Achievements ----------

  /** Abgeleitete Statistiken – rounds-Array ist die einzige Quelle der Wahrheit */
  function computeStats(data) {
    let answeredAll = 0, answeredDaily = 0, correctDaily = 0;
    let hasPerfect = false, hasSolid = false, hasDisaster = false, hasSpeed = false;
    let checkRounds = 0, challengesWon = 0, roundsTotal = 0;
    const levelDaySets = { 1: new Set(), 2: new Set(), 3: new Set() };
    const dailyDays = new Set();
    const levelsByDay = new Map();

    for (const r of data.rounds) {
      roundsTotal++;
      answeredAll += r.answers.length;
      if (r.type === 'daily') {
        answeredDaily += r.answers.length;
        correctDaily += r.score;
        dailyDays.add(r.dateKey);
        if (levelDaySets[r.level]) levelDaySets[r.level].add(r.dateKey);
        if (!levelsByDay.has(r.dateKey)) levelsByDay.set(r.dateKey, new Set());
        levelsByDay.get(r.dateKey).add(r.level);
        if (r.total === 10) {
          if (r.score === 10) hasPerfect = true;
          if (r.score >= 5) hasSolid = true;
          if (r.score === 0) hasDisaster = true;
          if (r.durationMs < 150000 && r.score >= 7) hasSpeed = true;
        }
      }
      if (r.type === 'check') checkRounds++;
      if (r.type === 'challenge' && r.outcome === 'win') challengesWon++;
    }

    // Laufende Runden zählen bei "insgesamt beantwortet" mit, damit z. B.
    // „Erste Frage beantwortet" sofort freigeschaltet wird (nicht erst am Rundenende)
    for (const key in data.inProgress) {
      const st = data.inProgress[key];
      if (st && Array.isArray(st.answers)) answeredAll += st.answers.length;
    }

    let allThreeOneDay = false;
    for (const set of levelsByDay.values()) {
      if (set.has(1) && set.has(2) && set.has(3)) { allThreeOneDay = true; break; }
    }

    // Tages-Serien (Berlin-Kalendertage)
    const tKey = today();
    let cur = 0;
    let start = dailyDays.has(tKey) ? tKey : U.shiftKey(tKey, -1);
    let k = start;
    while (dailyDays.has(k)) { cur++; k = U.shiftKey(k, -1); }
    let best = 0, run = 0, prev = null;
    for (const d of [...dailyDays].sort()) {
      run = (prev !== null && U.daysBetween(prev, d) === 1) ? run + 1 : 1;
      if (run > best) best = run;
      prev = d;
    }

    return {
      answeredAll: answeredAll,
      answeredDaily: answeredDaily,
      correctDaily: correctDaily,
      hitrate: answeredDaily > 0 ? Math.round(100 * correctDaily / answeredDaily) : 0,
      hasPerfect, hasSolid, hasDisaster, hasSpeed,
      checkRounds: checkRounds,
      challengesWon: challengesWon,
      challengesSent: data.counters.challengesSent || 0,
      bestAnswerStreak: data.counters.answerStreakBest || 0,
      dayStreak: cur,
      bestDayStreak: best,
      levelDays: { 1: levelDaySets[1].size, 2: levelDaySets[2].size, 3: levelDaySets[3].size },
      allThreeOneDay: allThreeOneDay,
      roundsTotal: roundsTotal,
      rankN: MM.rankFor(correctDaily).n
    };
  }

  /**
   * Trefferquote je Themengebiet (pro Profil, nur reguläre Tagesrunden –
   * konsistent mit Profil-Statistik und Fortschritts-Chart).
   * Ergebnis absteigend nach Quote sortiert (Stärken oben, Schwächen unten).
   */
  function computeTopicStats(data) {
    const agg = new Map(); // topic -> { answered, correct }
    for (const r of data.rounds) {
      if (r.type !== 'daily') continue;
      for (const a of r.answers) {
        const q = MM.qById.get(a.q);
        if (!q) continue;
        const topic = q.topic || 'other';
        let s = agg.get(topic);
        if (!s) { s = { answered: 0, correct: 0 }; agg.set(topic, s); }
        s.answered++;
        if (a.correct) s.correct++;
      }
    }
    return [...agg.entries()]
      .map(([topic, s]) => ({
        topic: topic,
        answered: s.answered,
        correct: s.correct,
        pct: Math.round(100 * s.correct / s.answered)
      }))
      .sort((a, b) => b.pct - a.pct || b.answered - a.answered);
  }

  /**
   * Fragen-Vorrat pro Level (pro Profil): Wie viele Fragen hat der Nutzer
   * noch NIE beantwortet? Abgeleitet aus data.rounds (Quelle der Wahrheit,
   * unabhängig von der Rotationsliste). days = volle Tage mit komplett
   * neuen 10er-Sets. minDays = Engpass über alle Level.
   */
  function computePoolStatus(data) {
    const seen = { 1: new Set(), 2: new Set(), 3: new Set() };
    for (const r of data.rounds) {
      if (r.type !== 'daily') continue;
      if (!seen[r.level]) continue;
      for (const a of r.answers) seen[r.level].add(a.q);
    }
    const status = { levels: {}, minDays: Infinity };
    for (const lvl of [1, 2, 3]) {
      const total = idsForLevel(lvl).length;
      let seenCount = 0;
      for (const id of seen[lvl]) {
        if (MM.qById.has(id)) seenCount++;
      }
      const fresh = Math.max(0, total - seenCount);
      const days = Math.floor(fresh / 10);
      status.levels[lvl] = { total: total, fresh: fresh, days: days };
      if (days < status.minDays) status.minDays = days;
    }
    return status;
  }

  /** Neue Achievements freischalten; gibt Liste der neuen IDs zurück */
  function evaluateAchievements(data) {
    const stats = computeStats(data);
    const fresh = [];
    for (const a of MM.ACHIEVEMENTS) {
      if (!data.ach[a.id] && a.cond(stats)) {
        data.ach[a.id] = today();
        fresh.push(a.id);
      }
    }
    return fresh;
  }

  MM.engine = {
    buildIndex,
    ensureDailySet, refreshQuestions,
    startDaily, startCheck, startReplay, startChallenge, resumeState,
    completedDailyToday, todayDailyRound, canCheck,
    answer, advance, finishRound,
    encodeChallenge, decodeChallenge,
    computeStats, computeTopicStats, computePoolStatus, evaluateAchievements,
    progressKey
  };
})();
