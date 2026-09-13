# 揭曉畫面 比例與字級規格（T-設計）

> 老闆評語：**留白太多　字太小　找好比例**
> 本文只寫規格。作者請照著改，不要即興發揮。
> 量測依據：`.team/20260913-情緒定型/evidence-t1/` 的截圖，用 PIL 逐列掃描像素（方法與腳本附在 §8）。

---

## 0｜先說結論

| | 現況（量到的） | 目標 |
|---|---|---|
| 桌面五區盒高合計 | 829 px | 由內容決定，約 232–360 px |
| 其中真正有內容 | **132 px（16%）** | ≥ 70%，且每盒尾端死白 ≤ 12 px |
| 手機五區盒高合計 | 929 px，內容 69 px（**7%**） | 單欄，內容 ≥ 65% |
| 演出階段最大字 | `#revtitle`「第 2 回合揭曉」19 px（純 chrome） | 旁白 26 px（真的有資訊） |
| 主角（區名／玩家名／屏住呼吸） | **11 px 墨高 ≈ 12 px 字**，比 HUD 的 17 px 還小 | 17 px |
| 被巡查區的視覺強度 | 2 px 紅框 ＋ **1.3% 亮度差** ＋ 22 px 角落 emoji | 亮度差 ≥ 8%，光錐 ＋ 30 px 手電筒 ＋ 一句旁白 |

---

## 1｜病根：CEO 的判讀方向對，但機制錯了，照他的說法改會**完全沒效果**

CEO 說「`public/index.html:128-135` 的 `.board` 是固定 2 欄 grid，先給每區固定大格子再塞內容」。

**格子不是固定的，是「有彈性而且很貪心」。** 真正的因果鏈是三條規則疊起來：

| # | 檔:行 | 規則 | 作用 |
|---|---|---|---|
| ① | `public/index.html:162` | `.board{display:grid;grid-template-columns:1fr 1fr;gap:8px}` | 沒寫 `grid-template-rows` → 隱式列是 `auto` |
| ② | `public/index.html:163-164` | `.bzone{min-height:86px}` / `.bzone.office{min-height:70px}` | 只是**地板**，不是實際高度 |
| ③ | `public/focus.css:10` | `.focus-game .reveal-board-pane .board{height:auto;flex:1;min-height:120px;margin:0;overflow:auto}` | **`flex:1` 才是把盒子撐開的兇手** |

`.reveal-board-pane` 是 `display:flex;flex-direction:column`（同 `focus.css:10`）。`.board` 帶 `flex:1` → 吃掉 pane 裡所有剩餘高度。接著 grid 的 `align-content` 預設是 `normal`（對 grid 等同 `stretch`），**把多出來的高度平均灌給三列 auto 列，完全不看哪一列有內容**。

**算術對得上（這是證據不是推論）：**
```
底線   = office 70 + row2 86 + row3 86 = 242
gap    = 8 × 2 = 16
量到的 board 總高（t1-03-hold-breath.png，y 269→778）= 509
剩餘   = 509 − 242 − 16 = 251 → 平均分給 3 列 = 83.7
推得   office 70+84=154 / row2 86+84=170 / row3 86+84=170
量到   office 157      / row2 168      / row3 168     ← 誤差 ≤ 3 px
```

**反向驗證**：`t1-07-dead-ghost.png` 底部多了 `#revsum` 結算條，剩餘空間變少，同樣五區縮成 127/148/140。盒子會跟著剩餘空間伸縮 → 證明是 `flex-grow`，不是 `min-height`。

**對作者最重要的一句話：只改 `min-height:86px` 改成更小的數字，畫面一格都不會動。** 必須改的是 `flex:1` 和 `align-content`。

---

## 2｜比例決策

### 2.1 三條硬規則

**R1 — `.board` 不再 `flex-grow`，改成內容決定高度**
```
flex:1  →  flex:0 1 auto
並加    align-content:start
```
`align-content:start` 是關鍵：讓多餘空間留在 grid 外面，而不是平均塞進每一列。

**R2 — 空出來的高度給 `#revsum`，不是給盒子**
`#revsum` 加 `margin-top:auto`，釘在 pane 底部。地圖在上、戰果條在下、中間是舞台地板。
這樣演出第 ⑥ 步 `#revsum` 填入內容時，它是**往上長**、地圖不動 —— 情緒最高點不會發生 layout shift。
（🔴 不要改成整塊置中，那會讓 `#revsum` 一出現就把整張地圖推上去。）

