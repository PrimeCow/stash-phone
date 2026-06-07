import CookieManager from '@react-native-cookies/cookies';

// On iOS, the login WebView's session cookies (Authelia + Stash, httpOnly) are NOT
// automatically sent by the app's native fetch/AVPlayer. We read them out via the
// native cookie store and replay them as a Cookie header on requests. Held in a
// module singleton so the GraphQL client and media sources can read it.
//
// Every native call is wrapped in a timeout so a missing/unbuilt native module can
// never hang the UI (this previously made the Done button spin forever).

let cookieHeader: string | null = null;

export function getSessionCookie(): string | null {
  return cookieHeader;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/** Read the WebView's cookies for the server and store them as a Cookie header. */
export async function captureSessionCookies(serverURL: string): Promise<boolean> {
  const cookies = await withTimeout(CookieManager.get(serverURL, true), 4000);
  if (!cookies) return false;
  const entries = Object.entries(cookies);
  const header = entries.map(([name, c]) => `${name}=${c.value}`).join('; ');
  cookieHeader = header || null;

  // Best-effort: mirror into the native (non-WebKit) store so AVPlayer/NSURLSession
  // also send them for video and images.
  for (const [name, c] of entries) {
    await withTimeout(
      CookieManager.set(
        serverURL,
        { name, value: c.value, domain: c.domain, path: c.path, version: c.version, expires: c.expires },
        false
      ),
      2000
    );
  }
  return cookieHeader != null;
}

/** Source object for expo-image / expo-video carrying the session cookie. */
export function withCookie(uri: string): { uri: string; headers?: Record<string, string> } {
  return cookieHeader ? { uri, headers: { Cookie: cookieHeader } } : { uri };
}
