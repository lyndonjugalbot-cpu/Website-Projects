// Renders access.html to PyWots-Access.pdf (A4, one page). Run from etsy/video: node ../pdf/render.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(path.join(here, "../video/package.json"))("playwright-core");
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const page = await browser.newPage();
await page.goto(`file://${path.join(here, "access.html")}`);
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: path.join(here, "PyWots-Access.pdf"), format: "A4", printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await browser.close();
console.log("wrote PyWots-Access.pdf");
