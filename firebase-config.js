// ============================================================
// 🔥 CONFIGURACIÓN DE FIREBASE
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyAeGBlBuHu_sm1_yq-3RCwsNZMEAXmunxE",
    authDomain: "santify-19aee.firebaseapp.com",
    databaseURL: "https://santify-19aee-default-rtdb.firebaseio.com",
    projectId: "santify-19aee",
    storageBucket: "santify-19aee.firebasestorage.app",
    messagingSenderId: "767338603808",
    appId: "1:767338603808:web:dbebbd7377de5b9c9e6345"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const storage = firebase.storage();
const auth = firebase.auth();

window.firebaseStorage = storage;
window.firebaseAuth = auth;

// Mantener conexión activa
database.goOnline();

// ============================================================
// ✅ MONITOREO DE CONEXIÓN
// ============================================================

let isConnected = false;

database.ref('.info/connected').on('value', function(snap) {
    isConnected = snap.val() === true;
    if (isConnected) {
        console.log('✅ Conectado a Firebase');
    } else {
        console.warn('⚠️ Desconectado de Firebase');
    }
});

// ============================================================
// 🔊 SONIDO — SOLO CON INTERACCIÓN DEL USUARIO
// ============================================================

let audioElement = null;
let audioContext = null;
let sonidoHabilitado = false;

// Crear o reanudar AudioContext SOLO si el usuario ya interactuó
function prepararAudio() {
    if (sonidoHabilitado) return true;

    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        sonidoHabilitado = true;
        console.log('🔊 Sonido habilitado por acción del usuario');
        return true;
    } catch (e) {
        console.warn('⚠️ Error preparando audio:', e.message);
        return false;
    }
}

// Los navegadores móviles suspenden el AudioContext al bloquear la pantalla o
// cambiar de app. Sin esto, el sonido puede quedar mudo hasta el próximo toque.
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible' && sonidoHabilitado && audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
    }
});

// Cargar el archivo de sonido
function obtenerAudio() {
    if (audioElement) return audioElement;
    try {
        audioElement = new Audio('sonido.mp3');
        audioElement.preload = 'auto';
        audioElement.load();
        audioElement.volume = 0.8;
        return audioElement;
    } catch (e) {
        console.warn('⚠️ Error cargando sonido.mp3:', e.message);
        return null;
    }
}

// Reproducir sonido — SOLO si el usuario ya lo habilitó
function reproducirSonido() {
    if (!sonidoHabilitado) {
        console.log('🔇 Sonido no habilitado aún. El usuario debe tocar "Activar Sonido".');
        return;
    }

    try {
        // Reanudar el contexto si el navegador lo suspendió (pantalla bloqueada, cambio de app, etc.)
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {});
        }

        // Opción 1: AudioContext (tono sintético como respaldo)
        if (audioContext && audioContext.state === 'running') {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, audioContext.currentTime);
            gain.gain.setValueAtTime(0.3, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
            osc.start(audioContext.currentTime);
            osc.stop(audioContext.currentTime + 0.15);

            setTimeout(() => {
                try {
                    const osc2 = audioContext.createOscillator();
                    const gain2 = audioContext.createGain();
                    osc2.connect(gain2);
                    gain2.connect(audioContext.destination);
                    osc2.type = 'sine';
                    osc2.frequency.setValueAtTime(1100, audioContext.currentTime);
                    gain2.gain.setValueAtTime(0.25, audioContext.currentTime);
                    gain2.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
                    osc2.start(audioContext.currentTime);
                    osc2.stop(audioContext.currentTime + 0.2);
                } catch (e) {}
            }, 180);
        }

        // Opción 2: MP3 (más familiar para el usuario)
        const audio = obtenerAudio();
        if (audio) {
            audio.currentTime = 0;
            audio.volume = 0.8;
            audio.play().catch(e => {
                console.warn('⚠️ Error con MP3, reintentando con un elemento nuevo:', e.message);
                // Tras mucho tiempo en segundo plano algunos navegadores móviles
                // invalidan el elemento de audio: se recrea y se reintenta una vez.
                audioElement = null;
                const retry = obtenerAudio();
                if (retry) {
                    retry.currentTime = 0;
                    retry.volume = 0.8;
                    retry.play().catch(e2 => console.warn('⚠️ Reintento de MP3 falló:', e2.message));
                }
            });
        }

        // Vibración (móviles)
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100, 50, 200]);
        }
    } catch (e) {
        console.warn('⚠️ Error en reproducirSonido:', e.message);
    }
}

