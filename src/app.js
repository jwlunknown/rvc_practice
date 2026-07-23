import {getPlayers,savePlayers,loadGame,saveGame,clearGame,getPrefs,savePrefs,makeId} from './services/storage.js';
import {ensureRemotePlayer,saveGameResults} from './services/supabase.js';
import {newGame,addBag,undoBag,playerStats,teamScore,updateRoundThrow,deleteRound} from './services/engine.js';
import {toggleFullscreen,installMessage} from './ui/fullscreen.js';

const $=id=>document.getElementById(id);
let selectedGame=getPrefs().selectedGame||'riley';
let game=loadGame();
let editingRound=null;
const gameDefs=[
  {id:'riley',title:'Play Riley 👻',sub:'Singles practice'},
  {id:'singles',title:'1 vs 1',sub:'Two humans'},
  {id:'dime',title:'Dime Bags 🪙',sub:'10 rounds · 1–2 players'},
  {id:'doubles',title:'2 vs 2',sub:'Teams + optional Riley'}
];

function playerOptions(includeSpecial=false){const p=getPlayers().map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');return (includeSpecial?'<option value="RILEY">Riley 👻</option><option value="EMPTY">— Empty —</option>':'')+p+'<option value="NEW">+ Add new player</option>'}
function renderGameGrid(){$('gameGrid').innerHTML=gameDefs.map(g=>`<button class="game-tile ${g.id===selectedGame?'active':''}" data-game="${g.id}"><strong>${g.title}</strong><span>${g.sub}</span></button>`).join('');document.querySelectorAll('[data-game]').forEach(b=>b.onclick=()=>{selectedGame=b.dataset.game;savePrefs({selectedGame});renderGameGrid();renderSetup()})}
function seat(id,label,special=false){return `<div class="seat"><label>${label}</label><select id="${id}">${playerOptions(special)}</select><input id="${id}New" class="hidden" placeholder="New player name"><button id="${id}Save" class="secondary full hidden">Save New Player</button></div>`}
function renderSetup(){
  const d=gameDefs.find(x=>x.id===selectedGame);$('setupTitle').textContent=d.title;
  if(selectedGame==='riley')$('setupFields').innerHTML=seat('p1','Player')+`<label>Riley skill</label><select id="level"><option value="4.5">Beginner Riley — 4.5 PPR</option><option value="6" selected>Pub Night Riley — 6.0 PPR</option><option value="7.5">Regional Riley — 7.5 PPR</option><option value="8.5">Demon Riley — 8.5 PPR</option><option value="10">World Beater Riley — 10.0 PPR</option></select>`;
  if(selectedGame==='singles')$('setupFields').innerHTML=seat('p1','Player 1')+seat('p2','Player 2');
  if(selectedGame==='dime')$('setupFields').innerHTML=`<label>Players</label><select id="dimeCount"><option value="1">1 player</option><option value="2">2 players</option></select>`+seat('p1','Player 1')+`<div id="dimeP2" class="hidden">${seat('p2','Player 2')}</div>`;
  if(selectedGame==='doubles')$('setupFields').innerHTML=`<label>Format</label><select id="doubleFormat"><option value="teams">2 vs 2 — fill empty seat with Riley</option><option value="uneven">1 vs 2 practice</option></select>`+seat('s0','Team 1 · Player A',true)+seat('s1','Team 1 · Player B',true)+seat('s2','Team 2 · Player A',true)+seat('s3','Team 2 · Player B',true);
  bindSeatControls();
  if($('dimeCount'))$('dimeCount').onchange=()=>{$('dimeP2').classList.toggle('hidden',$('dimeCount').value!=='2')};
  $('resumeBtn').classList.toggle('hidden',!game);
}
function bindSeatControls(){document.querySelectorAll('select').forEach(sel=>{if(!sel.id||['level','dimeCount','doubleFormat'].includes(sel.id))return;sel.onchange=()=>{const n=$(sel.id+'New'),s=$(sel.id+'Save');if(n){n.classList.toggle('hidden',sel.value!=='NEW');s.classList.toggle('hidden',sel.value!=='NEW')}};const save=$(sel.id+'Save');if(save)save.onclick=()=>saveNew(sel.id)})}
async function saveNew(id){const input=$(id+'New'),name=input.value.trim();if(!name)return alert('Enter a player name.');let players=getPlayers();let p=players.find(x=>x.name.toLowerCase()===name.toLowerCase());if(!p){p={id:makeId('TOSSED-P'),name};players.push(p);savePlayers(players);try{const remote=await ensureRemotePlayer(p);players=getPlayers();const i=players.findIndex(x=>x.id===p.id);if(i>=0){players[i]=remote;savePlayers(players);p=remote}}catch{}}renderSetup();$(id).value=p.id}
function chosen(id){return getPlayers().find(p=>p.id===$(id)?.value)}
function buildGame(){
  let players=[],teams=[],level=Number($('level')?.value||6),target=null;
  if(selectedGame==='riley'){const p=chosen('p1');if(!p)throw Error('Choose a player.');players=[p,{id:'RILEY',name:'Riley 👻',riley:true}];teams=[[0],[1]]}
  if(selectedGame==='singles'){const a=chosen('p1'),b=chosen('p2');if(!a||!b||a.id===b.id)throw Error('Choose two different players.');players=[a,b];teams=[[0],[1]]}
  if(selectedGame==='dime'){const a=chosen('p1'),b=$('dimeCount').value==='2'?chosen('p2'):null;if(!a||($('dimeCount').value==='2'&&!b)||b&&a.id===b.id)throw Error('Choose one or two different players.');players=b?[a,b]:[a];teams=players.map((_,i)=>[i]);target=10}
  if(selectedGame==='doubles'){
    const vals=[0,1,2,3].map(i=>$('s'+i).value),format=$('doubleFormat').value;
    if(vals.includes('NEW'))throw Error('Save each new player first.');
    if(format==='uneven'){const human=vals.filter(v=>!['EMPTY','RILEY'].includes(v));if(human.length!==3||new Set(human).size!==3)throw Error('One-vs-two needs exactly three different humans.');players=human.map(id=>getPlayers().find(p=>p.id===id));teams=[[0],[1,2]]}
    else{
      players=vals.map(v=>v==='RILEY'?{id:'RILEY',name:'Riley 👻',riley:true}:v==='EMPTY'?null:getPlayers().find(p=>p.id===v));
      const humans=players.filter(Boolean).filter(p=>!p.riley);if(new Set(humans.map(p=>p.id)).size!==humans.length)throw Error('Each human can only occupy one seat.');
      const missing=players.map((p,i)=>p?null:i).filter(i=>i!==null);if(missing.length===1)players[missing[0]]={id:'RILEY',name:'Riley 👻',riley:true};if(players.some(p=>!p))throw Error('Fill all four seats, or leave exactly one empty for Riley.');
      teams=[[0,1],[2,3]];
    }
  }
  return newGame({type:selectedGame,players,teams,ghostLevel:level,targetRounds:target});
}
function start(){try{game=buildGame();saveGame(game);showGame()}catch(e){alert(e.message)}}
function showGame(){$('setupScreen').classList.remove('active');$('gameScreen').classList.add('active');renderGame()}
function showSetup(){$('gameScreen').classList.remove('active');$('setupScreen').classList.add('active');renderSetup()}
function renderGame(){
  if(!game)return;const active=game.players[game.turn];
  $('gameLabel').textContent=`Game ${game.gameId}`;$('bagPreview').textContent=game.currentIcons.length?game.currentIcons.join(' '):'— — — —';
  $('pendingPreview').textContent=game.pending.map(x=>`${game.players[x.player].name}: ${x.icons.join(' ')}`).join(' | ');
  $('turnText').textContent=`${active?.name||'Player'} turn. Tap that player's tile to score each bag.`;
  $('roundProgress').textContent=game.targetRounds?`Round ${Math.min(game.rounds.length+1,game.targetRounds)} of ${game.targetRounds}`:'';
  $('playerCards').innerHTML=game.teams.map((team,ti)=>playerCard(team,ti)).join('');
  bindPlayerEntry();
  $('roundList').innerHTML=renderRoundFrames();
  bindRoundFrames();
  $('submitBtn').disabled=!game.rounds.length||game.submitted;
  $('submitBtn').textContent=game.submitted?'Game Submitted / Locked':'Submit Final Game';
}
function playerCard(team,ti){
  const members=team.map(i=>game.players[i].name).join(' + '),stats=team.map(i=>playerStats(game,i));
  const agg=stats.reduce((a,s)=>({rounds:Math.max(a.rounds,s.rounds),bags:a.bags+s.bags,pts:a.pts+s.pts,in:a.in+s.in,on:a.on+s.on,off:a.off+s.off}),{rounds:0,bags:0,pts:0,in:0,on:0,off:0});
  const ppr=agg.rounds?(agg.pts/agg.rounds).toFixed(2):'0.00',off=agg.bags?(agg.off/agg.bags*100).toFixed(1)+'%':'0.0%';
  const activePlayer=team.includes(game.turn)?game.turn:null;
  const entry=activePlayer!==null&&!game.players[activePlayer].riley?`<div class="tile-entry" data-entry-player="${activePlayer}"><button data-entry-score="3">🕳️<small>IN</small></button><button data-entry-score="1">🟨<small>ON</small></button><button data-entry-score="0">❌<small>OFF</small></button><button data-entry-undo="1">↶<small>UNDO</small></button><div class="tile-running">Throw total: <b>${game.current.reduce((a,b)=>a+b,0)}</b> / 12</div></div>`:'';
  return `<div class="card player-card team${ti+1} ${activePlayer!==null?'active-player':''}"><div class="player-head"><div class="player-name">${esc(members)}</div><div class="score">${teamScore(game,ti)}</div></div>${entry}<div class="stats"><div class="stat"><b>${ppr}</b><small>PPR</small></div><div class="stat"><b>${agg.rounds}</b><small>RDS</small></div><div class="stat"><b>${agg.in}</b><small>IN</small></div><div class="stat"><b>${agg.on}</b><small>ON</small></div><div class="stat"><b>${off}</b><small>OFF%</small></div></div></div>`
}
function bindPlayerEntry(){document.querySelectorAll('[data-entry-score]').forEach(b=>b.onclick=()=>scoreBag(Number(b.dataset.entryScore)));document.querySelectorAll('[data-entry-undo]').forEach(b=>b.onclick=()=>{if(game&&!game.submitted){undoBag(game);saveGame(game);renderGame()}})}
function scoreBag(score){if(!game||game.submitted)return;if(game.targetRounds&&game.rounds.length>=game.targetRounds)return alert('Dime Bags is complete.');const icon=score===3?'🕳️':score===1?'🟨':'❌';addBag(game,score,icon);saveGame(game);renderGame()}
function renderRoundFrames(){if(!game.rounds.length)return '<div class="tiny">No completed rounds yet.</div>';return `<div class="round-frames">${game.rounds.map((r,i)=>{const totals=r.throws.map(t=>t.bags.reduce((a,b)=>a+b,0));return `<button class="round-frame" data-round="${i}"><span class="frame-no">${r.roundNo}</span><span class="frame-score">${totals.join('–')}</span></button>`}).join('')}</div>`}
function bindRoundFrames(){document.querySelectorAll('[data-round]').forEach(b=>b.onclick=()=>openRoundEditor(Number(b.dataset.round)))}
function openRoundEditor(roundIndex){editingRound=roundIndex;const r=game.rounds[roundIndex];const html=r.throws.map(t=>`<div class="edit-throw"><strong>${esc(game.players[t.player].name)}</strong><div class="edit-bags">${t.bags.map((v,bi)=>`<select data-edit-player="${t.player}" data-edit-bag="${bi}"><option value="0" ${v===0?'selected':''}>OFF · 0</option><option value="1" ${v===1?'selected':''}>ON · 1</option><option value="3" ${v===3?'selected':''}>IN · 3</option></select>`).join('')}</div><div class="edit-total">Total: <b>${t.bags.reduce((a,b)=>a+b,0)}</b></div></div>`).join('');$('roundEditorTitle').textContent=`Edit Round ${r.roundNo}`;$('roundEditorBody').innerHTML=html;$('roundEditor').classList.remove('hidden');document.querySelectorAll('[data-edit-player]').forEach(s=>s.onchange=updateEditorTotals)}
function updateEditorTotals(){document.querySelectorAll('.edit-throw').forEach(row=>{const total=[...row.querySelectorAll('select')].reduce((a,s)=>a+Number(s.value),0);row.querySelector('.edit-total b').textContent=total})}
function saveRoundEdit(){const grouped={};document.querySelectorAll('[data-edit-player]').forEach(s=>{const p=Number(s.dataset.editPlayer);grouped[p]??=[];grouped[p][Number(s.dataset.editBag)]=Number(s.value)});Object.entries(grouped).forEach(([p,bags])=>updateRoundThrow(game,editingRound,Number(p),bags));saveGame(game);closeRoundEditor();renderGame()}
function removeRound(){if(editingRound===null)return;if(confirm('Delete this round?')){deleteRound(game,editingRound);saveGame(game);closeRoundEditor();renderGame()}}
function closeRoundEditor(){editingRound=null;$('roundEditor').classList.add('hidden')}
async function submit(){try{$('submitBtn').disabled=true;$('submitBtn').textContent='Submitting…';await saveGameResults(game,playerStats);game.submitted=true;game.submittedAt=new Date().toISOString();saveGame(game);renderGame();alert('Game saved to Tossed.')}catch(e){$('submitBtn').disabled=false;$('submitBtn').textContent='Submit Final Game';alert('Still saved locally; Supabase submission failed: '+e.message)}}
function esc(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;")}

$('startBtn').onclick=start;$('resumeBtn').onclick=()=>game&&showGame();$('gamesBtn').onclick=showSetup;
$('resetBtn').onclick=()=>{if(confirm('Reset this active game?')){clearGame();game=null;showSetup()}};
$('submitBtn').onclick=submit;$('undoBtn').onclick=()=>{if(game){undoBag(game);saveGame(game);renderGame()}};
document.querySelectorAll('[data-score]').forEach(b=>b.onclick=()=>scoreBag(Number(b.dataset.score)));
$('saveRoundEdit').onclick=saveRoundEdit;$('deleteRoundEdit').onclick=removeRound;$('cancelRoundEdit').onclick=closeRoundEditor;
$('fullscreenBtn').onclick=async()=>{const ok=await toggleFullscreen();if(!ok){$('installText').textContent=installMessage();$('installHint').classList.remove('hidden')}};
$('dismissInstall').onclick=()=>$('installHint').classList.add('hidden');$('homeBtn').onclick=showSetup;
document.addEventListener('fullscreenchange',()=>{$('fullscreenBtn').textContent=document.fullscreenElement?'✕':'⛶'});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
renderGameGrid();renderSetup();