// Proxy-mode session handling relies on the login WebView's `sharedCookiesEnabled`
// so the OS shares the session cookie with the app's native requests — no extra
// native cookie module (which would require a native rebuild). These are kept as
// no-ops so existing call sites stay simple.

export function getSessionCookie(): string | null {
  return null;
}

export function setSessionCookie(_value: string | null): void {
  // no-op
}

export async function captureSessionCookies(_serverURL: string): Promise<boolean> {
  return false;
}

/** Source object for expo-image / expo-video (no extra headers needed). */
export function withCookie(uri: string): { uri: string } {
  return { uri };
}
