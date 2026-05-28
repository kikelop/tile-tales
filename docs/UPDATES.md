# Tile Tales - Log de Actualizaciones

## 2026-05-28 — F8: vaciar el backlog viable (map polish + location editor + dark modales + backup)

Misma sesion que F7. "Tirar con todo lo pendiente" antes de una auditoria del usuario. Se cierran los items del backlog que NO estan bloqueados (iOS necesita Xcode, Supabase es multi-sesion, el scan esta pospuesto a nativo). Build verde, **19/19 tests** (5 nuevos), deploy manual a prod.

### Map polish (AUDIT seccion 6)
`TileMap.tsx` reescrito:
- **Filtro por tags**: barra de chips abajo, solo los tags presentes en tiles geolocalizadas. `activeTag` filtra los markers.
- **Boton "mi ubicacion"**: flotante abajo-derecha, `requestGeolocation()` → `map.flyTo([lat,lng], 13)`. Spinner mientras pide, toast si falla. Usa `mapRef` (ref de MapContainer en react-leaflet v5).
- **Dark mode real del mapa**: basemap carto `dark_all` vs `light_all` segun tema (key fuerza remount del TileLayer al cambiar), header + chips theme-aware via MutationObserver sobre `data-theme`. Antes el header iba hardcoded claro sobre el mapa.
- **Clustering (6.1) pospuesto a proposito**: react-leaflet v5 no tiene wrapper de markercluster mantenido; meterlo a mano es fragil. Documentado, no hecho.

### Location editor (AUDIT 1.x / pendientes)
- `geo.ts` `trimDisplayName`: el `display_name` de Nominatim ("Lisboa, Área Metropolitana de Lisboa, Portugal, Europa…") se reduce a "primer segmento, pais" → "Lisboa, Portugal" en los resultados de busqueda. Los de 2 segmentos quedan intactos (el test existente sigue verde).
- Feedback visual en la fila de localizacion del modal de edit: fondo/borde verde suave + pin relleno cuando hay ubicacion (con transicion 0.25s), y "lat, lng · naming…" mientras el reverse geocode resuelve el nombre.

### Dark mode en popovers/modales
Nuevas vars en `globals.css`: `--tt-popover-bg`, `--tt-popover-divider`, `--tt-input-bg`, `--tt-input-border` (light + dark). Aplicadas a:
- Sort menu + Add menu de TileGrid (eran `#fff` fijo → se veian como parche blanco en dark).
- Modal de crear album (Albums.tsx).
- CropModal se deja negro a proposito. El modal de edit del viewer y WallpaperGenerator quedan PENDIENTES (superficies grandes, pasada propia — anotado en CLAUDE.md).

### Export / Import backup (AUDIT alta prioridad)
- `lib/backup.ts` con `jszip` dynamic-imported (patron de exifr). `exportCollection()` → ZIP con `collection.json` (manifest v1: tiles + albums) + `blobs/<id>` por cada tile capturado (`isIdbRef`); los samples van por path y no se empaquetan. `importCollection(file)` → escribe los blobs de vuelta a IDB y mergea metadata.
- `store.importData({tiles, albums})`: merge por id, salta los ya existentes (idempotente). Tiles capturados cuyo blob no esta en el ZIP se descartan (renderizarian roto).
- UI en la pantalla de Stats, seccion "Backup": Export (descarga `tile-tales-backup-YYYY-MM-DD.zip`) + Import (file input `.zip`), con toasts de conteo.
- Tests: `backup.test.ts` (round-trip del manifest, merge de sample tiles, skip de ghost-blob, rechazo de ZIP sin manifest) + `store.test.ts` (importData dedup + idempotencia).

### Estado del backlog tras F8
Vivo y no bloqueado: picker en mini-mapa (opcional), dark mode del edit sheet + WallpaperGenerator (+ split TileEditSheet, hacer juntos), clustering del mapa. Bloqueado: iOS (Xcode), Supabase (scope grande), scan (nativo).

## 2026-05-28 — F7: cierre de Sprint 3 (multi-import + stats + deep linking)

Commit `e37c586`. Los tres items que faltaban del Sprint 3 del AUDIT (Albums y Dark mode ya se hicieron en F6). Con esto **Sprint 3 queda completo**. Build verde, 14/14 tests, deploy manual a prod (`app-five-xi-20.vercel.app`).

