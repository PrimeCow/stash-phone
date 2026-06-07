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
