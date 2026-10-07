// Shared helpers for the API layer.
//
// Every function in src/api is async and either resolves with data or throws an
// ApiError with an HTTP status. They call the Express API under /api: in
// development through Vite's proxy (vite.config.ts), online on the same domain,
// so the session cookie is sent with every request.

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

// Query string for a GET request; empty values are left out.
// toQueryString({ status: 'active', page: 2 }) → "status=active&page=2"
export function toQueryString(query: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  return params.toString();
}

// Called when a request is refused with 401 while the app thinks someone is
// logged in (e.g. a deactivated doctor, or a password changed on another device).
// AuthContext registers itself here to clear the user and show the login page.
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

interface RequestOptions {
  body?: unknown;
  // Login and /me answer 401 as part of their normal work: no automatic logout.
  ignoreUnauthorized?: boolean;
}

// fetch('/api' + path) with a JSON body; returns the JSON answer (undefined for 204).
// The server answers errors as { error: message }.
const UNREACHABLE = 'Could not reach the server. Please check your connection and try again.';

export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, UNREACHABLE);
  }

  const data: unknown = res.status === 204 ? undefined : await res.json().catch(() => undefined);
  if (res.ok) return data as T;

  if (res.status === 401 && !options.ignoreUnauthorized) onUnauthorized?.();
  const message = (data as { error?: unknown } | undefined)?.error;
  if (typeof message === 'string') throw new ApiError(res.status, message);
  // No answer from Express itself: a proxy in front of it answered instead
  // (Vite in development while the server is stopped, Render while it starts up).
  if (res.status === 502 || res.status === 503 || res.status === 504) throw new ApiError(res.status, UNREACHABLE);
  throw new ApiError(res.status, 'Something went wrong. Please try again.');
}
