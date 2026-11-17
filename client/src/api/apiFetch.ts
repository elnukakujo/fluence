import { BASE_URL, getAuthHeaders } from ".";
import { throwIfConflict } from "./conflictError";

/** A non-2xx response. `message` is the caller's "Failed to …" text; the server's own `{error}` text is kept apart. */
export class ApiError extends Error {
  status: number;
  serverMessage?: string;
  /** The parsed JSON body of the error response, for errors that carry data (e.g. merge conflicts). */
  body?: Record<string, unknown>;
  constructor(message: string, status: number, serverMessage?: string, body?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.serverMessage = serverMessage;
    this.body = body;
  }
}

export type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** object → JSON; FormData sent as-is */
  body?: unknown;
  /** Becomes ApiError.message (today's "Failed to …" text). */
  errorMessage: string;
  /** 409 → ConflictError */
  conflict?: boolean;
  /** Return the Response instead of parsed JSON (non-2xx still throws). */
  raw?: boolean;
  signal?: AbortSignal;
  cache?: RequestCache;
  /** Extra headers merged over the auth headers. */
  headers?: Record<string, string>;
};

/** The browser's IANA time zone ("" when it cannot tell). */
function browserTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; }
}

/** The only place that calls fetch. `path` is `/api/…`, `/media/…` or an absolute URL (sent without auth headers). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- wrappers used to return res.json() (any); callers narrow via T
export async function apiFetch<T = any>(path: string, opts: ApiOptions): Promise<T> {
  const absolute = /^https?:\/\//.test(path);
  const isForm = typeof FormData !== "undefined" && opts.body instanceof FormData;
  let headers: Record<string, string> | undefined;
  if (!absolute) {
    headers = { ...(await getAuthHeaders()), "X-Timezone": browserTimeZone() };      // the learner's day follows their own clock (spec 3)
    if (isForm) delete headers["Content-Type"];
    if (opts.headers) headers = { ...headers, ...opts.headers };
  }
  const res = await fetch(absolute ? path : `${BASE_URL}${path}`, {
    method: opts.method,
    headers,
    body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
    signal: opts.signal,
    cache: opts.cache,
  });
  if (opts.conflict) await throwIfConflict(res);
  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    throw new ApiError(opts.errorMessage, res.status, body?.error ?? body?.detail, body);
  }
  if (opts.raw) return res as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
