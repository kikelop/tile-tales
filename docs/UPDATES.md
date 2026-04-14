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

## 2026-04-12 — Geolocalizacion + Compartir
- Geolocalizacion automatica: al capturar foto se solicita permiso de ubicacion
- lat/lng se guardan automaticamente en el tile nuevo
- Funciona en ambos flujos de captura (grid y viewer)
- Boton de compartir en viewer 3D (entre favorito y editar)
- Genera share card: imagen del tile con nombre, ubicacion/fecha y watermark "Tile Tales"
- Web Share API en mobile (con archivo), descarga directa en desktop
