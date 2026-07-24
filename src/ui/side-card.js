document.addEventListener('click',event=>{
  const badge=event.target.closest('.court-side-badge');
  if(!badge)return;
  event.preventDefault();
  document.getElementById('gameSettingsBtn')?.click();
});

document.addEventListener('keydown',event=>{
  if(!['Enter',' '].includes(event.key))return;
  const badge=event.target.closest('.court-side-badge');
  if(!badge)return;
  event.preventDefault();
  document.getElementById('gameSettingsBtn')?.click();
});

const cards=document.getElementById('playerCards');
if(cards){
  const makeBadgesAccessible=()=>cards.querySelectorAll('.court-side-badge').forEach(badge=>{
    badge.setAttribute('role','button');
    badge.setAttribute('tabindex','0');
    badge.setAttribute('title','Update current Inside / Outside settings');
  });
  new MutationObserver(makeBadgesAccessible).observe(cards,{childList:true,subtree:true});
  makeBadgesAccessible();
}
