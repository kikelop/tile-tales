# Tile Tales

## Proyecto
App de coleccion de azulejos callejeros con visualizacion 3D. Web first, PWA instalable.

## Stack
- **Web**: Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + Three.js/React Three Fiber + Drei
- **Estado**: Store custom con subscribers en `app/src/lib/store.ts` + localStorage persistence
- **Mapa**: Leaflet + react-leaflet
- **Deploy**: Vercel proyecto `app` en team `kikes-projects-ec907ff6`. URL prod canonica: **`https://app-five-xi-20.vercel.app`**. Root directory configurado en dashboard (no en `vercel.json`, ese campo esta deprecado). La Vercel Git Integration nativa no esta disparando — usar **deploy manual** desde `app/`: `vercel --prod --yes`. La GitHub Action `.github/workflows` esta rota tambien (proyecto no enlazado en runner). Push a `main` actualiza GitHub pero NO prod hasta que se haga `vercel --prod`.
- **iOS**: SwiftUI + SceneKit + MapKit (proyecto en `ios/TileTales/`, pendiente de Xcode)
- **Backend**: Pendiente (Supabase planificado)

## Estructura del proyecto
```
tile-tales/
├── CLAUDE.md              ← Este archivo
├── vercel.json            ← Root directory config
├── docs/                  ← Documentacion del proyecto
│   ├── PROJECT.md         ← Vision y concepto
│   ├── ROADMAP.md         ← Fases del proyecto
│   ├── UPDATES.md         ← Log de sesiones
│   ├── AUDIT.md           ← Auditoria UX/UI completa (30 mejoras + 16 features)
│   ├── DECISIONS.md       ← ADRs
│   └── REFERENCES.md      ← Descripcion de 20 referencias visuales
├── references/            ← Capturas de inspiracion visual
├── ios/                   ← App iOS nativa (SwiftUI + SceneKit)
│   └── TileTales/         ← Proyecto Xcode (15 archivos Swift)
└── app/                   ← Next.js app (root para Vercel)
    ├── public/
    │   ├── manifest.json  ← PWA manifest
    │   ├── sw.js          ← Service worker (cache-first para imagenes)
    │   ├── icon-192.png   ← PWA icon
    │   ├── icon-512.png   ← PWA icon
    │   └── tiles/         ← Texturas de tiles (.webp, optimizadas)
    │       └── default/   ← Texturas de lados y reverso del tile 3D
    └── src/
        ├── app/
        │   ├── page.tsx       ← Orquestador: splash → grid → viewer/wallpaper/map
        │   ├── layout.tsx     ← Root layout, fonts, PWA meta tags
        │   └── globals.css    ← Tailwind + theme vars
        ├── components/
        │   ├── TileViewer3D.tsx    ← Viewer 3D principal (R3F canvas, rotacion, share, animacion)
        │   ├── TileGrid.tsx        ← Home: mosaico grid con filtros, pinch-to-zoom, favoritos
        │   ├── TileMap.tsx         ← Mapa Leaflet con pins de tiles geolocalizadas
        │   ├── WallpaperGenerator.tsx ← Generador de wallpapers (patrones + duotono)
        │   ├── SplashScreen.tsx    ← Splash con tiles animadas en duotono
        │   ├── ScreenTransition.tsx ← Fade+slide entre pantallas
        │   └── CropModal.tsx       ← Crop cuadrado de fotos capturadas (camara y galeria)
        └── lib/
            └── store.ts   ← Estado global: tiles, wallpapers, CRUD, localStorage
```

## Modelo de datos (store.ts)
```typescript
interface TileItem {
  id: string;
  name: string;
  file: string;      // URL de la textura (.webp o blob URL para capturas)
  memory: string;     // Texto en el reverso del tile
  date: string;
  tags: string[];     // e.g. ["geometric", "floral", "classic"]
  favorite: boolean;
  lat?: number;       // Geolocalizacion
  lng?: number;
}
```

## Navegacion (page.tsx)
```
Splash → Grid (home) → Viewer 3D
                     → Wallpaper Generator
                     → Map
```

