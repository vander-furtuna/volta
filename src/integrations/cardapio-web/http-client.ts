import { cwEndpoints, type CwEnvironment } from "./config";

/**
 * Minimal HTTP client for the CW open API.
 * Only the HTTP status is guaranteed by the docs; the error body format is not.
 */

export class CwApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "CwApiError";
  }

  /** 401: token expired or revoked, or installation inactive. Refresh, or treat as uninstalled. */
  get isUnauthorized() {
    return this.status === 401;
  }

  /** 403: the app registration lacks the required scope. */
  get isMissingScope() {
    return this.status === 403;
  }

  /** 429: store rate limit hit. Reschedule the job instead of retrying immediately. */
  get isRateLimited() {
    return this.status === 429;
  }
}

type QueryParams = Record<string, string | number | undefined>;

export interface CwClientOptions {
  environment: CwEnvironment;
  accessToken: string;
  fetchImpl?: typeof fetch;
}

export function createCwClient({ environment, accessToken, fetchImpl = fetch }: CwClientOptions) {
  const baseUrl = cwEndpoints(environment).api;

  async function request<T>(
    method: "GET" | "POST" | "PUT",
    path: string,
    options: { query?: QueryParams; body?: unknown } = {},
  ): Promise<T> {
    const url = new URL(path, baseUrl);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const response = await fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    });

    if (!response.ok) {
      const body: unknown = await response.json().catch(() => undefined);
      throw new CwApiError(
        `CW responded ${response.status} to ${method} ${path}`,
        response.status,
        body,
      );
    }
    return (await response.json()) as T;
  }

  return {
    get: <T>(path: string, query?: QueryParams) => request<T>("GET", path, { query }),
    post: <T>(path: string, body: unknown) => request<T>("POST", path, { body }),
    put: <T>(path: string, body: unknown) => request<T>("PUT", path, { body }),
  };
}

export type CwClient = ReturnType<typeof createCwClient>;
