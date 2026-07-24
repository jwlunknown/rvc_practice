import {db} from './supabase.js';

const ROOM_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
let channel=null;
let roomCode=null;
let suppress=false;

export function makeRoomCode(){
  let code='';
  for(let i=0;i<6;i++) code+=ROOM_CHARS[Math.floor(Math.random()*ROOM_CHARS.length)];
  return code;
}

export function makeHostToken(){
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function createRoom(game){
  if(!db) throw new Error('Supabase is not available.');
  for(let attempt=0;attempt<5;attempt++){
    const code=makeRoomCode();
    const token=makeHostToken();
    const {error}=await db.from('live_rooms').insert({room_code:code,host_token:token,status:'active',game_state:game,updated_at:new Date().toISOString()});
    if(!error) return {code,token};
    if(error.code!=='23505') throw error;
  }
  throw new Error('Could not create a unique room. Try again.');
}

export async function loadRoom(code){
  if(!db) throw new Error('Supabase is not available.');
  const clean=String(code||'').trim().toUpperCase();
  const {data,error}=await db.from('live_rooms').select('room_code,game_state,status,updated_at').eq('room_code',clean).single();
  if(error) throw new Error('Room not found.');
  return data;
}

export async function updateRoom(code,game,status='active'){
  if(!db||!code||suppress) return;
  const {error}=await db.from('live_rooms').update({game_state:game,status,updated_at:new Date().toISOString()}).eq('room_code',code);
  if(error) throw error;
}

export async function subscribeRoom(code,onGame){
  if(!db) throw new Error('Supabase is not available.');
  await leaveRoom();
  roomCode=String(code).toUpperCase();
  channel=db.channel(`tossed-room-${roomCode}`)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'live_rooms',filter:`room_code=eq.${roomCode}`},payload=>{
      if(!payload.new?.game_state) return;
      suppress=true;
      try{onGame(payload.new.game_state,payload.new.status)}finally{setTimeout(()=>{suppress=false},0)}
    })
    .subscribe();
  return channel;
}

export async function leaveRoom(){
  if(channel&&db) await db.removeChannel(channel);
  channel=null;roomCode=null;suppress=false;
}

export function roomJoinUrl(code){
  const url=new URL(window.location.href);
  url.search='';url.hash='';url.searchParams.set('room',String(code).toUpperCase());
  return url.toString();
}
