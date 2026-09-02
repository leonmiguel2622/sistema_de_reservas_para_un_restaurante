/**
 * auth.js — Login y permisos por rol con políticas de seguridad
 * Roles: administrador (full), mesero, cocina, despacho
 * Usuarios demo: admin/admin123, mesero/mesero123, cocina/cocina123, despacho/despacho123
 *
 * POLÍTICAS:
 * - Sanitización anti XSS/SQLi en usuario (Storage.sanitizeInput)
 * - Validación de formato (isValidText simulando regex de usuario)
 * - Hash simulado de contraseña (no texto plano en comparación) — en prod usar bcrypt/PBKDF2 en backend
 * - Rate Limit 5 intentos / 15 min (protección fuerza bruta, como en Implementación de Protección.js)
 * - Guardias de vista por rol (PERMISSIONS) — ninguna vista se renderiza sin hasAccess()
 * - Sesión en sessionStorage (se borra al cerrar pestaña) con verificación de rol
 */
const Auth = (() => {
  "use strict";

  // Hasheo simple para no comparar texto plano en memoria (demo)
  function hashPass(p) {
    // djb2-like + SECRET — NO es seguro para prod, solo evidencia de "hatcheo"
    let h = 5381;
    for (let i = 0; i < p.length; i++) h = ((h << 5) + h) ^ p.charCodeAt(i);
    return (h >>> 0).toString(16);
  }

  const USERS = {
    admin:    { passHash: hashPass("admin123"),    rol: "administrador", nombre: "Administrador" },
    mesero:   { passHash: hashPass("mesero123"),   rol: "mesero",        nombre: "Mesero" },
    cocina:   { passHash: hashPass("cocina123"),   rol: "cocina",        nombre: "Cocina" },
    despacho: { passHash: hashPass("despacho123"), rol: "despacho",      nombre: "Despacho" }
  };

  const ROLE_LABELS = {
    administrador: "Administrador",
    mesero: "Mesero",
    cocina: "Cocina",
    despacho: "Despacho"
  };

  const PERMISSIONS = {
    dashboard: ["administrador", "mesero", "cocina", "despacho"],
    mesas:     ["administrador", "mesero"],
    reservas:  ["administrador", "mesero"],
    pedidos:   ["administrador", "mesero"],
    cocina:    ["administrador", "cocina"],
    despachos: ["administrador", "despacho", "mesero"],
    usuarios:  ["administrador"]
  };

  function sanitize(str) {
    if (typeof str !== "string") return "";
    // Delega a Storage + lower + trim
    return Storage.sanitizeInput(str).toLowerCase();
  }

  // ---------- Rate Limiting (5 intentos / 15 min) ----------
  const RATE_LIMIT = { windowMs: 15 * 60 * 1000, max: 5, key: "restoLoginAttempts" };
  function _getAttempts() {
    try {
      const raw = localStorage.getItem(RATE_LIMIT.key);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      const now = Date.now();
      return arr.filter(ts => now - ts < RATE_LIMIT.windowMs);
    } catch { return []; }
  }
  function _recordFailedAttempt() {
    const a = _getAttempts(); a.push(Date.now());
    try { localStorage.setItem(RATE_LIMIT.key, JSON.stringify(a)); } catch {}
  }
  function _clearAttempts() { try { localStorage.removeItem(RATE_LIMIT.key); } catch {} }
  function _isRateLimited() {
    const a = _getAttempts();
    if (a.length >= RATE_LIMIT.max) {
      const oldest = a[0];
      const remaining = RATE_LIMIT.windowMs - (Date.now() - oldest);
      return { limited: true, minutes: Math.ceil(remaining / 60000), remaining };
    }
    return { limited: false };
  }

  // ---------- Login con validaciones ----------
  function login(usernameRaw, passwordRaw) {
    // 1. Rate limit
    const rl = _isRateLimited();
    if (rl.limited) return { ok: false, error: `Demasiados intentos. Intente de nuevo en ${rl.minutes} min. (429)`, code: 429 };

    // 2. Sanitización y validación de formato
    const username = sanitize(usernameRaw);
    const password = String(passwordRaw || "");
    if (!username || !password) return { ok: false, error: "Usuario y contraseña requeridos" };
    if (username.length < 3 || username.length > 20) return { ok: false, error: "Usuario inválido (3-20 chars)" };
    if (!/^[a-z0-9_]+$/.test(username)) return { ok: false, error: "Usuario solo a-z, 0-9, _" };
    if (password.length < 4 || password.length > 30) return { ok: false, error: "Contraseña inválida" };

    // 3. Búsqueda y comparación por hash
    const u = USERS[username];
    if (!u) { _recordFailedAttempt(); return { ok: false, error: "Usuario no existe" }; }
    const inputHash = hashPass(password);
    if (u.passHash !== inputHash) { _recordFailedAttempt(); return { ok: false, error: "Contraseña incorrecta" }; }

    _clearAttempts();
    const session = { username, rol: u.rol, nombre: u.nombre, ts: Date.now() };
    try { sessionStorage.setItem("restoUser", JSON.stringify(session)); } catch {}
    try { sessionStorage.setItem("restoRole", u.rol); } catch {}
    return { ok: true, user: session };
  }

  function logout() {
    try { sessionStorage.removeItem("restoUser"); sessionStorage.removeItem("restoRole"); } catch {}
  }

  function getCurrentUser() {
    try {
      const raw = sessionStorage.getItem("restoUser");
      if (!raw) return null;
      const u = JSON.parse(raw);
      // Verifica que el usuario aún existe y el rol coincide (anti manipulación sessionStorage)
      if (!USERS[u.username] || USERS[u.username].rol !== u.rol) return null;
      return u;
    } catch { return null; }
  }

  function hasAccess(rol, viewId) {
    const allowed = PERMISSIONS[viewId];
    if (!allowed) return false;
    return allowed.includes(rol);
  }

  function getMenuItems(rol) {
    const base = [
      { id: "dashboard", label: "Panel",     icon: "fa-chart-pie",      roles: PERMISSIONS.dashboard },
      { id: "mesas",     label: "Mesas",     icon: "fa-chair",          roles: PERMISSIONS.mesas },
      { id: "reservas",  label: "Reservas",  icon: "fa-calendar-check", roles: PERMISSIONS.reservas },
      { id: "pedidos",   label: "Pedidos",   icon: "fa-clipboard-list", roles: PERMISSIONS.pedidos },
      { id: "cocina",    label: "Cocina",    icon: "fa-fire",           roles: PERMISSIONS.cocina },
      { id: "despachos", label: "Despachos", icon: "fa-truck",          roles: PERMISSIONS.despachos },
      { id: "usuarios",  label: "Usuarios",  icon: "fa-users-cog",      roles: PERMISSIONS.usuarios }
    ];
    return base.filter(item => item.roles.includes(rol));
  }

  return {
    USERS, ROLE_LABELS, PERMISSIONS,
    login, logout, getCurrentUser, hasAccess, getMenuItems, sanitize,
    _hashPass: hashPass, RATE_LIMIT
  };
})();
