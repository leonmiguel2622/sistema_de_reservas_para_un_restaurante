/**
 * modules.js — Lógica de negocio y vistas :contentReference[oaicite:2]{index=2}
 * Flujo: Reservas -> Pedidos/platos -> Cocina (pendiente->preparacion->listo) -> Despachos (pendiente->ruta->entregado)
 */
const Modules = (() => {
  "use strict";

  let platosTemp = []; // buffer para modal pedidos

  // ---------- Helpers ----------
  function getData() { return Storage.getData(); }

  function formatDate(dateStr) { return dateStr || "-"; }

  // ---------- DASHBOARD ----------
  function renderDashboard(currentUser) {
    const data = getData();
    const hoy = new Date().toISOString().slice(0, 10);
    const reservasHoy = data.reservas.filter(r => r.fecha === hoy);
    const platosPendientes = data.pedidos.flatMap(p => p.platos || []).filter(pl => pl.estado === "pendiente" || pl.estado === "preparacion");
    const despachosActivos = data.despachos.filter(d => d.estado === "ruta" || d.estado === "pendiente");
    const mesasOcupadas = data.mesas.filter(m => m.estado === "ocupada").length;

    return `
      <div class="stats-grid">
        <div class="stat-card"><i class="fas fa-calendar-day"></i><div class="stat-info"><h4>Reservas del día</h4><span>${reservasHoy.length}</span></div></div>
        <div class="stat-card"><i class="fas fa-utensils"></i><div class="stat-info"><h4>Platos pendientes</h4><span>${platosPendientes.length}</span></div></div>
        <div class="stat-card"><i class="fas fa-truck"></i><div class="stat-info"><h4>Despachos activos</h4><span>${despachosActivos.length}</span></div></div>
        <div class="stat-card"><i class="fas fa-chair"></i><div class="stat-info"><h4>Mesas ocupadas</h4><span>${mesasOcupadas}/8</span></div></div>
      </div>
      <div class="card">
        <div class="card-header"><h3>📋 Resumen rápido</h3></div>
        <p>Bienvenido, <strong>${currentUser.username}</strong>. Rol: <span class="badge">${Auth.ROLE_LABELS[currentUser.rol] || currentUser.rol}</span></p>
        <p style="margin-top:10px;color:#5f6b7a;font-size:0.9rem;">Flujo: <strong>Reservas</strong> → <strong>Pedidos / platos</strong> → <strong>Cocina</strong> (preparación → listo) → <strong>Despachos</strong> (ruta → entregado). Datos en <code>localStorage</code> encriptado.</p>
      </div>
      <div class="card">
        <div class="card-header"><h3>Estado de mesas</h3></div>
        <div class="mesas-grid">
          ${data.mesas.map(m => {
            const label = { disponible: "Disponible", reservada: "Reservada", ocupada: "Ocupada" }[m.estado] || m.estado;
            return `<div class="mesa-item ${m.estado}"><div class="mesa-num">Mesa ${m.numero}</div><div class="mesa-estado badge badge-${m.estado}">${label}</div></div>`;
          }).join("")}
        </div>
      </div>
    `;
  }

  // ---------- MESAS ----------
  function renderMesas() {
    const data = getData();
    return `
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-chair" style="color:var(--primary)"></i> Vista visual de mesas</h3>
          <span style="font-size:0.8rem;color:#5f6b7a;">Verde: disponible · Naranja: reservada · Rojo: ocupada</span>
        </div>
        <div class="mesas-grid">
          ${data.mesas.map(m => {
            const label = { disponible: "Disponible", reservada: "Reservada", ocupada: "Ocupada" }[m.estado] || m.estado;
            return `<div class="mesa-item ${m.estado}"><div class="mesa-num">Mesa ${m.numero}</div><div class="mesa-estado badge badge-${m.estado}">${label}</div></div>`;
          }).join("")}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Detalle mesas</h3></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th># Mesa</th><th>Estado</th><th>Reserva / Pedido asociado</th></tr></thead>
            <tbody>
              ${data.mesas.map(m => {
                const pedido = data.pedidos.find(p => p.mesaId === m.id);
                const reserva = data.reservas.find(r => r.mesaId === m.id);
                let assoc = "-";
                if (m.estado === "reservada" && reserva) assoc = `Reserva ${reserva.fecha} ${reserva.hora} · ${reserva.personas} pers.`;
                else if (m.estado === "ocupada" && pedido) assoc = `Pedido #${pedido.id} · ${(pedido.platos||[]).length} platos`;
                return `<tr><td>Mesa ${m.numero}</td><td><span class="badge badge-${m.estado}">${m.estado}</span></td><td>${assoc}</td></tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ---------- RESERVAS ----------
  function renderReservas() {
    const data = getData();
    return `
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-calendar-check"></i> Reservas</h3>
          <button class="btn btn-primary" onclick="App.openModal('reserva')"><i class="fas fa-plus"></i> Nueva reserva</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Mesa</th><th>Fecha</th><th>Hora</th><th>Personas</th><th>Estado</th></tr></thead>
            <tbody>
              ${data.reservas.length === 0 ? `<tr><td colspan="5" style="text-align:center;color:#5f6b7a;">Sin reservas · El mesero o admin crea reservas asignando mesa, fecha, hora y personas.</td></tr>` :
                data.reservas.map(r => {
                  const mesa = data.mesas.find(m => m.id === r.mesaId);
                  return `<tr><td>Mesa ${mesa ? mesa.numero : "?"}</td><td>${formatDate(r.fecha)}</td><td>${r.hora}</td><td>${r.personas}</td><td><span class="badge badge-reservada">Reservada</span></td></tr>`;
                }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ---------- PEDIDOS ----------
  function renderPedidos() {
    const data = getData();
    return `
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-clipboard-list"></i> Pedidos</h3>
          <button class="btn btn-primary" onclick="App.openModal('pedido')"><i class="fas fa-plus"></i> Nuevo pedido</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Mesa</th><th>Platos</th><th>Estado</th><th>Acción</th></tr></thead>
            <tbody>
              ${data.pedidos.length === 0 ? `<tr><td colspan="4" style="text-align:center;color:#5f6b7a;">Sin pedidos · Se registran pedidos por mesa con uno o más platos.</td></tr>` :
                data.pedidos.map(p => {
                  const mesa = data.mesas.find(m => m.id === p.mesaId);
                  const platosStr = (p.platos || []).map(pl => `${pl.nombre} <span class="badge badge-${pl.estado}" style="font-size:0.65rem;">${pl.estado}</span>`).join(", ") || "—";
                  return `<tr><td>Mesa ${mesa ? mesa.numero : "?"}</td><td>${platosStr}</td><td><span class="badge">${p.estado || "activo"}</span></td>
                  <td><button class="btn btn-sm btn-outline" onclick="App.openModal('pedido', ${p.id})">Editar</button></td></tr>`;
                }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ---------- COCINA ----------
  function renderCocina() {
    const data = getData();
    const platos = data.pedidos.flatMap(p => (p.platos || []).map(pl => ({ ...pl, pedidoId: p.id, mesaId: p.mesaId })));
    const pendientes = platos.filter(pl => pl.estado === "pendiente");
    const preparacion = platos.filter(pl => pl.estado === "preparacion");
    const listos = platos.filter(pl => pl.estado === "listo");
    return `
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-fire" style="color:#d32f2f"></i> Cola de platos — Pendientes</h3>
          <span class="badge badge-pendiente">${pendientes.length} pendientes</span>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Plato</th><th>Pedido</th><th>Mesa</th><th>Acción</th></tr></thead><tbody>
          ${pendientes.length === 0 ? `<tr><td colspan="4" style="text-align:center;color:#5f6b7a;">Sin platos pendientes</td></tr>` :
            pendientes.map(pl => `<tr><td>${pl.nombre}</td><td>#${pl.pedidoId}</td><td>Mesa ${(() => { const m = data.mesas.find(x=>x.id===pl.mesaId); return m?m.numero:pl.mesaId; })()}</td><td><button class="btn btn-sm btn-primary" onclick="Modules.cocinaAction(${pl.pedidoId}, '${pl.nombre.replace(/'/g, "\\'")}', 'preparacion')">Preparar</button></td></tr>`).join("")}
        </tbody></table></div>
      </div>
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-blender" style="color:#f57c00"></i> En preparación</h3>
          <span class="badge badge-preparacion">${preparacion.length} en preparación</span>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Plato</th><th>Pedido</th><th>Mesa</th><th>Acción</th></tr></thead><tbody>
          ${preparacion.length === 0 ? `<tr><td colspan="4" style="text-align:center;color:#5f6b7a;">Sin platos en preparación</td></tr>` :
            preparacion.map(pl => `<tr><td>${pl.nombre}</td><td>#${pl.pedidoId}</td><td>Mesa ${(() => { const m = data.mesas.find(x=>x.id===pl.mesaId); return m?m.numero:pl.mesaId; })()}</td><td><button class="btn btn-sm" style="background:#2e7d32;color:white;" onclick="Modules.cocinaAction(${pl.pedidoId}, '${pl.nombre.replace(/'/g, "\\'")}', 'listo')">Marcar listo</button></td></tr>`).join("")}
        </tbody></table></div>
      </div>
      ${listos.length ? `<div class="card"><div class="card-header"><h3><i class="fas fa-check" style="color:#2e7d32"></i> Listos para despacho</h3><span class="badge badge-listo">${listos.length} listos</span></div><p style="color:#5f6b7a;font-size:0.85rem;">Estos platos ya pueden ser despachados desde la vista <strong>Despachos</strong>.</p></div>` : ""}
    `;
  }

  // ---------- DESPACHOS ----------
  function renderDespachos() {
    const data = getData();
    return `
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-truck"></i> Despachos — Gestión de entregas a mesas</h3>
          <button class="btn btn-primary" onclick="App.openModal('despacho')"><i class="fas fa-plus"></i> Nuevo despacho</button>
        </div>
        <p style="font-size:0.85rem;color:#5f6b7a;margin-bottom:12px;">Desde un pedido con platos <span class="badge badge-listo">listo</span> se crea un despacho; el equipo de despacho lo marca <span class="badge badge-ruta">en ruta</span> y <span class="badge badge-entregado">entregado</span>.</p>
        <div class="table-wrap"><table><thead><tr><th>Pedido</th><th>Mesa</th><th>Platos</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
          ${data.despachos.length === 0 ? `<tr><td colspan="5" style="text-align:center;color:#5f6b7a;">Sin despachos</td></tr>` :
            data.despachos.map(d => {
              const pedido = data.pedidos.find(p => p.id === d.pedidoId);
              const mesaNum = pedido ? (getData().mesas.find(m=>m.id===pedido.mesaId)?.numero || pedido.mesaId) : "?";
              const estado = d.estado || "pendiente";
              const platosStr = (d.platos || []).join(", ");
              let accion = "—";
              if (estado === "pendiente") accion = `<button class="btn btn-sm btn-primary" onclick="Modules.despachoAction(${d.id}, 'ruta')">En ruta</button>`;
              else if (estado === "ruta") accion = `<button class="btn btn-sm" style="background:#388e3c;color:white;" onclick="Modules.despachoAction(${d.id}, 'entregado')">Entregar</button>`;
              else if (estado === "entregado") accion = `<span style="color:#388e3c;font-weight:600;"><i class="fas fa-check"></i> Entregado</span>`;
              return `<tr><td>#${d.pedidoId}</td><td>Mesa ${mesaNum}</td><td>${platosStr}</td><td><span class="badge badge-${estado}">${estado}</span></td><td>${accion}</td></tr>`;
            }).join("")}
        </tbody></table></div>
      </div>
    `;
  }

  // ---------- USUARIOS (solo admin) ----------
  function renderUsuarios() {
    return `
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-users-cog"></i> Administración de usuarios</h3></div>
        <p style="color:#5f6b7a;margin-bottom:12px;">Usuarios demo:</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Usuario</th><th>Contraseña</th><th>Rol</th><th>Acceso</th></tr></thead>
            <tbody>
              <tr><td><code>admin</code></td><td><code>admin123</code></td><td><span class="badge" style="background:#1e2a3a;color:white;">Administrador</span></td><td>Panel completo: mesas, reservas, pedidos, despachos y usuarios</td></tr>
              <tr><td><code>mesero</code></td><td><code>mesero123</code></td><td><span class="badge" style="background:#b8860b;color:white;">Mesero</span></td><td>Mesas, reservas, pedidos y despachos</td></tr>
              <tr><td><code>cocina</code></td><td><code>cocina123</code></td><td><span class="badge badge-preparacion">Cocina</span></td><td>Cola de platos pendientes y en preparación</td></tr>
              <tr><td><code>despacho</code></td><td><code>despacho123</code></td><td><span class="badge badge-ruta">Despacho</span></td><td>Gestión de entregas a mesas</td></tr>
            </tbody>
          </table>
        </div>
        <div style="margin-top:18px; display:flex; gap:12px; flex-wrap:wrap;">
          <button class="btn btn-danger" onclick="Modules.resetData()"><i class="fas fa-undo-alt"></i> Resetear datos demo</button>
          <button class="btn btn-outline" onclick="Modules.exportData()"><i class="fas fa-download"></i> Exportar JSON</button>
          <label class="btn btn-outline" style="cursor:pointer;"><i class="fas fa-upload"></i> Importar JSON <input type="file" id="importFile" accept=".json" style="display:none;" onchange="Modules.importData(event)"></label>
        </div>
        <p style="margin-top:12px;color:#5f6b7a;font-size:0.8rem;">El reset restaura 8 mesas y 8 platos. Exportar/importar permite respaldo.</p>
      </div>
    `;
  }

  // ---------- ACCIONES con validación de transición ----------
  const ESTADOS_PLATO = ["pendiente","preparacion","listo"];
  const ESTADOS_DESPACHO = ["pendiente","ruta","entregado"];
  function cocinaAction(pedidoId, platoNombreRaw, nuevoEstado) {
    const platoNombre = Storage.sanitizeInput(platoNombreRaw);
    if (!ESTADOS_PLATO.includes(nuevoEstado)) { console.warn("Estado plato inválido", nuevoEstado); return; }
    if (!Storage.isValidText(platoNombre,60)) return;
    const data = getData();
    const pedido = data.pedidos.find(p => p.id === pedidoId);
    if (!pedido) { console.warn("pedidoId no existe", pedidoId); return; }
    const plato = (pedido.platos || []).find(pl => pl.nombre === platoNombre);
    if (!plato) { console.warn("plato no encontrado", platoNombre); return; }
    // Validar transición permitida: pendiente->preparacion->listo
    const idxActual = ESTADOS_PLATO.indexOf(plato.estado);
    const idxNuevo = ESTADOS_PLATO.indexOf(nuevoEstado);
    if (idxNuevo !== idxActual + 1) { alert(`Transición no permitida: ${plato.estado} → ${nuevoEstado}`); return; }
    plato.estado = nuevoEstado;
    plato.actualizadoPor = Auth.getCurrentUser()?.username || "anon";
    Storage.save();
    App.refresh();
  }

  function despachoAction(despachoId, nuevoEstado) {
    if (!ESTADOS_DESPACHO.includes(nuevoEstado)) { console.warn("Estado despacho inválido", nuevoEstado); return; }
    const data = getData();
    const despacho = data.despachos.find(d => d.id === despachoId);
    if (!despacho) { console.warn("despachoId no existe", despachoId); return; }
    const idxActual = ESTADOS_DESPACHO.indexOf(despacho.estado);
    const idxNuevo = ESTADOS_DESPACHO.indexOf(nuevoEstado);
    if (idxNuevo !== idxActual + 1) { alert(`Transición no permitida: ${despacho.estado} → ${nuevoEstado}`); return; }
    despacho.estado = nuevoEstado;
    despacho.actualizadoPor = Auth.getCurrentUser()?.username || "anon";
    if (nuevoEstado === "entregado") {
      const pedido = data.pedidos.find(p => p.id === despacho.pedidoId);
      if (pedido) {
        const mesa = data.mesas.find(m => m.id === pedido.mesaId);
        const despachosPedido = data.despachos.filter(d => d.pedidoId === pedido.id);
        if (despachosPedido.every(d => d.estado === "entregado")) {
          if (mesa) mesa.estado = "disponible";
        }
      }
    }
    Storage.save();
    App.refresh();
  }

  function resetData() {
    if (!confirm("¿Resetear todos los datos a valores demo? Se borrarán reservas, pedidos y despachos.")) return;
    Storage.reset();
    App.refresh();
  }

  function exportData() {
    const data = getData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `resto-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 500*1024) { alert("Archivo muy grande (>500KB)"); return; }
    if (!file.name.endsWith(".json")) { alert("Solo se permiten .json"); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        // Validación estricta antes de aceptar importación (anti inyección)
        if (!Storage.validateStructure(parsed)) throw new Error("Estructura inválida — se esperaban 8 mesas / 8 platos y estados permitidos. Posible archivo manipulado.");
        // Sanitizar textos importados
        parsed.reservas.forEach(r => { r.fecha = Storage.sanitizeInput(String(r.fecha||"")); r.hora = Storage.sanitizeInput(String(r.hora||"")); });
        parsed.pedidos.forEach(p => p.platos?.forEach(pl => pl.nombre = Storage.sanitizeInput(pl.nombre)));
        Storage.secureSet(Storage.STORAGE_KEY, parsed);
        Storage.load();
        App.refresh();
        alert("Datos importados correctamente");
      } catch (err) { alert("Error al importar: " + err.message); }
    };
    reader.readAsText(file);
  }

  // ---------- MODALES ----------
  function getModalHTML(type, id) {
    const data = getData();
    if (type === "reserva") {
      const disponibles = data.mesas.filter(m => m.estado === "disponible");
      if (disponibles.length === 0) {
        return `<h3>Nueva reserva</h3><p style="color:#b23c1c;"><i class="fas fa-exclamation-triangle"></i> No hay mesas disponibles. Libere una mesa o use una ocupada para pedido directo.</p><button class="btn" onclick="App.closeModal()">Cerrar</button>`;
      }
      return `
        <h3><i class="fas fa-calendar-plus"></i> Nueva reserva</h3>
        <p style="font-size:0.85rem;color:#5f6b7a;margin-bottom:12px;">El mesero o admin crea reservas asignando mesa, fecha, hora y personas.</p>
        <div class="form-group"><label>Mesa</label><select id="modalMesa">${disponibles.map(m=>`<option value="${m.id}">Mesa ${m.numero} — ${m.estado}</option>`).join("")}</select></div>
        <div class="form-row">
          <div class="form-group"><label>Fecha</label><input type="date" id="modalFecha" value="${new Date().toISOString().slice(0,10)}"></div>
          <div class="form-group"><label>Hora</label><input type="time" id="modalHora" value="20:00"></div>
        </div>
        <div class="form-group"><label>Personas</label><input type="number" id="modalPersonas" value="2" min="1" max="12"></div>
        <button class="btn btn-primary" onclick="Modules.saveReserva()"><i class="fas fa-save"></i> Guardar reserva</button>
      `;
    } else if (type === "pedido") {
      const pedido = id ? data.pedidos.find(p => p.id === id) : null;
      // permitir cualquier mesa, pero sugerir ocupada/reservada
      const mesaId = pedido ? pedido.mesaId : (data.mesas.find(m => m.estado === "ocupada")?.id || data.mesas.find(m=>m.estado==="reservada")?.id || data.mesas[0]?.id);
      // reset temp si es nuevo
      if (!pedido) platosTemp = [];
      else platosTemp = (pedido.platos || []).map(p => ({ ...p }));
      return `
        <h3><i class="fas fa-clipboard-list"></i> ${pedido ? "Editar" : "Nuevo"} pedido</h3>
        <p style="font-size:0.85rem;color:#5f6b7a;margin-bottom:12px;">Se registran pedidos por mesa con uno o más platos.</p>
        <div class="form-group"><label>Mesa</label><select id="modalMesaPedido">${data.mesas.map(m=>`<option value="${m.id}" ${m.id===mesaId?"selected":""}>Mesa ${m.numero} — ${m.estado}</option>`).join("")}</select></div>
        <div class="form-group"><label>Platos (seleccionar)</label><select id="modalPlatoSelect">${data.platos.map(p=>`<option value="${p.id}">${p.nombre} — $${p.precio.toFixed(2)}</option>`).join("")}</select></div>
        <button class="btn btn-sm btn-outline" onclick="Modules.addPlatoPedido()"><i class="fas fa-plus"></i> Agregar plato</button>
        <div id="platosAgregados" style="margin:12px 0; display:flex; flex-wrap:wrap; gap:6px;">${platosTemp.map(pl=>`<span class="badge badge-pendiente">${pl.nombre} <span style="font-weight:400;">(${pl.estado})</span></span>`).join("") || '<span style="color:#5f6b7a;font-size:0.85rem;">Ningún plato agregado</span>'}</div>
        <button class="btn btn-primary" onclick="Modules.savePedido(${id || "null"})"><i class="fas fa-save"></i> Guardar pedido</button>
      `;
    } else if (type === "despacho") {
      const pedidosConListos = data.pedidos.filter(p => (p.platos || []).some(pl => pl.estado === "listo"));
      if (pedidosConListos.length === 0) {
        return `<h3>Nuevo despacho</h3><p style="color:#5f6b7a;">No hay pedidos con platos <span class="badge badge-listo">listo</span>. Pase platos por Cocina primero.</p><button class="btn" onclick="App.closeModal()">Cerrar</button>`;
      }
      return `
        <h3><i class="fas fa-truck"></i> Nuevo despacho</h3>
        <p style="font-size:0.85rem;color:#5f6b7a;margin-bottom:12px;">Desde un pedido con platos listos se crea un despacho.</p>
        <div class="form-group"><label>Pedido</label><select id="modalPedidoDespacho">${pedidosConListos.map(p=>{ const mesa=data.mesas.find(m=>m.id===p.mesaId); const count=(p.platos||[]).filter(pl=>pl.estado==="listo").length; return `<option value="${p.id}">Pedido #${p.id} — Mesa ${mesa?mesa.numero:p.mesaId} — ${count} platos listos</option>`}).join("")}</select></div>
        <button class="btn btn-primary" onclick="Modules.saveDespacho()"><i class="fas fa-save"></i> Crear despacho</button>
      `;
    }
    return "<p>Modal no disponible</p>";
  }

  function saveReserva() {
    const data = getData();
    const mesaId = parseInt(document.getElementById("modalMesa")?.value);
    const fechaRaw = document.getElementById("modalFecha")?.value || "";
    const horaRaw = document.getElementById("modalHora")?.value || "";
    const personasRaw = document.getElementById("modalPersonas")?.value || "";
    const personas = parseInt(personasRaw);

    // Sanitización y validación exhaustiva (vista por rol ya filtró acceso)
    const fecha = Storage.sanitizeInput(fechaRaw);
    const hora = Storage.sanitizeInput(horaRaw);
    if (!Storage.isValidNumber(mesaId,1,100)) { alert("Mesa inválida"); return; }
    if (!Storage.isValidDate(fecha)) { alert("Fecha inválida o en el pasado (use YYYY-MM-DD ≥ hoy)"); return; }
    if (!Storage.isValidTime(hora)) { alert("Hora inválida (HH:MM 00-23)"); return; }
    if (!Storage.isValidNumber(personas,1,12)) { alert("Personas debe ser 1-12"); return; }

    const mesa = data.mesas.find(m => m.id === mesaId);
    if (!mesa) { alert("Mesa no existe"); return; }
    if (mesa.estado !== "disponible") { alert("Mesa no disponible — elija otra (verde)"); return; }

    // Anti solapamiento: misma mesa misma fecha+hora ya reservada
    const solapa = data.reservas.some(r => r.mesaId === mesaId && r.fecha === fecha && r.hora === hora);
    if (solapa) { alert("Ya existe una reserva para esa mesa en esa fecha/hora"); return; }

    // Validar capacidad: no exceder capacidad de la mesa
    if (mesa.capacidad && personas > mesa.capacidad) {
      if (!confirm(`La mesa ${mesa.numero} es para ${mesa.capacidad} pers. (usted puso ${personas}). ¿Continuar?`)) return;
    }

    const nuevaReserva = {
      id: Date.now(),
      mesaId, fecha, hora, personas,
      estado: "reservada",
      creadoPor: (Auth.getCurrentUser()?.username || "desconocido"),
      creadoEn: new Date().toISOString()
    };
    // Validar estructura antes de guardar
    if (!nuevaReserva.id || !nuevaReserva.mesaId) { alert("Error interno de reserva"); return; }
    data.reservas.push(nuevaReserva);
    mesa.estado = "reservada";
    Storage.save();
    // Verificar persistencia
    if (!Storage.validateStructure(Storage.getData())) console.warn("Estructura post-reserva inválida");
    App.closeModal();
    App.refresh();
  }

  function addPlatoPedido() {
    const data = getData();
    const platoId = parseInt(document.getElementById("modalPlatoSelect").value);
    const plato = data.platos.find(p => p.id === platoId);
    if (!plato) return;
    if (!platosTemp.find(p => p.id === plato.id)) {
      platosTemp.push({ ...plato, estado: "pendiente" });
      const container = document.getElementById("platosAgregados");
      if (container) container.innerHTML = platosTemp.map(pl => `<span class="badge badge-pendiente">${pl.nombre} <span style="font-weight:400;">(${pl.estado})</span></span>`).join("");
    }
  }

  function savePedido(id) {
    const data = getData();
    const mesaId = parseInt(document.getElementById("modalMesaPedido")?.value);
    if (!Storage.isValidNumber(mesaId,1,100)) { alert("Seleccione mesa válida"); return; }
    if (platosTemp.length === 0 && !id) { alert("Agregue al menos un plato"); return; }
    // Validar cada plato en buffer (anti inyección)
    for (const pl of platosTemp) {
      if (!Storage.isValidText(pl.nombre, 60)) { alert("Plato inválido: " + pl.nombre); return; }
      if (typeof pl.precio !== "number" || pl.precio < 0) { alert("Precio inválido"); return; }
      const master = data.platos.find(x => x.id === pl.id);
      if (!master) { alert("Plato no existe en menú"); return; }
    }

    const mesa = data.mesas.find(m => m.id === mesaId);
    if (!mesa) { alert("Mesa no existe"); return; }
    if (!id && mesa.estado === "reservada") {
      // Permitir convertir reserva en pedido, pero advertir
      // Si mesa reservada y sin reserva del día, igual permitir
    }

    if (id) {
      const pedido = data.pedidos.find(p => p.id === id);
      if (!pedido) { alert("Pedido no encontrado"); return; }
      // Validar que edición no vacíe pedido
      if (platosTemp.length) {
        // Sanitizar nombres al guardar
        pedido.platos = platosTemp.map(pl => ({ id: pl.id, nombre: Storage.sanitizeInput(pl.nombre), precio: pl.precio, estado: pl.estado || "pendiente" }));
      }
      pedido.mesaId = mesaId;
      pedido.actualizadoEn = new Date().toISOString();
      pedido.actualizadoPor = Auth.getCurrentUser()?.username || "anon";
    } else {
      const nuevoPedido = {
        id: Date.now(),
        mesaId,
        platos: platosTemp.map(pl => ({ id: pl.id, nombre: Storage.sanitizeInput(pl.nombre), precio: pl.precio, estado: "pendiente" })),
        estado: "activo",
        creadoEn: new Date().toISOString(),
        creadoPor: Auth.getCurrentUser()?.username || "anon"
      };
      data.pedidos.push(nuevoPedido);
      mesa.estado = "ocupada";
    }
    platosTemp = [];
    Storage.save();
    if (!Storage.validateStructure(Storage.getData())) console.warn("Estructura post-pedido inválida");
    App.closeModal();
    App.refresh();
  }

  function saveDespacho() {
    const data = getData();
    const pedidoId = parseInt(document.getElementById("modalPedidoDespacho")?.value);
    if (!Storage.isValidNumber(pedidoId,1,Number.MAX_SAFE_INTEGER)) { alert("Pedido inválido"); return; }
    const pedido = data.pedidos.find(p => p.id === pedidoId);
    if (!pedido) { alert("Pedido no existe"); return; }
    const platosListos = (pedido.platos || []).filter(pl => pl.estado === "listo").map(pl => Storage.sanitizeInput(pl.nombre));
    if (platosListos.length === 0) { alert("No hay platos en estado listo para despachar"); return; }
    // Validar que platos listos no estén vacíos por inyección
    if (platosListos.some(n => !Storage.isValidText(n,60))) { alert("Nombre de plato inválido"); return; }
    const yaExiste = data.despachos.some(d => d.pedidoId === pedidoId && d.estado !== "entregado");
    if (yaExiste) { if (!confirm("Ya existe un despacho activo para este pedido. ¿Crear otro?")) return; }
    const nuevoDespacho = {
      id: Date.now(),
      pedidoId,
      platos: platosListos,
      estado: "pendiente",
      creadoEn: new Date().toISOString(),
      creadoPor: Auth.getCurrentUser()?.username || "anon"
    };
    data.despachos.push(nuevoDespacho);
    Storage.save();
    if (!Storage.validateStructure(Storage.getData())) console.warn("Estructura post-despacho inválida");
    App.closeModal();
    App.refresh();
  }

  return {
    renderDashboard,
    renderMesas,
    renderReservas,
    renderPedidos,
    renderCocina,
    renderDespachos,
    renderUsuarios,
    cocinaAction,
    despachoAction,
    resetData,
    exportData,
    importData,
    getModalHTML,
    saveReserva,
    addPlatoPedido,
    savePedido,
    saveDespacho
  };
})();
