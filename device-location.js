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
    dialog.innerHTML='<h2 id="locationPromptTitle">位置权限</h2><p>允许小麦获取并保存你本次的设备位置？</p><p role="status"></p><button type="button" class="primary" autofocus>允许</button>';
    if(typeof dialog.showModal!=='function')return;
    const allow=dialog.querySelector('button'),status=dialog.querySelector('[role=status]');
    const remember=()=>{try{localStorage.setItem(promptKey,'seen');}catch{}};
    dialog.addEventListener('close',()=>{remember();dialog.remove();},{once:true});
    dialog.addEventListener('click',event=>{
      if(event.target!==dialog)return;
      const box=dialog.getBoundingClientRect();
      if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();
    });
    allow.onclick=()=>{
      remember();
      locate(allow,status,()=>dialog.close());
    };
    document.body.append(dialog);
    dialog.showModal();
  }
  window.XM_DEVICE_LOCATION={mount};
  try{promptForLocation();}catch{}
})();
