# Tile Tales - Auditoria UX/UI y Propuestas de Features

**Fecha**: 2026-04-12
**Version auditada**: Web PWA (Next.js 16 + R3F)
**Componentes analizados**: SplashScreen, TileGrid, TileViewer3D, WallpaperGenerator, TileMap, CropModal, ScreenTransition, store.ts

---

## Estado actual de la app

### Features implementadas (28 total)
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
12. Wallpaper flow: seleccionar -> crear -> preview -> save/download
13. Mapa con Leaflet: pins con miniatura, popup -> abrir en 3D
14. Boton + flotante: take photo / choose from library (en grid y viewer)
15. localStorage persistence (tiles, wallpapers, sobrevive refresh)
16. PWA: manifest.json, service worker cache, instalable en home screen
17. Imagenes optimizadas a WebP (32MB -> 720KB)
18. Texture preloading para cambio instantaneo entre tiles
19. Geolocalizacion automatica al capturar foto
20. Compartir tile con share card (Web Share API / download)

### Stack actual
- Next.js 16 + React 19 + TypeScript
- Three.js / React Three Fiber + Drei
- Framer Motion
- Leaflet + react-leaflet
- Tailwind CSS 4
- Custom store con localStorage

---

## Mejoras UX/UI propuestas

### 1. Navegacion y flujo

#### 1.1 Swipe horizontal entre tiles en el viewer
**Problema**: Actualmente solo se puede cambiar de tile tocando thumbnails abajo.
**Solucion**: Detectar swipe izquierda/derecha en el area del canvas para navegar entre tiles. El gesto deberia ser distinguible del drag de rotacion (swipe rapido vs drag lento).
**Impacto**: Alto - gesto natural en mobile que los usuarios esperan.
**Complejidad**: Media.

#### 1.2 Gesto de back (swipe desde borde izquierdo)
**Problema**: Hay que buscar y tocar el boton back, que en pantallas grandes queda lejos del pulgar.
**Solucion**: Detectar swipe desde los primeros 20px del borde izquierdo para volver atras.
**Impacto**: Medio - mejora la fluidez de navegacion.
**Complejidad**: Baja.

#### 1.3 Deep linking / URLs por pantalla
**Problema**: Toda la app es una SPA con estado interno. No se puede compartir un link a un tile especifico, y el boton atras del navegador no funciona.
**Solucion**: Usar `window.history.pushState` / `popstate` para manejar navegacion con el historial del navegador.
**Impacto**: Alto - comportamiento esperado en la web.
**Complejidad**: Media.

#### 1.4 Transicion animada grid -> viewer (shared element)
**Problema**: El cambio de pantalla es un fade generico. Se pierde la relacion visual entre la tile en el grid y la tile en el viewer.
**Solucion**: FLIP animation donde la miniatura del grid se expande hasta ocupar el canvas del viewer.
**Impacto**: Alto - experiencia premium, tipo iOS Photos.
**Complejidad**: Alta.

---

### 2. Grid (Home)

#### 2.1 Barra de busqueda
**Problema**: Con muchos tiles, encontrar uno especifico requiere scroll.
**Solucion**: Campo de busqueda oculto que aparece con pull-down, filtra por nombre y tags.
**Impacto**: Alto cuando la coleccion crece (>20 tiles).
**Complejidad**: Baja.

#### 2.2 Contador de tiles en el header
**Problema**: No hay contexto inmediato del tamano de la coleccion.
**Solucion**: Mostrar "Tile Tales (14)" o un subtitle "14 tiles" debajo del titulo.
**Impacto**: Bajo - informativo.
**Complejidad**: Trivial.

#### 2.3 Long press para seleccion multiple
**Problema**: Para borrar o etiquetar varios tiles hay que hacerlo uno por uno.
**Solucion**: Long press activa modo seleccion con checkmarks, barra de acciones (borrar, etiquetar, compartir).
**Impacto**: Medio - patron estandar en apps de galeria.
**Complejidad**: Media.

#### 2.4 Ordenar tiles
**Problema**: Los tiles siempre aparecen en orden de creacion (mock primero, nuevos al final).
**Solucion**: Boton de sort con opciones: recientes, nombre A-Z, favoritos primero.
**Impacto**: Medio.
**Complejidad**: Baja.

#### 2.5 Animacion de entrada escalonada
**Problema**: Los tiles aparecen todos de golpe, sin personalidad.
**Solucion**: Fade-in + scale con delay escalonado por tile (50ms entre cada uno).
**Impacto**: Bajo - polish visual.
**Complejidad**: Baja.

