import type { z } from "zod";
import { cwEndpoints, type CwEnvironment } from "./config";

/**
 * Minimal HTTP client for the CW open API.
 * Only the HTTP status is guaranteed by the docs; the error body format is not.
 * Every successful response is validated with the schema the caller passes in: a response
 * outside that shape is an error, never a silently cast value.
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

/**
 * A 2xx response whose body does not match the expected schema. The body is not kept in the
 * error, because it can contain customer data.
 */
export class CwResponseError extends Error {
  constructor(
    message: string,
    readonly path: string,
  ) {
    super(message);
    this.name = "CwResponseError";
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
    schema: z.ZodType<T>,
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

    const parsed = schema.safeParse(await response.json().catch(() => undefined));
    if (!parsed.success) {
      throw new CwResponseError(`CW returned an unexpected body for ${method} ${path}`, path);
    }
    return parsed.data;
  }

  return {
    get: <T>(path: string, schema: z.ZodType<T>, query?: QueryParams) =>
      request<T>("GET", path, schema, { query }),
    post: <T>(path: string, body: unknown, schema: z.ZodType<T>) =>
      request<T>("POST", path, schema, { body }),
    put: <T>(path: string, body: unknown, schema: z.ZodType<T>) =>
      request<T>("PUT", path, schema, { body }),
  };
}

export type CwClient = ReturnType<typeof createCwClient>;
