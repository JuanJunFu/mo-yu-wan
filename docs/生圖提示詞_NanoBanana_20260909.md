# 摸魚王 生圖提示詞總表（Nano Banana / Opal 用）2026-09-09

## 使用方法
1. 每張圖＝複製該條**完整提示詞**（主體＋風格＋負面已組好，一段到底）貼進 Opal。
2. 長寬比照每條標註設定（16:9／2:3 直式／1:1 方形）。
3. **角色一致性**：同一角色的圖，把第一張生好的圖丟給 Nano Banana 當參考圖再生下一張。
4. **去背類（PNG）**：提示詞已要求 `isolated on a plain solid light background`，生完用去背工具摳掉即可；若 Opal 支援直接輸出透明背景就直接開。
5. 生好後照檔名存進 `05_線上遊戲/public/art/`。
6. 鐵則：圖裡**不要有任何文字**（標題、數字、UI 字全部走 HTML）。

## ★ 分層原則（場景與人物分開）
對應 UI 規格的 Layer 架構（L1 環境／L4 角色）：
- **場景類（bg / env）＝一律空景**，提示詞尾都帶 `no people, no characters`；構圖刻意留空位給角色。
- **人物類（char / character）＝一律單人去背 PNG**，帶 `no background scenery`；一個姿勢一張。
- 畫面由前端疊圖合成（env 打底 → 角色 → 特效最上層），好處：角色可獨立做呼吸/晃動/震動動畫、換裝換姿勢不用重生整張場景、同一角色跨畫面一致。

---

## 共用風格塊（每條提示詞已內含，這裡列出供你微調）

**STYLE（固定）**
```
hand-painted watercolor and gouache, delicate hand-drawn ink outlines, slightly imperfect organic linework, aged parchment texture, visible paper grain, subtle watercolor bleeding, warm muted storybook palette of cream parchment, warm brown, soft green, dusty blue, muted red and golden yellow, vintage children's fairy-tale storybook illustration, cute exaggerated proportions, slightly oversized heads, small hands and feet, expressive faces, old wooden furniture, warm office interior, magical everyday objects, cozy clutter, cozy but mischievous atmosphere, adult workplace satire disguised as a children's fairy tale
```

**NEGATIVE（固定）**
```
no photorealism, no 3D render, no glossy mobile game UI, no anime, no cyberpunk, no futuristic office, no realistic corporate photography, no text, no letters, no numbers, no watermark, no logo
```

---

# 01 首頁 Home（★場景空景＋人物分層，前端疊圖）

### `home_bg_1920x1080.webp` ｜16:9｜空景（無人）
```
A magical workplace fairy-tale kingdom hidden inside an old enchanted office, completely empty of people, rows of wooden desks with magical paperwork, coffee cups and filing cabinets, warm golden light entering through tall windows, tiny magical particles floating in the air, large empty central space suitable for a game title, ornate storybook border, whimsical children's fairy-tale book cover, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, slightly imperfect organic linework, aged parchment texture, visible paper grain, subtle watercolor bleeding, warm muted storybook palette of cream parchment, warm brown, soft green, dusty blue, muted red and golden yellow, cozy but mischievous atmosphere, adult workplace satire disguised as a children's fairy tale — no photorealism, no 3D render, no glossy mobile game UI, no anime, no cyberpunk, no futuristic office, no realistic corporate photography, no text, no letters, no numbers, no watermark, no people, no characters
```

### `home_char_boss_search_768x1024.png` ｜3:4 直式｜去背（疊在封面右側，可做左右晃動動畫）
```
A comical strict fairy-tale office boss actively searching for slackers, leaning forward on tip-toes holding a giant golden magnifying glass up to one squinting eye, old-fashioned vest, tie and small round glasses, sneaky exaggerated hunting pose, full body, cute exaggerated proportions with slightly oversized head and small hands and feet, highly expressive suspicious face, isolated character on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, warm muted storybook palette with muted red and golden yellow accents, vintage children's storybook character illustration — no photorealism, no 3D render, no anime, no background scenery, no text, no watermark
```

