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

## Public submissions are public

Content posted in GitHub Issues and Discussions **is publicly visible by
default**. Do not paste unpublished results, personal details, or anything you
would not want indexed. Only fragments you deliberately post are used for
testing; nothing from your local analysis session is ever collected by the app
itself.

**Regression-corpus consent:** a desanitized fragment becomes part of the
public regression corpus **only after you explicitly agree** (the bug template
asks). If you prefer private handling, say so in the issue and the maintainers
will keep the fragment out of public test material.

## Public submissions, investigation use, and corpus redistribution are three distinct things

1. **Visibility.** Content posted in GitHub Issues and Discussions is
   **publicly visible by default**. Do not paste unpublished results, personal
   details, or anything you would not want indexed.
2. **Investigation use.** Maintainers may view and work with the fragments you
   post while investigating the issue you filed. Submitting a fragment does
   not require you to grant any broader license.
3. **Regression-corpus redistribution.** A desanitized fragment is added to
   the **public** regression corpus **only after you explicitly agree**
   (the bug template asks for Yes/No). **Declining consent never affects your
   access to investigation, answers, or technical support.** Privately shared
   full documents stay local to the maintainers' machines and never enter the
   public repository, releases, or the public corpus.
4. **No full papers.** We never collect or ask for complete private papers —
   only desanitized fragments you choose to post.

The application itself continues to upload nothing (see sections above).