### Import multiple
`lib/useCaptureTile.ts` pasa de imagen única a una **cola** de `QueueItem[]` (`{ url, geo }`). `handleCapture` lee `e.target.files` completo y encola un item por foto, cada uno con su `readGeoForCapture` (EXIF para galeria, GPS para camara) ya en vuelo. `pendingImage = queue[0]?.url`. Un `queueRef` espeja la cola para que `handleCropConfirm` lea el geo del head sin closure stale. `dropHead` revoca el object URL del head y hace `slice(1)`. Cancel = skip del item actual (avanza la cola), no cancela el lote entero.
- El `<input>` de galeria (en `page.tsx` y `TileViewer3D.tsx`) lleva `multiple`. El de camara sigue single (`capture`).
- `CropModal` recibe `queueCount`: pill "N photos left" arriba del crop + boton Cancel→**Skip** cuando hay lote. Cada guardado toasta "Tile saved · N left" (o "Tile saved" si es el ultimo).

### Stats screen
`components/StatsView.tsx`, pantalla nueva. Se abre desde el **contador de tiles del header del grid**, que ahora es un boton (con glifo de barras) — sin añadir clutter a la bottom bar. Contenido:
- Hero: total + "N captured by you" (cuenta de `isIdbRef`).
- Cards: Favorites / Located / Countries / Albums.
- Top tags: barras horizontales normalizadas al tag mas usado.
- Places: desglose "City, Country → count". Resuelto con `usePlaceLabels`, que siembra del cache de `reverseGeocode` (sync, sin request) y rellena los que falten **secuencialmente** en un effect para respetar el rate limit ~1req/s de Nominatim. La seccion muestra "loading…" mientras quedan coords sin resolver.

### Deep linking
Hash routing en `page.tsx`. `screenToHash`/`hashToScreen` mapean el `Screen` interno a `#/`, `#/tile/3`, `#/wallpaper`, `#/map`, `#/albums`, `#/album/<id>`, `#/stats`. Dos effects:
- `popstate` → `setScreen(hashToScreen(hash))` con flag `skipPush` para no re-empujar.
- cambio de `screen` → `pushState` del hash, salvo si vino de popstate. La primera nav real usa `replaceState` (ref `initialNav`) para que el back desde el grid salga limpio en vez de quedarse en bucle.
- El splash, al terminar, navega a `hashToScreen(location.hash)` en vez de forzar grid → un link a `#/tile/2` abre ese tile tras el splash.
- Caveat: el indice del viewer es posicional, no estable si cambian los tiles. Aceptable para back/share.

### Lint
Los 6 errors siguen siendo preexistentes (`set-state-in-effect` en CropModal/TileViewer3D + immutability R3F en refs). Los archivos nuevos solo añaden los warnings habituales de floating-promise, marcados con `void`.

## 2026-03-31 — Setup inicial del proyecto
- Creada estructura de carpetas del proyecto en `/Documents/tile-tales/`
- Archivos de contexto: CLAUDE.md, PROJECT.md, UPDATES.md, DECISIONS.md, ROADMAP.md, REFERENCES.md
- Copiadas 16 capturas de referencia visual a `/references/` con nombres descriptivos
- Definida vision inicial: app de coleccion de azulejos con galeria 3D
- Stack propuesto: Next.js + Three.js/R3F + Tailwind + Supabase
- Inicializado repositorio git
- Inicializado Next.js 16 con dependencias (Three.js, R3F, Drei, Framer Motion)
- Galeria basica con cards 3D y datos mock
- Visor 3D de azulejo individual en /viewer

## 2026-03-31 — Visor 3D iterado
- Azulejo con grosor ceramico, textura en cara superior
- Rotacion libre con drag (quaternions, sin gimbal lock)
- Auto-rotacion sutil en Z + wobble en X/Y + flotacion
- Inercia al soltar (flick)
- Zoom con scroll (desktop) y pinch (mobile)
- Responsive: camara adaptativa segun aspect ratio
- 4 texturas de azulejos reales como samples
- Desplegado en Vercel (URL fija de produccion)

