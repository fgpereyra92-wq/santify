// ============================================================
// 🔥 CONFIGURACIÓN DE FIREBASE
// ============================================================
// ¡CAMBIAR ESTOS DATOS CON LOS TUYOS!
// Los obtienes de: Firebase Console → Configuración del proyecto → Tus aplicaciones

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
// ✅ VERIFICAR CONEXIÓN CON FIREBASE
// ============================================================
database.ref('.info/connected').on('value', function(snap) {
    if (snap.val() === true) {
        console.log('✅ Conectado a Firebase Realtime Database');
    } else {
        console.warn('⚠️ Desconectado de Firebase - Reintentando...');
    }
});

// ============================================================
// 📡 FUNCIONES DE FIREBASE CON PUSHUP PARA NUEVOS PEDIDOS
// ============================================================

// Función para escuchar nuevos pedidos en tiempo real (PUSHUP)
function escucharNuevosPedidos(callback) {
    // Escuchar solo pedidos nuevos (pendientes)
    const pedidosRef = database.ref('pedidos');
    
    // Usar 'child_added' para detectar NUEVOS pedidos (no todos)
    pedidosRef.orderByChild('estado').equalTo('pendiente').on('child_added', function(snapshot) {
        const pedido = snapshot.val();
        const id = parseInt(snapshot.key);
        
        // Llamar al callback con el nuevo pedido
        if (pedido && pedido.estado === 'pendiente') {
            callback({ id, ...pedido });
        }
    });
    
    // También escuchar cambios en pedidos existentes (para actualizaciones)
    pedidosRef.on('child_changed', function(snapshot) {
        const pedido = snapshot.val();
        const id = parseInt(snapshot.key);
        if (pedido && pedido.estado === 'pendiente') {
            callback({ id, ...pedido });
        }
    });
}

// Función para dejar de escuchar
function dejarDeEscucharNuevosPedidos() {
    database.ref('pedidos').off();
}

// ============================================================
// 📦 FUNCIONES CRUD PARA FIREBASE
// ============================================================

// Leer todos los usuarios
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
        throw error;
    }
}

// Guardar/Actualizar usuario
async function setUsuario(id, usuarioData) {
    try {
        await database.ref(`usuarios/${id}`).set(usuarioData);
        return { id, ...usuarioData };
    } catch (error) {
        console.error('Error guardando usuario:', error);
        throw error;
    }
}

// Eliminar usuario
async function deleteUsuario(id) {
    try {
        await database.ref(`usuarios/${id}`).remove();
        return true;
    } catch (error) {
        console.error('Error eliminando usuario:', error);
        throw error;
    }
}

// Leer todos los pedidos
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
        throw error;
    }
}

// Guardar/Actualizar pedido
async function setPedido(id, pedidoData) {
    try {
        await database.ref(`pedidos/${id}`).set(pedidoData);
        return { id, ...pedidoData };
    } catch (error) {
        console.error('Error guardando pedido:', error);
        throw error;
    }
}

// Eliminar pedido
async function deletePedido(id) {
    try {
        await database.ref(`pedidos/${id}`).remove();
        return true;
    } catch (error) {
        console.error('Error eliminando pedido:', error);
        throw error;
    }
}

// Leer historial de liquidaciones
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

// Guardar historial de liquidaciones
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

// Leer liquidación del admin
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

// Guardar liquidación del admin
async function setLiquidacionAdmin(data) {
    try {
        await database.ref('liquidacionAdmin').set(data);
        return data;
    } catch (error) {
        console.error('Error guardando liquidacionAdmin:', error);
        throw error;
    }
}

// Obtener próximo ID disponible
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

// ============================================================
// 🚀 FUNCIÓN PARA CREAR PEDIDO CON PUSHUP
// ============================================================

async function crearPedidoConPushup(pedidoData) {
    try {
        const id = await getNextId('pedidos');
        const nuevoPedido = {
            ...pedidoData,
            fechaCreacion: new Date().toISOString(),
            fechaCompletado: null
        };
        await setPedido(id, nuevoPedido);
        
        // Esto activará automáticamente el 'child_added' y notificará a todos los usuarios conectados
        console.log(`📦 Nuevo pedido #${id} creado - Notificando a repartidores...`);
        
        return { id, ...nuevoPedido };
    } catch (error) {
        console.error('Error creando pedido:', error);
        throw error;
    }
}

// ============================================================
// 📢 EXPORTAR FUNCIONES PARA USO EN app.js
// ============================================================

// Hacer las funciones globales para app.js
window.firebaseFunctions = {
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
};

// ============================================================
// 🔥 INICIALIZACIÓN
// ============================================================
console.log('🔥 Firebase configurado correctamente');
console.log('📡 Escuchando nuevos pedidos en tiempo real...');
console.log('📦 Proyecto: santify-19aee');
console.log('🌐 Database URL:', firebaseConfig.databaseURL);