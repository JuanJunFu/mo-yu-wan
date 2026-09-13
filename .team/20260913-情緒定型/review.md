# 審查紀錄 <任務ID>

> 由阿審（Codex / GPT）撰寫。跨模型審核：寫的是 Claude，審的是 Codex。
> 每一輪 append 在下方，不覆蓋舊輪——保留迴圈歷史。

---

## 審查輪次 1 — Codex
判定：PASS / FAIL
Codex 版本／指令：<codex review --base main ... 或 codex exec ...>

Blocking 問題（FAIL 必填，附怎麼修）：
- [檔:行] <問題說明> → <建議修法>

Nit（非阻擋小問題）：
- <小問題>

Codex 原文摘錄（忠實，不過度濃縮）：
> <關鍵段落>

Claude 觀點（僅在與 Codex 分歧時補，最終判定仍以 Codex 技術判斷為主）：
- <存疑點 + 原因>

---
<!-- 第 2、3 輪同格式往下 append。第 3 輪仍 FAIL → CEO 升給老闆裁決 -->

## 審查輪次 1 — Codex（實際執行；上方為未填寫的空白模板）

判定：**FAIL**

Codex 版本／指令：
- 執行檔 `/Applications/Codex.app/Contents/Resources/codex`，`codex-cli 0.153.4`，model `gpt-5.6-sol`
- 先試 `codex review --uncommitted`＋自訂 prompt → **被拒**：`error: the argument '--uncommitted' cannot be used with '[PROMPT]'`
- 改用：`codex exec -c 'model_reasoning_effort="high"' -c 'mcp_servers={}' -s workspace-write "<7 條重點清單＋硬性不變量清單>"`（工作目錄＝repo 根，讓 Codex 自己跑 `git diff`／grep／`node --test`）
- 耗時約 17 分鐘，tokens used 226,868，exit 0，**輸出完整未截斷**
- 唯讀驗證：執行前後 `git diff | shasum -a 256` 皆為 `80acb1b5befef751b2be52ce50915c537d34686f4c1d99febc2004c5a0187b4e`，`git status --short` 皆為 `62e59ce1e42bf38f67f0d96363f9b3600e75ddde73bb0254457ff0a670dd3aee` → **Codex 沒有改動 repo 任何檔案**

---

### Blocking 問題

> 阿審已**逐條打開原始碼獨立複驗**，每條標注複驗結果與「是否本批新增」。

**B1｜`server.js:230` 預設回合數改動（Codex 信心 10/10）**
`- room.config.rounds=opts.rounds||(n<=3?6:8);` → `+ room.config.rounds=opts.rounds||(room.solo?4:6);`
Codex：「這是直接改變勝負何時結算的遊戲規則，違反『不加規則，只加情緒』→ 還原原本局數邏輯，另開規則變更任務處理。」
→ **阿審複驗：改動屬實且在 diff 內**（多人 4 人以上局從 8 回合掉到 6 回合）。
→ 🟡 **但這條 Codex 判錯了脈絡，見下方「Claude 觀點」§1。task.md `:242` 有整節 `T6｜砍回合數【老闆 2026-09-13 裁決納入】`，`:249` 明寫「CEO 裁決的數字：solo → 4 回合；多人 → 6 回合」。這是老闆核准的範圍內工作，不是寫手擅自加規則。**

**B2｜`public/focus.js:13`＋`public/focus.css:7` 首局隱藏補給商店（Codex 信心 10/10）**
Codex：「新玩家因此第一局少一組可用操作，這不是純顯示層，而是依裝置歷史改變可玩的選項 → 首局也提供商店入口；若要簡化教學，只降視覺權重，不要移除功能。」
→ **阿審複驗：機制屬實。`focus.js:17-20` `playedBefore()`／`shopVisible()`／`focusShop(){if(!shopVisible())return;…}`，`focus.js:134` 首局把商店按鈕整顆換成純文字「第一局先專心摸魚就好。」。`moyu_played_once` 在 HEAD 中 0 次出現＝本批新增。**
→ 🟡 **但這也是 task.md 明文要求的驗收項：T3 勾選項「**第一局隱藏補給市場**（遵守 C1：要有首次遊玩判定；bot 照買；後端不動）」。Codex 是在反對一個已核准的產品決策，不是抓寫手偏離。見「Claude 觀點」§1。**
→ ℹ️ 另註：`focus.css:7` 的 `.focus-draw>#marketbox{display:none!important}` 在 HEAD 就有（各 1 處），**非本批新增**。

**B3｜`server.js:991` `payload null→{}` 確實改變遊戲狀態，寫手宣稱不成立（Codex 信心 10/10）**
Codex 原文：「全域把 `null`/`undefined` payload 轉成 `{}` 產生實際狀態變更。我實跑得到：`createRoom(null)` 成功建房、`setPassword(null)` 清除密碼、主管 `submitChoice(null)` 成功提交「不協查」並觸發揭曉。寫手宣稱「不會產生不同遊戲結果」是錯的 → 缺少必要 payload 時應直接回 `{error:'無效請求'}`；只對明確允許空物件的 handler 使用預設值。」
→ **阿審複驗全部屬實**：
  - `server.js:1009-1013` `createRoom`：`{}` → `name='玩家'`／`roomName='玩家 的房間'`／`password=''` → 建房成功
  - `server.js:1101-1107` `setPassword`：`password=''` → `room.password=null` → **靜默解除房間密碼**＋`cb({ok:true})`
  - `server.js:1293-1295` 主管 `submitChoice`：`payload.inspectZone===undefined` → `room.choices.emp[me.id]={action:'supervise',zone:null}` → 鎖定「不協查」並可能立刻 `resolveRound`
  - Codex 同時明確排除了提權：「沒有發現藉此繞過冷卻或多拿分數」
→ **這條是本批真正的 blocking：不是「有洞」，是「寫手的驗證宣稱是假的」。**

**B4｜`server.js:293` × `public/focus.js:73` C4 鏡像在猝死回合失準 2900ms（Codex 信心 10/10）**
Codex 原文：「server 公式只涵蓋 `playReveal()`，但本批的過勞死 act 從 `revAnimEndsAt-700` 開始再播 3600ms，因此真正 act 比公式多 2900ms。`multiplayer reveal timer starts…after animation` 的宣稱在過勞死回合不成立 → 將這 2900ms 納入 server 的最大演出時間，或把過勞死演出收進既有 `revAnimEndsAt`。」
→ **阿審複驗屬實**：`focus.js:50` `const KAROSHI_MS=3600;`、`focus.js:73` `const start=Math.max(0,revAnimEndsAt-Date.now()-700);`、`focus.js:80` `return start+KAROSHI_MS;`、`focus.js:86` `revealStageTimer=setTimeout(…,Math.max(board,playKaroshi()));`
→ 即 `-700 + 3600 = +2900ms`。**T2 的猝死演出把 act 拉長，但沒有回頭同步 `server.js` 的 `revealAnimMs`——這正是 C4 警告的那件事真的發生了。**
→ 後果：猝死回合，server 的 `REVEAL_SEC` 15 秒倒數會在演出還沒播完就開始數，多人局最多提前 2.9 秒。不影響結算，但打破「倒數等演出跑完才起算」的老闆裁決。

**B5｜`server.js:603` 搞鬼王「報信命中」歸因錯誤（Codex 信心 9/10）**
Codex 原文：「搞鬼王把『同回合任何 `warned` shield』算成該幽靈報信命中，沒有核對報信目標。我構造兩隻鬼同回合報不同玩家、只有第二隻真的救到人的案例，程式仍把第一隻列為『命中』並頒王 → chronicle 記錄 target/player ID，按同一幽靈行動及同一目標精確配對。」
→ **阿審複驗屬實，程式碼註解自己招了**：
```js
// 報信有沒有真的救到人：同回合出現 shield/warned 就算命中
const hits=acts.filter(a=>a.kind==='warn'&&c.some(s=>s.type==='shield'&&s.kind==='warned'&&s.round===a.round)).length;
```
比對條件只有 `s.round===a.round`，**完全沒有比對 target**。
→ 這條直接打在本任務的最高驗收問題上：**玩家會拿到一頂他其實沒掙到的王冠，而且畫面會編一段他沒做過的事蹟給他看。**「理解自己為什麼得到這個結果」在這裡是假的。

