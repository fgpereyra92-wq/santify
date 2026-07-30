// ============================================================
// ===== app.js - VERSIÓN COMPLETA CORREGIDA =====
// ============================================================

const ADMIN_PASSWORD = 'LedZepp1';
let usuarioActual = null;
let usuariosCache = [];
let pedidosCache = [];
let clientesCache = [];
let historialLiquidaciones = [];
let liquidacionAdmin = { total: 0, historial: [] };
let ultimoPedidoPendiente = null;
let sonidoActivado = false;

// ============================================================
// ===== REFERENCIA A FIREBASE =====
// ============================================================

// Esta función ahora está definida globalmente en firebase-config.js
// pero la declaramos aquí también por si acaso
if (typeof window.getFirebase === 'undefined') {
    window.getFirebase = function() {
        if (typeof window.firebaseFunctions === 'undefined') {
            console.error('❌ Firebase no está cargado');
            return null;
        }
        return window.firebaseFunctions;
    };
}

// ============================================================
// ===== ACTIVAR SONIDO GLOBAL =====
// ============================================================

function activarSonidoGlobal() {
    if (sonidoActivado) return;
    
    try {
        const fb = window.getFirebase();
        if (fb && fb.activarSonido) {
            fb.activarSonido();
            sonidoActivado = true;
            console.log('🔊 Sonido activado por interacción del usuario');
        }
    } catch (e) {
        console.warn('⚠️ Error activando sonido:', e);
    }
}

// Detectar interacción del usuario para activar sonido
document.addEventListener('click', function() {
    activarSonidoGlobal();
});
document.addEventListener('touchstart', function() {
    activarSonidoGlobal();
});

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
    const fb = window.getFirebase();
    if (fb) fb.dejarDeEscucharNuevosPedidos();
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('adminPanel').style.display = 'none';
}

// ============================================================
// ===== LOGIN USUARIO =====
// ============================================================

async function loginUsuario() {
    const username = document.getElementById('userLogin').value;
    const password = document.getElementById('userPass').value;
    
    try {
        const fb = window.getFirebase();
        if (!fb) {
            document.getElementById('userLoginError').textContent = '❌ Error de conexión con Firebase';
            return;
        }
        
        const usuarios = await fb.getUsuarios();
        const usuario = usuarios.find(u => u.username === username && u.password === password);
        
        if (usuario) {
            usuarioActual = usuario;
            window.usuarioActual = usuario;
            guardarSesionUsuario(usuario);
            document.getElementById('loginUsuarioSection').style.display = 'none';
            document.getElementById('usuarioPanel').style.display = 'block';
            await cargarPanelUsuario(usuario);
            document.getElementById('userLoginError').textContent = '';
        } else {
            document.getElementById('userLoginError').textContent = '❌ Usuario o contraseña incorrectos';
        }
    } catch (error) {
        console.error('Error en login:', error);
        document.getElementById('userLoginError').textContent = '❌ Error de conexión';
    }
}

function logoutUsuario() {
    usuarioActual = null;
    window.usuarioActual = null;
    limpiarSesion();
    const fb = window.getFirebase();
    if (fb) fb.dejarDeEscucharNuevosPedidos();
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
        await cargarClientes();
        await cargarHistorialLiquidaciones();
        await cargarLiquidacionAdmin();
    } catch (error) {
        console.error('Error cargando datos:', error);
    }
}

async function cargarUsuarios() {
    try {
        const fb = window.getFirebase();
        if (!fb) return;
        usuariosCache = await fb.getUsuarios();
        renderUsuarios(usuariosCache);
    } catch (error) {
        console.error('Error cargando usuarios:', error);
    }
}

