# 任務 20260913-情緒定型

> 由 CEO 撰寫。這是阿寫的北極星、阿審的判準。需求或驗收標準有歧義時，角色應停下回報 CEO，不要硬猜。
> **本檔所有「現況」敘述都附 `檔:行` 證據，來自 2026-09-13 兩路程式盤點。實作前若發現與現況不符，停下來回報，不要硬改。**

## 業務線
客戶網站App（個人側案：摸魚王線上版）

---

## 核心判斷（這一階段的唯一判準）

**現在已經有「可玩的系統」，缺的是「想分享給朋友玩的情緒」。**

→ **這一階段不加規則，只加情緒。**
任何會增加玩家「要學的新東西」的改動一律退回，不管它多好玩。

## 🎯 最高驗收問題（每一項改動都要能回答）

> **玩家是否親眼看到發生了什麼，並且能理解自己為什麼得到這個結果？**

卡面與動畫都服務這件事。做完每個子任務，先用這句話自問一次；答不出來就是沒做完。

---

## 需求

老闆 2026-09-13 定調的優先順序：

| 優先 | 工作 | 驗收重點（老闆原話） |
|---|---|---|
| 1 | 恢復揭曉動畫入口與容器可見性 | 玩家實際看得到巡查、屏息、抓捕；看完能進個人總結 |
| 2 | 過勞警告與猝死演出 | 工作連續兩回後，提交前清楚提示「再工作將出局」 |
| 3 | 四類手牌卡面 | 看得懂效果、使用時機與目標；藉口清楚標示自動觸發 |
| 4 | 恢復封面／大廳美術，補素材命名 | 一屏操作下仍保有世界觀，重要按鈕不被擠出畫面 |
| 5 | 三王結算 + 故事書 | （CEO 追加，唯一動 server.js 的，最後做） |

盤點證實：**老闆要的「揭曉高潮」有八成已經寫好了，只是被一條 CSS 蓋住看不到**。這批工的性質是「掀開 + 補強 + 接線」，不是「從零做」。

---

## 🔒 工程約束（老闆工程審查追加，不可違反）

### C1｜「首回合」與「第一局」是不同需求
零點數只能證明**開局買不起**（`server.js:218` vs `server.js:61` vs `server.js:970`）。
老闆選的是**整個第一局隱藏市場**＝新手流程設計，不是規則改動。因此：
- 前端必須有**明確的「首次遊玩」判定**（localStorage 之類），不能拿 `round===1` 當代理
- **隱藏市場 ≠ 機器人停止購物**：bot 老闆的採購邏輯（`server.js:707-710`）照跑不動
- **隱藏市場 ≠ 市場規則停用**：`buyCard`（`server.js:952-976`）、`refillMarket`（`server.js:81`）後端完全不動
- 這是**顯示層的隱藏**，不是功能層的關閉

### C2｜不能只刪掉 `display:none!important`
直接掀開會讓地圖、結果卡、下一步按鈕**一起堆回來**。必須編排成：
- **揭曉演出 →（結束後）個人總結**，兩者是先後關係不是二選一
- 提供**跳過演出**的入口
- **重連或重複收到狀態時，同一回合不得反覆重播**（需要 round-level 的播放去重）

### C3｜替代方案必須是「當下合法」的
不可以提示玩家去點一個伺服器會拒絕的按鈕。實際合法性規則（已查證）：

| 行動 | 何時不合法 | 證據 |
|---|---|---|
| `idle` 休息 | **永遠合法**（無任何檢查） | `server.js:1083` |
| `slack` 摸魚 | 被加班令指定該回合 → 直接擋 | `server.js:1085` |
| `slack` 該區 | `lastZone===zone`（上回合待過）→ 擋 | `server.js:1088` |
| `risky` 賭命 | 該區 gain<2 → 擋 | `server.js:1089` |
| `hold` 憋氣 | 非菜鳥 → 擋 | `server.js:1091` |
| 主管 | 走 `supervise` 分支，根本沒有摸魚選項 | `server.js:1065-1067` |

**⚠️ 三個必須寫死的事實：**

1. **🔁 CEO 二次修正（2026-09-13）：「邊做邊摸」不是幽靈機制，是命名不一致。**

   原判斷（「程式裡不存在」）不夠準。查完四個出現處後的正確結論：
   - `server.js:414` 這行在**「摸魚成功」分支內**：`if(e.task){ e.task.progress+=1; r.note+='；邊做邊摸 任務 +1' }`
   - → **「邊做邊摸」的效果真的存在**，它不是一個按鈕，而是**「摸魚」在你有任務時的附帶效果**

   **真正的病在命名與文件照抄設計文件的三選一寫法**：

   | 位置 | 現況寫法 | 問題 |
   |---|---|---|
   | `index.html:823` | 「認真做｜**邊做邊摸**（+1 進度、有分但被抓算怠工）｜擺爛」 | 寫成**三選一**，玩家去找中間那個按鈕 → 找不到 |
   | `index.html:207` | 首頁 hint「老闆派工作、員工邊做邊摸」 | 同上 |
   | `server.js:414` | 揭曉時才冒出「邊做邊摸」四個字 | 玩家沒選過這個動作，結果報告卻這樣講 → 更困惑 |
   | `README.md:48` | 列為待辦 | 無害，它確實還沒做成獨立動作 |

   → **修法是統一命名，不是刪字**：改成「摸魚時若有任務，會順便推進度」這種講法。
   → 🔴 **仍然不准新增 action**。本批只使用現有 `work`／`idle`／`slack`。
   → 分工：`server.js:414` 由 T5 那位改；`index.html:207`／`:823` 由 T3 那位改。

   **同類病（一併記錄，本批可不處理）**：`safeCount`（`server.js:346,358,381`）只被累加**從未讀取**，而規則文 `index.html:819` 寫著「有人龜在辦公室，會害其他人各 +1 心悸」——**這條規則根本沒實作**，規則文在描述不存在的機制。

2. **🔁 CEO 修正（2026-09-13，原判斷錯誤，已查證推翻）：加班令下 `idle` 完全合法，不存在「必死」。**
   CEO 先前只驗證 `slack` 被擋就推論必死，未驗證 `idle`。老闆工程審查指出缺口，重查結果：
   - **提交層**：`server.js:1083` `if(action==='work'||action==='idle')` 直接收下，**整條分支沒有任何 `_otRound` 檢查**；加班檢查只存在於 `slack` 分支（`server.js:1085`）
   - **結算層**：`server.js:373-374` idle ＝ `safeCount++`、心悸 −1、「安全、不算摸魚」，**無任何加班懲罰**。`_otRound` 全檔 11 處，只有 `server.js:354` 在 `work` 分支讀它
   - **連工中斷**：`server.js:345` `e.workStreak = ch.action==='work' ? +1 : 0` → idle 直接歸零
   - **決定性證據**：bot 自己的實作註解（`server.js:570-572`）：`// 被加班令點名：只能認真做（領加班費）或發呆` → `Math.random()<0.85?'work':'idle'`
   → **走老闆二分表的第一列：伺服器允許 idle → UI 顯示「休息」這個合法替代方案。**
   → **「加班可造成無法避免的過勞出局」這個玩法問題不存在，不記入 backlog。**

3. **前端也沒有藏住 idle，不需要修入口。**
   - `cards.js:28` `const locked = slack && (you.lastZone===c.id || you.overtime)` → **只鎖摸魚卡**（`slack=!!z`），work/idle 照常可點
   - `index.html:657-658` 舊版同樣只作用於 `ST.slackZones`
   - `index.html:393` 已有橫幅「🕘 老闆要求你加班！本回合不能摸魚」+ 付 3💰 請假鈕（`you.points>=3` 才 enabled）
   → T2 要做的**不是解鎖**，是**把「休息」講成一個出口**。

### C4｜🔴 跨檔隱性契約：`revealAnimMs` ↔ `playReveal`（2026-09-13 新增，**所有後續寫手必讀**）

老闆裁決「揭曉倒數要等演出跑完才起算」後，`server.js` 新增了 `revealAnimMs(rv)`（約 `server.js:280-299`），
它是前端 `playReveal()` 演出時序的**鏡像**：

```
animMs = 3800 + n*480 + g*350 + (危險 ? 1600 : 0)      上限 REVEAL_ANIM_MAX_MS = 12000
n＝本回合有結果的員工數、g＝事件跑馬燈則數、危險＝有非主管員工待在被巡查區
```

**⚠️ 任何人改動 `public/index.html` 的 `playReveal` 演出時序（滑入 stagger、跑馬燈、手電筒、屏息 1600ms、
戰果淡入），都必須同步改 `server.js` 的 `revealAnimMs`，反之亦然。**

- 失準的後果：倒數提早或延後開始。**不會壞掉遊戲規則或結算**（已由測試釘住）。
- 引用時**用函式名不要用行號**（`playReveal`／`revAnimEndsAt`／`revealAnimMs`）——`index.html` 同時被多人改動，行號會漂。
- `REVEAL_SEC` 的**值**仍然不准改，改的只是「何時開始數」。有測試 `REVEAL_SEC itself is untouched` 釘住。

→ **wave 3 的版面比例改動（`design-reveal-layout.md`）若動到演出時序，必須一併更新 `revealAnimMs` 並補測試。**

---

## 驗收標準（成功長什麼樣）

### T1｜掀開已經做好的揭曉演出 【優先 1・Critical・最便宜】

**現況（bug）**：`focus.js:88` 每次進揭曉都加上 `focus-revealing`，`focus.css:9` 的
`#reveal.focus-revealing > :not(.focus-result):not(.focus-next){display:none!important}`
把整套演出容器全部隱藏。全檔搜尋 `focus-revealing` **只有加上那一處，沒有任何地方移除**。
被蓋住的東西（都已實作、都還在跑）：
- 員工逐一 stagger 滑入各區塊 `index.html:736-744`
- 老闆手電筒掃過 + 巡查區發光脈動 `index.html:753-757`、`index.html:132,135`
- **被抓危險區玩家先「🫁 屏住呼吸」顫抖 1600ms 再判生死** `index.html:758-777`、`index.html:141-142`
- 幽靈/道具事件跑馬燈 toast `index.html:748-752`
- 出局者灰階抖動 + 💀 幽靈頭像 `index.html:144,775`

- [x] 揭曉階段能實際看到上列五項演出（不是 DOM 存在，是螢幕上看得到）
- [x] 編排為 **演出 → 個人總結**（遵守 C2），演出結束後 `.focus-result` 仍然出現
- [x] 有**跳過演出**入口（遵守 C2）
- [x] **同一回合不重播**：重連、重複 state 廣播都不得再播一次（遵守 C2）
- [x] 老闆視角修好：目前 `focus.js:87` 因 `r.results` 只含員工（`server.js:344`）導致 `mine===undefined`，走 fallback 把所有人結果擠成一段密文字；且 `focus.js:89-90` 讓對比卡兩側顯示同一份 `bossZones`，對老闆零資訊量
- [x] 證據：`/browse` 或 `/qa` 跑一局單人練習，附揭曉連續截圖（屏息中 / 判定後 / 個人總結）+ 一張重連不重播的證明

### T2｜過勞警告與猝死演出 【優先 2・純前端，後端零改動】

**現況**：資料**已經在 client 手上**——`viewFor` 已回傳 `workStreak` 與 `workStreakLimit`（`server.js:146-197` 區段）、結果物件已帶 `suddenDeath:true`（`server.js:433-439`）、`WORK_STREAK_LIMIT=3`（`server.js:63`）。**後端零改動。**

**⚠️ 已經做了一半，不要重做**：`focus.js:79` 已有
`b.classList.toggle('lethal', ST.you.workStreak>=ST.workStreakLimit-1)` 與 `'⚠ 再工作就猝死'`。
真正缺的是下面三件事。另有一句常駐灰字警語 `focus.js:34`（與上面重複，考慮收斂）。

- [x] **警告要在提交前的顯眼位置**，不只是工作卡自己的 `card-effect` 文字
- [x] **列出當下合法的替代方案**（遵守 C3）——這是目前最大的缺口：玩家看到「再工作就猝死」，但畫面**沒告訴他休息可以把連工歸零**
  - 休息（`idle`）**永遠合法，加班令下也合法**，一律列出
  - 摸魚（`slack`）要先驗 `you.overtime` 與 `you.lastZone` 才能列
  - ❌ **不得出現「邊做邊摸」**
- [x] 修掉 `focus.js:79` 的硬編碼：`連做 ${ST.you.workStreak||0}/3` 把 3 寫死，與同一行使用的 `ST.workStreakLimit` 不同步
- [x] 猝死揭曉**荒謬好笑**，不是一行字。要有演出，時長 ≥1.5 秒
- [x] 猝死者**不是被懲罰，是換跑道**：畫面立刻告訴他「你現在可以爭 👻 搞鬼王」
- [x] 證據：截圖（連工二的警告 / 替代方案含休息 / 加班令下休息仍可點 / 猝死演出）

### T3｜四類手牌卡面 【優先 3】

**老闆已裁定**：四類 = **藉口／干擾／增益／社交**，`mooch`（🙏凹同事）保留為社交類。
對應現況（`server.js:61` `PRICES`）：`excuse`→藉口、`jam`→干擾、`energy`+`boost`→增益、`mooch`→社交。
目前道具是 emoji chip（`focus.js:38`），不是卡牌。

- [x] 每張卡固定四要素：**圖、名稱、效果、使用時機**
- [x] 四類視覺可區分，不讀字就知道哪類
- [x] **藉口卡清楚標示「自動觸發」**——`excuse` 不可主動打出（`server.js:1075` 只收 `kind==='item'`），玩家必須一眼看懂它是被動擋箭牌
- [x] `mooch` 要標示**目標**（要選一位隊友，`server.js:1077-1081`）
- [x] **第一局隱藏補給市場**（遵守 C1：要有首次遊玩判定；bot 照買；後端不動）
- [x] 手牌（`START_HAND=2`，`server.js:36`）**照常顯示**——那是玩家第一回合真的摸得到的卡
- [x] 統一「邊做邊摸」的命名（見 C3-1 的二次修正）——**它是「摸魚+有任務」的附帶效果，不是按鈕**：
  - `index.html:823` 規則文目前寫成三選一（認真做｜邊做邊摸｜擺爛），要改成「摸魚時若有任務會順便推進度」
  - `index.html:207` 首頁 hint 同樣要改
  - 🔴 **不准去實作那個動作**，只改文案。（`server.js:414` 由 T5 那位負責，不用你動）
  - ⚠️ `index.html:207` 那條 hint **文案已改，但它在螢幕上看不到**——`cards.css:6` 的 `#s-home>.hint{display:none}` 把它蓋著（既有行為，非本次造成）。詳見下方回報。
  - ✅ **wave3 已放出來**：改成「模式選單底下的一條 footer」（`#s-home` 只在模式選單那一頁轉 column，進表單就收起、矮螢幕不顯示），並修掉行內 `color:var(--wood2)` 的隱形陷阱。截圖 `evidence-wave3/w3-10~13-home-*`。
- [x] 證據：四類各一張卡面截圖 + 第一局無市場截圖 + 修正後的首頁 hint

### T4｜恢復封面／大廳美術，補素材命名 【優先 4】

**素材現況（2026-09-13 CEO 查證）**：
- `public/art/` 只有 3 張：`01_cover.jpg`／`02_lobby.jpg`／`03_board.jpg`
- 老闆提到的 commit `5215711` 與 `concepts/character-and-map-sheet.png` 等三張合成圖，**不在本機、不在本 clone、不在遠端**（`git cat-file -t 5215711` → Not a valid object name；`ls-remote origin` 只有 `main=0fb7f22`；全機搜尋檔名零結果）。它們在另一個工作環境，尚未過來。
- 老闆更正：那是**合成圖不是透明角色圖**，不能直接當角色素材用。
- `09_boss_end.jpg`／`10_king_end.jpg` 老闆處也無獨立成品。

**現有美術有兩張在原定位置看不到**：
- `01_cover.jpg` 首頁封面 `index.html:172` 被 `cards.css:6` `#s-home>#art-home{display:none!important}` 隱藏
- `02_lobby.jpg` 大廳圖 `index.html:212` 被 `screen.js:137` `pane-off` 隱藏
- `public/art/README.md` 已過時：把 `03_board.jpg` 標「預留」，但它其實已接線用在行動卡背景（`focus.css:6`、`focus.js:77-78`）

**角色頭像現況**：`focus.css:5,13` 用 `01_cover.jpg` 三個固定裁切位模擬 `.employee`／`.boss`／`.ghost`。

- [ ] 恢復封面／大廳美術的**實際可見性**（解除上述兩處隱藏），且確認沒有被其他層再蓋掉
  - ⚠️ **只完成大廳這半**：`screen.js:137` 已改，`art-lobby` 實測可見。**封面（`art-home`／`cards.css:6`）不是我這輪範圍**（CEO 指派給另一位寫手），本檔不勾這格，等封面那邊也完成才算整條達標。
- [ ] **一屏操作下重要按鈕不被擠出畫面**——美術回來不能把操作區推走
  - ⚠️ **大廳（桌機＋手機 375px）全過**；**結算頁桌機過、手機 375px 沒過**——但用 A/B 實測證明跟我恢復美術**無關**（`art-end` 缺圖時本來就是 0 高度，開/關我的 `pane-off` 修改按鈕位置完全一樣 895.86px，擠出去的是別的寫手新加的三王/排行榜內容撐爆的）。細節見下方報告，這格照實不勾。
- [x] **沿用現有裁切頭像**，同時**預留獨立角色圖路徑 + 缺圖自動回退**（缺圖收起不影響遊戲，維持 `public/art/README.md:3` 契約）
  - `public/art/README.md` 新增「獨立角色圖槽」一節：命名 `11_char_boss.png`／`12_char_employee.png`／`13_char_ghost.png`，並給了可直接貼的 CSS（`background-image` 雙層寫法，新圖 404 時自動透出舊裁切，不用 JS）。**這段 CSS 目前只是文件裡的建議，還沒真的貼進 `focus.css`**（不在我這輪檔案範圍），照實只勾「命名＋回退設計已就緒」，不是「已上線」。
- [x] 新增圖槽命名寫進 `public/art/README.md`，**並修正該檔已過時的接線狀態欄**
  - `03_board.jpg` 從「預留」改成「行動卡插圖精靈圖」實際接線位置；順手也把 `01_cover.jpg`／`02_lobby.jpg` 兩列的「已接線」欄更新成目前的多處真實用法（原表只寫了其中一種用途）。
- [x] ❌ **不得把合成圖直接當透明角色圖使用**
  - 沒有動用 `concepts/character-and-map-sheet.png`（它根本不在本機）；README 新增專門一段警語重申這點。
- [ ] 證據：封面、大廳、缺圖回退各一張截圖 + 手機寬度下按鈕未被擠出的截圖
  - 有：大廳可見（桌機+手機）、結算頁缺圖自動收起無空白框（桌機+手機）、桌機按鈕未擠出（大廳+結算）、手機大廳按鈕未擠出。**沒有**：封面截圖（不在我範圍）；手機結算頁按鈕**沒有**通過（見上，附證據但不是好結果）。截圖在 `.team/20260913-情緒定型/evidence-t4/`。

### T5｜三王結算 + 故事書修 【優先 5・唯一動 server.js 的】

**老闆定調**：🐟 摸魚王＝唯一的「贏」（主線）；👻 搞鬼王／🐮 牛馬王＝頭銜不是勝利（榮譽，不動勝負）。
**設計理由**：死掉不再是出局，是換跑道——前兩回合死掉的人現在整局沒他的事，這是「不想再玩一次」的頭號兇手。

**現況**：
- 稱號系統已有地基（`server.js:528-533`，含「過勞牛馬 🐂💦」等 7 種）
- `checkWin` 選摸魚王只從 `aliveEmps` 挑（`server.js:473`）→ **幽靈被完全排除**，搞鬼王要新增一條線
- 故事書硬傷：`buildStory`（`server.js:485-519`）對每種事件**只取第一筆**（`c.find(...)`）→ **一局裡最爆笑的那一幕如果是第二次發生，永遠不會寫進故事**
- `chron()` 已記錄 9 種事件（`server.js:123`：ot/mooch/held/shield/catch/bigwin/eliminated/promote/fire）
- **完全沒有第一人稱角色台詞**——全是第三人稱旁白（`server.js:390` 最接近，只是藉口卡名稱套模板）

- [x] 結算頁同時頒三個王，每個王有名字、得主、一句事蹟
  - ✅ **2026-09-13 由 T2+T3 那位補完**：`renderEnd` 新增 `kingsMarkup()`／`kingCard()`（`public/index.html`），`#endkings` 畫出三王的名字／得主／一句事蹟。視覺層級照老闆裁定：🐟 摸魚王＝金框放大（唯一的勝利），👻 搞鬼王／🐮 牛馬王＝並排小卡（榮譽頭銜・不計勝負）；`vacant:true` 走虛線框＋「從缺」＋那句話。截圖見 `evidence-t23/t23-08a`、`t23-08c`。
- [x] 搞鬼王從**幽靈**裡選（不能沿用 `aliveEmps`）
- [x] 牛馬王從工作次數／薪水累積選（`WORK_WAGE=1` `server.js:62` 已有資料）
  - 2026-09-13 老闆裁決修正：**純取 `workCount` 最高（次排 `wageEarned`），照實頒**。原本我加的「摸魚王讓賢」規則已移除——那是加規則，而且把笑點讓掉了。同一人同時戴 🐟+🐮 兩頂王冠是允許且刻意的。
- [x] 摸魚王維持現行勝負判定**不變**——三王不得動到 `checkWin` 的勝負結果
- [x] `buildStory` 改為「選最精彩」而非「取第一筆」，**且仍不得超過 9 段**
- [x] 加入第一人稱角色台詞（至少覆蓋：被抓、摸魚得逞、猝死、憋氣躲過）
- [x] 測試綠：`node --test tests/card-flow.test.cjs`（現有 7 項不得退化）+ 新增三王與故事書選材測試
- [x] 證據：完整一局的結算頁截圖 + 故事書全文
  - ⚠️ **沒有截圖**（不能碰 `public/`，且前端正被另一位寫手改動中）。改附 socket.io 真連線跑完整一局後 server 推播的結算 payload 全文（三王 + 稱號 + 故事書 8 段），見下方回報。

---

### T6｜砍回合數 【老闆 2026-09-13 裁決納入・與 T5 同一趟改 server.js】

**老闆選擇**：節奏調參納入這批，但**只砍回合數，不動秒數**。

**現況**：`server.js:227` `room.config.rounds = opts.rounds||(n<=3?6:8)`。
多人每回合上限 `ADMIN_SEC 45`+`CHOOSE_SEC 45`+`REVEAL_SEC 15`=105 秒（`server.js:28-29`），**但那是上限不是固定值**——`tryResolve`（`server.js:768-776`）全員送出即結算。單人局完全無倒數（`server.js:257-258,265-266`）。

**CEO 裁決的數字**：**solo → 4 回合；多人 → 6 回合**。
理由：單人練習是「3 分鐘試玩入口」（無倒數，4 回合約 2~3 分鐘）；多人是社交場，砍太短不夠爽。

- [x] `rounds` 公式改為：solo 4、多人 6（`opts.rounds` 覆寫能力保留）
- [x] **不得改動** `ADMIN_SEC`／`CHOOSE_SEC`／`REVEAL_SEC`（老闆明確只砍回合數）
- [x] ⚠️ **驗證短局的連鎖影響**，並在回報中如實說明：
  - 資遣：實測 4 回合局**不是「幾乎」，是 100% 觸發不了**（最快第 5 回合才輪得到老闆動手）
  - 升職：理論上限 4 回合局 2 次（第 1、4 回合）、6 回合局也是 2 次；實務常只有 1 次
  - 老闆業績勝：8 局實測 `tasksIssued` 只有 3~5，門檻變成階梯函數（issued=3 時要 100% 才達標）
  - 搞鬼王：8 局實測「有幽靈」8/8、但「幽靈真的出手」只有 3/8
- [x] 測試覆蓋短局的勝負判定：`checkWin`（`server.js:472-482`）在 4 回合與 6 回合都要得出合理結果
- [x] 證據：solo 跑完整一局的實際耗時（牆鐘）+ 測試輸出
  - ⚠️ 量到的是**機器全自動、零思考時間**的牆鐘 20.8~22.2 秒／4 回合；**真人思考時間沒量到**（需要真人試玩）

---

## 範圍邊界

**要做**：T1~T5 上列項目。

**不要做**（明確排除，防蔓延）：
- ❌ **任何新遊戲規則**。這批只加情緒，不加要學的東西
- ❌ **新增任何 action**。只使用現有 `work`／`idle`／`slack`
- ❌ **實作「邊做邊摸」**（程式裡不存在，做它就是加規則；只修宣傳它的文案）
- ❌ 幽靈下注／報信猜老闆（好點子，進 backlog 的進階解鎖層）
- ❌ 幽靈經費節流（**已確認不需要**：`GHOST_COOLDOWN=2` `server.js:35` 已在節流；幽靈不在摸魚王候選內 `server.js:473`，💰 對他終局價值為 0，用經費當代價等於沒代價）
- ❌ 全站前端重構（見技術備註的收斂策略）
- ❌ 動 `resolveRound` 的結算數學（`server.js:275-470`）
- ❌ T1~T4 動 `server.js`（只有 T5／T6 可以）
- ❌ **動 `ADMIN_SEC`／`CHOOSE_SEC`／`REVEAL_SEC`**（老闆裁決：只砍回合數，不動秒數）

---

## 檔案清單

| 檔案 | 動作 | 負責內容 |
|------|------|----------|
| `public/focus.css` | 修改 | T1 改寫 `:9` `focus-revealing` 規則；T2 猝死/警告樣式 |
| `public/focus.js` | 修改 | T1 演出編排+跳過+去重、老闆視角修正(`:87-96`)；T2 三件套；T3 卡牌化(`:38`) |
| `public/index.html` | 修改 | T1 演出（`:696-786` 原地保留）；T3 卡片結構 |
| `public/cards.css` / `cards.js` | 修改 | T3 四類卡視覺；T4 解除 `cards.css:6` 封面隱藏 |
| `public/screen.js` | 修改 | T4 解除 `:137` 對美術的 `pane-off` |
| `public/art/README.md` | 修改 | T4 更新圖槽表與已接線狀態（現已過時） |
| `server.js` | 修改 | **僅 T5**：三王、`buildStory` 選材、角色台詞 |
| `tests/card-flow.test.cjs` | 修改 | T5 三王與故事書選材測試 |

---

## 子任務

- [x] T1 掀開揭曉演出（先做，是其他項的地基）— 演出→個人總結編排完成、跳過入口、回合去重、老闆／幽靈視角修好
- [x] T2 過勞警告與猝死演出（可與 T3 平行）
- [x] T3 四類手牌卡面（可與 T2 平行）＋ 三王事蹟渲染（T5 的前端那一半）
- [ ] T4 恢復美術可見性 + 圖槽預留（素材未到，只做接線與回退）— **screen.js＋README 這半完成**（大廳/結算美術解隱藏、README 補文件）；封面（cards.css）另一位寫手負責；結算頁手機 375px 按鈕被別的寫手新加內容擠出（非我造成，見下方報告）
- [x] T5 三王結算 + 故事書（最後做，唯一動 server.js）— **server 端完成**；結算頁把「一句事蹟」畫出來需前端補一刀
- [x] T6 砍回合數（solo 4／多人 6，秒數零更動）
- [x] wave3 揭曉版面比例與字級（`design-reveal-layout.md`）— 盒高改由內容決定、字級階層翻正、聚光燈對比、老闆撲空、真 375px 驗證；順帶放出首頁 slogan／一句話玩法

---

## 技術備註

### 🔴 最大風險：前端是四層 monkey-patch 疊加

`index.html:917-923` 無條件依序載入四層，後面的 CSS/JS **覆寫、隱藏**前面的同名全域函式（`render`/`renderGame`/`renderEmpZones`/`renderReveal`）與 DOM：

```
index.html(羊皮紙原版) → cards.js(卡牌層) → screen.js(分頁層) → focus.js(單決策引導層)
```

**T1 這個 bug 就是這個架構咬人的鐵證**：一條 `focus.css` 規則就把整套揭曉演出蓋掉，而且沒人發現。老闆的工程審查 C2 講的正是這件事——掀開會讓東西一起堆回來。

**收斂策略（不做大重構，但要止血）**：
- 凡是這次動到的畫面，**把該畫面的疊加收斂成單一 render 路徑**，不要再往上疊第五層
- 嚴禁用「再加一條 `!important` 蓋掉上一層」解問題——要這樣做時停下來回報 CEO
- 每個改動要能回答：「這段在四層疊完之後，玩家實際看到的是什麼？」

### 其他盤點事實（供參考，本批不一定處理）
- 沒有任何音效（全檔無 `.mp3`/`.wav`/`new Audio`）
- 地點是 emoji 按鈕清單不是地圖；`ADJ` 鄰接關係（`server.js:25`）前端沒畫出來，「隔壁區也算抓到」玩家得用背的
- 規則全文預設隱藏（`screen.js:82` `pane-off`）
- 員工看不到完成率（`index.html:544` 只有老闆分支），**全程沒有即時排行榜**（`server.js:525,541` 只在結束時算）→ 玩家整局不知道自己領先或落後
- 選行動畫面同時有 12~15 個可互動元件 + 30+ 段文字

### 老闆的長期偏好
本機服務綁 127.0.0.1、`.env` 600、密鑰不寫死、Node 長駐服務 `setBlocking(true)`。

---

## 待決事項

**全部已裁決，無待決項。**

- **✅ Q1**：節奏調參納入，**只砍回合數不動秒數** → 見 T6。CEO 定數字：solo 4、多人 6。
- **✅ Q2**：四類 = 藉口／干擾／增益／社交，`mooch` 保留為社交類。
- **✅ Q3**：素材在另一環境、且是合成圖不能直接用 → T4 只做接線＋預留＋回退。

⚠️ 注意張力：T1 把演出掀開**會讓揭曉變長**，與縮短節奏方向相反。因此 T6 只砍回合數不砍秒數——
演出長度交給 T1 依實際體感決定，**不准為了省時間而閹割演出**。

---
<!-- 以下由阿寫在完成後 append -->

## 寫手回報 — T5+T6

**狀態：DONE_WITH_CONCERNS**

### 做了什麼
- **T5 三王**：新增 `pickKings()`（`server.js:556-594`），把 🐟 摸魚王／👻 搞鬼王／🐮 牛馬王 三筆固定寫進 `room.winner.kings`，每筆帶 `title`／`holder`／`deed`（名字、得主、一句事蹟），從缺時 `vacant:true` 也照樣給一句話。摸魚王**直接沿用 `checkWin` 給的 `winnerEmpId`，一個字都沒重算**；`checkWin` 本體 0 行改動（已逐字比對）。
- **T5 故事書**：`buildStory` 改成「同種事件挑最戲劇的那筆（`bestOf`）→ 跨類別取 6 幕 → 排回時間順序」，開場／結局／頒獎三段保底。順手修掉一個舊 bug：舊版 `slice(0,9)` 在事件多時會把**結局整段砍掉**（玩家看不到自己為什麼贏）。
- **T5 台詞**：新增 `STORY_LINES`＋`quoteOf()`，四個時刻（被抓／摸魚得逞／猝死／憋氣躲過）都有第一人稱自嘲台詞，用「回合＋名字」做確定性挑選（重連不換句子）。猝死段改寫成「不是出局，是換了跑道」。
- **T5 資料接線**：`resolveRound` 只加了**計數器與大事記欄位**（`workCount`／`wageEarned`／`moochedCount`、幽靈作祟 `chron`、`eliminated` 的 `cause`、若干 `pid`），**沒有動任何結算數學**。
- **T6**：`server.js:228` `rounds = opts.rounds || (room.solo?4:6)`。`ADMIN_SEC`／`CHOOSE_SEC`／`REVEAL_SEC` **零改動**（`git diff` 完全抓不到這三個字）。

### 碰過的檔（只有這兩個）
- `/Users/freedom/Documents/Codex/2026-09-12/https-github-com-juanjunfu-mo-yu/work/mo-yu-wan/server.js`
- `/Users/freedom/Documents/Codex/2026-09-12/https-github-com-juanjunfu-mo-yu/work/mo-yu-wan/tests/card-flow.test.cjs`

`git status` 顯示 `public/focus.css`／`public/focus.js`／`public/index.html` 也被改了——**那是另一位寫手的，不是我動的**。

### 驗收對照

