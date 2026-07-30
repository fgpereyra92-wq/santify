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
// 🔊 SONIDO
// ============================================================

let audioElement = null;
let audioInicializado = false;

function initAudioElement() {
    if (audioElement) return audioElement;
    try {
        audioElement = new Audio('sonido.mp3');
        audioElement.preload = 'auto';
        audioElement.load();
        return audioElement;
    } catch (e) {
        console.warn('Error cargando sonido:', e);
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
                console.log('🔊 Sonido activado');
            }).catch(e => {});
        }
    } catch (e) {}
}

function reproducirSonido() {
    try {
        const audio = initAudioElement();
        if (audio) {
            audio.currentTime = 0;
            audio.volume = 0.8;
            audio.play().catch(e => console.warn('Error reproduciendo:', e));
        }
        if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
    } catch (e) {}
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
            console.log('📦 Nuevo pedido:', pedido.descripcion);
            reproducirSonido();
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