## 2026-04-10 — Captura de fotos + Crop + Memory
- Boton de camara: abre camara trasera en mobile, file picker en desktop
- Crop modal: recorte cuadrado con drag, zoom (sliders + pinch), rotacion fina (-10/+10)
- Tile 3D con ExtrudeGeometry (bordes redondeados) + material array (top=textura, bottom=memory, sides=borde)
- UVs corregidas para mapeo correcto de texturas en caps
- Feature "Write a memory": editor de texto con tipografia Caveat, renderizado como textura canvas en la cara trasera del azulejo
- URL de produccion fija: https://app-five-xi-20.vercel.app/viewer

## 2026-04-10 — Refinamientos 3D + Texturas custom
- Tile 3D reconstruido: ExtrudeGeometry (bordes redondeados) + planes separados para cada cara
- Texturas custom por cara: square.png (trasera), side1-4.png (laterales), tile texture (frontal)
- UVs corregidas para caps (top/bottom) mapeando coordenadas XZ a 0..1
- Z-fighting resuelto con offset 0.001 en planes laterales
- Texto memory adaptativo: 110px max, 64px min, word wrap, color #5a5248
- Fecha en esquina inferior derecha con color #8a8278
- Fondo trasero usa square.png como textura ceramica con texto renderizado encima
- Laterales con color solido #e2ddd6 de base + planes con texturas side1-4.png encima
- Crop modal mejorado: rotacion fina (-10/+10, step 0.05), zoom con slider eliminado
- Pinch zoom en mobile con native touch events
- Camera adaptativa: Y=0.6 en portrait para centrar mejor

## 2026-04-12 — PWA + Optimizaciones
- Manifest.json para PWA instalable (standalone, off-white theme)
- Service worker con cache-first para imagenes (.webp, .png)
- Imagenes optimizadas a WebP (32MB → 720KB)

## 2026-04-12 — Geolocalizacion + Compartir + iOS + Auditoria
- Geolocalizacion automatica: al capturar foto se solicita permiso de ubicacion
- lat/lng se guardan automaticamente en el tile nuevo
- Funciona en ambos flujos de captura (grid y viewer)
- Boton de compartir en viewer 3D (entre favorito y editar)
- Genera share card: imagen del tile con nombre, ubicacion/fecha y watermark "Tile Tales"
- Web Share API en mobile (con archivo), descarga directa en desktop
- App iOS nativa creada en `ios/TileTales/` (SwiftUI + SceneKit + MapKit, 15 archivos)
  - Grid, viewer 3D, mapa, wallpaper, edit sheet, share, camara, geolocalizacion
  - Pendiente de build: necesita Xcode (usuario no tiene macOS actualizado)
- Auditoria UX/UI completa en `docs/AUDIT.md`
  - 30 mejoras propuestas con impacto y complejidad
  - 16 features nuevas (alta/media/baja prioridad)
  - 4 sprints de implementacion
- Desplegado en prod: commit `13a48ce`
- **Nota**: Geolocalizacion no verificada en prod — revisar en proxima sesion

## 2026-05-19 — Scan de documento: intentado en web, descartado, pospuesto a app nativa

Sesion larga de prueba, debug y revert. Cronologia:

1. **Infra previa**: arreglado `next.config.ts` con `turbopack.root` (lockfile huerfano en `~/`), `vercel.json` raiz borrado (`rootDirectory` deprecado en schema actual), proyecto re-linkeado al deployment `app` de Vercel (URL real `app-five-xi-20.vercel.app`, no `app-rho-seven-17` como decia el CLAUDE.md viejo). Vercel git integration nativa no estaba disparando — deploy manual con `vercel --prod --yes` desde `app/`. Colores de fondo revertidos al canonico `#f5f2ed` en `globals.css`, `SplashScreen`, `TileGrid`, `TileViewer3D` (eran restos de pushes de prueba rojo/azul/rosa).

2. **Intento 1 — ScanModal sobre foto nativa** (commit `c4d17ea`): `+ take photo` → input file capture environment → ScanModal con OpenCV.js → auto-deteccion (Canny + findContours + approxPolyDP) + 4 esquinas arrastrables + lupa + warp perspectivo a 1024x1024. **No cargaba en la PWA**: spinner "Loading scanner..." infinito.

