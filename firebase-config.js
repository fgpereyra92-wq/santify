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

// Mantener conexión activa SIEMPRE
database.goOnline();

// ============================================================
// ✅ VERIFICAR CONEXIÓN CON RECONEXIÓN AUTOMÁTICA
// ============================================================

let reconectando = false;
let intentosReconexion = 0;

database.ref('.info/connected').on('value', function(snap) {
    if (snap.val() === true) {
        console.log('✅ Conectado a Firebase Realtime Database');
        reconectando = false;
        intentosReconexion = 0;
        // Recargar datos automáticamente al reconectar
        if (window.usuarioActual && window.cargarPedidosUsuario) {
            setTimeout(() => {
                window.cargarPedidosUsuario(window.usuarioActual.id);
            }, 500);
        }
    } else {
        if (!reconectando) {
            reconectando = true;
            console.warn('⚠️ Desconectado de Firebase - Reintentando...');
            // Intentar reconexión cada 3 segundos
            const interval = setInterval(() => {
                if (!reconectando) {
                    clearInterval(interval);
                    return;
                }
                intentosReconexion++;
                console.log(`🔄 Intento de reconexión #${intentosReconexion}`);
                database.goOnline();
                if (intentosReconexion > 10) {
                    clearInterval(interval);
                    console.warn('⚠️ Reintentando reconexión en 30 segundos...');
                    setTimeout(() => {
                        intentosReconexion = 0;
                        database.goOnline();
                    }, 30000);
                }
            }, 3000);
        }
    }
});

// ============================================================
// 🔊 SONIDO CON ARCHIVO MP3
// ============================================================

let audioElement = null;
let sonidoHabilitado = true;
let audioInicializado = false;

function initAudioElement() {
    if (audioElement) return audioElement;
    
    try {
        audioElement = new Audio('sonido.mp3');
        audioElement.preload = 'auto';
        audioElement.load();
        console.log('🔊 Archivo de sonido cargado: sonido.mp3');
        return audioElement;
    } catch (e) {
        console.warn('⚠️ Error cargando archivo de sonido:', e);
        return null;
    }
}

function activarSonido() {
    if (audioInicializado) return;
    
    try {
        const audio = initAudioElement();
        if (audio) {
            audio.volume = 0.1;
            audio.play().then(() => {
                audio.pause();
                audio.currentTime = 0;
                audioInicializado = true;
                console.log('🔊 Sonido activado por interacción del usuario');
            }).catch(e => {
                console.warn('⚠️ Error activando sonido:', e);
            });
        }
    } catch (e) {
        console.warn('⚠️ Error activando sonido:', e);
    }
}

function reproducirSonidoNotificacion() {
    if (!sonidoHabilitado) return;
    
    try {
        const audio = initAudioElement();
        if (!audio) {
            reproducirSonidoFallback();
            return;
        }
        
        audio.currentTime = 0;
        audio.volume = 0.8;
        
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => {
                console.warn('⚠️ Error reproduciendo sonido MP3, usando fallback:', e);
                reproducirSonidoFallback();
            });
        }
        
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100, 50, 200]);
        }
        
    } catch (error) {
        console.warn('⚠️ Error con sonido principal:', error);
        reproducirSonidoFallback();
    }
}

function reproducirSonidoFallback() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.type = 'sine';
        osc1.frequency.value = 880;
        gain1.gain.setValueAtTime(0.3, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.2);
        
        setTimeout(() => {
            try {
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.type = 'sine';
                osc2.frequency.value = 1100;
                gain2.gain.setValueAtTime(0.25, ctx.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
                osc2.start(ctx.currentTime);
                osc2.stop(ctx.currentTime + 0.25);
            } catch (e) {}
        }, 180);
        
    } catch (e) {
        console.warn('⚠️ Fallback de sonido falló:', e);
    }
}

