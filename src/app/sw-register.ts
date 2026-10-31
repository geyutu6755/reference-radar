/**
 * Service worker registration with update notification.
 *
 * Reload policy: the page is ONLY reloaded when the user accepts an update
 * (SKIP_WAITING → controllerchange). First-install claims must never reload —
 * that would wipe in-memory analysis state.
 */
import type { MessageKey } from "../i18n";

export interface SwUpdate {
  key: MessageKey;
  apply: () => Promise<void>;
}

export function registerServiceWorker(onUpdate: (u: SwUpdate) => void): void {
  if (!("serviceWorker" in navigator)) return;
  if (!/^https?:$/.test(location.protocol)) return; // not over http(s) — skip

  const start = (): void => {
    const swUrl = `${import.meta.env.BASE_URL ?? "/"}sw.js`.replace(/([^:]\/)\/+/g, "$1");
    navigator.serviceWorker
      .register(swUrl, { scope: import.meta.env.BASE_URL || "/" })
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener("statechange", () => {
            if (next.state === "installed" && navigator.serviceWorker.controller) {
              onUpdate({
                key: "pwa.updateReady",
                apply: async () => {
                  updateAccepted = true;
                  next.postMessage({ type: "SKIP_WAITING" });
                },
              });
            }
          });
        });
      })
      .catch(() => {
        // SW registration failure must never break the app.
      });

    let refreshing = false;
    let updateAccepted = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (updateAccepted && !refreshing) {
        refreshing = true;
        location.reload();
      }
    });
  };

  if (document.readyState === "complete") start();
  else window.addEventListener("load", start);
}
