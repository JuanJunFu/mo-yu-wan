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
function focusShop(){shopDialog.append($('marketbox'));shopDialog.showModal();}
function focusDraw(){sock.emit('drawRoundCards', r=>{if(r?.error)err(r.error);});}
function focusReady(){sock.emit('practiceReady', r=>{if(r?.error)err(r.error);});}
const skillsButton = screenNode('button','ghost',gameTools);
skillsButton.textContent='技能';skillsButton.onclick=()=>skillDialog.showModal();
const focusResult = screenNode('section', 'focus-result', $('reveal'));
const focusNext = screenNode('button','focus-next', $('reveal'));
focusNext.onclick=()=>sock.emit('nextRound');
function stampCharacter(role){return `<span class="story-portrait ${role}" aria-hidden="true"></span>`;}
function sign(n){return n>0?'+'+n:String(n);}
function paintDraw(){
  const you=ST.you;if(you.role!=='emp')return;
  if(!you.alive){
    drawPanel.innerHTML=`<div class="draw-intro"><span class="step-kicker">幽靈回合</span><h2>你已出局，但還能幫同事</h2><p>你不再抽牌或工作。可作祟干擾老闆，也可以略過這回合。</p></div><div class="ghost-portrait-large">${stampCharacter('ghost')}</div><div class="draw-footer"><button type="button" onclick="focusReady()" ${ST.adminReady?'':'disabled'}>${ST.adminReady?'開始幽靈回合 →':'老闆準備中…'}</button></div>`;return;
  }
  const drawn=you.drawnThisRound, cards=you.roundDraw||[];
  const key=ST.code+':'+ST.round+':'+drawn+':'+ST.adminReady+':'+you.drawCount+':'+you.hand.length;
  if(key===drawKey)return;drawKey=key;
  drawPanel.innerHTML=`<div class="draw-intro"><span class="step-kicker">第 ${ST.round} 回合 · ① 抽牌</span><h2>${drawn?(cards.length?'你的新手牌':'本回合手牌已備妥'):'先抽道具，再決定怎麼摸魚'}</h2><p>${ST.round===1?'目標：撐到下班，賺最多點數。摸魚會增加心悸，工作可以降心悸。':'每回合補 1 張道具，最多保留 3 張。行動牌可重複使用。'}</p></div>`
    +(drawn?`<div class="drawn-hand">${cards.length?cards.map(c=>`<article class="new-card"><span class="step-kicker">${c.kind==='item'?'搭配行動使用':'被抓時自動使用'}</span><div class="new-card-art">${c.icon}</div><h3>${esc(c.name)}</h3><p>${esc(c.desc)}</p></article>`).join(''):`<div class="draw-empty">${you.hand.length>=3?'手牌已滿，不會多抽或丟棄你的牌。':'這副道具牌已抽完，可使用目前的手牌。'}</div>`}</div>`
    :`<button class="draw-deck" type="button" onclick="focusDraw()"><span class="deck-emblem">✦</span><strong>${you.drawCount>0?'抽 '+you.drawCount+' 張道具牌':'確認目前手牌'}</strong><span>點擊牌堆翻開 · 每回合一次</span></button>`)
    +`<p class="overwork-rule">⚠ 連續工作 3 回合會過勞猝死，變成幽靈。休息或摸魚可中斷。</p><div class="draw-footer"><button class="ghost" type="button" onclick="focusShop()">補給商店（選用）</button>${ST.solo?`<button type="button" onclick="focusReady()" ${(!drawn&&you.alive)||!ST.adminReady?'disabled':''}>${!drawn&&you.alive?'先抽牌':!ST.adminReady?'老闆準備中…':'看懂了，開始選行動牌 →'}</button>`:'<span>抽完後，等待老闆開始回合。</span>'}</div>`;
}
function paintFocusHand(){
  const you=ST.you;
  $('handbox').innerHTML='<div class="focus-hand-heading">搭配道具 <small>選用 1 張；不選也能出牌</small><button type="button" class="inline-skills" onclick="skillDialog.showModal()">角色技能</button></div><div class="item-chips">'+(you.hand.length?you.hand.map((c,i)=>`<button type="button" class="item-chip ${selCard===i?'selected':''}" onclick="focusItem(${i})" aria-pressed="${selCard===i}"><span>${c.icon}</span>${esc(c.name)}<small>${c.kind==='item'?(selCard===i?'已搭配':'點選搭配'):'自動保護'}</small></button>`).join(''):'<span class="empty-hand">沒有道具也能出行動牌。</span>')+'</div>';
  if(you.hand[selCard]?.type==='mooch')$('handbox').innerHTML+='<div class="target-chips"><span>凹哪位同事？</span>'+ST.players.filter(p=>p.id!==you.id&&p.role==='emp'&&p.alive).map(p=>`<button type="button" onclick="setMooch('${p.id}')" aria-pressed="${moochTarget===p.id}">${esc(p.name)}</button>`).join('')+'</div>';
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
    if(you.workStreak>=ST.workStreakLimit-1){main='⚠ 再工作就會過勞猝死，立刻轉為幽靈。';detail='你已連續工作 2 回合。改選休息或摸魚即可中斷；免死金牌無法抵擋。';}
    else detail+=` 這是連續工作第 ${(you.workStreak||0)+1} 次，連做 ${ST.workStreakLimit} 次會猝死。`;
  }
  $('play-slot').innerHTML=`<strong>${you.submitted?'✓ 已蓋牌。':main}</strong><small>${you.submitted?'等待其他玩家；全員交齊後揭曉。':detail||'還沒有送出，選好後再按右側出牌。'}</small>`;
  $('empsubmit').textContent=you.submitted?'更新出牌':empPick?.action==='work'&&you.workStreak>=ST.workStreakLimit-1?'仍要工作（會猝死）':c?'確認出「'+c.short+'」':'先選行動牌';
  $('play-slot').classList.toggle('lethal',empPick?.action==='work'&&you.workStreak>=ST.workStreakLimit-1);
}
const focusEmpRender=renderEmpZones;
renderEmpZones=function(){
  focusEmpRender();emp.classList.add('focus-employee');
  actionPane.classList.remove('pane-off');tricksPane.classList.remove('pane-off');
  paintFocusHand();paintPreview();
  $('empzones').querySelectorAll('button').forEach((b,i)=>{
    const c=actionCards[i];b.querySelector('.card-art').classList.add('scene-art','scene-'+c.id);
    b.querySelector('.card-art').textContent='';
    const note=b.querySelector('.card-bottom');note.textContent=b.disabled?'本回合不可用':b.classList.contains('selected')?'✓ 已選，尚未送出':'點選查看效果';
    if(c.id==='work'){b.classList.toggle('lethal',ST.you.workStreak>=ST.workStreakLimit-1);b.querySelector('.card-effect').textContent=ST.you.workStreak>=ST.workStreakLimit-1?'⚠ 再工作就猝死':`薪水 +1 · 心悸 −1（連做 ${ST.you.workStreak||0}/3）`;}
  });
};
const focusToggle=toggleCard;
toggleCard=function(i){focusToggle(i);paintFocusHand();paintPreview();};
function paintPersonalResult(){
  const r=ST.reveal;if(!r)return;
  const mine=r.results.find(x=>x.playerId===ST.you.id);
  $('reveal').classList.add('focus-revealing');
  let title='本回合已結算',action='巡查 '+(r.bossZones.join('、')||'無'),explain='';
  if(mine){
    title=mine.suddenDeath?'過勞猝死，變成幽靈了':mine.eliminated?'心悸爆表，變成幽靈了':mine.caught===true?'被老闆抓到了':mine.gain!=null?'摸魚成功！':mine.working?'工作完成，領到薪水':mine.supervisor?'協查完成':'這回合安全度過';
    action=mine.working?'埋頭苦幹':mine.action==='idle'?'回座喘口氣':mine.zoneName;
    explain=mine.note;
  }
  focusResult.innerHTML=`<div class="result-heading"><span class="step-kicker">③ 揭曉 · 第 ${r.round} 回合</span><h2>${title}</h2></div><div class="result-match"><div>${stampCharacter(ST.you.isGhost?'ghost':ST.you.role==='boss'?'boss':'employee')}<span>你出的牌</span><strong>${esc(action)}</strong>${mine?.item?`<small>搭配 ${esc(mine.item)}</small>`:''}</div><span class="versus">VS</span><div>${stampCharacter('boss')}<span>老闆巡查</span><strong>${esc(r.bossZones.join('、')||'本回合未巡查')}</strong></div></div>`
    +(mine?`<div class="result-totals"><div><span>你的點數</span><strong>${sign(mine.pointsDelta??0)}</strong><small>現在 ${mine.pointsAfter} 點</small></div><div><span>你的心悸</span><strong>${sign(mine.anxietyDelta??0)}</strong><small>現在 ${mine.anxietyAfter} / ${ST.anxietyOut}</small></div></div><p class="result-explain">${esc(explain)}</p>`:`<p class="result-explain">${esc(r.results.map(x=>x.name+'：'+x.note).join('；'))}</p>`)
    +'<button type="button" class="ghost result-details" onclick="openReader(\'完整結算\', document.getElementById(\'revlist\').textContent)">查看其他玩家與完整紀錄</button>';
  focusNext.classList.toggle('pane-off',!ST.you.isHost);
  focusNext.disabled=!ST.solo&&Date.now()<ST.revealSkipAt;
  focusNext.textContent=ST.round>=ST.rounds||!ST.players.some(p=>p.role==='emp'&&p.alive)?'看懂了，查看本局結果':'看懂了，進入下一回合 →';
}
const focusRender=render;
render=function(){
  focusRender();if(!ST)return;
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
  if(you.role==='emp')$('mystats').innerHTML=`<span>點數 <b>${you.points}</b></span><span>心悸 <b>${you.anxiety}/${ST.anxietyOut}</b></span><span class="${you.workStreak>=2?'work-danger':''}">連做 <b>${you.workStreak||0}/3</b></span>`;
  if(ST.phase==='reveal')paintPersonalResult();
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
for(const id of ['rules-home','rules-lobby']){
  const note=document.createElement('p');note.textContent='卡牌版新規則：首回合抽 2 張道具，之後每回合補 1 張（上限 3 張）。單人練習不倒數，手動開始和繼續。連續工作 3 回合會過勞猝死，立即變成幽靈；免死金牌不適用。休息、摸魚或協查會中斷連續工作。';$(id).append(note);
}
if(ST)render();
