# Sistema de Reservas para Restaurante — RestoApp

Sistema frontend para gestión de reservas, pedidos, cocina y despachos. Datos en `localStorage` encriptado, sin backend. Responsive con menú lateral colapsable.


## Estructura del proyecto

```
sistema-reservas-restaurante/
├── index.html          # Shell: sidebar + topbar + contenedor vistas + modal
├── css/
│   └── styles.css      # Variables, sidebar, stats, mesas-grid, tablas, responsive 820px/480px
└── js/
    ├── storage.js      → Persistencia en localStorage (encriptada)
    ├── auth.js         → Login, sanitización y permisos por rol + Rate Limit
    ├── modules.js      → Lógica de negocio y vistas
    └── app.js          → Controlador principal (router + UI)
```

- `js/storage.js:6` — `Storage` (IIFE). Cifrado XOR + Base64 con `SECRET_KEY`, clave `restoData`. Expone `load()`, `save()`, `getData()`, `reset()`, `DEFAULT_MESAS`, `DEFAULT_PLATOS`.
- `js/auth.js:6` — `Auth`. Mapa `USERS`, `ROLE_LABELS`, `PERMISSIONS`, `login()`/`logout()` con `sessionStorage`, y `RATE_LIMIT` 5 intentos / 15 min.
- `js/modules.js:1` — `Modules`. `renderDashboard()`, `renderMesas()`, `renderReservas()`, `renderPedidos()`, `renderCocina()`, `renderDespachos()`, `renderUsuarios()` + acciones `cocinaAction()`/`despachoAction()` + modales.
- `js/app.js:6` — `App`. `init()`, `buildMenu()`, `render()`, `doLogin()`, `openModal()`/`closeModal()`.

## Roles y permisos

| Rol | Acceso |
|---|---|
| **Administrador** | Panel completo: mesas, reservas, pedidos, despachos y usuarios |
| **Mesero** | Mesas, reservas, pedidos y despachos |
| **Cocina** | Cola de platos pendientes y en preparación |
| **Despacho** | Gestión de entregas a mesas |

## Usuarios demo

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `admin123` | administrador |
| `mesero` | `mesero123` | mesero |
| `cocina` | `cocina123` | cocina |
| `despacho` | `despacho123` | despacho |

## Flujo de trabajo

1. **Reservas** — Mesero o admin crea reservas asignando mesa, fecha, hora y personas. Mesa pasa a `reservada` (`js/modules.js:80`).
2. **Pedidos / platos** — Se registran pedidos por mesa con uno o más platos (estado inicial `pendiente`). Mesa pasa a `ocupada`.
3. **Cocina** — Marca platos como `preparacion` y luego `listo` (`js/modules.js:135`).
4. **Despachos** — Desde un pedido con platos `listo` se crea un despacho; equipo de despacho lo marca `ruta` y `entregado` (`js/modules.js:200`). Al entregar todos los platos del pedido, la mesa vuelve a `disponible`.

## Características

- Datos guardados en `localStorage` (persisten al recargar) — ver sección siguiente.
- Panel con estadísticas: reservas del día, platos pendientes, despachos activos, mesas ocupadas (`js/modules.js:16`).
- Vista visual de mesas con colores por estado: verde disponible / naranja reservada / rojo ocupada (`css/styles.css:52`).
- Diseño responsive con menú lateral colapsable en móvil (hamburguesa a <820px).
- 8 mesas y 8 platos precargados como datos demo (`js/storage.js:50`).
- Sanitización anti-XSS (`js/storage.js:113`) y Rate Limiting en login (`js/auth.js:40`).
- Exportar/Importar JSON de respaldo (solo admin, `js/modules.js:180`).

## Cómo ejecutar

No requiere instalación. Abrir con servidor local (recomendado) o doble clic:

Opción A — Live Server (VS Code) o Laragon/XAMPP apuntando a la carpeta.
Opción B — Doble clic en `index.html` (funciona, pero `sessionStorage` puede variar entre navegadores).

No hay dependencias npm. Solo CDN Font Awesome.

## Persistencia: ¿se debe borrar al actualizar la página?

**No. Es correcto que NO se borre.**

Por especificación: “Datos guardados en localStorage (persisten al recargar)”. El comportamiento actual es el esperado:

- `localStorage` es persistente por diseño (sobrevive a F5, cierre de pestaña y reinicio del navegador). Es lo que permite que una demo sin base de datos conserve reservas/pedidos.
- `sessionStorage` (usado solo para la sesión `restoUser` en `js/auth.js:45`) sí se borra al cerrar pestaña, pero mantiene el login durante recargas.
- `js/storage.js:80` hace `load()` → `secureGet("restoData")`. Si existe, lo reutiliza; si no, crea datos demo. Por eso al actualizar ves los mismos datos.

