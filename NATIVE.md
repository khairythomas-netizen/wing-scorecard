# Running WingZ as a native app

WingZ ships twice from one codebase: as a web app on GitHub Pages, and as an
iOS and Android app wrapped around the same bundle by Capacitor.

The native build loads files from inside the binary. There is no `server.url`
in `capacitor.config.ts`, deliberately: Apple rejects apps that are a website
in a frame under guideline 4.2, and an app that only works online is worse
anyway.

## What is already native

These are not the web versions in a wrapper. Each one checks the platform and
uses the system API when there is one.

| | Native | Web |
| --- | --- | --- |
| Location | System permission prompt via Geolocation | Browser prompt |
| Photos | System picker and camera | File input |
| Status bar | Follows the app's light/dark choice | Theme colour meta tag |
| Splash | Hidden once React has rendered | None |
| Haptics | A tap when you keep a wing | Nothing |
| Google sign-in | System browser, returns through `app.wingz.mobile://auth` | Page redirect |
| Offline cache | The binary | Service worker |

The photo picker is the one people will notice. On iOS Safari, choosing a
photo means an action sheet, then the library, then a confirmation screen. The
native picker hands the image straight back.

## Building it

This needs tooling that a web-only machine does not have: **Xcode** and
**CocoaPods** for iOS, **Android Studio** and **JDK 17+** for Android. Node
alone is not enough.

```bash
npx cap add ios       # once, after installing Xcode and CocoaPods
npx cap add android   # once, after installing Android Studio
npm run ios           # build, sync, open Xcode
npm run android       # build, sync, open Android Studio
```

`npm run build:native` is the part that matters: it builds with relative asset
paths, because the native shell serves from `capacitor://localhost` rather
than the `/wing-scorecard/` sub-path GitHub Pages uses. Building with the web
base path produces an app that loads nothing.

## Before the first sign-in works natively

Add `app.wingz.mobile://auth` to **Supabase → Authentication → URL
Configuration → Redirect URLs**. Without it Supabase refuses to send the
session back and Google sign-in fails silently in the app.

Google itself needs no change: it redirects to Supabase, which redirects to
the app's own scheme.

## Still to do before submitting

- **Icons and a splash image.** Capacitor generates them from a source image;
  the WingZ mark is in `public/icons`.
- **Permission strings.** iOS requires a plain sentence explaining why the app
  wants the camera, the photo library and location. Apple rejects placeholder
  text, so these should say what WingZ actually does with each.
- **Push notifications** are in-app only today. Real push needs a server to
  send them, which WingZ does not have.