**B6｜`public/index.html:103` × `public/cards.css:2` 終局勝負標題近乎隱形（Codex 信心 10/10）**
Codex 原文：「`#endbanner` 仍使用 `color:var(--wood2)`；實際是 `#ece3c8`，背景是 `#f4eddc`，對比僅 1.10:1。最重要的『老闆／員工獲勝』標題近乎隱形，色碼陷阱尚未清完 → 改用深色 `#4a2c14`（約 10.83:1）或修正 token scope。」
→ **阿審複驗屬實**：`index.html:103` `.banner{…color:var(--wood2)…}`；`index.html:371` `<div class="banner" id="endbanner">`；`index.html:905` 寫入「👔 老闆獲勝！／🏆 員工陣營獲勝！」；`cards.css` 於 `index.html:1037` 載入且把 `--wood2` 重定義為 `#ece3c8`；`focus.css` 對 `.banner` 有 **0** 條覆寫。
→ ⚠️ **但是：`.banner` 那條規則與 `cards.css:2` 的 `--wood2:#ece3c8` 兩者在 HEAD 都已存在（HEAD `index.html:83` 逐字相同）＝本批未新增、也未修好。** Codex 對「新增樣式」的結論是通過的：「新增樣式沒有再直接使用 `var(--wood2)` 當前景，首頁 slogan 也已改成深色；但既有 `.banner` 漏網」。
→ 之所以仍列 blocking：**T5 這批重做的就是終局畫面（三王＋故事書），勝負標題隱形正好落在本批的爆炸半徑內，且直接違反最高驗收問題。**

**B7｜`public/focus.css:143/146` `.bzone.inspected` 演出中途 layout shift（Codex 信心 8/10，視覺體感需人工確認）**
Codex 原文：「`.bzone` 預設 84px，空且未巡查時縮為 42px；第④拍加 `.inspected` 後立即失去縮高規則。`transition` 只涵蓋原始 `.bzone` 的 `box-shadow`/`border-color`，沒有 `min-height`。手機單欄必然推動下面所有區塊。沒有 `@supports selector(:has(*))` fallback…本輪沒有可用的真實 `/browse` 實機環境，未做肉眼錄影驗證。」
→ **阿審複驗數字精準**：`--bz-head:26px --bz-pad:8px --bz-gap:6px --bz-chip:36px` → 預設 `26+16+6+36 = 84px`；空區未巡查 `26+16 = 42px`。**Codex 的 84/42 是自己算出來的，不是猜的。**
→ 修法（Codex）：「在動畫開始前先保留巡查區高度，另用獨立 class 啟動聚光效果。」

**B8｜`public/index.html:687`／`:923` 玩家名稱進 inline `onclick`，`esc()` 不擋引號 → XSS（Codex 信心 10/10）**
Codex 原文：「玩家名稱被放進 inline `onclick`，但 `esc()` 不處理引號。12 字元名稱 `'))top.x=1//` 可形成有效 JavaScript，房主點『資遣』時執行。**這是 HEAD 已存在的漏洞，不是本批新增**，但目前版本仍不安全 → 移除 inline handler，使用 `addEventListener` 和閉包／安全 `data-*` ID。」
→ **阿審複驗屬實且確認為既有漏洞**：`index.html:923` `esc()` 只 replace `[&<>]`，不處理 `'`；`index.html:687` `onclick="if(confirm('確定資遣 ${esc(p.name)}？'))sock.emit('fire',…)"`；該行與 HEAD **逐字相同**（兩邊 `shasum` 均為 `0a29c689…`）。名稱上限 `slice(0,12)`，Codex 的 payload 剛好 12 字元。
→ Codex 自己已標明非本批新增。**建議另開安全任務，不建議當本批的放行閘門。**

---

### Nit（非阻擋）

- `public/focus.js:31` — Codex：「`.rev-head` 契約沒有 assert/null guard；DOM 改動後可能直接 throw，或只搬走 `revtitle` 而把旁白留在原處。」阿審複驗：目前 DOM **成立**（`index.html:342-345` `.rev-head` 底下依序為 `#revtitle`／`#skiprev`／`#actnarr`，同父層），`index.html:338` 也留了警語註解，但程式端確實無 guard。
- `public/focus.css:10` — 多組新增小字未達 4.5:1：`.versus` 2.68:1、金色結果 3.02:1、`#revtitle` 3.82:1、`.rr-where` 3.90:1、`.cf-buff .cf-kind` ≈4.20:1、`.kcard .ksub` ≈4.00:1。（通過的：`.act-narr` 10.30:1、`.home-slogan` 10.83:1。）
- `server.js:1133` — 「多個正常驗證早退仍不回 ack；wrapper 只保證『同步例外』有錯誤 ack，不能保證每條拒絕路徑都有回覆。」
- `server.js:1355` — 「`voice-signal` 未驗證 `to` 是同房語音 peer。socket ID 不易猜，但仍應限制跨房信令。」
- `tests/card-flow.test.cjs:90` — 「所謂跨檔鏡像測試只把 server 公式再手寫一次，沒有讀取或執行前端時序，無法抓到跨檔漂移。」阿審複驗屬實：該測試全部斷言都是拿 `3800+n*480+…` 的硬編碼數字去對 `revealAnimMs`，**完全沒碰 `public/index.html`**。B4 之所以能溜過 29 綠，原因就在這裡。

---

### Codex 對 CEO 七條重點的逐條結論（原文摘錄，未濃縮）

**1. C4 鏡像 — 有問題。**
> - `playReveal()` 本身的計算為：初始 `500 + n*140`／跑馬燈 `g*350 + 300`／手電筒 `1100`／個人結果 `n*220 + 700 + danger*1600`／總結與尾巴 `n*120 + 1200`
> - 合計確實是 `3800 + n*480 + g*350 + danger*1600`，與 `revealAnimMs()` 逐項一致。
> - `n` 兩端都是未過濾的 `r/rv.results.length`；`g` 都是 `ghostNotes.length`；危險判定也都是 zone 命中 boss/supervisor 且 `!supervisor`。這部分通過。
> - 但 `public/focus.js:73-86` 又延長過勞死 act 2900ms，server 不知道這段，因此完整兩段式舞台已失準。
> - 現行最多 6 玩家，`n≤5`；即使用寬鬆上界 `g≤6`，公式最高約 9900ms，不會撞 12000。假設 8 人總局、`n=7,g=8,danger=true` 是 11560ms；再更大的異常資料才會截頂。截頂時 server 會比前端提早進入 15 秒讀取期。
> - `room.revealAnimMs` 只被傳到 view，前端沒有讀；真正影響在 `startTimer(animMs/1000+REVEAL_SEC)` 和 `revealSkipAt`。它不改分數／心悸／出局計算，但確實控制 `advanceRound()` 的時間及 `nextRound` gate，因此**不是「完全不進狀態轉移條件」，只是只改變轉移時間、不改勝負公式**。

→ 直接回答 CEO 的問題：公式在**非猝死回合**與前端一致（Codex 逐段加總驗過）；`12000` 上限在現行 6 人上限下**碰不到**（最高約 9900ms），設計合理；「失準只影響倒數早晚不影響結算」**大致成立但 Codex 修正了措辭**——它確實會改變 `advanceRound()` 的觸發時間與 `nextRound` gate，只是不進勝負公式。

**2. `guardHandlers` on/onNoAck 分類 — 通過分類；wrapper 還有邊界。**
Codex 逐一核了全部 **29** 個註冊（表格見下方原始輸出檔），結論全部「正確」，包含 CEO 特別點名的那個：

| event | 註冊 | handler 宣告 | `fn.length` | 最後參數實際為 ack | 結論 |
|---|---|---|---:|---|---|
| voice-signal | onNoAck | `({to,data})` | 1 | 否，唯一參數是 payload | 正確 |

> `voice-signal` 分類正確。現有 handler 都沒有 default/rest，解構與 arrow function 本身不會破壞 `fn.length`；但未來加 default/rest 就會誤判。同步例外會在 `server.js:998` 回錯誤 ack，不會因 wrapper 吞錯而永久等；非例外的無 ack 早退與非同步 callback 例外仍不在保證範圍。

→ 阿審獨立比對：`grep -nE "^\s*(on|onNoAck)\(" server.js` 得 **29 行**，`onNoAck` 共 7 個（`specLeave`／`nextRound`／`restart`／`voice-join`／`voice-leave`／`voice-signal`／`disconnect`），與 Codex 表格一致。**CEO 擔心的單點失誤沒有發生。**