### `home_char_slacker_desk_512x512.png` ｜1:1｜去背（疊在封面桌後，可做呼吸動畫）
```
A cute green goblin-like office worker secretly slacking while hiding behind a single wooden desk, only the upper body and mischievous peeking eyes visible above the desk edge, holding a snack in one hand, playful guilty grin, the desk itself included as part of the cutout, isolated on a plain solid light background, cute exaggerated proportions with slightly oversized head, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, warm muted storybook palette with soft green accents, vintage children's storybook character illustration — no photorealism, no 3D render, no anime, no background scenery, no text, no watermark
```

### `home_char_ghost_float_512x512.png` ｜1:1｜去背（疊在封面上空，可做漂浮動畫）
```
A cute translucent office ghost floating playfully in mid-air, softly glowing pale spirit still wearing a loose floating tie, tiny arms spread wide in a cheerful gliding pose, wispy tail trailing behind, small magical sparkles around it, isolated character on a plain solid light background, cute exaggerated proportions with slightly oversized head, cheeky expressive face, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, dusty blue and soft lavender muted storybook palette, vintage children's storybook character illustration — no photorealism, no 3D render, no anime, no scary horror elements, no background scenery, no text, no watermark
```

### `home_logo_transparent_1920x600.png` ｜16:5（生 16:9 再裁）｜去背
```
An ornate fairy-tale game logo emblem frame, a horizontal decorative wooden and golden banner ribbon with an empty blank center for a title, flanked by a cute golden fish wearing a tiny crooked paper crown on one side and a magical steaming coffee cup on the other, curling parchment scroll ends, small golden sparkles, carved wood texture with gold leaf accents, symmetrical composition, isolated on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, aged parchment texture, warm muted storybook palette of cream parchment, warm brown and golden yellow, vintage children's storybook ornament — no photorealism, no 3D render, no anime, no text, no letters, no numbers, no watermark
```
（中央留空，標題「摸魚王」由 HTML 疊上去）

### `home_decor_01.webp` ｜1:1｜去背
```
A single magical steaming coffee cup on a wooden desk corner, tiny golden stars rising with the steam, a small sleepy goblin-like office worker face reflected on the coffee surface, cozy clutter of paper clips and a quill beside it, isolated decorative object on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, aged parchment texture, warm muted storybook palette, vintage children's fairy-tale storybook illustration, magical everyday objects — no photorealism, no 3D render, no anime, no text, no watermark
```

### `home_decor_02.webp` ｜1:1｜去背
```
A wobbly stack of enchanted office paperwork tied with red string, a few pages fluttering away like little birds, a tiny wax seal glowing softly, a pencil stuck in the stack, isolated decorative object on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, aged parchment texture, warm muted storybook palette, vintage children's fairy-tale storybook illustration, magical everyday objects — no photorealism, no 3D render, no anime, no text, no watermark
```

---

# 02 Lobby 大廳

### `lobby_bg_1920x1080.webp` ｜16:9
```
A cozy enchanted office lounge from a whimsical workplace fairy tale, a large round wooden table surrounded by empty wooden chairs waiting for players, one grand mysterious boss chair at the head of the table, coffee cups, paperwork, office plants, glowing magical lanterns hanging from wooden beams, warm cozy evening atmosphere before a secret game begins, wide composition with clear empty central space for UI elements, vintage children's storybook illustration, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, slightly imperfect organic linework, aged parchment texture, visible paper grain, warm muted storybook palette of cream parchment, warm brown, soft green, dusty blue and golden yellow, fantasy board game aesthetic, cozy but mischievous atmosphere — no photorealism, no 3D render, no glossy mobile game UI, no anime, no futuristic office, no text, no letters, no watermark, no people
```

