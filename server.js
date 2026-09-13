// 摸魚王 · 線上房間遊戲（Phase 4：幽靈行動 + 藉口/道具手牌；含 Phase3 主管/罩學弟/資遣、Phase2 任務系統與綜合評分）
const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const { Server } = require('socket.io');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const io = new Server();
app.use(express.static(path.join(__dirname, 'public')));

// ---------- 常數 ----------
// 四區分數梯度拉開（2026-09-11 試玩回饋）：風險報酬遞增，每區都有選的理由
const ZONES = {
  office: { name: '辦公室', slack: 0, anxiety: 0, safe: true },
  tea:    { name: '茶水間', slack: 1, anxiety: 1 },
  copy:   { name: '影印間', slack: 2, anxiety: 1 },
  toilet: { name: '廁所',   slack: 3, anxiety: 2 },
  roof:   { name: '頂樓',   slack: 4, anxiety: 3 },
};
const SLACK_ZONES = ['tea', 'copy', 'toilet', 'roof'];
const ADJ = { office:['copy'], copy:['office','tea'], tea:['copy','toilet'], toilet:['tea','roof'], roof:['toilet'] };
// 🔴 2026-09-13 Codex 輪次 3 B3-A／B3-B（HEAD 就有的缺陷，老闆裁決本批一起修）：
//    客戶端送 key 進來查表**一律**要走這裡，不能直接靠 `table[k]` 的真假值判斷，因為
//    ① 隱式轉字串：`ZONES[['tea']]`／`ZONES[Buffer('tea')]` 都拿得到茶水間 → 驗證過關，
//       但**原本的陣列／Buffer 被原樣存進 room.choices**，結算時 `inspected.has(zone)` 是嚴格比對
//       → 老闆明明巡了那一區卻抓不到人（實測 +2💰 白拿）。
//    ② 原型鏈：`ZONES['__proto__']` 是 Object.prototype（truthy）→ 驗證過關 →
//       結算走到 `for(const adj of ADJ[zone])` 丟 TypeError → 整間房 phase 永遠卡在 choosing。
//    hasOwnProperty 用 Object.prototype.call 呼叫：查的表自己不一定有這個方法。
function hasKey(table, k){ return (typeof k==='string'||typeof k==='number') && Object.prototype.hasOwnProperty.call(table, k); }
function isZoneKey(z){ return typeof z==='string' && Object.prototype.hasOwnProperty.call(ZONES, z); }
const ANXIETY_OUT_DEFAULT = 6;
const TASK_NEED = 4, TASK_DEADLINE = 3;
const CHOOSE_SEC = 45, ADMIN_SEC = 45;
const REVEAL_SEC = 15;        // 揭曉頁停留秒數（自動進下一回合）
const REVEAL_MIN_SKIP = 5;    // 房主最少看幾秒才能跳過
const PROMOTE_COOLDOWN = 3;   // 升職令冷卻
const SUPERVISOR_TERM = 2;    // 主管任期
const HELP_COOLDOWN = 2;      // 老鳥罩學弟冷卻
const BOSS_FIRES = 2;         // 老闆每局資遣次數（管理點）
const GHOST_COOLDOWN = 2;     // 幽靈行動冷卻（每 2 回合可作祟一次）
const START_HAND = 2;         // 開局手牌
const HAND_LIMIT = 3;         // 手牌上限
const MAX_ROOMS = 10;               // 房間總數上限（防濫用閥；單機記憶體實際撐得更多）
const MAX_ROUNDS = 20;              // 自訂局數上限（純輸入驗證閥；預設仍是 solo 4／多人 6，前端不送 rounds）
const LOBBY_IDLE_MS = 30*60*1000;   // 等待中房間閒置 30 分回收
const ENDED_IDLE_MS = 5*60*1000;    // 遊戲結束後 5 分回收
const ABANDON_MS = 5*60*1000;       // 遊戲中全員真人離線 5 分回收（保留重連窗口）

const TASKS = [
  '幫全辦公室買飲料（記 12 種客製）','印 500 頁報告（釘歪重印）','回一封「收到」CC 全公司',
  '參加三小時廢會（email 就能解決）','照顧老闆的多肉並寫日誌','做一份沒人看的週報',
  '喬印表機卡紙（其實沒紙）','辦不熟同事的驚喜生日會','打字老闆的醜手稿','訂便當記住每人不吃什麼',
  '找五年前沒人記得檔名的檔案','改簡報第 38 版','教主管用新系統','整理 900 個「新增資料夾」',
  '回一星負評要有溫度','幫老闆搶演唱會票','寫道歉信給奧客','統計午餐問卷',
];

// 藉口/道具卡：藉口＝被抓時自動觸發；道具＝暗選時出牌、結算時生效
const CARD_DEFS = {
  excuse: { icon:'🗣️', kind:'passive', name:'藉口', desc:'被抓時自動使用：這次不算、不加心悸' },
  energy: { icon:'🧃', kind:'item', name:'提神飲料', desc:'出牌：本回合結算心悸 −2' },
  jam:    { icon:'🖨️', kind:'item', name:'影印機卡紙', desc:'出牌：老闆本回合隨機少巡一區' },
  boost:  { icon:'💪', kind:'item', name:'雞精加持', desc:'出牌：本回合摸魚成功分數 +2' },
  overtime:{ icon:'🕘', kind:'boss', name:'加班令', desc:'指定 1 名員工本回合不能摸魚；他認真做可領加班費 +2💰 但過勞 +1💓' },
  mooch:  { icon:'🙏', kind:'item', name:'凹同事', desc:'出牌指定同事：他這回合認真工作的話，薪水歸你、任務也幫你推 1（他白做工）' },
};
// ---------- 點數經濟（2026-09-11 MVP）：💰=偷懶點數（也是王位分數）、老闆用部門經費 ----------
const PRICES = { excuse:3, energy:3, jam:2, boost:3, overtime:3, mooch:2 }; // energy/boost≥3：天然匯率約2-3💰/💓，低於此=套利洞
const WORK_WAGE = 1; // 認真工作有薪水！不可以白嫖——除非被同事凹
const WORK_STREAK_LIMIT = 3; // 連續工作三回合過勞猝死；改做其他行動即中斷
const OT_REFUSE_COST = 3;     // 付 3💰「請假開溜」拒絕加班
// 憋氣機制（A′ 限縮版）：只有菜鳥能憋（老鳥走免死金牌線）；💓 計價＝天然凸成本自我節流
const HOLD_COST  = { 30:1, 60:2 };  // 淺憋+1💓=30%、拚命憋+2💓=60%（無論老闆來不來都扣＝防無腦刷）
const FOCUS_COST = { 30:1, 60:2 };  // 老闆「緊盯」：−1經費=30%、−2經費=60%，每回合限 1 區
const SHOP_SEC = 10;          // 單人模式 bot 老闆行政時的補給採購窗口
const BREATHE_COST = 3;       // 深呼吸：3💰 洗 1💓（限心悸≥門檻-2、每回合 1 次——防無限農場）
const RISKY_ANX = 2;          // 賭命衝刺：無論成敗 +2💓，摸魚成功分 ×2
const BOSS_START_BUDGET = 3;  // 老闆開局部門經費；員工每完成 1 件任務 +1
function buildMarketDeck(){
  const d=[]; // 河道只放員工卡；加班令＝老闆專屬固定供應槽（不靠運氣翻）
  for(let i=0;i<5;i++) d.push({type:'excuse', name:EXCUSE_NAMES[i%EXCUSE_NAMES.length]});
  for(let i=0;i<4;i++) d.push({type:'energy', name:CARD_DEFS.energy.name});
  for(let i=0;i<3;i++) d.push({type:'jam', name:CARD_DEFS.jam.name});
  for(let i=0;i<4;i++) d.push({type:'boost', name:CARD_DEFS.boost.name});
  for(let i=0;i<2;i++) d.push({type:'mooch', name:CARD_DEFS.mooch.name});
  return d;
}
function refillMarket(room){ while(room.market.length<3&&room.marketDeck.length) room.market.push(room.marketDeck.shift()); }
const EXCUSE_NAMES = ['肚子痛先閃','幫客戶送件','電腦當機重開','去修印表機','幫老闆買咖啡','量個體溫'];
function buildCardDeck(){
  const deck = [];
  for (const n of EXCUSE_NAMES) deck.push({ type:'excuse', name:n });
  for (let i=0;i<4;i++) deck.push({ type:'energy', name:CARD_DEFS.energy.name });
  for (let i=0;i<3;i++) deck.push({ type:'jam', name:CARD_DEFS.jam.name });
  for (let i=0;i<4;i++) deck.push({ type:'boost', name:CARD_DEFS.boost.name });
  for (let i=0;i<2;i++) deck.push({ type:'mooch', name:CARD_DEFS.mooch.name });
  return deck;
}
function drawCard(room, p){
  if (!room.cardDeck.length || p.hand.length >= HAND_LIMIT) return null;
  const c = room.cardDeck.shift(); p.hand.push(c); return c;
}
function drawRoundHand(room, p){
  if(p._drawnRound===room.round || p.role!=='emp' || !p.alive) return [];
  p._drawnRound=room.round; p.roundDraw=[];
  const count=room.round===1?START_HAND:1;
  for(let i=0;i<count;i++){const c=drawCard(room,p);if(c)p.roundDraw.push(c);}
  return p.roundDraw;
}
const GHOST_ACTIONS = { haunt:'👻 騷擾老闆', warn:'📞 通風報信', disrupt:'🌀 打斷協查' };

// ---------- c-lite 單人模式：老闆行為模式卡（開局翻給員工看＝「讀 AI」的樂趣） ----------
const BOSS_PATTERNS = {
  routine: { name:'輪班表老闆', hint:'照表巡：☕→🖨️→🚻→🪟 輪著來' },
  hunter:  { name:'記仇老闆',   hint:'愛查上回有人得逞的地方' },
  lazy:    { name:'佛系老闆',   hint:'多半只巡 ☕茶水 🖨️影印' },
  chaos:   { name:'陰晴不定老闆', hint:'完全隨機，看心情' },
};
const BOT_EMP_ROSTER = [ ['greedy','🤖薪水小偷'], ['steady','🤖乖乖牌'], ['swing','🤖薛丁鵝'], ['greedy','🤖摸魚見習生'] ];
const BOT_BOSS_NAME = '🤖鵝霸老闆';

const rooms = new Map();

// ---------- 工具 ----------
function code4(){ const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<4;i++)s+=c[Math.floor(Math.random()*c.length)]; return s; }
function newRoomCode(){ let c; do{c=code4();}while(rooms.has(c)); return c; }
function shuffle(a){ const b=[...a]; for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];} return b; }
function log(room,msg){ room.log.push(msg); if(room.log.length>60)room.log.shift(); }
// 大事記：供終局生成「本局故事」（結構化事件，與 log 分開）
function chron(room,ev){ if(!room.chronicle)room.chronicle=[]; if(room.chronicle.length<200) room.chronicle.push({round:room.round,...ev}); }
function touch(room){ room.lastActivity=Date.now(); }
function lobbySnapshot(){
  return [...rooms.values()].filter(r=>!r.solo).sort((a,b)=>b.createdAt-a.createdAt).map(r=>({
    code:r.code, name:r.name, players:r.players.size, max:6,
    locked:!!r.password, inGame:r.phase!=='lobby',
  }));
}
// 玩家身分 = 獨立 playerId（uuid），socket 只是可替換的傳輸管道（斷線重連 rebind、bot 可為 null）
function newPid(){ return crypto.randomUUID().replace(/-/g,'').slice(0,16); }
function mkPlayer(pid,socket,name){ return { id:pid, socket, name, connected:true, isBot:false, role:null, seniority:null, workStreak:0,
  alive:true, isGhost:false, slackCount:0, points:0, anxiety:0, immunity:0, lastZone:null, task:null,
  isSupervisor:false, supTermLeft:0, helpCooldown:0, canBeFired:false, voiceOn:false,
  hand:[], ghostCooldown:0 }; }
function humanConnected(room){ return [...room.players.values()].some(p=>!p.isBot&&p.connected); }
function bossOf(room){ for(const p of room.players.values()) if(p.role==='boss') return p; return null; }
function aliveEmps(room){ return [...room.players.values()].filter(p=>p.role==='emp'&&p.alive); }

// ---------- 計時器 ----------
function clearTimer(room){ if(room._timer){ clearTimeout(room._timer); room._timer=null; } room.timerEndsAt=null; }
function startTimer(room,sec,onExpire){ clearTimer(room); room.timerEndsAt=Date.now()+sec*1000; room._timer=setTimeout(()=>{ room._timer=null; room.timerEndsAt=null; onExpire(); }, sec*1000); }

