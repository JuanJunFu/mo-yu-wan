// Guided card flow: one decision and one personal result, with original artwork.
const focusLead = screenNode('div', 'focus-lead');
contextBand.after(focusLead);
const drawPanel = screenNode('div', 'draw-panel', $('admin'));
let drawKey = '', focusRoundKey = '', inspectedItem = null;
const skillDialog = screenNode('dialog', 'focus-dialog', document.body);
skillDialog.innerHTML = '<header><h2>角色技能（選用）</h2><button type="button">完成</button></header>';
skillDialog.querySelector('button').onclick = () => skillDialog.close();
skillDialog.append(tacticsPane);tacticsPane.classList.remove('pane-off');
const shopDialog = screenNode('dialog', 'focus-dialog', document.body);
shopDialog.innerHTML = '<header><h2>補給商店（選用）</h2><button type="button">返回抽牌</button></header>';
shopDialog.querySelector('button').onclick = () => shopDialog.close();
// C1｜「第一局」＝這台裝置的首次遊玩（localStorage），不是 round===1（零點數只證明開局買不起）。
// 這是**顯示層**的隱藏：server 的 buyCard／refillMarket 與 bot 老闆採購（server.js:707-710）完全不受影響。
// localStorage 不可用時 fail-open：當成已玩過 → 市場照開，不會因為隱私模式把功能弄丟。
const PLAYED_KEY='moyu_played_once';
function playedBefore(){try{return localStorage.getItem(PLAYED_KEY)==='1';}catch(e){return true;}}
function markPlayed(){try{localStorage.setItem(PLAYED_KEY,'1');}catch(e){}}
function shopVisible(){return playedBefore();}
function focusShop(){if(!shopVisible())return;shopDialog.append($('marketbox'));shopDialog.showModal();}
function streakLimit(){return (ST&&ST.workStreakLimit)||3;}
// 抽牌鈕與「開始選行動牌」鈕在 .draw-footer 的同一個位置換手（抽完就換人上場）。
// 手指連點兩下時，第二下會打到剛換上去的下一步鈕，把「看新抽到的牌」那一拍整個跳掉。
// 剛抽完的 600ms 內先擋下來，而且要明講原因——不是靜默吃掉（靜默＝又一個死點擊）。
const READY_AFTER_DRAW_MS=600;
let drawClickAt=0;
function focusDraw(){drawClickAt=Date.now();sock.emit('drawRoundCards', r=>{if(r?.error)err(r.error);});}
function focusReady(){
  if(Date.now()-drawClickAt<READY_AFTER_DRAW_MS)return err('剛抽到的牌先看一眼，再按「開始選行動牌」');
  sock.emit('practiceReady', r=>{if(r?.error)err(r.error);});
}
const skillsButton = screenNode('button','ghost',gameTools);
skillsButton.textContent='技能';skillsButton.onclick=()=>skillDialog.showModal();
const focusResult = screenNode('section', 'focus-result', $('reveal'));
const focusNext = screenNode('button','focus-next', $('reveal'));
focusNext.onclick=()=>sock.emit('nextRound');
// 揭曉收斂成單一路徑：① 演出（原版動畫板）→ ② 個人總結。
// screen.js 的「亮牌結果／地圖動畫」雙分頁在這裡關掉，避免同一畫面有兩條 render 路徑。
revealBoardPane.prepend($('revtitle').parentElement, $('revtoasts'));
$('reveal').querySelector('.screen-tabs').classList.add('pane-off');
$('nextbtn').classList.add('pane-off');$('waitnext').classList.add('pane-off');
let revealStage='summary', revealStageKey='', revealStageTimer=null;
function applyRevealStage(){
  const acting=revealStage==='act';
  revealTabs.select(1); // 只讓「演出」那一格有機會亮；亮牌分頁永遠關著
  revealBoardPane.classList.toggle('pane-off',!acting);
  focusResult.classList.toggle('pane-off',acting);
  focusNext.classList.toggle('pane-off',acting||!(ST&&ST.you&&ST.you.isHost));
}
// 同一回合只演一次：重複的 state 廣播、socket 重連、整頁重載都不再重播。
function revealSeen(){try{return sessionStorage.getItem('moyu_reveal_seen')||'';}catch(e){return '';}}
function markRevealSeen(k){try{sessionStorage.setItem('moyu_reveal_seen',k);}catch(e){}}
// ---- 💀 過勞猝死演出 ----
// 接在 T1 的 act 階段裡（不另開一條路）：地圖上的 💀 剛翻出來就蓋上這一幕，播完才切個人總結。
// 荒謬好笑是刻意的——猝死不是懲罰，是換跑道，所以最後一拍直接把新目標（👻 搞鬼王）講出來。
const karoshiScene=screenNode('div','karoshi-scene pane-off',$('reveal'));
karoshiScene.setAttribute('aria-live','polite');
const KAROSHI_MS=3600;   // 演出總長（需求：≥1500ms）
let karoshiTimers=[];
function kT(fn,ms){karoshiTimers.push(setTimeout(fn,ms));}
function clearKaroshi(){
  karoshiTimers.forEach(clearTimeout);karoshiTimers=[];
  karoshiScene.className='karoshi-scene pane-off';karoshiScene.innerHTML='';
}
// 回傳這一幕何時播完（距現在的毫秒）；0 ＝這回合猝死的不是你，不演。
function playKaroshi(){
  clearKaroshi();
  const r=ST&&ST.reveal;if(!r||!ST.you)return 0;
  const mine=r.results.find(x=>x.playerId===ST.you.id);
  if(!mine||!mine.suddenDeath)return 0;
  karoshiScene.innerHTML='<div class="kar-flash"></div><div class="kar-stage">'
    +'<div class="kar-avatar"><span class="kar-face">🧑‍💻</span><span class="kar-soul">👻</span></div>'
    +'<div class="kar-stamp">過 勞 死</div>'
    +'<ul class="kar-lines">'
    +`<li>你連續工作了 ${streakLimit()} 個回合。</li>`
    +'<li>滑鼠還在動，你已經不動了。</li>'
    +'<li>公司致贈：一朵花、一封罐頭慰問信，還有你沒休完的特休。</li>'
    +'</ul>'
    +'<div class="kar-turn">👻 換跑道成功！你現在可以爭 <b>搞鬼王</b><small>飄到天花板上扯老闆後腿、替同事通風報信——摸魚王是輪不到了，這頂還在。</small></div>'
    +'</div>';
  const start=Math.max(0,revAnimEndsAt-Date.now()-700);
  kT(()=>{
    karoshiScene.classList.remove('pane-off');
    kT(()=>karoshiScene.classList.add('beat1'),420);   // 印章砸下
    kT(()=>karoshiScene.classList.add('beat2'),1050);  // 三行遺言
    kT(()=>karoshiScene.classList.add('beat3'),2350);  // 換跑道
  },start);
  return start+KAROSHI_MS;
}
function revealAct(){
  if(revealStageTimer)clearTimeout(revealStageTimer);
  revealStage='act';applyRevealStage();
  const board=Math.max(800,revAnimEndsAt-Date.now());
  revealStageTimer=setTimeout(()=>{revealStageTimer=null;revealSummary();},Math.max(board,playKaroshi()));
}
function revealSummary(){
  if(revealStageTimer){clearTimeout(revealStageTimer);revealStageTimer=null;}
  clearKaroshi();
  revealStage='summary';applyRevealStage();
}
// 跳過＝把動畫瞬間播完（原版行為）再直接進個人總結；沿用原本那顆按鈕，不另開入口。
const focusSkipReveal=skipReveal;
skipReveal=function(){focusSkipReveal();revealSummary();};
function stampCharacter(role){return `<span class="story-portrait ${role}" aria-hidden="true"></span>`;}
function sign(n){return n>0?'+'+n:String(n);}
// ---- 四類卡面（藉口／干擾／增益／社交）----
// 四要素固定：圖（.cf-art）、名稱（.cf-name）、效果（.cf-effect）、使用時機（.cf-when）。
// 類別靠顏色＋徽章區分，不讀字也看得出來（cf-excuse / cf-jam / cf-buff / cf-social）。
function cardWhen(c,sel){
  const k=cardClass(c.type);
  if(c.kind!=='item') return '⚡ 自動觸發 · 被抓時替你擋下這一次';
  if(c.type==='mooch') return sel?'✓ 已搭配 · 記得在下面選一位隊友':k.when;
  return sel?'✓ 已搭配本回合行動':k.when;
}
function focusCardFace(c,i){
  const k=cardClass(c.type), item=c.kind==='item', sel=selCard===i;
  return `<button type="button" class="focus-card cf-${k.cls}${sel?' selected':''}${item?'':' cf-auto'}" onclick="focusItem(${i})" aria-pressed="${sel}">`
    +`<span class="cf-kind">${k.badge} ${k.label}</span>`
    +`<span class="cf-art" aria-hidden="true">${c.icon}</span>`
    +`<span class="cf-name">${esc(c.name)}</span>`
    +`<span class="cf-effect">${esc(String(c.desc||'').replace('出牌：',''))}</span>`
    +`<span class="cf-when">${esc(cardWhen(c,sel))}</span>`
    +'</button>';
}
// draw-footer 右邊那顆是整個畫面最大的按鈕（實測 400×46）。舊版在還沒抽牌時把它鎖住、
// 文案卻寫「先抽牌」——讀起來像 CTA，但 disabled 的表單控制項連 click 事件都不派送
// （實測：程式 .click() 與真實點擊都沒有任何事件、狀態、提示），玩家等於按到一顆死鈕。
// 改法：還沒抽就讓它「真的去抽」，跟中間那疊牌堆共用同一個 focusDraw()，抽完才換成下一步。
// server.js:1301-1305 的 drawRoundCards 不看 adminReady，所以老闆還在準備時抽牌也是合法的；
// 「老闆準備中…」那個 disabled 留著不動——那是真的沒事可做的合理等待。
function footerStep(drawn,you){
  if(!drawn&&you.alive)
    return `<button type="button" onclick="focusDraw()">${you.drawCount>0?'抽 '+you.drawCount+' 張道具牌':'確認目前手牌'}</button>`;
  return `<button type="button" onclick="focusReady()" ${ST.adminReady?'':'disabled'}>${ST.adminReady?'看懂了，開始選行動牌 →':'老闆準備中…'}</button>`;
}
function paintDraw(){
  const you=ST.you;if(you.role!=='emp')return;
  if(!you.alive){
    drawPanel.innerHTML=`<div class="draw-intro"><span class="step-kicker">幽靈回合</span><h2>你已出局，但還能幫同事</h2><p>你不再抽牌或工作。可作祟干擾老闆，也可以略過這回合。</p></div><div class="ghost-portrait-large">${stampCharacter('ghost')}</div><div class="draw-footer"><button type="button" onclick="focusReady()" ${ST.adminReady?'':'disabled'}>${ST.adminReady?'開始幽靈回合 →':'老闆準備中…'}</button></div>`;return;
  }
  const drawn=you.drawnThisRound, cards=you.roundDraw||[];
  const key=ST.code+':'+ST.round+':'+drawn+':'+ST.adminReady+':'+you.drawCount+':'+you.hand.length;
  if(key===drawKey)return;drawKey=key;
  // 新抽到的牌也走四類卡面：類別徽章＋圖＋名稱＋效果＋使用時機（藉口卡的「自動觸發」在這裡就要講死）
  const newCard=c=>{const k=cardClass(c.type);
    return `<article class="new-card cf-${k.cls}${c.kind==='item'?'':' cf-auto'}"><span class="cf-kind">${k.badge} ${k.label}</span><div class="new-card-art">${c.icon}</div><h3>${esc(c.name)}</h3><p>${esc(String(c.desc||'').replace('出牌：',''))}</p><span class="cf-when">${esc(cardWhen(c,false))}</span></article>`;};
  // 過勞警告已經在 #econbox 那條橫幅上（renderEcon → overworkWarning），這裡只在還沒進入危險區時提醒一次，避免同一句講兩遍
  const danger=(you.workStreak||0)>=streakLimit()-1;
  drawPanel.innerHTML=`<div class="draw-intro"><span class="step-kicker">第 ${ST.round} 回合 · ① 抽牌</span><h2>${drawn?(cards.length?'你的新手牌':'本回合手牌已備妥'):'先抽道具，再決定怎麼摸魚'}</h2><p>${ST.round===1?'目標：撐到下班，賺最多點數。摸魚會增加心悸，工作可以降心悸。':'每回合補 1 張道具，最多保留 3 張。行動牌可重複使用。'}</p></div>`
    +(drawn?`<div class="drawn-hand">${cards.length?cards.map(newCard).join(''):`<div class="draw-empty">${you.hand.length>=3?'手牌已滿，不會多抽或丟棄你的牌。':'這副道具牌已抽完，可使用目前的手牌。'}</div>`}</div>`
    :`<button class="draw-deck" type="button" onclick="focusDraw()"><span class="deck-emblem">✦</span><strong>${you.drawCount>0?'抽 '+you.drawCount+' 張道具牌':'確認目前手牌'}</strong><span>點擊牌堆翻開 · 每回合一次</span></button>`)
    +(danger?'':`<p class="overwork-rule">⚠ 連續工作 ${streakLimit()} 回合會過勞猝死，變成幽靈。休息或摸魚可中斷。</p>`)
    +`<div class="draw-footer">${shopVisible()?'<button class="ghost" type="button" onclick="focusShop()">補給商店（選用）</button>':'<span class="draw-hint">第一局先專心摸魚就好。</span>'}${ST.solo?footerStep(drawn,you):'<span>抽完後，等待老闆開始回合。</span>'}</div>`;
}
function paintFocusHand(){
  const you=ST.you;
  $('handbox').innerHTML='<div class="focus-hand-heading">搭配道具 <small>選用 1 張；🛡️ 藉口卡會自己跳出來</small><button type="button" class="inline-skills" onclick="skillDialog.showModal()">角色技能</button></div><div class="focus-hand">'
    +(you.hand.length?you.hand.map(focusCardFace).join(''):'<span class="empty-hand">沒有道具也能出行動牌。</span>')+'</div>';
  // 🤝 社交卡（mooch）一定要標示目標：server.js:1077-1081 沒帶 cardTarget 會被退回
  if(you.hand[selCard]?.type==='mooch'){
    const mates=ST.players.filter(p=>p.id!==you.id&&p.role==='emp'&&p.alive);
    $('handbox').innerHTML+='<div class="target-chips"><span>🎯 凹哪位同事？</span>'
      +(mates.length?mates.map(p=>`<button type="button" onclick="setMooch('${p.id}')" aria-pressed="${moochTarget===p.id}">${esc(p.name)}</button>`).join('')
        :'<em>目前沒有可凹的同事，這張打不出去。</em>')+'</div>';
  }
}
function focusItem(i){
  const c=ST.you.hand[i];if(!c)return;
  inspectedItem=i;
  if(c.kind==='item'&&!ST.you.submitted)toggleCard(i);
  else {paintFocusHand();paintPreview();}
}
function paintPreview(){
  const you=ST.you,c=empPick&&actionCards.find(c=>c.id===(empPick.action==='slack'?empPick.zone:empPick.action));
  const item=selCard!=null?you.hand[selCard]:null, inspect=you.hand[inspectedItem];
  let main='選一張行動牌，這裡會告訴你它的效果。', detail='';
  if(c){
    if(empPick.action==='slack'){
      const z=ST.zones[c.id];const base=Math.max(0,z.slack+(you.seniority==='senior'?-1:1));
      main=`去${c.short}：成功可得 ${base} 點，心悸 +${z.anxiety}。`;
      detail='被老闆抓到，這次摸魚不計分，並增加心悸。';
    }else if(empPick.action==='work') {main='認真工作：薪水 +1，心悸 −1。';detail=you.task?'任務進度 +2；不計摸魚次數。':'本回合安全，不計摸魚次數。';}
    else {main='回座休息：心悸 −1，不會被抓。';detail='不加分，也不計摸魚次數。';}
  }
  if(item)detail=`搭配「${item.name}」：${item.desc.replace('出牌：','')}`;
  else if(inspect)detail=`「${inspect.name}」：${inspect.desc}`;
  if(riskyOn&&empPick?.action==='slack')detail+=' 已啟用拼命：符合條件時成功分數加倍、心悸額外 +2。';
  if(you.overtime&&empPick?.action==='work'){main='加班工作：薪水 +2，心悸 +1。';detail='本次是加班，心悸不會下降。';}
  if(empPick?.action==='work'){
    if(you.workStreak>=streakLimit()-1){main='⚠ 再工作就會過勞猝死，立刻轉為幽靈。';detail=`你已連續工作 ${you.workStreak||0} 回合。改選休息或摸魚即可中斷；免死金牌無法抵擋。`;}
    else detail+=` 這是連續工作第 ${(you.workStreak||0)+1} 次，連做 ${streakLimit()} 次會猝死。`;
  }
  $('play-slot').innerHTML=`<strong>${you.submitted?'✓ 已蓋牌。':main}</strong><small>${you.submitted?'等待其他玩家；全員交齊後揭曉。':detail||'還沒有送出，選好後再按右側出牌。'}</small>`;
  // 選牌屏的同一個病：還沒選行動牌時，index.html:759/765 把這顆鈕設成 disabled，
  // 文案卻是像 CTA 的「先選行動牌」——按下去沒有事件、沒有提示（實測 clicks=0、err 為空）。
  // 改法：① 文案直接指路（⬆ 上面的行動牌），讓它讀起來是狀態不是動作；
  //       ② 讓它可以按——按下去由 submitEmp 把行動牌區高亮＋捲進視線，並補一則錯誤訊息。
  const needPick=!c&&!you.submitted;
  $('empsubmit').textContent=you.submitted?'更新出牌':empPick?.action==='work'&&you.workStreak>=streakLimit()-1?'仍要工作（會猝死）':c?'確認出「'+c.short+'」':'⬆ 先選上面的行動牌';
  if(needPick)$('empsubmit').disabled=false;
  $('empsubmit').classList.toggle('needs-pick',needPick);
  $('play-slot').classList.toggle('lethal',empPick?.action==='work'&&you.workStreak>=streakLimit()-1);
}
const focusEmpRender=renderEmpZones;
renderEmpZones=function(){
  focusEmpRender();emp.classList.add('focus-employee');
  actionPane.classList.remove('pane-off');tricksPane.classList.remove('pane-off');
  paintFocusHand();paintPreview();
  renderEcon(); // 過勞警告橫幅要跟著「目前選了哪張」更新（pickEmp 只會叫 renderEmpZones）
  const lim=streakLimit(), lethal=ST.you.workStreak>=lim-1;
  $('empzones').querySelectorAll('button').forEach((b,i)=>{
    const c=actionCards[i];b.querySelector('.card-art').classList.add('scene-art','scene-'+c.id);
    b.querySelector('.card-art').textContent='';
    const note=b.querySelector('.card-bottom');note.textContent=b.disabled?'本回合不可用':b.classList.contains('selected')?'✓ 已選，尚未送出':'點選查看效果';
    if(c.id==='work'){b.classList.toggle('lethal',lethal);b.querySelector('.card-effect').textContent=lethal?'⚠ 再工作就猝死':`薪水 +1 · 心悸 −1（連做 ${ST.you.workStreak||0}/${lim}）`;}
    // 休息永遠合法（server.js:1083），加班令下也是——過勞時把它標成出口，別讓玩家以為只剩工作可選
    if(c.id==='idle')b.classList.toggle('escape',lethal);
  });
};
const focusToggle=toggleCard;
toggleCard=function(i){focusToggle(i);paintFocusHand();paintPreview();};
// 沒選行動牌就按送出＝把視線帶回行動牌區（閃兩下＋捲進畫面）；錯誤訊息照舊由 submitEmp
// 本體發（index.html:561 的 err('先選這回合要去哪／做什麼')），所以一定看得到回饋。
// prefers-reduced-motion 會被 cards.css:18 關掉動畫，那時剩下的錯誤訊息仍在。
function nudgePickAction(){
  const zones=$('empzones');if(!zones)return;
  zones.classList.remove('nudge');void zones.offsetWidth;zones.classList.add('nudge');
  zones.scrollIntoView({block:'nearest'});
}
const focusSubmitEmp=submitEmp;
submitEmp=function(){if(!empPick)nudgePickAction();focusSubmitEmp();};
function resultSide(role,label,main,sub){
  return `<div>${stampCharacter(role)}<span>${label}</span><strong>${esc(main)}</strong>${sub?`<small>${esc(sub)}</small>`:''}</div>`;
}
// 誰、在哪、結果各一行：老闆／幽靈看的是「現場發生什麼」，不是一整段密文字。
function resultRoster(r){
  if(!r.results.length)return '<p class="result-explain">這回合沒有員工行動。</p>';
  return '<ul class="result-roster">'+r.results.map(x=>{
    const[txt,color]=outcomeIcon(x);
    const where=x.working?'💼 認真工作':x.supervisor?'🕵️ 協查':`${ZI[x.zone]||'🏢'} ${x.zoneName}`;
    return `<li class="${color}${x.playerId===ST.you.id?' self':''}"><span class="rr-who">${x.supervisor?'🕵️':x.seniority==='senior'?'🦉':'🐣'} ${esc(x.name)}</span><span class="rr-where">${esc(where)}</span><span class="rr-what">${esc(txt)}</span></li>`;
  }).join('')+'</ul>';
}
function paintPersonalResult(){
  const r=ST.reveal;if(!r)return;
  const you=ST.you, mine=r.results.find(x=>x.playerId===you.id);
  // 一回合只演一次：換回合才重新編排；重複廣播／重連／重整都走「補完＋直接看結果」。
  const key=ST.code+':'+r.round;
  if(key!==revealStageKey){
    revealStageKey=key;
    if(revealSeen()===key)skipReveal();
    else{markRevealSeen(key);revealAct();}
  }
  const patrol=r.bossZones.join('、')||'本回合沒巡查', supNote=r.supZone?`主管協查 ${r.supZone}`:'';
  const threshold=`門檻 ${Math.round(ST.completeThreshold*100)}%`;
  let title,match,body;
  if(mine){
    // caught 為 'held'/'excused'/'warned'/'guarded'/'blocked' 時是「被抓但擋下來」，
    // 不能跟著沒被巡到的情況一起講「安全度過」，否則玩家看不懂自己剛剛多驚險。
    title=mine.suddenDeath?'過勞猝死，變成幽靈了':mine.eliminated?'心悸爆表，變成幽靈了':mine.caught===true?'被老闆抓到了':mine.caught?'差一點！這次擋下來了':mine.gain!=null?'摸魚成功！':mine.working?'工作完成，領到薪水':mine.supervisor?'協查完成':'這回合安全度過';
    const action=mine.working?'埋頭苦幹':mine.action==='idle'?'回座喘口氣':mine.zoneName;
    match=resultSide(you.isGhost?'ghost':'employee','你出的牌',action,mine.item?`搭配 ${mine.item}`:'')
      +'<span class="versus">VS</span>'+resultSide('boss','老闆巡查',patrol,supNote);
    body=`<div class="result-totals"><div><span>你的點數</span><strong>${sign(mine.pointsDelta??0)}</strong><small>現在 ${mine.pointsAfter} 點</small></div><div><span>你的心悸</span><strong>${sign(mine.anxietyDelta??0)}</strong><small>現在 ${mine.anxietyAfter} / ${ST.anxietyOut}</small></div></div><p class="result-explain">${esc(mine.note)}</p>`;
    // 出局＝換跑道，不是被罰坐板凳。演出播完後，個人總結這裡再把新目標釘死一次。
    if(mine.eliminated)body+=`<div class="result-turn">👻 <b>不是出局，是換跑道。</b>${mine.suddenDeath?'你被自己的認真殺死了；':''}你現在是幽靈：不抽牌、不計分，但每 2 回合能作祟一次（扯老闆後腿 · 打斷協查 · 替同事通風報信）。<b>你現在可以爭 👻 搞鬼王。</b></div>`;
  }else if(you.role==='boss'){
    // 老闆不在 results 裡（server.js resolveRound 只跑 aliveEmps），所以另外算「我巡到了什麼」。
    const caught=r.results.filter(x=>x.caught===true), slipped=r.results.filter(x=>x.caught&&x.caught!==true);
    const slackers=r.results.filter(x=>!x.supervisor&&x.zone&&x.zone!=='office');
    const working=r.results.filter(x=>x.working).length, resting=r.results.filter(x=>!x.working&&!x.supervisor&&x.zone==='office').length;
    const spread={};for(const x of r.results){const k=x.working?'💼':x.supervisor?'🕵️':(ZI[x.zone]||'🏢');spread[k]=(spread[k]||0)+1;}
    title=caught.length?`抓到 ${caught.length} 個！`:slipped.length?`差一點…${slipped.length} 人溜掉了`:slackers.length?'撲了個空，他們摸魚成功':'沒人敢摸魚，全員都在位子上';
    match=resultSide('boss','你巡查的地方',patrol,supNote||'沒有主管協查')
      +'<span class="versus">VS</span>'
      +resultSide('employee','員工實際去了',Object.entries(spread).map(([k,v])=>k+'×'+v).join(' ')||'沒有員工行動',`摸魚 ${slackers.length} · 工作 ${working} · 休息 ${resting}`);
    body=`<div class="result-totals"><div><span>當場抓到</span><strong>${caught.length}</strong><small>被擋掉／躲掉 ${slipped.length} 人</small></div><div><span>任務完成率</span><strong>${r.rate}%</strong><small>${threshold}</small></div></div>`+resultRoster(r);
  }else{
    // 幽靈／已出局：也不在 results 裡，給的是「現場發生什麼」而不是個人損益。
    const aliveMates=ST.players.filter(p=>p.role==='emp'&&p.alive).length;
    title='幽靈視角：這回合的現場';
    match=resultSide('ghost','你的狀態','幽靈（不抽牌、不計分）',you.ghostActed?'本回合已作祟':'本回合沒作祟')
      +'<span class="versus">VS</span>'+resultSide('boss','老闆巡查',patrol,supNote);
    body=`<div class="result-totals"><div><span>還活著的同事</span><strong>${aliveMates}</strong><small>這回合 ${r.results.length} 人行動</small></div><div><span>任務完成率</span><strong>${r.rate}%</strong><small>${threshold}</small></div></div>`+resultRoster(r);
  }
  focusResult.innerHTML=`<div class="result-heading"><span class="step-kicker">③ 揭曉 · 第 ${r.round} 回合</span><h2>${esc(title)}</h2></div><div class="result-match">${match}</div>`
    +body
    +'<button type="button" class="ghost result-details" onclick="openReader(\'完整結算\', document.getElementById(\'revlist\').textContent)">查看完整結算紀錄</button>';
  focusNext.disabled=!ST.solo&&Date.now()<ST.revealSkipAt;
  focusNext.textContent=ST.round>=ST.rounds||!ST.players.some(p=>p.role==='emp'&&p.alive)?'看懂了，查看本局結果':'看懂了，進入下一回合 →';
  applyRevealStage();
}
const focusRender=render;
render=function(){
  focusRender();if(!ST)return;
  // 疊加順序的坑：renderEmpZones（開分頁）是在 screen.js 的 render 本體之前跑的，
  // 而 screen.js 換回合時會 empTabs.select(0) 把「道具牌」那格關回去。單決策層沒有分頁，
  // 所以在最外層再開一次；不這樣做，回合第一次 render（含中途重整）手牌會整區消失。
  if(!emp.classList.contains('hide')){actionPane.classList.remove('pane-off');tricksPane.classList.remove('pane-off');}
  const you=ST.you;document.body.classList.toggle('focus-game',!['lobby','ended'].includes(ST.phase));
  const current=ST.code+':'+ST.round;
  if(current!==focusRoundKey){drawKey='';inspectedItem=null;focusRoundKey=current;}
  skillsButton.classList.toggle('pane-off',ST.phase!=='choosing'||you.role!=='emp');
  const drawMode=ST.phase==='admin'&&you.role==='emp';
  $('admin').classList.toggle('focus-draw',drawMode);drawPanel.classList.toggle('pane-off',!drawMode);
  if(drawMode)paintDraw();
  if(you.role==='boss'&&$('marketbox').parentElement===shopDialog)$('admin').prepend($('marketbox'));
  if(ST.phase!=='admin'&&shopDialog.open)shopDialog.close();
  if(ST.phase!=='choosing'&&skillDialog.open)skillDialog.close();
  focusLead.innerHTML=ST.phase==='choosing'?`<div><span class="step-kicker">② 選牌</span><strong>${you.isGhost?'你是幽靈，可以作祟幫助同事。':you.isSupervisor?'你是主管，這回合選擇要不要協查。':you.role==='boss'?'選 '+ST.bossInspect+' 張巡查牌，猜員工躲在哪裡。':'選 1 張行動牌，再按「確認出牌」。'}</strong></div><span>${ST.solo?'練習不倒數 · 慢慢選': '所有人出牌後一起揭曉'}</span>`:'';
  focusLead.classList.toggle('pane-off',ST.phase!=='choosing');
  if(ST.solo)$('timer').classList.add('hide');
  if(you.role==='emp')$('mystats').innerHTML=`<span>點數 <b>${you.points}</b></span><span>心悸 <b>${you.anxiety}/${ST.anxietyOut}</b></span><span class="${you.workStreak>=streakLimit()-1?'work-danger':''}">連做 <b>${you.workStreak||0}/${streakLimit()}</b></span>`;
  if(ST.phase==='ended')markPlayed(); // 打完一整局才算「玩過」＝第二局起才開補給市場（C1 的首次遊玩判定）
  paintStreakNotes();
  // 再玩一局會重用房號＋回合數（server.js restart：round 歸 0），三個去重記號都要跟著歸零，
  // 否則新的第 1 回合會被當成「播過了」而直接跳到總結，還會留著上一局的舊演出畫面。
  if(ST.phase==='lobby'){markRevealSeen('');revealStageKey='';revAnimKey=null;}
  if(ST.phase==='reveal')paintPersonalResult();
  else if(revealStage!=='summary')revealSummary(); // 離開揭曉就收掉待播的演出計時器
  if(ST.solo&&ST.phase==='choosing'&&you.isGhost){
    const skip=screenNode('button','ghost', $('ghostchoose'));skip.textContent='不作祟，觀看揭曉 →';skip.onclick=()=>sock.emit('practiceGhostPass',r=>{if(r?.error)err(r.error);});
  }
  document.querySelectorAll('.seat').forEach((n,i)=>{const p=ST.players[i];if(p)n.insertAdjacentHTML('afterbegin',stampCharacter(p.isGhost?'ghost':p.role==='boss'?'boss':'employee'));});
};
// Keep the multiplayer host's reveal button in sync without repainting the result.
setInterval(()=>{if(ST?.phase==='reveal'&&!ST.solo)focusNext.disabled=Date.now()<ST.revealSkipAt;},500);
// Original illustrated cover includes employee, boss and ghost; show it intact.
const menuArt=screenNode('div','menu-story-art');modeMenu.prepend(menuArt);
menuArt.setAttribute('role','img');menuArt.setAttribute('aria-label','原作繪本插畫：員工、老闆與幽靈');
// 猝死上限一律讀 ST.workStreakLimit；腳本載入時 ST 還是 null（狀態靠 socket 後到），所以每次 render 再補寫一次。
const streakNotes=['rules-home','rules-lobby'].map(id=>{const note=document.createElement('p');$(id).append(note);return note;});
function paintStreakNotes(){
  const txt=`卡牌版新規則：首回合抽 2 張道具，之後每回合補 1 張（上限 3 張）。單人練習不倒數，手動開始和繼續。連續工作 ${streakLimit()} 回合會過勞猝死，立即變成幽靈；免死金牌不適用。休息、摸魚或協查會中斷連續工作。`;
  for(const n of streakNotes)if(n.textContent!==txt)n.textContent=txt;
}
paintStreakNotes();
if(ST)render();
