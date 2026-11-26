(() => {
  'use strict';
  const endpoint=window.XIAOMAI_CHAT_CONFIG?.endpoint;
  if(!endpoint || !globalThis.crypto?.randomUUID)return;
  const key='xiaomai-visit-id-v1';
  const promptKey='xiaomai-location-prompt-v1';
  let id;
  try{
    id=localStorage.getItem(key);
    if(!/^[a-f0-9-]{36}$/.test(id||'')){
      id=crypto.randomUUID();
      localStorage.setItem(key,id);
    }
  }catch{return;}
  function report(position,keepalive=false){
    return fetch(new URL('visit',endpoint),{method:'POST',credentials:'omit',keepalive,
      headers:{'Content-Type':'application/json'},body:JSON.stringify({id,position})})
      .then(response=>{if(!response.ok)throw Error('visit_unavailable');});
  }
  let visit=Promise.resolve();
  try{
    const last=Number(sessionStorage.getItem(key)||0);
    if(Date.now()-last>300000){
      visit=report(undefined,true).then(()=>sessionStorage.setItem(key,String(Date.now()))).catch(()=>{});
    }
  }catch{}
  function locate(button,status,onShared) {
    if(!navigator.geolocation){status.textContent='当前浏览器无法读取设备定位。';return;}
    button.disabled=true;
    status.textContent='正在请求当前位置…';
    navigator.geolocation.getCurrentPosition(async ({coords})=>{
      try {
        await visit;
        if(!status.isConnected)return;
        await report({latitude:coords.latitude,longitude:coords.longitude,accuracy:coords.accuracy});
        status.textContent='已将当前位置分享给小麦管理员。';
        onShared?.();
      } catch{status.textContent='位置未能保存，可以重试。';}
      finally{button.disabled=false;}
    },error=>{
      status.textContent=error.code===1?'未获得位置权限。':'暂时无法读取当前位置，可以重试。';
      button.disabled=false;
    },{enableHighAccuracy:true,maximumAge:0,timeout:15000});
  }
  function mount() {
    const anchor=document.querySelector('#wechatSettings');
    if(!anchor)return;
    const section=document.createElement('section');
    section.innerHTML='<p>访问时会记录公网 IP 和 IP 所在地区，供小麦管理员查看。你可以选择分享设备的精确位置。</p><button type="button" class="primary">共享当前位置</button><p role="status"></p>';
    anchor.after(section);
    const button=section.querySelector('button'),status=section.querySelector('[role=status]');
    button.onclick=()=>locate(button,status);
  }
  function promptForLocation(){
    if(localStorage.getItem(promptKey))return;
    const dialog=document.createElement('dialog');
    dialog.setAttribute('aria-labelledby','locationPromptTitle');
    dialog.style.cssText='width:min(360px,calc(100% - 32px));box-sizing:border-box;border:1px solid #b7cbbb;border-radius:18px;padding:20px;background:#fffef8;color:#264536;line-height:1.6';
    dialog.innerHTML='<h2 id="locationPromptTitle">共享当前位置</h2><p>小麦会记录访问的公网 IP 和大致地区。允许定位后，你本次的位置和精度会保存到小麦管理页，供管理员查看。</p><p>你也可以跳过，继续使用小麦。</p><p role="status"></p><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="primary" data-allow>允许定位</button><button type="button" data-skip autofocus>暂不共享</button></div>';
    if(typeof dialog.showModal!=='function')return;
    const allow=dialog.querySelector('[data-allow]'),skip=dialog.querySelector('[data-skip]'),status=dialog.querySelector('[role=status]');
    const remember=()=>{try{localStorage.setItem(promptKey,'seen');}catch{}};
    dialog.addEventListener('close',()=>{remember();dialog.remove();},{once:true});
    skip.onclick=()=>dialog.close();
    allow.onclick=()=>{
      remember();
      locate(allow,status,()=>{allow.hidden=true;skip.textContent='完成';});
    };
    document.body.append(dialog);
    dialog.showModal();
  }
  window.XM_DEVICE_LOCATION={mount};
  try{promptForLocation();}catch{}
})();
