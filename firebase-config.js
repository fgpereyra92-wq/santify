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

// Mantener conexión activa
database.goOnline();

// ============================================================
// ✅ VERIFICAR CONEXIÓN
// ============================================================

let reconectando = false;

database.ref('.info/connected').on('value', function(snap) {
    if (snap.val() === true) {
        console.log('✅ Conectado a Firebase Realtime Database');
        if (reconectando) {
            reconectando = false;
            if (window.usuarioActual) {
                setTimeout(() => {
                    if (window.cargarPedidosUsuario) {
                        window.cargarPedidosUsuario(window.usuarioActual.id);
                    }
                }, 1000);
            }
        }
    } else {
        if (!reconectando) {
            reconectando = true;
            console.warn('⚠️ Desconectado de Firebase - Reintentando...');
            setTimeout(() => {
                database.goOnline();
            }, 5000);
        }
    }
});

// ============================================================
// 🔊 SONIDO MEJORADO PARA MÓVILES
// ============================================================

let audioContext = null;
let sonidoHabilitado = true;

function initAudio() {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        return true;
    } catch (e) {
        console.warn('⚠️ Error con audio:', e);
        return false;
    }
}

function reproducirSonidoNotificacion() {
    if (!sonidoHabilitado) return;
    
    try {
        if (!audioContext || audioContext.state === 'suspended') {
            initAudio();
        }
        
        if (!audioContext) return;
        
        // Sonido 1: Tono principal (880Hz)
        const osc1 = audioContext.createOscillator();
        const gain1 = audioContext.createGain();
        osc1.connect(gain1);
        gain1.connect(audioContext.destination);
        osc1.type = 'sine';
        osc1.frequency.value = 880;
        gain1.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
        osc1.start(audioContext.currentTime);
        osc1.stop(audioContext.currentTime + 0.2);
        
        // Sonido 2: Tono más agudo (1100Hz) - "ding dong"
        setTimeout(() => {
            try {
                const osc2 = audioContext.createOscillator();
                const gain2 = audioContext.createGain();
                osc2.connect(gain2);
                gain2.connect(audioContext.destination);
                osc2.type = 'sine';
                osc2.frequency.value = 1100;
                gain2.gain.setValueAtTime(0.25, audioContext.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.25);
                osc2.start(audioContext.currentTime);
                osc2.stop(audioContext.currentTime + 0.25);
            } catch (e) {}
        }, 180);
        
        // Vibración para móviles
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100, 50, 200]);
        }
        
    } catch (error) {
        console.warn('⚠️ Error reproduciendo sonido:', error);
    }
}

function activarSonido() {
    initAudio();
    try {
        if (audioContext) {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.frequency.value = 440;
            gain.gain.setValueAtTime(0.1, audioContext.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05);
            osc.start(audioContext.currentTime);
            osc.stop(audioContext.currentTime + 0.05);
        }
    } catch (e) {}
}

// ============================================================
// 📡 FUNCIONES DE FIREBASE
// ============================================================

function escucharNuevosPedidos(callback) {
    const pedidosRef = database.ref('pedidos');
    pedidosRef.keepSynced(true);
    
    pedidosRef.orderByChild('estado').equalTo('pendiente').on('child_added', function(snapshot) {
        const pedido = snapshot.val();
        const id = parseInt(snapshot.key);
        if (pedido && pedido.estado === 'pendiente') {
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
            callback({ id, ...pedido });
        }
    });
}

function dejarDeEscucharNuevosPedidos() {
    database.ref('pedidos').off();
}

// ===== USUARIOS =====
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

// ===== PEDIDOS =====
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

// ===== CLIENTES =====
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

// ===== HISTORIAL LIQUIDACIONES =====
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

// ===== LIQUIDACIÓN ADMIN =====
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

// ===== OBTENER PRÓXIMO ID =====
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

// ===== CREAR PEDIDO CON PUSHUP =====
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
// 📢 NOTIFICACIONES DEL NAVEGADOR
// ============================================================

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
    initAudio,
    sonidoHabilitado
};

console.log('🔥 Firebase configurado correctamente');
console.log('📡 Escuchando nuevos pedidos en tiempo real...');
console.log('📦 Proyecto: santify-19aee');
console.log('🔊 Sonido de notificaciones activado');