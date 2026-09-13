const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
// Run the real rules without opening a port or waiting on real clocks.
const source=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8').split('const PORT=process.env.PORT||3000;')[0];
function engine(o={}){
  const scheduled=[];
  const context=vm.createContext({require,console,__dirname:path.join(__dirname,'..'),setTimeout:(fn,ms)=>{scheduled.push({fn,ms});return scheduled.length;},clearTimeout:()=>{},setInterval:()=>0});
  vm.runInContext(source,context);
  const api=vm.runInContext('({mkPlayer,startGame,enterChoose,resolveRound,tryResolve,advanceRound,drawRoundHand,viewFor,checkWin,endGame,buildStory,pickKings,revealAnimMs,guardHandlers,REVEAL_SEC,REVEAL_MIN_SKIP,REVEAL_ANIM_MAX_MS,rooms,io})',context);
  const room={code:'TEST',hostId:'boss',players:new Map(),config:{},log:[],choices:{emp:{},boss:null,ghost:{}},spectators:new Map(),createdAt:Date.now(),solo:o.solo!==false};
  for(const id of (o.ids||['boss','employee','colleague']))room.players.set(id,api.mkPlayer(id,null,id));
  api.rooms.set(room.code,room);api.startGame(room,o.start||{rounds:8});
  return {api,room,p:room.players.get('employee'),scheduled};
}
function round(e,action){
  e.api.enterChoose(e.room);
  e.room.choices={boss:{zones:[]},emp:{employee:{action,zone:action==='slack'?'tea':'office'},colleague:{action:'idle',zone:'office'}},ghost:{}};
  e.api.resolveRound(e.room);
}
// 通用回合：未指定的存活員工一律休息；老闆不巡查（讓結果不吃隨機）
function playRound(e,actions={}){
  e.api.enterChoose(e.room);
  const emp={};
  for(const p of e.room.players.values()) if(p.role==='emp'&&p.alive) emp[p.id]=actions[p.id]||{action:'idle',zone:'office'};
  e.room.choices={boss:{zones:[]},emp,ghost:{}};
  e.api.resolveRound(e.room);
}
// 依現行 checkWin 規則（server.js:479-489）獨立算一次預期勝者，用來證明三王沒有動到勝負
function expectedSlackKing(room){
  const alive=[...room.players.values()].filter(p=>p.role==='emp'&&p.alive);
  return [...alive].sort((a,b)=>b.points-a.points||a.anxiety-b.anxiety)[0];
}
// ---------- 跨檔鏡像：把前端的演出函式「真的跑一遍」，用它算出來的時間對 server ----------
// 🔴 兩輪教訓，第二版做法：
//    輪次 1：測試把 server 公式再手抄一次去對 server → 前端改了照樣綠（B4 就是這樣溜過去的）。
//    輪次 2：改成 regex 讀前端數字，Codex 證明還是假綠——① 舊公式留在註解裡 regex 照樣抓得到；
//            ② 把 `return start+KAROSHI_MS` 改成 `-1000`，只讀「常數宣告」的 regex 完全看不到。
//    → 這一版**不再解析數字**：把 `playReveal()`／`playKaroshi()` 的原始碼原封不動抓出來，
//      丟進 vm＋假 DOM＋凍結時鐘**實際執行**，讀它們真的算出來的 `revAnimEndsAt` 與回傳值。
//      註解騙不了它（註解不會被執行）、算式怎麼改都逃不掉（結果會變）、重構成函式也照抓。
//      前端改成我的假 DOM 支撐不住的寫法 → 直接 throw，測試紅（fail loud，不會靜默放過）。
const FRONT_HTML=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
const FRONT_FOCUS=fs.readFileSync(path.join(__dirname,'../public/focus.js'),'utf8');
// 🔴 Codex 輪次 3 B3-D：「不會被執行的字」必須先擦掉再找東西，否則註解裡的舊值會被當成真的。
//    codeOnly() 把註解整段、字串／樣板字面值的內容換成**同樣長度**的空白（引號、反引號、`${}`
//    與其中的程式碼都保留），所以：① 大括號仍然數得平 ② 索引可以原封不動切回原始碼。
//    cutFunction 與 KAROSHI_MS 兩處都走它——只要是「從前端原始碼挖東西」就不准再直接 regex 全文。
//    （已知限制：不理解 regex 字面值；目前被掃的四個函式都沒有 regex 字面值。）
function codeOnly(src){
  const out=src.split('');
  const blank=i=>{ if(i<out.length&&out[i]!=='\n') out[i]=' '; };
  let mode='code', depth=0; const tpl=[];
  for(let i=0;i<src.length;i++){
    const ch=src[i], nx=src[i+1];
    if(mode==='line'){ blank(i); if(ch==='\n')mode='code'; continue; }
    if(mode==='block'){ blank(i); if(ch==='*'&&nx==='/'){ blank(i+1); i++; mode='code'; } continue; }
    if(mode==='sq'||mode==='dq'){
      if(ch==='\\'){ blank(i); blank(i+1); i++; continue; }
      if(ch===(mode==='sq'?"'":'"')){ mode='code'; continue; }   // 引號本身留著
      blank(i); continue;
    }
    if(mode==='tpl'){
      if(ch==='\\'){ blank(i); blank(i+1); i++; continue; }
      if(ch==='`'){ mode='code'; continue; }
      if(ch==='$'&&nx==='{'){ tpl.push(depth); depth++; mode='code'; i++; continue; }  // ${ 保留＝括號成對
      blank(i); continue;
    }
    if(ch==='/'&&nx==='/'){ blank(i); blank(i+1); i++; mode='line'; continue; }
    if(ch==='/'&&nx==='*'){ blank(i); blank(i+1); i++; mode='block'; continue; }
    if(ch==="'"){ mode='sq'; continue; }
    if(ch==='"'){ mode='dq'; continue; }
    if(ch==='`'){ mode='tpl'; continue; }
    if(ch==='{'){ depth++; continue; }
    if(ch==='}'){ depth--; if(tpl.length&&depth===tpl[tpl.length-1]){ tpl.pop(); mode='tpl'; } continue; }
  }
  return out.join('');
}
// 從原始碼切出一整個函式：只在「擦掉註解與字串之後」的程式碼上找 header 與配對大括號，
// 所以註解裡放一份舊版函式也騙不到（切出來的仍是真正會執行的那一份）。
function cutFunction(src,header,where){
  const mask=codeOnly(src);
  const s=mask.indexOf(header);
  assert.ok(s>=0,`${where} 找不到 ${header}（註解裡的不算）`);
  let i=mask.indexOf('{',s+header.length);
  assert.ok(i>=0,`${where} 的 ${header} 後面找不到主體 {`);
  let depth=0;
  for(;i<mask.length;i++){
    if(mask[i]==='{'){ depth++; continue; }
    if(mask[i]==='}'){ depth--; if(depth===0) return src.slice(s,i+1); }
  }
  assert.fail(`${where} 的 ${header} 大括號沒配平，切不出完整函式`);
}
// 假 DOM＋凍結時鐘，把前端演出函式跑起來
const FROZEN_NOW=1700000000000;
let _stage=null;
function frontStage(){
  if(_stage) return _stage;
  const mkEl=()=>({ innerHTML:'', textContent:'', className:'', id:'', style:{},
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},
    appendChild(){}, prepend(){}, setAttribute(){}, querySelector(){return mkEl();}, after(){} });
  const shared=mkEl();
  const zoneKeys=['office','tea','copy','toilet','roof'];
  const sandbox={
    Date:{now:()=>FROZEN_NOW}, Math, JSON, Object, Array, String, Number, Boolean, Set, Map,
    document:{createElement:()=>mkEl()},
    $:()=>shared, esc:s=>String(s),
    rvT:()=>{}, kT:()=>{}, clearKaroshi(){}, streakLimit:()=>3,
    // revealAct 用 setTimeout 決定「演出播完才切個人總結」——把延遲攔下來，那就是前端真正等的時間
    setTimeout:(fn,ms)=>{ sandbox.__captured=ms; return 1; }, clearTimeout(){},
    __captured:null, revealStage:'summary', revealStageTimer:null,
    applyRevealStage(){}, revealSummary(){},
    revTimers:[], revAnimEndsAt:0, karoshiScene:shared,
    ZI:Object.fromEntries(zoneKeys.map(k=>[k,'🏢'])),
    ST:{ code:'TEST', slackZones:zoneKeys.filter(k=>k!=='office'),
         zones:Object.fromEntries(zoneKeys.map(k=>[k,{name:k}])), reveal:null, you:{id:'me'} },
  };
  const ctx=vm.createContext(sandbox);
  const srcs={
    outcomeIcon:cutFunction(FRONT_HTML,'function outcomeIcon(','public/index.html'),
    playReveal :cutFunction(FRONT_HTML,'function playReveal(','public/index.html'),
    playKaroshi:cutFunction(FRONT_FOCUS,'function playKaroshi(','public/focus.js'),
    revealAct  :cutFunction(FRONT_FOCUS,'function revealAct(','public/focus.js'),
  };
  // playKaroshi 用到的 KAROSHI_MS 是 focus.js 的模組級常數：把**宣告整句**原樣執行（不解析數字）
  // 🔴 Codex 輪次 3 B3-D：舊版直接對全文 regex，會抓到**註解裡**的第一個匹配——
  //    實測「註解留 const KAROSHI_MS=3600、真值改成 5000」→ 前後端漂移 1400ms 但 39/39 全綠。
  //    改成在 codeOnly() 擦過的程式碼上找，而且**必須恰好一個**（多一個代表有人留了會誤導的副本）。
  const FOCUS_CODE=codeOnly(FRONT_FOCUS);
  const kms=[...FOCUS_CODE.matchAll(/const\s+KAROSHI_MS\s*=[^;]+;/g)];
  assert.equal(kms.length,1,`public/focus.js 應該恰好有 1 個會執行的 \`const KAROSHI_MS=…;\`，實際 ${kms.length} 個`
    +'——猝死演出長度改寫過？請一併更新 server.js 的 KAROSHI_SCENE_MS');
  vm.runInContext(FRONT_FOCUS.slice(kms[0].index,kms[0].index+kms[0][0].length),ctx);
  for(const [name,code] of Object.entries(srcs)){
    assert.ok(code.length>120,`${name} 切出來只有 ${code.length} 字，太短，切錯了`);
    vm.runInContext(code,ctx);
  }
  _stage={ctx,srcs};
  return _stage;
}
function mkFrontReveal(n,g,danger){
  return { round:1, rate:0, bossZones:danger?['tea']:[], bossZoneKeys:danger?['tea']:[], supZone:null, supZoneKey:null,
    ghostNotes:Array.from({length:g},(_,i)=>({icon:'👻',text:'note'+i})),
    results:Array.from({length:n},(_,i)=>({playerId:'p'+i,name:'p'+i,seniority:'junior',
      zone:(danger&&i===0)?'tea':'office',zoneName:'x',note:'n'})) };
}
// 真的跑一次 playReveal()，回傳它算出來的演出長度（revAnimEndsAt − now）
function frontPlayRevealMs(n,g,danger){
  const {ctx}=frontStage();
  ctx.ST.reveal=mkFrontReveal(n,g,danger);
  vm.runInContext('revAnimEndsAt=0;playReveal(ST.reveal);',ctx);
  const end=vm.runInContext('revAnimEndsAt',ctx);
  assert.ok(Number.isFinite(end)&&end>FROZEN_NOW,`playReveal 沒有算出合理的 revAnimEndsAt（拿到 ${end}）`);
  return end-FROZEN_NOW;
}
// 真的跑一次 playReveal() → revealAct()，攔下 revealAct 排給「切個人總結」的 setTimeout 延遲。
// 那個數字就是玩家實際要等多久才看得到個人總結，也正是 server 的 revealAnimMs 必須對上的東西。
// （連 revealAct 裡的 Math.max(board, playKaroshi()) 都是執行出來的，測試這邊零手抄公式。）
function frontActMs(n,g,danger,karoshi){
  const {ctx}=frontStage();
  const rv=mkFrontReveal(n,g,danger);
  if(karoshi){ rv.results[0].playerId='me'; rv.results[0].suddenDeath=true; }
  ctx.ST.reveal=rv; ctx.ST.you={id:'me'};
  const ms=vm.runInContext('revAnimEndsAt=0;playReveal(ST.reveal);__captured=null;revealAct();__captured',ctx);
  assert.ok(Number.isFinite(ms)&&ms>0,`revealAct 沒有排出合理的延遲（拿到 ${ms}）——前端改用別的方式收尾了？`);
  return ms;
}
function frontKaroshiExtraMs(){ return frontActMs(2,0,false,true)-frontActMs(2,0,false,false); }
// 從原始碼列出「有 payload 位」的事件（on 的最後一個宣告參數是 ack，onNoAck 全部都是 payload）
function paramList(sig){                     // '({a,b}, cb)' 的內文 → ['{a,b}','cb']
  const out=[];let depth=0,cur='';
  for(const ch of sig){
    if('([{'.includes(ch))depth++; else if(')]}'.includes(ch))depth--;
    if(ch===','&&depth===0){out.push(cur.trim());cur='';continue;}
    cur+=ch;
  }
  if(cur.trim())out.push(cur.trim());
  return out;
}
function payloadEventsFromSource(src){
  const out=[];
  for(const m of src.matchAll(/^ {2}(on|onNoAck)\('([\w-]+)',\s*\((.*?)\)=>/gm)){
    const parts=paramList(m[3]);
    const slots=m[1]==='on'?parts.length-1:parts.length;
    if(slots>0) out.push(m[2]);
  }
  return out;
}
// 世界快照：被拒絕的封包不得留下任何痕跡（房間、密碼、選擇、手牌、經費…）
function worldSnapshot(api){
  const out={};
  for(const [code,room] of api.rooms){
    out[code]={
      name:room.name, password:room.password??null, phase:room.phase, round:room.round,
      rounds:room.config&&room.config.rounds, bossFires:room.bossFires, supervisorId:room.supervisorId??null,
      choices:JSON.stringify(room.choices), market:(room.market||[]).map(c=>c.type).join(','),
      logLen:room.log.length, chronLen:(room.chronicle||[]).length, specs:room.spectators?room.spectators.size:0,
      players:[...room.players.values()].map(p=>[p.id,p.role,p.alive,p.isGhost,p.points,p.anxiety,p.isSupervisor,
        p.supTermLeft,p.hand.map(c=>c.type).join('|'),p.task?p.task.progress:'-',p.budget,p._otRound,p.canBeFired].join(':')),
    };
  }
  return JSON.stringify(out);
}
// 假 socket：直接把 io.on('connection') 註冊的真 handler 抓出來打，測 socket 層的行為
function wireSocket(e){
  const h={};
  const sock={id:'sock1',data:{},on:(ev,fn)=>{h[ev]=fn;},emit:()=>{},join:()=>{},leave:()=>{},to:()=>({emit:()=>{}})};
  const conn=e.api.io.listeners('connection');
  assert.equal(typeof conn[0],'function','io.on(connection) 應該有註冊 handler');
  conn[0](sock);
  return {sock,h};
}
test('opening draw gives two real cards; repeat click cannot draw again',()=>{
  const e=engine();assert.equal(e.p.hand.length,0);
  assert.equal(e.api.drawRoundHand(e.room,e.p).length,2);
  e.api.drawRoundHand(e.room,e.p);assert.equal(e.p.hand.length,2);
  e.room.round++;assert.equal(e.api.drawRoundHand(e.room,e.p).length,1);
  e.room.round++;assert.equal(e.api.drawRoundHand(e.room,e.p).length,0);
  assert.equal(e.p.hand.length,3);
});
test('three consecutive work choices cause sudden death even with immunity',()=>{
  const e=engine();round(e,'work');assert.equal(e.p.workStreak,1);assert.equal(e.p.alive,true);
  e.api.advanceRound(e.room);round(e,'work');assert.equal(e.p.workStreak,2);assert.equal(e.p.alive,true);
  e.api.advanceRound(e.room);round(e,'work');assert.equal(e.p.workStreak,3);assert.equal(e.p.alive,false);assert.equal(e.p.isGhost,true);
  const result=e.room.lastReveal.results.find(r=>r.playerId===e.p.id);assert.equal(result.suddenDeath,true);assert.equal(result.eliminated,true);
});
test('rest or slack breaks the consecutive-work streak',()=>{
  for(const action of ['idle','slack']){
    const e=engine();round(e,'work');e.api.advanceRound(e.room);round(e,'work');e.api.advanceRound(e.room);round(e,action);
    assert.equal(e.p.workStreak,0);assert.equal(e.p.alive,true);e.api.advanceRound(e.room);round(e,'work');assert.equal(e.p.workStreak,1);assert.equal(e.p.alive,true);
  }
});
test('solo choosing and reveal do not schedule automatic advancement',()=>{
  const e=engine();e.scheduled.length=0;round(e,'idle');
  assert.equal(e.room.phase,'reveal');assert.equal(e.room.timerEndsAt,null);assert.equal(e.scheduled.length,0);
});
test('last-round result stays visible until player continues',()=>{
  const e=engine();e.room.round=8;round(e,'idle');assert.equal(e.room.phase,'reveal');
  e.api.advanceRound(e.room);assert.equal(e.room.phase,'ended');
});
test('personal result deltas include wage and stress changes and use player IDs',()=>{
  const e=engine();e.p.anxiety=2;round(e,'work');const r=e.room.lastReveal.results.find(r=>r.playerId===e.p.id);
  assert.equal(r.pointsDelta,1);assert.equal(r.anxietyDelta,-1);assert.equal(r.pointsAfter,e.p.points);
});
test('solo ghost waits until the player acts or explicitly passes',()=>{
  const e=engine();e.room.hostId=e.p.id;e.p.alive=false;e.p.isGhost=true;
  e.api.enterChoose(e.room);e.room.choices={boss:{zones:[]},emp:{colleague:{action:'idle',zone:'office'}},ghost:{}};
  e.api.tryResolve(e.room);assert.equal(e.room.phase,'choosing');
  e.room.choices.ghost[e.p.id]={type:'pass'};e.api.tryResolve(e.room);assert.equal(e.room.phase,'reveal');
});

// ---------- 揭曉倒數：等演出跑完才起算（REVEAL_SEC 值不變，只移起點） ----------
test('REVEAL_SEC itself is untouched',()=>{
  const e=engine();
  assert.equal(e.api.REVEAL_SEC,15);        // 老闆明令：秒數不准動
  assert.equal(e.api.REVEAL_MIN_SKIP,5);
});
test('reveal animation length mirrors the front-end playReveal timeline',()=>{
  const e=engine(),f=e.api.revealAnimMs;
  // 期望值 **來自實際執行 public/index.html 的 playReveal()**，不是手抄 server 公式（見檔頭 frontStage）
  const rv=(n,g,opt={})=>({
    results:new Array(n).fill(null).map((_,i)=>({zone:(opt.danger&&i===0)?'tea':'office',supervisor:!!opt.supervisor})),
    ghostNotes:new Array(g).fill({}), bossZoneKeys:opt.danger?['tea']:[], supZoneKey:opt.supZoneKey||null,
  });
  for(const [n,g,danger] of [[0,0,false],[2,0,false],[1,2,false],[1,0,true],[5,6,true],[3,1,true]]){
    assert.equal(f(rv(n,g,{danger})),frontPlayRevealMs(n,g,danger),`n=${n} g=${g} danger=${danger} 與前端 playReveal 不一致`);
  }
  // 主管不算「危險」（他免疫被抓，前端 anyDanger 也把他排除）
  assert.equal(f({results:[{zone:'tea',supervisor:true}],ghostNotes:[],bossZoneKeys:['tea']}),frontPlayRevealMs(1,0,false));
  // 主管協查區也會觸發屏息
  assert.equal(f({results:[{zone:'roof'}],ghostNotes:[],bossZoneKeys:[],supZoneKey:'roof'}),frontPlayRevealMs(1,0,true));
  assert.equal(f(null),0);
  // 上限必須蓋得住 6 人房最壞情況（1 老闆＋5 員工：n=5、g≤6、屏息、猝死），否則正常局會被截頂
  const worst=frontActMs(5,6,true,true);
  assert.ok(e.api.REVEAL_ANIM_MAX_MS>=worst,`REVEAL_ANIM_MAX_MS=${e.api.REVEAL_ANIM_MAX_MS} 蓋不住 6 人房最壞情況 ${worst}ms`);
  // 硬上限仍然有效（餵超出遊戲規模的資料）
  assert.equal(f({results:new Array(40).fill({zone:'roof'}),ghostNotes:new Array(40).fill({}),bossZoneKeys:['roof']}),e.api.REVEAL_ANIM_MAX_MS);
});
// 🔴 B4：猝死回合前端還會多播一幕（public/focus.js playKaroshi），server 公式漏了就會提早 2.9 秒起算倒數
test('reveal animation length also covers the sudden-death act from public/focus.js',()=>{
  const e=engine(),f=e.api.revealAnimMs;
  const extra=frontKaroshiExtraMs();
  assert.ok(extra>0,`實際執行 playKaroshi() 算出的猝死延長是 ${extra}ms，應為正數`);
  const plain={results:[{zone:'office'},{zone:'office'}],ghostNotes:[],bossZoneKeys:[]};
  const karoshi={results:[{zone:'office',suddenDeath:true},{zone:'office'}],ghostNotes:[],bossZoneKeys:[]};
  assert.equal(f(plain),frontActMs(2,0,false,false));
  assert.equal(f(karoshi),frontActMs(2,0,false,true),'猝死回合要把 playKaroshi 那一截算進去');
  // 屏息 + 猝死會同時發生（有人在被巡查區被抓、另一人過勞死）
  const both={results:[{zone:'tea'},{zone:'office',suddenDeath:true}],ghostNotes:[{}],bossZoneKeys:['tea']};
  assert.equal(f(both),frontActMs(2,1,true,true));
});
// 突變測試只能證明「我想到的那個錯」會被抓到。這條改用**掃遍整個可達輸入空間**：
// n（員工數 0~5，6 人房上限）× g（事件 0~8）× 屏息 × 猝死，每一組都拿 server 的公式去對
// 「真的執行前端 playReveal()+revealAct() 算出來的毫秒數」。任何一處算式分歧都會被逮到，
// 不需要我事先猜對是哪個係數被改。
test('server and front-end agree on the act length across the whole reachable input space',()=>{
  const e=engine(),f=e.api.revealAnimMs;
  let checked=0, worst=0;
  for(let n=0;n<=5;n++) for(let g=0;g<=8;g++) for(const danger of [false,true]) for(const karoshi of [false,true]){
    if(n===0&&(danger||karoshi)) continue;          // 沒有員工就不會有人被巡到、也不會有人過勞死
    const rv=mkFrontReveal(n,g,danger);
    if(karoshi) rv.results[0].suddenDeath=true;
    const front=frontActMs(n,g,danger,karoshi);
    worst=Math.max(worst,front);
    assert.equal(f(rv),Math.min(e.api.REVEAL_ANIM_MAX_MS,front),
      `n=${n} g=${g} danger=${danger} karoshi=${karoshi}：server ${f(rv)}ms ≠ 前端 ${front}ms`);
    checked++;
  }
  assert.ok(checked>=180,`只掃了 ${checked} 組，掃得不夠`);   // 6*9*2*2=216，扣掉 n=0 不可能有屏息/猝死的 27 組
  // 掃出來的最大值也不准超過硬上限（超過＝正常局會被截頂，玩家看不完演出就被推走）
  assert.ok(e.api.REVEAL_ANIM_MAX_MS>=worst,`REVEAL_ANIM_MAX_MS=${e.api.REVEAL_ANIM_MAX_MS} 蓋不住掃到的最大值 ${worst}ms`);
});
test('multiplayer reveal timer starts counting only after the animation finishes',()=>{
  const e=engine({solo:false,ids:['boss','e1','e2']});
  e.scheduled.length=0;
  const t0=Date.now();
  playRound(e);                                    // 全員休息、老闆不巡 → n=2, g=0, 無危險
  const animMs=frontActMs(2,0,false,false);        // 期望值＝真的跑一次前端 playReveal() 得到的
  assert.equal(e.room.revealAnimMs,animMs);
  const last=e.scheduled[e.scheduled.length-1];
  // Math.round：startTimer 收的是秒，animMs/1000 再乘回來會有 IEEE754 尾差（19759.999999999996），非邏輯誤差
  assert.equal(Math.round(last.ms),animMs+e.api.REVEAL_SEC*1000,'倒數長度＝演出時長 + REVEAL_SEC');
  // 房主的跳過鎖也要跟著順移（不能在演出還沒播完就把大家推走）
  const skipIn=e.room.revealSkipAt-t0;
  assert.ok(skipIn>=animMs+e.api.REVEAL_MIN_SKIP*1000-50&&skipIn<=animMs+e.api.REVEAL_MIN_SKIP*1000+500,`revealSkipAt 應順移，實際 ${skipIn}ms`);
});
// B4 的實跑版：真的讓人過勞猝死，看多人局倒數有沒有把猝死演出算進去
test('multiplayer reveal timer waits for the sudden-death act too',()=>{
  const e=engine({solo:false,ids:['boss','e1','e2']});
  const dying=e.room.players.get('e1');
  for(let i=0;i<2;i++){ playRound(e,{e1:{action:'work',zone:'office'}}); e.api.advanceRound(e.room); }
  e.scheduled.length=0;
  const t0=Date.now();
  playRound(e,{e1:{action:'work',zone:'office'}});   // 第三次連工 → 過勞猝死
  assert.equal(dying.alive,false);
  assert.equal(e.room.lastReveal.results.find(r=>r.playerId==='e1').suddenDeath,true);
  const animMs=frontActMs(2,0,false,true);         // ＝真的跑 playReveal()+playKaroshi() 得到的
  assert.equal(e.room.revealAnimMs,animMs,'猝死回合的演出時長要含 playKaroshi 那一截');
  const last=e.scheduled[e.scheduled.length-1];
  assert.equal(Math.round(last.ms),animMs+e.api.REVEAL_SEC*1000,'倒數不得在猝死演出播完前就開始數');
  const skipIn=e.room.revealSkipAt-t0;
  assert.ok(skipIn>=animMs+e.api.REVEAL_MIN_SKIP*1000-50,`房主跳過鎖也要順移，實際 ${skipIn}ms`);
});
test('solo reveal still has no timer and no skip lock',()=>{
  const e=engine();
  e.scheduled.length=0;
  const t0=Date.now();
  playRound(e);
  assert.equal(e.room.phase,'reveal');
  assert.equal(e.scheduled.length,0,'solo 不得排任何自動推進');
  assert.equal(e.room.timerEndsAt,null);
  assert.ok(e.room.revealSkipAt<=t0+50,'solo 隨時可以按下一步');
});

// ---------- T6：回合數（solo 4 / 多人 6，opts.rounds 仍可覆寫） ----------
test('round count is four for solo, six for multiplayer, and opts still overrides',()=>{
  assert.equal(engine({start:{}}).room.config.rounds,4);
  assert.equal(engine({solo:false,ids:['boss','e1','e2','e3'],start:{}}).room.config.rounds,6);
  assert.equal(engine({start:{rounds:8}}).room.config.rounds,8);
  assert.equal(engine({solo:false,ids:['boss','e1','e2','e3'],start:{rounds:2}}).room.config.rounds,2);
});
test('checkWin still crowns a slacker king in both a four-round and a six-round game',()=>{
  for(const [label,cfg,slacker] of [['solo-4',{start:{}},'employee'],['multi-6',{solo:false,ids:['boss','e1','e2','e3'],start:{}},'e2']]){
    const e=engine(cfg);const rounds=e.room.config.rounds;
    assert.equal(rounds,label==='solo-4'?4:6);
    for(let i=1;i<=rounds;i++){
      playRound(e,{[slacker]:i%2?{action:'slack',zone:'copy'}:{action:'idle',zone:'office'}});
      e.api.advanceRound(e.room);
    }
    const w=e.room.winner;
    assert.ok(w,`${label}: 應該要在第 ${rounds} 回合結束`);
    assert.equal(e.room.phase,'ended');
    assert.equal(w.side,'emp');                                  // 沒派過任務 → 完成率 0% → 員工陣營勝
    assert.equal(w.winnerEmpId,slacker,`${label}: 摸魚最多的人該當王`);
    assert.equal(w.kings.length,3);
    assert.equal(w.kings[0].holderId,slacker);
  }
});

// ---------- T5：三王 ----------
test('three kings are awarded without touching the win/lose verdict',()=>{
  const e=engine({start:{}});const rounds=e.room.config.rounds;
  for(let i=1;i<=rounds;i++){
    playRound(e,{employee:{action:'slack',zone:'copy'},colleague:{action:'work',zone:'office'}});
    if(i<rounds)e.api.advanceRound(e.room);
  }
  const expected=expectedSlackKing(e.room);           // 先用純 checkWin 規則自己算一次
  const beforeAlive=[...e.room.players.values()].map(p=>`${p.id}:${p.alive}:${p.points}:${p.anxiety}`);
  e.api.advanceRound(e.room);
  const w=e.room.winner;
  assert.equal(w.side,'emp');
  assert.equal(w.winnerEmpId,expected.id);
  assert.match(w.reason,new RegExp(`摸魚王是【${expected.name}】`));
  // 頒獎不得改動任何玩家狀態
  assert.deepEqual([...e.room.players.values()].map(p=>`${p.id}:${p.alive}:${p.points}:${p.anxiety}`),beforeAlive);
  // 三個王：名字、得主、事蹟
  assert.equal(w.kings.length,3);
  assert.equal(w.kings.map(k=>k.key).join(','),'slack,ghost,ox');
  for(const k of w.kings){assert.ok(k.title);assert.ok(k.deed);assert.ok('holder' in k);}
  assert.equal(w.kings[0].kind,'win');                // 只有摸魚王算「贏」
  assert.equal(w.kings[1].kind,'honor');
  assert.equal(w.kings[2].kind,'honor');
  // 榮譽王不得讓別人也變成勝者
  assert.equal(w.ranking.filter(r=>r.isKing).length,1);
  // colleague 連工作三回合過勞猝死 → 同時是唯一的幽靈（搞鬼王）與最會做工的人（牛馬王）
  assert.equal(w.kings[1].holder,'colleague');
  assert.equal(w.kings[2].holder,'colleague');
  assert.match(w.kings[2].deed,/認真工作 3 回合/);
  assert.match(w.kings[2].deed,/過勞猝死/);
  const row=w.ranking.find(r=>r.name==='colleague');
  assert.equal(row.title,'👻 搞鬼王');                  // 稱號位階：搞鬼王 > 牛馬王
  assert.equal(row.kings.join(','),'ghost,ox');
  assert.equal(row.isKing,false);                      // 榮譽頭銜不是勝利
  assert.equal(w.ranking.find(r=>r.name==='employee').title,'🐟 摸魚王');
});
test('ghost king is picked from ghosts, and is vacant when nobody died',()=>{
  const e=engine();
  // 沒有幽靈 → 搞鬼王從缺（而且不會誤抓活人）
  const none=e.api.pickKings(e.room,'emp','employee');
  assert.equal(none[1].key,'ghost');assert.equal(none[1].vacant,true);assert.equal(none[1].holderId,null);
  assert.ok(none[1].deed);
  // 兩隻幽靈：作祟多的贏；aliveEmps 抓不到的人也要選得到
  const g1=e.room.players.get('employee'),g2=e.room.players.get('colleague');
  for(const g of [g1,g2]){g.alive=false;g.isGhost=true;}
  // 大事記欄位比照 server 真的寫出來的形狀（ghost/warn 帶 targetPid、shield 帶 pid）——
  // 由 `chronicle records who warned whom…` 那條測試釘住，避免 fixture 與真實資料脫節
  e.room.chronicle=[
    {round:2,type:'eliminated',name:'employee',pid:'employee',cause:'overwork'},
    {round:3,type:'eliminated',name:'colleague',pid:'colleague',cause:'anxiety',anxiety:6},
    {round:4,type:'ghost',kind:'haunt',name:'colleague',pid:'colleague',detail:'茶水間',targetPid:null},
    {round:5,type:'ghost',kind:'warn',name:'colleague',pid:'colleague',detail:'employee',targetPid:'employee'},
    {round:5,type:'shield',kind:'warned',name:'employee',pid:'employee'},
  ];
  const k=e.api.pickKings(e.room,'boss',null);
  assert.equal(k[1].holderId,'colleague');
  assert.equal(k[1].acts,2);
  assert.match(k[1].deed,/作祟 2 次/);
  assert.match(k[1].deed,/1 次真的救到/);
  assert.equal(k[0].vacant,true);                      // 老闆贏 → 摸魚王從缺，不亂發
  // 全員都是幽靈但沒人出手 → 改選死最早、飄最久的那位
  e.room.chronicle=e.room.chronicle.filter(x=>x.type==='eliminated');
  assert.equal(e.api.pickKings(e.room,'boss',null)[1].holderId,'employee');
});
// 🔴 B5：兩隻鬼同回合報不同人，只有真的救到人的那隻算命中（舊版只比 round，白撿命中＋假事蹟）
test('ghost king only credits the warn that actually saved its own target',()=>{
  const e=engine({ids:['boss','employee','colleague','g1','g2']});
  const mk=(id,exit)=>{const p=e.room.players.get(id);p.alive=false;p.isGhost=true;return {id,exit};};
  mk('g1',4);mk('g2',2);
  // g1 報信給 employee（真的被救到）；g2 同一回合報信給 colleague（colleague 沒被抓，白報一場）
  e.room.chronicle=[
    {round:4,type:'eliminated',name:'g1',pid:'g1',cause:'anxiety',anxiety:6},
    {round:2,type:'eliminated',name:'g2',pid:'g2',cause:'anxiety',anxiety:6},   // 死得早 → 舊版平手時他反而勝出
    {round:5,type:'ghost',kind:'warn',name:'g1',pid:'g1',detail:'employee',targetPid:'employee'},
    {round:5,type:'ghost',kind:'warn',name:'g2',pid:'g2',detail:'colleague',targetPid:'colleague'},
    {round:5,type:'shield',kind:'warned',name:'employee',pid:'employee'},        // 只有 employee 被救到
  ];
  const k=e.api.pickKings(e.room,'boss',null)[1];
  assert.equal(k.holderId,'g1','王冠要給真的救到人的那隻鬼（舊版會因為同回合有 warned 就給 g2）');
  assert.match(k.deed,/1 次真的救到/);
  // 反向：只留沒救到人的 g2 → 事蹟不得謊稱救到人
  const only2=[...e.room.chronicle].filter(x=>x.pid!=='g1');
  e.room.chronicle=only2;
  e.room.players.get('g1').isGhost=false;e.room.players.get('g1').alive=true;
  const k2=e.api.pickKings(e.room,'boss',null)[1];
  assert.equal(k2.holderId,'g2');
  assert.doesNotMatch(k2.deed,/真的救到/,'沒救到人就不准寫「真的救到」——那是編給玩家看的假事蹟');
  // 同回合、同一個目標才算命中：把 shield 換成 colleague 就換 g2 命中
  e.room.chronicle=[...only2,{round:5,type:'shield',kind:'warned',name:'colleague',pid:'colleague'}];
  assert.match(e.api.pickKings(e.room,'boss',null)[1].deed,/1 次真的救到/);
  // 不同回合被救的不算（就算目標一樣）
  e.room.chronicle=[...only2,{round:6,type:'shield',kind:'warned',name:'colleague',pid:'colleague'}];
  assert.doesNotMatch(e.api.pickKings(e.room,'boss',null)[1].deed,/真的救到/);
});
// 上面那條靠 fixture；這條用真的引擎跑一遍，證明 chronicle 真的寫得出對帳需要的欄位（fixture 不是幻想）
test('chronicle records who warned whom and who was actually saved',()=>{
  const e=engine({ids:['boss','employee','colleague','g1','g2']});
  const emp=e.room.players.get('employee'), col=e.room.players.get('colleague');
  for(const id of ['g1','g2']){const g=e.room.players.get(id);g.alive=false;g.isGhost=true;g.ghostCooldown=0;}
  e.api.enterChoose(e.room);
  for(const p of e.room.players.values()) p.hand=[];        // 清掉藉口卡，否則會走 shield/excused 那條
  emp.immunity=0;col.immunity=0;
  e.room.choices={
    boss:{zones:['tea']},                                    // 老闆巡茶水間
    emp:{employee:{action:'slack',zone:'tea'},               // employee 被抓（但有幽靈報信）
         colleague:{action:'idle',zone:'office'}},           // colleague 安全，g2 的報信白報
    ghost:{g1:{type:'warn',targetId:'employee'},g2:{type:'warn',targetId:'colleague'}},
  };
  e.api.resolveRound(e.room);
  const c=e.room.chronicle;
  const w1=c.find(x=>x.type==='ghost'&&x.pid==='g1'), w2=c.find(x=>x.type==='ghost'&&x.pid==='g2');
  assert.equal(w1&&w1.targetPid,'employee','幽靈報信要記下報給誰（playerId）');
  assert.equal(w2&&w2.targetPid,'colleague');
  const sh=c.filter(x=>x.type==='shield'&&x.kind==='warned');
  assert.equal(sh.length,1,'只有 employee 該被報信救到');
  assert.equal(sh[0].pid,'employee','被救者要記 playerId，不能只記名字（同名玩家會混在一起）');
  assert.equal(e.room.lastReveal.results.find(r=>r.playerId==='employee').caught,'warned');
  // 端到端：王冠與事蹟都歸給 g1
  const k=e.api.pickKings(e.room,'boss',null)[1];
  assert.equal(k.holderId,'g1');
  assert.match(k.deed,/1 次真的救到/);
});
test('ox king ranks purely by work count then wage, even if that is the slacker king',()=>{
  const e=engine();
  const emp=e.room.players.get('employee'),col=e.room.players.get('colleague');
  emp.workCount=5;emp.wageEarned=5;col.workCount=3;col.wageEarned=3;
  // 照實頒：摸魚王做最多工就讓他戴兩頂，不讓賢（老闆 2026-09-13 裁決）
  assert.equal(e.api.pickKings(e.room,'emp','employee')[2].holderId,'employee');
  assert.equal(e.api.pickKings(e.room,'emp','colleague')[2].holderId,'employee');
  assert.equal(e.api.pickKings(e.room,'boss',null)[2].holderId,'employee');
  col.workCount=5;col.wageEarned=9;
  assert.equal(e.api.pickKings(e.room,'boss',null)[2].holderId,'colleague');      // 同工作數比薪水累積
  emp.workCount=0;col.workCount=0;
  const none=e.api.pickKings(e.room,'boss',null)[2];
  assert.equal(none.vacant,true);assert.ok(none.deed);
});
test('one player can wear both the slacker and the ox crown',()=>{
  const e=engine();
  const emp=e.room.players.get('employee'),col=e.room.players.get('colleague');
  emp.workCount=4;emp.wageEarned=4;col.workCount=1;col.wageEarned=1;
  e.api.endGame(e.room,'emp','摸魚王是【employee】','employee');
  const w=e.room.winner;
  assert.equal(w.kings[0].holderId,'employee');
  assert.equal(w.kings[2].holderId,'employee');
  const row=w.ranking.find(r=>r.name==='employee');
  assert.equal(row.kings.join(','),'slack,ox');   // 兩頂王冠都掛在同一人身上
  assert.equal(row.title,'🐟 摸魚王');            // 位階：摸魚王 > 牛馬王
  assert.match(w.story[w.story.length-1],/🐟 摸魚王：employee｜👻 搞鬼王：從缺｜🐮 牛馬王：employee/);
});
test('engine run records the counters the ox king needs',()=>{
  const e=engine();
  round(e,'work');e.api.advanceRound(e.room);round(e,'work');
  assert.equal(e.p.workCount,2);assert.equal(e.p.wageEarned,2);
});

// ---------- T5：故事書 ----------
const FAT_CHRONICLE=[
  {round:1,type:'catch',name:'阿美',pid:'employee',zone:'茶水間'},
  {round:5,type:'catch',name:'阿強',pid:'colleague',zone:'頂樓'},
  {round:1,type:'bigwin',name:'阿美',pid:'employee',zone:'影印間',gain:5,risky:false},
  {round:4,type:'bigwin',name:'阿強',pid:'colleague',zone:'頂樓',gain:9,risky:true},
  {round:1,type:'held',name:'阿美',pid:'employee',zone:'茶水間',pct:30},
  {round:3,type:'held',name:'阿強',pid:'colleague',zone:'廁所',pct:60},
  {round:1,type:'shield',kind:'excused',name:'阿美',detail:'肚子痛先閃'},
  {round:2,type:'shield',kind:'warned',name:'阿強'},
  {round:1,type:'mooch',name:'阿美',by:'阿強'},
  {round:2,type:'ot',name:'阿美'},
  {round:2,type:'ghost',kind:'haunt',name:'阿鬼',pid:'ghosty',detail:'廁所'},
  {round:3,type:'promote',name:'阿美'},
  {round:3,type:'fire',name:'阿鬼',pid:'ghosty'},
  {round:4,type:'eliminated',name:'阿美',pid:'employee',cause:'overwork'},
];
const FAKE_KINGS=[{key:'slack',icon:'🐟',title:'摸魚王',holder:'阿強'},{key:'ghost',icon:'👻',title:'搞鬼王',holder:'阿鬼'},{key:'ox',icon:'🐮',title:'牛馬王',holder:null}];
test('story picks the most dramatic take of each event and never exceeds nine paragraphs',()=>{
  const e=engine();e.room.chronicle=[...FAT_CHRONICLE];
  const s=e.api.buildStory(e.room,'emp','摸魚王是【阿強】（偷懶 9 💰）','colleague',FAKE_KINGS);
  assert.ok(s.length<=9,`故事最多 9 段，實際 ${s.length}`);
  const text=s.join('\n');
  // 被抓：兩筆都在，要選頂樓那筆（不是第一筆茶水間）
  assert.match(text,/放大鏡的光停在頂樓/);
  assert.doesNotMatch(text,/放大鏡的光停在茶水間/);
  // 摸魚得逞：選 9💰 那筆
  assert.match(text,/爽賺了 9💰/);
  assert.doesNotMatch(text,/爽賺了 5💰/);
  // 憋氣：選 60% 那筆
  assert.match(text,/憋 60%/);
  assert.doesNotMatch(text,/憋 30%/);
  // 擋箭牌：幽靈報信比藉口卡精彩
  assert.match(text,/幽靈密電/);
  assert.doesNotMatch(text,/肚子痛先閃/);
  // 結局與頒獎保底不被截斷（舊版 slice(0,9) 會把這兩段砍掉）
  assert.match(s[s.length-2],/摸魚王是【阿強】/);
  assert.match(s[s.length-1],/本日頒獎/);
  assert.match(s[s.length-1],/🐟 摸魚王：阿強/);
  assert.match(s[s.length-1],/👻 搞鬼王：阿鬼/);
  assert.match(s[s.length-1],/🐮 牛馬王：從缺/);
});
test('story carries first-person lines for caught, slack win, sudden death and holding breath',()=>{
  const e=engine();
  e.room.chronicle=[
    {round:2,type:'catch',name:'阿美',pid:'employee',zone:'廁所'},
    {round:3,type:'bigwin',name:'阿強',pid:'colleague',zone:'頂樓',gain:6,risky:false},
    {round:3,type:'held',name:'阿強',pid:'colleague',zone:'影印間',pct:60},
    {round:4,type:'eliminated',name:'阿美',pid:'employee',cause:'overwork'},
  ];
  const s=e.api.buildStory(e.room,'emp','摸魚王是【阿強】','colleague',FAKE_KINGS);
  const text=s.join('\n');
  assert.match(text,/阿美：「.+」/);                      // 被抓
  assert.match(text,/阿強：「.+」/);                      // 摸魚得逞／憋氣
  assert.equal((text.match(/：「/g)||[]).length>=4,true); // 四個時刻都有台詞
  assert.match(text,/過勞猝死在鍵盤上/);
  assert.match(text,/不是出局，是換了跑道/);              // 猝死＝換跑道，不是懲罰
  // 同樣輸入要產生同樣台詞（確定性，重連不會換句子）
  assert.deepEqual(e.api.buildStory(e.room,'emp','摸魚王是【阿強】','colleague',FAKE_KINGS),s);
});
// ---------- 順手 bug：practiceGhostPass 會吃掉已送出的幽靈行動 ----------
test('ghost pass must not overwrite a haunt that was already submitted',()=>{
  const e=engine();
  const {sock,h}=wireSocket(e);
  const g=e.room.players.get('employee');
  g.alive=false;g.isGhost=true;g.ghostCooldown=0;e.room.hostId=g.id;
  e.api.enterChoose(e.room);
  e.room.choices={emp:{},boss:null,ghost:{}};        // colleague/老闆都還沒送 → 不會提前結算
  sock.data.roomCode=e.room.code;sock.data.playerId=g.id;
  let r1=null;h.submitChoice({ghostAction:{type:'haunt'}},x=>{r1=x;});
  assert.equal(r1&&r1.ok,true);
  assert.equal(e.room.choices.ghost[g.id].type,'haunt');
  let r2=null;h.practiceGhostPass(x=>{r2=x;});
  assert.ok(r2&&r2.error,'已作祟過還能 pass 就是 bug');
  assert.equal(e.room.choices.ghost[g.id].type,'haunt','pass 不得覆蓋已送出的作祟');
  assert.equal(e.room.phase,'choosing');
});
test('ghost pass still works when the ghost has not acted yet',()=>{
  const e=engine();
  const {sock,h}=wireSocket(e);
  const g=e.room.players.get('employee');
  g.alive=false;g.isGhost=true;e.room.hostId=g.id;
  e.api.enterChoose(e.room);
  e.room.choices={emp:{},boss:null,ghost:{}};
  sock.data.roomCode=e.room.code;sock.data.playerId=g.id;
  let r=null;h.practiceGhostPass(x=>{r=x;});
  assert.equal(r&&r.ok,true);
  assert.equal(e.room.choices.ghost[g.id].type,'pass');
});

// ---------- ack 型別防護：畸形封包不得殺掉整個 process（實測過：修補前送 'hello' 就死） ----------
// 假 socket 的 on() 收到的已經是 guardHandlers 包過的函式，所以 h[ev](...) 打的就是正式的入口。
function junkEngine(){
  const e=engine();
  const {sock,h}=wireSocket(e);
  sock.data.roomCode=e.room.code;sock.data.playerId='employee';   // 綁成真的座位，讓 handler 走得進去
  return {e,sock,h};
}
test('every socket handler is registered through the guard wrapper',()=>{
  // 原始碼層：不准有任何一個 handler 繞過 on()/onNoAck() 直接掛 socket.on
  const bare=source.match(/^\s*socket\.on\(['"]/gm)||[];
  assert.equal(bare.length,0,`還有 ${bare.length} 個 handler 直接用 socket.on 註冊`);
  const declared=(source.match(/^  on\('/gm)||[]).length+(source.match(/^  onNoAck\('/gm)||[]).length;
  assert.ok(declared>=29,`on()/onNoAck() 註冊數 ${declared}，比預期少`);
  // 執行層：真的掛到 socket 上的數量要跟原始碼對得起來（少一個就是有人漏包）
  const {h}=junkEngine();
  assert.equal(Object.keys(h).length,declared,'掛上 socket 的 handler 數 ≠ 原始碼的註冊數');
});
test('a non-function ack does not throw for any registered event',()=>{
  const events=Object.keys(junkEngine().h);
  for(const ev of events){
    for(const junk of ['hello',42,{not:'a fn'},['array'],true,null]){
      const {h}=junkEngine();                                   // 每個事件用全新房間，避免互相污染
      assert.doesNotThrow(()=>h[ev](junk),`${ev} 收到 ${JSON.stringify(junk)} 當 ack 就炸了`);
    }
    const {h}=junkEngine();
    assert.doesNotThrow(()=>h[ev](),`${ev} 完全不給參數就炸了`);  // 連 payload 都沒給（解構 undefined）
  }
});
// 🔴 B3：畸形 payload 不准被當成合法的空請求。舊版一律補成 {}，Codex 實跑抓到三個真的狀態變更：
//    createRoom(null) 建了房、setPassword(null) **靜默解除房間密碼**、主管 submitChoice(null) 鎖定「不協查」。
//    這條測試的重點不是「沒炸」，是「什麼都沒發生」——舊測試只斷言 doesNotThrow，所以整批溜過去了。
// 🔴 Codex 輪次 2 B3-2：二進位也要在這裡。socket.io 原生支援 binary，
//    Buffer／TypedArray／ArrayBuffer 全都 `typeof==='object'`，只驗 typeof 會整批放行，
//    輪次 1 修掉的三條（建房／解除密碼／主管鎖定）換成 Buffer 就原樣復現。
//    Date/Map/Set/RegExp 一起放進來：它們 JSON 送不進來，但列著才守得住「只收 POJO」這條線。
const BAD_PAYLOADS=[null,undefined,'hello',42,true,['array'],
  Buffer.from('deadbeef','hex'), new Uint8Array([1,2,3]), new ArrayBuffer(8), new DataView(new ArrayBuffer(8)),
  new Date(), new Map([['a',1]]), new Set([1]), /regex/];
test('malformed payloads are rejected with an error and change nothing at all',()=>{
  const evs=payloadEventsFromSource(source);
  assert.ok(evs.length>=15,`從原始碼解析到的「有 payload 位」事件只有 ${evs.length} 個，解析壞了？`);
  for(const must of ['createRoom','createSolo','setPassword','submitChoice','voice-signal','startGame'])
    assert.ok(evs.includes(must),`${must} 應該被算成有 payload 位的事件`);
  for(const ev of evs){
    for(const bad of BAD_PAYLOADS){
      if(ev==='startGame'&&bad==null) continue;                 // 白名單：HEAD 本來就允許空 payload（opts||{}）
      const {e,h}=junkEngine();
      e.room.password='4321';                                   // 讓「密碼被改掉」看得見
      e.room.hostId='employee';                                 // 綁成房主，才走得到房主專屬那些 handler
      const before=worldSnapshot(e.api);
      let ack=null;
      assert.doesNotThrow(()=>h[ev](bad,x=>{ack=x;}),`${ev} 收到畸形 payload ${String(bad)} 就炸了`);
      if(ev!=='voice-signal')                                   // onNoAck 沒有 ack 可以回話，只能靜靜丟掉
        assert.equal(ack&&ack.error,'無效請求',`${ev} 收到 ${String(bad)} 應該回明確錯誤，不是靜默接受`);
      assert.equal(worldSnapshot(e.api),before,`${ev} 收到 ${String(bad)} 之後世界狀態被改了`);
    }
  }
});
test('a null payload no longer creates a room, clears a password, or locks in a choice',()=>{
  // Codex 輪次 1 實跑出來的三條，逐條釘死
  const a=junkEngine();
  const roomsBefore=a.e.api.rooms.size;
  let r1=null;a.h.createRoom(null,x=>{r1=x;});
  assert.equal(r1&&r1.error,'無效請求');
  assert.equal(a.e.api.rooms.size,roomsBefore,'createRoom(null) 不得建出房間');

  const b=junkEngine();
  b.e.room.password='1234';b.e.room.hostId='employee';           // 綁成房主，證明擋下來的不是權限而是 payload
  let r2=null;b.h.setPassword(null,x=>{r2=x;});
  assert.equal(r2&&r2.error,'無效請求');
  assert.equal(b.e.room.password,'1234','setPassword(null) 不得靜默解除房間密碼');

  const c=junkEngine();
  const sup=c.e.room.players.get('employee');
  sup.isSupervisor=true;sup.supTermLeft=2;c.e.room.supervisorId=sup.id;
  c.e.api.enterChoose(c.e.room);c.e.room.choices={emp:{},boss:null,ghost:{}};
  let r3=null;c.h.submitChoice(null,x=>{r3=x;});
  assert.equal(r3&&r3.error,'無效請求');
  assert.deepEqual(c.e.room.choices.emp,{},'主管 submitChoice(null) 不得鎖定「不協查」');
  assert.equal(c.e.room.phase,'choosing','不得因此提前結算');
});
// 🔴 B3-2：把上面那三條原封不動換成 Buffer 再打一次。socket.io 會真的把 Buffer 交到 handler 手上
//    （用專案自己的 socket.io-parser encode→decode 驗過），所以這不是理論題。
// 同樣不靠「我有沒有想到 Buffer」：把 socket.io 送得進來的值**系統性列舉**出來
//（JSON 六型 ＋ 全部 TypedArray 品種 ＋ ArrayBuffer/DataView），逐一驗「只有 POJO 才進得了 handler」。
const TYPED_ARRAYS=[Int8Array,Uint8Array,Uint8ClampedArray,Int16Array,Uint16Array,
  Int32Array,Uint32Array,Float32Array,Float64Array,BigInt64Array,BigUint64Array];
const PAYLOAD_ZOO=[
  // [說明, 值, 該不該被當成合法 payload]
  ['{}',{},true], ['有欄位的物件',{a:1},true], ['Object.create(null)',Object.create(null),true],
  ['跨 realm 的物件',vm.runInNewContext('({a:1})'),true],   // vm 測試會走到這條，realm 不同也必須放行
  ['null',null,false], ['undefined',undefined,false], ['字串','x',false], ['空字串','',false],
  ['數字',1,false], ['0',0,false], ['true',true,false], ['false',false,false],
  ['陣列',[1,2],false], ['空陣列',[],false],
  ['Buffer',Buffer.from('ab'),false], ['ArrayBuffer',new ArrayBuffer(4),false],
  ['DataView',new DataView(new ArrayBuffer(4)),false],
  ...TYPED_ARRAYS.map(T=>[T.name,new T(2),false]),
  ['Date',new Date(),false], ['Map',new Map(),false], ['Set',new Set(),false], ['RegExp',/x/,false],
];
test('only a plain object counts as a payload — the whole value zoo, not just the cases I happened to think of',()=>{
  assert.ok(PAYLOAD_ZOO.length>=25,`型別動物園只有 ${PAYLOAD_ZOO.length} 種，列得不夠`);
  for(const [label,value,shouldPass] of PAYLOAD_ZOO){
    const {e,h}=junkEngine();
    e.room.password='4321'; e.room.hostId='employee';
    const before=worldSnapshot(e.api);
    let ack=null;
    assert.doesNotThrow(()=>h.setPassword(value,x=>{ack=x;}),`setPassword 收到 ${label} 就炸了`);
    if(shouldPass){
      assert.notEqual(ack&&ack.error,'無效請求',`${label} 是合法 payload，不該被 payload 驗證擋掉`);
    }else{
      assert.equal(ack&&ack.error,'無效請求',`${label} 應該被退件`);
      assert.equal(worldSnapshot(e.api),before,`${label} 被退件後世界狀態卻變了`);
      assert.equal(e.room.password,'4321',`${label} 竟然改動了房間密碼`);
    }
  }
});
test('a binary payload cannot do what a null payload could not',()=>{
  const bin=()=>Buffer.from('deadbeef','hex');
  const a=junkEngine();
  const roomsBefore=a.e.api.rooms.size;
  let r1=null;a.h.createRoom(bin(),x=>{r1=x;});
  assert.equal(r1&&r1.error,'無效請求');
  assert.equal(a.e.api.rooms.size,roomsBefore,'createRoom(Buffer) 不得建出房間');

  const b=junkEngine();
  b.e.room.password='1234';b.e.room.hostId='employee';
  let r2=null;b.h.setPassword(bin(),x=>{r2=x;});
  assert.equal(r2&&r2.error,'無效請求');
  assert.equal(b.e.room.password,'1234','setPassword(Buffer) 不得靜默解除房間密碼');

  const c=junkEngine();
  const sup=c.e.room.players.get('employee');
  sup.isSupervisor=true;sup.supTermLeft=2;c.e.room.supervisorId=sup.id;
  c.e.api.enterChoose(c.e.room);c.e.room.choices={emp:{},boss:null,ghost:{}};
  let r3=null;c.h.submitChoice(bin(),x=>{r3=x;});
  assert.equal(r3&&r3.error,'無效請求');
  assert.deepEqual(c.e.room.choices.emp,{},'主管 submitChoice(Buffer) 不得鎖定「不協查」');
  assert.equal(c.e.room.phase,'choosing');

  // 白名單的 startGame 也一樣：允許的是「空 payload」，不是「任何非物件」
  const d=junkEngine();
  d.e.room.hostId='employee';d.e.room.phase='lobby';
  let r4=null;d.h.startGame(bin(),x=>{r4=x;});
  assert.equal(r4&&r4.error,'無效請求','startGame 白名單只放行 null/undefined，不放行 Buffer');
  assert.equal(d.e.room.phase,'lobby');
});
test('well-formed payloads still behave exactly as before',()=>{
  // 反向保護：修 B3 不能把正常路徑一起擋掉
  const a=junkEngine();
  const roomsBefore=a.e.api.rooms.size;
  let r1=null;a.h.createRoom({name:'阿寫'},x=>{r1=x;});
  assert.equal(r1&&r1.ok,true);
  assert.equal(a.e.api.rooms.size,roomsBefore+1,'正常 createRoom 照樣建得出房間');

  const b=junkEngine();
  b.e.room.password='1234';b.e.room.hostId='employee';
  let r2=null;b.h.setPassword({password:'5678'},x=>{r2=x;});
  assert.equal(r2&&r2.ok,true);assert.equal(b.e.room.password,'5678');
  let r3=null;b.h.setPassword({password:''},x=>{r3=x;});         // 房主「刻意」解除密碼仍然要做得到
  assert.equal(r3&&r3.ok,true);assert.equal(b.e.room.password,null,'明確送空字串＝刻意解鎖，不可被誤擋');

  const c=junkEngine();
  const sup=c.e.room.players.get('employee');
  sup.isSupervisor=true;sup.supTermLeft=2;c.e.room.supervisorId=sup.id;
  c.e.api.enterChoose(c.e.room);c.e.room.choices={emp:{},boss:null,ghost:{}};
  let r4=null;c.h.submitChoice({inspectZone:null},x=>{r4=x;});   // 前端真的會送這個（supPick 沒選＝null）
  assert.equal(r4&&r4.ok,true);
  // 註：choices 物件是在 vm realm 裡建的，deepStrictEqual 會因 prototype 不同而失敗 → 逐欄比對
  const ch=c.e.room.choices.emp[sup.id];
  assert.equal(ch&&ch.action,'supervise');assert.equal(ch&&ch.zone,null);

  // startGame 在白名單上：HEAD 就吃得下空 payload（內文 opts||{}），行為不得倒退
  const d=junkEngine();
  d.e.room.hostId='employee';d.e.room.phase='lobby';
  let r5=null;d.h.startGame(null,x=>{r5=x;});
  assert.equal(r5&&r5.ok,true,'startGame 空 payload 應維持 HEAD 行為（用預設設定開局）');
  assert.equal(d.e.room.phase!=='lobby',true);
});
// ---------- 欄位級型別驗證（Codex 輪次 3 B3-A／B／C；HEAD 就有的缺陷，老闆 2026-09-13 裁決一起修）----------
// 頂層 payload 是 POJO **不代表**裡面的欄位是乾淨的。`ZONES[zone]` 會把 ['tea']／Buffer('tea')
// 隱式轉成字串而通過驗證，原值卻被原樣存進 room.choices，結算時 `inspected.has(zone)` 是嚴格比對
// → 老闆明明巡了那一區卻抓不到人（實測白拿 +2💰）；`'__proto__'` 更會拿到 Object.prototype
// → 通過驗證 → resolveRound 丟 TypeError → 整間房 phase 永遠卡在 choosing。
function seat(e,pid){ const {sock,h}=wireSocket(e); sock.data.roomCode=e.room.code; sock.data.playerId=pid; return h; }
// 全部都「看起來像 tea」：只要驗證是靠隱式轉字串，這些就會通過
const FAKE_ZONES=[['陣列 [tea]',['tea']],['Buffer(tea)',Buffer.from('tea')],
  ['[Buffer(tea)]',[Buffer.from('tea')]],['自訂 toString 的物件',{toString:()=>'tea'}],
  ['Object(String)',new String('tea')],
  ["'__proto__'",'__proto__'],["'constructor'",'constructor'],["'toString'",'toString'],["'hasOwnProperty'",'hasOwnProperty']];
function chooseReady(e){ e.api.enterChoose(e.room); e.room.choices={emp:{},boss:null,ghost:{}}; e.room.config.bossInspect=1; }
test('a zone that only looks like a zone cannot be slacked in — and the real one still works',()=>{
  for(const [label,zone] of FAKE_ZONES){
    const e=engine();
    const emp=e.room.players.get('employee'); emp.seniority='junior'; emp.immunity=0;
    const hEmp=seat(e,'employee'), hBoss=seat(e,'boss');
    chooseReady(e);
    let ackB=null; hBoss.submitChoice({zones:['tea']},x=>{ackB=x;});
    assert.equal(ackB&&ackB.ok,true,'老闆巡查茶水間應該成立');
    let ack=null;
    assert.doesNotThrow(()=>hEmp.submitChoice({action:'slack',zone},x=>{ack=x;}),`${label} 讓 handler 炸了`);
    assert.equal(ack&&ack.error,'請選一個摸魚區',`${label} 應該被退件（不是靠隱式轉字串放行）`);
    assert.equal(e.room.choices.emp.employee,undefined,`${label} 被退件卻留下了選擇`);
  }
  // 對照組：真的字串照收，而且照樣會被巡查抓到（證明不是把摸魚整個擋掉）
  const e=engine();
  const emp=e.room.players.get('employee'); emp.seniority='junior'; emp.immunity=0;
  const hEmp=seat(e,'employee'), hBoss=seat(e,'boss');
  chooseReady(e);
  hBoss.submitChoice({zones:['tea']},()=>{});
  let ok=null; hEmp.submitChoice({action:'slack',zone:'tea'},x=>{ok=x;});
  assert.equal(ok&&ok.ok,true);
  assert.equal(e.room.choices.emp.employee.zone,'tea');
  for(const p of e.room.players.values()) p.hand=[];      // 清掉藉口卡，讓「有沒有被抓」是唯一變因
  e.room.choices.emp.colleague={action:'idle',zone:'office'};
  e.api.resolveRound(e.room);
  const r=e.room.lastReveal.results.find(x=>x.playerId==='employee');
  assert.equal(r.caught,true,'在被巡查的區摸魚就是要被抓（型別驗證不得改變這件事）');
  assert.equal(e.room.players.get('employee').points,0,'被抓就沒有 +2💰');
});
test('the boss and the supervisor cannot inspect with a fake zone either',()=>{
  for(const [label,zone] of FAKE_ZONES){
    const b=engine(); const hBoss=seat(b,'boss'); chooseReady(b);
    let ack=null;
    assert.doesNotThrow(()=>hBoss.submitChoice({zones:[zone]},x=>{ack=x;}),`老闆 zones ${label} 讓 handler 炸了`);
    assert.equal(ack&&ack.error,'請選 1 個要查的地方',`老闆 zones ${label} 應該被退件`);
    assert.equal(b.room.choices.boss,null,`老闆 zones ${label} 被退件卻留下了巡查`);

    const s=engine(); const sup=s.room.players.get('employee');
    sup.isSupervisor=true; sup.supTermLeft=2; s.room.supervisorId=sup.id;
    const hSup=seat(s,'employee'); chooseReady(s);
    let ack2=null;
    assert.doesNotThrow(()=>hSup.submitChoice({inspectZone:zone},x=>{ack2=x;}),`主管 ${label} 讓 handler 炸了`);
    assert.equal(ack2&&ack2.error,'協查地點無效',`主管 inspectZone ${label} 應該被退件`);
    assert.equal(s.room.choices.emp[sup.id],undefined);
  }
  // zones 根本不是陣列：以前 .filter 直接丟 TypeError（被 guard 接住回「伺服器內部錯誤」），現在要明確退件
  for(const notArr of [Buffer.from('tea'),new Date(),new Map(),{0:'tea',length:1},'tea']){
    const b=engine(); const hBoss=seat(b,'boss'); chooseReady(b);
    let ack=null; hBoss.submitChoice({zones:notArr},x=>{ack=x;});
    assert.equal(ack&&ack.error,'請選 1 個要查的地方',`zones=${String(notArr).slice(0,12)} 應該是明確退件`);
    assert.notEqual(ack&&ack.error,'伺服器內部錯誤，這個動作沒有生效','不准再靠例外處理當驗證');
  }
  // 對照組：老闆巡查與主管協查的正常路徑一字不改
  const b=engine(); const hBoss=seat(b,'boss'); chooseReady(b);
  let ok=null; hBoss.submitChoice({zones:['roof'],focus:{zone:'roof',pct:30}},x=>{ok=x;});
  assert.equal(ok&&ok.ok,true);
  assert.deepEqual(b.room.choices.boss.zones,['roof']);
  assert.equal(b.room.choices.boss.focus.pct,30,'緊盯 30% 仍要收得下');
  const s=engine(); const sup=s.room.players.get('employee');
  sup.isSupervisor=true; sup.supTermLeft=2; s.room.supervisorId=sup.id;
  const hSup=seat(s,'employee'); chooseReady(s);
  let ok2=null; hSup.submitChoice({inspectZone:'copy'},x=>{ok2=x;});
  assert.equal(ok2&&ok2.ok,true); assert.equal(s.room.choices.emp[sup.id].zone,'copy');
  let ok3=null; hSup.submitChoice({inspectZone:null},x=>{ok3=x;});   // 不協查仍然合法
  assert.equal(ok3&&ok3.ok,true); assert.equal(s.room.choices.emp[sup.id].zone,null);
});
test('緊盯 pct 也不能用原型鏈的 key 繞過經費檢查',()=>{
  // FOCUS_COST['__proto__'] 是 Object.prototype（truthy），而且 `budget < Object.prototype` 是 false
  const e=engine(); const hBoss=seat(e,'boss'); chooseReady(e);
  const boss=e.room.players.get('boss'); const budget0=boss.budget;
  let ack=null; hBoss.submitChoice({zones:['tea'],focus:{zone:'tea',pct:'__proto__'}},x=>{ack=x;});
  assert.equal(ack&&ack.ok,true,'巡查本身合法，只有緊盯要被忽略');
  assert.equal(e.room.choices.boss.focus,null,'原型鏈 key 不得變成一次緊盯');
  assert.equal(boss.budget,budget0,'也不得扣到經費');
});
test('a __proto__ zone can no longer freeze the entire room',()=>{
  // 修補前：ack 回 {ok:true} → resolveRound 丟 TypeError: object is not iterable
  //         → timer 已清、壞掉的 choice 留在房裡、phase 永遠卡在 choosing（單一惡意客戶端癱瘓整房）
  const e=engine({solo:false,ids:['boss','employee','colleague']});
  const emp=e.room.players.get('employee'); emp.seniority='junior'; emp.immunity=0;
  const hEmp=seat(e,'employee'), hBoss=seat(e,'boss');
  chooseReady(e);
  hBoss.submitChoice({zones:['tea']},()=>{});
  let ack=null; hEmp.submitChoice({action:'slack',zone:'__proto__'},x=>{ack=x;});
  assert.equal(ack&&ack.error,'請選一個摸魚區');
  assert.equal(e.room.phase,'choosing');
  // 房間還活著：同一位玩家改送合法的選擇，這回合照樣結算得完
  let ok=null; hEmp.submitChoice({action:'slack',zone:'tea'},x=>{ok=x;});
  assert.equal(ok&&ok.ok,true);
  e.room.choices.emp.colleague={action:'idle',zone:'office'};
  assert.doesNotThrow(()=>e.api.resolveRound(e.room),'結算不得因為剛才那個封包而爆炸');
  assert.equal(e.room.phase,'reveal','房間要能往下走，不是卡在 choosing');
});
test('a __proto__ ghost action cannot squat this round\'s ghost slot',()=>{
  // GHOST_ACTIONS['__proto__'] 是 Object.prototype（truthy）→ 舊版通過驗證後占住名額，
  // 結算時三個分支都比不中（continue），幽靈這回合等於被消音
  const e=engine();
  const g=e.room.players.get('employee'); g.alive=false; g.isGhost=true; g.ghostCooldown=0;
  const hG=seat(e,'employee'); chooseReady(e);
  for(const bad of ['__proto__','constructor','toString',['haunt'],Buffer.from('haunt'),null,undefined]){
    let ack=null;
    assert.doesNotThrow(()=>hG.submitChoice({ghostAction:{type:bad}},x=>{ack=x;}),`ghostAction.type=${String(bad)} 讓 handler 炸了`);
    assert.equal(ack&&ack.error,'無效的幽靈行動',`ghostAction.type=${String(bad)} 應該被退件`);
    assert.deepEqual(Object.keys(e.room.choices.ghost),[],'被退件的幽靈行動不得占住名額');
  }
  let ok=null; hG.submitChoice({ghostAction:{type:'haunt'}},x=>{ok=x;});
  assert.equal(ok&&ok.ok,true,'真的作祟仍然要送得出去');
  assert.equal(e.room.choices.ghost[g.id].type,'haunt');
  // 報信對象存的是驗證過的 pid，不是客戶端原值
  const e2=engine();
  const g2=e2.room.players.get('employee'); g2.alive=false; g2.isGhost=true; g2.ghostCooldown=0;
  const hG2=seat(e2,'employee'); chooseReady(e2);
  let bad=null; hG2.submitChoice({ghostAction:{type:'warn',targetId:Buffer.from('colleague')}},x=>{bad=x;});
  assert.equal(bad&&bad.error,'報信對象無效');
  let good=null; hG2.submitChoice({ghostAction:{type:'warn',targetId:'colleague'}},x=>{good=x;});
  assert.equal(good&&good.ok,true);
  assert.equal(e2.room.choices.ghost[g2.id].targetId,'colleague');
});
test('handing in a card index that is not really an index is rejected, not crashed',()=>{
  // me.hand['__proto__'] 是 Object.prototype（truthy）→ 下一行 CARD_DEFS[undefined].kind 直接 TypeError
  for(const bad of ['__proto__','constructor',[0],'0',Buffer.from('0'),0.5,-1,NaN,{}]){
    const e=engine();
    const p=e.room.players.get('employee'); p.hand=[{type:'energy',name:'提神飲料'}];
    const h=seat(e,'employee'); chooseReady(e);
    let ack=null;
    assert.doesNotThrow(()=>h.submitChoice({action:'idle',cardIdx:bad},x=>{ack=x;}),`cardIdx=${String(bad)} 讓 handler 炸了`);
    assert.equal(ack&&ack.error,'沒有這張手牌',`cardIdx=${String(bad)} 應該是明確退件`);
    assert.equal(e.room.choices.emp[p.id],undefined);
  }
  // 對照組：真的整數索引照常出牌
  const e=engine();
  const p=e.room.players.get('employee'); p.hand=[{type:'energy',name:'提神飲料'}];
  const h=seat(e,'employee'); chooseReady(e);
  let ok=null; h.submitChoice({action:'idle',cardIdx:0},x=>{ok=x;});
  assert.equal(ok&&ok.ok,true); assert.equal(e.room.choices.emp[p.id].cardIdx,0);
});
test('startGame only accepts a whole number of rounds inside a sane range',()=>{
  // 🔴 B3-C：`{rounds:{}}` 讓 `room.round>=room.config.rounds` 永遠命中不了＝這局不會結束；
  //          `{rounds:[]}` 則第一回合就結束。兩種都是 ack {ok:true}。
  for(const bad of [{},[],[6],Buffer.from('9'),'8',new Date(),0,-1,1.5,NaN,Infinity,21,1e9])
    assert.equal(engine({start:{rounds:bad}}).room.config.rounds,4,`rounds=${String(bad)} 應該退回單人預設 4 回合`);
  for(const good of [1,2,4,8,20])
    assert.equal(engine({start:{rounds:good}}).room.config.rounds,good,`rounds=${good} 是合法值，不得被擋`);
  assert.equal(engine({solo:false,ids:['boss','e1','e2','e3'],start:{rounds:{}}}).room.config.rounds,6,'多人退回 6');
  // 真的打完一局：垃圾 rounds 之後遊戲仍然會結束（這才是 B3-C 的實害）
  const e=engine({start:{rounds:{}}});
  for(let i=1;i<=6;i++){ playRound(e); e.api.advanceRound(e.room); if(e.room.phase==='ended') break; }
  assert.equal(e.room.phase,'ended','垃圾 rounds 不得讓這局永遠打不完');
  assert.equal(e.room.round,4);
});
test('a prototype-chain threshold cannot poison the win condition',()=>{
  // {low,mid,high}['__proto__'] 是 Object.prototype（truthy）→ completeThreshold 變成物件
  // → `rate>=completeThreshold` 永遠 false（老闆再拚業績也不可能贏）、畫面顯示 NaN%
  for(const bad of ['__proto__','constructor','toString',['mid'],Buffer.from('mid'),{},null])
    assert.equal(engine({start:{threshold:bad}}).room.config.completeThreshold,0.7,`threshold=${String(bad)} 應退回 0.7`);
  for(const [k,v] of [['low',0.6],['mid',0.7],['high',0.8]])
    assert.equal(engine({start:{threshold:k}}).room.config.completeThreshold,v,`threshold=${k} 是合法值`);
});
// 前兩輪的教訓：突變測試只證明「我想到的那個錯」會被抓。這條反過來——不列舉攻擊，
// 直接掃「房間狀態裡有沒有伺服器不該有的東西」。任何客戶端送進來又沒被正規化的值都會現形。
test('no client-supplied non-JSON value survives anywhere in room state',()=>{
  const PURE=new Set(['[object Object]','[object Array]','[object Map]','[object Set]','[object Null]']);
  const impure=(root)=>{
    const seen=new Set(),bad=[];
    (function walk(node,p,d){
      if(node===null||d>8) return;
      if(typeof node!=='object'&&typeof node!=='function') return;
      const tag=Object.prototype.toString.call(node);
      if(!PURE.has(tag)){ bad.push(`${p}=${tag}`); return; }
      if(seen.has(node)) return; seen.add(node);
      if(node instanceof Map){ for(const [k,v] of node) walk(v,`${p}.get(${String(k).slice(0,10)})`,d+1); return; }
      if(node instanceof Set){ let i=0; for(const v of node) walk(v,`${p}.set[${i++}]`,d+1); return; }
      if(Array.isArray(node)){ node.forEach((v,i)=>walk(v,`${p}[${i}]`,d+1)); return; }
      for(const k of Object.keys(node)){ if(k==='socket'||k==='_timer') continue; walk(node[k],`${p}.${k}`,d+1); }
    })(root,'room',0);
    return bad;
  };
  // submitChoice 與 startGame 是僅有的兩個「把客戶端值寫進遊戲狀態」的入口
  //（其餘 handler 不是 .toString() 正規化就是 Map.get 嚴格比對，寫進去的都是伺服器自己的東西）
  const ZOO=[Buffer.from('tea'),new Uint8Array([1,2]),new ArrayBuffer(4),new DataView(new ArrayBuffer(4)),
    new Date(),new Map([['a',1]]),new Set([1]),/tea/,['tea'],[Buffer.from('tea')],{toString:()=>'tea'},function tea(){}];
  // ⚠️ 每個欄位都要有一組「其他欄位全合法、只有它是髒的」的 payload，否則會在前面的驗證就被退掉，
  //    髒值根本走不到寫入那一步 → 測試看起來綠，其實什麼都沒驗到（這條就被突變測試抓過一次）。
  const shapes=[
    ['boss',v=>({zones:[v]}),'boss'], ['boss',v=>({zones:['tea'],focus:{zone:v,pct:v}}),'boss'],
    ['boss',v=>({zones:['tea'],focus:{zone:'tea',pct:v}}),'boss'],
    ['sup', v=>({inspectZone:v}),'employee'],
    ['emp', v=>({action:'slack',zone:v,helpTarget:v,cardIdx:v,cardTarget:v,risky:v,hold:v}),'employee'],
    ['emp', v=>({action:'idle',helpTarget:v}),'employee'],          // 只有 helpTarget 髒
    ['emp', v=>({action:'slack',zone:'tea',helpTarget:v}),'employee'],
    ['emp', v=>({action:'slack',zone:'tea',risky:v,hold:v}),'employee'],  // 只有 risky/hold 髒
    ['emp', v=>({action:'idle',cardIdx:v}),'employee'],             // 只有 cardIdx 髒
    ['emp', v=>({action:v}),'employee'],
    ['ghost',v=>({ghostAction:{type:v,targetId:v}}),'employee'],
    ['ghost',v=>({ghostAction:{type:'warn',targetId:v}}),'employee'],
  ];
  for(const v of ZOO) for(const [role,mk,pid] of shapes){
    const e=engine();
    const p=e.room.players.get('employee');
    if(role==='sup'){ p.isSupervisor=true; p.supTermLeft=2; e.room.supervisorId=p.id; }
    if(role==='ghost'){ p.alive=false; p.isGhost=true; p.ghostCooldown=0; }
    const h=seat(e,pid); chooseReady(e);
    assert.doesNotThrow(()=>h.submitChoice(mk(v),()=>{}),`${role} 收到 ${Object.prototype.toString.call(v)} 就炸了`);
    const dirty=impure(e.room);
    assert.deepEqual(dirty,[],`${role} 送 ${Object.prototype.toString.call(v)} 之後，房間狀態殘留：${dirty.join(', ')}`);
    // startGame 同一批值
    const g=engine({start:{rounds:v,threshold:v,bossMode:v,bossId:v,seniorityMode:v}});
    const gd=impure(g.room);
    assert.deepEqual(gd,[],`startGame 收到 ${Object.prototype.toString.call(v)} 之後殘留：${gd.join(', ')}`);
  }
});

test('a real function ack still gets its reply, before and after junk traffic',()=>{
  const {e,h}=junkEngine();
  const p=e.room.players.get('employee');
  e.room.phase='admin';p.role='emp';p.alive=true;
  // 註：ack 物件是在 vm realm 裡建的，deepStrictEqual 會因為 prototype 不同而失敗，逐欄比對
  let ok=null;h.drawRoundCards(x=>{ok=x;});
  assert.equal(ok&&ok.ok,true,'正常 ack 要收到 {ok:true}');
  h.drawRoundCards('hello');                                    // 中間插一個畸形封包
  let err=null;e.room.phase='reveal';h.drawRoundCards(x=>{err=x;});
  assert.equal(err&&err.error,'目前不能抽牌','畸形封包不得影響後續正常 ack');
  // 客戶端多塞參數（T4 寫手撞死伺服器的呼叫法 emit(ev,{},ack)）：真 ack 仍要接得回來
  let late=null;h.drawRoundCards({},x=>{late=x;});
  assert.equal(late&&late.error,'目前不能抽牌','ack 被擠到後面時要接回真的 ack');
});
test('payload-and-ack handlers survive junk in either slot',()=>{
  const {e,h}=junkEngine();
  const g=e.room.players.get('employee');
  g.alive=false;g.isGhost=true;g.ghostCooldown=0;e.room.hostId=g.id;
  e.api.enterChoose(e.room);e.room.choices={emp:{},boss:null,ghost:{}};
  assert.doesNotThrow(()=>h.submitChoice({ghostAction:{type:'haunt'}},'not-a-fn'),'ack 位是字串');
  assert.equal(e.room.choices.ghost[g.id].type,'haunt','ack 壞掉不影響 handler 本身的效果');
  assert.doesNotThrow(()=>h.submitChoice(null,null),'payload 給 null');
  let r=null;h.submitChoice({ghostAction:{type:'haunt'}},x=>{r=x;});
  assert.ok(r&&r.error,'正常 ack 照常收得到錯誤回應');
});
test('onNoAck keeps the payload of voice-signal intact',()=>{
  // voice-signal 的最後一個參數是 payload 不是 ack；用 on() 註冊會被換成 no-op，這裡守住
  const {e,h}=junkEngine();
  const orig=e.api.io.to;let seen=null;
  e.api.io.to=(to)=>({emit:(ev,payload)=>{seen={to,ev,payload};}});
  try{ h['voice-signal']({to:'peer1',data:{sdp:'X'}}); } finally { e.api.io.to=orig; }
  assert.equal(seen&&seen.to,'peer1');
  assert.equal(seen.payload.data.sdp,'X');
});
test('a handler that still throws is logged loudly instead of killing the process',()=>{
  // 保險層：正規化之後 handler 內部若仍丟例外，不吞掉——完整 stack 照樣印，只是不讓別人的房間陪葬
  const e=engine();
  const calls=[];const origErr=console.error;console.error=(...a)=>calls.push(a);
  let acked=null;
  try{
    const fake={id:'boom',on:(ev,fn)=>{fake[ev]=fn;}};
    const {on,onNoAck}=e.api.guardHandlers(fake);
    on('boom',(cb)=>{ throw new Error('handler 內部爆炸'); });
    onNoAck('boom2',()=>{ throw new Error('單向事件也爆炸'); });
    assert.doesNotThrow(()=>fake.boom(x=>{acked=x;}));
    assert.doesNotThrow(()=>fake.boom2());
  } finally { console.error=origErr; }
  assert.equal(calls.length,2,'兩次例外都要留下 log');
  assert.match(calls[0][0],/socket handler 例外 event=boom/);
  assert.equal(calls[0][1].message,'handler 內部爆炸','原始 Error 物件（含 stack）要原封不動交給 log');
  assert.ok(acked&&acked.error,'有 ack 的話要回錯誤，客戶端不會傻等');
});

test('story tells the ghost sub-plot when ghosts actually act',()=>{
  const e=engine();
  e.room.chronicle=[
    {round:2,type:'eliminated',name:'阿美',pid:'employee',cause:'anxiety',anxiety:6},
    {round:3,type:'ghost',kind:'haunt',name:'阿美',pid:'employee',detail:'頂樓'},
  ];
  const s=e.api.buildStory(e.room,'boss','業績達標',null,FAKE_KINGS);
  assert.match(s.join('\n'),/幽靈 阿美.*頂樓/);
});
