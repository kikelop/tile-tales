// Captures every .frame in frames.html to framed/<key>-<theme>.png at 3200x1800.
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const here = dirname(fileURLToPath(import.meta.url));
const FRAMES = ["cover", "grid", "viewer", "map", "stats", "wallpaper", "albums", "album"];
const THEMES = ["light", "dark"];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1600, height: 900 } });
await page.goto("file://" + join(here, "frames.html"));
await page.waitForLoadState("networkidle");
await page.waitForTimeout(300);

for (const theme of THEMES) {
  for (const key of FRAMES) {
    const el = page.locator(`#frame-${key}-${theme}`);
    const out = join(here, "framed", `${key}-${theme}.png`);
    await el.screenshot({ path: out });
    console.log("✓", `framed/${key}-${theme}.png`);
  }
}
await browser.close();
console.log("done");
