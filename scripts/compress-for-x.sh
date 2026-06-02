#!/usr/bin/env bash
#
# compress-for-x.sh — comprime un vídeo para subirlo a X vía Typefully (plan free).
#
# Typefully (free) topa vídeo en 10 MB. Este script calcula el bitrate según la
# duración para clavar el tamaño bajo el objetivo, escala a 1920 de alto como mucho
# (no hace upscale), baja a 30fps y quita el audio — óptimo para grabaciones de UI.
#
# Uso:
#   ./compress-for-x.sh <input> [target_mb] [output]
#
# Ejemplos:
#   ./compress-for-x.sh "~/Downloads/ScreenRecording.mp4"
#   ./compress-for-x.sh entrada.mov 9 salida.mp4
#
# Requiere ffmpeg:  brew install ffmpeg
set -euo pipefail

INPUT="${1:?uso: compress-for-x.sh <input> [target_mb] [output]}"
TARGET_MB="${2:-9.3}"          # margen de seguridad bajo el límite de 10 MB
OUTPUT="${3:-}"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "✗ ffmpeg no encontrado. Instálalo con:  brew install ffmpeg" >&2
  exit 1
fi
[ -f "$INPUT" ] || { echo "✗ no existe el archivo: $INPUT" >&2; exit 1; }

# Output por defecto: <nombre>-x.mp4 junto al original
if [ -z "$OUTPUT" ]; then
  dir="$(cd "$(dirname "$INPUT")" && pwd)"
  base="$(basename "${INPUT%.*}")"
  OUTPUT="$dir/${base}-x.mp4"
fi

DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$INPUT")"
[ -n "$DUR" ] || { echo "✗ no pude leer la duración" >&2; exit 1; }

# bitrate de vídeo (kbps) = target_mb * 8192 / duración, con 7% de margen.
# (1 MB = 8192 kbit. Sin audio, todo el presupuesto va a vídeo.)
KBPS="$(awk -v mb="$TARGET_MB" -v d="$DUR" 'BEGIN{ printf "%d", (mb*8192/d)*0.93 }')"

echo "→ entrada:  $INPUT"
echo "→ duración: ${DUR}s   objetivo: ${TARGET_MB} MB   bitrate: ${KBPS}k   (30fps, ≤1920h, sin audio)"

PASSLOG="$(mktemp -t x264pass)"
VF="scale=-2:'min(1920,ih)',fps=30"

ffmpeg -y -i "$INPUT" -vf "$VF" -c:v libx264 -preset slow -b:v "${KBPS}k" \
  -pass 1 -passlogfile "$PASSLOG" -an -pix_fmt yuv420p -f mp4 /dev/null 2>/dev/null
ffmpeg -y -i "$INPUT" -vf "$VF" -c:v libx264 -preset slow -b:v "${KBPS}k" \
  -pass 2 -passlogfile "$PASSLOG" -an -pix_fmt yuv420p -movflags +faststart "$OUTPUT" 2>/dev/null
rm -f "${PASSLOG}"*

SIZE_MB="$(awk -v b="$(stat -f%z "$OUTPUT" 2>/dev/null || stat -c%s "$OUTPUT")" 'BEGIN{ printf "%.2f", b/1048576 }')"
echo "✓ salida:   $OUTPUT   (${SIZE_MB} MB)"
awk -v s="$SIZE_MB" 'BEGIN{ if (s+0 > 10) { print "⚠  sigue por encima de 10 MB — baja target_mb y reintenta"; exit 0 } }'