## Features implementadas (32 total)
1. Splash screen con tiles animadas en duotono
2. Grid mosaico (tipo iOS Photos, scroll-to-bottom, pinch-to-zoom 1-6 columnas)
3. Viewer 3D interactivo (drag to rotate, pinch zoom, auto-rotate Z, wobble, float)
4. Animacion de entrada dramatica (caida + Y flip 360 + Z spin decelerando)
5. Selector de tiles en el viewer (thumbnails abajo)
6. Editar tile: nombre, memoria (reverso), fecha, tags desde modal del lapiz
7. Favoritos: toggle con corazon en el viewer, indicador en grid
8. Eliminar tiles desde el modal de edicion
9. Filtros funcionales: All, Favorites, tags dinamicos en barra inferior
10. Wallpaper generator: 5 patrones (Grid, Mirror, Diamond, Pinwheel, Brick)
11. Wallpaper duotono: filtro de 2 colores con alto contraste + color pickers
12. Wallpaper flow: seleccionar → crear → preview → save/download
13. Mapa con Leaflet: pins con miniatura, popup → abrir en 3D
14. Boton + flotante: take photo / choose from library (en grid y viewer)
15. Persistencia: metadata de tiles en `localStorage`, blobs de tiles capturados en **IndexedDB** (`tile-tales` DB → `tile-blobs` store). Se mantienen al cerrar la PWA. Migration filtra automaticamente las refs `blob:` muertas de versiones anteriores.
16. PWA: manifest.json, service worker cache, instalable en home screen
17. Imagenes optimizadas a WebP (32MB → 720KB)
18. Texture preloading para cambio instantaneo entre tiles
19. Geolocalizacion en captura: camara usa `navigator.geolocation`; galeria lee EXIF GPS via `exifr` (sin fallback a la ubicacion actual si la foto no trae GPS — antes estampaba erroneamente Madrid sobre fotos de Portugal). **Verificado live en prod 2026-05-19.**
20. Compartir tile: share card con imagen + nombre + ubicacion (Web Share API / download)
21. Contador de tiles en header del grid (filtered count cuando hay filtro activo)
22. Hint "flip to see memory" al primer abrir del viewer (gated por localStorage)
23. Doble tap en el viewer → slerp suave a la rotacion frontal inicial (0.4s easeOutCubic)
24. Toast notifications (`lib/toast` + `<Toaster />` global) + haptic feedback (`lib/haptic`) en favorite, share, save, delete, location updates, double tap
25. Editor de localizacion en el modal del lapiz: display lat/lng, Clear, "Use my location" (GPS), "Search a place" (Nominatim/OSM con debounce 400ms)
26. Reverse geocoding (lat/lng → "Lisboa, Portugal") con cache localStorage. Aplicado en location editor, popup del mapa y share card.
27. Busqueda en el grid (header search input, filtra por name/tags) + ordenar tiles (Recent/A–Z/Favorites first, persistido en localStorage).
28. Swipe horizontal entre tiles en el viewer con threshold de intencion 8px (swipe vs rotate-by-drag).
29. Presets de duotono en wallpaper (Ocean / Sunset / Forest / Vintage / Noir) con chips visuales.
30. Onboarding banner para nuevos usuarios + tap en canvas para pausar/reanudar auto-rotate.
31. **Dark mode** (system + toggle manual). CSS variables centralizadas en `globals.css`, inline boot script en layout.tsx evita flash al cargar, `theme-color` meta media-aware.
32. **Collections / Albums**. Modelo en store + vista de albums + detalle + chips de seleccion en el modal de edit. Borrar un tile lo quita de cualquier album automaticamente.
33. **Import multiple**. `useCaptureTile` gestiona una COLA de imagenes pendientes (antes una sola). El `<input>` de galeria lleva `multiple`; cada foto recorre el crop modal una a una con su lectura EXIF/GPS propia en paralelo. CropModal muestra pill "N photos left" y cambia Cancel→Skip durante el lote; cada guardado avisa "Tile saved · N left".
34. **Stats screen** (`StatsView.tsx`). El contador de tiles del header del grid (ahora boton con glifo de grafica) la abre. Hero total + captured-by-you, cards de Favorites/Located/Countries/Albums, barras de top-tags y desglose por lugar resuelto con `reverseGeocode` (sembrado desde cache, relleno secuencial para respetar rate limit de Nominatim).
35. **Deep linking**. Hash routing en `page.tsx` (`#/tile/3`, `#/album/<id>`, `#/stats`…). Sync pantalla↔hash con `popstate`: el boton atras del navegador funciona y los links a tile/album son compartibles. Primera nav hace `replaceState`, el resto `pushState`.
36. **Map polish**. Filtro por tags (chips abajo, solo tags presentes en tiles geolocalizadas) + boton flotante "mi ubicacion" (`requestGeolocation` → `flyTo` zoom 13) + dark mode real del mapa (basemap carto `dark_all` vs `light_all` segun tema, header/chips theme-aware via MutationObserver). Clustering (markercluster) **deliberadamente pospuesto**: react-leaflet v5 no tiene integracion estable, merece pasada dedicada.
37. **Location editor polish**. `searchPlaces` trunca el `display_name` verboso de Nominatim a "primer segmento, pais" (`trimDisplayName`). La fila de localizacion del editor tiene feedback visual: fondo/borde verde + pin relleno cuando hay ubicacion, y "lat, lng · naming…" mientras resuelve el reverse geocode.
38. **Dark mode en popovers/modales**. Nuevas vars `--tt-popover-bg`/`--tt-popover-divider`/`--tt-input-bg`/`--tt-input-border` en globals.css. Aplicadas a sort menu + add menu (TileGrid) y al modal de crear album (Albums). PENDIENTE aun: el modal de edit del viewer (TileViewer3D) y WallpaperGenerator siguen claros — son superficies grandes, pasada propia.
39. **Export / Import backup**. `lib/backup.ts` (jszip dynamic-imported). Export → ZIP con `collection.json` (tiles+albums) + `blobs/<id>` por cada tile capturado (los samples van por path, no se empaquetan). Import → restaura blobs a IDB y mergea metadata por id (idempotente, salta los ya existentes; descarta tiles capturados sin blob en el ZIP). UI en la pantalla de Stats (seccion Backup). `store.importData` hace el merge. Tests en `backup.test.ts` (round-trip, ghost-blob skip, manifest invalido) + `store.test.ts` (importData dedup).

