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

## Features implementadas (25 total)
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
15. localStorage persistence (tiles, wallpapers, sobrevive refresh)
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

## Proximos pasos (proxima sesion)
### 1. Retocar UX del location editor
Funciona pero hay margen para pulirlo:
- Resultados de Nominatim a veces son verbosos ("Lisboa, Área Metropolitana de Lisboa, Portugal, Europa, ...") — truncar / quedarse con los primeros 2-3 segmentos.
- Picker en mini-mapa como alternativa al buscador (mas visual). Pendiente decidir si compensa el espacio extra en el bottom sheet.
- Feedback visual mas claro entre "Use my location" y el resultado (transicion del display).

### 2. UX core (ver docs/AUDIT.md Sprint 2)
- Swipe entre tiles en viewer
- Barra de busqueda en grid
- Reverse geocoding (lat/lng → nombre ciudad) — Nominatim ya esta integrado, reutilizar
- Ordenar tiles
- Presets de duotono en wallpaper

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
