#!/usr/bin/env bash
#
# Build the attendee + booth Android app (frontend/) into an APK people can
# download and side-load. One APK serves both audiences — the account's role
# decides which app it opens.
#
#   VITE_API_URL=https://api.natcon.example.com scripts/build-apk.sh
#
# The API address is baked into the bundle at build time: the APK ships the
# web assets inside itself and has no dev proxy to fall back on, so an APK
# built without VITE_API_URL would install fine and then fail every login.
# That is why this script refuses to run without it.
#
# Debug build by default — signed with the local debug key, installable by
# anyone who downloads it. For a release build, set all three:
#
#   NATCON_KEYSTORE=/abs/path/natcon.jks
#   NATCON_KEYSTORE_PASSWORD=…
#   NATCON_KEY_ALIAS=…
#   NATCON_KEY_PASSWORD=…      # optional, defaults to the keystore password
#
# Never commit the keystore or those passwords.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/frontend"

if [ -z "${VITE_API_URL:-}" ]; then
  cat >&2 <<'MSG'
VITE_API_URL is required.

The APK carries the app inside it and talks to the API over the network, so
the API address has to be known at build time:

  VITE_API_URL=https://api.natcon.example.com scripts/build-apk.sh

Use http://<your-lan-ip>:8081 to test against the API on your laptop — see
docs/ANDROID.md for the cleartext-HTTP caveat.
MSG
  exit 1
fi

export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
if [ ! -d "$ANDROID_HOME" ]; then
  echo "Android SDK not found at $ANDROID_HOME — set ANDROID_HOME." >&2
  exit 1
fi

VARIANT=debug
GRADLE_TASK=assembleDebug
if [ -n "${NATCON_KEYSTORE:-}" ]; then
  : "${NATCON_KEYSTORE_PASSWORD:?NATCON_KEYSTORE_PASSWORD is required with NATCON_KEYSTORE}"
  : "${NATCON_KEY_ALIAS:?NATCON_KEY_ALIAS is required with NATCON_KEYSTORE}"
  export NATCON_KEY_PASSWORD="${NATCON_KEY_PASSWORD:-$NATCON_KEYSTORE_PASSWORD}"
  VARIANT=release
  GRADLE_TASK=assembleRelease
fi

echo "→ building the web bundle against $VITE_API_URL"
npm run build

echo "→ syncing it into the Android project"
npx cap sync android

echo "→ gradle $GRADLE_TASK"
(cd android && ./gradlew "$GRADLE_TASK")

APK="$ROOT/frontend/android/app/build/outputs/apk/$VARIANT/app-$VARIANT.apk"
[ -f "$APK" ] || { echo "expected an APK at $APK" >&2; exit 1; }

OUT_DIR="$ROOT/dist"
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/natcon2026-$VARIANT.apk"
cp "$APK" "$OUT"

SIZE=$(du -h "$OUT" | cut -f1)
echo
echo "APK ready: $OUT ($SIZE, $VARIANT)"
echo "Install on a phone plugged in over USB with:  adb install -r \"$OUT\""
