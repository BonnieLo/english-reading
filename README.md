# Page Talk 書友英語聊天室

手機可以玩、**沒有網路也能玩**的英語學習小遊戲。你會像在跟外國書友聊天一樣討論一本讀物。每一輪有三個回覆可以選（附中文翻譯，沒有標準答案），選完會看到解析，同時學會食、衣、住、行的英文單字。

- **三種程度**：初級（TOEIC 300 以下，書友 Lily）、中級（300–650，Jake）、高級（650–990，Olivia）
- **多種讀物**：經典名著、繪本故事、生活短文，之後會加入新聞類
- **英文朗讀**：用手機內建語音，離線也能用
- **積分、完成進度、單字本**：單字依食衣住行分類
- **備份**：可以匯出、匯入進度，換手機時帶走

## 怎麼安裝到手機

1. 用手機打開 GitHub Pages 網址：`https://bonnielo.github.io/english-reading/`
2. 加到主畫面：
   - **iPhone**：用 Safari 打開，點下方「分享」，選「加入主畫面」。
   - **Android**：用 Chrome 打開，點畫面上的「安裝」，或從選單選「安裝應用程式」。
3. 第一次打開時，App 會把程式和內建讀物存進手機，之後沒網路也能玩。

離線朗讀用的是手機內建語音。Android 如果沒有聲音，請到「設定 › 文字轉語音」下載英文語音。

## 書單怎麼更新

- 手機連上網路時，App 會檢查 `packs/index.json`：
  - 已下載的讀物有新版會**自動更新**。
  - 新讀物會出現在「新讀物」區，點「下載」後離線也能玩。
- App 本身有新版時，把 `sw.js` 裡的 `VERSION` 加一，手機下次連網開啟就會更新。

## 檔案結構

```
index.html              App 頁面
style.css / app.js      樣式與程式
sw.js                   離線快取（Service Worker）
manifest.webmanifest    安裝到主畫面的設定
icons/  fonts/          圖示與內建字型（Atkinson Hyperlegible、Bricolage Grotesque，SIL OFL 授權）
packs/index.json        書單
packs/<id>.json         每本讀物一個檔案
tools/validate.mjs      檢查讀物格式：node tools/validate.mjs
```

## 新增一本讀物

1. 在 `packs/` 新增 `<id>.json`，格式照現有檔案（例如 `packs/red.json`）：
   - `lv`：`b` 初級、`i` 中級、`a` 高級
   - 每個話題有 `intro`、`turns`、`end`
   - 每一輪（turn）有：
     - `q`：書友的問題 `[英文, 中文]`
     - `o`：三個選項，每個是 `[英文, 中文, 解析, 書友回應英文, 書友回應中文]`
     - `v`：單字 `[單字, 中文, 分類]`，分類是 食／衣／住／行／其他
2. 在 `packs/index.json` 加上同樣的基本資料（不含 `topics` 內容，只放話題數量）。
   - `builtin: true`：第一次安裝就會內建。
   - `builtin: false`：出現在「新讀物」讓使用者自己下載。
3. 修改既有讀物時，把 pack 檔和 `index.json` 裡的 `v` 都加一，手機才會更新。
4. 執行 `node tools/validate.mjs` 確認格式正確，再推上 GitHub。

## 內容來源與授權

聊天內容都是改寫成對話和摘要，不直接貼原文，每本讀物都會標示出處與授權。

| 類型 | 來源 | 授權 |
|---|---|---|
| 經典名著 | Project Gutenberg、Standard Ebooks | 公有領域 |
| 繪本故事 | StoryWeaver、Global Digital Library | CC BY 4.0（需註明出處） |
| 新聞 | VOA Learning English（排除 AP、Reuters 等轉載內容） | 美國政府作品，大多為公有領域 |
| 生活短文 | Page Talk 原創 | — |

BBC News、BBC Learning English 等有版權的內容**不使用**。
