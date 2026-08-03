// ============================================================
// ===== app.js — VERSIÓN ESTABLE Y PROFESIONAL =====
// ============================================================

const ADMIN_PASSWORD = 'LedZepp1';
let usuarioActual = null;
let usuariosCache = [];
let pedidosCache = [];
let clientesCache = [];
let historialLiquidaciones = [];
let liquidacionAdmin = { total: 0, historial: [] };
let ultimoPedidoPendiente = null;
let geolocationWatchId = null;
let geolocationActive = false;
// Polling para actualización periódica cuando no hay escucha en tiempo real
let adminPollingId = null;
let userPollingId = null;
let pollingIntervalMs = 7000; // intervalo por defecto (7s). Cambiar a 5000-10000 según prefieras

// ============================================================
// ===== HELPER PARA FIREBASE =====
// ============================================================

function fb() {
    const f = window.firebaseFunctions;
    if (!f) {
        console.error('❌ Firebase no cargado');
        return null;
    }
    return f;
}

// ============================================================
// ===== ACTIVAR SONIDO POR INTERACCIÓN =====
// ============================================================

let sonidoActivadoPorUsuario = false;

function activarSonidoGlobal() {
    if (sonidoActivadoPorUsuario) return;
    const f = fb();
    if (f && f.prepararAudio) {
        const ok = f.prepararAudio();
        if (ok) {
            sonidoActivadoPorUsuario = true;
            console.log('🔊 Sonido activado por interacción');
        }
    }
}

// Eventos que activan el sonido (solo si el usuario interactúa)
document.addEventListener('click', function(e) {
    if (!e.target.closest('[onclick*="activarSonido"]')) {
        activarSonidoGlobal();
    }
});

document.addEventListener('touchstart', function(e) {
    if (!e.target.closest('[onclick*="activarSonido"]')) {
        activarSonidoGlobal();
    }
});

// ============================================================
// ===== SESIÓN =====
// ============================================================

function guardarSesionAdmin(e) { sessionStorage.setItem('admin', JSON.stringify(e)); }
function obtenerSesionAdmin() { return JSON.parse(sessionStorage.getItem('admin') || 'false'); }
function guardarSesionUsuario(u) { sessionStorage.setItem('usuario', JSON.stringify(u)); }
function obtenerSesionUsuario() { return JSON.parse(sessionStorage.getItem('usuario') || 'null'); }
function limpiarSesion() { sessionStorage.removeItem('admin'); sessionStorage.removeItem('usuario'); }

// ============================================================
// ===== LOGIN ADMIN =====
// ============================================================

async function loginAdmin() {
    const pass = document.getElementById('adminPassword').value;
    if (pass === ADMIN_PASSWORD) {
        guardarSesionAdmin(true);
        const loginSection = document.getElementById('loginSection');
        const adminPanel = document.getElementById('adminPanel');
        if (loginSection) loginSection.style.display = 'none';
        if (adminPanel) adminPanel.style.display = 'block';
        await cargarDatosAdmin();
        iniciarPollingAdmin();
        document.getElementById('adminPassword').value = '';
        const errorEl = document.getElementById('loginError');
        if (errorEl) errorEl.textContent = '';
    } else {
        const errorEl = document.getElementById('loginError');
        if (errorEl) errorEl.textContent = '❌ Clave incorrecta';
    }
}

function logout() {
    if (!confirm('¿Cerrar sesión?')) return;
    limpiarSesion();
    detenerSeguimientoUbicacion();
    const f = fb();
    if (f) f.dejarDeEscuchar();
    detenerTodosPolling();
    const loginSection = document.getElementById('loginSection');
    const adminPanel = document.getElementById('adminPanel');
    if (loginSection) loginSection.style.display = 'block';
    if (adminPanel) adminPanel.style.display = 'none';
}

// ============================================================
// ===== LOGIN USUARIO =====
// ============================================================

async function loginUsuario() {
    const username = document.getElementById('userLogin').value;
    const password = document.getElementById('userPass').value;
    const errorEl = document.getElementById('userLoginError');
    
    try {
        const f = fb();
        if (!f) {
            if (errorEl) errorEl.textContent = '❌ Error de conexión';
            return;
        }
        
        const usuarios = await f.getUsuarios();
        const usuario = usuarios.find(u => u.username === username && u.password === password);
        
        if (usuario) {
            usuarioActual = usuario;
            window.usuarioActual = usuario;
            guardarSesionUsuario(usuario);
            
            const loginSection = document.getElementById('loginUsuarioSection');
            const panel = document.getElementById('usuarioPanel');
            if (loginSection) loginSection.style.display = 'none';
            if (panel) panel.style.display = 'block';
            
            if (errorEl) errorEl.textContent = '';
            await cargarPanelUsuario(usuario);
            iniciarPollingUsuario(usuario.id);
        } else {
            if (errorEl) errorEl.textContent = '❌ Usuario o contraseña incorrectos';
        }
    } catch (error) {
        console.error('Error en login:', error);
        if (errorEl) errorEl.textContent = '❌ Error de conexión';
    }
}

function logoutUsuario() {
    const idPrevio = usuarioActual ? usuarioActual.id : null;
    usuarioActual = null;
    window.usuarioActual = null;
    limpiarSesion();
    detenerSeguimientoUbicacion();
    const f = fb();
    if (f) f.dejarDeEscuchar();
    if (f && idPrevio !== null && f.dejarDeEscucharUsuario) f.dejarDeEscucharUsuario(idPrevio);
    detenerTodosPolling();
    
    const loginSection = document.getElementById('loginUsuarioSection');
    const panel = document.getElementById('usuarioPanel');
    if (loginSection) loginSection.style.display = 'block';
    if (panel) panel.style.display = 'none';
}

// ============================================================
// ===== CARGAR DATOS ADMIN =====
// ============================================================

async function cargarDatosAdmin() {
    try {
        const f = fb();
        if (f) pedidosCache = await f.getPedidos(); // precargar para que los totales de liquidación salgan bien en el primer render
        await cargarUsuarios();
        await cargarPedidos();
        await cargarClientes();
        await cargarHistorial();
        await cargarLiquidacionAdmin();
    } catch (e) { console.error('Error cargando datos admin:', e); }
}

async function cargarUsuarios() {
    const f = fb();
    if (!f) return;
    usuariosCache = await f.getUsuarios();
    renderUsuarios(usuariosCache);
}

async function cargarPedidos() {
    const f = fb();
    if (!f) return;
    pedidosCache = await f.getPedidos();
    renderPedidosAdmin(pedidosCache);
    
    const sel = document.getElementById('usuarioAsignado');
    if (sel) {
        const valorPrevio = sel.value;
        const activos = usuariosCache.filter(u => u.activo);
        sel.innerHTML = '<option value="">Sin asignar</option>' +
            activos.map(u => `<option value="${u.id}">${u.nombre} (${u.vehiculo})</option>`).join('');
        if (valorPrevio && activos.some(u => String(u.id) === valorPrevio)) sel.value = valorPrevio;
    }
}

async function cargarClientes() {
    const f = fb();
    if (!f) return;
    clientesCache = await f.getClientes();
    renderClientes(clientesCache);
    
    const sel = document.getElementById('clienteOrigen');
    if (sel) {
        const valorPrevio = sel.value;
        const activos = clientesCache.filter(c => c.activo);
        sel.innerHTML = '<option value="">Seleccionar cliente</option>' +
            activos.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        if (valorPrevio && activos.some(c => String(c.id) === valorPrevio)) sel.value = valorPrevio;
    }
}

async function cargarHistorial() {
    const f = fb();
    if (!f) return;
    historialLiquidaciones = await f.getHistorial();
}

async function cargarLiquidacionAdmin() {
    const f = fb();
    if (!f) return;
    liquidacionAdmin = await f.getLiquidacionAdmin();
    const el = document.getElementById('totalAdmin');
    if (el) el.textContent = '$' + (liquidacionAdmin.total || 0);
}

// ============================================================
// ===== RENDER =====
// ============================================================

