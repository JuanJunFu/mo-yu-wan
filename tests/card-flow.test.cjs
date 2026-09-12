const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
// Run the real rules without opening a port or waiting on real clocks.
const source=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8').split('const PORT=process.env.PORT||3000;')[0];
function engine(){
  const scheduled=[];
  const context=vm.createContext({require,console,__dirname:path.join(__dirname,'..'),setTimeout:(fn,ms)=>{scheduled.push({fn,ms});return scheduled.length;},clearTimeout:()=>{},setInterval:()=>0});
  vm.runInContext(source,context);
  const api=vm.runInContext('({mkPlayer,startGame,enterChoose,resolveRound,tryResolve,advanceRound,drawRoundHand,viewFor,rooms})',context);
  const room={code:'TEST',hostId:'boss',players:new Map(),config:{},log:[],choices:{emp:{},boss:null,ghost:{}},spectators:new Map(),createdAt:Date.now(),solo:true};
  for(const id of ['boss','employee','colleague'])room.players.set(id,api.mkPlayer(id,null,id));
  api.rooms.set(room.code,room);api.startGame(room,{rounds:8});
  return {api,room,p:room.players.get('employee'),scheduled};
}
function round(e,action){
  e.api.enterChoose(e.room);
  e.room.choices={boss:{zones:[]},emp:{employee:{action,zone:action==='slack'?'tea':'office'},colleague:{action:'idle',zone:'office'}},ghost:{}};
  e.api.resolveRound(e.room);
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
