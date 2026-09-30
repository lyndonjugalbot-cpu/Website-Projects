// Renders mockups.html to the Etsy listing photos in ../ (3000×2250 JPEG, 4:3).
//
//   cd etsy/video && npm install && npm run images        (all photos)
//   node etsy/images/source/render.mjs hero python          (just some)
//
// Etsy warns that photos over 1 MB may not finish uploading, so each photo is saved at the
// highest JPEG quality that keeps it under 1 MB.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../video/package.json"));
const { chromium } = require("playwright-core");
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const PHOTOS = [
  ["hero", "01-hero"],
  ["python", "02-real-python"],
  ["lessons", "03-lessons"],
  ["tower", "04-tower"],
  ["ranks", "05-ranks"],
  ["daily", "06-daily-quest"],
  ["how", "07-how-it-works"],
  ["included", "08-whats-included"],
];
const LIMIT = 1_000_000;

const wanted = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1500, height: 1125 }, deviceScaleFactor: 2 });
await page.goto(`file://${path.join(here, "mockups.html")}`);
await page.evaluate(() => window.ready);

for (const [id, name] of PHOTOS) {
  if (wanted.length && !wanted.includes(id)) continue;
  await page.evaluate((h) => { location.hash = h; }, id);
  await page.waitForTimeout(150);
  let quality = 92, buf;
  for (; quality >= 60; quality -= 4) {
    buf = await page.screenshot({ type: "jpeg", quality });
    if (buf.length <= LIMIT) break;
  }
  const out = path.join(here, "..", `${name}.jpg`);
  fs.writeFileSync(out, buf);
  console.log(`${name}.jpg  q${quality}  ${(buf.length / 1e6).toFixed(2)} MB`);
}
await browser.close();