3. **Bug raiz identificado**: el service worker (`app/public/sw.js`) interceptaba TODAS las requests, incluido el `<script>` cross-origin a `docs.opencv.org/4.10.0/opencv.js`. En iOS PWA standalone esto tainta la respuesta y el script no ejecuta — `script.onload` dispara pero `window.cv` queda undefined para siempre. Fix: el SW ahora hace `if (url.origin !== self.location.origin) return;` antes de cualquier `event.respondWith`. Cache name bumped a `v2` para forzar activacion limpia. Util mas alla del scanner, se queda.

4. **Intento 2 — CameraScanner live** (commit `0db1673`): a peticion del user para que el modo scanner SEA la camara, no un paso posterior. Componente con `getUserMedia({ facingMode: environment })`, `<video>` fullscreen, overlay SVG con quad detectado en realtime cada 200ms, shutter freeze + 4 esquinas ajustables + warp. **No funciona en PWA iOS standalone**: tras un par de iteraciones (display:none video, dimensiones cero, error reporting, panel de debug en pantalla), el log mostro `mediaDevices: true` → `calling getUserMedia...` → silencio total. La camara se enciende fisicamente (LED rojo + indicador de grabacion en status bar de iOS) pero la Promise de `getUserMedia` NUNCA resuelve ni rechaza. **WebKit bloquea silenciosamente** el stream a PWAs standalone. Sin workaround a nivel JS. Confirmado con panel de debug verde renderizado encima del modal.

5. **Revert** (commit `0d39660`): flujo vuelve a como estaba antes del experimento — `+ take photo` y `+ choose from library` → input file → CropModal (cuadrado, zoom, rotacion fina) → 3D viewer. Sin ScanModal, sin CameraScanner. Ambos componentes borrados del repo, recuperables desde git history. El fix del service worker se queda.

**Scan pospuesto a la app nativa iOS** (`ios/TileTales/`) cuando se retome. Stack natural alli: SwiftUI + Vision `VNDetectRectanglesRequest` + Core Image `CIPerspectiveCorrection`. Sin las limitaciones de PWA WebKit.

**Otros cleanup de la sesion**:
- Borrado `vercel.json` huerfano del repo raiz (`rootDirectory` no valido en schema actual)
- URL prod canonica = `https://app-five-xi-20.vercel.app` (corregida en CLAUDE.md, antes apuntaba a una URL desconectada)
- Service worker v2 con skip cross-origin (mejora general)

## 2026-05-19 (tarde) — Geo bug cerrado + Sprint 1 quick wins + Location editor

Tres commits, todo live en prod tras dos deploys (`vercel --prod --yes` desde `app/`).

### Commit 1 — `8c287bd` Geo race + Sprint 1
- **Geo race condition**: `pendingGeo` guardaba el resultado resuelto de `getCurrentPosition`, no la Promise. Si el usuario confirmaba el crop antes de que el GPS respondiera (lo habitual con `enableHighAccuracy: true` que tarda varios segundos en iOS), el tile se guardaba sin lat/lng silenciosamente. Esto explica el "no lo vi funcionar en prod" arrastrado desde el 12 de abril. Fix: guardar la Promise; en `handleCropConfirm` se hace `addTile` inmediato y se patchea con `updateTile(id, { lat, lng })` cuando la Promise resuelve. Sin bloquear el cierre del modal.
- **Sprint 1 (AUDIT)**: contador de tiles en header del grid, hint "Drag to flip" al primer abrir del viewer (gated por `localStorage`), doble tap → slerp a rotacion frontal (0.4s easeOutCubic), Toast global + haptic helpers cableados en favorite/share/save/delete.
- Nuevos: `lib/haptic.ts`, `lib/toast.ts`, `components/Toaster.tsx`.

### Commit 2 — `12b5419` EXIF para galeria + location editor
- **Galeria lee EXIF GPS** con `exifr` (~10KB gzipped, dynamic import). Si la foto trae GPS embebido, se respeta. Si no, en este commit caia a `getCurrentPosition` como fallback — comportamiento corregido en el siguiente commit.
- **Editor de localizacion en el modal del lapiz**: display de coords actuales o "No location" + boton "Use my current location" + Clear.
- Refactor: `requestGeolocation`, `readExifGps`, `readGeoForCapture` extraidos a `lib/geo.ts`. Inputs usan `data-source="camera"|"gallery"` para que un solo handler decida la fuente.

