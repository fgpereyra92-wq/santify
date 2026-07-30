// ============================================================
// ===== PUSHUP - NOTIFICACIONES MEJORADAS =====
// ============================================================

// Variable para controlar notificaciones duplicadas
let ultimaNotificacionId = null;
let timeoutNotificacion = null;

function mostrarAlertaPedidoNuevoMejorado(pedido) {
    const fb = getFirebase();
    if (fb && fb.reproducirSonidoNotificacion) {
        // Reproducir sonido 2 veces para asegurar
        fb.reproducirSonidoNotificacion();
        setTimeout(() => {
            if (fb.reproducirSonidoNotificacion) fb.reproducirSonidoNotificacion();
        }, 400);
    }
    
    // Evitar duplicados
    if (ultimaNotificacionId === pedido.id) {
        console.log('⏭️ Notificación duplicada ignorada');
        return;
    }
    ultimaNotificacionId = pedido.id;
    
    // Limpiar timeout anterior
    if (timeoutNotificacion) {
        clearTimeout(timeoutNotificacion);
        timeoutNotificacion = null;
    }
    
    // Eliminar alertas anteriores
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
    
    // Auto-cerrar después de 15 segundos
    timeoutNotificacion = setTimeout(() => {
        if (alerta.parentNode) alerta.remove();
        timeoutNotificacion = null;
    }, 15000);
}

function iniciarEscuchaPushup() {
    const fb = getFirebase();
    if (!fb) {
        console.error('❌ Firebase no disponible para pushup');
        // Reintentar después de 2 segundos
        setTimeout(iniciarEscuchaPushup, 2000);
        return;
    }
    
    console.log('📡 Iniciando escucha de nuevos pedidos (keepSynced activado)...');
    
    // Activar sonido al iniciar
    activarSonidoGlobal();
    
    fb.escucharNuevosPedidos(function(nuevoPedido) {
        console.log(`📦 Nuevo pedido #${nuevoPedido.id} detectado en tiempo real:`, nuevoPedido.descripcion);
        
        if (ultimoPedidoPendiente === null || nuevoPedido.id !== ultimoPedidoPendiente.id) {
            ultimoPedidoPendiente = nuevoPedido;
            
            // Reproducir sonido
            if (fb.reproducirSonidoNotificacion) {
                fb.reproducirSonidoNotificacion();
                setTimeout(() => {
                    if (fb.reproducirSonidoNotificacion) fb.reproducirSonidoNotificacion();
                }, 400);
            }
            
            // Notificación del navegador
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
            
            // Alerta visual mejorada
            mostrarAlertaPedidoNuevoMejorado(nuevoPedido);
            
            // Recargar pedidos
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
    const fb = getFirebase();
    if (fb && fb.activarSonido) {
        fb.activarSonido();
        // Intentar reproducir sonido de prueba
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

// Detectar interacción del usuario para activar sonido
document.addEventListener('click', function() {
    activarSonidoGlobal();
});
document.addEventListener('touchstart', function() {
    activarSonidoGlobal();
});

function activarSonidoGlobal() {
    const fb = getFirebase();
    if (fb && fb.activarSonido && !window.sonidoActivado) {
        fb.activarSonido();
        window.sonidoActivado = true;
        console.log('🔊 Sonido activado por interacción del usuario');
    }
}