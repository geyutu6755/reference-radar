/** Create the v1.2.1 GitHub release. */
import { spawnSync } from "node:child_process";

const token = (() => {
  const r = spawnSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf-8",
  });
  return /^password=(.+)$/m.exec(r.stdout)[1];
})();

const body = `Final stability patch. Fixes one user-facing defect found during production adversarial verification. Rule count stays at 19; no new rules, no new features.

## Fixed

- **Re-check comparison survives going home**: after fixing the paper and re-uploading via the home page, the comparison card (已消失 / 新出现 / 仍然存在) was missing because \`setSession(null)\` cleared the previous result. The comparison now persists across home navigation for the same fileName, and is cleared when a different file is analyzed. Verified on production (rr-v1.2.1) with adversarial probe.

## Verified

- 262 Vitest tests, Playwright E2E (Chromium/Firefox/WebKit), PWA install/update/offline script (versions read from the built worker), 0-vuln audit — all green on the release commit 9e1861f.
- Live-site functional test: ALL 25 checks PASS (clean-sample gate, exact rule assertions, clause basis, locate flash, graph, HTML+PDF content, offline import/analysis/export, negative canary).

**Full notes:** [CHANGELOG](https://github.com/geyutu6755/reference-radar/blob/main/CHANGELOG.md).`;

const res = await fetch("https://api.github.com/repos/geyutu6755/reference-radar/releases", {
  method: "POST",
  headers: {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    tag_name: "v1.2.1",
    target_commitish: "main",
    name: "Reference Radar v1.2.1 · 重检比较修复",
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