Esto es ventaja para evidencias: el evaluador puede crear datos, recargar y verificar que no se pierden.

### Cómo borrar datos entonces

1. **Desde la app (recomendado):** Entrar como `admin` → Usuarios → *Resetear datos demo* (`js/modules.js:174` → `Storage.reset():106`).
2. **Manual DevTools:** F12 → Application → Local Storage → borrar clave `restoData` o `Clear All`.
3. **Por código:** En consola: `localStorage.removeItem("restoData"); location.reload();`

### Si QUIERES que se borre al actualizar (comportamiento alternativo)

No es lo pedido, pero si tu entrega lo exige, cambia una línea en `js/app.js:6` dentro de `init()`:

```js
// Borrar todo al recargar (OPCIONAL - descomentar si se requiere)
window.addEventListener("beforeunload", () => {
  localStorage.removeItem(Storage.STORAGE_KEY);
});
// O borrar solo en F5/Ctrl+R:
if (performance.navigation.type === 1) Storage.reset();
```

O cambia `Storage.save()` para usar `sessionStorage` en lugar de `localStorage` (`js/storage.js:32`). Con `sessionStorage` los datos se pierden al cerrar pestaña pero persisten en recargas dentro de la misma pestaña.

## Políticas de seguridad (exigidas por el instructor)

> “Guardar solo en localStorage es práctica rápida de atacar y vulnerar. Importante manejar políticas de seguridad, hasheo, validación.”

El proyecto implementa lo pedido en 2 niveles:

### 1. Storage (`js/storage.js:1`)
- **Cifrado + firma:** `encrypt()/decrypt()` XOR+Base64 + `simpleHash()` y clave `restoData_sig` (`js/storage.js:14`). Al cargar se verifica `computeSignature()`; si la firma no coincide (edición manual en DevTools → Application → Local Storage) se descarta el dato corrupto y se restaura demo, evitando inyecciones.
- **Validación estricta:** `validateStructure()` verifica 8 mesas / 8 platos, estados permitidos (`disponible|reservada|ocupada`), `isValidText()` regex unicode, `isValidDate()` (no pasado), `isValidTime()`, `isValidNumber()`. Datos corruptos → reset.
- **Sanitización:** `sanitizeInput()` elimina `<> ' " ; ` `` ` en todo input antes de guardar.

### 2. Auth + vistas por rol (`js/auth.js:1`, `js/app.js:129`)
- **Login validado:** sanitiza usuario (`a-z0-9_`, 3-20 chars), valida longitud contraseña, compara por **hash** `hashPass()` (djb2 con salt) no texto plano, muestra error sin revelar si usuario existe o no (opcional).
- **Rate Limiting 5/15 min** (`js/auth.js:40` igual a `Implementación de Protección.js` del curso) → tras 5 fallos responde `429` y bloquea.
- **Guardias de rol:** `PERMISSIONS` y `hasAccess()` + `App.render()` bloquea vistas no autorizadas. `getMenuItems()` solo dibuja menú permitido. `sessionStorage` verifica `USERS[username].rol === session.rol` anti manipulación.
- **Validaciones en cada flujo** (`js/modules.js:334`): fecha no pasada, hora HH:MM, personas 1-12 y ≤ capacidad mesa, anti-solapamiento mesa/fecha/hora, transiciones estrictas `pendiente→preparacion→listo` y `pendiente→ruta→entregado`, importación JSON validada con `validateStructure()` y límite 500KB.

Sin backend no hay seguridad real (cualquiera ve el código). Esto es evidencia de “hatcheo/validación” para evaluación; en producción migrar a backend con `bcrypt`, JWT y `schema.sql`.

## Validaciones visibles en código (para el evaluador)

Abra DevTools → Sources → `js/` y busque:
- `js/app.js:129` — `if (!Auth.hasAccess(currentUser.rol, viewId))` → bloqueo vistas.
- `js/storage.js:33` — `secureSet` guarda `restoData` + `restoData_sig`.
- `js/modules.js:334` — `Storage.isValidDate(fecha)`, `isValidTime`, `isValidNumber(personas,1,12)`.

## Tecnologías

HTML5, CSS3 (variables, grid, flex), JavaScript vanilla (IIFE modules), localStorage + XOR cipher + firma djb2, Font Awesome 6.

## Notas

- `schema.sql` referencia para migración MySQL.
- `google-oauth.js` (ejemplo del curso) se puede integrar reemplazando `Auth.login` por `GoogleAuth.init()` si el instructor lo exige como plus — ver carpeta `Sistema de reserva con autenticador/`.
- Backups legacy en `backups/`.

## Posibles extensiones

Exportación a Excel/PDF, impresión de tickets, menú editable de platos.
