# Tile Tales - Roadmap

## Fase 0: Fundacion (actual)
- [x] Estructura del proyecto y archivos de contexto
- [x] Recopilacion de referencias visuales
- [ ] Definir diseno conceptual (wireframes / mockups)
- [ ] Inicializar proyecto Next.js con dependencias base

## Fase 1: Galeria basica web
- [ ] Layout principal con grid de cards
- [ ] Efecto 3D en cards (rotacion al hover, perspectiva)
- [ ] Vista de detalle de azulejo
- [ ] Datos mock para prototipado

## Fase 2: Upload y almacenamiento
- [ ] Formulario de subida de fotos
- [ ] Integracion con Supabase Storage (o alternativa)
- [ ] Metadata: ubicacion, fecha, notas, tags
- [ ] Autenticacion basica

## Fase 3: Visualizacion 3D avanzada
- [ ] Vista 3D inmersiva de azulejo individual
- [ ] Textura del azulejo mapeada sobre geometria 3D
- [ ] Controles de camara (orbit, zoom)
- [ ] Iluminacion y materiales ceramicos

## Fase 4: Compositor de patrones
- [ ] Herramienta para combinar azulejos en patrones repetitivos
- [ ] Preview de fondo tileable
- [ ] Exportar como imagen de fondo

## Fase 5: iOS
- [ ] Evaluar React Native vs SwiftUI
- [ ] Port de funcionalidades core
- [ ] Integracion con camara nativa
- [ ] Geolocalizacion automatica

## Iteración futura (idea aparcada) — Atlas mundial de tradiciones del azulejo
Inspiración: QS Supplies "World Map Depicting Tile Designs From Every Country"
(https://www.qssupplies.co.uk/world-map-depicting-tile-designs-from-every-country.html)
— mapea el diseño de azulejo tradicional de 80+ países (tradición, época, paleta).

Encaja con el mapa + tiles geolocalizadas que ya existen. Direcciones posibles:
- **Capa "Descubre por país"** en el mapa: un azulejo icónico por país como pins de
  referencia (distintos de las capturas del usuario); tap → ficha (tradición/época/
  colores) + abrir en 3D. Convierte la app de colección personal en atlas cultural.
- **Contexto automático al capturar**: usar el reverse-geocode (país) ya existente para
  mostrar la tradición de ese país al guardar un azulejo. Barato, alto valor → buen punto
  de arranque.
- **Pasaporte / "colecciona el mundo"**: rellenar un mapa-pasaporte según países
  capturados (gamificación, enlaza con la idea de retención de INNO).

Realidad/IP: NO copiar sus imágenes (Pinterest/Dreamstime con licencia). Usar el proyecto
solo como referencia de qué tradiciones representar; imágenes propias/banco libre/Wikimedia
y descripciones redactadas por nosotros. Arrancar con MVP de ~15-20 países de tradición
fuerte (Portugal, España, Marruecos, México, Turquía, Países Bajos, Italia, Túnez, Irán,
Japón…). 80+ países = trabajo de contenido.

Posible caso de portfolio: "de app de colección a atlas cultural".
