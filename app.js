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
            if (f.reproducirSonido) {
                f.reproducirSonido();
                setTimeout(() => { if (f.reproducirSonido) f.reproducirSonido(); }, 300);
            }
        }
    }
}

// Eventos que activan el sonido (solo si el usuario interactúa)
document.addEventListener('click', function() {
    activarSonidoGlobal();
});
document.addEventListener('touchstart', function() {
    activarSonidoGlobal();
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

function loginAdmin() {
    const pass = document.getElementById('adminPassword').value;
    if (pass === ADMIN_PASSWORD) {
        guardarSesionAdmin(true);
        const loginSection = document.getElementById('loginSection');
        const adminPanel = document.getElementById('adminPanel');
        if (loginSection) loginSection.style.display = 'none';
        if (adminPanel) adminPanel.style.display = 'block';
        cargarDatosAdmin();
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
    const f = fb();
    if (f) f.dejarDeEscuchar();
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
        } else {
            if (errorEl) errorEl.textContent = '❌ Usuario o contraseña incorrectos';
        }
    } catch (error) {
        console.error('Error en login:', error);
        if (errorEl) errorEl.textContent = '❌ Error de conexión';
    }
}

function logoutUsuario() {
    usuarioActual = null;
    window.usuarioActual = null;
    limpiarSesion();
    const f = fb();
    if (f) f.dejarDeEscuchar();
    
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
        const activos = usuariosCache.filter(u => u.activo);
        sel.innerHTML = '<option value="">Sin asignar</option>' + 
            activos.map(u => `<option value="${u.id}">${u.nombre} (${u.vehiculo})</option>`).join('');
    }
}

async function cargarClientes() {
    const f = fb();
    if (!f) return;
    clientesCache = await f.getClientes();
    renderClientes(clientesCache);
    
    const sel = document.getElementById('clienteOrigen');
    if (sel) {
        const activos = clientesCache.filter(c => c.activo);
        sel.innerHTML = '<option value="">Seleccionar cliente</option>' + 
            activos.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
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
        container.innerHTML = '<p>No hay usuarios</p>';
        return;
    }
    container.innerHTML = usuarios.map(u => `
        <div class="card">
            <h4>${u.nombre}</h4>
            <p>👤 @${u.username}</p>
            <p>🚗 ${u.vehiculo}</p>
            <p>💰 $${u.liquidacionTotal || 0}</p>
            <p>📦 ${u.pedidosCompletados || 0}</p>
            <span class="badge ${u.activo && u.disponible ? 'badge-active' : 'badge-inactive'}">
                ${u.activo ? (u.disponible ? '🟢 Disponible' : '⏸️ No disponible') : '❌ Inactivo'}
            </span>
            <div class="card-actions">
                <button onclick="toggleUsuarioActivo(${u.id})" class="${u.activo ? 'btn-danger' : 'btn-success'}">
                    ${u.activo ? 'Desactivar' : 'Activar'}
                </button>
                <button onclick="toggleDisponibilidadAdmin(${u.id})" class="${u.disponible ? 'btn-secondary' : 'btn-success'}" ${!u.activo ? 'disabled' : ''}>
                    ${u.disponible ? '⏸️ Pausar' : '▶️ Activar'}
                </button>
                <button onclick="verLiquidacionDetalle(${u.id})" class="btn-primary">💰 Liquidación</button>
                <button onclick="ajustarLiquidacion(${u.id})" class="btn-secondary">✏️ Ajustar</button>
                <button onclick="eliminarUsuario(${u.id})" class="btn-danger">Eliminar</button>
            </div>
        </div>
    `).join('');
}

function renderClientes(clientes) {
    const container = document.getElementById('listaClientes');
    if (!container) return;
    if (!clientes || clientes.length === 0) {
        container.innerHTML = '<p>No hay clientes</p>';
        return;
    }
    container.innerHTML = clientes.map(c => `
        <div class="card">
            <h4>${c.nombre}</h4>
            <p>📍 ${c.direccion || 'Sin dirección'}</p>
            <p>📞 ${c.telefono || 'Sin teléfono'}</p>
            <span class="badge ${c.activo ? 'badge-active' : 'badge-inactive'}">
                ${c.activo ? '✅ Activo' : '❌ Inactivo'}
            </span>
            <div class="card-actions">
                <button onclick="toggleClienteActivo(${c.id})" class="${c.activo ? 'btn-danger' : 'btn-success'}">
                    ${c.activo ? 'Desactivar' : 'Activar'}
                </button>
                <button onclick="eliminarCliente(${c.id})" class="btn-danger">Eliminar</button>
            </div>
        </div>
    `).join('');
}

