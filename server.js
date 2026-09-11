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
const ZONES = {
  office: { name: '辦公室', slack: 0, anxiety: 0, safe: true },
  tea:    { name: '茶水間', slack: 2, anxiety: 1 },
  copy:   { name: '影印間', slack: 2, anxiety: 1 },
  toilet: { name: '廁所',   slack: 3, anxiety: 2 },
  roof:   { name: '頂樓',   slack: 3, anxiety: 2 },
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
  excuse: { icon:'🗣️', kind:'passive', desc:'被抓時自動使用：這次不算、不加心悸' },
  energy: { icon:'🧃', kind:'item', name:'提神飲料', desc:'出牌：本回合結算心悸 −2' },
  jam:    { icon:'🖨️', kind:'item', name:'影印機卡紙', desc:'出牌：老闆本回合隨機少巡一區' },
  boost:  { icon:'💪', kind:'item', name:'雞精加持', desc:'出牌：本回合摸魚成功分數 +2' },
};
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
  routine: { name:'輪班表老闆', hint:'照固定路線輪流巡（茶水→影印→廁所→頂樓），被連查兩回的地方會跳過' },
  hunter:  { name:'記仇老闆',   hint:'特別愛查「上回合有人摸魚得逞」的地方' },
  lazy:    { name:'佛系老闆',   hint:'懶得走遠，大多只巡茶水間和影印間，偶爾才殺上頂樓' },
  chaos:   { name:'陰晴不定老闆', hint:'完全沒有規律，全憑當天心情亂巡' },
};
const BOT_EMP_ROSTER = [ ['greedy','🤖薪水小偷'], ['steady','🤖乖乖牌'], ['swing','🤖薛丁鵝'] ];
const BOT_BOSS_NAME = '🤖鵝霸老闆';

const rooms = new Map();

