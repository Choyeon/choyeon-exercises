// Generate Choyeon icon assets (light rounded-rect bg + colorful gradient figure)
// matching the user's reference: legacy full composite + adaptive fg/bg, all densities.
// taskSpace / page are globals injected by the ego nodejs runtime.
import { writeFileSync, mkdirSync } from "fs";

const BASE = "D:/WebProjects/ChoyeonExercises";
const SHOTS = BASE + "/docs/screenshots";
const RES = BASE + "/android/app/src/main/res";
const URL = "file:///D:/WebProjects/ChoyeonExercises/docs/screenshots/icon.html";

const dens = [
  { d: "mdpi", s: 48 },
  { d: "hdpi", s: 72 },
  { d: "xhdpi", s: 96 },
  { d: "xxhdpi", s: 144 },
  { d: "xxxhdpi", s: 192 },
];

const task = await taskSpace("choyeon icon gen 2");
const page = task.page("p1");

async function restoreWindow() {
  try {
    await page.cdp("Page.bringToFront", {});
  } catch (e) {}
  try {
    const { windowId } = await task.cdp("Browser.getWindowForTarget", {});
    await task.cdp("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } });
  } catch (e) {}
}

async function shot(query, sizePx, outPath) {
  await page.goto(URL + query);
  await page.waitForTimeout(120);
  await restoreWindow();
  await page.waitForTimeout(60);
  const dpr = await page.evaluate(() => window.devicePixelRatio || 1);
  const model = await page.cdp("DOM.getBoxModel", { nodeId: await (async () => {
    const { root } = await page.cdp("DOM.getDocument", {});
    const { nodeId } = await page.cdp("DOM.querySelector", { nodeId: root.nodeId, selector: "#icon" });
    return nodeId;
  })() });
  const b = model.model.content;
  const x = Math.min(...b.filter((_, i) => i % 2 === 0));
  const y = Math.min(...b.filter((_, i) => i % 2 === 1));
  const w = Math.max(...b.filter((_, i) => i % 2 === 0)) - x;
  const h = Math.max(...b.filter((_, i) => i % 2 === 1)) - y;
  const clip = { x, y, width: w, height: h, scale: 1 / dpr };
  let data;
  for (let i = 0; i < 6; i++) {
    try {
      const r = await page.cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip });
      data = r.data;
      break;
    } catch (e) {
      if (/minimized|window/i.test(e.message || "")) { await restoreWindow(); await page.waitForTimeout(300); continue; }
      throw e;
    }
  }
  writeFileSync(outPath, Buffer.from(data, "base64"));
  console.log("wrote", outPath, "dpr=", dpr, "clip=", Math.round(w) + "x" + Math.round(h));
}

for (const { d, s } of dens) {
  const dir = RES + "/mipmap-" + d;
  mkdirSync(dir, { recursive: true });
  await shot("?size=" + s, s, dir + "/ic_launcher.png");
  await shot("?size=" + s, s, dir + "/ic_launcher_round.png");
  await shot("?size=" + s + "&fg=1", s, dir + "/ic_launcher_foreground.png");
  await shot("?size=" + s + "&bg=1", s, dir + "/ic_launcher_background.png");
}

// Expo assets
await shot("?size=1024", 1024, BASE + "/assets/icon.png");
await shot("?size=512", 512, BASE + "/assets/play-store/icon-512.png");
await shot("?size=512", 512, BASE + "/assets/favicon.png");
await shot("?size=1024&fg=1", 1024, BASE + "/assets/adaptive/ic_launcher_foreground.png");
await shot("?size=1024&bg=1", 1024, BASE + "/assets/adaptive/ic_launcher_background.png");
// docs/screenshots preview
await shot("?size=512", 512, SHOTS + "/icon.png");
await shot("?size=512&fg=1", 512, SHOTS + "/foreground.png");
await shot("?size=512&bg=1", 512, SHOTS + "/background.png");

await task.finish({ keep: [] });
console.log("DONE");