**R3 — `.bzone` 高度由 chip 列數決定，公式化**

在 `.focus-game .reveal-board-pane` 上宣告四個變數當唯一旋鈕：
```
--bz-pad : 8px    盒內上下 padding
--bz-head: 26px   區名那一行的行高（17px 字 × 1.5）
--bz-chip: 36px   一列 chip 的高度（17px 字 + 上下 6px padding + 邊框）
--bz-gap : 6px    區名與 chip 之間、chip 列之間
```

| 狀態 | min-height 公式 | 算出來 |
|---|---|---|
| 空區（無 chip） | `calc(var(--bz-head) + var(--bz-pad)*2)` | **42 px** |
| 有 1 列 chip | `calc(var(--bz-head) + var(--bz-pad)*2 + var(--bz-gap) + var(--bz-chip))` | **84 px** |
| 有 2 列以上 | 不設上限，內容自己撐 | 2 列 ≈ 126 px |
| **空區但被巡查** | 同「有 1 列 chip」，**不准收窄** | **84 px**（理由見 §4.3） |

空／非空用 `:has()` 判斷。**這個 codebase 已經在用 `:has()`**（`public/focus.css:3` 的 `body:has(#s-home:not(.hide))`），不是新依賴。

```
.bzone                          → min-height: 空區公式
.bzone:has(.chip)               → min-height: 一列公式
.bzone.inspected                → min-height: 一列公式（覆蓋空區）
```

⚠️ 不會有「先收起再展開」的跳動：`index.html:812` 的 `$('ch_'+zk).appendChild(el)` 在第一幀就把 chip 塞進 DOM 了，`.in` class 只控制透明度／位移。`:has(.chip)` 從第一幀就成立。

### 2.2 三種人數下長什麼樣（桌面，board 可用高度約 509 px）

假設 402 px 寬的欄位一列放得下 2 顆 chip。

| 人數 | 分佈範例 | office | row2 | row3 | board 總高 | 舊高 | 省下 |
|---|---|---|---|---|---|---|---|
| **3 人**（1 boss + 2 emp，如 `t1-03`） | 辦公室 1、茶水 1、其餘空 | 84 | 84 | 42 | **226 px** | 509 | 283 px |
| **4 人**（3 emp） | 辦公室 1、頂樓 2、其餘空 | 84 | 42 | 84 | **226 px** | 509 | 283 px |
| **6 人**（5 emp，如 `t1-01`） | 辦公室 1、頂樓 3（2 列）、其餘空 | 84 | 42 | 126 | **268 px** | 509 | 241 px |
| **8 人 最壞**（7 emp 全擠一區） | 一區 4 列 chip | 42 | 210 | 42 | **310 px** | 509 | 199 px |

**最壞情況 310 px < 509 px，所以拿掉 `flex:1` 絕對安全。**
`overflow:auto`（`focus.css:10`）保留當安全網，不要刪。

省下的 200–280 px 去向（依序）：
1. 旁白區（新主角）≈ 52 px
2. `#revsum` 靠底部撐開 ≈ 28 + n×26 px
3. 剩下的當舞台地板留白 —— 這才是**有意義的留白**：它是空的，因為它本來就該是空的，而不是五個空盒子假裝有東西。

---

## 3｜字級階層

### 3.1 現況（量到的墨跡高度；中文全形字墨高 ≈ font-size − 1~2 px）

| 元素 | 檔:行 | CSS 值 | 量到墨高 | 截圖 |
|---|---|---|---|---|
| HUD「第 2/4 回合」 | `focus.css:6` | 16px | 17 px | t1-03 |
| `#revtitle`「第 2 回合揭曉」 | `focus.css:10` | 19px | 18 px | t1-03 |
| **區名 `.bzone .bt`** | `index.html:165` | **.78rem = 12.5px** | **11 px** | t1-03 |
| **玩家 `.chip`** | `index.html:171` | **.8rem = 12.8px** | **11 px** | t1-03 |
| **結果浮字 `.float`**（`🚨+2心悸`／`💰+4`） | `index.html:180` | **.82rem = 13.1px** | — | t1-03 |
| 手電筒 `.stamp` | `index.html:167` | 1.4rem = 22.4px | — | t1-03 |
| 摘要大標 `.result-heading h2` | `focus.css:11` | 28px | 26 px | t1-10 |

