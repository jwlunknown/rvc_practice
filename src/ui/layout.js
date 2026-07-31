const STORAGE_KEY='tossed.widgetLayouts.v2';
const LEGACY_STORAGE_KEY='tossed.widgetLayouts.v1';
const dashboard=document.getElementById('widgetDashboard');
const layoutBtn=document.getElementById('layoutBtn');
const modal=document.getElementById('layoutModal');
const list=document.getElementById('layoutEditorList');
const portraitBtn=document.getElementById('portraitLayoutBtn');
const landscapeBtn=document.getElementById('landscapeLayoutBtn');
const closeBtn=document.getElementById('closeLayoutBtn');
const resetBtn=document.getElementById('resetLayoutBtn');
const columnsInput=document.getElementById('layoutColumns');

const labels={room:'Linked Room',current:'Current Throw',players:'Player Cards',rounds:'Round Frames',actions:'Game Controls'};
const ids=Object.keys(labels);
const defaults={
  portrait:{columns:2,order:['room','current','players','rounds','actions'],tiles:{room:{span:2,minHeight:0},current:{span:2,minHeight:0},players:{span:2,minHeight:0},rounds:{span:2,minHeight:0},actions:{span:2,minHeight:0}},visible:{room:true,current:true,players:true,rounds:true,actions:true}},
  landscape:{columns:4,order:['room','current','players','rounds','actions'],tiles:{room:{span:4,minHeight:0},current:{span:2,minHeight:0},players:{span:2,minHeight:0},rounds:{span:2,minHeight:0},actions:{span:2,minHeight:0}},visible:{room:true,current:true,players:true,rounds:true,actions:true}}
};
let layouts=loadLayouts();
let editing='portrait';
let draggedId=null;
const media=matchMedia('(orientation: landscape)');

