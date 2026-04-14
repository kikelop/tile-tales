# Tile Tales

## Proyecto
App de coleccion de azulejos callejeros con visualizacion 3D. Web first, PWA instalable.

## Stack
- **Web**: Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + Three.js/React Three Fiber + Drei
- **Estado**: Store custom con subscribers en `app/src/lib/store.ts` + localStorage persistence
- **Mapa**: Leaflet + react-leaflet
- **Deploy**: Vercel (`app-five-xi-20.vercel.app`), root directory = `app/`
- **Backend**: Pendiente (Supabase planificado)

## Estructura del proyecto
```
tile-tales/
├── CLAUDE.md              ← Este archivo
├── vercel.json            ← Root directory config
├── docs/                  ← Documentacion del proyecto
├── references/            ← Capturas de inspiracion visual
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
        │   ├── TileViewer3D.tsx    ← Viewer 3D principal (R3F canvas, rotacion, animacion entrada)
        │   ├── TileGrid.tsx        ← Home: mosaico grid con filtros, pinch-to-zoom, favoritos
        │   ├── TileMap.tsx         ← Mapa Leaflet con pins de tiles geolocalizadas
        │   ├── WallpaperGenerator.tsx ← Generador de wallpapers (patrones + duotono)
        │   ├── SplashScreen.tsx    ← Splash con tiles animadas en duotono
        │   ├── ScreenTransition.tsx ← Fade+slide entre pantallas
        │   └── CropModal.tsx       ← Crop de fotos capturadas
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

## Features implementadas
- Splash screen con tiles animadas en duotono
- Grid mosaico (tipo iOS Photos, scroll-to-bottom, pinch-to-zoom 1-6 columnas)
- Viewer 3D interactivo (drag to rotate, pinch zoom, auto-rotate Z, wobble, float)
- Animacion de entrada dramatica (caida + Y flip 360 + Z spin decelerando)
- Selector de tiles en el viewer (thumbnails abajo)
- Editar tile: nombre, memoria (reverso), fecha, tags desde modal del lapiz
- Favoritos: toggle con corazon en el viewer, indicador en grid
- Eliminar tiles desde el modal de edicion
- Filtros funcionales: All, Favorites, tags dinamicos en barra inferior
- Wallpaper generator: 5 patrones (Grid, Mirror, Diamond, Pinwheel, Brick)
- Wallpaper duotono: filtro de 2 colores con alto contraste + color pickers
- Wallpaper flow: seleccionar → crear → preview → save/download
- Mapa con Leaflet: pins con miniatura, popup → abrir en 3D
- Boton + flotante: take photo / choose from library (en grid y viewer)
- localStorage persistence (tiles, wallpapers, sobrevive refresh)
- PWA: manifest.json, service worker cache, instalable en home screen
- Imagenes optimizadas a WebP (32MB → 720KB)
- Texture preloading para cambio instantaneo entre tiles
- Geolocalizacion automatica al capturar foto (navigator.geolocation)
- Compartir tile: share card con imagen + nombre + ubicacion (Web Share API / download)

## Features implementadas (sesion 2026-04-12 tarde)
- Geolocalizacion automatica: al capturar foto se pide permiso y se guarda lat/lng
- Compartir tile: boton share en viewer 3D, genera imagen con nombre/ubicacion, Web Share API (mobile) o descarga (desktop)

## Features pendientes (proxima sesion)
### 1. Social con Supabase
- Auth (login/registro)
- Storage para imagenes de tiles
- Base de datos para colecciones
- Ver tiles de otros usuarios en el mapa comunitario
- Esto es lo mas complejo — requiere setup de Supabase

## Instrucciones para Claude
1. Al inicio de cada sesion, lee CLAUDE.md para tener contexto
2. Codigo en ingles, documentacion en espanol
3. Componentes funcionales con TypeScript
4. CSS con Tailwind + inline styles (patron actual del proyecto)
5. Commits en ingles, formato convencional
6. Deploy: `cd app && vercel --prod --yes`
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
