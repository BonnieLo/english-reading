/* Page Talk 書友英語聊天室
   讀物（pack）存在瀏覽器的 Cache Storage，離線也能玩；連上網時會檢查 packs/index.json，
   自動更新已下載的讀物，並列出可以下載的新讀物。 */

const LEVELS = {
  b:{zh:"初級",toeic:"TOEIC 300 以下",name:"Lily",city:"Toronto",lang:"en-US",rate:.85,intro:"加拿大書友，說話慢、句子短"},
  i:{zh:"中級",toeic:"TOEIC 300–650",name:"Jake",city:"Sydney",lang:"en-AU",rate:.95,intro:"澳洲書友，日常生活對話"},
  a:{zh:"高級",toeic:"TOEIC 650–990",name:"Olivia",city:"London",lang:"en-GB",rate:1,intro:"英國書友，深入討論文學與社會"}
};
const CATS = ["食","衣","住","行","其他"];
const CAT_NAME = {"食":"Food","衣":"Clothing","住":"Home","行":"Transport","其他":"More words"};
const PACK_CACHE = "er-packs";

/* ---------- State ---------- */
const KEY = "pagetalk-v1";
const S = {level:"b",genre:"全部",points:0,words:{},done:{},zh:true,voice:true,hideInstall:false};
try{ Object.assign(S, JSON.parse(localStorage.getItem(KEY) || "{}")); }catch(e){}
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} }

let BOOKS = [];          // 已安裝的讀物（完整內容）
let INDEX = null;        // 書單 packs/index.json
let checking = false;
const busyIds = new Set();

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wait = ms => new Promise(r => setTimeout(r, ms));
const ICON_SAY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7"/><path d="M18.5 5.5a9 9 0 010 13"/></svg>';
const ICON_BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';

/* ---------- Packs: 下載、更新、離線讀取 ---------- */
const hasCache = "caches" in window;
const packUrl = id => `packs/${encodeURIComponent(id)}.json`;
function validPack(p){ return p && typeof p.id === "string" && LEVELS[p.lv] && Array.isArray(p.topics) && p.topics.length; }

async function loadInstalled(){
  BOOKS = [];
  if(!hasCache) return;
  try{
    const c = await caches.open(PACK_CACHE);
    for(const req of await c.keys()){
      try{ const p = await (await c.match(req)).json(); if(validPack(p)) BOOKS.push(p); }catch(e){}
    }
  }catch(e){}
  sortBooks();
}
function sortBooks(){
  const order = INDEX ? INDEX.packs.map(p => p.id) : [];
  BOOKS.sort((a, b) => {
    const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.title.localeCompare(b.title);
  });
}
async function fetchIndex(){
  try{
    const r = await fetch("packs/index.json", {cache: "no-cache"});
    if(!r.ok) throw 0;
    const j = await r.json();
    if(Array.isArray(j.packs)) INDEX = j;
  }catch(e){}
}
async function installPack(meta){
  busyIds.add(meta.id); renderHome();
  try{
    const r = await fetch(`${packUrl(meta.id)}?v=${encodeURIComponent(meta.v)}`, {cache: "no-store"});
    if(!r.ok) throw new Error(r.status);
    const p = await r.json();
    if(!validPack(p)) throw new Error("格式不正確");
    if(hasCache){
      const c = await caches.open(PACK_CACHE);
      await c.put(packUrl(p.id), new Response(JSON.stringify(p), {headers: {"Content-Type": "application/json"}}));
    }
    BOOKS = BOOKS.filter(b => b.id !== p.id).concat(p); sortBooks();
    return true;
  }catch(e){
    return false;
  }finally{
    busyIds.delete(meta.id);
  }
}
function installedVersion(id){ const b = BOOKS.find(b => b.id === id); return b ? (b.v || 0) : null; }
function newPacks(){ return INDEX ? INDEX.packs.filter(m => installedVersion(m.id) === null) : []; }

