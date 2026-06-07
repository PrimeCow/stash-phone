# stash-phone

A phone client for [Stash](https://github.com/stashapp/stash), the self-hosted media
organizer — built with **React Native (Expo)** and compiling to **iOS and Android**
from one codebase. It's the mobile sibling of [stash-tv](../stashtv) (the tvOS app);
the GraphQL client, models, and saved-filter logic are ported across.

## Status

**Feature parity with stash-tv.** Working today:

- **PIN app lock** — a 4-digit PIN (stored in `expo-secure-store`) is required on
  cold launch and on every return from the background. Set once on first run.
- **Server setup** — enter your Stash URL + optional API key, with a live connection
  test against the `version` query. Credentials persist (API key in the secure
  keychain via `expo-secure-store`, URL in `AsyncStorage`).
- **Scenes** — your Stash saved filters render as a chip strip (plus a "Recent
  Scenes" view), shown in an infinite-scroll grid with pull-to-refresh.
  Random-sort filters re-seed on refresh so a refresh actually re-shuffles.
- **Markers** — saved-filter chips + "Recent Markers" grid; tapping a marker plays
  its scene starting at the marker's timecode.
- **Performers** — portrait grid; opening a performer shows their info, a paginated
  list of their scenes, and a "Play All" queue.
- **Groups** — portrait grid; opening a group shows its cover/synopsis and scenes,
  with "Play All" and per-scene playback that auto-advances through the group.
- **Manage Filters** — per-tab toggle of which saved filters appear as chips; sign out.
- **Player** — HLS playback (`expo-video`) with the API key folded into the stream
  URL, native controls, picture-in-picture, and playlist auto-advance.

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
│   ├── _layout.tsx           providers (lock, config, prefs, playback) + Stack + LockOverlay
│   ├── index.tsx             gate: redirects to /setup or /(tabs)
│   ├── setup.tsx             server URL / API key onboarding + connection test
│   ├── (tabs)/               Scenes / Markers / Performers / Groups tabs
│   ├── performer/[id].tsx    performer detail: info + scenes + Play All
│   ├── group/[id].tsx        group detail: cover/synopsis + scenes + Play All
│   └── player.tsx            full-screen HLS player (modal)
├── components/               cards (Scene/Marker/Performer/Group), grids
│   │                         (FilteredBrowse, PaginatedGrid), FilterChipBar,
│   │                         ManageFiltersSheet, PinPad, LockOverlay
├── config/                   React contexts:
│   ├── AppLockContext        PIN lock state (SecureStore + AppState re-lock)
│   ├── ServerConfigContext   server URL + API key (SecureStore / AsyncStorage)
│   ├── FilterPrefsContext    per-mode saved-filter prefs (scenes / markers)
│   └── PlaybackContext       the playlist handed to the player route
├── hooks/
│   ├── useFilteredBrowse.ts  saved-filter chips + pagination (Scenes, Markers)
│   └── usePaginatedList.ts   plain pagination (Performers, Groups, detail lists)
├── lib/
│   ├── graphql.ts            fetch-based Stash GraphQL client (ApiKey header)
│   ├── queries.ts            Find{Scenes,SceneMarkers,Performers,Groups,Group,…}
│   ├── stashUrl.ts           folds the API key into media/stream URLs
│   └── normalizeFilter.ts    object_filter → SceneFilterType input shape
└── types/stash.ts            domain types + display helpers
```

## Compatibility

Built against the current Stash schema (same as stash-tv): uses `findGroups`
(renamed from `findMovies` in v0.27) and `Performer.alias_list`. Adjust the queries
in `src/lib/queries.ts` for older servers.
