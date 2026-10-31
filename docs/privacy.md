# Privacy

Reference Radar is **local-first by architecture**, not by policy alone:

1. **No upload path exists.** The site is static; there is no backend, no
   analytics, no third-party runtime script. The only network requests the app
   makes are for its own static assets (and the bundled CJK font, lazily,
   during the first PDF export).
2. **No persistence.** Uploaded DOCX bytes and analysis results live in
   in-memory state. Nothing is written to localStorage or IndexedDB; closing
   the tab erases everything. Preferences (theme, language) are stored, and
   nothing else.
3. **Service worker scope.** The service worker caches static app assets only
   (JS/CSS/icon/font) and never caches navigation payloads, uploaded files or
   analysis data.
4. **Version switching.** Re-running the analysis with another standard
   version reuses the bytes still held in memory for the current session; the
   file is never re-fetched or transmitted.

**Verify it yourself:** open DevTools → Network, check "Disable cache" and
watch the network log while analyzing a document — only `localhost`-served
static assets appear. The CSP (`default-src 'self'`) additionally blocks any
third-party origin.

Contact / disclosure: see [SECURITY.md](../SECURITY.md).