// ---------- 視角 ----------
function viewFor(room, pid){
  const me = room.players.get(pid);
  const boss = bossOf(room);
  const players = [...room.players.values()].map(p=>({
    id:p.id, name:p.name, role:p.role, seniority:p.seniority, alive:p.alive, isGhost:p.isGhost,
    slackCount:p.slackCount, anxiety:p.anxiety, points:p.points, connected:p.connected, isBot:!!p.isBot,
    hasTask:!!p.task, isSupervisor:p.isSupervisor, canBeFired:p.canBeFired, isHost:p.id===room.hostId,
    submitted: room.phase==='choosing' ? (p.role==='boss' ? room.choices.boss!=null : (room.choices.emp[p.id]!=null)) : false,
  }));
  return {
    code:room.code, name:room.name||null, phase:room.phase, round:room.round, rounds:room.config.rounds,
    bossInspect:room.config.bossInspect, anxietyOut:room.config.anxietyOut, completeThreshold:room.config.completeThreshold,
    tasksIssued:room.tasksIssued, tasksDone:room.tasksDone, timerEndsAt:room.timerEndsAt||null, revealSkipAt:room.revealSkipAt||null,
    revealAnimMs:room.revealAnimMs||0, // server 推算的演出時長；倒數已含這段，前端要對齊可讀它（現有前端不讀也無妨）
    zones:ZONES, slackZones:SLACK_ZONES, solo:!!room.solo, adminReady:!!room.adminReady, workStreakLimit:WORK_STREAK_LIMIT,
    market: (room.market||[]).map(c=>({type:c.type,name:CARD_DEFS[c.type].name,icon:CARD_DEFS[c.type].icon,desc:CARD_DEFS[c.type].desc,price:PRICES[c.type]||2,bossOnly:c.type==='overtime'})),
    bossPattern: room.bossPattern ? { key:room.bossPattern, name:BOSS_PATTERNS[room.bossPattern].name, hint:BOSS_PATTERNS[room.bossPattern].hint } : null,
    supervisorName: room.supervisorId ? (room.players.get(room.supervisorId)||{}).name : null,
    you: me ? {
      id:me.id, name:me.name, role:me.role, seniority:me.seniority, alive:me.alive, isGhost:me.isGhost,
      slackCount:me.slackCount, anxiety:me.anxiety, points:me.points, lastZone:me.lastZone, immunity:me.immunity,
      workStreak:me.workStreak||0,
      isSupervisor:me.isSupervisor, supTermLeft:me.supTermLeft, helpCooldown:me.helpCooldown, canBeFired:me.canBeFired,
      task: me.task ? {name:me.task.name,progress:me.task.progress,need:me.task.need,deadlineLeft:me.task.deadlineLeft,state:me.task.state} : null,
      submitted: me.role==='boss' ? room.choices.boss!=null : (room.choices.emp[me.id]!=null),
      isHost: me.id===room.hostId,
      hand: me.hand.map(c=>({type:c.type, name:c.name, icon:CARD_DEFS[c.type].icon, kind:CARD_DEFS[c.type].kind, desc:CARD_DEFS[c.type].desc})),
      drawnThisRound:me._drawnRound===room.round,
      drawCount:Math.min(room.round===1?START_HAND:1,HAND_LIMIT-me.hand.length,room.cardDeck.length),
      roundDraw:(me._drawnRound===room.round?me.roundDraw||[]:[]).map(c=>({type:c.type,name:c.name,...CARD_DEFS[c.type],name:c.name})),
      budget: me.budget||0, bought: me._boughtRound===room.round, breathed: me._breathedRound===room.round,
      overtime: me._otRound===room.round,
      ghostCooldown: me.ghostCooldown,
      ghostActed: !!(room.choices.ghost&&room.choices.ghost[me.id]),
      ghostTargets: (me.isGhost&&room.phase==='choosing') ? aliveEmps(room).map(e=>({id:e.id,name:e.name})) : [],
      // 老鳥可罩的學弟（本回未在冷卻）
      juniors: (me.role==='emp'&&me.seniority==='senior'&&me.helpCooldown===0&&!me.isSupervisor)
        ? aliveEmps(room).filter(e=>e.seniority==='junior'&&!e.isSupervisor).map(e=>({id:e.id,name:e.name})) : [],
    } : null,
    players,
    admin: room.phase==='admin' ? {
      taskLeft: room.taskDeck.length,
      needTask: aliveEmps(room).filter(p=>!p.task&&!p.isSupervisor).map(p=>({id:p.id,name:p.name})),
      canPromote: room.promoteCooldown===0,
      promotable: room.promoteCooldown===0 ? aliveEmps(room).filter(p=>!p.isSupervisor).map(p=>({id:p.id,name:p.name})) : [],
      fireable: aliveEmps(room).filter(p=>p.canBeFired).map(p=>({id:p.id,name:p.name})),
      bossFires: room.bossFires,
      supervisorName: room.supervisorId ? (room.players.get(room.supervisorId)||{}).name : null,
    } : null,
    reveal: (room.phase==='reveal'||room.phase==='ended') ? room.lastReveal : null,
    winner: room.winner||null, log: room.log.slice(-14), zoneStreak: room.zoneStreak,
  };
}
function broadcast(room){ for(const p of room.players.values()){ if(p.connected&&p.socket) p.socket.emit('state', viewFor(room,p.id)); }
  if(room.spectators&&room.spectators.size){ const sd=specView(room); for(const s of room.spectators.values()) s.socket.emit('spec', sd); } }
// 觀戰視角：只給文字流程，不含任何玩家暗選資訊
function specView(room){ return { code:room.code, name:room.name||null, phase:room.phase, round:room.round,
  rounds:room.config.rounds, players:room.players.size, log:room.log.slice(-30) }; }

// ---------- 開局 ----------
function startGame(room, opts){
  const ids=[...room.players.keys()];
  if(ids.length<3) return { error:'至少需要 3 人（1 老闆 + 2 員工）' };
  let bossId=room.hostId;
  if(opts.bossMode==='random') bossId=ids[Math.floor(Math.random()*ids.length)];
  else if(opts.bossId&&room.players.has(opts.bossId)) bossId=opts.bossId;
  if(room.solo&&room.soloBossId&&room.players.has(room.soloBossId)) bossId=room.soloBossId; // 單人模式：老闆固定是腳本 bot
  const empIds=ids.filter(i=>i!==bossId);
  const seniorCount=Math.max(1,Math.floor(empIds.length/2));
  const seniorSet = opts.seniorityMode==='random' ? new Set(shuffle(empIds).slice(0,seniorCount)) : new Set(empIds.slice(0,seniorCount));
  for(const p of room.players.values()){
    p.role=(p.id===bossId)?'boss':'emp';
    p.seniority=p.role==='emp'?(seniorSet.has(p.id)?'senior':'junior'):null;
    p.alive=true; p.isGhost=false; p.slackCount=0; p.points=0; p.anxiety=0; p.lastZone=null; p.task=null;
    p.immunity=(p.seniority==='senior')?1:0; p.isSupervisor=false; p.supTermLeft=0; p.helpCooldown=0; p.canBeFired=false;
    p.hand=[]; p._drawnRound=0; p.roundDraw=[]; p.workStreak=0; p.ghostCooldown=0; p.otCount=0;
    p.workCount=0; p.wageEarned=0; p.moochedCount=0; // 牛馬王選材計數器（終局頒獎用，不進結算）
  }
  room.cardDeck=shuffle(buildCardDeck());
  // 補給市場（三張河道）＋老闆部門經費
  room.marketDeck=shuffle(buildMarketDeck()); room.market=[]; refillMarket(room);
  for(const p of room.players.values()){ p.budget=(p.id===bossId)?BOSS_START_BUDGET:0; p._boughtRound=0; p._breathedRound=0; p._otRound=0; }
  const n=ids.length;
  // 節奏（2026-09-13 裁決）：單人＝3 分鐘試玩入口 4 回合；多人是社交場 6 回合。只砍回合數，秒數不動。
  // 🔴 Codex 輪次 3 B3-C：`opts.rounds||預設` 對 rounds 零驗證。實測 `{rounds:{}}` → 終局判定
  //    （server.js `room.round>=room.config.rounds`）永遠命中不了＝這局**不會結束**；`{rounds:[]}` → 第 1 回合就結束。
  //    只收合理範圍內的正整數，其餘一律回退到預設（前端從來不送 rounds，只有測試／自訂客戶端會送）。
  const wantRounds=Number.isInteger(opts.rounds)?opts.rounds:0;
  room.config.rounds=(wantRounds>=1&&wantRounds<=MAX_ROUNDS)?wantRounds:(room.solo?4:6);
  room.config.bossInspect=(n<=3)?2:1;
  room.config.anxietyOut=(n>=6)?5:ANXIETY_OUT_DEFAULT;
  // 同一類：`{low,mid,high}['__proto__']` 是 Object.prototype（truthy），會讓門檻變成一個物件
  //   → `rate>=completeThreshold` 永遠 false（老闆再怎麼拚業績都不可能贏）、畫面顯示 NaN%。
  const TH={low:0.6,mid:0.7,high:0.8};
  room.config.completeThreshold=hasKey(TH,opts.threshold)?TH[opts.threshold]:0.7;
  room.taskDeck=shuffle(TASKS); room.tasksIssued=0; room.tasksDone=0;
  room.round=1; room.zoneStreak={}; room.winner=null; room.log=[]; room.chronicle=[];
  room.supervisorId=null; room.promoteCooldown=0; room.bossFires=BOSS_FIRES;
  log(room, `遊戲開始！老闆是【${room.players.get(bossId).name}】，${room.config.rounds} 回合，老闆查 ${room.config.bossInspect} 區，業績門檻 ${Math.round(room.config.completeThreshold*100)}%。`);
  // bot 老闆開局翻「行為模式卡」給員工看（讀 AI 的樂趣）
  room.bossPattern = room.players.get(bossId).isBot ? shuffle(Object.keys(BOSS_PATTERNS))[0] : null;
  if(room.bossPattern) log(room, `📇 老闆行為模式卡：【${BOSS_PATTERNS[room.bossPattern].name}】— ${BOSS_PATTERNS[room.bossPattern].hint}`);
  enterAdmin(room);
  return { ok:true };
}

function enterAdmin(room){
  room.phase='admin'; room.adminReady=false; room.choices={emp:{},boss:null,ghost:{}};
  for(const p of room.players.values()) if(p.isBot) drawRoundHand(room,p);
  const b=bossOf(room);
  // 真人老闆沒有任何行政事項可辦 → 直接開工，省掉全員枯等
  if(b&&!b.isBot){
    const needTask=room.taskDeck.length>0&&aliveEmps(room).some(p=>!p.task&&!p.isSupervisor);
    const canFire=room.bossFires>0&&aliveEmps(room).some(p=>p.canBeFired);
    const canPromote=room.promoteCooldown===0&&!room.supervisorId&&aliveEmps(room).some(p=>!p.isSupervisor);
    if(!needTask&&!canFire&&!canPromote){
      log(room, `— 第 ${room.round} 回合：老闆沒有行政事項，直接開工 —`);
      enterChoose(room); return;
    }
  }
  log(room, `— 第 ${room.round} 回合：老闆行政（派工作／升職／資遣）—`);
  if(room.solo) clearTimer(room);
  else startTimer(room, ADMIN_SEC, ()=>{ enterChoose(room); broadcast(room); });
  if(b&&b.isBot) scheduleBotAdmin(room);
  scheduleBotEconomy(room);
}
function enterChoose(room){
  for(const p of room.players.values()) drawRoundHand(room,p);
  room.phase='choosing'; room.choices={emp:{},boss:null,ghost:{}};
  if(room.solo) clearTimer(room);
  else startTimer(room, CHOOSE_SEC, ()=>{
    for(const e of aliveEmps(room)) if(room.choices.emp[e.id]==null) room.choices.emp[e.id]= e.isSupervisor?{action:'supervise',zone:null}:{action:'idle',zone:'office'};
    if(room.choices.boss==null) room.choices.boss={zones:[]};
    resolveRound(room); broadcast(room);
  });
  scheduleBots(room);
}

// ---------- 揭曉演出時長推算 ----------
// 🔴 前後端耦合警告：這是 `public/index.html` 的 `playReveal()`（揭曉演出）時序的**鏡像**，兩邊必須同步。
//    前端逐段累加（見 public/index.html 的 playReveal 與結尾的 revAnimEndsAt）：
//      ② 員工滑入各區    500 + n*140
//      ③ 事件跑馬燈      + g*350 + 300
//      ④ 老闆手電筒      + 1100
//      ⑤ 個人結果        + n*220 + 700 +（有人待在被巡查區 ? 1600 屏息 : 0）
//      ⑥ 戰果總結淡入    + n*120 + 1200（尾巴留給人看完）
//      → 合計 3800 + n*480 + g*350 + (危險 ? 1600 : 0)
//    n＝本回合有結果的員工數、g＝事件跑馬燈則數、危險＝有非主管員工待在被巡查區。
//    ⑦ 💀 過勞猝死演出（public/focus.js 的 playKaroshi）：它「接在」上面那段之後再多播一截，
//       所以不在 playReveal 的 t 裡，必須單獨加（2026-09-13 Codex 輪次 1 B4：漏了這段，猝死回合早 2.9 秒起算）。
//    ⚠️ 只要有人改了 playReveal 或 playKaroshi 的時序，這裡就會失準（後果只是倒數早／晚開始，不會壞掉遊戲規則）。
//       改任一邊的人請同步改另一邊。tests/card-flow.test.cjs 會直接讀前端原始碼把數字挖出來對，
//       只改一邊會讓 `reveal animation length mirrors ...` 那兩個測試紅掉。
// 為什麼算在 server 而不是等 client 回報：計時器權威必須留在 server
//    （docs/設計探討_手機流暢與機器人模式_20260911.md:21 — 斷線／切背景／鎖屏都不能卡住遊戲），
//    所以不能有「等某個 client 說演出播完了」這種依賴。
// 上限推導（6 人房 = 1 老闆 + 5 員工，joinRoom/createSolo 都卡在 6）：
//    n≤5；g≤(死掉的員工數)+(每人最多出 1 張道具)+(老闆緊盯 1 則)≤6
//    → 3800 + 5*480 + 6*350 + 1600 + 2900 = 12800ms，所以上限要 >12800 才不會把正常局截頂。
const REVEAL_ANIM_MAX_MS = 14000; // 硬上限：不管公式算出多少，揭曉倒數最多只延後 14 秒（防呆，保證有界）
// 🔴 這兩個是 **前端常數的鏡像**（server 這邊只是抄數值，改前端一定要回來改這裡）：
const KAROSHI_LEAD_MS  = 700;   // public/focus.js `playKaroshi()`：`revAnimEndsAt-Date.now()-700`＝提前 700ms 起跑
const KAROSHI_SCENE_MS = 3600;  // public/focus.js `const KAROSHI_MS=3600`＝猝死那一幕本身的長度
const KAROSHI_EXTRA_MS = KAROSHI_SCENE_MS - KAROSHI_LEAD_MS; // 2900：猝死回合比 playReveal 多出來的尾巴
function revealAnimMs(rv){
  if(!rv) return 0;
  const n=(rv.results||[]).length, g=(rv.ghostNotes||[]).length;
  const insp=new Set([...(rv.bossZoneKeys||[]), rv.supZoneKey].filter(Boolean));
  const danger=(rv.results||[]).some(x=>x.zone&&insp.has(x.zone)&&!x.supervisor);
  // 前端只有「猝死的那個人自己」會播這一幕，但倒數是整房共用的 → 只要這回合有人猝死就整房順延，
  // 否則猝死的人讀個人總結的時間會被吃掉 2.9 秒（正是老闆裁決「演出跑完才起算」要解決的事）。
  const karoshi=(rv.results||[]).some(x=>x.suddenDeath);
  return Math.min(REVEAL_ANIM_MAX_MS, 3800 + n*480 + g*350 + (danger?1600:0) + (karoshi?KAROSHI_EXTRA_MS:0));
}