async function cargarPedidos() {
    try {
        const fb = window.getFirebase();
        if (!fb) return;
        pedidosCache = await fb.getPedidos();
        renderPedidosAdmin(pedidosCache);
        
        const selectUsuario = document.getElementById('usuarioAsignado');
        if (selectUsuario) {
            const usuariosActivos = usuariosCache.filter(u => u.activo);
            selectUsuario.innerHTML = '<option value="">Sin asignar</option>' + 
                usuariosActivos.map(u => `<option value="${u.id}">${u.nombre} (${u.vehiculo})</option>`).join('');
        }
    } catch (error) {
        console.error('Error cargando pedidos:', error);
    }
}

async function cargarClientes() {
    try {
        const fb = window.getFirebase();
        if (!fb) return;
        clientesCache = await fb.getClientes();
        renderClientes(clientesCache);
        
        const selectCliente = document.getElementById('clienteOrigen');
        if (selectCliente) {
            const clientesActivos = clientesCache.filter(c => c.activo);
            selectCliente.innerHTML = '<option value="">Seleccionar cliente (origen)</option>' + 
                clientesActivos.map(c => `<option value="${c.id}">${c.nombre} - ${c.direccion}</option>`).join('');
        }
    } catch (error) {
        console.error('Error cargando clientes:', error);
    }
}

async function cargarHistorialLiquidaciones() {
    try {
        const fb = window.getFirebase();
        if (!fb) return;
        historialLiquidaciones = await fb.getHistorialLiquidaciones();
    } catch (error) {
        historialLiquidaciones = [];
    }
}