**這就是老闆說的「字太小」的精確版本：**
演出階段的主角（區名 12 px／玩家名 12 px／「屏住呼吸…」12 px／結果浮字 13 px）**全部小於行政 chrome（HUD 16 px、回合標 19 px）**。階層是反的。
而且 `docs/UI規格_桌面版1920x1080_20260909.md:48-49` 白紙黑字寫著：
> 05｜Reveal（**最強情緒畫面，不是資訊頁**）…數值浮現（+2/+1/+3心悸）**全部不用小字**。

現在 13 px 的 `.float` 是直接違反既有規格，不是我的個人品味。

### 3.2 目標字級表（桌面 ≥700px）

| 排序 | 元素 | selector（寫在 `focus.css`） | 現況 | **目標** | weight | 色 |
|---|---|---|---|---|---|---|
| 🥇 **主角** | 旁白（新增） | `.focus-game .reveal-board-pane .act-narr` | 不存在 | **26px** | 800 | `--wood2` |
| 🥇 **主角** | 結果浮字 | `.focus-game .reveal-board-pane .float` | 13.1px | **22px** | 900 | 維持 gold/red/blue/mut |
| 🥈 第二 | 玩家 chip | `.focus-game .reveal-board-pane .chip` | 12.8px | **17px** | 800 | `--ink` |
| 🥈 第二 | 區名 `.bt` | `.focus-game .reveal-board-pane .bzone .bt` | 12.5px | **17px** | 800 | `--muted` → **`--kraft2`** |
| 🥈 第二 | 手電筒 `.stamp` | `.focus-game .reveal-board-pane .stamp` | 22.4px | **30px** | — | — |
| 🥉 第三 | 幽靈跑馬燈 `.toast` | `.focus-game .reveal-board-pane .toast` | 13.6px | **15px** | 700 | 維持 |
| 🥉 第三 | 戰果條 `.sumline` | `.focus-game .reveal-board-pane .sumline` | 14.7px | **15px** | 維持 | 維持 |
| ⬇️ **降階** | `#revtitle` | `.focus-game #revtitle` | 19px | **13px**，`letter-spacing:1px`，色 `#8d6f3f` | 700 | — |

**`#revtitle` 為什麼降階而不是刪掉：**
摘要階段已經有一模一樣的處理 —— `.step-kicker{font-size:11px;letter-spacing:1px;color:#8d6f3f}`（`focus.css:6`），畫面上長成「③ 揭曉 · 第 1 回合」（見 `t1-10-boss-view.png` 大標上方那行小字）。演出階段套同一套 kicker，兩段舞台的頭部就統一了。這是**跟既有設計對齊**，不是新發明。

降完之後階層變成：旁白 26 > 浮字 22 > chip/區名 17 > HUD 16 > toast/sumline 15 > kicker 13。**主角終於最大。**

### 3.3 🔴 不准動 HUD

不要為了「讓主角相對變大」去縮 `.status-band h2` 或 `.status-band .me b`。
`focus.css:6` 有 `.focus-game .status-band .me b{font-size:16px!important}` —— **你一碰就得加新的 `!important` 才壓得回去，直接違反鐵則**，而且 HUD 是 choose/admin/reveal 三個 phase 共用，改了會全站連動。
把主角拉到 26 px 就已經解決階層反轉，不需要動 HUD。

---

## 4｜空區怎麼處理

### 4.1 結論：**收成窄帶，永遠不收起**

**理由（三條，都不是美感問題）：**
1. **空間記憶。** 五區順序由 `index.html:804` 的 `zoneOrder=['office',...ST.slackZones]` 固定。如果區塊按回合出現／消失，玩家無法跨回合比對「上回合誰在頂樓」。地圖必須是同一張地圖。
2. **「沒人去」是推理輸入。** 頂樓是 💰+4/💓+3 的最高風險區（`index.html` 規則文 909 行）。整桌沒人敢上頂樓，本身就是牌桌風向的情報。
3. **「老闆撲空」需要空區才成立。** 見 §4.3。

### 4.2 空區的視覺語言：沿用既有的 `vacant`

`index.html:129` 已經有 `.kcard.vacant{opacity:.75;border-style:dashed}` 這套「從缺」語彙（結算三王從缺時用）。空區直接沿用，不要新發明：