// ---------- 結算 ----------
function resolveRound(room){
  clearTimer(room);
  const emps=aliveEmps(room);
  const before=new Map(emps.map(p=>[p.id,{points:p.points,anxiety:p.anxiety,taskProgress:p.task?.progress||0,item:p.hand[room.choices.emp[p.id]?.cardIdx]?.name||null}]));
  const bossZones=[...((room.choices.boss&&room.choices.boss.zones)||[])];
  const choiceOf=e=>room.choices.emp[e.id]||(e.isSupervisor?{action:'supervise',zone:null}:{action:'idle',zone:'office'});

  // 主管協查區
  const sup=room.supervisorId?room.players.get(room.supervisorId):null;
  let supZone = (sup&&sup.alive&&sup.isSupervisor) ? (choiceOf(sup).zone||null) : null;

  // ① 幽靈行動先套用（改變巡查版圖）
  const ghostNotes=[]; const warnedSet=new Set();
  for(const [gid,ga] of Object.entries(room.choices.ghost||{})){
    const g=room.players.get(gid); if(!g||!g.isGhost||g.ghostCooldown>0) continue;
    let gdet=null;      // 作祟細節（顯示用中文名），只給大事記／搞鬼王用（不影響結算）
    let gtarget=null;   // 報信對象的 playerId：搞鬼王要「比對到人」才能算命中，光比 round 會誤判（Codex 輪次 1 B5）
    if(ga.type==='haunt'&&bossZones.length){
      const rm=bossZones.splice(Math.floor(Math.random()*bossZones.length),1)[0];
      gdet=ZONES[rm].name;
      ghostNotes.push({icon:'👻',text:`幽靈【${g.name}】作祟，老闆的【${ZONES[rm].name}】巡查泡湯`});
    } else if(ga.type==='disrupt'&&supZone){
      ghostNotes.push({icon:'🌀',text:`幽靈【${g.name}】打斷了主管協查`}); supZone=null;
    } else if(ga.type==='warn'&&ga.targetId&&room.players.has(ga.targetId)){
      warnedSet.add(ga.targetId); gtarget=ga.targetId; gdet=(room.players.get(ga.targetId)||{}).name||null;
      ghostNotes.push({icon:'📞',text:'有幽靈偷偷通風報信…'});
    } else continue;
    g.ghostCooldown=GHOST_COOLDOWN;
    chron(room,{type:'ghost',kind:ga.type,name:g.name,pid:g.id,detail:gdet,targetPid:gtarget});
  }

  // ② 道具出牌（結算期生效；出牌即消耗）
  const energyOf={}, boostSet=new Set(), moochMap={};
  for(const e of emps){
    const ch=choiceOf(e); if(ch.cardIdx==null) continue;
    const c=e.hand[ch.cardIdx]; if(!c||CARD_DEFS[c.type].kind!=='item') continue;
    e.hand.splice(ch.cardIdx,1);
    if(c.type==='energy'){ energyOf[e.id]=2; ghostNotes.push({icon:'🧃',text:`【${e.name}】灌了提神飲料（心悸 −2）`}); }
    else if(c.type==='boost'){ boostSet.add(e.id); ghostNotes.push({icon:'💪',text:`【${e.name}】雞精加持（摸魚成功 +2 分）`}); }
    else if(c.type==='jam'&&bossZones.length){
      const rm=bossZones.splice(Math.floor(Math.random()*bossZones.length),1)[0];
      ghostNotes.push({icon:'🖨️',text:`【${e.name}】搞了影印機卡紙，老闆的【${ZONES[rm].name}】巡查泡湯`});
    }
    else if(c.type==='mooch'&&ch.cardTarget&&room.players.has(ch.cardTarget)&&ch.cardTarget!==e.id){
      if(!moochMap[ch.cardTarget]) moochMap[ch.cardTarget]=e.id;
      ghostNotes.push({icon:'🙏',text:`【${e.name}】對某位同事使出了「拜託啦」攻勢…`});
    }
  }

  const inspected=new Set(bossZones); if(supZone) inspected.add(supZone);

  // 老闆緊盯（觀察）：限仍在巡查版圖內的一區；此刻才扣經費（被幽靈/卡紙拔掉的巡查不收錢）
  let focusZone=null, focusPct=0;
  const bfoc=room.choices.boss&&room.choices.boss.focus;
  const bpp=bossOf(room);
  if(bfoc&&inspected.has(bfoc.zone)&&bpp&&(bpp.budget||0)>=FOCUS_COST[bfoc.pct]){
    bpp.budget-=FOCUS_COST[bfoc.pct]; focusZone=bfoc.zone; focusPct=bfoc.pct;
    ghostNotes.push({icon:'👀',text:`老闆瞇起眼睛死盯【${ZONES[focusZone].name}】（觀察 ${focusPct}%）`});
  }

  // 老鳥罩學弟：juniorId -> true（被罩）
  const guarded=new Set();
  for(const e of emps){
    if(e.seniority==='senior'&&!e.isSupervisor&&e.helpCooldown===0){
      const ht=choiceOf(e).helpTarget;
      if(ht&&room.players.has(ht)){ guarded.add(ht); e.helpCooldown=HELP_COOLDOWN; e._helpedName=(room.players.get(ht)||{}).name; }
    }
  }

  const pending={}; emps.forEach(e=>pending[e.id]=0);
  const results=[]; let safeCount=0;

  for(const e of emps){
    const ch=choiceOf(e); const r={playerId:e.id,name:e.name, seniority:e.seniority, note:'', zone:'office',action:ch.action,item:before.get(e.id).item};
    e.workStreak=ch.action==='work'?(e.workStreak||0)+1:0;
    if(energyOf[e.id]) pending[e.id]-=energyOf[e.id];
    if(e.isSupervisor){
      r.zoneName='主管巡查'; r.supervisor=true; r.zone=supZone||'office';
      if(e.task){ e.task.progress+=1; }
      r.note = supZone ? `主管，協查【${ZONES[supZone].name}】（免疫被抓）` : '主管，未協查（免疫被抓）';
      e.lastZone='office';
    } else if(ch.action==='work'){
      safeCount++; r.zoneName='認真工作'; r.working=true;
      e.workCount=(e.workCount||0)+1; // 牛馬王選材用（純計數，不參與結算）
      const ot=(e._otRound===room.round);
      if(ot){ e.points+=2; e.wageEarned=(e.wageEarned||0)+2; pending[e.id]+=1; r.ot=true; e.otCount=(e.otCount||0)+1; chron(room,{type:'ot',name:e.name});
        if(e.task){ e.task.progress+=2; r.note=`🕘 加班！任務 +2（${e.task.progress}/${e.task.need}）、加班費 +2💰、過勞 +1💓`; } else r.note='🕘 加班！加班費 +2💰、過勞 +1💓';
      } else {
        pending[e.id]-=1;
        const mb=moochMap[e.id]?room.players.get(moochMap[e.id]):null;
        if(mb&&mb.alive){
          // 被同事凹：薪水進別人口袋、還幫他推任務——白做工
          mb.points+=WORK_WAGE; if(mb.task) mb.task.progress+=1;
          if(e.task) e.task.progress+=2;
          r.mooched=true; e.moochedCount=(e.moochedCount||0)+1;
          r.note=`被【${mb.name}】凹了！${e.task?`任務 +2（${e.task.progress}/${e.task.need}）但`:''}薪水被拿走${mb.task?'、還幫他推進度':''}，白做工 😭`;
          chron(room,{type:'mooch',name:e.name,by:mb.name});
          log(room,`🙏【${mb.name}】凹了【${e.name}】：薪水 +${WORK_WAGE}💰${mb.task?'、自己任務 +1':''}`);
        } else {
          e.points+=WORK_WAGE; e.wageEarned=(e.wageEarned||0)+WORK_WAGE;
          if(e.task){ e.task.progress+=2; r.note=`認真工作：任務 +2（${e.task.progress}/${e.task.need}）、薪水 +${WORK_WAGE}💰、心悸 −1`; } else r.note=`認真工作：薪水 +${WORK_WAGE}💰、心悸 −1`;
        }
      }
      e.lastZone='office';
    } else if(ch.action==='idle'||ch.zone==='office'){
      safeCount++; r.zoneName='辦公室'; pending[e.id]-=1; r.note='回辦公室休息（安全、不算摸魚、心悸 −1）'; e.lastZone='office';
    } else {
      const zone=ch.zone, z=ZONES[zone]; r.zoneName=z.name; r.zone=zone;
      // 憋氣（菜鳥限定）：暗選時已承諾，無論老闆來不來都扣 💓
      const holdPct=(e.seniority==='junior'&&ch.hold)?ch.hold:0;
      if(holdPct){ pending[e.id]+=HOLD_COST[holdPct]||0; r.hold=holdPct; }
      let caught=inspected.has(zone);
      if(!caught && e.seniority==='junior'){ for(const adj of (ADJ[zone]||[])) if(inspected.has(adj)){caught=true;break;} }
      if(caught){
        // ⓪ 憋氣骰最先結算（已預付💓；成功＝不消耗下游任何擋箭牌）
        const dodge=Math.max(0, holdPct-(zone===focusZone?focusPct:0));
        if(dodge>0&&Math.random()*100<dodge){
          r.caught='held'; r.note=`🫁 老闆掃過…屏住呼吸驚險躲過！（憋氣 ${holdPct}%${zone===focusZone?`−緊盯 ${focusPct}%`:''}）`;
          chron(room,{type:'held',name:e.name,pid:e.id,zone:z.name,pct:holdPct});
        } else {
        const exIdx=e.hand.findIndex(c=>c.type==='excuse');
        // ⚠️ shield 一律帶 pid：搞鬼王要拿「被救的是誰」回頭跟幽靈的報信對象對帳（同名玩家不能混在一起）
        if(exIdx>=0){ const c=e.hand.splice(exIdx,1)[0]; r.caught='excused'; r.note=`被抓，但掏出藉口「${c.name}」滑走了！`; chron(room,{type:'shield',kind:'excused',name:e.name,pid:e.id,detail:c.name}); }
        else if(warnedSet.has(e.id)){ r.caught='warned'; r.note='被抓前收到幽靈報信，及時溜回座位！'; chron(room,{type:'shield',kind:'warned',name:e.name,pid:e.id}); }
        else if(guarded.has(e.id)){ r.caught='guarded'; r.note='被抓，但老鳥罩學弟擋下了！'; chron(room,{type:'shield',kind:'guarded',name:e.name,pid:e.id}); }
        else if(e.seniority==='senior'&&e.immunity>0){ e.immunity--; r.caught='blocked'; r.note='被抓，但免死金牌擋下！'; chron(room,{type:'shield',kind:'blocked',name:e.name,pid:e.id}); }
        else { const anx=(e.seniority==='junior')?3:2; pending[e.id]+=anx; r.caught=true; r.anx=anx; r.note=`被逮到！這次不算，心悸 +${anx}`;
          chron(room,{type:'catch',name:e.name,pid:e.id,zone:z.name});
          // 主管檢舉獎金：若在主管協查區被抓
          if(supZone&&zone===supZone&&sup){ sup.points+=2; r.byBoss=false; log(room,`🕵️ 主管【${sup.name}】協查抓到【${e.name}】(+2 分)`); }
        }
        }
      } else {
        let gain=z.slack+(e.seniority==='senior'?-1:1); if(gain<0)gain=0;
        if(boostSet.has(e.id)) gain+=2;
        if(ch.risky) gain*=2;
        e.slackCount++; e.points+=gain; pending[e.id]+=z.anxiety; r.gain=gain;
        if(gain>=5) chron(room,{type:'bigwin',name:e.name,pid:e.id,zone:z.name,gain,risky:!!ch.risky});
        r.note=`摸魚成功！💰+${gain}、心悸 +${z.anxiety}${ch.risky?'（🎲拼了×2）':''}`;
        // 命名一致性（2026-09-13）：這不是一個可以選的動作，是「摸魚」在身上有任務時的附帶效果。
        // 舊文案寫「邊做邊摸」會讓玩家去找一個不存在的按鈕。
        if(e.task){ e.task.progress+=1; r.note+=`；摸魚途中順手推進任務 +1（${e.task.progress}/${e.task.need}）`; }
      }
      if(ch.risky){ pending[e.id]+=RISKY_ANX; r.risky=true; if(r.caught===true) r.note+=`（🎲拼了失手，額外 +${RISKY_ANX}💓）`; }
      e.lastZone=zone;
    }
    results.push(r);
  }

  // 任務完成 / 逾期（兩段式）
  for(const e of emps){
    if(!e.task) continue; const t=e.task;
    if(t.progress>=t.need){ room.tasksDone++; e.points+=1;
      const c=drawCard(room,e);
      const bb=bossOf(room); if(bb) bb.budget=(bb.budget||0)+1; // 員工交差＝老闆部門經費 +1
      log(room,`✅【${e.name}】完成「${t.name}」(+1💰${c?'、抽 1 張卡':''}；老闆經費 +1)`); e.task=null; }
    else { t.deadlineLeft--;
      if(t.deadlineLeft<=0){
        if(t.state!=='grace'){ t.state='grace'; t.deadlineLeft=1; log(room,`⏳【${e.name}】任務到期，給一回合補交`); }
        else { pending[e.id]+=2; e.canBeFired=true; log(room,`❌【${e.name}】任務逾期！壓力 心悸 +2，老闆可資遣`); e.task=null; }
      }
    }
  }

  // 回合末結算心悸（可因休息而下降，floor 0）+ 出局
  for(const e of emps){
    e.anxiety+=pending[e.id]; if(e.anxiety<0) e.anxiety=0;
    if(e.workStreak>=WORK_STREAK_LIMIT){
      const rr=results.find(x=>x.playerId===e.id);
      if(rr){rr.eliminated=true;rr.suddenDeath=true;rr.note+='；連續工作 3 回合，過勞猝死，轉為幽靈（免死金牌不適用）';}
      e.alive=false;e.isGhost=true;
      if(e.isSupervisor){e.isSupervisor=false;if(room.supervisorId===e.id)room.supervisorId=null;}
      chron(room,{type:'eliminated',name:e.name,pid:e.id,cause:'overwork'});log(room,`👻【${e.name}】連續工作 ${WORK_STREAK_LIMIT} 回合，過勞猝死！`);
      continue;
    }
    if(e.anxiety>=room.config.anxietyOut){ const rr=results.find(x=>x.name===e.name); if(rr)rr.eliminated=true;
      e.alive=false; e.isGhost=true; if(e.isSupervisor){e.isSupervisor=false; if(room.supervisorId===e.id)room.supervisorId=null;}
      chron(room,{type:'eliminated',name:e.name,pid:e.id,cause:'anxiety',anxiety:e.anxiety});
      log(room,`💀【${e.name}】心悸爆表（${e.anxiety}）出局！`); }
  }

  // 主管任期 / 升職冷卻 / 罩學弟冷卻 遞減
  if(sup&&sup.isSupervisor){ sup.supTermLeft--; if(sup.supTermLeft<=0){ sup.isSupervisor=false; room.supervisorId=null; log(room,`【${sup.name}】主管任期結束，回歸員工`); } }
  if(room.promoteCooldown>0) room.promoteCooldown--;
  for(const e of emps) if(e.helpCooldown>0) e.helpCooldown--;
  for(const p of room.players.values()) if(p.isGhost&&p.ghostCooldown>0) p.ghostCooldown--;

  // 老闆連查限制
  for(const r of results){
    const p=room.players.get(r.playerId), prev=before.get(r.playerId);
    r.pointsDelta=p.points-prev.points; r.anxietyDelta=p.anxiety-prev.anxiety;
    r.pointsAfter=p.points; r.anxietyAfter=p.anxiety;
  }
  const ns={}; for(const z of Object.keys(ZONES)) ns[z]=bossZones.includes(z)?((room.zoneStreak[z]||0)+1):0; room.zoneStreak=ns;

  room.lastReveal={ round:room.round, bossZones:bossZones.map(z=>ZONES[z].name), bossZoneKeys:bossZones,
    supZone: supZone?ZONES[supZone].name:null, supZoneKey:supZone||null, ghostNotes, results,
    rate: room.tasksIssued>0?Math.round(room.tasksDone/room.tasksIssued*100):0 };
  log(room, `第 ${room.round} 回合：老闆查 ${bossZones.map(z=>ZONES[z].name).join('、')||'（無）'}${supZone?`｜主管協查 ${ZONES[supZone].name}`:''}。完成率 ${room.lastReveal.rate}%。`);
  room.phase='reveal';
  if(room.phase==='reveal'){ // 未結束才排自動進下一回合
    // 揭曉倒數「等演出跑完才起算」（2026-09-13 老闆裁決）：REVEAL_SEC 的值一個字都沒動（仍 15 秒），
    // 只把起點往後推一個演出時長。否則 6 人局演出吃掉 ~9 秒，玩家只剩 ~6 秒讀個人總結，
    // 直接違反這批的最高驗收「玩家要理解自己為什麼得到這個結果」。
    const animMs=revealAnimMs(room.lastReveal); room.revealAnimMs=animMs;
    room.revealSkipAt = room.solo?Date.now():Date.now() + animMs + REVEAL_MIN_SKIP*1000;
    if(!room.solo) startTimer(room, animMs/1000 + REVEAL_SEC, ()=>{ if(room.phase==='reveal'){ advanceRound(room); broadcast(room); } });
  }
}