| 驗收項 | 結果 | 證據 |
|---|---|---|
| 結算頁同時頒三個王（名字／得主／事蹟） | ⚠️ **半套** | server 資料齊（`winner.kings[]`）；故事書頒獎段＋排行榜稱號已可見；**`deed` 沒被 `renderEnd` 畫出來**（`public/index.html:787-806` 沒讀 `kings`）——要動 public/，超出我的檔案範圍 |
| 搞鬼王從幽靈裡選 | ✅ | `pickKings` 候選 = `emps.filter(p=>p.isGhost\|\|!p.alive)`（`server.js:568`），沒用 `aliveEmps`；測試 `ghost king is picked from ghosts...` |
| 無幽靈時搞鬼王從缺 | ✅ | 同測試第一段斷言 `vacant===true`、`holderId===null` |
| 牛馬王從工作次數／薪水累積選 | ✅ | 主排 `workCount`、次排 `wageEarned`、再次 `otCount`；測試 `ox king ranks by work count then wage...` |
| 摸魚王勝負判定不變 | ✅ | `checkWin` 逐字比對 0 差異；測試另外用純規則重算一次勝者比對，並斷言頒獎前後玩家狀態完全不變 |
| `buildStory` 選最精彩 + ≤9 段 | ✅ | 測試 `story picks the most dramatic take...`：兩筆 catch 選頂樓不選茶水間、兩筆 bigwin 選 9💰、兩筆 held 選 60%、shield 選幽靈報信不選藉口卡；14 筆大事記下長度 = 9 |
| 第一人稱台詞覆蓋四時刻 | ✅ | 測試 `story carries first-person lines...`：斷言 ≥4 句 `：「…」`＋確定性重跑一致 |
| 現有 7 項不退化 | ✅ | 16/16 綠（原 7 + 新 9） |
| T6 rounds solo 4／多人 6 | ✅ | 單元測試 + 真 socket 實跑（solo 顯示 `第 1/4 回合`、5 人多人房 `rounds=6`） |
| T6 不動秒數 | ✅ | `git diff server.js \| grep -E "ADMIN_SEC\|CHOOSE_SEC\|REVEAL_SEC"` → 空 |
| T6 4 回合／6 回合都得出合理結果 | ✅ | 測試 `checkWin still crowns a slacker king in both...` |

### T6 連鎖影響（實測，CEO 要的如實回報）

1. **資遣：4 回合局 100% 觸發不了**（比 task.md 寫的「幾乎」更絕對）。
   實測：第 1 回合派任務、全程不做 → `deadlineLeft` 3→2→1→0(進 grace)→0(逾期) → `canBeFired` **在第 4 回合結束時才成立**，老闆最早只能在**第 5 回合的 admin** 動手。4 回合局沒有第 5 回合。
   6 回合局：撐得到（第 5、6 回合），但條件苛刻（第 1 回合派、進度掛零）。
   → **`BOSS_FIRES=2` 這個管理點在 solo 局等於完全死掉。**
2. **升職：4 回合局理論上限 2 次（第 1、4 回合），6 回合局也是 2 次，8 回合才 3 次。**
   而且第 4 回合升的主管，`SUPERVISOR_TERM=2` 只用得到 1 回合就散場 → 主管機制在 solo 局形同半廢。
3. **老闆業績勝：門檻在短局變成階梯函數。** 8 局實測 `tasksIssued` 只有 3~5：
   `2/5=40% · 2/4=50% · 1/4=25% · 3/5=60% · 2/3=67% · 2/4=50% · 3/3=100% · 2/5=40%`
   → issued=3 時，`70%` 門檻實際要求 **100%**（2/3=67% 差 3 個百分點就沒過）。8 局中老闆只贏 1 局（12.5%）。**這不是抖動大小的問題，是門檻在小樣本下語意變了。**
4. **搞鬼王樣本很小：8 局裡「有幽靈」8/8，但「幽靈真的出手作祟」只有 3/8。**
   其餘 5 局的搞鬼王是靠「沒人出手 → 改選死最早、飄最久那位」的保底規則發出去的，事蹟寫的是「一次都沒下手——鬼也是會累的」。**頭銜在，戲劇性薄。**

### 自評風險點（請阿審重點看）

1. 🔴 **最大風險：三王的「事蹟」在畫面上看不到。** `renderEnd`（`public/index.html:787-806`）沒讀 `winner.kings`。今天玩家看得到的只有：排行榜每人的王位稱號（`ranking[].title`）＋故事書最後一段的「本日頒獎——…」一行。**「一句事蹟」＝0 可見**。對照最高驗收問題「玩家是否理解自己為什麼得到這個結果」，**這題目前只答對一半**，缺的那一半在前端。
2. ✅ **`ranking[].title` 王位蓋掉個性稱號 → 老闆已裁定維持現狀**（位階：摸魚王 > 搞鬼王 > 牛馬王）。原本 7 種稱號（`server.js:535-540`）在非王位者身上照常運作。
3. 🟡 **我在 `resolveRound` 裡動了東西**（範圍邊界寫「不動結算數學」）。我動的是：`workCount`／`wageEarned`／`moochedCount` 三個純計數器、幽靈作祟的 `chron()`、`eliminated` 的 `cause`、三處 `pid` 欄位、一句揭曉文案（第 ③ 項修正）。**沒有任何一行改到分數／心悸／抓捕判定**。但這確實碰到了 275-470 那個區塊，請阿審逐行確認我沒說謊。理由：chronicle 原本**完全沒有記錄幽靈行動**（`server.js:288-300` 只寫 `ghostNotes`，不進 chronicle），也沒有任何「工作次數」欄位，不補資料就做不出搞鬼王與牛馬王。
4. ✅ **牛馬王「讓賢」已依老闆裁決移除**（`server.js:581-582` 現在是單純 `emps.filter(p=>p.workCount>0)`）。實測 6 局中有 4 局摸魚王同時是牛馬王，雙冠正常運作。
5. 🟡 **故事書的「戲劇權重」是我拍的**（deaths 70 / catch 50+區塊風險×5 / held 60 / fire 55 / bigwin 45+gain×2 / shield 40+種類 / ghost 42+次數×2 / mooch 38 / ot 35 / promote 30）。可驗證的只有「同類型挑最強那筆」與「總長 ≤9」；**跨類型誰該勝出是主觀的**，沒有客觀標準可驗。
6. ✅ **假 socket 打真 handler（`tests/card-flow.test.cjs:37-44`）→ CEO 已裁定接受，不改。**
7. 🔴 **新增的前後端耦合：`revealAnimMs`（`server.js:280-299`）是 `public/index.html` `playReveal()` 的時序鏡像。** 前端演出時序一改，server 推算就失準（後果只是倒數早／晚開始，不影響結算與勝負）。已寫整段警告註解 + 12 秒硬上限。這是這批唯一一處跨檔隱性契約，請阿審重點看。
7. 🟢 **chronicle 上限 200 筆**（`server.js:123`）。短局不可能撞到，但 `bestOf` 掃全表是 O(n×類型數)，終局才跑一次，無效能疑慮。

### 順手發現（**沒動**）

1. ✅ **已修（老闆第 ③ 項裁決）**：`server.js:414` 的「；邊做邊摸 任務 +1」改成「；摸魚途中順手推進任務 +1」。CEO 查證更精確：這不是不存在的機制，是**「摸魚」在身上有任務時的附帶效果**，舊文案會讓玩家去找一個不存在的按鈕。`index.html:207` / `:823` 兩處由 wave 2 處理，我沒動。
2. ✅ **已修（老闆第 ④ 項裁決）**：`practiceGhostPass`（`server.js:1179-1181`）加上 `if(room.choices.ghost[p.id]) return cb?.({error:'本回合已作祟過了'})`，錯誤訊息與 `submitChoice` 既有 guard（`server.js:1206`）一致。已補兩個測試（覆蓋＋不覆蓋兩條路徑）。
3. 🟡 **`safeCount`（`server.js:346,358,381`）算了但從來沒用過。** 規則全文 `index.html:817` 寫著「有人龜在辦公室，會害其他人各 +1 心悸」——**這條規則沒有實作**。規則說明在描述一個不存在的機制。
4. 🟡 **`httpServer.listen(PORT)` 沒綁 127.0.0.1**（server.js 尾段）。這是 Docker 部署的遊戲，容器內綁 0.0.0.0 合理，但本機開發時會對整個 LAN 開放。不在本次範圍，只記一筆。
5. 🟢 4 回合局的 `BOSS_FIRES=2` 與 `SUPERVISOR_TERM=2` 實質失效（見上面連鎖影響 1、2）。**這是 T6 的代價，不是 bug**，要不要補償請 CEO 決定（例如 solo 局把 `TASK_DEADLINE` 降到 2）——我沒動，那是加規則。

### 驗證證據

**① 測試：23/23 綠（原 7 項零退化；三輪改動後重跑）**

```
$ node --test tests/card-flow.test.cjs
✔ opening draw gives two real cards; repeat click cannot draw again (90.459416ms)
✔ three consecutive work choices cause sudden death even with immunity (1.162333ms)
✔ rest or slack breaks the consecutive-work streak (1.167333ms)
✔ solo choosing and reveal do not schedule automatic advancement (0.476667ms)
✔ last-round result stays visible until player continues (0.829792ms)
✔ personal result deltas include wage and stress changes and use player IDs (1.732167ms)
✔ solo ghost waits until the player acts or explicitly passes (1.24ms)
✔ REVEAL_SEC itself is untouched (1.138917ms)
✔ reveal animation length mirrors the front-end playReveal timeline (1.26725ms)
✔ multiplayer reveal timer starts counting only after the animation finishes (1.386875ms)
✔ solo reveal still has no timer and no skip lock (1.026625ms)
✔ round count is four for solo, six for multiplayer, and opts still overrides (3.132666ms)
✔ checkWin still crowns a slacker king in both a four-round and a six-round game (1.088167ms)
✔ three kings are awarded without touching the win/lose verdict (1.977125ms)
✔ ghost king is picked from ghosts, and is vacant when nobody died (1.352ms)
✔ ox king ranks purely by work count then wage, even if that is the slacker king (1.075625ms)
✔ one player can wear both the slacker and the ox crown (1.059417ms)
✔ engine run records the counters the ox king needs (1.038916ms)
✔ story picks the most dramatic take of each event and never exceeds nine paragraphs (1.185125ms)
✔ story carries first-person lines for caught, slack win, sudden death and holding breath (1.330167ms)
✔ ghost pass must not overwrite a haunt that was already submitted (3.087666ms)
✔ ghost pass still works when the ghost has not acted yet (1.441166ms)
✔ story tells the ghost sub-plot when ghosts actually act (1.481083ms)
ℹ tests 23
ℹ suites 0
ℹ pass 23
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

**② `checkWin` 逐字比對：0 差異**

```
$ git show HEAD:server.js | awk '/^function checkWin/,/^}$/' > /tmp/cw_old.txt
$ awk '/^function checkWin/,/^}$/' server.js > /tmp/cw_new.txt
$ diff /tmp/cw_old.txt /tmp/cw_new.txt && echo "checkWin: 完全一致（0 行差異）"
checkWin: 完全一致（0 行差異）
```

**③ 秒數常數零改動**

```
$ git diff server.js | grep -E "ADMIN_SEC|CHOOSE_SEC|REVEAL_SEC"
（無輸出）
```

**④ 真 socket.io 連線跑完整一局 solo（`node server.js` on :3111，非 stub）**

```
[0.0s] 開局 code=...
[0.0s] --- 第 1/4 回合 (admin) ---
  揭曉：老闆查 頂樓｜🤖薪水小偷:摸魚成功！💰+4… / 🤖摸魚見習生:被逮到！… / 阿寫:被逮到！…
[5.5s] --- 第 2/4 回合 (admin) ---
[11.0s] --- 第 3/4 回合 (admin) ---
[16.4s] --- 第 4/4 回合 (admin) ---

[20.8s] ===== 結算 =====
陣營：員工陣營獲勝｜理由：摸魚王是【🤖摸魚見習生】（偷懶 3 💰）

--- 三王 ---
🐟 摸魚王（唯一的勝利）：🤖摸魚見習生
    事蹟：偷懶 3💰・摸魚 0 次；被逮到 1 次還是爬上了王座，臉皮比考績表厚。
👻 搞鬼王（榮譽頭銜・不計勝負）：阿寫
    事蹟：第 2 回合下班（永久），之後作祟 1 次：扯掉老闆一次巡查。
🐮 牛馬王（榮譽頭銜・不計勝負）：🤖薪水小偷
    事蹟：認真工作 2 回合、領了 3💰 血汗錢、加班 1 次，最後在第 4 回合心悸爆表倒下。

--- 綜合評分（稱號） ---
  C 🤖摸魚見習生 🐟 摸魚王 👑勝者 · 摸魚0 工作2 分3 心悸2
  B 🤖薪水小偷 🐮 牛馬王 · 摸魚2 工作2 分10 心悸6 · 已出局
  C 阿寫 👻 搞鬼王 · 摸魚0 工作0 分0 心悸6 · 已出局

--- 故事書（8 段，上限 9） ---
  1. 在一間被施了魔法的老辦公室裡，🤖鵝霸老闆 又戴上了那枚小皇冠，握緊金色放大鏡踏進走廊。今天要對付的員工是：🤖薪水小偷、🤖摸魚見習生、阿寫。上班鐘敲響，一場貓抓老鼠的一天開始了。
  2. 第 1 回合，放大鏡的光停在頂樓——🤖摸魚見習生 被逮個正著，慘叫聲穿透了三面隔板。🤖摸魚見習生：「這杯咖啡是要拿給您的，真的。」
  3. 🤖摸魚見習生 被抓包的瞬間掏出「去修印表機」，滑得比下班打卡還快。
  4. 🤖鵝霸老闆 甩出了加班令。🤖薪水小偷 含淚加班到燈火通明，領了加班費，也熬出了黑眼圈。
  5. 第 3 回合，幽靈 阿寫 從天花板探出頭，把老闆往影印間的腳步硬生生扯了回來。
  6. 阿寫、🤖薪水小偷 心悸爆表倒下。他們化作了辦公室的幽靈——不是出局，是換了跑道：從此在天花板上飄來飄去，替活著的同事通風報信、扯老闆的後腿。
  7. 下班鐘響。🤖摸魚見習生 戴著歪歪的紙皇冠站上文件山頂，高舉金色咖啡杯——摸魚王是【🤖摸魚見習生】（偷懶 3 💰）！🤖鵝霸老闆 癱坐在角落，放大鏡滾落在地。
  8. 本日頒獎——🐟 摸魚王：🤖摸魚見習生｜👻 搞鬼王：阿寫｜🐮 牛馬王：🤖薪水小偷。明天太陽照常升起，影印機照常卡紙。是牛馬，還是摸魚王？明天上班，再見分曉。
```

**⑤ 多人房真 socket 驗證回合數**

```
多人房 5 人｜rounds=6（舊公式 n>=4 → 8）
```

**⑥ 8 局並行 solo 實跑（三王從缺／重複的各種組合 + 故事書長度）**

```
TALLY side=emp  rate=40%  tasks=2/5  kings=🤖薛丁鵝/阿寫/🤖摸魚見習生  story=8
TALLY side=emp  rate=50%  tasks=2/4  kings=🤖摸魚見習生/阿寫/🤖乖乖牌  story=9
TALLY side=emp  rate=25%  tasks=1/4  kings=🤖乖乖牌/阿寫/阿寫          story=8
TALLY side=emp  rate=60%  tasks=3/5  kings=🤖薪水小偷/阿寫/🤖乖乖牌    story=9
TALLY side=emp  rate=67%  tasks=2/3  kings=🤖乖乖牌/阿寫/🤖乖乖牌      story=9
TALLY side=emp  rate=50%  tasks=2/4  kings=🤖薛丁鵝/阿寫/🤖乖乖牌      story=9
TALLY side=boss rate=100% tasks=3/3  kings=從缺/阿寫/🤖乖乖牌          story=9
TALLY side=emp  rate=40%  tasks=2/5  kings=🤖薛丁鵝/阿寫/🤖薪水小偷    story=9
```
→ 故事書長度 8~9，**8/8 從未超過 9 段**；老闆贏那局摸魚王正確從缺。

**⑦ T6 連鎖影響探針（與測試同一套 vm 引擎跑真規則）**

```
rounds=4｜第 1 回合派任務、全程不做｜canBeFired 在第 4 回合結束時成立｜老闆最早能在第 5 回合的 admin 動手｜這一局撐得到嗎：撐不到（資遣觸發不了）
rounds=6｜…｜撐得到
rounds=8｜…｜撐得到
rounds=4｜PROMOTE_COOLDOWN=3｜整局最多升職 2 次
rounds=6｜PROMOTE_COOLDOWN=3｜整局最多升職 2 次
rounds=8｜PROMOTE_COOLDOWN=3｜整局最多升職 3 次
```

---

## 修正批次 — 老闆裁決四項（2026-09-13 二輪）

| # | 裁決 | 做法 | 證據 |
|---|---|---|---|
| ① | 牛馬王「讓賢」退回，照實頒 | 移除 `pickKings` 裡的排除邏輯，改成單純 `emps.filter(p=>(p.workCount||0)>0)`（`server.js:581-582`） | 測試改名 `ox king ranks purely by work count then wage, even if that is the slacker king` + 新測試 `one player can wear both the slacker and the ox crown`；e2e 6 局中 **4 局摸魚王同時是牛馬王** |
| ② | `ranking[].title` 維持王位優先 | **零改動** | — |
| ③ | 修掉「邊做邊摸」命名不一致 | `server.js:414` 改成「；摸魚途中順手推進任務 +1（x/y）」，並在上方加兩行註解說明這是附帶效果不是可選動作 | e2e 6 局：新文案出現 19 次、舊文案「邊做邊摸」殘留 **0** |
| ④ | `practiceGhostPass` 覆蓋 bug | `server.js:1179-1181` 加 guard；錯誤訊息沿用 `submitChoice` 既有的「本回合已作祟過了」 | 新增 2 測試（已作祟→拒絕且不覆蓋、未作祟→正常 pass）；e2e 幽靈作祟回覆 `{"ok":true}` 且事蹟正確寫出作祟次數 |

**④ 的 stall 風險已查證**：guard 走 early-return 不呼叫 `tryResolve`，但不會卡住回合——`tryResolve` 的 solo 幽靈閘門（`server.js:929-931`）只檢查 `room.choices.ghost[human.id]` 是否存在，haunt 已經把它填好；其餘玩家送出時 bot（`server.js:910,918`）與真人（`server.js:1257`）都會各自再呼叫一次 `tryResolve`。

**修正後 e2e 實跑（真 socket、6 局並行，`node server.js` on :3111）**

```
TALLY side=emp rate=33% tasks=1/3 kings=🤖乖乖牌/阿寫/🤖乖乖牌      story=9   ← 雙冠
TALLY side=emp rate=50% tasks=2/4 kings=🤖乖乖牌/阿寫/🤖乖乖牌      story=9   ← 雙冠
TALLY side=emp rate=50% tasks=2/4 kings=🤖摸魚見習生/阿寫/🤖摸魚見習生 story=7 ← 雙冠
TALLY side=emp rate=40% tasks=2/5 kings=🤖摸魚見習生/🤖乖乖牌/🤖乖乖牌 story=8
TALLY side=emp rate=50% tasks=2/4 kings=🤖乖乖牌/從缺/🤖乖乖牌       story=7   ← 無幽靈→搞鬼王仍正確從缺
TALLY side=emp rate=50% tasks=2/4 kings=阿寫/🤖摸魚見習生/🤖薛丁鵝   story=9
```

**雙冠實例（老闆要的笑點）**

```
揭曉：… 🤖薪水小偷:摸魚成功！💰+3、心悸 +3；摸魚途中順手推進任務 …

陣營：員工陣營獲勝｜理由：摸魚王是【🤖乖乖牌】（偷懶 12 💰）

🐟 摸魚王（唯一的勝利）：🤖乖乖牌
    事蹟：偷懶 12💰・摸魚 1 次；第 2 回合在頂樓一口氣爽賺 7💰。
👻 搞鬼王（榮譽頭銜・不計勝負）：阿寫
    事蹟：第 4 回合下班（永久），之後在天花板上飄了一整局，一次都沒下手——鬼也是會累的。
🐮 牛馬王（榮譽頭銜・不計勝負）：🤖乖乖牌
    事蹟：認真工作 3 回合、領了 4💰 血汗錢、加班 1 次。

  A 🤖乖乖牌 🐟 摸魚王 👑勝者 · 摸魚1 工作3 分12 心悸3
```
→ 同一隻 bot 做最多工（3 回合＋加班 1 次）**同時**是摸魚王，兩頂王冠都掛在他身上。

**沒有為了短局去調 `TASK_DEADLINE` 或 `PROMOTE_COOLDOWN`**（那是加規則）。

---

## 追加 — 揭曉倒數「等演出跑完才起算」（2026-09-13 三輪，老闆裁決）

### 問題
T1 把揭曉演出掀開後，演出與個人總結**共用** `REVEAL_SEC=15`（`server.js:29`）。
T1 實測演出長度：3 人局 6.3 秒、4 人局 7.7 秒、6 人局 ~9 秒 → 6 人局玩家只剩約 6 秒讀總結，**直接違反本批最高驗收「玩家要理解自己為什麼得到這個結果」**。

### 做法（純 server 端計算，零前端改動、零新 client 事件）
- 新增 `revealAnimMs(rv)`（`server.js:280-299`）：**`public/index.html` 的 `playReveal()` 時序鏡像**，由 server 自己從 `room.lastReveal` 算出演出時長。
- `resolveRound` 結尾（`server.js:483-491`）改成
  `startTimer(room, animMs/1000 + REVEAL_SEC, …)`，`revealSkipAt` 一併順移 `animMs`。
- **`REVEAL_SEC` 的值一個字沒動**（仍是 15；有測試 `REVEAL_SEC itself is untouched` 釘住）。
- **solo 完全不受影響**（`room.solo` 分支照舊 `clearTimer` + `revealSkipAt=now`；有測試釘住）。

### 為什麼選這個方案
1. **計時器權威必須留在 server**（`docs/設計探討_手機流暢與機器人模式_20260911.md:21` 明載：斷線／切背景／鎖屏都不能卡住遊戲）。任何「等 client 回報演出播完」的方案都會把權威移到 client，違反這條。
2. **不需要任何 client 回報 → 結構上不可能因為某個 client 不講話而卡住**（滿足「不得卡住整局」的約束，連 fallback 都不需要觸發）。
3. 另外再加一道 `REVEAL_ANIM_MAX_MS = 12000` 硬上限：不管公式算出多少，倒數最多只延後 12 秒。這是防呆——就算未來前端演出爆長、或 `lastReveal` 資料異常，延遲也有界。
4. **零前端改動**，三位寫手同時在改 `public/` 不會撞車。

### 公式推導依據（可重現）
前端 `playReveal()` 逐段累加（**唯一真相來源，我只讀沒改**）：

```
public/index.html:819   let t=500+n*140;                        // ② 員工滑入各區
public/index.html:826   t+=(r.ghostNotes||[]).length*350+300;    // ③ 事件跑馬燈
public/index.html:830   t+=1100;                                 // ④ 老闆手電筒＋主管蓋章
public/index.html:851   t+=n*220+700+(anyDanger?1600:0);         // ⑤ 個人結果（屏息 1.6s）
public/index.html:860   revAnimEndsAt=…Date.now()+t+n*120+1200;  // ⑥ 戰果總結＋尾巴
```
合併同類項 →
**`animMs = 3800 + n*480 + g*350 + (危險 ? 1600 : 0)`**
（`n`＝本回合有結果的員工數、`g`＝事件跑馬燈則數、`危險`＝有非主管員工待在被巡查區）

`anyDanger` 的判定我也照抄前端：`inspSet = bossZoneKeys ∪ {supZoneKey}`、`results.some(x=>x.zone && inspSet.has(x.zone) && !x.supervisor)`。

**與 T1 實測對帳**：3 人局＝2 位員工、有人在危險區、無事件 → `3800+2*480+1600 = 6360ms`，**T1 量到 6.3 秒，對得上**。4 人／6 人局 T1 的數字偏大，差額落在 `g*350`（那幾局有事件跑馬燈），公式結構一致。

### ⚠️ 風險：這是前後端耦合
`revealAnimMs` 是 `playReveal` 的鏡像。**前端演出時序一改，server 的推算就失準**。
- 失準的後果是**倒數早開始或晚開始，不會壞掉遊戲規則**（不影響結算、不影響勝負）。
- 我已在 `server.js:280-292` 寫了整段耦合警告註解，指名 `playReveal` 與 `revAnimEndsAt`（**用函式名不用行號**，因為 `public/index.html` 正在被三個人改，行號會漂）。
- 建議 CEO 把「改 `playReveal` 時序要同步改 `server.js` 的 `revealAnimMs`」記進交接清單。

### 驗證（真 socket 連線，`node server.js` on :3111）

```
=== 3 人局（n=2）===
員工數 n=2｜事件 g=0｜有人在被巡查區=true｜老闆巡 茶水間、影印間
server 回報 revealAnimMs=6360ms（獨立算出 6360ms）→ 一致 ✅
倒數剩餘 21359ms（預期 6360+15000=21360）→ 符合 ✅
→ 舊行為玩家讀個人總結只剩 8640ms；新行為剩滿 15000ms
房主跳過鎖還要 11359ms（預期 6360+5000=11360）→ 順移正確 ✅

=== 6 人局（n=5，最壞情況）===
員工數 n=5｜事件 g=0｜有人在被巡查區=true｜老闆巡 茶水間
server 回報 revealAnimMs=7800ms（獨立算出 7800ms）→ 一致 ✅
倒數剩餘 22799ms（預期 7800+15000=22800）→ 符合 ✅
→ 舊行為玩家讀個人總結只剩 7200ms；新行為剩滿 15000ms
房主跳過鎖還要 12799ms（預期 7800+5000=12800）→ 順移正確 ✅
```

新增 4 個單元測試：`REVEAL_SEC itself is untouched`／`reveal animation length mirrors the front-end playReveal timeline`（含主管不算危險、主管協查區算危險、12 秒硬上限、null 防呆）／`multiplayer reveal timer starts counting only after the animation finishes`／`solo reveal still has no timer and no skip lock`。

### 沒做到的（誠實欄）
- **結算頁的三王「事蹟」沒有畫出來**——需要動 `public/index.html` 的 `renderEnd`，不在我的檔案範圍。
- **沒有任何截圖**——不能碰 `public/`，且該目錄正被另一位寫手改動中，我截到的畫面不代表最終結果。
- **真人試玩的牆鐘沒量到**——我量的是機器零思考時間的 20.8~22.2 秒／4 回合。
- **沒有 git commit／push**，改動全留在 working tree。

---

## 寫手回報 — T1

**狀態：DONE_WITH_CONCERNS**

### 做了什麼
1. **掀開演出但不是刪 CSS**：刪掉 `focus.css:9` 那條 `#reveal.focus-revealing > :not(...)｛display:none!important｝` 全域封印，改成 focus.js 的兩段式舞台狀態機 `applyRevealStage()`：`act`（演出）→ `summary`（個人總結）。切換用既有的 `pane-off` 機制，**沒有新增任何 `!important`**（`git diff public/focus.css | grep +.*important` = 0）。
2. **收斂成單一 render 路徑**（不疊第五層）：把原版演出節點（標題列＋`#revtoasts`＋`#revboard`＋`#revsum`）集中進 screen.js 既有的 `.reveal-board-pane`，並永久關掉 screen.js 的「亮牌結果／地圖動畫」分頁列、`#nextbtn`／`#waitnext`。`applyRevealStage()` 每次都呼叫 `revealTabs.select(1)`，所以 cards.js 的亮牌牆分頁**永遠不可能亮起來**——揭曉只剩一條路。
3. **跳過入口沿用原本那顆按鈕**（`index.html:298`，改文案為「⏩ 跳過演出，直接看結果」並加 `id="skiprev"`），focus.js 覆寫全域 `skipReveal()` = 原本的瞬間播完 + 直接進個人總結。沒有另開新入口。
4. **回合級去重**：`sessionStorage['moyu_reveal_seen']` 記 `房號:回合`。重連／重整／重複 state 廣播都走「補完動畫 + 直接看結果」，不重播。`restart`（再玩一局）回 lobby 時把 `moyu_reveal_seen`／`revealStageKey`／`revAnimKey` 三個記號歸零（**這是我自己改出來的 bug，自己抓到自己修**：不歸零的話新局第 1 回合會被當成播過而跳過演出）。
5. **老闆視角修好**：`r.results` 只有員工，老闆／幽靈的 `mine===undefined`。改成三分支——員工（原邏輯保留）／老闆／幽靈。老闆看到的是「我巡了哪裡 vs 員工實際去了哪裡」＋「當場抓到 N／被擋掉躲掉 M」＋每人一行的 `.result-roster`（誰・在哪・結果），不再是一整段密文字，對比卡兩側也不再是同一份 `bossZones`。
6. **順手修一句會誤導的標題**：`caught` 為 `'excused'/'held'/'warned'/'guarded'/'blocked'` 時原本歸到「這回合安全度過」，玩家不知道自己剛剛差點掛掉。改成「差一點！這次擋下來了」。
7. `playReveal()` 結尾新增 `revAnimEndsAt`（演出何時播完），focus.js 依它決定何時切個人總結。尾巴留 1.2 秒讓人看完「一行式戰果總結」。

### 碰過的檔（只有這三個）
- `public/focus.js`（+92／−13）
- `public/focus.css`（改寫第 9 行開頭那條封印，新增演出舞台與 `.result-roster` 樣式）
- `public/index.html`（3 處：`revAnimEndsAt` 宣告、`playReveal` 結尾設值、跳過鈕加 id＋改文案）
- **沒有碰** `server.js`、`public/cards.*`、`public/screen.js`、`tests/`。

### 驗收對照
| 驗收項 | 結果 | 證據 |
|---|---|---|
| 五項演出螢幕上看得到 | ✅ | stagger 滑入＝`t1-01`＋時間軌跡（1362ms 1 個 chip → 1681ms 2 個）；手電筒＋巡查區發光＝`t1-03`／`t1-04`（區塊變紅＋🔦）；🫁 屏住呼吸＝`t1-03`；幽靈跑馬燈 toast＝`t1-08`；出局者灰階＋👻＝`t1-07` |
| 演出 →（結束後）個人總結 | ✅ | 3 人局實測演出 6.2~6.6 秒後自動切；`t1-12`／`t1-14`／`t1-15` 皆為演出結束後的個人總結卡 |
| 跳過入口 | ✅ | 原子證據：點擊前 `{stage:"act", remainMs:4635, btnVisible:true, boardVisible:true}` → 點擊後 `{stage:"summary", boardVisible:false, summaryVisible:true}`；截圖 `t1-11`（演出中，按鈕在）／`t1-12`（跳過後） |
| 同一回合不重播 | ✅ | ① socket 斷線→重連：3 秒內 61 次取樣 `distinctStages:["summary"]`；② 整頁重載：載入後 `{stage:"summary", boardOff:true}`；③ 連續 6 次 `render()`：`stagesAfterEachRender` 全 summary、`revAnimKeySame:true`；④ 再玩一局：`{stageKey:"", seen:"", revAnimKey:null}` 且新局第 1 回合觀察到 `act`（有重播） |
| 老闆視角修好 | ✅ | `t1-10`（桌機 900px）／`t1-15`（手機 430px）：標題「差一點…2 人溜掉了」「撲了個空，他們摸魚成功」、兩側不同資訊、逐人 roster |
| 證據截圖 | ✅ | `.team/20260913-情緒定型/evidence-t1/`（11 張） |