```
空區（:not(:has(.chip)) 且 :not(.inspected)）：
  min-height  : 42px（§2.1 公式）
  border-style: dashed
  border-color: var(--line)        ← 從 --kraft 降階
  background  : var(--paper2) 平塗  ← 拿掉漸層，讓它明顯是「沒事發生」
  .bt 保持 17px 不降 ——「這區沒人」要讀得到，壓縮的是盒子不是字
```

**不准在空盒子裡塞裝飾插畫、剪影、「無人」浮水印去填空白。** 空區的資訊價值就是空。填滿它等於刪掉情報。

### 4.3 🔴 例外：空區 ＋ 被巡查 ＝「老闆撲空」，必須放大

`t1-03-hold-breath.png` 裡的 **影印間** 就是這個狀態：老闆巡了、裡面一個人都沒有。
現在它長成一個 168 px 的粉紅色空盒子，**沒有任何文字說明發生了什麼**。這是整張截圖裡最浪費的區域 —— 它承載的是員工陣營這回合最爽的一刻，卻什麼都沒講。

規格：
```
.bzone.inspected:not(:has(.chip))
  min-height : 84px（不准套空區的 42px）
  border     : 實線，維持 --red
  ：在區名右側顯示「撲空」字樣（17px，色 --green）
```
「撲空」兩個字從 `r.bossZoneKeys` 對照該區 chip 數量即可判定，**不需要 server 新欄位、不是新規則**，只是把已經在畫面上的事實講出來。
（若作者不想碰 JS，可用 `.bzone.inspected:not(:has(.chip)) .bt::after{content:'　· 撲空'}` 純 CSS 達成。可接受，但 JS 版比較好，因為和 §5 的旁白共用同一個 touchpoint。）

---

## 5｜被巡查區的強度

### 5.1 現況有多弱（量到的，不是感覺）

`t1-03-hold-breath.png` 取樣盒內平均色：

| | RGB | 相對亮度 |
|---|---|---|
| 一般區（廁所）內部 | (238, 226, 192) | 225.8 |
| 被巡區（影印間）內部 | (242, 217, 198) | 222.4 |

**亮度差 3.4 / 255 = 1.3%。人眼在 parchment 底色上基本看不出來。**
唯一真的看得到的訊號只有 2 px 的邊框變色（102,104,79 → 168,50,38）＋ 右上角 22 px 的 🔦。
而且 `index.html:166` 的 `animation:pulseR 1s ease-in-out 2` **只跑 2 次就停**，玩家一眨眼就沒了，之後畫面是靜止的。

「老闆巡查」是這個畫面的戲劇核心，現在的強度配不上。

### 5.2 該多強：把「紅底」換成「光錐」，並且把周圍**壓暗**

聚光燈的原理是對比，不是自己發光。`docs/美術指導_童話繪本風_20260909.md:151` 的 prompt 本來就寫著 `dramatic golden spotlight` —— 走這個語彙，不要做現代 UI 的 glow。

**S1 — 被巡區：從手電筒位置打下來的光錐**
🔦 在 `top:4px;right:6px`（`index.html:167`），所以光源在右上角：
```
background: radial-gradient(120% 90% at 88% 0%,
              #ffe9b0 0%,      /* 光心 */
              #f6dcc0 38%,
              #f0cdb8 100%);   /* 錐外，帶紅褐 */
border     : 3px solid var(--red);   /* 2px → 3px */
```

**S2 — 未巡區：壓暗（這一條才是真正拉出對比的）**
```
.board:has(.bzone.inspected) .bzone:not(.inspected){
  filter: brightness(.93) saturate(.8);
}
```
壓暗後 (238,226,192) × .93 → 亮度 209。對上光心 233 → **亮度差 24 / 255 = 9.4%，是現況 1.3% 的 7 倍**。

**S3 — 手電筒放大**：`.stamp` 22.4px → **30px**。

**S4 — 脈動改成「落錘一次」**
`pulseR … 2` 改成單次、較重的一拍（例：`.45s cubic-bezier(.2,1.6,.4,1) 1`，配合 border-color 從 `--kraft` 轉到 `--red`）。
✅ 這不影響 `revAnimEndsAt`（JS 獨立算的，`index.html:863`），可以安心改。

**S5 — 給它一句話（見 §5.3）。** 光效沒有文字就還是默片。

**驗收指標**：截圖取樣，被巡區最亮點 vs 相鄰未巡區的相對亮度差 **≥ 8%**（現況 1.3%）。用 §8 腳本量。

### 5.3 旁白（新主角）