**3. `payload null→{}` — 有問題。**（原文見 B3）
> `startGame(null)` 原本已有 `opts||{}`，行為等價；join/rejoin/spectate/makeQR/assign/promote/fire/buy/orderOvertime 會落入錯誤分支；一般員工與幽靈的空 `submitChoice` 也不會取得有效動作。**沒有發現藉此繞過冷卻或多拿分數，但主管提交與房間／密碼操作已足以推翻寫手宣稱。**

**4. `.rev-head` 契約 — 有問題（Codex 歸為 nit 級）。**
> 目前 DOM 通過：`#revtitle`、`#skiprev`、`#actnarr` 都是 `.rev-head` 的直接子節點，所以搬動 parent 時旁白一起走。但程式沒有檢查 `revtitle` 存在，也沒有驗證 `actnarr.parentElement === revtitle.parentElement`；未來拆 DOM 會 crash 或靜默留下旁白。

**5. `:has()` × `.bzone.inspected` — 有問題。**（原文見 B7）
> 沒有 `@supports selector(:has(*))` fallback；不支援 `:has()` 時基本內容仍存在、盒子維持 84px，但空區縮排、未巡區壓暗與「老闆撲空」訊息會消失。**本輪沒有可用的真實 `/browse` 實機環境，未做肉眼錄影驗證。**

**6. `cards.css:2` 反向 `:root` — 有問題（但新增樣式本身乾淨）。**
> 新增樣式沒有再直接使用 `var(--wood2)` 當前景，首頁 slogan 也已改成深色；但既有 `.banner` 漏網，造成終局勝方標題 1.10:1。其他實算結果包括：`.act-narr` `#4a2c14`/`#f2e7cf` 10.30:1 通過；`.home-slogan` `#4a2c14`/`#f4eddc` 10.83:1 通過；`.result-roster .gold` 3.02:1 小字不通過；`.versus` 2.68:1 不通過；`#revtitle` 3.82:1 不通過；`.cf-buff .cf-kind` 約 4.20:1，10px 小字不通過；`.kcard .ksub` 約 4.00:1 小字不通過。

**7. T1 兩段式舞台／跳過／同回合不重播 — 通過主要流程，但 key 設計仍脆弱。**
> - restart：server 先廣播 `phase='lobby',round=0`；`public/focus.js:282` 在 lobby 清空 session key、`revealStageKey`、`revAnimKey`。Socket.IO 同連線有序，因此**目前新局第一回合不會被舊 `code:1` 吞掉**。
> - 跳過：override 先執行原 `skipReveal()` 補完動畫 DOM，再呼叫 `revealSummary()`；`focusResult` 在同一次 `paintPersonalResult()` 尾端建立並套 stage，**個人總結會出現**。
> - key 僅為 `房號:回合`。重複廣播、重連、重整可正確去重；但缺 game/session nonce，若未來加入「不經 lobby 直接重開」或相同房號直接換局，會碰撞。**現在所有同房 restart 路徑都有 lobby 廣播，所以尚未實際失效。**

→ **CEO 最擔心的 restart 去重歸零：Codex 判定目前沒壞。** 阿審獨立確認 `focus.js:282` `if(ST.phase==='lobby'){markRevealSeen('');revealStageKey='';revAnimKey=null;}` 存在。

---

### 硬性不變量驗證（Codex 原文＋阿審獨立複跑，兩路一致）

| 不變量 | Codex 結果 | 阿審獨立複跑 | 判定 |
|---|---|---|---|
| `checkWin` 對 HEAD 逐字 0 差異 | `base_len=619 cur_len=619 equal=true`，兩邊 SHA-256 皆 `5e3b30f12fed7ec02a756545e3aab8d7e306491ad6f075bc5bc4d437f99600cd` | `awk` 抽 HEAD:472-482 vs WT:510-520，`diff` 無輸出 → `CHECKWIN_IDENTICAL_0_DIFF` | ✅ |
| 六常數零改動 | `REVEAL_SEC=15 / REVEAL_MIN_SKIP=5 / ADMIN_SEC=45 / CHOOSE_SEC=45 / TASK_DEADLINE=3 / PROMOTE_COOLDOWN=3` 兩邊相同 | `grep` HEAD vs WT `server.js:27-31` 逐字相同 | ✅ |
| `focus.css` `!important` == 10 | `10` | `10` | ✅ |
| `cards.css` `!important` ≤ 3 | `3` | `3` | ✅ |
| `node --test tests/card-flow.test.cjs` 29/29 | `tests 29, pass 29, fail 0` | `tests 29 / pass 29 / fail 0 / duration_ms 287` | ✅ |
| 沒有新增遊戲 action | HEAD `idle,slack,supervise,work`＝WT `idle,slack,supervise,work`；「一般員工可選動作仍只有 `work/idle/slack`」 | 同集合 diff 無輸出 → `SAME_ACTION_SET`；diff 中 0 個新 action 字面量 | ✅ |
| 沒有新增遊戲規則 | **失敗**——「至少有預設回合數變更及首局商店歷史 gate」 | 兩者屬實，**但兩者皆為 task.md 明文核准項（T6／T3+C1）** | ⚠️ 見 Claude 觀點 §1 |
| 三王不改 `checkWin` 勝負 | 「**勝負面通過**。`checkWin` 逐字一致，`pickKings` 不改玩家分數／生死；**但搞鬼王榮譽結果存在錯誤歸因**」 | `pickKings` 只寫 king 物件，未寫回 player 狀態 | ✅ 勝負面／❌ 榮譽歸因（B5） |
| 額外 | `node --check server.js public/focus.js public/screen.js public/cards.js` 全過；`git diff --check` 過 | — | ✅ |

**測試是否作弊 — Codex：有問題。**
> - `tests/card-flow.test.cjs:90` 複製 server 公式，沒驗前端。
> - `tests/card-flow.test.cjs:361` 對所有 malformed handler 只斷言 `doesNotThrow`，完全不檢查狀態不應改變；實際上測試期間 `createRoom` 等 handler 會產生副作用。
> - 搞鬼王測試把「同回合有 warned 就算命中」的實作假設直接寫進 fixture，沒有兩隻鬼同回合報不同目標的反例。
> - 沒有 DOM、sessionStorage、CSS layout 或過勞死完整 act 時序測試。

→ **阿審複驗這三條全部屬實。** `:361` 確實只有 `assert.doesNotThrow(()=>h[ev](junk))`，零狀態斷言——這正是 B3 能通過 29 綠的原因；`:90` 全部斷言都是硬編碼數字對 `revealAnimMs`，零前端讀取——這正是 B4 能通過 29 綠的原因。**「29/29 綠」在這兩個項目上不構成證據。**

---

### Claude 觀點（與 Codex 分歧處；最終技術判定仍以 Codex 為主）

**§1 — B1／B2 是「Codex 缺 task.md 脈絡」造成的假陽性，不是寫手偏離計畫。**
我在 prompt 裡把「沒有新增任何遊戲規則」當成硬性不變量丟給 Codex，**這是我的下達錯誤，不是 Codex 判錯**。實情：
- **B1 回合數**：task.md `:242` 有完整一節 `T6｜砍回合數【老闆 2026-09-13 裁決納入・與 T5 同一趟改 server.js】`，`:249` 明寫「CEO 裁決的數字：solo → 4 回合；多人 → 6 回合」，`:253` 明寫「不得改動 `ADMIN_SEC`／`CHOOSE_SEC`／`REVEAL_SEC`」（寫手遵守了）。
- **B2 首局隱藏市場**：task.md T3 驗收清單明文「**第一局隱藏補給市場**（遵守 C1：要有首次遊玩判定；bot 照買；後端不動）」，C1 整節就是在規定怎麼做這件事。
→ **建議 CEO 把 B1／B2 從「blocking bug」降為「產品決策爭議」**：Codex 的反對意見有價值（B2 的「別移除功能、只降視覺權重」是很好的替代設計），但那是要老闆重新裁決的事，不是打回去要寫手修的 bug。信心 9/10。

**§2 — B8（XSS）不應該當本批的放行閘門。**
Codex 自己標了「這是 HEAD 已存在的漏洞，不是本批新增」，我也用 `shasum` 確認 `index.html:687` 與 HEAD 逐字相同。**這是真漏洞、要修，但把它掛在「情緒定型」這批的閘門上會讓寫手去改一段本批完全沒碰的程式碼。建議另開安全任務。** 信心 9/10。

