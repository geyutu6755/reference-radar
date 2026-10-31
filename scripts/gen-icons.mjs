import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const svg = readFileSync("public/favicon.svg", "utf-8");
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [192, 512, 180]) {
  const html = `<body style="margin:0"><div id="i" style="width:${size}px;height:${size}px">${svg.replace('viewBox="0 0 64 64"', `viewBox="0 0 64 64" width="${size}" height="${size}"`)}</div></body>`;
  await page.setContent(html);
  await page.locator("#i").screenshot({ path: `public/icons/icon-${size}.png` });
  console.log("icon", size);
}
// maskable (icon with more padding on solid bg)
const maskable = svg.replace('<rect x="4" y="4" width="56" height="56" rx="14" fill="#0e5fd8"/>', '<rect x="0" y="0" width="64" height="64" fill="#0e5fd8"/><g transform="translate(6.4,6.4) scale(0.8)">').replace("</svg>", "</g></svg>");
await page.setContent(`<body style="margin:0"><div id="i" style="width:512px;height:512px">${maskable.replace('viewBox="0 0 64 64"', 'viewBox="0 0 64 64" width="512" height="512"')}</div></body>`);
await page.locator("#i").screenshot({ path: "public/icons/icon-512-maskable.png" });
console.log("maskable done");
await browser.close();
