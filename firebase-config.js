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

// ============================================================
// ✅ VERIFICAR CONEXIÓN
// ============================================================

database.ref('.info/connected').on('value', function(snap) {
    if (snap.val() === true) {
        console.log('✅ Conectado a Firebase Realtime Database');
    } else {
        console.warn('⚠️ Desconectado de Firebase - Reintentando...');
    }
});

// ============================================================
// 📡 FUNCIONES DE FIREBASE
// ============================================================

// Escuchar nuevos pedidos
function escucharNuevosPedidos(callback) {
    const pedidosRef = database.ref('pedidos');
    pedidosRef.keepSynced(true);
    
    pedidosRef.orderByChild('estado').equalTo('pendiente').on('child_added', function(snapshot) {
        const pedido = snapshot.val();
        const id = parseInt(snapshot.key);
        if (pedido && pedido.estado === 'pendiente') {
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
    database
};

console.log('🔥 Firebase configurado correctamente');
console.log('📡 Escuchando nuevos pedidos en tiempo real...');
console.log('📦 Proyecto: santify-19aee');