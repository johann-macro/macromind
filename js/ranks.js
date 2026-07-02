/* ============================================================
   MacroMind – ranks.js
   10 Ränge nach kumulativ korrekt beantworteten Fragen
   (nur reguläre Tagesrunden, Erstdurchläufe).
   Rang 1 und Rang 5 sind Running Gags – NIE ersetzen.
   ============================================================ */
window.MM = window.MM || {};

(function () {
  'use strict';

  // Bewusst OHNE Emojis – die Titel wirken allein über Farbe/Animation (CSS-Klassen)
  MM.RANKS = [
    { n: 1,  min: 0,    name: 'Praktikant ohne Kaffee-Skills', cls: 'rank-c1'  },
    { n: 2,  min: 20,   name: 'Verzweifelter Daytrader',       cls: 'rank-c2'  },
    { n: 3,  min: 50,   name: 'Mindestlohn-Justierer',         cls: 'rank-c3'  },
    { n: 4,  min: 100,  name: 'Excel-Anfänger',                cls: 'rank-c4'  },
    { n: 5,  min: 170,  name: 'Praktikant mit Visitenkarte',   cls: 'rank-c5'  },
    { n: 6,  min: 260,  name: 'Dubai-Influencer',              cls: 'rank-c6'  },
    { n: 7,  min: 380,  name: 'Junior Analyst',                cls: 'rank-c7'  },
    { n: 8,  min: 540,  name: 'Hedgefonds-Hoffnung',           cls: 'rank-c8'  },
    { n: 9,  min: 740,  name: 'Vice President',                cls: 'rank-c9'  },
    { n: 10, min: 1000, name: 'Wall-Street-Legende',           cls: 'rank-c10' }
  ];

  /** Rang-Objekt für kumulierte korrekte Antworten */
  MM.rankFor = function (correctTotal) {
    let r = MM.RANKS[0];
    for (const rank of MM.RANKS) {
      if (correctTotal >= rank.min) r = rank;
    }
    return r;
  };

  /** Nächster Rang oder null (wenn Maximum erreicht) */
  MM.nextRank = function (correctTotal) {
    for (const rank of MM.RANKS) {
      if (correctTotal < rank.min) return rank;
    }
    return null;
  };
})();