function checkWin(room){
  const alive=aliveEmps(room);
  if(alive.length===0){ endGame(room,'boss','所有員工都出局了'); return; }
  if(room.round>=room.config.rounds){
    const rate=room.tasksIssued>0?room.tasksDone/room.tasksIssued:0;
    if(rate>=room.config.completeThreshold){ endGame(room,'boss',`業績達標（完成率 ${Math.round(rate*100)}% ≥ ${Math.round(room.config.completeThreshold*100)}%）`); return; }
    // 經濟地基：摸魚王由 💰（偷懶點數）決定——花錢＝真的割王位肉；次數降為稱號 flavor
    const rank=[...alive].sort((a,b)=>b.points-a.points||a.anxiety-b.anxiety);
    endGame(room,'emp',`摸魚王是【${rank[0].name}】（偷懶 ${rank[0].points} 💰）`, rank[0].id);
  }
}

// ---------- 終局頒獎：三王 ----------
// 🐟 摸魚王＝唯一的「贏」，得主直接沿用 checkWin 算好的 winnerEmpId，這裡一個字都不重算。
// 👻 搞鬼王／🐮 牛馬王＝榮譽頭銜，只發稱號與事蹟，不參與、也不影響勝負。
// 設計理由：死掉不是出局，是換跑道——每個人離場時都要帶著一個身分走。
const KING_DEFS = {
  slack:{ key:'slack', icon:'🐟', title:'摸魚王', kind:'win',   sub:'唯一的勝利' },
  ghost:{ key:'ghost', icon:'👻', title:'搞鬼王', kind:'honor', sub:'榮譽頭銜・不計勝負' },
  ox:   { key:'ox',    icon:'🐮', title:'牛馬王', kind:'honor', sub:'榮譽頭銜・不計勝負' },
};
// 第一人稱台詞（職場自嘲，調性對齊 EXCUSE_NAMES）；用回合＋名字做確定性挑選，同一局重看講同一句
const STORY_LINES = {
  caught:      ['我只是站起來活動一下筋骨。','這杯咖啡是要拿給您的，真的。','我在思考工作，站著比較好思考。','剛剛訊號不好，我出來收個信。'],
  slackWin:    ['這叫策略性補充體力。','薪水沒漲，效率當然要自己調。','我沒有偷懶，我在做向下管理。','上班摸魚，才是真正的循環經濟。'],
  suddenDeath: ['我還有一封信沒回……','原來過勞也是有進度條的。','早知道昨天就多去廁所坐一下。','幫我跟老闆說，我去休息一下下。'],
  held:        ['肺活量是我最後的職業技能。','別過來、別過來、別過來……','這一刻我跟影印機融為一體。','憋氣三十秒，換三十年勞保。'],
};
function sayLine(kind,name,round){
  const list=STORY_LINES[kind]; if(!list||!list.length) return '';
  let h=Math.abs(round||0); for(const ch of String(name||'')) h+=ch.codePointAt(0);
  return list[h%list.length];
}
function quoteOf(kind,name,round){ const l=sayLine(kind,name,round); return l?`${name}：「${l}」`:''; }
// 大事記工具：chron 只存區塊中文名，反查回區塊設定才拿得到風險級距
const ZONE_BY_NAME = Object.fromEntries(Object.values(ZONES).map(z=>[z.name,z]));
function chronOf(room){ return room.chronicle||[]; }
function isSame(ev,p){ return ev.pid ? ev.pid===p.id : ev.name===p.name; }
// 「選最精彩」：同一種事件發生多次時用 score 挑最戲劇的那筆（舊版一律 find 取第一筆＝最爆笑的常被吃掉）
function bestOf(list, score){ let best=null, bs=-Infinity; for(const e of list){ const s=score(e); if(s>bs){bs=s;best=e;} } return best; }

function slackDeed(room,p){
  const c=chronOf(room);
  const bw=bestOf(c.filter(x=>x.type==='bigwin'&&isSame(x,p)), e=>e.gain*10+e.round);
  const hd=bestOf(c.filter(x=>x.type==='held'&&isSame(x,p)), e=>e.pct*10+e.round);
  const ct=c.filter(x=>x.type==='catch'&&isSame(x,p)).length;
  const base=`偷懶 ${p.points}💰・摸魚 ${p.slackCount} 次`;
  if(bw) return `${base}；第 ${bw.round} 回合在${bw.zone}${bw.risky?'賭上性命':''}一口氣爽賺 ${bw.gain}💰。`;
  if(hd) return `${base}；第 ${hd.round} 回合在${hd.zone}憋住 ${hd.pct}% 的氣，硬是從放大鏡底下活了下來。`;
  if(ct) return `${base}；被逮到 ${ct} 次還是爬上了王座，臉皮比考績表厚。`;
  return `${base}；全程沒被老闆抓到一次，乾淨得像沒來上班。`;
}
const GHOST_ACT_TEXT = { haunt:'扯掉老闆一次巡查', warn:'向陽間通風報信', disrupt:'打斷主管協查' };
function ghostDeed(s){
  const head=s.exit?`第 ${s.exit} 回合下班（永久）`:'半路變成了幽靈';
  if(!s.acts.length) return `${head}，之後在天花板上飄了一整局，一次都沒下手——鬼也是會累的。`;
  const kinds=[...new Set(s.acts.map(a=>GHOST_ACT_TEXT[a.kind]).filter(Boolean))];
  return `${head}，之後作祟 ${s.acts.length} 次：${kinds.join('、')}${s.hits?`，其中 ${s.hits} 次真的救到了陽間的同事`:''}。`;
}
function oxDeed(room,p){
  const c=chronOf(room);
  const dead=c.find(x=>x.type==='eliminated'&&isSame(x,p));
  const fired=c.find(x=>x.type==='fire'&&isSame(x,p));
  const bits=[`認真工作 ${p.workCount||0} 回合`,`領了 ${p.wageEarned||0}💰 血汗錢`];
  if(p.otCount) bits.push(`加班 ${p.otCount} 次`);
  if(p.moochedCount) bits.push(`被同事凹去白做工 ${p.moochedCount} 次`);
  let tail='。';
  if(dead&&dead.cause==='overwork') tail=`，最後在第 ${dead.round} 回合過勞猝死在自己的鍵盤上。`;
  else if(dead) tail=`，最後在第 ${dead.round} 回合心悸爆表倒下。`;
  else if(fired) tail=`，做到第 ${fired.round} 回合還是收到了資遣信封。`;
  else if(!(p.slackCount||0)) tail='，全局零摸魚——這不是玩家，這是員工。';
  return bits.join('、')+tail;
}
// 回傳三個王（固定三筆，從缺就是 vacant:true）；不讀也不改任何勝負狀態
function pickKings(room, side, winnerEmpId){
  const c=chronOf(room);
  const emps=[...room.players.values()].filter(p=>p.role==='emp');
  const exitRound=p=>{ const e=c.find(x=>(x.type==='eliminated'||x.type==='fire')&&isSame(x,p)); return e?e.round:null; };

  // 🐟 摸魚王：checkWin 說誰是王就是誰；老闆贏＝沒有摸魚王（維持現行勝負語意）
  const sk=winnerEmpId?room.players.get(winnerEmpId):null;
  const slackKing = sk
    ? { ...KING_DEFS.slack, holderId:sk.id, holder:sk.name, deed:slackDeed(room,sk) }
    : { ...KING_DEFS.slack, holderId:null, holder:null, vacant:true, deed:'這局老闆提早收工——沒有人戴上那頂歪歪的紙皇冠。' };

  // 👻 搞鬼王：候選是「幽靈」，不能沿用 aliveEmps（幽靈在那裡被排除掉了）
  const ghosts=emps.filter(p=>p.isGhost||!p.alive);
  let ghostKing;
  if(!ghosts.length){
    ghostKing={ ...KING_DEFS.ghost, holderId:null, holder:null, vacant:true, deed:'全員活到下班，這局沒有半隻鬼——恭喜，也有點無聊。' };
  } else {
    const stat=g=>{
      const acts=c.filter(x=>x.type==='ghost'&&isSame(x,g));
      // 報信有沒有真的救到人：必須「同一回合」**且**「就是我報信的那個人」被救到才算命中。
      // 🔴 2026-09-13 Codex 輪次 1 B5：舊版只比 `s.round===a.round`，兩隻鬼同回合報不同人時，
      //    沒救到人的那隻也白撿一次命中 → 拿到王冠還附一句他沒做過的假事蹟。
      //    比對用 playerId（`targetPid` ↔ `pid`）；缺任一邊就算不命中（fail closed：寧可少發，不亂發）。
      const savedIn=(round,pid)=>!!pid&&c.some(s=>s.type==='shield'&&s.kind==='warned'&&s.round===round&&s.pid===pid);
      const hits=acts.filter(a=>a.kind==='warn'&&savedIn(a.round,a.targetPid)).length;
      return { g, acts, hits, score:acts.length*10+hits*5, exit:exitRound(g) };
    };
    // 作祟多的優先；全都沒出手時，換成「死最早、飄最久」的那位（讓他至少帶著身分離場）
    const w=ghosts.map(stat).sort((a,b)=>b.score-a.score||(a.exit??99)-(b.exit??99)||a.g.name.localeCompare(b.g.name))[0];
    ghostKing={ ...KING_DEFS.ghost, holderId:w.g.id, holder:w.g.name, acts:w.acts.length, deed:ghostDeed(w) };
  }

  // 🐮 牛馬王：工作次數優先、薪水累積次之。照實頒——摸魚王同時做最多工就讓他戴兩頂，那才是最好笑的故事
  const oxPool=emps.filter(p=>(p.workCount||0)>0);
  let oxKing;
  if(!oxPool.length){
    oxKing={ ...KING_DEFS.ox, holderId:null, holder:null, vacant:true, deed:'這局沒有人認真工作過——整間辦公室都在摸魚，老闆氣到手抖。' };
  } else {
    const w=[...oxPool].sort((a,b)=>(b.workCount||0)-(a.workCount||0)||(b.wageEarned||0)-(a.wageEarned||0)||(b.otCount||0)-(a.otCount||0)||a.name.localeCompare(b.name))[0];
    oxKing={ ...KING_DEFS.ox, holderId:w.id, holder:w.name, workCount:w.workCount||0, wageEarned:w.wageEarned||0, deed:oxDeed(room,w) };
  }
  return [slackKing, ghostKing, oxKing];
}

// 終局故事：把大事記編成一段童話小說（storybook epilogue）
// 2026-09-13 兩個修正：①同種事件「選最精彩」不再取第一筆 ②開場／結局／頒獎保底，
//   中段最多 6 幕 → 總長仍 ≤9 段（舊版事件一多，slice(0,9) 會把結局整段砍掉，玩家看不到自己為什麼贏）
const STORY_MID_MAX = 6;
function buildStory(room, side, reason, winnerEmpId, kings){
  const c=chronOf(room);
  const b=bossOf(room), bn=b?b.name:'老闆';
  const emps=[...room.players.values()].filter(p=>p.role==='emp');
  // 中段候選：w＝這類事件的戲劇權重（用來選最精彩），round＝選完排回時間順序用
  const mid=[]; const add=(w,round,text)=>{ if(text) mid.push({w,round:round||0,text}); };

  const catchEv=bestOf(c.filter(e=>e.type==='catch'), e=>(ZONE_BY_NAME[e.zone]?.slack||0)*10+e.round);
  if(catchEv) add(50+(ZONE_BY_NAME[catchEv.zone]?.slack||0)*5, catchEv.round,
    `第 ${catchEv.round} 回合，放大鏡的光停在${catchEv.zone}——${catchEv.name} 被逮個正著，慘叫聲穿透了三面隔板。${quoteOf('caught',catchEv.name,catchEv.round)}`);

  const heldEv=bestOf(c.filter(e=>e.type==='held'), e=>e.pct*10+e.round);
  if(heldEv) add(60, heldEv.round,
    `最驚險的一幕在第 ${heldEv.round} 回合：老闆的目光掃過${heldEv.zone}，${heldEv.name} 縮在角落屏住呼吸（憋 ${heldEv.pct}%），臉憋得比薪水條還綠——竟然硬是躲了過去。${quoteOf('held',heldEv.name,heldEv.round)}`);

  const SHIELD_W={warned:8,guarded:6,blocked:4,excused:2};
  const shEv=bestOf(c.filter(e=>e.type==='shield'), e=>(SHIELD_W[e.kind]||0)*10+e.round);
  if(shEv) add(40+(SHIELD_W[shEv.kind]||0), shEv.round, {
    excused:`${shEv.name} 被抓包的瞬間掏出「${shEv.detail||'萬用藉口'}」，滑得比下班打卡還快。`,
    warned:`天花板上飄來一通幽靈密電，${shEv.name} 在放大鏡到位前一秒溜回了座位。`,
    guarded:`千鈞一髮之際，老鳥張開翅膀把 ${shEv.name} 護在身後，深藏功與名。`,
    blocked:`免死金牌在關鍵時刻閃閃發光，${shEv.name} 拍拍灰塵若無其事地走回座位。`,
  }[shEv.kind]||'');

  const bwEv=bestOf(c.filter(e=>e.type==='bigwin'), e=>e.gain*10+(e.risky?5:0)+e.round);
  if(bwEv) add(45+bwEv.gain*2, bwEv.round,
    `而 ${bwEv.name} 在${bwEv.zone}${bwEv.risky?'賭上性命':''}爽賺了 ${bwEv.gain}💰，嘴角的笑意藏都藏不住。${quoteOf('slackWin',bwEv.name,bwEv.round)}`);

  const moEv=bestOf(c.filter(e=>e.type==='mooch'), e=>e.round);
  if(moEv) add(38, moEv.round, `${moEv.name} 被 ${moEv.by} 一句「拜託啦～」凹去做工，做得滿頭大汗——薪水卻悄悄滑進了別人的口袋。`);

  const otEv=bestOf(c.filter(e=>e.type==='ot'), e=>e.round);
  if(otEv) add(35, otEv.round, `${bn} 甩出了加班令。${otEv.name} 含淚加班到燈火通明，領了加班費，也熬出了黑眼圈。`);

  const ghosts=c.filter(e=>e.type==='ghost');
  const ghEv=bestOf(ghosts, e=>({haunt:30,disrupt:20,warn:10}[e.kind]||0)+e.round);
  if(ghEv) add(42+ghosts.length*2, ghEv.round, {
    haunt:`第 ${ghEv.round} 回合，幽靈 ${ghEv.name} 從天花板探出頭，把老闆往${ghEv.detail||'某一區'}的腳步硬生生扯了回來。`,
    warn:`幽靈 ${ghEv.name} 壓低聲音對${ghEv.detail?`【${ghEv.detail}】`:'陽間的同事'}通風報信——死了還在幫同事看門，這就是義氣。`,
    disrupt:`幽靈 ${ghEv.name} 一陣陰風吹亂了主管的協查表，主管抓了半天只抓到自己的影子。`,
  }[ghEv.kind]||'');

  const pmEv=bestOf(c.filter(e=>e.type==='promote'), e=>e.round);
  if(pmEv) add(30, pmEv.round, `第 ${pmEv.round} 回合，${pmEv.name} 被升為代理主管——同事們的眼神，從羨慕慢慢變成了警戒。`);

  const frEv=bestOf(c.filter(e=>e.type==='fire'), e=>e.round);
  if(frEv) add(55, frEv.round, `${frEv.name} 收到了資遣信封。抱著紙箱走出大門時，桌上的多肉還沒來得及澆水。`);

  const deaths=c.filter(e=>e.type==='eliminated');
  if(deaths.length){
    const sd=deaths.filter(e=>e.cause==='overwork'), anx=deaths.filter(e=>e.cause!=='overwork');
    const parts=[];
    if(sd.length){ const q=quoteOf('suddenDeath',sd[0].name,sd[0].round);
      parts.push(`${sd.map(e=>e.name).join('、')} 連做三回合，直接過勞猝死在鍵盤上${q?`——${q}`:''}`); }
    if(anx.length) parts.push(`${anx.map(e=>e.name).join('、')} 心悸爆表倒下`);
    add(70, deaths[deaths.length-1].round,
      `${parts.join('；')}。他們化作了辦公室的幽靈——不是出局，是換了跑道：從此在天花板上飄來飄去，替活著的同事通風報信、扯老闆的後腿。`);
  }

  mid.sort((a,b)=>b.w-a.w||a.round-b.round);                                        // ① 先挑最精彩
  const picked=mid.slice(0,STORY_MID_MAX).sort((a,b)=>a.round-b.round||b.w-a.w);    // ② 再排回時間順序
  const P=[`在一間被施了魔法的老辦公室裡，${bn} 又戴上了那枚小皇冠，握緊金色放大鏡踏進走廊。今天要對付的員工是：${emps.map(p=>p.name).join('、')}。上班鐘敲響，一場貓抓老鼠的一天開始了。`,
    ...picked.map(x=>x.text)];
  if(side==='boss') P.push(`下班鐘響。${bn} 站在辦公室中央高舉業績獎盃：${reason}。員工們癱在文件堆裡，連嘆氣的力氣都沒有了。`);
  else { const k=room.players.get(winnerEmpId);
    P.push(`下班鐘響。${k?k.name:'某人'} 戴著歪歪的紙皇冠站上文件山頂，高舉金色咖啡杯——${reason}！${bn} 癱坐在角落，放大鏡滾落在地。`); }
  const board=(kings||[]).map(k=>`${k.icon} ${k.title}：${k.holder||'從缺'}`).join('｜');
  P.push(`${board?`本日頒獎——${board}。`:''}明天太陽照常升起，影印機照常卡紙。是牛馬，還是摸魚王？明天上班，再見分曉。`);
  return P.filter(Boolean).slice(0,9);
}

