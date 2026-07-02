/* ============================================================
   MacroMind – firebase-config.js
   Öffentliche Firebase-Web-Konfiguration. Diese Werte sind
   bewusst client-seitig sichtbar – die eigentliche Absicherung
   erfolgt über die Firestore-Sicherheitsregeln (firestore.rules),
   nicht über Geheimhaltung dieser Keys.

   Fehlt/leer diese Config, läuft die App automatisch im reinen
   Lokal-Modus (nur Gast + lokaler Account-Cache, kein Cloud-Sync).
   ============================================================ */
window.MM = window.MM || {};

MM.firebaseConfig = {
  apiKey: "AIzaSyATE-XphlIp3UqnxG6dpDv04qConMsqKBo",
  authDomain: "macromind-e6445.firebaseapp.com",
  projectId: "macromind-e6445",
  storageBucket: "macromind-e6445.firebasestorage.app",
  messagingSenderId: "1053287084812",
  appId: "1:1053287084812:web:7927392f4e4439702b4f29"
};