### Commit 3 — `9bfd43f` Place search + galeria sin fallback
- **Galeria sin EXIF ya no cae a la ubicacion actual**. El comportamiento previo metia Madrid sobre fotos viejas de Portugal subidas desde la camera roll. Ahora el tile queda sin geo y el editor lo permite anadir despues.
- **Buscador Nominatim** en el editor: input "Search a place" con debounce 400ms y AbortController. Resultados de OpenStreetMap (sin API key), tap selecciona y guarda. Cubre el caso "estoy en Madrid pero la foto es de Lisboa".

### Anecdotas operativas
- **Deploy debe lanzarse desde `app/`**, no desde la raiz `tile-tales/`. Vercel CLI usa el cwd para decidir que sube. Lanzado desde la raiz, la build remota no encuentra `tsconfig.json` y Next regenera uno sin el alias `@/`. El error sale como `Cannot find module '@/components/Toaster'` aunque local compile. Confirmado en esta sesion: el primer deploy fallo, repetido desde `app/` paso. CLAUDE.md ya lo mencionaba — vale la pena recordarlo aqui.
- Al instalar `exifr` me confundi de cwd y cree `package.json`/`package-lock.json`/`node_modules/` huerfanos en `tile-tales/` (raiz del repo). Limpiados antes del commit del EXIF.

### UX del location editor — retocar despues
Funciona pero el usuario marco que la UX "no es lo mejor". Pendientes para proxima iteracion:
- Truncar `display_name` de Nominatim (suele venir muy verboso). → parcial: hoy `reverseGeocode` ya construye "City, Country" con `addressdetails`, mucho mas limpio. `searchPlaces` sigue devolviendo `display_name` raw.
- Considerar picker en mini-mapa como alternativa al buscador.
- Transicion visual mas clara entre "Use my location" y el resultado.

## 2026-05-19 (noche) — Fix critico: persistencia de tiles capturados (IDB)

Commit `bf1dc32`. Bug grave detectado por el usuario via captura: al cerrar y reabrir la PWA, **todos los tiles que el usuario habia anadido aparecian como imagenes rotas**. Solo los 14 mocks de `/public/tiles/*.webp` sobrevivian. Bug original del proyecto, lleva ahi desde el dia 1.

### Causa raiz
`CropModal` devolvia `URL.createObjectURL(blob)` y el `addTile` guardaba ese URL en `tile.file`, que iba a localStorage tal cual:
```js
addTile({ file: "blob:https://app-five-xi-20.vercel.app/abc-123", ... });
```
Los blob URLs son validos **solo durante la sesion del documento que los creo**. Al recargar (o cerrar/reabrir la PWA), apuntan a nada → imagen rota. La data binaria nunca se persistia, solo la referencia volatil.

### Solucion: IndexedDB para los blobs
- `lib/blob-storage.ts` — wrapper IDB con `saveTileBlob`, `loadTileBlob`, `deleteTileBlob`, `getTileBlobUrl` (con cache en memoria de object URLs). DB `tile-tales`, store `tile-blobs`.
- `lib/useTileFileUrl.ts` — hook React que resuelve `tile.file`. Si empieza por `idb:` carga async desde IDB; si no, lo devuelve tal cual (compatibilidad con los mocks `/tiles/*.webp`).
- `CropModal` cambia su contrato: `onConfirm` ahora recibe un `Blob`, no un URL. El caller decide como persistir.
- `handleCropConfirm` en `page.tsx` y `TileViewer3D.tsx`: `saveTileBlob(id, blob)` primero, luego `addTile({ file: "idb:<id>" })`.
- Todos los renders consumen el hook: `TileGrid` (sub-componente `TileThumb`), `TileMap` (sub-componente `TileMarker`), `TileViewer3D` (preload + Scene activo + thumbnails selector + share card), `WallpaperGenerator` (selector + image loader Promise.all).
- `deleteTile` ahora tambien borra el blob de IDB si era un tile custom.

### Migration de tiles rotos
`loadState` ahora filtra cualquier tile con `file.startsWith("blob:")`. La data binaria de esos tiles esta perdida para siempre — el usuario tendra que re-capturarlos. La purga es silenciosa; el siguiente cambio de estado persiste el localStorage limpio.

