# Tile Tales — Build in public en X

Estrategia de la cuenta [@kikelopezdesign](https://x.com/kikelopezdesign) desde 2026-06-01.
Programado en Typefully (social set `297990`).

## La apuesta

La cuenta deja de ser comentario suelto de product design + IA y se convierte en **una sola historia con destino**: llevar Tile Tales a la App Store, end to end, contando la fricción real — pagar los 99€, comerse los bugs, las review rejections, hasta que esté descargable.

- **Cadencia:** 1 post/día, lunes a viernes, 16:00 Madrid (14:00 UTC en horario de verano).
- **Voz:** minúsculas (incluida la "i"), frases cortas, learning out loud. Sin punchlines, sin em-dashes, sin "wasn't X — it was Y".
- **Hashtags:** siempre `#tiletales` primero, luego `#buildinpublic`, luego el específico (`#threejs`, `#uidesign`, `#maps`...). Si no cabe en ≤280, se cae el específico antes que los dos primeros.
- **Regla de honestidad (innegociable en BIP):** solo se programa con fecha lo que ya es cierto hoy. Los hitos futuros (pagar, bugs, rejection, live) viven como borradores sin fecha y se publican EN EL MOMENTO en que pasan de verdad. Nada de ficción con fecha.

## Media — vídeos e imágenes

- **Vídeo > pantallazo** cuando la feature es movimiento (visor 3d girando, pinch-zoom, filtrado reordenando). Pantallazo estático para vistas que no ganan nada en movimiento (un grid con poco scroll).
- **X no mezcla vídeo + imagen** en el mismo tuit: o 1 vídeo, o hasta 4 fotos. Si quieres ambos, el segundo va en una respuesta.
- **Tope de 10 MB por vídeo** en el plan free de Typefully (límite al subir vía API/scheduling). X aguanta 512 MB, pero por Typefully hay que comprimir.
- **Compresión: script reutilizable** `scripts/compress-for-x.sh` (requiere ffmpeg: `brew install ffmpeg`). Calcula el bitrate solo según la duración, dos pasadas para clavar el tamaño, escala a ≤1920 de alto, 30fps, sin audio — óptimo para grabaciones de UI. No hace upscale.

```bash
./scripts/compress-for-x.sh "~/Downloads/ScreenRecording.mp4"          # objetivo 9.3 MB por defecto
./scripts/compress-for-x.sh entrada.mov 9 salida.mp4                    # objetivo y salida custom
```

Genera `<nombre>-x.mp4` junto al original y avisa si se pasa de 10 MB (entonces baja el target y reintenta).

> **Flujo recurrente (no salir a herramientas externas):** cuando Kike pase un vídeo para X, comprimir aquí con el script → subir por Typefully → enlazar. Ver memoria `reference_x_video_compress_flow`.
- **Flujo de subida por Typefully:** `create_media_upload` → PUT plano del archivo a la URL presignada (sin headers: `curl -T`) → `get_media_status` hasta `ready` → enlazar el `media_id` en `media_ids` del draft.

## Decisión abierta (= contenido)

**Native (SwiftUI/RN) vs wrap del web app (Capacitor).** Aún sin decidir, a propósito: decidirlo es el beat del 4 jun. Inclinación honesta = wrap (semanas, no meses; el web app ya existe y funciona).
Nota técnica: el wrap resuelve además el bug de cámara ya conocido — `getUserMedia` muere en PWA standalone, pero Capacitor usa la cámara nativa. Ver memoria `reference_ios_pwa_camera_limits`.

## Programado (Jun 1–12) — todo cierto hoy

Orden: **primero el tour de features con pantallazos** (presentan la app), después los beats del viaje. Cada tuit es **autoexplicativo** — deja claro que es una app que estoy desarrollando + de qué feature/sección va — y por debajo del límite de caracteres (≤280).

| Día | Post | |
|---|---|---|
| Lun 1 | `· 0` intro — "i've been building a little thing on the side" | +media |
| Mar 2 | `· 1` grid — la galería, wall de tiles, pinch to zoom | +media |
| Mié 3 | `· 2` 3d viewer — tap → objeto 3d, gíralo, escribe detrás | +media |
| Jue 4 | `· 3` map — trail GPS, lisbon/seville/fez | +media |
| Vie 5 | `· 4` stats — colección en números | +media |
| Lun 8 | `· 5` wallpaper — patrones tileables (grid/mirror/pinwheel) | +media |
| Mar 9 | `· 6` albums — agrupar por viaje/ciudad | +media |
| Mié 10 | `· 7` album detail — galería dentro de cada álbum | +media |
| Jue 11 | `· 8` **the pivot** — "i'm taking it to the app store" | journey |
| Vie 12 | `· 9` **native vs wrap** — pregunta a la audiencia | journey |

Tour de features (Jun 1–10) presenta la app. El viaje arranca el 11. A los beats del viaje (`· 8` en adelante) les meto pantallazos sobre la marcha, no ahora.

## Borradores sin fecha — FIRE-WHEN-REAL

En Typefully, prefijo `TT · FIRE-WHEN-REAL ·`. Editar los `[corchetes]` y publicar cuando ocurra de verdad:

1. **paid the 99** — decidido + pagados los 99€. El proyecto deja de ser side project.
2. **first build on my iphone** — corriendo en el teléfono real, no una pestaña de navegador.
3. **the camera wall** — primer muro: la cámara web muere al wrappear → cámara nativa.
4. **testflight first tester** — primera persona que no soy yo con la app.
5. **icon + store screenshots** — el terreno conocido del diseñador (ata con el nicho).
6. **submitted to review** — botón pulsado, "waiting for review".
7. **rejected** — la rejection y qué dijo Apple. La parte que nadie captura.
8. **it's live** — el cierre con el recuento: semanas, 99€, rejections, bugs.

## Por qué encaja con la búsqueda de trabajo

Un diseñador que **envía un producto real end to end** es exactamente el diferenciador para el cambio de empleo (idealista, fintech, service apps). La cuenta sigue on-niche sin necesidad del carril de comentario: el viaje genera por sí mismo takes de diseño + IA (onboarding, icono, usar Claude para wrappear, agentic UX del flujo de captura).