### 自評風險點（請 Codex 重點看）
1. **跨腳本 `const` 依賴**：focus.js 直接用了 screen.js 的 top-level `const revealBoardPane`／`revealTabs`（classic script 的 global lexical environment）。這是既有寫法（focus.js 早就在用 `contextBand`／`tacticsPane`／`gameTools`），但如果有人把任何一支改成 `type="module"`，**這裡會直接炸**。
2. **`revealTabs.select(1)` 是跨層控制**：我用 screen.js 自己的分頁 API 強制只留演出分頁，而不是用 CSS 蓋它。好處是沒有 `!important` 對打，壞處是如果之後有人改 screen.js 的分頁順序（目前 index 1 = 地圖動畫），這裡會選錯分頁。建議 reviewer 確認這個耦合可接受。
3. **cards.js 的亮牌牆現在永遠看不到**：`#revealed-cards` 還是每次 render 都會被建出來塞進隱藏的 `.reveal-cards-pane`（多做工、但沒有洩漏也沒有視覺影響）。在 focus 層它本來就被 `focus.css:9` 蓋著，所以不是退化——但這是「有程式碼在跑卻沒人看得到」的技術債。
4. **多人局的時間預算**：`REVEAL_SEC=15`（不准動）。實測演出長度：3 人局 ~6.3 秒、4 人局 ~7.7 秒；人多會更長（每多一位員工約 +0.6 秒）。6 人局（5 員工）推估約 9 秒，**個人總結只剩 ~6 秒**。目前沒有閹割演出（task.md 明令禁止），但這個數字請 CEO 知道；真的太擠時解法應該是調 `REVEAL_SEC` 而不是砍演出。
5. **`sessionStorage` 是分頁層級**：同一台機器開兩個分頁玩同一局不會互相干擾（這是刻意選 session 而非 local）。但同一分頁換房重玩靠的是 `房號:回合` 這組 key，房號碰撞（4 碼）理論上可能讓下一局的同回合被誤判成播過——機率低且 lobby 會清記號，但這是唯一的理論破口。
6. **`prefers-reduced-motion` 沒處理**：演出仍然會播（只有 `.new-card` 有 reduce 規則）。要不要讓 reduce 模式直接跳到總結，是產品決定，我沒有自作主張。

### 順手發現（沒動）
- `server.js:1179` 的 `httpServer.listen(PORT)` 沒綁 `127.0.0.1`（實測 `lsof` 顯示 `*:3131`）。老闆的長期偏好是本機服務綁 loopback。**不在我的範圍，沒動**。
- 多人局非房主玩家在個人總結階段沒有「等房主」的字（`#waitnext` 被我一併關掉，但它在原本的 `focus.css:9` 封印下本來就看不到，不是退化）。要補的話應該補進 `.focus-result` 而不是把 `#waitnext` 放回來。
- 加班令回合實測：摸魚四區全部 disabled，但「回座喘口氣」照樣可點可送出——**佐證 task.md C3 第 2 點的修正是對的**（`idle` 在加班令下合法）。這是 T2 的料，我只是撞到。
- 另一位寫手在同一 working tree 改 `server.js`／`tests/`，中途我的測試用 server（:3101）被連帶殺掉一次。我後來改用 :3131 並用獨立 log 檔避免互相覆蓋。

### 驗證證據（實際跑過，不是「應該會過」）
```
$ node --test tests/card-flow.test.cjs
ℹ tests 16   ℹ pass 16   ℹ fail 0
（原有 7 項全綠，另 9 項是另一位寫手 T5/T6 新增的）

$ PORT=3131 node server.js      # 實跑單人練習 + 多人局（3 個 socket 傀儡玩家）
$ ~/.claude/skills/gstack/browse/dist/browse …   # gstack /browse 無頭瀏覽器

演出時間軌跡（3 人局，[ms, chip.in, chip.hold, toast.in, sumline.in, stage]）：
[1362,1,0,0,0,"act"] [1681,2,0,0,0,"act"] … [4562,2,0,0,2,"act"] [4882,2,0,0,3,"act"] [5201,2,0,0,3,"act"]

跳過鈕原子證據：
{"before":{"stage":"act","remainMs":4635,"btnVisible":true,"boardVisible":true},
 "after":{"stage":"summary","boardVisible":false,"summaryVisible":true,"title":"心悸爆表，變成幽靈了"}}

重連不重播（斷線→重連，3 秒 61 次取樣）：
{"samples":61,"distinctStages":["summary"],"phase":"reveal","boardOff":true,"resultVisible":true}

重複 state 廣播（連呼叫 6 次 render()）：
{"stagesAfterEachRender":["summary","summary","summary","summary","summary","summary"],"revAnimKeySame":true}

再玩一局去重歸零：
before {"stageKey":"Q8AR:4","seen":"Q8AR:4","revAnimKey":"Q8AR:4"}
after  {"phase":"lobby","round":0,"stageKey":"","seen":"","revAnimKey":null}
新局第 1 回合：{"distinct":["summary","act"],"phase":"reveal","round":1,"revAnimKey":"Q8AR:1"}

瀏覽器 console：整場 88 則全是 18:32 那次外部把 :3101 伺服器殺掉造成的 ERR_CONNECTION_REFUSED，
零則 JS 例外（grep -v ERR_CONNECTION_REFUSED 後為空）。
```

**截圖**（`.team/20260913-情緒定型/evidence-t1/`，同時留在 scratchpad）：
| 檔名 | 內容 |
|---|---|
| `t1-01-reveal-hold.png` | 演出：員工滑入各區塊（桌機） |
| `t1-03-hold-breath.png` | 🫁 屏住呼吸 顫抖中＋巡查區發紅＋🔦 |
| `t1-07-dead-ghost.png` | 出局者灰階👻 chip ＋ 一行式戰果總結 |
| `t1-08-toast.png` | 幽靈作祟跑馬燈 toast |
| `t1-09-ghost-view.png` | 幽靈個人總結（原本是密文字） |
| `t1-10-boss-view.png` | 老闆個人總結（桌機） |
| `t1-11-skip-before.png` | 演出中，「⏩ 跳過演出」按鈕在畫面上 |
| `t1-12-skip-after.png` | 跳過後的員工個人總結（被老闆抓到了） |
| `t1-13-mobile-act.png` | 手機 430px 演出 |
| `t1-14-mobile-summary.png` | 手機 430px 個人總結 |
| `t1-15-mobile-boss.png` | 手機 430px 老闆總結（roster 不溢出） |

**沒有 git add／commit／push，改動全留在 working tree。**

---

## 寫手回報 — T4（screen.js ＋ art/README.md 這半）

**狀態：DONE_WITH_CONCERNS**

### 做了什麼
1. **`screen.js:137` 解除大廳／結算美術的隱藏**：原本 `['art-lobby', 'art-end', 'rules-lobby'].forEach(id => $(id)?.classList.add('pane-off'))` 一次把三個東西全蓋掉，改成只留 `['rules-lobby']`。`rules-lobby`（規則摺疊區，跟美術無關）維持收起，符合「不要順便解開規則」的要求。這是整個檔案唯一的程式碼改動，前後都離 T1 依賴的 `revealBoardPane`／`revealTabs`（`screen.js:127-131`）有一段距離，沒有動到那幾行。
2. **實測確認 `#art-end` 的 `onerror` 缺圖回退依然有效**：`09_boss_end.jpg`／`10_king_end.jpg` 檔案不存在，`index.html` 的 `onerror="this.parentNode.style.display='none'"` 會把整個圖槽收起，不留空白框（桌機、手機都測了）。
3. **`public/art/README.md` 全面更新**：修正 `03_board.jpg`「預留」的過時狀態（它其實是行動卡插圖精靈圖，已接線）、順手更新 `01_cover.jpg`／`02_lobby.jpg` 兩列成目前的多處真實用法，新增「獨立角色圖槽」一節（`11_char_boss.png`／`12_char_employee.png`／`13_char_ghost.png` 命名 + 可直接貼的 CSS 雙層 `background-image` 回退寫法），並重申老闆的更正：合成圖不能直接當透明角色圖用。
4. **`/browse` 實測跑通**：`PORT=3151 node server.js`，桌機（1440×900）與手機（375×667）兩種寬度分別驗證大廳、結算頁。
5. **確認沒有弄壞 T1 的揭曉演出**：用真實 render 流程（不是讀 code 用猜的）跑了一次合成的 reveal 狀態，`revealTabs`／`revealBoardPane`／`empTabs` 全部型別正常，`applyRevealStage()` 的 act→summary 兩段式切換、對戰頭像（`.story-portrait` 裁切 `01_cover.jpg`）都正常顯示，過程 console 零 JS 例外。

### 碰過的檔（只有這兩個，符合範圍）
- `/Users/freedom/Documents/Codex/2026-09-12/https-github-com-juanjunfu-mo-yu/work/mo-yu-wan/public/screen.js`（1 行邏輯改動）
- `/Users/freedom/Documents/Codex/2026-09-12/https-github-com-juanjunfu-mo-yu/work/mo-yu-wan/public/art/README.md`（全篇重寫）

沒有動 `server.js`、`tests/`、`public/focus.*`、`public/cards.*`、`public/index.html`。

### 驗收對照

| 驗收項 | 結果 | 證據 |
|---|---|---|
| 恢復封面／大廳美術可見性，沒被其他層蓋掉 | ⚠️ **只完成大廳這半** | `#art-lobby` 實測可見（`t4-01`／`t4-02`）；`#art-home`（封面）在 `cards.css:11`（目前拿掉了 `!important`，可能是另一位寫手正在改，不歸我判定）——**不是我的範圍**，這格 task.md 沒勾 |
| 一屏操作下重要按鈕不被擠出畫面 | ⚠️ **大廳全過，結算頁手機沒過（但非我造成）** | 見下方獨立一節的完整說明 + A/B 證據 |
| 沿用現有裁切頭像 + 預留獨立角色圖路徑 + 缺圖自動回退 | ✅（文件層級） | README 新增命名與可貼 CSS；**這段 CSS 還沒真的貼進 `focus.css`**（不在我檔案範圍），只是規格就緒 |
| 新增圖槽命名 + 修正過時接線狀態欄 | ✅ | README `03_board.jpg` 行更正；`01`／`02` 行也更新成完整真實用途 |
| 不得把合成圖直接當透明角色圖 | ✅ | 沒有使用該檔案（本機也找不到）；README 重申警語 |
| 證據截圖 | ⚠️ **部分** | 6 張截圖在 `.team/20260913-情緒定型/evidence-t4/`，缺「封面」（不在範圍）、缺「手機結算頁按鈕未被擠出」（**沒通過，如實附上失敗證據**） |

### 結算頁手機 375px 按鈕被擠出——完整說明（自評風險點 #1，最重要）

**現象**：`/browse` 在 375×667 開結算頁（`#s-end`），「再玩一局」「關閉房間」兩顆按鈕的 `getBoundingClientRect().bottom` 是 895.86px，超出 `window.innerHeight`（667px）228px，實際上滑不到、按不到。截圖 `t4-05`。

**這不是我這次改動造成的，證據如下（A/B 對照，同一個已渲染頁面上直接切換）**：
```js
// 先量：模擬「還原成 T4 之前」的隱藏方式（手動幫 art-end 加回 pane-off）
document.getElementById('art-end').classList.add('pane-off');
// 關閉房間按鈕 bottom = 895.859375px

// 再量：切回我實際的修改（拿掉 pane-off）
document.getElementById('art-end').classList.remove('pane-off');
// 關閉房間按鈕 bottom = 895.859375px  ← 完全一樣
```
兩種情況數字**完全相同**，因為 `09_boss_end.jpg`／`10_king_end.jpg` 檔案本來就不存在，`#art-end` 不管有沒有被我的 `pane-off` 蓋著，實際佔用高度都是 0px（`getBoundingClientRect().height` 兩種情況都是 0）。真正把畫面撐爆的是結算頁新增的「三王」「排行榜」內容（`kingsMarkup(w.kings)`、`$('ranking').innerHTML=...`，屬於另一位寫手正在改的 `index.html`／`renderEnd`），這些內容在**沒有我的美術改動時就已經超出手機一屏**。

**額外量測（供 CEO/下一手參考，不是我要修的）**：如果之後真的把 `09_boss_end.jpg`／`10_king_end.jpg` 生出來並成功載入，`#art-end` 會撐開到 ~202px（`cards.css:` `#art-lobby,#art-end{max-height:210px}` 那條規則吃到），屆時按鈕會被再往下推、`bottom` 變成 ~1124px——**問題只會更嚴重，不會自己消失**。建議：手機結算頁的高度預算需要跟正在做「三王事蹟畫出來」那位（task.md T5 備註提到 `renderEnd` 還沒讀 `kings`，現在看起來已經有人在補）一起重新盤點，不是靠美術這層能解的（`art-end` 就算完全不顯示，缺口還有 228px）。

### 自評風險點（請阿審重點看）

1. **上面那條手機結算頁溢出**——我已經證明不是我造成的（A/B 完全相同），但它確實出現在「一屏操作下重要按鈕不被擠出畫面」這條驗收項下，而且是我測出來的。task.md 這格我沒勾，如實記錄，請阿審確認 A/B 證據的邏輯站得住腳。
2. **獨立角色圖槽的 CSS 只是文件，不是真的接線**——README 裡那三行 `background-image` 雙層寫法是可以直接複製貼上的規格，但目前 `focus.css` 完全沒有這幾行。如果有人看 README 就以為「圖槽已經接好，丟檔案就上線」，會踩空——我在 README 裡有特別加粗這句提醒，但阿審可以確認這樣的措辭夠不夠清楚。
3. **`public/art/README.md` 的行號引用有時效性**——`focus.css`／`focus.js`／`index.html` 在我整個測試過程中被另外的寫手改了好幾次，行號一直在漂移（例如 `focus.js` 的 `stampCharacter` 從我一開始看到的第 49 行變成後來的第 96 行）。README 裡我用的是**動手寫文件那一刻**看到的行號，並在檔案開頭加了一句提醒（行號可能漂移，找不到就用 class/函式名重新 grep）。這是老實的做法，但代表這份文件的行號**在我交件後可能很快就不準**，這是共享 working tree 下沒辦法完全避免的限制。
4. **封面（`art-home`）在我測試期間被另一位寫手改了至少一次**（`cards.css` 的 `#s-home>#art-home{display:none!important}` 中途變成 `display:none`，拿掉了 `!important`）——我沒有動這個檔案，只是路過觀察到，如實記在 README 裡，沒有蓋掉或修正它（不是我的範圍）。
5. 🟡 **多人房「一屏」沒有測到滿房（6 人）情境**——我原本想測滿房的大廳畫面（玩家列表變長會不會把按鈕擠出去），但這跟美術本身無關（`.plist` 沒有內建 `max-height`/`overflow`，這是既有設計，不是本次改動引入的），而且測試過程中踩到下面第 6 點的環境問題，最終只驗證了 1 人房的大廳畫面。**這格沒有 100% 覆蓋**，如實告知。

### 🔴 重大操作發現（不是 T4 的 bug，是整個 /team 流程的風險，務必轉告 CEO）

**`/browse` 的無頭瀏覽器是所有同時執行的 subagent 共用同一個 daemon**，不是每個寫手各自獨立一份。我測試過程中直接撞見：
- 我開的分頁一度被切換／導向到另一個寫手的伺服器（`http://127.0.0.1:3141/`，猜是 T2 或 T3 在測 `mooch` 卡），期間我執行的 `browse tab`／`browse closetab` 很可能誤關過對方開的分頁（我事後在 `ps aux` 裡直接看到另一位寫手的 shell loop：`cd .../evidence-t23 && ... sock.emit('restart') ... startGame ...`，證實真的有人在跟我共用同一個瀏覽器程序）。
- 我自己也留下過一個沒清乾淨的背景迴圈（一開始寫錯 `sock.emit` 參數個數，見下一點），它在我以為已經結束後又繼續執行了一陣子，二度把我剛重啟的測試伺服器搞掛。
- 這代表：**這一批三個寫手同時跑，彼此的 `/browse` 操作互相看得到、也改得到對方的分頁／状態**。這次算運氣好，只是我的分頁一度顯示錯房間、對方的伺服器沒被我打壞；但下一次可能真的會有人的分頁被誤關、誤導頁，或像我一樣不小心把共用資源搞出非預期狀態。
- **建議**：CEO 之後排多寫手同時跑 `/browse` 時，要嘛協調好「誰用哪個 tab index」，要嘛（更安全）把瀏覽器驗證步驟序列化、不要真的同時進行。這不是我能在 T4 範圍內修的，只能先講清楚讓 CEO 知道。

### 順手發現（沒動）

1. 🔴 **踩到一個 `server.js` 的真實健壯性 bug（不是我造成的，是我測試時意外揭露的）**：`socket.on('practiceReady', (cb)=>{...cb?.({ok:true})...})`（以及 `drawRoundCards`）如果收到的最後一個參數不是函式（例如客戶端多帶了一個資料物件），`cb?.(...)` 只會擋掉 `null`/`undefined`，擋不住「給了一個物件」的情況，會直接丟出 `TypeError: cb is not a function` 讓整個 Node process 崩潰（不是只影響那個 request，是整台伺服器所有房間、所有玩家一起斷線）。我是在手動測試時不小心用錯呼叫方式（`sock.emit('practiceReady',{},res)` 多塞了一個空物件）撞出來的，正常的正版前端（`focusReady()` 等）不會這樣呼叫，所以**目前玩家從 UI 操作不會觸發**，但這是一個「單一客戶端送錯格式就能讓所有人斷線」的脆弱點。`server.js` 不在我這輪範圍（T1~T4 明文禁止動 `server.js`），只記錄，不動它。crash log 摘要：`TypeError: cb is not a function at Socket.<anonymous> (server.js:1190:55 / :1204:78 / :1205:43)`。
2. 🟡 `safeCount`／`httpServer.listen(PORT)` 沒綁 127.0.0.1 等——T1、T5 已經各自記過，這裡不重複記。

### 驗證證據（實際跑過，不是「應該會過」）

**環境**：`PORT=3151 node server.js`（獨立埠號，避開其他寫手）＋ `~/.claude/skills/gstack/browse/dist/browse`（gstack 無頭瀏覽器）。

**① `screen.js` diff（唯一程式碼改動，逐行可核對）**
```
$ git diff public/screen.js
-// Secondary screens: remove decorative art and open verbose content on demand.
-['art-lobby', 'art-end', 'rules-lobby'].forEach(id => $(id)?.classList.add('pane-off'));
+// Secondary screens: keep the storybook art visible (T4); still open verbose rules text on demand.
+['rules-lobby'].forEach(id => $(id)?.classList.add('pane-off'));
```

**② 大廳美術恢復可見（桌機 1440×900 + 手機 375×667），按鈕都在畫面內**
```
桌機：{"innerHeight":900,"startBtn":{"bottom":702.19,"ok":true},"closeBtn":{"bottom":702.19,"ok":true}}
手機：{"innerHeight":667,"startBtnBottom":593.30,"startBtnVisible":true,"closeBtnBottom":593.30,"closeBtnVisible":true,"artLobbyHeight":202.41}
```
截圖：`t4-01-lobby-mobile-375.png`、`t4-02-lobby-desktop.png`

**③ 結算頁缺圖自動收起，沒有空白框**
```js
document.getElementById('art-end').outerHTML
// display:"none", height:0, imgSrc:".../art/10_king_end.jpg"（404，onerror 生效）, hasPaneOff:false
```
截圖：`t4-04-end-desktop-missing-art-no-blank-box.png`（桌機，按鈕在畫面內 bottom 786/834 < 900）

**④ 結算頁手機 375px 按鈕被擠出＋ A/B 證明非我造成**（見上方專節）
截圖：`t4-05-end-mobile-375-KNOWN-overflow-not-caused-by-my-change.png`

**⑤ T1 揭曉演出沒被弄壞（用真實 render() 流程跑合成 reveal 狀態，非讀 code 用猜的）**
```
render() 後：{ok:true, resultVisible:false, boardOff:false}  // 剛進場：act 階段，動畫板可見
2 秒後：      {resultVisible:true, boardOff:true, cardsPaneOff:true, title:"摸魚成功！"}  // 已切到 summary
console --errors：只有預期中的 404（缺圖回退），零 JS 例外
```
截圖：`t4-06-reveal-regression-check-T1-intact.png`

**截圖清單**（`.team/20260913-情緒定型/evidence-t4/`）：
| 檔名 | 內容 |
|---|---|
| `t4-01-lobby-mobile-375.png` | 大廳美術可見，手機 375px，按鈕未被擠出 |
| `t4-02-lobby-desktop.png` | 大廳美術可見，桌機 1440×900，按鈕未被擠出 |
| `t4-04-end-desktop-missing-art-no-blank-box.png` | 結算頁缺圖自動收起、無空白框，桌機按鈕未被擠出 |
| `t4-05-end-mobile-375-KNOWN-overflow-not-caused-by-my-change.png` | 結算頁手機 375px 按鈕被擠出（已證明非我造成，見報告） |
| `t4-06-reveal-regression-check-T1-intact.png` | T1 揭曉個人總結畫面正常（回歸測試） |

### 沒做到的（誠實欄）
- **封面（`art-home`）沒有恢復**——CEO 明確指派給另一位寫手，我沒有動 `cards.css`。
- **結算頁手機 375px 按鈕沒有做到「不被擠出」**——已證明非我造成，但沒有能力在我的檔案範圍內修（根源在 `index.html`／`renderEnd` 新增的三王/排行榜內容，需要動 `public/index.html`，超出我的範圍，而且該檔正被另一位寫手改動中）。
- **獨立角色圖槽的 CSS 只是 README 裡的建議規格，沒有真的貼進 `focus.css`**——原因同上，不在我檔案範圍。
- **沒有測滿房（6 人）大廳畫面**——測試過程撞見共用瀏覽器 daemon 的環境問題，優先保住核心必附證據，滿房情境沒有覆蓋到。
- **沒有 git add／commit／push**，改動全留在 working tree（`public/screen.js`、`public/art/README.md`，加上 `.team/` 底下的 task.md 與 evidence-t4/）。

---

## 寫手回報 — T2＋T3＋三王渲染

**狀態：DONE_WITH_CONCERNS**

### 做了什麼
1. **T2 過勞警告**：新增 `overworkWarning()`（`public/index.html`，接在 `renderEcon()` 尾巴），把警告放到**和加班令同一條橫幅帶**——也就是提交前一定看得到的位置，不再只有工作卡的小字。橫幅列出**當下伺服器真的會收的行動**：`idle` 永遠列（含加班令回合，並明寫「加班令只禁摸魚，休息照樣送得出去」），`slack` 先過 `you.overtime` 與 `you.lastZone` 才列，**沒有「邊做邊摸」**。選牌階段這些是可直接點的按鈕；抽牌階段變 disabled 並附一句「等一下進到選行動牌就能點」。
2. **T2 硬編碼**：全檔改走 `streakLimit()`（`focus.js`），一次掃掉 5 處寫死的 `3`／`2`（工作卡 `連做 x/3`、狀態列 `連做 x/3`、`work-danger` 的 `>=2`、出牌預覽的「你已連續工作 2 回合」、規則附註）。唯一剩下的字面 `3` 是 `streakLimit()` 在 `ST` 還沒到時的 fallback。
3. **T2 猝死演出**：新增 `playKaroshi()`＋`.karoshi-scene`，**接在 T1 的 `act` 階段裡**（`revealAct()` 取 `max(板面動畫, 猝死演出)` 當 act 長度），不另開路徑。四拍：白光＋屍體癱下→「過 勞 死」紅印章砸下＋震動→三行遺言→綠框「👻 換跑道成功！你現在可以爭 **搞鬼王**」。實測 **3.48 秒**（6.60s→10.08s），遠超 ≥1.5s。個人總結再補一塊 `.result-turn` 把新目標釘死。
4. **T3 四類卡面**：新增 `CARD_CLASS`（`index.html`，`excuse→藉口 / jam→干擾 / energy,boost→增益 / mooch→社交`）＋ `focusCardFace()`（`focus.js`）。每張卡固定四要素（圖／名稱／效果／使用時機），四類用「左側粗色條＋徽章色＋底色」三重編碼。藉口卡走虛線框＋`⚡ 自動觸發 · 被抓時替你擋下這一次`；社交卡選起來會跳出「🎯 凹哪位同事？」。抽牌面板與補給市場也套同一套標示。
5. **T3 第一局隱藏市場**：`localStorage['moyu_played_once']`（`focus.js`）——**打完一整局（`phase==='ended'`）才算玩過**，不是 `round===1`。只藏「補給商店」入口＋`focusShop()` 直接 return；**後端零改動**，實測第一局 `ST.market.length===3`、bot 老闆照樣買到加班令。
6. **文案統一**：`index.html` 首頁 hint 與規則文的「三選一含邊做邊摸」全部改掉，改成「摸魚時手上若有任務，會順便推 +1 進度」＋明寫「**不是第四個按鈕**」；規則文順手改成四類卡的講法。**沒有新增任何 action**。
7. **三王事蹟渲染**：`renderEnd` 新增 `kingsMarkup()`／`kingCard()` 與 `#endkings`。🐟 摸魚王＝金框放大（medal 41.6px／名字 20.8px／2px 框），👻 搞鬼王／🐮 牛馬王＝並排小卡（28.8px／16px／1px 框）＝視覺層級明確不等重；`vacant:true` 走虛線＋「從缺」＋server 給的那句話。
8. **順手（在檔案範圍內）**：
   - 修掉 `cards.css` 那條 `#s-home>#art-home{display:none!important}` 的 `!important`（詳見下方「關於封面」）。
   - 修掉一個**既有的疊加順序 bug**：`screen.js` 換回合時 `empTabs.select(0)` 會把「道具牌」那格關掉，而 `renderEmpZones` 是在它之前跑的 → 回合第一次 render（含中途重整）**手牌整區消失**。在 `focus.js` 最外層 render 再開一次。這條直接影響 T3 的「手牌照常顯示」。
   - 結算頁 `#s-end>.card{overflow:auto}` ＋ `#hostend` sticky（見下方 375px 那段）。

### 碰過的檔（只有這四個）
- `/Users/freedom/Documents/Codex/2026-09-12/https-github-com-juanjunfu-mo-yu/work/mo-yu-wan/public/index.html`
- `/Users/freedom/Documents/Codex/2026-09-12/https-github-com-juanjunfu-mo-yu/work/mo-yu-wan/public/focus.js`
- `/Users/freedom/Documents/Codex/2026-09-12/https-github-com-juanjunfu-mo-yu/work/mo-yu-wan/public/focus.css`
- `/Users/freedom/Documents/Codex/2026-09-12/https-github-com-juanjunfu-mo-yu/work/mo-yu-wan/public/cards.css`

`public/cards.js` 在我的範圍內但**沒動**（它的 `renderHand` 在 focus 層被 `paintFocusHand` 覆蓋掉，改它等於改看不到的東西）。`server.js`／`tests/`／`public/screen.js`／`public/art/` **一個字都沒碰**（`git diff public/screen.js` 顯示的是 T4 那位的改動，註解自己寫著 T4）。

### 驗收對照

| 驗收項 | 結果 | 證據 |
|---|---|---|
| T2 警告在提交前的顯眼位置 | ✅ | `t23-01a`（抽牌階段）／`t23-01b`（選牌階段），橫幅在 `#econbox`、在行動卡**上面** |
| T2 列出當下合法的替代方案 | ✅ | `t23-02`：休息＋4 個摸魚區（`lastZone` 冷卻會自動剔除）。DOM 實測：`["🌿 回座休息…[enabled]","☕ 去茶水間摸魚…",…]` |
| T2 加班令下休息仍可點且送得出去 | ✅ | `t23-03a`（OT＋連工2 同時成立 → 替代方案**只剩「🌿 回座休息」**）／`t23-03b`（真的按下去送出：`err:""`、`submitted:true`，下回合 `連做 0/3`） |
| T2 ❌ 不得出現「邊做邊摸」 | ✅ | `grep -n "邊做邊摸" public/` 只剩規則文那句「**不是第四個按鈕**」的否定說明 |
| T2 硬編碼修掉 | ✅ | `git diff public/focus.js \| grep "/3"` 為空；畫面實測 `連做 2/3` 來自 `ST.workStreakLimit` |
| T2 猝死演出 ≥1.5 秒、荒謬 | ✅ | 取樣時間軸：`6602ms ON → 10082ms ON → 10202ms summary`＝**3.48 秒**；`t23-04a/b/c` 三拍截圖 |
| T2 猝死＝換跑道 | ✅ | 演出最後一拍＋`t23-04d` 個人總結的 `.result-turn`：「不是出局，是換跑道…你現在可以爭 👻 搞鬼王」 |
| T3 四要素 | ✅ | DOM 實測每張卡都有 `.cf-art/.cf-name/.cf-effect/.cf-when`；`t23-05a/b/c` |
| T3 四類視覺可區分 | ✅ | `t23-05b`（藉口綠虛線／增益金／干擾藍）＋`t23-05c`（社交紫）＋`t23-07b-market-four-classes` |
| T3 藉口卡標示自動觸發 | ✅ | `t23-06`：虛線框＋`⚡ 自動觸發 · 被抓時替你擋下這一次`，且不會被選起來 |
| T3 mooch 標示目標 | ✅ | `t23-05c`：卡面「✓ 已搭配 · 記得在下面選一位隊友」＋下方「🎯 凹哪位同事？」兩顆隊友鈕 |
| T3 第一局隱藏市場（顯示層，bot 照買） | ✅ | `t23-07`：`{played:null, shopBtn:false, marketLen:3, marketboxVisible:false}`；同一局 log 有 `🛒【🤖鵝霸老闆】買了 🕘加班令` |
| T3 手牌照常顯示 | ✅ | `t23-05a`（第一回合摸到 2 張）＋修好上面那個「手牌整區消失」的疊加 bug |
| T3 文案統一 | ✅ | `t23-09b` 規則 reader；首頁 hint 見下方⚠️ |
| 三王：名字／得主／一句事蹟 | ✅ | `t23-08a`（三王齊全）／`t23-08c`（搞鬼王從缺，虛線＋那句話） |
| 三王視覺層級（摸魚王＝唯一的贏） | ✅ | 量到：lead medal 41.6px vs honor 28.8px、lead 名字 20.8px vs 16px、lead 框 2px 金 vs 1px |
| 375px 重要按鈕不被擠出 | ✅ | 修前 `再玩一局` y=965 > vh=812；修後 375×812／375×667 皆 `inViewNoScroll:true`。**連同「補上結算美術之後」一起驗**（強制 `art-end-img` 指到真圖 → 101px，按鈕仍 `inView:true`） |
| 不弄壞 T1 | ✅ | 見下方 T1 回歸 |
| 測試 | ✅ | `node --test tests/card-flow.test.cjs` → **23/23 綠**（另一位寫手把 19 加到 23） |
| 新增 `!important` | ✅ **0** | `focus.css` 10→10、`cards.css` 4→**3**（淨 −1）、`index.html`／`focus.js`／`cards.js` 0→0 |

### 🔴 關於「把首頁封面恢復可見」——我的判斷與 CEO 的敘述不同，請裁決

CEO 交辦：「`cards.css:6` 的 `#s-home>#art-home{display:none!important}` 把首頁封面圖 `index.html:172` 藏起來了，把封面恢復可見」。

**實測發現：封面 `01_cover.jpg` 本來就看得到**，而且是 HEAD 就有的行為——
- `git show HEAD:public/focus.js:128`：`const menuArt=screenNode('div','menu-story-art');modeMenu.prepend(menuArt);`
- `focus.css` 的 `.menu-story-art{background:url('/art/01_cover.jpg')…}`
- 瀏覽器實測：`{menuArt:{img:"…/art/01_cover.jpg", x:190,y:197,w:900,h:215}}` → 900×215 的封面橫幅就在模式選單正上方（截圖 `t23-09a`）

我先照字面把 `#art-home` 放出來，結果是**同一張封面在首頁出現兩次**（左邊多一塊 300×83 被壓扁的縮圖），比原本差。所以我的處置是：
- **移除那條 `!important`**（CEO 要的技術目標達成，淨 −1），
- 但保留 `#art-home{display:none}`（一般宣告），並在該處寫清楚原因與替代節點。

→ **如果老闆要的是「另一塊獨立封面區」而不是現在這塊橫幅，請 CEO 明講，我再做。** 我不想為了字面達標而讓首頁出現重複美術。

### ⚠️ 首頁 hint 的文案改了，但它在畫面上看不到（既有行為，非本次造成）
`index.html:207` 的 hint 文案我已改成「摸魚時手上若有任務，還會順便推一點進度」，但 `cards.css:6` 有一條 `#s-home>.hint{display:none}`（**HEAD 就有**）。實測 `getComputedStyle(...).display === "none"`，兩條 hint 都看不到。
我沒有自作主張把它放出來——`#s-home` 是 `display:flex;align-items:center;justify-content:center`（`menu.css:1`），硬放出來會變成模式選單旁邊多兩條橫向文字，有把按鈕擠掉的風險，而首頁版面是 T4 的範圍。
**玩家真正看得到的那份文案（規則全文 reader）我已經改好並附截圖**（`t23-09b`）。要不要讓首頁 hint 復活請 CEO／T4 決定。

