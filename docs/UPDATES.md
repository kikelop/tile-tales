# Tile Tales - Log de Actualizaciones

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
- Truncar `display_name` de Nominatim (suele venir muy verboso).
- Considerar picker en mini-mapa como alternativa al buscador.
- Transicion visual mas clara entre "Use my location" y el resultado.
