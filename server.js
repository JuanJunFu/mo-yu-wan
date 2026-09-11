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
};
// ---------- 點數經濟（2026-09-11 MVP）：💰=偷懶點數（也是王位分數）、老闆用部門經費 ----------
const PRICES = { excuse:3, energy:3, jam:2, boost:3, overtime:3 }; // energy/boost≥3：天然匯率約2-3💰/💓，低於此=套利洞
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
  return deck;
}
function drawCard(room, p){
  if (!room.cardDeck.length || p.hand.length >= HAND_LIMIT) return null;
  const c = room.cardDeck.shift(); p.hand.push(c); return c;
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
function mkPlayer(pid,socket,name){ return { id:pid, socket, name, connected:true, isBot:false, role:null, seniority:null,
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
    zones:ZONES, slackZones:SLACK_ZONES, solo:!!room.solo,
    market: (room.market||[]).map(c=>({type:c.type,name:CARD_DEFS[c.type].name,icon:CARD_DEFS[c.type].icon,desc:CARD_DEFS[c.type].desc,price:PRICES[c.type]||2,bossOnly:c.type==='overtime'})),
    bossPattern: room.bossPattern ? { key:room.bossPattern, name:BOSS_PATTERNS[room.bossPattern].name, hint:BOSS_PATTERNS[room.bossPattern].hint } : null,
    supervisorName: room.supervisorId ? (room.players.get(room.supervisorId)||{}).name : null,
    you: me ? {
      id:me.id, name:me.name, role:me.role, seniority:me.seniority, alive:me.alive, isGhost:me.isGhost,
      slackCount:me.slackCount, anxiety:me.anxiety, points:me.points, lastZone:me.lastZone, immunity:me.immunity,
      isSupervisor:me.isSupervisor, supTermLeft:me.supTermLeft, helpCooldown:me.helpCooldown, canBeFired:me.canBeFired,
      task: me.task ? {name:me.task.name,progress:me.task.progress,need:me.task.need,deadlineLeft:me.task.deadlineLeft,state:me.task.state} : null,
      submitted: me.role==='boss' ? room.choices.boss!=null : (room.choices.emp[me.id]!=null),
      isHost: me.id===room.hostId,
      hand: me.hand.map(c=>({type:c.type, name:c.name, icon:CARD_DEFS[c.type].icon, kind:CARD_DEFS[c.type].kind, desc:CARD_DEFS[c.type].desc})),
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
    reveal: room.phase==='reveal' ? room.lastReveal : null,
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
    p.hand=[]; p.ghostCooldown=0; p.otCount=0;
  }
  room.cardDeck=shuffle(buildCardDeck());
  for(let i=0;i<START_HAND;i++) for(const p of room.players.values()) if(p.role==='emp') drawCard(room,p);
  // 補給市場（三張河道）＋老闆部門經費
  room.marketDeck=shuffle(buildMarketDeck()); room.market=[]; refillMarket(room);
  for(const p of room.players.values()){ p.budget=(p.id===bossId)?BOSS_START_BUDGET:0; p._boughtRound=0; p._breathedRound=0; p._otRound=0; }
  const n=ids.length;
  room.config.rounds=opts.rounds||(n<=3?6:8);
  room.config.bossInspect=(n<=3)?2:1;
  room.config.anxietyOut=(n>=6)?5:ANXIETY_OUT_DEFAULT;
  room.config.completeThreshold={low:0.6,mid:0.7,high:0.8}[opts.threshold]||0.7;
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
  room.phase='admin'; room.choices={emp:{},boss:null,ghost:{}};
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
  startTimer(room, ADMIN_SEC, ()=>{ enterChoose(room); broadcast(room); });
  if(b&&b.isBot) scheduleBotAdmin(room);
  scheduleBotEconomy(room);
}
function enterChoose(room){
  room.phase='choosing'; room.choices={emp:{},boss:null,ghost:{}};
  startTimer(room, CHOOSE_SEC, ()=>{
    for(const e of aliveEmps(room)) if(room.choices.emp[e.id]==null) room.choices.emp[e.id]= e.isSupervisor?{action:'supervise',zone:null}:{action:'idle',zone:'office'};
    if(room.choices.boss==null) room.choices.boss={zones:[]};
    resolveRound(room); broadcast(room);
  });
  scheduleBots(room);
}

// ---------- 結算 ----------
function resolveRound(room){
  clearTimer(room);
  const emps=aliveEmps(room);
  const bossZones=[...((room.choices.boss&&room.choices.boss.zones)||[])];
  const choiceOf=e=>room.choices.emp[e.id]||(e.isSupervisor?{action:'supervise',zone:null}:{action:'idle',zone:'office'});

  // 主管協查區
  const sup=room.supervisorId?room.players.get(room.supervisorId):null;
  let supZone = (sup&&sup.alive&&sup.isSupervisor) ? (choiceOf(sup).zone||null) : null;

  // ① 幽靈行動先套用（改變巡查版圖）
  const ghostNotes=[]; const warnedSet=new Set();
  for(const [gid,ga] of Object.entries(room.choices.ghost||{})){
    const g=room.players.get(gid); if(!g||!g.isGhost||g.ghostCooldown>0) continue;
    if(ga.type==='haunt'&&bossZones.length){
      const rm=bossZones.splice(Math.floor(Math.random()*bossZones.length),1)[0];
      ghostNotes.push({icon:'👻',text:`幽靈【${g.name}】作祟，老闆的【${ZONES[rm].name}】巡查泡湯`});
    } else if(ga.type==='disrupt'&&supZone){
      ghostNotes.push({icon:'🌀',text:`幽靈【${g.name}】打斷了主管協查`}); supZone=null;
    } else if(ga.type==='warn'&&ga.targetId&&room.players.has(ga.targetId)){
      warnedSet.add(ga.targetId);
      ghostNotes.push({icon:'📞',text:'有幽靈偷偷通風報信…'});
    } else continue;
    g.ghostCooldown=GHOST_COOLDOWN;
  }

  // ② 道具出牌（結算期生效；出牌即消耗）
  const energyOf={}, boostSet=new Set();
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
    const ch=choiceOf(e); const r={name:e.name, seniority:e.seniority, note:'', zone:'office'};
    if(energyOf[e.id]) pending[e.id]-=energyOf[e.id];
    if(e.isSupervisor){
      r.zoneName='主管巡查'; r.supervisor=true; r.zone=supZone||'office';
      if(e.task){ e.task.progress+=1; }
      r.note = supZone ? `主管，協查【${ZONES[supZone].name}】（免疫被抓）` : '主管，未協查（免疫被抓）';
      e.lastZone='office';
    } else if(ch.action==='work'){
      safeCount++; r.zoneName='認真工作'; r.working=true;
      const ot=(e._otRound===room.round);
      if(ot){ e.points+=2; pending[e.id]+=1; r.ot=true; e.otCount=(e.otCount||0)+1; chron(room,{type:'ot',name:e.name});
        if(e.task){ e.task.progress+=2; r.note=`🕘 加班！任務 +2（${e.task.progress}/${e.task.need}）、加班費 +2💰、過勞 +1💓`; } else r.note='🕘 加班！加班費 +2💰、過勞 +1💓';
      } else {
        pending[e.id]-=1; e.points=Math.max(0,e.points-1);
        if(e.task){ e.task.progress+=2; r.note=`認真工作：任務 +2（${e.task.progress}/${e.task.need}）、心悸 −1、💰−1`; } else r.note='認真工作：心悸 −1、💰−1';
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
          chron(room,{type:'held',name:e.name,zone:z.name,pct:holdPct});
        } else {
        const exIdx=e.hand.findIndex(c=>c.type==='excuse');
        if(exIdx>=0){ const c=e.hand.splice(exIdx,1)[0]; r.caught='excused'; r.note=`被抓，但掏出藉口「${c.name}」滑走了！`; chron(room,{type:'shield',kind:'excused',name:e.name,detail:c.name}); }
        else if(warnedSet.has(e.id)){ r.caught='warned'; r.note='被抓前收到幽靈報信，及時溜回座位！'; chron(room,{type:'shield',kind:'warned',name:e.name}); }
        else if(guarded.has(e.id)){ r.caught='guarded'; r.note='被抓，但老鳥罩學弟擋下了！'; chron(room,{type:'shield',kind:'guarded',name:e.name}); }
        else if(e.seniority==='senior'&&e.immunity>0){ e.immunity--; r.caught='blocked'; r.note='被抓，但免死金牌擋下！'; chron(room,{type:'shield',kind:'blocked',name:e.name}); }
        else { const anx=(e.seniority==='junior')?3:2; pending[e.id]+=anx; r.caught=true; r.anx=anx; r.note=`被逮到！這次不算，心悸 +${anx}`;
          chron(room,{type:'catch',name:e.name,zone:z.name});
          // 主管檢舉獎金：若在主管協查區被抓
          if(supZone&&zone===supZone&&sup){ sup.points+=2; r.byBoss=false; log(room,`🕵️ 主管【${sup.name}】協查抓到【${e.name}】(+2 分)`); }
        }
        }
      } else {
        let gain=z.slack+(e.seniority==='senior'?-1:1); if(gain<0)gain=0;
        if(boostSet.has(e.id)) gain+=2;
        if(ch.risky) gain*=2;
        e.slackCount++; e.points+=gain; pending[e.id]+=z.anxiety; r.gain=gain;
        if(gain>=5) chron(room,{type:'bigwin',name:e.name,zone:z.name,gain,risky:!!ch.risky});
        r.note=`摸魚成功！💰+${gain}、心悸 +${z.anxiety}${ch.risky?'（🎲拼了×2）':''}`;
        if(e.task){ e.task.progress+=1; r.note+=`；邊做邊摸 任務 +1（${e.task.progress}/${e.task.need}）`; }
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
    if(e.anxiety>=room.config.anxietyOut){ const rr=results.find(x=>x.name===e.name); if(rr)rr.eliminated=true;
      e.alive=false; e.isGhost=true; if(e.isSupervisor){e.isSupervisor=false; if(room.supervisorId===e.id)room.supervisorId=null;}
      chron(room,{type:'eliminated',name:e.name});
      log(room,`💀【${e.name}】心悸爆表（${e.anxiety}）出局！`); }
  }

  // 主管任期 / 升職冷卻 / 罩學弟冷卻 遞減
  if(sup&&sup.isSupervisor){ sup.supTermLeft--; if(sup.supTermLeft<=0){ sup.isSupervisor=false; room.supervisorId=null; log(room,`【${sup.name}】主管任期結束，回歸員工`); } }
  if(room.promoteCooldown>0) room.promoteCooldown--;
  for(const e of emps) if(e.helpCooldown>0) e.helpCooldown--;
  for(const p of room.players.values()) if(p.isGhost&&p.ghostCooldown>0) p.ghostCooldown--;

  // 老闆連查限制
  const ns={}; for(const z of Object.keys(ZONES)) ns[z]=bossZones.includes(z)?((room.zoneStreak[z]||0)+1):0; room.zoneStreak=ns;

  room.lastReveal={ round:room.round, bossZones:bossZones.map(z=>ZONES[z].name), bossZoneKeys:bossZones,
    supZone: supZone?ZONES[supZone].name:null, supZoneKey:supZone||null, ghostNotes, results,
    rate: room.tasksIssued>0?Math.round(room.tasksDone/room.tasksIssued*100):0 };
  log(room, `第 ${room.round} 回合：老闆查 ${bossZones.map(z=>ZONES[z].name).join('、')||'（無）'}${supZone?`｜主管協查 ${ZONES[supZone].name}`:''}。完成率 ${room.lastReveal.rate}%。`);
  room.phase='reveal';
  checkWin(room);
  if(room.phase==='reveal'){ // 未結束才排自動進下一回合
    room.revealSkipAt = Date.now() + REVEAL_MIN_SKIP*1000;
    startTimer(room, REVEAL_SEC, ()=>{ if(room.phase==='reveal'){ advanceRound(room); broadcast(room); } });
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

// 終局故事：把大事記編成一段童話小說（storybook epilogue）
function buildStory(room, side, reason, winnerEmpId){
  const c=room.chronicle||[];
  const b=bossOf(room), bn=b?b.name:'老闆';
  const emps=[...room.players.values()].filter(p=>p.role==='emp');
  const P=[];
  P.push(`在一間被施了魔法的老辦公室裡，${bn} 又戴上了那枚小皇冠，握緊金色放大鏡踏進走廊。今天要對付的員工是：${emps.map(p=>p.name).join('、')}。上班鐘敲響，一場貓抓老鼠的一天開始了。`);
  const fc=c.find(e=>e.type==='catch');
  if(fc) P.push(`第 ${fc.round} 回合，放大鏡的光停在${fc.zone}——${fc.name} 被逮個正著，慘叫聲穿透了三面隔板。`);
  const hd=c.find(e=>e.type==='held');
  if(hd) P.push(`最驚險的一幕在第 ${hd.round} 回合：老闆的目光掃過${hd.zone}，${hd.name} 縮在角落屏住呼吸，臉憋得比薪水條還綠——竟然硬是躲了過去。`);
  const sh=c.find(e=>e.type==='shield');
  if(sh) P.push({
    excused:`${sh.name} 被抓包的瞬間掏出「${sh.detail||'萬用藉口'}」，滑得比下班打卡還快。`,
    warned:`天花板上飄來一通幽靈密電，${sh.name} 在放大鏡到位前一秒溜回了座位。`,
    guarded:`千鈞一髮之際，老鳥張開翅膀把 ${sh.name} 護在身後，深藏功與名。`,
    blocked:`免死金牌在關鍵時刻閃閃發光，${sh.name} 拍拍灰塵若無其事地走回座位。`,
  }[sh.kind]||'');
  const bw=c.find(e=>e.type==='bigwin');
  if(bw) P.push(`而 ${bw.name} 在${bw.zone}${bw.risky?'賭上性命':''}爽賺了 ${bw.gain}💰，嘴角的笑意藏都藏不住。`);
  const ot=c.find(e=>e.type==='ot');
  if(ot) P.push(`${bn} 甩出了加班令。${ot.name} 含淚加班到燈火通明，領了加班費，也熬出了黑眼圈。`);
  const pm=c.find(e=>e.type==='promote');
  if(pm) P.push(`第 ${pm.round} 回合，${pm.name} 被升為代理主管——同事們的眼神，從羨慕慢慢變成了警戒。`);
  const fr=c.find(e=>e.type==='fire');
  if(fr) P.push(`${fr.name} 收到了資遣信封。抱著紙箱走出大門時，桌上的多肉還沒來得及澆水。`);
  const dead=c.filter(e=>e.type==='eliminated').map(e=>e.name);
  if(dead.length) P.push(`${dead.join('、')} 心悸爆表倒下，化作了辦公室的幽靈——從此在天花板上飄來飄去，伺機替活著的同事通風報信。`);
  if(side==='boss') P.push(`下班鐘響。${bn} 站在辦公室中央高舉業績獎盃：${reason}。員工們癱在文件堆裡，連嘆氣的力氣都沒有了。`);
  else { const k=room.players.get(winnerEmpId);
    P.push(`下班鐘響。${k?k.name:'某人'} 戴著歪歪的紙皇冠站上文件山頂，高舉金色咖啡杯——${reason}！${bn} 癱坐在角落，放大鏡滾落在地。`); }
  P.push('明天太陽照常升起，影印機照常卡紙。是牛馬，還是摸魚王？——明天上班，再見分曉。');
  return P.filter(Boolean).slice(0,9);
}

function endGame(room, side, reason, winnerEmpId){
  clearTimer(room); room.phase='ended'; touch(room);
  const th=room.config.anxietyOut;
  const emps=[...room.players.values()].filter(p=>p.role==='emp');
  const ranking=emps.map(p=>{
    const comp=Math.max(0, p.points + p.slackCount*2 + (p.alive?5:0) - p.anxiety);
    let title;
    if(!p.alive) title=((p.otCount||0)>=2)?'過勞牛馬 🐂💦':'壯烈畢業 💀';
    else if((p.otCount||0)>=2) title='加班狂牛馬 🐂';
    else if(p.slackCount===0) title='全勤牛馬 🐂';
    else if(p.anxiety>=th-2) title='驚弓之鳥 😰';
    else if(p.seniority==='senior') title='老油條 🦉';
    else title='摸魚同好 😎';
    const grade=comp>=20?'S':comp>=14?'A':comp>=8?'B':'C';
    return { name:p.name, seniority:p.seniority, slackCount:p.slackCount, points:p.points, alive:p.alive, anxiety:p.anxiety, comp, title, grade, isKing:p.id===winnerEmpId };
  }).sort((a,b)=>(b.isKing?1:0)-(a.isKing?1:0)||b.comp-a.comp);
  const outCount=emps.filter(p=>!p.alive).length;
  const rate=room.tasksIssued>0?Math.round(room.tasksDone/room.tasksIssued*100):0;
  const bp=bossOf(room);
  const bossGrade=(side==='boss')?((rate>=80||outCount===emps.length)?'S':'A'):(rate>=50?'B':'C');
  room.winner={ side, reason, winnerEmpId, ranking, rate, tasksDone:room.tasksDone, tasksIssued:room.tasksIssued,
    story: buildStory(room, side, reason, winnerEmpId),
    boss:{ name:bp?bp.name:'老闆', outCount, total:emps.length, rate, grade:bossGrade } };
  log(room, `🏁 結束：${side==='boss'?'老闆獲勝':'員工陣營獲勝'} — ${reason}`);
}

function advanceRound(room){ room.round++; enterAdmin(room); }

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
  // 道具：心悸快爆先喝提神；衝高爽區帶雞精；偶爾搞卡紙
  let cardIdx=null;
  const idxOf=t=>e.hand.findIndex(c=>c.type===t);
  if(hot&&idxOf('energy')>=0) cardIdx=idxOf('energy');
  else if(choice.action==='slack'&&ZONES[choice.zone].slack>=3&&idxOf('boost')>=0&&Math.random()<0.6) cardIdx=idxOf('boost');
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
  return { ...choice, helpTarget, cardIdx, risky, hold };
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
        room.bossFires--; chron(room,{type:'fire',name:f.name}); log(room,`🔨 老闆資遣了【${f.name}】！（剩 ${room.bossFires} 次）`); }
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
    botAdmin(room); checkWin(room);
    if(room.phase!=='admin'){ broadcast(room); return; }
    // 有真人員工 → 留一段補給採購窗口（倒數顯示），沒有就直接開工
    const humanEmp=[...room.players.values()].some(p=>!p.isBot&&p.role==='emp'&&p.alive&&p.connected);
    if(humanEmp){ startTimer(room, SHOP_SEC, ()=>{ if(room.phase==='admin'){ enterChoose(room); broadcast(room); } }); }
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
  const done=aliveEmps(room).every(e=>room.choices.emp[e.id]!=null)&&room.choices.boss!=null;
  if(done) resolveRound(room);
}

// ---------- Socket ----------
io.on('connection', (socket)=>{
  socket.data.roomCode=null;

  socket.on('createRoom', ({name, roomName, password}, cb)=>{
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
  socket.on('createSolo', ({name,threshold,players,seniority}, cb)=>{
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

  socket.on('joinRoom', ({code,name,password}, cb)=>{
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
  socket.on('rejoin', ({code,playerId}, cb)=>{
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

  socket.on('listRooms', (cb)=>{ cb&&cb({ok:true, rooms:lobbySnapshot(), count:rooms.size, max:MAX_ROOMS}); });

  socket.on('spectateRoom', ({code,password}, cb)=>{
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
  socket.on('specLeave', ()=>{ const room=rooms.get(socket.data.specCode); if(room&&room.spectators) room.spectators.delete(socket.id); socket.data.specCode=null; });

  // 房主變更/解除房間密碼（已在房內者不受影響；舊邀請連結的 key 會失效）
  socket.on('setPassword', ({password}, cb)=>{
    const room=rooms.get(socket.data.roomCode); if(!room) return cb&&cb({error:'你不在任何房間'});
    if(socket.data.playerId!==room.hostId) return cb&&cb({error:'只有房主能改密碼'});
    password=(password||'').toString().trim();
    if(password&&!/^\d{4}$/.test(password)) return cb&&cb({error:'密碼須為 4 位數字'});
    room.password=password||null; touch(room);
    log(room, password?'🔑 房主更新了房間密碼':'🔓 房主解除了房間密碼');
    cb&&cb({ok:true}); broadcast(room);
  });

  // 房主主動關閉房間，釋出名額
  socket.on('closeRoom', (cb)=>{
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
  socket.on('makeQR', ({text}, cb)=>{
    if(typeof text!=='string'||text.length>300||!/^https?:\/\//.test(text)) return cb&&cb({error:'無效的連結'});
    QRCode.toDataURL(text, {width:300, margin:1}, (e,dataUrl)=>{
      cb&&cb(e?{error:'QR Code 產生失敗'}:{ok:true, dataUrl});
    });
  });

  socket.on('startGame', (opts, cb)=>{
    const room=rooms.get(socket.data.roomCode); if(!room) return;
    if(socket.data.playerId!==room.hostId) return cb&&cb({error:'只有房主能開始'});
    touch(room);
    const res=startGame(room,opts||{}); if(res.error) return cb&&cb(res);
    cb&&cb({ok:true}); broadcast(room);
  });

  socket.on('assignTask', ({targetId}, cb)=>{
    const room=rooms.get(socket.data.roomCode); if(!room||room.phase!=='admin') return;
    const b=bossOf(room); if(!b||socket.data.playerId!==b.id) return cb&&cb({error:'只有老闆能派任務'});
    const t=room.players.get(targetId);
    if(!t||t.role!=='emp'||!t.alive||t.task||t.isSupervisor) return cb&&cb({error:'該員工不可指派'});
    if(room.taskDeck.length===0) return cb&&cb({error:'任務卡用完了'});
    const name=room.taskDeck.shift();
    t.task={name,need:TASK_NEED,deadlineLeft:TASK_DEADLINE,progress:0,state:'active'}; room.tasksIssued++;
    log(room,`📋 老闆派給【${t.name}】：${name}`); cb&&cb({ok:true}); broadcast(room);
  });

  socket.on('promote', ({targetId}, cb)=>{
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

  socket.on('fire', ({targetId}, cb)=>{
    const room=rooms.get(socket.data.roomCode); if(!room||room.phase!=='admin') return;
    const b=bossOf(room); if(!b||socket.data.playerId!==b.id) return cb&&cb({error:'只有老闆能資遣'});
    if(room.bossFires<=0) return cb&&cb({error:'資遣次數用完了'});
    const t=room.players.get(targetId);
    if(!t||t.role!=='emp'||!t.alive||!t.canBeFired) return cb&&cb({error:'此人不可資遣（需有逾期紀錄）'});
    if(t.seniority==='senior'&&t.immunity>0){ t.immunity--; t.canBeFired=false; room.bossFires--; log(room,`🛡️【${t.name}】用免死金牌擋下資遣！`); return cb&&cb({ok:true, blocked:true}), broadcast(room); }
    t.alive=false; t.isGhost=true; if(t.isSupervisor){t.isSupervisor=false; if(room.supervisorId===t.id)room.supervisorId=null;}
    room.bossFires--; chron(room,{type:'fire',name:t.name}); log(room,`🔨 老闆資遣了【${t.name}】！（剩 ${room.bossFires} 次）`);
    cb&&cb({ok:true}); broadcast(room);
    checkWin(room); broadcast(room);
  });

  // ---- 點數經濟：補給市場（admin 階段限定；員工用💰、老闆用部門經費買加班令）----
  socket.on('buyCard', ({idx}, cb)=>{
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
  socket.on('breathe', (cb)=>{
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
  socket.on('refuseOvertime', (cb)=>{
    const room=rooms.get(socket.data.roomCode); if(!room||(room.phase!=='admin'&&room.phase!=='choosing')) return cb&&cb({error:'現在不能請假'});
    const me=room.players.get(socket.data.playerId); if(!me||me.role!=='emp'||!me.alive) return cb&&cb({error:'不可用'});
    if(me._otRound!==room.round) return cb&&cb({error:'你沒有被要求加班'});
    if(me.points<OT_REFUSE_COST) return cb&&cb({error:`💰不夠（要 ${OT_REFUSE_COST}）——只能乖乖加班了`});
    me.points-=OT_REFUSE_COST; me._otRound=0;
    log(room,`🏃【${me.name}】燒了 ${OT_REFUSE_COST}💰 請假開溜，拒絕加班！`);
    cb&&cb({ok:true}); broadcast(room);
  });

  // 加班令：老闆行政階段打出手上的加班令
  socket.on('orderOvertime', ({targetId}, cb)=>{
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

  socket.on('beginRound', (cb)=>{
    const room=rooms.get(socket.data.roomCode); if(!room||room.phase!=='admin') return;
    const b=bossOf(room); if(!b||socket.data.playerId!==b.id) return cb&&cb({error:'只有老闆能開始本回合'});
    enterChoose(room); broadcast(room);
  });

  socket.on('submitChoice', (payload, cb)=>{
    const room=rooms.get(socket.data.roomCode); if(!room||room.phase!=='choosing') return;
    const me=room.players.get(socket.data.playerId); if(!me) return;
    if(!me.alive){
      // 幽靈行動（不擋結算節奏；沒出就跳過）
      if(!me.isGhost) return;
      const ga=payload&&payload.ghostAction;
      if(!ga||!GHOST_ACTIONS[ga.type]) return cb&&cb({error:'無效的幽靈行動'});
      if(me.ghostCooldown>0) return cb&&cb({error:`幽靈行動冷卻中（還 ${me.ghostCooldown} 回）`});
      if(room.choices.ghost[me.id]) return cb&&cb({error:'本回合已作祟過了'});
      if(ga.type==='warn'){
        const t=room.players.get(ga.targetId);
        if(!t||t.role!=='emp'||!t.alive) return cb&&cb({error:'報信對象無效'});
      }
      room.choices.ghost[me.id]={type:ga.type, targetId:ga.targetId||null};
      cb&&cb({ok:true}); broadcast(room); return;
    }
    if(me.role==='boss'){
      const picks=(payload.zones||[]).filter(z=>ZONES[z]&&z!=='office');
      if(picks.length!==room.config.bossInspect) return cb&&cb({error:`請選 ${room.config.bossInspect} 個要查的地方`});
      for(const z of picks) if((room.zoneStreak[z]||0)>=2) return cb&&cb({error:`「${ZONES[z].name}」已連查兩回合`});
      // 緊盯（觀察 30/60%）：限巡查區之一、經費夠才收
      let focus=null; const bf=payload.focus;
      if(bf&&bf.zone&&picks.includes(bf.zone)&&FOCUS_COST[bf.pct]){
        if((me.budget||0)<FOCUS_COST[bf.pct]) return cb&&cb({error:`部門經費不足，盯不動（要 ${FOCUS_COST[bf.pct]}）`});
        focus={zone:bf.zone,pct:bf.pct};
      }
      room.choices.boss={zones:picks,focus};
    } else if(me.isSupervisor){
      const zone=payload.inspectZone; if(zone&&(!ZONES[zone]||zone==='office')) return cb&&cb({error:'協查地點無效'});
      room.choices.emp[me.id]={action:'supervise', zone: zone||null};
    } else {
      const action=payload.action; const helpTarget=payload.helpTarget||null;
      const risky=!!payload.risky;
      let cardIdx=null;
      if(payload.cardIdx!=null){
        const c=me.hand[payload.cardIdx];
        if(!c) return cb&&cb({error:'沒有這張手牌'});
        if(CARD_DEFS[c.type].kind!=='item') return cb&&cb({error:'藉口卡不用出，被抓時會自動使用'});
        cardIdx=payload.cardIdx;
      }
      if(action==='work'||action==='idle') room.choices.emp[me.id]={action,zone:'office',helpTarget,cardIdx};
      else if(action==='slack'){ const zone=payload.zone;
        if(me._otRound===room.round) return cb&&cb({error:`🕘 你被要求加班，本回合不能摸魚！（可付 ${OT_REFUSE_COST}💰 請假開溜）`});
        if(!ZONES[zone]||zone==='office') return cb&&cb({error:'請選一個摸魚區'});
        if(me.lastZone===zone) return cb&&cb({error:`上回合已在「${ZONES[zone].name}」，換地方`});
        // 賭命衝刺限 gain≥2 的區（老鳥在低分區拼了=純懲罰，直接擋）
        if(risky){ const g=ZONES[zone].slack+(me.seniority==='senior'?-1:1); if(g<2) return cb&&cb({error:'這區報酬太低，不值得拼命（🎲限💰+2以上的區）'}); }
        // 憋氣：菜鳥限定
        let hold=0;
        if(payload.hold){ if(me.seniority!=='junior') return cb&&cb({error:'🫁 憋氣是菜鳥的求生術（老鳥有免死金牌）'});
          hold=(payload.hold===60)?60:30; }
        room.choices.emp[me.id]={action:'slack',zone,helpTarget,cardIdx,risky,hold};
      } else return cb&&cb({error:'無效動作'});
    }
    cb&&cb({ok:true});
    tryResolve(room);
    broadcast(room);
  });

  socket.on('nextRound', ()=>{ const room=rooms.get(socket.data.roomCode); if(!room||socket.data.playerId!==room.hostId||room.phase!=='reveal') return;
    if(room.revealSkipAt && Date.now()<room.revealSkipAt) return; // 前 5 秒不能跳
    advanceRound(room); broadcast(room); });

  socket.on('restart', ()=>{
    const room=rooms.get(socket.data.roomCode); if(!room||socket.data.playerId!==room.hostId) return;
    clearTimer(room); touch(room);
    for(const [id,p] of room.players) if(!p.connected) room.players.delete(id); // 再玩一局時剔除離線者
    room.phase='lobby'; room.round=0; room.winner=null; room.choices={emp:{},boss:null,ghost:{}};
    room.tasksIssued=0; room.tasksDone=0; room.supervisorId=null; room.promoteCooldown=0; room.bossFires=BOSS_FIRES;
    for(const p of room.players.values()){ p.role=null;p.seniority=null;p.alive=true;p.isGhost=false;p.slackCount=0;p.points=0;p.anxiety=0;p.lastZone=null;p.task=null;p.immunity=0;p.isSupervisor=false;p.supTermLeft=0;p.helpCooldown=0;p.canBeFired=false;p.hand=[];p.ghostCooldown=0; }
    log(room,'房主重開一局。'); broadcast(room);
  });

  // ---- 語音（WebRTC 信令；實際音訊走 P2P） ----
  socket.on('voice-join', ()=>{
    const room=rooms.get(socket.data.roomCode); if(!room) return;
    const me=room.players.get(socket.data.playerId); if(!me) return; me.voiceOn=true;
    // 語音信令走 socket.id 路由（io.to 需要 socket room），與遊戲身分 playerId 分離
    const peers=[...room.players.values()].filter(p=>p.voiceOn&&p.connected&&p.socket&&p.socket.id!==socket.id).map(p=>({id:p.socket.id,name:p.name}));
    socket.emit('voice-peers', peers);                              // 我方主動 offer 這些既有語音者
    socket.to(room.code).emit('voice-joined', {id:socket.id, name:me.name});
  });
  socket.on('voice-leave', ()=>{ const room=rooms.get(socket.data.roomCode); if(!room) return; const me=room.players.get(socket.data.playerId); if(me) me.voiceOn=false; socket.to(room.code).emit('voice-left',{id:socket.id}); });
  socket.on('voice-signal', ({to,data})=>{ io.to(to).emit('voice-signal',{from:socket.id, data}); });

  socket.on('disconnect', ()=>{
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