## Proximos pasos (proxima sesion)

### 🎯 OBJETIVO DE LA PROXIMA SESION: review integral para dejar la app terminada
Kike quiere hacer **review de TODAS las features** (las 39, F1→F8) y pulir lo que no esté como a él le gusta, para dar la app por **terminada** a su gusto. No es seguir metiendo features nuevas — es auditar, criticar y rematar lo existente.
- **Como arrancar**: abrir prod (`app-five-xi-20.vercel.app`) en movil y desktop, recorrer pantalla por pantalla (Splash → Grid → Viewer → Map → Wallpaper → Albums → Stats → CropModal) en claro Y oscuro. Anotar fricciones.
- **Candidatos calientes ya conocidos** (de los pendientes de abajo): dark mode del edit sheet del viewer + WallpaperGenerator (siguen claros, cantan en dark), split del TileEditSheet, picker en mini-mapa, clustering del mapa.
- **Forma de trabajo**: Kike lidera el review (el conoce su gusto); Claude ejecuta los arreglos. Probable que convenga un pase de pulido transversal (ritmo, anchos, consistencia de copy EN, microinteracciones) como se hizo en el portfolio.
- Lo de abajo es el inventario de pendientes que alimenta ese review.

### 1. Retocar UX del location editor
- ~~Truncar `display_name` verboso de Nominatim~~ → hecho en F8 (`trimDisplayName`).
- ~~Feedback visual entre "Use my location" y el resultado~~ → hecho en F8 (fila verde + "naming…").
- Picker en mini-mapa como alternativa al buscador (mas visual). Pendiente decidir si compensa el espacio extra en el bottom sheet. **Unico item vivo de este bloque.**

