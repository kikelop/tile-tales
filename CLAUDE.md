# Tile Tales

## Proyecto
App de coleccion de azulejos callejeros con visualizacion 3D. Web first, luego iOS.

## Stack previsto
- **Web**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + Three.js/React Three Fiber
- **Backend**: Supabase (auth, storage, DB) o similar
- **iOS**: Por decidir (React Native o SwiftUI)

## Estructura del proyecto
```
tile-tales/
├── CLAUDE.md          ← Este archivo. Leelo siempre al inicio.
├── docs/
│   ├── PROJECT.md     ← Vision, concepto, features, inspiraciones
│   ├── UPDATES.md     ← Log cronologico de cada sesion de trabajo
│   ├── DECISIONS.md   ← Decisiones tecnicas y de diseno (ADR)
│   ├── ROADMAP.md     ← Fases y milestones del proyecto
│   └── REFERENCES.md  ← Descripcion de las referencias visuales en /references
├── references/        ← Capturas de inspiracion visual (16 imagenes)
└── src/               ← Codigo fuente (por inicializar)
```

## Instrucciones para Claude
1. Al inicio de cada sesion, lee CLAUDE.md y UPDATES.md para tener contexto
2. Al final de cada sesion de trabajo, anade una entrada en UPDATES.md con fecha y resumen
3. Si se toma una decision importante, registrarla en DECISIONS.md
4. Respetar las preferencias del usuario: iteracion rapida, sin pausas de validacion, efectos sutiles y elegantes

## Convenciones
- Codigo en ingles, documentacion en espanol
- Componentes funcionales con TypeScript
- CSS con Tailwind, animaciones con Framer Motion o CSS nativo
- Commits en ingles, formato convencional