function endGame(room, side, reason, winnerEmpId){
  clearTimer(room); room.phase='ended'; touch(room);
  const th=room.config.anxietyOut;
  const emps=[...room.players.values()].filter(p=>p.role==='emp');
  const kings=pickKings(room, side, winnerEmpId);
  // 稱號位階：摸魚王 > 搞鬼王 > 牛馬王（同一人同時上榜時，排行榜只顯示最高的那個）
  const kingTitle={}, kingDeed={}, kingKeys={};
  for(const k of kings){ if(!k.holderId) continue;
    (kingKeys[k.holderId]=kingKeys[k.holderId]||[]).push(k.key);
    if(!kingTitle[k.holderId]){ kingTitle[k.holderId]=`${k.icon} ${k.title}`; kingDeed[k.holderId]=k.deed; } }
  const ranking=emps.map(p=>{
    const comp=Math.max(0, p.points + p.slackCount*2 + (p.alive?5:0) - p.anxiety);
    let title;
    if(kingTitle[p.id]) title=kingTitle[p.id];
    else if(!p.alive) title=((p.otCount||0)>=2)?'過勞牛馬 🐂💦':'壯烈畢業 💀';
    else if((p.otCount||0)>=2) title='加班狂牛馬 🐂';
    else if(p.slackCount===0) title='全勤牛馬 🐂';
    else if(p.anxiety>=th-2) title='驚弓之鳥 😰';
    else if(p.seniority==='senior') title='老油條 🦉';
    else title='摸魚同好 😎';
    const grade=comp>=20?'S':comp>=14?'A':comp>=8?'B':'C';
    return { name:p.name, seniority:p.seniority, slackCount:p.slackCount, points:p.points, alive:p.alive, anxiety:p.anxiety,
      workCount:p.workCount||0, comp, title, grade, isKing:p.id===winnerEmpId,
      kings:kingKeys[p.id]||[], kingDeed:kingDeed[p.id]||null };
  }).sort((a,b)=>(b.isKing?1:0)-(a.isKing?1:0)||b.comp-a.comp);
  const outCount=emps.filter(p=>!p.alive).length;
  const rate=room.tasksIssued>0?Math.round(room.tasksDone/room.tasksIssued*100):0;
  const bp=bossOf(room);
  const bossGrade=(side==='boss')?((rate>=80||outCount===emps.length)?'S':'A'):(rate>=50?'B':'C');
  room.winner={ side, reason, winnerEmpId, kings, ranking, rate, tasksDone:room.tasksDone, tasksIssued:room.tasksIssued,
    story: buildStory(room, side, reason, winnerEmpId, kings),
    boss:{ name:bp?bp.name:'老闆', outCount, total:emps.length, rate, grade:bossGrade } };
  log(room, `🏁 結束：${side==='boss'?'老闆獲勝':'員工陣營獲勝'} — ${reason}`);
  log(room, `👑 三王：${kings.map(k=>`${k.icon}${k.title}＝${k.holder||'從缺'}`).join('｜')}`);
}

function advanceRound(room){ checkWin(room); if(room.phase==='ended')return; room.round++; enterAdmin(room); }

// ========== c-lite 單人模式：bot 層（只產生「選擇」，結算引擎 resolveRound 完全不動） ==========
function mkBot(name, style){ const p=mkPlayer(newPid(), null, name); p.isBot=true; p.botStyle=style; return p; }
function rand(a,b){ return a+Math.random()*(b-a); }

// softmax 機率抽樣（非 argmax）：讓 bot 有「人味」變異
function softmaxPick(cands, temp){
  const m=Math.max(...cands.map(c=>c.score));
  const ws=cands.map(c=>Math.exp((c.score-m)/temp));
  let r=Math.random()*ws.reduce((a,b)=>a+b,0);
  for(let i=0;i<cands.length;i++){ r-=ws[i]; if(r<=0) return cands[i].choice; }
  return cands[cands.length-1].choice;
}

// 員工 bot：三性格（貪懶/穩健/搖擺）＋任務壓力＋心悸自保；不偷看老闆巡查（不作弊）
function botEmpChoice(room, e){
  if(e.isSupervisor){
    const zs=SLACK_ZONES.slice();
    return { action:'supervise', zone: Math.random()<0.7 ? zs[Math.floor(Math.random()*zs.length)] : null };
  }
  const out=room.config.anxietyOut, style=e.botStyle||'steady';
  const hot=e.anxiety>=out-2, warm=e.anxiety>=out-3;
  // 被加班令點名：只能認真做（領加班費）或發呆
  if(e._otRound===room.round){
    return { action: Math.random()<0.85?'work':'idle', zone:'office' };
  }
  const cands=[];
  cands.push({ score: 2+(hot?6:0)+(e.anxiety>0?1:0)+(style==='steady'?1:0)-(style==='greedy'?1:0),
    choice:{action:'idle',zone:'office'} });
  let sWork=1+(hot?4:0)+(style==='steady'?1:0);
  if(e.task){ const t=e.task; sWork += t.state==='grace'?10 : (t.deadlineLeft<=1?7 : (t.need-t.progress>=3?3:1)); }
  cands.push({ score:sWork, choice:{action:'work',zone:'office'} });
  for(const k of SLACK_ZONES){
    if(e.lastZone===k) continue;
    const z=ZONES[k];
    cands.push({ score: z.slack*2+(style==='greedy'?z.slack:0)-z.anxiety*(hot?4:(warm?2:1))+(e.task?1:0),
      choice:{action:'slack',zone:k} });
  }
  const temp={greedy:1.1,steady:1.4,swing:2.6}[style]||1.5;
  const choice=softmaxPick(cands,temp);
  // 道具：心悸快爆先喝提神；衝高爽區帶雞精；偶爾搞卡紙；貪懶偶爾凹同事
  let cardIdx=null, cardTarget=null;
  const idxOf=t=>e.hand.findIndex(c=>c.type===t);
  if(hot&&idxOf('energy')>=0) cardIdx=idxOf('energy');
  else if(choice.action==='slack'&&ZONES[choice.zone].slack>=3&&idxOf('boost')>=0&&Math.random()<0.6) cardIdx=idxOf('boost');
  else if(idxOf('mooch')>=0&&Math.random()<0.35){
    const mates=aliveEmps(room).filter(x=>x.id!==e.id&&!x.isSupervisor);
    if(mates.length){ cardIdx=idxOf('mooch'); cardTarget=mates[Math.floor(Math.random()*mates.length)].id; }
  }
  else if(idxOf('jam')>=0&&Math.random()<0.2) cardIdx=idxOf('jam');
  // 老鳥 bot 會罩心悸快爆的學弟（含真人玩家）
  let helpTarget=null;
  if(e.seniority==='senior'&&!e.isSupervisor&&e.helpCooldown===0){
    const j=aliveEmps(room).find(x=>x.seniority==='junior'&&!x.isSupervisor&&x.anxiety>=out-2);
    if(j&&Math.random()<0.5) helpTarget=j.id;
  }
  // 賭命衝刺：貪懶型在還很安全＋落後時偶爾拼一把（限 gain≥2 的區）
  let risky=false;
  if(choice.action==='slack'&&style==='greedy'&&e.anxiety<=out-4){
    const g=ZONES[choice.zone].slack+(e.seniority==='senior'?-1:1);
    const lead=Math.max(...aliveEmps(room).map(x=>x.points));
    if(g>=2&&e.points<lead&&Math.random()<0.25) risky=true;
  }
  // 憋氣（菜鳥 bot）：三性格投法——貪懶敢憋、穩健只在很安全時淺憋、搖擺隨機難讀
  let hold=0;
  if(choice.action==='slack'&&e.seniority==='junior'){
    if(style==='greedy'&&e.anxiety<=out-3&&Math.random()<0.4) hold=(e.anxiety<=out-4&&Math.random()<0.3)?60:30;
    else if(style==='steady'&&e.anxiety<=out-4&&Math.random()<0.25) hold=30;
    else if(style==='swing'&&Math.random()<0.2) hold=Math.random()<0.5?30:60;
  }
  return { ...choice, helpTarget, cardIdx, cardTarget, risky, hold };
}

// bot 員工的行政階段經濟行為：深呼吸＋逛補給市場
function scheduleBotEconomy(room){
  const round=room.round;
  for(const p of room.players.values()){
    if(!p.isBot||p.role!=='emp'||!p.alive) continue;
    setTimeout(()=>{
      if(!rooms.has(room.code)||room.phase!=='admin'||room.round!==round||!p.alive) return;
      const out=room.config.anxietyOut;
      if(p.anxiety>=out-2&&p.points>=BREATHE_COST+1&&p._breathedRound!==round){
        p.points-=BREATHE_COST; p.anxiety=Math.max(0,p.anxiety-1); p._breathedRound=round;
        log(room,`😮‍💨【${p.name}】花 ${BREATHE_COST}💰 深呼吸壓驚（💓−1）`); broadcast(room);
      }
      if(p._boughtRound===round||p.hand.length>=HAND_LIMIT) return;
      const wantBuy={greedy:0.35,steady:0.8,swing:0.5}[p.botStyle||'steady'];
      if(Math.random()>wantBuy) return;
      const hasExcuse=p.hand.some(c=>c.type==='excuse');
      let pick=-1;
      if(!hasExcuse) pick=room.market.findIndex(c=>c.type==='excuse'&&p.points>=PRICES.excuse+1);
      if(pick<0&&p.anxiety>=out-3) pick=room.market.findIndex(c=>c.type==='energy'&&p.points>=PRICES.energy+1);
      if(pick<0) pick=room.market.findIndex(c=>c.type==='boost'&&p.points>=PRICES.boost+2);
      if(pick<0) return;
      const card=room.market[pick]; const price=PRICES[card.type]||2;
      p.points-=price; p.hand.push({type:card.type,name:card.name}); p._boughtRound=round;
      room.market.splice(pick,1); refillMarket(room);
      log(room,`🛒【${p.name}】買了 ${CARD_DEFS[card.type].icon}${CARD_DEFS[card.type].name}`); broadcast(room);
    }, rand(1500,SHOP_SEC*900));
  }
}

// 老闆 bot 巡查：照「行為模式卡」出牌（員工看得到卡＝可讀可破，讀 AI 的樂趣）
function botBossZones(room){
  const n=room.config.bossInspect;
  const avail=SLACK_ZONES.filter(z=>(room.zoneStreak[z]||0)<2);
  const pat=room.bossPattern||'chaos';
  if(pat==='routine'){
    const order=['tea','copy','toilet','roof'], start=(room.round-1)%4, picks=[];
    for(let i=0;i<8&&picks.length<n;i++){ const z=order[(start+i)%4]; if(avail.includes(z)&&!picks.includes(z)) picks.push(z); }
    return picks;
  }
  const w={}; for(const z of avail) w[z]=1;
  if(pat==='hunter'&&room.lastReveal) for(const r of (room.lastReveal.results||[])) if(r.gain!=null&&w[r.zone]!=null) w[r.zone]+=3;
  if(pat==='lazy'){ if(w.tea!=null)w.tea+=2; if(w.copy!=null)w.copy+=2; }
  const picks=[], pool=avail.slice();
  while(picks.length<n&&pool.length){
    let tot=pool.reduce((a,z)=>a+w[z],0), r=Math.random()*tot, sel=pool[0];
    for(const z of pool){ r-=w[z]; if(r<=0){sel=z;break;} }
    picks.push(sel); pool.splice(pool.indexOf(sel),1);
  }
  return picks;
}

function botGhostAction(room, g){
  const targets=aliveEmps(room);
  const opts=['haunt']; if(room.supervisorId) opts.push('disrupt'); if(targets.length) opts.push('warn');
  const t=opts[Math.floor(Math.random()*opts.length)];
  if(t==='warn'){ const human=targets.find(x=>!x.isBot); const tgt=human||[...targets].sort((a,b)=>b.anxiety-a.anxiety)[0]; return {type:'warn',targetId:tgt.id}; }
  return {type:t,targetId:null};
}