### 2. Pendientes documentados (no urgentes)
- **Dark mode de las superficies grandes que quedan claras**: el modal de edit del viewer (TileViewer3D) y WallpaperGenerator. Son muchas lineas de inline styles hardcoded (#faf8f5/#1a1a1a/#e0d8cc); ya existen las vars `--tt-popover-bg`/`--tt-input-*` para reusar. CropModal se queda negro a proposito (crop fullscreen tipo iOS). Los popovers y el modal de album YA estan migrados (F8).
- **Map clustering** (markercluster): pospuesto en F8 — react-leaflet v5 no tiene wrapper estable, requiere implementacion propia o integracion manual cuidada. El filtro por tags y el boton "mi ubicacion" ya estan.
- Split del modal de edit del viewer (TileEditSheet) sigue pendiente. La logica de albums/location/memory esta densamente acoplada al outer; merece su propia sesion. Se solaparia con el dark mode de ese modal — hacerlos juntos.
- ESLint rules `no-floating-promises` + `no-misused-promises` activas como warning. Quedan ~12 warnings intencionales (`void` faltante en fire-and-forget).

### 3. iOS app
- Instalar Xcode (requiere macOS actualizado)
- Abrir `ios/TileTales/TileTales.xcodeproj`
- Build + test en simulador
- Iterar UI para que coincida con la web

### 4. Scan estilo doc (cuadrilatero + warp perspectivo) — POSPUESTO a app nativa
Intentado en web 2026-05-19 y descartado:
- **Flujo "foto nativa → ScanModal con OpenCV.js"**: funcionaba tecnicamente tras arreglar el SW (ver abajo), pero la deteccion automatica en azulejos de pared (poco contraste con el fondo) fallaba mas de la cuenta y el modal extra entre captura y guardado anadia friccion sin compensar.
- **Flujo "camara live con getUserMedia + overlay realtime"**: bloqueado por iOS. En PWA standalone instalada en home screen, `navigator.mediaDevices.getUserMedia()` se llama, la camara se activa fisicamente (LED rojo + indicador de grabacion en status bar) pero la Promise nunca resuelve ni rechaza. WebKit lo bloquea silenciosamente — solo funciona desde Safari abierto, no desde la PWA. Confirmado con panel de debug en pantalla.
- **Decision**: dejarlo para cuando la app pase a nativa iOS (Swift + Vision `VNDetectRectanglesRequest`, o ARKit). El framework nativo no tiene estas limitaciones.
- **Codigo recuperable** en git history: `c4d17ea` (ScanModal sobre foto estatica con OpenCV.js + 4 esquinas + lupa), `0db1673` (CameraScanner live con getUserMedia + overlay realtime).
- **Side-effect util conservado**: el service worker (`app/public/sw.js`) ahora NO intercepta requests cross-origin (cache name bumped a `v2`). Era el bug raiz que rompia la carga de OpenCV.js — util tener ese fix por si alguna libreria externa se anade en el futuro.

### 5. Social con Supabase (mas adelante)
- Auth (login/registro)
- Storage para imagenes de tiles
- Base de datos para colecciones
- Ver tiles de otros usuarios en el mapa comunitario

## Instrucciones para Claude
1. Al inicio de cada sesion, lee CLAUDE.md para tener contexto
2. Codigo en ingles, documentacion en espanol
3. Componentes funcionales con TypeScript
4. CSS con Tailwind + inline styles (patron actual del proyecto)
5. Commits en ingles, formato convencional
6. Deploy: **manual obligatorio**, `cd app && vercel --prod --yes` (la Vercel git integration y la GitHub Action estan rotas — push a main NO actualiza prod por si solo)
7. Push: `git push origin main`
8. Iteracion rapida, sin pausas de validacion, efectos sutiles y elegantes
9. Siempre verificar build antes de commit: `cd app && npx next build`

## Paleta de colores
- Background: `#f5f2ed`
- Foreground: `#1a1a1a`
- Muted: `#8a8578`
- Duotono default: dark `#4a6fa5`, light `#e8dcc8`

## Convenciones de UI
- Botones flotantes: 44-52px, borderRadius: 50%, background blur
- Bottom bar: backdrop-filter blur, border-top sutil
- Modales: bottom sheet con borderRadius top
- Transiciones: 0.2-0.3s ease
- Touch: WebkitTapHighlightColor transparent en todos los botones
