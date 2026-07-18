// ============================================================
// ===== CONFIGURACIÓN GENERAL =====
// ============================================================
const ADMIN_PASSWORD = 'LedZepp1';
let usuarioActual = null;
let pedidosCache = [];
let usuariosCache = [];
let historialLiquidaciones = [];
let liquidacionAdmin = { total: 0, historial: [] };
let adminAutenticado = false;

// ===== VARIABLES PARA NOTIFICACIONES =====
let ultimoPedidoPendiente = null;
let intervaloVerificacion = null;
let notificacionSonidoHabilitada = true;

// ===== REFERENCIA A FUNCIONES DE FIREBASE =====
const {
    escucharNuevosPedidos,
    dejarDeEscucharNuevosPedidos,
    getUsuarios,
    setUsuario,
    deleteUsuario,
    getPedidos,
    setPedido,
    deletePedido,
    getHistorialLiquidaciones,
    setHistorialLiquidaciones,
    getLiquidacionAdmin,
    setLiquidacionAdmin,
    getNextId,
    crearPedidoConPushup,
    database
} = window.firebaseFunctions;

// ============================================================
// ===== MANEJO DE SESIÓN =====
// ============================================================

function guardarSesionAdmin(estado) {
    sessionStorage.setItem('adminAutenticado', JSON.stringify(estado));
}

function obtenerSesionAdmin() {
    const data = sessionStorage.getItem('adminAutenticado');
    return data ? JSON.parse(data) : false;
}

function guardarSesionUsuario(usuario) {
    sessionStorage.setItem('usuarioActual', JSON.stringify(usuario));
}

function obtenerSesionUsuario() {
    const data = sessionStorage.getItem('usuarioActual');
    return data ? JSON.parse(data) : null;
}

function limpiarSesion() {
    sessionStorage.removeItem('adminAutenticado');
    sessionStorage.removeItem('usuarioActual');
}

// ============================================================
// ===== PREVENIR RECARGA DE PÁGINA =====
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey && e.key === 'r') || e.key === 'F5') {
            e.preventDefault();
            return false;
        }
    });
    
    document.addEventListener('submit', function(e) {
        e.preventDefault();
        return false;
    });
    
    const adminPass = document.getElementById('adminPassword');
    if (adminPass) {
        adminPass.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                loginAdmin();
            }
        });
    }
    
    const userPass = document.getElementById('userPass');
    if (userPass) {
        userPass.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                loginUsuario();
            }
        });
    }
    
    const userLogin = document.getElementById('userLogin');
    if (userLogin) {
        userLogin.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                loginUsuario();
            }
        });
    }
    
    verificarSesion();
    cargarHistorialLiquidaciones();
    cargarLiquidacionAdmin();
    
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});

// ============================================================
// ===== VERIFICAR SESIÓN =====
// ============================================================

async function verificarSesion() {
    const adminAutenticado = obtenerSesionAdmin();
    if (adminAutenticado) {
        const loginSection = document.getElementById('loginSection');
        const adminPanel = document.getElementById('adminPanel');
        if (loginSection && adminPanel) {
            loginSection.style.display = 'none';
            adminPanel.style.display = 'block';
            await cargarDatosAdmin();
        }
        return;
    }
    
    const usuario = obtenerSesionUsuario();
    if (usuario) {
        usuarioActual = usuario;
        const loginUsuarioSection = document.getElementById('loginUsuarioSection');
        const usuarioPanel = document.getElementById('usuarioPanel');
        if (loginUsuarioSection && usuarioPanel) {
            loginUsuarioSection.style.display = 'none';
            usuarioPanel.style.display = 'block';
            await cargarPanelUsuario(usuario);
        }
        return;
    }
}

// ============================================================
// ===== CARGAR HISTORIAL Y LIQUIDACIÓN ADMIN =====
// ============================================================

async function cargarHistorialLiquidaciones() {
    try {
        historialLiquidaciones = await getHistorialLiquidaciones();
    } catch (error) {
        historialLiquidaciones = JSON.parse(localStorage.getItem('historialLiquidaciones') || '[]');
    }
}

async function guardarHistorialLiquidaciones() {
    try {
        await setHistorialLiquidaciones(historialLiquidaciones);
    } catch (error) {
        localStorage.setItem('historialLiquidaciones', JSON.stringify(historialLiquidaciones));
    }
}

async function cargarLiquidacionAdmin() {
    try {
        liquidacionAdmin = await getLiquidacionAdmin();
    } catch (error) {
        liquidacionAdmin = JSON.parse(localStorage.getItem('liquidacionAdmin') || '{"total":0,"historial":[]}');
    }
}

async function guardarLiquidacionAdmin() {
    try {
        await setLiquidacionAdmin(liquidacionAdmin);
    } catch (error) {
        localStorage.setItem('liquidacionAdmin', JSON.stringify(liquidacionAdmin));
    }
}

// ============================================================
// ===== ADMIN LOGIN =====
// ============================================================

function loginAdmin() {
    const password = document.getElementById('adminPassword').value;
    if (password === ADMIN_PASSWORD) {
        guardarSesionAdmin(true);
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        cargarDatosAdmin();
        document.getElementById('adminPassword').value = '';
        document.getElementById('loginError').textContent = '';
    } else {
        document.getElementById('loginError').textContent = '❌ Clave incorrecta';
    }
}

function logout() {
    if (!confirm('¿Cerrar sesión?')) return;
    limpiarSesion();
    detenerVerificacionPedidos();
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('adminPassword').value = '';
}

// ============================================================
// ===== USUARIO LOGIN =====
// ============================================================

async function loginUsuario() {
    const username = document.getElementById('userLogin').value;
    const password = document.getElementById('userPass').value;
    
    try {
        const usuarios = await getUsuarios();
        const usuario = usuarios.find(u => u.username === username && u.password === password);
        
        if (usuario) {
            usuarioActual = usuario;
            guardarSesionUsuario(usuario);
            document.getElementById('loginUsuarioSection').style.display = 'none';
            document.getElementById('usuarioPanel').style.display = 'block';
            await cargarPanelUsuario(usuario);
            document.getElementById('userLoginError').textContent = '';
        } else {
            document.getElementById('userLoginError').textContent = '❌ Usuario o contraseña incorrectos';
        }
    } catch (error) {
        document.getElementById('userLoginError').textContent = '❌ Error de conexión';
    }
}