// 老闆 bot 行政：派任務給所有閒置員工；升職陷阱＝升當前摸魚王（橡皮筋）；有逾期者 80% 開鍘
function botAdmin(room){
  const b=bossOf(room); if(!b||!b.isBot) return;
  for(const p of aliveEmps(room)){
    if(!p.task&&!p.isSupervisor&&room.taskDeck.length){
      const name=room.taskDeck.shift();
      p.task={name,need:TASK_NEED,deadlineLeft:TASK_DEADLINE,progress:0,state:'active'}; room.tasksIssued++;
      log(room,`📋 老闆派給【${p.name}】：${name}`);
    }
  }
  if(room.promoteCooldown===0&&!room.supervisorId){
    const lead=[...aliveEmps(room)].filter(p=>!p.isSupervisor).sort((a,b)=>b.slackCount-a.slackCount||b.points-a.points)[0];
    if(lead&&lead.slackCount>=2&&Math.random()<0.7){
      lead.isSupervisor=true; lead.supTermLeft=SUPERVISOR_TERM; room.supervisorId=lead.id; room.promoteCooldown=PROMOTE_COOLDOWN;
      chron(room,{type:'promote',name:lead.name});
      log(room,`🧑‍💼 老闆升【${lead.name}】為代理主管（任期 ${SUPERVISOR_TERM} 回，不能摸魚、可協查抓人）`);
    }
  }
  if(room.bossFires>0){
    const f=aliveEmps(room).find(p=>p.canBeFired);
    if(f&&Math.random()<0.8){
      if(f.seniority==='senior'&&f.immunity>0){ f.immunity--; f.canBeFired=false; room.bossFires--; log(room,`🛡️【${f.name}】用免死金牌擋下資遣！`); }
      else { f.alive=false; f.isGhost=true; if(f.isSupervisor){f.isSupervisor=false; if(room.supervisorId===f.id)room.supervisorId=null;}
        room.bossFires--; chron(room,{type:'fire',name:f.name,pid:f.id}); log(room,`🔨 老闆資遣了【${f.name}】！（剩 ${room.bossFires} 次）`); }
    }
  }
  // 部門經費夠就從固定槽補一張加班令，手上有就對「當前偷懶王」打出（記仇橡皮筋）
  if(b._boughtRound!==room.round&&!b.hand.some(c=>c.type==='overtime')&&(b.budget||0)>=PRICES.overtime){
    b.budget-=PRICES.overtime; b.hand.push({type:'overtime',name:CARD_DEFS.overtime.name}); b._boughtRound=room.round;
    log(room,`🛒【${b.name}】買了 🕘加班令`);
  }
  if(b.hand.some(c=>c.type==='overtime')&&Math.random()<0.8){
    const lead=[...aliveEmps(room)].filter(p=>!p.isSupervisor&&p._otRound!==room.round).sort((a,c)=>c.points-a.points)[0];
    if(lead&&lead.points>=3){
      const ci=b.hand.findIndex(c=>c.type==='overtime'); b.hand.splice(ci,1); lead._otRound=room.round;
      log(room,`🕘 老闆對【${lead.name}】打出加班令！本回合不能摸魚（認真做有加班費 +2💰）`);
    }
  }
}

function scheduleBotAdmin(room){
  const round=room.round;
  setTimeout(()=>{
    if(!rooms.has(room.code)||room.phase!=='admin'||room.round!==round) return;
    botAdmin(room); if(!aliveEmps(room).length)checkWin(room);
    room.adminReady=true;
    if(room.phase!=='admin'){ broadcast(room); return; }
    // 有真人員工 → 留一段補給採購窗口（倒數顯示），沒有就直接開工
    const humanEmp=[...room.players.values()].some(p=>!p.isBot&&p.role==='emp'&&p.alive&&p.connected);
    if(room.solo){clearTimer(room);}
    else if(humanEmp){ startTimer(room, SHOP_SEC, ()=>{ if(room.phase==='admin'){ enterChoose(room); broadcast(room); } }); }
    else enterChoose(room);
    broadcast(room);
  }, rand(1000,1800));
}

// choosing 進場時為每個 bot 排「思考延遲」後代打；寫入與真人共用 room.choices，湊齊同樣走 tryResolve
function scheduleBots(room){
  const round=room.round;
  const guard=()=>rooms.has(room.code)&&room.phase==='choosing'&&room.round===round;
  for(const p of room.players.values()){
    if(!p.isBot) continue;
    if(p.role==='boss'){
      setTimeout(()=>{ if(!guard()||room.choices.boss!=null) return;
        const zones=botBossZones(room);
        // 緊盯：記仇老闆對「上回有人得逞的巡查區」瞇眼；陰晴不定偶爾亂盯
        let focus=null;
        if((p.budget||0)>=1&&zones.length){
          if(room.bossPattern==='hunter'&&room.lastReveal){
            const hot=zones.find(z=>(room.lastReveal.results||[]).some(x=>x.gain!=null&&x.zone===z));
            if(hot&&Math.random()<0.6) focus={zone:hot,pct:(p.budget>=3&&Math.random()<0.4)?60:30};
          } else if(room.bossPattern==='chaos'&&Math.random()<0.25) focus={zone:zones[Math.floor(Math.random()*zones.length)],pct:30};
        }
        room.choices.boss={zones,focus}; tryResolve(room); broadcast(room); }, rand(2000,4500));
    } else if(p.alive){
      setTimeout(()=>{ if(!guard()||room.choices.emp[p.id]!=null) return;
        // 貪懶 bot 錢夠時偶爾付錢拒絕加班（自由的代價）
        if(p._otRound===room.round&&p.botStyle==='greedy'&&p.points>=OT_REFUSE_COST+3&&Math.random()<0.4){
          p.points-=OT_REFUSE_COST; p._otRound=0;
          log(room,`🏃【${p.name}】燒了 ${OT_REFUSE_COST}💰 請假開溜，拒絕加班！`);
        }
        room.choices.emp[p.id]=botEmpChoice(room,p); tryResolve(room); broadcast(room); }, rand(1200,4000));
    } else if(p.isGhost&&p.ghostCooldown===0){
      setTimeout(()=>{ if(!guard()||room.choices.ghost[p.id]) return;
        if(Math.random()<0.6){ room.choices.ghost[p.id]=botGhostAction(room,p); broadcast(room); } }, rand(1500,3500));
    }
  }
}

function tryResolve(room){
  if(room.phase!=='choosing') return;
  if(room.solo){
    const human=room.players.get(room.hostId);
    if(human?.isGhost&&!room.choices.ghost[human.id])return;
  }
  const done=aliveEmps(room).every(e=>room.choices.emp[e.id]!=null)&&room.choices.boss!=null;
  if(done) resolveRound(room);
}

// ---------- Socket ----------
// handler 防護層：socket.io 不攔 handler 例外，handler 丟出去的例外會直接殺掉整個 process，
// 而房間狀態只存在記憶體（README：重啟即清空）→ 一個畸形封包＝所有房間的牌局同時消失。
// 實測（修補前）：客戶端送 socket.emit('drawRoundCards','hello')，cb 就是字串；
//   `cb?.()` 只擋 null/undefined、`cb&&cb()` 只擋 falsy，兩者都擋不住「不是函式」
//   → TypeError: cb is not a function → process 退出。
// 對策：所有 handler 一律走 on()／onNoAck() 註冊，在進 handler 之前把參數正規化，
// handler 內部寫法一行都不用改（cb?.()／cb&&cb() 全部原樣保留）。
//   on(ev,fn)      最後一個宣告參數是 ack callback（本檔絕大多數 handler）
//   onNoAck(ev,fn) 沒有 ack 的單向事件（最後一個參數是 payload、或根本沒宣告參數）
// ⚠️ 新增 handler 時選錯會怎樣：該有 ack 卻用 onNoAck ＝ 少一層保護；沒 ack 卻用 on ＝ payload
//    會被換成 no-op（功能整個失效，測試時馬上看得出來）。預設用 on。
// ⚠️ 兩個已知邊界（不是 bug，是這層保護管不到的地方）：
//    1. 靠 fn.length 認 ack 位置，所以 handler 不要用預設值參數或 rest（fn.length 會少算）。
//    2. 只包同步執行那一段；setTimeout／setInterval／第三方 callback 裡丟的例外仍會殺 process
//       （例如 scheduleBots 的 setTimeout、閒置回收器）。那些不是客戶端能直接餵資料的入口。
// 🔴 2026-09-13 Codex 輪次 1 B3：payload 位「一律補成 {}」是錯的修法——它把畸形封包變成合法的空請求，
//    實跑出來的後果：createRoom(null) 靜默建房、setPassword(null) **靜默解除房間密碼**、
//    主管 submitChoice(null) 靜默鎖定「不協查」並可能直接觸發結算。
//    改法：payload 位一定要是「真的物件」，否則直接回 {error:'無效請求'} 並且**不進 handler**（零副作用）。
//    崩潰保護不倒退：拒絕發生在呼叫 handler 之前，解構 undefined 的那顆地雷根本踩不到。
// payload 允許「不給／給 null」的白名單：只放 HEAD 本來就吃得下空 payload 的 handler。
//    startGame 的內文本來就是 `startGame(room,opts||{})`，空 payload ＝用預設設定開局，不是新行為。
const EMPTY_PAYLOAD_OK = new Set(['startGame']);
// 真的 payload ＝ 純物件（POJO）。字串／數字／布林／陣列／**二進位**都是畸形（本檔沒有任何 handler 收這些）。
// 🔴 2026-09-13 Codex 輪次 2 B3-2：`typeof v==='object'` 不等於「純物件」。socket.io 原生支援二進位，
//    Buffer／Uint8Array／ArrayBuffer／Date 全部 typeof 'object'，會整批從舊版檢查底下溜過去，
//    輪次 1 修掉的三條（建房／解除密碼／主管鎖定不協查）換成 Buffer 就原樣復現。
//    三道檢查都選「跨 realm 也成立」的做法（Array.isArray／ArrayBuffer.isView／Object#toString），
//    不用 instanceof 也不比對 Object.prototype——測試用 vm 跑，那兩種寫法會被 realm 差異騙。
function isPayloadObject(v){
  if(typeof v!=='object'||v===null) return false;
  if(Array.isArray(v)||ArrayBuffer.isView(v)) return false;        // 陣列／Buffer／TypedArray／DataView
  return Object.prototype.toString.call(v)==='[object Object]';    // 擋 ArrayBuffer／Date／Map／Set／RegExp…
}
function guardHandlers(socket){
  const noopAck=()=>{};                        // 客戶端沒給 ack（或給了垃圾）時的替身：呼叫不做事也不炸
  const wrap=(event,fn,hasAck)=>(...raw)=>{
    const args=raw.slice();
    const lastRaw=args.length?args[args.length-1]:undefined; // socket.io 保證：真的 ack 一定在最後一個
    const n=fn.length;                         // handler 宣告的參數個數（ack 一律宣告在最後一個）
    while(args.length<n) args.push(undefined); // 客戶端少給參數 → 補齊，免得 ({a,b}) 解構 undefined 就炸
    const payloadSlots=hasAck?Math.max(0,n-1):n;
    if(hasAck&&n>0&&typeof args[n-1]!=='function')                  // ack 位：不是函式就換掉
      args[n-1]=(typeof lastRaw==='function')?lastRaw:noopAck;      //   客戶端多塞參數時仍把真 ack 接回來
    const ack=(hasAck&&n>0&&typeof args[n-1]==='function')?args[n-1]:null;
    for(let i=0;i<payloadSlots;i++){                                // payload 位：驗型別，不合法就明確退件
      if(isPayloadObject(args[i])) continue;
      if(args[i]==null&&EMPTY_PAYLOAD_OK.has(event)){ args[i]={}; continue; }
      if(ack){ try{ ack({error:'無效請求'}); }catch(e){} }           // 單向事件（onNoAck）沒得回話，就只是靜靜丟掉
      return;                                                       // 不呼叫 handler ＝ 保證零狀態變更
    }
    try{ return fn(...args); }
    catch(err){
      // 不是吞錯：完整 stack 照樣印出來（跟崩潰時印的同一份），差別只在別人的房間不用陪葬
      console.error(`🔴 socket handler 例外 event=${event} socket=${socket.id}`, err);
      if(ack){ try{ ack({error:'伺服器內部錯誤，這個動作沒有生效'}); }catch(e){} }
    }
  };
  return { on:(event,fn)=>socket.on(event,wrap(event,fn,true)), onNoAck:(event,fn)=>socket.on(event,wrap(event,fn,false)) };
}