// ---------- 工具 ----------
function code4(){ const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; for(let i=0;i<4;i++)s+=c[Math.floor(Math.random()*c.length)]; return s; }
function newRoomCode(){ let c; do{c=code4();}while(rooms.has(c)); return c; }
function shuffle(a){ const b=[...a]; for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];} return b; }
function log(room,msg){ room.log.push(msg); if(room.log.length>60)room.log.shift(); }
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
    p.hand=[]; p.ghostCooldown=0;
  }
  room.cardDeck=shuffle(buildCardDeck());
  for(let i=0;i<START_HAND;i++) for(const p of room.players.values()) if(p.role==='emp') drawCard(room,p);
  const n=ids.length;
  room.config.rounds=opts.rounds||(n<=3?6:8);
  room.config.bossInspect=(n<=3)?2:1;
  room.config.anxietyOut=(n>=6)?5:ANXIETY_OUT_DEFAULT;
  room.config.completeThreshold={low:0.6,mid:0.7,high:0.8}[opts.threshold]||0.7;
  room.taskDeck=shuffle(TASKS); room.tasksIssued=0; room.tasksDone=0;
  room.round=1; room.zoneStreak={}; room.winner=null; room.log=[];
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
      safeCount++; r.zoneName='認真工作'; r.working=true; pending[e.id]-=1; e.points=Math.max(0,e.points-1);
      if(e.task){ e.task.progress+=2; r.note=`認真工作：任務 +2（${e.task.progress}/${e.task.need}）、心悸 −1、分數 −1`; } else r.note='認真工作：心悸 −1、分數 −1';
      e.lastZone='office';
    } else if(ch.action==='idle'||ch.zone==='office'){
      safeCount++; r.zoneName='辦公室'; pending[e.id]-=1; r.note='回辦公室休息（安全、不算摸魚、心悸 −1）'; e.lastZone='office';
    } else {
      const zone=ch.zone, z=ZONES[zone]; r.zoneName=z.name; r.zone=zone;
      let caught=inspected.has(zone);
      if(!caught && e.seniority==='junior'){ for(const adj of (ADJ[zone]||[])) if(inspected.has(adj)){caught=true;break;} }
      if(caught){
        const exIdx=e.hand.findIndex(c=>c.type==='excuse');
        if(exIdx>=0){ const c=e.hand.splice(exIdx,1)[0]; r.caught='excused'; r.note=`被抓，但掏出藉口「${c.name}」滑走了！`; }
        else if(warnedSet.has(e.id)){ r.caught='warned'; r.note='被抓前收到幽靈報信，及時溜回座位！'; }
        else if(guarded.has(e.id)){ r.caught='guarded'; r.note='被抓，但老鳥罩學弟擋下了！'; }
        else if(e.seniority==='senior'&&e.immunity>0){ e.immunity--; r.caught='blocked'; r.note='被抓，但免死金牌擋下！'; }
        else { const anx=(e.seniority==='junior')?3:2; pending[e.id]+=anx; r.caught=true; r.anx=anx; r.note=`被逮到！這次不算，心悸 +${anx}`;
          // 主管檢舉獎金：若在主管協查區被抓
          if(supZone&&zone===supZone&&sup){ sup.points+=2; r.byBoss=false; log(room,`🕵️ 主管【${sup.name}】協查抓到【${e.name}】(+2 分)`); }
        }
      } else {
        let gain=z.slack+(e.seniority==='senior'?-1:1); if(gain<0)gain=0;
        if(boostSet.has(e.id)) gain+=2;
        e.slackCount++; e.points+=gain; pending[e.id]+=z.anxiety; r.gain=gain;
        r.note=`摸魚成功！次數 +1（分 +${gain}，心悸 +${z.anxiety}）`;
        if(e.task){ e.task.progress+=1; r.note+=`；邊做邊摸 任務 +1（${e.task.progress}/${e.task.need}）`; }
      }
      e.lastZone=zone;
    }
    results.push(r);
  }

  // 任務完成 / 逾期（兩段式）
  for(const e of emps){
    if(!e.task) continue; const t=e.task;
    if(t.progress>=t.need){ room.tasksDone++; e.points+=1;
      const c=drawCard(room,e);
      log(room,`✅【${e.name}】完成「${t.name}」(+1 分${c?'、抽 1 張卡':''})`); e.task=null; }
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
    const rank=[...alive].sort((a,b)=>b.slackCount-a.slackCount||a.anxiety-b.anxiety);
    endGame(room,'emp',`摸魚王是【${rank[0].name}】（摸魚 ${rank[0].slackCount} 次）`, rank[0].id);
  }
}

function endGame(room, side, reason, winnerEmpId){
  clearTimer(room); room.phase='ended'; touch(room);
  const th=room.config.anxietyOut;
  const emps=[...room.players.values()].filter(p=>p.role==='emp');
  const ranking=emps.map(p=>{
    const comp=Math.max(0, p.points + p.slackCount*2 + (p.alive?5:0) - p.anxiety);
    let title;
    if(!p.alive) title='壯烈畢業 💀';
    else if(p.slackCount===0) title='勞模 😇';
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
  return { ...choice, helpTarget, cardIdx };
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
      log(room,`🧑‍💼 老闆升【${lead.name}】為代理主管（任期 ${SUPERVISOR_TERM} 回，不能摸魚、可協查抓人）`);
    }
  }
  if(room.bossFires>0){
    const f=aliveEmps(room).find(p=>p.canBeFired);
    if(f&&Math.random()<0.8){
      if(f.seniority==='senior'&&f.immunity>0){ f.immunity--; f.canBeFired=false; room.bossFires--; log(room,`🛡️【${f.name}】用免死金牌擋下資遣！`); }
      else { f.alive=false; f.isGhost=true; if(f.isSupervisor){f.isSupervisor=false; if(room.supervisorId===f.id)room.supervisorId=null;}
        room.bossFires--; log(room,`🔨 老闆資遣了【${f.name}】！（剩 ${room.bossFires} 次）`); }
    }
  }
}

