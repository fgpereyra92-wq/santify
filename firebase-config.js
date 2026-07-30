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
database.goOnline();

// ============================================================
// ✅ VERIFICAR CONEXIÓN
// ============================================================

database.ref('.info/connected').on('value', function(snap) {
    if (snap.val() === true) {
        console.log('✅ Conectado a Firebase');
    } else {
        console.warn('⚠️ Desconectado de Firebase');
    }
});

// ============================================================
// 🔊 SONIDO - VERSIÓN MEJORADA PARA MÓVILES
// ============================================================

let audioElement = null;
let audioContext = null;
let sonidoInicializado = false;

// Inicializar AudioContext (necesario para móviles)
function initAudioContext() {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        return true;
    } catch (e) {
        console.warn('Error inicializando AudioContext:', e);
        return false;
    }
}

// Cargar archivo de sonido
function getAudioElement() {
    if (audioElement) return audioElement;
    try {
        audioElement = new Audio('sonido.mp3');
        audioElement.preload = 'auto';
        audioElement.load();
        audioElement.volume = 0.8;
        return audioElement;
    } catch (e) {
        console.warn('Error cargando sonido:', e);
        return null;
    }
}

// Activar sonido (se llama al tocar la pantalla)
function activarSonido() {
    if (sonidoInicializado) return;
    
    // Inicializar AudioContext
    initAudioContext();
    
    // Reproducir un "click" silencioso para activar el audio
    try {
        const audio = getAudioElement();
        if (audio) {
            audio.volume = 0.01;
            audio.play().then(() => {
                audio.pause();
                audio.currentTime = 0;
                audio.volume = 0.8;
                sonidoInicializado = true;
                console.log('🔊 Sonido activado correctamente');
            }).catch(e => {
                console.warn('Error activando sonido:', e);
            });
        }
    } catch (e) {
        console.warn('Error en activarSonido:', e);
    }
}

// Reproducir sonido de notificación
function reproducirSonido() {
    if (!sonidoInicializado) {
        // Intentar activar sonido primero
        activarSonido();
        // Esperar un poco y reproducir
        setTimeout(() => {
            reproducirSonidoReal();
        }, 100);
        return;
    }
    reproducirSonidoReal();
}

function reproducirSonidoReal() {
    try {
        // Primero intentar con AudioContext para más control
        if (audioContext && audioContext.state === 'running') {
            // Crear un tono corto como respaldo
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
            
            // Segundo tono
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
        
        // También reproducir el MP3 (más familiar para usuarios)
        const audio = getAudioElement();
        if (audio) {
            audio.currentTime = 0;
            audio.volume = 0.8;
            audio.play().catch(e => console.warn('Error con MP3:', e));
        }
        
        // Vibración para móviles
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100, 50, 200]);
        }
    } catch (e) {
        console.warn('Error en reproducirSonido:', e);
    }
}

// ============================================================
// 📡 FUNCIONES FIREBASE
// ============================================================

function escucharNuevosPedidos(callback) {
    const pedidosRef = database.ref('pedidos');
    pedidosRef.keepSynced(true);
    
    pedidosRef.orderByChild('estado').equalTo('pendiente').on('child_added', function(snapshot) {
        const pedido = snapshot.val();
        const id = parseInt(snapshot.key);
        if (pedido && pedido.estado === 'pendiente') {
            console.log('📦 Nuevo pedido #' + id + ': ' + pedido.descripcion);
            // Reproducir sonido con fuerza
            for (let i = 0; i < 3; i++) {
                setTimeout(() => { reproducirSonido(); }, i * 300);
            }
            callback({ id, ...pedido });
        }
    });
}

function dejarDeEscuchar() {
    database.ref('pedidos').off();
    database.ref('pedidos').keepSynced(false);
}

// ===== USUARIOS =====
async function getUsuarios() {
    try {
        const snapshot = await database.ref('usuarios').once('value');
        const data = snapshot.val();
        if (!data) return [];
        return Object.keys(data).map(key => ({ id: parseInt(key), ...data[key] }));
    } catch (error) {
        console.error('Error:', error);
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

// ===== PEDIDOS =====
async function getPedidos() {
    try {
        const snapshot = await database.ref('pedidos').once('value');
        const data = snapshot.val();
        if (!data) return [];
        return Object.keys(data).map(key => ({ id: parseInt(key), ...data[key] }));
    } catch (error) {
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

// ===== CLIENTES =====
async function getClientes() {
    try {
        const snapshot = await database.ref('clientes').once('value');
        const data = snapshot.val();
        if (!data) return [];
        return Object.keys(data).map(key => ({ id: parseInt(key), ...data[key] }));
    } catch (error) {
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

// ===== LIQUIDACIONES =====
async function getHistorial() {
    try {
        const snapshot = await database.ref('historialLiquidaciones').once('value');
        const data = snapshot.val();
        return data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
    } catch (error) {
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
// 📢 EXPORTAR
// ============================================================

window.firebaseFunctions = {
    escucharNuevosPedidos,
    dejarDeEscuchar: dejarDeEscuchar,
    getUsuarios,
    setUsuario,
    deleteUsuario,
    getPedidos,
    setPedido,
    deletePedido,
    getClientes,
    setCliente,
    deleteCliente,
    getHistorial,
    setHistorial,
    getLiquidacionAdmin,
    setLiquidacionAdmin,
    getNextId,
    crearPedidoConPushup,
    database,
    activarSonido,
    reproducirSonido
};

window.getFirebase = function() {
    return window.firebaseFunctions || null;
};

console.log('🔥 Firebase OK');
console.log('🔊 Sonido preparado');