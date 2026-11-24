# Irish frontend

One code base (React Native + **Expo SDK 58** + Expo Router) for the **web app, Android app and iOS app**.

## Run

The backend must be running first (see the main README).

```powershell
cd frontend
npm install
npx expo start          # then press  w = web,  a = Android,  scan QR = phone (Expo Go)
npm run web             # web only
```

### Phones (Android / iPhone with Expo Go)

1. Start the backend so the phone can reach it:
   `uvicorn backend.main:app --host 0.0.0.0 --port 8000`
2. Laptop and phone on the same Wi-Fi.
3. The app uses the laptop's address automatically (from Expo). If it cannot connect,
   open **Settings** (gear icon) and type `http://<laptop-ip>:8000`.

iOS without a Mac: install **Expo Go** from the App Store and scan the QR code (risk R4).

## Folder structure

```
frontend/
  src/app/                 Expo Router routes (thin files, one per screen)
    (tabs)/                Tailor, Tracker, Logins, Profile, History
    tracker/[id].tsx       Job details
    settings.tsx
  src/screens/
    dependent/             Screens (call the API + common components)
    independent/           Pure helpers used by screens (tracker filters, application cards)
  src/services/
    dependent/             API client, settings (backend address), hooks, pickers
    independent/           Types and formatting helpers
  common-components/
    independent/           Ready components every screen uses: Button, Card, TextField,
                           Chip, Segmented, Dialog, Toast, Screen, MarkdownView, theme…
    dependent/index.ts     THE import for screens - picks platform overrides
    dependent/platform.*.ts  Metro loads .web / .android / .ios automatically
  platforms/
    web/                   Browser downloads, upload of File objects, focus-ring TextField
    android/               Material ripple Button, emulator address 10.0.2.2
    ios/                   Native clear-button TextField
    shared-native/         File download + share code used by Android and iOS
  assets/images/           App icon, splash and favicon (made from the Irish logo)
```

Platform folders are under `platforms/` (not `frontend/android` / `frontend/ios`) because Expo
generates its native projects in `frontend/android` and `frontend/ios` when building locally.

### How a platform override works

Screens always import from `@common/dependent`:

```ts
import { Button, TextField } from '@common/dependent';
```

`common-components/dependent/index.ts` exports the platform's version if
`platforms/<name>/dependent/index.tsx` provides one, otherwise the common version.
To override a component on one platform, add it to that platform's `overrides` object.

## Checks

```powershell
npx tsc --noEmit     # typecheck
npx expo lint        # lint
npx expo-doctor      # dependency / config check
```