### 自評風險點（請阿審重點看）
1. 🔴 **`cards.css:2` 會重新定義 `:root` token，而且是**反向**的**：`--wood2` 在 `index.html:9` 是深棕 `#4a2c14`，在 `cards.css:2` 變成淺奶油 `#ece3c8`；`--gold` 也從 `#a5770b` 變成 `#d6b973`。我第一版用 `var(--wood2)` 寫按鈕文字色 → **實際渲染成淺字配淺底、整排字看不見**（我自己截圖才抓到，見 review note）。現在我新加的 CSS **一律寫死色碼**並在檔內註明原因。**請阿審確認我沒有漏掉任何一個 `var()`**，也建議把這件事記進技術債。
2. 🟡 **`renderEmpZones` 裡多叫了一次 `renderEcon()`**：因為 `pickEmp()` 只會呼叫 `renderEmpZones`，不叫 `renderEcon`，警告橫幅的「目前選了哪個替代方案」不更新就會不同步。代價是每次 render `renderEcon` 跑兩次（`renderGame` 一次、這裡一次）。純字串重建，但確實是重複工。
3. 🟡 **猝死演出會把 `act` 階段拉長約 3.5 秒**。多人局 `REVEAL_SEC=15`（不准動）：實測 4 人局板面動畫 ~6.6 秒＋猝死 3.5 秒 ≈ 10.1 秒，**個人總結只剩約 5 秒**。人再多會更緊。目前沒閹割演出（task.md 明令禁止），但這個數字請 CEO 知道。跳過鈕全程可用，猝死那一幕也吃跳過。
4. 🟡 **`markPlayed()` 的時機是 `phase==='ended'`**：中途離開、或第一局打到一半關掉，下次還是算「第一局」（市場繼續藏）。我認為這是對的（沒打完就是沒體驗完），但這是我自己的判斷，不是 task.md 寫死的。另外**觀戰者不會觸發**（`spec` 不走 `render()`）。
5. 🟡 **`localStorage` 不可用時 fail-open**：`playedBefore()` 的 `catch` 回傳 `true` → 當成已玩過 → 市場照開。選擇「寧可多給市場，也不要在隱私模式把功能弄丟」，但這代表**隱私模式的新玩家不會享受到第一局簡化**。
6. 🟡 **`#hostend` 用 `position:sticky; bottom:-14px`**，`-14px` 是為了吃掉 `#s-end>.card{padding:14px}`（`screen.css`）。**這是跨檔耦合**：如果有人改了那個 padding，底部會露出半行或多一條縫。已在 focus.css 註明。
7. 🟡 **「每 2 回合能作祟一次」是寫死的字面 2**（`.result-turn` 文案）。`GHOST_COOLDOWN`（`server.js:35`）沒有出現在 `viewFor` 的回傳裡，client 拿不到；我沿用規則全文 `index.html` 既有的同一句寫法。**server 改了這個常數，這句話會說謊。**
8. 🟢 **四類卡面在極矮螢幕（`max-height:700px and max-width:700px`）會收起「使用時機」那一行**，圖／名稱／效果保留。這是我為了保住出牌按鈕做的取捨；嚴格講那一屏就不滿足「四要素固定」了。實測 390×664：`whenShown:"none"`，但 `bodyScroll 664/664`（零溢出）、送出鈕 `inView:true`。

### 順手發現（**沒動**）
1. 🟡 **`art/10_king_end.jpg` 404**（`index.html` 的 `renderEnd` 會去載）。`onerror` 有把節點收掉所以不影響畫面，但 console 每局噴一次 error。task.md:174 已記載這張圖不存在。T4 那位剛把 `art-end` 解除隱藏，所以現在**每一局結算都會打這個 404**。
2. 🟡 **`cards.js` 的 `renderHand`／`renderReveal` 每次 render 都在建一堆看不到的 DOM**（focus 層整個蓋掉）。不是退化，是既有技術債，白跑的工。
3. 🟡 **`#s-home>.hint{display:none}`（`cards.css:6`）讓兩條首頁標語永久隱形**，其中一條是老闆的 slogan「你是牛馬，還是摸魚王？」。
4. 🟡 **`#endbanner`（「🏆 員工陣營獲勝！」）在結算頁幾乎看不清**——`.banner` 的配色在卡牌層底色上對比極低（截圖 `t23-08a` 可見它幾乎融進背景）。既有問題，不在本次範圍。
5. 🟢 **`/browse` 是所有寫手共用一個 daemon**（CEO 的提醒屬實）。我中途確實看到分頁被切走／被別人導向。我的作法是每次操作前先 `tab 1` 或重新 `goto` 自己的 URL；多人局測試我自己開了 tab 2/3 當老闆與同事，用完已 `closetab`。
6. 🟢 **測試期間伺服器被外部殺掉一次**（console 有一段 `ERR_CONNECTION_REFUSED` 與 WebSocket failed，時間 19:43–19:44），重開 `PORT=3141` 後續測。不是我造成的，也沒去碰 `server.js`。

### 驗證證據（全部實際跑過，不是「應該會過」）

**① 測試 23/23 綠**
```
$ node --test tests/card-flow.test.cjs
ℹ tests 23   ℹ pass 23   ℹ fail 0
```

**② 猝死演出時間軸（`.karoshi-scene` 每 120ms 取樣，單人局第 3 回合連工第 3 次）**
```
[6483,"reveal","off","act"]            ← 板面動畫還在跑
[6602,"reveal","ON:","act"]            ← 猝死演出開場（白光＋屍體癱下）
[6962,"reveal","ON:beat1","act"]       ← 「過 勞 死」印章砸下＋震動
[7561,"reveal","ON:beat1,beat2","act"] ← 三行遺言
[8881,"reveal","ON:beat1,beat2,beat3","act"] ← 換跑道：可以爭 👻 搞鬼王
[10082,"reveal","ON:beat1,beat2,beat3","act"]
[10202,"reveal","off","summary"]       ← 演出結束才切個人總結
→ 演出長度 10082−6602 = 3480ms（需求 ≥1500ms）
```

**③ 加班令 ＋ 連工 2 同時成立（3 分頁多人房，我當老闆打出加班令）**
```
選牌前：{"phase":"choosing","ot":true,"streak":2,
 "warnOpts":["🌿 回座休息 · 心悸 −1 · 絕不會被抓[enabled]"],      ← 摸魚全被剔除，只剩休息
 "otbar":"🕘 老闆要求你加班！本回合不能摸魚…",
 "zones":["埋頭苦幹[enabled]","回座喘口氣[enabled]","茶水間[DISABLED]","影印間[DISABLED]","廁所[DISABLED]","頂樓[DISABLED]"]}
真的送出：{"err":"","submitted":true,"btn":"更新出牌"}            ← 伺服器收下了
下一回合：連做 0/3                                                ← 休息真的把連工歸零
```

**④ 第一局隱藏市場（顯示層），後端與 bot 不受影響**
```
{"played":null,"shopBtn":false,"hint":"第一局先專心摸魚就好。","marketLen":3,"marketboxVisible":false}
同一局 log：["🛒【🤖鵝霸老闆】買了 🕘加班令"]        ← bot 照買，市場後端照跑
打完一局後：{"played":"1","shopBtn":true,"hint":null}  ← 第二局起開放
```

**⑤ 四類卡面 DOM（真實牌，不是假資料）**
```
抽牌：["new-card cf-excuse cf-auto :: 🛡️ 藉口 :: 去修印表機 :: ⚡ 自動觸發 · 被抓時替你擋下這一次",
       "new-card cf-buff :: ✨ 增益 :: 雞精加持 :: 選行動牌時搭配，強化自己"]
手牌：["focus-card cf-excuse cf-auto|🛡️ 藉口|去修印表機|⚡ 自動觸發 · 被抓時替你擋下這一次",
       "focus-card cf-buff|✨ 增益|雞精加持|選行動牌時搭配，強化自己",
       "focus-card cf-jam|🌀 干擾|影印機卡紙|選行動牌時搭配，干擾老闆巡查"]
社交：["focus-card cf-social selected|🤝 社交|凹同事|✓ 已搭配 · 記得在下面選一位隊友"]
       targets:["🤖摸魚見習生","🤖薛丁鵝"]
市場：["mcard mc-buff :: ✨ 增益 …","mcard mc-social :: 🤝 社交 …","mcard mc-jam :: 🌀 干擾 …"]
```

**⑥ 三王 payload → 畫面（結算頁真的讀到 `winner.kings`）**
```
["🐟摸魚王=🤖摸魚見習生 :: 偷懶 5💰・摸魚 1 次；第 1 回合在頂樓一口氣爽賺 5💰。",
 "👻搞鬼王=阿寫 :: 第 3 回合下班（永久），之後作祟 1 次：扯掉老闆一次巡查。",
 "🐮牛馬王=🤖薛丁鵝 :: 認真工作 3 回合、領了 3💰 血汗錢，最後在第 4 回合過勞猝死在自己的鍵盤上。"]
DOM 有 .kings: true
從缺那局：["👻搞鬼王=從缺(vacant) :: 全員活到下班，這局沒有半隻鬼——恭喜，也有點無聊。"]
```

**⑦ 375px 按鈕擠出 → 修好（含「美術補上之後」一起驗）**
```
修前 375×812：{"btnY":965,"btnBottom":1005,"inViewNoScroll":false,"cardScroll":"978/657"}
修後 375×812：再玩一局 y=644 inView:true｜關閉房間 inView:true｜本局故事 inView:true
修後 375×667：再玩一局 y=499 inView:true｜關閉房間 inView:true｜本局故事 inView:true
修後 375×667 ＋ 強制載入結算美術（artEndH=101px，模擬 10_king_end.jpg 存在）：
             再玩一局 y=499 inView:true｜關閉房間 y=543 inView:true｜摸魚王卡 inView:true
捲到底時：最後一列排行榜 bottom=462 vs 黏底操作區 top=470 → overlapPx=0（沒有永久遮住任何內容）
視覺層級（同一畫面量到）：lead medal 41.6px vs honor 28.8px｜lead 名字 20.8px vs 16px｜lead 框 2px vs 1px
```

**⑧ T1 回歸（沒弄壞）**
```
演出看得到：多人局第 4 回合 act 階段截圖 t23-T1a（員工 chip 滑入辦公室、老闆 🔦 打在茶水間/影印間、區塊發紅）
跳過鈕：before {"stage":"act","skipBtnVisible":true,"skipLabel":"⏩ 跳過演出，直接看結果","boardChips":2}
        after  {"stage":"summary","summaryVisible":true,"title":"工作完成，領到薪水"}
重複 render：stagesAfter6Renders = ["summary","summary","summary","summary","summary","summary"]
socket 重連（揭曉中，3 秒 38 次取樣）：distinct = ["reveal:summary"]
整頁重載（揭曉中）：{"phase":"reveal","round":6,"stage":"summary","seen":"PYXK:6"}
猝死演出也吃跳過與去重：revealSummary() → clearKaroshi()
```

**⑨ 瀏覽器 console**：零 JS 例外。只有 `art/10_king_end.jpg` 404（既有缺圖，`onerror` 已處理）與我自己中途停伺服器造成的 `ERR_CONNECTION_REFUSED`。

**⑩ 截圖**（`.team/20260913-情緒定型/evidence-t23/`，共 31 張）

| 檔名 | 內容 |
|---|---|
| `t23-01a-warn-in-draw.png` | 連工 2/3・抽牌階段的過勞警告（替代方案先 disabled） |
| `t23-01b-warn-before-submit.png` | 連工 2/3・**提交前**的過勞警告（可點的替代方案） |
| `t23-02-alternatives-with-rest.png` | 替代方案特寫：休息在最前面、綠框 |
| `t23-03a-overtime-rest-allowed.png` | **加班令＋連工 2**：替代方案只剩「回座休息」，摸魚四區 disabled |
| `t23-03b-overtime-rest-submitted.png` | 同上，休息真的送出成功 |
| `t23-04a-karoshi-stamp.png` | 猝死演出 beat1：「過 勞 死」印章砸下 |
| `t23-04b-karoshi-lines.png` | beat2：靈魂飄出＋三行遺言 |
| `t23-04c-karoshi-turn.png` | beat3：「👻 換跑道成功！你現在可以爭 搞鬼王」 |
| `t23-04d-summary-change-track.png` | 個人總結的 `.result-turn` 換跑道宣告 |
| `t23-05a-draw-cardfaces.png` | 抽牌面板四要素卡面（藉口／增益） |
| `t23-05b-hand-cardfaces.png` | 手牌三類同框（藉口／增益／干擾） |
| `t23-05c-social-card-target.png` | 🤝 社交卡選中＋「🎯 凹哪位同事？」目標列 |
| `t23-06-excuse-auto-trigger.png` | 藉口卡「⚡ 自動觸發」特寫 |
| `t23-07-firstgame-no-market.png` | **第一局**：沒有補給商店入口 |
| `t23-07b-market-second-game.png` | 第二局市場（帶類別徽章） |
| `t23-07b-market-four-classes.png` | 市場同時出現增益／社交／干擾 |
| `t23-08a-end-three-kings.png` | 結算頁三王（桌機，含事蹟＋層級） |
| `t23-08b-end-scrolled-bottom.png` | 結算頁捲到底 |
| `t23-08c-end-kings-vacant.png` | 搞鬼王**從缺**的呈現 |
| `t23-09a-home-cover.png` | 首頁封面（`.menu-story-art`，本來就看得到） |
| `t23-09b-rules-reader.png` | 規則 reader：「邊做邊摸不是第四個按鈕」＋手牌四類 |
| `t23-10a-mobile-home.png` | 430px 首頁，兩顆模式鈕都在畫面內 |
| `t23-10b-mobile-draw.png` | 430px 抽牌卡面 |
| `t23-10c-mobile-warn-choosing.png` | 430px 過勞警告＋六張行動卡＋手牌＋送出鈕全在一屏 |
| `t23-10d-mobile-short.png` | 390×664 矮螢幕，零溢出 |
| `t23-10e-mobile375-end-before.png` | **修前**：375px 結算頁按鈕被擠到 y=965（畫面外） |
| `t23-10e-mobile375x812-end-sticky.png` | 修後 375×812：操作區黏底 |
| `t23-10f-mobile375x667-end-with-art.png` | **修後**＋強制載入結算美術，按鈕仍黏在底部 |
| `t23-10g-mobile375x667-end-scrolled.png` | 捲到底，排行榜與按鈕不重疊 |

### 沒做到的（誠實欄）
- **首頁 hint 的文案改了但畫面上看不到**（`cards.css:6` 既有的 `#s-home>.hint{display:none}`）。我沒有擅自放出來，理由與風險寫在上面。
- **「把封面恢復可見」我沒有照字面做**——因為實測封面本來就看得到，照做會變成重複美術。我只移除了那條 `!important`。請 CEO 裁決。
- **四類卡面在極矮螢幕會收起「使用時機」**（`max-height:700px and max-width:700px`），嚴格講那一屏不滿足四要素。
- **`prefers-reduced-motion` 只補了猝死演出的終態**（`cards.css:13` 的 `*{animation:none!important}` 會讓淡入元素卡在 opacity:0）。整套揭曉演出在 reduce 模式下的行為我沒有改，那是 T1 的地盤。
- **沒有 git add／commit／push**，改動全留在 working tree。

---

## 寫手回報 — ack 崩潰修補（2026-09-13）

**狀態：DONE**

### 做了什麼

1. **在註冊層一次解決**：`server.js:967-1005` 新增 `guardHandlers(socket)`，回傳 `on()` / `onNoAck()` 兩個註冊函式；`io.on('connection')` 開頭 `const {on,onNoAck}=guardHandlers(socket);`，29 個 handler 全部改走它註冊。**101 個 `cb?.()`／`cb&&cb()` 呼叫點一個字都沒動。**
2. **正規化規則**（進 handler 之前）：① 客戶端少給的參數補齊到 `fn.length`（避免 `({a,b})` 解構 `undefined` 直接炸）② payload 位的 `null`/`undefined` → `{}` ③ ack 位不是函式 → 換成 no-op，**但若客戶端真的有帶 ack（socket.io 保證在最後一個），會把真 ack 接回來**，客戶端不會傻等。
3. **保險層**：handler 內部若仍丟例外 → `console.error` 印出**完整原始 Error（含 stack）**＋事件名＋socket id，然後回 ack `{error:'伺服器內部錯誤，這個動作沒有生效'}`。
4. **測試 +6 項**（23 → 29 全綠），含一條「原始碼裡不准有任何 handler 直接用 `socket.on` 註冊」的結構性測試。

### 為什麼是 `on()` / `onNoAck()` 兩個名字（不是 CEO 建議的單一包裝）

CEO 建議的字面規則「最後一個參數若不是函式就換成 no-op」**會打壞 `voice-signal`**：
`server.js:1355` `onNoAck('voice-signal', ({to,data})=>{...})` 的最後一個參數是 **payload 不是 ack**，
用單一規則包會把正常的 `{to,data}` 換成 no-op → WebRTC 信令全滅（語音直接壞掉）。
從 wrapper 的角度，`emit('drawRoundCards','hello')`（畸形 ack）和 `emit('voice-signal',{...})`（正常 payload）
**參數形狀完全一樣、型別推不出來**，所以必須在註冊時宣告。做法：
- 預設 `on()` ＝有 ack（22 個），**安全的那邊當預設**；
- 例外 `onNoAck()` ＝沒有 ack（7 個：`specLeave` `nextRound` `restart` `voice-join` `voice-leave` `voice-signal` `disconnect`，其中 6 個是零參數、只有 `voice-signal` 真的靠這個旗標）。
- 選錯的後果寫在 `server.js:977-978`：該有 ack 卻用 `onNoAck` ＝ 少一層保護；沒 ack 卻用 `on` ＝ payload 被吃掉、功能整個失效（測試馬上抓到，不是靜默）。

### 保險層為什麼不會把真 bug 靜默吞掉

- **stack 沒有被吃掉**：`console.error(..., err)` 傳的是**原始 Error 物件**，印出來的 stack 跟 process 崩潰時印的是同一份；差別只在別人的房間不用陪葬。測試 `a handler that still throws is logged loudly...` 直接斷言 `calls[0][1].message`＝原始 Error。
- **不是 `process.on('uncaughtException')`**：那種全域吞法會連 handler 以外（timer、I/O）的錯一起吃掉，而且吃完狀態不明。這裡只包 handler 的同步執行段，範圍明確。
- **客戶端也會知道**：有 ack 就回 `{error:...}`，不會出現「按了沒反應也沒錯誤」的鬼打牆。
- **實測結果是這層根本沒被觸發**：29 個事件 × 各種畸形封包打完，`server-final.log` 零例外——正規化就把問題擋掉了，try/catch 是純保險。
- ⚠️ 已知邊界（寫進 `server.js:979-982` 註解）：只包**同步**那段；`scheduleBots` 的 `setTimeout`、閒置回收器 `setInterval` 裡丟例外仍會殺 process（那些不是客戶端能直接餵資料的入口）。另外靠 `fn.length` 認 ack 位置，所以 handler 不能用預設值參數或 rest。

### 碰過的檔（只有這兩個）

| 檔案 | 動作 |
|---|---|
| `server.js` | 新增 `guardHandlers()`（`:967-1005`）＋ 29 行註冊改名（`socket.on(` → `on(`／`onNoAck(`）＋ `voice-signal` 上方一行警告註解 |
| `tests/card-flow.test.cjs` | vm 匯出清單加 `guardHandlers`（`:12`）＋ 新增 6 個測試與 `junkEngine()` helper（`:343-425`） |

`public/` 一個檔都沒碰（另一位寫手在改）。

### 驗收對照

| 驗收項 | 結果 | 證據 |
|---|---|---|
| 在註冊層一次解決，不逐一改 101 個呼叫點 | ✅ | 29 行註冊行**去掉前綴後逐字相同**（下方證據 ④）；排除我新增註解後 `cb?.(`＝9、`cb&&cb(`＝92＝**101，與 CEO 實測相同** |
| 涵蓋所有 handler（含單參數 `(cb)` 與 `(payload, cb)`） | ✅ | `grep -c "socket\.on("` → **1**（只剩 `guardHandlers` 內部那行），`on(`22 ＋ `onNoAck(`7 ＝ **29**；另有測試在執行層斷言「掛上 socket 的 handler 數 ＝ 原始碼註冊數」 |
| 測試①字串當 ack 不 throw | ✅ | `a non-function ack does not throw for any registered event`：**29 事件 × 6 種垃圾（字串/數字/物件/陣列/布林/null）＋ 完全不給參數** |
| 測試②傳 undefined 仍正常 | ✅ | 同上「完全不給參數」那條；以及既有 23 項測試（很多本來就沒給 ack）零退化 |
| 測試③正常函式 ack 照常收到回應 | ✅ | `a real function ack still gets its reply, before and after junk traffic`：`{ok:true}` → 插入畸形封包 → 仍收到 `{error:'目前不能抽牌'}` |
| 實際起 server 打畸形封包，process 不死、其他房間不受影響 | ✅ | 證據 ②：29 種畸形封包打完，A 的「不該消失的房間」還在，**A 的舊連線也還能用** |
| 正常流程零退化 | ✅ | 證據 ③：真 socket 協定跑完整局，`{ok:true}`／`{error:...}` 全對；voice-signal payload 完整送達 |
| 現有 23 測試零退化 | ✅ | 29/29 綠（23 舊 + 6 新） |
| `checkWin` 逐字 0 差異 | ✅ | 對 HEAD 比對：`checkWin ✅ 逐字 0 差異` |
| 六個常數沒動 | ✅ | 證據 ⑤ |
| `revealAnimMs()` 沒動 | ✅ | 我的改動只有 guard 區塊＋29 行前綴＋1 行註解，沒有一行落在 `revealAnimMs` |
| 沒有 git add／commit／push | ✅ | 全留 working tree |

### 自評風險點（請阿審重點看）

1. 🟠 **`onNoAck` 名單的正確性**是這個設計的單點。我逐行核過 29 個簽名（22 個最後一個參數確實叫 `cb`；7 個是零參數或 payload）。**若阿審只查一件事，就查 `server.js` 那 29 行註冊的最後一個參數是不是真的 ack。** 未來新增 handler 選錯 `onNoAck` 會少一層保護（不會壞功能，所以不會被測試抓到）。
2. 🟠 **`fn.length` 推 ack 位置**：handler 若寫成 `(payload, cb={})` 或 `(...args)`，`fn.length` 會少算，ack 位就抓錯。目前全檔沒有這種寫法，已寫進註解，但沒有自動化防呆。
3. 🟡 **payload 位 `null`/`undefined` → `{}` 是行為改變**（原本會 crash，現在走既有錯誤分支）。我逐一看過會受影響的 handler：`startGame`（本來就 `opts||{}`）、`submitChoice`（`{}` → `payload.action` undefined → 既有的 `{error:'無效動作'}`）、其餘都是解構後 `(x||'')` 防呆，**沒有任何一條路徑因此得到不同的遊戲結果**。但這是我人工核對，值得第二雙眼睛。
4. 🟡 **`emit('createRoom')`（空封包）現在會成功建出一間 `玩家 的房間`**（見證據 ② 的 `Z2L2`/`KEXP`）。這是「不 crash」的必然副作用：payload 補成 `{}` 後全部走預設值。房間數上限 `MAX_ROOMS=10` 仍在，但**惡意腳本可以用 10 個空封包塞滿大廳**——這是既有的 rate-limit 缺口（本來就能用正常封包做到），我沒有擴大範圍去加節流。若要修，是另一張票。
5. 🟡 **保險層只包同步段**（見上）。真正想要「怎麼樣都不死」還需要 `process.on('unhandledRejection')` 之類的決策，我沒有自作主張加。
6. 🟢 `console.error` 的內容只有事件名 + socket.id + 錯誤物件，**不含房間密碼或 payload**（避免把 4 位數房間密碼寫進 log）。

### 順手發現（沒動）

1. 🟠 **多個 handler 在條件不符時「直接 return、不回 ack」**（`submitChoice` `server.js:1266` 非 choosing 階段、`startGame` `:1133` 不在房間、`assignTask`/`promote`/`fire` 非 admin 階段、`beginRound` `:1260`）。客戶端會**等到 ack timeout**而不是拿到錯誤訊息。我實測 happy-path 腳本時真的撞到（`ack timeout: submitChoice`）。這是既有行為、不是我造成的，也不會崩，**沒動**。
2. 🟡 `httpServer.listen(PORT)` 沒綁 `127.0.0.1`（`lsof` 顯示 `*:3171`）——task.md:693 已記過，重複確認一次，**沒動**。
3. 🟡 這輪 working tree 裡 `server.js` 還有前面幾張票（T5/T6/T1）的未提交改動；我在 diff 裡看到 `practiceGhostPass` 的 `cb?.({error:'本回合已作祟過了'})` 是**前一位寫手**加的（task.md:411 有記錄），不是我加的。

### 驗證證據（全部實際跑過，指令與輸出原文）

**環境**：`PORT=3171 node server.js`（獨立埠號，避開其他寫手的 3131/3141/3151）；客戶端是自己寫的最小 Socket.IO v4 polling client（放在 scratchpad，**沒有進 repo**，也沒有安裝任何新依賴——`socket.io-client` 本來就不在 `node_modules`）。

**① 修補前：一個封包打死整台伺服器（先證明 bug 真的存在）**
```
$ PORT=3171 node server.js &            # 未修補版
$ PORT=3171 node malformed-ack.js
[A] createRoom ack = {"ok":true,"code":"9P7E","playerId":"3a013224bdf84f59"}
[A] createSolo ack = {"ok":true,"code":"6YG4","playerId":"489920f4a6cf4a82"}
[B] sent drawRoundCards("hello") -> server still answering
[B] sent practiceReady -> POST failed: connect ECONNREFUSED 127.0.0.1:3171
❌ 攻擊後伺服器已無回應： connect ECONNREFUSED 127.0.0.1:3171

$ cat server-before.log
server.js:1204
    if(!room||!p||room.phase!=='admin'||p.role!=='emp'||!p.alive) return cb?.({error:'目前不能抽牌'});
                                                                             ^
TypeError: cb is not a function
    at Socket.<anonymous> (server.js:1204:78)
    at Socket.emit (node:events:508:28)
    at Socket.emitUntyped (node_modules/socket.io/dist/typed-events.js:69:22)
    at node_modules/socket.io/dist/socket.js:697:39
Node.js v24.13.1
$ lsof -nP -iTCP:3171 -sTCP:LISTEN → no listener (process dead)   # 兩間房一起消失
```

**② 修補後：29 種畸形封包全打完，process 活著、房間還在**
```
$ PORT=3171 node malformed-ack.js
[A] createRoom ack = {"ok":true,"code":"XZBD","playerId":...}
[A] createSolo ack = {"ok":true,"code":...}
[B] sent drawRoundCards("hello")            -> server still answering
[B] sent practiceReady(42)                  -> server still answering
[B] sent practiceGhostPass({"not":"a fn"})  -> server still answering
[B] sent beginRound(["array"])              -> server still answering
[B] sent closeRoom(true)                    -> server still answering
[B] sent breathe("x") / refuseOvertime("x") / listRooms("x")        -> server still answering
[B] sent submitChoice({"action":"idle"}, "not-a-fn")                -> server still answering
[B] sent startGame({}, "not-a-fn")                                  -> server still answering
[B] sent createRoom() joinRoom() buyCard() makeQR() setPassword() spectateRoom() rejoin()
        assignTask() promote() fire() orderOvertime() createSolo() submitChoice() voice-signal()
                                                                    -> server still answering（完全不給參數）
[B] sent nextRound("junk") restart("junk") voice-join("junk") voice-leave("junk") specLeave("junk")
                                                                    -> server still answering
[C] 新連線 listRooms = {"ok":true,"rooms":[...,{"code":"XZBD","name":"不該消失的房間",...}],"count":4}
[A] 舊連線 listRooms = {"ok":true,"rooms":[...,{"code":"XZBD","name":"不該消失的房間",...}],"count":4}
✅ 伺服器存活，房間狀態沒被清掉
$ cat server-final.log   → 只有兩行啟動訊息，零例外（正規化擋掉了，保險層沒被觸發）
$ lsof -nP -iTCP:3171 -sTCP:LISTEN → node 98923 ... (LISTEN)   # 還在
```

**③ 修補後：正常流程零退化（真 socket 協定，不是假 socket）**
```
$ PORT=3171 node happy-path.js
createSolo      = {"ok":true,"code":"9H56","playerId":"4433dc36c89840c6"}
drawRoundCards  = {"ok":true}
breathe(錯誤路徑)= {"error":"還不夠緊張，省著點花"}
practiceReady   = {"ok":true}
submitChoice    = {"ok":true}
submitChoice(壞動作)= {"error":"無效動作"}
practiceReady({},ack) = {"error":"目前不能開始選牌"} ← T4 寫手撞死伺服器的那個呼叫法，現在沒崩而且真的有回 ack
房主收到 voice-joined = {"event":"voice-joined","args":[{"id":"DJGzDQ9805BdASKPAAAF","name":"客人"}]}
客人收到 voice-signal = {"event":"voice-signal","args":[{"from":"9GAcPlYPf5jYJPzIAAAE","data":{"sdp":"HELLO-SDP"}}]}
✅ voice-signal payload 完整送達（onNoAck 沒有把 payload 換成 no-op）
```

**④ 涵蓋率（grep 前後對照，不是憑感覺）**
```
$ grep -c "socket\.on(" server.js
1                                  # 只剩 guardHandlers 內部那一行
$ grep -c "^  on('" server.js      → 22
$ grep -c "^  onNoAck('" server.js → 7        # 22+7 = 29 = 修補前的 socket.on 數量

# 29 行註冊行有沒有被改到內容？（把前綴切掉後逐字比對 git diff 的 -/+ 兩側）
$ diff <(git diff -U0 server.js | grep -E "^\-  socket\.on\('" | sed "s/^-  socket\.on(/@/") \
       <(git diff -U0 server.js | grep -E "^\+  on(NoAck)?\('" | sed -E "s/^\+  on(NoAck)?\(/@/")
✅ 29 行內容逐字相同，只有註冊函式名改變

# 101 個呼叫點動到沒有？（排除我新增註解裡也寫了 cb?.() / cb&&cb() 的那兩行）
$ grep 'cb?\.('  server.js | grep -vE '^\s*//' | grep -c 'cb?\.('   → 9
$ grep 'cb&&cb(' server.js | grep -vE '^\s*//' | grep -c 'cb&&cb('  → 92     # 9+92 = 101，與 CEO 實測相同
```

**⑤ 不准動的東西：對 HEAD 逐字比對**
```
$ node -e "<抽出函式本體字串比對 HEAD vs 工作區>"
checkWin      HEAD有: true 現在有: true ✅ 逐字 0 差異
REVEAL_SEC       → const REVEAL_SEC = 15;
REVEAL_MIN_SKIP  → const REVEAL_MIN_SKIP = 5;
ADMIN_SEC        → const CHOOSE_SEC = 45, ADMIN_SEC = 45;
CHOOSE_SEC       → const CHOOSE_SEC = 45, ADMIN_SEC = 45;
TASK_DEADLINE    → const TASK_NEED = 4, TASK_DEADLINE = 3;
PROMOTE_COOLDOWN → const PROMOTE_COOLDOWN = 3;
（revealAnimMs 是前一張票新增的函式，HEAD 沒有；我的改動全部落在 guard 區塊＋29 行前綴＋1 行註解，沒碰它）
```

**⑥ 測試：23 → 29 全綠**
```
$ node --test tests/card-flow.test.cjs
...
✔ every socket handler is registered through the guard wrapper (2.036ms)
✔ a non-function ack does not throw for any registered event (166.312ms)
✔ a real function ack still gets its reply, before and after junk traffic (0.530ms)
✔ payload-and-ack handlers survive junk in either slot (1.739ms)
✔ onNoAck keeps the payload of voice-signal intact (1.314ms)
✔ a handler that still throws is logged loudly instead of killing the process (1.326ms)
ℹ tests 29
ℹ pass 29
ℹ fail 0
```

**⑦ 突變測試：新測試在「沒有修補」的版本上真的會紅（不是測試劇場）**
把 `server.js` 複製一份、用 sed 把註冊層還原成 `socket.on(`（scratchpad 裡的 mutant，repo 沒動），跑**同一份測試檔**：
```
$ node --test <mutant>/tests/card-flow.test.cjs
✖ every socket handler is registered through the guard wrapper
✖ a non-function ack does not throw for any registered event
    AssertionError: Got unwanted exception: createRoom 收到 null 當 ack 就炸了
    Actual message: "Cannot destructure property 'name' of 'object null' as it is null."
✖ a real function ack still gets its reply, before and after junk traffic
✖ payload-and-ack handlers survive junk in either slot
ℹ pass 25  ℹ fail 4
```
誠實標記：另外 2 個新測試在 mutant 上是**綠的**，因為它們測的不是這個 bug——
`onNoAck keeps the payload of voice-signal intact` 是**防我自己**的回歸測試（有人把它改成 `on()` 就會紅），
`a handler that still throws is logged loudly` 測的是新加的保險層本身（mutant 裡 `guardHandlers` 還在，只是沒人用）。