function scheduleBotAdmin(room){
  const round=room.round;
  setTimeout(()=>{
    if(!rooms.has(room.code)||room.phase!=='admin'||room.round!==round) return;
    botAdmin(room); checkWin(room);
    if(room.phase==='admin') enterChoose(room);
    broadcast(room);
  }, rand(1500,3000));
}

// choosing 進場時為每個 bot 排「思考延遲」後代打；寫入與真人共用 room.choices，湊齊同樣走 tryResolve
function scheduleBots(room){
  const round=room.round;
  const guard=()=>rooms.has(room.code)&&room.phase==='choosing'&&room.round===round;
  for(const p of room.players.values()){
    if(!p.isBot) continue;
    if(p.role==='boss'){
      setTimeout(()=>{ if(!guard()||room.choices.boss!=null) return;
        room.choices.boss={zones:botBossZones(room)}; tryResolve(room); broadcast(room); }, rand(2000,4500));
    } else if(p.alive){
      setTimeout(()=>{ if(!guard()||room.choices.emp[p.id]!=null) return;
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

  // c-lite 單人練習：真人當員工 ＋ 2 個 AI 同事 ＋ 腳本老闆（開房即開局）
  socket.on('createSolo', ({name,threshold}, cb)=>{
    if(rooms.size>=MAX_ROOMS) return cb&&cb({error:`房間已滿（${MAX_ROOMS}/${MAX_ROOMS}），請稍後再試`});
    name=(name||'玩家').toString().slice(0,12);
    const code=newRoomCode();
    const pid=newPid();
    const room={ code, name:'單人練習', password:null, solo:true, createdAt:Date.now(), lastActivity:Date.now(),
      spectators:new Map(), hostId:pid, players:new Map(), phase:'lobby', round:0,
      config:{rounds:8,bossInspect:1,anxietyOut:ANXIETY_OUT_DEFAULT,completeThreshold:0.7},
      choices:{emp:{},boss:null,ghost:{}}, taskDeck:[], cardDeck:[], tasksIssued:0, tasksDone:0, zoneStreak:{}, log:[], winner:null,
      supervisorId:null, promoteCooldown:0, bossFires:BOSS_FIRES, _timer:null, timerEndsAt:null };
    room.players.set(pid, mkPlayer(pid,socket,name));            // 真人先加＝分職級時穩拿老鳥（有免死金牌，對新手友善）
    const roster=shuffle(BOT_EMP_ROSTER).slice(0,2);
    for(const [style,bn] of roster){ const b=mkBot(bn,style); room.players.set(b.id,b); }
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
    room.bossFires--; log(room,`🔨 老闆資遣了【${t.name}】！（剩 ${room.bossFires} 次）`);
    cb&&cb({ok:true}); broadcast(room);
    checkWin(room); broadcast(room);
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
      room.choices.boss={zones:picks};
    } else if(me.isSupervisor){
      const zone=payload.inspectZone; if(zone&&(!ZONES[zone]||zone==='office')) return cb&&cb({error:'協查地點無效'});
      room.choices.emp[me.id]={action:'supervise', zone: zone||null};
    } else {
      const action=payload.action; const helpTarget=payload.helpTarget||null;
      let cardIdx=null;
      if(payload.cardIdx!=null){
        const c=me.hand[payload.cardIdx];
        if(!c) return cb&&cb({error:'沒有這張手牌'});
        if(CARD_DEFS[c.type].kind!=='item') return cb&&cb({error:'藉口卡不用出，被抓時會自動使用'});
        cardIdx=payload.cardIdx;
      }
      if(action==='work'||action==='idle') room.choices.emp[me.id]={action,zone:'office',helpTarget,cardIdx};
      else if(action==='slack'){ const zone=payload.zone;
        if(!ZONES[zone]||zone==='office') return cb&&cb({error:'請選一個摸魚區'});
        if(me.lastZone===zone) return cb&&cb({error:`上回合已在「${ZONES[zone].name}」，換地方`});
        room.choices.emp[me.id]={action:'slack',zone,helpTarget,cardIdx};
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
