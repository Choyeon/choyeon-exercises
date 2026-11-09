// Composite the ORIGINAL logo artwork (C-arc + runner, from git 6738e84)
// onto the light rounded-square background drawn earlier. Rendered on a canvas
// so alpha is preserved (no screenshot, no headed-browser white compositing).
// taskSpace / page are globals injected by the ego nodejs runtime.
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const BASE = "D:/WebProjects/ChoyeonExercises";
const SHOTS = BASE + "/docs/screenshots";
const RES = BASE + "/android/app/src/main/res";
// Original logo artwork is kept in the repo as the source of truth (git 6738e84).
const LOGO = SHOTS + "/original-logo.png";
const logoB64 = readFileSync(LOGO).toString("base64");

const html = [
  '<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:transparent}</style></head><body>',
  '<script>',
  'var logoData="data:image/png;base64,' + logoB64 + '";',
  'var logo=new Image();',
  'window.ready=new Promise(function(r){logo.onload=function(){r(1)};logo.src=logoData;});',
  // bounding box of the non-transparent artwork + alpha diagnostics
  'window.info=function(){',
  '  var c=document.createElement("canvas");c.width=logo.width;c.height=logo.height;',
  '  var x=c.getContext("2d");x.drawImage(logo,0,0);',
  '  var d=x.getImageData(0,0,c.width,c.height).data;',
  '  var x0=1e9,y0=1e9,x1=-1,y1=-1,trans=0;',
  '  for(var y=0;y<c.height;y++)for(var px=0;px<c.width;px++){',
  '    var a=d[(y*c.width+px)*4+3];',
  '    if(a<10){trans++;}else{if(px<x0)x0=px;if(px>x1)x1=px;if(y<y0)y0=y;if(y>y1)y1=y;}',
  '  }',
  '  return {w:logo.width,h:logo.height,bbox:[x0,y0,x1,y1],transparent:trans,cornerAlpha:d[3]};',
  '};',
  'function roundPath(x,px,py,w,h,r){x.beginPath();x.moveTo(px+r,py);x.lineTo(px+w-r,py);',
  '  x.quadraticCurveTo(px+w,py,px+w,py+r);x.lineTo(px+w,py+h-r);',
  '  x.quadraticCurveTo(px+w,py+h,px+w-r,py+h);x.lineTo(px+r,py+h);',
  '  x.quadraticCurveTo(px,py+h,px,py+h-r);x.lineTo(px,py+r);',
  '  x.quadraticCurveTo(px,py,px+r,py);x.closePath();}',
  'window.render=function(size,mode,frac){',
  '  var c=document.createElement("canvas");c.width=size;c.height=size;',
  '  var x=c.getContext("2d"), S=size, bg="#F2F2F4", line="#E2E2E8";',
  '  if(mode==="legacy"||mode==="round"){',
  '    var pad=S*0.0059, rad=S*0.2305;',
  '    roundPath(x,pad,pad,S-2*pad,S-2*pad,rad);x.fillStyle=bg;x.fill();',
  '    var ins=S*0.0137, rad2=S*0.2227;',
  '    roundPath(x,ins,ins,S-2*ins,S-2*ins,rad2);x.strokeStyle=line;x.lineWidth=S*0.0049;x.stroke();',
  '  } else if(mode==="bg"){ x.fillStyle=bg; x.fillRect(0,0,S,S); }',
  '  if(mode!=="bg"){',
  '    var i=window.info(), b=i.bbox;',
  '    var sx=b[0],sy=b[1],sw=b[2]-b[0]+1,sh=b[3]-b[1]+1;',
  '    var dw=S*frac, dh=dw*sh/sw;',
  '    x.drawImage(logo,sx,sy,sw,sh,(S-dw)/2,(S-dh)/2,dw,dh);',
  '  }',
  '  return c.toDataURL("image/png").split(",")[1];',
  '};',
  '</script></body></html>',
].join("\n");
writeFileSync(SHOTS + "/_icon_compose.html", html);

const task = await taskSpace("choyeon original-logo icon");
const page = task.page("p1");
await page.goto("file:///D:/WebProjects/ChoyeonExercises/docs/screenshots/_icon_compose.html");
await page.waitForTimeout(300);

async function ev(expr) {
  const r = await page.cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
await ev("window.ready");
const info = await ev("window.info()");
console.log("LOGO INFO", JSON.stringify(info));

// frac: share of the canvas occupied by the artwork's visible bounding box.
// legacy/round -> the reference look; fg -> 108dp adaptive canvas (visible 72dp).
// width-based scale: logo bbox is 360x444 (taller than wide).
// reference: logo ~57% of the square's width / ~70% of its height.
// adaptive fg canvas is 108dp while visible area is ~72dp -> 0.57*72/108 = 0.38
const FRAC = { legacy: 0.57, round: 0.57, fg: 0.38 };

async function make(size, mode, out) {
  const b64 = await ev("window.render(" + size + ',"' + mode + '",' + (FRAC[mode] || 0) + ")");
  mkdirSync(out.substring(0, out.lastIndexOf("/")), { recursive: true });
  writeFileSync(out, Buffer.from(b64, "base64"));
  console.log("wrote", out.replace(BASE + "/", ""), size + "x" + size, mode);
}

// density sizes for legacy icons (dp), and 108dp adaptive layers (px)
const dens = [
  { d: "mdpi", s: 48, a: 108 },
  { d: "hdpi", s: 72, a: 162 },
  { d: "xhdpi", s: 96, a: 216 },
  { d: "xxhdpi", s: 144, a: 324 },
  { d: "xxxhdpi", s: 192, a: 432 },
];

for (const { d, s, a } of dens) {
  const rdir = RES + "/mipmap-" + d;
  await make(s, "legacy", rdir + "/ic_launcher.png");
  await make(s, "round", rdir + "/ic_launcher_round.png");
  await make(a, "fg", rdir + "/ic_launcher_foreground.png");
  await make(a, "bg", rdir + "/ic_launcher_background.png");
  const adir = BASE + "/assets/mipmap-" + d;
  await make(s, "legacy", adir + "/ic_launcher.png");
  await make(s, "round", adir + "/ic_launcher_round.png");
}

// Expo / store assets
await make(1024, "legacy", BASE + "/assets/icon.png");
await make(512, "legacy", BASE + "/assets/play-store/icon-512.png");
await make(512, "legacy", BASE + "/assets/favicon.png");
await make(1024, "fg", BASE + "/assets/adaptive/ic_launcher_foreground.png");
await make(1024, "bg", BASE + "/assets/adaptive/ic_launcher_background.png");

// previews
await make(512, "legacy", SHOTS + "/icon.png");
await make(512, "fg", SHOTS + "/foreground.png");
await make(512, "bg", SHOTS + "/background.png");

await task.finish({ keep: [] });
console.log("DONE");
