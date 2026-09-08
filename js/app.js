/**
 * app.js — Controlador principal :contentReference[oaicite:3]{index=3}
 * Inicializa storage, auth, enruta vistas y maneja UI global (sidebar, modal, topbar)
 */
const App = (() => {
  "use strict";

  let currentUser = null;
  let currentView = "dashboard";

  // DOM refs (asignadas en init)
  let sidebar, menuContainer, pageContent, viewTitle, roleBadge, userNameDisplay, modalOverlay, modalBody, modalCloseBtn, hamburgerBtn, logoutBtn;

  function qs(id) { return document.getElementById(id); }

  function init() {
    // cache DOM
    sidebar = qs("sidebar");
    menuContainer = qs("menuContainer");
    pageContent = qs("pageContent");
    viewTitle = qs("viewTitle");
    roleBadge = qs("roleBadge");
    userNameDisplay = qs("userNameDisplay");
    modalOverlay = qs("modalOverlay");
    modalBody = qs("modalBody");
    modalCloseBtn = qs("modalCloseBtn");
    hamburgerBtn = qs("hamburgerBtn");
    logoutBtn = qs("logoutBtn");

    // cargar datos encriptados
    Storage.load();

    // listeners globales
    if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
    if (modalOverlay) modalOverlay.addEventListener("click", (e) => { if (e.target === modalOverlay) closeModal(); });
    if (hamburgerBtn) hamburgerBtn.addEventListener("click", () => sidebar.classList.toggle("open"));
    if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

    // sesión existente?
    const stored = Auth.getCurrentUser();
    if (stored) {
      currentUser = stored;
      buildMenu();
      render("dashboard");
      updateUserUI();
    } else {
      showLogin();
    }

    // Auto-logout por inactividad (30 min TTL) + chequeo cada 60s
    setInterval(() => {
      if (currentUser && !Auth.isSessionValid()) {
        alert("Sesión expirada por inactividad (30 min). Ingrese de nuevo.");
        handleLogout();
      }
    }, 60 * 1000);
    // También validar en cada interacción
    ["click","keydown"].forEach(ev => document.addEventListener(ev, () => {
      if (currentUser) Auth.getCurrentUser(); // sliding refresh
    }));
  }

  function updateUserUI() {
    if (!currentUser) return;
    if (userNameDisplay) userNameDisplay.textContent = currentUser.username;
    if (roleBadge) roleBadge.textContent = Auth.ROLE_LABELS[currentUser.rol] || currentUser.rol;
  }

  function buildMenu() {
    if (!currentUser || !menuContainer) return;
    const items = Auth.getMenuItems(currentUser.rol);
    menuContainer.innerHTML = items.map(item =>
      `<div class="menu-item" data-view="${item.id}"><i class="fas ${item.icon}"></i> ${item.label}</div>`
    ).join("");
    menuContainer.querySelectorAll(".menu-item").forEach(el => {
      el.addEventListener("click", () => {
        const view = el.dataset.view;
        if (view) render(view);
        if (window.innerWidth < 820) sidebar.classList.remove("open");
      });
    });
    // marcar activo
    const active = menuContainer.querySelector(`.menu-item[data-view="${currentView}"]`);
    if (active) active.classList.add("active");
  }

  function showLogin() {
    currentUser = null;
    if (viewTitle) viewTitle.textContent = "Acceso";
    if (roleBadge) roleBadge.textContent = "Invitado";
    if (userNameDisplay) userNameDisplay.textContent = "—";
    if (menuContainer) menuContainer.innerHTML = `<p style="padding:16px;color:#94a3b8;font-size:0.85rem;">Inicie sesión para ver el menú</p>`;
    // Login tipo ReservaRest (screenshot evaluación) con fondo granate
    pageContent.innerHTML = `
      <div style="min-height:70vh;display:flex;align-items:center;justify-content:center;width:100%;background:linear-gradient(180deg, #7a1e3a 0%, #5e1630 100%);margin:-24px -28px;padding:40px 20px;border-radius:12px;">
        <div style="width:100%;max-width:380px;text-align:center;">
          <div style="color:#fff;margin-bottom:18px;">
            <div style="font-size:2.2rem;margin-bottom:6px;"><i class="fas fa-utensils"></i> <i class="fas fa-plate-wheat" style="opacity:0.9"></i></div>
            <h1 style="font-size:1.8rem;font-weight:700;letter-spacing:0.5px;margin:0;">ReservaRest</h1>
            <p style="opacity:0.9;font-size:0.9rem;margin-top:4px;">Sistema integral de gestión</p>
          </div>
          <div class="login-card" style="margin:0 auto;text-align:left;">
            <h2 style="font-size:1.1rem;color:#7a1e3a;margin-bottom:14px;">Iniciar sesión</h2>
            <div class="form-group"><label>Usuario</label><input id="loginUser" value="admin" placeholder="Ej: admin" autocomplete="username"></div>
            <div class="form-group"><label>Contraseña</label><input id="loginPass" type="password" value="admin123" placeholder="••••••••" autocomplete="current-password"></div>
            <button class="btn" style="width:100%;justify-content:center;background:#7a1e3a;color:#fff;border:none;" onclick="App.doLogin()"><i class="fas fa-sign-in-alt"></i> Entrar</button>
          </div>
          <div style="margin-top:16px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);border-radius:10px;padding:12px;text-align:left;color:#fff;font-size:0.78rem;line-height:1.6;">
            <strong style="display:block;margin-bottom:6px;opacity:0.95;">Usuarios demo:</strong>
            <div><code style="background:rgba(0,0,0,0.2);padding:1px 6px;border-radius:4px;">admin / admin123</code></div>
            <div><code style="background:rgba(0,0,0,0.2);padding:1px 6px;border-radius:4px;">mesero / mesero123</code></div>
            <div><code style="background:rgba(0,0,0,0.2);padding:1px 6px;border-radius:4px;">cocina / cocina123</code></div>
            <div><code style="background:rgba(0,0,0,0.2);padding:1px 6px;border-radius:4px;">despacho / despacho123</code></div>
          </div>
          <p style="color:rgba(255,255,255,0.7);font-size:0.7rem;margin-top:10px;">Datos en localStorage encriptado · Validación y hasheo activo</p>
        </div>
      </div>
    `;
    // enter key
    setTimeout(() => {
      const pass = qs("loginPass");
      if (pass) pass.addEventListener("keyup", (e) => { if (e.key === "Enter") doLogin(); });
    }, 100);
  }

  function doLogin() {
    const userEl = qs("loginUser");
    const passEl = qs("loginPass");
    if (!userEl || !passEl) return;
    const username = Auth.sanitize(userEl.value);
    const password = passEl.value;
    if (!username || !password) { alert("Ingrese usuario y contraseña"); return; }
    const res = Auth.login(username, password);
    if (res.ok) {
      currentUser = res.user;
      buildMenu();
      render("dashboard");
      updateUserUI();
    } else {
      alert(res.error || "Credenciales incorrectas");
    }
  }

  function handleLogout() {
    Auth.logout();
    currentUser = null;
    if (sidebar) sidebar.classList.remove("open");
    showLogin();
  }

  function render(viewId) {
    if (!currentUser) { showLogin(); return; }
    // validar sesión no expirada
    if (!Auth.isSessionValid()) { alert("Sesión expirada"); handleLogout(); return; }
    // permiso por rol (guardia de vista)
    if (!Auth.hasAccess(currentUser.rol, viewId)) {
      pageContent.innerHTML = `<div class="card"><h3><i class="fas fa-ban" style="color:#b23c1c;"></i> Acceso denegado</h3><p style="color:#5f6b7a;">Tu rol <strong>${currentUser.rol}</strong> no tiene permiso para ver <strong>${viewId}</strong>.</p></div>`;
      return;
    }
    currentView = viewId;
    const titles = {
      dashboard: "Panel de control",
      mesas: "Gestión de mesas",
      reservas: "Reservas",
      pedidos: "Pedidos",
      cocina: "Cola de cocina",
      despachos: "Despachos",
      usuarios: "Administración de usuarios"
    };
    if (viewTitle) viewTitle.textContent = titles[viewId] || "Panel";
    if (roleBadge) roleBadge.textContent = Auth.ROLE_LABELS[currentUser.rol] || currentUser.rol;

    let html = "";
    switch (viewId) {
      case "dashboard": html = Modules.renderDashboard(currentUser); break;
      case "mesas": html = Modules.renderMesas(); break;
      case "reservas": html = Modules.renderReservas(); break;
      case "pedidos": html = Modules.renderPedidos(); break;
      case "cocina": html = Modules.renderCocina(); break;
      case "despachos": html = Modules.renderDespachos(); break;
      case "usuarios": html = Modules.renderUsuarios(); break;
      default: html = "<p>Vista no disponible</p>";
    }
    pageContent.innerHTML = html;

    // resaltar menú
    if (menuContainer) {
      menuContainer.querySelectorAll(".menu-item").forEach(el => el.classList.remove("active"));
      const activeMenu = menuContainer.querySelector(`.menu-item[data-view="${viewId}"]`);
      if (activeMenu) activeMenu.classList.add("active");
    }
  }

  function refresh() {
    render(currentView);
  }

  // ---------- Modal ----------
  function openModal(type, id) {
    if (!modalBody || !modalOverlay) return;
    modalBody.innerHTML = Modules.getModalHTML(type, id);
    modalOverlay.classList.add("open");
  }

  function closeModal() {
    if (modalOverlay) modalOverlay.classList.remove("open");
  }

  // Exponer API global para onclick inline (render genera botones)
  window.App = { init, doLogin, openModal, closeModal, render, refresh, handleLogout, getCurrentView: () => currentView };
  // También exponer Modules actions para inline handlers
  window.Modules = Modules;

  document.addEventListener("DOMContentLoaded", init);

  return { init, doLogin, openModal, closeModal, render, refresh, handleLogout };
})();
