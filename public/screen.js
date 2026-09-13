// One viewport per screen. Move live controls instead of duplicating their IDs.
function screenNode(tag, cls, parent) {
  const node = document.createElement(tag);
  node.className = cls;
  if (parent) parent.append(node);
  return node;
}
function screenTabs(parent, entries, initial = 0) {
  const nav = screenNode('nav', 'screen-tabs');
  nav.setAttribute('aria-label', '切換操作區');
  parent.prepend(nav);
  const buttons = entries.map(([label, pane], i) => {
    const b = screenNode('button', '', nav);
    b.type = 'button'; b.textContent = label;
    b.onclick = () => select(i);
    return b;
  });
  function select(index) {
    entries.forEach(([, pane], i) => pane.classList.toggle('pane-off', i !== index));
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(i === index)));
  }
  select(initial);
  return {select, buttons};
}

// Paginated reference reader: even long rules/logs don't extend the page.
const reader = screenNode('dialog', 'screen-reader', document.body);
reader.innerHTML = '<header><h2></h2><button type="button" aria-label="關閉">✕</button></header><div class="reader-text"></div><footer><button type="button">上一頁</button><span></span><button type="button">下一頁</button></footer>';
reader.querySelector('header button').onclick = () => reader.close();
let readerPages = [], readerPage = 0;
function paintReader() {
  reader.querySelector('.reader-text').textContent = readerPages[readerPage] || '目前沒有紀錄。';
  const controls = reader.querySelectorAll('footer button');
  controls[0].disabled = readerPage === 0;
  controls[1].disabled = readerPage >= readerPages.length - 1;
  reader.querySelector('footer span').textContent = `${readerPage + 1} / ${Math.max(1, readerPages.length)}`;
}
reader.querySelectorAll('footer button').forEach((b, i) => b.onclick = () => {readerPage += i ? 1 : -1; paintReader();});
function openReader(title, text) {
  const size = innerHeight < 500 ? 100 : innerWidth < 600 ? 220 : 650;
  readerPages = text.trim().match(new RegExp(`[\\s\\S]{1,${size}}`, 'g')) || ['目前沒有紀錄。'];
  readerPage = 0; reader.querySelector('h2').textContent = title; paintReader(); reader.showModal();
}
function readerButton(parent, label, getText) {
  const button = screenNode('button', 'ghost', parent);
  button.type = 'button'; button.textContent = label;
  button.onclick = () => openReader(label, getText());
}

// Home: one nickname, then choose one mode instead of stacking every form.
const entry = document.querySelector('.entry-panel');
const homeRows = [...entry.children];
const homeBody = screenNode('div', 'home-mode-body', entry);
const soloPane = homeRows.find(n => n.querySelector('#solocount'));
const roomFields = homeRows.find(n => n.querySelector('#roomname'));
const joinPane = homeRows.find(n => n.querySelector('#joincode'));
const createButton = entry.querySelector('button[onclick="doCreate()"]');
const createPane = screenNode('div', 'mode-pane', homeBody);
createPane.append(roomFields, createButton);
homeBody.append(soloPane, joinPane);
const roomsPane = [...$('s-home').children].find(n => n.classList.contains('card') && n !== entry);
homeBody.append(roomsPane);
const homeTabs = screenTabs(homeBody, [['單人練習', soloPane], ['開房', createPane], ['加入', joinPane], ['公開房', roomsPane]]);
const modeMenu = screenNode('section', 'mode-menu', $('s-home'));
modeMenu.innerHTML = '<div class="mode-menu-heading"><span class="eyebrow">CHOOSE YOUR TABLE</span><h2>今天，怎麼摸魚？</h2><p>自己練一手，或和朋友一起鬥智。</p></div><div class="mode-options"><button type="button" class="mode-option"><span class="mode-number">01 / PRACTICE</span><span class="mode-icon">🃏</span><strong>單人練習</strong><span>與 AI 老闆、同事對局<br>熟悉卡牌與角色能力</span><em>開始練習 →</em></button><button type="button" class="mode-option multiplayer"><span class="mode-number">02 / MULTIPLAYER</span><span class="mode-icon">👥</span><strong>多人遊玩</strong><span>開房邀朋友，或加入房間<br>3–6 人一起出牌較勁</span><em>進入遊戲大廳 →</em></button></div>';
hero.classList.add('pane-off');
entry.classList.add('pane-off');
function selectHomeMode(mode) {
  modeMenu.classList.add('pane-off'); entry.classList.remove('pane-off');
  entry.querySelector('h2').textContent = mode === 'solo' ? '單人練習' : '多人遊玩';
  homeTabs.buttons.forEach((b, i) => b.classList.toggle('pane-off', mode === 'solo' ? i !== 0 : i === 0));
  homeTabs.select(mode === 'solo' ? 0 : 1);
}
modeMenu.querySelectorAll('.mode-option').forEach((b, i) => b.onclick = () => selectHomeMode(i ? 'multi' : 'solo'));
const modeBack = screenNode('button', 'ghost mode-back', entry);
modeBack.type = 'button'; modeBack.textContent = '← 返回模式選單';
modeBack.onclick = () => {entry.classList.add('pane-off');modeMenu.classList.remove('pane-off');};
entry.prepend(modeBack);
if (new URLSearchParams(location.search).has('room')) {selectHomeMode('multi');homeTabs.select(2);}
const homeTools = screenNode('div', 'screen-tools', entry);
readerButton(homeTools, '玩法說明', () => guide.textContent + '\n\n' + $('rules-home').textContent);
guide.classList.add('pane-off'); $('rules-home').classList.add('pane-off');

