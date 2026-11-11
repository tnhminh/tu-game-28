#!/usr/bin/env bash
# Build the Tủ Game 28 Android release: AAB (for Google Play) + universal APK + debug APK.
#
#   bash tools/build-android.sh            # full build
#   SKIP_WWW=1 bash tools/build-android.sh # don't rebuild www/
#   SKIP_ICONS=1 ...                       # don't regenerate launcher icons / splash
#
# Signing: see docs/BUILD.md (android/keystore.properties or TG28_KEYSTORE_PROPERTIES).
# Outputs: dist/tu-game-28-<versionName>.aab / .apk / -debug.apk
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
if [ -z "${JAVA_HOME:-}" ]; then
  JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")"
  export JAVA_HOME
fi

log() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }

[ -d "$ANDROID_HOME/platforms" ] || { echo "Android SDK not found at $ANDROID_HOME" >&2; exit 1; }
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

# 1. web assets ---------------------------------------------------------------
if [ -z "${SKIP_WWW:-}" ] && [ -f tools/build-www.mjs ]; then
  log "Building www/ (node tools/build-www.mjs)"
  node tools/build-www.mjs
elif [ ! -f www/index.html ]; then
  echo "www/index.html missing and tools/build-www.mjs not found" >&2; exit 1
else
  log "Using existing www/ (build-www.mjs not run)"
fi

# 2. node deps ----------------------------------------------------------------
if [ ! -d node_modules/@capacitor/android ]; then
  log "npm ci"
  npm ci
fi

# 3. icons + splash -------------------------------------------------------------
if [ -z "${SKIP_ICONS:-}" ]; then
  log "Generating launcher icons / splash"
  python3 android/scripts/gen-icons.py --root "$ROOT"
fi

# 4. capacitor sync -------------------------------------------------------------
log "npx cap sync android"
npx cap sync android

# 5. gradle ---------------------------------------------------------------------
VERSION_NAME="$(sed -n 's/.*versionName "\(.*\)".*/\1/p' android/app/build.gradle | head -1)"
log "Gradle: bundleRelease assembleRelease assembleDebug (versionName $VERSION_NAME)"
( cd android && ./gradlew --no-daemon clean bundleRelease assembleRelease assembleDebug )

# 6. collect --------------------------------------------------------------------
mkdir -p dist
OUT=android/app/build/outputs
cp "$OUT/bundle/release/app-release.aab" "dist/tu-game-28-$VERSION_NAME.aab"
REL_APK="$(ls "$OUT"/apk/release/app-release*.apk | head -1)"
cp "$REL_APK" "dist/tu-game-28-$VERSION_NAME.apk"
cp "$OUT/apk/debug/app-debug.apk" "dist/tu-game-28-$VERSION_NAME-debug.apk"
case "$REL_APK" in *unsigned*) echo "WARNING: release APK is UNSIGNED (no keystore configured)";; esac

# quick signature check
BT="$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)"
log "apksigner verify"
"$BT/apksigner" verify --print-certs "dist/tu-game-28-$VERSION_NAME.apk" | grep -E 'Signer #1 certificate (DN|SHA-256)' || true

log "Done"
ls -la dist/
