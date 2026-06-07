// Minimal fetch-based GraphQL client for Stash, ported from the tvOS
// StashClient. POSTs to <server>/graphql with an optional ApiKey header.

import { getSessionCookie } from './session';

export interface GraphQLError {
  message: string;
  path?: string[];
}

export class StashError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'StashError';
  }
}

/**
 * Thrown (in proxy mode) when a request is bounced to the reverse-proxy login
 * page instead of reaching Stash — i.e. the session cookie is missing/expired
 * and the user needs to log in again through the web auth flow.
 */
export class AuthRequiredError extends Error {
  constructor() {
    super('Sign-in required to reach this server.');
    this.name = 'AuthRequiredError';
  }
}

export interface StashClientConfig {
  serverURL: string;
  apiKey?: string | null;
  connectionMode?: 'direct' | 'proxy';
}

function joinURL(base: string, path: string): string {
  const trimmed = base.replace(/\/+$/, '');
  return `${trimmed}/${path}`;
}

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export class StashClient {
  constructor(private readonly config: StashClientConfig) {}

  async execute<TData>(
    operationName: string,
    query: string,
    variables?: Record<string, unknown>
  ): Promise<TData> {
    const endpoint = joinURL(this.config.serverURL, 'graphql');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.config.apiKey) {
      headers.ApiKey = this.config.apiKey;
    }
    const cookie = getSessionCookie();
    if (cookie) {
      headers.Cookie = cookie;
    }

    const proxy = this.config.connectionMode === 'proxy';

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ operationName, query, variables }),
      });
    } catch (err) {
      throw new StashError(
        `Could not reach the server. Check the URL and that Stash is running.`,
        err
      );
    }

    // In proxy mode an unauthenticated request is rejected by the SSO layer: a
    // 401/403 (Authelia answers API/JSON requests this way), or a 302 to the login
    // page that fetch follows to a different origin (HTML body handled below).
    if (
      proxy &&
      (response.status === 401 ||
        response.status === 403 ||
        (response.url && originOf(response.url) !== originOf(endpoint)))
    ) {
      throw new AuthRequiredError();
    }

    if (!response.ok) {
      const preview = await safePreview(response);
      throw new StashError(`Server returned HTTP ${response.status}.${preview}`);
    }

    const raw = await response.text();
    let envelope: { data?: TData; errors?: GraphQLError[] };
    try {
      envelope = JSON.parse(raw);
    } catch (err) {
      // A login HTML page where JSON was expected means the proxy intercepted us.
      if (proxy && /^\s*</.test(raw)) {
        throw new AuthRequiredError();
      }
      throw new StashError('Server returned a response that was not valid JSON.', err);
    }

    if (envelope.errors && envelope.errors.length > 0) {
      throw new StashError(envelope.errors.map((e) => e.message).join('; '));
    }
    if (envelope.data == null) {
      throw new StashError('Server returned an empty response.');
    }
    return envelope.data;
  }
}

async function safePreview(response: Response): Promise<string> {
  try {
    const text = (await response.text()).trim();
    if (!text) return '';
    const slice = text.slice(0, 300);
    return `\n\n${slice}${text.length > 300 ? '…' : ''}`;
  } catch {
    return '';
  }
}

export function makeClient(
  config: {
    serverURL: string | null;
    apiKey?: string | null;
    connectionMode?: 'direct' | 'proxy';
  } | null
): StashClient {
  if (!config?.serverURL) {
    throw new StashError('Server URL is not configured.');
  }
  return new StashClient({
    serverURL: config.serverURL,
    apiKey: config.apiKey,
    connectionMode: config.connectionMode,
  });
}
