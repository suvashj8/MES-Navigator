export const GATEWAY_RETRY_MS = 2000;

export const API_RESTART_MSG =
  'API is restarting — wait a few seconds and try again.';

export function isGatewayStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

export function gatewayErrorMessage(status: number, fallback: string): string {
  if (isGatewayStatus(status)) return API_RESTART_MSG;
  return fallback || 'Request failed';
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type GatewayOpts = { gatewayRetry?: boolean };

/** One retry after a short delay when the API is down or Vite proxy returns 502. */
export async function fetchWithGatewayRetry(
  url: string,
  init?: RequestInit,
  opts?: GatewayOpts
): Promise<Response> {
  try {
    const res = await fetch(url, init);
    if (isGatewayStatus(res.status) && !opts?.gatewayRetry) {
      await sleep(GATEWAY_RETRY_MS);
      return fetchWithGatewayRetry(url, init, { gatewayRetry: true });
    }
    return res;
  } catch {
    if (!opts?.gatewayRetry) {
      await sleep(GATEWAY_RETRY_MS);
      return fetchWithGatewayRetry(url, init, { gatewayRetry: true });
    }
    throw new Error(API_RESTART_MSG);
  }
}