**§3 — B6 的定性我與 Codex 有一點差異。**
`.banner{color:var(--wood2)}` 與 `cards.css:2` 的 `--wood2:#ece3c8` **兩者在 HEAD 都已存在**，本批沒有把它弄壞。Codex 的措辭「色碼陷阱尚未清完」是準的，但 blocking 的理由應該寫成「**在 T5 重做的終局畫面上，最重要的一行字看不見**」——因為它命中最高驗收問題，而不是因為它是新 bug。信心 8/10。

**§4 — 我完全同意 Codex 的 B3／B4／B5／B7，且已獨立複驗全部程式碼證據。**
這四條是本批**真正的、範圍內的、新引入的** blocking：
- **B4 最重要**：C4 那條「所有後續寫手必讀」的警告，在 T2 加猝死演出時**就是被忽略了**——這正是 task.md 預言會發生的那個失誤。
- **B5 次之**：搞鬼王會頒給沒掙到的人並編一段假事蹟，**直接違反「玩家是否理解自己為什麼得到這個結果」**。
- **B3**：問題不在洞多大（Codex 已確認無提權），在於**寫手的「我逐一人工核過」是不實陳述**——這件事本身比 bug 嚴重。
- **B7**：真實的演出中途跳動，Codex 算出的 84px→42px 我複驗數字精準；**唯獨「肉眼有多明顯」Codex 誠實標了無法驗證，需要 `/browse` 實機補一段錄影**。

**§5 — 我沒能驗到、也沒人驗到的部分（如實回報，不補位）。**
本輪**沒有任何實機瀏覽器驗證**。以下全部只有靜態分析：五項演出是否真的「螢幕上看得到」、猝死演出是否「荒謬好笑」、四類卡面是否「不讀字就知道哪類」、B7 的閃爍體感強度、B6 的隱形程度。**最高驗收問題「玩家是否親眼看到」，這一輪沒有人親眼看到。**

---

### 阿審總結判定

**FAIL。** 放行前必須修的（範圍內、本批新增、兩路都確認）：**B4、B5、B3、B7**。
建議降級處理的：**B1／B2 → 送回 CEO 裁決（是已核准範圍，非偏離）**；**B6／B8 → 既有缺陷，另開任務**（B6 若要順手修，一行改 `#4a2c14` 即可）。
補測試要求：`tests/card-flow.test.cjs:90` 與 `:361` 這兩個測試目前**擋不住 B4 與 B3**，修完要一併補上能真正抓到的斷言，否則下一輪還是 29 綠。

---

## 審查輪次 2 — Codex

判定：**FAIL**（Codex 判 FAIL，1 條 blocking）

Codex 版本／指令：
`/Applications/Codex.app/Contents/Resources/codex exec --sandbox workspace-write -c 'model_reasoning_effort="high"' "<輪次 2 複審 prompt>"`
codex-cli **0.153.4**（app bundle；`which codex` 的 npm 版 0.141.0 太舊會報 `requires a newer version of Codex`）。
base = `HEAD` (`0fb7f22`)，改動全在未提交工作區。Codex 原始輸出全文：`codex-raw-round2.txt`。

> **本輪已在 prompt 中明確排除輪次 1 的兩條「非缺陷」**：回合數 8→6／solo 4（task.md `T6【老闆 2026-09-13 裁決納入】`）、第一局隱藏市場（task.md T3／C1）。Codex 確認遵守：「已按指示不把單人 4／多人 6 回合及第一局隱藏商店判為 blocking。」

---

### Blocking 問題（1 條）

- **[server.js:1011] `isPayloadObject()` 不是真正的「純物件」檢查，B3 只補了一半——`Buffer`／TypedArray 仍然穿透，輪次 1 的三個狀態變更原封不動全部復活。**

  `function isPayloadObject(v){ return typeof v==='object' && v!==null && !Array.isArray(v); }`
  這條只擋掉 `null` / 原始型別 / 陣列。`Buffer`、`Uint8Array`、`ArrayBuffer`、`Date` 全都 `typeof==='object'`、非 null、非 Array → **一律放行進 handler**，解構後每個欄位都是 `undefined`，於是走進和輪次 1 完全相同的預設值路徑。

  → **修法**：改成跨 realm 可用的 POJO 檢查，明確排除 `ArrayBuffer` / `ArrayBufferView`(含 Buffer 與所有 TypedArray) / 其他非 POJO。例如以原型鏈判定：
  `const proto=Object.getPrototypeOf(v); if(proto!==Object.prototype&&proto!==null) return false;`
  （`Object.create(null)` 目前也會通過，是否要放行請一併決定）。並把 `Buffer`／TypedArray 加進 `tests/card-flow.test.cjs` 的 `BAD_PAYLOADS` 回歸清單。
  **[Codex 信心 10/10；阿審獨立複驗後同意 10/10]**

**阿審獨立複驗（沒有採信 Codex 宣稱，全部自己重跑）：**

1. 型別層 — `isPayloadObject` 對各種輸入的回傳值：
   `Buffer.from('hi')`→**true**、`new Uint8Array(4)`→**true**、`new ArrayBuffer(4)`→**true**、`new Date()`→**true**、`Object.create(null)`→**true**；
   `null`/`undefined`/`'str'`/`42`/`true`/`[]`→false（這些擋住了，B3 對這批是有效的）。

2. 傳輸層 — 用專案自己的 `node_modules/socket.io-parser` 做 encode→decode round trip，確認遠端客戶端送得進來：
   ```
   event: createRoom | typeof: object | ctor: Buffer | isArray: false | isPayloadObject -> true
   ```
   **不是理論漏洞，Buffer 真的會以 Buffer 型態抵達 handler。**

3. 行為層 — 用**專案測試檔自己的 harness**（`engine()`／`wireSocket()`，打的是真的 `guardHandlers` 包出來的入口）送 `Buffer.from('AAAA')`：
   ```
   1. createRoom(Buffer)   ack:{"ok":true,"code":"JHU7",...}  rooms 1 -> 2   房間真的建出來了
   2. setPassword(Buffer)  ack:{"ok":true}   password "1234" -> null         房間密碼被靜默解除
   3. 主管 submitChoice(Buffer) ack:{"ok":true}  choices.emp:{"employee":{"action":"supervise","zone":null}}
   4. 對照組 createRoom(null) ack:{"error":"無效請求"}                        null 確實有擋住
   ```
   → **輪次 1 B3 點名的三條狀態變更（靜默建房／靜默解除密碼／主管靜默鎖定不協查），換成 Buffer 後 100% 全部復現。**

4. 把 `BAD_PAYLOADS` 換成 `[Buffer.from('AAAA'), new Uint8Array(4)]` 跑現有測試 → 立刻紅：
   `AssertionError: createRoom 收到 AAAA 應該回明確錯誤，不是靜默接受 / actual: undefined, expected: '無效請求'`

**因此寫手回報中「payload 位一定要是『真的物件』…保證零副作用」這句話不成立**——目前只對 `null`/原始型別/陣列成立，對二進位 payload 不成立。這是輪次 1 同一條 blocking 的殘留，不是新開的單。

---

### Nit（非阻擋）

- **[server.js:308] B4 整房順延是任務書外的產品取捨。** 只有猝死玩家會播那一幕，其他人也跟著多等 2.9 秒。Codex 判「可接受、非 blocking，但確實是任務書外的產品取捨，應由產品負責人知情」。Codex 補算：猝死玩家得到完整 15 秒閱讀期，其他玩家實際有約 **17.9 秒**閱讀期（因為他們不播 `playKaroshi()`）。
- **[tests/card-flow.test.cjs:57] 跨檔 regex 能 fail loud，但對排版敏感且存在假綠**；長期更適合共享時序資料或直接測控制流。
- **[server.js:1020] `startGame` 白名單有個不一致**：`socket.emit('startGame', ack)`（只給 ack 不給 payload）會把 callback 留在 payload 位而**被退件**，白名單形同沒生效。目前前端固定傳物件，**不是現行回歸**。（阿審複驗邏輯：`fn.length=2` → `args` 補成 `[ackFn, undefined]` → ack 位回填 `lastRaw`=ackFn → payload 位 `args[0]` 仍是 function → 不是物件也不是 null → 退件。Codex 判斷正確。）
- **[public/focus.js:73-86] regex 沒驗 `playKaroshi()` 的 return 式與呼叫是否還在**——Codex 實測把前端真正的 `return start+KAROSHI_MS` 改成少 1000ms，測試解析結果仍是 2900、照樣綠（假綠）。

