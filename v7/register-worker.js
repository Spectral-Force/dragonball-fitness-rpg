// Refresh an installed app only after its working state has been protected.
export function startUpdateChecks({ environment=globalThis, beforeReload=async()=>true, onDeferred=()=>{} }={}) {
  const env=environment,sw=env.navigator?.serviceWorker;
  if(!sw||env.location?.protocol==='file:')return {check:async()=>{},applyReady:async()=>false};
  let registration=null,ready=false,applying=false,reloaded=false,lastCheck=0;
  let hadController=!!sw.controller;
  async function applyReady() {
    if(!ready||applying||reloaded)return false;
    applying=true;
    try {
      if(env.document?.visibilityState==='hidden'||!await beforeReload()){onDeferred();return false;}
      reloaded=true;env.location.reload();return true;
    } catch {onDeferred();return false;}
    finally {applying=false;}
  }
  sw.addEventListener('controllerchange',()=>{
    if(!hadController){hadController=true;return;} // First installation already loaded current files.
    ready=true;void applyReady();
  });
  async function check(force=false) {
    if(env.navigator.onLine===false)return;
    const now=Date.now();
    if(!force&&now-lastCheck<300000)return applyReady();
    lastCheck=now;
    try {
      registration ||= await sw.register('./dbz-sw-v7.js',{scope:'./',updateViaCache:'none'});
      await registration.update();
      await applyReady();
    } catch { /* Offline/restricted installation must never prevent local play. */ }
  }
  env.addEventListener('online',()=>{void check(true);});
  env.addEventListener('focus',()=>{void check();});
  env.document?.addEventListener('visibilitychange',()=>{if(env.document.visibilityState==='visible')void check();});
  if(env.document?.readyState==='complete')void check(true);
  else env.addEventListener('load',()=>{void check(true);},{once:true});
  return {check,applyReady};
}
