# Android Automation (Headless Emulator + Maestro)

This project now includes a scriptable Android automation path for CI/local runs:

1. Install Android SDK packages
2. Create an AVD
3. Boot emulator in headless mode
4. Build + install Expo Android app
5. Run Maestro smoke flow

It also supports Firebase Test Lab (Robo) as an emulator alternative.

## Prerequisites

- Java 17+ available in `PATH`
- Android command-line tools installed and configured:
  - `sdkmanager`
  - `avdmanager`
  - `adb`
  - `emulator`
- Maestro CLI installed:
  - `curl -Ls "https://get.maestro.mobile.dev" | bash`
- Linux host must support hardware virtualization (`/dev/kvm`) for `x86_64` emulator images.
  - Without KVM, Android x86 emulators will not boot.
  - ARM images are not supported by the current Android emulator on x86_64 hosts.

Set `ANDROID_SDK_ROOT` if not using the default (`$HOME/Android/Sdk`).

## One-time setup

From repo root:

```bash
./scripts/android-sdk-setup.sh
./scripts/android-avd-create.sh
```

## Run headless Android smoke test

From repo root:

```bash
./scripts/android-emulator-start.sh
./scripts/android-mobile-maestro.sh
./scripts/android-emulator-stop.sh
```

## NPM shortcuts

From repo root:

```bash
npm run android:sdk:setup
npm run android:avd:create
npm run android:emulator:start
npm run android:test:mobile
npm run android:emulator:stop
npm run android:build:apk
npm run android:test:firebase:robo
npm run android:test:firebase:robo:build
```

## Firebase Test Lab (Robo)

Prerequisites:

- `gcloud` CLI installed and authenticated:
  - `gcloud auth login`
  - `gcloud config set project <PROJECT_ID>`
- APIs enabled:
  - `gcloud services enable testing.googleapis.com toolresults.googleapis.com`

Run with existing APK:

```bash
FIREBASE_PROJECT_ID=<PROJECT_ID> npm run android:test:firebase:robo
```

Build APK then run Robo:

```bash
FIREBASE_PROJECT_ID=<PROJECT_ID> npm run android:test:firebase:robo:build
```

Optional custom Test Lab device:

```bash
FIREBASE_PROJECT_ID=<PROJECT_ID> \
FTL_DEVICE_MODEL=oriole \
FTL_OS_VERSION=34 \
npm run android:test:firebase:robo
```

## Environment variables

- `ANDROID_API_LEVEL` default `34`
- `ANDROID_BUILD_TOOLS` default `34.0.0`
- `ANDROID_SYSTEM_IMAGE` default `system-images;android-34;google_apis;x86_64`
- `AVD_NAME` default `ci-api34`
- `ANDROID_DEVICE` default `pixel_6`
- `EMULATOR_PORT` default `5554`
- `EXPO_PORT` default `8081`
- `FLOW_FILE` default `mobile/.maestro/smoke.yaml`
- `FIREBASE_PROJECT_ID` (required for Test Lab)
- `APK_PATH` default `mobile/android/app/build/outputs/apk/debug/app-debug.apk`
- `FTL_TIMEOUT` default `5m`
- `FTL_DEVICE_MODEL` optional (e.g. `oriole`)
- `FTL_OS_VERSION` optional (must be set with `FTL_DEVICE_MODEL`)
- `FTL_LOCALE` default `en_US`
- `FTL_ORIENTATION` default `portrait`
