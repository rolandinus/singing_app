#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK_PATH="${APK_PATH:-${PROJECT_ROOT}/mobile/android/app/build/outputs/apk/release/app-release.apk}"
FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID:-${GOOGLE_CLOUD_PROJECT:-}}"
FTL_TIMEOUT="${FTL_TIMEOUT:-5m}"
FTL_DEVICE_MODEL="${FTL_DEVICE_MODEL:-}"
FTL_OS_VERSION="${FTL_OS_VERSION:-}"
FTL_LOCALE="${FTL_LOCALE:-en_US}"
FTL_ORIENTATION="${FTL_ORIENTATION:-portrait}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud not found. Install Google Cloud CLI first."
  exit 1
fi

if [ -z "${FIREBASE_PROJECT_ID}" ]; then
  echo "Missing FIREBASE_PROJECT_ID (or GOOGLE_CLOUD_PROJECT)."
  echo "Example: FIREBASE_PROJECT_ID=my-project npm run android:test:firebase:robo"
  exit 1
fi

if [ ! -f "${APK_PATH}" ]; then
  echo "APK not found at ${APK_PATH}"
  echo "Build it first with: npm run android:build:apk"
  exit 1
fi

BASE_CMD=(
  gcloud firebase test android run
  --type robo
  --app "${APK_PATH}"
  --project "${FIREBASE_PROJECT_ID}"
  --timeout "${FTL_TIMEOUT}"
)

if [ -n "${FTL_DEVICE_MODEL}" ] || [ -n "${FTL_OS_VERSION}" ]; then
  if [ -z "${FTL_DEVICE_MODEL}" ] || [ -z "${FTL_OS_VERSION}" ]; then
    echo "If setting a custom device, both FTL_DEVICE_MODEL and FTL_OS_VERSION are required."
    exit 1
  fi
  BASE_CMD+=(
    --device "model=${FTL_DEVICE_MODEL},version=${FTL_OS_VERSION},locale=${FTL_LOCALE},orientation=${FTL_ORIENTATION}"
  )
fi

echo "Running Firebase Test Lab Robo test in project: ${FIREBASE_PROJECT_ID}"
"${BASE_CMD[@]}"
