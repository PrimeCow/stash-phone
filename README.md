# stash-phone

A phone client for [Stash](https://github.com/stashapp/stash), the self-hosted media
organizer — built with **React Native (Expo)** and compiling to **iOS and Android**
from one codebase. It's the mobile sibling of [stash-tv](../stashtv) (the tvOS app);
the GraphQL client, models, and saved-filter logic are ported across.

## Status

**Phase 1 — Scenes + player.** Working today:

- **Server setup** — enter your Stash URL + optional API key, with a live connection
  test against the `version` query. Credentials persist (API key in the secure
  keychain via `expo-secure-store`, URL in `AsyncStorage`).
- **Scenes** — your Stash saved filters render as a chip strip (plus a "Recent
  Scenes" view), shown in a 2-column infinite-scroll grid with pull-to-refresh.
  Random-sort filters re-seed on refresh so a refresh actually re-shuffles.
- **Manage Filters** — toggle which saved filters appear as chips; sign out.
- **Player** — HLS playback (`expo-video`) with the API key folded into the stream
  URL, native controls, picture-in-picture, and playlist auto-advance (ready for the
  Groups/Performers "Play All" queues coming later).

**Later phases:** Markers, Performers, Groups tabs; PIN app lock.

## Requirements

- Node 20+ and npm
- For iOS: macOS with Xcode + CocoaPods
- For Android: Android Studio + a JDK 17 (the bundled `java -version` here is 1.8 —
  install a newer JDK before an Android build)
- A running Stash server reachable from the device/simulator, and (if your server
  requires auth) an API key from **Settings → Security → API Key**

## Run

```bash
npm install

# Dev client / Expo Go (Metro):
npx expo start

# Native debug builds (creates ios/ and android/ via prebuild on first run):
npx expo run:ios
npx expo run:android
```

On first launch you'll land on the setup screen — enter your server URL, optionally an
API key, **Test Connection**, then **Save & Continue**.

### Networking notes

- iOS allows arbitrary loads (`NSAllowsArbitraryLoads`) via `app.json` so HTTP
  LAN servers work. Tighten this if you ship beyond your network.
- Android **debug** builds permit cleartext (HTTP) by default. For a **release**
  build against an HTTP server, add `expo-build-properties` with
  `android.usesCleartextTraffic: true`.

## Project layout

```
src/
├── app/                      expo-router routes
│   ├── _layout.tsx           providers (config, prefs, playback) + root Stack
│   ├── index.tsx             gate: redirects to /setup or /(tabs)
│   ├── setup.tsx             server URL / API key onboarding + connection test
│   ├── (tabs)/
│   │   ├── _layout.tsx       bottom tab bar
│   │   └── index.tsx         Scenes browse (chips, infinite grid, refresh)
│   └── player.tsx            full-screen HLS player (modal)
├── components/               SceneCard, FilterChipBar, ManageFiltersSheet
├── config/                   React contexts:
│   ├── ServerConfigContext   server URL + API key (SecureStore / AsyncStorage)
│   ├── FilterPrefsContext    enabled saved-filter IDs, active chip, recent toggle
│   └── PlaybackContext       the playlist handed to the player route
├── lib/
│   ├── graphql.ts            fetch-based Stash GraphQL client (ApiKey header)
│   ├── queries.ts            FindScenes / FindSavedFilters / Version operations
│   ├── stashUrl.ts           folds the API key into media/stream URLs
│   └── normalizeFilter.ts    object_filter → SceneFilterType input shape
└── types/stash.ts            domain types (Scene, SavedFilter, Performer, …)
```

## Compatibility

Built against the current Stash schema (same as stash-tv): uses `findGroups`
(renamed from `findMovies` in v0.27) and `Performer.alias_list`. Adjust the queries
in `src/lib/queries.ts` for older servers.