---

### 七個重點問題 — Codex 逐條結論

| # | 主題 | Codex 結論 |
|---|---|---|
| 1 | `REVEAL_ANIM_MAX_MS` 14000 | **合理，算式正確**。但更正 CEO 的「29 秒」：正常可達最壞是 12.8+15 = **約 27.8 秒**；29 秒是硬上限允許的異常邊界。實跑 `revealAnimMs()` 最壞局 → `{"worstRevealMs":12800,"cap":14000}`，**不會被截頂** |
| 2 | C4 契約變兩處＋regex | fail-loud **值得保留**（比輪次 1 硬編碼有實質進步），但 **regex 不夠穩、有假綠** |
| 3 | B4 整房順延 | **可接受，非 blocking**，但是任務書外的取捨 |
| 4 | B3 白名單會不會誤殺 | **前端沒有正當請求被誤殺**；但 B3 仍錯誤接受二進位 payload（＝本輪 blocking） |
| 5 | B5 有沒有弄壞 buildStory | **沒有。B5 修正正確** |
| 6 | B7 shorthand 覆蓋判斷 | **寫手判斷正確**，box-shadow／border-color 必須寫回去 |
| 7 | reduced-motion | **寫手的理由錯了，但結果是安全的**，非 blocking |

**第 1 題細節（Codex 重推的上限）**：`n≤5`；設既有幽靈數 `d`，`d+n≤5`，每隻幽靈至多一則、每名存活員工至多一張道具、老闆緊盯至多一則 → `g≤d+n+1≤6`；`3800 + 5×480 + 6×350 + 1600 + 2900 = 12800`。**與 server.js:297 註解的推導一致。**
Codex 保留一點（信心 8/10，未做真瀏覽器驗證）：真實牆鐘時間仍可能因網路延遲、背景分頁 timer throttling、中途重連而漂移；**前端目前完全不讀 server 傳來的 `revealAnimMs`，是自己從收到 state 的時間算 `revAnimEndsAt`**。
> 阿審複驗：`grep -rn "revealAnimMs" public/` 只在**註解**中出現 3 次（`index.html:847`、`focus.css:153`、`focus.css:189`），**前端確實零讀取**。C4 鏡像關係純靠人工紀律＋regex 測試維持。

**第 4 題細節**：Codex 實掃到 **34 個 `sock.emit` 呼叫點、28 個唯一事件**（不是寫手回報的「30 個 emit」）。15 個 payload-bearing 事件全部傳物件字面量。
> 阿審複驗：`grep -oE "\bsock\.emit\('[^']+'" public/*.js public/index.html | wc -l` = **34**，unique = **28**。**Codex 的數字對，寫手的 30 是錯的**（結論不受影響：payload-bearing 的都送物件字面量）。
其餘子項 Codex 均確認安全：`voice-signal`（onNoAck，畸形值靜默丟棄）、`disconnect`（宣告零參數，Socket.IO 的 reason 字串不會被當 payload，handler 仍會執行）、bot（不模擬 socket client，直接寫 `room.choices`）。

**第 7 題細節（Codex 直接打臉寫手的理由）**：
> 「實作者所說『既有 reduced-motion 缺口』**不正確**，但結果反而是安全的。`cards.css` 已有全域 `@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}` [public/cards.css:18]。它雖早於 `focus.css` 載入，但帶 `!important`，會壓過 B7 非 important 的 transition。因此新的 `min-height` transition 和既有 box-shadow／border-color transition **都會被排除**；不構成 blocking。」

> 阿審複驗：`public/cards.css:18` 該條全域規則**確實存在**。寫手宣稱的「延伸既有缺口」是**事實錯誤**——根本沒有缺口。**結論安全，但寫手的理由是錯的，這代表他沒去看 cards.css。**

---

### 硬性不變量 — 阿審獨立複驗（**沒有沿用輪次 1 的數字**）

| 不變量 | 要求 | 阿審實測 | 結果 |
|---|---|---|---|
| `checkWin` vs HEAD | 逐字 0 差異 | `diff` 抽取兩版函式 → 無輸出，11 行對 11 行 | ✅ |
| `REVEAL_SEC` | 15 零改動 | HEAD 與 WORK 皆 `server.js:29` `= 15` | ✅ |
| `REVEAL_MIN_SKIP` | 5 零改動 | 皆 `server.js:30` `= 5` | ✅ |
| `ADMIN_SEC`／`CHOOSE_SEC` | 45 零改動 | 皆 `server.js:28` `const CHOOSE_SEC = 45, ADMIN_SEC = 45;` | ✅ |
| `TASK_DEADLINE` | 3 零改動 | 皆 `server.js:27` `TASK_DEADLINE = 3` | ✅ |
| `PROMOTE_COOLDOWN` | 3 零改動 | 皆 `server.js:31` `= 3` | ✅ |
| `!important` focus.css | 10 | **重新量 = 10**（HEAD 也是 10，淨 0） | ✅ |
| `!important` cards.css | 3 | **重新量 = 3**（HEAD = 4，淨 **−1**） | ✅ |
| `node --test` | 36/36 綠 | `tests 36 / pass 36 / fail 0` | ✅ |
| `guardHandlers` 分類 | 22 / 7 | `^\s*on\(` = **22**、`^\s*onNoAck\(` = **7**，事件名逐一比對與輪次 1 核對表**完全相同** | ✅ |
| 不新增 action | — | Codex：HEAD 與工作區事件名排序比較均 29 個，`added []`、`removed []`；玩家 action 仍 `work`／`idle`／`slack`／主管 `supervise` | ✅ |
| 審核未污染 repo | — | `git status --porcelain` 前後一致（8 modified + `.team/` untracked） | ✅ |

> ⚠️ CEO 特別提醒的「輪次 1 `!important` 數字曾被擾動」已處理：上表 10／3 是**本輪對最新工作區重新量的**，並額外量了 HEAD 做對照。

---

### 突變測試表 — 阿審獨立重跑驗證（**這張表是真的**）

CEO 要求驗證寫手的突變測試表不是自我宣稱。阿審把工作區複製到 scratch，**逐條反向套回**再跑測試（腳本：`scratchpad/mutate.js`、`mutate7.js`）：

| 反向套用 | 寫手宣稱 | **阿審實測** | 吻合 |
|---|---|---|---|
| 拿掉 `+(karoshi?KAROSHI_EXTRA_MS:0)` | 34/2 | **34 pass / 2 fail** | ✅ |
| 前端 `index.html` `t+=1100`→`t+=1500` | 32/4 | **32 pass / 4 fail** | ✅ |
| 前端 `focus.js` `KAROSHI_MS` 3600→5000 | 33/3 | **33 pass / 3 fail** | ✅ |
| B5 比對改回「只比 round」 | 35/1 | **35 pass / 1 fail**（`ghost king only credits the warn that actually saved its own target`） | ✅ |
| B5 只拿掉 `targetPid` 欄位 | 35/1 | **35 pass / 1 fail**（`chronicle records who warned whom…`） | ✅ |
| B3 改回 `null→{}` | 34/2 | **34 pass / 2 fail** | ✅ |
| **全部反向套回（＝輪次 1 那版）** | **29/7** | **29 pass / 7 fail** | ✅ |

**七條全部逐字吻合，失敗的測試名稱也逐條對得上。突變測試表屬實，不是測試劇場。**
（註：阿審第一次跑「全部反向」時得到 28/8，是因為我多綁了兩條**前端漂移**突變；那兩條不是寫手的 edit。只還原寫手自己在 `server.js` 的 9 處後，精確得到 29/7。）

**但 Codex 對這張表下了重要但書**：
> 「突變結果證明『對那些特定變異敏感』，**不能證明所有語意錯誤都會被抓到**。」
> 本輪 blocking 正是活生生的例子——`Buffer` 這條語意錯誤，29/7 的突變表完全抓不到。

---

### 測試品質評估 — Codex 原文