// Función que se llama desde el botón "Activar Sonido"
function activarSonidoManual() {
    const ok = prepararAudio();
    if (ok) {
        // Reproducir sonido de prueba para confirmar
        setTimeout(() => reproducirSonido(), 100);
        setTimeout(() => reproducirSonido(), 400);
        alert('🔊 Sonido activado correctamente');
    } else {
        alert('⚠️ No se pudo activar el sonido. Intenta nuevamente.');
    }
}

// ============================================================
// 🔐 AUTENTICACIÓN CON FIREBASE AUTH
// ============================================================

// Todas las cuentas viven en Firebase Auth. Ya no hay ninguna contraseña en este
// archivo: el navegador lo descarga entero, así que cualquier clave escrita acá
// sería pública. Quien se autentica recibe un uid, y las reglas de la base deciden
// qué puede ver según ese uid.

// Los repartidores escriben solo su usuario, no un email. Se completa acá para que
// Firebase Auth, que exige formato de email, lo acepte.
const DOMINIO_CUENTAS = '@deliberisso.com.ar';

function aEmail(identificador) {
    const id = String(identificador || '').trim();
    return id.includes('@') ? id : id + DOMINIO_CUENTAS;
}

async function loginAdmin(usuario, clave) {
    try {
        const cred = await auth.signInWithEmailAndPassword(aEmail(usuario), clave);
        const uid = cred.user.uid;

        // Autenticarse no alcanza: hay que estar en la lista de administradores.
        const snap = await database.ref('admins/' + uid).once('value');
        if (!snap.val()) {
            await auth.signOut();
            return { success: false, error: 'Esta cuenta no tiene permisos de administrador' };
        }
        return { success: true, role: 'admin', uid };
    } catch (error) {
        console.error('Error en login admin:', error.code || error.message);
        return { success: false, error: 'Usuario o contraseña incorrectos' };
    }
}

async function loginRepartidor(identificador, password) {
    try {
        const cred = await auth.signInWithEmailAndPassword(aEmail(identificador), password);
        const uid = cred.user.uid;

        // uidIndex traduce el uid de Firebase al id numérico histórico, que es el que
        // referencian pedidos e historial de liquidaciones.
        const idSnap = await database.ref('uidIndex/' + uid).once('value');
        const id = idSnap.val();
        if (id == null) {
            await auth.signOut();
            return { success: false, error: 'Esta cuenta no está habilitada como repartidor' };
        }

        const snap = await database.ref('usuarios/' + id).once('value');
        const usuario = snap.val();
        if (!usuario) {
            await auth.signOut();
            return { success: false, error: 'No encontramos tus datos' };
        }

        return { success: true, uid, user: { id: parseInt(id), ...usuario } };
    } catch (error) {
        console.error('Error en login repartidor:', error.code || error.message);
        return { success: false, error: 'Usuario o contraseña incorrectos' };
    }
}

// La sesión de Firebase se restaura de forma asincrónica al cargar la página. Esto
// permite esperarla antes de decidir si una sesión guardada sigue siendo válida.
function esperarAuth() {
    return new Promise(resolve => {
        const off = auth.onAuthStateChanged(user => { off(); resolve(user); });
    });
}

async function esAdminActual() {
    const user = auth.currentUser;
    if (!user) return false;
    try {
        const snap = await database.ref('admins/' + user.uid).once('value');
        return !!snap.val();
    } catch (e) { return false; }
}

async function logoutUsuario() {
    try {
        await auth.signOut();
        return { success: true };
    } catch (error) {
        console.error('Error en logout:', error);
        return { success: false, error: error.message };
    }
}

function getCurrentUser() {
    return auth.currentUser;
}

function onAuthStateChanged(callback) {
    return auth.onAuthStateChanged(callback);
}

// ============================================================
// 📡 FUNCIONES DE FIREBASE (CORREGIDAS)
// ============================================================

let listenerActivo = null;