### `lobby_boss_chair_600x400.png` ｜3:2｜去背
```
A grand comically imposing boss office chair from a fairy-tale kingdom, dark carved wood with worn red velvet cushion, golden trim and tiny decorative crown carved on the headrest, a faint golden magical aura, slightly crooked and overworn in a humorous way, isolated on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, aged parchment texture, warm muted storybook palette, vintage children's storybook object illustration — no photorealism, no 3D render, no anime, no text, no watermark, no people
```

### `character_player_generic_512x768.png` ｜2:3 直式｜去背
```
A cute generic office worker character from a whimsical workplace fairy tale, full body standing pose, friendly green goblin-like office clerk wearing a slightly rumpled shirt and loose tie, holding a paper folder, playful secretive glance to the side, cute exaggerated proportions with slightly oversized head and small hands and feet, expressive face, isolated character on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, slightly imperfect organic linework, warm muted storybook palette, vintage children's storybook character illustration — no photorealism, no 3D render, no anime, no text, no watermark
```

### `lobby_decor_01.png` ｜1:1｜去背
```
A hanging magical lantern made of brass and warm glowing amber glass, tiny golden fireflies drifting around it, a small paper charm tied to its hook, isolated decorative object on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, aged parchment texture, warm muted storybook palette, vintage children's fairy-tale storybook illustration — no photorealism, no 3D render, no anime, no text, no watermark
```

### `lobby_decor_02.png` ｜1:1｜去背
```
A cheerful potted office plant with slightly magical oversized leaves, one leaf holding a tiny sleeping fairy, terracotta pot with a hairline crack repaired with golden kintsugi, isolated decorative object on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, warm muted storybook palette of soft green and warm brown, vintage children's fairy-tale storybook illustration — no photorealism, no 3D render, no anime, no text, no watermark
```

---

# 03/04 遊戲桌與選擇行動 Choose

### `choose_bg_1920x1080.webp` ｜16:9
```
An enchanted office floor transformed into a whimsical fairy-tale board game map, five connected cozy locations forming a playful winding path: employee desks area, copy machine room, tea corner, bathroom door, and a rooftop under the moon, wooden game-board elements and carved path tiles connecting the zones, ornate fantasy map border, warm parchment texture, top-down three-quarter perspective, clear readable spatial composition with generous empty space inside each zone for UI markers, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, slightly imperfect organic linework, aged parchment texture, visible paper grain, warm muted storybook palette of cream parchment, warm brown, soft green, dusty blue and golden yellow, vintage children's storybook, cozy but mischievous atmosphere — no photorealism, no 3D render, no glossy mobile game UI, no anime, no futuristic office, no text, no letters, no watermark, no people
```

### `choose_zone_desk_512x512.png` ｜1:1
```
A cozy employee desk seat zone from a fairy-tale office board game, a worn wooden desk with neat paperwork, a small safe warm glow, a comfy chair, framed as a square location tile illustration, centered composition, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, aged parchment texture, warm muted storybook palette of cream parchment and soft green, vintage children's storybook illustration, magical everyday objects — no photorealism, no 3D render, no anime, no text, no watermark, no people
```

### `choose_zone_copy_512x512.png` ｜1:1
```
A magical old copy machine room zone from a fairy-tale office board game, a chunky vintage copy machine with a slightly mischievous face, papers floating out like butterflies, soft dusty blue shadows perfect for hiding, framed as a square location tile illustration, centered composition, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, aged parchment texture, warm muted storybook palette, vintage children's storybook illustration, magical everyday objects — no photorealism, no 3D render, no anime, no text, no watermark, no people
```

### `choose_zone_tea_512x512.png` ｜1:1
```
A cozy tea corner zone from a fairy-tale office board game, a wooden counter with a magical steaming kettle, oversized bubble tea cups glowing with tiny stars, hanging mugs and a small snack shelf, inviting warm golden light, framed as a square location tile illustration, centered composition, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, aged parchment texture, warm muted storybook palette of golden yellow and warm brown, vintage children's storybook illustration — no photorealism, no 3D render, no anime, no text, no watermark, no people
```

