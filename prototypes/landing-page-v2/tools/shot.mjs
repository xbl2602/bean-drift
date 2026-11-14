// Minimal CDP screenshot helper (no puppeteer). Requires Chrome started with
// --remote-debugging-port=9222 --headless=new.
// usage: node shot.mjs <url> <out.png> [waitMs] [width] [height] [scrollY]
import { writeFileSync } from "node:fs";

const [url, out, waitMsArg, wArg, hArg, scrollArg, clickXArg, clickYArg] = process.argv.slice(2);
const waitMs = Number(waitMsArg || 4000);
const width = Number(wArg || 1600);
const height = Number(hArg || 1000);
const scrollY = Number(scrollArg || 0);
const clickX = clickXArg ? Number(clickXArg) : -1;
const clickY = clickYArg ? Number(clickYArg) : -1;

const created = await (await fetch("http://127.0.0.1:9223/json/new?about:blank", { method: "PUT" })).json();
const ws = new WebSocket(created.webSocketDebuggerUrl);
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let nextId = 1;
const pending = new Map();
const logs = [];
let loaded = null;
const loadPromise = new Promise((res) => (loaded = res));

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === "Page.loadEventFired") {
    loaded && loaded();
  } else if (msg.method === "Runtime.consoleAPICalled") {
    const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(" ");
    if (msg.params.type === "error" || msg.params.type === "warning") logs.push(`[${msg.params.type}] ${text}`);
  } else if (msg.method === "Runtime.exceptionThrown") {
    logs.push(`[exception] ${msg.params.exceptionDetails.text} ${msg.params.exceptionDetails.exception?.description || ""}`);
  }
};

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((res) => {
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url });
await Promise.race([loadPromise, new Promise((r) => setTimeout(r, 15000))]);
if (scrollY > 0) {
  await send("Runtime.evaluate", { expression: `document.documentElement.style.scrollBehavior='auto';window.scrollTo(0, ${scrollY});` });
}
await new Promise((r) => setTimeout(r, waitMs));
if (clickX >= 0 && clickY >= 0) {
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
    await send("Input.dispatchMouseEvent", { type, x: clickX, y: clickY, button: "left", clickCount: 1 });
    await new Promise((r) => setTimeout(r, 180));
  }
  await new Promise((r) => setTimeout(r, 900));
}

const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
writeFileSync(out, Buffer.from(shot.result.data, "base64"));
const info = await send("Runtime.evaluate", {
  expression: `JSON.stringify({
    title: document.title,
    h: document.documentElement.scrollHeight,
    y: window.scrollY,
    secs: Array.from(document.querySelectorAll('main > section')).map(s => [s.className.split(' ')[0], Math.round(s.offsetTop), Math.round(s.offsetHeight)]),
    hidden: Array.from(document.querySelectorAll('.reveal')).filter(e => !e.classList.contains('is-in')).length
  })`,
  returnByValue: true,
});
console.log("saved", out);
console.log(info.result?.result?.value);
if (logs.length) console.log(logs.slice(0, 12).join("\n"));
await fetch(`http://127.0.0.1:9223/json/close/${created.id}`);
ws.close();

