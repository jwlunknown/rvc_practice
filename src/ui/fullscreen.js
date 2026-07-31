let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e});
export async function toggleFullscreen(){
  try{
    if(document.fullscreenElement){await document.exitFullscreen();return true}
    if(document.documentElement.requestFullscreen){await document.documentElement.requestFullscreen();return true}
  }catch{}
  return false;
}
export function installMessage(){
  const ua=navigator.userAgent;
  if(/iPhone|iPad|iPod/.test(ua)) return 'In Safari, tap Share, then “Add to Home Screen” for the cleanest full-screen experience.';
  if(/Silk/.test(ua)) return 'Silk may limit browser fullscreen. Add Tossed to the Fire tablet home screen or use the ⛶ button when supported.';
  return 'Use the ⛶ button, or install Tossed from your browser menu for an app-like full-screen view.';
}
export async function promptInstall(){if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;return true}return false}