### `choose_zone_bathroom_512x512.png` ｜1:1
```
A whimsical office bathroom door zone from a fairy-tale board game, an old wooden door slightly ajar with warm light spilling out, a cute towel and a small potted plant beside it, a faint sense of a perfect hiding spot with mild risk, muted red accent, framed as a square location tile illustration, centered composition, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, aged parchment texture, warm muted storybook palette, vintage children's storybook illustration — no photorealism, no 3D render, no anime, no text, no watermark, no people
```

### `choose_zone_rooftop_512x512.png` ｜1:1
```
A dreamy office rooftop zone at dusk from a fairy-tale board game, a wooden bench under a big soft moon, drifting clouds, a string of tiny lanterns, distant chimneys, the most relaxing yet most dangerous slacking spot, dusty blue night palette with golden moonlight, framed as a square location tile illustration, centered composition, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, aged parchment texture, warm muted storybook palette, vintage children's storybook illustration — no photorealism, no 3D render, no anime, no text, no watermark, no people
```

---

# 05 Reveal 揭曉

### `reveal_bg_1920x1080.webp` ｜16:9
```
A dramatic magical reveal moment inside a whimsical fairy-tale office, a single golden theatrical spotlight cutting through warm dusty air, papers frozen mid-flight everywhere, desks pushed aside forming an open stage-like center, long comic shadows, tense but humorous storybook climax atmosphere, large empty central space for characters and UI, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, slightly imperfect organic linework, aged parchment texture, visible paper grain, warm muted storybook palette with dramatic golden yellow and muted red accents, vintage children's storybook illustration — no photorealism, no 3D render, no glossy mobile game UI, no anime, no futuristic office, no text, no watermark, no people
```

### `reveal_boss_768x1024.png` ｜3:4 直式｜去背
```
A comical strict fairy-tale office boss dramatically pointing forward with one finger, the other hand holding a giant golden magnifying glass, exaggerated triumphant expression shouting, old-fashioned vest and tie, full body dynamic pose leaning forward, cute exaggerated proportions with slightly oversized head, isolated character on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, warm muted storybook palette with muted red and golden yellow accents, vintage children's storybook character illustration, comic surprise energy — no photorealism, no 3D render, no anime, no text, no watermark
```

### `reveal_caught_employee_768x1024.png` ｜3:4 直式｜去背
```
A cute green goblin-like office worker frozen in comic shock at being caught slacking, wide startled eyes, drink still in hand mid-sip, papers dropping from the other hand, stiff full body pose like a statue, sweat drops and small shock lines around the head, cute exaggerated proportions with slightly oversized head, isolated character on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, warm muted storybook palette, vintage children's storybook character illustration, children's storybook climax humor — no photorealism, no 3D render, no anime, no text, no watermark
```

### `reveal_escape_employee_768x1024.png` ｜3:4 直式｜去背
```
A cute green goblin-like office worker secretly celebrating a narrow escape, smug relieved grin, wiping forehead with one hand, the other hand making a tiny victory fist close to the chest, sneaky tip-toe full body pose, small golden sparkles of relief around them, cute exaggerated proportions with slightly oversized head, isolated character on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, warm muted storybook palette, vintage children's storybook character illustration, playful workplace comedy — no photorealism, no 3D render, no anime, no text, no watermark
```

### `reveal_effect_catch_1024x1024.png` ｜1:1｜去背
```
A magical golden catch effect burst, a radiant spotlight beam cone with sparkling stars and swirling ink flourishes, a glowing ornate ring at the base like a magic circle drawn in gold leaf, papers caught swirling inside the light, pure effect element with no characters, isolated on a plain solid dark background for easy compositing, hand-painted watercolor and gouache texture, delicate hand-drawn ink outlines, golden yellow and warm amber palette, vintage children's storybook magic effect — no photorealism, no 3D render, no anime, no lens flare, no text, no watermark
```

---

# 06 任務 Task

