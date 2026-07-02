/* ============================================================
   MacroMind – util.js
   Zentrale Utilities. WICHTIG: Alle Datums-/Tagesberechnungen
   der App laufen ausschließlich über MM.util.dateKey() bzw. die
   Berlin-Funktionen hier – niemals über lokale Systemzeit oder
   UTC direkt (vermeidet den Zeitzonen-Bug der Vorversionen).
   ============================================================ */
window.MM = window.MM || {};

(function () {
  'use strict';

  // --- Europe/Berlin Zeitzone (inkl. automatischer CET/CEST-Umstellung) ---
  const berlinFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });

  /** Kalendertag in Berlin als "YYYY-MM-DD" */
  function dateKey(d) {
    return berlinFmt.format(d || new Date());
  }

  /** dateKey -> {y, m, d} (Zahlen) */
  function keyParts(key) {
    const [y, m, d] = key.split('-').map(Number);
    return { y, m, d };
  }

  /** Differenz in Kalendertagen zwischen zwei dateKeys (b - a) */
  function daysBetween(a, b) {
    const pa = keyParts(a), pb = keyParts(b);
    const ua = Date.UTC(pa.y, pa.m - 1, pa.d);
    const ub = Date.UTC(pb.y, pb.m - 1, pb.d);
    return Math.round((ub - ua) / 86400000);
  }

  /** dateKey um n Tage verschieben */
  function shiftKey(key, n) {
    const p = keyParts(key);
    const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
    return dt.toISOString().slice(0, 10);
  }

  /** ISO-Wochen-Key "2026-W27" für einen dateKey */
  function weekKey(key) {
    const p = keyParts(key);
    const dt = new Date(Date.UTC(p.y, p.m - 1, p.d));
    const dayNum = (dt.getUTCDay() + 6) % 7; // Mo=0..So=6
    dt.setUTCDate(dt.getUTCDate() - dayNum + 3); // Donnerstag der Woche
    const isoYear = dt.getUTCFullYear();
    const jan4 = new Date(Date.UTC(isoYear, 0, 4));
    const week = 1 + Math.round(((dt - jan4) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
    return isoYear + '-W' + String(week).padStart(2, '0');
  }

  /** Monats-Key "2026-07" */
  function monthKey(key) { return key.slice(0, 7); }

  /** dateKey -> "01.07.2026" */
  function fmtDate(key) {
    if (!key) return '';
    const p = keyParts(key);
    return String(p.d).padStart(2, '0') + '.' + String(p.m).padStart(2, '0') + '.' + p.y;
  }

  /** "2025-11" oder "2025-11-15" -> "Stand: 11/2025" bzw. "Stand: 15.11.2025" */
  function fmtAsOf(asOf) {
    if (!asOf) return '';
    const parts = asOf.split('-');
    if (parts.length >= 3) return fmtDate(asOf);
    if (parts.length === 2) return parts[1] + '/' + parts[0];
    return parts[0];
  }

  function fmtDuration(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
  }

  // --- Sonstige Helfer ---
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  // --- Base64url für UTF-8-Strings (Challenge-Codes, Sync-Codes) ---
  function b64urlEncode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64urlDecode(str) {
    let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /** Einfache, stabile Prüfsumme (für Challenge-Code-Validierung) */
  function checksum(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    }
    return h.toString(36);
  }

  // --- PIN-Hashing: crypto.subtle (SHA-256) mit synchronem Fallback ---
  async function hashPin(pin, salt) {
    const input = salt + '::' + pin;
    if (window.crypto && crypto.subtle && window.isSecureContext !== false) {
      try {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
        return 's256:' + Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) { /* Fallback unten */ }
    }
    // FNV-1a-basierter iterierter Fallback (kein kryptographischer Schutz,
    // aber PIN steht nie im Klartext im Storage)
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (let round = 0; round < 500; round++) {
      const s = input + '#' + round;
      for (let i = 0; i < s.length; i++) {
        h1 = ((h1 ^ s.charCodeAt(i)) * 0x01000193) >>> 0;
        h2 = ((h2 ^ ((s.charCodeAt(i) << 3) | round % 7)) * 0x01000193) >>> 0;
      }
    }
    return 'fnv:' + h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
  }

  function randomSalt() {
    if (window.crypto && crypto.getRandomValues) {
      const a = new Uint8Array(8);
      crypto.getRandomValues(a);
      return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  }

  MM.util = {
    dateKey, keyParts, daysBetween, shiftKey, weekKey, monthKey,
    fmtDate, fmtAsOf, fmtDuration,
    uuid, shuffle, esc, clamp,
    b64urlEncode, b64urlDecode, checksum,
    hashPin, randomSalt
  };
})();