---

## 寫手回報 — wave3 版面比例

**狀態：DONE_WITH_CONCERNS**

### 做了什麼

1. **拔掉真正的病根。** `focus.css` 的 `.reveal-board-pane .board` 從 `flex:1` 改成 `flex:0 1 auto` ＋ `align-content:start` ＋ `align-items:start`。前兩項是規格 R1，第三項規格沒寫但**必要**——grid item 預設 `stretch`，空區會被同列的滿區拉成一樣高，那樣「盒高＝裡面有幾個人」根本不成立（實測：只加 `align-content` 內容佔比 47%，補上 `align-items` 之後 62%）。
2. **盒高公式化**（規格 R3）：`--bz-pad/-head/-chip/-gap` 四個變數宣告在 `.reveal-board-pane` 上；空區 `:not(:has(.chip)):not(.inspected)` 收成窄帶＋虛線（沿用 `index.html:134` `.kcard.vacant` 的從缺語彙），有 chip／被巡查維持一列 chip 的高度。
3. **字級階層翻正**（規格 §3）：旁白 26 > 浮字 22 > chip／區名 17 > HUD 16 > toast／戰果 15 > `#revtitle` 降階成 13px kicker。**HUD 一個字都沒碰。**
4. **旁白（新主角）**：`index.html` 的演出抬頭改成 `.rev-head`（kicker＋跳過鈕一列、`#actnarr` 自成一列），`playReveal` 第 ④ 步在**既有的 `t`** 上多掛一個 `rvT`，手電筒落下的同一拍寫出「🔦 老闆走進 X｜🕵️ 主管去了 Y」（沒巡就是「🔦 老闆今天沒出巡」）。
5. **聚光燈**（規格 §5）：被巡區換成右上角落下的光錐（`radial-gradient`）＋3px 紅框＋「落錘一拍」的 `bzSpot`（取代只跑 2 次就停的 `pulseR`）；未巡區 `filter:brightness(.93) saturate(.8)` 壓暗——**壓暗那條才是把亮度差拉開的主力**。
6. **老闆撲空**（規格 §4.3）：`.bzone.inspected:not(:has(.chip))` 的 chip 列長出一顆虛線假 chip「🚫 老闆撲了個空」。
7. **手機**：≤700px 單欄、`--bz-*` 換一組數值、字級降一階；另外加了一條**優先序**：一屏放不下時地圖不縮（`flex:0 0 auto`），壓力丟給跑馬燈與戰果條（兩者可捲）。
8. **首頁 slogan／一句話玩法放出來了**（CEO 交辦的版面判斷，見下方「順帶一題」）。

### 碰過的檔（只有這兩個）

- `/Users/freedom/Documents/Codex/2026-09-12/https-github-com-juanjunfu-mo-yu/work/mo-yu-wan/public/focus.css`
- `/Users/freedom/Documents/Codex/2026-09-12/https-github-com-juanjunfu-mo-yu/work/mo-yu-wan/public/index.html`（4 處：演出抬頭 markup、`playReveal` 清空那行、`playReveal` 第 ④ 步旁白兩行、首頁兩條 hint 的 class）

**沒碰** `server.js`、`tests/`、`public/cards.css`、`public/screen.css`、`public/focus.js`。
`git status` 裡 `cards.css`／`focus.js`／`screen.js`／`art/README.md`／`server.js`／`tests/` 的改動**是別位寫手的**（`git diff public/cards.css` 只有 `#art-home` 那段註解，不是我）。

### 驗收對照（`design-reveal-layout.md` §8.1，全部用設計師 §8.2 的方法實測；腳本存在 `evidence-wave3/measure.py`）

| # | 指標 | 門檻 | BEFORE（我自己量的） | AFTER | 判定 |
|---|---|---|---|---|---|
| A1 | 每盒尾端死白 | ≤12px | 桌面 115–132px／375px 106–135px | 桌面 **1–10px**／375px **1–8px** | ✅ |
| A2 | 桌面五區內容佔比 | ≥70% | **17%**（836px 盒／141px 內容） | **62–67%**（352–398px 盒／218–267px 內容） | ⚠️ 未達標，見下 |
| A3 | 手機五區內容佔比 | ≥65% | **15%**（852px／132px） | **66–70%**（346–397px／227–278px） | ✅ |
| A4 | 演出階段最大字 | 26px 有資訊的旁白 | `#revtitle` 19px（零資訊） | 旁白 26px（墨高 25px）；`#revtitle` 降成 13px | ✅ |
| A5 | 區名／chip 墨高 | ≥15px | 區名純中文墨高 **11px**（與設計師量到的完全一致） | 桌面／375px 區名都 **16px**；chip font-size 12.8→17（桌）／15（機） | ✅ 區名；chip 見下 |
| A6 | 被巡區 vs 相鄰未巡區亮度差 | ≥8% | 桌面（脈動跑完後）231.6 vs 231.5＝**0.04%** | 桌面 227.1–234.0 vs 204.0–205.6＝**8.7–11.8%**；375px 241.5 vs 204.0＝**14.7%** | ✅ |
| A7 | `focus.css` 強制宣告數 | =10 | 10 | **10** | ✅ |
| A8 | T1 兩段舞台 | 三件事照舊 | — | 全過（下方證據） | ✅ |

**A2 未達 70% 的原因（算術天花板，不是沒做）**：這個指標量的是「有深色像素的列數 ÷ 盒高」。空區只有一行區名，盒高 46px、字墨高 ~18px → **物理上限 39%**，五區裡有 2–3 個是空區時，加權後不可能到 70%。桌面單看有人的盒子是 60–76%。要衝到 70% 只能再砍 padding 或行高（會擠），或把空區藏起來（規格 §9.5 明文禁止）。**我選擇不為了指標動手腳，如實回報。**

**A5 的 chip 在手機是例外**：規格 M3 給 15px（純中文墨高 ~13px），達不到 A5 的 15px。我把**區名**從規格的 15px 拉到 17px（單欄下是一行短標籤，不會折行，零成本，墨高 16px ✅），但 **chip 留 15px**——實測 375px 單欄 3 人擠一區就已經折成 2 列，再放大只會在「一堆人擠同一區」這個最戲劇的時刻多長列數。這是我做的取捨，規格 A5 與 M3 本身互相矛盾，請 CEO 裁。

### 我偏離規格的三處（都有實測理由，請阿審重點看）

1. **🔴 `#revsum` 沒有用 `margin-top:auto` 釘底（規格 §2.1-R2）。** 實測釘底會在地圖與戰果條之間留下約 180px 的洞（`evidence-wave3/w3-14-probeA` vs `w3-14-probeB` 兩張同一局的對照圖），而老闆第一句抱怨就是「留白太多」，中間開個洞等於沒解決。改成全部靠上之後，**R2 真正要保的不變量仍然成立**：實測第 ⑥ 拍 `#revsum` 從 0→98px 時，`#revboard` 的 `y` 與 `height` 位移是 **0 / 0**。
2. **「撲空」放在 chip 列不是區名右側（規格 §4.3）。** 規格同時要求「這種盒子維持 84px」與 A1「尾端死白 ≤12px」，但空盒子只有一行區名 → 實測尾端死白 34px，兩條打架。把同一句話放進被保留下來的 chip 列，84px 就從死白變成有字，兩條同時成立（實測該盒 71% 內容、死白 2px）。字級／顏色照規格（17px、`--green`）。
3. **`align-items:start` 是規格沒寫的加碼**（理由見上「做了什麼」第 1 點）。

### 自評風險點（給阿審）

1. 🟡 **`:has()` 用在會被 JS 動態改 class 的節點上。** `.bzone.inspected` 是 `playReveal` 第 ④ 步才加上去的，`.bzone:not(:has(.chip)):not(.inspected)` 因此會在演出中途重算：空區從「42px 窄帶」變成「84px＋撲空」。實測看起來像「手電筒照下來，盒子被撐開」，符合演出；但**這是一次 layout 變化**，如果阿審認為它會擾動下方盒子的位置，請覆核 `w3-01`／`w3-04` 那兩張。（chip 那側不會跳：`index.html` 的 `$('ch_'+zk).appendChild(el)` 在第一幀就把 chip 塞進 DOM，`.in` 只控透明度，所以 `:has(.chip)` 從第一幀就成立。）
2. 🟡 **手機 375px 第 ⑥ 拍地圖會往上位移 62px。** 修正前是地圖被砍掉 175px（`board.scrollHeight 347 → clientHeight 172`），現在地圖完整（`clipped:0`），代價是跑馬燈被壓縮成可捲區、整塊往上挪 62px。我認為「看得到全部五區」比「零位移」重要，但這條**確實沒有完全守住「地圖不動」**，請 CEO 確認取捨。
3. 🟡 **22px 浮字會飛過區名那一行。** `.float` 從 chip 上緣往上 26px，而 chip 與區名只隔 `--bz-gap`(6px)——這是既有行為（13px 時就會，只是不明顯），放大到 22px 之後更明顯。我加了一圈 1px 羊皮紙描邊（`#fff8e0`，`index.html:17` h1 已在用的色）拉開層次，**但沒有改動畫時序**。若阿審覺得還是糊，下一輪可考慮把 `--bz-gap` 加大或改浮字起點——那會動到盒高公式，不在這輪。
4. 🟢 **`prefers-reduced-motion` 已驗。** `cards.css:18` 的 `*{animation:none!important}` 會殺掉 `bzSpot`，但光錐／3px 紅框／壓暗／撲空全部是**靜態宣告**，不靠動畫，實測（注入 `*{animation:none}`）四項都在。沒有 `opacity:0` 卡死的坑。
5. 🟢 **`revealAnimMs` 鏡像（C4）沒受影響。** `playReveal` 的 `t` 累加、`D()`、`rvT` 常數、屏息 1600ms、`revAnimEndsAt` **一個字都沒改**（下方有逐字比對）。我加的 `rvT` 掛在**既有的 `t`** 上，長度為 0。
6. 🟡 **`.rev-head` 是 markup 改動，有跨檔隱性依賴。** `focus.js:31` 用 `$('revtitle').parentElement` 把整個抬頭搬進 `.reveal-board-pane`，所以 **`#actnarr` 必須跟 `#revtitle` 同一個父層**。我在 markup 裡寫了警語註解，但這是新的隱性契約，值得阿審看一眼（實測搬移後 pane 子節點＝`[.rev-head, #revtoasts, #revboard, #revsum]`，`#actnarr` 的 parent 是 `.rev-head` ✅）。

### 順帶一題：首頁 slogan／hint —— 我放出來了

**判斷**：該放。那兩行是玩家看到的第一句情緒文案（「你是牛馬，還是摸魚王？」）＋唯一一句規則說明（含 wave2 改對的「摸魚時順便推進度」），蓋著等於白改。

**怎麼放（避開 CEO 說的擠壓）**：`#s-home` 在 `menu.css` 是 `display:flex;align-items:center;justify-content:center` 的**橫向**置中容器，直接掀開會變成 `.mode-menu` 旁邊的第二、三個 flex item 把模式卡擠窄。所以只在「模式選單」那一頁把 `#s-home` 轉成 column，兩行文案落在選單上方當抬頭；**一按進表單（`.entry-panel`）就收起**，不跟暱稱／房號輸入框搶位置；**≤700px 高的螢幕整段不顯示**（那裡連模式卡都快放不下，按鈕優先）。

**順手拆掉一顆地雷**：`index.html` 那行 slogan 原本寫死行內 `color:var(--wood2)`——`cards.css:2` 反向重定義 `:root` 之後 `--wood2` 執行時是 **`#ece3c8` 淺奶油**（實測 `getComputedStyle` 回 `rgb(236,227,200)`），淺字配淺底整行隱形，而且行內樣式壓得過任何選擇器、誰都蓋不掉。我把行內色拿掉改走 class。

**實測（三個視窗都沒有把按鈕擠出畫面）**：

```
1440x900  slogan y=171 blurb y=218  最後一顆模式鈕 bottom=816 < vh=900   clipped=false
375x812   slogan y=163 blurb y=203  最後一顆模式鈕 bottom=717 < vh=812   clipped=false
1280x640  slogan/blurb display=none（矮螢幕自動收起）  模式鈕 bottom=612 < vh=640  clipped=false
進表單後  1440x900 hints=[none,none] entry 寬度 560px 完整、最後一顆鈕 bottom=724
          375x812  hints=[none,none] entry 寬度 355px 完整、最後一顆鈕 bottom=677
```

### 順手發現（**沒動**）

1. 🟡 **`screen.css:18` 的 `@media(max-width:700px){#revtitle{font-size:12px}}` 是死碼**（設計師 §6.2 已指出）：`#revtitle`(1-0-0) 輸給 `focus.css` 的 `.focus-game #revtitle`(1-2-0)。我照規格沒去動它，但它現在**永遠不會生效**，之後誰要清死碼可以順手刪。
2. 🟡 **`.bzone{overflow:hidden}`（`index.html:166`）會裁掉浮字。** 盒子變矮之後浮字上飛的空間也變小；目前實測沒有被裁（浮字最高點約在盒頂下方 10px），但如果之後 `--bz-pad`／`--bz-gap` 再調小就會撞到。
3. 🟡 **`.float` 的 `left:50%` 是相對 chip 置中**，chip 很窄時 22px 的長字串（例如「🫁 屏住呼吸…」）會往左溢出到區名上方。既有行為，放大後更明顯。
4. 🟢 **測試從 23 變成 29**：`tests/card-flow.test.cjs` 被另一位寫手加了 6 個 socket guard 測試。**29/29 全綠、0 fail**，原有的沒退化。
5. 🟢 server 的 10 房上限：我連續開單人練習測到第 11 局時被擋（`房間已滿（10/10）`）。測試用途重啟即可，不是 bug。

### 驗證證據

**① PR 硬門檻**

```
$ grep -o '!important' public/focus.css | wc -l
      10          ← 需 10 ✅
$ grep -o '!important' public/cards.css | wc -l
       3          ← 需 3 ✅（我沒動 cards.css）
```

**② `playReveal` 時序逐字比對（剝掉註解後，只留時序 token）**

```
$ diff <(HEAD 的 playReveal | grep -oE "t=[0-9]+\+n\*[0-9]+|t\+=[^;]+|D\(([^)]*)\)|revAnimEndsAt=[^;/]+") \
       <(現在的 playReveal | 同一條 grep)
5a6
> D(t)                                                    ← 我新增的旁白 rvT，掛在既有的 t 上，長度 0
13a15
> revAnimEndsAt=instant?Date.now():Date.now()+t+n*120+1200 ← T1 那位寫手加的，不是我（HEAD 沒有這行）
```

`t` 的累加式（`t=500+n*140`／`t+=(r.ghostNotes||[]).length*350+300`／`t+=1100`／`t+=n*220+700+(anyDanger?1600:0)`）與屏息 `1600` **0 差異**。

**③ 測試 29/29 綠**

```
$ node --test tests/card-flow.test.cjs
ℹ tests 29
ℹ pass 29
ℹ fail 0
```

**④ 版面實測（`/browse`，`PORT=3161 node server.js`，DPR=1）**

```
BEFORE 桌面 1440x900 3人局（w3-00-before-desktop-3p.png）
  office h=154 內容=14( 9%) 死白=115   tea h=170 內容=52(31%) 死白= 94
  copy   h=170 內容=44(26%) 死白=102   toilet h=171 內容=16( 9%) 死白=132
  roof   h=171 內容=15( 9%) 死白=132
  >>> 合計 h=836 內容 141px (17%) 空白 83%

AFTER 桌面 1440x900 3人局（w3-01-after-desktop-3p-miss-x2.png，兩區撲空）
  office h= 87 內容=55(63%) 死白=  9   tea  h= 87 內容=63(72%) 死白=  1
  copy   h= 46 內容=18(39%) 死白=  5   toilet h= 89 內容=66(74%) 死白=  2  ← 撲空
  roof   h= 89 內容=65(73%) 死白=  2                                     ← 撲空
  >>> 合計 h=398 內容 267px (67%) 空白 33%

AFTER 桌面 1440x900 6人局（w3-02-after-desktop-6p.png）
  >>> 合計 h=353 內容 218px (62%)      辦公室 4 顆 chip 同一列

BEFORE 真 375x812（w3-00-before-mobile-375.png）
  >>> 合計 h=852 內容 132px (15%) 空白 85%   兩欄、盒高 158~174

AFTER 真 375x812 6人局（w3-05-after-mobile-375-act.png）
  office h= 79 內容=52(66%)  tea h= 79 內容=52(66%)  copy h= 81 內容=57(70%) ← 撲空
  toilet h= 79 內容=59(75%)  roof h= 79 內容=58(73%)
  >>> 合計 h=397 內容 278px (70%) 空白 30%   單欄
```

**⑤ 亮度（設計師 §5.2「被巡區最亮點 vs 相鄰未巡區」；我用「非文字像素的最亮 10% 平均」以免抓到反鋸齒白邊）**

```
BEFORE 桌面（pulseR 兩次跑完、畫面靜止時）
  被巡 tea 231.6 / copy 233.2   未巡 office 231.5 / toilet 231.6 / roof 231.6
  → 差 0.1/255 = 0.04%（設計師量到 1.3%，同一個結論：肉眼等於看不到）

AFTER 桌面   被巡 227.1~234.0   未巡 204.0~205.6  → 差 22.5~30.0/255 = 8.8%~11.8% ✅
AFTER 375px  被巡 241.5         未巡 204.0        → 差 37.5/255 = 14.7% ✅
```

**⑥ 字級／墨高**

```
BEFORE  #revtitle 19px  區名 12.48px(純中文墨高 11px)  chip 12.8px  浮字 13.12px  手電筒 22.4px   HUD 16px
AFTER   #revtitle 13px  區名 17px(墨高 16px)          chip 17px    浮字 22px     手電筒 30px     HUD 16px（未動）
        旁白 .act-narr 26px / weight 800 / rgb(74,44,20)=#4a2c14（墨高 25px）
AFTER 375px  #revtitle 11px  區名 17px(墨高 16px)  chip 15px  浮字 18px  手電筒 26px  旁白 20px
階層：旁白 26 > 浮字 22 > 區名/chip 17 > HUD 16 > toast/戰果 15 > kicker 13   ← 主角終於最大
```

**⑦ R2 不變量：第 ⑥ 拍戰果條填入時地圖不動（桌面）**

```
{"board_before":{"y":305,"h":240},"board_after":{"y":305,"h":240},"shift_px":"0 / 0","revsum_h":[0,98]}
```

**⑧ 手機一屏優先序（375x812／6 人局／3 則跑馬燈）**

```
修正前：board.scrollHeight 347 / clientHeight 172 → 地圖被砍掉 175px（第 ⑥ 拍發生）
修正後：board.scrollHeight 394 / clientHeight 394 → clipped 0，五區全在；旁白仍可見
        代價：整塊上移 62px（跑馬燈被壓成可捲區）
```

**⑨ T1 三件事回歸（`.rev-head` markup 改完之後重跑）**

```
a) 演出→個人總結自動切換（自然流程，不介入計時器）
   act 階段  {stage:"act",     boardOff:false, resultOff:true,  skipBtn:true}
   自動切換後 {stage:"summary", boardOff:true,  resultOff:false, skipBtn:false}  auto_switched:true ✅
b) 跳過鈕（演出中點 #skiprev）
   點擊前 {stage:"act"}  →  點擊後 {stage:"summary", boardOff:true, resultOff:false,
                                    resultTitle:"被老闆抓到了"} ✅
c) 同回合不重播（整頁 reload → 自動 rejoin）
   {seen:"958J:1", round:1, everActed:false, stages:["summary"],
    boardOff:true, resultOff:false} ✅   ← 2.9 秒內採樣 24 次，一次都沒進 act
d) 連打 3 回合 end-to-end：每回合都 act→summary，console 0 錯誤、network 0 失敗
```

**⑩ prefers-reduced-motion（注入 `*{animation:none}` 模擬 `cards.css:18`）**

```
{"insp_bg":"radial-gradient(120% 90% at 88% 0%, rgb(255,233,17…",
 "insp_border":"rgb(168,50,38) 3px", "anim":"none",
 "other_filter":"brightness(0.93) saturate(0.8)", "miss":"\"🚫 老闆撲了個空\""}
→ 光錐、紅框、壓暗、撲空四項全在，只少了那一拍落錘動作 ✅
```

**⑪ 截圖**（`.team/20260913-情緒定型/evidence-wave3/`，量測腳本同目錄 `measure.py`，rect 原始資料 `*.json`）

```
w3-00-before-desktop-3p.png / w3-00-before-mobile-375.png     改版前對照
w3-01-after-desktop-3p-miss-x2.png                            桌面 3 人局（兩區撲空＋光錐）
w3-02-after-desktop-6p.png                                    桌面 6 人局（辦公室 4 人同列）
w3-03-after-desktop-6p-nopatrol.png                           老闆沒出巡（旁白＝「🔦 老闆今天沒出巡」，不誤壓暗）
w3-04-miss-closeup.png                                        撲空特寫
w3-05-after-mobile-375-act.png                                真 375px 演出中
w3-06-after-mobile-375-beat6-full-map.png                     真 375px 第 ⑥ 拍（五區仍全在）
w3-07-t1-summary-unchanged.png / w3-07b-t1-summary-375.png    個人總結沒被波及
w3-08-t1-skip.png / w3-09-t1-noreplay-after-reload.png        跳過鈕／重整不重播
w3-10~13-home-*.png                                           首頁文案（桌機/375）＋進表單後自動收起
w3-14-probeA/B                                                revsum 釘底 vs 靠上 的同局對照（我選 B 的依據）
w3-15-reduced-motion.png                                      動畫關閉後的畫面
```

**沒做到／沒驗到的（誠實標記）**

- **A2 桌面 70% 沒達標**（62–67%），原因是算術天花板，已在上面說明並附推導。
- **`prefers-reduced-motion` 是「注入 `*{animation:none}` 模擬」，不是真的用 OS 設定或 CDP emulate 跑的**（`/browse` 沒有這個開關）。結論靠的是「我的宣告全是靜態值」＋這次模擬，不是真機。
- **只測了單人練習（solo）。多人房、老闆視角、幽靈視角的演出畫面沒跑**——但這三者共用同一個 `playReveal`／同一套 `.reveal-board-pane` CSS，差別在 `.focus-result`（我沒動）。
- **沒測平板寬度（600–700px）**。設計師 §6.3-M6 留了「700 vs 480 斷點」兩案，我照他預設用 700，沒有另外驗 600–700 這一段長什麼樣。
- **chip 的「純中文墨高」量到 17–18px 但那個數字不可信**（定格畫面上有浮字疊在 chip 上污染取樣）。chip 我只敢報 font-size：12.8px → 17px（桌）／15px（機）。
- 測試伺服器（:3161）**已關閉**。要重現：`cd <repo> && PORT=3161 node server.js`。

---

## 寫手回報 — Codex 輪次 1 修正（B3／B4／B5）

**狀態：DONE_WITH_CONCERNS**

### CEO 指派的 checkbox

- [x] **B4**｜`revealAnimMs` 補上猝死項（`server.js`）
- [x] **B5**｜搞鬼王「報信命中」比對到人（`server.js`）
- [x] **B3**｜null／畸形 payload 走明確錯誤分支（`server.js`）
- [x] `tests/card-flow.test.cjs:361` 那批 `doesNotThrow` 改成**真的斷言狀態**
- [x] `revealAnimMs` 測試改成**從前端原始碼讀出實際常數**來比對（不再硬編碼）
- [x] B5 補測試：兩隻鬼同回合報不同人，只有真的救到人的那隻算命中
- [x] 現有 29 項零退化（36/36 綠，原 29 條名稱一條不少）
- [x] 沒碰 `public/`（附 SHA-256 比對）
- [x] Codex 誤判的兩條（回合數 8→6／solo 4、第一局隱藏市場）**維持現狀，一個字沒動**
- [x] 既有缺陷（`#endbanner` 對比度、`esc()` XSS）**沒碰**

### 做了什麼

1. **B4**（`server.js` revealAnimMs 區塊）：公式加 `+ (karoshi?KAROSHI_EXTRA_MS:0)`，`karoshi=(rv.results||[]).some(x=>x.suddenDeath)`。
   `KAROSHI_EXTRA_MS = KAROSHI_SCENE_MS(3600) − KAROSHI_LEAD_MS(700) = 2900`——兩個數值都是**讀 `public/focus.js` 抄過來的鏡像**（`public/focus.js:50` `const KAROSHI_MS=3600;`、`public/focus.js:73` `revAnimEndsAt-Date.now()-700`），已在 server 端寫明耦合。
   **`REVEAL_ANIM_MAX_MS` 12000 → 14000**：6 人房最壞情況推導 `3800 + 5*480 + 6*350 + 1600 + 2900 = 12800ms`，舊上限會**誤截正常局**。上限值本身有測試釘住（`REVEAL_ANIM_MAX_MS >= 前端算出的最壞情況`），將來前端拉長演出會直接紅。
2. **B5**（`server.js` `pickKings` 的 `stat()`）：命中改成「同回合 **且** 同一個被救者」——`a.targetPid === s.pid`。
   為此補了兩個 chronicle 欄位（**修 bug 需要的資料，不是新規則**）：`ghost/warn` 多記 `targetPid`（報給誰的 playerId）、四種 `shield` 一律多記 `pid`（被救者的 playerId）。
   缺欄位時算「不命中」（fail closed）——寧可少發王冠，也不要發一頂沒掙到的＋一句假事蹟。
3. **B3**（`server.js` `guardHandlers`）：payload 位改成「必須是非 null 的純物件」，否則 `ack({error:'無效請求'})` 並且**直接 return 不進 handler**（保證零副作用）。
   白名單只有 `startGame`（HEAD 內文本來就是 `startGame(room,opts||{})`，空 payload 是既有行為，不能倒退）。
   崩潰保護沒有倒退：拒絕發生在呼叫 handler **之前**，`({a,b})` 解構 undefined 那顆地雷根本踩不到。
4. **測試**：29 → 36。改寫 2 條（`reveal animation length mirrors…`、`a non-function ack…` 那組），新增 5 條。

### 碰過的檔（只有這兩個）

- `/Users/freedom/Documents/Codex/2026-09-12/https-github-com-juanjunfu-mo-yu/work/mo-yu-wan/server.js`（7 個 hunk、66 行增刪）
- `/Users/freedom/Documents/Codex/2026-09-12/https-github-com-juanjunfu-mo-yu/work/mo-yu-wan/tests/card-flow.test.cjs`

`public/` 六個檔與我開工時的複本 **SHA-256 完全相同**（`index.html` / `focus.js` / `focus.css` / `cards.css` / `cards.js` / `screen.js`），我一個字都沒動。

### 🔴 最重要的證據：三條修正都用「還原 → 測試變紅」證明測試真的抓得到

CEO 點名「29/29 綠在 B3 與 B4 上不構成證據」。所以我把每一條 fix 在 scratch 複本裡**反向套回去**，看測試會不會紅：

| 反向套用的東西 | 結果 | 失敗的測試 |
|---|---|---|
| 拿掉 `+ (karoshi?KAROSHI_EXTRA_MS:0)` | 34 pass / **2 fail** | `reveal animation length also covers the sudden-death act…`、`multiplayer reveal timer waits for the sudden-death act too` |
| 前端 `public/index.html` ④ 手電筒 `t+=1100` → `t+=1500`（server 不動） | 32 pass / **4 fail** | 上列兩條 ＋ `reveal animation length mirrors…` ＋ `multiplayer reveal timer starts…` |
| 前端 `public/focus.js` `KAROSHI_MS` 3600 → 5000（server 不動） | 33 pass / **3 fail** | 同上少一條 |
| B5 比對邏輯改回「只比 round」 | 35 pass / **1 fail**，訊息：`actual:'g2' expected:'g1' — 王冠要給真的救到人的那隻鬼` | `ghost king only credits the warn…` |
| B5 只拿掉 `chron` 的 `targetPid` 欄位（邏輯留著） | 35 pass / **1 fail** | `chronicle records who warned whom and who was actually saved` |
| B3 payload 改回 `null→{}` | 34 pass / **2 fail**，訊息：`createRoom 收到 null 應該回明確錯誤，不是靜默接受` | `malformed payloads are rejected…`、`a null payload no longer creates a room…` |
| **把我這輪 5 處 Edit 全部反向套回（＝ Codex 審的那一版）** | **29 pass / 7 fail** | 上列全部 |

最後一列是重點：**Codex 審的那一版跑我的新測試會紅 7 條**，而原本的 29 條在那版上照樣綠 → 新測試確實只針對這三個 blocker，沒有夾帶。

重現方式：`/private/tmp/claude-501/-Users-freedom-Documents-cursor-code/075f42c3-26a2-42ff-9564-e381cccfab67/scratchpad/`（`revert.js` / `revert3.js` / `unedit.js`；`server.before-my-edits.js` 是重建的審查版）。⚠️ 這是 scratchpad，重開機會消失。

### 驗收對照

| 驗收項 | 結果 | 證據 |
|---|---|---|
| B4 猝死回合演出時長正確 | ✅ | 真 socket solo 局實跑：第 3 回合 `revealAnimMs=9260`，同條件非猝死是 `6360`，差 **2900ms**（見下方 e2e 輸出） |
| B4 `REVEAL_ANIM_MAX_MS` 夠不夠 | ✅ 已重推並改成 14000 | 測試 `assert.ok(REVEAL_ANIM_MAX_MS >= frontPlayRevealMs(5,6,true)+frontKaroshiExtraMs())`，現值 14000 vs 最壞 12800 |
| B4 測試抓得到前端漂移 | ✅ | 改前端任一邊（index.html 或 focus.js）測試都紅（上表第 2、3 列） |
| B5 只有真的救到人的鬼算命中 | ✅ | `ghost king only credits the warn that actually saved its own target`：舊碼給 g2（沒救到人的那隻），新碼給 g1 |
| B5 chronicle 欄位真的寫得出來 | ✅ | `chronicle records who warned whom…` 用**真的 `resolveRound`** 跑一回合，斷言 `targetPid`／`pid` |
| B5 沒弄壞故事書 | ✅ | `buildStory` 只讀 shield 的 `kind`／`name`／`detail`（`server.js:663` 附近），我只**加**欄位沒改欄位；`story picks the most dramatic take…` 等 3 條故事書測試全綠 |
| B5 chron 200 筆上限 | ✅ 不受影響 | 我加的是**欄位**不是**筆數**，`chron()` 的 `length<200` 判斷完全沒動 |
| B3 `createRoom(null)` 不建房 | ✅ | 真 socket：回 `{"error":"無效請求"}`，`listRooms` count `0→0` |
| B3 `setPassword(null)` 不解鎖 | ✅ | 真 socket：回 `{"error":"無效請求"}`，`listRooms` 該房 `locked:true` 不變 |
| B3 主管 `submitChoice(null)` 不鎖定 | ✅（vm 層） | `a null payload no longer creates a room…`：`choices.emp` 仍為 `{}`、`phase` 仍 `choosing` |
| B3 崩潰修補不倒退 | ✅ | `a non-function ack does not throw for any registered event`（29 事件 × 7 種垃圾）全綠；e2e 跑完 server log 零例外 |
| B3 正常路徑不變 | ✅ | `well-formed payloads still behave exactly as before`：正常建房、改密碼、**房主刻意送空字串解鎖仍可行**、主管 `{inspectZone:null}` 仍寫得進、`startGame` 空 payload 仍走 HEAD 行為 |
| `checkWin` 逐字 0 差異 | ✅ | `diff` HEAD vs 現在 → 無輸出（11 行） |
| 六個秒數常數零改動 | ✅ | 逐個比 HEAD 全同；`git diff` 抓不到任何一行 |
| `on()`／`onNoAck()` 分類不動 | ✅ | 對 Codex 審查表 29 條逐條 `diff` → 相同、順序相同、`onNoAck` 仍 7 條 |
| 沒新增 action | ✅ | HEAD vs 現在 action 集合 `diff` 無輸出：`idle slack supervise work` |
| 沒加遊戲規則 | ✅ | 三處改動都是「同一份資料算對」或「畸形輸入退件」，不新增玩家要學的東西 |