### `task_bg_1920x1080.webp` ｜16:9
```
An old wooden office desk seen from above at a gentle angle inside a fairy-tale office, warm desk lamp glow, a quill, ink pot, coffee cup, wax seals and neat stacks of magical paperwork arranged around the edges, large calm empty space in the center-left for a floating scroll and on the right for UI panels, tiny magical sparkles, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, aged parchment texture, visible paper grain, warm muted storybook palette of cream parchment, warm brown and golden yellow, vintage children's storybook illustration, fairy-tale workplace quest aesthetic — no photorealism, no 3D render, no anime, no text, no letters, no watermark, no people
```

### `task_scroll_768x1024.png` ｜3:4 直式｜去背
```
An enchanted quest scroll unrolled vertically, ornate parchment with gently curling wooden rollers at top and bottom, faint glowing golden progress notches along one edge, delicate ink flourish borders, the central writing area left completely blank, tiny magical sparkles drifting off the paper, isolated object on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, aged parchment texture with visible paper grain, warm muted storybook palette of cream parchment, warm brown and golden yellow, vintage children's storybook illustration, board game card aesthetic — no photorealism, no 3D render, no anime, no text, no letters, no numbers, no watermark
```

### `task_completed_stamp_512x512.png` ｜1:1｜去背
```
A round golden wax seal stamp of approval glowing softly, embossed with a simple crown-over-fish emblem, tiny paper confetti and sparkles bursting around it, slightly tilted playful angle, isolated object on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, golden yellow and muted red palette, vintage children's storybook illustration — no photorealism, no 3D render, no anime, no text, no letters, no watermark
```

### `task_deadline_hourglass_512x768.png` ｜2:3 直式｜去背
```
A magical antique hourglass with a carved wooden frame, glowing golden sand falling fast, a faint worried face subtly formed in the swirling sand, small red warning glow at the base, tiny sparks of urgency around it, isolated object on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, warm muted storybook palette with golden yellow and muted red accents, vintage children's storybook illustration — no photorealism, no 3D render, no anime, no text, no numbers, no watermark
```

---

# 07 場景卡 Scene（示範一組，其餘場景卡日後照此格式：空景＋人物分開）

### `scene_teaparty_env_768x960.png` ｜4:5 直式｜空景（無人）
```
An absurd magical office tea party scene, office desks pushed together and transformed into a cheerful celebration table covered with oversized bubble tea drinks glowing with tiny stars, snack plates, scattered paperwork pushed aside, a filing cabinet standing at one side, warm festive lantern light, generous empty spots left around the table for characters to be composited in, centered composition as a premium fantasy board game scene card artwork, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, aged parchment background, warm whimsical muted storybook palette, children's fairy-tale storybook illustration, high detail — no photorealism, no 3D render, no glossy mobile game UI, no anime, no text, no watermark, no people, no characters
```

### `scene_char_teaparty_worker_512x768.png` ｜2:3 直式｜去背
```
A cute green goblin-like office worker happily holding up an oversized bubble tea drink glowing with tiny stars with both hands, blissful delighted expression with closed happy eyes, small celebratory hop pose, full body, cute exaggerated proportions with slightly oversized head and small hands and feet, isolated character on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, warm whimsical muted storybook palette, children's fairy-tale storybook character illustration — no photorealism, no 3D render, no anime, no background scenery, no text, no watermark
```

### `scene_char_boss_peek_512x768.png` ｜2:3 直式｜去背
```
A comical strict fairy-tale office boss peeking suspiciously from behind an imaginary corner, body leaning sideways with only half the body visible in the pose, one raised eyebrow over small round glasses, hands gripping the edge of an unseen wall, old-fashioned vest and tie, cute exaggerated proportions with slightly oversized head, highly expressive doubting face, isolated character on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, warm muted storybook palette with muted red accents, children's fairy-tale storybook character illustration — no photorealism, no 3D render, no anime, no background scenery, no text, no watermark
```

---

# 08 角色卡 Character（★同一角色請用參考圖串聯保持一致）

