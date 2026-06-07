// Minimal fetch-based GraphQL client for Stash, ported from the tvOS
// StashClient. POSTs to <server>/graphql with an optional ApiKey header.

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

export interface StashClientConfig {
  serverURL: string;
  apiKey?: string | null;
}

function joinURL(base: string, path: string): string {
  const trimmed = base.replace(/\/+$/, '');
  return `${trimmed}/${path}`;
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

    if (!response.ok) {
      const preview = await safePreview(response);
      throw new StashError(`Server returned HTTP ${response.status}.${preview}`);
    }

    let envelope: { data?: TData; errors?: GraphQLError[] };
    try {
      envelope = await response.json();
    } catch (err) {
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
  config: { serverURL: string | null; apiKey?: string | null } | null
): StashClient {
  if (!config?.serverURL) {
    throw new StashError('Server URL is not configured.');
  }
  return new StashClient({ serverURL: config.serverURL, apiKey: config.apiKey });
}
