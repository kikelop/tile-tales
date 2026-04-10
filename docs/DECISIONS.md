# Tile Tales - Decisiones de Arquitectura y Diseno

## ADR-001: Web first con Next.js
**Fecha**: 2026-03-31
**Decision**: Comenzar con aplicacion web usando Next.js antes de hacer port a iOS.
**Motivo**: Permite iterar rapido en el concepto y la UX sin la friccion de desarrollo nativo. Next.js ofrece SSR, buen DX y despliegue sencillo en Vercel.

## ADR-002: Three.js / React Three Fiber para 3D
**Fecha**: 2026-03-31
**Decision**: Usar React Three Fiber (wrapper de Three.js para React) para los efectos 3D.
**Motivo**: Se integra naturalmente con el ecosistema React/Next.js. Permite crear efectos de cards 3D, rotacion y perspectiva de forma declarativa.