---

### 3. Viewer 3D

#### 3.1 Indicador "dale la vuelta"
**Problema**: La feature de memoria en el reverso es invisible. Muchos usuarios nunca la descubriran.
**Solucion**: Al abrir un tile por primera vez (localStorage flag), mostrar un hint animado: icono de flip + "Flip to see the back" que desaparece tras 3s o primer interaccion.
**Impacto**: Alto - la memoria es una de las features mas diferenciadores.
**Complejidad**: Baja.

#### 3.2 Doble tap para resetear rotacion
**Problema**: Despues de rotar mucho el tile, no hay forma rapida de volver a la vista frontal.
**Solucion**: Doble tap anima suavemente de vuelta a la rotacion frontal (quaternion slerp).
**Impacto**: Medio.
**Complejidad**: Baja.

#### 3.3 Info/metadata visible sin modal
**Problema**: Para ver tags, fecha o coordenadas hay que abrir el modal de edicion.
**Solucion**: Seccion colapsable debajo del canvas (o encima de thumbnails) con chips de tags, fecha y ubicacion. Tap en tag filtra en el grid.
**Impacto**: Medio.
**Complejidad**: Baja.

#### 3.4 Transicion animada entre tiles
**Problema**: Al cambiar de tile por thumbnails, el cambio es instantaneo (pop).
**Solucion**: Exit animation del tile actual (slide out + fade) + entry animation del nuevo. Ya existe `ExitingTile` en el codigo pero no parece usarse.
**Impacto**: Medio - polish visual.
**Complejidad**: Media (el componente ExitingTile ya existe parcialmente).

---

### 4. Crop Modal

#### 4.1 Grid overlay (regla de tercios)
**Problema**: Dificil encuadrar bien sin guias visuales.
**Solucion**: Lineas de 3x3 grid sobre el area de crop, toggle on/off.
**Impacto**: Bajo.
**Complejidad**: Trivial.

#### 4.2 Boton de reset
**Problema**: Si haces zoom y rotas mucho, no hay forma de volver al estado inicial.
**Solucion**: Boton de reset que anima back al centrado original.
**Impacto**: Bajo.
**Complejidad**: Baja.

---

### 5. Wallpaper Generator

#### 5.1 Presets de duotono
**Problema**: Elegir colores complementarios es dificil con solo color pickers.
**Solucion**: 4-5 presets de combinaciones probadas (Oceano, Sunset, Forest, Vintage, Noir) como chips antes de los pickers.
**Impacto**: Medio - reduce friccion creativa.
**Complejidad**: Trivial.

#### 5.2 Compartir wallpaper
**Problema**: Solo se puede guardar/descargar. No compartir directamente.
**Solucion**: Boton share en la vista de preview usando Web Share API (igual que share tile).
**Impacto**: Medio.
**Complejidad**: Baja.

#### 5.3 Preview fullscreen antes de generar
**Problema**: El preview en el editor es pequeno. Solo ves el resultado completo al generar.
**Solucion**: Tap en el preview lo muestra fullscreen temporalmente.
**Impacto**: Bajo.
**Complejidad**: Baja.

---

### 6. Mapa

#### 6.1 Clustering de pins
**Problema**: Con muchos tiles en la misma zona, los pins se superponen.
**Solucion**: Usar leaflet.markercluster para agrupar pins cercanos con contador.
**Impacto**: Alto cuando la coleccion crece.
**Complejidad**: Baja (libreria existente).

#### 6.2 Filtrar por tags en el mapa
**Problema**: El mapa muestra todos los tiles geolocalizados, sin filtro.
**Solucion**: Reutilizar los filter chips del grid en la parte inferior del mapa.
**Impacto**: Medio.
**Complejidad**: Baja.

#### 6.3 Boton "mi ubicacion"
**Problema**: No hay forma de centrar el mapa en tu posicion actual.
**Solucion**: Boton flotante con icono de ubicacion que centra y hace zoom.
**Impacto**: Medio - util para ver "que tiles tengo cerca".
**Complejidad**: Baja.

#### 6.4 Estadisticas por zona
**Problema**: No hay resumen de distribucion geografica.
**Solucion**: Badge en el header: "3 tiles in Lisbon, 2 in Barcelona" (reverse geocoding).
**Impacto**: Bajo - informativo.
**Complejidad**: Media (requiere reverse geocoding API).

---

### 7. UI General

