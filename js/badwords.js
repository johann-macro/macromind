/* ============================================================
   MacroMind – badwords.js
   Namensvalidierung: erlaubte Zeichen, Sperrliste inkl.
   Leetspeak-Normalisierung. Bekannte Persönlichkeiten des
   öffentlichen Lebens sind erlaubt (z. B. Putin, Trump),
   NS-Größen und Beleidigungen sind gesperrt.
   ============================================================ */
window.MM = window.MM || {};

(function () {
  'use strict';

  // Erlaubte Zeichen: Buchstaben (inkl. Umlaute/Akzente), Zahlen, Leerzeichen,
  // gängige Sonderzeichen – ausdrücklich KEINE Frage-/Ausrufezeichen.
  const NAME_RE = /^[\p{L}\p{N} .,\-_'"()&+*#@€$%:;~^°]{3,20}$/u;
  const FORBIDDEN_CHARS_RE = /[?!¿¡]/;

  // Sperrliste: Beleidigungen (DE/EN/PL/RO) + extrem problematische historische Figuren.
  // Wird gegen den NORMALISIERTEN Namen (Leetspeak aufgelöst, Trennzeichen entfernt) geprüft.
  const BLOCKLIST = [
    // NS-Größen (explizit laut Spezifikation gesperrt)
    'hitler', 'adolfh', 'himmler', 'goebbels', 'gobbels', 'goring', 'goering',
    'eichmann', 'mengele', 'heydrich', 'bormann', 'kaltenbrunner', 'ribbentrop',
    'nazi', 'schutzstaffel', 'waffenss', 'reichsfuhrer', 'sieg heil'.replace(' ', ''),
    'heilhitler', 'hakenkreuz', 'swastika', '1488', 'blut und ehre'.replace(/ /g, ''),
    // Deutsch
    'arschloch', 'hurensohn', 'hurenson', 'wichser', 'fotze', 'missgeburt',
    'schlampe', 'drecksau', 'bastard', 'spast', 'mongo', 'untermensch',
    'judensau', 'kanake', 'neger', 'zigeuner',
    // Englisch
    'fuck', 'bitch', 'cunt', 'nigger', 'nigga', 'faggot', 'fagot', 'retard',
    'whore', 'slut', 'asshole', 'dickhead', 'cocksucker', 'motherfucker',
    'rapist', 'pedo', 'paedo',
    // Polnisch
    'kurwa', 'chuj', 'huj', 'pizda', 'jebac', 'jebany', 'spierdalaj',
    'cipa', 'skurwysyn', 'debil', 'pierdol',
    // Rumänisch
    'pula', 'muie', 'pizda', 'curva', 'futu', 'futui', 'sugi', 'bagamias',
    'dracului', 'jigodie'
  ];

  // Leetspeak-/Umgehungs-Normalisierung
  const LEET_MAP = {
    '0': 'o', '1': 'i', '2': 'z', '3': 'e', '4': 'a', '5': 's',
    '6': 'g', '7': 't', '8': 'b', '9': 'g',
    '@': 'a', '$': 's', '€': 'e', '+': 't', '(': 'c', ')': '',
    'ä': 'a', 'ö': 'o', 'ü': 'u', 'ß': 'ss',
    'á': 'a', 'à': 'a', 'â': 'a', 'ã': 'a', 'å': 'a', 'ă': 'a', 'ą': 'a',
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e', 'ę': 'e',
    'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
    'ó': 'o', 'ò': 'o', 'ô': 'o', 'õ': 'o', 'ø': 'o',
    'ú': 'u', 'ù': 'u', 'û': 'u',
    'ç': 'c', 'ć': 'c', 'č': 'c',
    'ñ': 'n', 'ń': 'n',
    'ś': 's', 'ş': 's', 'ș': 's', 'š': 's',
    'ț': 't', 'ţ': 't',
    'ź': 'z', 'ż': 'z', 'ž': 'z',
    'ł': 'l', 'ý': 'y'
  };

  function normalize(name) {
    let s = String(name).toLowerCase();
    let out = '';
    for (const ch of s) {
      if (LEET_MAP.hasOwnProperty(ch)) out += LEET_MAP[ch];
      else if (/[a-z]/.test(ch)) out += ch;
      // alles andere (Leerzeichen, Punkte, Bindestriche …) entfernen
    }
    return out;
  }

  /** Entfernt direkt aufeinanderfolgende Buchstaben-Dopplungen: "hiitler" -> "hitler" */
  function collapseRepeats(s) {
    let out = '';
    for (let i = 0; i < s.length; i++) {
      if (s[i] !== s[i - 1]) out += s[i];
    }
    return out;
  }

  /**
   * Prüft einen Anzeigenamen.
   * @returns {{ ok: boolean, reason?: 'length'|'chars'|'blocked' }}
   */
  function validateName(name) {
    const trimmed = String(name || '').trim();
    if (trimmed.length < 3 || trimmed.length > 20) return { ok: false, reason: 'length' };
    if (FORBIDDEN_CHARS_RE.test(trimmed)) return { ok: false, reason: 'chars' };
    if (!NAME_RE.test(trimmed)) return { ok: false, reason: 'chars' };

    const norm = normalize(trimmed);
    const collapsed = collapseRepeats(norm);
    for (const bad of BLOCKLIST) {
      if (norm.includes(bad) || collapsed.includes(bad)) {
        return { ok: false, reason: 'blocked' };
      }
    }
    return { ok: true };
  }

  MM.names = { validateName, normalize };
})();