/* 開啟時：內建讀物自動裝好，已裝的讀物有新版就自動更新 */
async function syncPacks(manual){
  if(checking) return; checking = true; renderHome();
  await fetchIndex();
  let updated = 0, failed = 0;
  if(INDEX){
    sortBooks();
    for(const m of INDEX.packs){
      const have = installedVersion(m.id);
      if((have === null && m.builtin) || (have !== null && m.v > have)){
        (await installPack(m)) ? (have === null ? 0 : updated++) : failed++;
      }
    }
  }
  if(!hasCache && INDEX){ // 不支援快取的瀏覽器：直接讀
    for(const m of INDEX.packs) if(installedVersion(m.id) === null) await installPack(m);
  }
  checking = false; renderHome();
  if(manual){
    if(!navigator.onLine) toast("目前離線，連上網再檢查");
    else if(failed) toast(`有 ${failed} 本讀物下載失敗，稍後再試`);
    else toast(updated ? `已更新 ${updated} 本讀物` : (newPacks().length ? `有 ${newPacks().length} 本新讀物可以下載` : "書單已是最新"));
  }else if(updated) toast(`已自動更新 ${updated} 本讀物`);
}

/* ---------- Speech ---------- */
const canSpeak = "speechSynthesis" in window;
let voices = [];
function loadVoices(){ try{ voices = speechSynthesis.getVoices(); }catch(e){} }
if(canSpeak){ loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function speak(text, queue){
  if(!canSpeak) return;
  try{
    const lv = LEVELS[C ? C.book.lv : S.level];
    if(!queue) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lv.lang; u.rate = lv.rate;
    const v = voices.find(v => v.lang.replace("_","-") === lv.lang) || voices.find(v => /^en/i.test(v.lang));
    if(v) u.voice = v;
    speechSynthesis.speak(u);
  }catch(e){}
}

/* ---------- Toast ---------- */
let toastT;
function toast(html){
  const t = $("#toast"); t.innerHTML = html; t.classList.add("on");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2400);
}

/* ---------- Install (加到主畫面) ---------- */
let installEvt = null;
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; renderHome(); });
addEventListener("appinstalled", () => { installEvt = null; toast("已安裝！之後從主畫面打開就能離線玩"); renderHome(); });
function installBanner(){
  if(isStandalone() || S.hideInstall) return "";
  if(installEvt) return `<div class="banner"><p>安裝到主畫面，沒有網路也能玩。</p><button class="btn primary" id="doInstall">安裝</button><button class="linkbtn" id="hideInstall">不用了</button></div>`;
  if(isIOS) return `<div class="banner"><p>在 Safari 點下方的「分享」按鈕，選「加入主畫面」，之後沒有網路也能玩。</p><button class="linkbtn" id="hideInstall">知道了</button></div>`;
  return "";
}