**(a) 新測試不是單純演戲，但證據強度不一：**
> - B5 最強：fixture 測精確歸屬，再由真 `resolveRound` 產生 chronicle，最後一路驗到搞鬼王 holder／deed。[tests/card-flow.test.cjs:324-380]
> - B3 對列出的 `null/undefined/string/number/boolean/array` 確實驗了 ack、世界快照與零副作用，比原本 `doesNotThrow` 強很多。[tests/card-flow.test.cjs:534-579]
> - B4 已驗到 server timer、skip lock 及真引擎猝死結果，但前端部分仍是原始碼數字解析，不是實際 DOM／timer 控制流。[tests/card-flow.test.cjs:159-223]

**(b) 修改既有搞鬼王 fixture「不算」改測試遷就實作：**
> 「schema 本來就為 B5 正式增加 `targetPid/pid`，fixture 更新成新 schema 是合理維護。更重要的是另有真引擎測試從 `resolveRound` 產生欄位並做端到端王冠驗證，已打破純 fixture 自我循環。」
> 但 Codex 指出**仍有部分自我循環**：「B4 測試把『哪些前端數字代表總時長』這項實作假設寫進 regex helper；最壞 `n=5/g=6` 也是人工 fixture，沒有用真引擎建出最壞局。」
> → **寫手在 task.md 第 1602 行主動請阿審裁決這一點，裁決：不算作弊，通過。**

**(c) Codex 點名仍未覆蓋的關鍵項目：**
> - B3 沒測 `Buffer`、TypedArray、ArrayBuffer 或其他非 POJO；**這正是本輪 blocking**
> - B4 沒有真瀏覽器驗證 `playReveal → playKaroshi → revealSummary` 的實際控制流，也沒有背景分頁、網路延遲或中途重連案例
> - regex 沒驗證 `playKaroshi()` 的 return 式與呼叫是否仍存在
> - B7 沒有 computed-style／動畫取樣／reduced-motion 自動測試
> - 正式測試沒有 200 筆 chronicle cap 案例（本輪只有 Codex 用 `/tmp` 探針獨立確認）

---

### Codex 原文摘錄（忠實，不過度濃縮）

> **VERDICT: FAIL**
>
> **BLOCKING:**
> - [server.js:1011] `isPayloadObject()` 只排除 `null` 與陣列，並非「純物件」檢查；`Buffer`／TypedArray 仍會通過。我用目前的真 `guardHandlers` 與 handler 實測：`createRoom(Buffer)` 成功建房，`setPassword(Buffer)` 把 `1234` 清成 `null`；專案的 `socket.io-parser` encode/decode 後也確認 payload 在伺服器端仍是 `Buffer`。因此 B3 的「畸形 payload 零副作用」尚未成立。→ 改成跨 realm 可用的 plain-object/prototype 檢查，至少明確排除 `ArrayBuffer`、`ArrayBufferView`、`Buffer` 與其他非 POJO，並把它們加入回歸測試。[信心 10/10]

> **第 5 題**：「B5 新欄位沒有弄壞 `buildStory`。`chron()` 的上限仍是 `<200`；我另外推入 205 筆，結果長度為 200。[server.js:123] ghost 事件新增 `pid/detail/targetPid`，shield 四分支保留既有 `kind/name/detail` 並只增加 `pid`。命中現在確實比對 `kind==='warned'`、同回合與同 `playerId`，任一邊缺 ID 都不命中。`buildStory` 對 shield 只讀 `kind/name/detail`，對 ghost 只讀 `kind/name/detail`。全專案搜尋沒有發現對 chronicle 事件做 key 數量或固定 object shape 的假設。**結論：B5 修正正確，200 筆上限及既有故事讀取路徑未受破壞。**」

> **第 6 題**：「實作者對 shorthand 覆蓋的判斷正確。inline base `.bzone` 原有 `transition:box-shadow .3s,border-color .3s`。[public/index.html:166] `focus.css` 在頁尾較晚載入。新規則選擇器 `.focus-game .reveal-board-pane .bzone` 特異性也更高，所以其 `transition` 會整組取代 base 值；把 `box-shadow` 與 `border-color` 寫回去是必要的。」

> **第 2(b) 題**：「regex 不夠穩，也有假綠：題目舉的 `KAROSHI_MS = 3600` 加空白其實**不會**失敗，因 regex 使用 `\s*`。`let t = 500 + n * 140` 則會失敗，因該 regex 要求緊密格式。我做了記憶體內變異：把舊公式留在註解、真正公式改寫，regex 仍抓到註解中的 `500/140`。把前端真正的 `return start+KAROSHI_MS` 改成少 1000ms，測試解析結果仍是 2900，因它只解析常數與 lead，完全沒驗證 return 控制流。**結論：目前適合當漂移警報，但不能當完整前端行為證明。**」

---

### 阿審觀點（與 Codex 分歧處 / 補充）

**§1 — 我完全同意 Codex 的 blocking，而且是自己重跑出來的，不是背書。**
`Buffer` 這條我做了四層獨立驗證（型別層／socket.io-parser 傳輸層／專案自己 harness 的行為層／既有測試改 fixture）。**輪次 1 B3 的三條狀態變更全部原樣復現**。這條非修不可。

**§2 — 一個對 CEO 的提醒：這條 blocking 打臉的不是「修得不夠好」，是「驗證方法的盲區」。**
寫手做了很紮實的突變測試（我逐條驗過，全部屬實），也做了真 socket e2e。但突變測試只能證明「**你想到的那個錯誤**會被抓到」。`Buffer` 沒進 `BAD_PAYLOADS` 清單，於是 36/36 綠、7 條突變全紅，卻仍然漏掉同一條 blocking 的另一個入口。**這正是為什麼要跨模型審——Codex 想到了 Buffer，寫手和我第一眼都沒有。**

**§3 — 寫手的三處事實性錯誤（都不影響結論，但要記下來）：**
1. 「前端 30 個 emit」→ 實際 **34 個呼叫點／28 個唯一事件**。
2. 「reduced-motion 是延伸既有缺口」→ **錯，`cards.css:18` 早就有全域 `!important` 覆蓋，沒有缺口**。
3. 「payload 保證零副作用」→ **對二進位 payload 不成立**（即本輪 blocking）。
第 2 點特別值得留意：寫手為自己的 CSS 改動辯護時，**沒有去讀同專案的 `cards.css`**。

**§4 — 三條修對了，我確認無誤：B5 ✅、B7 ✅、B4 ✅（含 14000 上限）。**
- **B5** 是四條裡做得最好的：真引擎 `resolveRound` 產生資料 + 端到端驗到王冠歸屬，`buildStory`／200 筆上限我與 Codex 各自獨立確認未受影響。
- **B7** 的 shorthand 覆蓋判斷正確，我複驗了 `index.html:166` 的 base 規則與 `focus.css` 的載入順序／特異性。
- **B4** 的 12800 上限算式我複驗與 `server.js:297` 註解一致，`REVEAL_ANIM_MAX_MS=14000` 有 1200ms 餘裕。**Codex 更正了 CEO 的「29 秒」說法：正常最壞是 27.8 秒。**
- **`REVEAL_ANIM_MAX_MS` 不在受保護六常數清單但被改動** → Codex 判合理，我同意，但**這是產品可感知的等待時間變更，建議 CEO 知情備案**。

**§5 — 「玩家是否親眼看到」仍然沒有解決，如實記錄，不當作已解。**
本批到目前為止只有**部分**實機驗證：CEO 自己跑過第一回合三屏、B7 那位有 30ms 取樣與連續截圖。
**以下仍然沒有任何人完整走過**：猝死演出好不好笑、四類卡面能不能不讀字就分辨、整局體感。
Codex 明講：「除題目已揭露的猝死喜劇效果、四類卡面辨識與完整整局體感外，我沒有發現其他已宣稱完成、但完全缺乏任何靜態或測試證據的主要項目。」
→ **這不是 blocking，但也不是已解。放行前建議 CEO 或老闆親自走一局完整流程。**

**§6 — B4 的 C4 鏡像契約是紙糊的，建議另開任務（不阻擋本輪）。**
前端**完全不讀** server 傳來的 `revealAnimMs`（我 grep 過，只出現在 3 條註解裡），兩邊靠人工紀律＋一組會假綠的 regex 維持同步。Codex 已示範兩種假綠。**這是結構性風險，不是本批引入的**，建議另開任務改成單一真實來源（例如 server 把 `revealAnimMs` 下發、前端據此排程）。

---

### 阿審總結判定

**FAIL — 但這輪離放行只差一步。**

