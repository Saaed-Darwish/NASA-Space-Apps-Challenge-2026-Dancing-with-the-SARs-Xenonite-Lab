/** Short health probes fit inside Netlify's proxy timeout; startup has its own budget. */
export interface BackendState {
  phase: "idle" | "checking" | "waking" | "ready" | "error";
  message: string;
}

const unavailable =
  "The data service is taking longer than expected. Retry the connection to load observations, forecasts and chat.";
const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Cancel a caller without cancelling the startup shared by other panels. */
function waitFor<T>(
  promise: Promise<T>,
  signal?: AbortSignal | null,
): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}

export function createBackendClient({
  transport = (url: string, init?: RequestInit) => fetch(url, init),
  now = Date.now,
  sleep = pause,
  startupBudgetMs = 120_000,
  probeTimeoutMs = 8_000,
  retryDelayMs = 2_000,
  requestTimeoutMs = 15_000,
  freshForMs = 30_000,
} = {}) {
  let state: BackendState = { phase: "idle", message: "" };
  let checkedAt = -Infinity;
  let inFlight: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  function publish(phase: BackendState["phase"], message = "") {
    if (state.phase === phase && state.message === message) return;
    state = { phase, message };
    listeners.forEach((listener) => listener());
  }

  async function probe() {
    const deadline = now() + startupBudgetMs;
    publish("checking", "Connecting to the data service…");
    while (now() < deadline) {
      try {
        const response = await transport("/api/health", {
          cache: "no-store",
          signal: AbortSignal.timeout(
            Math.max(1, Math.min(probeTimeoutMs, deadline - now())),
          ),
        });
        if ([401, 403, 404].includes(response.status)) {
          const message =
            "The data service connection is not configured correctly. Check the deployment's /api/health route.";
          publish("error", message);
          throw new Error(message);
        }
        // A sleeping host or a missing proxy may return an HTML loading page with 200.
        if (response.ok && (await response.json()).status === "healthy") {
          checkedAt = now();
          publish("ready");
          return;
        }
      } catch (error) {
        if (state.phase === "error") throw error;
      }
      publish(
        "waking",
        "Starting the data service. This can take up to two minutes; your data will load automatically. You can keep exploring the map.",
      );
      await sleep(Math.max(0, Math.min(retryDelayMs, deadline - now())));
    }
    publish("error", unavailable);
    throw new Error(unavailable);
  }

  function ready(signal?: AbortSignal | null, force = false): Promise<void> {
    if (signal?.aborted) return Promise.reject(signal.reason);
    if (!force && now() - checkedAt < freshForMs) return Promise.resolve();
    if (!inFlight) {
      const pending = probe();
      inFlight = pending;
      // Handle settlement without creating an unhandled rejection on cancellation.
      void pending.then(
        () => {
          if (inFlight === pending) inFlight = null;
        },
        () => {
          if (inFlight === pending) inFlight = null;
        },
      );
    }
    return waitFor(inFlight, signal);
  }

  async function apiFetch(
    url: string,
    init: RequestInit = {},
    timeoutMs = requestTimeoutMs,
  ): Promise<Response> {
    if (!url.startsWith("/api/"))
      throw new Error("Expected a same-origin API route");
    await ready(init.signal);
    const send = () =>
      transport(url, {
        ...init,
        signal: AbortSignal.any([
          ...(init.signal ? [init.signal] : []),
          AbortSignal.timeout(timeoutMs),
        ]),
      });
    const readOnly = !init.method || init.method.toUpperCase() === "GET";
    try {
      const response = await send();
      if (!readOnly || ![502, 503, 504].includes(response.status))
        return response;
      void response.body?.cancel().catch(() => {});
    } catch (error) {
      if (init.signal?.aborted || !readOnly) throw error;
    }
    // Recover once if a previously healthy service went away. Never replay POST/chat.
    checkedAt = -Infinity;
    await ready(init.signal, true);
    return send();
  }

  return {
    apiFetch,
    ready,
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const backend = createBackendClient();
export const apiFetch = backend.apiFetch;