### Notas operativas
- Es la primera vez que tocamos IDB en este proyecto. Mantenemos localStorage para los tiles array y wallpapers (compactos, JSON-friendly) y reservamos IDB para los blobs (pesados).
- `getTileBlobUrl` cachea object URLs en un `Map<id, string>` para no crear uno por render. `revokeTileBlobUrl` esta exportado para futuras limpiezas si la cache crece demasiado, aunque ahora mismo no se llama (los URLs viven mientras la app este abierta).
- `useTexture.preload` ahora solo se llama con URLs reales (await get blob URL primero).

## 2026-05-19 (cierre) — Reverse geocoding

Commit `f128924`. Sprint 2 ítem #3 del AUDIT.

`lib/geo.ts` adquiere `reverseGeocode(lat, lng)` que hace `nominatim.openstreetmap.org/reverse?addressdetails=1` y construye el label como `address.city || town || village || hamlet || suburb || county || state` + `address.country` — mucho mas limpio que el `display_name` verboso. Cache en localStorage keyed por coords redondeadas a 4 decimales (~11m, suficiente para que tiles del mismo barrio compartan request). Dedup de in-flight via `Map<key, Promise>`.

`lib/useReverseGeocode.ts` es el hook React: devuelve sync el valor cacheado, debounce 250ms para nuevos lookups, abort on unmount. Cableado en:
- Location editor del modal del lapiz (display de coords reemplazado por label).
- TileMap popup (label como subtitulo bajo el nombre).
- Share card subtitle.

## 2026-05-20 — Sesion maraton: 6 fases (deuda + Sprint 2 restante + tests + refactor + Sprint 3 selecto)

Tras una planificacion con `/Users/enriquelopezdeandres/.claude/plans/quiero-que-hagas-un-wondrous-wilkinson.md` (3 Explore agents auditando codigo / infra / gap features + 1 Plan agent validando el orden), se ejecutaron 6 commits secuenciales en `main`. Cada fase termina con build + deploy + push.

### F1 `c6927ee` — Saneamiento tecnico
- `lib/useCaptureTile.ts` extrae `handleCapture` + `handleCropConfirm` + `handleCropCancel` duplicados en `page.tsx` y `TileViewer3D.tsx`. `try/finally` asegura revoke del `pendingImage` aunque `saveTileBlob` falle. `afterAdd` callback lee `getState()` fresco para saltar al nuevo tile sin closure stale.
- `TileViewer3D` preload usa `useRef<Set<string>>` para no re-precargar todas las texturas en cada `toggleFavorite` / `updateTile`.
- `blob-storage` lanza `STORAGE_FAILURE_EVENT` cuando IDB no esta disponible (Safari privado, bloqueado). Toaster lo captura y avisa una sola vez por sesion. `getTileBlobUrl` ahora limpia `pendingUrls` en `finally` para no acumular Maps muertas en reject.
- `store.loadState()` ahora devuelve `purgedCount`. `getInitialPurgedCount()` lo expone. Toaster lo lee al mount y dispara "Cleaned up N broken tile(s)" 800ms despues si > 0.
- `generateTileId()` pasa a `crypto.randomUUID()` (con fallback a Date.now+random) para evitar colisiones con blobs huerfanos en IDB.
- `lib/geo.ts` introduce `fetchWithTimeout` (5s) usado en reverseGeocode + searchPlaces — un Nominatim caido o lento ya no congela el editor.
- Delete tile ahora tambien revoca el object URL cacheado.

### F2 `ad305f1` — Sprint 2 restante (busqueda + sort + swipe + presets duotono)
- TileGrid: header con boton Search (reveal input filtra por name/tags) + Sort menu (Recent / A–Z / Favorites first, persiste en localStorage `tile-tales-sort`). Scroll resetea al top en cualquier cambio de filter/search/sort.
- TileViewer3D / RotatableTile: swipe horizontal entre tiles. Los primeros ~8px de cualquier pointer bloquean intent como `rotate` o `swipe`. Swipe > 60px dispara prev/next + haptic.
- WallpaperGenerator: chips de presets duotono (Ocean / Sunset / Forest / Vintage / Noir) con preview circular bicolor. Tap aplica los dos colores; preset activo si dark+light coinciden.

