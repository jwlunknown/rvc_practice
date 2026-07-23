import {ghostThrow} from '../games/riley.js';
export function newGame({type,players,teams,ghostLevel=6,targetRounds=null}){
  const game={gameId:`TOSSED-${new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14)}-${Math.random().toString(36).slice(2,6).toUpperCase()}`,
    createdAt:new Date().toISOString(),type,players,teams,ghostLevel:Number(ghostLevel),targetRounds,turn:0,current:[],currentIcons:[],pending:[],rounds:[],submitted:false};
  autoThrowRiley(game);
  return game;
}
export function addBag(game,points,icon){if(game.current.length>=4)return;game.current.push(points);game.currentIcons.push(icon);if(game.current.length===4)finishThrow(game)}
export function undoBag(game){game.current.pop();game.currentIcons.pop()}
function finishThrow(game){game.pending.push({player:game.turn,bags:[...game.current],icons:[...game.currentIcons]});game.current=[];game.currentIcons=[];advance(game)}
function advance(game){
  let next=(game.turn+1)%game.players.length;
  if(next===0){completeRound(game);return}
  game.turn=next;
  autoThrowRiley(game);
}
function autoThrowRiley(game){
  if(!game.players[game.turn]?.riley)return;
  const r=ghostThrow(game.ghostLevel);
  game.pending.push({player:game.turn,...r});
  advance(game);
}
function completeRound(game){game.rounds.push({roundNo:game.rounds.length+1,throws:game.pending.map(x=>({...x})),createdAt:new Date().toISOString()});game.pending=[];game.turn=0}
export function updateRoundThrow(game,roundIndex,playerIndex,bags){
  const round=game.rounds[roundIndex];if(!round)return false;
  const icons=bags.map(v=>v===3?'🕳️':v===1?'🟨':'❌');
  const existing=round.throws.find(t=>t.player===playerIndex);
  if(existing){existing.bags=[...bags];existing.icons=icons}else round.throws.push({player:playerIndex,bags:[...bags],icons});
  game.submitted=false;delete game.submittedAt;return true;
}
export function deleteRound(game,roundIndex){
  if(roundIndex<0||roundIndex>=game.rounds.length)return false;
  game.rounds.splice(roundIndex,1);game.rounds.forEach((r,i)=>r.roundNo=i+1);game.submitted=false;delete game.submittedAt;return true;
}
export function playerStats(game,index){const s={rounds:0,bags:0,pts:0,in:0,on:0,off:0};for(const r of game.rounds){const t=r.throws.find(x=>x.player===index);if(!t)continue;s.rounds++;for(const v of t.bags){s.bags++;s.pts+=v;if(v===3)s.in++;else if(v===1)s.on++;else s.off++}}return s}
export function teamScore(game,teamIndex){const team=game.teams[teamIndex];if(game.type==='dime')return team.reduce((a,i)=>a+playerStats(game,i).pts,0);let total=0;for(const r of game.rounds){const scores=game.teams.map(t=>t.reduce((a,i)=>{const x=r.throws.find(z=>z.player===i);return a+(x?x.bags.reduce((p,q)=>p+q,0):0)},0));total+=Math.max(0,scores[teamIndex]-scores[teamIndex===0?1:0])}return total}