function mostrarNotificacionNavegador(titulo, mensaje) {
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            const notificacion = new Notification(titulo, {
                body: mensaje,
                icon: 'data:image/svg+xml,' + encodeURIComponent(`
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
                        <rect width="100" height="100" rx="20" fill="#ff6b35"/>
                        <text x="50" y="70" font-size="60" text-anchor="middle">📦</text>
                    </svg>
                `),
                silent: false,
                requireInteraction: true,
                vibrate: [200, 100, 200],
                tag: 'nuevo-pedido-' + Date.now()
            });
            
            setTimeout(() => {
                if (notificacion) notificacion.close();
            }, 15000);
            
            return notificacion;
        } catch (e) {
            console.log('Error mostrando notificación:', e);
        }
    } else if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// ============================================================
// 📡 FUNCIONES DE FIREBASE - CON KEEP SYNCED
// ============================================================

function escucharNuevosPedidos(callback) {
    const pedidosRef = database.ref('pedidos');
    pedidosRef.keepSynced(true);
    
    pedidosRef.orderByChild('estado').equalTo('pendiente').on('child_added', function(snapshot) {
        const pedido = snapshot.val();
        const id = parseInt(snapshot.key);
        if (pedido && pedido.estado === 'pendiente') {
            console.log(`📦 Nuevo pedido #${id} detectado: ${pedido.descripcion}`);
            reproducirSonidoNotificacion();
            mostrarNotificacionNavegador('📦 Nuevo Pedido Disponible', 
                `${pedido.descripcion}\n${pedido.origen} → ${pedido.destino}\n💰 $${pedido.pagoRepartidor}`);
            callback({ id, ...pedido });
        }
    });
    
    pedidosRef.on('child_changed', function(snapshot) {
        const pedido = snapshot.val();
        const id = parseInt(snapshot.key);
        if (pedido && pedido.estado === 'pendiente') {
            console.log(`📦 Pedido #${id} actualizado: ${pedido.descripcion}`);
            callback({ id, ...pedido });
        }
    });
    
    console.log('📡 Escuchando pedidos en tiempo real (keepSynced activado)');
}

function dejarDeEscucharNuevosPedidos() {
    database.ref('pedidos').off();
    database.ref('pedidos').keepSynced(false);
}

// ============================================================
// 📦 FUNCIONES CRUD
// ============================================================

async function getUsuarios() {
    try {
        const snapshot = await database.ref('usuarios').once('value');
        const data = snapshot.val();
        if (!data) return [];
        return Object.keys(data).map(key => ({
            id: parseInt(key),
            ...data[key]
        }));
    } catch (error) {
        console.error('Error obteniendo usuarios:', error);
        return [];
    }
}

async function setUsuario(id, usuarioData) {
    try {
        await database.ref(`usuarios/${id}`).set(usuarioData);
        return { id, ...usuarioData };
    } catch (error) {
        console.error('Error guardando usuario:', error);
        throw error;
    }
}

async function deleteUsuario(id) {
    try {
        await database.ref(`usuarios/${id}`).remove();
        return true;
    } catch (error) {
        console.error('Error eliminando usuario:', error);
        throw error;
    }
}

async function getPedidos() {
    try {
        const snapshot = await database.ref('pedidos').once('value');
        const data = snapshot.val();
        if (!data) return [];
        return Object.keys(data).map(key => ({
            id: parseInt(key),
            ...data[key]
        }));
    } catch (error) {
        console.error('Error obteniendo pedidos:', error);
        return [];
    }
}

async function setPedido(id, pedidoData) {
    try {
        await database.ref(`pedidos/${id}`).set(pedidoData);
        return { id, ...pedidoData };
    } catch (error) {
        console.error('Error guardando pedido:', error);
        throw error;
    }
}

async function deletePedido(id) {
    try {
        await database.ref(`pedidos/${id}`).remove();
        return true;
    } catch (error) {
        console.error('Error eliminando pedido:', error);
        throw error;
    }
}