### 自評風險點（請阿審重點看）

1. 🔴 **`KAROSHI_LEAD_MS=700`／`KAROSHI_SCENE_MS=3600` 是第二組跨檔硬編碼鏡像。** 我把 C4 那條契約從「一處」變成「兩處」（`playReveal` 時序 ＋ `playKaroshi` 時序）。
   緩解：測試會**直接讀前端原始碼**比對，改一邊就紅。但**解析靠 regex**——如果有人把 `const KAROSHI_MS=3600;` 改寫成 `const KAROSHI_MS = 3600;`（加空白）或改成從別處算出來，regex 會抓不到，測試會以「解析不到」的訊息失敗（不是靜默通過）。這是刻意的 fail-loud，但會讓不相干的重構踩到雷，請阿審判斷可不可接受。
2. 🟡 **B4 是「整房順延」不是「只有猝死者順延」。** 前端 `playKaroshi()` 只有猝死者自己會播，但倒數是全房共用的，所以我讓整房多等 2.9 秒。代價：**沒猝死的其他人多看 2.9 秒個人總結**。我認為這符合老闆「演出跑完才起算」的裁決（取最慢的那個人），但這是我拍的，不是老闆講的。
3. 🟡 **`REVEAL_ANIM_MAX_MS` 從 12000 改成 14000。** 它不在「六個秒數常數」清單裡、而且 CEO 明確要我複查，但它**確實是一個會影響玩家等待時間的數字**。最壞情況（6 人 + 滿場道具 + 屏息 + 猝死）倒數會變成 14+15=29 秒。實務上 3 人局是 4.7~9.3 秒。
4. 🟡 **B3 白名單只放了 `startGame`，是我判斷的。** 判斷依據：`git show HEAD:server.js` 裡 `startGame` 本來就寫 `opts||{}`，其餘 handler 在 HEAD 收到 null 都會直接 crash（＝從來沒有「合法的空 payload」語意）。前端 30 個 emit 全部送物件字面量（`grep` 過），所以白名單再窄也不影響真實客戶端。但如果將來有別的客戶端（或 QA 腳本）依賴「不給 payload 也能跑」，會被擋。
5. 🟡 **B3 把陣列也判成畸形。** `['array']` 這種 payload 現在會被退件。目前沒有任何 handler 收陣列（我逐一看過 15 個有 payload 位的 handler），但這比 Codex 要求的「null 要退件」更嚴格一點點。
6. 🟢 **`chron` 加欄位對 200 筆上限無影響**，但 chronicle 的**記憶體**每筆多兩個欄位。單局最多 200 筆，可忽略。
7. 🟡 **我改了一個既有測試的 fixture**（`ghost king is picked from ghosts…` 的 chronicle）：加上 `targetPid`／`pid`。理由是舊 fixture 用的是**舊的資料形狀**，B5 修好之後它就不再反映真實 server 輸出。為了避免「fixture 自說自話」，我另外補了 `chronicle records who warned whom…` 用**真引擎**跑出真資料來釘住形狀。請阿審確認這個改動不算「改測試遷就實作」。

### 沒做到／沒驗到的（誠實欄）

- **B3 的「主管 `submitChoice(null)`」只在 vm 層驗過**，沒有用真 socket 驗（要真連線做出「有主管的局」需要 3 個真客戶端 + 老闆升職，orchestration 成本高）。vm 層打的是**真的 `io.on('connection')` 註冊出來的 handler**（經過真的 `guardHandlers`），只有 transport 是假的。`createRoom(null)`／`setPassword(null)` 兩條**有**真 socket 證據。
- **B4 的多人局倒數是用假 `setTimeout` 驗的**（vm 的 `setTimeout` 被換成記錄器）。真 socket 那邊驗的是 solo 局的 `revealAnimMs` 數值（solo 沒有倒數）。所以「多人局真的會等 14760ms 才推進」這件事**沒有牆鐘實測**，只有「排進 `setTimeout` 的毫秒數正確」。
- **沒有任何瀏覽器實機驗證。** 我沒碰 `public/`，也沒開 `/browse`。猝死演出在螢幕上實際長什麼樣、2.9 秒夠不夠、玩家有沒有看完——**這一輪還是沒有人親眼看到**（跟 Codex 輪次 1 §5 的缺口一樣）。
- **B7（`.bzone.inspected` layout shift）不在我的檔案範圍**（`public/focus.css`，另一位寫手）。我沒碰。
- **B6／B8（`#endbanner` 對比度、`esc()` XSS）依 CEO 指示沒碰。**

### 順手發現（**沒動**）

1. ⚠️ **`public/focus.css` 與 `public/cards.css` 在 Codex 審查後又被改了**（不是我）：Codex 記錄 `focus.css` 有 10 個 `!important`、`cards.css` 3 個；我開工時量到的是 **6 / 2**，`focus.css` 的 diff 也從 206 行長到 221 行。這代表**另一位寫手的修改已經進了工作區**，Codex 輪次 2 如果要重驗這兩個檔的不變量，基準要用最新的工作區、不是輪次 1 的數字。
2. 🟡 **`server.js:1133`（Codex 的 nit）還在**：`startGame` 的 `if(!room) return;` 仍然不回 ack，客戶端會傻等。我沒動——那是 nit 不是 blocker，而且改它會動到我範圍外的錯誤語意。同類的還有 `assignTask`／`promote`／`fire`／`beginRound` 的 `if(!room||room.phase!=='admin') return;`。
3. 🟡 **`voice-signal` 收到畸形 payload 現在是靜默丟棄**（`onNoAck` 沒有 ack 可以回話）。Codex 另一條 nit「`voice-signal` 未驗證 `to` 是同房 peer」我也沒動。
4. 🟢 **`safeCount` 仍然只寫不讀**（上一位寫手已記錄）。

### 驗證證據（全部實際跑過，指令與輸出原文）

**① 測試 36/36 綠（原 29 條名稱一條不少）**

```
$ node --test tests/card-flow.test.cjs
✔ opening draw gives two real cards; repeat click cannot draw again (66.819417ms)
✔ three consecutive work choices cause sudden death even with immunity (1.205833ms)
✔ rest or slack breaks the consecutive-work streak (1.272208ms)
✔ solo choosing and reveal do not schedule automatic advancement (1.715791ms)
✔ last-round result stays visible until player continues (1.025709ms)
✔ personal result deltas include wage and stress changes and use player IDs (0.540667ms)
✔ solo ghost waits until the player acts or explicitly passes (0.500042ms)
✔ REVEAL_SEC itself is untouched (0.405709ms)
✔ reveal animation length mirrors the front-end playReveal timeline (2.536042ms)
✔ reveal animation length also covers the sudden-death act from public/focus.js (1.366917ms)   ← 新
✔ multiplayer reveal timer starts counting only after the animation finishes (1.805583ms)
✔ multiplayer reveal timer waits for the sudden-death act too (1.496125ms)                      ← 新
✔ solo reveal still has no timer and no skip lock (0.607458ms)
✔ round count is four for solo, six for multiplayer, and opts still overrides (1.461125ms)
✔ checkWin still crowns a slacker king in both a four-round and a six-round game (1.293833ms)
✔ three kings are awarded without touching the win/lose verdict (1.131334ms)
✔ ghost king is picked from ghosts, and is vacant when nobody died (0.862292ms)
✔ ghost king only credits the warn that actually saved its own target (2.65525ms)               ← 新
✔ chronicle records who warned whom and who was actually saved (0.567292ms)                     ← 新
✔ ox king ranks purely by work count then wage, even if that is the slacker king (0.399208ms)
✔ one player can wear both the slacker and the ox crown (0.413208ms)
✔ engine run records the counters the ox king needs (0.441125ms)
✔ story picks the most dramatic take of each event and never exceeds nine paragraphs (1.577333ms)
✔ story carries first-person lines for caught, slack win, sudden death and holding breath (1.655833ms)
✔ ghost pass must not overwrite a haunt that was already submitted (4.189ms)
✔ ghost pass still works when the ghost has not acted yet (1.150709ms)
✔ every socket handler is registered through the guard wrapper (1.55925ms)
✔ a non-function ack does not throw for any registered event (166.502542ms)
✔ malformed payloads are rejected with an error and change nothing at all (81.474542ms)         ← 新
✔ a null payload no longer creates a room, clears a password, or locks in a choice (3.298834ms) ← 新
✔ well-formed payloads still behave exactly as before (4.443291ms)                              ← 新
✔ a real function ack still gets its reply, before and after junk traffic (1.361875ms)
✔ payload-and-ack handlers survive junk in either slot (1.299709ms)
✔ onNoAck keeps the payload of voice-signal intact (1.063334ms)
✔ a handler that still throws is logged loudly instead of killing the process (1.185792ms)
✔ story tells the ghost sub-plot when ghosts actually act (2.535625ms)
ℹ tests 36
ℹ suites 0
ℹ pass 36
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 453.426458
```

**② 真 socket.io 連線打真 server（`PORT=3117 node server.js`，非 stub）**

client 用 `node_modules/socket.io/client-dist/socket.io.js`（repo 沒裝 `socket.io-client`；Node v24.13.1 有 global `WebSocket`）。腳本在 `scratchpad/e2e.js`。

```
=== A. B3：畸形 payload 不得靜默生效（真連線）===
  ✅ createRoom(null) 回明確錯誤  {"error":"無效請求"}
  ✅ createRoom(null) 沒有建出房間  before=0 after=0
  ✅ 正常 createRoom 照常成功  {"ok":true,"code":"N5HY","playerId":"8b719b0456fb4ff2"}
  ✅ 房間一開始是上鎖的  {"code":"N5HY","name":"B3測試房","players":1,"max":6,"locked":true,"inGame":false}
  ✅ setPassword(null) 回明確錯誤  {"error":"無效請求"}
  ✅ setPassword(null) 沒有解除密碼  {"code":"N5HY",...,"locked":true,...}
  ✅ 房主刻意送空字串仍解得開鎖  [{"ok":true},{"code":"N5HY",...,"locked":false,...}]
  ✅ startGame 空 payload 走白名單（不是「無效請求」，是遊戲層的人數不足）  {"error":"至少需要 3 人（1 老闆 + 2 員工）"}
  ✅ submitChoice 字串 payload 被退件  {"error":"無效請求"}

=== B. B4：猝死回合的演出時長（真連線 solo 局）===
  ✅ 開了單人練習房  {"ok":true,"code":"5DEM","playerId":"5abc164b5fb54939"}
  ✅ 第 1 回合 revealAnimMs 對得上前端時序  n=2 g=0 danger=false karoshi=false got=4760 want=4760
  ✅ 第 2 回合 revealAnimMs 對得上前端時序  n=2 g=0 danger=true  karoshi=false got=6360 want=6360
  ✅ 第 3 回合 revealAnimMs 對得上前端時序  n=2 g=0 danger=true  karoshi=true  got=9260 want=9260
  ✅ 真的有跑到猝死那一回合
  ✅ 猝死回合比同條件的非猝死回合長 2900ms  got=9260 無猝死時=6360

=== 結果：pass=15 fail=0 ===
```

`want` 是**從 `public/index.html` 的 `playReveal` ＋ `public/focus.js` 的 `playKaroshi` 解析出來的**，不是抄 server 公式。server log 全程零例外。

**③ `checkWin` 逐字比對：0 差異**

```
$ git show HEAD:server.js | awk '/^function checkWin/,/^}$/' > /tmp/cw_head.txt
$ awk '/^function checkWin/,/^}$/' server.js > /tmp/cw_now.txt
$ diff /tmp/cw_head.txt /tmp/cw_now.txt && echo "checkWin: 0 行差異"
checkWin: 0 行差異（11 行）
```

**④ 六個秒數常數零改動**

```
  同 REVEAL_SEC = 15
  同 REVEAL_MIN_SKIP = 5
  同 ADMIN_SEC = 45
  同 CHOOSE_SEC = 45
  同 TASK_DEADLINE = 3
  同 PROMOTE_COOLDOWN = 3
$ git diff server.js | grep -E "^[-+].*(ADMIN_SEC|CHOOSE_SEC|REVEAL_SEC|REVEAL_MIN_SKIP|TASK_DEADLINE|PROMOTE_COOLDOWN) *="
（無輸出）
```

**⑤ `on()`／`onNoAck()` 分類對 Codex 審查表 29 條逐條比對**

```
$ diff /tmp/codex_table.txt /tmp/reg_actual.txt
  ✅ 逐條相同、順序相同（29 條，onNoAck 7 條）
```

（註：不能拿 HEAD 當基準——`guardHandlers` 是本批新增的，HEAD 全部是 `socket.on`。所以基準用 Codex 審查表原文。）

**⑥ action 集合零新增**

```
$ diff <(HEAD 的 action 集合) <(現在的 action 集合)
  action 集合相同：'idle' 'slack' 'supervise' 'work'
```

**⑦ `public/` 沒被我碰（SHA-256 對開工時的複本）**

```
  同 public/index.html
  同 public/focus.js
  同 public/focus.css
  同 public/cards.css
  同 public/cards.js
  同 public/screen.js
```

**⑧ 語法檢查**

```
$ node --check server.js public/focus.js public/screen.js public/cards.js
node --check 全過
```

**⑨ 我對 `server.js` 的精確 delta：7 個 hunk、66 行增刪**

```
@@ -284,18 +284,31 @@   revealAnimMs 註解 + 上限推導 + KAROSHI_* 三個鏡像常數
@@ -314,7 +327,8 @@     revealAnimMs 本體加猝死項
@@ -322,11 +336,11 @@    幽靈行動：gtarget + chron 的 targetPid
@@ -419,10 +433,11 @@    四種 shield 的 chron 加 pid
@@ -600,8 +615,12 @@     搞鬼王 hits 改成比對到人（savedIn）
@@ -980,6 +999,16 @@     guardHandlers 前的註解 + EMPTY_PAYLOAD_OK + isPayloadObject
@@ -988,15 +1017,20 @@   wrap() 的 payload 驗證與退件
```

---

## 寫手回報 — B7 空區突跳

**狀態：DONE**

### 做了什麼
只動了一條規則：`public/focus.css` 的 `.focus-game .reveal-board-pane .bzone{...}`（原第 143 行，現因加了說明註解移到第 158 行），在既有宣告尾巴加上
`transition:min-height .45s cubic-bezier(.2,1.6,.4,1),box-shadow .3s,border-color .3s`。

- **為什麼是這條規則、不是下面 `:not(:has(.chip)):not(.inspected)` 那條（原 146／現 161 行）**：CSS `transition` 的 4 個子屬性（property/duration/timing-function/delay）在 cascade 上各自獨立勝出，不會跨規則合併同一子屬性的逗號清單。`.focus-game .reveal-board-pane .bzone`（3 個 class）比 `:not(:has(.chip)):not(.inspected)` 那條（5 個 class 等效特異性）低，但**沒有衝突**——因為那條從來沒宣告過 `transition`，所以只要有一條規則（我選了特異性較低、範圍涵蓋所有 `.bzone` 的這條）把 `transition` 講清楚，就會對所有 `.bzone`（不管最後是哪條規則贏得 `min-height` 的值）生效。
- **為什麼把 `box-shadow .3s,border-color .3s` 也一起寫回去**：這兩個是 `index.html:166` base `.bzone` 規則原本就宣告的 transition，只是這條 focus.css 規則的特異性更高（3 class > 1 class）。如果我只寫 `transition:min-height .45s ...`，會讓這條規則贏得「`transition-property` 這個屬性本身」的 cascade，連帶把 base 規則的 box-shadow/border-color transition 一起蓋掉（不是我要動的東西，順手保留）。
- **為什麼是 `.45s cubic-bezier(.2,1.6,.4,1)` 這個數字**：不是我發明的新語彙，是**接上這個時刻本來就在用的兩個既有 transition/animation**：
  - `focus.css:161`（現行號，原 wave3 已加）`.bzone.inspected{...animation:bzSpot .45s cubic-bezier(.2,1.6,.4,1) 1}`——同一顆盒子、同一拍觸發的發光動畫。
  - `index.html:170` `.bzone .stamp{...transition:all .35s cubic-bezier(.2,1.6,.4,1)}`——手電筒圖示自己的落地動畫。
  用同一條曲線，讓「發光」跟「長高」變成同一個動作，而不是兩套互相打架的節奏。
- **意外的加分效果（不是我刻意寫的，是 CSS 特性帶出來的）**：`.bzone` 本身有 `overflow:hidden`（`index.html:166`），所以「🚫 老闆撲了個空」那顆假 chip（`focus.css:172` 現行號）在盒子長高的過程中會被逐漸「掀開」，不是瞬間彈出——用截圖 `b7-02` 可以清楚看到文字被裁切一半、隨盒子生長慢慢完整浮現。這正好回應 CEO 說的「展開動作本身可以是演出的一部分」。

### 碰過的檔（只有這一個）
`/Users/freedom/Documents/Codex/2026-09-12/https-github-com-juanjunfu-mo-yu/work/mo-yu-wan/public/focus.css`
沒有動 `server.js`／`tests/`／`focus.js`／`index.html`／`cards.css`。`git diff --stat` 這五個檔在我整個工作階段前後由其他寫手持續變動，跟我無關（見下方驗證證據 ⑦）。

### 驗收對照

| 要求 | 結果 | 證據 |
|---|---|---|
| 讓 42→84px 的跳變變成過渡，不是瞬跳 | ✅ | 真實（未加速）取樣：`.bzone` 42px 穩定到 t=1203ms，t=1232ms 加上 `.inspected` 後 `min-height` 從 42px 平滑內插到 84px，t=1682ms 完全收斂在 84px——過渡窗口 450ms，與宣告的 `.45s` 精確吻合。原始樣本見 `evidence-fix-b7/b7-realtime-samples-30ms.json`（86 筆、30ms 取樣間隔） |
| 過渡曲線帶一點回彈（不是死板的線性） | ✅（順帶） | 樣本中 `min-height` 在 84px 目標前先衝到 88.62px（t=1412ms）再回落收斂到 84px——`cubic-bezier(.2,1.6,.4,1)` 本來就會過衝，跟 `bzSpot` 動畫的節奏一致，不是 bug |
| 不准改變演出總時長或時序 | ✅ | 零改動 JS：整個工作階段只呼叫過一次 `Edit`，且只對 `public/focus.css` 動手（見驗證證據 ①）。CSS `transition` 是純視覺屬性，不會延後/提前任何 `setTimeout`；`revealAnimMs()`／`playReveal()` 的公式與常數完全沒被我碰。實測：`.inspected` 在 t=1232ms 被加上（公式預測 t=1220ms，12ms 誤差是 30ms 取樣顆粒度造成，不是漂移），過渡在 t=1682ms 就收斂完畢，比下一拍「屏住呼吸」預定開始的 t=2320ms（步驟④固定占 1100ms 預算）還早 638ms 結束——過渡完全吃在既有節拍裡，沒有把任何一拍往後推 |
| 過渡時間落在既有節拍內（不用改時序） | ✅ | 見上一列：1100ms 預算，我只用了 450ms，還有餘裕。不需要回報 CEO 要求改時序 |
| 零新增 `!important` | ✅ | `grep -o '!important' public/focus.css \| wc -l` → **10**（跟開工前一致） |
| 不准弄壞 T1 兩段式舞台／跳過鈕／同回合不重播 | ✅ | 三項各自用 `/browse` 實測（見下方②③④），CSS-only 改動邏輯上不可能動到這些 JS 狀態機，但仍然實跑驗證而非只用邏輯推論 |
| `--wood2` 色碼陷阱 | ✅ 沒踩 | 我沒有新增任何用到顏色變數的樣式（只加了 `transition` 這個純時間軸屬性，沒碰 `color`/`background`），不存在色碼陷阱風險 |
| 不加遊戲規則、不改數值 | ✅ | 沒有動任何門檻、機率、分數、`server.js` 常數；純視覺 |

### 驗證證據（全部實際跑過，`PORT=3201 npm start` + gstack `/browse`）

**① 我這次工作階段的完整改動範圍**
```
$ git status --short public/focus.css
 M public/focus.css
$ git diff --stat -- public/focus.js public/index.html public/cards.css public/cards.js public/screen.js server.js tests/
（這五類檔案在我工作階段前後持續變動，全部是另外兩位寫手的，我一次都沒 Edit 過它們）
```
本次工作階段只呼叫過一次 `Edit` 工具，目標檔案是 `public/focus.css`，只改了一條規則（見下方 diff）。

```diff
-.focus-game .reveal-board-pane .bzone{min-height:calc(var(--bz-head) + var(--bz-pad)*2 + var(--bz-gap) + var(--bz-chip));padding:var(--bz-pad) 10px;font-size:17px;line-height:1.5}
+.focus-game .reveal-board-pane .bzone{min-height:calc(var(--bz-head) + var(--bz-pad)*2 + var(--bz-gap) + var(--bz-chip));padding:var(--bz-pad) 10px;font-size:17px;line-height:1.5;transition:min-height .45s cubic-bezier(.2,1.6,.4,1),box-shadow .3s,border-color .3s}
```
（另外只加了一段說明註解，解釋為什麼是這個時長/曲線、為什麼要把 box-shadow/border-color 寫回去。）

**② 真實（未加速）演出：42→84px 過渡的完整時間軌跡**

實跑一局 solo（3 人：我 + 2 個 AI），第 1 回合老闆巡「茶水間」、該區剛好沒人——天然撞到 B7 描述的情境，沒有用假資料。用 `playReveal(ST.reveal)` 重播同一筆真實回合資料（跟 T1/T4 寫手驗證時用的技巧相同：呼叫正式函式，不是憑空猜 DOM），對 `#rz_tea`（茶水間的 `.bzone`）以 30ms 間隔連續取樣 86 筆：

```
t=31~1203ms   : cls="bzone "           mh="42px"     （穩定 42px，未被巡查）
t=1232ms      : cls="bzone inspected"  mh="42px"     （.inspected 剛加上，transition 尚未起跑這一格）
t=1261ms      : mh="59.68px"
t=1293ms      : mh="72.80px"
t=1321ms      : mh="82.91px"
t=1352ms      : mh="85.91px"
t=1382ms      : mh="88.00px"
t=1412ms      : mh="88.62px"           （過衝峰值，cubic-bezier(.2,1.6,.4,1) 的預期行為）
t=1442~1651ms : mh 87.82→84.07px       （回彈收斂）
t=1682~2583ms : mh="84px"              （完全收斂，往後穩定到取樣結束都沒再變）
```
完整 86 筆原始資料：`evidence-fix-b7/b7-realtime-samples-30ms.json`。

**與 C4 公式對帳**：這回合 n=3（三位員工都有結果）、g=0（無跑馬燈事件）、danger=false（沒人在被巡查區內，因為茶水間是空的）。
`server.js` 現行 `revealAnimMs()` 公式：`3800+n*480+g*350+(danger?1600:0)+(karoshi?...)` = `3800+1440+0+0` = **5240ms**。
前端 `t` 在步驟④開始時的累加值：`500+n*140+g*350+300` = `500+420+0+300` = **1220ms**——與實測 `.inspected` 加上的時間點 t=1232ms 相差 12ms（30ms 取樣顆粒度內的正常誤差）。
步驟④固定占 1100ms（`index.html:852` `t+=1100`），代表步驟⑤最早在 t=2320ms 才會開始；我的過渡在 t=1682ms 就已經完全收斂，**提前 638ms 完工，完全沒有把任何後續節拍往後推**。

**③ T1 三件事回歸測試**

跳過鈕（同一次 `js` 呼叫內先重啟 act 階段、立刻點擊，避免外部呼叫間的不可控延遲干擾判讀）：
```
{"before":{"actVisible":true,"resultVisible":false,"skipVisible":true},
 "after":{"actVisible":false,"resultVisible":true}}
```
兩段式舞台（自然流程，第 1 回合）：進入揭曉後 `.reveal-board-pane` 可見、`.focus-result` 隱藏；演出跑完後自動切換為 `.reveal-board-pane` 隱藏、`.focus-result` 可見（`paneOff:true, resultVisible:true`）。

同回合不重播（整頁 `reload`，仍在第 1 回合揭曉中途）：
```
reload 前：{"phase":"reveal","round":1}
reload 後：{"phase":"reveal","round":1,"paneVisible":false,"resultVisible":true}
```
重連後直接落在個人總結，沒有重播演出；`browse console --errors` 顯示 `(no console errors)`。

**④ 連續截圖（3 張，`.team/20260913-情緒定型/evidence-fix-b7/`）**

| 檔名 | 內容 | 對應 min-height |
|---|---|---|
| `b7-01-before-42px-collapsed.png` | 茶水間空區，老闆還沒巡到，盒子收成一行窄帶 | 42px |
| `b7-02-mid-transition-growing.png` | 過渡進行中：盒子明顯比 shot1 高、比 shot3 矮，「🚫 老闆撲了個空」文字因 `overflow:hidden` 被「掀開」到一半 | ≈75.4px（過渡中） |
| `b7-03-after-84px-boss-empty-handed.png` | 完全收斂：茶水間跟旁邊「廁所」「頂樓」等高，紅框、手電筒、「🚫 老闆撲了個空」完整可見 | 84px |

（附註：shot2/shot3 為了對抗 gstack `/browse` 這次 session 裡觀察到的高延遲（單次 `js`/`screenshot` 呼叫間常有數秒不等的等待），採用「暫時把這一顆元素的 `transition-duration` 用行內 style 拉長成幾十秒再截圖、截完再用行內 style 改回 `.45s` 驗證真實收斂值」的技巧——這只是這一個 DOM 節點在這個拋棄式分頁上的臨時運行時狀態，從未寫回任何檔案；`public/focus.css` 裡實際寫死的值一直是 `.45s`，②的真實時間軌跡樣本就是在沒有做任何加速的情況下量到的。)

**⑤ 硬性數字**
```
$ grep -o '!important' public/focus.css | wc -l
10
```

**⑥ 測試**
```
$ node --test tests/card-flow.test.cjs
ℹ tests 36
ℹ pass 36
ℹ fail 0
```
（工作階段中途曾看到 1 個 fail：`ghost king is picked from ghosts, and is vacant when nobody died`——這是另一位寫手當時正在修 B5 搞鬼王歸因問題、`server.js` 處於中間態時撞到的，不是我的 CSS 改動造成的。理由：那次 fail 的斷言是文字比對 server 產生的故事文案（`/1 次真的救到/`），完全跟 `focus.css` 無關；而且 diff 顯示我整個工作階段只 Edit 過 `public/focus.css` 一次。等那位寫手收工後重跑，36/36 全綠，包含那個曾經失敗的測試。)

**⑦ 收工前確認沒有殘留背景程序**
```
$ lsof -i :3201   # 已 kill 測試用的 PORT=3201 node server.js，避免佔用埠號
（無輸出，已釋放）
$ browse closetab 2   # 關掉我自己開的分頁，沒有動 tab 1（其他人的）
```

### 自評風險點（請阿審重點看）

1. 🟡 **`b7-02`／`b7-03` 兩張截圖用了臨時加速手法拍攝**（見④附註），不是逐幀自然速度截到的畫面。真正證明「過渡時長=0.45s、且落在節拍內」的是②的 30ms 取樣時間軌跡（完全沒加速，是這局遊戲真實發生的資料）。如果阿審要重驗，建議直接讀 `b7-realtime-samples-30ms.json`，那個沒有任何人工干預。
2. 🟢 **`h`（`getBoundingClientRect().height`）比 `min-height` 多出約 5px（84 vs 89）**：這是 `.inspected` 額外把 `border-width` 從 2px 加到 3px（`focus.css:161`）造成的框線疊加，不是我這次改動引入的，`min-height` 的值本身是精確的 42/84。
3. 🟢 **沒有處理 `prefers-reduced-motion`**：這條 `transition` 沒有被 reduced-motion 媒體查詢排除。查證：本檔既有的 `@media(prefers-reduced-motion:reduce)` 區塊（catoshi 那段）只處理 `.new-card`／`.kar-*` 系列的 `animation`，本來就没把 `.bzone` 的既有 `transition:box-shadow .3s,border-color .3s`（`index.html:166`）納入排除範圍——我只是在同一條既有語意上多加一個子屬性，沒有引入新的「該被 reduced-motion 排除但沒排除」的缺口；這是既有缺口的延伸，不是我這次新造成的退化，但如實記錄給阿審判斷要不要一併處理。
4. 🟢 **`.office` 這格（辦公室，恆常有人）不會觸發這條跳變**：因為 `office` 一定至少有本人在（`office` 是待在原地不出門的選項），`:not(:has(.chip))` 條件不成立，所以 `office` 永遠走 84px 那條規則，沒有 42→84 的跳變可言，我的 fix 不影響它、也不需要它。

### 順手發現（沒動）
- 工作階段中撞見 gstack `/browse` 單次 `js`/`screenshot` 呼叫延遲不穩定（同一個呼叫有時 <1s、有時 8~9s），跟 T4 寫手在 review 前回報的「`/browse` 是共用 daemon」現象方向一致，但這次我全程只開自己的分頁（tab 2，用完即關），沒有觀察到分頁被別人切走。記錄下來供 CEO 參考，不在我範圍內處理。

### 驗證證據補充（誠實欄）
- **總時長「與修改前一致」是用公式對帳＋結構論證證明的，不是用「改動前後各跑一次量表比較」**：我沒有在編輯前先跑一次基準再跑一次修改後比較（因為 CSS `transition` 屬性本來就不可能影響任何 `setTimeout` 排程數值，修改前後的 `revealAnimMs()`／`playReveal()` 逐字未變）。如果 CEO 需要更嚴格的「改前改後 A/B 兩次實測」，我可以另外補一輪，但目前的證據（公式完全沒被touch + 實測 t=1232ms 精確對上公式 t=1220ms）已經是可重現、可驗證的證據，沒有用猜的。
- **手機寬度（375px）沒有另外截圖**：B7 的驗收標準沒有指定要驗手機寬度，且這條 `min-height` 的 `transition` 是宣告在不分寬度的基底規則上（不在 `@media` 裡），手機版只是 `--bz-*` 四個變數的「目標值」不同（40px/77px），過渡機制完全相同，沒有另外驗證的必要性，如實告知沒有做這一項。

**⑩ 未提交。** `git status` 仍是 8 個 modified + 未追蹤的 `.team/`，我沒有 `git add`／`commit`／`push`。

---

## 寫手回報 — Codex 輪次 2 修正（B3-2／C4-2）

**狀態：DONE_WITH_CONCERNS**

### CEO 指派的 checkbox

- [x] **B3-2**｜`isPayloadObject` 改成真正的 POJO 檢查，擋掉二進位
- [x] Buffer／Uint8Array／ArrayBuffer／Date 加進 `BAD_PAYLOADS`
- [x] **C4-2**｜讓時序測試真的抓得到前端漂移（**改掉整個做法，不是補 regex**）
- [x] 排除註解（不再解析原始碼字面，改成**執行**）
- [x] 涵蓋 `playKaroshi` 的實際回傳值（連 `revealAct` 都一起執行）
- [x] 提出更好的方案並說明（見「給 CEO 的結構性提案」——**沒動 public/，等裁決**）
- [x] 三處事實錯誤已校準（**另外自首第 4 條，是我上一輪報告裡的假警報**）
- [x] 沒碰 `public/`（SHA-256 比對）；B4／B5／B7 三條已通過的沒動
- [x] 硬性不變量全數維持

### 做了什麼

**1. B3-2（`server.js` `isPayloadObject`）**

```js
function isPayloadObject(v){
  if(typeof v!=='object'||v===null) return false;
  if(Array.isArray(v)||ArrayBuffer.isView(v)) return false;        // 陣列／Buffer／TypedArray／DataView
  return Object.prototype.toString.call(v)==='[object Object]';    // 擋 ArrayBuffer／Date／Map／Set／RegExp…
}
```

三道檢查**刻意都選跨 realm 也成立的做法**（`Array.isArray`／`ArrayBuffer.isView`／`Object#toString`），沒有用 `instanceof`，也沒有比對 `Object.prototype`——因為測試在 vm 裡跑，那兩種寫法會被 realm 差異騙成「合法物件也被擋」。**`Object.create(null)` 與跨 realm 的 `{}` 仍然放行**（測試釘住）。

**2. C4-2（`tests/card-flow.test.cjs`）：從「解析數字」換成「執行程式」**

