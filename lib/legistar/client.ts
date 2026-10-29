export const LEGISTAR_BASE = "https://webapi.legistar.com/v1/milwaukee";
const USER_AGENT = "Minutes/0.1 (tarik@radiomilwaukee.org)";
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;
const TIMEOUT_MS = 20_000;

export class LegistarError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LegistarError";
  }
}

// Injectable so tests never touch the network or wait on real backoff.
export interface LegistarGetOptions {
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>;
  sleep?: (ms: number) => Promise<void>;
}

export async function legistarGet<T>(
  path: string,
  params?: Record<string, string>,
  { fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }: LegistarGetOptions = {},
): Promise<T> {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  const url = `${LEGISTAR_BASE}/${path.replace(/^\//, "")}${query}`;
  let lastError: LegistarError | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));
    try {
      const res = await fetchImpl(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) return (await res.json()) as T;
      lastError = new LegistarError(`Legistar ${res.status} for ${path}`, res.status);
      if (res.status < 500) throw lastError;
    } catch (err) {
      if (err === lastError) throw err;
      // Network failure or timeout: retryable.
      lastError = new LegistarError(`Legistar request failed for ${path}: ${String(err)}`);
    }
  }
  throw lastError!;
}