/* ---------- Home ---------- */
const topicId = (b, i) => b.id + ":" + i;
function renderHome(){
  if(!$("#home") || $("#home").hidden) return;
  const lv = LEVELS[S.level];
  const books = BOOKS.filter(b => b.lv === S.level);
  const genres = ["全部", ...new Set(BOOKS.map(b => b.g))];
  if(!genres.includes(S.genre)) S.genre = "全部";
  const shown = books.filter(b => S.genre === "全部" || b.g === S.genre);
  const nWords = Object.keys(S.words).length;
  const nDone = Object.keys(S.done).length;
  const nTopics = BOOKS.reduce((n, b) => n + b.topics.length, 0);
  const fresh = newPacks();
  const on = navigator.onLine;

  $("#home").innerHTML = `
    <header class="top">
      <div class="brand"><h1>Page <span>Talk</span></h1><p class="zh">書友英語聊天室 · 邊聊讀物邊學食衣住行單字</p></div>
      <button class="wb-btn" id="openWords"><b>${nWords}</b><span class="zh">單字本</span></button>
    </header>
    ${installBanner()}
    <div class="stats">
      <div class="stat"><b>${S.points}</b><span class="zh">聊天積分</span></div>
      <div class="stat"><b>${nWords}</b><span class="zh">學會單字</span></div>
      <div class="stat"><b>${nDone}<small style="font-size:.8rem;color:var(--muted)"> / ${nTopics}</small></b><span class="zh">完成話題</span></div>
    </div>
    <div class="netline"><span class="dot${on ? " on" : ""}"></span><span>${on ? "線上" : "離線中，已下載的讀物都能玩"} · 已下載 ${BOOKS.length} 本讀物</span>
      <button class="linkbtn" id="checkUpd" ${checking ? "disabled" : ""}>${checking ? "檢查中…" : "檢查書單更新"}</button></div>
    ${fresh.length ? `<div class="label">新讀物 New</div><div class="store">${fresh.map(storeItem).join("")}</div>
      ${fresh.length > 1 ? `<div class="btns" style="justify-content:flex-start;margin-top:8px"><button class="btn" id="getAll">全部下載（${fresh.length} 本）</button></div>` : ""}` : ""}
    <div class="label">程度 Level</div>
    <div class="levels">${Object.entries(LEVELS).map(([k, l]) => `
      <button class="lv" data-lv="${k}" aria-pressed="${k === S.level}"><b>${l.zh}</b><small>${l.toeic}</small></button>`).join("")}
    </div>
    <div class="partner-line"><span class="avatar">${lv.name[0]}</span><span class="zh">今天的書友：<b style="color:var(--ink)">${lv.name}</b>（${lv.city}）· ${lv.intro}</span></div>
    <div class="label">類型 Genre</div>
    <div class="chips">${genres.map(g => {
      const has = g === "全部" || books.some(b => b.g === g);
      return `<button class="chip" data-g="${esc(g)}" aria-pressed="${g === S.genre}"${has ? "" : ' style="opacity:.45"'}>${esc(g)}</button>`;
    }).join("")}</div>
    <div class="label">書架 Bookshelf · ${lv.zh}</div>
    <div class="books">${shown.length ? shown.map(bookCard).join("") : emptyShelf(lv)}</div>
    <div class="panel" id="backup">
      <h3>備份進度</h3>
      <p>進度存在這支手機裡。換手機或清除瀏覽資料前，先匯出備份；到新手機再貼上匯入。</p>
      <div class="btns"><button class="btn" id="exp">匯出備份</button><button class="btn" id="imp">匯入備份</button></div>
      <div id="bkBox" hidden><textarea id="bkText" aria-label="備份內容"></textarea>
        <div class="btns"><button class="btn primary" id="bkAct"></button><button class="btn" id="bkClose">關閉</button></div></div>
    </div>
    <p class="foot">點任一個話題開始聊天。每一輪有三個回覆可以選，沒有標準答案，選哪個都有不同的回應和解析。點<b>底線單字</b>或「聽」可以聽發音。
      離線朗讀使用手機內建語音；Android 如果沒有聲音，請到「設定 › 文字轉語音」下載英文語音。
      <br><button class="reset" id="reset">清除我的進度</button> <span id="resetAsk" hidden> 確定要清除？ <button class="reset" id="resetYes">確定清除</button></span></p>`;
}
function emptyShelf(lv){
  if(!BOOKS.length) return `<div class="empty">${checking ? "正在準備讀物…" : "還沒有讀物。請連上網路後按「檢查書單更新」。"}</div>`;
  const other = BOOKS.filter(b => b.g === S.genre);
  return `<div class="empty">${lv.zh}還沒有「${esc(S.genre)}」類的讀物。試試其他程度，或選「全部」。<br><br>${
    other.map(b => `<button class="chip" data-jump="${b.lv}">${LEVELS[b.lv].zh}：${esc(b.zhTitle)}</button>`).join(" ")}</div>`;
}
function storeItem(m){
  const busy = busyIds.has(m.id);
  return `<div class="sitem"><span class="sw" style="--c:${esc(m.color)}"></span>
    <div class="si"><b>${esc(m.title)}</b><small>${LEVELS[m.lv] ? LEVELS[m.lv].zh : ""} · ${esc(m.g)} · ${esc(m.zhTitle)} · ${m.topics} 個話題</small></div>
    <button class="btn primary" data-get="${esc(m.id)}" ${busy || !navigator.onLine ? "disabled" : ""}>${busy ? "下載中…" : "下載"}</button></div>`;
}
function bookCard(b){
  const src = b.url ? `<a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.source)}</a>` : esc(b.source || "");
  return `<article class="book">
    <div class="cover" style="--c:${esc(b.color)}"><span class="genre">${esc(b.g)}</span><h3>${esc(b.title)}</h3><p>${esc(b.author)} · <span class="zh">${esc(b.zhTitle)}</span></p></div>
    <div class="binfo"><p class="desc">${esc(b.desc)}</p>
      <ul class="topics">${b.topics.map((t, i) => {
        const done = S.done[topicId(b, i)];
        return `<li><button class="topic" data-b="${esc(b.id)}" data-t="${i}"><span class="cat" data-c="${esc(t.cat)}">${esc(t.cat)}</span><span class="tt">${esc(t.t)}<small>${esc(t.zh)}</small></span><span class="go${done ? " done" : ""}">${done ? "已聊過 ✓" : "開始聊 →"}</span></button></li>`;
      }).join("")}</ul>
      <p class="src">${esc(b.kind || "")} · ${esc(b.license || "")}${src ? " · " + src : ""}</p>
    </div></article>`;
}
function exportText(){ return JSON.stringify({app:"page-talk",v:1,at:new Date().toISOString(),points:S.points,words:S.words,done:S.done}); }