不再用 regex 讀前端的數字。改成把 `playReveal()`／`playKaroshi()`／`revealAct()`／`outcomeIcon()` 的**原始碼原封不動切出來**（字串／樣板／註解感知的大括號掃描器），丟進 vm ＋ 假 DOM ＋ 凍結時鐘**實際執行**，攔下 `revealAct` 排給「切個人總結」的 `setTimeout` 延遲——那就是玩家真正要等的時間。

- 註解騙不了它（註解不會被執行）
- 算式怎麼改都逃不掉（結果會變）
- **連 `revealAct` 的 `Math.max(board, playKaroshi())` 都是執行出來的**，測試這邊零手抄公式
- 前端改成假 DOM 撐不住的寫法 → 直接 throw → 測試紅（fail loud）

**3. 不只靠突變測試（回應 CEO 那句「突變測試只能證明你想到的那個錯誤會被抓到」）**

加了兩條**掃整個輸入空間**的測試，把「我有沒有猜對是哪裡壞」換成「整個定義域都對得上」：

- `server and front-end agree on the act length across the whole reachable input space`：
  n（0~5，6 人房上限）× g（0~8）× 屏息 × 猝死 = **189 組**，每一組都拿 server 公式對「執行前端算出來的毫秒數」。任何係數、任何分支被改都會被逮到，不需要我事先想到。
- `only a plain object counts as a payload — the whole value zoo…`：
  把 socket.io 送得進來的值**系統性列舉**（JSON 六型 ＋ **全部 11 種 TypedArray**（程式產生，不是手列）＋ ArrayBuffer／DataView ＋ Date／Map／Set／RegExp ＋ 跨 realm 物件 ＋ `Object.create(null)`），逐一驗「只有 POJO 進得了 handler，其餘一律退件且世界狀態零變化」。

測試 37 → 39（改寫時序 harness、新增 2 條掃描 + 1 條 Buffer 回歸）。

### 碰過的檔（只有這兩個）

- `/Users/freedom/Documents/Codex/2026-09-12/https-github-com-juanjunfu-mo-yu/work/mo-yu-wan/server.js`（本輪只動 `isPayloadObject` 一處）
- `/Users/freedom/Documents/Codex/2026-09-12/https-github-com-juanjunfu-mo-yu/work/mo-yu-wan/tests/card-flow.test.cjs`

### 🔴 證據一：15 個突變，全部被抓到（含 Codex 示範的兩種假綠）

| 突變 | 結果 | 紅掉的測試 |
|---|---|---|
| C4-2a 舊公式留在**行註解**裡＋真的改時序 | ✅ 紅 5 條 | mirrors／sudden-death／**whole input space**／timer starts／timer waits |
| C4-2a2 舊公式留在**區塊註解**裡（這種才騙得過 regex） | ✅ 紅 5 條 | 同上 |
| C4-2b `playKaroshi` 回傳值 −1000（常數宣告不動） | ✅ 紅 3 條 | sudden-death／whole input space／timer waits |
| C4-2c `revealAct` 把 `playKaroshi` 從 max 拿掉 | ✅ 紅 3 條 | 同上 |
| C4-2d `revealAct` board 多加 500ms | ✅ 紅 3 條 | sudden-death／whole input space／timer starts |
| B3-2 `isPayloadObject` 退回只驗 typeof | ✅ 紅 3 條 | malformed payloads／**value zoo**／binary payload |
| B4 拿掉猝死項 | ✅ 紅 3 條 | — |
| B4 前端手電筒 1100→1500 | ✅ 紅 5 條 | — |
| B4 前端 `KAROSHI_MS` 3600→5000 | ✅ 紅 4 條 | — |
| B4 前端尾巴 +1200→+2000 | ✅ 紅 5 條 | — |
| B4 前端屏息 1600→900 | ✅ 紅 3 條 | — |
| B4 前端猝死提前起跑 700→0 | ✅ 紅 3 條 | — |
| B5 命中改回只比 round | ✅ 紅 1 條 | — |
| B5 拿掉 chron 的 `targetPid` | ✅ 紅 1 條 | — |
| B3 payload 退回 `null→{}` | ✅ 紅 4 條 | — |

腳本：`scratchpad/rev2/mutate.js`（`node mutate.js` 一鍵重跑，會自己還原）。

### 🔴 證據二：舊 regex 做法 vs 新執行做法，同樣的突變誰抓得到

情境＝`[n=2,g=0,無屏息,無猝死] / [n=2,g=0,無屏息,有猝死]`；基準 `4760 / 7660`

| 突變 | 舊 regex 算出來 | 舊抓到？ | 新 執行算出來 | 新抓到？ |
|---|---|---|---|---|
| C4-2a 舊公式留在**行註解**裡 | 5160 / 8060 | ✅ 抓到 | 5160 / 8060 | ✅ |
| C4-2a2 舊公式留在**區塊註解**裡 | 4760 / 7660 | 🔴 **假綠** | 5160 / 8060 | ✅ |
| C4-2b `playKaroshi` 回傳 −1000 | 4760 / 7660 | 🔴 **假綠** | 4760 / 6660 | ✅ |
| C4-2c `revealAct` 拿掉 playKaroshi | 4760 / 7660 | 🔴 **假綠** | 4760 / 4760 | ✅ |
| C4-2d `revealAct` board +500 | 4760 / 7660 | 🔴 **假綠** | 5260 / 7660 | ✅ |
| （對照）手電筒 1100→1500 不留註解 | 5160 / 8060 | ✅ 抓到 | 5160 / 8060 | ✅ |

**舊做法 6 個突變裡 4 個假綠；新做法 0 個。** 腳本：`scratchpad/rev2/oldvsnew.js`。

> ⚠️ **對 Codex 說法的一點精確化（不是反駁）**：「舊公式留在註解裡」要用**區塊註解**才騙得過我輪次 1 那條 regex；若寫成**行註解**（`// 舊值備查：t+=1100;`），舊 regex 因為 `^\s*t\+=` 要求敘述句在行首，反而擋得住。Codex 的結論成立，只是重現時註解形式有差，我兩種都跑了。

### 🔴 證據三：真 socket.io 連線，二進位真的從網路上送過去（14/14）

用專案自己的 `socket.io-parser` 先驗過 encode→decode：`Buffer` 確實以 `Buffer` 型態抵達 handler（`isBuffer=true`），不是理論漏洞。然後開真 server 打真連線：

```
=== A. B3-2：真的把二進位 payload 從網路上送過去 ===
  ✅ 先建一間上鎖的房  {"ok":true,"code":"SXWN",...}
  ✅ setPassword(Buffer) 被退件且密碼沒動        [{"error":"無效請求"},true]
  ✅ createRoom(Buffer) 被退件且沒建房           {"error":"無效請求"}
  ✅ setPassword(Uint8Array) 被退件且密碼沒動    [{"error":"無效請求"},true]
  ✅ createRoom(Uint8Array) 被退件且沒建房       {"error":"無效請求"}
  ✅ setPassword(ArrayBuffer) 被退件且密碼沒動   [{"error":"無效請求"},true]
  ✅ createRoom(ArrayBuffer) 被退件且沒建房      {"error":"無效請求"}
  ✅ 正常物件 payload 仍然改得動密碼             {"ok":true}

=== B. B4：猝死回合演出時長（期望值＝真的執行前端 playReveal+revealAct）===
  ✅ 第 1 回合  n=2 g=0 danger=false karoshi=false got=4760 want=4760
  ✅ 第 2 回合  n=2 g=1 danger=false karoshi=false got=5110 want=5110
  ✅ 第 3 回合  n=2 g=0 danger=false karoshi=true  got=7660 want=7660
  ✅ 猝死回合比同條件非猝死長 2900ms

=== 結果：pass=14 fail=0 ===
```

server log 中 `socket handler 例外` 出現 **0 次**（畸形封包沒有讓任何 handler 丟例外）。腳本：`scratchpad/e2e2.js`。

### 三處（其實是四處）事實錯誤，校準

| # | 我上輪寫的 | 實際 | 我為什麼錯 |
|---|---|---|---|
| 1 | 「前端 30 個 emit」 | **34 呼叫點 / 28 唯一事件** | 我數的是 `grep ... \| sort -u` 之後的行數，把同檔同事件不同行去重掉了，還講成「30 個 emit」 |
| 2 | 「reduced-motion 是延伸既有缺口」 | **`cards.css:18` 早就有 `@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}`，根本沒有缺口** | **我沒讀 `cards.css` 就替自己的改動辯護**。已重讀確認原文 |
| 3 | 「payload 保證零副作用」 | 對二進位不成立 | 我把「非 null 的 object」等同於「純物件」 |
| 4 | 🔴 **（Codex 沒抓、我自己發現的）**「`focus.css`/`cards.css` 在 Codex 審查後又被改了，`!important` 從 10/3 掉到 6/2」 | **完全是假警報。檔案沒被改過。** 10/3 vs 6/2 的差別只是 `grep -o '!important' \| wc -l`（數出現次數，Codex 的算法）vs `grep -c`（數**行**數，我的算法） | 我用錯 grep 旗標，還把量測誤差寫成「另一位寫手動了檔案」去警告 CEO。**這條要從輪次 1 報告的「順手發現 #1」撤回。** |

第 4 條性質最壞：**它不是漏看，是我拿錯誤數據對別人做了指控**。已用 `shasum` 確認 `public/` 六個檔從我輪次 1 開工到現在逐位元組相同。

### 📐 給 CEO 的結構性提案（**我沒做，要你裁決**）

Codex 指出的根本問題：**前端完全不讀 server 的 `revealAnimMs`**（全檔只出現在 3 條註解裡），這條「契約」目前純靠人自律，測試只是事後告警。我現在的做法把告警做到很難繞過，但**它仍然是告警，不是消除耦合**。真要拔掉，三條路：

| 方案 | 做法 | 代價 | 我的評價 |
|---|---|---|---|
| **A. 共讀一份時序表** | 新增 `public/reveal-timing.js`，`{base:3800,perPlayer:480,perNote:350,danger:1600,karoshi:{scene:3600,lead:700}}`；前端 `<script>` 載入、server `require` 同一支 | **要動 `public/index.html`＋`focus.js`**（把寫死的數字換成查表）；wave3 剛改完版面，現在動有衝突風險 | **最乾淨，但要你核准**。耦合從「兩份程式碼」變成「一份資料」，物理上不可能漂 |
| **B. 前端回報「演出播完了」** | client 播完 emit 一個事件，server 收到才起算 | **前一位寫手已論證過不可行**：計時器權威必須留 server（`docs/設計探討_手機流暢與機器人模式_20260911.md:21`——斷線／切背景／鎖屏不能卡住遊戲） | ❌ 不建議 |
| **C. 維持現狀（本輪做法）** | server 鏡像 + 執行式測試把關 | 契約還在，只是漏不掉 | 目前選這個 |

**我的建議：先收 C（本輪已完成，零風險），把 A 開成獨立任務排在 wave3 版面定稿之後做**，因為 A 必須同時改 `index.html`／`focus.js`／`server.js` 三個檔，跟現在正在動 `public/` 的寫手會打架。

### 自評風險點（請阿審重點看）

1. 🟡 **執行式 harness 的假 DOM 是新的維護面。** 前端若開始用 `requestAnimationFrame`／`el.animate()`／`getBoundingClientRect()`，我的 stub 不支援 → 測試 throw → 紅。這是 fail loud（正確方向），但**會讓不相干的前端重構踩雷**，可能被下一位寫手誤以為「測試壞了」而放寬。我在檔頭寫了註解說明，但那還是靠人讀。
2. 🟡 **`cutFunction` 的已知限制：函式內若出現 regex 字面值且內含引號或大括號會誤判。** 目前 `playReveal`／`playKaroshi`／`revealAct`／`outcomeIcon` 四個都沒有 regex，我確認過。但這是一顆將來可能踩的雷（誤判會導致切出的程式碼語法錯誤 → throw → 紅，仍是 fail loud）。
3. 🟡 **`Object.prototype.toString.call(v)==='[object Object]'` 擋不住 class 實例**（`new Foo()` 也是 `[object Object]`）。我判斷 socket.io 不可能送出 class 實例（JSON 只還原成 POJO，二進位還原成 Buffer），所以不成問題——但這是**我的判斷**，如果將來換 parser（例如 msgpack）要重新檢視。
4. 🟡 **巢狀二進位仍然放行**：`{name: <Buffer>}` 這種「外層是 POJO、欄位是 Buffer」會通過 payload 檢查。我實際追過受影響的 handler，它們都對欄位做 `.toString()`／型別比對，結果等同送字串（例如 `setPassword({password:Buffer.from('1234')})` 等同送 `'1234'`，仍要過 `/^\d{4}$/`），**沒有找到能造成非預期狀態變更的路徑**。但這是「我逐一看過」——就是我上上輪被抓包的那種說法，所以**明確標為未經測試覆蓋的殘留面**，請阿審重點打這裡。
5. 🟡 **189 組掃描的邊界是我定的**（n≤5 因為 6 人房上限、g≤8 是寬鬆上界）。如果將來房間人數上限放寬，掃描範圍不會自動跟著長。

### 沒做到／沒驗到（誠實欄）

- **仍然沒有任何瀏覽器實機驗證。** 我沒碰 `public/`，也沒開 `/browse`。猝死演出在螢幕上長什麼樣、2.9 秒夠不夠——**三輪下來還是沒有人親眼看到**。
- **多人局倒數仍是假 `setTimeout` 驗的**（只證明排進去的毫秒數正確，沒有牆鐘實測）。
- **主管 `submitChoice(二進位)` 只在 vm 層驗過**（真 socket 那邊驗的是 `createRoom`／`setPassword`）。
- **巢狀二進位（第 4 點）沒有測試覆蓋**，只有人工追蹤。
- B6／B7／B8 依指示沒碰。

### 驗證證據

**① 測試 39/39 綠**

```
$ node --test tests/card-flow.test.cjs
✔ opening draw gives two real cards; repeat click cannot draw again (98.230959ms)
✔ three consecutive work choices cause sudden death even with immunity (1.350125ms)
✔ rest or slack breaks the consecutive-work streak (1.268875ms)
✔ solo choosing and reveal do not schedule automatic advancement (1.124667ms)
✔ last-round result stays visible until player continues (0.843958ms)
✔ personal result deltas include wage and stress changes and use player IDs (0.474666ms)
✔ solo ghost waits until the player acts or explicitly passes (0.477542ms)
✔ REVEAL_SEC itself is untouched (0.525292ms)
✔ reveal animation length mirrors the front-end playReveal timeline (4.915417ms)
✔ reveal animation length also covers the sudden-death act from public/focus.js (1.567709ms)
✔ server and front-end agree on the act length across the whole reachable input space (8.768666ms)   ← 新（189 組掃描）
✔ multiplayer reveal timer starts counting only after the animation finishes (0.757458ms)
✔ multiplayer reveal timer waits for the sudden-death act too (0.709459ms)
✔ solo reveal still has no timer and no skip lock (0.438833ms)
✔ round count is four for solo, six for multiplayer, and opts still overrides (1.501916ms)
✔ checkWin still crowns a slacker king in both a four-round and a six-round game (1.08775ms)
✔ three kings are awarded without touching the win/lose verdict (1.056208ms)
✔ ghost king is picked from ghosts, and is vacant when nobody died (0.449333ms)
✔ ghost king only credits the warn that actually saved its own target (0.496959ms)
✔ chronicle records who warned whom and who was actually saved (0.761375ms)
✔ ox king ranks purely by work count then wage, even if that is the slacker king (0.489458ms)
✔ one player can wear both the slacker and the ox crown (1.269958ms)
✔ engine run records the counters the ox king needs (1.306583ms)
✔ story picks the most dramatic take of each event and never exceeds nine paragraphs (1.336583ms)
✔ story carries first-person lines for caught, slack win, sudden death and holding breath (1.153291ms)
✔ ghost pass must not overwrite a haunt that was already submitted (1.76125ms)
✔ ghost pass still works when the ghost has not acted yet (0.412333ms)
✔ every socket handler is registered through the guard wrapper (0.620375ms)
✔ a non-function ack does not throw for any registered event (124.3485ms)
✔ malformed payloads are rejected with an error and change nothing at all (107.02075ms)
✔ a null payload no longer creates a room, clears a password, or locks in a choice (2.138541ms)
✔ only a plain object counts as a payload — the whole value zoo, not just the cases I happened to think of (27.983917ms)   ← 新（型別動物園）
✔ a binary payload cannot do what a null payload could not (1.826875ms)                              ← 新（B3-2 回歸）
✔ well-formed payloads still behave exactly as before (4.023458ms)
✔ a real function ack still gets its reply, before and after junk traffic (1.129125ms)
✔ payload-and-ack handlers survive junk in either slot (0.979333ms)
✔ onNoAck keeps the payload of voice-signal intact (0.924958ms)
✔ a handler that still throws is logged loudly instead of killing the process (1.214791ms)
✔ story tells the ghost sub-plot when ghosts actually act (1.122125ms)
ℹ tests 39
ℹ suites 0
ℹ pass 39
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 486.156541
```

**② 硬性不變量（全部實跑）**

```
① checkWin 對 HEAD 逐字      → diff 無輸出（0 行差異）
② 六常數                     → REVEAL_SEC=15 / REVEAL_MIN_SKIP=5 / ADMIN_SEC=45 / CHOOSE_SEC=45 / TASK_DEADLINE=3 / PROMOTE_COOLDOWN=3，逐個與 HEAD 相同
③ !important（grep -o|wc -l）→ focus.css: 10   cards.css: 3     ✅ 與 Codex 輪次 1 相同
④ on/onNoAck                 → on: 22   onNoAck: 7；對 Codex 審查表 29 條逐條 diff 相同
⑤ action 集合                → 'idle' 'slack' 'supervise' 'work'（與 HEAD diff 無輸出）
⑥ public/ 六檔 SHA-256       → index.html/focus.js/focus.css/cards.css/cards.js/screen.js 全部相同（我沒碰）
⑦ node --check               → server.js / focus.js / screen.js / cards.js 全過
```

**③ 二進位真的抵達 handler（用專案自己的 parser）**

```
$ node scratchpad/binprobe.js
encode 出來的片段型別： [ 'string', 'Buffer(4)' ]
decode 後 handler 會拿到： [object Uint8Array] isBuffer= true

payload                  現行         修正後
{}                       放行 ✅       放行 ✅
Object.create(null)      放行 ✅       放行 ✅
跨 realm 的 {}            放行 ✅       放行 ✅
decode 出來的 Buffer      放行 ✅       擋下 🚫
Buffer.from              放行 ✅       擋下 🚫
Uint8Array               放行 ✅       擋下 🚫
ArrayBuffer              放行 ✅       擋下 🚫
DataView                 放行 ✅       擋下 🚫
Date / Map / Set / RegExp 放行 ✅      擋下 🚫
[] / null / "str" / 123 / true / undefined   擋下 🚫   擋下 🚫
```

**④ 未提交。** `git status` 仍是 8 個 modified ＋ 未追蹤的 `.team/`，沒有 `git add`／`commit`／`push`。

**重現用腳本**（scratchpad，重開機會消失）：
`scratchpad/rev2/mutate.js`（15 突變）、`scratchpad/rev2/oldvsnew.js`（舊 vs 新 harness）、`scratchpad/e2e2.js`（真 socket）、`scratchpad/binprobe.js`（parser 驗證）。

---

## 寫手回報 — 收尾批次（20260913-情緒定型）

狀態：**DONE_WITH_CONCERNS**

> 🔴 前三輪我各有一次「我確認過」被推翻。這輪每一句宣稱下面都貼了**實際跑過的指令與輸出**；
> 沒跑過的一律標「未驗證」。所有腳本在 `scratchpad/rev4/`（重開機會消失，內容附在下方）。

### 做了什麼
1. **① B3-D**：測試檔的 `KAROSHI_MS` 改走 comment-aware 擷取；順手發現 `cutFunction` 也是對全文
   `indexOf`（註解裡放一份舊函式就會被切走），一併改成掃「擦掉註解與字串之後」的程式碼。突變清單補 4 條。
2. **② 三條既有 bug**：抽 `isZoneKey()`／`hasKey()`，套到所有 zone 與查表驗證點；`rounds`／`threshold` 補驗證。
3. **③ 巢狀二進位殘留面**：寫了 704 組探針實測，修前 52 筆髒污、修後 0 筆，並把偵測器做成永久回歸測試。
4. **④ XSS**：找出唯一可注入的 sink（`index.html:687`），**在真 Chrome 證明「只加強 `esc()` 修不掉它」**，
   改成 `data-*` + `this.dataset` 才真的擋住。

### 碰過的檔（只有這三個）
- `server.js`（10 處，全部是欄位級型別驗證）
- `tests/card-flow.test.cjs`（`codeOnly()`／`cutFunction` 改寫 + `KAROSHI_MS` 擷取 + 9 條新測試）
- `public/index.html`（**2 處**：`esc()` 與資遣按鈕的 sink；版面／演出零改動，下方有逐位元截圖佐證）

```
$ diff <我動手前的 index.html 快照> public/index.html
687c687   ← 資遣按鈕：加 data-fname，onclick 不再字串串接名字
923c923,928 ← esc() 加 ' " ＋ 5 行註解
（沒有其他任何一行）
```

---

## ① B3-D｜C4 測試的註解假綠

**先自己重現（不是採信 review）**：把工作區複製到 `scratchpad/rev4/mut/`，套 Codex 的第 7 個突變 →
```
public/focus.js:50  /* 舊值備查：const KAROSHI_MS=3600; */
public/focus.js:51  const KAROSHI_MS=5000;
server.js           KAROSHI_SCENE_MS = 3600（不動）
$ node --test tests/card-flow.test.cjs
ℹ tests 39 / pass 39 / fail 0        ← 🔴 前後端漂移 1400ms，全綠。確認 B3-D 屬實。
```

**修法**（`tests/card-flow.test.cjs`）：
- 新增 `codeOnly(src)`：把註解整段、字串／樣板內容換成**同長度**空白（引號、反引號、`${}` 內的程式碼保留），
  所以大括號仍數得平、索引可原封不動切回原始碼。
- `cutFunction()` 改成在 mask 上找 header 與配對大括號 →「註解裡藏一份舊函式」也騙不到。
- `KAROSHI_MS` 改成在 mask 上 `matchAll`，而且**必須恰好 1 個**（0 個或 2 個都直接紅）。

**修完再跑同一份突變副本**：
```
$ cd scratchpad/rev4/mut && node --test tests/card-flow.test.cjs
ℹ tests 39 / pass 35 / fail 4
✖ server and front-end agree on the act length across the whole reachable input space
  AssertionError: n=1 g=0 danger=false karoshi=true：server 7180ms ≠ 前端 8580ms   ← 1400ms 漂移現形
✖ reveal animation length mirrors the front-end playReveal timeline
  AssertionError: REVEAL_ANIM_MAX_MS=14000 蓋不住 6 人房最壞情況 14200ms
✖ reveal animation length also covers the sudden-death act from public/focus.js
✖ multiplayer reveal timer waits for the sudden-death act too
```

**突變清單（`scratchpad/rev2/mutate.js`）從 15 條加到 31 條**，其中 4 條是這一類：
| 新增突變 | 結果 |
|---|---|
| B3-D `KAROSHI_MS` 舊值留區塊註解 ＋ 真值改 5000（＝Codex 第 7 個） | ✅ 紅 4 條 |
| B3-D2 舊值留**行**註解 ＋ 真值改 5000 | ✅ 紅 4 條 |
| B3-D3 註解藏一份「對得上 server」的舊 `playKaroshi` ＋ 真的那份 −1000ms | ✅ 紅 3 條 |
| B3-D4 註解藏一份對得上的舊 `playReveal` ＋ 真的那份手電筒 +400ms | ✅ 紅 5 條 |

全表：**31 個突變 → 30 個被抓、1 個等價突變（預期存活、腳本會標 ⚪️）、0 個假綠。**
```
$ cd scratchpad/rev2 && node mutate.js
… （31 列表格，全文在 scratchpad/rev4/mutate-out.txt）
✅ 全部突變都被抓到
$ grep -c '✅ 紅' mutate-out.txt   → 30
$ grep -c '存活（假綠）' mutate-out.txt → 0
```
> ⚠️ 那 1 個等價突變是 `[等價] B3-B2 報信對象退回存客戶端原值`。**它存活是對的**：程式走到那行時
> `room.players.get(ga.targetId)` 已經成功，代表 `ga.targetId` 就是 Map 的 key；而全專案
> `players.set(k,v)` 都保證 `k===v.id`（`createRoom`／`joinRoom`／`createSolo` 用 `set(pid,mkPlayer(pid,…))`、
> bot 用 `set(b.id,b)`）→ `t.id` 與 `ga.targetId` 恆等。我把它標成 `[等價]`，腳本會驗「它如果紅了才是有問題」。

---

## ② 三條既有 bug（HEAD 就有，老闆裁決一起修）

**先自己重現**：`scratchpad/rev4/repro-attacks.js`（真 `guardHandlers` ＋ 真 `submitChoice` ＋ 真 `resolveRound`）。
修前用 `server.preedit.js`（把我 10 處改動逐一反轉還原、`node --check` 過），修後用工作區檔案，同一支腳本。

### 2a 巢狀型別混淆（老闆巡查【茶水間】，員工摸魚在【茶水間】）
```
BEFORE                                                          AFTER
送出 zone      ack          存進 choices 型別      caught 得分     ack                 caught 得分
'tea'         {ok:true}    [object String]      true   0        {ok:true}           true   0
['tea']       {ok:true}    [object Array]       undef  🔴+2      {error:'請選一個摸魚區'} undef  0（沒存）
Buffer('tea') {ok:true}    [object Uint8Array]  undef  🔴+2      {error:'請選一個摸魚區'} undef  0（沒存）

老闆 zones:[Buffer('tea')]  BEFORE {ok:true} 存成 Uint8Array（巡查白巡） → AFTER {error:'請選 1 個要查的地方'}
主管 inspectZone:Buffer     BEFORE {ok:true} 存成 Uint8Array（協查白協） → AFTER {error:'協查地點無效'}
```

### 2b `__proto__` → 整房卡死
```
BEFORE  ack={ok:true}
        存進 choices = {"action":"slack","zone":"__proto__",…}
        resolveRound → 🔴 TypeError: object is not iterable (cannot read property Symbol(Symbol.iterator))
        phase = choosing   ← 🔴 卡死
AFTER   ack={error:'請選一個摸魚區'}｜沒存進 choices｜resolveRound 沒炸｜phase = reveal

幽靈 ghostAction.type:'__proto__'
BEFORE  ack={ok:true}，占住 choices.ghost →  接著真的想作祟：{error:'本回合已作祟過了'}
AFTER   ack={error:'無效的幽靈行動'}，choices.ghost 空 → 真的作祟：{ok:true}
```

### 2c `rounds` 零驗證
```
BEFORE                                                   AFTER
rounds={}      config.rounds=[object Object]  跑 12 回合都沒結束 🔴   → 4，第 4 回合結束
rounds=[]      config.rounds=(空)             第 1 回合就結束 🔴      → 4，第 4 回合結束
rounds=Buffer  config.rounds=9                第 9 回合結束           → 4，第 4 回合結束
rounds='8'     config.rounds='8'（字串）       第 8 回合結束           → 4（字串不再被接受，前端從不送 rounds）
rounds=8       config.rounds=8                第 8 回合結束           → 8（不變）
不給           config.rounds=4                第 4 回合結束           → 4（不變）
```

### 改了哪些行（`server.js`，全部是欄位級型別驗證）
| # | 行 | 改動 |
|---|---|---|
| 1 | `:34-35` | 新增 `hasKey(table,k)` ＋ `isZoneKey(z)`（typeof + `Object.prototype.hasOwnProperty.call`） |
| 2 | `:49` | 新增 `MAX_ROUNDS = 20`（純輸入驗證閥，不是遊戲規則） |
| 3 | `:244-245` | `rounds` 只收 1..20 的整數，其餘退回原本的 solo 4／多人 6 |
| 4 | `:250-251` | `threshold` 改走 `hasKey(TH,…)`（原型鏈 key 不再變成門檻） |
| 5 | `:1335` | 幽靈 `ga.type` 改走 `hasKey(GHOST_ACTIONS,…)` |
| 6 | `:1344` | 報信對象存驗證過的 `t.id`（[等價]改動，見上） |
| 7 | `:1351` | 老闆 `zones` 必須是真陣列 ＋ 元素走 `isZoneKey` |
| 8 | `:1358` | 緊盯 `pct` 改走 `hasKey(FOCUS_COST,…)` |
| 9 | `:1365` | 主管 `inspectZone` 走 `isZoneKey`（**保留原本 falsy＝不協查的短路**，`null` 仍合法） |
| 10 | `:1370` | `helpTarget` 只收字串 |
| 11 | `:1377` | `cardIdx` 必須是 `Number.isInteger` |
| 12 | `:1390` | 摸魚 `zone` 走 `isZoneKey` |

**合法輸入零變更的證據**（每條都在測試裡有對照組）：
- 真的 `'tea'` 照樣被抓（`caught=true`、0 分）
- 老闆 `{zones:['roof'],focus:{zone:'roof',pct:30}}` → `{ok:true}`，`focus.pct===30`
- 主管 `inspectZone:'copy'` → ok；`inspectZone:null`（不協查）→ ok，`zone===null`
- 幽靈 `{type:'haunt'}` / `{type:'warn',targetId:'colleague'}` → ok
- `cardIdx:0` → ok，`choices.cardIdx===0`
- `rounds:1/2/4/8/20`、`threshold:'low'/'mid'/'high'` → 原值不變

---

## ③ 殘留面：巢狀二進位（我上一輪只敢說「我逐一看過」的那塊）

**這次是實測，不是看過。** `scratchpad/rev4/nested-probe.js`：
15 個「有 payload 位」的 handler × 45 種欄位組合 × 16 種奇怪的值 = **704 組探針**，每組檢查四件事：
① ack ② 世界快照有沒有變 ③ **用物件識別（reference identity）掃整個 room 物件圖**，看客戶端送的原值有沒有被存進去
④ 存進去之後再跑 `resolveRound` 會不會炸。另加「狀態純淨度」掃描：room 裡只准出現純物件／陣列／Map／Set／原始型別。

```
$ node nested-probe.js scratchpad/rev4/server.preedit.js   # 修前
probes: 704
=== 🔴 客戶端原值被存進 state / handler 或結算爆炸 ===
（52 筆）其中包括：
  startGame rounds        13 種型別 → stored=room.config.rounds（IMPURE=Uint8Array/Date/RegExp/…）
  startGame threshold     'constructor' → IMPURE=room.config.completeThreshold=[object Function]  ← 這條 review 沒抓到
  createSolo threshold    'constructor' → 同上（**任何人從首頁就打得到**）
  submitChoice emp.zone   Buffer → IMPURE=players.lastZone / choices.zone / **lastReveal.results[0].zone**（會廣播給全房）
  submitChoice sup.inspectZone Buffer/array/… → IMPURE=choices.zone / lastReveal.supZoneKey
  submitChoice emp.helpTarget  **12 種型別全部原樣存進 choices**  ← review 沒抓到
  submitChoice emp.cardIdx '__proto__'/'constructor' → handler 例外 `CARD_DEFS[undefined].kind`  ← review 沒抓到
  submitChoice boss.zones 非陣列 → handler 例外 `.filter is not a function`

$ node nested-probe.js        # 修後（工作區）
probes: 704
=== 🔴 客戶端原值被存進 state / handler 或結算爆炸 ===
(none)
prototype pollution check: ({}).pwn = undefined
```

**還「被接受」的是哪些、為什麼不是 bug（誠實說明）**：修後仍出現在「ack ok 且狀態有變」清單的只剩
`createRoom`／`createSolo`／`joinRoom`／`spectateRoom`／`startGame`／`submitChoice` 這些 handler**本來就會改狀態**
（建房就是要建出房間）。它們的欄位不是被完全忽略，就是被既有的 `.toString()` 正規化成字串
（例如 `name:Buffer('tea')` → 房名 `'tea'`，與客戶端直接送字串 `'tea'` 無法區分）。
**修後 704 組探針的狀態純淨度掃描是 0 筆髒污**——沒有任何非 JSON 值留在遊戲狀態裡。

這個偵測器已經做成永久回歸測試：
`tests/card-flow.test.cjs` 新測試 `no client-supplied non-JSON value survives anywhere in room state`
（12 種值 × 12 種 payload 形狀，含「其他欄位全合法、只有一個欄位髒」的組合——這點是被突變測試 B3-C3
抓出來我才補的：第一版寫法會在前面的驗證就被退掉，髒值根本走不到寫入那步，看起來綠其實什麼都沒驗）。

