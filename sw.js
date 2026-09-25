/* Page Talk service worker：讓 App 離線可用。
   發布新版 App 時，把 VERSION 加一，手機下次連網開啟就會更新。 */
const VERSION = "1.1.0";
const SHELL = "er-shell-" + VERSION;
const ASSETS = [
  "./", "index.html", "style.css", "app.js", "manifest.webmanifest",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png",
  "fonts/atkinson-400.woff2", "fonts/atkinson-700.woff2", "fonts/bricolage-800.woff2",
  "packs/index.json"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await cache.addAll(ASSETS);
    // 內建讀物也先存起來，第一次打開後就能離線玩
    try{
      const index = await (await fetch("packs/index.json", {cache: "no-store"})).json();
      await cache.addAll(index.packs.filter(p => p.builtin).map(p => `packs/${p.id}.json`));
    }catch(e){}
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for(const key of await caches.keys()){
      if(key.startsWith("er-shell-") && key !== SHELL) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  if(url.origin !== location.origin) return;

  // 書單與讀物：先上網拿最新的，沒網路就用手機裡的
  if(/\/packs\/[^/]+\.json$/.test(url.pathname)){
    event.respondWith((async () => {
      try{
        const res = await fetch(req);
        if(res.ok){
          const cache = await caches.open(SHELL);
          await cache.put(url.pathname.endsWith("/index.json") ? req.url.split("?")[0] : new Request(url.origin + url.pathname), res.clone());
        }
        return res;
      }catch(e){
        const hit = await caches.match(req, {ignoreSearch: true});
        return hit || new Response('{"error":"offline"}', {status: 503, headers: {"Content-Type": "application/json"}});
      }
    })());
    return;
  }

  // App 本體：先用手機裡的（離線也能開），沒有才上網
  event.respondWith((async () => {
    const hit = await caches.match(req, {ignoreSearch: true}) ||
      (req.mode === "navigate" ? await caches.match("index.html") : null);
    if(hit) return hit;
    try{ return await fetch(req); }
    catch(e){ return req.mode === "navigate" ? caches.match("index.html") : Response.error(); }
  })());
});