演出階段現在最大的字是「第 2 回合揭曉」——**一句零資訊的 chrome**。手電筒亮起來的那一刻，畫面上沒有任何文字告訴玩家發生了什麼。

規格：在 `.reveal-board-pane` 的 kicker 那一行**下方**加一個 `.act-narr`（26px／800）。

| 時點 | 內容 |
|---|---|
| 演出開始（t=0） | **空字串，但保留 `min-height:1.4em`** ← 之後填字不會 layout shift |
| 手電筒落下（`index.html:832` 既有的 `rvT` 裡） | `r.bossZones.length ? `🔦 老闆走進 ${r.bossZones.join('、')}` : '🔦 老闆今天沒出巡'`　；若 `r.supZoneKey` 再接 `｜🕵️ 主管去了 ${r.supZone}` |

🔴 **這不是新增遊戲規則。** `r.bossZones` / `r.supZone` 這兩個欄位現在已經印在畫面上兩次了 —— `#revsum` 第一行（`index.html:855`）和 `#revlist`（`index.html:774`）。我只是把它從 13 px 的註腳，搬到 26 px 的主角位。零新增 server 欄位、零數值變動。

---

## 6｜手機規格

### 6.1 先講清楚證據的限制

🔴 `t1-13-mobile-act.png` / `t1-14` / `t1-15` 是 **430×860**（iPhone 14 Pro Max），**不是 375**。**我沒有 375px 的截圖，下面 375 的數字是依 CSS 推算，不是量到的。**
作者改完請補一張真的 375px 截圖驗收。

### 6.2 手機現況（430px，量到的）

| 區 | 盒高 | 內容 | 空 |
|---|---|---|---|
| 辦公室 | 165 px | 14 px (8%) | 151 px |
| 茶水間 | 181 px | 11 px (6%) | 170 px |
| 影印間 | 181 px | 13 px (7%) | 168 px |
| 廁所 | 201 px | 16 px (8%) | 185 px |
| 頂樓 | 201 px | 15 px (7%) | 186 px |
| **合計** | **929 px** | **69 px（7%）** | **860 px（93%）** |

**手機是最慘的：93% 是空的。** 整個 860 px 高的螢幕，扒掉 HUD 之後全是五個空盒子。

另外量到：手機區名墨高 **11 px，和桌面一模一樣** —— `.bzone .bt` 沒有任何 mobile override，12 px 的字直接搬到手機上。

**順帶回報一個 bug（不是我要的改動，是既有死碼）：**
`screen.css` 的 `@media(max-width:700px){#revtitle{font-size:12px}}` **完全沒生效**。
`#revtitle`(1,0,0) 輸給 `focus.css:10` 的 `.focus-game #revtitle`(1,2,0)，而且 focus.css 載入更晚（`index.html:1017` vs `1020`）。
證據：`t1-13-mobile-act.png` 的「第 1 回合揭曉」量到 18 px，不是 12 px。
→ 作者依 §3.2 在 `focus.css` 改 `#revtitle` 時，這條 screen.css 的死規則會一併失效，不用管它，**但也不要去 screen.css 改，改了照樣不生效。**

### 6.3 手機規格（≤700px）

**M1 — 單欄。**
```
.focus-game .reveal-board-pane .board{grid-template-columns:1fr}
.focus-game .reveal-board-pane .bzone.office{grid-column:auto}
```
> `.bzone.office{grid-column:1/3}`（`index.html:164`，0-2-0）輸給 `.focus-game .reveal-board-pane .bzone.office`（0-4-0）。**不需要 `!important`。**

理由：430px 下兩欄各 189 px，一列只塞得下 1 顆 chip —— 兩欄一點好處都沒有，卻把可讀寬度砍半。單欄下 388 px 寬可以塞 2 顆 chip，而且區名拉到 15 px 也不會被截斷。

**M2 — 手機變數（同一組 `--bz-*`，只調數值）**
```
--bz-head: 23px   /* 15px × 1.5 */
--bz-chip: 32px
--bz-pad : 7px
--bz-gap : 5px
→ 空區 min-height = 37px；1 列 chip = 74px
```

**M3 — 手機字級（桌面 −2~4px）**

| 元素 | 桌面 | **手機 ≤700px** |
|---|---|---|
| 旁白 `.act-narr` | 26px | **20px**，`line-height:1.35` |
| 結果浮字 `.float` | 22px | **18px** |
| chip | 17px | **15px** |
| 區名 `.bt` | 17px | **15px** |
| 手電筒 `.stamp` | 30px | **26px** |
| toast / sumline | 15px | **13px** |
| kicker `#revtitle` | 13px | **11px** |