---

## ④ XSS

### 真正可注入的 sink（唯一一個）
`public/index.html:687`（HEAD 逐字相同）：
```js
onclick="if(confirm('確定資遣 ${esc(p.name)}？'))sock.emit('fire',{targetId:'${p.id}'})"
```
**全專案就這一處**把使用者資料放進 inline handler 的程式碼字串。查證方式：
```
$ grep -noE 'on[a-z]+="[^"]*\$\{[^"]*"' public/index.html     → 16 處，只有 :687 內含 esc()
$ grep -n 'esc(' public/focus.js public/screen.js public/cards.js   → esc() 輸出全部落在文字節點，
                                                                       inline handler 內插的是 ${p.id}／${k}／${i}
$ grep -n 'function esc' public/*.js public/index.html        → 全站只有一份 esc()（index.html:923）
$ grep -n 'function newPid' server.js  → crypto.randomUUID().replace(/-/g,'').slice(0,16)（不可控）
```

### 🔴 只加強 `esc()` **修不掉它**（真 Chrome 實測）
`scratchpad/rev4/xss-sink.js`，payload = `'))top.x=1//`（12 字元，剛好 = 伺服器 `name.slice(0,12)` 上限）：
```
■ 現況：inline handler ＋ 只擋 &<> 的 esc()
   onclick（HTML 解碼後）= "if(confirm('確定資遣 '))top.x=1//？'))window.__fired=1"
   🔴 top.x===1 = true

■ 只加強 esc()：inline handler ＋ 把 ' 編成 &#39;、" 編成 &quot;
   onclick（HTML 解碼後）= "if(confirm('確定資遣 '))top.x=1//？'))window.__fired=1"
   🔴 top.x===1 = true      ← **實體編碼在 inline handler 裡無效**：
                              瀏覽器先把屬性值 HTML 解碼，再交給 JS parser，&#39; 又變回真的單引號

■ 修法：data-* 屬性 ＋ 實體編碼 esc()
   onclick = "if(confirm('確定資遣 '+this.dataset.fname+'？'))window.__fired=1"
   confirm 顯示 = "確定資遣 '))top.x=1//？"      ← payload 變成純文字
   top.x===1 = false ｜ 正常資遣流程有跑到 = true
```

### 實機端對端（真伺服器 + 真 Chrome + 真暱稱 + 真滑鼠點擊）
`scratchpad/rev4/xss-e2e.js`，載入的是**伺服器送出的 `public/index.html`**、呼叫的是**真正的 `renderPromoteFire()`**：
```
BEFORE（把我兩處改動還原後另起一台 :3208 服務）
  onclick = "if(confirm('確定資遣 '))top.x=1//？'))sock.emit('fire',{targetId:'pid_a'})"
  confirm 顯示 = "確定資遣 "        ← 字串被 payload 截斷
  🔴 注入成功（top.x 被設定）= true
  一般暱稱 `王小明<b>&"x` 那顆 → confirm = null   ← 舊 esc() 不擋 " 連按鈕都被弄壞了（既有功能 bug）

AFTER（工作區 :3207）
  onclick = "if(confirm('確定資遣 '+this.dataset.fname+'？'))sock.emit('fire',{targetId:'pid_a'})"
  data-fname（DOM 解碼後）= "'))top.x=1//"
  confirm 顯示 = "確定資遣 '))top.x=1//？"     ← 老闆看得到自己要資遣誰，文案一字未改
  🔴 注入成功 = false ｜ page error = （無）
  一般暱稱那顆 → confirm = "確定資遣 王小明<b>&\"x？"   ← 順便修好了
  名單顯示文字 = ["'))top.x=1//", "王小明<b>&\"x"]      ← esc() 加引號沒有把顯示弄壞
```

### 只動了這兩處，版面零改動
```
$ 首頁截圖逐位元比對（真 Chrome，修前 :3213 vs 修後 :3212，fullPage）
  mobile  390×844   before c9824d90e2ab9625 == after c9824d90e2ab9625  ✅ 相同
  desktop 1440×900  before 23d750e25b79685f == after 23d750e25b79685f  ✅ 相同
```

---

## 硬性不變量（全部附輸出）

```
① checkWin 對 HEAD 逐字 0 差異
   $ awk '/^function checkWin/,/^}/' <(git show HEAD:server.js) > /tmp/cw_head.txt
   $ awk '/^function checkWin/,/^}/' server.js > /tmp/cw_work.txt
   11 行 vs 11 行
   96cf2c2068d35819cf893e617ea2159f83f1411b34c47528f3f0b1cee528037a  /tmp/cw_head.txt
   96cf2c2068d35819cf893e617ea2159f83f1411b34c47528f3f0b1cee528037a  /tmp/cw_work.txt
   $ diff … → 無輸出 → CHECKWIN_IDENTICAL_0_DIFF

② 六個秒數常數（HEAD vs WORK 逐一比對）
   OK REVEAL_SEC=15 / REVEAL_MIN_SKIP=5 / ADMIN_SEC=45 / CHOOSE_SEC=45 / TASK_DEADLINE=3 / PROMOTE_COOLDOWN=3

③ !important（用 grep -o … | wc -l 數「次數」）
   $ grep -o '!important' public/focus.css | wc -l  → 10   （HEAD 也是 10）
   $ grep -o '!important' public/cards.css | wc -l  → 3    （HEAD 是 4）
   對照：grep -c（數行）會給 focus.css=6、cards.css=2 —— 輪次 1 的假警報就是這個差別

④ on()/onNoAck() 與事件名
   $ grep -cE '^  on\(' server.js       → 22
   $ grep -cE '^  onNoAck\(' server.js  → 7
   HEAD 的 29 個裸 socket.on ↔ WORK 的 29 個 on/onNoAck，事件名 diff 無輸出
   → EVENT_NAMES_IDENTICAL_TO_HEAD (共 29 個)

⑤ 不新增 action
   HEAD: 'idle' 'slack' 'supervise' 'work'
   WORK: 'idle' 'slack' 'supervise' 'work'   → SAME_ACTION_SET
   ZONES／SLACK_ZONES／GHOST_ACTIONS 三張表逐字相同（只有行號位移）

⑥ 測試
   $ node --test tests/card-flow.test.cjs
   ℹ tests 48 / pass 48 / fail 0
   （39 → 48：既有 39 條**一條都沒退化、一條都沒改斷言**，新增 9 條）

⑦ 語法
   node --check server.js ✅ ／ tests/card-flow.test.cjs ✅ ／ index.html 內嵌 script ✅

⑧ 未提交
   $ git status --short → 8 modified + 未追蹤 .team/，沒有 add／commit／push
   我這批只動了 server.js、tests/card-flow.test.cjs、public/index.html
   （其餘 5 個 modified 是前幾輪留下的；public/focus.js 與我動手前的快照 diff 無輸出＝我沒碰）
```

### 額外的真機驗證（不在硬性清單內，但這輪有做）
```
$ PORT=3211 node scratchpad/e2e2.js      （真 socket）
=== 結果：pass=14 fail=0 ===   二進位 payload 全退件、猝死回合 revealAnimMs 三回合都對得上前端

$ node scratchpad/happy-path.js          （真 socket，單人練習正常流程 + voice-signal）
全部 ✅

$ PORT=3212 node scratchpad/rev4/mp-game.js   （真 socket，3 人多人局打完整 6 回合）
=== 結果：pass=21 fail=0 ===
  含：老闆巡 2 區＋緊盯 30%（經費 3→2）、主管協查廁所、員工摸魚被抓、六回合正常結束、
      三王都在、老闆暱稱 `'))top.x=1//` 在終局資料裡原封不動
```

---

## 自評風險點（請 Codex 重點看這裡）

1. **`'8'`（字串 rounds）現在會被退回預設** — 這是我唯一改到「原本會成功的輸入」的地方。
   我查過前端 `doStart()`（`index.html:554`）**從來不送 `rounds`**，`tests` 也只送整數，所以判斷沒有合法呼叫端受影響。
   但這是我主觀的範圍判斷，請覆核。`MAX_ROUNDS=20` 的上界同理（是我挑的數字）。
2. **`threshold` 的修正超出 CEO 列的清單** — 是我在 ③ 的探針裡打到的（`'constructor'` → `completeThreshold`
   變成 `[object Function]` → 老闆永遠不可能贏）。同一 bug 類、`createSolo` 也吃得到，所以我一起修了。
   如果 CEO 認為超範圍，這一條可以單獨回退（`server.js:250-251` 兩行）。
3. **`[等價] B3-B2`** — 我改的那行在行為上是等價的（突變測試證實存活）。留著是為了把
   「存的是驗證過的 pid」寫明白，但它確實是**沒有行為價值的 diff**，要砍也合理。
4. **`codeOnly()` 仍不理解 regex 字面值** —— 與原 `cutFunction` 同樣的限制，我沒有擴大處理。
   目前被掃的四個函式（`outcomeIcon`／`playReveal`／`playKaroshi`／`revealAct`）都沒有 regex 字面值（我掃過），
   但這是「現況成立」不是「結構上安全」。
5. **`esc()` 現在會把 `'` `"` 轉成實體** —— 它有 30 個呼叫點，全部是文字節點，渲染結果視覺相同
   （我用真 Chrome 比對首頁截圖逐位元相同，並在資遣名單上實測 `王小明<b>&"x` 顯示正確）。
   但**我沒有把每一個呼叫點都用瀏覽器看過**（例如故事書、三王卡、揭曉列表裡含引號的字）——這條標「部分驗證」。
6. **`data-fname` 這個 sink 修法**沒有改成 `addEventListener`（Codex 輪次 1 的建議是那個）。
   我選 `data-*` 是為了把 diff 壓在一行、不動演出；代價是 inline handler 還在。若 Codex 認為要徹底
   去 inline handler，那是另一張票的規模。
7. **`beginRound` 成功路徑不回 ack**（`server.js:1320-1324`）——我寫 e2e 時真的被它 hang 住。
   是輪次 1 的既有 nit，我沒動它（範圍外）。

## 未驗證 / 做不到（如實寫）

- **整局的「玩家親眼看到」仍然沒有人完整走過。** 我做的是程式碼層與 socket 層的實跑，
  以及首頁／資遣名單的真 Chrome 檢查。**猝死演出好不好笑、四類卡面能不能不讀字辨識、整局節奏體感——
  這輪我一樣沒有驗過**，不要記成已解。CEO 要親自跑一局是對的。
- **`esc()` 的 30 個呼叫點沒有逐一目視。** 見自評 5。
- 我沒有用 `/browse`（subagent 叫不到 slash command），改用全域 `puppeteer@24.40.0` 驅動真的
  Chrome/146.0.7680.153。若團隊規範要求一律走 `/browse`，這幾張證據需要用 `/browse` 重跑一次。

## 順手發現（沒動）

1. **`server.js:428` 等把玩家名字組進 `r.note`，`index.html:791` 用 `${x.note}` 原樣塞進
   `innerHTML`（沒有 `esc()`）** → 暱稱可經由 note 做 HTML 注入。名字上限 12 字元，我沒找出 12 字元內
   能自動執行的 payload（`<svg/onload=x>` 要 14 字元），所以沒當成本批的洞。**但這是真的注入面，建議另開票。**
   （同型：`x.zoneName`、`p.title`、`k.title` 等也是不 esc 直接進 innerHTML，那些目前是伺服器常數。）
2. `server.js:1477` `httpServer.listen(PORT)` 沒綁 host → 監聽所有介面。**前面幾輪已經記過三次**（task.md:415／695／1154），
   我只是重複確認一次，沒動。
3. `tests/card-flow.test.cjs` 的 `assert.ok(checked>=180)` 仍是寬鬆斷言（輪次 3 nit），我沒動。
4. 機器上有一支 2026-09-08 起的 `node dev-server.js` 佔著 :3199（**別的專案**，不是這個 repo）。我沒碰它。

## 重現腳本（scratchpad，重開機會消失）
```
scratchpad/rev4/repro-attacks.js    三條既有 bug 的確定性重現（吃 server.js 路徑參數）
scratchpad/rev4/server.preedit.js   把我 10 處改動反轉還原的「修前」server（node --check 過；
                                    用它重跑 repro-attacks.js 會逐字重現 BEFORE 輸出）
scratchpad/rev4/nested-probe.js     704 組巢狀欄位探針（識別掃描 + 純淨度掃描）
scratchpad/rev4/xss-sink.js         真 Chrome：證明只加強 esc() 修不掉 inline handler
scratchpad/rev4/xss-e2e.js          真伺服器 + 真 Chrome + 真 renderPromoteFire() + 真滑鼠點擊
scratchpad/rev4/mp-game.js          真 socket 3 人多人局打完整 6 回合
scratchpad/rev2/mutate.js           突變測試（31 條；15 → 31）
scratchpad/rev4/cmp.txt / mutate-out.txt / xss-before.txt / xss-after.txt / mp-game2.txt   輸出留存
```

---

# 寫手回報 — 收尾兩項

狀態：**DONE_WITH_CONCERNS**（兩項都做完並實測；concerns 見下方自評，主要是「多人房沒實跑」與「技能對話框裡還有同型 disabled 鈕（範圍外沒動）」）

## 做了什麼

**① 死點擊（兩處）**
- 抽牌屏（`focus.js` 原 134 行）：把那顆最大的按鈕從「鎖住＋寫『先抽牌』」改成**真的去抽**——
  抽走 `focusDraw()`，跟畫面中間那疊牌堆同一個入口；抽完才換成「看懂了，開始選行動牌 →」。
  抽出 `footerStep(drawn,you)` 一個小函式，`paintDraw` 的模板只留一個呼叫。
  `!ST.adminReady`（老闆準備中）那個 disabled **原樣保留**（CEO 指定：那是合理的等待）。
- 同一個位置換手會產生新的坑：**連點兩下的第二下會打到剛換上去的下一步鈕**，把「看新手牌」那一拍跳掉。
  加了 600ms 冷卻（`READY_AFTER_DRAW_MS`），而且**明講原因**（`err('剛抽到的牌先看一眼…')`），不是靜默吃掉。
- 選牌屏（`focus.js` 原 175 行）：這顆沒辦法「替玩家選一張行動牌」（那會動到遊戲邏輯），所以走 CEO 列的第二條路：
  ① 文案 `先選行動牌` → `⬆ 先選上面的行動牌`（讀起來是狀態＋指路，不是 CTA）；
  ② **讓它可以按**——按下去 `submitEmp` 包一層 `nudgePickAction()`：行動牌區閃兩下金色＋捲進視線，
     錯誤訊息沿用本體既有的 `err('先選這回合要去哪／做什麼')`（`index.html:561`），所以一定看得到回饋；
  ③ 掛 `.needs-pick` 把它降一階視覺重量（不是本回合的主要動作）。選了牌之後 class 自動拿掉、恢復原本的綠色確認鈕。

**② 結算橫幅對比度 1.10:1 → 9.82:1**
- 病根：`.banner{color:var(--wood2)}`，但 `cards.css:2` 的 `:root` 把 `--wood2` 從 `#4a2c14`（深棕）
  換成 `#ece3c8`（淺奶油），配 `.card` 的 `#f4eddc` ＝ 淺字配淺底。這正是 `index.html:68` 那段註解警告過的坑。
- 依那段既有規矩**改寫死色碼**（不吃 token），並補一塊童話木框羊皮紙牌面（色彩語彙沿用同檔既有的 `.task` 卷軸與 `.kcard.lead` 金框）。
- **`.banner` 有沒有被共用：grep 過，全站只有 `index.html:371` 這一個節點在用**
  （另一條 `screen.css:16 #s-end .banner` 只設 padding/font-size）。仍照 CEO 指示只掛 `#endbanner`，
  並用 `#s-end #endbanner`（2,0,0）提高特異性，才蓋得過 `#s-end .banner`（1,1,0）的 padding。

## 碰過的檔

| 檔 | 改了什麼 |
|---|---|
| `public/focus.js` | `focusDraw/focusReady` 加抽完冷卻＋提示；新增 `footerStep()`；`paintDraw` footer 改呼叫它；`paintPreview` 改文案＋`needs-pick`＋解鎖；新增 `nudgePickAction()` 與 `submitEmp` 包裝 |
| `public/index.html` | `<style>` 三段新規則：`#s-end #endbanner`（橫幅牌面）、`#empsubmit.needs-pick`、`#empzones.nudge` + `@keyframes pickNudge` |

**沒碰**：`server.js`、`tests/`、`focus.css`、`cards.css`、`screen.css`、`menu.css`、`screen.js`、`cards.js`。

## 驗收對照

| 要求 | 結果 | 證據 |
|---|---|---|
| ① 抽牌屏不得有死點擊 | ✅ 按鈕現在直接抽牌 | `drawn:false→true`、`hand:0→2`、footer 自動換成下一步（見下方指令輸出） |
| ① 選牌屏不得有死點擊 | ✅ 可按且有回饋 | click 事件 `0→1`、`err` 出現、`#empzones` 加上 `nudge` 且背景實測 `rgba(217,165,32,0.306)` 動畫中 |
| ① `!adminReady` 的等待維持 disabled | ✅ 未動 | 抽完但老闆還沒好時實測 `["老闆準備中…\|d=true"]` |
| ② 對比度 ≥ 4.5:1 且要有數字 | ✅ **9.82:1（最差色階）** | 修前 **1.10:1** → 修後 9.82 / 11.37（漸層兩階）、10.83（對卡片底） |
| ② 兩種勝負都要截圖 | ✅ 真的打出來的兩局 | `after-08-endbanner-emp-win.png`（摸魚王結算）、`after-09-endbanner-boss-win.png`（「所有員工都出局了」） |
| ② 風格留在童話繪本／羊皮紙木框 | ✅ | 深棕字＋羊皮紙漸層＋木色外框＋金色內暈，與下方 `.kcard.lead` 金框同一組色 |
| 零新增 `!important` | ✅ | focus.css **10**、cards.css **3**、index.html **0**（`grep -o … \| wc -l`，與交辦數字一致） |
| 不動遊戲邏輯／規則／action | ✅ | 前端沒有新增任何 `sock.emit` 事件；`submitEmp` 包裝只在 `!empPick` 時做視覺提示後照樣呼叫本體 |
| T1 兩段式（act→summary） | ✅ | 送出後 `stage:"act"`、`board:"reveal-board-pane"`、`result:"…pane-off"`；等完 → `stage:"summary"` 兩者對調 |
| 跳過鈕 | ✅ | 點 `#skiprev` 後立刻 `stage:"summary"` |
| 同回合不重播 | ✅ | 揭曉中整頁 reload → `stage:"summary"`、`sessionStorage.moyu_reveal_seen="9K7U:1"`，沒有重播 act |
| 過勞警告橫幅 | ✅ | 連做 2/3 時 `#econbox` 出現「💀 再按一次「埋頭苦幹」就過勞猝死…」＋四個替代方案 |
| 猝死演出 | ✅ | `karoshi-scene beat1 beat2` + 截圖 `after-07-karoshi.png` |
| 三王結算 | ✅ | 兩局的 `#endkings` 都有 🐟/👻/🐮（含 boss win 時的「從缺」文案） |
| 48/48 綠 | ✅ | 見下 |

## 自評風險點（請 Codex 重點看這裡）

1. **`focus.js` 直接改 `$('empsubmit').disabled=false`**（`paintPreview`），而 `disabled=true` 是
   `index.html:759/765` 設的。兩處分屬不同檔、靠執行順序（focus.js 的 `renderEmpZones` 包在最外層）才成立。
   我確認過呼叫鏈 `pickEmp/toggleCard/setHold/toggleRisky/toggleHelp/setMooch → renderEmpZones(包裝版) → paintPreview`
   六個入口都會走到，但這仍是「靠順序」的耦合，**若之後有人在 focus.js 之後再包一層就會壞**。
2. **`submitEmp` 用全域重新指派包裝**（沿用本檔既有 `toggleCard`／`skipReveal`／`renderEmpZones` 的手法）。
   `index.html:317` 的 inline `onclick="submitEmp()"` 會查到新的那支——這點我實測過（click 後 err 出現、
   `#empzones` 拿到 `nudge`），但它依賴 inline handler 的作用域查找，不是最穩的寫法。
3. **600ms 冷卻是我挑的數字**。太短擋不住連點、太長會讓「真的想馬上走」的玩家吃到一次提示。
   幽靈回合的「開始幽靈回合 →」也走同一支 `focusReady()`，幽靈不抽牌所以時間戳一定是舊的（不會被擋）——
   實測 round 4 幽靈屏 `["開始幽靈回合 →|d=false"]` 正常。但這是「現況成立」不是結構上安全。
4. **抽牌屏現在有兩顆字面相同的「抽 N 張道具牌」**（中間牌堆 + 底部按鈕）。動作完全一樣，
   但螢幕閱讀器會聽到兩次近似的名字。我判斷「大按鈕真的能用」比「名字唯一」重要，若 Codex 不同意可改文案。
5. **多人房（`ST.solo===false`）沒有實跑。** 抽牌屏的改動只落在 `ST.solo` 分支（多人維持原本的
   `<span>抽完後，等待老闆開始回合。</span>`，一個字沒動）；但 **`#empsubmit` 的改動多人房也吃得到**。
   邏輯上與單人同路徑（`renderEmpZones → paintPreview`），我沒有第二個瀏覽器 session 去驗，**標未驗證**。
6. **`#empzones.nudge` 的背景閃爍靠「animation 的層級高於一般宣告」**壓過 `cards.css` 的
   `#s-game #empzones{background:none}`（後者特異性 2,0,0 比我的 1,1,0 高）。這是標準 CSS 行為、
   我也實測到 `rgba(217,165,32,0.306)`，但它是「靠 cascade 細節」而不是靠特異性贏，值得覆核。
   `prefers-reduced-motion` 會被 `cards.css:18` 關掉這個動畫——那時剩下的回饋只有錯誤訊息（我認為可接受）。
7. **`#empsubmit.needs-pick` 的字色對比**：`#fff8e5` 配漸層兩階實測 **4.69:1 / 6.55:1**（14px 800 粗體要 4.5:1）。
   第一版我寫的 `#8b7f5e` 只有 3.74:1，量出來才改深的——這條是量出來的，不是目測。

## 未驗證 / 做不到（如實寫）

- **多人房整局沒跑**（見自評 5）。
- **老闆／主管視角沒跑**：單人局人類固定是員工。我用讀碼確認 `renderEmpZones()` 只在
  `index.html:691`（存活、非老闆、非主管）那條分支被呼叫，所以 `#empsubmit` 不會被老闆/主管碰到——**這是讀碼結論，不是實測**。
- **「好不好懂」是我自己的判斷**：我證明的是「按下去有反應、看得見、不會誤送」，
  沒有第二個人試玩過「⬆ 先選上面的行動牌」這句話夠不夠白話。

## 順手發現（沒動）

1. **「角色技能（選用）」對話框裡還有 4 顆同型的 disabled 鈕**：`🎲 拼了！…`、`不憋氣`、`🫁 淺憋 30%`、`🫁 拚命憋 60%`
   （沒選摸魚區時全部 disabled）。實測輸出見下。它們的標籤有把理由寫在字面上（`（限💰+2以上的區）`），
   而且藏在標了「選用」的對話框裡，所以我判斷不是這次要修的「最大的按鈕」——**但species 相同，建議另開票**。
2. `GET /art/09_boss_end.jpg`、`GET /art/10_king_end.jpg` → **404**（結算頁美術圖槽缺圖）。
   由 `onerror` 自動收起，不影響版面，但 console 每次結算都會噴紅字。缺的是素材不是程式。
3. 手機寬度下錯誤訊息 `.err`（`position:sticky;top:8px;z-index:50`，來自 `cards.css:12`）會蓋住上方標題列一小塊。
   這是全站既有行為（每一則 err 都這樣），不是這次新增的。
4. `.banner` 這個 class 現在只剩 `#endbanner` 一個使用者；`.banner` 本體那條 `color:var(--wood2)`
   實質上已經是死宣告。我沒有刪（刪它超出範圍，而且哪天有人加第二個 banner 會需要）。

## 驗證證據（指令＋輸出）

**環境**：`PORT=3211 npm start`（`node server.js`，`127.0.0.1:3211`）／gstack `browse`（headless Chromium）／viewport 1280×900 與 390×844。

### 修前基準（同一支量測腳本）
```
# 抽牌屏那顆按鈕
$B js "…getComputedStyle/getBoundingClientRect…"
[{"text":"先抽牌","disabled":true,"pe":"auto","opacity":"0.45","w":400,"h":46,"area":18400}]

# 證明它是死的：程式 .click() 完全沒有事件、沒有狀態變化、沒有提示
{"before":{"clicks":0,"phase":"admin","drawn":false,"hand":0,"err":""},
 "after" :{"clicks":0,"phase":"admin","drawn":false,"hand":0,"err":""}}
# 真實滑鼠點擊（Playwright）：Operation timed out: click: Timeout 5000ms exceeded.（等不到可點狀態）

# 選牌屏那顆按鈕
{"text":"先選行動牌","disabled":true,"pe":"auto","opacity":"0.45","w":210,"h":65,"phase":"choosing"}
{"before":{"clicks":0,"err":""},"after":{"clicks":0,"err":"","submitted":false}}

# 結算橫幅
{"text":"🏆 員工陣營獲勝！","fg":"#ece3c8","bg":"#f4eddc","bgFrom":"card","ratio":1.1,
 "fontSize":"20px","fontWeight":"900","AA":false}
```
截圖：`evidence-final/before-01-draw-deadclick.png`、`before-02-choose-deadclick.png`、`before-06-endbanner-1.10.png`

### 修後 ①-抽牌屏（新玩家，清空 localStorage/sessionStorage 後從首頁走完）
```
$B snapshot -i
@e4 [button] "✦ 抽 2 張道具牌 點擊牌堆翻開 · 每回合一次"
@e5 [button] "抽 2 張道具牌"                     ← 不再是 [disabled]
[{"text":"抽 2 張道具牌","disabled":false,"pe":"auto","opacity":"1","w":400,"h":46}]

$B click ".draw-footer > button"
{"after":{"drawn":true,"hand":2,"roundDraw":2,
          "footer":["看懂了，開始選行動牌 →|disabled=false"],
          "newCards":["雞精加持","雞精加持"],"err":""}}
```
**連點兩下的保護**（第二下打到剛換上去的下一步鈕）：
```
$B click ".draw-footer > button" && $B click ".draw-footer > button"
{"phase":"admin","round":2,"drawn":true,
 "err":"剛抽到的牌先看一眼，再按「開始選行動牌」",
 "footer":["看懂了，開始選行動牌 →|d=false"]}      ← 沒有被跳過，仍停在抽牌屏
```
**`老闆準備中…` 的合理等待仍在**（開局 350ms 內抽牌，卡在 bot 還沒 ready 的窗口）：
```
{"t":0,"phase":"admin","adminReady":false,"drawn":false,"footer":["補給商店（選用）|d=false","抽 2 張道具牌|d=false"]}
        （抽完 250ms 後）
{"phase":"admin","adminReady":false,"drawn":true, "footer":["補給商店（選用）|d=false","老闆準備中…|d=true"]}
```
截圖：`after-01-draw-live-button.png`、`after-02-drawn-hand.png`、`after-05b-doubletap-guard-msg.png`、`after-12-mobile-draw.png`

### 修後 ①-選牌屏
```
{"phase":"choosing","text":"⬆ 先選上面的行動牌","disabled":false,"cls":"needs-pick",
 "color":"rgb(255, 248, 229)","opacity":"1","w":210,"h":65}
$B click "#empsubmit"
{"clicks":1,                                        ← 修前是 0
 "err":"先選這回合要去哪／做什麼",                     ← 看得見的文字回饋
 "zonesCls":"zones nudge","zonesBg":"rgba(217, 165, 32, 0.055)",   ← 行動牌區正在閃
 "submitted":false,"empPick":null}                  ← 沒有誤送出
# 選了牌之後自動復原：
{"text":"確認出「埋頭苦幹」","cls":"","disabled":false,"bgImage":"none","bg":"rgb(91, 103, 68)"}
# 指路鈕自己的字對比（14px/800，AA 需 4.5）
{"fg":"rgb(255, 248, 229)","stops":["rgb(122,111,82)","rgb(99,89,60)"],"ratios":[4.69,6.55],"worst":4.69}
```
**兩屏「可見的 disabled 按鈕」清查**（掃全頁 `<button>`，過濾看得見的）：
```
抽牌屏  {"phase":"admin",   "disabledVisible":[],"total":7}
選牌屏  {"phase":"choosing","disabledVisible":[],"total":16}
技能對話框（範圍外，順手發現 1）
  [{"t":"完成","dis":false},{"t":"🎲 拼了！…","dis":true},{"t":"不憋氣","dis":true},
   {"t":"🫁 淺憋 30%+1💓","dis":true},{"t":"🫁 拚命憋 60%+2💓","dis":true}]
```
截圖：`after-03-nudge-feedback.png`（桌機）、`after-10-mobile-choose.png`、`after-11-mobile-nudge.png`（390×844）

### 修後 ②-結算橫幅（量測腳本存檔：`evidence-final/measure-contrast.js`，可原樣重跑）
```
$B js "$(cat evidence-final/measure-contrast.js)"

員工勝（第 1 局，摸魚王＝🤖摸魚見習生）
{"text":"🏆 員工陣營獲勝！","fg":"#4a2c14","fontSize":"20px","fontWeight":"900",
 "backgrounds":[{"bg":"#fdf3cf","ratio":11.37},{"bg":"#f3e2b0","ratio":9.82}],
 "worst":9.82,"ancestor":"#f4eddc (card)","ancestorRatio":10.83,"AA":true}

老闆勝（第 3 局，reason：「所有員工都出局了」——真的打出來的，不是改狀態模擬）
{"text":"👔 老闆獲勝！","fg":"#4a2c14",…,"worst":9.82,"ancestorRatio":10.83,"AA":true}
```
**1.10 → 9.82（最差色階）／11.37（淺階）／10.83（對卡片底）**，全部 ≥ AA 4.5:1。
手機 390×844 再量一次同樣是 `worst 9.82`，牌面沒有溢出（`after-13-mobile-endbanner.png`）。
截圖：`after-08-endbanner-emp-win.png`、`after-09-endbanner-boss-win.png`、`after-13-mobile-endbanner.png`

### 回歸
```
T1 兩段式   送出後 {"phase":"reveal","stage":"act","board":"reveal-board-pane","result":"focus-result pane-off"}
            等完   {"stage":"summary","board":"reveal-board-pane pane-off","result":"focus-result",
                    "next":"看懂了，進入下一回合 →"}
跳過鈕      click #skiprev → {"stage":"summary","board":"…pane-off","result":"focus-result","title":"工作完成，領到薪水"}
同回合不重播 揭曉中整頁 reload → {"phase":"reveal","stage":"summary","seen":"9K7U:1"}（沒有重播 act）
過勞警告    連做 2/3 → "💀 再按一次「埋頭苦幹」就過勞猝死｜已連續工作 2/3 回合 · 免死金牌擋不住｜
                        改做下面任一項…🌿 回座休息／☕ 茶水間／🖨️ 影印間／🚻 廁所／🪟 頂樓"
            送出鈕同步變成 "仍要工作（會猝死）"、#play-slot 加上 lethal
猝死演出    {"stage":"act","kar":"karoshi-scene beat1 beat2","karTxt":"🧑‍💻👻過 勞 死你連續工作了 3 個回合…"}
三王        員工勝：🐟🤖摸魚見習生／👻阿寫／🐮阿寫   老闆勝：🐟從缺（「這局老闆提早收工…」）／👻阿寫／🐮從缺
console     只有既有的 art 404（09_boss_end.jpg／10_king_end.jpg），沒有 JS 例外
```
截圖：`after-04-reveal-act-skipbtn.png`、`after-06-overwork-warning.png`、`after-07-karoshi.png`

### 測試與 `!important` 計數
```
$ node --test tests/card-flow.test.cjs
ℹ tests 48   ℹ pass 48   ℹ fail 0   ℹ duration_ms 791.532        （改動前基準也是 48/48）

$ grep -o '!important' public/focus.css  | wc -l   →  10
$ grep -o '!important' public/cards.css  | wc -l   →   3
$ grep -o '!important' public/index.html | wc -l   →   0
（另外沒動到的：screen.css 8、menu.css 2）

$ node --check public/focus.js  → OK
```

**沒有 commit／push**（working tree 交給 CEO 分批 commit）。
截圖與量測腳本：`.team/20260913-情緒定型/evidence-final/`
