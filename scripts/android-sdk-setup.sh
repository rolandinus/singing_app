#!/usr/bin/env bash
set -euo pipefail

ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}"
ANDROID_HOME="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
ANDROID_API_LEVEL="${ANDROID_API_LEVEL:-34}"
ANDROID_BUILD_TOOLS="${ANDROID_BUILD_TOOLS:-34.0.0}"
ANDROID_SYSTEM_IMAGE="${ANDROID_SYSTEM_IMAGE:-system-images;android-${ANDROID_API_LEVEL};google_apis;x86_64}"

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

if ! command -v sdkmanager >/dev/null 2>&1; then
  echo "sdkmanager not found."
  echo "Install Android command-line tools and ensure:"
  echo "  \$ANDROID_SDK_ROOT/cmdline-tools/latest/bin is on PATH"
  exit 1
fi

echo "Using ANDROID_SDK_ROOT=$ANDROID_SDK_ROOT"
yes | sdkmanager --licenses >/dev/null || true

sdkmanager --install \
  "platform-tools" \
  "emulator" \
  "platforms;android-${ANDROID_API_LEVEL}" \
  "build-tools;${ANDROID_BUILD_TOOLS}" \
  "${ANDROID_SYSTEM_IMAGE}"

echo "Android SDK packages installed."
