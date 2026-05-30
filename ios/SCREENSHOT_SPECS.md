# App Store Screenshots — Specs & shot list

Para capturar rápido en el simulador una vez Xcode compile. App Store Connect exige
al menos el set de **6.7"**; el de 6.5" es opcional pero recomendado.

## Tamaños requeridos (portrait, px)

| Display | Device de captura | Tamaño portrait |
|---|---|---|
| **6.7"** (obligatorio) | iPhone 16 Pro Max / 15 Pro Max | **1290 × 2796** |
| 6.5" (recomendado) | iPhone 11 Pro Max / XS Max | 1242 × 2688 |
| 5.5" (legacy, opcional) | iPhone 8 Plus | 1242 × 2208 |

Subiendo solo el set 6.7", Apple lo reescala para el resto. Empieza por ese.

## Cómo capturar

1. En Xcode, corre en el simulador del device de 6.7".
2. Prepara datos: deja los 13 tiles de muestra + captura 2-3 reales para que el grid
   y el mapa se vean poblados.
3. `Cmd+S` en el simulador guarda el screenshot a tamaño real en el escritorio.
4. (Opcional) Recorta la barra de estado si quieres mockups limpios, pero Apple
   acepta la captura íntegra.

## Shot list (5 capturas, en este orden)

1. **Grid / Home** — el mosaico lleno de tiles curados. Es la primera impresión.
   Pon el grid en tamaño medio (3 columnas) para que se vea variedad.
2. **Viewer 3D (hero)** — abre Star Compass en 3D, ligeramente rotado para que se
   vea el grosor y el relieve. Es el momento "wow" de la app.
3. **Map** — el mapa con varios pins repartidos por Europa (los samples ya cubren
   Lisboa, Sevilla, Barcelona, Ámsterdam, Madrid…). Con un pin seleccionado y su card.
4. **Wallpaper** — un wallpaper generado en preview, patrón Diamond o Pinwheel con un
   preset duotono (Ocean o Sunset). Vistoso.
5. **Stats** — la pantalla de stats con el hero, las cards y el desglose por lugares.

## Texto de marketing sobre las capturas (opcional)

Si añades caption overlays (estilo App Store moderno), una línea por captura:
1. "Collect the tiles you walk on"
2. "Hold each one in 3D"
3. "Map every find"
4. "Turn them into wallpapers"
5. "Watch your collection grow"

## App Preview (vídeo, opcional)
Un clip de 15-30s rotando un tile en 3D y haciendo flip a la memoria vende la app
mejor que cualquier captura. Dejarlo para una v1.1 si la primera review pasa.