### `character_card_frame_1024x1536.png` ｜2:3 直式｜去背
```
An ornate golden fantasy trading card frame, empty transparent center window, carved wood and gold leaf border with tiny coffee cup and fish and crown motifs in the corners, a blank ribbon plaque at the bottom for a name, aged parchment inner edge, symmetrical vertical card composition, isolated frame on a plain solid light background with the center left completely empty, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, warm muted storybook palette of warm brown and golden yellow, vintage children's storybook card design — no photorealism, no 3D render, no anime, no text, no letters, no watermark, no characters inside the frame
```

### `character_senior_512x768.png`（老鳥）｜2:3 直式｜去背
```
A veteran office worker character from a whimsical fairy-tale kingdom, a confident tired middle-aged green goblin-like clerk with heavy eyelids and a subtle mischievous smile, old-fashioned cardigan over a shirt and loose tie, holding a coffee cup exactly like a legendary warrior holding a sword, a tiny magical golden shield charm floating beside him, full body standing pose radiating calm experience, cute exaggerated proportions with slightly oversized head and small hands and feet, highly expressive face, isolated character on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, warm vintage muted storybook palette, children's storybook character illustration — no photorealism, no 3D render, no anime, no text, no watermark
```

### `character_junior_512x768.png`（菜鳥）｜2:3 直式｜去背
```
A rookie office worker character from a whimsical fairy-tale kingdom, a young eager nervous green goblin-like clerk with big sparkling eyes, crisp brand-new shirt with sleeves slightly too long, clutching a comically oversized employee badge and a notebook, one bead of sweat, full body slightly tip-toe pose ready to dash off and slack, cute exaggerated proportions with slightly oversized head and small hands and feet, highly expressive face, isolated character on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, warm vintage muted storybook palette with soft green accents, children's storybook character illustration — no photorealism, no 3D render, no anime, no text, no watermark
```

### `character_boss_512x768.png`（老闆）｜2:3 直式｜去背
```
A comical strict boss character from a whimsical fairy-tale office kingdom, a stout imposing figure in an old-fashioned vest, tie and small round glasses, holding a giant golden magnifying glass like a royal scepter, suspicious narrowed eyes scanning for slackers, a tiny crooked golden crown pin on the vest, full body authoritative standing pose, cute exaggerated proportions with slightly oversized head and small hands and feet, highly expressive stern-but-silly face, isolated character on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, warm vintage muted storybook palette with muted red accents, children's storybook character illustration — no photorealism, no 3D render, no anime, no text, no watermark
```

### `character_supervisor_512x768.png`（代理主管）｜2:3 直式｜去背
```
A temporary supervisor character from a whimsical fairy-tale office kingdom, a green goblin-like office worker suddenly promoted, wearing an oversized ceremonial armband and holding a small clipboard and a tiny brass whistle, torn expression between pride and guilt while watching coworkers suspiciously from the corner of the eye, full body stiff patrol pose, cute exaggerated proportions with slightly oversized head and small hands and feet, highly expressive conflicted face, isolated character on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, warm vintage muted storybook palette with dusty blue accents, children's storybook character illustration — no photorealism, no 3D render, no anime, no text, no watermark
```

### `character_ghost_512x768.png`（幽靈）｜2:3 直式｜去背
```
A cute translucent office ghost character from a whimsical fairy-tale kingdom, a softly glowing pale spirit of a former office worker still wearing a floating loose tie, playful mischievous grin, tiny arms raised in a gentle spooky pose, wispy tail instead of legs, small magical sparkles drifting around, full floating body, cute exaggerated proportions with slightly oversized head, highly expressive cheeky face, isolated character on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, dusty blue and soft lavender muted storybook palette, children's storybook character illustration — no photorealism, no 3D render, no anime, no scary horror elements, no text, no watermark
```

---

# 09/10 結算 Result

### `result_bg_1920x1080.webp` ｜16:9
```
A grand fairy-tale ending scene inside a magical office at golden hour, warm cinematic golden light pouring through tall windows, gentle rain of tiny paper confetti, desks and paperwork softly blurred at the edges, a subtle glowing stage-like center left empty for a winner illustration and large UI text, celebratory yet cozy storybook final chapter atmosphere, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, aged parchment texture, visible paper grain, warm muted storybook palette rich in golden yellow and cream, vintage children's fairy-tale illustration — no photorealism, no 3D render, no glossy mobile game UI, no anime, no text, no watermark, no people
```

