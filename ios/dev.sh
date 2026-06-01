#!/bin/bash
# Tile Tales — build / install / launch with automatic disk cleanup.
#
# iOS dev eats disk fast (DerivedData + simulator runtimes/devices). This script
# prunes the accumulators on every run so the Mac doesn't fill up:
#   - wipes Xcode's global ~/Library/Developer/Xcode/DerivedData (GUI builds pile up there)
#   - deletes unavailable/old simulator devices
#   - builds incrementally into a single /tmp path (fast, bounded size)
#
# Usage:
#   ./dev.sh            # build + install + launch on the iPhone (default)
#   ./dev.sh sim        # same on the iPhone 17 simulator
#   ./dev.sh clean      # also wipe the /tmp build cache (full clean next run)
set -e

HERE="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$HERE/TileTales/TileTales.xcodeproj"
DD=/tmp/tiletales-dd
BUNDLE=com.tiletales.app
DEVICE_UDID=00008101-001D4C581AE0001E              # iPhone de Quique
SIM_UDID=FAD576B2-CC3E-4521-AD2B-01C2A9561933        # iPhone 17 simulator

# --- automatic cleanup (the part that keeps the disk from filling) ---
echo "🧹 cleaning DerivedData + stale simulators…"
rm -rf ~/Library/Developer/Xcode/DerivedData/* 2>/dev/null || true
xcrun simctl delete unavailable 2>/dev/null || true

MODE="${1:-device}"
if [ "$MODE" = "clean" ]; then
  rm -rf "$DD"
  echo "✅ wiped /tmp build cache. Run ./dev.sh or ./dev.sh sim to build."
  exit 0
fi

df -h / | tail -1   # show free space before building

if [ "$MODE" = "sim" ]; then
  xcrun simctl boot "$SIM_UDID" 2>/dev/null || true
  open -a Simulator
  xcodebuild -project "$PROJECT" -scheme TileTales \
    -destination "platform=iOS Simulator,id=$SIM_UDID" \
    -derivedDataPath "$DD" CODE_SIGNING_ALLOWED=NO build
  xcrun simctl install "$SIM_UDID" "$DD/Build/Products/Debug-iphonesimulator/TileTales.app"
  xcrun simctl launch "$SIM_UDID" "$BUNDLE"
else
  xcodebuild -project "$PROJECT" -scheme TileTales \
    -destination "platform=iOS,id=$DEVICE_UDID" \
    -derivedDataPath "$DD" -allowProvisioningUpdates build
  xcrun devicectl device install app --device "$DEVICE_UDID" \
    "$DD/Build/Products/Debug-iphoneos/TileTales.app"
  xcrun devicectl device process launch --device "$DEVICE_UDID" "$BUNDLE"
fi

echo "✅ done ($MODE)"
