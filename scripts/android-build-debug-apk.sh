#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="${PROJECT_ROOT}/mobile"
APK_PATH="${APK_PATH:-${MOBILE_DIR}/android/app/build/outputs/apk/release/app-release.apk}"
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

echo "Assembling release APK..."
(
  cd "${MOBILE_DIR}/android"
  ./gradlew --no-daemon "-Dorg.gradle.jvmargs=${GRADLE_JVM_ARGS}" assembleRelease
)

if [ ! -f "${APK_PATH}" ]; then
  echo "Expected APK not found at: ${APK_PATH}"
  exit 1
fi

echo "APK ready: ${APK_PATH}"
