(() => {
  'use strict';
  const endpoint=window.XIAOMAI_CHAT_CONFIG?.endpoint;
  if(!endpoint || !globalThis.crypto?.randomUUID)return;
  const key='xiaomai-visit-id-v1';
  const promptKey='xiaomai-location-sharing-v1';
  const interval=300000;
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
  let automaticPending=false,lastPositionAt=0;
  function currentPosition(){
    return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,
      {enableHighAccuracy:true,maximumAge:0,timeout:15000}));
  }
  async function savePosition(coords){
    await visit;
    if(localStorage.getItem(promptKey)!=='allowed')return false;
    await report({latitude:coords.latitude,longitude:coords.longitude,accuracy:coords.accuracy});
    lastPositionAt=Date.now();
    return true;
  }
  async function autoUpdate(){
    if(!navigator.geolocation||document.hidden||automaticPending||Date.now()-lastPositionAt<interval||
      localStorage.getItem(promptKey)!=='allowed')return;
    automaticPending=true;
    try {
      if(navigator.permissions){
        const permission=await navigator.permissions.query({name:'geolocation'}).catch(()=>null);
        if(permission&&permission.state!=='granted')return;
      }
      const {coords}=await currentPosition();
      if(!document.hidden)await savePosition(coords);
    }catch{}finally{automaticPending=false;}
  }
  async function locate(button,status,onShared) {
    if(!navigator.geolocation){status.textContent='当前浏览器无法读取设备定位。';return;}
    button.disabled=true;
    status.textContent='正在请求当前位置…';
    try{
      const {coords}=await currentPosition();
      if(!status.isConnected)return;
      localStorage.setItem(promptKey,'allowed');
      if(await savePosition(coords)){
        status.textContent='自动位置更新已开启。';
        onShared?.();
      }
    }catch(error){
      status.textContent=error.code===1?'未获得位置权限。':'暂时无法读取当前位置，可以重试。';
    }finally{button.disabled=false;}
  }
  function mount() {
    const anchor=document.querySelector('#wechatSettings');
    if(!anchor)return;
    const section=document.createElement('section');
    section.innerHTML='<p>访问时会记录公网 IP 和 IP 所在地区，供小麦管理员查看。</p><button type="button" class="primary"></button><p role="status"></p>';
    anchor.after(section);
    const button=section.querySelector('button'),status=section.querySelector('[role=status]');
    const update=()=>{button.textContent=localStorage.getItem(promptKey)==='allowed'?'关闭位置自动更新':'开启位置自动更新';};
    update();
    button.onclick=()=>{
      if(localStorage.getItem(promptKey)==='allowed'){
        localStorage.setItem(promptKey,'disabled');
        status.textContent='已关闭位置自动更新。';
        update();
      }else void locate(button,status,update);
    };
  }
  function promptForLocation(){
    const preference=localStorage.getItem(promptKey);
    if(preference==='allowed'||preference==='disabled')return;
    const dialog=document.createElement('dialog');
    dialog.setAttribute('aria-labelledby','locationPromptTitle');
    dialog.className='location-entry';
    dialog.style.cssText='width:min(360px,calc(100% - 32px));box-sizing:border-box;border:1px solid #b7cbbb;border-radius:18px;padding:20px;background:#fffef8;color:#264536;line-height:1.6';
    dialog.innerHTML='<h2 id="locationPromptTitle">位置权限</h2><p>允许小麦在使用期间自动获取并保存你的位置？</p><p role="status"></p><button type="button" class="primary" autofocus>允许</button>';
    if(typeof dialog.showModal!=='function')return;
    const allow=dialog.querySelector('button'),status=dialog.querySelector('[role=status]');
    const remember=()=>{try{if(!localStorage.getItem(promptKey))localStorage.setItem(promptKey,'dismissed');}catch{}};
    dialog.addEventListener('close',()=>{remember();dialog.remove();},{once:true});
    dialog.addEventListener('cancel',event=>event.preventDefault());
    allow.onclick=async()=>{
      remember();
      await locate(allow,status);
      dialog.close();
    };
    document.body.append(dialog);
    dialog.showModal();
  }
  window.XM_DEVICE_LOCATION={mount};
  try{promptForLocation();}catch{}
  if(navigator.geolocation){
    void autoUpdate();
    document.addEventListener('visibilitychange',()=>void autoUpdate());
    window.addEventListener('pageshow',()=>void autoUpdate());
    setInterval(()=>void autoUpdate(),interval);
  }
})();
