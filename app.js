// ============================================================
// ===== app.js - VERSIÓN LIMPIA SIN DUPLICADOS =====
// ============================================================

const ADMIN_PASSWORD = 'LedZepp1';
let usuarioActual = null;
let usuariosCache = [];
let pedidosCache = [];
let historialLiquidaciones = [];
let liquidacionAdmin = { total: 0, historial: [] };
let ultimoPedidoPendiente = null;
let notificacionSonidoHabilitada = true;

// ============================================================
// ===== SESIÓN =====
// ============================================================

function guardarSesionAdmin(estado) {
    sessionStorage.setItem('adminAutenticado', JSON.stringify(estado));
}

function obtenerSesionAdmin() {
    return JSON.parse(sessionStorage.getItem('adminAutenticado') || 'false');
}

function guardarSesionUsuario(usuario) {
    sessionStorage.setItem('usuarioActual', JSON.stringify(usuario));
}

function obtenerSesionUsuario() {
    return JSON.parse(sessionStorage.getItem('usuarioActual') || 'null');
}

function limpiarSesion() {
    sessionStorage.removeItem('adminAutenticado');
    sessionStorage.removeItem('usuarioActual');
}

// ============================================================
// ===== LOGIN ADMIN =====
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
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('adminPanel').style.display = 'none';
}

// ============================================================
// ===== LOGIN USUARIO (USA FIREBASE) =====
// ============================================================

async function loginUsuario() {
    const username = document.getElementById('userLogin').value;
    const password = document.getElementById('userPass').value;
    
    try {
        const usuarios = await window.firebaseFunctions.getUsuarios();
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
    window.firebaseFunctions.dejarDeEscucharNuevosPedidos();
    document.getElementById('loginUsuarioSection').style.display = 'block';
    document.getElementById('usuarioPanel').style.display = 'none';
}

// ============================================================
// ===== CARGAR DATOS ADMIN =====
// ============================================================

async function cargarDatosAdmin() {
    try {
        await cargarUsuarios();
        await cargarPedidos();
        await cargarHistorial();
        await cargarLiquidacionAdmin();
    } catch (error) {
        console.error('Error cargando datos:', error);
    }
}

async function cargarUsuarios() {
    try {
        usuariosCache = await window.firebaseFunctions.getUsuarios();
        renderUsuarios(usuariosCache);
    } catch (error) {
        console.error('Error cargando usuarios:', error);
    }
}

async function cargarPedidos() {
    try {
        pedidosCache = await window.firebaseFunctions.getPedidos();
        renderPedidosAdmin(pedidosCache);
    } catch (error) {
        console.error('Error cargando pedidos:', error);
    }
}

async function cargarHistorial() {
    try {
        historialLiquidaciones = await window.firebaseFunctions.getHistorialLiquidaciones();
    } catch (error) {
        historialLiquidaciones = [];
    }
}

async function cargarLiquidacionAdmin() {
    try {
        liquidacionAdmin = await window.firebaseFunctions.getLiquidacionAdmin();
        document.getElementById('totalAdmin').textContent = `$${liquidacionAdmin.total || 0}`;
    } catch (error) {
        liquidacionAdmin = { total: 0, historial: [] };
    }
}

// ============================================================
// ===== RENDER USUARIOS =====
// ============================================================

function renderUsuarios(usuarios) {
    const container = document.getElementById('listaUsuarios');
    if (!container) return;
    
    if (!usuarios || usuarios.length === 0) {
        container.innerHTML = '<p>No hay usuarios registrados</p>';
        return;
    }
    
    container.innerHTML = usuarios.map(u => `
        <div class="card">
            <h4>${u.nombre}</h4>
            <p>👤 @${u.username}</p>
            <p>🚗 ${u.vehiculo}</p>
            <p>💰 $${u.liquidacionTotal || 0}</p>
            <p>📦 ${u.pedidosCompletados || 0} pedidos</p>
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
                <button onclick="verLiquidacionUsuario(${u.id})" class="btn-primary">💰 Liquidación</button>
                <button onclick="ajustarLiquidacion(${u.id})" class="btn-secondary">✏️ Ajustar</button>
                <button onclick="eliminarUsuario(${u.id})" class="btn-danger">Eliminar</button>
            </div>
        </div>
    `).join('');
}

// ============================================================
// ===== CRUD USUARIOS (USA FIREBASE) =====
// ============================================================

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
        const id = await window.firebaseFunctions.getNextId('usuarios');
        await window.firebaseFunctions.setUsuario(id, {
            nombre, username, password, vehiculo,
            activo: true, disponible: true,
            liquidacionTotal: 0, pedidosCompletados: 0,
            ajustesLiquidacion: []
        });
        hideForm('usuario');
        document.getElementById('nombre').value = '';
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('vehiculo').value = 'bici';
        await cargarUsuarios();
    } catch (error) {
        alert('Error al crear usuario');
    }
}

