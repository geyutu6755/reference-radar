/** Create the v1.2.0 GitHub release. Run: node scripts/create-v120-release.mjs */
import { spawnSync } from "node:child_process";

const token = (() => {
  const r = spawnSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf-8",
  });
  return /^password=(.+)$/m.exec(r.stdout)[1];
})();

const body = `The closing release of the initial product arc: Reference Radar now covers the full user loop — import or paste → check → locate → understand the basis → apply safe fixes → re-check → export.

**Use it:** https://geyutu6755.github.io/reference-radar/ — installable PWA, works offline (after install + one online PDF export). [Guide](https://github.com/geyutu6755/reference-radar/blob/main/docs/user-guide.md). 19 rules across GB/T 7714—2015/2025, each with verified clause sources and real-DOCX reachability tests.

## Re-check comparison (重新检查比较)

Fix the paper, re-upload, and the workbench compares runs: **已消失 / 新出现 / 仍然存在**, matched by rule + exact conclusion. Version-mismatch warning included. In-memory only.

## Reference-list-only paste mode

Paste just the reference list: list-internal checks (gaps, duplicates, order, format) run; body-dependent conclusions are suppressed and disclosed — never "everything is uncited".

## Three real-engine samples

Correct paper / typical citation errors / fixable format issues — all through the same pipeline, no hardcoded results.

## Environment reliability

Vitest worker-start timeouts patched (60s→180s/300s) so the suite runs on resource-constrained machines.

## Scope statement

Sequential numeric system only (顺序编码制); 19 rules; not a full-standard compliance certification. [Details](https://github.com/geyutu6755/reference-radar/blob/main/docs/rule-coverage.md).

**Verified:** 262 Vitest tests, Playwright E2E (3 browsers), PWA check, live-site verification, 0-vuln audit. Merged via [PR #4](https://github.com/geyutu6755/reference-radar/pull/4) with green CI. [Full notes](https://github.com/geyutu6755/reference-radar/blob/main/CHANGELOG.md).`;

const res = await fetch("https://api.github.com/repos/geyutu6755/reference-radar/releases", {
  method: "POST",
  headers: {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    tag_name: "v1.2.0",
    target_commitish: "main",
    name: "Reference Radar v1.2.0 — Final Quality & Usability Release",
    body,
    draft: false,
    prerelease: false,
  }),
});
const data = await res.json();
if (res.ok) {
  console.log("release created:", data.html_url);
} else {
  console.error("HTTP", res.status, JSON.stringify(data).slice(0, 300));
  process.exit(1);
}
