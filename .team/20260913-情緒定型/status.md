# 狀態 20260913-情緒定型

目前狀態：**coding**

<!-- 狀態流轉：todo → coding → review → fixing → qa → done（或 blocked） -->

## 流轉紀錄

- 2026-09-13 CEO 兩路程式盤點完成（後端系統/回合流程、前端首局體驗），全部證據附 `檔:行`
- 2026-09-13 CEO 寫 task.md；老闆三輪工程審查追加約束 C1/C2/C3
- 2026-09-13 CEO 自我修正：原「加班令致必死」判斷**錯誤**，經查證 `idle` 在加班令下合法（`server.js:1083,373-374,345,570-572`），已推翻並更新 task.md
- 2026-09-13 老闆裁決 Q1（節奏只砍回合數）、Q2（四類卡 mooch 留）、Q3（素材不在本機）→ task.md 無待決項
- 2026-09-13 **派活 wave 1**：
  - 阿寫-A → T1 掀開揭曉演出（`public/focus.js` `focus.css` `index.html`）
  - 阿寫-D → T5 三王結算+故事書 / T6 砍回合數（`server.js` `tests/`）
  - 兩者檔案不重疊，平行執行
- wave 2（待 A 完成）：T2+T3（focus.js/cards.*）、T4（screen.js/cards.css/art）

## 老闆裁決紀錄（2026-09-13，T5 回報後）

| 議題 | 寫手做法 | 老闆裁決 |
|---|---|---|
| `ranking[].title` 王位稱號蓋掉原 7 種個性稱號 | 蓋掉 | **維持現狀（王位優先）**。CEO 原建議並存，被否決 |
| 牛馬王「讓賢」（摸魚王若同時工作最多就換人） | 自行加入 | **退回，照實頒**。task.md 明令不加規則；且讓賢會把「你做最多」的笑點讓掉 |
| 三王事蹟 `deed` 前端看不到（`renderEnd` 沒讀 `kings`） | 做不到（不在其檔案範圍） | **CEO 直接排進 wave 2**，不另外問老闆——那是 T5 的另一半 |

CEO 已透過 SendMessage 把①③④派回原寫手（②不用改）。

## CEO 自驗（不轉述寫手說詞）

- `node --test tests/card-flow.test.cjs` → **16/16 綠**（原 7 項零退化）
- `git diff server.js | grep -E "ADMIN_SEC|CHOOSE_SEC|REVEAL_SEC"` → **無輸出**，秒數常數確實沒被動
- `checkWin` diff 為 `@@ -483,0 +491,103 @@` → **純新增，本體零修改**
- 回合數：`-  room.config.rounds=opts.rounds||(n<=3?6:8)` / `+  room.config.rounds=opts.rounds||(room.solo?4:6)` → 符合裁決

## 派活紀錄

| Wave | 子任務 | 負責 | 檔案範圍 | 狀態 |
|---|---|---|---|---|
| 1 | T1 掀開揭曉演出 | 阿寫-A | `public/focus.js` `public/focus.css` `public/index.html` | coding |
| 1 | T5+T6 三王/故事書/回合數 | 阿寫-D | `server.js` `tests/card-flow.test.cjs` | coding |
| 2 | T2+T3 過勞提示/四類卡面 | 待派 | `public/focus.js` `public/cards.*` `public/index.html` | todo |
| 2 | T4 美術可見性/圖槽 | 待派 | `public/screen.js` `public/cards.css` `public/art/README.md` | todo |

---

## Codex 三輪審查結果（2026-09-13）

| 輪次 | 判定 | Blocker | 結果 |
|---|---|---|---|
| 1 | FAIL | B3（payload null 改變行為）／B4（C4 鏡像破了，猝死回合差 2900ms）／B5（搞鬼王歸因沒比對 target）／B7（空區高度突跳） | 四條全修 |
| 2 | FAIL | B3-2（`isPayloadObject` 放行 Buffer／TypedArray／Date） | 修正為跨 realm 安全的 POJO 檢查 |
| 3 | FAIL | B3-D（`KAROSHI_MS` 擷取繞過 comment-aware，註解可造成假綠）＋ Codex 另開 3 條 | 見下 |

**輪次 3 的關鍵判讀**：Codex 新開的 4 條裡，**3 條經審核官比對 HEAD 確認是既有 bug**（`ZONES[zone]` 那段在 `HEAD:1086` 與 `WORK:1357` 逐字相同），非本批迴歸。審核官並抓到 Codex 一處事實錯誤（「結算改用 Set」——`new Set(bossZones)` 在 `HEAD:320` 就有）。
反方向事實：HEAD 有 29 個裸 `socket.on` 零防護，`submitChoice({zones:<非陣列>})` 在 HEAD 會殺掉整個 process，在本批被 guard 接住——**這塊本批是淨改善**。

## 老闆裁決（2026-09-13，三輪後升級）

1. **修補範圍**：B3-D ＋ 三條既有 bug（zone 型別混淆作弊／`__proto__` 癱瘓／`rounds` 零驗證）＋ XSS，一次修完
2. **完整走局**：由 CEO 親自跑，不再只靠寫手分段驗證

## 收尾批次（進行中）

單一寫手，範圍 `server.js`／`tests/`／`public/index.html`（僅 XSS 那處）。
交付後 CEO 跑完整一局實機驗收，再決定是否 commit。

## 🔴 三輪都未解、不得記成已解

**沒有任何人完整玩過一局。** 猝死演出好不好笑、四類卡面能否不讀字分辨、整局體感——這是本批最高驗收問題「玩家是否親眼看到」的直接缺口。Codex 原話：「VM/fake DOM 只證明排程控制流與毫秒數，不證明真瀏覽器的 layout、動畫、背景分頁 throttling、重連或整局體感。」

## 待辦（老闆未裁決，記為下一批候選）

- **摸魚王悖論**：6 局實測 4 局的摸魚王同時是牛馬王（67%）。4 回合局裡穩定薪水可能勝過機率摸魚 → 這款叫「摸魚王」的遊戲最佳解可能是不要摸魚。建議 4 vs 6 vs 8 回合各 20 局對照實測再決定
- **抽牌／選牌兩屏的比例**：wave3 只量了揭曉屏。行動卡 448px 中 `.card-art` 佔 304px（68%）、資訊文字 105px（23%），是否算留白需設計師用 §8.2 方法判定
- **C4 契約結構性修法**：前端完全不讀 server 的 `revealAnimMs`，契約靠人自律。寫手建議新增 `public/reveal-timing.js` 讓兩邊共讀一份時序表，需同時改三個檔，排在版面定稿後
- `#endbanner` 對比度 1.10:1（既有）
