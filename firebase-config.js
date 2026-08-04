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

const ADMIN_PASSWORD = 'LedZepp1';

async function registrarRepartidor(email, password, nombre, vehiculo = 'moto') {
    try {
        const userCred = await auth.createUserWithEmailAndPassword(email, password);
        const uid = userCred.user.uid;

        await database.ref(`usuarios/${uid}`).set({
            id: uid,
            nombre,
            email,
            username: email,
            vehiculo,
            saldo: 0,
            estado: 'disponible',
            activo: true,
            createdAt: new Date().toISOString()
        });

        return { success: true, uid, user: userCred.user };
    } catch (error) {
        console.error('Error registrando repartidor:', error);
        return { success: false, error: error.message };
    }
}

async function loginRepartidor(email, password) {
    try {
        const userCred = await auth.signInWithEmailAndPassword(email, password);
        const uid = userCred.user.uid;

        const snap = await database.ref(`usuarios/${uid}`).once('value');
        const usuario = snap.val();

        if (!usuario) {
            await auth.signOut();
            return { success: false, error: 'Usuario no encontrado en BD' };
        }

        return { success: true, uid, user: usuario, authUser: userCred.user };
    } catch (error) {
        console.error('Error en login repartidor:', error);
        return { success: false, error: error.message };
    }
}

async function loginAdmin(clave) {
    if (clave === ADMIN_PASSWORD) {
        return { success: true, role: 'admin' };
    }
    return { success: false, error: 'Clave incorrecta' };
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
    registrarRepartidor,
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