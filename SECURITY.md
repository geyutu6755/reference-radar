# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 1.0.x | ✅ |

## Reporting a vulnerability

Please report security issues privately via GitHub's
["Report a vulnerability"](https://github.com/geyutu6755/reference-radar/security/advisories/new)
feature rather than a public issue. Include reproduction steps and the browser
version. You can expect an initial response within two weeks.

## Security model of the application

Reference Radar is a static site with **no backend**:

- User documents are parsed in browser memory and never uploaded, stored or
  sent anywhere. There is no telemetry and no third-party runtime script.
- Uploads are bounded (20 MB compressed; decompressed size and compression
  ratio caps enforced by a ZIP central-directory pre-scan), path-traversal
  entry names are rejected, legacy `.doc`/encrypted files are detected.
- XML parsing uses fast-xml-parser without DTD evaluation, so XXE /
  billion-laughs expansion does not apply.
- A strict Content-Security-Policy forbids inline scripts and external
  origins; all rendered content is React-escaped and the HTML report generator
  escapes every dynamic value.
- The service worker caches only static app assets, never user documents.
- Dependencies are pinned by lockfile; `pnpm audit` runs in CI and must stay
  clean (including dev dependencies).