**M4 — 375px 的算式（請驗）**
board 寬 ≈ 375 − 20(wrap padding) − 22(surface padding) ≈ 333 px，單欄盒內寬 ≈ 309 px。
chip「🐣 摸魚見習生💼」@15px ≈ 15×6 + 2×20(emoji) + 28(padding) ≈ **158 px** → 一列剛好 2 顆（158×2+5=321 > 309 → 實際 1–2 顆會 wrap）。
`.chips{flex-wrap:wrap}`（`index.html:170`）已經會處理，不用改。

**M5 — 五區單欄總高試算（6 人局）**
`37(空) + 74 + 37 + 106(2列) + 37 = 291 px` ＋ 4×gap(8) = **323 px**，遠低於現在的 929 px。

**M6 — 斷點選擇**
用既有的 **≤700px**（`screen.css` / `focus.css` 都已經在用這個斷點），不要新開斷點。
若老闆看了覺得平板（600–700px）單欄太空，把這段改成 `≤480px` 即可，兩種都不破壞其他規則 —— 這是我唯一願意出兩版給老闆選的地方。

---

## 7｜改哪一層（🔴 不要疊第五層）

載入順序（`public/index.html:1015-1021`）：
```
index.html <style>  →  cards.css/js  →  screen.css/js  →  menu.css  →  focus.css/js
```

### 7.1 所有 CSS 改在 `public/focus.css`

它是最後一個 CSS，而且**已經擁有** `.focus-game .reveal-board-pane .board` 這條規則（`focus.css:10`）。在既有那一行上改，不要新開檔案、不要回頭改 `screen.css` 或 `index.html` 的 `<style>`（會被蓋掉 —— §6.2 的 `#revtitle` 就是活生生的例子）。

**🔴 保證不需要任何 `!important`，一個都不用加：**

| 目標 | 你寫的 selector | 特異性 | 對手（現況贏家） | 特異性 |
|---|---|---|---|---|
| `.board` | `.focus-game .reveal-board-pane .board` | 0-3-0 | 同一條，就地改 | — |
| `.bzone` | `.focus-game .reveal-board-pane .bzone` | 0-3-0 | `.bzone`(index.html:163) | 0-1-0 ✅ |
| `.bzone.office` | `.focus-game .reveal-board-pane .bzone.office` | 0-4-0 | `.bzone.office`(index.html:164) | 0-2-0 ✅ |
| `.chip` / `.bt` / `.float` / `.stamp` | `.focus-game .reveal-board-pane X` | 0-3-0 | `index.html` 裸 class | 0-1~2-0 ✅ |
| `#revtitle` | `.focus-game #revtitle`（既有） | 1-2-0 | `#revtitle`(screen.css) | 1-0-0 ✅ |
| `#revsum` | `.focus-game .reveal-board-pane #revsum`（既有） | 1-3-0 | `#revsum`(screen.css) | 1-0-0 ✅ |

**`focus.css` 現有 `!important` 數量 = 10。改完必須還是 10。** 這條當 PR 的硬門檻：
```
grep -o '!important' public/focus.css | wc -l    # 必須輸出 10
```

### 7.2 JS 只碰一個函式：`public/index.html` 的 `playReveal()`（`:801-864`）

只有兩件事需要 JS，而且**只能**寫在這裡：
1. §5.3 的旁白（掛進 `:832` 那個既有的 `rvT(...)` 裡 —— 手電筒落下的同一拍）
2. §4.3 的「撲空」字樣（可選，也可以走純 CSS `::after`）

**為什麼不疊第五層**：演出的時間軸 `t` 和 `revAnimEndsAt` 只有 `playReveal` 知道。任何外層 monkey-patch 都得重新推導一次時間軸，必然和本體 desync，第一個壞掉的就是 T1 的 `act → summary` 自動切換（`focus.js:48` 靠 `revAnimEndsAt` 決定何時切）。

**動 `playReveal` 的三條紅線：**
- ❌ 不准改 `t` 的任何累加、`D()`、`rvT()` 的時間常數、`revAnimEndsAt` 的算式（`:863`）
- ❌ 不准改 `zoneOrder`（`:804`）或 `outcomeIcon()` 回傳的字串（`:786-800`）—— 那是規則語意
- ✅ 只准在既有的 `rvT(...)` callback **裡面**多寫一行 DOM 設值

