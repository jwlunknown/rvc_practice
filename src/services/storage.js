const PLAYERS='rvcSanctuaryPractice.players.v1',GAME='tossed.activeGame.v7',PREFS='tossed.prefs.v7';
export function makeId(prefix='TOSSED'){return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`}
export function getPlayers(){let p=[];try{p=JSON.parse(localStorage.getItem(PLAYERS)||'[]')}catch{}if(!p.length){p=[{id:makeId('TOSSED-P-JEREMY'),name:'Jeremy'}];savePlayers(p)}return p}
export function savePlayers(p){localStorage.setItem(PLAYERS,JSON.stringify(p))}
export function loadGame(){try{return JSON.parse(localStorage.getItem(GAME)||'null')}catch{return null}}
export function saveGame(g){localStorage.setItem(GAME,JSON.stringify(g))}
export function clearGame(){localStorage.removeItem(GAME)}
export function getPrefs(){try{return JSON.parse(localStorage.getItem(PREFS)||'{}')}catch{return {}}}
export function savePrefs(p){localStorage.setItem(PREFS,JSON.stringify(p))}