async function toggleUsuarioActivo(id) {
    const usuario = usuariosCache.find(u => u.id === id);
    if (!usuario) return;
    await window.firebaseFunctions.setUsuario(id, { ...usuario, activo: !usuario.activo });
    await cargarUsuarios();
}

async function toggleDisponibilidadAdmin(id) {
    const usuario = usuariosCache.find(u => u.id === id);
    if (!usuario || !usuario.activo) {
        alert('El usuario está inactivo. Actívalo primero.');
        return;
    }
    const nuevoEstado = !usuario.disponible;
    if (!confirm(`¿Cambiar disponibilidad de ${usuario.nombre} a "${nuevoEstado ? 'disponible' : 'no disponible'}"?`)) return;
    await window.firebaseFunctions.setUsuario(id, { ...usuario, disponible: nuevoEstado });
    await cargarUsuarios();
}

async function eliminarUsuario(id) {
    if (!confirm('¿Eliminar este usuario?')) return;
    await window.firebaseFunctions.deleteUsuario(id);
    await cargarUsuarios();
}

// ============================================================
// ===== RENDER PEDIDOS ADMIN =====
// ============================================================

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
                ${p.estado === 'pendiente' ? `<button onclick="asignarPedido(${p.id})" class="btn-primary">Asignar</button>` : ''}
                ${p.estado === 'asignado' ? `<button onclick="completarPedido(${p.id})" class="btn-success">Completar</button>` : ''}
                <button onclick="eliminarPedido(${p.id})" class="btn-danger">Eliminar</button>
            </div>
        </div>
    `}).join('');
}

// ============================================================
// ===== CRUD PEDIDOS (USA FIREBASE) =====
// ============================================================

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
    
    try {
        await window.firebaseFunctions.crearPedidoConPushup({
            descripcion, origen, destino, costoServicio, pagoRepartidor,
            gananciaAdmin: costoServicio - pagoRepartidor,
            usuarioAsignado: usuarioAsignado ? parseInt(usuarioAsignado) : null,
            estado: usuarioAsignado ? 'asignado' : 'pendiente'
        });
        hideForm('pedido');
        document.getElementById('descripcion').value = '';
        document.getElementById('origen').value = '';
        document.getElementById('destino').value = '';
        document.getElementById('costoServicio').value = '';
        document.getElementById('pagoRepartidor').value = '';
        document.getElementById('usuarioAsignado').value = '';
        await cargarPedidos();
        await cargarUsuarios();
        alert('✅ Pedido creado exitosamente.');
    } catch (error) {
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
    const pedido = pedidosCache.find(p => p.id === id);
    if (pedido) {
        await window.firebaseFunctions.setPedido(id, { ...pedido, usuarioAsignado: usuariosActivos[index].id, estado: 'asignado' });
        await cargarPedidos();
    }
}

async function completarPedido(id) {
    if (!confirm('¿Completar este pedido?')) return;
    const pedido = pedidosCache.find(p => p.id === id);
    if (!pedido) return;
    
    await window.firebaseFunctions.setPedido(id, { ...pedido, estado: 'completado', fechaCompletado: new Date().toISOString() });
    if (pedido.usuarioAsignado) {
        const usuario = usuariosCache.find(u => u.id === pedido.usuarioAsignado);
        if (usuario) {
            await window.firebaseFunctions.setUsuario(usuario.id, {
                ...usuario,
                liquidacionTotal: (usuario.liquidacionTotal || 0) + pedido.pagoRepartidor,
                pedidosCompletados: (usuario.pedidosCompletados || 0) + 1
            });
        }
    }
    liquidacionAdmin.total = (liquidacionAdmin.total || 0) + (pedido.gananciaAdmin || pedido.costoServicio - pedido.pagoRepartidor);
    await window.firebaseFunctions.setLiquidacionAdmin(liquidacionAdmin);
    document.getElementById('totalAdmin').textContent = `$${liquidacionAdmin.total || 0}`;
    await cargarPedidos();
    await cargarUsuarios();
}

async function eliminarPedido(id) {
    if (!confirm('¿Eliminar este pedido?')) return;
    await window.firebaseFunctions.deletePedido(id);
    await cargarPedidos();
}

// ============================================================
// ===== PANEL USUARIO =====
// ============================================================

async function cargarPanelUsuario(usuario) {
    document.getElementById('bienvenidaUsuario').textContent = `👋 Hola, ${usuario.nombre}`;
    document.getElementById('vehiculoUsuario').textContent = getVehiculoIcon(usuario.vehiculo);
    document.getElementById('liquidacionUsuario').textContent = `$${usuario.liquidacionTotal || 0}`;
    actualizarEstadoUsuario(usuario);
    await cargarPedidosUsuario(usuario.id);
    iniciarEscuchaPushup();
}

function getVehiculoIcon(v) {
    const icons = { bici: '🚲 Bici', moto: '🏍️ Moto', auto: '🚗 Auto' };
    return icons[v] || v;
}

function actualizarEstadoUsuario(usuario) {
    const estadoSpan = document.getElementById('estadoUsuario');
    const btn = document.getElementById('btnDisponibilidad');
    if (!estadoSpan || !btn) return;
    if (usuario.activo && usuario.disponible) {
        estadoSpan.textContent = '✅ Activo';
        estadoSpan.className = 'badge-active';
        btn.textContent = '🟢 Disponible';
        btn.className = 'btn-success';
        btn.disabled = false;
    } else if (usuario.activo && !usuario.disponible) {
        estadoSpan.textContent = '⏸️ Pausado';
        estadoSpan.className = 'badge-inactive';
        btn.textContent = '⏸️ No disponible';
        btn.className = 'btn-secondary';
        btn.disabled = false;
    } else {
        estadoSpan.textContent = '❌ Inactivo';
        estadoSpan.className = 'badge-inactive';
        btn.textContent = '🚫 Inactivo';
        btn.className = 'btn-danger';
        btn.disabled = true;
    }
}

async function toggleDisponibilidad() {
    if (!usuarioActual) return;
    const nuevoEstado = !usuarioActual.disponible;
    await window.firebaseFunctions.setUsuario(usuarioActual.id, { ...usuarioActual, disponible: nuevoEstado });
    usuarioActual.disponible = nuevoEstado;
    guardarSesionUsuario(usuarioActual);
    actualizarEstadoUsuario(usuarioActual);
    await cargarPedidosUsuario(usuarioActual.id);
}

async function cargarPedidosUsuario(usuarioId) {
    const pedidos = await window.firebaseFunctions.getPedidos();
    renderPedidosUsuario(pedidos, usuarioId);
}

function renderPedidosUsuario(pedidos, usuarioId) {
    const pendientes = pedidos.filter(p => p.estado === 'pendiente');
    document.getElementById('pedidosPendientes').innerHTML = pendientes.length === 0 ? 
        '<p>No hay pedidos disponibles</p>' :
        pendientes.map(p => `
            <div class="card">
                <h4>📦 ${p.descripcion}</h4>
                <p>📍 ${p.origen} → ${p.destino}</p>
                <p>💰 Pago: $${p.pagoRepartidor}</p>
                <div class="card-actions">
                    <button onclick="tomarPedido(${p.id})" class="btn-success">✅ Tomar Pedido</button>
                </div>
            </div>
        `).join('');
    
    const misPedidos = pedidos.filter(p => p.usuarioAsignado === usuarioId && p.estado === 'asignado');
    document.getElementById('misPedidos').innerHTML = misPedidos.length === 0 ?
        '<p>No tienes pedidos asignados</p>' :
        misPedidos.map(p => `
            <div class="card">
                <h4>📦 ${p.descripcion}</h4>
                <p>📍 ${p.origen} → ${p.destino}</p>
                <p>💰 Pago: $${p.pagoRepartidor}</p>
                <p>Estado: <span class="badge badge-asignado">ASIGNADO</span></p>
                <div class="card-actions">
                    <button onclick="completarPedidoUsuario(${p.id})" class="btn-success">✅ Completar</button>
                </div>
            </div>
        `).join('');
    
    const historial = pedidos.filter(p => p.usuarioAsignado === usuarioId && p.estado === 'completado');
    document.getElementById('historialPedidos').innerHTML = historial.length === 0 ?
        '<p>No hay pedidos completados</p>' :
        historial.map(p => `
            <div class="card">
                <h4>📦 ${p.descripcion}</h4>
                <p>📍 ${p.origen} → ${p.destino}</p>
                <p>💰 Pago: $${p.pagoRepartidor}</p>
                <p>✅ Entregado: ${new Date(p.fechaCompletado).toLocaleString()}</p>
            </div>
        `).join('');
}

async function tomarPedido(id) {
    if (!usuarioActual || !usuarioActual.disponible) {
        alert('No estás disponible para tomar pedidos');
        return;
    }
    if (!confirm('¿Tomar este pedido?')) return;
    const pedido = pedidosCache.find(p => p.id === id);
    if (pedido) {
        await window.firebaseFunctions.setPedido(id, { ...pedido, usuarioAsignado: usuarioActual.id, estado: 'asignado' });
        await cargarPedidosUsuario(usuarioActual.id);
    }
}

async function completarPedidoUsuario(id) {
    if (!confirm('¿Completar este pedido?')) return;
    const pedido = (await window.firebaseFunctions.getPedidos()).find(p => p.id === id);
    if (!pedido) { alert('Pedido no encontrado'); return; }
    await window.firebaseFunctions.setPedido(id, { ...pedido, estado: 'completado', fechaCompletado: new Date().toISOString() });
    if (usuarioActual) {
        const nuevaLiquidacion = (usuarioActual.liquidacionTotal || 0) + pedido.pagoRepartidor;
        await window.firebaseFunctions.setUsuario(usuarioActual.id, {
            ...usuarioActual,
            liquidacionTotal: nuevaLiquidacion,
            pedidosCompletados: (usuarioActual.pedidosCompletados || 0) + 1
        });
        usuarioActual.liquidacionTotal = nuevaLiquidacion;
        usuarioActual.pedidosCompletados = (usuarioActual.pedidosCompletados || 0) + 1;
        document.getElementById('liquidacionUsuario').textContent = `$${nuevaLiquidacion}`;
        guardarSesionUsuario(usuarioActual);
    }
    const ganancia = pedido.gananciaAdmin || (pedido.costoServicio - pedido.pagoRepartidor);
    liquidacionAdmin.total = (liquidacionAdmin.total || 0) + ganancia;
    await window.firebaseFunctions.setLiquidacionAdmin(liquidacionAdmin);
    await cargarPedidosUsuario(usuarioActual.id);
    alert('✅ Pedido completado exitosamente');
}

// ============================================================
// ===== LIQUIDACIONES =====
// ============================================================

async function verLiquidacionUsuario(id) {
    const usuario = usuariosCache.find(u => u.id === id);
    if (!usuario) return;
    alert(`💰 Liquidación de ${usuario.nombre}\nTotal: $${usuario.liquidacionTotal || 0}\nPedidos: ${usuario.pedidosCompletados || 0}`);
}

async function ajustarLiquidacion(id) {
    const usuario = usuariosCache.find(u => u.id === id);
    if (!usuario) return;
    const concepto = prompt('Concepto (ej: Bono, Descuento, etc.):');
    if (!concepto) return;
    const monto = parseFloat(prompt('Monto (positivo o negativo):'));
    if (isNaN(monto) || monto === 0) return;
    const ajustes = usuario.ajustesLiquidacion || [];
    ajustes.push({ id: Date.now(), fecha: new Date().toISOString(), concepto, monto, tipo: monto > 0 ? 'extra' : 'descuento' });
    await window.firebaseFunctions.setUsuario(id, { ...usuario, ajustesLiquidacion: ajustes, liquidacionTotal: (usuario.liquidacionTotal || 0) + monto });
    await cargarUsuarios();
    alert('✅ Ajuste aplicado correctamente');
}

// ============================================================
// ===== PUSHUP - NOTIFICACIONES EN TIEMPO REAL =====
// ============================================================

function iniciarEscuchaPushup() {
    window.firebaseFunctions.escucharNuevosPedidos(function(nuevoPedido) {
        if (ultimoPedidoPendiente === null || nuevoPedido.id !== ultimoPedidoPendiente.id) {
            ultimoPedidoPendiente = nuevoPedido;
            // Sonido
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = 880;
                gain.gain.value = 0.3;
                osc.start();
                setTimeout(() => { osc.stop(); }, 150);
            } catch(e) {}
            // Notificación
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('📦 Nuevo Pedido Disponible', {
                    body: `${nuevoPedido.descripcion}\n${nuevoPedido.origen} → ${nuevoPedido.destino}\n💰 $${nuevoPedido.pagoRepartidor}`,
                    silent: false
                });
            }
            // Alerta visual
            const alerta = document.createElement('div');
            alerta.className = 'alerta-pedido-nuevo';
            alerta.innerHTML = `
                <div class="alerta-contenido">
                    <span class="alerta-icono">📦</span>
                    <div class="alerta-texto">
                        <strong>¡Nuevo Pedido Disponible!</strong>
                        <p>${nuevoPedido.descripcion}</p>
                        <p>${nuevoPedido.origen} → ${nuevoPedido.destino}</p>
                        <p>💰 $${nuevoPedido.pagoRepartidor}</p>
                    </div>
                    <button onclick="this.parentElement.parentElement.remove()" class="btn-danger">✕</button>
                </div>
            `;
            const panel = document.getElementById('usuarioPanel');
            if (panel) panel.insertBefore(alerta, panel.firstChild);
            setTimeout(() => { if (alerta.parentNode) alerta.remove(); }, 10000);
            cargarPedidosUsuario(usuarioActual.id);
        }
    });
}

// ============================================================
// ===== TABS =====
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

async function cargarLiquidaciones() {
    const usuarios = await window.firebaseFunctions.getUsuarios();
    document.getElementById('liquidacionesList').innerHTML = usuarios.map(u => `
        <div class="card">
            <h4>${u.nombre}</h4>
            <p>🚗 ${u.vehiculo}</p>
            <p>💰 Liquidación total: $${u.liquidacionTotal || 0}</p>
            <p>📦 Pedidos completados: ${u.pedidosCompletados || 0}</p>
            <span class="badge ${u.activo ? 'badge-active' : 'badge-inactive'}">
                ${u.activo ? '✅ Activo' : '❌ Inactivo'}
            </span>
        </div>
    `).join('');
}

function showForm(tipo) {
    document.getElementById(tipo === 'usuario' ? 'usuarioForm' : 'pedidoForm').style.display = 'block';
}

function hideForm(tipo) {
    document.getElementById(tipo === 'usuario' ? 'usuarioForm' : 'pedidoForm').style.display = 'none';
}

// ============================================================
// ===== INICIO =====
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    if (obtenerSesionAdmin()) {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        cargarDatosAdmin();
    }
    const usuario = obtenerSesionUsuario();
    if (usuario) {
        usuarioActual = usuario;
        document.getElementById('loginUsuarioSection').style.display = 'none';
        document.getElementById('usuarioPanel').style.display = 'block';
        cargarPanelUsuario(usuario);
    }
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});

console.log('🚚 Gestor de Entregas v3.0 - Firebase');
console.log('Admin: LedZepp1');
console.log('Usuarios: carlos123 / reparto2024, maria456 / bici2024');
