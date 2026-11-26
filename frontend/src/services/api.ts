import { ApiResponse, HealthStatus } from '../types/health';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

let inMemoryAccessToken: string | null = null;
let onUnauthorizedHandler: (() => void) | null = null;

// Deduplicate concurrent identical GET requests & cache master/reference GET responses briefly
const inflightGets = new Map<string, Promise<unknown>>();
const responseCache = new Map<string, { data: unknown; expiresAt: number }>();

const CACHEABLE_GET_PATHS = [
  '/api/branches',
  '/api/categories',
  '/api/permissions',
  '/api/roles',
  '/api/products?limit=100',
  '/api/analytics/kpis',
];

const MASTER_CACHE_TTL_MS = 12_000;

export function invalidateApiCache(prefix?: string): void {
  if (!prefix) {
    responseCache.clear();
    return;
  }
  for (const key of Array.from(responseCache.keys())) {
    if (key.startsWith(prefix)) {
      responseCache.delete(key);
    }
  }
}

function getCacheTtlForPath(path: string): number {
  for (const prefix of CACHEABLE_GET_PATHS) {
    if (path === prefix || path.startsWith(prefix)) {
      return MASTER_CACHE_TTL_MS;
    }
  }
  return 0;
}

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function registerUnauthorizedHandler(handler: () => void): void {
  onUnauthorizedHandler = handler;
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function tryRefreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ApiResponse<{ accessToken: string }>;
    if (json.success && json.data?.accessToken) {
      inMemoryAccessToken = json.data.accessToken;
      return json.data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

async function executeFetch<T>(
  path: string,
  options: RequestInit = {},
  retryOn401 = true
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemoryAccessToken) {
    headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
    cache: 'no-store',
  });

  if (res.status === 401 && retryOn401 && !path.startsWith('/api/auth/login')) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      return executeFetch<T>(path, options, false);
    }
    if (onUnauthorizedHandler) {
      onUnauthorizedHandler();
    }
  }

  const json = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !json.success) {
    throw new ApiError(
      json.error?.code || 'REQUEST_FAILED',
      json.error?.message || `HTTP Error ${res.status}`,
      res.status,
      json.error?.details
    );
  }

  return json.data as T;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retryOn401 = true
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();

  if (method !== 'GET') {
    const result = await executeFetch<T>(path, options, retryOn401);
    if (!path.startsWith('/api/auth/login') && !path.startsWith('/api/auth/refresh')) {
      invalidateApiCache();
    }
    return result;
  }

  const ttlMs = getCacheTtlForPath(path);
  if (ttlMs > 0) {
    const hit = responseCache.get(path);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.data as T;
    }
    if (hit) responseCache.delete(path);
  }

  const existingInflight = inflightGets.get(path);
  if (existingInflight) {
    return existingInflight as Promise<T>;
  }

  const reqPromise = executeFetch<T>(path, options, retryOn401)
    .then((data) => {
      if (ttlMs > 0) {
        responseCache.set(path, { data, expiresAt: Date.now() + ttlMs });
      }
      return data;
    })
    .finally(() => {
      inflightGets.delete(path);
    });

  inflightGets.set(path, reqPromise);
  return reqPromise;
}

export class ApiService {
  static async getHealth(): Promise<ApiResponse<HealthStatus>> {
    const res = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    return (await res.json()) as ApiResponse<HealthStatus>;
  }
}