#### 7.1 Dark mode
**Problema**: Solo existe el tema claro. En entornos oscuros puede ser molesto.
**Solucion**: Tema oscuro siguiendo preferencia del sistema (`prefers-color-scheme`). Variables CSS ya estan centralizadas en globals.css.
**Impacto**: Alto - feature esperada en apps modernas.
**Complejidad**: Media.

#### 7.2 Haptic feedback
**Problema**: Las interacciones se sienten "planas" en mobile.
**Solucion**: `navigator.vibrate(10)` en favorito toggle, share, delete.
**Impacto**: Bajo - polish.
**Complejidad**: Trivial.

#### 7.3 Skeleton loading states
**Problema**: "Loading..." text es generico.
**Solucion**: Placeholders animados con gradiente shimmer para grid items e imagenes.
**Impacto**: Bajo - polish visual.
**Complejidad**: Baja.

#### 7.4 Toast notifications
**Problema**: No hay feedback visual de acciones completadas.
**Solucion**: Toast component minimalista: "Tile saved", "Wallpaper downloaded", "Shared!". Aparece 2s y desaparece.
**Impacto**: Medio - reduce incertidumbre del usuario.
**Complejidad**: Baja.

#### 7.5 Onboarding (primer uso)
**Problema**: Features ocultas (flip tile, pinch zoom, memory text) son dificiles de descubrir.
**Solucion**: 2-3 pantallas al primer uso con ilustraciones simples. LocalStorage flag para no repetir.
**Impacto**: Alto - mejora significativamente discoverability.
**Complejidad**: Media.

---

## Nuevas features propuestas

### Alta prioridad

| Feature | Descripcion | Impacto | Complejidad |
|---------|-------------|---------|-------------|
| **Colecciones/Albums** | Agrupar tiles por viaje, ciudad o estilo. Similar a albums de fotos. | Alto | Media |
| **Import multiple** | Seleccionar varias fotos de la galeria de una vez | Alto | Baja |
| **Estadisticas** | Total tiles, paises, tags mas usados, primer tile, rachas | Medio | Baja |
| **Reverse geocoding** | Convertir lat/lng a nombre de ciudad/pais automaticamente (Nominatim API) | Alto | Baja |
| **Export/backup** | Descargar ZIP con imagenes + JSON de metadata | Alto | Media |

### Media prioridad

| Feature | Descripcion | Impacto | Complejidad |
|---------|-------------|---------|-------------|
| **Timeline view** | Vista cronologica vertical con fecha y ubicacion | Medio | Media |
| **Color palette extraction** | Extraer colores dominantes de cada tile, buscar por color | Medio | Media |
| **Similar tiles** | Sugerir tiles parecidos por tags o colores | Bajo | Media |
| **Tile comparison** | Poner 2 tiles lado a lado en el viewer 3D | Bajo | Media |
| **AR mode** | Ver el tile en realidad aumentada sobre una pared (WebXR) | Alto | Alta |

### Baja prioridad (v2+)

| Feature | Descripcion | Impacto | Complejidad |
|---------|-------------|---------|-------------|
| **Achievements/Badges** | Sistema de logros: "10 tiles", "5 paises", etc. (ref. 05) | Medio | Media |
| **Tile of the day** | Highlight aleatorio diario de tu coleccion | Bajo | Trivial |
| **Stamp frame mode** | Visualizar tiles con borde dentado tipo sello (ref. 10-11) | Bajo | Media |
| **Mini archive view** | Formato librito desplegable para colecciones (ref. 14-16) | Medio | Alta |
| **Sound effects** | Click ceramico al girar, sonido de camara | Bajo | Baja |
| **Home screen widget** | Widget iOS/Android con tile random | Medio | Alta (nativo) |

---

## Prioridad de implementacion recomendada

### Sprint 1 (Quick wins - 1 sesion)
1. Contador de tiles en header
2. Haptic feedback
3. Indicador "flip to see memory"
4. Doble tap reset rotacion
5. Toast notifications

### Sprint 2 (UX core - 1-2 sesiones)
1. Swipe entre tiles en viewer
2. Barra de busqueda en grid
3. Reverse geocoding
4. Ordenar tiles
5. Presets de duotono

### Sprint 3 (Features nuevas - 2-3 sesiones)
1. Colecciones/Albums
2. Import multiple
3. Estadisticas de coleccion
4. Deep linking
5. Dark mode

### Sprint 4 (Backend - 3+ sesiones)
1. Supabase integration (auth, storage, DB)
2. Export/backup
3. Comunidad (ver tiles de otros)
4. Sync entre dispositivos