$("#home").addEventListener("click", async e => {
  const lvB = e.target.closest("[data-lv]"); if(lvB){ S.level = lvB.dataset.lv; save(); renderHome(); return; }
  const g = e.target.closest("[data-g]"); if(g){ S.genre = g.dataset.g; save(); renderHome(); return; }
  const j = e.target.closest("[data-jump]"); if(j){ S.level = j.dataset.jump; save(); renderHome(); return; }
  const t = e.target.closest(".topic"); if(t){ openTopic(t.dataset.b, +t.dataset.t); return; }
  const get = e.target.closest("[data-get]");
  if(get){
    const m = INDEX.packs.find(p => p.id === get.dataset.get);
    const ok = await installPack(m); renderHome();
    toast(ok ? `已下載《${esc(m.zhTitle)}》，離線也能玩` : "下載失敗，請確認網路後再試");
    return;
  }
  if(e.target.closest("#getAll")){
    let n = 0; for(const m of newPacks()) if(await installPack(m)) n++;
    renderHome(); toast(`已下載 ${n} 本讀物`); return;
  }
  if(e.target.closest("#checkUpd")){ syncPacks(true); return; }
  if(e.target.closest("#doInstall") && installEvt){ installEvt.prompt(); try{ await installEvt.userChoice; }catch(_){} installEvt = null; renderHome(); return; }
  if(e.target.closest("#hideInstall")){ S.hideInstall = true; save(); renderHome(); return; }
  if(e.target.closest("#openWords")){ showWords(); return; }
  if(e.target.closest("#exp")){
    $("#bkBox").hidden = false; $("#bkText").value = exportText(); $("#bkAct").textContent = "複製";
    $("#bkAct").dataset.mode = "copy"; $("#bkText").select(); return;
  }
  if(e.target.closest("#imp")){
    $("#bkBox").hidden = false; $("#bkText").value = ""; $("#bkText").placeholder = "把匯出的備份文字貼在這裡";
    $("#bkAct").textContent = "匯入"; $("#bkAct").dataset.mode = "import"; $("#bkText").focus(); return;
  }
  if(e.target.closest("#bkClose")){ $("#bkBox").hidden = true; return; }
  if(e.target.closest("#bkAct")){
    if($("#bkAct").dataset.mode === "copy"){
      try{ await navigator.clipboard.writeText($("#bkText").value); toast("已複製備份，貼到記事本或傳給自己保存"); }
      catch(_){ $("#bkText").select(); toast("請長按選取文字後複製"); }
    }else{
      try{
        const d = JSON.parse($("#bkText").value.trim());
        if(d.app !== "page-talk" || typeof d.points !== "number") throw 0;
        S.points = d.points; S.words = d.words || {}; S.done = d.done || {}; save(); renderHome(); toast("已匯入備份");
      }catch(_){ toast("這不是 Page Talk 的備份文字，請重新複製後再貼上"); }
    }
    return;
  }
  if(e.target.closest("#reset")){ $("#resetAsk").hidden = false; return; }
  if(e.target.closest("#resetYes")){ S.points = 0; S.words = {}; S.done = {}; save(); renderHome(); toast("已清除進度"); }
});
addEventListener("online", () => { renderHome(); syncPacks(false); });
addEventListener("offline", renderHome);