io.on('connection', (socket)=>{
  const {on,onNoAck}=guardHandlers(socket);
  socket.data.roomCode=null;

  on('createRoom', ({name, roomName, password}, cb)=>{
    if(rooms.size>=MAX_ROOMS) return cb&&cb({error:`房間已滿（${MAX_ROOMS}/${MAX_ROOMS}），請稍後再試`});
    name=(name||'玩家').toString().slice(0,12);
    roomName=(roomName||'').toString().trim().slice(0,16)||`${name} 的房間`;
    password=(password||'').toString().trim();
    if(password&&!/^\d{4}$/.test(password)) return cb&&cb({error:'房間密碼須為 4 位數字'});
    const code=newRoomCode();
    const pid=newPid();
    const room={ code, name:roomName, password:password||null, createdAt:Date.now(), lastActivity:Date.now(),
      spectators:new Map(), hostId:pid, players:new Map(), phase:'lobby', round:0,
      config:{rounds:8,bossInspect:1,anxietyOut:ANXIETY_OUT_DEFAULT,completeThreshold:0.7},
      choices:{emp:{},boss:null,ghost:{}}, taskDeck:[], cardDeck:[], tasksIssued:0, tasksDone:0, zoneStreak:{}, log:[], winner:null,
      supervisorId:null, promoteCooldown:0, bossFires:BOSS_FIRES, _timer:null, timerEndsAt:null };
    room.players.set(pid, mkPlayer(pid,socket,name)); rooms.set(code,room);
    socket.join(code); socket.data.roomCode=code; socket.data.playerId=pid; log(room,`【${name}】開了房間 ${code}`);
    cb&&cb({ok:true,code,playerId:pid}); broadcast(room);
  });

  // c-lite 單人練習：真人當員工 ＋ AI 同事 ＋ 腳本老闆（開房即開局；可選 3~6 人局）
  on('createSolo', ({name,threshold,players,seniority}, cb)=>{
    if(rooms.size>=MAX_ROOMS) return cb&&cb({error:`房間已滿（${MAX_ROOMS}/${MAX_ROOMS}），請稍後再試`});
    name=(name||'玩家').toString().slice(0,12);
    const total=Math.min(6,Math.max(3,parseInt(players)||4)); // 含你＋AI老闆
    const wantJunior=(seniority==='junior'); // 職級靠加入順序決定（前半=老鳥）：想當菜鳥就排 bot 後面
    const code=newRoomCode();
    const pid=newPid();
    const room={ code, name:'單人練習', password:null, solo:true, createdAt:Date.now(), lastActivity:Date.now(),
      spectators:new Map(), hostId:pid, players:new Map(), phase:'lobby', round:0,
      config:{rounds:8,bossInspect:1,anxietyOut:ANXIETY_OUT_DEFAULT,completeThreshold:0.7},
      choices:{emp:{},boss:null,ghost:{}}, taskDeck:[], cardDeck:[], tasksIssued:0, tasksDone:0, zoneStreak:{}, log:[], winner:null,
      supervisorId:null, promoteCooldown:0, bossFires:BOSS_FIRES, _timer:null, timerEndsAt:null };
    const roster=shuffle(BOT_EMP_ROSTER).slice(0,total-2);       // 扣掉真人與 AI 老闆＝AI 同事數
    if(!wantJunior) room.players.set(pid, mkPlayer(pid,socket,name)); // 先加＝老鳥（免死金牌）
    for(const [style,bn] of roster){ const b=mkBot(bn,style); room.players.set(b.id,b); }
    if(wantJunior) room.players.set(pid, mkPlayer(pid,socket,name));  // 後加＝菜鳥（能憋氣、摸魚+1分）
    const bossBot=mkBot(BOT_BOSS_NAME,null); room.players.set(bossBot.id,bossBot); room.soloBossId=bossBot.id;
    rooms.set(code,room);
    socket.join(code); socket.data.roomCode=code; socket.data.playerId=pid;
    log(room,`【${name}】開了單人練習房（vs ${roster.map(r=>r[1]).join('、')}＋${BOT_BOSS_NAME}）`);
    const res=startGame(room,{threshold:threshold||'mid', seniorityMode:'balanced'});
    if(res.error){ rooms.delete(code); return cb&&cb(res); }
    cb&&cb({ok:true,code,playerId:pid}); broadcast(room);
  });

  on('joinRoom', ({code,name,password}, cb)=>{
    code=(code||'').toString().toUpperCase().trim(); name=(name||'玩家').toString().slice(0,12);
    const room=rooms.get(code);
    if(!room) return cb&&cb({error:'找不到房間'});
    if(room.phase!=='lobby') return cb&&cb({error:'遊戲已開始，無法加入', canSpectate:true});
    if(room.players.size>=6) return cb&&cb({error:'房間已滿（最多 6 人）', canSpectate:true});
    if(room.password){
      const pwd=(password||'').toString().trim();
      if(pwd!==room.password) return cb&&cb({error:pwd?'密碼錯誤':'此房間已上鎖', needPassword:true});
    }
    touch(room);
    const pid=newPid();
    room.players.set(pid, mkPlayer(pid,socket,name)); socket.join(code); socket.data.roomCode=code; socket.data.playerId=pid;
    log(room,`【${name}】加入房間`); cb&&cb({ok:true,code,playerId:pid}); broadcast(room);
  });

  // 斷線重連：憑 playerId 綁回原座位（任何階段皆可，含遊戲中）
  on('rejoin', ({code,playerId}, cb)=>{
    code=(code||'').toString().toUpperCase().trim();
    const room=rooms.get(code);
    if(!room) return cb&&cb({error:'房間已不存在'});
    const me=room.players.get((playerId||'').toString());
    if(!me||me.isBot) return cb&&cb({error:'找不到你的座位'});
    if(me.connected&&me.socket&&me.socket.id!==socket.id){ try{me.socket.disconnect(true);}catch(e){} } // 舊分頁擠下線
    me.socket=socket; me.connected=true; touch(room);
    socket.join(code); socket.data.roomCode=code; socket.data.playerId=me.id;
    log(room,`【${me.name}】重新連線`);
    cb&&cb({ok:true,code,playerId:me.id}); broadcast(room);
  });

  on('listRooms', (cb)=>{ cb&&cb({ok:true, rooms:lobbySnapshot(), count:rooms.size, max:MAX_ROOMS}); });

  on('spectateRoom', ({code,password}, cb)=>{
    code=(code||'').toString().toUpperCase().trim();
    const room=rooms.get(code);
    if(!room) return cb&&cb({error:'找不到房間'});
    if(room.password){
      const pwd=(password||'').toString().trim();
      if(pwd!==room.password) return cb&&cb({error:pwd?'密碼錯誤':'此房間已上鎖', needPassword:true});
    }
    room.spectators.set(socket.id,{id:socket.id,socket});
    socket.data.specCode=code;
    cb&&cb({ok:true});
    socket.emit('spec', specView(room));
  });
  onNoAck('specLeave', ()=>{ const room=rooms.get(socket.data.specCode); if(room&&room.spectators) room.spectators.delete(socket.id); socket.data.specCode=null; });

  // 房主變更/解除房間密碼（已在房內者不受影響；舊邀請連結的 key 會失效）
  on('setPassword', ({password}, cb)=>{
    const room=rooms.get(socket.data.roomCode); if(!room) return cb&&cb({error:'你不在任何房間'});
    if(socket.data.playerId!==room.hostId) return cb&&cb({error:'只有房主能改密碼'});
    password=(password||'').toString().trim();
    if(password&&!/^\d{4}$/.test(password)) return cb&&cb({error:'密碼須為 4 位數字'});
    room.password=password||null; touch(room);
    log(room, password?'🔑 房主更新了房間密碼':'🔓 房主解除了房間密碼');
    cb&&cb({ok:true}); broadcast(room);
  });

  // 房主主動關閉房間，釋出名額
  on('closeRoom', (cb)=>{
    const room=rooms.get(socket.data.roomCode); if(!room) return cb&&cb({error:'你不在任何房間'});
    if(socket.data.playerId!==room.hostId) return cb&&cb({error:'只有房主能關閉房間'});
    clearTimer(room);
    for(const p of room.players.values()){
      if(p.connected&&p.socket){ p.socket.emit('kicked',{reason:'房主關閉了房間'}); p.socket.leave(room.code); p.socket.data.roomCode=null; }
    }
    if(room.spectators) for(const s of room.spectators.values()){ s.socket.emit('kicked',{reason:'房主關閉了房間'}); s.socket.data.specCode=null; }
    rooms.delete(room.code);
    cb&&cb({ok:true});
  });

  // 邀請連結 QR Code（伺服器端產生，不經第三方服務）
  on('makeQR', ({text}, cb)=>{
    if(typeof text!=='string'||text.length>300||!/^https?:\/\//.test(text)) return cb&&cb({error:'無效的連結'});
    QRCode.toDataURL(text, {width:300, margin:1}, (e,dataUrl)=>{
      cb&&cb(e?{error:'QR Code 產生失敗'}:{ok:true, dataUrl});
    });
  });

  on('startGame', (opts, cb)=>{
    const room=rooms.get(socket.data.roomCode); if(!room) return;
    if(socket.data.playerId!==room.hostId) return cb&&cb({error:'只有房主能開始'});
    touch(room);
    const res=startGame(room,opts||{}); if(res.error) return cb&&cb(res);
    cb&&cb({ok:true}); broadcast(room);
  });

  on('assignTask', ({targetId}, cb)=>{
    const room=rooms.get(socket.data.roomCode); if(!room||room.phase!=='admin') return;
    const b=bossOf(room); if(!b||socket.data.playerId!==b.id) return cb&&cb({error:'只有老闆能派任務'});
    const t=room.players.get(targetId);
    if(!t||t.role!=='emp'||!t.alive||t.task||t.isSupervisor) return cb&&cb({error:'該員工不可指派'});
    if(room.taskDeck.length===0) return cb&&cb({error:'任務卡用完了'});
    const name=room.taskDeck.shift();
    t.task={name,need:TASK_NEED,deadlineLeft:TASK_DEADLINE,progress:0,state:'active'}; room.tasksIssued++;
    log(room,`📋 老闆派給【${t.name}】：${name}`); cb&&cb({ok:true}); broadcast(room);
  });

  on('promote', ({targetId}, cb)=>{
    const room=rooms.get(socket.data.roomCode); if(!room||room.phase!=='admin') return;
    const b=bossOf(room); if(!b||socket.data.playerId!==b.id) return cb&&cb({error:'只有老闆能升職'});
    if(room.promoteCooldown>0) return cb&&cb({error:`升職令冷卻中（還 ${room.promoteCooldown} 回）`});
    const t=room.players.get(targetId);
    if(!t||t.role!=='emp'||!t.alive||t.isSupervisor) return cb&&cb({error:'不可升職此人'});
    if(room.supervisorId) return cb&&cb({error:'已經有主管了'});
    t.isSupervisor=true; t.supTermLeft=SUPERVISOR_TERM; room.supervisorId=t.id; room.promoteCooldown=PROMOTE_COOLDOWN;
    chron(room,{type:'promote',name:t.name});
    log(room,`🧑‍💼 老闆升【${t.name}】為代理主管（任期 ${SUPERVISOR_TERM} 回，不能摸魚、可協查抓人）`);
    cb&&cb({ok:true}); broadcast(room);
  });

  on('fire', ({targetId}, cb)=>{
    const room=rooms.get(socket.data.roomCode); if(!room||room.phase!=='admin') return;
    const b=bossOf(room); if(!b||socket.data.playerId!==b.id) return cb&&cb({error:'只有老闆能資遣'});
    if(room.bossFires<=0) return cb&&cb({error:'資遣次數用完了'});
    const t=room.players.get(targetId);
    if(!t||t.role!=='emp'||!t.alive||!t.canBeFired) return cb&&cb({error:'此人不可資遣（需有逾期紀錄）'});
    if(t.seniority==='senior'&&t.immunity>0){ t.immunity--; t.canBeFired=false; room.bossFires--; log(room,`🛡️【${t.name}】用免死金牌擋下資遣！`); return cb&&cb({ok:true, blocked:true}), broadcast(room); }
    t.alive=false; t.isGhost=true; if(t.isSupervisor){t.isSupervisor=false; if(room.supervisorId===t.id)room.supervisorId=null;}
    room.bossFires--; chron(room,{type:'fire',name:t.name,pid:t.id}); log(room,`🔨 老闆資遣了【${t.name}】！（剩 ${room.bossFires} 次）`);
    cb&&cb({ok:true}); broadcast(room);
    checkWin(room); broadcast(room);
  });

  // ---- 點數經濟：補給市場（admin 階段限定；員工用💰、老闆用部門經費買加班令）----
  on('buyCard', ({idx}, cb)=>{
    const room=rooms.get(socket.data.roomCode); if(!room||room.phase!=='admin') return cb&&cb({error:'只有老闆行政時間能採購'});
    const me=room.players.get(socket.data.playerId); if(!me||!me.alive) return;
    if(me._boughtRound===room.round) return cb&&cb({error:'每回合限購 1 件'});
    // idx === -1 ＝老闆專屬固定供應槽：加班令
    if(idx===-1){
      if(me.role!=='boss') return cb&&cb({error:'加班令是老闆專屬'});
      if(me.hand.some(c=>c.type==='overtime')) return cb&&cb({error:'手上已有一張加班令，先打出去'});
      if((me.budget||0)<PRICES.overtime) return cb&&cb({error:`部門經費不足（要 ${PRICES.overtime}，剩 ${me.budget||0}）`});
      me.budget-=PRICES.overtime; me.hand.push({type:'overtime',name:CARD_DEFS.overtime.name});
      me._boughtRound=room.round; touch(room);
      log(room,`🛒【${me.name}】買了 🕘加班令`);
      return cb&&cb({ok:true}), broadcast(room);
    }
    const card=room.market[idx]; if(!card) return cb&&cb({error:'這格已被買走'});
    const price=PRICES[card.type]||2;
    if(me.role==='boss') return cb&&cb({error:'河道是員工福利社，老闆請買加班令'});
    if(me.hand.length>=HAND_LIMIT) return cb&&cb({error:`手牌已滿（${HAND_LIMIT} 張）`});
    if(me.points<price) return cb&&cb({error:`💰不夠（要 ${price}，剩 ${me.points}）——花的可是王位分數`});
    me.points-=price; me.hand.push({type:card.type,name:card.name});
    me._boughtRound=room.round;
    room.market.splice(idx,1); refillMarket(room); touch(room);
    log(room,`🛒【${me.name}】買了 ${CARD_DEFS[card.type].icon}${CARD_DEFS[card.type].name}`);
    cb&&cb({ok:true}); broadcast(room);
  });

  // 深呼吸：3💰 洗 1💓（限心悸≥門檻-2、每回合 1 次）
  on('breathe', (cb)=>{
    const room=rooms.get(socket.data.roomCode); if(!room||(room.phase!=='admin'&&room.phase!=='choosing')) return cb&&cb({error:'現在不是深呼吸的時候'});
    const me=room.players.get(socket.data.playerId); if(!me||me.role!=='emp'||!me.alive) return cb&&cb({error:'不可用'});
    if(me._breathedRound===room.round) return cb&&cb({error:'這回合已經深呼吸過了'});
    if(me.anxiety<room.config.anxietyOut-2) return cb&&cb({error:'還不夠緊張，省著點花'});
    if(me.points<BREATHE_COST) return cb&&cb({error:`💰不夠（要 ${BREATHE_COST}）`});
    me.points-=BREATHE_COST; me.anxiety=Math.max(0,me.anxiety-1); me._breathedRound=room.round;
    log(room,`😮‍💨【${me.name}】花 ${BREATHE_COST}💰 深呼吸壓驚（💓−1）`);
    cb&&cb({ok:true}); broadcast(room);
  });

  // 拒絕加班：付 3💰 請假開溜（形態3 兩面張力——付不起就只能乖乖加班）
  on('refuseOvertime', (cb)=>{
    const room=rooms.get(socket.data.roomCode); if(!room||(room.phase!=='admin'&&room.phase!=='choosing')) return cb&&cb({error:'現在不能請假'});
    const me=room.players.get(socket.data.playerId); if(!me||me.role!=='emp'||!me.alive) return cb&&cb({error:'不可用'});
    if(me._otRound!==room.round) return cb&&cb({error:'你沒有被要求加班'});
    if(me.points<OT_REFUSE_COST) return cb&&cb({error:`💰不夠（要 ${OT_REFUSE_COST}）——只能乖乖加班了`});
    me.points-=OT_REFUSE_COST; me._otRound=0;
    log(room,`🏃【${me.name}】燒了 ${OT_REFUSE_COST}💰 請假開溜，拒絕加班！`);
    cb&&cb({ok:true}); broadcast(room);
  });

  // 加班令：老闆行政階段打出手上的加班令
  on('orderOvertime', ({targetId}, cb)=>{
    const room=rooms.get(socket.data.roomCode); if(!room||room.phase!=='admin') return cb&&cb({error:'只有行政時間能派加班'});
    const b=bossOf(room); if(!b||socket.data.playerId!==b.id) return cb&&cb({error:'只有老闆能要求加班'});
    const ci=b.hand.findIndex(c=>c.type==='overtime'); if(ci<0) return cb&&cb({error:'手上沒有加班令（去補給市場買）'});
    const t=room.players.get(targetId);
    if(!t||t.role!=='emp'||!t.alive||t.isSupervisor) return cb&&cb({error:'這位員工不能被指派加班'});
    if(t._otRound===room.round) return cb&&cb({error:'他這回合已經在加班了'});
    b.hand.splice(ci,1); t._otRound=room.round;
    log(room,`🕘 老闆對【${t.name}】打出加班令！本回合不能摸魚（認真做有加班費 +2💰）`);
    cb&&cb({ok:true}); broadcast(room);
  });

  on('drawRoundCards', (cb)=>{
    const room=rooms.get(socket.data.roomCode), p=room?.players.get(socket.data.playerId);
    if(!room||!p||room.phase!=='admin'||p.role!=='emp'||!p.alive) return cb?.({error:'目前不能抽牌'});
    drawRoundHand(room,p);touch(room);cb?.({ok:true});broadcast(room);
  });
  on('practiceGhostPass', (cb)=>{
    const room=rooms.get(socket.data.roomCode),p=room?.players.get(socket.data.playerId);
    if(!room?.solo||room.phase!=='choosing'||!p?.isGhost||p.id!==room.hostId)return cb?.({error:'目前不能略過幽靈行動'});
    // 已經作祟過就不准覆蓋——否則 pass 會把剛送出的 haunt/warn/disrupt 吃掉（搞鬼王的事蹟跟著一起消失）
    if(room.choices.ghost[p.id])return cb?.({error:'本回合已作祟過了'});
    room.choices.ghost[p.id]={type:'pass'};touch(room);tryResolve(room);broadcast(room);cb?.({ok:true});
  });
  on('practiceReady', (cb)=>{
    const room=rooms.get(socket.data.roomCode), p=room?.players.get(socket.data.playerId);
    if(!room?.solo||!p||p.id!==room.hostId||room.phase!=='admin')return cb?.({error:'目前不能開始選牌'});
    if(!room.adminReady)return cb?.({error:'老闆正在準備，請稍候'});
    if(p.alive&&p.role==='emp'&&p._drawnRound!==room.round)return cb?.({error:'先抽取本回合手牌'});
    touch(room);enterChoose(room);broadcast(room);cb?.({ok:true});
  });
  on('beginRound', (cb)=>{
    const room=rooms.get(socket.data.roomCode); if(!room||room.phase!=='admin') return;
    const b=bossOf(room); if(!b||socket.data.playerId!==b.id) return cb&&cb({error:'只有老闆能開始本回合'});
    enterChoose(room); broadcast(room);
  });

  on('submitChoice', (payload, cb)=>{
    const room=rooms.get(socket.data.roomCode); if(!room||room.phase!=='choosing') return;
    const me=room.players.get(socket.data.playerId); if(!me) return;
    if(!me.alive){
      // 幽靈行動（不擋結算節奏；沒出就跳過）
      if(!me.isGhost) return;
      const ga=payload&&payload.ghostAction;
      // hasKey 不是 GHOST_ACTIONS[ga.type]：`type:'__proto__'` 會拿到 Object.prototype（truthy）通過驗證，
      // 然後在 choices.ghost 占住這回合的名額，讓幽靈連真的作祟都送不出去（實測 → 「本回合已作祟過了」）。
      if(!ga||!hasKey(GHOST_ACTIONS,ga.type)) return cb&&cb({error:'無效的幽靈行動'});
      if(me.ghostCooldown>0) return cb&&cb({error:`幽靈行動冷卻中（還 ${me.ghostCooldown} 回）`});
      if(room.choices.ghost[me.id]) return cb&&cb({error:'本回合已作祟過了'});
      let gtarget=null;
      if(ga.type==='warn'){
        const t=room.players.get(ga.targetId);
        if(!t||t.role!=='emp'||!t.alive) return cb&&cb({error:'報信對象無效'});
        gtarget=t.id;                                     // 存驗證過的 pid，不存客戶端原值
      }
      room.choices.ghost[me.id]={type:ga.type, targetId:gtarget};
      cb&&cb({ok:true}); tryResolve(room); broadcast(room); return;
    }
    if(me.role==='boss'){
      // zones 必須是「真的陣列」＋每個元素都是 ZONES 自己的字串鍵：
      //   非陣列（Buffer/Map/Date…）以前會在 .filter 丟 TypeError（被 guard 接住回 500），現在直接退件；
      //   元素是 ['tea']／Buffer('tea') 以前會通過 `ZONES[z]` 的隱式轉字串，然後原值被存進 choices → 巡查白巡。
      const picks=(Array.isArray(payload.zones)?payload.zones:[]).filter(z=>isZoneKey(z)&&z!=='office');
      if(picks.length!==room.config.bossInspect) return cb&&cb({error:`請選 ${room.config.bossInspect} 個要查的地方`});
      for(const z of picks) if((room.zoneStreak[z]||0)>=2) return cb&&cb({error:`「${ZONES[z].name}」已連查兩回合`});
      // 緊盯（觀察 30/60%）：限巡查區之一、經費夠才收
      // hasKey 不是 FOCUS_COST[bf.pct]：`pct:'__proto__'` 會拿到 Object.prototype（truthy）→ 通過驗證，
      // 而且 `budget < Object.prototype` 是 false（NaN 比較），連經費檢查都繞得過。
      let focus=null; const bf=payload.focus;
      if(bf&&bf.zone&&picks.includes(bf.zone)&&hasKey(FOCUS_COST,bf.pct)){
        if((me.budget||0)<FOCUS_COST[bf.pct]) return cb&&cb({error:`部門經費不足，盯不動（要 ${FOCUS_COST[bf.pct]}）`});
        focus={zone:bf.zone,pct:bf.pct};
      }
      room.choices.boss={zones:picks,focus};
    } else if(me.isSupervisor){
      // 沒選（null/undefined/''）＝不協查，維持原行為；有選就必須是真的摸魚區字串鍵
      const zone=payload.inspectZone; if(zone&&!(isZoneKey(zone)&&zone!=='office')) return cb&&cb({error:'協查地點無效'});
      room.choices.emp[me.id]={action:'supervise', zone: zone||null};
    } else {
      // helpTarget 只收字串：結算時是 `room.players.has(ht)` 嚴格比對，非字串本來就永遠罩不到人，
      // 但舊寫法會把客戶端送來的 Buffer／Map／函式原樣掛在 room.choices 上（實測 12 種型別全部存得進去）。
      const action=payload.action; const helpTarget=(typeof payload.helpTarget==='string')?payload.helpTarget:null;
      const risky=!!payload.risky;
      let cardIdx=null, cardTarget=null;
      if(payload.cardIdx!=null){
        // 必須是整數索引：`cardIdx:'__proto__'` 會讓 me.hand['__proto__'] 拿到 Object.prototype（truthy）
        //   → 下一行 CARD_DEFS[undefined].kind 直接 TypeError（實測被 guard 接住回「伺服器內部錯誤」）；
        //   `cardIdx:[0]` 則會把陣列原樣存進 choices。
        const c=Number.isInteger(payload.cardIdx)?me.hand[payload.cardIdx]:null;
        if(!c) return cb&&cb({error:'沒有這張手牌'});
        if(CARD_DEFS[c.type].kind!=='item') return cb&&cb({error:'藉口卡不用出，被抓時會自動使用'});
        cardIdx=payload.cardIdx;
        if(c.type==='mooch'){
          const t=room.players.get(payload.cardTarget);
          if(!t||t.role!=='emp'||!t.alive||t.id===me.id) return cb&&cb({error:'🙏 要凹誰？選一位同事'});
          cardTarget=t.id;
        }
      }
      if(action==='work'||action==='idle') room.choices.emp[me.id]={action,zone:'office',helpTarget,cardIdx,cardTarget};
      else if(action==='slack'){ const zone=payload.zone;
        if(me._otRound===room.round) return cb&&cb({error:`🕘 你被要求加班，本回合不能摸魚！（可付 ${OT_REFUSE_COST}💰 請假開溜）`});
        if(!isZoneKey(zone)||zone==='office') return cb&&cb({error:'請選一個摸魚區'});
        if(me.lastZone===zone) return cb&&cb({error:`上回合已在「${ZONES[zone].name}」，換地方`});
        // 賭命衝刺限 gain≥2 的區（老鳥在低分區拼了=純懲罰，直接擋）
        if(risky){ const g=ZONES[zone].slack+(me.seniority==='senior'?-1:1); if(g<2) return cb&&cb({error:'這區報酬太低，不值得拼命（🎲限💰+2以上的區）'}); }
        // 憋氣：菜鳥限定
        let hold=0;
        if(payload.hold){ if(me.seniority!=='junior') return cb&&cb({error:'🫁 憋氣是菜鳥的求生術（老鳥有免死金牌）'});
          hold=(payload.hold===60)?60:30; }
        room.choices.emp[me.id]={action:'slack',zone,helpTarget,cardIdx,cardTarget,risky,hold};
      } else return cb&&cb({error:'無效動作'});
    }
    cb&&cb({ok:true});
    tryResolve(room);
    broadcast(room);
  });

  onNoAck('nextRound', ()=>{ const room=rooms.get(socket.data.roomCode); if(!room||socket.data.playerId!==room.hostId||room.phase!=='reveal') return;
    if(room.revealSkipAt && Date.now()<room.revealSkipAt) return; // 前 5 秒不能跳
    advanceRound(room); broadcast(room); });

  onNoAck('restart', ()=>{
    const room=rooms.get(socket.data.roomCode); if(!room||socket.data.playerId!==room.hostId) return;
    clearTimer(room); touch(room);
    for(const [id,p] of room.players) if(!p.connected) room.players.delete(id); // 再玩一局時剔除離線者
    room.phase='lobby'; room.round=0; room.winner=null; room.choices={emp:{},boss:null,ghost:{}};
    room.tasksIssued=0; room.tasksDone=0; room.supervisorId=null; room.promoteCooldown=0; room.bossFires=BOSS_FIRES;
    for(const p of room.players.values()){ p.role=null;p.seniority=null;p.alive=true;p.isGhost=false;p.slackCount=0;p.points=0;p.anxiety=0;p.lastZone=null;p.task=null;p.immunity=0;p.isSupervisor=false;p.supTermLeft=0;p.helpCooldown=0;p.canBeFired=false;p.hand=[];p.ghostCooldown=0; }
    log(room,'房主重開一局。'); broadcast(room);
  });

  // ---- 語音（WebRTC 信令；實際音訊走 P2P） ----
  onNoAck('voice-join', ()=>{
    const room=rooms.get(socket.data.roomCode); if(!room) return;
    const me=room.players.get(socket.data.playerId); if(!me) return; me.voiceOn=true;
    // 語音信令走 socket.id 路由（io.to 需要 socket room），與遊戲身分 playerId 分離
    const peers=[...room.players.values()].filter(p=>p.voiceOn&&p.connected&&p.socket&&p.socket.id!==socket.id).map(p=>({id:p.socket.id,name:p.name}));
    socket.emit('voice-peers', peers);                              // 我方主動 offer 這些既有語音者
    socket.to(room.code).emit('voice-joined', {id:socket.id, name:me.name});
  });
  onNoAck('voice-leave', ()=>{ const room=rooms.get(socket.data.roomCode); if(!room) return; const me=room.players.get(socket.data.playerId); if(me) me.voiceOn=false; socket.to(room.code).emit('voice-left',{id:socket.id}); });
  // ⚠️ voice-signal 的最後一個參數是 payload 不是 ack，一定要走 onNoAck（用 on 會把 payload 換成 no-op）
  onNoAck('voice-signal', ({to,data})=>{ io.to(to).emit('voice-signal',{from:socket.id, data}); });

  onNoAck('disconnect', ()=>{
    const sr=rooms.get(socket.data.specCode); if(sr&&sr.spectators) sr.spectators.delete(socket.id);
    const room=rooms.get(socket.data.roomCode); if(!room) return;
    const me=room.players.get(socket.data.playerId);
    if(me&&me.socket&&me.socket.id!==socket.id) return; // 已被新連線 rebind（rejoin 擠下線），舊 socket 的 disconnect 不動座位
    if(me){
      if(me.voiceOn){ me.voiceOn=false; socket.to(room.code).emit('voice-left',{id:socket.id}); }
      me.connected=false; me.socket=null;
      // 等待室/結算畫面離線＝直接讓出名額；遊戲中保留座位（角色還在局裡，可憑 playerId 重連）
      if(room.phase==='lobby'||room.phase==='ended'){ room.players.delete(me.id); touch(room); log(room,`【${me.name}】離開房間（名額已釋出）`); }
      else { touch(room); log(room,`【${me.name}】離線（可重新整理頁面重連）`); }
    }
    if(me&&me.id===room.hostId){ const others=[...room.players.values()].filter(p=>p.connected&&!p.isBot); if(others.length){ room.hostId=others[0].id; log(room,`房主離線，改由【${others[0].name}】接手`); } }
    if(room.players.size===0){ clearTimer(room); rooms.delete(room.code); return; }
    // 遊戲中全員（真人）離線不立即刪房——保留給重連，交給閒置回收器（ABANDON_MS）
    if((room.phase==='lobby'||room.phase==='ended')&&!humanConnected(room)){ clearTimer(room); rooms.delete(room.code); return; }
    broadcast(room);
  });
});

// 閒置房回收：等待中 30 分沒動靜、或結束後 5 分 → 關房，讓 10 個名額流動
setInterval(()=>{
  const now=Date.now();
  for(const room of rooms.values()){
    const idle=now-(room.lastActivity||room.createdAt||now);
    const inGame=room.phase!=='lobby'&&room.phase!=='ended';
    const expired=(room.phase==='lobby'&&idle>LOBBY_IDLE_MS)||(room.phase==='ended'&&idle>ENDED_IDLE_MS)
      ||(inGame&&!humanConnected(room)&&idle>ABANDON_MS);
    if(!expired) continue;
    clearTimer(room);
    for(const p of room.players.values()){
      if(p.connected&&p.socket){
        p.socket.emit('kicked',{reason:room.phase==='lobby'?'房間閒置超過 30 分鐘，已自動關閉':'遊戲已結束，房間已回收'});
        p.socket.leave(room.code); p.socket.data.roomCode=null;
      }
    }
    if(room.spectators) for(const s of room.spectators.values()){ s.socket.emit('kicked',{reason:'房間已關閉'}); s.socket.data.specCode=null; }
    rooms.delete(room.code);
  }
}, 60*1000);

const PORT=process.env.PORT||3000;
const httpServer=http.createServer(app);
io.attach(httpServer);
httpServer.listen(PORT, ()=>console.log(`摸魚王 online (Phase4 幽靈+手牌+動畫揭曉) HTTP 已啟動 :${PORT}`));

// HTTPS（自簽憑證）供語音使用（麥克風 getUserMedia 需安全連線）
try{
  const keyF='/app/certs/key.pem', certF='/app/certs/cert.pem';
  if(fs.existsSync(keyF)&&fs.existsSync(certF)){
    const httpsServer=https.createServer({key:fs.readFileSync(keyF),cert:fs.readFileSync(certF)}, app);
    io.attach(httpsServer);
    const HPORT=process.env.HTTPS_PORT||3443;
    httpsServer.listen(HPORT, ()=>console.log(`HTTPS（語音）已啟動 :${HPORT}`));
  } else console.log('未找到憑證，僅 HTTP；語音需 HTTPS（放 /app/certs/key.pem,cert.pem）');
}catch(e){ console.log('HTTPS 啟動失敗：', e.message); }
