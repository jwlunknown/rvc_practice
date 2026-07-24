const STORAGE_KEY='tossed.widgetLayouts.v1';
const dashboard=document.getElementById('widgetDashboard');
const layoutBtn=document.getElementById('layoutBtn');
const modal=document.getElementById('layoutModal');
const list=document.getElementById('layoutEditorList');
const portraitBtn=document.getElementById('portraitLayoutBtn');
const landscapeBtn=document.getElementById('landscapeLayoutBtn');
const closeBtn=document.getElementById('closeLayoutBtn');
const resetBtn=document.getElementById('resetLayoutBtn');

const labels={room:'Linked Room',current:'Current Throw',players:'Player Cards',rounds:'Round Frames',actions:'Game Controls'};
const ids=Object.keys(labels);
const defaults={
  portrait:{order:['room','current','players','rounds','actions'],sizes:{room:'full',current:'full',players:'full',rounds:'full',actions:'full'},visible:{room:true,current:true,players:true,rounds:true,actions:true}},
  landscape:{order:['room','current','players','rounds','actions'],sizes:{room:'full',current:'half',players:'half',rounds:'half',actions:'half'},visible:{room:true,current:true,players:true,rounds:true,actions:true}}
};
let layouts=loadLayouts();
let editing='portrait';
let draggedId=null;
const media=matchMedia('(orientation: landscape)');

function clone(value){return JSON.parse(JSON.stringify(value))}
function normalize(layout,orientation){
  const base=clone(defaults[orientation]);
  if(!layout)return base;
  const supplied=(layout.order||[]).filter(id=>ids.includes(id));
  base.order=[...supplied,...ids.filter(id=>!supplied.includes(id))];
  ids.forEach(id=>{
    if(['compact','half','wide','full'].includes(layout.sizes?.[id]))base.sizes[id]=layout.sizes[id];
    if(typeof layout.visible?.[id]==='boolean')base.visible[id]=layout.visible[id];
  });
  return base;
}
function loadLayouts(){
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
    return {portrait:normalize(saved.portrait,'portrait'),landscape:normalize(saved.landscape,'landscape')};
  }catch{return clone(defaults)}
}
function saveLayouts(){localStorage.setItem(STORAGE_KEY,JSON.stringify(layouts))}
function activeOrientation(){return media.matches?'landscape':'portrait'}
function widget(id){return dashboard?.querySelector(`[data-widget="${id}"]`)}
function applyLayout(orientation=activeOrientation()){
  if(!dashboard)return;
  const layout=layouts[orientation];
  layout.order.forEach(id=>{const el=widget(id);if(el)dashboard.appendChild(el)});
  ids.forEach(id=>{
    const el=widget(id);if(!el)return;
    el.classList.remove('widget-size-compact','widget-size-half','widget-size-wide','widget-size-full');
    el.classList.add(`widget-size-${layout.sizes[id]}`);
    el.classList.toggle('layout-hidden',!layout.visible[id]);
  });
  dashboard.dataset.orientation=orientation;
}
function setEditing(orientation){
  editing=orientation;
  portraitBtn.classList.toggle('layout-tab-active',orientation==='portrait');
  landscapeBtn.classList.toggle('layout-tab-active',orientation==='landscape');
  renderEditor();
}
function renderEditor(){
  const layout=layouts[editing];
  list.innerHTML=layout.order.map((id,index)=>`<div class="layout-editor-row" draggable="true" data-layout-id="${id}">
    <span class="drag-handle" aria-hidden="true">☰</span>
    <strong>${labels[id]}</strong>
    <label class="layout-visible"><input type="checkbox" data-visible="${id}" ${layout.visible[id]?'checked':''}> Show</label>
    <select data-size="${id}" aria-label="${labels[id]} size">
      <option value="compact" ${layout.sizes[id]==='compact'?'selected':''}>Compact</option>
      <option value="half" ${layout.sizes[id]==='half'?'selected':''}>Half</option>
      <option value="wide" ${layout.sizes[id]==='wide'?'selected':''}>Wide</option>
      <option value="full" ${layout.sizes[id]==='full'?'selected':''}>Full</option>
    </select>
    <div class="layout-order-buttons"><button data-up="${id}" ${index===0?'disabled':''}>↑</button><button data-down="${id}" ${index===layout.order.length-1?'disabled':''}>↓</button></div>
  </div>`).join('');
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
  list.querySelectorAll('[data-size]').forEach(select=>select.onchange=()=>{layouts[editing].sizes[select.dataset.size]=select.value;commitEditorChange()});
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
closeBtn?.addEventListener('click',closeEditor);
resetBtn?.addEventListener('click',()=>{
  if(!confirm(`Reset the ${editing} layout?`))return;
  layouts[editing]=clone(defaults[editing]);
  commitEditorChange();
});
modal?.addEventListener('click',e=>{if(e.target===modal)closeEditor()});
media.addEventListener?.('change',()=>applyLayout());
window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY){layouts=loadLayouts();applyLayout();if(!modal.classList.contains('hidden'))renderEditor()}});

applyLayout();