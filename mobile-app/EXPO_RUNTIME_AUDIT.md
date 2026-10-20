# Expo Runtime Audit

Date: 2026-10-09

## Result

- Expo SDK: 57.0.27
- React Native: 0.86.3
- Expo doctor: 21/21 checks passed
- TypeScript: passed
- Android bundle: passed

## Root Cause

Multiple Metro servers were running on ports 8081 and 8082. Expo Go could load a stale bundle and show old Firebase or ExpoAV runtime errors.

Firebase Auth was also split across two copies (`firebase@10.12.2` with a nested `@firebase/auth@1.7.4`), so the auth component was registered on a different `@firebase/app` instance and Expo Go threw `Component auth has not been registered yet`.

Fix: upgraded to `firebase@12` (single deduplicated `@firebase/app`/`@firebase/auth`). `metro.config.js` still redirects `firebase/auth` to the top-level `@firebase/auth/dist/rn/index.js`, because the `firebase` package has no React Native export condition for `./auth`.

## Fix

- Stopped duplicate Metro processes.
- Started one cache-cleared server on port 8081.
- Metro resolver now selects the installed Firebase Auth React Native build.
- Removed deprecated Expo AV usage and uses `expo-audio`/`expo-video`.

## Run

```powershell
cd mobile-app
npx expo start --clear --port 8081
```

Open the latest QR code in Expo Go. Do not use an older QR/session on port 8082.
