# App Store Connect — Metadata (v1)

Borrador listo para copiar/pegar en App Store Connect. Ajusta a tu gusto antes de enviar.

## Básico

- **App name** (30 char máx): `Tile Tales`
- **Subtitle** (30 char máx): `Collect the tiles you walk on`
- **Bundle ID**: `com.tiletales.app`
- **Primary category**: Photography
- **Secondary category**: Travel
- **Price**: Free
- **Age rating**: 4+ (sin contenido sensible)

## Promotional text (170 char máx, editable sin nueva versión)

```
Turn the beautiful street tiles you find into a 3D collection you can spin, map and turn into wallpapers.
```

## Description

```
Tile Tales is a little museum for the floor and walls under your feet.

Every city is full of beautiful tiles — Lisbon's calçada, Sevilla's azulejos, a Delft façade in Amsterdam. Tile Tales lets you collect them.

Snap a tile, crop it, and it becomes a real 3D object you can pick up, rotate and flip — with a handwritten memory on the back. Pin where you found it on the map, group tiles into albums, and see your collection grow.

FEATURES
• Capture tiles with your camera or import from your library (multiple at once)
• A tactile 3D viewer — drag to rotate, double-tap to recenter, flip to read the memory
• Map of everywhere you've found tiles, with filters by tag
• Turn your favourite tiles into phone wallpapers — 5 patterns, duotone presets
• Albums to organise your collection
• Stats: top tags, places, countries
• Export and import your whole collection as a backup

Everything stays on your device. No account, no servers, no tracking.

Tile Tales started as a designer's side project — a way to keep the patterns you'd otherwise just walk past.
```

## Keywords (100 char máx, separados por coma, sin espacios)

```
tiles,azulejo,pattern,3d,collection,travel,wallpaper,mosaic,ceramic,architecture,design,photo,map
```

## URLs

- **Support URL**: `https://www.kikelopez.es` (o una página/sección dedicada)
- **Marketing URL** (opcional): `https://www.kikelopez.es`
- **Privacy Policy URL**: pendiente de hostear `PRIVACY_POLICY.md` (ver ese doc). Apple **exige** una URL pública aquí.

## App Privacy (cuestionario "Data Collection")

Respuesta: **"Data Not Collected"** en todas las categorías.
- No se recoge ningún dato. Cámara, ubicación y fotos se usan solo en el dispositivo para crear tiles; nada sale del teléfono ni se envía a servidores.
- Marca "No" en tracking.

## What's New (para la v1)

```
First release. Collect tiles, view them in 3D, map them, and make wallpapers.
```

## Notas
- `CFBundleDisplayName` y bundle id ya están en el proyecto. Versión actual `0.1.0` build `1` → súbela a `1.0.0` para el envío.
- Subtítulo y keywords son lo más editable; itéralo viendo qué buscan en la App Store.
