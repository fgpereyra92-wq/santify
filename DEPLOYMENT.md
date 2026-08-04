# 🚀 Guía de Lanzamiento — Deliberisso v1.0

Este documento tiene **todos los pasos necesarios para lanzar hoy**.

---

## PASO 1: Actualizar reglas de seguridad en Firebase Console

**¿Por qué?** Hoy cualquiera puede leer y modificar toda tu base de datos. Esto lo protege.

### Pasos:
1. Abre https://console.firebase.google.com
2. Ve al proyecto `santify-19aee`
3. En el menú izquierdo: **Realtime Database** → pestaña **Rules**
4. **Borra TODO lo que hay ahí** (el contenido actual)
5. Copia el contenido de `FIREBASE_RULES.json` en este repo
6. Clic en **Publish**
7. Espera a que la confirmación diga "Rules updated"

**Qué hace:**
- Público puede leer categorías y ofertas (landing)
- Repartidores solo leen/escriben sus datos
- Admin puede modificar todo

---

## PASO 2: Crear usuario admin en Firebase Auth

**¿Por qué?** Firebase Auth necesita saber quién es admin.

### Pasos:
1. En Firebase Console: **Authentication** (menú izquierdo)
2. Pestaña **Users**
3. Clic en **+ Create user** (esquina superior derecha)
4. Rellena:
   - **Email:** `admin@deliberisso.local`
   - **Password:** `LedZepp1` (misma que `ADMIN_PASSWORD` en app.js)
5. Clic en **Create user**

**Listo.** Ahora el admin se loguea con esa clave en el panel.

---

## PASO 3: Configurar Cloudflare Pages

Cloudflare Pages es donde va a vivir tu sitio (gratis, con CDN global, protección contra ataques, SSL automático).

### Pasos:
1. Abre https://pages.cloudflare.com
2. Clic en **Connect to Git**
3. Autoriza con GitHub
4. Busca el repo `netunlock/santify`
5. Clic en **Begin setup**
6. En la pantalla de configuración:
   - **Framework preset:** Ninguno (es un sitio estático)
   - **Build command:** (vacío)
   - **Build output directory:** (vacío)
   - Clic en **Save and deploy**

**Espera ~3 minutos a que termine el deploy.**

Cloudflare va a crear un dominio temporal como `santify.pages.dev`. Eso es solo para probar — en el siguiente paso vinculamos tu dominio real.

---

## PASO 4: Vincular tu dominio deliberisso.com.ar

El dominio ya lo pagaste en NIC Argentina. Ahora lo conectamos a Cloudflare.

### Pasos:

#### 4A. Cambiar nameservers en NIC Argentina
1. Abre https://nic.ar (tu panel de control)
2. Busca `deliberisso.com.ar`
3. Ve a **DNS** o **Servidores de nombres**
4. Reemplaza los servidores actuales con los de Cloudflare:
   - `lars.ns.cloudflare.com`
   - `rosita.ns.cloudflare.com`
5. Guarda

(Espera 5-10 minutos a que se propague)

#### 4B. Configurar el dominio en Cloudflare Pages
1. Ve a tu proyecto en Cloudflare Pages
2. Pestaña **Custom domains**
3. Clic en **+ Set up a domain**
4. Escribe `deliberisso.com.ar`
5. Clic en **Continue**
6. Confirma que apunta a tu project de Pages
7. Clic en **Activate domain**

**Listo.** En ~10 minutos, `www.deliberisso.com.ar` va a servir tu sitio.

---

## PASO 5: Probar que funciona

### Pruebas:

1. **Landing (público):**
   - Ve a https://www.deliberisso.com.ar
   - Debería ver ofertas y categorías (si ya cargaste alguna en el admin)

2. **Panel Admin:**
   - Ve a https://www.deliberisso.com.ar/admin
   - Login con clave: `LedZepp1`
   - Deberías ver el panel de administración

3. **Panel Repartidores:**
   - Ve a https://www.deliberisso.com.ar/repartidores
   - Necesitas un repartidor registrado (crea uno en la sección Usuarios del admin)
   - Login con email + password

---

## PASO 6: Crear repartidores

Los repartidores se auto-registran (ahora con Firebase Auth).

### Opción A: Crear desde el admin
1. Admin → pestaña **Usuarios** → **+ Nuevo Usuario**
2. Rellena nombre, email, contraseña, vehículo
3. Guarda

### Opción B: Repartidor se auto-registra
(Para eso necesitas agregar un botón de registro en `index.html` — está en `usuarios.html` como ejemplo)

---

## Tabla de URLs finales:

| Rol | URL | Login |
|---|---|---|
| **Público (landing)** | https://www.deliberisso.com.ar | No requiere |
| **Repartidor** | https://www.deliberisso.com.ar/repartidores | Email + Password |
| **Admin** | https://www.deliberisso.com.ar/admin | Clave: `LedZepp1` |

---

## Solucionar problemas

### "Veo blanco en la landing"
- Abre la consola (F12) y mira los errores
- Probablemente Firebase Auth no está inicializado — verifica PASO 2

### "Login de repartidor no funciona"
- Verifica que el usuario existe en Firebase Auth (PASO 2)
- Verifica que tiene un documento en `usuarios/{uid}` en la BD
- Mira la consola para errores

### "El dominio no apunta a Cloudflare"
- Verifica los nameservers en NIC Argentina (PASO 4A)
- Espera ~15-30 minutos a que se propague
- Usa `nslookup deliberisso.com.ar` en terminal para verificar

---

## Siguientes pasos (después de lanzar)

1. **Implementar registro de repartidores** (botón en la landing o en el login)
2. **Agregar foto de perfil** (Firebase Storage, una vez habilitado sin plan Blaze)
3. **Mejorar notificaciones** (Web Push API cuando hay nuevo pedido)
4. **Historial de pedidos** para repartidores
5. **Dashboard de analytics** en admin

---

¿Preguntas? Revisa `CLAUDE.md` para entender la arquitectura.