### F3 `88f2f3b` — UX gaps + infra leve
- Onboarding banner en el grid cuando no hay tiles custom todavia (gated por localStorage `tile-tales-onboarding-dismissed`).
- Tap sin drag/swipe en el canvas del viewer toggla `autoRotatePaused` ref. Tracked durante pointerUp + touchEnd + tras slerp para respetar la pausa de manera consistente.
- manifest.json: `scope`, `display_override`, `orientation`, `categories`.
- SW cache name bumped `v2` → `v3` para forzar update en PWAs instaladas.
- ESLint: añadidas reglas type-aware `no-floating-promises` + `no-misused-promises` como warning. Hooks `useTileFileUrl` y `useReverseGeocode` opt-out de `set-state-in-effect` (limpiar state on input change ES su proposito).

### F4 `e4b9903` — Vitest MVP
Setup: `vitest` + `@vitejs/plugin-react` + `@testing-library/react` + `jsdom` + `fake-indexeddb`. `URL.createObjectURL` stubbed en `test-setup.ts` porque jsdom 29 no lo implementa para Blobs. `afterEach` limpia DOM + localStorage.

14 tests:
- `blob-storage`: roundtrip, delete, URL cache, missing-blob null, helpers ref.
- `geo`: reverseGeocode cache + dedup + null en empty, searchPlaces short-circuit + result mapping.
- `store`: loadState filtra dead blob URLs + reporta `purgedCount`, generateTileId unico en 100 iteraciones.
- `useTileFileUrl`: sync para mocks, async para `idb:*`.

Scripts: `npm run test` (watch) / `npm run test:run` (CI).

### F5 `6bdefc2` — Refactor split de TileViewer3D
TileViewer3D pasa de 1632 a 994 lineas. Extraidos a `components/viewer/`:
- `TileScene.tsx` (default export Scene + helpers: useTextTexture, TileMesh, RotatableTile, AdaptiveCamera).
- `SelectorThumb.tsx` (la thumbnail del strip inferior).
- `FlipHint.tsx` (la pill animada con prop `visible`).

El modal de edit se queda en TileViewer3D (state densamente acoplado al outer) — futuro split.

### F6 `8e5b369` — Dark mode + Collections (Sprint 3 selecto)
**Dark mode**:
- `globals.css`: variables `--tt-*` para los dos modos. `:root` (light) + `:root[data-theme="dark"]`.
- `lib/theme.ts`: getStoredTheme / systemTheme / getActiveTheme / setTheme + subscribers (no usados aun).
- Inline boot script en `layout.tsx` setea `data-theme` antes del render para no flashear. `theme-color` meta media-aware para iOS status bar.
- Toggle sun/moon en el header del grid. Canvas 3D usa MutationObserver sobre `documentElement[data-theme]` para re-tintar bg cuando el usuario toggla.
- Wired: grid outer + chips + bottom bar + buttons + onboarding banner + filter chips. Viewer outer + canvas bg + map outer. Modales / popovers / WallpaperGenerator / CropModal se quedan claros (look "elevated" tipo iOS).

**Collections / Albums**:
- store: `Album { id, name, tileIds[], createdAt }` + `albums` en state. `addAlbum`, `renameAlbum`, `deleteAlbum`, `toggleTileInAlbum`, `getAlbumsForTile`. Migration de loadState filtra `tileIds` que ya no existen. `deleteTile` quita el id de todos los albums.
- `components/Albums.tsx`: lista de albums con cover (primera tile) + count, modal de creacion. Export `AlbumDetail` para la pantalla de detalle (3-col grid + rename inline + delete con confirm).
- `components/viewer/AlbumsField.tsx`: chips toggle dentro del modal de edit. "+ New album" crea y asigna en un tap.
- `app/page.tsx`: Screen types `albums` + `album.id`. Boton en bottom bar del grid abre Albums.

### Cierre operativo
- Push a `kikelop/tile-tales` en `main` con 7 commits (c6927ee → 8e5b369 + este doc commit).
- Vercel prod aliased a `https://app-five-xi-20.vercel.app` actualizado tras cada fase.
- `npm run test:run`: 14/14 verde. `npm run lint`: tras config strict salen ~23 problems entre warnings (intencionales en su mayoria) y 6 errors preexistentes (`set-state-in-effect`, `immutability` en R3F refs) que no rompen `next build`.
- Tiempo real ejecutado <2h vs estimado de 13h. Plan original sobreestimaba.