async function cargarLiquidacionAdmin() {
    try {
        const fb = window.getFirebase();
        if (!fb) return;
        liquidacionAdmin = await fb.getLiquidacionAdmin();
        const totalAdmin = document.getElementById('totalAdmin');
        if (totalAdmin) {
            totalAdmin.textContent = `$${liquidacionAdmin.total || 0}`;
        }
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
// ===== CRUD USUARIOS =====
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
        const fb = window.getFirebase();
        if (!fb) { alert('Error de conexión con Firebase'); return; }
        
        const id = await fb.getNextId('usuarios');
        await fb.setUsuario(id, {
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
        console.error('Error:', error);
        alert('Error al crear usuario');
    }
}

async function toggleUsuarioActivo(id) {
    const usuario = usuariosCache.find(u => u.id === id);
    if (!usuario) return;
    const fb = window.getFirebase();
    if (!fb) { alert('Error de conexión con Firebase'); return; }
    await fb.setUsuario(id, { ...usuario, activo: !usuario.activo });
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
    const fb = window.getFirebase();
    if (!fb) { alert('Error de conexión con Firebase'); return; }
    await fb.setUsuario(id, { ...usuario, disponible: nuevoEstado });
    await cargarUsuarios();
}

async function eliminarUsuario(id) {
    if (!confirm('¿Eliminar este usuario?')) return;
    const fb = window.getFirebase();
    if (!fb) { alert('Error de conexión con Firebase'); return; }
    await fb.deleteUsuario(id);
    await cargarUsuarios();
}

// ============================================================
// ===== RENDER CLIENTES =====
// ============================================================

function renderClientes(clientes) {
    const container = document.getElementById('listaClientes');
    if (!container) return;
    
    if (!clientes || clientes.length === 0) {
        container.innerHTML = '<p>No hay clientes registrados</p>';
        return;
    }
    
    container.innerHTML = clientes.map(c => `
        <div class="card">
            <h4>${c.nombre}</h4>
            <p>📍 ${c.direccion || 'Sin dirección'}</p>
            <p>📞 ${c.telefono || 'Sin teléfono'}</p>
            <p>✉️ ${c.email || 'Sin email'}</p>
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

// ============================================================
// ===== CRUD CLIENTES =====
// ============================================================

async function crearCliente() {
    const nombre = document.getElementById('clienteNombre').value;
    const direccion = document.getElementById('clienteDireccion').value;
    const telefono = document.getElementById('clienteTelefono').value;
    const email = document.getElementById('clienteEmail').value;
    
    if (!nombre || !direccion) {
        alert('Nombre y dirección son obligatorios');
        return;
    }
    
    try {
        const fb = window.getFirebase();
        if (!fb) { alert('Error de conexión con Firebase'); return; }
        
        const id = await fb.getNextId('clientes');
        await fb.setCliente(id, { nombre, direccion, telefono, email, activo: true });
        hideForm('cliente');
        document.getElementById('clienteNombre').value = '';
        document.getElementById('clienteDireccion').value = '';
        document.getElementById('clienteTelefono').value = '';
        document.getElementById('clienteEmail').value = '';
        await cargarClientes();
        await cargarPedidos();
    } catch (error) {
        console.error('Error:', error);
        alert('Error al crear cliente');
    }
}

async function toggleClienteActivo(id) {
    const cliente = clientesCache.find(c => c.id === id);
    if (!cliente) return;
    const fb = window.getFirebase();
    if (!fb) { alert('Error de conexión con Firebase'); return; }
    await fb.setCliente(id, { ...cliente, activo: !cliente.activo });
    await cargarClientes();
    await cargarPedidos();
}

async function eliminarCliente(id) {
    if (!confirm('¿Eliminar este cliente?')) return;
    const fb = window.getFirebase();
    if (!fb) { alert('Error de conexión con Firebase'); return; }
    await fb.deleteCliente(id);
    await cargarClientes();
    await cargarPedidos();
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
            <p>📍 ${p.origen || 'Sin origen'} → ${p.destino || 'Sin destino'}</p>
            <p>💰 Servicio: $${p.costoServicio || 0} | Repartidor: $${p.pagoRepartidor || 0}</p>
            <p>💼 Ganancia Admin: $${p.gananciaAdmin || (p.costoServicio - p.pagoRepartidor)}</p>
            <p>👤 ${usuario ? usuario.nombre : 'Sin asignar'}</p>
            <p>🕐 Creado: ${p.fechaCreacion ? new Date(p.fechaCreacion).toLocaleString() : 'Sin fecha'}</p>
            ${p.fechaCompletado ? `<p>✅ Entregado: ${new Date(p.fechaCompletado).toLocaleString()}</p>` : ''}
            <span class="badge badge-${p.estado || 'pendiente'}">${(p.estado || 'pendiente').toUpperCase()}</span>
            <div class="card-actions">
                ${p.estado === 'pendiente' ? `<button onclick="asignarPedido(${p.id})" class="btn-primary">Asignar</button>` : ''}
                ${p.estado === 'asignado' ? `<button onclick="completarPedido(${p.id})" class="btn-success">Completar</button>` : ''}
                <button onclick="eliminarPedido(${p.id})" class="btn-danger">Eliminar</button>
            </div>
        </div>
    `).join('');
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
        const cliente = clientesCache.find(c => c.id === parseInt(clienteId));
        origen = cliente ? `${cliente.nombre} - ${cliente.direccion}` : origenManual;
    } else if (origenManual) {
        origen = origenManual;
    } else {
        alert('Debes seleccionar un cliente o escribir un origen manual');
        return;
    }
    
    if (!descripcion || !origen || !destino || !costoServicio || !pagoRepartidor) {
        alert('Todos los campos son obligatorios');
        return;
    }
    
    try {
        const fb = window.getFirebase();
        if (!fb) { alert('Error de conexión con Firebase'); return; }
        
        await fb.crearPedidoConPushup({
            descripcion, origen, destino,
            costoServicio, pagoRepartidor,
            clienteOrigenId: clienteId || null,
            gananciaAdmin: costoServicio - pagoRepartidor,
            usuarioAsignado: usuarioAsignado ? parseInt(usuarioAsignado) : null,
            estado: usuarioAsignado ? 'asignado' : 'pendiente'
        });
        
        hideForm('pedido');
        document.getElementById('descripcion').value = '';
        document.getElementById('clienteOrigen').value = '';
        document.getElementById('origenManual').value = '';
        document.getElementById('destino').value = '';
        document.getElementById('costoServicio').value = '';
        document.getElementById('pagoRepartidor').value = '';
        document.getElementById('usuarioAsignado').value = '';
        
        await cargarPedidos();
        await cargarUsuarios();
        alert('✅ Pedido creado exitosamente.');
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
    const pedido = pedidosCache.find(p => p.id === id);
    if (pedido) {
        const fb = window.getFirebase();
        if (!fb) { alert('Error de conexión con Firebase'); return; }
        await fb.setPedido(id, { ...pedido, usuarioAsignado: usuariosActivos[index].id, estado: 'asignado' });
        await cargarPedidos();
    }
}

async function completarPedido(id) {
    if (!confirm('¿Completar este pedido?')) return;
    const pedido = pedidosCache.find(p => p.id === id);
    if (!pedido) return;
    
    const fb = window.getFirebase();
    if (!fb) { alert('Error de conexión con Firebase'); return; }
    
    await fb.setPedido(id, { ...pedido, estado: 'completado', fechaCompletado: new Date().toISOString() });
    if (pedido.usuarioAsignado) {
        const usuario = usuariosCache.find(u => u.id === pedido.usuarioAsignado);
        if (usuario) {
            await fb.setUsuario(usuario.id, {
                ...usuario,
                liquidacionTotal: (usuario.liquidacionTotal || 0) + pedido.pagoRepartidor,
                pedidosCompletados: (usuario.pedidosCompletados || 0) + 1
            });
        }
    }
    liquidacionAdmin.total = (liquidacionAdmin.total || 0) + (pedido.gananciaAdmin || pedido.costoServicio - pedido.pagoRepartidor);
    await fb.setLiquidacionAdmin(liquidacionAdmin);
    const totalAdmin = document.getElementById('totalAdmin');
    if (totalAdmin) totalAdmin.textContent = `$${liquidacionAdmin.total || 0}`;
    await cargarPedidos();
    await cargarUsuarios();
}

async function eliminarPedido(id) {
    if (!confirm('¿Eliminar este pedido?')) return;
    const fb = window.getFirebase();
    if (!fb) { alert('Error de conexión con Firebase'); return; }
    await fb.deletePedido(id);
    await cargarPedidos();
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
    const fb = window.getFirebase();
    if (!fb) { alert('Error de conexión con Firebase'); return; }
    await fb.setUsuario(id, { ...usuario, ajustesLiquidacion: ajustes, liquidacionTotal: (usuario.liquidacionTotal || 0) + monto });
    await cargarUsuarios();
    alert('✅ Ajuste aplicado correctamente');
}

// ============================================================
// ===== PANEL USUARIO =====
// ============================================================

async function cargarPanelUsuario(usuario) {
    const bienvenida = document.getElementById('bienvenidaUsuario');
    if (bienvenida) bienvenida.textContent = `👋 Hola, ${usuario.nombre}`;
    
    const vehiculo = document.getElementById('vehiculoUsuario');
    if (vehiculo) vehiculo.textContent = getVehiculoIcon(usuario.vehiculo);
    
    const liquidacion = document.getElementById('liquidacionUsuario');
    if (liquidacion) liquidacion.textContent = `$${usuario.liquidacionTotal || 0}`;
    
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
    const fb = window.getFirebase();
    if (!fb) { alert('Error de conexión con Firebase'); return; }
    await fb.setUsuario(usuarioActual.id, { ...usuarioActual, disponible: nuevoEstado });
    usuarioActual.disponible = nuevoEstado;
    window.usuarioActual = usuarioActual;
    guardarSesionUsuario(usuarioActual);
    actualizarEstadoUsuario(usuarioActual);
    await cargarPedidosUsuario(usuarioActual.id);
}

async function cargarPedidosUsuario(usuarioId) {
    try {
        const fb = window.getFirebase();
        if (!fb) return;
        const pedidos = await fb.getPedidos();
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
                    <p>📍 ${p.origen || 'Sin origen'} → ${p.destino || 'Sin destino'}</p>
                    <p>💰 Pago: $${p.pagoRepartidor || 0}</p>
                    <div class="card-actions">
                        <button onclick="tomarPedido(${p.id})" class="btn-success">✅ Tomar Pedido</button>
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
                    <p>Estado: <span class="badge badge-asignado">ASIGNADO</span></p>
                    <div class="card-actions">
                        <button onclick="completarPedidoUsuario(${p.id})" class="btn-success">✅ Completar</button>
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
                    <p>✅ Entregado: ${p.fechaCompletado ? new Date(p.fechaCompletado).toLocaleString() : 'Sin fecha'}</p>
                </div>
            `).join('');
    }
}

async function tomarPedido(id) {
    if (!usuarioActual || !usuarioActual.disponible) {
        alert('No estás disponible para tomar pedidos');
        return;
    }
    if (!confirm('¿Tomar este pedido?')) return;
    const pedido = pedidosCache.find(p => p.id === id);
    if (pedido) {
        const fb = window.getFirebase();
        if (!fb) { alert('Error de conexión con Firebase'); return; }
        await fb.setPedido(id, { ...pedido, usuarioAsignado: usuarioActual.id, estado: 'asignado' });
        await cargarPedidosUsuario(usuarioActual.id);
    }
}

async function completarPedidoUsuario(id) {
    if (!confirm('¿Completar este pedido?')) return;
    const fb = window.getFirebase();
    if (!fb) { alert('Error de conexión con Firebase'); return; }
    
    const pedido = (await fb.getPedidos()).find(p => p.id === id);
    if (!pedido) { alert('Pedido no encontrado'); return; }
    await fb.setPedido(id, { ...pedido, estado: 'completado', fechaCompletado: new Date().toISOString() });
    if (usuarioActual) {
        const nuevaLiquidacion = (usuarioActual.liquidacionTotal || 0) + pedido.pagoRepartidor;
        await fb.setUsuario(usuarioActual.id, {
            ...usuarioActual,
            liquidacionTotal: nuevaLiquidacion,
            pedidosCompletados: (usuarioActual.pedidosCompletados || 0) + 1
        });
        usuarioActual.liquidacionTotal = nuevaLiquidacion;
        usuarioActual.pedidosCompletados = (usuarioActual.pedidosCompletados || 0) + 1;
        window.usuarioActual = usuarioActual;
        const liquidacionSpan = document.getElementById('liquidacionUsuario');
        if (liquidacionSpan) liquidacionSpan.textContent = `$${nuevaLiquidacion}`;
        guardarSesionUsuario(usuarioActual);
    }
    const ganancia = pedido.gananciaAdmin || (pedido.costoServicio - pedido.pagoRepartidor);
    liquidacionAdmin.total = (liquidacionAdmin.total || 0) + ganancia;
    await fb.setLiquidacionAdmin(liquidacionAdmin);
    await cargarPedidosUsuario(usuarioActual.id);
    alert('✅ Pedido completado exitosamente');
}

// ============================================================
// ===== PUSHUP - NOTIFICACIONES MEJORADAS =====
// ============================================================

let ultimaNotificacionId = null;
let timeoutNotificacion = null;

function mostrarAlertaPedidoNuevoMejorado(pedido) {
    const fb = window.getFirebase();
    if (fb && fb.reproducirSonidoNotificacion) {
        fb.reproducirSonidoNotificacion();
        setTimeout(() => {
            if (fb.reproducirSonidoNotificacion) fb.reproducirSonidoNotificacion();
        }, 400);
    }
    
    if (ultimaNotificacionId === pedido.id) {
        console.log('⏭️ Notificación duplicada ignorada');
        return;
    }
    ultimaNotificacionId = pedido.id;
    
    if (timeoutNotificacion) {
        clearTimeout(timeoutNotificacion);
        timeoutNotificacion = null;
    }
    
    const alertaAnterior = document.querySelector('.alerta-pedido-nuevo');
    if (alertaAnterior) alertaAnterior.remove();
    
    const alerta = document.createElement('div');
    alerta.className = 'alerta-pedido-nuevo';
    alerta.style.cssText = `
        background: linear-gradient(135deg, #1a3a1a, #0a2a0a);
        border: 2px solid #28a745;
        border-radius: 12px;
        padding: 15px 20px;
        margin-bottom: 20px;
        animation: alertaEntrada 0.5s ease-out;
        box-shadow: 0 0 30px rgba(40, 167, 69, 0.2);
        position: relative;
        z-index: 100;
    `;
    
    alerta.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px;">
            <span style="font-size: 2.5rem; animation: iconoPulso 0.8s ease-in-out infinite;">📦</span>
            <div style="flex: 1;">
                <strong style="color: #28a745; font-size: 1.2rem;">¡Nuevo Pedido Disponible!</strong>
                <p style="margin: 3px 0; color: #b0b0b0;">${pedido.descripcion || 'Sin descripción'}</p>
                <p style="font-size: 0.9rem; opacity: 0.8; margin: 0;">📍 ${pedido.origen || 'Sin origen'} → ${pedido.destino || 'Sin destino'}</p>
                <p style="font-size: 0.9rem; color: #28a745; margin: 0;">💰 $${pedido.pagoRepartidor || 0}</p>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" style="padding: 4px 12px; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer;">✕</button>
        </div>
    `;
    
    const panel = document.getElementById('usuarioPanel');
    if (panel) {
        panel.insertBefore(alerta, panel.firstChild);
    }
    
    timeoutNotificacion = setTimeout(() => {
        if (alerta.parentNode) alerta.remove();
        timeoutNotificacion = null;
    }, 15000);
}

function iniciarEscuchaPushup() {
    const fb = window.getFirebase();
    if (!fb) {
        console.error('❌ Firebase no disponible para pushup');
        setTimeout(iniciarEscuchaPushup, 2000);
        return;
    }
    
    console.log('📡 Iniciando escucha de nuevos pedidos (keepSynced activado)...');
    activarSonidoGlobal();
    
    fb.escucharNuevosPedidos(function(nuevoPedido) {
        console.log(`📦 Nuevo pedido #${nuevoPedido.id} detectado:`, nuevoPedido.descripcion);
        
        if (ultimoPedidoPendiente === null || nuevoPedido.id !== ultimoPedidoPendiente.id) {
            ultimoPedidoPendiente = nuevoPedido;
            
            if (fb.reproducirSonidoNotificacion) {
                fb.reproducirSonidoNotificacion();
                setTimeout(() => {
                    if (fb.reproducirSonidoNotificacion) fb.reproducirSonidoNotificacion();
                }, 400);
            }
            
            if ('Notification' in window && Notification.permission === 'granted') {
                try {
                    new Notification('📦 Nuevo Pedido Disponible', {
                        body: `${nuevoPedido.descripcion || 'Pedido'}\n📍 ${nuevoPedido.origen || ''} → ${nuevoPedido.destino || ''}\n💰 $${nuevoPedido.pagoRepartidor || 0}`,
                        icon: 'data:image/svg+xml,' + encodeURIComponent(`
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
                                <rect width="100" height="100" rx="20" fill="#ff6b35"/>
                                <text x="50" y="70" font-size="60" text-anchor="middle">📦</text>
                            </svg>
                        `),
                        silent: false,
                        vibrate: [200, 100, 200],
                        requireInteraction: true,
                        tag: 'nuevo-pedido-' + nuevoPedido.id
                    });
                } catch (e) {
                    console.log('Error mostrando notificación:', e);
                }
            }
            
            mostrarAlertaPedidoNuevoMejorado(nuevoPedido);
            
            if (usuarioActual) {
                console.log('🔄 Recargando lista de pedidos...');
                cargarPedidosUsuario(usuarioActual.id);
            }
        }
    });
}

// ============================================================
// ===== ACTIVAR SONIDO MANUAL =====
// ============================================================

function activarSonidoManual() {
    const fb = window.getFirebase();
    if (fb && fb.activarSonido) {
        fb.activarSonido();
        if (fb.reproducirSonidoNotificacion) {
            fb.reproducirSonidoNotificacion();
            setTimeout(() => {
                if (fb.reproducirSonidoNotificacion) fb.reproducirSonidoNotificacion();
            }, 300);
        }
        alert('🔊 Sonido activado. Ahora escucharás las notificaciones.');
        console.log('🔊 Sonido activado manualmente');
    } else {
        alert('⚠️ Error activando sonido. Intenta tocar la pantalla primero.');
    }
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
    } else if (tab === 'clientes') {
        document.getElementById('tabClientes').style.display = 'block';
        document.querySelectorAll('.tab-btn')[4].classList.add('active');
        cargarClientes();
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
    const fb = window.getFirebase();
    if (!fb) return;
    const usuarios = await fb.getUsuarios();
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
                <button onclick="verLiquidacionUsuario(${u.id})" class="btn-primary">💰 Ver Detalle</button>
                <button onclick="ajustarLiquidacion(${u.id})" class="btn-secondary">✏️ Ajustar</button>
            </div>
        </div>
    `).join('');
}

function showForm(tipo) {
    if (tipo === 'usuario') {
        document.getElementById('usuarioForm').style.display = 'block';
    } else if (tipo === 'pedido') {
        document.getElementById('pedidoForm').style.display = 'block';
        cargarClientes();
    } else if (tipo === 'cliente') {
        document.getElementById('clienteForm').style.display = 'block';
    }
}

function hideForm(tipo) {
    if (tipo === 'usuario') {
        document.getElementById('usuarioForm').style.display = 'none';
    } else if (tipo === 'pedido') {
        document.getElementById('pedidoForm').style.display = 'none';
    } else if (tipo === 'cliente') {
        document.getElementById('clienteForm').style.display = 'none';
    }
}

// ============================================================
// ===== RECONEXIÓN AUTOMÁTICA =====
// ============================================================

function iniciarReconexion() {
    const fb = window.getFirebase();
    if (!fb) {
        console.error('❌ Firebase no disponible para reconexión');
        return;
    }
    
    const dbRef = fb.database.ref('.info/connected');
    dbRef.on('value', function(snap) {
        if (snap.val() === true) {
            console.log('✅ Reconectado a Firebase');
            if (usuarioActual) {
                cargarPedidosUsuario(usuarioActual.id);
            }
        } else {
            console.log('⚠️ Desconectado de Firebase - Reintentando...');
        }
    });
}

// ============================================================
// ===== INICIO =====
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚚 Gestor de Entregas v3.0 - Firebase');
    console.log('Admin: LedZepp1');
    console.log('Usuarios: carlos123 / reparto2024, maria456 / bici2024');
    console.log('🔊 Sonido: Activado al tocar la pantalla');
    
    // Activar sonido al cargar la página (intento)
    setTimeout(function() {
        activarSonidoGlobal();
    }, 1000);
    
    if (typeof window.firebaseFunctions === 'undefined') {
        console.warn('⏳ Esperando carga de Firebase...');
        const checkFirebase = setInterval(function() {
            if (typeof window.firebaseFunctions !== 'undefined') {
                clearInterval(checkFirebase);
                console.log('✅ Firebase cargado correctamente');
                iniciarSistema();
            }
        }, 500);
    } else {
        iniciarSistema();
    }
});

function iniciarSistema() {
    if (obtenerSesionAdmin()) {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        cargarDatosAdmin();
    }
    const usuario = obtenerSesionUsuario();
    if (usuario) {
        usuarioActual = usuario;
        window.usuarioActual = usuario;
        document.getElementById('loginUsuarioSection').style.display = 'none';
        document.getElementById('usuarioPanel').style.display = 'block';
        cargarPanelUsuario(usuario);
    }
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    iniciarReconexion();
}