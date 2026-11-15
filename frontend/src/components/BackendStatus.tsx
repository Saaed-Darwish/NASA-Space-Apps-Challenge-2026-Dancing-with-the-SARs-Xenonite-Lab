import { useEffect, useSyncExternalStore } from "react";
import { backend } from "../data/backend";

export default function BackendStatus() {
  const state = useSyncExternalStore(backend.subscribe, backend.getSnapshot);
  useEffect(() => {
    void backend.ready().catch(() => {});
  }, []);
  if (state.phase === "ready" || state.phase === "idle") return null;
  return (
    <div className="backend-status" role="status" aria-live="polite">
      <span>{state.message}</span>
      {state.phase === "error" && (
        <button onClick={() => window.location.reload()}>
          Retry connection
        </button>
      )}
    </div>
  );
}
