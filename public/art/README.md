# 美術圖槽（storybook artwork slots）

把生成好的圖丟進本資料夾（檔名照下表），前端會自動顯示；**缺圖時圖槽自動收起、不影響遊戲**（這條契約本次〔T4〕重新用瀏覽器實測過，見下方各列說明）。
生圖 prompt 與風格規範見 `04_美術素材/美術指導_童話繪本風_20260909.md`（每張都要帶「固定＋禁止」段）。

> 2026-09-13（T4）更新：下面的行號是這次盤點當下讀到的內容。`focus.css`／`focus.js`／`index.html`
> 這次是另外兩位寫手同時在改的檔案，行號之後很可能會再漂移——對不上時請照 class 名稱／函式名重新
> grep，不要死板照號數找。

## 全頁背景與場景插畫

| 檔名 | 畫面 | 現況（已接線） |
|------|------|--------|
| `01_cover.jpg` | 首頁封面（16:9，中央留白放標題） | ⚠️ 多處接線，狀態不一：① 首頁大圖 `#art-home`（`index.html:209`）目前仍被 `cards.css:11` 的 `#s-home>#art-home{display:none}` 蓋住——**這條不是本回合範圍，指派給另一位寫手處理，不用等它**；② 已被當成模式選單頂部插畫背景 `.menu-story-art`（`focus.js:293-294` 建立節點、`focus.css:4,15,18` 給樣式）；③ 已被裁切成三個角色頭像（見下方「獨立角色圖槽」一節） |
| `02_lobby.jpg` | Lobby 大廳（冒險前夜） | ✅ 大廳頂部 `#art-lobby`（`index.html:249`）**本回合〔T4〕解除隱藏**：原本 `screen.js:137` 把它和 `art-end`、`rules-lobby` 一起強制 `pane-off`，現在只留 `rules-lobby`（規則摺疊區，跟美術無關，維持收起）。另外也被拿去當全站背景圖（`focus.css:2` `body{background:...url('/art/02_lobby.jpg')...}`）與抽牌畫面裝飾（`focus.css:8` 的 `.draw-deck`／`.new-card-art`） |
| `03_board.jpg` | ~~遊戲桌童話棋盤~~ → **實際是行動卡插圖精靈圖（sprite sheet）**，橫向切 5～6 格對應每種行動 | ✅ 已接線（**這欄原本寫「預留」是舊的，已過時，這次一併修正**）：`focus.css:6` 的 `.card-art.scene-art{background-image:url('/art/03_board.jpg');background-size:500% auto}`，再用 `.scene-work`／`.scene-idle`／`.scene-tea`／`.scene-copy`／`.scene-toilet`／`.scene-roof` 六組 `background-position` 切格；由 `focus.js` 的 `renderEmpZones` override（約 `focus.js:186`）動態幫每張行動卡的 `.card-art` 加上 `scene-art scene-<action>` class 挑對格子 |
| `04_choose.jpg` | 偷偷做決定 | 預留（`grep -rn "04_choose" public/` 零結果，尚無任何程式碼引用） |
| `05_reveal.jpg` | 揭曉戲劇場面 | 預留（零引用） |
| `06_task.jpg` | 魔法任務卷軸（直式） | 預留（零引用） |
| `07_scene.jpg` | 場景卡（直式卡面） | 預留（零引用） |
| `08_character.jpg` | 角色卡（直式卡面） | 預留（零引用；跟下面新增的「獨立角色圖槽」是兩回事，不要搞混——這張原本設計給的是直式卡面插圖，不是頭像） |
| `09_boss_end.jpg` | 結局：老闆勝 | ✅ 接線存在，**檔案本體目前不存在**：`renderEnd()`（約 `index.html:886`）依 `winner.side` 把 `#art-end-img`（`index.html:358`）的 `src` 動態換成本檔或下一列的 `10_king_end.jpg`；本回合〔T4〕解除了 `screen.js:137` 對 `#art-end` 的隱藏後，已用瀏覽器實測確認：檔案不存在時 `onerror="this.parentNode.style.display='none'"` 會自動把圖槽收起，**不會留空白框**，結算頁其餘內容照常顯示 |
| `10_king_end.jpg` | 結局：摸魚王 👑 | 同上一列，勝方為員工陣營（`winner.side!=='boss'`）時使用 |

## 獨立角色圖槽（老闆／一般員工／幽靈）—— 新增命名，素材未到，先佔位

