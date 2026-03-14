#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="${PROJECT_ROOT}/mobile"
FLOW_FILE="${FLOW_FILE:-${MOBILE_DIR}/.maestro/smoke.yaml}"
EXPO_PORT="${EXPO_PORT:-8081}"
EMULATOR_PORT="${EMULATOR_PORT:-5554}"
SERIAL="emulator-${EMULATOR_PORT}"
METRO_LOG="${PROJECT_ROOT}/.expo-metro.log"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}"
ANDROID_HOME="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"

export ANDROID_SDK_ROOT ANDROID_HOME
export PATH="$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/emulator:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$PATH"

if ! command -v java >/dev/null 2>&1 && [ -x "$HOME/.local/java-current/bin/java" ]; then
  export PATH="$HOME/.local/java-current/bin:$PATH"
fi

if [ -z "${JAVA_HOME:-}" ] && [ -x "$HOME/.local/java-current/bin/java" ]; then
  export JAVA_HOME="$HOME/.local/java-current"
fi

if ! command -v java >/dev/null 2>&1; then
  echo "java not found. Install Java 17+ first."
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found. Start by running scripts/android-sdk-setup.sh."
  exit 1
fi

if ! command -v maestro >/dev/null 2>&1; then
  echo "maestro CLI not found."
  echo "Install with: curl -Ls \"https://get.maestro.mobile.dev\" | bash"
  exit 1
fi

if ! adb devices | grep -q "^${SERIAL}[[:space:]]"; then
  echo "Expected running emulator '${SERIAL}', but it was not found."
  echo "Start one with: ./scripts/android-emulator-start.sh"
  exit 1
fi

cleanup() {
  if [ -n "${METRO_PID:-}" ] && kill -0 "${METRO_PID}" >/dev/null 2>&1; then
    kill "${METRO_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "Starting Expo Metro on port ${EXPO_PORT}..."
(
  cd "${MOBILE_DIR}"
  npx expo start --port "${EXPO_PORT}" --non-interactive --dev-client
) >"${METRO_LOG}" 2>&1 &
METRO_PID=$!

echo "Preparing native Android project (managed prebuild)..."
(
  cd "${MOBILE_DIR}"
  CI=1 npx expo prebuild --platform android
)

echo "Building and launching Android debug app on ${SERIAL}..."
(
  cd "${MOBILE_DIR}"
  CI=1 npx expo run:android --variant debug --no-bundler
)

echo "Running Maestro flow: ${FLOW_FILE}"
maestro test "${FLOW_FILE}"