// Game status uses a compact band; detailed task text lives in the reader.
const gameCard = document.querySelector('#s-game > .card');
gameCard.classList.add('game-surface');
const statusBand = screenNode('div', 'status-band');
gameCard.prepend(statusBand);
statusBand.append($('round').closest('h2').parentElement, $('mystats'), $('timer'), $('status'));
const contextBand = screenNode('div', 'context-band');
statusBand.after(contextBand);
const taskSummary = screenNode('button', 'ghost', contextBand);
taskSummary.type = 'button';
taskSummary.onclick = () => openReader('任務與老闆情報', $('mytask').textContent + '\n' + $('patternbox').textContent);
$('mytask').classList.add('pane-off'); $('patternbox').classList.add('pane-off');
const gameTools = screenNode('div', 'screen-tools', contextBand);
readerButton(gameTools, '紀錄', () => $('log').textContent);
readerButton(gameTools, '規則', () => $('rules-home').textContent);
document.querySelector('#s-game > details').classList.add('pane-off');

// Employee: switch between action / inventory / abilities in the same area.
const emp = $('empchoose');
const actionPane = screenNode('div', 'employee-actions', emp);
actionPane.append($('empzones'));
const tricksPane = screenNode('div', 'employee-tricks', emp);
tricksPane.append($('handbox'));
const tacticsPane = screenNode('div', 'employee-tactics', emp);
tacticsPane.append($('helpbox'), $('riskybox'));
const empTabs = screenTabs(emp, [['行動牌', actionPane], ['道具牌', tricksPane], ['角色技能', tacticsPane]]);
const playFooter = screenNode('div', 'play-footer', emp);
playFooter.append($('play-slot'), $('empsubmit'));

// Boss preparation: market, assignments and management occupy one panel each.
const adminTabsBody = screenNode('div', 'admin-tab-body', $('adminboss'));
const assignments = screenNode('div', 'assign-pane', adminTabsBody);
assignments.append($('adminhint'), $('assignlist'));
const management = screenNode('div', 'manage-pane', adminTabsBody);
management.append($('promotebox'), $('firebox'));
const overtime = screenNode('div', 'overtime-pane', adminTabsBody);
overtime.append($('otbox'));
screenTabs(adminTabsBody, [['派工', assignments], ['人事', management], ['加班牌', overtime]]);
const beginButton = $('adminboss').querySelector('button[onclick*="beginRound"]');
$('adminboss').append(beginButton);
[...$('adminboss').children].forEach(n => {if (n !== adminTabsBody && n !== beginButton) n.classList.add('pane-off');});