**現況**：目前沒有三張獨立、透明背景的角色圖。老闆／員工／幽靈頭像全部是用**同一張 `01_cover.jpg` 裁固定位置**模擬出來的：`.story-portrait` class（基礎規則＋位置目前分散在 `focus.css` 約第 5、16 行兩處，第 16 行是後蓋的 override，實際生效值以它為準）搭配 `focus.js` 的 `stampCharacter(role)`（約 `focus.js:96`）產生 `<span class="story-portrait employee|boss|ghost">`。這組 class 同時餵三個地方的頭像：座位列小頭像（32px）、揭曉個人總結對戰頭像（90px）、幽靈回合大頭像（140px）——**共用同一張源圖**，換圖時三處會一起換，不用分開改。

**⚠️ 老闆已明確更正過一次，別重蹈覆轍**：老闆提到的 `concepts/character-and-map-sheet.png`（commit `5215711`，目前不在本機／本 clone／遠端）是**三個角色畫在同一張的合成示意圖，不是可以直接套用的透明角色圖**。合成圖沒辦法直接當 `background-image` 用（會把老闆、員工、幽靈三個一起塞進同一個頭像框裡），**必須先請美術／生圖流程切成三張「各自獨立、背景透明」的 PNG，才能對進下面的檔名**。

**新增圖槽命名**（延續現有 `01`～`10` 的兩位數編號慣例，接續 `11`起；用 `.png` 是因為要透明背景，跟其他滿版場景圖的 `.jpg` 不同）：

| 檔名 | 角色 | 建議規格 |
|------|------|----------|
| `11_char_boss.png` | 老闆（🤖鵝霸老闆／玩家扮演的老闆通用一張） | 透明背景，單一角色半身或全身立繪，直式構圖，主體置中偏上（會被裁成圓形頭像，四角留白不重要，中心一定要是臉/主體） |
| `12_char_employee.png` | 一般員工（**不分老鳥🦉／菜鳥🐣**——目前程式碼沒有依職級分開頭像，`stampCharacter()` 一律回傳 `'employee'`，做兩張也不會被接上，除非之後有人改程式碼） | 同上規格 |
| `13_char_ghost.png` | 幽靈（心悸爆表出局後的員工） | 同上規格；可以帶一點半透明／飄浮感呼應「幽靈」設定，但**檔案本身仍要是不透明背景以外都透明**的角色 PNG，不要整張圖都調成半透明（會跟後面疊的舊裁切圖混在一起分不清楚） |

**接線點（寫給下一個接手美術的人；本回合〔T4〕的檔案範圍只有 `screen.js` 和本檔，沒有動 `focus.css`／`focus.js`，所以下面這段 CSS 目前還沒有真的貼進程式碼，先把規格寫死在這裡，複製貼上即可上線）**：

把 `focus.css` 裡 `.story-portrait.employee`／`.story-portrait.boss`／`.story-portrait.ghost` 這三條規則的 `background-image` 改成「新圖在上、`01_cover.jpg` 舊裁切在下」的兩層寫法——CSS 的 `background-image` 本來就支援逗號分隔多層，**上層 404 時瀏覽器會直接透出下層**，不用另外寫 JS 判斷：

```css
.story-portrait.employee{background-image:url('/art/12_char_employee.png'),url('/art/01_cover.jpg');background-size:cover,auto 190%;background-position:center,11% 64%}
.story-portrait.boss{background-image:url('/art/11_char_boss.png'),url('/art/01_cover.jpg');background-size:cover,auto 190%;background-position:center,85% 43%}
.story-portrait.ghost{background-image:url('/art/13_char_ghost.png'),url('/art/01_cover.jpg');background-size:cover,auto 190%;background-position:center,28% 12%}
```

效果：
- 三張新圖都到位 → 直接顯示新圖，舊的裁切被蓋在下面看不到，**不用刪任何既有程式碼**。
- 只做出一部分（例如只有老闆）→ 還沒做的那幾個 class 第一層 404，自動透出下面那層（舊的 `01_cover.jpg` 裁切），**不會破圖、不會空白**，符合本檔最上面「缺圖自動收起、不影響遊戲」的契約，只是退回成目前這種「合成裁切」的樣子而已。

（上面 `01_cover.jpg` 那層的座標是抄目前 `focus.css` 第 16 行 override 之後的**生效值**；貼進去之前請先重新 grep 一次 `.story-portrait.employee` 確認沒有被其他人再調過，尤其現在 `focus.css` 還在被別的寫手改。）
