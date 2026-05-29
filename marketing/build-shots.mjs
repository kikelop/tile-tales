// Recaptures app screens from localhost:3000 into raw/<key>-<theme>.png (1170x2532).
// Clears storage so the new curated DEFAULT_TILES load (no watermark, new order).
// Keeps albums/album raws untouched (those need the hand-made demo albums).
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3000";
const themes = process.argv[2] ? [process.argv[2]] : ["light", "dark"];
const VIEWER_INDEX = 12; // Star Compass (last in DEFAULT_TILES -> hero)

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
});
const page = await ctx.newPage();

async function prime(theme) {
  await page.goto(BASE);
  await page.evaluate((t) => {
    try { localStorage.clear(); } catch {}
    try { localStorage.setItem("tile-tales-theme", t); } catch {}
    try { localStorage.setItem("tile-tales-onboarding-dismissed", "1"); } catch {}
    try { localStorage.setItem("tile-tales-flip-hint-seen", "1"); } catch {}
    try { indexedDB.deleteDatabase("tile-tales"); } catch {}
  }, theme);
}
async function shot(key, theme) {
  // hide the Next dev error overlay so the red "Issue" badge stays out of shots
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await page.screenshot({ path: join(here, "raw", `${key}-${theme}.png`) });
}

for (const theme of themes) {
  await prime(theme);

  // grid — wait past the splash by keying on a grid-only element (filter chip)
  await page.goto(BASE + "/#/grid");
  await page.getByText("Favorites", { exact: false }).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
  await shot("grid", theme); console.log("✓ grid", theme);

  // map — wait for the leaflet canvas, then for tiles to paint
  await page.goto(BASE + "/#/map");
  await page.waitForSelector(".leaflet-container", { timeout: 20000 });
  await page.waitForTimeout(2600);
  await shot("map", theme); console.log("✓ map", theme);

  // stats — wait for a stats-only label
  await page.goto(BASE + "/#/stats");
  await page.getByText("TOP TAGS", { exact: false }).first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
  await shot("stats", theme); console.log("✓ stats", theme);

  // viewer — tilt with a vertical drag to expose the 3D thickness/perspective
  // (vertical avoids the horizontal swipe gesture that switches tiles)
  await page.goto(BASE + `/#/tile/${VIEWER_INDEX}`);
  await page.waitForSelector("canvas", { timeout: 20000 });
  await page.waitForTimeout(2800);
  // small tilt only: enough to read the 3D thickness, not enough to flip to the
  // (blank) memory back. ~40px diagonal, vertical-dominant to avoid the swipe gesture.
  const cx = 195, cy = 360;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 4; i++) { await page.mouse.move(cx + i * 2, cy + i * 5); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(700);
  await shot("viewer", theme); console.log("✓ viewer", theme);

  // wallpaper — star-blue-gold (idx 9) + terrazzo-star (idx 3), Mirror + Duotone Ocean.
  // The Create button is gated by selection, so wait on the tile strip instead.
  await page.goto(BASE + "/#/wallpaper");
  const thumbs = page.locator('button:has(img)');
  await thumbs.first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(600);
  // the Next dev error overlay (nextjs-portal) intercepts pointer events — hide it
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  const pick = async (i) => { const t = thumbs.nth(i); await t.scrollIntoViewIfNeeded(); await t.click({ force: true }); await page.waitForTimeout(180); };
  await pick(9); // star-blue-gold -> selection "1"
  await pick(3); // terrazzo-star  -> selection "2"
  await page.getByRole("button", { name: "Mirror", exact: true }).click({ force: true });
  await page.waitForTimeout(180);
  // enable duotone but keep its DEFAULT colors (don't pick a preset)
  await page.getByRole("button", { name: "Duotone", exact: true }).click({ force: true });
  await page.waitForTimeout(1100);
  await shot("wallpaper", theme); console.log("✓ wallpaper", theme);
}

await browser.close();
console.log("done");
