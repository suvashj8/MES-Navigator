/** TTL for in-memory GET responses (see api.ts request()). */
export const GET_CACHE_TTL_MS = 10_000;

const getCache = new Map<string, { ts: number; data: unknown }>();

/** GET paths to drop when a mutation touches the given API area. */
const MUTATION_INVALIDATION: Record<string, readonly string[]> = {
  'daily-grading': ['/daily-grading', '/dashboard', '/reports/', '/missing-standards'],
  'grading-standards': [
    '/grading-standards',
    '/dashboard',
    '/missing-standards',
    '/products',
    '/product-master',
  ],
  'product-master': ['/product-master', '/products', '/grading-standards', '/dashboard'],
  products: ['/products', '/product-master', '/grading-standards'],
  staff: ['/staff', '/dashboard', '/departments'],
  users: ['/users'],
  auth: ['/auth/me', '/auth/scope'],
  'activity-mappings': ['/activity-mappings', '/cost-centers', '/activities'],
  'missing-standards': ['/missing-standards', '/dashboard'],
  /** Grade preview is POST-only; no GET lists depend on it. */
  grade: [],
};

const MUTATION_PREFIX_ORDER: readonly [pathPrefix: string, resource: string][] = [
  ['/daily-grading', 'daily-grading'],
  ['/grading-standards', 'grading-standards'],
  ['/product-master', 'product-master'],
  ['/products', 'products'],
  ['/activity-mappings', 'activity-mappings'],
  ['/missing-standards', 'missing-standards'],
  ['/staff', 'staff'],
  ['/users', 'users'],
  ['/auth/', 'auth'],
  ['/grade/', 'grade'],
];

export function buildGetCacheKey(authToken: string | null, path: string): string {
  return `${authToken || 'anon'}::${path}`;
}

export function getCachedGet<T>(key: string): T | undefined {
  const hit = getCache.get(key);
  if (!hit || Date.now() - hit.ts >= GET_CACHE_TTL_MS) return undefined;
  return hit.data as T;
}

export function setCachedGet(key: string, data: unknown): void {
  getCache.set(key, { ts: Date.now(), data });
}

export function clearGetCache(): void {
  getCache.clear();
}

function pathFromCacheKey(key: string): string {
  const sep = key.indexOf('::');
  return sep >= 0 ? key.slice(sep + 2) : key;
}

function invalidateGetCacheByPrefixes(prefixes: readonly string[]): void {
  for (const key of [...getCache.keys()]) {
    const path = pathFromCacheKey(key);
    if (prefixes.some((pfx) => path.startsWith(pfx))) {
      getCache.delete(key);
    }
  }
}

function mutationResourceKey(pathWithoutQuery: string): string | null {
  for (const [prefix, resource] of MUTATION_PREFIX_ORDER) {
    if (pathWithoutQuery.startsWith(prefix)) return resource;
  }
  return null;
}

/** Drop stale GET entries after POST/PUT/PATCH/DELETE (or full clear on login). */
export function invalidateGetCacheForMutation(path: string): void {
  const p = path.split('?')[0];

  if (p.startsWith('/auth/login') || p.startsWith('/auth/refresh')) {
    clearGetCache();
    return;
  }

  const resource = mutationResourceKey(p);
  if (resource == null) {
    clearGetCache();
    return;
  }

  const prefixes = MUTATION_INVALIDATION[resource];
  if (!prefixes?.length) return;
  invalidateGetCacheByPrefixes(prefixes);
}
