/**
 * Normalize a user-entered server URL: trim, default the scheme to https,
 * strip a trailing slash, and validate it parses to a real http(s) host.
 * Returns null for anything unusable (empty, "null", a scheme-only string, a
 * host with no dot), so bad values can never reach fetch or the login WebView.
 */
export function normalizeServerURL(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  s = s.replace(/\/+$/, '');
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const host = u.hostname;
    const usable = host === 'localhost' || host.includes('.') || host.includes(':');
    return usable ? s : null;
  } catch {
    return null;
  }
}

// Folds the API key into a Stash media URL (screenshots, HLS streams),
// ported from the tvOS StashURL helper. Stash accepts the key as an
// `apikey` query parameter on media endpoints.

export function authenticatedURL(
  path: string | null | undefined,
  apiKey: string | null | undefined
): string | null {
  if (!path) return null;
  if (!apiKey) return path;
  try {
    const url = new URL(path);
    url.searchParams.append('apikey', apiKey);
    return url.toString();
  } catch {
    // Not an absolute URL — append manually.
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}apikey=${encodeURIComponent(apiKey)}`;
  }
}
