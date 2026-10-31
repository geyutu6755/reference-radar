/**
 * Reference Radar service worker.
 *
 * - Precaches the app shell and hashed build assets (list injected at build).
 * - Runtime-caches the lazily-fetched CJK font (a static app asset).
 * - Never caches user documents or analysis results — everything the user
 *   uploads stays in memory only.
 */
const VERSION = "rr-v1.0.0";
const PRECACHE = `${VERSION}-precache`;
const RUNTIME = `${VERSION}-runtime`;

self.addEventListener("install", (event) => {
  const urls = self.__RR_PRECACHE = [];