/* ---------- Word book ---------- */
function showWords(){
  const el = $("#words");
  const entries = Object.entries(S.words);
  el.innerHTML = `<div class="wb-head"><button class="icon-btn" id="wBack" aria-label="回書架">${ICON_BACK}</button><h2>單字本</h2></div>
  <p class="zh" style="color:var(--muted);margin:.3rem 0 0">聊天中學過的單字會自動收進來，依食衣住行分類。點單字聽發音。</p>
  ${entries.length ? CATS.map(c => {
    const list = entries.filter(([, v]) => v[1] === c).sort((a, b) => a[0].localeCompare(b[0]));
    if(!list.length) return "";
    return `<section class="wgroup"><h3><span class="cat" data-c="${c}">${c}</span>${CAT_NAME[c]} <small>${list.length}</small></h3>
      <div class="wlist">${list.map(([w, v]) => `<button class="witem" data-say="${esc(w)}"><b>${esc(w)}</b><span>${esc(v[0])}</span></button>`).join("")}</div></section>`;
  }).join("") : `<div class="empty">還沒有單字。回書架選一本讀物開始聊天，每聊一輪就會收集 4–5 個新單字。</div>`}`;
  $("#home").hidden = true; el.hidden = false; scrollTo(0, 0);
}
$("#words").addEventListener("click", e => {
  if(e.target.closest("#wBack")){ $("#words").hidden = true; $("#home").hidden = false; renderHome(); return; }
  const s = e.target.closest("[data-say]"); if(s) speak(s.dataset.say);
});

/* ---------- Chat ---------- */
let C = null;
const msgs = $("#msgs"), opts = $("#opts");
function scrollDown(){ requestAnimationFrame(() => msgs.scrollTo({top: msgs.scrollHeight, behavior: "smooth"})); }

function buildVocab(topic){
  const map = {};
  topic.turns.forEach(t => t.v.forEach(v => { map[v[0].toLowerCase()] = v; }));
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  const re = keys.length ? new RegExp("\\b(" + keys.map(reEsc).join("|") + ")(?:s|es)?\\b", "gi") : null;
  return {map, re};
}
function hl(text){
  const s = esc(text);
  if(!C.vocab.re) return s;
  return s.replace(C.vocab.re, (m, base) => `<button class="w" data-w="${esc(base.toLowerCase())}">${m}</button>`);
}

function openTopic(bid, ti){
  const book = BOOKS.find(b => b.id === bid), topic = book && book.topics[ti];
  if(!topic) return;
  C = {book, ti, topic, turn: 0, sel: -1, busy: false, run: {}};
  C.vocab = buildVocab(topic);
  const lv = LEVELS[book.lv];
  $("#cAvatar").textContent = lv.name[0];
  $("#cTitle").textContent = `${lv.name} · ${book.title}`;
  $("#cSub").textContent = `${topic.zh}（${topic.t}）`;
  msgs.innerHTML = ""; opts.innerHTML = "";
  $("#chat").hidden = false; document.body.style.overflow = "hidden";
  syncToggles(); renderProgress();
  addSys(`<b>${esc(book.title)}</b>${esc(book.zhTitle)} · ${esc(book.g)}<br>話題：${esc(topic.t)}（${esc(topic.zh)}）`);
  flow(C.run);
}
function closeChat(){
  if(C) C.run.cancelled = true;
  if(canSpeak) try{ speechSynthesis.cancel(); }catch(e){}
  C = null; $("#chat").hidden = true; document.body.style.overflow = "";
  $("#words").hidden = true; $("#home").hidden = false; renderHome();
}
$("#back").addEventListener("click", closeChat);

