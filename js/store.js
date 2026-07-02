/* ============================================================
   MacroMind – store.js
   Persistenz mit echtem geräteübergreifendem Login:
   - Konten: Benutzername + 4-stellige PIN → intern Firebase-Auth
     (Email/Passwort, beides deterministisch aus Nutzername+PIN
     abgeleitet). Fortschritt liegt in Firestore (users/<uid>).
   - Auf jedem Gerät mit denselben Zugangsdaten einloggen → derselbe
     Fortschritt wird geladen (Merge-on-Login schützt vor Datenverlust).
   - Lokaler Cache (localStorage) spiegelt die Daten → App funktioniert
     auch offline; Cloud-Schreibvorgänge laufen gebündelt im Hintergrund.
   - Gast-Modus: rein lokal, ohne Cloud, ohne Internetbedarf.
   - Fehlt Firebase (kein Netz/kein SDK), degradiert die App sauber zu
     reinem Lokalbetrieb (Account-Login dann nur aus lokalem Cache).
   ============================================================ */
window.MM = window.MM || {};

(function () {
  'use strict';
  const U = MM.util;

  const K_SESSION = 'mm_session_v1';
  const K_DATA_PREFIX = 'mm_data_v1_';
  const GUEST_KEY = 'guest';
  const CLOUD_DEBOUNCE_MS = 1500;

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  function defaultData(name) {
    return {
      v: 1,
      name: name,
      createdAt: new Date().toISOString(),
      updatedAt: Date.now(),
      settings: { theme: 'dark', lang: MM.lang },
      rotation: {},
      daily: {},
      rounds: [],
      inProgress: {},
      ach: {},
      counters: { answerStreakCur: 0, answerStreakBest: 0, challengesSent: 0 }
    };
  }

  function mergeDefaults(data) {
    const d = defaultData(data.name || 'Anonymous0000');
    for (const k in d) if (data[k] == null) data[k] = d[k];
    for (const k in d.counters) if (data.counters[k] == null) data.counters[k] = d.counters[k];
    if (!data.settings.theme) data.settings.theme = 'dark';
    if (!data.settings.lang) data.settings.lang = 'de';
    return data;
  }

  /** Zwei Datensätze desselben Kontos zusammenführen (Schutz vor Datenverlust,
      wenn auf zwei Geräten – ggf. offline – gespielt wurde). */
  function mergeData(a, b) {
    if (!a) return b;
    if (!b) return a;
    const newer = (b.updatedAt || 0) >= (a.updatedAt || 0) ? b : a;
    const older = newer === b ? a : b;
    const out = JSON.parse(JSON.stringify(newer));

    // Runden: Vereinigung nach ID
    const byId = new Map();
    for (const r of (a.rounds || [])) byId.set(r.id, r);
    for (const r of (b.rounds || [])) if (!byId.has(r.id)) byId.set(r.id, r);
    out.rounds = [...byId.values()].sort((x, y) =>
      (x.finishedAt || '').localeCompare(y.finishedAt || ''));

    // Achievements: jeweils frühestes Freischaltdatum
    out.ach = Object.assign({}, older.ach, newer.ach);
    for (const id in (older.ach || {})) {
      if (!out.ach[id] || older.ach[id] < out.ach[id]) out.ach[id] = older.ach[id];
    }

    // Zähler: Maximum bzw. Summe sinnvoll wählen
    out.counters = Object.assign({}, older.counters, newer.counters);
    out.counters.answerStreakBest = Math.max(
      (a.counters && a.counters.answerStreakBest) || 0,
      (b.counters && b.counters.answerStreakBest) || 0);
    out.counters.challengesSent = Math.max(
      (a.counters && a.counters.challengesSent) || 0,
      (b.counters && b.counters.challengesSent) || 0);

    return mergeDefaults(out);
  }

  const Store = {
    userKey: null,
    session: null,     // { type:'guest'|'account', key, username?, uid? }
    data: null,

    cloudReady: false,
    _auth: null,
    _db: null,
    _pushTimer: null,

    // ---------- Cloud-Init ----------
    initCloud() {
      if (!window.firebase || !MM.firebaseConfig || !MM.firebaseConfig.apiKey) {
        this.cloudReady = false;
        return false;
      }
      try {
        if (!firebase.apps.length) firebase.initializeApp(MM.firebaseConfig);
        this._auth = firebase.auth();
        this._db = firebase.firestore();
        try {
          this._db.enablePersistence({ synchronizeTabs: true }).catch(function () {});
        } catch (e) {}
        this.cloudReady = true;
      } catch (e) {
        this.cloudReady = false;
      }
      return this.cloudReady;
    },

    // ---------- Ableitung von Email/Passwort aus Nutzername+PIN ----------
    _email(username) {
      const lower = String(username).trim().toLowerCase();
      // Reversible Hex-Kodierung → immer gültige, eindeutige Email-Localpart
      let hex = '';
      for (const ch of lower) hex += ch.charCodeAt(0).toString(16);
      return 'mm_' + hex + '@macromind.users';
    },
    async _password(username, pin) {
      const lower = String(username).trim().toLowerCase();
      // Deterministisch, lang genug für Firebase (>=6 Zeichen), PIN nie im Klartext
      const h = await U.hashPin(pin, 'pw::' + lower);
      return 'mmpw_' + h;
    },

    // ---------- Registrierung ----------
    async register(username, pin) {
      const uname = String(username).trim();
      if (!/^\d{4}$/.test(pin)) return { ok: false, error: 'auth.err.pinFormat' };
      const nameCheck = MM.names.validateName(uname);
      if (!nameCheck.ok) return { ok: false, error: 'profile.err.' + nameCheck.reason };

      if (!this.cloudReady) {
        // Ohne Cloud kann kein geräteübergreifendes Konto entstehen
        return { ok: false, error: 'auth.err.offline' };
      }

      const email = this._email(uname);
      const pw = await this._password(uname, pin);
      try {
        const cred = await this._auth.createUserWithEmailAndPassword(email, pw);
        const uid = cred.user.uid;
        const data = defaultData(uname);
        this.userKey = 'u_' + uid;
        this.data = data;
        this.session = { type: 'account', key: this.userKey, username: uname, uid: uid };
        writeJSON(K_SESSION, this.session);
        writeJSON(K_DATA_PREFIX + this.userKey, data);
        await this._flushCloud(true);
        if (data.settings.lang) MM.setLang(data.settings.lang);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: this._authErr(e, 'auth.err.userTaken') };
      }
    },

    // ---------- Login ----------
    async login(username, pin) {
      const uname = String(username).trim();
      if (!/^\d{4}$/.test(pin)) return { ok: false, error: 'auth.err.pinFormat' };

      if (!this.cloudReady) {
        // Offline: nur möglich, wenn dieses Gerät den Account schon kennt
        return this._loginLocalFallback(uname, pin);
      }

      const email = this._email(uname);
      const pw = await this._password(uname, pin);
      try {
        const cred = await this._auth.signInWithEmailAndPassword(email, pw);
        const uid = cred.user.uid;
        this.userKey = 'u_' + uid;
        this.session = { type: 'account', key: this.userKey, username: uname, uid: uid };
        writeJSON(K_SESSION, this.session);

        const cloud = await this._fetchCloud(uid);
        const localCache = readJSON(K_DATA_PREFIX + this.userKey, null);
        let data = (cloud && localCache) ? mergeData(localCache, cloud) : (cloud || localCache || defaultData(uname));
        data.name = data.name || uname;
        this.data = mergeDefaults(data);
        writeJSON(K_DATA_PREFIX + this.userKey, this.data);
        await this._flushCloud(true); // ggf. gemergte Daten zurückschreiben
        if (this.data.settings.lang) MM.setLang(this.data.settings.lang);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: this._authErr(e, 'auth.err.wrongPin') };
      }
    },

    _authErr(e, defaultKey) {
      const code = (e && e.code) || '';
      if (code === 'auth/email-already-in-use') return 'auth.err.userTaken';
      if (code === 'auth/user-not-found') return 'auth.err.userNotFound';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return 'auth.err.wrongPin';
      if (code === 'auth/network-request-failed') return 'auth.err.network';
      if (code === 'auth/too-many-requests') return 'auth.err.tooMany';
      return defaultKey;
    },

    _loginLocalFallback(uname) {
      // Nur wenn eine Session dieses Kontos lokal existiert
      const s = readJSON(K_SESSION, null);
      if (s && s.type === 'account' && s.username &&
          s.username.toLowerCase() === uname.toLowerCase() &&
          localStorage.getItem(K_DATA_PREFIX + s.key)) {
        this.session = s;
        this._loadLocal(s.key);
        return { ok: true };
      }
      return { ok: false, error: 'auth.err.network' };
    },

    // ---------- Gast ----------
    loginGuest() {
      if (!localStorage.getItem(K_DATA_PREFIX + GUEST_KEY)) {
        const rand = String(Math.floor(1000 + Math.random() * 9000));
        writeJSON(K_DATA_PREFIX + GUEST_KEY, defaultData('Anonymous' + rand));
      }
      this.session = { type: 'guest', key: GUEST_KEY };
      writeJSON(K_SESSION, this.session);
      this._loadLocal(GUEST_KEY);
      return { ok: true };
    },

    // ---------- Session-Wiederherstellung (Auto-Login) ----------
    /** Gibt ein Promise<boolean> zurück: true, wenn ein Nutzer geladen wurde. */
    restoreSession() {
      const s = readJSON(K_SESSION, null);
      if (!s || !s.key) return Promise.resolve(false);

      if (s.type === 'guest') {
        if (!localStorage.getItem(K_DATA_PREFIX + s.key)) return Promise.resolve(false);
        this.session = s;
        this._loadLocal(s.key);
        return Promise.resolve(true);
      }

      // Account: auf Firebase-Auth-Status warten (persistiert automatisch)
      const self = this;
      if (this.cloudReady) {
        return new Promise(function (resolve) {
          let done = false;
          const finish = function (v) { if (!done) { done = true; resolve(v); } };
          const unsub = self._auth.onAuthStateChanged(async function (user) {
            unsub();
            if (!user) { finish(self._restoreLocalAccount(s)); return; }
            self.userKey = 'u_' + user.uid;
            self.session = { type: 'account', key: self.userKey, username: s.username, uid: user.uid };
            writeJSON(K_SESSION, self.session);
            try {
              const cloud = await self._fetchCloud(user.uid);
              const localCache = readJSON(K_DATA_PREFIX + self.userKey, null);
              let data = (cloud && localCache) ? mergeData(localCache, cloud)
                : (cloud || localCache || defaultData(s.username || 'Anonymous0000'));
              self.data = mergeDefaults(data);
              writeJSON(K_DATA_PREFIX + self.userKey, self.data);
              self._scheduleCloudPush();
              if (self.data.settings.lang) MM.setLang(self.data.settings.lang);
              finish(true);
            } catch (e) {
              finish(self._restoreLocalAccount(s));
            }
          });
          // Sicherheitsnetz: falls Firebase nicht antwortet, lokal weiter
          setTimeout(function () { finish(self._restoreLocalAccount(s)); }, 6000);
        });
      }

      // Kein Cloud verfügbar: lokalen Cache nutzen
      return Promise.resolve(this._restoreLocalAccount(s));
    },

    _restoreLocalAccount(s) {
      if (s && s.key && localStorage.getItem(K_DATA_PREFIX + s.key)) {
        this.session = s;
        this._loadLocal(s.key);
        return true;
      }
      return false;
    },

    // ---------- Cloud-IO ----------
    async _fetchCloud(uid) {
      if (!this.cloudReady) return null;
      const snap = await this._db.collection('users').doc(uid).get();
      if (!snap.exists) return null;
      const d = snap.data();
      // Daten liegen als JSON-String im Feld "blob" (umgeht Firestores Verbot
      // verschachtelter Arrays, z. B. bei den Antwort-Permutationen).
      if (d && typeof d.blob === 'string') {
        try { return JSON.parse(d.blob); } catch (e) { return null; }
      }
      return d; // Rückwärtskompatibilität (früh angelegte Dokumente ohne blob)
    },

    _scheduleCloudPush() {
      if (!this.cloudReady || !this.session || this.session.type !== 'account') return;
      const self = this;
      clearTimeout(this._pushTimer);
      this._pushTimer = setTimeout(function () { self._flushCloud(); }, CLOUD_DEBOUNCE_MS);
    },

    async _flushCloud(awaitWrite) {
      if (!this.cloudReady || !this.session || this.session.type !== 'account') return;
      const user = this._auth.currentUser;
      if (!user || !this.data) return;
      clearTimeout(this._pushTimer);
      // Als JSON-String speichern → Firestore-sicher (keine verschachtelten Arrays).
      // name/updatedAt zusätzlich als Klarfelder (nur zur Diagnose in der Konsole).
      const payload = {
        blob: JSON.stringify(this.data),
        name: this.data.name || '',
        updatedAt: this.data.updatedAt || Date.now()
      };
      const p = this._db.collection('users').doc(user.uid).set(payload);
      if (awaitWrite) { try { await p; } catch (e) {} }
      else { p.catch(function () {}); }
    },

    /** Sofortiges Wegschreiben (z. B. beim Verlassen der Seite) */
    flushNow() {
      if (this.session && this.session.type === 'account') this._flushCloud(false);
    },

    // ---------- Laden/Speichern ----------
    _loadLocal(key) {
      this.userKey = key;
      this.data = mergeDefaults(readJSON(K_DATA_PREFIX + key, defaultData('Anonymous0000')));
      if (this.data.settings.lang) MM.setLang(this.data.settings.lang);
    },

    /** Synchron lokal speichern (immer sofort) + Cloud-Push (gebündelt) */
    save() {
      if (!this.userKey || !this.data) return;
      this.data.updatedAt = Date.now();
      writeJSON(K_DATA_PREFIX + this.userKey, this.data);
      this._scheduleCloudPush();
    },

    // ---------- Logout / Löschen ----------
    logout() {
      this.flushNow();
      if (this.cloudReady && this.session && this.session.type === 'account') {
        try { this._auth.signOut(); } catch (e) {}
      }
      this.session = null;
      this.userKey = null;
      this.data = null;
      localStorage.removeItem(K_SESSION);
    },

    async deleteCurrentUser() {
      if (!this.userKey) return;
      const wasAccount = this.session && this.session.type === 'account';
      const uid = this.session && this.session.uid;
      localStorage.removeItem(K_DATA_PREFIX + this.userKey);

      if (wasAccount && this.cloudReady && this._auth.currentUser) {
        try { await this._db.collection('users').doc(uid).delete(); } catch (e) {}
        try { await this._auth.currentUser.delete(); } catch (e) {
          // Löschen des Auth-Kontos kann erneutes Login verlangen – Daten sind bereits weg
          try { await this._auth.signOut(); } catch (e2) {}
        }
      }
      this.session = null;
      this.userKey = null;
      this.data = null;
      localStorage.removeItem(K_SESSION);
    },

    isGuest() { return this.session && this.session.type === 'guest'; },
    isCloudAccount() {
      return this.session && this.session.type === 'account' && this.cloudReady;
    },

    // ---------- Sync-Codes (zusätzlicher manueller Transfer / Backup) ----------
    exportCode() {
      const json = JSON.stringify(this.data);
      return 'MMS1.' + U.b64urlEncode(json) + '.' + U.checksum(json);
    },
    importCode(code) {
      try {
        const parts = String(code).trim().split('.');
        if (parts.length !== 3 || parts[0] !== 'MMS1') return { ok: false };
        const json = U.b64urlDecode(parts[1]);
        if (U.checksum(json) !== parts[2]) return { ok: false };
        const data = JSON.parse(json);
        if (!data || !Array.isArray(data.rounds)) return { ok: false };
        this.data = mergeData(this.data, mergeDefaults(data));
        this.save();
        if (this.data.settings.lang) MM.setLang(this.data.settings.lang);
        return { ok: true };
      } catch (e) {
        return { ok: false };
      }
    }
  };

  MM.Store = Store;
})();