function logoutUsuario() {
    usuarioActual = null;
    limpiarSesion();
    detenerVerificacionPedidos();
    document.getElementById('loginUsuarioSection').style.display = 'block';
    document.getElementById('usuarioPanel').style.display = 'none';
    document.getElementById('userLogin').value = '';
    document.getElementById('userPass').value = '';
}

// ============================================================
// ===== PANEL ADMIN =====
// ============================================================

async function cargarDatosAdmin() {
    try {
        await cargarUsuarios();
        await cargarPedidos();
        await cargarHistorialLiquidaciones();
        await cargarLiquidacionAdmin();
        actualizarLiquidacionAdminUI();
    } catch (error) {
        console.error('Error cargando datos:', error);
    }
}

function actualizarLiquidacionAdminUI() {
    const totalAdmin = document.getElementById('totalAdmin');
    if (totalAdmin) {
        totalAdmin.textContent = `$${liquidacionAdmin.total || 0}`;
    }
}

// ============================================================
// ===== USUARIOS =====
// ============================================================

async function cargarUsuarios() {
    try {
        usuariosCache = await getUsuarios();
        renderUsuarios(usuariosCache);
    } catch (error) {
        console.error('Error cargando usuarios:', error);
    }
}

function renderUsuarios(usuarios) {
    const container = document.getElementById('listaUsuarios');
    if (!container) return;
    
    if (!usuarios || usuarios.length === 0) {
        container.innerHTML = '<p>No hay usuarios registrados</p>';
        return;
    }
    
    container.innerHTML = usuarios.map(u => {
        let disponibilidadText = '';
        let disponibilidadClass = '';
        if (u.activo) {
            if (u.disponible) {
                disponibilidadText = '🟢 Disponible';
                disponibilidadClass = 'badge-active';
            } else {
                disponibilidadText = '⏸️ No disponible';
                disponibilidadClass = 'badge-inactive';
            }
        } else {
            disponibilidadText = '❌ Inactivo';
            disponibilidadClass = 'badge-inactive';
        }
        
        return `
        <div class="card">
            <h4>${u.nombre}</h4>
            <p>👤 @${u.username}</p>
            <p>🚗 ${u.vehiculo}</p>
            <p>💰 $${u.liquidacionTotal || 0}</p>
            <p>📦 ${u.pedidosCompletados || 0} pedidos</p>
            <span class="badge ${disponibilidadClass}">${disponibilidadText}</span>
            <div class="card-actions">
                <button type="button" onclick="toggleUsuarioActivo(${u.id})" class="${u.activo ? 'btn-danger' : 'btn-success'}">
                    ${u.activo ? 'Desactivar' : 'Activar'}
                </button>
                <button type="button" onclick="toggleDisponibilidadAdmin(${u.id})" class="${u.disponible ? 'btn-secondary' : 'btn-success'}" ${!u.activo ? 'disabled' : ''}>
                    ${u.disponible ? '⏸️ Pausar' : '▶️ Activar'}
                </button>
                <button type="button" onclick="verLiquidacionUsuario(${u.id})" class="btn-primary">💰 Liquidación</button>
                <button type="button" onclick="ajustarLiquidacion(${u.id})" class="btn-secondary">✏️ Ajustar</button>
                <button type="button" onclick="eliminarUsuario(${u.id})" class="btn-danger">Eliminar</button>
            </div>
        </div>
    `}).join('');
}

async function toggleUsuarioActivo(id) {
    try {
        const usuario = usuariosCache.find(u => u.id === id);
        if (!usuario) return;
        
        await setUsuario(id, { ...usuario, activo: !usuario.activo });
        await cargarUsuarios();
        await cargarPedidos();
    } catch (error) {
        console.error('Error:', error);
        alert('Error al cambiar estado del usuario');
    }
}

async function toggleDisponibilidadAdmin(id) {
    const usuario = usuariosCache.find(u => u.id === id);
    if (!usuario) return;
    
    if (!usuario.activo) {
        alert('El usuario está inactivo. Actívalo primero.');
        return;
    }
    
    const nuevoEstado = !usuario.disponible;
    const mensaje = nuevoEstado ? 'disponible' : 'no disponible';
    
    if (!confirm(`¿Cambiar disponibilidad de ${usuario.nombre} a "${mensaje}"?`)) return;
    
    try {
        await setUsuario(id, { ...usuario, disponible: nuevoEstado });
        usuario.disponible = nuevoEstado;
        await cargarUsuarios();
        await cargarPedidos();
        await cargarLiquidaciones();
    } catch (error) {
        console.error('Error:', error);
        alert('Error al cambiar disponibilidad del usuario');
    }
}

async function eliminarUsuario(id) {
    if (!confirm('¿Eliminar este usuario?')) return;
    try {
        await deleteUsuario(id);
        await cargarUsuarios();
        await cargarPedidos();
    } catch (error) {
        console.error('Error:', error);
        alert('Error al eliminar usuario');
    }
}

async function crearUsuario() {
    const nombre = document.getElementById('nombre').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const vehiculo = document.getElementById('vehiculo').value;
    
    if (!nombre || !username || !password) {
        alert('Todos los campos son obligatorios');
        return;
    }
    
    try {
        const id = await getNextId('usuarios');
        const nuevoUsuario = {
            nombre,
            username,
            password,
            vehiculo,
            activo: true,
            disponible: true,
            liquidacionTotal: 0,
            pedidosCompletados: 0,
            ajustesLiquidacion: []
        };
        await setUsuario(id, nuevoUsuario);
        hideForm('usuario');
        document.getElementById('nombre').value = '';
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('vehiculo').value = 'bici';
        await cargarUsuarios();
        await cargarPedidos();
    } catch (error) {
        console.error('Error:', error);
        alert('Error al crear usuario');
    }
}

// ============================================================
// ===== AJUSTES DE LIQUIDACIÓN =====
// ============================================================

