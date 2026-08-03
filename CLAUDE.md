# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Deliberisso (rebranded from "Pedidos San" / "Santify" in 2026-08). Sistema de gestión de pedidos/repartos: administración de repartidores (usuarios), clientes, pedidos, liquidaciones de pago y seguimiento GPS en tiempo real, con notificaciones sonoras cuando entra un pedido nuevo. También incluye una landing pública estilo Netflix (`landing.html`) donde los clientes eligen ofertas gastronómicas y piden por WhatsApp directo al local.

**Sobre el nombre**: el Firebase Project ID (`santify-19aee`) y el repo de GitHub (`netunlock/santify`) siguen usando el nombre anterior — son identificadores técnicos inmutables/de bajo riesgo para renombrar, no texto de marca. Todo lo visible para el usuario (títulos, headers, mensajes) ya dice "Deliberisso".

## Commands

There is no build tool, package manager, linter, or test suite in this repo — it's a static HTML/CSS/JS site with no bundler.

- **Run locally**: serve the folder with any static file server (e.g. VS Code "Live Server", or `python -m http.server 8000`) and open `index.html` / `usuarios.html` / `landing.html`. Opening the HTML files directly via `file://` mostly works too, but Firebase Storage CORS is only allowed for `http://localhost:5500`, `http://127.0.0.1:5500`, `http://localhost:8000`, `http://127.0.0.1:8000` (see `cors.json`) — use one of those ports/origins if testing Storage uploads.
- **Deploy**: commit + `git push origin main`. The site is served as static files (GitHub Pages history is visible in past commit messages).
- **Firebase Storage CORS**: `cors.json` is applied to the GCS bucket via `gsutil`/`gcloud`, not through the Firebase console — the console has no CORS UI for Storage.

## Architecture

Multi-page vanilla JS app, no framework/bundler. Three HTML entry points share the same `styles.css`, `firebase-config.js`, and `app.js`:

- `index.html` — combined admin + repartidor (delivery person) login and both dashboards.
- `usuarios.html` — repartidor-only login/panel, a stripped-down copy of the same UI (likely for a dedicated mobile-friendly link).
- `landing.html` — standalone public marketing page with a WhatsApp contact button; self-contained styles, doesn't load `app.js`/`firebase-config.js`.

**Data/backend layer (`firebase-config.js`)**: initializes Firebase (v9 compat SDK loaded from CDN in the HTML `<head>`) against the `santify-19aee` project, Realtime Database + Storage. Exposes every data operation as a single global object `window.firebaseFunctions` (CRUD for `usuarios`, `pedidos`, `clientes`, liquidaciones, plus `escucharNuevosPedidos`/`dejarDeEscuchar` for realtime listeners and the sound helpers). `app.js` never touches `firebase`/`database` directly — it always goes through the `fb()` helper that reads `window.firebaseFunctions`.

**UI/state layer (`app.js`)**: single file, all global state (`usuarioActual`, `usuariosCache`, `pedidosCache`, `clientesCache`, `liquidacionAdmin`, etc.) and all DOM logic (tabs, forms, render functions) live here as top-level functions called via inline `onclick=` handlers in the HTML — there's no component system or event delegation layer.

- **Auth**: not Firebase Auth. Admin login checks the entered password against a hardcoded `ADMIN_PASSWORD` constant in `app.js`. Delivery-person login (`loginUsuario`) fetches all `usuarios` from the Realtime DB and compares the plaintext `password` field client-side. Session state (which role is logged in) is kept in `sessionStorage`, not a DB session.
- **Realtime updates run through two parallel mechanisms**: Firebase `child_added`/`child_changed` listeners (`iniciarEscucha`/`escucharNuevosPedidos`) for push-like updates, plus a polling fallback (`iniciarPollingAdmin`/`iniciarPollingUsuario`, default every 7s) in case listeners miss something. Both need to be considered when changing how pedidos refresh.
- **IDs**: `usuarios`/`pedidos`/`clientes` are keyed by incrementing integers computed by `getNextId()`, which scans existing keys and takes `max + 1` — not an atomic Firebase push ID, so concurrent creates could theoretically collide.
- **GPS**: repartidor location is tracked with `navigator.geolocation.watchPosition` (`iniciarSeguimientoUbicacion`) and rendered on a Leaflet map (`cargarVistaGps`, loaded from CDN) in the admin's GPS tab.
- **Sound notifications**: gated behind explicit user interaction (browser autoplay policy) — a Web Audio oscillator tone plus `sonido.mp3` playback plus vibration only fire after the user has clicked "Activar Sonido" at least once (`activarSonidoManual`/`prepararAudio`).
- `sw.js` is a Service Worker for caching/push notifications that exists in the repo but is **not currently registered** by any page — it's a dormant/unwired feature, not dead code to delete without checking with the user first.

## Repo layout notes

- `datos.json` is local sample/test data, not read by any HTML/JS file, and is gitignored — don't treat it as a source of truth for the live DB.
- `archivado/`, `archivos 2026 07 29/`, and the `*.rar` files are the previous manual-backup workflow (pre-git). They're gitignored; git history is now the source of truth for past versions instead.
- `logos/` holds source/candidate logo images; `logo.png` at the repo root is the one actually referenced by the HTML pages.
