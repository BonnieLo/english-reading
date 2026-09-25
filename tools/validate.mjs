// 檢查 packs/ 內的讀物格式：node tools/validate.mjs
import { readFileSync, readdirSync } from "node:fs";

const LV = ["b", "i", "a"], CATS = ["食", "衣", "住", "行", "其他"];
const errors = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const pair = (x) => Array.isArray(x) && x.length === 2 && x.every(s => typeof s === "string" && s.trim());

const index = JSON.parse(readFileSync("packs/index.json", "utf8"));
const ids = new Set();
for (const m of index.packs) {
  const w = `index:${m.id}`;
  if (ids.has(m.id)) err(w, "id 重複");
  ids.add(m.id);
  if (!/^[a-z0-9-]+$/.test(m.id)) err(w, "id 只能用小寫英文、數字、-");
  let p;
  try { p = JSON.parse(readFileSync(`packs/${m.id}.json`, "utf8")); } catch (e) { err(w, `讀不到 packs/${m.id}.json`); continue; }
  for (const k of ["id", "v", "lv", "g", "kind", "title", "zhTitle", "author", "color", "desc", "license", "source"]) {
    if (p[k] === undefined || p[k] === "") err(m.id, `缺少欄位 ${k}`);
    if (k !== "topics" && JSON.stringify(p[k]) !== JSON.stringify(m[k])) err(m.id, `欄位 ${k} 跟 index.json 不一致`);
  }
  if (!Number.isInteger(p.v) || p.v < 1) err(m.id, "v 必須是正整數");
  if (!LV.includes(p.lv)) err(m.id, "lv 必須是 b / i / a");
  if (!Array.isArray(p.topics) || !p.topics.length) { err(m.id, "沒有 topics"); continue; }
  if (m.topics !== p.topics.length) err(m.id, `index.json 的 topics 應為 ${p.topics.length}`);
  p.topics.forEach((t, ti) => {
    const tw = `${m.id} 話題${ti + 1}`;
    if (!t.t || !t.zh) err(tw, "缺少 t / zh 標題");
    if (!CATS.includes(t.cat)) err(tw, `cat 必須是 ${CATS.join("/")}`);
    if (!pair(t.intro)) err(tw, "intro 必須是 [英文, 中文]");
    if (!pair(t.end)) err(tw, "end 必須是 [英文, 中文]");
    if (!Array.isArray(t.turns) || !t.turns.length) err(tw, "沒有 turns");
    (t.turns || []).forEach((u, ui) => {
      const uw = `${tw} 第${ui + 1}輪`;
      if (!pair(u.q)) err(uw, "q 必須是 [英文, 中文]");
      if (!Array.isArray(u.o) || u.o.length !== 3) err(uw, "o 必須剛好 3 個選項");
      (u.o || []).forEach((o, oi) => {
        if (!Array.isArray(o) || o.length !== 5 || !o.every(s => typeof s === "string" && s.trim()))
          err(uw, `選項${"ABC"[oi]} 必須是 5 個字串 [英文, 中文, 解析, 回應英文, 回應中文]`);
      });
      if (!Array.isArray(u.v) || !u.v.length) err(uw, "v 至少要有 1 個單字");
      (u.v || []).forEach(v => {
        if (!Array.isArray(v) || v.length !== 3 || !CATS.includes(v[2])) err(uw, `單字格式錯誤：${JSON.stringify(v)}`);
      });
    });
  });
}
for (const f of readdirSync("packs")) {
  if (f !== "index.json" && f.endsWith(".json") && !ids.has(f.slice(0, -5))) err(f, "沒有列在 index.json");
}
if (errors.length) { console.error(errors.join("\n")); console.error(`\n${errors.length} 個問題`); process.exit(1); }
console.log(`OK：${index.packs.length} 本讀物、${index.packs.reduce((n, p) => n + p.topics, 0)} 個話題格式正確`);