function renderPedidosAdmin(pedidos) {
    const container = document.getElementById('listaPedidos');
    if (!container) return;
    if (!pedidos || pedidos.length === 0) {
        container.innerHTML = '<p>No hay pedidos</p>';
        return;
    }
    container.innerHTML = pedidos.map(p => {
        const u = usuariosCache.find(u => u.id === p.usuarioAsignado);
        return `
        <div class="card">
            <h4>📦 ${p.descripcion}</h4>
            <p>📍 ${p.origen || 'Sin origen'} → ${p.destino || 'Sin destino'}</p>
            <p>💰 Servicio: $${p.costoServicio || 0} | Repartidor: $${p.pagoRepartidor || 0}</p>
            <p>👤 ${u ? u.nombre : 'Sin asignar'}</p>
            <p>🕐 ${p.fechaCreacion ? new Date(p.fechaCreacion).toLocaleString() : 'Sin fecha'}</p>
            <span class="badge badge-${p.estado || 'pendiente'}">${(p.estado || 'pendiente').toUpperCase()}</span>
            <div class="card-actions">
                ${p.estado === 'pendiente' ? `<button onclick="asignarPedido(${p.id})" class="btn-primary">Asignar</button>` : ''}
                ${p.estado === 'asignado' ? `<button onclick="completarPedido(${p.id})" class="btn-success">Completar</button>` : ''}
                <button onclick="eliminarPedido(${p.id})" class="btn-danger">Eliminar</button>
            </div>
        </div>
    `}).join('');
}

// ============================================================
// ===== LIQUIDACIONES — INTERFAZ COMPLETA =====
// ============================================================