- **修對了（3/4）**：**B5 ✅**、**B7 ✅**、**B4 ✅**（含 `REVEAL_ANIM_MAX_MS` 14000 的放寬，算式正確、有餘裕）
- **只修了一半（1/4）**：**B3 ❌** — `null`／原始型別／陣列擋住了，**`Buffer`／TypedArray 沒擋住**，輪次 1 的三個狀態變更全部復現

**放行前唯一必須修的**：`server.js:1011` `isPayloadObject()` 改成真正的 POJO 檢查（排除 `ArrayBuffer`／`ArrayBufferView`／`Buffer`），並把 `Buffer`／`Uint8Array` 加進 `tests/card-flow.test.cjs:537` 的 `BAD_PAYLOADS` 回歸清單。**這是一行判斷式 + 一行測試資料的修正。**

**所有硬性不變量本輪全部通過**（`checkWin` 逐字 0 差異、六常數零改動、`!important` 10／3 重新量過、36/36 綠、22／7 分類不變、零新增 action）。
**突變測試表經獨立重跑，七條全部屬實。**
**未解事項照實留檔**：整局體感／猝死喜劇效果／四類卡面辨識，仍無人完整驗過。

---

## 審查輪次 3 — Codex（codex-cli 0.153.4，model_reasoning_effort=high，約 14 分鐘 / 184,468 tokens）

**判定：FAIL**

> ⚠️ 依 `/team` 規則這是最後一輪。**本輪必須升給老闆裁決**——但升上去的問題跟輪次 2 不是同一類，請務必看完下面「阿審的範圍裁決」再決定怎麼處理。

Codex 原始輸出全文：`.team/20260913-情緒定型/codex-raw-round3.txt`

---

### Blocking 問題（Codex 提出 4 條，我全部獨立重現過）

#### 🔴 B3-A `[server.js:1355]`（另見 `1326`／`1337`）— 巢狀型別混淆 → 直接規避老闆巡查
payload 外層過了 POJO 檢查，但**欄位層沒有型別驗證**。`ZONES[zone]` 會把 `['tea']`／`Buffer('tea')` 隱式轉成字串 `'tea'` 而通過驗證，**原始的陣列／Buffer 卻被原樣寫進 `room.choices`**；結算時 `inspected.has(zone)`（`server.js:364` 的 `Set`）用嚴格同一性比對，陣列／Buffer 永遠不等於字串 `'tea'` → **抓不到**。

我的獨立重現（真 `guardHandlers` ＋ 真 `submitChoice` ＋ 真 `resolveRound`，老闆巡查 `tea`）：

| 送出的 zone | ack | 存進 choices 的型別 | 結算 caught | 得分 |
|---|---|---|---|---|
| `'tea'`（正常） | `{ok:true}` | `[object String]` | 被抓 | — |
| `['tea']` | `{ok:true}` | `[object Array]` | **undefined（沒被抓）** | **+2💰** |
| `Buffer('tea')` | `{ok:true}` | `[object Uint8Array]` | **undefined（沒被抓）** | **+2💰** |

老闆 `zones:[Buffer('tea'),'copy']`、主管 `inspectZone:Buffer('tea')` 同理失效。
→ **修法**：欄位級 schema／正規化——zone 必須是 primitive string 且 `Object.hasOwn(ZONES,zone)`；`zones` 必須是合法字串陣列；**寫入 state 前只存正規化後的值**，並補三種角色的結算回歸測試。

#### 🔴 B3-B `[server.js:1357]` — `zone:'__proto__'` 繞過驗證 → 房間卡死
`ZONES['__proto__']` 回傳 `Object.prototype`（truthy）→ 通過驗證。我重現：ack 先回 `{ok:true}`，接著 `resolveRound` 在 `server.js:427` 附近丟 `TypeError: object is not iterable`，**timer 已清、壞掉的 choice 留在房間、phase 永遠卡在 `choosing`**。單一惡意客戶端即可讓整間房停擺。
→ **修法**：改用 `Object.hasOwn(ZONES,zone)`；並且**不要在 `tryResolve` 成功前先回成功 ack**。

#### 🔴 B3-C `[server.js:230]` — `startGame` 巢狀 `opts.rounds` 零驗證
`{rounds:{}}`／`{rounds:[]}`／`{rounds:Buffer}` 全部回 `{ok:true}` 並原樣存進 `room.config.rounds`（我重現，型別分別為 `[object Object]`／`[object Array]`／`[object Uint8Array]`）。`server.js:528` 靠數值強制轉型判終局 → `{}` 讓回合上限**永遠命中不了**（遊戲不會結束），`[]` 則**第一回合就結束**。
→ **修法**：`rounds` 驗證為有限整數＋允許範圍；其他 start options 逐欄驗 enum／primitive。

#### 🔴 B3-D `[tests/card-flow.test.cjs:113]` — C4-2 仍有「註解假綠」，與寫手宣稱相反
`cutFunction` 確實是 comment-aware 的，**但 `KAROSHI_MS` 沒有走 `cutFunction`**，走的是
`FRONT_FOCUS.match(/const\s+KAROSHI_MS\s*=[^;]+;/)` ——不帶 `/g`，**抓全檔第一個匹配，包含註解裡的**。

我在隔離副本獨立重現（**不是採信 Codex**）：
```
public/focus.js:50  /* 舊值備查：const KAROSHI_MS=3600; */
public/focus.js:51  const KAROSHI_MS=5000;     ← 前端真值改成 5000
server.js:301       const KAROSHI_SCENE_MS = 3600;   ← server 不動
→ node --test tests/card-flow.test.cjs = tests 39 / pass 39 / fail 0（全綠）
```
**前後端漂移 1400ms，測試完全沒感覺。** 這正是輪次 2 Codex 抓到、寫手宣稱「新做法 0 個假綠」已經消滅的那一類假綠。
→ **修法**：`KAROSHI_MS` 也用 comment-aware 掃描器擷取真正的宣告（或改成單一真實來源由 server 下發），並把這個突變加進 `mutate.js` 回歸。

---

### 🟡 阿審的範圍裁決（**與 Codex 的分歧，請 CEO／老闆特別看這段**）

Codex 這 4 條技術事實**全部正確，我逐條獨立重現無誤**。但 Codex **沒有去比對 HEAD**，因此漏掉一個對「本輪該不該 FAIL」很關鍵的事實：

**B3-A／B3-B／B3-C 三條在 HEAD（`0fb7f22`）上一字不差地同樣復現——它們是既有 bug，不是本批改動造成的迴歸。**

我的 HEAD／WORK 對照實測：

| 攻擊 | HEAD 結果 | WORK 結果 | 是迴歸嗎 |
|---|---|---|---|
| `zone:['tea']` | 沒被抓、+2💰 | 沒被抓、+2💰 | ❌ 既有 |
| `zone:Buffer('tea')` | 沒被抓、+2💰 | 沒被抓、+2💰 | ❌ 既有 |
| `zone:'__proto__'` | 丟例外、phase 卡 `choosing` | 同左 | ❌ 既有 |
| `startGame({rounds:{}})` | `{ok:true}`，config 被污染 | 同左 | ❌ 既有 |

**Codex 有一處事實性錯誤**：它寫「`[server.js:364]／[server.js:426]` 結算**改用** `Set` 嚴格同一性」，暗示本批改動引入了這個比對方式。**不成立**——`const inspected=new Set(bossZones)` 在 **HEAD:320** 就存在，WORK:364 逐字相同，本批沒動它。

**我同意 Codex 的技術判定，但不同意它隱含的「本批把事情弄壞了」歸因。**
反方向的事實是：**本批其實讓這一塊變好了**。HEAD 完全沒有 `guardHandlers`／`isPayloadObject`（我查過，HEAD 兩者出現次數都是 0，29 個 handler 全是裸 `socket.on`）。我 182 組巢狀 fuzz 只找到一條會丟例外的路徑（`submitChoice({zones:<非陣列>})` → `.filter is not a function`），**在 HEAD 那會直接殺掉整個 process，在 WORK 被 guard 接住只影響單一請求**。

→ **B3-A/B/C 我建議另開一張「欄位級 payload schema」任務**，不要綁死本批。
→ **但 B3-D 不一樣：它就長在本輪的交付物上（C4-2 就是這輪要做的東西），而且直接推翻寫手「新做法 0 個假綠」的宣稱。這條我認為必須修才能放行。**