function renderUsuarios(usuarios) {
    const container = document.getElementById('listaUsuarios');
    if (!container) return;
    if (!usuarios || usuarios.length === 0) {
        container.innerHTML = '<div class="list-shell"><p>No hay usuarios</p></div>';
        return;
    }
    container.innerHTML = `
        <div class="list-shell">
            <div class="list-section-title">Repartidores</div>
            ${usuarios.map(u => {
                const estado = u.activo ? (u.disponible ? '🟢 Disponible' : '⏸️ No disponible') : '❌ Inactivo';
                const calificacion = u.calificacion ? `${'★'.repeat(u.calificacion)} (${u.calificacion}/5)` : 'Sin calificación';
                const ubicacion = u.ubicacion ? `${u.ubicacion.lat.toFixed(4)}, ${u.ubicacion.lng.toFixed(4)}` : 'Sin GPS';
                const gpsStatus = u.gpsActiva ? '🛰️ GPS activo' : '⚠️ GPS inactivo';
                const { pedidosActivos, ajustes, totalAjustes, totalGeneral } = calcularLiquidacion(u.id, pedidosCache, u.ajustesLiquidacion);
                const ajustesLabel = ajustes.length > 0 ? `✏️ Ajustes: ${ajustes.length} · ${totalAjustes > 0 ? '+' : ''}$${totalAjustes}` : '✏️ Sin ajustes';
                return `
                    <div class="list-row">
                        <div class="list-row-main" style="display:flex;align-items:center;">
                            <span style="font-size:1.4rem;margin-right:10px;">👤</span>
                            <div>
                                <strong>${u.nombre}</strong>
                                <div>👤 @${u.username}</div>
                                <div>🚗 ${u.vehiculo}</div>
                                <div>💰 $${totalGeneral} · 📦 ${pedidosActivos.length}</div>
                                <div>${ajustesLabel}</div>
                                <div>⭐ ${calificacion}</div>
                                <div>📍 ${ubicacion}</div>
                                <div>${gpsStatus}</div>
                                <div class="badge ${u.activo && u.disponible ? 'badge-active' : 'badge-inactive'}">${estado}</div>
                            </div>
                        </div>
                        <div class="list-row-actions">
                            <button onclick="toggleUsuarioActivo(${u.id})" class="${u.activo ? 'btn-danger' : 'btn-success'}">${u.activo ? 'Desactivar' : 'Activar'}</button>
                            <button onclick="toggleDisponibilidadAdmin(${u.id})" class="${u.disponible ? 'btn-secondary' : 'btn-success'}" ${!u.activo ? 'disabled' : ''}>${u.disponible ? '⏸️ Pausar' : '▶️ Activar'}</button>
                            <button onclick="calificarUsuario(${u.id})" class="btn-secondary">⭐ Calificar</button>
                            <button onclick="verLiquidacionDetalle(${u.id})" class="btn-primary">💰 Liquidación</button>
                            <button onclick="ajustarLiquidacion(${u.id})" class="btn-secondary">✏️ Ajustar</button>
                            <button onclick="eliminarUsuario(${u.id})" class="btn-danger">Eliminar</button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderClientes(clientes) {
    const container = document.getElementById('listaClientes');
    if (!container) return;
    if (!clientes || clientes.length === 0) {
        container.innerHTML = '<div class="list-shell"><p>No hay clientes</p></div>';
        return;
    }
    container.innerHTML = `
        <div class="list-shell">
            <div class="list-section-title">Clientes</div>
            ${clientes.map(c => `
                <div class="list-row">
                    <div class="list-row-main">
                        <strong>${c.nombre}</strong>
                        <div>📍 ${c.direccion || 'Sin dirección'}</div>
                        <div>📞 ${c.telefono || 'Sin teléfono'}</div>
                        ${c.referencia ? `<div>📝 ${c.referencia}</div>` : ''}
                        <div class="badge ${c.activo ? 'badge-active' : 'badge-inactive'}">${c.activo ? '✅ Activo' : '❌ Inactivo'}</div>
                    </div>
                    <div class="list-row-actions">
                        <button onclick="editarCliente(${c.id})" class="btn-secondary">✏️ Editar</button>
                        <button onclick="toggleClienteActivo(${c.id})" class="${c.activo ? 'btn-danger' : 'btn-success'}">${c.activo ? 'Desactivar' : 'Activar'}</button>
                        <button onclick="eliminarCliente(${c.id})" class="btn-danger">Eliminar</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderPedidosAdmin(pedidos) {
    const container = document.getElementById('listaPedidos');
    if (!container) return;
    if (!pedidos || pedidos.length === 0) {
        container.innerHTML = '<div class="list-shell"><p>No hay pedidos</p></div>';
        return;
    }

    const vigentes = pedidos.filter(p => p.estado === 'pendiente' || p.estado === 'asignado');
    const registros = pedidos.filter(p => p.estado === 'completado' || p.estado === 'cancelado');

    const renderPedidoRow = (p) => {
        const u = usuariosCache.find(u => u.id === p.usuarioAsignado);
        const estado = (p.estado || 'pendiente').toUpperCase();
        return `
            <div class="list-row">
                <div class="list-row-main">
                    <strong>📦 ${p.descripcion}</strong>
                    <div>📍 ${p.origen || 'Sin origen'} → ${p.destino || 'Sin destino'}</div>
                    <div>💰 Servicio: $${p.costoServicio || 0} · Repartidor: $${p.pagoRepartidor || 0}</div>
                    <div>👤 ${u ? u.nombre : 'Sin asignar'}</div>
                    <div>🕐 ${p.fechaCreacion ? new Date(p.fechaCreacion).toLocaleString() : 'Sin fecha'}</div>
                    <div class="badge badge-${p.estado || 'pendiente'}">${estado}</div>
                </div>
                <div class="list-row-actions">
                    ${p.estado === 'pendiente' ? `<button onclick="asignarPedido(${p.id})" class="btn-primary">Asignar</button>` : ''}
                    ${p.estado === 'asignado' ? `<button onclick="completarPedido(${p.id})" class="btn-success">Completar</button>` : ''}
                    <button onclick="eliminarPedido(${p.id})" class="btn-danger">Eliminar</button>
                </div>
            </div>
        `;
    };

    container.innerHTML = `
        <div class="list-shell">
            <div class="list-section-title">Solicitudes vigentes</div>
            ${vigentes.length === 0 ? '<p>No hay solicitudes vigentes</p>' : vigentes.map(renderPedidoRow).join('')}
            <div class="list-divider"></div>
            <div class="list-section-title">Registros</div>
            ${registros.length === 0 ? '<p>No hay registros</p>' : registros.map(renderPedidoRow).join('')}
        </div>
    `;
}

// ============================================================
// ===== LIQUIDACIONES — INTERFAZ COMPLETA =====
// ============================================================

// Fuente de verdad del monto a liquidar: siempre se calcula en vivo a partir
// de los pedidos reales (no del contador liquidacionTotal, que puede
// desincronizarse si se completan pedidos muy seguidos).
function calcularLiquidacion(usuarioId, pedidosLista, ajustesLista) {
    const completados = pedidosLista.filter(p => p.usuarioAsignado === usuarioId && p.estado === 'completado');
    const pedidosActivos = completados.filter(p => !p.liquidado);
    const pedidosHistorial = completados.filter(p => p.liquidado)
        .sort((a, b) => new Date(b.liquidacionFecha || 0) - new Date(a.liquidacionFecha || 0));
    const totalPedidos = pedidosActivos.reduce((sum, p) => sum + (p.pagoRepartidor || 0), 0);
    const ajustes = ajustesLista || [];
    const totalAjustes = ajustes.reduce((sum, a) => sum + (a.monto || 0), 0);
    return { pedidosActivos, pedidosHistorial, ajustes, totalPedidos, totalAjustes, totalGeneral: totalPedidos + totalAjustes };
}

async function verLiquidacionDetalle(id) {
    const u = usuariosCache.find(u => u.id === id);
    if (!u) {
        alert('Usuario no encontrado');
        return;
    }
    
    const f = fb();
    if (!f) { alert('Error de conexión'); return; }
    
    const pedidos = await f.getPedidos();
    const { pedidosActivos, pedidosHistorial, ajustes, totalPedidos, totalAjustes, totalGeneral } =
        calcularLiquidacion(id, pedidos, u.ajustesLiquidacion);
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;justify-content:center;align-items:center;z-index:1000;padding:20px;';
    
    modal.innerHTML = `
        <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;max-width:700px;width:100%;max-height:85vh;overflow-y:auto;padding:25px;">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #2a2a2a;padding-bottom:15px;margin-bottom:20px;">
                <h2 style="color:#ff6b35;margin:0;">💰 Liquidación: ${u.nombre}</h2>
                <button onclick="this.closest('.modal-overlay').remove()" style="background:#dc3545;color:white;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;">✕</button>
            </div>
            
            <!-- Resumen -->
            <div style="background:#2a2a2a;padding:15px;border-radius:8px;margin-bottom:20px;">
                <p><strong>Repartidor:</strong> ${u.nombre}</p>
                <p><strong>Vehículo:</strong> ${u.vehiculo}</p>
                <p><strong>Total pedidos:</strong> $${totalPedidos}</p>
                ${totalAjustes !== 0 ? `<p><strong>Ajustes:</strong> $${totalAjustes}</p>` : ''}
                <p style="font-size:1.2rem;"><strong>TOTAL A PAGAR:</strong> <span style="color:#28a745;font-size:1.5rem;">$${totalGeneral}</span></p>
            </div>
            
            <!-- Pedidos activos (no liquidados) -->
            <h4 style="color:#ff6b35;margin-bottom:10px;">📦 Pedidos a liquidar (${pedidosActivos.length})</h4>
            ${pedidosActivos.length === 0 ? '<p style="color:#888;">No hay pedidos pendientes de liquidar</p>' : `
                <div style="max-height:250px;overflow-y:auto;margin-bottom:20px;">
                    <table style="width:100%;border-collapse:collapse;color:#b0b0b0;">
                        <thead>
                            <tr style="border-bottom:2px solid #2a2a2a;text-align:left;">
                                <th style="padding:8px;">#</th>
                                <th style="padding:8px;">Descripción</th>
                                <th style="padding:8px;">Origen → Destino</th>
                                <th style="padding:8px;">Pago</th>
                                <th style="padding:8px;">Fecha</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pedidosActivos.map((p, i) => `
                                <tr style="border-bottom:1px solid #2a2a2a;">
                                    <td style="padding:8px;">${i + 1}</td>
                                    <td style="padding:8px;">${p.descripcion}</td>
                                    <td style="padding:8px;font-size:0.85rem;">📍 ${p.origen} → ${p.destino}</td>
                                    <td style="padding:8px;color:#28a745;">$${p.pagoRepartidor}</td>
                                    <td style="padding:8px;font-size:0.8rem;">${p.fechaCompletado ? new Date(p.fechaCompletado).toLocaleDateString() : 'N/A'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `}
            
            <!-- Ajustes -->
            ${ajustes.length > 0 ? `
                <h4 style="color:#ff6b35;margin-bottom:10px;">✏️ Ajustes</h4>
                <div style="max-height:150px;overflow-y:auto;margin-bottom:20px;">
                    ${ajustes.map(a => `
                        <div style="background:#2a2a2a;padding:10px;border-radius:6px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
                            <div>
                                <p style="margin:0;">${a.concepto}</p>
                                <p style="margin:0;font-size:0.8rem;color:#888;">${new Date(a.fecha).toLocaleDateString()}</p>
                            </div>
                            <span style="color:${a.monto > 0 ? '#28a745' : '#dc3545'};font-weight:bold;">
                                ${a.monto > 0 ? '+' : ''}$${a.monto}
                            </span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            <!-- Historial (ya liquidado) -->
            ${pedidosHistorial.length > 0 ? `
                <div class="list-divider"></div>
                <h4 style="color:#888;margin-bottom:10px;">📜 Historial (ya liquidado, ${pedidosHistorial.length})</h4>
                <div style="max-height:200px;overflow-y:auto;margin-bottom:20px;">
                    <table style="width:100%;border-collapse:collapse;color:#888;">
                        <thead>
                            <tr style="border-bottom:2px solid #2a2a2a;text-align:left;">
                                <th style="padding:8px;">#</th>
                                <th style="padding:8px;">Descripción</th>
                                <th style="padding:8px;">Pago</th>
                                <th style="padding:8px;">Liquidado el</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pedidosHistorial.map((p, i) => `
                                <tr style="border-bottom:1px solid #2a2a2a;">
                                    <td style="padding:8px;">${i + 1}</td>
                                    <td style="padding:8px;">${p.descripcion}</td>
                                    <td style="padding:8px;">$${p.pagoRepartidor}</td>
                                    <td style="padding:8px;font-size:0.8rem;">${p.liquidacionFecha ? new Date(p.liquidacionFecha).toLocaleDateString() : 'N/A'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : ''}

            <!-- Botones de acción -->
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <button onclick="compartirLiquidacionWhatsApp(${u.id})" style="flex:1;min-width:150px;padding:12px;background:#25D366;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">
                    📱 Compartir por WhatsApp
                </button>
                <button onclick="copiarReporteLiquidacion(${u.id})" style="flex:1;min-width:150px;padding:12px;background:#007bff;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">
                    📋 Copiar Reporte
                </button>
                <button onclick="pagarLiquidacion(${u.id})" style="flex:1;min-width:150px;padding:12px;background:#28a745;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">
                    ✅ Pagar Liquidación
                </button>
                <button onclick="this.closest('.modal-overlay').remove()" style="flex:1;min-width:150px;padding:12px;background:#6c757d;color:white;border:none;border-radius:6px;cursor:pointer;">
                    Cerrar
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// ============================================================
// ===== COMPARTIR REPORTE DE LIQUIDACIÓN =====
// ============================================================

function generarReporteTexto(usuarioId) {
    const u = usuariosCache.find(u => u.id === usuarioId);
    if (!u) return '';
    
    const pedidosCompletados = pedidosCache.filter(p => p.usuarioAsignado === usuarioId && p.estado === 'completado' && !p.liquidado);
    const totalPedidos = pedidosCompletados.reduce((sum, p) => sum + (p.pagoRepartidor || 0), 0);
    const ajustes = u.ajustesLiquidacion || [];
    const totalAjustes = ajustes.reduce((sum, a) => sum + (a.monto || 0), 0);
    const totalGeneral = totalPedidos + totalAjustes;
    
    let reporte = `📊 *LIQUIDACIÓN - ${u.nombre}*\n`;
    reporte += `🚗 Vehículo: ${u.vehiculo}\n`;
    reporte += `📅 Fecha: ${new Date().toLocaleDateString()}\n\n`;
    
    reporte += `📦 *PEDIDOS COMPLETADOS (${pedidosCompletados.length})*\n`;
    pedidosCompletados.forEach((p, i) => {
        reporte += `${i + 1}. ${p.descripcion}\n`;
        reporte += `   📍 ${p.origen} → ${p.destino}\n`;
        reporte += `   💰 $${p.pagoRepartidor}\n`;
        if (p.fechaCompletado) {
            reporte += `   📅 ${new Date(p.fechaCompletado).toLocaleDateString()}\n`;
        }
        reporte += '\n';
    });
    
    reporte += `💰 Subtotal pedidos: $${totalPedidos}\n`;
    
    if (ajustes.length > 0) {
        reporte += `\n✏️ *AJUSTES*\n`;
        ajustes.forEach(a => {
            reporte += `• ${a.concepto}: ${a.monto > 0 ? '+' : ''}$${a.monto}\n`;
        });
        reporte += `💰 Total ajustes: $${totalAjustes}\n`;
    }
    
    reporte += `\n💵 *TOTAL A PAGAR: $${totalGeneral}*\n`;
    reporte += `\n✅ Liquidación generada por Gestor de Entregas`;
    
    return reporte;
}

function copiarReporteLiquidacion(usuarioId) {
    const reporte = generarReporteTexto(usuarioId);
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(reporte).then(() => {
            alert('✅ Reporte copiado al portapapeles\n\nPuedes pegarlo en WhatsApp o donde necesites.');
        }).catch(() => {
            copiarTextoFallback(reporte);
        });
    } else {
        copiarTextoFallback(reporte);
    }
}

function copiarTextoFallback(texto) {
    const textarea = document.createElement('textarea');
    textarea.value = texto;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        alert('✅ Reporte copiado al portapapeles');
    } catch (err) {
        alert('No se pudo copiar automáticamente. Aquí está el reporte:\n\n' + texto);
    }
    document.body.removeChild(textarea);
}

function compartirLiquidacionWhatsApp(usuarioId) {
    const reporte = generarReporteTexto(usuarioId);
    const mensaje = encodeURIComponent(reporte);
    const url = `https://wa.me/?text=${mensaje}`;
    window.open(url, '_blank');
}

async function pagarLiquidacion(id) {
    if (!confirm('¿Confirmar pago? Esto reiniciará el contador a $0')) return;
    
    const u = usuariosCache.find(u => u.id === id);
    if (!u) { alert('Usuario no encontrado'); return; }
    
    const f = fb();
    if (!f) { alert('Error de conexión'); return; }
    
    try {
        const pedidos = await f.getPedidos();
        const { pedidosActivos, totalGeneral } = calcularLiquidacion(id, pedidos, u.ajustesLiquidacion);

        const historial = await f.getHistorial();
        historial.push({
            usuarioId: id,
            usuarioNombre: u.nombre,
            monto: totalGeneral,
            fecha: new Date().toISOString(),
            detalle: 'Pago de liquidación - ' + pedidosActivos.length + ' pedidos'
        });
        await f.setHistorial(historial);

        // Marcar como liquidados los pedidos que se acaban de pagar
        const fechaLiquidacion = new Date().toISOString();
        for (const p of pedidosActivos) {
            await f.setPedido(p.id, { ...p, liquidado: true, liquidacionFecha: fechaLiquidacion });
        }

        await f.setUsuario(id, {
            ...u,
            liquidacionTotal: 0,
            pedidosCompletados: 0,
            ajustesLiquidacion: []
        });

        const modal = document.querySelector('.modal-overlay');
        if (modal) modal.remove();

        await cargarUsuarios();
        await cargarPedidos();
        await cargarLiquidaciones();
        alert('✅ Liquidación pagada exitosamente');
    } catch (error) {
        console.error('Error pagando liquidación:', error);
        alert('Error al pagar liquidación');
    }
}

// ============================================================
// ===== CRUD USUARIOS =====
// ============================================================

async function crearUsuario() {
    const nombre = document.getElementById('nombre').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const vehiculo = document.getElementById('vehiculo').value;
    if (!nombre || !username || !password) { alert('Completa todos los campos'); return; }
    const f = fb();
    if (!f) { alert('Error de conexión'); return; }
    const id = await f.getNextId('usuarios');
    await f.setUsuario(id, {
        nombre,
        username,
        password,
        vehiculo,
        activo: true,
        disponible: true,
        liquidacionTotal: 0,
        pedidosCompletados: 0,
        ajustesLiquidacion: [],
        calificacion: 0,
        ubicacion: null,
        gpsActiva: false
    });
    hideForm('usuario');
    ['nombre','username','password'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const vehEl = document.getElementById('vehiculo');
    if (vehEl) vehEl.value = 'bici';
    await cargarUsuarios();
    alert('✅ Usuario creado correctamente');
}

async function toggleUsuarioActivo(id) {
    const u = usuariosCache.find(u => u.id === id);
    if (!u) return;
    const f = fb();
    if (!f) return;
    await f.setUsuario(id, { ...u, activo: !u.activo });
    await cargarUsuarios();
}

async function toggleDisponibilidadAdmin(id) {
    const u = usuariosCache.find(u => u.id === id);
    if (!u || !u.activo) { alert('Usuario inactivo'); return; }
    const nuevo = !u.disponible;
    if (!confirm(`¿Cambiar a ${nuevo ? 'disponible' : 'no disponible'}?`)) return;
    const f = fb();
    if (!f) return;
    await f.setUsuario(id, { ...u, disponible: nuevo });
    await cargarUsuarios();
}

async function eliminarUsuario(id) {
    if (!confirm('¿Eliminar usuario?')) return;
    const f = fb();
    if (!f) return;
    await f.deleteUsuario(id);
    await cargarUsuarios();
}

async function calificarUsuario(id) {
    const u = usuariosCache.find(u => u.id === id);
    if (!u) return;
    const valor = prompt(`Calificación para ${u.nombre} (1 a 5):`, u.calificacion || '0');
    const calificacion = parseInt(valor, 10);
    if (isNaN(calificacion) || calificacion < 1 || calificacion > 5) {
        alert('La calificación debe ser un número entre 1 y 5');
        return;
    }
    const f = fb();
    if (!f) return;
    await f.setUsuario(id, { ...u, calificacion });
    await cargarUsuarios();
}

// ============================================================
// ===== CRUD CLIENTES =====
// ============================================================

async function crearCliente() {
    const nombre = document.getElementById('clienteNombre').value;
    const direccion = document.getElementById('clienteDireccion').value;
    const telefono = document.getElementById('clienteTelefono').value;
    const email = document.getElementById('clienteEmail').value;
    const referencia = document.getElementById('clienteReferencia').value;
    if (!nombre || !direccion) { alert('Nombre y dirección son obligatorios'); return; }
    const f = fb();
    if (!f) { alert('Error de conexión'); return; }
    const id = await f.getNextId('clientes');
    await f.setCliente(id, { nombre, direccion, telefono, email, referencia, activo: true });
    hideForm('cliente');
    ['clienteNombre','clienteDireccion','clienteTelefono','clienteEmail','clienteReferencia'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    await cargarClientes();
}

function editarCliente(id) {
    const c = clientesCache.find(c => c.id === id);
    if (!c) { alert('Cliente no encontrado'); return; }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;justify-content:center;align-items:center;z-index:1000;padding:20px;';
    modal.innerHTML = `
        <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;max-width:480px;width:100%;padding:25px;">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #2a2a2a;padding-bottom:15px;margin-bottom:20px;">
                <h2 style="color:#ff6b35;margin:0;">✏️ Editar Cliente</h2>
                <button onclick="this.closest('.modal-overlay').remove()" style="background:#dc3545;color:white;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;">✕</button>
            </div>
            <input type="text" id="editClienteNombre" placeholder="Nombre del cliente" class="input-field" value="${c.nombre || ''}">
            <input type="text" id="editClienteDireccion" placeholder="Dirección" class="input-field" value="${c.direccion || ''}">
            <input type="text" id="editClienteTelefono" placeholder="Teléfono" class="input-field" value="${c.telefono || ''}">
            <input type="email" id="editClienteEmail" placeholder="Email" class="input-field" value="${c.email || ''}">
            <input type="text" id="editClienteReferencia" placeholder="Referencia / detalle (opcional)" class="input-field" value="${c.referencia || ''}">
            <div class="form-actions">
                <button type="button" onclick="guardarEdicionCliente(${id})" class="btn-primary">Guardar</button>
                <button type="button" onclick="this.closest('.modal-overlay').remove()" class="btn-secondary">Cancelar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function guardarEdicionCliente(id) {
    const c = clientesCache.find(c => c.id === id);
    if (!c) return;
    const nombre = document.getElementById('editClienteNombre').value;
    const direccion = document.getElementById('editClienteDireccion').value;
    const telefono = document.getElementById('editClienteTelefono').value;
    const email = document.getElementById('editClienteEmail').value;
    const referencia = document.getElementById('editClienteReferencia').value;
    if (!nombre || !direccion) { alert('Nombre y dirección son obligatorios'); return; }
    const f = fb();
    if (!f) { alert('Error de conexión'); return; }
    await f.setCliente(id, { ...c, nombre, direccion, telefono, email, referencia });
    const modal = document.querySelector('.modal-overlay');
    if (modal) modal.remove();
    await cargarClientes();
}

async function toggleClienteActivo(id) {
    const c = clientesCache.find(c => c.id === id);
    if (!c) return;
    const f = fb();
    if (!f) return;
    await f.setCliente(id, { ...c, activo: !c.activo });
    await cargarClientes();
}

async function eliminarCliente(id) {
    if (!confirm('¿Eliminar cliente?')) return;
    const f = fb();
    if (!f) return;
    await f.deleteCliente(id);
    await cargarClientes();
}

// ============================================================
// ===== CRUD PEDIDOS =====
// ============================================================

async function crearPedido() {
    const descripcion = document.getElementById('descripcion').value;
    const clienteId = document.getElementById('clienteOrigen').value;
    const origenManual = document.getElementById('origenManual').value;
    const destino = document.getElementById('destino').value;
    const costoServicio = parseFloat(document.getElementById('costoServicio').value);
    const pagoRepartidor = parseFloat(document.getElementById('pagoRepartidor').value);
    const usuarioAsignado = document.getElementById('usuarioAsignado').value;
    
    let origen = '';
    if (clienteId) {
        const c = clientesCache.find(c => c.id === parseInt(clienteId));
        origen = c ? c.nombre : origenManual;
    } else if (origenManual) {
        origen = origenManual;
    } else {
        alert('Selecciona un cliente o escribe origen manual');
        return;
    }
    if (!descripcion || !origen || !destino || !costoServicio || !pagoRepartidor) {
        alert('Completa todos los campos');
        return;
    }
    
    const f = fb();
    if (!f) { alert('Error de conexión'); return; }
    
    await f.crearPedidoConPushup({
        descripcion, origen, destino, costoServicio, pagoRepartidor,
        gananciaAdmin: costoServicio - pagoRepartidor,
        usuarioAsignado: usuarioAsignado ? parseInt(usuarioAsignado) : null,
        estado: usuarioAsignado ? 'asignado' : 'pendiente'
    });
    
    hideForm('pedido');
    ['descripcion','origenManual','destino','costoServicio','pagoRepartidor'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const selCliente = document.getElementById('clienteOrigen');
    if (selCliente) selCliente.value = '';
    const selUsuario = document.getElementById('usuarioAsignado');
    if (selUsuario) selUsuario.value = '';
    
    await cargarPedidos();
    if (usuarioActual) await cargarPedidosUsuario(usuarioActual.id);
    alert('✅ Pedido creado');
}

async function asignarPedido(id) {
    const activos = usuariosCache.filter(u => u.activo && u.disponible);
    if (activos.length === 0) { alert('No hay repartidores disponibles'); return; }
    const lista = activos.map((u, i) => `${i+1}. ${u.nombre} (${u.vehiculo})`).join('\n');
    const sel = prompt(`Selecciona repartidor:\n${lista}\n\nNúmero:`);
    if (!sel) return;
    const idx = parseInt(sel) - 1;
    if (idx < 0 || idx >= activos.length) { alert('Selección inválida'); return; }
    const p = pedidosCache.find(p => p.id === id);
    if (!p) return;
    const f = fb();
    if (!f) return;
    await f.setPedido(id, { ...p, usuarioAsignado: activos[idx].id, estado: 'asignado' });
    await cargarPedidos();
}

async function completarPedido(id) {
    if (!confirm('¿Completar pedido?')) return;
    const p = pedidosCache.find(p => p.id === id);
    if (!p) return;
    const f = fb();
    if (!f) return;
    await f.setPedido(id, { ...p, estado: 'completado', fechaCompletado: new Date().toISOString() });
    if (p.usuarioAsignado) {
        const u = usuariosCache.find(u => u.id === p.usuarioAsignado);
        if (u) {
            await f.setUsuario(u.id, { ...u, liquidacionTotal: (u.liquidacionTotal || 0) + p.pagoRepartidor, pedidosCompletados: (u.pedidosCompletados || 0) + 1 });
        }
    }
    liquidacionAdmin.total = (liquidacionAdmin.total || 0) + (p.gananciaAdmin || p.costoServicio - p.pagoRepartidor);
    await f.setLiquidacionAdmin(liquidacionAdmin);
    const totalEl = document.getElementById('totalAdmin');
    if (totalEl) totalEl.textContent = '$' + (liquidacionAdmin.total || 0);
    await cargarPedidos();
    if (usuarioActual) await cargarPedidosUsuario(usuarioActual.id);
}

async function eliminarPedido(id) {
    if (!confirm('¿Eliminar pedido?')) return;
    const f = fb();
    if (!f) return;
    await f.deletePedido(id);
    await cargarPedidos();
}

// ============================================================
// ===== AJUSTAR LIQUIDACIÓN =====
// ============================================================

async function ajustarLiquidacion(id) {
    const u = usuariosCache.find(u => u.id === id);
    if (!u) { alert('Usuario no encontrado'); return; }
    const concepto = prompt('Concepto (ej: Bono, Descuento, etc.):');
    if (!concepto) return;
    const monto = parseFloat(prompt('Monto (positivo = extra, negativo = descuento):'));
    if (isNaN(monto) || monto === 0) return;
    const ajustes = u.ajustesLiquidacion || [];
    ajustes.push({ 
        id: Date.now(), 
        fecha: new Date().toISOString(), 
        concepto, 
        monto,
        tipo: monto > 0 ? 'extra' : 'descuento'
    });
    const f = fb();
    if (!f) { alert('Error de conexión'); return; }
    const nuevoLiquidacionTotal = (u.liquidacionTotal || 0) + monto;
    await f.setUsuario(id, { ...u, ajustesLiquidacion: ajustes, liquidacionTotal: nuevoLiquidacionTotal });
    u.ajustesLiquidacion = ajustes;
    u.liquidacionTotal = nuevoLiquidacionTotal;
    await cargarUsuarios();
    await cargarLiquidaciones();
    if (usuarioActual && usuarioActual.id === id) {
        usuarioActual.ajustesLiquidacion = ajustes;
        usuarioActual.liquidacionTotal = nuevoLiquidacionTotal;
        window.usuarioActual = usuarioActual;
        await cargarPanelUsuario(usuarioActual);
    }
    alert('✅ Ajuste aplicado correctamente');
}

// ============================================================
// ===== PANEL USUARIO =====
// ============================================================

async function cargarPanelUsuario(usuario) {
    const bienvenida = document.getElementById('bienvenidaUsuario');
    if (bienvenida) bienvenida.textContent = '👋 Hola, ' + usuario.nombre;
    
    const vehiculo = document.getElementById('vehiculoUsuario');
    if (vehiculo) vehiculo.textContent = getVehiculoIcon(usuario.vehiculo);

    actualizarEstado(usuario);
    await cargarPedidosUsuario(usuario.id);
    actualizarLiquidacionUsuarioDOM(usuario);
    iniciarSeguimientoUbicacion();
    iniciarEscucha();
    iniciarEscuchaUsuarioActual(usuario.id);
}

// Recalcula el total en base a pedidosCache (ya cargado por cargarPedidosUsuario)
function actualizarLiquidacionUsuarioDOM(usuario) {
    const { totalGeneral, totalAjustes } = calcularLiquidacion(usuario.id, pedidosCache, usuario.ajustesLiquidacion);
    const liquidacion = document.getElementById('liquidacionUsuario');
    if (liquidacion) liquidacion.textContent = '$' + totalGeneral;
    const ajustesUsuario = document.getElementById('ajustesUsuario');
    if (ajustesUsuario) ajustesUsuario.textContent = `${totalAjustes > 0 ? '+' : ''}$${totalAjustes}`;
}

// Escucha cambios propios en tiempo real (ej: liquidación pagada por el admin)
function iniciarEscuchaUsuarioActual(id) {
    const f = fb();
    if (!f || !f.escucharUsuario) return;
    f.escucharUsuario(id, function(usuarioActualizado) {
        if (!usuarioActual || usuarioActual.id !== id) return;
        usuarioActual = { ...usuarioActual, ...usuarioActualizado };
        window.usuarioActual = usuarioActual;
        guardarSesionUsuario(usuarioActual);
        actualizarEstado(usuarioActual);
        cargarPedidosUsuario(id)
            .then(() => actualizarLiquidacionUsuarioDOM(usuarioActual))
            .catch(console.error);
    });
}

function getVehiculoIcon(v) {
    const icons = { bici: '🚲 Bici', moto: '🏍️ Moto', auto: '🚗 Auto' };
    return icons[v] || v;
}

function actualizarEstado(usuario) {
    const es = document.getElementById('estadoUsuario');
    const btn = document.getElementById('btnDisponibilidad');
    const gpsEl = document.getElementById('gpsUsuario');
    const ubicacionEl = document.getElementById('ubicacionUsuario');
    if (!es || !btn) return;
    if (usuario.activo && usuario.disponible) {
        es.textContent = '✅ Activo';
        es.className = 'badge-active';
        btn.textContent = '🟢 Disponible';
        btn.className = 'btn-success';
        btn.disabled = false;
    } else if (usuario.activo && !usuario.disponible) {
        es.textContent = '⏸️ Pausado';
        es.className = 'badge-inactive';
        btn.textContent = '⏸️ No disponible';
        btn.className = 'btn-secondary';
        btn.disabled = false;
    } else {
        es.textContent = '❌ Inactivo';
        es.className = 'badge-inactive';
        btn.textContent = '🚫 Inactivo';
        btn.className = 'btn-danger';
        btn.disabled = true;
    }
    if (gpsEl) {
        gpsEl.textContent = usuario.gpsActiva ? '📍 GPS activo' : '⚠️ GPS desactivado';
    }
    if (ubicacionEl) {
        if (usuario.ubicacion) {
            ubicacionEl.textContent = `${usuario.ubicacion.lat.toFixed(4)}, ${usuario.ubicacion.lng.toFixed(4)}`;
        } else {
            ubicacionEl.textContent = 'Sin datos';
        }
    }
}

async function toggleDisponibilidad() {
    if (!usuarioActual) return;
    const nuevo = !usuarioActual.disponible;
    const f = fb();
    if (!f) { alert('Error de conexión'); return; }

    if (nuevo) {
        const gpsOk = await requerirGpsParaDisponibilidad();
        if (!gpsOk) {
            return;
        }
    }

    if (!nuevo) {
        detenerSeguimientoUbicacion();
        usuarioActual.gpsActiva = false;
    }

    await f.setUsuario(usuarioActual.id, { ...usuarioActual, disponible: nuevo });
    usuarioActual.disponible = nuevo;
    window.usuarioActual = usuarioActual;
    guardarSesionUsuario(usuarioActual);
    actualizarEstado(usuarioActual);
    await cargarPedidosUsuario(usuarioActual.id);
}

function detenerSeguimientoUbicacion() {
    if (geolocationWatchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(geolocationWatchId);
    }
    geolocationWatchId = null;
    geolocationActive = false;
}

function iniciarSeguimientoUbicacion() {
    if (!navigator.geolocation || !usuarioActual) return;
    if (geolocationActive) return;

    const f = fb();
    if (!f) return;

    const actualizarUbicacion = (position) => {
        const nuevaUbicacion = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString()
        };
        const siguiente = { ...usuarioActual, ubicacion: nuevaUbicacion, gpsActiva: true };
        usuarioActual = siguiente;
        window.usuarioActual = siguiente;
        guardarSesionUsuario(siguiente);
        f.setUsuario(siguiente.id, siguiente).catch(console.error);
        actualizarEstado(siguiente);
    };

    const errorHandler = (error) => {
        const siguiente = { ...usuarioActual, gpsActiva: false, ubicacion: null };
        usuarioActual = siguiente;
        window.usuarioActual = siguiente;
        guardarSesionUsuario(siguiente);
        f.setUsuario(siguiente.id, siguiente).catch(console.error);
        actualizarEstado(siguiente);
        console.warn('GPS no disponible:', error.message);
    };

    geolocationActive = true;
    geolocationWatchId = navigator.geolocation.watchPosition(actualizarUbicacion, errorHandler, {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 20000
    });
}

function requerirGpsParaDisponibilidad() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            alert('Tu navegador no soporta GPS');
            resolve(false);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            () => {
                iniciarSeguimientoUbicacion();
                resolve(true);
            },
            (error) => {
                console.warn('GPS denegado:', error.message);
                alert('Debes activar el GPS para pasar a disponible');
                resolve(false);
            },
            { enableHighAccuracy: true, timeout: 15000 }
        );
    });
}

async function cargarPedidosUsuario(usuarioId) {
    const f = fb();
    if (!f) return;
    const pedidos = await f.getPedidos();
    pedidosCache = pedidos;
    renderPedidosUsuario(pedidos, usuarioId);
}

function renderPedidosUsuario(pedidos, usuarioId) {
    const pendientes = pedidos.filter(p => p.estado === 'pendiente');
    const el = document.getElementById('pedidosPendientes');
    if (el) {
        el.innerHTML = `
            <div class="list-shell">
                <div class="list-section-title">Solicitudes vigentes</div>
                ${pendientes.length === 0 ? '<p>No hay pedidos disponibles</p>' : pendientes.map(p => `
                    <div class="list-row">
                        <div class="list-row-main">
                            <strong>📦 ${p.descripcion}</strong>
                            <div>📍 ${p.origen || 'Sin origen'} → ${p.destino || 'Sin destino'}</div>
                            <div>💰 Pago: $${p.pagoRepartidor || 0}</div>
                        </div>
                        <div class="list-row-actions">
                            <button onclick="tomarPedido(${p.id})" class="btn-success">✅ Tomar Pedido</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    const mis = pedidos.filter(p => p.usuarioAsignado === usuarioId && p.estado === 'asignado');
    const el2 = document.getElementById('misPedidos');
    if (el2) {
        el2.innerHTML = `
            <div class="list-shell">
                <div class="list-section-title">Mis pedidos</div>
                ${mis.length === 0 ? '<p>No tienes pedidos asignados</p>' : mis.map(p => `
                    <div class="list-row">
                        <div class="list-row-main">
                            <strong>📦 ${p.descripcion}</strong>
                            <div>📍 ${p.origen} → ${p.destino}</div>
                            <div>💰 Pago: $${p.pagoRepartidor}</div>
                            <div class="badge badge-asignado">ASIGNADO</div>
                        </div>
                        <div class="list-row-actions">
                            <button onclick="completarPedidoUsuario(${p.id})" class="btn-success">✅ Completar</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    const hist = pedidos.filter(p => p.usuarioAsignado === usuarioId && p.estado === 'completado');
    const noLiquidados = hist.filter(p => !p.liquidado);
    const liquidados = hist.filter(p => p.liquidado)
        .sort((a, b) => new Date(b.liquidacionFecha || 0) - new Date(a.liquidacionFecha || 0));
    const el3 = document.getElementById('historialPedidos');
    if (el3) {
        const renderHistRow = (p) => `
            <div class="list-row">
                <div class="list-row-main">
                    <strong>📦 ${p.descripcion}</strong>
                    <div>📍 ${p.origen} → ${p.destino}</div>
                    <div>💰 Pago: $${p.pagoRepartidor}</div>
                    <div>✅ ${p.fechaCompletado ? new Date(p.fechaCompletado).toLocaleString() : 'Sin fecha'}</div>
                </div>
            </div>
        `;
        el3.innerHTML = `
            <div class="list-shell">
                <div class="list-section-title">No liquidado (activo)</div>
                ${noLiquidados.length === 0 ? '<p>No hay pedidos pendientes de liquidar</p>' : noLiquidados.map(renderHistRow).join('')}
                <div class="list-divider"></div>
                <div class="list-section-title">Historial (ya liquidado)</div>
                ${liquidados.length === 0 ? '<p>Todavía no hay liquidaciones pagadas</p>' : liquidados.map(renderHistRow).join('')}
            </div>
        `;
    }
}

// ============================================================
// ===== TOMAR Y COMPLETAR PEDIDOS (CORREGIDO) =====
// ============================================================

async function tomarPedido(id) {
    if (!usuarioActual) {
        alert('Debes iniciar sesión');
        return;
    }
    if (!usuarioActual.disponible) {
        alert('No estás disponible para tomar pedidos');
        return;
    }
    if (!confirm('¿Tomar este pedido?')) return;

    const p = pedidosCache.find(p => p.id === id);
    if (!p) {
        alert('Error: Pedido no encontrado. Recargando...');
        await cargarPedidosUsuario(usuarioActual.id);
        return;
    }

    const f = fb();
    if (!f) { alert('Error de conexión'); return; }

    try {
        await f.setPedido(id, { ...p, usuarioAsignado: usuarioActual.id, estado: 'asignado' });
        await cargarPedidosUsuario(usuarioActual.id);
        alert('✅ Pedido tomado exitosamente');
    } catch (error) {
        console.error('Error al tomar pedido:', error);
        alert('Error al tomar pedido');
    }
}

async function completarPedidoUsuario(id) {
    if (!confirm('¿Completar pedido?')) return;
    
    const f = fb();
    if (!f) { alert('Error de conexión'); return; }

    try {
        const pedidos = await f.getPedidos();
        const p = pedidos.find(p => p.id === id);
        if (!p) { alert('Pedido no encontrado'); return; }

        await f.setPedido(id, { ...p, estado: 'completado', fechaCompletado: new Date().toISOString() });

        if (usuarioActual) {
            const nuevoTotal = (usuarioActual.liquidacionTotal || 0) + p.pagoRepartidor;
            const nuevosPedidos = (usuarioActual.pedidosCompletados || 0) + 1;
            await f.setUsuario(usuarioActual.id, {
                ...usuarioActual,
                liquidacionTotal: nuevoTotal,
                pedidosCompletados: nuevosPedidos
            });
            usuarioActual.liquidacionTotal = nuevoTotal;
            usuarioActual.pedidosCompletados = nuevosPedidos;
            guardarSesionUsuario(usuarioActual);
        }

        const ganancia = p.gananciaAdmin || p.costoServicio - p.pagoRepartidor;
        liquidacionAdmin.total = (liquidacionAdmin.total || 0) + ganancia;
        await f.setLiquidacionAdmin(liquidacionAdmin);

        await cargarPedidosUsuario(usuarioActual.id);
        if (usuarioActual) actualizarLiquidacionUsuarioDOM(usuarioActual);
        alert('✅ Pedido completado exitosamente');
    } catch (error) {
        console.error('Error al completar pedido:', error);
        alert('Error al completar pedido');
    }
}

// ============================================================
// ===== NOTIFICACIONES EN TIEMPO REAL (ACTUALIZADO) =====
// ============================================================

function iniciarEscucha() {
    const f = fb();
    if (!f) {
        console.warn('⚠️ Firebase no disponible, reintentando en 2 segundos...');
        setTimeout(iniciarEscucha, 2000);
        return;
    }
    
    console.log('📡 Escuchando pedidos en tiempo real...');
    
    f.escucharNuevosPedidos(function(nuevo) {
        console.log('📦 Nuevo pedido o cambio detectado:', nuevo);
        
        if (ultimoPedidoPendiente === null || nuevo.id !== ultimoPedidoPendiente?.id || nuevo.estado !== ultimoPedidoPendiente?.estado) {
            ultimoPedidoPendiente = nuevo;

            // Si es un pedido nuevo (pendiente), mostrar alerta
            if (nuevo.estado === 'pendiente') {
                // Mostrar alerta visual SOLO para repartidores
                if (usuarioActual) {
                    const alerta = document.createElement('div');
                    alerta.className = 'alerta-pedido-nuevo';
                    alerta.style.cssText = 'background:linear-gradient(135deg,#1a3a1a,#0a2a0a);border:2px solid #28a745;border-radius:12px;padding:15px 20px;margin-bottom:20px;animation:fadeIn 0.5s ease-out;';
                    alerta.innerHTML = `
                        <div style="display:flex;align-items:center;gap:15px;">
                            <span style="font-size:2.5rem;">📦</span>
                            <div style="flex:1;">
                                <strong style="color:#28a745;font-size:1.1rem;">¡Nuevo Pedido!</strong>
                                <p style="margin:3px 0;color:#b0b0b0;">${nuevo.descripcion || 'Sin descripción'}</p>
                                <p style="font-size:0.9rem;color:#b0b0b0;margin:0;">📍 ${nuevo.origen || ''} → ${nuevo.destino || ''}</p>
                                <p style="color:#28a745;margin:0;">💰 $${nuevo.pagoRepartidor || 0}</p>
                            </div>
                            <button onclick="this.parentElement.parentElement.remove()" style="background:#dc3545;color:white;border:none;border-radius:6px;padding:4px 12px;cursor:pointer;">✕</button>
                        </div>
                    `;
                    
                    const panel = document.getElementById('usuarioPanel');
                    if (panel) {
                        panel.insertBefore(alerta, panel.firstChild);
                        setTimeout(() => { if (alerta.parentNode) alerta.remove(); }, 15000);
                    }
                }
            }

            // ✅ ACTUALIZAR panel de admin automáticamente si está visible
            const adminPanel = document.getElementById('adminPanel');
            if (adminPanel && adminPanel.style.display !== 'none') {
                console.log('🔄 Actualizando panel admin automáticamente...');
                cargarPedidos();
            }

            // ✅ ACTUALIZAR panel de usuario automáticamente
            if (usuarioActual) {
                console.log('🔄 Actualizando panel de usuario automáticamente...');
                cargarPedidosUsuario(usuarioActual.id).then(() => actualizarLiquidacionUsuarioDOM(usuarioActual));
            }
        }
    });
}

// ============================================================
// ===== POLLING PERIÓDICO (FALLBACK) =====
// ============================================================

function iniciarPollingAdmin() {
    if (adminPollingId !== null) return;
    console.log('⏱️ Iniciando polling admin cada', pollingIntervalMs, 'ms');
    adminPollingId = setInterval(() => {
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel && adminPanel.style.display !== 'none') {
            cargarPedidos().catch(console.error);
            cargarUsuarios().catch(console.error);
            cargarClientes().catch(console.error);
        }
    }, pollingIntervalMs);
}

function detenerPollingAdmin() {
    if (adminPollingId !== null) {
        clearInterval(adminPollingId);
        adminPollingId = null;
        console.log('⏹️ Polling admin detenido');
    }
}

function iniciarPollingUsuario(usuarioId) {
    if (userPollingId !== null) return;
    console.log('⏱️ Iniciando polling usuario cada', pollingIntervalMs, 'ms');
    userPollingId = setInterval(() => {
        if (usuarioActual && usuarioActual.id === usuarioId) {
            cargarPedidosUsuario(usuarioId)
                .then(() => actualizarLiquidacionUsuarioDOM(usuarioActual))
                .catch(console.error);
        }
    }, pollingIntervalMs);
}

function detenerPollingUsuario() {
    if (userPollingId !== null) {
        clearInterval(userPollingId);
        userPollingId = null;
        console.log('⏹️ Polling usuario detenido');
    }
}

function detenerTodosPolling() {
    detenerPollingAdmin();
    detenerPollingUsuario();
}

// ============================================================
// ===== ACTIVAR SONIDO MANUAL (BOTÓN) =====
// ============================================================

function activarSonidoManual() {
    const f = fb();
    if (f && f.activarSonidoManual) {
        f.activarSonidoManual();
    } else {
        alert('⚠️ Error al activar sonido');
    }
}

// ============================================================
// ===== TABS =====
// ============================================================

function showTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => { if (el) el.style.display = 'none'; });
    document.querySelectorAll('.tab-btn').forEach(el => { if (el) el.classList.remove('active'); });
    const tabs = ['usuarios', 'clientes', 'pedidos', 'liquidaciones', 'gps', 'admin'];
    const idx = tabs.indexOf(tab);
    if (idx >= 0) {
        const el = document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1));
        if (el) el.style.display = 'block';
        const btns = document.querySelectorAll('.tab-btn');
        if (btns[idx]) btns[idx].classList.add('active');
        if (tab === 'usuarios') cargarUsuarios();
        else if (tab === 'clientes') cargarClientes();
        else if (tab === 'pedidos') cargarPedidos();
        else if (tab === 'liquidaciones') cargarLiquidaciones();
        else if (tab === 'gps') cargarVistaGps();
        else if (tab === 'admin') cargarLiquidacionAdmin();
    }
}

function showUserTab(tab) {
    document.querySelectorAll('#usuarioPanel .tab-content').forEach(el => { if (el) el.style.display = 'none'; });
    document.querySelectorAll('#usuarioPanel .tab-btn').forEach(el => { if (el) el.classList.remove('active'); });
    if (tab === 'pendientes') {
        const el = document.getElementById('userTabPendientes');
        if (el) el.style.display = 'block';
        const btn = document.querySelector('#usuarioPanel .tab-btn:first-child');
        if (btn) btn.classList.add('active');
        if (usuarioActual) cargarPedidosUsuario(usuarioActual.id);
    } else if (tab === 'misPedidos') {
        const el = document.getElementById('userTabMisPedidos');
        if (el) el.style.display = 'block';
        const btn = document.querySelector('#usuarioPanel .tab-btn:nth-child(2)');
        if (btn) btn.classList.add('active');
        if (usuarioActual) cargarPedidosUsuario(usuarioActual.id);
    } else if (tab === 'historial') {
        const el = document.getElementById('userTabHistorial');
        if (el) el.style.display = 'block';
        const btn = document.querySelector('#usuarioPanel .tab-btn:nth-child(3)');
        if (btn) btn.classList.add('active');
        if (usuarioActual) cargarPedidosUsuario(usuarioActual.id);
    }
}

async function cargarLiquidaciones() {
    const f = fb();
    if (!f) return;
    const usuarios = await f.getUsuarios();
    const pedidos = await f.getPedidos();
    const container = document.getElementById('liquidacionesList');
    if (!container) return;
    container.innerHTML = `
        <div class="list-shell">
            <div class="list-section-title">Liquidaciones</div>
            ${usuarios.length === 0 ? '<p>No hay repartidores</p>' : usuarios.map(u => {
                const { pedidosActivos, ajustes, totalAjustes, totalGeneral } = calcularLiquidacion(u.id, pedidos, u.ajustesLiquidacion);
                const ajustesLabel = ajustes.length > 0 ? `✏️ Ajustes: ${ajustes.length} · ${totalAjustes > 0 ? '+' : ''}$${totalAjustes}` : '✏️ Sin ajustes';
                return `
                    <div class="list-row">
                        <div class="list-row-main">
                            <strong>${u.nombre}</strong>
                            <div>🚗 ${u.vehiculo}</div>
                            <div>💰 $${totalGeneral}</div>
                            <div>📦 ${pedidosActivos.length}</div>
                            <div>${ajustesLabel}</div>
                            <div class="badge ${u.activo ? 'badge-active' : 'badge-inactive'}">${u.activo ? '✅ Activo' : '❌ Inactivo'}</div>
                        </div>
                        <div class="list-row-actions">
                            <button onclick="verLiquidacionDetalle(${u.id})" class="btn-primary">💰 Ver Detalle</button>
                            <button onclick="ajustarLiquidacion(${u.id})" class="btn-secondary">✏️ Ajustar</button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

async function cargarVistaGps() {
    const f = fb();
    if (!f) return;
    const usuarios = await f.getUsuarios();
    const container = document.getElementById('vistaGps');
    if (!container) return;

    const activos = usuarios.filter(u => u.activo && u.disponible && u.gpsActiva && u.ubicacion);

    if (activos.length === 0) {
        container.innerHTML = '<div class="list-shell"><p>No hay repartidores activos con GPS en este momento.</p></div>';
        return;
    }

    const tabla = `
        <div class="list-shell">
            <div class="list-section-title">Tabla operativa</div>
            <table class="gps-table">
                <thead>
                    <tr>
                        <th>Repartidor</th>
                        <th>Vehículo</th>
                        <th>Ubicación</th>
                        <th>Última actualización</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${activos.map(u => `
                        <tr data-usuario-id="${u.id}" onclick="seleccionarUsuarioGPS(${u.id})">
                            <td>${u.nombre}</td>
                            <td>${u.vehiculo}</td>
                            <td>${u.ubicacion.lat.toFixed(4)}, ${u.ubicacion.lng.toFixed(4)}</td>
                            <td>${u.ubicacion.timestamp ? new Date(u.ubicacion.timestamp).toLocaleTimeString() : 'Sin hora'}</td>
                            <td><span class="badge badge-active">🟢 En línea</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    const mapa = `
        <div class="gps-map-card">
            <div class="list-section-title">Mapa de repartidores</div>
            <div id="gpsMap" class="gps-map-frame"></div>
            <div id="gpsSelectedInfo" class="gps-selected-info">Seleccioná un repartidor en el mapa o en la tabla para revisarlo.</div>
        </div>
    `;

    container.innerHTML = `<div class="gps-panel-grid">${tabla}${mapa}</div>`;

    const map = L.map('gpsMap', {
        center: [activos[0].ubicacion.lat, activos[0].ubicacion.lng],
        zoom: 13,
        zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
    }).addTo(map);

    const markers = activos.map(u => {
        const marker = L.marker([u.ubicacion.lat, u.ubicacion.lng]).addTo(map);
        marker.bindTooltip(`${u.nombre}`, {
            permanent: true,
            direction: 'top',
            offset: [0, -10],
            className: 'gps-marker-label'
        });
        marker.bindPopup(`
            <strong>${u.nombre}</strong><br>
            ${u.vehiculo}<br>
            ${u.ubicacion.lat.toFixed(5)}, ${u.ubicacion.lng.toFixed(5)}<br>
            <button onclick="seleccionarUsuarioGPS(${u.id})" class="btn-success btn-sm">Seleccionar</button>
        `);
        marker.on('click', () => seleccionarUsuarioGPS(u.id));
        return marker;
    });

    const group = L.featureGroup(markers);
    if (markers.length > 0) {
        map.fitBounds(group.getBounds().pad(0.2));
    }

    window.activosGPS = activos;
}

function seleccionarUsuarioGPS(id) {
    const usuarios = window.activosGPS || [];
    const usuario = usuarios.find(u => u.id === id);
    if (!usuario) return;

    document.querySelectorAll('.gps-table tr').forEach(row => row.classList.remove('gps-row-selected'));
    const row = document.querySelector(`.gps-table tr[data-usuario-id='${id}']`);
    if (row) row.classList.add('gps-row-selected');

    const info = document.getElementById('gpsSelectedInfo');
    if (info) {
        info.innerHTML = `
            <strong>${usuario.nombre}</strong> — ${usuario.vehiculo}<br>
            Ubicación: ${usuario.ubicacion.lat.toFixed(5)}, ${usuario.ubicacion.lng.toFixed(5)}<br>
            Estado: ${usuario.disponible ? 'Disponible' : 'No disponible'}
        `;
    }
}


function showForm(tipo) {
    const map = { usuario: 'usuarioForm', pedido: 'pedidoForm', cliente: 'clienteForm' };
    const el = document.getElementById(map[tipo]);
    if (el) el.style.display = 'block';
}

function hideForm(tipo) {
    const map = { usuario: 'usuarioForm', pedido: 'pedidoForm', cliente: 'clienteForm' };
    const el = document.getElementById(map[tipo]);
    if (el) el.style.display = 'none';
}

// ============================================================
// ===== INICIO =====
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚚 Gestor de Entregas v3.0');
    console.log('Admin: LedZepp1');
    console.log('Usuarios: carlos123, maria456, julio789');
    console.log('🔊 Para activar el sonido, toca el botón "Activar Sonido" o la pantalla');

    if (typeof window.firebaseFunctions === 'undefined') {
        const check = setInterval(function() {
            if (typeof window.firebaseFunctions !== 'undefined') {
                clearInterval(check);
                iniciarSistema();
            }
        }, 500);
    } else {
        iniciarSistema();
    }
});

function iniciarSistema() {
    if (obtenerSesionAdmin()) {
        const loginSection = document.getElementById('loginSection');
        const adminPanel = document.getElementById('adminPanel');
        if (loginSection) loginSection.style.display = 'none';
        if (adminPanel) adminPanel.style.display = 'block';
        cargarDatosAdmin();
        iniciarPollingAdmin();
    }
    const usuario = obtenerSesionUsuario();
    if (usuario) {
        usuarioActual = usuario;
        window.usuarioActual = usuario;
        const loginSection = document.getElementById('loginUsuarioSection');
        const panel = document.getElementById('usuarioPanel');
        if (loginSection) loginSection.style.display = 'none';
        if (panel) panel.style.display = 'block';
        cargarPanelUsuario(usuario);
        iniciarPollingUsuario(usuario.id);
    }
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}