// Reveal shows either the cards or the animated board, never both stacked.
const reveal = $('reveal');
const revealCardsPane = screenNode('div', 'reveal-cards-pane', reveal);
const revealBoardPane = screenNode('div', 'reveal-board-pane', reveal);
revealBoardPane.append($('revboard'), $('revsum'), $('revtoasts'));
const revealTabs = screenTabs(reveal, [['亮牌結果', revealCardsPane], ['地圖動畫', revealBoardPane]]);
reveal.append($('nextbtn'), $('waitnext'));
reveal.querySelector('details').classList.add('pane-off');
readerButton(reveal.querySelector('.screen-tabs'), '詳細結算', () => $('revlist').textContent);

// Secondary screens: keep the storybook art visible (T4); still open verbose rules text on demand.
['rules-lobby'].forEach(id => $(id)?.classList.add('pane-off'));
const endTools = screenNode('div', 'screen-tools', $('s-end'));
readerButton(endTools, '本局故事', () => $('endstory').textContent);
$('endstory').classList.add('pane-off');
const lobbyCard = $('lobbylist').closest('.card');
const lobbyPlayers = screenNode('div', 'lobby-players', lobbyCard);
lobbyPlayers.append($('lobbylist'));
const lobbyTabs = screenTabs(lobbyCard, [['玩家席位', lobbyPlayers], ['房主設定', $('hostpanel')]]);
const lobbyFooter = screenNode('div', 'lobby-footer', lobbyCard);
lobbyFooter.append(lobbyCard.querySelector('button[onclick="doStart()"]'), lobbyCard.querySelector('button[onclick="closeRoom()"]'));
// Public rooms are paged, so ten rooms still fit in the fixed-height lobby.
const roomPager = screenNode('div', 'screen-tabs');
$('roomlist').after(roomPager);
let roomPage = 0;
roomPager.innerHTML = '<button type="button">上一頁</button><span></span><button type="button">下一頁</button>';
function paintRoomPage() {
  const rows = [...$('roomlist').children];
  const count = Math.max(1, Math.ceil(rows.length / 3));
  roomPage = Math.min(roomPage, count - 1);
  rows.forEach((row, i) => row.classList.toggle('pane-off', Math.floor(i / 3) !== roomPage));
  roomPager.classList.toggle('pane-off', count === 1);
  roomPager.querySelector('span').textContent = `${roomPage + 1}/${count}`;
  roomPager.querySelectorAll('button').forEach((b, i) => b.disabled = i ? roomPage === count - 1 : roomPage === 0);
}
roomPager.querySelectorAll('button').forEach((b, i) => b.onclick = () => {roomPage += i ? 1 : -1;paintRoomPage();});
new MutationObserver(paintRoomPage).observe($('roomlist'), {childList:true});
paintRoomPage();
const oldScreenRender = render;
let screenRound = '';
render = function() {
  oldScreenRender();
  if (!ST) return;
  const key = ST.code + ':' + ST.round;
  if (key !== screenRound) {empTabs.select(0); revealTabs.select(0); screenRound = key;}
  const you = ST.you;
  if (you) {
    lobbyFooter.classList.toggle('pane-off', !you.isHost);
    lobbyTabs.buttons[1].disabled = !you.isHost;
    if (!you.isHost) lobbyTabs.select(0);
    taskSummary.textContent = you.task ? `📋 任務 ${you.task.progress}/${you.task.need} · 剩 ${you.task.deadlineLeft} 回合 ⓘ` : '📋 任務與情報 ⓘ';
    empTabs.buttons[1].textContent = `道具牌 ${you.hand?.length || 0}${selCard != null ? ' ✓' : ''}`;
  }
  const revealed = $('revealed-cards');
  if (revealed) revealCardsPane.append(revealed);
};
// Selection renders don't call the full render; keep the selected-item badge current.
const screenToggleCard = toggleCard;
toggleCard = function(i) {screenToggleCard(i);empTabs.buttons[1].textContent = `道具牌 ${ST.you.hand.length}${selCard != null ? ' ✓' : ''}`;};
if (ST) render();
