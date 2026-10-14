// Renders reel.html to video, frame by frame.
//
//   node render.mjs                         -> out/frames.mp4 (silent, 30 fps)
//   node render.mjs --stills 1,5.5,18,31    -> out/still-<t>.png for a quick look
//
// Needs Playwright (Chromium) and ffmpeg. reel.html is served over HTTP from this
// folder so fonts and images load the same way they would in a browser.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "out");
const FPS = 30;
const TYPES = { ".html": "text/html", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2" };

const args = process.argv.slice(2);
const stillsArg = args.includes("--stills") ? args[args.indexOf("--stills") + 1] : null;

await mkdir(OUT, { recursive: true });

const server = createServer(async (req, res) => {
  try {
    const path = join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!path.startsWith(ROOT)) throw new Error("outside root");
    const body = await readFile(path);
    res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const url = `http://127.0.0.1:${server.address().port}/reel.html`;

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: "networkidle" });
await page.evaluate(() => window.reelReady);
const duration = await page.evaluate(() => window.REEL_DURATION);

const frameAt = async (t) => {
  await page.evaluate((tt) => window.renderAt(tt), t);
  return page.screenshot({ type: "png" });
};

if (stillsArg) {
  const { writeFile } = await import("node:fs/promises");
  for (const t of stillsArg.split(",").map(Number)) {
    await writeFile(join(OUT, `still-${t}.png`), await frameAt(t));
    console.log("still", t);
  }
} else {
  const total = Math.round(duration * FPS);
  const ff = spawn("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
    "-r", String(FPS), "-movflags", "+faststart",
    join(OUT, "frames.mp4"),
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((r, j) => ff.on("close", (c) => (c === 0 ? r() : j(new Error("ffmpeg exited " + c)))));
  for (let f = 0; f < total; f++) {
    const buf = await frameAt(f / FPS);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % 60 === 0) console.log(`frame ${f}/${total}`);
  }
  ff.stdin.end();
  await done;
  console.log("wrote out/frames.mp4");
}

await browser.close();
server.close();