async function verLiquidacionDetalle(id) {
    const u = usuariosCache.find(u => u.id === id);
    if (!u) {
        alert('Usuario no encontrado');
        return;
    }
    
    const f = fb();
    if (!f) { alert('Error de conexión'); return; }
    
    const pedidos = await f.getPedidos();
    const pedidosCompletados = pedidos.filter(p => p.usuarioAsignado === id && p.estado === 'completado');
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;justify-content:center;align-items:center;z-index:1000;padding:20px;';
    
    modal.innerHTML = `
        <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;max-width:600px;width:100%;max-height:85vh;overflow-y:auto;padding:25px;">
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #2a2a2a;padding-bottom:15px;margin-bottom:20px;">
                <h2 style="color:#ff6b35;margin:0;">💰 ${u.nombre}</h2>
                <button onclick="this.closest('.modal-overlay').remove()" style="background:#dc3545;color:white;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;">✕</button>
            </div>
            <div style="background:#2a2a2a;padding:15px;border-radius:8px;margin-bottom:20px;">
                <p><strong>Total a pagar:</strong> $${u.liquidacionTotal || 0}</p>
                <p><strong>Pedidos completados:</strong> ${u.pedidosCompletados || 0}</p>
                <p><strong>Vehículo:</strong> ${u.vehiculo}</p>
            </div>
            
            <h4 style="color:#ff6b35;margin-bottom:10px;">📦 Pedidos completados</h4>
            <div style="max-height:200px;overflow-y:auto;">
                ${pedidosCompletados.length === 0 ? '<p style="color:#888;">No hay pedidos completados</p>' :
                    pedidosCompletados.map(p => `
                        <div style="background:#2a2a2a;padding:10px;border-radius:6px;margin-bottom:10px;border-left:3px solid #28a745;">
                            <p style="margin:3px 0;">${p.descripcion}</p>
                            <p style="margin:3px 0;font-size:0.9rem;color:#b0b0b0;">📍 ${p.origen} → ${p.destino}</p>
                            <p style="margin:3px 0;color:#28a745;">💰 $${p.pagoRepartidor}</p>
                        </div>
                    `).join('')}
            </div>
            
            <div style="display:flex;gap:10px;margin-top:20px;">
                <button onclick="pagarLiquidacion(${u.id})" style="flex:1;padding:12px;background:#28a745;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">
                    ✅ Pagar Liquidación
                </button>
                <button onclick="this.closest('.modal-overlay').remove()" style="flex:1;padding:12px;background:#6c757d;color:white;border:none;border-radius:6px;cursor:pointer;">
                    Cerrar
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function pagarLiquidacion(id) {
    if (!confirm('¿Confirmar pago? Esto reiniciará el contador a $0')) return;
    
    const u = usuariosCache.find(u => u.id === id);
    if (!u) { alert('Usuario no encontrado'); return; }
    
    const f = fb();
    if (!f) { alert('Error de conexión'); return; }
    
    try {
        const historial = await f.getHistorial();
        historial.push({
            usuarioId: id,
            usuarioNombre: u.nombre,
            monto: u.liquidacionTotal || 0,
            fecha: new Date().toISOString(),
            detalle: 'Pago de liquidación - ' + (u.pedidosCompletados || 0) + ' pedidos'
        });
        await f.setHistorial(historial);
        
        await f.setUsuario(id, {
            ...u,
            liquidacionTotal: 0,
            pedidosCompletados: 0,
            ajustesLiquidacion: []
        });
        
        const modal = document.querySelector('.modal-overlay');
        if (modal) modal.remove();
        
        await cargarUsuarios();
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
    await f.setUsuario(id, { nombre, username, password, vehiculo, activo: true, disponible: true, liquidacionTotal: 0, pedidosCompletados: 0, ajustesLiquidacion: [] });
    hideForm('usuario');
    ['nombre','username','password'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const vehEl = document.getElementById('vehiculo');
    if (vehEl) vehEl.value = 'bici';
    await cargarUsuarios();
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

// ============================================================
// ===== CRUD CLIENTES =====
// ============================================================

async function crearCliente() {
    const nombre = document.getElementById('clienteNombre').value;
    const direccion = document.getElementById('clienteDireccion').value;
    const telefono = document.getElementById('clienteTelefono').value;
    const email = document.getElementById('clienteEmail').value;
    if (!nombre || !direccion) { alert('Nombre y dirección son obligatorios'); return; }
    const f = fb();
    if (!f) { alert('Error de conexión'); return; }
    const id = await f.getNextId('clientes');
    await f.setCliente(id, { nombre, direccion, telefono, email, activo: true });
    hideForm('cliente');
    ['clienteNombre','clienteDireccion','clienteTelefono','clienteEmail'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
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
    await f.setUsuario(id, { ...u, ajustesLiquidacion: ajustes, liquidacionTotal: (u.liquidacionTotal || 0) + monto });
    await cargarUsuarios();
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
    
    const liquidacion = document.getElementById('liquidacionUsuario');
    if (liquidacion) liquidacion.textContent = '$' + (usuario.liquidacionTotal || 0);
    
    actualizarEstado(usuario);
    await cargarPedidosUsuario(usuario.id);
    iniciarEscucha();
}

function getVehiculoIcon(v) {
    const icons = { bici: '🚲 Bici', moto: '🏍️ Moto', auto: '🚗 Auto' };
    return icons[v] || v;
}

function actualizarEstado(usuario) {
    const es = document.getElementById('estadoUsuario');
    const btn = document.getElementById('btnDisponibilidad');
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
}

async function toggleDisponibilidad() {
    if (!usuarioActual) return;
    const nuevo = !usuarioActual.disponible;
    const f = fb();
    if (!f) { alert('Error de conexión'); return; }
    await f.setUsuario(usuarioActual.id, { ...usuarioActual, disponible: nuevo });
    usuarioActual.disponible = nuevo;
    window.usuarioActual = usuarioActual;
    guardarSesionUsuario(usuarioActual);
    actualizarEstado(usuarioActual);
    await cargarPedidosUsuario(usuarioActual.id);
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
        el.innerHTML = pendientes.length === 0 ? '<p>No hay pedidos disponibles</p>' :
            pendientes.map(p => `
                <div class="card">
                    <h4>📦 ${p.descripcion}</h4>
                    <p>📍 ${p.origen || 'Sin origen'} → ${p.destino || 'Sin destino'}</p>
                    <p>💰 Pago: $${p.pagoRepartidor || 0}</p>
                    <div class="card-actions">
                        <button onclick="tomarPedido(${p.id})" class="btn-success">✅ Tomar Pedido</button>
                    </div>
                </div>
            `).join('');
    }
    
    const mis = pedidos.filter(p => p.usuarioAsignado === usuarioId && p.estado === 'asignado');
    const el2 = document.getElementById('misPedidos');
    if (el2) {
        el2.innerHTML = mis.length === 0 ? '<p>No tienes pedidos asignados</p>' :
            mis.map(p => `
                <div class="card">
                    <h4>📦 ${p.descripcion}</h4>
                    <p>📍 ${p.origen} → ${p.destino}</p>
                    <p>💰 Pago: $${p.pagoRepartidor}</p>
                    <span class="badge badge-asignado">ASIGNADO</span>
                    <div class="card-actions">
                        <button onclick="completarPedidoUsuario(${p.id})" class="btn-success">✅ Completar</button>
                    </div>
                </div>
            `).join('');
    }
    
    const hist = pedidos.filter(p => p.usuarioAsignado === usuarioId && p.estado === 'completado');
    const el3 = document.getElementById('historialPedidos');
    if (el3) {
        el3.innerHTML = hist.length === 0 ? '<p>No hay pedidos completados</p>' :
            hist.map(p => `
                <div class="card">
                    <h4>📦 ${p.descripcion}</h4>
                    <p>📍 ${p.origen} → ${p.destino}</p>
                    <p>💰 Pago: $${p.pagoRepartidor}</p>
                    <p>✅ ${p.fechaCompletado ? new Date(p.fechaCompletado).toLocaleString() : 'Sin fecha'}</p>
                </div>
            `).join('');
    }
}

// ============================================================
// ===== TOMAR Y COMPLETAR PEDIDOS (CORREGIDO) =====
// ============================================================

async function tomarPedido(id) {
    // ✅ VALIDACIÓN: Usuario logueado y disponible
    if (!usuarioActual) {
        alert('Debes iniciar sesión');
        return;
    }
    if (!usuarioActual.disponible) {
        alert('No estás disponible para tomar pedidos');
        return;
    }
    if (!confirm('¿Tomar este pedido?')) return;

    // ✅ VALIDACIÓN: Buscar pedido en caché
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
        
        // ✅ ACTUALIZAR también el panel de admin si está visible
        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel && adminPanel.style.display !== 'none') {
            await cargarPedidos();
        }
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

        // Actualizar liquidación del usuario
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
            
            const liquidacionEl = document.getElementById('liquidacionUsuario');
            if (liquidacionEl) liquidacionEl.textContent = '$' + nuevoTotal;
            guardarSesionUsuario(usuarioActual);
        }

        // Actualizar liquidación del admin
        const ganancia = p.gananciaAdmin || p.costoServicio - p.pagoRepartidor;
        liquidacionAdmin.total = (liquidacionAdmin.total || 0) + ganancia;
        await f.setLiquidacionAdmin(liquidacionAdmin);

        await cargarPedidosUsuario(usuarioActual.id);

        const adminPanel = document.getElementById('adminPanel');
        if (adminPanel && adminPanel.style.display !== 'none') {
            await cargarPedidos();
            await cargarUsuarios();
        }
        alert('✅ Pedido completado exitosamente');
    } catch (error) {
        console.error('Error al completar pedido:', error);
        alert('Error al completar pedido');
    }
}

// ============================================================
// ===== NOTIFICACIONES EN TIEMPO REAL =====
// ============================================================

function iniciarEscucha() {
    const f = fb();
    if (!f) {
        setTimeout(iniciarEscucha, 2000);
        return;
    }
    console.log('📡 Escuchando pedidos en tiempo real...');

    f.escucharNuevosPedidos(function(nuevo) {
        if (ultimoPedidoPendiente === null || nuevo.id !== ultimoPedidoPendiente.id) {
            ultimoPedidoPendiente = nuevo;

            // Reproducir sonido (solo si está habilitado)
            if (f.reproducirSonido) {
                f.reproducirSonido();
                setTimeout(() => { if (f.reproducirSonido) f.reproducirSonido(); }, 300);
                setTimeout(() => { if (f.reproducirSonido) f.reproducirSonido(); }, 600);
            }

            // Alerta visual
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
            if (panel) panel.insertBefore(alerta, panel.firstChild);
            setTimeout(() => { if (alerta.parentNode) alerta.remove(); }, 15000);

            if (usuarioActual) {
                cargarPedidosUsuario(usuarioActual.id);
            }
        }
    });
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
    const tabs = ['usuarios', 'clientes', 'pedidos', 'liquidaciones', 'admin'];
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
    const container = document.getElementById('liquidacionesList');
    if (!container) return;
    container.innerHTML = usuarios.map(u => `
        <div class="card">
            <h4>${u.nombre}</h4>
            <p>🚗 ${u.vehiculo}</p>
            <p>💰 $${u.liquidacionTotal || 0}</p>
            <p>📦 ${u.pedidosCompletados || 0}</p>
            <span class="badge ${u.activo ? 'badge-active' : 'badge-inactive'}">${u.activo ? '✅ Activo' : '❌ Inactivo'}</span>
            <div class="card-actions">
                <button onclick="verLiquidacionDetalle(${u.id})" class="btn-primary">💰 Ver Detalle</button>
                <button onclick="ajustarLiquidacion(${u.id})" class="btn-secondary">✏️ Ajustar</button>
            </div>
        </div>
    `).join('');
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

    // ✅ NO se activa sonido automáticamente — solo con interacción del usuario

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
    }
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}