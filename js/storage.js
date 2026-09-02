/**
 * storage.js — Persistencia en localStorage con políticas de seguridad
 * Gestiona mesas, reservas, pedidos, despachos y platos.
 * Datos persisten al recargar (spec). 8 mesas y 8 platos precargados.
 *
 * POLÍTICAS IMPLEMENTADAS (exigidas en evaluación):
 * 1. Cifrado simétrico ligero (XOR + Base64) para ofuscación — NOTA: en producción usar backend + HTTPS + AES-GCM real
 * 2. Hasheo + firma de integridad para detectar manipulación manual en DevTools (restoData_sig)
 * 3. Validación estricta de estructura al cargar (anti inyección / corrupción)
 * 4. Sanitización y validadores expuestos para auth.js y modules.js
 */
const Storage = (() => {
  "use strict";

  const SECRET_KEY = "RestoApp2026SecureKey#";
  const STORAGE_KEY = "restoData";
  const SIG_KEY = STORAGE_KEY + "_sig";
  const SIG_SALT = "RestoSigSalt2026";

  // ---------- Cifrado XOR + Base64 (ofuscación cliente) ----------
  function encrypt(text) {
    let r = "";
    for (let i = 0; i < text.length; i++) r += String.fromCharCode(text.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length));
    return btoa(r);
  }
  function decrypt(enc) {
    try {
      const d = atob(enc);
      let r = "";
      for (let i = 0; i < d.length; i++) r += String.fromCharCode(d.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length));
      return r;
    } catch { return null; }
  }

  // ---------- Hasheo simple síncrono (djb2) para firma de integridad ----------
  // En producción usar crypto.subtle.digest('SHA-256', ...) que es asíncrono y estándar.
  function simpleHash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
    // mezclar con SECRET y SALT
    const salted = SIG_SALT + h + SECRET_KEY;
    let h2 = 0;
    for (let i = 0; i < salted.length; i++) h2 = Math.imul(31, h2) + salted.charCodeAt(i) | 0;
    return (h >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
  }
  function computeSignature(encryptedPayload) {
    return simpleHash(encryptedPayload + SIG_SALT + SECRET_KEY);
  }

  // ---------- Escritura segura con firma ----------
  function secureSet(key, data) {
    try {
      const json = JSON.stringify(data);
      const enc = encrypt(json);
      const sig = computeSignature(enc);
      localStorage.setItem(key, enc);
      localStorage.setItem(key + "_sig", sig);
    } catch (e) { console.warn("secureSet error", e); }
  }
  // ---------- Lectura segura con verificación ----------
  function secureGet(key) {
    try {
      const enc = localStorage.getItem(key);
      if (!enc) return null;
      const storedSig = localStorage.getItem(key + "_sig");
      // Si existe firma, verificar integridad (detecta edición manual)
      if (storedSig) {
        const expected = computeSignature(enc);
        if (storedSig !== expected) {
          console.warn("[Storage] Integridad violada en", key, "— posible manipulación manual. Se descarta y se restaura demo.");
          // No borrar automáticamente aquí, lo hará load() al detectar null
          return null;
        }
      }
      const dec = decrypt(enc);
      if (!dec) return null;
      return JSON.parse(dec);
    } catch (e) {
      console.warn("secureGet error / JSON corrupto", e);
      return null;
    }
  }

  // ---------- Datos demo ----------
  const DEFAULT_MESAS = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    numero: i + 1,
    capacidad: [2,2,4,4,4,6,6,8][i],
    zona: ["Terraza","Terraza","Salón","Salón","Salón","VIP","VIP","VIP"][i],
    estado: "disponible"
  }));
  const DEFAULT_PLATOS = [
    { id: 1, nombre: "Ceviche clásico", precio: 18.5 },
    { id: 2, nombre: "Lomo saltado", precio: 22.0 },
    { id: 3, nombre: "Arroz con pollo", precio: 16.0 },
    { id: 4, nombre: "Pasta al pesto", precio: 19.5 },
    { id: 5, nombre: "Ensalada mediterránea", precio: 14.0 },
    { id: 6, nombre: "Sopa de mariscos", precio: 20.0 },
    { id: 7, nombre: "Parrillada mixta", precio: 32.0 },
    { id: 8, nombre: "Flan de coco", precio: 8.5 }
  ];
  function getDefaultData() {
    return {
      mesas: JSON.parse(JSON.stringify(DEFAULT_MESAS)),
      platos: JSON.parse(JSON.stringify(DEFAULT_PLATOS)),
      reservas: [],
      pedidos: [],
      despachos: []
    };
  }

  // ---------- Validadores (usados por modules.js y auth.js) ----------
  function sanitizeInput(str) {
    if (typeof str !== "string") return "";
    return str.replace(/[<>]/g, "").replace(/['\";`]/g, "").trim();
  }
  function isValidText(str, max = 80) {
    if (typeof str !== "string") return false;
    const t = str.trim();
    if (!t || t.length > max) return false;
    // Permitir letras con tildes, números, espacios y -_,.: 
    return /^[\p{L}0-9\s\-_,.:()]+$/u.test(t);
  }
  function isValidNumber(n, min = 0, max = 9999) {
    return Number.isInteger(n) && n >= min && n <= max;
  }
  function isValidDate(isoDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
    const d = new Date(isoDate + "T12:00:00");
    if (isNaN(d.getTime())) return false;
    const today = new Date(); today.setHours(0,0,0,0);
    // Reservas no en pasado (permite hoy)
    return d >= today;
  }
  function isValidTime(hhmm) {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(hhmm);
  }

  // Validación profunda de estructura al cargar
  function validateStructure(obj) {
    if (!obj || typeof obj !== "object") return false;
    if (!Array.isArray(obj.mesas) || obj.mesas.length !== 8) return false;
    if (!Array.isArray(obj.platos) || obj.platos.length !== 8) return false;
    if (!Array.isArray(obj.reservas) || !Array.isArray(obj.pedidos) || !Array.isArray(obj.despachos)) return false;
    // Cada mesa debe tener estado permitido
    const allowedMesa = new Set(["disponible","reservada","ocupada"]);
    for (const m of obj.mesas) {
      if (!allowedMesa.has(m.estado)) return false;
      if (!isValidNumber(m.id,1,100) || !isValidNumber(m.numero,1,100)) return false;
    }
    // Platos válidos
    for (const p of obj.platos) {
      if (!isValidText(p.nombre, 60)) return false;
      if (typeof p.precio !== "number" || p.precio < 0 || p.precio > 999) return false;
    }
    return true;
  }

  let _data = null;
  function load() {
    let stored = secureGet(STORAGE_KEY);
    // Si falla firma o JSON corrupto o estructura inválida → restaurar demo
    if (!stored || !validateStructure(stored)) {
      if (stored) console.warn("[Storage] Estructura inválida, se restaura demo");
      _data = getDefaultData();
      save();
    } else {
      _data = stored;
    }
    // Normalizar
    _data.mesas.forEach(m => { if (!m.estado) m.estado = "disponible"; });
    return _data;
  }
  function save() { if (_data) secureSet(STORAGE_KEY, _data); }
  function getData() { if (!_data) load(); return _data; }
  function reset() { _data = getDefaultData(); save(); return _data; }

  return {
    STORAGE_KEY, SIG_KEY,
    load, save, getData, reset, getDefaultData,
    DEFAULT_MESAS, DEFAULT_PLATOS,
    secureSet, secureGet,
    sanitizeInput, isValidText, isValidNumber, isValidDate, isValidTime, validateStructure, simpleHash
  };
})();
