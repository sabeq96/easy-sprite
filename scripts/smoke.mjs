/**
 * Headless smoke check: drives the real app in Chrome and writes screenshots.
 *
 * Usage: node scripts/smoke.mjs [outDir]
 * Requires the dev server to be running on http://localhost:5173.
 */
import { mkdir } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:5173";
const outDir = process.argv[2] ?? "./.smoke";

const failures = [];
const log = (message) => console.log(`  ${message}`);

await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1440,900"],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
});

const page = await browser.newPage();

page.on("console", (message) => {
  if (message.type() === "error") failures.push(`console: ${message.text()}`);
});
page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));

try {
  console.log("Library");
  await page.goto(`${BASE}/sprites`, { waitUntil: "networkidle0" });
  await page.waitForSelector("text/Sprites", { timeout: 10_000 }).catch(() => {});
  await page.screenshot({ path: `${outDir}/01-library.png` });
  log("rendered");

  console.log("Create sprite");
  await page.locator("::-p-text(New sprite)").click();
  await page.waitForFunction(() => location.pathname.startsWith("/sprites/"), { timeout: 10_000 });
  await page.waitForSelector('[aria-label="Sprite canvas"]', { timeout: 10_000 });
  await new Promise((resolve) => setTimeout(resolve, 600));
  await page.screenshot({ path: `${outDir}/02-editor.png` });
  log(`opened ${await page.evaluate(() => location.pathname)}`);

  console.log("Draw a stroke");
  const canvas = await page.$('[aria-label="Sprite canvas"]');
  const box = await canvas?.boundingBox();
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx - 40, cy - 40);
    await page.mouse.down();
    for (let step = 0; step <= 12; step++) {
      await page.mouse.move(cx - 40 + step * 7, cy - 40 + step * 5);
    }
    await page.mouse.up();
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  await page.screenshot({ path: `${outDir}/03-stroke.png` });
  log("stroke drawn");

  console.log("Reload persistence");
  await new Promise((resolve) => setTimeout(resolve, 1200)); // let autosave debounce fire
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector('[aria-label="Sprite canvas"]', { timeout: 10_000 });
  await new Promise((resolve) => setTimeout(resolve, 800));
  await page.screenshot({ path: `${outDir}/04-after-reload.png` });
  log("reloaded");
} catch (error) {
  failures.push(`flow: ${error.message}`);
  await page.screenshot({ path: `${outDir}/99-failure.png` }).catch(() => {});
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.length} problem(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`\nSmoke OK — screenshots in ${outDir}`);
