#!/usr/bin/env bash
set -euo pipefail

ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}"
ANDROID_HOME="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
EMULATOR_PORT="${EMULATOR_PORT:-5554}"
SERIAL="emulator-${EMULATOR_PORT}"

export ANDROID_SDK_ROOT ANDROID_HOME
export PATH="$ANDROID_SDK_ROOT/platform-tools:$PATH"

if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found. Ensure \$ANDROID_SDK_ROOT/platform-tools is on PATH."
  exit 1
fi

if adb devices | grep -q "^${SERIAL}[[:space:]]"; then
  adb -s "${SERIAL}" emu kill
  echo "Stopped ${SERIAL}."
else
  echo "${SERIAL} is not running."
fi