### 結局＝空景＋人物分層合成（★前端疊圖：env 打底 → 角色 PNG → confetti 特效最上層）

**摸魚王勝**＝`result_env_paper_mountain` ＋ `result_char_king`（山頂）＋ `result_char_cheer_worker`（山腳）＋ `result_char_boss_defeated`（背景）＋ `result_confetti`
**老闆勝**＝`result_bg` ＋ `result_char_boss_trophy`（中央）＋ `result_char_worker_exhausted`（兩側）＋ `result_confetti`
**平手/其他**＝`result_bg` ＋ `result_char_boss_defeated` ＋ `result_char_worker_exhausted` ＋ 桌上小紙皇冠（可用 CSS/emoji）

### `result_env_paper_mountain_1024x1024.webp` ｜1:1｜空景（無人）
```
A gigantic comical mountain of stacked office paperwork rising like a fairy-tale peak inside a magical office, thousands of paper sheets, folders and binders piled into a towering summit with a flat spot on top left empty for a character, a few loose pages drifting off like snow, warm cinematic golden light from tall windows behind, tiny glowing fish-shaped symbols floating in the air, epic centered composition with generous empty sky space, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, aged parchment texture, warm muted storybook palette rich in golden yellow and cream, children's fairy-tale storybook final page — no photorealism, no 3D render, no anime, no text, no watermark, no people, no characters
```

### `result_char_king_768x1024.png`（摸魚王）｜3:4 直式｜去背
```
The ultimate office slacker champion, a proud green goblin-like worker standing triumphantly with legs apart, holding a golden coffee cup high overhead like a championship trophy, wearing a tiny crooked paper crown, chest puffed out, playful triumphant grin, full body victorious pose, cute exaggerated proportions with slightly oversized head and small hands and feet, highly expressive face, isolated character on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, warm muted storybook palette with golden yellow accents, children's fairy-tale storybook character illustration, whimsical workplace satire — no photorealism, no 3D render, no anime, no background scenery, no text, no watermark
```

### `result_char_boss_trophy_768x1024.png`（老闆勝姿）｜3:4 直式｜去背
```
The victorious comical fairy-tale office boss standing proudly with chest out, holding up a golden trophy shaped like a rolled completed task scroll with both hands, old-fashioned vest, tie and small round glasses, dramatic but humorous triumphant expression with a single proud tear, full body victory pose, cute exaggerated proportions with slightly oversized head and small hands and feet, isolated character on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, warm muted storybook palette with muted red and golden yellow accents, children's fairy-tale storybook character illustration, epic workplace comedy — no photorealism, no 3D render, no anime, no background scenery, no text, no watermark
```

### `result_char_boss_defeated_512x768.png`（老闆敗姿）｜2:3 直式｜去背
```
The defeated comical fairy-tale office boss sitting dramatically slumped on the floor, tie loosened and askew, small round glasses sliding down the nose, the giant golden magnifying glass lying abandoned beside him, deep theatrical sigh with a small storm cloud over his head, full body slumped pose, cute exaggerated proportions with slightly oversized head, highly expressive exaggerated despair that stays humorous, isolated character on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, warm muted storybook palette with muted red accents, children's fairy-tale storybook character illustration — no photorealism, no 3D render, no anime, no background scenery, no text, no watermark
```

### `result_char_cheer_worker_512x768.png`（歡呼同事）｜2:3 直式｜去背
```
A cute green goblin-like office worker cheering with both arms raised high, jumping mid-air with pure joy, tie flying up, sparkling admiring eyes looking upward, full body celebratory jump pose, cute exaggerated proportions with slightly oversized head and small hands and feet, isolated character on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, warm muted storybook palette with soft green accents, children's fairy-tale storybook character illustration — no photorealism, no 3D render, no anime, no background scenery, no text, no watermark
```