function escucharNuevosPedidos(callback) {
    const pedidosRef = database.ref('pedidos');

    // Escuchar NUEVOS pedidos (child_added)
    pedidosRef.on('child_added', function(snapshot) {
        const pedido = snapshot.val();
        const id = parseInt(snapshot.key);
        
        if (pedido) {
            console.log('📦 Pedido detectado #' + id + ': ' + pedido.descripcion + ' [' + pedido.estado + ']');
            
            // Solo reproducir sonido si es un pedido nuevo pendiente y el sonido está habilitado
            if (pedido.estado === 'pendiente' && sonidoHabilitado) {
                reproducirSonido();
                setTimeout(() => reproducirSonido(), 300);
                setTimeout(() => reproducirSonido(), 600);
            }
            
            // Llamar al callback con el pedido
            callback({ id, ...pedido });
        }
    }, function(error) {
        console.error('❌ Error escuchando pedidos:', error);
    });

    // También escuchar CAMBIOS en pedidos existentes (para actualizar estado en tiempo real)
    pedidosRef.on('child_changed', function(snapshot) {
        const pedido = snapshot.val();
        const id = parseInt(snapshot.key);
        
        if (pedido) {
            console.log('🔄 Pedido actualizado #' + id + ': ' + pedido.descripcion + ' [' + pedido.estado + ']');
            callback({ id, ...pedido });
        }
    });

    console.log('📡 Escuchando pedidos en tiempo real (nuevos y cambios)');
}

function dejarDeEscuchar() {
    database.ref('pedidos').off();
    console.log('🔇 Dejó de escuchar pedidos');
}

// Escuchar cambios en el propio usuario (ej: liquidación pagada por el admin)
function escucharUsuario(id, callback) {
    database.ref('usuarios/' + id).on('value', function(snapshot) {
        const data = snapshot.val();
        if (data) callback({ id, ...data });
    }, function(error) {
        console.error('❌ Error escuchando usuario:', error);
    });
}

function dejarDeEscucharUsuario(id) {
    database.ref('usuarios/' + id).off();
    console.log('🔇 Dejó de escuchar usuario ' + id);
}

// ============================================================
// 📦 CRUD — USUARIOS
// ============================================================

async function getUsuarios() {
    try {
        const snapshot = await database.ref('usuarios').once('value');
        const data = snapshot.val();
        if (!data) return [];
        return Object.keys(data).map(key => ({ id: parseInt(key), ...data[key] }));
    } catch (error) {
        console.error('Error obteniendo usuarios:', error);
        return [];
    }
}

async function setUsuario(id, data) {
    await database.ref(`usuarios/${id}`).set(data);
    return { id, ...data };
}

async function deleteUsuario(id) {
    await database.ref(`usuarios/${id}`).remove();
    return true;
}

// ============================================================
// 📦 CRUD — PEDIDOS
// ============================================================

async function getPedidos() {
    try {
        const snapshot = await database.ref('pedidos').once('value');
        const data = snapshot.val();
        if (!data) return [];
        return Object.keys(data).map(key => ({ id: parseInt(key), ...data[key] }));
    } catch (error) {
        console.error('Error obteniendo pedidos:', error);
        return [];
    }
}

async function setPedido(id, data) {
    await database.ref(`pedidos/${id}`).set(data);
    return { id, ...data };
}

async function deletePedido(id) {
    await database.ref(`pedidos/${id}`).remove();
    return true;
}

// ============================================================
// 📦 CRUD — CLIENTES
// ============================================================

async function getClientes() {
    try {
        const snapshot = await database.ref('clientes').once('value');
        const data = snapshot.val();
        if (!data) return [];
        return Object.keys(data).map(key => ({ id: parseInt(key), ...data[key] }));
    } catch (error) {
        console.error('Error obteniendo clientes:', error);
        return [];
    }
}

async function setCliente(id, data) {
    await database.ref(`clientes/${id}`).set(data);
    return { id, ...data };
}

async function deleteCliente(id) {
    await database.ref(`clientes/${id}`).remove();
    return true;
}

// ============================================================
// ⚙️ CONFIGURACIÓN GENERAL (teléfono de soporte de la landing)
// ============================================================

async function getConfig() {
    try {
        const snapshot = await database.ref('config').once('value');
        return snapshot.val() || {};
    } catch (error) {
        console.error('Error obteniendo configuración:', error);
        return {};
    }
}