### 7.3 撞車提醒

`public/index.html` 同時有三位寫手在改。`playReveal()` 的改動範圍是 `:801-864` 共 64 行，請先喊一聲確認沒人在動這一段。CSS 那邊（`focus.css`）衝突面小很多，優先做 CSS，JS 那 2 行最後補。

---

## 8｜驗收

### 8.1 硬指標（可量、可否證）

| # | 指標 | 現況 | 通過門檻 | 怎麼量 |
|---|---|---|---|---|
| A1 | 每個 `.bzone` 最後一個內容像素 → 盒底的距離 | 88–129 px | **≤ 12 px** | 下方腳本 |
| A2 | 桌面五區內容佔比 | 16% | **≥ 70%** | 下方腳本 |
| A3 | 手機五區內容佔比 | 7% | **≥ 65%** | 下方腳本 |
| A4 | 演出階段最大字 | 19px（chrome） | **26px 旁白（有資訊）** | 量墨高 |
| A5 | 區名／chip 字級 | 11px 墨高 | **≥ 15px 墨高** | 量墨高 |
| A6 | 被巡區 vs 鄰區亮度差 | 1.3% | **≥ 8%** | 下方腳本 |
| A7 | `focus.css` 的 `!important` 數 | 10 | **= 10** | `grep -c` |
| A8 | T1 兩段舞台 | — | act→summary 自動切、跳過鈕、同回合不重播 **全部照舊** | 手測 |

### 8.2 量測腳本（我就是用這個量出上面所有數字的）

```python
from PIL import Image
def lum(c): return 0.299*c[0]+0.587*c[1]+0.114*c[2]
def check(fn, boxes, inset=10):
    im=Image.open(fn).convert("RGB"); px=im.load(); tot=used=0
    for name,(x0,y0,x1,y1) in boxes.items():
        first=last=None
        for y in range(y0+inset, y1-inset):
            if sum(1 for x in range(x0+inset,x1-inset) if lum(px[x,y])<150) >= 2:
                if first is None: first=y
                last=y
        h=y1-y0; u=(last-first+1) if first else 0; tot+=h; used+=u
        print("  %-5s h=%3d 內容=%3d (%2.0f%%) 尾端死白=%3d" %
              (name,h,u,100*u/h, (y1-inset-last) if last else h))
    print("  >>> 合計 h=%d 內容 %d px (%.0f%%) 空白 %.0f%%" %
          (tot,used,100*used/tot,100*(tot-used)/tot))

# 盒座標請用「垂直/水平掃描找邊框變色點」重新量，不要沿用舊值（版面會變）
# 舊值（t1-03-hold-breath.png, 900x820）僅供對照：
check("t1-03-hold-breath.png", {
 "辦公室":(42,269,858,426), "茶水間":(42,434,444,602), "影印間":(454,434,856,602),
 "廁所":(42,610,444,778),  "頂樓":(454,610,856,778)})
```

### 8.3 要補的截圖

| 檔名 | 條件 |
|---|---|
| `t4-01-act-3p.png` | 桌面 3 人局演出階段（對照 `t1-03`） |
| `t4-02-act-6p.png` | 桌面 6 人局演出階段（對照 `t1-01`） |
| `t4-03-act-spotlight.png` | 手電筒落下的那一幀（驗 A6 ＋ 旁白） |
| `t4-04-act-miss.png` | **空區被巡查＝撲空**（§4.3，對照 `t1-03` 的影印間） |
| `t4-05-mobile-375-act.png` | **真的 375px**，不要再用 430 |
| `t4-06-summary-unchanged.png` | 摘要階段（證明 §3 沒有波及 `t1-10` 的版面） |

---

## 9｜🔴 不要做什麼