function renderProgress(){
  const n = C.topic.turns.length;
  $("#prog").innerHTML = Array.from({length: n}, (_, i) => `<i class="${i < C.turn ? "on" : ""}"></i>`).join("") + `<span>${Math.min(C.turn, n)}/${n}</span>`;
}
function syncToggles(){
  $("#zhTog").setAttribute("aria-pressed", S.zh);
  $("#voTog").setAttribute("aria-pressed", S.voice);
  $("#voTog").hidden = !canSpeak;
  document.body.classList.toggle("hide-zh", !S.zh);
}
$("#zhTog").addEventListener("click", () => { S.zh = !S.zh; save(); syncToggles(); toast(S.zh ? "顯示書友訊息的中文翻譯" : "隱藏書友訊息的中文翻譯（挑戰模式）"); });
$("#voTog").addEventListener("click", () => { S.voice = !S.voice; save(); syncToggles(); if(!S.voice && canSpeak) speechSynthesis.cancel(); toast(S.voice ? "自動朗讀：開" : "自動朗讀：關"); });

function addSys(html){ const d = document.createElement("div"); d.className = "sys zh"; d.innerHTML = html; msgs.appendChild(d); scrollDown(); }
function addBubble(who, en, zh){
  const lv = LEVELS[C.book.lv];
  const row = document.createElement("div");
  row.className = "row " + who;
  row.innerHTML = `${who === "them" ? `<div class="avatar">${lv.name[0]}</div>` : ""}
    <div class="bubble"><div class="en">${who === "them" ? hl(en) : esc(en)}</div><div class="zh">${esc(zh)}</div>
    ${canSpeak ? `<button class="say" data-say="${esc(en)}">${ICON_SAY}<span>聽</span></button>` : ""}</div>`;
  msgs.appendChild(row); scrollDown();
}
async function partnerSay(run, en, zh){
  const lv = LEVELS[C.book.lv];
  const row = document.createElement("div");
  row.className = "row them";
  row.innerHTML = `<div class="avatar">${lv.name[0]}</div><div class="bubble typing" aria-label="typing"><i></i><i></i><i></i></div>`;
  msgs.appendChild(row); scrollDown();
  await wait(Math.min(1500, 500 + en.length * 10));
  row.remove();
  if(run.cancelled) return;
  addBubble("them", en, zh);
  if(S.voice) speak(en, true);
}
async function flow(run){
  const tp = C.topic;
  await partnerSay(run, ...tp.intro); if(run.cancelled) return;
  await wait(300);
  await partnerSay(run, ...tp.turns[0].q); if(run.cancelled) return;
  showOptions();
}
function showOptions(){
  const t = C.topic.turns[C.turn];
  C.sel = -1; C.busy = false;
  opts.innerHTML = `<div class="opts-head"><span>選一句回覆 ${LEVELS[C.book.lv].name}</span><span>沒有標準答案</span></div>` +
    t.o.map((o, j) => `
    <div class="opt" data-j="${j}">
      <div class="opt-top">
        <button class="opt-pick" data-pick="${j}" aria-expanded="false"><span class="letter">${"ABC"[j]}</span><span><span class="en">${esc(o[0])}</span><span class="zh">${esc(o[1])}</span></span></button>
        ${canSpeak ? `<button class="opt-say" data-say="${esc(o[0])}" aria-label="聽這句">${ICON_SAY}</button>` : ""}
      </div>
      <div class="opt-more" hidden><p class="note">${esc(o[2])}</p><button class="send" data-send="${j}">送出這句 →</button></div>
    </div>`).join("");
  opts.scrollTop = 0;
}
opts.addEventListener("click", e => {
  const s = e.target.closest("[data-say]"); if(s){ speak(s.dataset.say); return; }
  const p = e.target.closest("[data-pick]");
  if(p){
    const j = +p.dataset.pick;
    C.sel = C.sel === j ? -1 : j;
    opts.querySelectorAll(".opt").forEach((el, k) => {
      const on = k === C.sel;
      el.classList.toggle("sel", on);
      el.querySelector(".opt-more").hidden = !on;
      el.querySelector(".opt-pick").setAttribute("aria-expanded", on);
    });
    if(C.sel >= 0){
      if(S.voice) speak(C.topic.turns[C.turn].o[j][0]);
      requestAnimationFrame(() => opts.querySelector(".opt.sel")?.scrollIntoView({block: "nearest", behavior: "smooth"}));
    }
    return;
  }
  const sd = e.target.closest("[data-send]"); if(sd) send(+sd.dataset.send);
});
async function send(j){
  if(C.busy) return; C.busy = true;
  const run = C.run, t = C.topic.turns[C.turn], o = t.o[j];
  opts.innerHTML = "";
  if(canSpeak) try{ speechSynthesis.cancel(); }catch(e){}
  addBubble("me", o[0], o[1]);
  addExplain(t, j);
  await wait(250);
  await partnerSay(run, o[3], o[4]); if(run.cancelled) return;
  addVocab(t.v);
  S.points += 10;
  t.v.forEach(v => { S.words[v[0]] = [v[1], v[2]]; });
  save();
  C.turn++; renderProgress();
  if(C.turn < C.topic.turns.length){
    await wait(500);
    await partnerSay(run, ...C.topic.turns[C.turn].q); if(run.cancelled) return;
    showOptions();
  }else{
    await wait(400);
    await partnerSay(run, ...C.topic.end); if(run.cancelled) return;
    finish();
  }
}
function addExplain(t, j){
  const d = document.createElement("div");
  d.className = "card";
  d.innerHTML = `<h4>回覆解析</h4><div class="note">${esc(t.o[j][2])}</div>
    <details><summary>看三個選項的意思</summary><ul class="explain-list">${t.o.map((o, k) => `
      <li class="${k === j ? "picked" : ""}"><div class="en">${"ABC"[k]}. ${esc(o[0])}${k === j ? '<span class="tag">你的選擇</span>' : ""}</div><div class="zh">${esc(o[1])}</div><div class="n">${esc(o[2])}</div></li>`).join("")}
    </ul></details>`;
  msgs.appendChild(d); scrollDown();
}
function addVocab(v){
  const d = document.createElement("div");
  d.className = "card";
  d.innerHTML = `<h4>這一輪的單字 · +10 分</h4><div class="vchips">${v.map(w => `
    <button class="vchip" data-say="${esc(w[0])}"><span class="cat" data-c="${esc(w[2])}">${esc(w[2])}</span><b>${esc(w[0])}</b><span>${esc(w[1])}</span></button>`).join("")}</div>`;
  msgs.appendChild(d); scrollDown();
}
function finish(){
  const id = topicId(C.book, C.ti);
  const first = !S.done[id];
  S.done[id] = true; S.points += 30; save();
  const next = C.book.topics[C.ti + 1];
  const nWords = C.topic.turns.reduce((n, t) => n + t.v.length, 0);
  const d = document.createElement("div");
  d.className = "end-card";
  d.innerHTML = `<div class="big">Chapter complete!</div>
    <p>聊完「${esc(C.topic.zh)}」${first ? "" : "（再聊一次）"} · 完成獎勵 +30 分 · 這個話題有 ${nWords} 個單字<br>目前總分 ${S.points} 分</p>
    <div class="btns">
      ${next ? `<button class="btn primary" data-next="${C.ti + 1}">下一個話題：${esc(next.zh)}</button>` : ""}
      <button class="btn" data-again="1">換個選項再聊一次</button>
      <button class="btn${next ? "" : " primary"}" data-home="1">回書架</button>
    </div>`;
  msgs.appendChild(d); scrollDown();
}
msgs.addEventListener("click", e => {
  const s = e.target.closest("[data-say]"); if(s){ speak(s.dataset.say); return; }
  const w = e.target.closest(".w");
  if(w && C){
    const v = C.vocab.map[w.dataset.w];
    if(v){ speak(v[0]); toast(`<b>${esc(v[0])}</b><small>${esc(v[1])} · ${esc(v[2])}</small>`); }
    return;
  }
  const n = e.target.closest("[data-next]"); if(n){ const b = C.book.id; C.run.cancelled = true; openTopic(b, +n.dataset.next); return; }
  if(e.target.closest("[data-again]")){ const b = C.book.id, t = C.ti; C.run.cancelled = true; openTopic(b, t); return; }
  if(e.target.closest("[data-home]")) closeChat();
});

/* ---------- Boot ---------- */
if("serviceWorker" in navigator && location.protocol !== "file:"){
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => { if(hadController) toast("App 已更新到新版本"); });
}
(async () => {
  renderHome();
  await loadInstalled();
  renderHome();
  syncPacks(false);
})();