async function setConfig(data) {
    try {
        await database.ref('config').update(data);
        return true;
    } catch (error) {
        console.error('Error guardando configuración:', error);
        return false;
    }
}

// ============================================================
// 📊 MÉTRICAS DE LA LANDING
// ============================================================
// Contadores atómicos con ServerValue.increment: dos visitantes simultáneos no
// se pisan el valor. Nada de esto debe interrumpir al usuario, así que todas las
// funciones tragan sus errores y nunca se esperan con await desde la interfaz.

function sumarMetrica(ruta, cantidad = 1) {
    try {
        return database.ref(ruta).set(firebase.database.ServerValue.increment(cantidad))
            .catch(e => console.warn('Métrica no registrada:', e.message));
    } catch (error) {
        console.warn('Métrica no registrada:', error.message);
        return Promise.resolve();
    }
}

function registrarVistaOferta(ofertaId) {
    if (ofertaId == null) return;
    sumarMetrica(`metricas/ofertas/${ofertaId}/vistas`);
}

function registrarWhatsappOferta(ofertaId, clienteId) {
    if (ofertaId != null) sumarMetrica(`metricas/ofertas/${ofertaId}/whatsapp`);
    if (clienteId != null) sumarMetrica(`metricas/locales/${clienteId}/whatsapp`);
}

function registrarWhatsappLocal(clienteId) {
    if (clienteId != null) sumarMetrica(`metricas/locales/${clienteId}/whatsapp`);
}

function registrarFiltroCategoria(categoriaId) {
    if (categoriaId) sumarMetrica(`metricas/categorias/${categoriaId}/filtros`);
}

// Lo que la gente busca y no encuentra: dice qué comida falta en la plataforma.
function registrarBusquedaSinResultado(texto) {
    const t = String(texto || '').trim().toLowerCase();
    if (t.length < 3) return;
    try {
        database.ref('metricas/busquedasSinResultado').push({
            texto: t.slice(0, 60),
            fecha: new Date().toISOString()
        }).catch(e => console.warn('Búsqueda no registrada:', e.message));
    } catch (error) {
        console.warn('Búsqueda no registrada:', error.message);
    }
}

async function getMetricas() {
    try {
        const snapshot = await database.ref('metricas').once('value');
        return snapshot.val() || {};
    } catch (error) {
        console.error('Error obteniendo métricas:', error);
        return {};
    }
}

// ============================================================
// 💼 HISTORIAL DE LIQUIDACIONES DEL ADMINISTRADOR
// ============================================================
// Va en su propio nodo, separado del historial de repartidores, porque son dos
// cuentas distintas: lo que cobra el admin no es un pago a nadie.

async function getHistorialAdmin() {
    try {
        const snapshot = await database.ref('historialLiquidacionAdmin').once('value');
        const data = snapshot.val();
        if (!data) return [];
        return Array.isArray(data) ? data.filter(Boolean) : Object.values(data);
    } catch (error) {
        console.error('Error obteniendo historial del admin:', error);
        return [];
    }
}

async function setHistorialAdmin(lista) {
    try {
        await database.ref('historialLiquidacionAdmin').set(lista);
        return true;
    } catch (error) {
        console.error('Error guardando historial del admin:', error);
        return false;
    }
}

// ============================================================
// 📢 BANNERS DE PUBLICIDAD (laterales de la landing)
// ============================================================

async function getBanners() {
    try {
        const snapshot = await database.ref('banners').once('value');
        const data = snapshot.val();
        if (!data) return [];
        return Object.keys(data).map(key => ({ id: parseInt(key), ...data[key] }));
    } catch (error) {
        console.error('Error obteniendo banners:', error);
        return [];
    }
}

async function setBanner(id, data) {
    try {
        await database.ref('banners/' + id).set(data);
        return true;
    } catch (error) {
        console.error('Error guardando banner:', error);
        return false;
    }
}

async function deleteBanner(id) {
    try {
        await database.ref('banners/' + id).remove();
        return true;
    } catch (error) {
        console.error('Error eliminando banner:', error);
        return false;
    }
}

// ============================================================
// 📦 CRUD — CATEGORÍAS (landing estilo Netflix)
// ============================================================

async function getCategorias() {
    try {
        const snapshot = await database.ref('categorias').once('value');
        const data = snapshot.val();
        if (!data) return [];
        return Object.keys(data).map(key => ({ id: parseInt(key), ...data[key] }));
    } catch (error) {
        console.error('Error obteniendo categorías:', error);
        return [];
    }
}