1. **不准新增 `!important`。** `focus.css` 現在是 10 個，改完還要是 10 個。§7.1 已經證明每一條都有足夠特異性，不需要。
2. **不准動 `.status-band`（HUD）。** `focus.css:6` 的 `.me b{font-size:16px!important}` 會逼你加新的 `!important`。而且 HUD 跨 phase 共用。
3. **不准改 `playReveal` 的時間軸**：`t` 累加、`D()`、`rvT()` 常數、`revAnimEndsAt`（`index.html:863`）。改了就破壞 T1 的 `act → summary`。
4. **不准動跳過鈕 `skipReveal()`（`index.html:801`）與同回合不重播的 `revAnimKey`（`:783-784`）／`revealSeen()`（`focus.js:43-44`）。**
5. **不准把空區 `display:none` 或從 `zoneOrder`（`index.html:804`）拿掉。** 理由見 §4.1。
6. **不准拿掉 `.board` 的 `overflow:auto`。** 8 人擠一區時的安全網。
7. **不准把演出階段改成整塊垂直置中。** `#revsum` 在第 ⑥ 拍才填內容，置中會讓整張地圖在情緒最高點往上跳。用 `margin-top:auto` 釘底（§2.1 R2）。
8. **不准在空盒子裡塞裝飾**（插畫、剪影、「無人」浮水印、假數據）。空區的資訊價值就是空。
9. **不准改色。** 只准用 `index.html:9` `:root` 裡既有的變數。§5.2 的光錐色階（`#ffe9b0`/`#f6dcc0`/`#f0cdb8`）是在既有 `warm muted storybook palette`（`docs/美術指導_童話繪本風_20260909.md:336-347`）內的暖米／暖褐，沒有離開色票。
10. **不准做現代 UI 的 glow / 漸層英雄區 / 儀表板卡片。** `docs/美術指導_童話繪本風_20260909.md:8-13`：按鈕要做木牌、羊皮紙、魔法印章；負面提示明列 `no glossy mobile game UI`。被巡查做的是**光錐**不是 box-shadow glow。
11. **不准改 `outcomeIcon()` 的字串或 `ZI` 圖示。** 那是規則語意不是排版。
12. **不准回頭改 `screen.css` 或 `index.html` 的 `<style>` 來調揭曉版面。** 會被 `focus.css` 蓋掉（`#revtitle` 就是現成的死碼案例，§6.2）。

---

## 10｜為什麼這些改動服務「玩家是否親眼看到、並理解自己為什麼」

| 老闆的話 | 對應改動 | 服務了驗收問題的哪一半 |
|---|---|---|
| 留白太多 | §2 `flex:1` → `flex:0 1 auto` + `align-content:start`；空區收成 42px 窄帶 | **看到**：五個空盒子把視線攤平，沒有任何一處值得停留。收掉之後，有人的區／被巡的區自然成為畫面焦點 |
| 字太小 | §3 主角 12px → 17px，結果浮字 13px → 22px，新增 26px 旁白，`#revtitle` 降階成 13px kicker | **看到 ＋ 理解**：`🚨 +2 心悸` 從 13px 的註腳變成 22px 的宣告；旁白第一次用文字說出「老闆走進哪裡」 |
| 找好比例 | §2.1 `--bz-*` 公式（空 42 / 1 列 84 / 每多一列 +42）；§5 聚光燈對比 1.3% → 9.4%；§2.1 R2 revsum 釘底 | **理解**：盒子的高度第一次和「裡面有幾個人」成正比 —— 版面本身變成資訊。老闆巡到哪裡，是畫面上最亮的地方 |

現況最尖銳的一句話：在 `t1-03-hold-breath.png` 裡，玩家唯一的一次生死判定（「🫁 屏住呼吸…」）是用 **12 px** 顯示的，而畫面上最大的字是「第 2 回合揭曉」（**19 px**，零資訊）。
本規格做的事，就是把這兩個數字對調過來。

---

## 附：我沒做到的事（誠實標記）

- **沒有跑瀏覽器實測。** 本文所有數字都是從 `evidence-t1/` 的 PNG 逐像素量出來的，沒有跑 `/browse` 開實機。CSS 的因果鏈（§1）是「讀規則 + 算術對帳 + 兩張截圖交叉驗證」推出來的，不是實機 DevTools 量的。作者改完請用 §8.2 腳本在新截圖上驗一次。
- **沒有拿到第二雙眼睛。** OpenClaw（`192.168.122.105:18790`）回 401、shim（`127.0.0.1:18899`）回 404，兩條視覺評審路徑都不通，所以本文是單人判斷。§6.3-M6（手機斷點 700 vs 480）是我唯一沒把握的 taste 決策，已標明兩案並存。
- **沒有 375px 的證據。** §6.2 之外的 375 數字全是推算（§6.1 已標示）。
- **`t1-08-toast.png` / `t1-11-skip-before.png` / `t1-15-mobile-boss.png` 沒逐一量。** 它們的版面結構與已量的同型，沒有另外量的必要；若作者發現這三張有本文未涵蓋的狀態，請回報。
