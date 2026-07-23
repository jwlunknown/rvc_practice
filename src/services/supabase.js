import {SUPABASE_URL,SUPABASE_KEY} from '../config.js';
const sdk=window.supabase;
export const db=sdk&&SUPABASE_KEY? sdk.createClient(SUPABASE_URL,SUPABASE_KEY):null;
export async function ensureRemotePlayer(player){
  if(!db || /^[0-9a-f-]{36}$/i.test(player.id)) return player;
  const {data,error}=await db.from('players').insert({display_name:player.name}).select().single();
  if(error) throw error;
  return {...player,id:data.player_id};
}
export async function saveGameResults(game,statsForPlayer){
  if(!db) return;
  for(let i=0;i<game.players.length;i++){
    const p=game.players[i];
    if(p.riley || !/^[0-9a-f-]{36}$/i.test(p.id)) continue;
    const {data:session,error}=await db.from('throw_sessions').insert({
      player_id:p.id,mode:game.type,environment:'indoor',notes:game.gameId
    }).select().single();
    if(error) throw error;
    const rows=game.rounds.map((r,n)=>{
      const t=r.throws.find(x=>x.player===i);
      if(!t) return null;
      return {
        session_id:session.session_id,player_id:p.id,round_number:n+1,
        position:n%2?'outside':'inside',
        bag_1:label(t.bags[0]),bag_2:label(t.bags[1]),bag_3:label(t.bags[2]),bag_4:label(t.bags[3]),
        points:t.bags.reduce((a,b)=>a+b,0),notes:game.gameId
      };
    }).filter(Boolean);
    if(rows.length){const {error:e}=await db.from('rounds').insert(rows);if(e)throw e;}
  }
}
function label(v){return v===3?'IN':v===1?'ON':'OFF'}
