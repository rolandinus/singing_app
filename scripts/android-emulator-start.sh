#!/usr/bin/env bash
set -euo pipefail

ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}"
ANDROID_HOME="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
AVD_NAME="${AVD_NAME:-ci-api34}"
EMULATOR_PORT="${EMULATOR_PORT:-5554}"
ANDROID_EMULATOR_ACCEL="${ANDROID_EMULATOR_ACCEL:-auto}"
SERIAL="emulator-${EMULATOR_PORT}"

export ANDROID_SDK_ROOT ANDROID_HOME
export PATH="$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$PATH"

if ! command -v emulator >/dev/null 2>&1; then
  echo "emulator binary not found. Ensure \$ANDROID_SDK_ROOT/emulator is on PATH."
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found. Ensure \$ANDROID_SDK_ROOT/platform-tools is on PATH."
  exit 1
fi

if adb devices | grep -q "^${SERIAL}[[:space:]]"; then
  echo "Emulator ${SERIAL} is already running."
else
  echo "Starting headless AVD '${AVD_NAME}' on ${SERIAL}..."
  nohup emulator \
    -avd "${AVD_NAME}" \
    -port "${EMULATOR_PORT}" \
    -no-window \
    -no-audio \
    -no-boot-anim \
    -gpu swiftshader_indirect \
    -accel "${ANDROID_EMULATOR_ACCEL}" \
    >/tmp/android-emulator-${AVD_NAME}.log 2>&1 &
  EMULATOR_PID=$!
fi

echo "Waiting for ${SERIAL} to be visible to adb..."
for _ in $(seq 1 120); do
  if [ -n "${EMULATOR_PID:-}" ] && ! kill -0 "${EMULATOR_PID}" >/dev/null 2>&1; then
    echo "Emulator process exited before adb detected device."
    echo "Last emulator log lines:"
    tail -n 40 "/tmp/android-emulator-${AVD_NAME}.log" || true
    exit 1
  fi
  if adb devices | grep -q "^${SERIAL}[[:space:]]"; then
    break
  fi
  sleep 2
done

if ! adb devices | grep -q "^${SERIAL}[[:space:]]"; then
  echo "Timed out waiting for ${SERIAL} to appear in adb devices."
  echo "Last emulator log lines:"
  tail -n 40 "/tmp/android-emulator-${AVD_NAME}.log" || true
  exit 1
fi

echo "Waiting for Android boot completion on ${SERIAL}..."
for _ in $(seq 1 120); do
  if [ -n "${EMULATOR_PID:-}" ] && ! kill -0 "${EMULATOR_PID}" >/dev/null 2>&1; then
    echo "Emulator process exited before boot completed."
    echo "Last emulator log lines:"
    tail -n 40 "/tmp/android-emulator-${AVD_NAME}.log" || true
    exit 1
  fi
  BOOTED="$(timeout 5 adb -s "${SERIAL}" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  if [ "${BOOTED}" = "1" ]; then
    adb -s "${SERIAL}" shell input keyevent 82 >/dev/null 2>&1 || true
    echo "Emulator is ready: ${SERIAL}"
    exit 0
  fi
  sleep 2
done

echo "Timed out waiting for emulator boot."
echo "Last emulator log lines:"
tail -n 40 "/tmp/android-emulator-${AVD_NAME}.log" || true
exit 1