async function setCategoria(id, data) {
    await database.ref(`categorias/${id}`).set(data);
    return { id, ...data };
}

async function deleteCategoria(id) {
    await database.ref(`categorias/${id}`).remove();
    return true;
}

// ============================================================
// 📦 CRUD — OFERTAS (los "pósters" de la landing)
// ============================================================

async function getOfertas() {
    try {
        const snapshot = await database.ref('ofertas').once('value');
        const data = snapshot.val();
        if (!data) return [];
        return Object.keys(data).map(key => ({ id: parseInt(key), ...data[key] }));
    } catch (error) {
        console.error('Error obteniendo ofertas:', error);
        return [];
    }
}

async function setOferta(id, data) {
    await database.ref(`ofertas/${id}`).set(data);
    return { id, ...data };
}

async function deleteOferta(id) {
    await database.ref(`ofertas/${id}`).remove();
    return true;
}

// ============================================================
// 📦 LIQUIDACIONES
// ============================================================

async function getHistorial() {
    try {
        const snapshot = await database.ref('historialLiquidaciones').once('value');
        const data = snapshot.val();
        return data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
    } catch (error) {
        console.error('Error obteniendo historial:', error);
        return [];
    }
}

async function setHistorial(historial) {
    const obj = {};
    historial.forEach((item, index) => { obj[index] = item; });
    await database.ref('historialLiquidaciones').set(obj);
    return historial;
}

async function getLiquidacionAdmin() {
    try {
        const snapshot = await database.ref('liquidacionAdmin').once('value');
        const data = snapshot.val();
        return data || { total: 0, historial: [] };
    } catch (error) {
        console.error('Error obteniendo liquidacionAdmin:', error);
        return { total: 0, historial: [] };
    }
}

async function setLiquidacionAdmin(data) {
    await database.ref('liquidacionAdmin').set(data);
    return data;
}

async function getNextId(path) {
    try {
        const snapshot = await database.ref(path).once('value');
        const data = snapshot.val();
        if (!data) return 1;
        const keys = Object.keys(data);
        const ids = keys.map(k => parseInt(k));
        const maxId = Math.max(...ids);
        return maxId + 1;
    } catch (error) {
        console.warn('Error obteniendo próximo ID, usando 1:', error);
        return 1;
    }
}

async function crearPedidoConPushup(data) {
    const id = await getNextId('pedidos');
    const nuevo = {
        ...data,
        fechaCreacion: new Date().toISOString(),
        fechaCompletado: null
    };
    await setPedido(id, nuevo);
    console.log('📦 Pedido #' + id + ' creado');
    return { id, ...nuevo };
}

// ============================================================
// 📢 EXPORTAR FUNCIONES (GLOBALES)
// ============================================================

window.firebaseFunctions = {
    escucharNuevosPedidos,
    dejarDeEscuchar,
    escucharUsuario,
    dejarDeEscucharUsuario,
    getUsuarios,
    setUsuario,
    deleteUsuario,
    getPedidos,
    setPedido,
    deletePedido,
    getClientes,
    setCliente,
    deleteCliente,
    getConfig,
    setConfig,
    registrarVistaOferta,
    registrarWhatsappOferta,
    registrarWhatsappLocal,
    registrarFiltroCategoria,
    registrarBusquedaSinResultado,
    getMetricas,
    getHistorialAdmin,
    setHistorialAdmin,
    getBanners,
    setBanner,
    deleteBanner,
    getCategorias,
    setCategoria,
    deleteCategoria,
    getOfertas,
    setOferta,
    deleteOferta,
    getHistorial,
    setHistorial,
    getLiquidacionAdmin,
    setLiquidacionAdmin,
    getNextId,
    crearPedidoConPushup,
    database,
    activarSonidoManual,
    reproducirSonido,
    prepararAudio,
    esperarAuth,
    esAdminActual,
    loginRepartidor,
    loginAdmin,
    logoutUsuario,
    getCurrentUser,
    onAuthStateChanged
};

window.getFirebase = function() {
    return window.firebaseFunctions || null;
};

console.log('🔥 Firebase OK');
console.log('🔊 Sonido preparado (esperando interacción del usuario)');