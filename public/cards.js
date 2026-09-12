/* Reuse authoritative Socket.IO rules; replace choice tiles with a card table. */
const actionCards = [
  {id:'work',name:'假裝很忙？認真忙。',short:'埋頭苦幹',icon:'💼',effect:'薪水 +1 · 心悸 −1',note:'有任務時，進度 +2',kind:'工作'},
  {id:'idle',name:'辦公室避風港',short:'回座喘口氣',icon:'🌿',effect:'心悸 −1 · 不會被抓',note:'本回合不獲得摸魚次數',kind:'休息'},
  {id:'tea',name:'咖啡還沒泡好',short:'茶水間',icon:'☕',kind:'摸魚'},
  {id:'copy',name:'印表機又卡紙',short:'影印間',icon:'🖨️',kind:'摸魚'},
  {id:'toilet',name:'帶薪上廁所',short:'廁所',icon:'🧻',kind:'摸魚'},
  {id:'roof',name:'頂樓放空計畫',short:'頂樓',icon:'🌤️',kind:'摸魚'}
];
function cardMarkup({name,icon,kind,effect,note,selected=false,disabled=false,click='',tone=''}){
  return `<button type="button" class="playing-card ${tone} ${selected?'selected':''}" ${disabled?'disabled':''} ${click?`onclick="${click}"`:''} aria-pressed="${selected}"><span class="card-top"><span>${esc(kind)}</span><span>✦</span></span><span class="card-art" aria-hidden="true">${icon}</span><strong>${esc(name)}</strong><span class="card-effect">${esc(effect||'')}</span><span class="card-bottom">${esc(note||'摸魚王 / OFFICE CARDS')}</span></button>`;
}
$('hdr').innerHTML='<h1>摸魚王 <span style="font-size:12px;letter-spacing:1px;color:#b5c5af">卡牌版</span></h1><div class="jp">OFFICE POLITICS · CARD GAME</div>';
const hero=document.createElement('section');hero.className='hero';
hero.innerHTML='<div class="eyebrow">01 / 下班前的心理戰</div><h2>工作可以等。<br>這張牌，不能亂出。</h2><p>在老闆眼皮底下，打好你的小算盤。<br>暗出行動、搭配道具，成為最後的摸魚王。</p><div class="hero-cards">'+cardMarkup({name:'帶薪上廁所',icon:'🧻',kind:'行動卡',effect:'高報酬，也有高風險',note:'03 / 摸魚'})+cardMarkup({name:'肚子痛先閃',icon:'🗣️',kind:'藉口卡',effect:'被抓時，自動擋下這一次',note:'防禦 / 自動觸發',tone:'passive'})+cardMarkup({name:'突擊巡查',icon:'👔',kind:'老闆卡',effect:'猜中員工，讓摸魚落空',note:'巡查 / 同時揭曉',tone:'patrol'})+'</div><div class="eyebrow">1 人練習 · 3–6 人連線 · 同時出牌</div>';
$('s-home').prepend(hero);
hero.querySelectorAll('button').forEach(b=>{b.tabIndex=-1;b.setAttribute('aria-hidden','true');});
document.querySelector('#s-home .card h2').textContent='入座，準備出牌';
document.querySelector('#s-home .card').classList.add('entry-panel');
const guide=document.createElement('details');guide.className='rules';guide.innerHTML='<summary>🃏 30 秒學會卡牌玩法</summary><div class="body">每位員工持有 6 張可重複使用的行動牌。每回合選 1 張，再選擇是否搭配 1 張消耗型道具牌，按「蓋牌」確認。老闆同時選擇巡查牌，所有人出牌後一起揭曉。<br><br>摸魚成功賺分，但會累積心悸；工作與休息能降低心悸。摸魚地點不能連續兩回合使用。藉口牌被抓時自動消耗。補給階段可花分數購買道具。<br><br>角色、任務完成率與終局勝負沿用原規則，完整條件見下方「遊戲規則與獲勝條件」。</div>';$('rules-home').before(guide);
const table=document.createElement('div');table.id='card-table-meta';$('s-game').prepend(table);
const slot=document.createElement('div');slot.id='play-slot';slot.className='play-slot';$('empsubmit').before(slot);
const oldGame=renderGame;
renderGame=function(){oldGame();const phases={admin:0,choosing:1,reveal:2};table.innerHTML=`<div class="table-head"><strong>摸魚王 / 卡牌桌</strong><span>房間 ${esc(ST.code)} · ${ST.solo?'單人練習':'多人對局'}</span></div><div class="phase-track">${['① 補給與派工','② 暗中出牌','③ 同時揭曉'].map((x,i)=>`<span class="${phases[ST.phase]===i?'active':''}">${x}</span>`).join('')}</div><div class="seats">${ST.players.map(p=>`<div class="seat ${p.id===ST.you.id?'self':''} ${!p.alive?'out':''}">${p.role==='boss'?'👔':'🪪'} ${esc(p.name)}${p.id===ST.you.id?' · 你':''}<small>${p.role==='boss'?'老闆':p.isSupervisor?'主管':p.seniority==='senior'?'老鳥':'菜鳥'} · ${!p.alive?'幽靈':p.submitted?'✓ 已蓋牌':!p.connected?'離線':'思考中'}${p.role==='emp'?' · '+p.points+' 分':''}</small></div>`).join('')}</div>`;};
renderHand=function(){const hand=ST.you.hand||[];$('handbox').innerHTML='<div class="hand-label"><b>道具手牌 · '+hand.length+'/3</b><small>可搭配 1 張道具；藉口自動觸發</small></div><div class="trick-hand">'+(hand.length?hand.map((c,i)=>cardMarkup({name:c.name,icon:c.icon,kind:c.kind==='item'?'道具 / 消耗':'藉口 / 自動',effect:c.desc,note:c.kind==='item'?'點擊選取，再次點擊取消':'被抓時自動使用，無須選取',tone:c.kind==='item'?'trick':'passive',selected:selCard===i,disabled:c.kind!=='item'||ST.you.submitted,click:c.kind==='item'?`toggleCard(${i})`:''})).join(''):'<p class="hint">目前沒有道具牌，下回合可到補給市場購買。</p>')+'</div>';};
const oldEmp=renderEmpZones;
renderEmpZones=function(){oldEmp();const you=ST.you;
  $('empzones').innerHTML=actionCards.map(c=>{const z=ST.zones[c.id],slack=!!z;const locked=slack&&(you.lastZone===c.id||you.overtime);const gain=z?Math.max(0,z.slack+(you.seniority==='senior'?-1:1)):0;
    return cardMarkup({name:c.short,icon:c.icon,kind:c.kind+' / 行動',effect:z?`成功 +${gain} 分 · 心悸 +${z.anxiety}`:c.effect,note:locked?(you.overtime?'加班中，無法出這張牌':'上回合使用，本回合冷卻'):c.note||('成功計 1 次摸魚'+(you.task?' · 任務進度 +1':'')),selected:!!empPick&&(slack?empPick.zone===c.id:empPick.action===c.id),disabled:!!locked,click:slack?`pickEmp('slack','${c.id}')`:`pickEmp('${c.id}')`});}).join('');
  if(!$('action-label')){const label=document.createElement('div');label.id='action-label';label.className='hand-label';label.innerHTML='<b>你的行動牌</b><small>每回合選 1 張；使用過的摸魚牌冷卻 1 回合</small>';$('empzones').before(label);}
  const c=empPick&&actionCards.find(c=>c.id===(empPick.action==='slack'?empPick.zone:empPick.action));const item=selCard!=null&&you.hand[selCard];
  slot.innerHTML=c?`<small>${you.submitted?'已蓋牌 · 全員出牌前可改選':'準備打出'}</small><strong>${c.icon} ${esc(c.short)}${item?' ＋ '+esc(item.name):''}</strong><small>全員出牌後，同時揭曉結果</small>`:'<small>出牌區</small><strong>從手牌選擇本回合的行動</strong><small>先選行動卡，再搭配道具卡</small>';
  $('empsubmit').textContent=c?(you.submitted?'更新蓋牌':'蓋牌，等待揭曉'):'請先選擇一張行動卡';
};
const oldBoss=renderBossZones;
renderBossZones=function(){oldBoss();$('bosszones').innerHTML=ST.slackZones.map(k=>cardMarkup({name:ST.zones[k].name,icon:ZI[k],kind:'巡查卡 / 老闆',effect:'揭曉時，抓出這個地點的員工',note:(ST.zoneStreak?.[k]||0)>=2?'連查兩回合，冷卻中':'本回合可出 '+ST.bossInspect+' 張巡查牌',tone:'patrol',selected:bossPicks.includes(k),disabled:ST.you.submitted||(ST.zoneStreak?.[k]||0)>=2,click:`pickBoss('${k}')`})).join('');$('bosssubmit').textContent='蓋下巡查牌，等待揭曉';};
const oldReveal=renderReveal;
renderReveal=function(){oldReveal();if(!ST.reveal)return;let area=$('revealed-cards');if(!area){area=document.createElement('div');area.id='revealed-cards';$('revboard').before(area);}const r=ST.reveal;
  area.innerHTML='<div class="hand-label"><b>本回合亮牌</b><small>老闆巡查 × 員工行動</small></div><div class="reveal-hand">'+r.bossZoneKeys.map(k=>cardMarkup({name:ST.zones[k].name,icon:ZI[k],kind:'老闆 / 巡查',effect:'巡查此區',tone:'patrol'})).join('')+r.results.map(x=>cardMarkup({name:x.working?'埋頭苦幹':x.zoneName,icon:x.working?'💼':ZI[x.zone]||'🃏',kind:x.name,effect:x.note,note:x.eliminated?'心悸爆表 · 進入幽靈狀態':'行動已結算'})).join('')+'</div>';
  area.querySelectorAll('button').forEach(b=>{b.tabIndex=-1;b.setAttribute('role','article');b.removeAttribute('aria-pressed');});
};
if(ST)render();
