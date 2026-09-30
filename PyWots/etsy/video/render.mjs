// Renders intro.html to MP4 (H.264, no audio) by stepping window.seek(frame) and piping
// JPEG frames straight into ffmpeg, so no frame files touch the disk.
//
//   node render.mjs video out/intro.mp4
//   node render.mjs stills stills 0,60,100,120,180,260,330,400,449
//
// Needs `playwright-core` and `ffmpeg-static` (npm install) and a Chrome/Chromium binary
// (CHROME env var, defaults to Google Chrome). The app screens come from
// ../images/source/shots — run `npm run screens` first if that folder is empty.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const ffmpegPath = require("ffmpeg-static");

const here = path.dirname(fileURLToPath(import.meta.url));
const [mode = "video", target = "out/intro.mp4", frameList] = process.argv.slice(2);
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(`file://${path.join(here, "intro.html")}`);
await page.evaluate(() => window.ready);
const total = await page.evaluate(() => window.TOTAL);

async function frame(f, type = "jpeg") {
  await page.evaluate((n) => window.seek(n), f);
  return type === "jpeg" ? page.screenshot({ type: "jpeg", quality: 95 }) : page.screenshot({ type: "png" });
}

if (mode === "stills") {
  fs.mkdirSync(target, { recursive: true });
  for (const f of frameList.split(",").map(Number)) {
    fs.writeFileSync(path.join(target, `f${String(f).padStart(3, "0")}.png`), await frame(f, "png"));
  }
  console.log(`stills written to ${target}`);
} else {
  fs.mkdirSync(path.dirname(path.resolve(here, target)), { recursive: true });
  const ff = spawn(ffmpegPath, [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", "30", "-c:v", "mjpeg", "-i", "-",
    "-an", "-vf", "scale=in_range=full:out_range=tv:out_color_matrix=bt709",
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", path.resolve(here, target),
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((res, rej) => ff.on("close", (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`)))));
  for (let f = 0; f < total; f++) {
    const buf = await frame(f);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % 90 === 0) console.log(`frame ${f}/${total}`);
  }
  ff.stdin.end();
  await done;
  console.log(`wrote ${target} (${(fs.statSync(path.resolve(here, target)).size / 1e6).toFixed(1)} MB)`);
}
await browser.close();