**最終 PASS/FAIL 以 Codex 的技術判斷為主 → 本輪 FAIL。** 分歧點（三條是否該算本批 blocking）攤開給 CEO 和老闆裁決。

---

### Nit（Codex 原文，非阻擋）

- `[tests/card-flow.test.cjs:86]` 假 DOM 不支援未來的 `requestAnimationFrame`／`animate()` 時直接紅，是**合理的 fail-loud**。被後續寫手隨手放寬屬流程治理風險；目前檔頭警告已算清楚。（我補測：目前 `public/index.html` 與 `public/focus.js` 對 `requestAnimationFrame`／`.animate(` 的出現次數都是 **0**，所以這條目前純屬未來風險。）
- `[tests/card-flow.test.cjs:49]` `cutFunction` 本身確實不理解 regex 字面值；**目前四個目標函式沒有 regex**，而且現有字串、樣板字面值、註解與巢狀大括號均成功切出、解析並執行。現況非 blocking。（我獨立掃過 `outcomeIcon`／`playReveal`／`playKaroshi`／`revealAct` 四段，確認無 regex 字面值，grep 命中的都在字串或註解內。）
- `[tests/card-flow.test.cjs:281]` n≤5、g≤8 是手寫邊界；`[:291]` 又只斷言 `checked>=180`，**即使漏掉最多九組仍可能綠**。建議建立 `MAX_PLAYERS` 共用常數、由它推導 n/g，並斷言精確 `189`。目前可達範圍仍被覆蓋，屬 nit。
- `[server.js:1019]` class instance 在同一 realm 直接呼叫時會通過；預設 Socket.IO parser 會把它還原成 POJO，因此目前不是可遠端利用問題。若更換 parser／reviver 必須重審。

---

### 六個殘留風險逐條結論（Codex ＋ 我的獨立複驗）

| # | 風險 | Codex 結論 | 阿審獨立複驗 |
|---|---|---|---|
| 1 | 巢狀二進位放行 | **有 blocking**（見 B3-A/B/C） | ✅ 重現，**但 HEAD 同樣如此** |
| 2 | 假 DOM 維護面 | fail-loud 正確，治理風險 | ✅ 目前前端 0 個 rAF／`.animate(` |
| 3 | `cutFunction` regex 誤判 | 限制屬實、現況非 blocking | ✅ 四函式皆無 regex 字面值 |
| 4 | `[object Object]` 擋不住 class | **寫手判斷成立**，網路上送不出來 | ✅ 我用 `socket.io-parser@4.2.7` 實測：class → `constructor=Object`、method 消失 |
| 5 | 189 組邊界手寫 | nit，建議共用 `MAX_PLAYERS` | ✅ 房間上限 6（`server.js:1074`／`1101`），目前覆蓋足夠 |
| 6 | `Object.create(null)` 放行 | 安全，15 個 handler 零例外 | ✅ 全專案 `.hasOwnProperty(` 命中 **0**。**補充：`Object.create(null)` 過 socket.io-parser 後會變成一般 Object，實務上根本送不進來** |

**Codex 頂層修正驗收（B3-2 本身）**：`createRoom(Buffer)` 房數 1→1、`setPassword(Buffer)` 密碼仍 `1234`、主管 `submitChoice(Buffer)` choices 仍 `{}`，三者都回「無效請求」。**輪次 2 的那條 blocking 確實修好了。**
我另加測 25 種值 × 跨 realm：Buffer／11 種 TypedArray／ArrayBuffer／DataView／Date／Map／Set／RegExp／function 全擋；`{}`／`Object.create(null)`／`JSON.parse` 結果／**vm 跨 realm `{}`** 全放行，**0 個誤判**。

---

### 硬性不變量（Codex 與我各自獨立跑，結果一致）

| 項目 | 結果 |
|---|---|
| `checkWin` vs HEAD | ✅ **逐字 0 差異**（Codex 另附 SHA-256 `96cf2c20…37a` 兩邊相同） |
| 六個秒數常數 | ✅ 零改動（15／5／45／45／3／3） |
| `grep -o '!important' public/focus.css \| wc -l` | ✅ **10**（HEAD 也是 10） |
| `grep -o '!important' public/cards.css \| wc -l` | ✅ **3**（HEAD 是 4） |
| `node --test tests/card-flow.test.cjs` | ✅ **39 / 39 綠** |
| `on()` / `onNoAck()` | ✅ **22 / 7**（合計 29） |
| 事件名核對 | ✅ HEAD 29 個裸 `socket.on` ↔ WORK 29 個 `on/onNoAck`，`diff` **無輸出**，零新增／零移除 |
| 新增 action / 遊戲規則 | ✅ 玩家 action 仍 `work/idle/slack`＋主管 `supervise`；幽靈 action 表未增加 |
| `git diff --check` | ✅ 無輸出 |
| Codex 是否動過 repo | ✅ `git status --short` 前後一致，HEAD 仍 `0fb7f22` |

---

### 寫手兩項自我宣稱的複驗（我自己跑過，沒有採信）

- **「15 個突變全部被抓到」→ ✅ 屬實。** 我跑 `mutate.js`：15 個突變全紅。Codex 也跑出同樣結果，失敗數依序 `5,5,3,3,3,3,3,5,4,5,3,3,1,1,4`。
- **「舊 regex 6 個突變裡 4 個假綠，新做法 0 個」→ ⚠️ 前半屬實，後半不成立。** 我跑 `oldvsnew.js`：基準都是 `4760 / 7660`，舊 regex 4 個假綠、新 harness 對**腳本列出的那 6 個**全抓到。
  **但「新做法 0 個假綠」只在腳本自己列的清單內成立**——Codex 加了第 7 個突變（註解保留舊 `KAROSHI_MS`、真常數改值），**新做法 39/39 全綠**（即 B3-D，我已獨立重現）。
- **腳本可信度**：Codex 比對 scratch 的 `server.js`／`index.html`／`focus.js`／測試檔 SHA-256 與工作區相同；`mutate.js` 找不到替換目標會 `exit 2`，逐次跑真 `node --test` 並在結尾還原。**沒有發現突變未套用或比對條件放水。**
  → 教訓與輪次 2 完全同型：**突變測試只能證明「你想到的那個錯誤」會被抓到。**

---

### 🔴 未解事項（**必須留檔，不得記成已解**）

**三輪下來仍然沒有任何完整的瀏覽器實機驗證。** Codex 原文：

> 「仍沒有完整瀏覽器實機驗證。`[public/focus.js:58]` 的猝死演出是否荒謬好笑、`[public/focus.js:98]` 的四類卡面能否不讀字辨識、整局節奏與玩家是否真的親眼看見／理解結果，本輪均未驗證。
> VM/fake DOM 只證明排程控制流與毫秒數，**不證明真瀏覽器的 layout、動畫、背景分頁 throttling、重連或整局體感**。`[tests/card-flow.test.cjs:81]`
> 上述視覺與整局體感需人工確認；**此驗收缺口仍存在，信心 10/10**，實際演出品質未評分。」

這是本批最高驗收問題「玩家是否**親眼看到**」的直接缺口。**程式碼審查通過 ≠ 這條解了。放行前必須有人完整走過一局。**

---

### 阿審總結判定

**FAIL（Codex 判定，最後一輪 → 升給老闆）**

- ✅ **輪次 2 的唯一 blocker B3-2 確實修好了**——頂層 POJO 檢查跨 realm 正確，25 種值 0 誤判，輪次 1／2 的攻擊全部失效。
- ✅ **C4-2 的方向是對的**：真的執行前端函式、攔真的 `setTimeout` 延遲，Codex 也確認「已執行真函式控制流」。這比輪次 2 的 regex 有實質進步。
- 🔴 **但 C4-2 沒做完**：`KAROSHI_MS` 那一行是漏網的 regex，**同一類註解假綠原封不動還在**（B3-D）。這條長在本輪交付物上，我認為必須修。
- 🟡 **B3-A/B/C 是真 bug，但 HEAD 同樣有**——建議另開任務，請老闆裁決要不要綁進本批。
- 🔴 **整局實機體感仍然零驗證。**

**放行前最小修正集（我的建議）**：只修 **B3-D**（`tests/card-flow.test.cjs:113` 的 `KAROSHI_MS` 改走 comment-aware 擷取 ＋ 把該突變加進 `mutate.js`），加上**一次人工完整走局**。B3-A/B/C 另開票。

