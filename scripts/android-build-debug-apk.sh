#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="${PROJECT_ROOT}/mobile"
BUILD_VARIANT="${BUILD_VARIANT:-release}"
case "${BUILD_VARIANT}" in
  debug)
    GRADLE_TASK="assembleDebug"
    DEFAULT_APK_PATH="${MOBILE_DIR}/android/app/build/outputs/apk/debug/app-debug.apk"
    ;;
  release)
    GRADLE_TASK="assembleRelease"
    DEFAULT_APK_PATH="${MOBILE_DIR}/android/app/build/outputs/apk/release/app-release.apk"
    ;;
  *)
    echo "Unsupported BUILD_VARIANT: ${BUILD_VARIANT}. Use 'debug' or 'release'."
    exit 1
    ;;
esac
APK_PATH="${APK_PATH:-${DEFAULT_APK_PATH}}"
GRADLE_JVM_ARGS="${GRADLE_JVM_ARGS:--Xmx4096m -XX:MaxMetaspaceSize=1024m -Dkotlin.daemon.jvm.options=-Xmx2048m}"

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

echo "Prebuilding Android project (Expo managed -> native)..."
(
  cd "${MOBILE_DIR}"
  CI=1 npx expo prebuild --platform android
)

echo "Assembling ${BUILD_VARIANT} APK..."
(
  cd "${MOBILE_DIR}/android"
  ./gradlew --no-daemon "-Dorg.gradle.jvmargs=${GRADLE_JVM_ARGS}" "${GRADLE_TASK}"
)

if [ ! -f "${APK_PATH}" ]; then
  echo "Expected APK not found at: ${APK_PATH}"
  exit 1
fi

echo "APK ready: ${APK_PATH}"
