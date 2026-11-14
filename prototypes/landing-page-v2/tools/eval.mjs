// Evaluate an expression in a fresh headless tab.
// usage: node eval.mjs <url> "<expression>" [waitMs] [scrollY]
const [url, expr, waitArg, scrollArg] = process.argv.slice(2);
const waitMs = Number(waitArg || 6000);
const scrollY = Number(scrollArg || 0);
const created = await (await fetch("http://127.0.0.1:9223/json/new?about:blank", { method: "PUT" })).json();
const ws = new WebSocket(created.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 1;
const pending = new Map();
let loaded;
const loadP = new Promise((r) => (loaded = r));
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method === "Page.loadEventFired" && loaded) loaded();
};
const send = (method, params = {}) => new Promise((res) => { const i = id++; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: Number(process.env.W || 1600), height: Number(process.env.H || 1000), deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url });
await Promise.race([loadP, new Promise((r) => setTimeout(r, 15000))]);
await new Promise((r) => setTimeout(r, waitMs));
if (scrollY > 0) {
  await send("Runtime.evaluate", { expression: `document.documentElement.style.scrollBehavior='auto';window.scrollTo(0,${scrollY});` });
  await new Promise((r) => setTimeout(r, 2500));
}
const out = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
console.log(JSON.stringify(out.result?.result?.value ?? out.result, null, 2));
await fetch(`http://127.0.0.1:9223/json/close/${created.id}`);
ws.close();

