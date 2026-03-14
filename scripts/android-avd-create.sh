#!/usr/bin/env bash
set -euo pipefail

ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}"
ANDROID_HOME="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
AVD_NAME="${AVD_NAME:-ci-api34}"
ANDROID_API_LEVEL="${ANDROID_API_LEVEL:-34}"
ANDROID_SYSTEM_IMAGE="${ANDROID_SYSTEM_IMAGE:-system-images;android-${ANDROID_API_LEVEL};google_apis;x86_64}"
ANDROID_DEVICE="${ANDROID_DEVICE:-pixel_6}"

export ANDROID_SDK_ROOT ANDROID_HOME
export PATH="$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$PATH"

if ! command -v java >/dev/null 2>&1 && [ -x "$HOME/.local/java-current/bin/java" ]; then
  export PATH="$HOME/.local/java-current/bin:$PATH"
fi

if [ -z "${JAVA_HOME:-}" ] && [ -x "$HOME/.local/java-current/bin/java" ]; then
  export JAVA_HOME="$HOME/.local/java-current"
fi

if ! command -v avdmanager >/dev/null 2>&1; then
  echo "avdmanager not found."
  echo "Install Android command-line tools and ensure:"
  echo "  \$ANDROID_SDK_ROOT/cmdline-tools/latest/bin is on PATH"
  exit 1
fi

if avdmanager list avd | grep -q "Name: ${AVD_NAME}$"; then
  echo "AVD '${AVD_NAME}' already exists."
  exit 0
fi

echo "Creating AVD '${AVD_NAME}' from ${ANDROID_SYSTEM_IMAGE} (device=${ANDROID_DEVICE})"
echo "no" | avdmanager create avd \
  -n "${AVD_NAME}" \
  -k "${ANDROID_SYSTEM_IMAGE}" \
  --device "${ANDROID_DEVICE}" \
  --force

echo "AVD '${AVD_NAME}' created."
