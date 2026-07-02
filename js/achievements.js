/* ============================================================
   MacroMind – achievements.js
   28 Erfolge. Namen/Beschreibungen kommen aus i18n
   (Schlüssel: ach.<id>.n und ach.<id>.d).
   cond(stats) wird zentral von der Engine ausgewertet.
   ============================================================ */
window.MM = window.MM || {};

(function () {
  'use strict';

  MM.ACHIEVEMENTS = [
    // Erste Schritte & Mengen-Meilensteine (alle Modi zählen bei "beantwortet")
    { id: 'first-answer',   icon: '🎬', cond: s => s.answeredAll >= 1 },
    { id: 'answered-50',    icon: '✍️', cond: s => s.answeredAll >= 50 },
    { id: 'answered-250',   icon: '📚', cond: s => s.answeredAll >= 250 },
    { id: 'answered-1000',  icon: '🪑', cond: s => s.answeredAll >= 1000 },

    // Korrekt-Meilensteine (nur reguläre Tagesrunden)
    { id: 'correct-5',      icon: '✅', cond: s => s.correctDaily >= 5 },
    { id: 'correct-50',     icon: '🧠', cond: s => s.correctDaily >= 50 },
    { id: 'correct-200',    icon: '📖', cond: s => s.correctDaily >= 200 },
    { id: 'correct-500',    icon: '🎓', cond: s => s.correctDaily >= 500 },

    // Runden-Erfolge (nur Erstdurchläufe von Tagesrunden)
    { id: 'perfect-round',  icon: '💯', cond: s => s.hasPerfect },
    { id: 'solid-round',    icon: '👍', cond: s => s.hasSolid },
    { id: 'disaster-round', icon: '🔥', cond: s => s.hasDisaster },
    { id: 'speed-round',    icon: '⏱️', cond: s => s.hasSpeed },

    // Antwort-Serien (richtige Antworten in Folge, Tagesrunden)
    { id: 'streak-5',       icon: '⚡', cond: s => s.bestAnswerStreak >= 5 },
    { id: 'streak-10',      icon: '🌊', cond: s => s.bestAnswerStreak >= 10 },
    { id: 'streak-20',      icon: '🤖', cond: s => s.bestAnswerStreak >= 20 },

    // Tages-Serien
    { id: 'days-3',         icon: '📅', cond: s => s.bestDayStreak >= 3 },
    { id: 'days-7',         icon: '🗓️', cond: s => s.bestDayStreak >= 7 },
    { id: 'days-30',        icon: '🏛️', cond: s => s.bestDayStreak >= 30 },

    // Level-Erfolge
    { id: 'level1-5days',   icon: '🧱', cond: s => (s.levelDays[1] || 0) >= 5 },
    { id: 'level2-5days',   icon: '🪜', cond: s => (s.levelDays[2] || 0) >= 5 },
    { id: 'level3-5days',   icon: '🔬', cond: s => (s.levelDays[3] || 0) >= 5 },
    { id: 'allrounder',     icon: '🎯', cond: s => s.allThreeOneDay },

    // Modi & Social
    { id: 'first-check',    icon: '🔁', cond: s => s.checkRounds >= 1 },
    { id: 'first-challenge',icon: '⚔️', cond: s => s.challengesSent >= 1 },
    { id: 'challenge-win',  icon: '🏆', cond: s => s.challengesWon >= 1 },

    // Rang-Meilensteine
    { id: 'rank-5',         icon: '💳', cond: s => s.rankN >= 5 },
    { id: 'rank-8',         icon: '🦈', cond: s => s.rankN >= 8 },
    { id: 'rank-10',        icon: '🚀', cond: s => s.rankN >= 10 }
  ];
})();
