// Renders icon.html to a 1024x1024 PNG App Store icon (no alpha, full-bleed).
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || join(here, "icon-1024.png");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
await page.goto("file://" + join(here, "icon.html"));
await page.waitForLoadState("networkidle");
await page.waitForTimeout(200);

await page.locator("#icon").screenshot({ path: out });
await browser.close();
console.log("✓", out);