async function getClientes() {
    try {
        const snapshot = await database.ref('clientes').once('value');
        const data = snapshot.val();
        if (!data) return [];
        return Object.keys(data).map(key => ({
            id: parseInt(key),
            ...data[key]
        }));
    } catch (error) {
        console.error('Error obteniendo clientes:', error);
        return [];
    }
}

async function setCliente(id, clienteData) {
    try {
        await database.ref(`clientes/${id}`).set(clienteData);
        return { id, ...clienteData };
    } catch (error) {
        console.error('Error guardando cliente:', error);
        throw error;
    }
}

async function deleteCliente(id) {
    try {
        await database.ref(`clientes/${id}`).remove();
        return true;
    } catch (error) {
        console.error('Error eliminando cliente:', error);
        throw error;
    }
}

async function getHistorialLiquidaciones() {
    try {
        const snapshot = await database.ref('historialLiquidaciones').once('value');
        const data = snapshot.val();
        if (!data) return [];
        return Object.keys(data).map(key => ({
            id: key,
            ...data[key]
        }));
    } catch (error) {
        console.error('Error obteniendo historial:', error);
        return [];
    }
}

async function setHistorialLiquidaciones(historial) {
    try {
        const obj = {};
        historial.forEach((item, index) => {
            obj[index] = item;
        });
        await database.ref('historialLiquidaciones').set(obj);
        return historial;
    } catch (error) {
        console.error('Error guardando historial:', error);
        throw error;
    }
}

async function getLiquidacionAdmin() {
    try {
        const snapshot = await database.ref('liquidacionAdmin').once('value');
        const data = snapshot.val();
        if (!data) return { total: 0, historial: [] };
        return data;
    } catch (error) {
        console.error('Error obteniendo liquidacionAdmin:', error);
        return { total: 0, historial: [] };
    }
}

async function setLiquidacionAdmin(data) {
    try {
        await database.ref('liquidacionAdmin').set(data);
        return data;
    } catch (error) {
        console.error('Error guardando liquidacionAdmin:', error);
        throw error;
    }
}

async function getNextId(refPath) {
    try {
        const snapshot = await database.ref(refPath).once('value');
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

async function crearPedidoConPushup(pedidoData) {
    try {
        const id = await getNextId('pedidos');
        const nuevoPedido = {
            ...pedidoData,
            fechaCreacion: new Date().toISOString(),
            fechaCompletado: null
        };
        await setPedido(id, nuevoPedido);
        console.log(`📦 Nuevo pedido #${id} creado - Notificando a repartidores...`);
        return { id, ...nuevoPedido };
    } catch (error) {
        console.error('Error creando pedido:', error);
        throw error;
    }
}

// ============================================================
// 📢 EXPORTAR FUNCIONES
// ============================================================

window.firebaseFunctions = {
    escucharNuevosPedidos,
    dejarDeEscucharNuevosPedidos,
    getUsuarios,
    setUsuario,
    deleteUsuario,
    getPedidos,
    setPedido,
    deletePedido,
    getClientes,
    setCliente,
    deleteCliente,
    getHistorialLiquidaciones,
    setHistorialLiquidaciones,
    getLiquidacionAdmin,
    setLiquidacionAdmin,
    getNextId,
    crearPedidoConPushup,
    database,
    reproducirSonidoNotificacion,
    activarSonido,
    initAudioElement,
    sonidoHabilitado,
    mostrarNotificacionNavegador
};

// ============================================================
// 🔥 FUNCIÓN GLOBAL PARA ACCEDER A FIREBASE DESDE APP.JS
// ============================================================

window.getFirebase = function() {
    if (typeof window.firebaseFunctions === 'undefined') {
        console.error('❌ Firebase no está cargado');
        return null;
    }
    return window.firebaseFunctions;
};

console.log('🔥 Firebase configurado correctamente');
console.log('📡 Escuchando nuevos pedidos en tiempo real (keepSynced activado)');
console.log('📦 Proyecto: santify-19aee');
console.log('🔊 Sonido: MP3 + Fallback');