async function ajustarLiquidacion(id) {
    const usuario = usuariosCache.find(u => u.id === id);
    if (!usuario) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>✏️ Ajustar Liquidación - ${usuario.nombre}</h2>
                <button type="button" onclick="this.closest('.modal-overlay').remove()" class="btn-danger">✕</button>
            </div>
            <div class="modal-body">
                <div class="ajuste-info">
                    <p><strong>Liquidación actual:</strong> $${usuario.liquidacionTotal || 0}</p>
                </div>
                <div class="ajuste-form">
                    <input type="text" id="conceptoAjuste" placeholder="Concepto (ej: Bono, Descuento, etc.)" class="input-field">
                    <input type="number" id="montoAjuste" placeholder="Monto (positivo o negativo)" class="input-field">
                    <div class="form-actions">
                        <button type="button" onclick="aplicarAjuste(${id})" class="btn-primary">Aplicar Ajuste</button>
                        <button type="button" onclick="this.closest('.modal-overlay').remove()" class="btn-secondary">Cancelar</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function aplicarAjuste(id) {
    const concepto = document.getElementById('conceptoAjuste').value;
    const monto = parseFloat(document.getElementById('montoAjuste').value);
    
    if (!concepto) {
        alert('Debes ingresar un concepto');
        return;
    }
    
    if (isNaN(monto) || monto === 0) {
        alert('Debes ingresar un monto válido (positivo o negativo)');
        return;
    }
    
    const usuario = usuariosCache.find(u => u.id === id);
    if (!usuario) return;
    
    try {
        const ajustesActuales = usuario.ajustesLiquidacion || [];
        const nuevoAjuste = {
            id: Date.now(),
            fecha: new Date().toISOString(),
            concepto: concepto,
            monto: monto,
            tipo: monto > 0 ? 'extra' : 'descuento'
        };
        
        ajustesActuales.push(nuevoAjuste);
        
        await setUsuario(id, {
            ...usuario,
            ajustesLiquidacion: ajustesActuales,
            liquidacionTotal: (usuario.liquidacionTotal || 0) + monto
        });
        
        const modal = document.querySelector('.modal-overlay');
        if (modal) modal.remove();
        
        await cargarUsuarios();
        await cargarPedidos();
        
        alert('✅ Ajuste aplicado correctamente');
    } catch (error) {
        console.error('Error:', error);
        alert('Error al aplicar ajuste');
    }
}

// ============================================================
// ===== FUNCIONES DE LIQUIDACIÓN =====
// ============================================================

async function verLiquidacionUsuario(id) {
    const usuario = usuariosCache.find(u => u.id === id);
    if (!usuario) return;
    
    const historialUsuario = historialLiquidaciones.filter(h => h.usuarioId === id);
    const ajustes = usuario.ajustesLiquidacion || [];
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>💰 Liquidación de ${usuario.nombre}</h2>
                <button type="button" onclick="this.closest('.modal-overlay').remove()" class="btn-danger">✕</button>
            </div>
            <div class="modal-body">
                <div class="liquidacion-resumen">
                    <p><strong>Total a pagar:</strong> $${usuario.liquidacionTotal || 0}</p>
                    <p><strong>Pedidos completados:</strong> ${usuario.pedidosCompletados || 0}</p>
                </div>
                
                ${ajustes.length > 0 ? `
                <div class="ajustes-section">
                    <h4>📝 Ajustes aplicados</h4>
                    ${ajustes.map(a => `
                        <div class="historial-item ${a.monto > 0 ? 'extra' : 'descuento'}">
                            <p><strong>${new Date(a.fecha).toLocaleString()}</strong></p>
                            <p>${a.concepto}: $${a.monto > 0 ? '+' : ''}${a.monto}</p>
                        </div>
                    `).join('')}
                </div>
                ` : ''}
                
                <div class="liquidacion-actions">
                    <button type="button" onclick="descargarLiquidacionTXT(${usuario.id})" class="btn-primary">📥 Descargar TXT</button>
                    <button type="button" onclick="pagarLiquidacion(${usuario.id})" class="btn-success">✅ Marcar como Pagado</button>
                </div>
                
                <div class="historial-section">
                    <h4>📜 Historial de Pagos</h4>
                    <div class="historial-lista">
                        ${historialUsuario.length === 0 ? '<p>No hay historial de pagos</p>' : 
                        historialUsuario.map(h => `
                            <div class="historial-item">
                                <p><strong>${new Date(h.fecha).toLocaleString()}</strong></p>
                                <p>Monto: $${h.monto}</p>
                                <p>${h.detalle || 'Pago realizado'}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function descargarLiquidacionTXT(id) {
    const usuario = usuariosCache.find(u => u.id === id);
    if (!usuario) return;
    
    const pedidos = await getPedidos();
    const pedidosUsuario = pedidos.filter(p => p.usuarioAsignado === id && p.estado === 'completado');
    const ajustes = usuario.ajustesLiquidacion || [];
    
    const fecha = new Date().toLocaleString();
    const contenido = `
========================================
    LIQUIDACIÓN DE REPARTIDOR
========================================
Fecha: ${fecha}
Usuario: ${usuario.nombre}
Vehículo: ${usuario.vehiculo}

--- DETALLE DE PEDIDOS ---
${pedidosUsuario.map((p, i) => `
${i+1}. ${p.descripcion}
   Origen: ${p.origen}
   Destino: ${p.destino}
   Pago: $${p.pagoRepartidor}
   Creación: ${new Date(p.fechaCreacion).toLocaleString()}
   Entrega: ${p.fechaCompletado ? new Date(p.fechaCompletado).toLocaleString() : 'Pendiente'}
`).join('')}

--- AJUSTES APLICADOS ---
${ajustes.length === 0 ? 'Sin ajustes' : ajustes.map(a => `
${new Date(a.fecha).toLocaleString()}
Concepto: ${a.concepto}
Monto: $${a.monto > 0 ? '+' : ''}${a.monto}
`).join('')}

--- RESUMEN ---
Total pedidos: ${pedidosUsuario.length}
Total ajustes: $${ajustes.reduce((sum, a) => sum + a.monto, 0)}
Total a cobrar: $${usuario.liquidacionTotal || 0}
========================================
    `;
    
    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `liquidacion_${usuario.username}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

async function pagarLiquidacion(id) {
    if (!confirm('¿Confirmar pago de liquidación? Esto reiniciará el contador a $0')) return;
    
    const usuario = usuariosCache.find(u => u.id === id);
    if (!usuario) return;
    
    const montoPagado = usuario.liquidacionTotal || 0;
    
    try {
        historialLiquidaciones.push({
            usuarioId: id,
            usuarioNombre: usuario.nombre,
            monto: montoPagado,
            fecha: new Date().toISOString(),
            detalle: `Pago de liquidación - ${usuario.pedidosCompletados} pedidos completados, ${(usuario.ajustesLiquidacion || []).length} ajustes`
        });
        await guardarHistorialLiquidaciones();
        
        await setUsuario(id, {
            ...usuario,
            liquidacionTotal: 0,
            pedidosCompletados: 0,
            ajustesLiquidacion: []
        });
        
        await cargarUsuarios();
        await cargarPedidos();
        
        const modal = document.querySelector('.modal-overlay');
        if (modal) modal.remove();
        
        alert('✅ Liquidación pagada exitosamente');
        
        const comprobante = `
========================================
    COMPROBANTE DE PAGO
========================================
Fecha: ${new Date().toLocaleString()}
Usuario: ${usuario.nombre}
Monto pagado: $${montoPagado}
Pedidos liquidados: ${usuario.pedidosCompletados}
Ajustes aplicados: ${(usuario.ajustesLiquidacion || []).length}
========================================
        `;
        const blob = new Blob([comprobante], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `comprobante_pago_${usuario.username}_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error al procesar el pago');
    }
}

// ============================================================
// ===== LIQUIDACIÓN DEL ADMINISTRADOR =====
// ============================================================

async function verLiquidacionAdmin() {
    await cargarLiquidacionAdmin();
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>💰 Liquidación del Administrador</h2>
                <button type="button" onclick="this.closest('.modal-overlay').remove()" class="btn-danger">✕</button>
            </div>
            <div class="modal-body">
                <div class="liquidacion-resumen">
                    <p><strong>Total ganado:</strong> $${liquidacionAdmin.total || 0}</p>
                </div>
                <div class="liquidacion-actions">
                    <button type="button" onclick="descargarLiquidacionAdminTXT()" class="btn-primary">📥 Descargar TXT</button>
                    <button type="button" onclick="cobrarLiquidacionAdmin()" class="btn-success">💰 Cobrar Liquidación</button>
                </div>
                <div class="historial-section">
                    <h4>📜 Historial de Cobros</h4>
                    <div class="historial-lista">
                        ${liquidacionAdmin.historial && liquidacionAdmin.historial.length === 0 ? '<p>No hay historial de cobros</p>' : 
                        (liquidacionAdmin.historial || []).map(h => `
                            <div class="historial-item">
                                <p><strong>${new Date(h.fecha).toLocaleString()}</strong></p>
                                <p>Monto: $${h.monto}</p>
                                <p>${h.detalle || 'Cobro realizado'}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function descargarLiquidacionAdminTXT() {
    await cargarLiquidacionAdmin();
    
    const pedidos = await getPedidos();
    const pedidosCompletados = pedidos.filter(p => p.estado === 'completado');
    
    const contenido = `
========================================
    LIQUIDACIÓN DEL ADMINISTRADOR
========================================
Fecha: ${new Date().toLocaleString()}

--- DETALLE DE PEDIDOS ---
${pedidosCompletados.map((p, i) => `
${i+1}. ${p.descripcion}
   Origen: ${p.origen}
   Destino: ${p.destino}
   Costo servicio: $${p.costoServicio}
   Pago repartidor: $${p.pagoRepartidor}
   Ganancia admin: $${p.gananciaAdmin || (p.costoServicio - p.pagoRepartidor)}
   Creación: ${new Date(p.fechaCreacion).toLocaleString()}
   Entrega: ${p.fechaCompletado ? new Date(p.fechaCompletado).toLocaleString() : 'Pendiente'}
   Repartidor: ${usuariosCache.find(u => u.id === p.usuarioAsignado)?.nombre || 'Sin asignar'}
`).join('')}

--- RESUMEN ---
Total pedidos completados: ${pedidosCompletados.length}
Total ganado: $${liquidacionAdmin.total || 0}
========================================
    `;
    
    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `liquidacion_admin_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

async function cobrarLiquidacionAdmin() {
    if (!confirm('¿Confirmar cobro de liquidación del administrador? Esto reiniciará el contador a $0')) return;
    
    const montoCobrado = liquidacionAdmin.total || 0;
    
    try {
        liquidacionAdmin.historial.push({
            fecha: new Date().toISOString(),
            monto: montoCobrado,
            detalle: `Cobro de liquidación - ${(await getPedidos()).filter(p => p.estado === 'completado').length} pedidos completados`
        });
        liquidacionAdmin.total = 0;
        await guardarLiquidacionAdmin();
        
        const modal = document.querySelector('.modal-overlay');
        if (modal) modal.remove();
        
        actualizarLiquidacionAdminUI();
        alert('✅ Liquidación del administrador cobrada exitosamente');
        
        const comprobante = `
========================================
    COMPROBANTE DE COBRO - ADMIN
========================================
Fecha: ${new Date().toLocaleString()}
Monto cobrado: $${montoCobrado}
========================================
        `;
        const blob = new Blob([comprobante], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `comprobante_cobro_admin_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error al procesar el cobro');
    }
}

// ============================================================
// ===== PEDIDOS ADMIN =====
// ============================================================

async function cargarPedidos() {
    try {
        pedidosCache = await getPedidos();
        renderPedidosAdmin(pedidosCache);
        
        const select = document.getElementById('usuarioAsignado');
        if (select) {
            const usuariosActivos = usuariosCache.filter(u => u.activo);
            select.innerHTML = '<option value="">Sin asignar</option>' + 
                usuariosActivos.map(u => `<option value="${u.id}">${u.nombre} (${u.vehiculo})</option>`).join('');
        }
    } catch (error) {
        console.error('Error cargando pedidos:', error);
    }
}

function renderPedidosAdmin(pedidos) {
    const container = document.getElementById('listaPedidos');
    if (!container) return;
    
    if (!pedidos || pedidos.length === 0) {
        container.innerHTML = '<p>No hay pedidos registrados</p>';
        return;
    }
    
    container.innerHTML = pedidos.map(p => {
        const usuario = usuariosCache.find(u => u.id === p.usuarioAsignado);
        return `
        <div class="card">
            <h4>📦 ${p.descripcion}</h4>
            <p>📍 ${p.origen} → ${p.destino}</p>
            <p>💰 Servicio: $${p.costoServicio} | Repartidor: $${p.pagoRepartidor}</p>
            <p>💼 Ganancia Admin: $${p.gananciaAdmin || (p.costoServicio - p.pagoRepartidor)}</p>
            <p>👤 ${usuario ? usuario.nombre : 'Sin asignar'}</p>
            <p>🕐 Creado: ${new Date(p.fechaCreacion).toLocaleString()}</p>
            ${p.fechaCompletado ? `<p>✅ Entregado: ${new Date(p.fechaCompletado).toLocaleString()}</p>` : ''}
            <span class="badge badge-${p.estado}">${p.estado.toUpperCase()}</span>
            <div class="card-actions">
                ${p.estado === 'pendiente' ? `<button type="button" onclick="asignarPedido(${p.id})" class="btn-primary">Asignar</button>` : ''}
                ${p.estado === 'asignado' ? `<button type="button" onclick="completarPedido(${p.id})" class="btn-success">Completar</button>` : ''}
                <button type="button" onclick="eliminarPedido(${p.id})" class="btn-danger">Eliminar</button>
            </div>
        </div>
    `}).join('');
}

// ===== CREAR PEDIDO CON PUSHUP (Notificación en tiempo real) =====
async function crearPedido() {
    const descripcion = document.getElementById('descripcion').value;
    const origen = document.getElementById('origen').value;
    const destino = document.getElementById('destino').value;
    const costoServicio = parseFloat(document.getElementById('costoServicio').value);
    const pagoRepartidor = parseFloat(document.getElementById('pagoRepartidor').value);
    const usuarioAsignado = document.getElementById('usuarioAsignado').value;
    
    if (!descripcion || !origen || !destino || !costoServicio || !pagoRepartidor) {
        alert('Todos los campos son obligatorios');
        return;
    }
    
    const gananciaAdmin = costoServicio - pagoRepartidor;
    
    try {
        const nuevoPedido = {
            descripcion,
            origen,
            destino,
            costoServicio,
            pagoRepartidor,
            gananciaAdmin: gananciaAdmin,
            usuarioAsignado: usuarioAsignado ? parseInt(usuarioAsignado) : null,
            estado: usuarioAsignado ? 'asignado' : 'pendiente',
            fechaCreacion: new Date().toISOString(),
            fechaCompletado: null
        };
        
        // Usar la función con pushup
        await crearPedidoConPushup(nuevoPedido);
        
        hideForm('pedido');
        document.getElementById('descripcion').value = '';
        document.getElementById('origen').value = '';
        document.getElementById('destino').value = '';
        document.getElementById('costoServicio').value = '';
        document.getElementById('pagoRepartidor').value = '';
        document.getElementById('usuarioAsignado').value = '';
        await cargarPedidos();
        await cargarUsuarios();
        await cargarLiquidacionAdmin();
        actualizarLiquidacionAdminUI();
        
        // Mostrar mensaje de confirmación
        alert('✅ Pedido creado exitosamente. Los repartidores han sido notificados.');
    } catch (error) {
        console.error('Error:', error);
        alert('Error al crear pedido');
    }
}

async function asignarPedido(id) {
    const usuariosActivos = usuariosCache.filter(u => u.activo && u.disponible);
    if (usuariosActivos.length === 0) {
        alert('No hay repartidores disponibles');
        return;
    }
    
    const lista = usuariosActivos.map((u, i) => `${i+1}. ${u.nombre} (${u.vehiculo})`).join('\n');
    const seleccion = prompt(`Selecciona un repartidor:\n${lista}\n\nIngresa el número:`);
    if (!seleccion) return;
    
    const index = parseInt(seleccion) - 1;
    if (index < 0 || index >= usuariosActivos.length) {
        alert('Selección inválida');
        return;
    }
    
    try {
        const pedido = pedidosCache.find(p => p.id === id);
        if (pedido) {
            await setPedido(id, {
                ...pedido,
                usuarioAsignado: usuariosActivos[index].id,
                estado: 'asignado'
            });
            await cargarPedidos();
            await cargarUsuarios();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al asignar pedido');
    }
}

async function completarPedido(id) {
    if (!confirm('¿Completar este pedido?')) return;
    const pedido = pedidosCache.find(p => p.id === id);
    if (!pedido) {
        alert('Pedido no encontrado');
        return;
    }
    
    try {
        await setPedido(id, {
            ...pedido,
            estado: 'completado',
            fechaCompletado: new Date().toISOString()
        });
        
        if (pedido.usuarioAsignado) {
            const usuario = usuariosCache.find(u => u.id === pedido.usuarioAsignado);
            if (usuario) {
                await setUsuario(usuario.id, {
                    ...usuario,
                    liquidacionTotal: (usuario.liquidacionTotal || 0) + pedido.pagoRepartidor,
                    pedidosCompletados: (usuario.pedidosCompletados || 0) + 1
                });
            }
        }
        
        const ganancia = pedido.gananciaAdmin || (pedido.costoServicio - pedido.pagoRepartidor);
        liquidacionAdmin.total = (liquidacionAdmin.total || 0) + ganancia;
        await guardarLiquidacionAdmin();
        actualizarLiquidacionAdminUI();
        
        await cargarPedidos();
        await cargarUsuarios();
    } catch (error) {
        console.error('Error:', error);
        alert('Error al completar pedido');
    }
}

async function eliminarPedido(id) {
    if (!confirm('¿Eliminar este pedido?')) return;
    try {
        await deletePedido(id);
        await cargarPedidos();
        await cargarUsuarios();
        await cargarLiquidacionAdmin();
        actualizarLiquidacionAdminUI();
    } catch (error) {
        console.error('Error:', error);
        alert('Error al eliminar pedido');
    }
}

// ============================================================
// ===== LIQUIDACIONES =====
// ============================================================

async function cargarLiquidaciones() {
    try {
        const usuarios = await getUsuarios();
        const container = document.getElementById('liquidacionesList');
        if (!container) return;
        
        container.innerHTML = usuarios.map(u => `
            <div class="card">
                <h4>${u.nombre}</h4>
                <p>🚗 ${u.vehiculo}</p>
                <p>💰 Liquidación total: $${u.liquidacionTotal || 0}</p>
                <p>📦 Pedidos completados: ${u.pedidosCompletados || 0}</p>
                <span class="badge ${u.activo ? 'badge-active' : 'badge-inactive'}">
                    ${u.activo ? '✅ Activo' : '❌ Inactivo'}
                </span>
                <div class="card-actions">
                    <button type="button" onclick="verLiquidacionUsuario(${u.id})" class="btn-primary">💰 Ver Detalle</button>
                    <button type="button" onclick="descargarLiquidacionTXT(${u.id})" class="btn-success">📥 Descargar</button>
                    <button type="button" onclick="ajustarLiquidacion(${u.id})" class="btn-secondary">✏️ Ajustar</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error:', error);
    }
}

// ============================================================
// ===== NOTIFICACIONES CON SONIDO Y PUSHUP =====
// ============================================================

function reproducirSonidoNotificacion() {
    if (!notificacionSonidoHabilitada) return;
    
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.value = 880;
        gainNode.gain.value = 0.3;
        
        oscillator.start();
        setTimeout(() => {
            oscillator.stop();
            const osc2 = audioContext.createOscillator();
            const gain2 = audioContext.createGain();
            osc2.connect(gain2);
            gain2.connect(audioContext.destination);
            osc2.type = 'sine';
            osc2.frequency.value = 1100;
            gain2.gain.value = 0.25;
            osc2.start();
            setTimeout(() => osc2.stop(), 200);
        }, 150);
        
    } catch (error) {
        console.log('Sonido no disponible:', error);
    }
}

function mostrarNotificacionNavegador(titulo, mensaje) {
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification(titulo, {
                body: mensaje,
                icon: 'data:image/svg+xml,' + encodeURIComponent(`
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
                        <rect width="100" height="100" rx="20" fill="#ff6b35"/>
                        <text x="50" y="70" font-size="60" text-anchor="middle">📦</text>
                    </svg>
                `),
                silent: false,
                requireInteraction: true,
                tag: 'nuevo-pedido'
            });
        } catch (e) {
            console.log('Error mostrando notificación:', e);
        }
    }
}

function mostrarAlertaPedidoNuevo(pedido) {
    const alertaAnterior = document.querySelector('.alerta-pedido-nuevo');
    if (alertaAnterior) alertaAnterior.remove();
    
    const alerta = document.createElement('div');
    alerta.className = 'alerta-pedido-nuevo';
    alerta.innerHTML = `
        <div class="alerta-contenido">
            <span class="alerta-icono">📦</span>
            <div class="alerta-texto">
                <strong>¡Nuevo Pedido Disponible!</strong>
                <p>${pedido.descripcion}</p>
                <p style="font-size: 0.9rem; opacity: 0.8;">${pedido.origen} → ${pedido.destino}</p>
                <p style="font-size: 0.9rem; color: #28a745;">💰 $${pedido.pagoRepartidor}</p>
            </div>
            <button onclick="this.closest('.alerta-pedido-nuevo').remove()" class="btn-danger" style="padding: 4px 12px;">✕</button>
        </div>
    `;
    
    const panel = document.getElementById('usuarioPanel');
    if (panel) {
        panel.insertBefore(alerta, panel.firstChild);
    }
    
    setTimeout(() => {
        if (alerta.parentNode) alerta.remove();
    }, 12000);
}

// ===== ESCUCHAR NUEVOS PEDIDOS EN TIEMPO REAL (PUSHUP) =====
function iniciarEscuchaPushup() {
    if (!usuarioActual) return;
    
    console.log('📡 Iniciando escucha de nuevos pedidos en tiempo real...');
    
    escucharNuevosPedidos(function(nuevoPedido) {
        console.log('📦 Nuevo pedido detectado por PUSHUP:', nuevoPedido);
        
        // Verificar que el pedido sea nuevo (no lo hemos visto antes)
        if (ultimoPedidoPendiente === null || 
            nuevoPedido.id !== ultimoPedidoPendiente.id) {
            
            ultimoPedidoPendiente = nuevoPedido;
            
            // 1. Reproducir sonido
            reproducirSonidoNotificacion();
            
            // 2. Mostrar notificación del navegador
            mostrarNotificacionNavegador(
                '📦 Nuevo Pedido Disponible',
                `${nuevoPedido.descripcion}\n${nuevoPedido.origen} → ${nuevoPedido.destino}\n💰 $${nuevoPedido.pagoRepartidor}`
            );
            
            // 3. Mostrar alerta visual
            mostrarAlertaPedidoNuevo(nuevoPedido);
            
            // 4. Actualizar la lista de pedidos
            cargarPedidosUsuario(usuarioActual.id);
        }
    });
}

function detenerEscuchaPushup() {
    dejarDeEscucharNuevosPedidos();
    console.log('🔇 Escucha de nuevos pedidos detenida');
}

// ============================================================
// ===== PANEL USUARIO =====
// ============================================================

async function cargarPanelUsuario(usuario) {
    try {
        const bienvenida = document.getElementById('bienvenidaUsuario');
        if (bienvenida) bienvenida.textContent = `👋 Hola, ${usuario.nombre}`;
        
        const vehiculo = document.getElementById('vehiculoUsuario');
        if (vehiculo) vehiculo.textContent = getVehiculoIcon(usuario.vehiculo);
        
        const liquidacion = document.getElementById('liquidacionUsuario');
        if (liquidacion) liquidacion.textContent = `$${usuario.liquidacionTotal || 0}`;
        
        actualizarEstadoUsuario(usuario);
        await cargarPedidosUsuario(usuario.id);
        
        const statusBar = document.querySelector('.status-bar');
        if (statusBar) {
            if (!document.querySelector('.btn-mi-liquidacion')) {
                const btnLiquidacion = document.createElement('div');
                btnLiquidacion.className = 'status-item';
                btnLiquidacion.innerHTML = `
                    <button type="button" onclick="verMiLiquidacion()" class="btn-primary btn-mi-liquidacion">💰 Mi Liquidación</button>
                `;
                statusBar.appendChild(btnLiquidacion);
            }
            
            if (!document.querySelector('.btn-toggle-sonido')) {
                const btnSonido = document.createElement('div');
                btnSonido.className = 'status-item';
                btnSonido.innerHTML = `
                    <button type="button" onclick="toggleSonidoNotificaciones()" class="btn-success btn-toggle-sonido">
                        🔊 Sonido ON
                    </button>
                `;
                statusBar.appendChild(btnSonido);
            }
        }
        
        // INICIAR PUSHUP - Escucha en tiempo real
        iniciarEscuchaPushup();
        
    } catch (error) {
        console.error('Error cargando panel usuario:', error);
    }
}

function toggleSonidoNotificaciones() {
    notificacionSonidoHabilitada = !notificacionSonidoHabilitada;
    const btn = document.querySelector('.btn-toggle-sonido');
    if (btn) {
        btn.textContent = notificacionSonidoHabilitada ? '🔊 Sonido ON' : '🔇 Sonido OFF';
        btn.className = notificacionSonidoHabilitada ? 'btn-success btn-toggle-sonido' : 'btn-secondary btn-toggle-sonido';
    }
    console.log(`🔊 Sonido de notificaciones: ${notificacionSonidoHabilitada ? 'Activado' : 'Desactivado'}`);
}

async function verMiLiquidacion() {
    if (!usuarioActual) return;
    await verLiquidacionUsuario(usuarioActual.id);
}

function getVehiculoIcon(vehiculo) {
    const icons = { bici: '🚲 Bici', moto: '🏍️ Moto', auto: '🚗 Auto' };
    return icons[vehiculo] || vehiculo;
}

function actualizarEstadoUsuario(usuario) {
    const estadoSpan = document.getElementById('estadoUsuario');
    const btnDisponibilidad = document.getElementById('btnDisponibilidad');
    
    if (!estadoSpan || !btnDisponibilidad) return;
    
    if (usuario.activo && usuario.disponible) {
        estadoSpan.textContent = '✅ Activo';
        estadoSpan.className = 'badge-active';
        btnDisponibilidad.textContent = '🟢 Disponible';
        btnDisponibilidad.className = 'btn-success';
        btnDisponibilidad.disabled = false;
    } else if (usuario.activo && !usuario.disponible) {
        estadoSpan.textContent = '⏸️ Pausado';
        estadoSpan.className = 'badge-inactive';
        btnDisponibilidad.textContent = '⏸️ No disponible';
        btnDisponibilidad.className = 'btn-secondary';
        btnDisponibilidad.disabled = false;
    } else {
        estadoSpan.textContent = '❌ Inactivo';
        estadoSpan.className = 'badge-inactive';
        btnDisponibilidad.textContent = '🚫 Inactivo';
        btnDisponibilidad.className = 'btn-danger';
        btnDisponibilidad.disabled = true;
    }
}

async function toggleDisponibilidad() {
    if (!usuarioActual) return;
    const nuevoEstado = !usuarioActual.disponible;
    
    try {
        await setUsuario(usuarioActual.id, {
            ...usuarioActual,
            disponible: nuevoEstado
        });
        
        usuarioActual.disponible = nuevoEstado;
        guardarSesionUsuario(usuarioActual);
        actualizarEstadoUsuario(usuarioActual);
        await cargarPedidosUsuario(usuarioActual.id);
        
        if (obtenerSesionAdmin()) {
            const usuarioEnCache = usuariosCache.find(u => u.id === usuarioActual.id);
            if (usuarioEnCache) {
                usuarioEnCache.disponible = nuevoEstado;
            }
            await cargarUsuarios();
            await cargarPedidos();
            await cargarLiquidaciones();
        }
        
        console.log(`✅ Disponibilidad actualizada a: ${nuevoEstado ? 'Disponible' : 'No disponible'}`);
    } catch (error) {
        console.error('Error:', error);
        alert('Error al cambiar disponibilidad');
    }
}

async function cargarPedidosUsuario(usuarioId) {
    try {
        const pedidos = await getPedidos();
        renderPedidosUsuario(pedidos, usuarioId);
    } catch (error) {
        console.error('Error cargando pedidos usuario:', error);
    }
}

function renderPedidosUsuario(pedidos, usuarioId) {
    const pendientes = pedidos.filter(p => p.estado === 'pendiente');
    const containerPendientes = document.getElementById('pedidosPendientes');
    if (containerPendientes) {
        containerPendientes.innerHTML = pendientes.length === 0 ? 
            '<p>No hay pedidos disponibles</p>' :
            pendientes.map(p => `
                <div class="card">
                    <h4>📦 ${p.descripcion}</h4>
                    <p>📍 ${p.origen} → ${p.destino}</p>
                    <p>💰 Pago: $${p.pagoRepartidor}</p>
                    <p>🕐 Creado: ${new Date(p.fechaCreacion).toLocaleString()}</p>
                    <div class="card-actions">
                        <button type="button" onclick="tomarPedido(${p.id})" class="btn-success">✅ Tomar Pedido</button>
                    </div>
                </div>
            `).join('');
    }
    
    const misPedidos = pedidos.filter(p => p.usuarioAsignado === usuarioId && p.estado === 'asignado');
    const containerMisPedidos = document.getElementById('misPedidos');
    if (containerMisPedidos) {
        containerMisPedidos.innerHTML = misPedidos.length === 0 ?
            '<p>No tienes pedidos asignados</p>' :
            misPedidos.map(p => `
                <div class="card">
                    <h4>📦 ${p.descripcion}</h4>
                    <p>📍 ${p.origen} → ${p.destino}</p>
                    <p>💰 Pago: $${p.pagoRepartidor}</p>
                    <p>🕐 Creado: ${new Date(p.fechaCreacion).toLocaleString()}</p>
                    <p>Estado: <span class="badge badge-asignado">ASIGNADO</span></p>
                    <div class="card-actions">
                        <button type="button" onclick="completarPedidoUsuario(${p.id})" class="btn-success">✅ Completar</button>
                    </div>
                </div>
            `).join('');
    }
    
    const historial = pedidos.filter(p => p.usuarioAsignado === usuarioId && p.estado === 'completado');
    const containerHistorial = document.getElementById('historialPedidos');
    if (containerHistorial) {
        containerHistorial.innerHTML = historial.length === 0 ?
            '<p>No hay pedidos completados</p>' :
            historial.map(p => `
                <div class="card">
                    <h4>📦 ${p.descripcion}</h4>
                    <p>📍 ${p.origen} → ${p.destino}</p>
                    <p>💰 Pago: $${p.pagoRepartidor}</p>
                    <p>🕐 Creado: ${new Date(p.fechaCreacion).toLocaleString()}</p>
                    <p>✅ Entregado: ${new Date(p.fechaCompletado).toLocaleString()}</p>
                </div>
            `).join('');
    }
}

async function tomarPedido(id) {
    if (!usuarioActual) {
        alert('Debes iniciar sesión');
        return;
    }
    
    if (!usuarioActual.disponible) {
        alert('No estás disponible para tomar pedidos. Activa tu disponibilidad.');
        return;
    }
    
    if (!confirm('¿Tomar este pedido?')) return;
    
    try {
        const pedido = pedidosCache.find(p => p.id === id);
        if (pedido) {
            await setPedido(id, {
                ...pedido,
                usuarioAsignado: usuarioActual.id,
                estado: 'asignado'
            });
            await cargarPedidosUsuario(usuarioActual.id);
            if (obtenerSesionAdmin()) {
                await cargarPedidos();
            }
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al tomar pedido');
    }
}

async function completarPedidoUsuario(id) {
    if (!confirm('¿Completar este pedido?')) return;
    
    try {
        const pedidosActuales = await getPedidos();
        const pedido = pedidosActuales.find(p => p.id === id);
        
        if (!pedido) {
            alert('Pedido no encontrado');
            return;
        }
        
        await setPedido(id, {
            ...pedido,
            estado: 'completado',
            fechaCompletado: new Date().toISOString()
        });
        
        if (usuarioActual) {
            const usuarioActualizado = usuariosCache.find(u => u.id === usuarioActual.id);
            if (usuarioActualizado) {
                const nuevaLiquidacion = (usuarioActualizado.liquidacionTotal || 0) + pedido.pagoRepartidor;
                const nuevosPedidos = (usuarioActualizado.pedidosCompletados || 0) + 1;
                
                await setUsuario(usuarioActual.id, {
                    ...usuarioActualizado,
                    liquidacionTotal: nuevaLiquidacion,
                    pedidosCompletados: nuevosPedidos
                });
                
                usuarioActual.liquidacionTotal = nuevaLiquidacion;
                usuarioActual.pedidosCompletados = nuevosPedidos;
                guardarSesionUsuario(usuarioActual);
                const liquidacionSpan = document.getElementById('liquidacionUsuario');
                if (liquidacionSpan) liquidacionSpan.textContent = `$${nuevaLiquidacion}`;
            }
        }
        
        const ganancia = pedido.gananciaAdmin || (pedido.costoServicio - pedido.pagoRepartidor);
        liquidacionAdmin.total = (liquidacionAdmin.total || 0) + ganancia;
        await guardarLiquidacionAdmin();
        actualizarLiquidacionAdminUI();
        
        await cargarPedidosUsuario(usuarioActual.id);
        
        if (obtenerSesionAdmin()) {
            await cargarPedidos();
            await cargarUsuarios();
        }
        
        alert('✅ Pedido completado exitosamente');
    } catch (error) {
        console.error('Error:', error);
        alert('Error al completar pedido: ' + error.message);
    }
}

// ============================================================
// ===== UTILIDADES =====
// ============================================================

function showTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    if (tab === 'usuarios') {
        document.getElementById('tabUsuarios').style.display = 'block';
        document.querySelector('.tab-btn:first-child').classList.add('active');
        cargarUsuarios();
    } else if (tab === 'pedidos') {
        document.getElementById('tabPedidos').style.display = 'block';
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        cargarPedidos();
    } else if (tab === 'liquidaciones') {
        document.getElementById('tabLiquidaciones').style.display = 'block';
        document.querySelectorAll('.tab-btn')[2].classList.add('active');
        cargarLiquidaciones();
    } else if (tab === 'admin') {
        document.getElementById('tabAdmin').style.display = 'block';
        document.querySelectorAll('.tab-btn')[3].classList.add('active');
        cargarLiquidacionAdmin();
        actualizarLiquidacionAdminUI();
    }
}

function showUserTab(tab) {
    document.querySelectorAll('#usuarioPanel .tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('#usuarioPanel .tab-btn').forEach(el => el.classList.remove('active'));
    
    if (tab === 'pendientes') {
        document.getElementById('userTabPendientes').style.display = 'block';
        document.querySelector('#usuarioPanel .tab-btn:first-child').classList.add('active');
        if (usuarioActual) cargarPedidosUsuario(usuarioActual.id);
    } else if (tab === 'misPedidos') {
        document.getElementById('userTabMisPedidos').style.display = 'block';
        document.querySelector('#usuarioPanel .tab-btn:nth-child(2)').classList.add('active');
        if (usuarioActual) cargarPedidosUsuario(usuarioActual.id);
    } else if (tab === 'historial') {
        document.getElementById('userTabHistorial').style.display = 'block';
        document.querySelector('#usuarioPanel .tab-btn:nth-child(3)').classList.add('active');
        if (usuarioActual) cargarPedidosUsuario(usuarioActual.id);
    }
}

function showForm(tipo) {
    if (tipo === 'usuario') {
        document.getElementById('usuarioForm').style.display = 'block';
    } else if (tipo === 'pedido') {
        document.getElementById('pedidoForm').style.display = 'block';
    }
}

function hideForm(tipo) {
    if (tipo === 'usuario') {
        document.getElementById('usuarioForm').style.display = 'none';
    } else if (tipo === 'pedido') {
        document.getElementById('pedidoForm').style.display = 'none';
    }
}

// ============================================================
// ===== INICIAR =====
// ============================================================

console.log('🚚 Gestor de Entregas v3.0 - Firebase');
console.log('✅ Conectado a Firebase Realtime Database');
console.log('📡 Pushup activado - Notificaciones en tiempo real');
console.log('Admin: LedZepp1');
console.log('Usuarios: carlos123 / reparto2024, maria456 / bici2024');
console.log('🔔 Notificaciones activas: Sonido + Alerta visual + Push');