function clone(value){return JSON.parse(JSON.stringify(value))}
function clamp(value,min,max){return Math.max(min,Math.min(max,Number(value)||min))}
function legacySpan(size,columns){
  const fractions={compact:.25,half:.5,wide:.75,full:1};
  return clamp(Math.round(columns*(fractions[size]||1)),1,columns);
}
function normalize(layout,orientation){
  const base=clone(defaults[orientation]);
  if(!layout)return base;
  base.columns=clamp(layout.columns||base.columns,1,6);
  const supplied=(layout.order||[]).filter(id=>ids.includes(id));
  base.order=[...supplied,...ids.filter(id=>!supplied.includes(id))];
  ids.forEach(id=>{
    const legacySize=layout.sizes?.[id];
    const tile=layout.tiles?.[id];
    base.tiles[id]={
      span:clamp(tile?.span??legacySpan(legacySize,base.columns),1,base.columns),
      minHeight:clamp(tile?.minHeight||0,0,1200)
    };
    if(typeof layout.visible?.[id]==='boolean')base.visible[id]=layout.visible[id];
  });
  return base;
}
function loadLayouts(){
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||localStorage.getItem(LEGACY_STORAGE_KEY)||'{}');
    return {portrait:normalize(saved.global?.portrait||saved.portrait,'portrait'),landscape:normalize(saved.global?.landscape||saved.landscape,'landscape')};
  }catch{return clone(defaults)}
}
function saveLayouts(){
  localStorage.setItem(STORAGE_KEY,JSON.stringify({version:2,scope:'global',global:layouts,gameOverrides:{}}));
}
function activeOrientation(){return media.matches?'landscape':'portrait'}
function widget(id){return dashboard?.querySelector(`[data-widget="${id}"]`)}
function applyLayout(orientation=activeOrientation()){
  if(!dashboard)return;
  const layout=layouts[orientation];
  dashboard.style.setProperty('--layout-columns',layout.columns);
  layout.order.forEach(id=>{const el=widget(id);if(el)dashboard.appendChild(el)});
  ids.forEach(id=>{
    const el=widget(id);if(!el)return;
    const tile=layout.tiles[id];
    el.style.setProperty('--tile-span',Math.min(tile.span,layout.columns));
    el.style.setProperty('--tile-min-height',tile.minHeight?`${tile.minHeight}px`:'0px');
    el.classList.toggle('layout-hidden',!layout.visible[id]);
  });
  dashboard.dataset.orientation=orientation;
}
function setEditing(orientation){
  editing=orientation;
  portraitBtn.classList.toggle('layout-tab-active',orientation==='portrait');
  landscapeBtn.classList.toggle('layout-tab-active',orientation==='landscape');
  columnsInput.value=layouts[orientation].columns;
  renderEditor();
}
function renderEditor(){
  const layout=layouts[editing];
  list.innerHTML=layout.order.map((id,index)=>{
    const tile=layout.tiles[id];
    return `<div class="layout-editor-row" draggable="true" data-layout-id="${id}">
      <span class="drag-handle" aria-hidden="true">☰</span>
      <strong>${labels[id]}</strong>
      <label class="layout-visible"><input type="checkbox" data-visible="${id}" ${layout.visible[id]?'checked':''}> Show</label>
      <label class="layout-dimension">Width <span>(columns)</span><input type="number" min="1" max="${layout.columns}" step="1" value="${Math.min(tile.span,layout.columns)}" data-span="${id}"></label>
      <label class="layout-dimension">Min height <span>(px)</span><input type="number" min="0" max="1200" step="20" value="${tile.minHeight}" data-height="${id}"></label>
      <div class="layout-order-buttons"><button data-up="${id}" ${index===0?'disabled':''}>↑</button><button data-down="${id}" ${index===layout.order.length-1?'disabled':''}>↓</button></div>
    </div>`;
  }).join('');
  bindEditor();
}
function move(id,delta){
  const order=layouts[editing].order,index=order.indexOf(id),next=index+delta;
  if(index<0||next<0||next>=order.length)return;
  [order[index],order[next]]=[order[next],order[index]];
  commitEditorChange();
}
function commitEditorChange(){saveLayouts();applyLayout();renderEditor()}
function bindEditor(){
  list.querySelectorAll('[data-visible]').forEach(input=>input.onchange=()=>{layouts[editing].visible[input.dataset.visible]=input.checked;commitEditorChange()});
  list.querySelectorAll('[data-span]').forEach(input=>input.onchange=()=>{layouts[editing].tiles[input.dataset.span].span=clamp(input.value,1,layouts[editing].columns);commitEditorChange()});
  list.querySelectorAll('[data-height]').forEach(input=>input.onchange=()=>{layouts[editing].tiles[input.dataset.height].minHeight=clamp(input.value,0,1200);commitEditorChange()});
  list.querySelectorAll('[data-up]').forEach(button=>button.onclick=()=>move(button.dataset.up,-1));
  list.querySelectorAll('[data-down]').forEach(button=>button.onclick=()=>move(button.dataset.down,1));
  list.querySelectorAll('.layout-editor-row').forEach(row=>{
    row.ondragstart=e=>{draggedId=row.dataset.layoutId;e.dataTransfer.effectAllowed='move';row.classList.add('dragging')};
    row.ondragend=()=>{draggedId=null;row.classList.remove('dragging')};
    row.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='move'};
    row.ondrop=e=>{
      e.preventDefault();
      const target=row.dataset.layoutId;
      if(!draggedId||draggedId===target)return;
      const order=layouts[editing].order,from=order.indexOf(draggedId),to=order.indexOf(target);
      order.splice(to,0,order.splice(from,1)[0]);
      commitEditorChange();
    };
  });
}
function openEditor(){setEditing(activeOrientation());modal.classList.remove('hidden')}
function closeEditor(){modal.classList.add('hidden')}

layoutBtn?.addEventListener('click',openEditor);
portraitBtn?.addEventListener('click',()=>setEditing('portrait'));
landscapeBtn?.addEventListener('click',()=>setEditing('landscape'));
columnsInput?.addEventListener('change',()=>{
  const layout=layouts[editing];
  layout.columns=clamp(columnsInput.value,1,6);
  ids.forEach(id=>layout.tiles[id].span=Math.min(layout.tiles[id].span,layout.columns));
  columnsInput.value=layout.columns;
  commitEditorChange();
});
closeBtn?.addEventListener('click',closeEditor);
resetBtn?.addEventListener('click',()=>{
  if(!confirm(`Reset the global ${editing} layout for every game mode?`))return;
  layouts[editing]=clone(defaults[editing]);
  commitEditorChange();
  setEditing(editing);
});
modal?.addEventListener('click',e=>{if(e.target===modal)closeEditor()});
media.addEventListener?.('change',()=>applyLayout());
window.addEventListener('storage',e=>{if([STORAGE_KEY,LEGACY_STORAGE_KEY].includes(e.key)){layouts=loadLayouts();applyLayout();if(!modal.classList.contains('hidden'))setEditing(editing)}});

applyLayout();