### `result_char_worker_exhausted_512x768.png`（累癱同事）｜2:3 直式｜去背
```
A cute green goblin-like office worker completely exhausted, slumped forward asleep over an imaginary desk edge, arms dangling, a tiny snot bubble and small dizzy stars over the head, a coffee cup tipped over beside the hand, gentle satisfied smile despite exhaustion, cute exaggerated proportions with slightly oversized head, isolated character on a plain solid light background, hand-painted watercolor and gouache, delicate hand-drawn ink outlines, warm muted storybook palette, children's fairy-tale storybook character illustration, cozy workplace comedy — no photorealism, no 3D render, no anime, no background scenery, no text, no watermark
```

### `result_confetti_1024x1024.png` ｜1:1｜去背
```
A celebratory magical confetti effect element, drifting tiny paper sheets, golden sparkles and small glowing fish-shaped symbols scattered across the frame, light airy composition with plenty of empty space between particles, pure effect overlay with no characters and no background scenery, isolated on a plain solid dark background for easy compositing, hand-painted watercolor and gouache texture, delicate hand-drawn ink outlines, golden yellow, cream and muted red palette, vintage children's storybook magic effect — no photorealism, no 3D render, no anime, no lens flare, no text, no watermark
```

---

## 建議生圖順序（角色一致性優先）
1. **先生 `character_boss` 和 `character_player_generic`**（一老闆＋一隻 goblin 員工站姿）→ 這兩張定調全套角色長相，是全案的「角色錨」。
2. 之後**所有人物姿勢圖都掛角色錨當參考圖**再生：
   - 老闆系：`home_char_boss_search`／`reveal_boss`／`scene_char_boss_peek`／`result_char_boss_trophy`／`result_char_boss_defeated`
   - 員工系：`home_char_slacker_desk`／`reveal_caught_employee`／`reveal_escape_employee`／`scene_char_teaparty_worker`／`result_char_king`／`result_char_cheer_worker`／`result_char_worker_exhausted`／`character_senior`／`character_junior`／`character_supervisor`
   - 幽靈系：`character_ghost` → `home_char_ghost_float`
3. 空景七張（home_bg/lobby_bg/choose_bg/reveal_bg/task_bg/result_bg/result_env_paper_mountain）互相參考，鎖第一張生好的當風格錨。
4. 物件與效果類（decor/scroll/stamp/hourglass/frame/confetti/zone tiles）最後生，最不挑一致性。

## 檔名對照（分層後人物清單，前端疊圖用）
| 畫面 | 空景 | 疊上去的人物/特效 |
|------|------|------------------|
| 首頁 | `home_bg` | `home_char_boss_search`＋`home_char_slacker_desk`＋`home_char_ghost_float` |
| 大廳 | `lobby_bg` | `character_player_generic`（每位玩家一隻）＋`lobby_boss_chair` |
| 選擇 | `choose_bg` | `choose_zone_*` 五張地點磚 |
| 揭曉 | `reveal_bg` | `reveal_boss`＋`reveal_caught_employee`＋`reveal_escape_employee`＋`reveal_effect_catch` |
| 任務 | `task_bg` | `task_scroll`＋`task_deadline_hourglass`＋`task_completed_stamp` |
| 場景卡 | `scene_teaparty_env` | `scene_char_teaparty_worker`＋`scene_char_boss_peek` |
| 角色卡 | `character_card_frame` | `character_senior/junior/boss/supervisor/ghost` |
| 結局·摸魚王 | `result_env_paper_mountain` | `result_char_king`＋`result_char_cheer_worker`＋`result_char_boss_defeated`＋`result_confetti` |
| 結局·老闆勝 | `result_bg` | `result_char_boss_trophy`＋`result_char_worker_exhausted`＋`result_confetti` |
| 結局·其他 | `result_bg` | `result_char_boss_defeated`＋`result_char_worker_exhausted` |
