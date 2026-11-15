(()=>{
  const $=id=>document.getElementById(id);
  const sessionKey='xiaomai-wechat-pending-v1';
  let ticket='',timer,displayTimer,controller,revision=0,stage='idle',visibleUntil=0,retries=0;
  const style=document.createElement('style');
  style.textContent='.wechat-card{margin:18px 0;padding:14px;background:#eaf0e3;border:1px solid #d4dfca;border-radius:15px}.wechat-card strong{display:block;font-size:14px}.wechat-card p,.wechat-bind p{font-size:13px;line-height:1.7}.wechat-card button,.wechat-bind button,.wechat-link{min-height:44px;padding:10px 14px;border-radius:12px}.wechat-card button,.wechat-link,.wechat-main{background:var(--green);color:white;font-weight:650}.wechat-bind{display:grid;gap:12px}.wechat-bind p{margin:0!important}.wechat-bind [hidden]{display:none!important}.wechat-link{text-align:center;text-decoration:none}.wechat-qr{display:block;margin:0 auto;width:min(100%,250px);height:auto;border:1px solid var(--line);border-radius:10px;background:white}.wechat-bind input{display:block;width:100%;margin-top:6px;border:1px solid var(--line);padding:10px 12px;font-size:16px;border-radius:10px}.wechat-bind label{font-size:13px}.wechat-secondary{background:#eaf0e5;color:#344e3e}.wechat-bind button:disabled{opacity:.6}';
  document.head.append(style);
  function readTicket(){
    if(ticket)return ticket;
    try{const own=sessionStorage.getItem(sessionKey);if(own)return own}catch{}
    try{return localStorage.getItem(sessionKey)||''}catch{return ''}
  }
  function remember(value,fresh=false){
    const previous=ticket;
    ticket=value||'';
    try{if(ticket)sessionStorage.setItem(sessionKey,ticket);else sessionStorage.removeItem(sessionKey)}catch{}
    try{
      const last=localStorage.getItem(sessionKey);
      // A late result from an older tab must not replace another tab's newer code.
      if(ticket&&(fresh||!last||last===previous))localStorage.setItem(sessionKey,ticket);
      if(!ticket&&last===previous)localStorage.removeItem(sessionKey);
    }catch{}
  }
  function access(){
    const hash=new URLSearchParams(location.hash.slice(1)).get('pocket');
    if(hash&&/^[\w-]{32,128}$/.test(hash))return hash;
    try{return sessionStorage.getItem('xiaomai-chat-access')||''}catch{return ''}
  }
  function open(){return Boolean($('wechatBinding')&&!$('veil').hidden)}
  function foreground(){return open()&&document.visibilityState!=='hidden'}
  function interrupt(){
    revision++;clearTimeout(timer);clearTimeout(displayTimer);
    if(controller)controller.abort();
    controller=null;
  }
  function leave(){interrupt()}
  function clearCode(){
    clearTimeout(displayTimer);visibleUntil=0;
    const image=$('wechatQR'),link=$('wechatOfficial');
    image.hidden=true;image.removeAttribute('src');link.hidden=true;link.removeAttribute('href');
  }
  function status(value){$('wechatStatus').textContent=value}
  function renew(label){
    const button=$('wechatGet');button.textContent=label;button.disabled=false;button.hidden=false;
  }
  function expireDisplay(){
    clearCode();
    if(stage==='waiting'||stage==='checking'){
      status('这张码已显示一会儿了，正在核对微信状态。');
      renew('重新获取二维码');
    }
  }
  function schedulePoll(delay=2200){
    clearTimeout(timer);
    if(foreground()&&ticket)timer=setTimeout(()=>run('poll'),delay);
  }
  function showCode(data){
    const url=new URL(data.officialUrl);
    if(url.protocol!=='https:'||url.username||url.password||url.port||!/(^|\.)weixin\.(qq\.com|com)$/i.test(url.hostname)||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data.qrImage))throw Error('invalid_wechat_response');
    const image=$('wechatQR'),link=$('wechatOfficial');
    image.src=data.qrImage;image.hidden=false;
    link.href=url.href;link.hidden=false;
    visibleUntil=Date.now()+Math.max(0,Math.min(Number(data.displayForMs)||0,120000));
    clearTimeout(displayTimer);displayTimer=setTimeout(expireDisplay,Math.max(0,visibleUntil-Date.now()));
  }
  function apply(data,action,hadPin){
    const previous=stage;
    if(data.session)remember(data.session,action==='start');
    stage=data.status;
    if(stage==='waiting'&&previous==='scanned'&&action==='poll')stage='scanned';
    $('wechatPinBox').hidden=stage!=='pin';
    $('wechatRetry').hidden=true;$('wechatGet').hidden=true;
    if(data.officialUrl)showCode(data);
    if(stage==='waiting'||stage==='checking'){
      if(stage==='checking'||(visibleUntil&&Date.now()>=visibleUntil))clearCode();
      if($('wechatQR').hidden){
        status('正在核对微信绑定状态，也可以换一张新码。');renew('重新获取二维码');
      }else{
        status('用另一部手机的微信扫一扫，或在这部手机上点「打开微信官方绑定入口」。请用 UU 的微信确认，再回到这里。');
      }
      schedulePoll(action==='view'?0:2200);return;
    }
    clearCode();
    if(stage==='scanned'){
      status('微信已扫码。请按微信提示确认，再回到这里查看结果。');schedulePoll();return;
    }
    if(stage==='pin'){
      status(hadPin?'微信仍在等待配对数字，请核对手机上显示的数字再提交。':'微信要求配对。请在下方输入 UU 手机上显示的数字。');
      $('wechatPin').value='';$('wechatPinSend').disabled=false;return;
    }
    const messages={
      idle:'准备好后再获取二维码，使用 UU 自己的微信确认。',
      expired:'这次绑定码已过期。准备好后可以重新获取。',
      pin_blocked:'这次配对数字已失效，请获取新的绑定码。',
      existing:'微信提示已有绑定，本次没有返回新的授权。可在微信 ClawBot 中查看原来的连接。',
      bound:'UU 的微信授权已保存。微信消息由小麦的独立接入服务在运行时收发。'
    };
    if(!Object.hasOwn(messages,stage))throw Error('invalid_wechat_response');
    remember('');status(messages[stage]);
    if(stage!=='bound')renew(stage==='idle'?'获取二维码':'重新获取二维码');
  }
  const errors={
    access_required:'请用发给 UU 的原专属链接打开小麦，再连接微信。',
    binding_storage_unavailable:'暂时连不上保存微信授权的服务，请稍后重试。',
    binding_not_configured:'微信绑定服务暂时无法使用，请稍后重试。',
    wechat_unavailable:'暂时连不上微信，可以稍后重试。',
    wechat_rejected:'微信暂未接受这次请求，请稍后再试。',
    invalid_pin:'请输入微信显示的 4 至 12 位数字。',
    account_already_bound:'小麦已有一个已保存的微信绑定。'
  };
  async function run(action,pin){
    if(!open())return;
    if(controller){if(action==='poll'&&!pin)return;interrupt()}
    clearTimeout(timer);
    const current=++revision,request=new AbortController();
    controller=request;
    const secret=access();
    if(!secret){controller=null;clearCode();$('wechatGet').hidden=true;$('wechatRetry').hidden=true;status(errors.access_required);return}
    if(action==='start'){
      clearCode();$('wechatPinBox').hidden=true;$('wechatRetry').hidden=true;
      $('wechatGet').hidden=false;$('wechatGet').disabled=true;status('正在向微信获取新二维码…');
    }else if(pin){$('wechatPinSend').disabled=true;status('正在向微信核对配对数字…')}
    const timeout=setTimeout(()=>request.abort(),action==='poll'?48000:21000);
    try{
      const url=new URL('wechat-bind',window.XIAOMAI_CHAT_CONFIG.endpoint);
      const body={action};if(ticket&&action!=='start')body.session=ticket;if(pin)body.pin=pin;
      const res=await fetch(url.href,{method:'POST',headers:{'Content-Type':'application/json','X-Xiaomai-Access':secret},credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',body:JSON.stringify(body),signal:request.signal});
      const data=await res.json();
      if(current!==revision||!open())return;
      if(!res.ok)throw Error(data.error||'binding_unavailable');
      retries=0;
      apply(data,action,Boolean(pin));
    }catch(error){
      if(current!==revision||!open())return;
      status(errors[error.message]||'这次没能取得微信状态，请点一下重试。');
      if(error.message==='access_required'){clearCode();$('wechatGet').hidden=true;$('wechatRetry').hidden=true;return}
      if(pin){$('wechatPinSend').disabled=false;return}
      if(ticket){
        $('wechatRetry').hidden=false;
        if($('wechatQR').hidden)renew('重新获取二维码');
        if(action==='poll'&&retries<3)schedulePoll(2000*(++retries));
      }else renew('获取二维码');
    }finally{
      clearTimeout(timeout);if(current===revision)controller=null;
    }
  }
  function guide(){
    interrupt();ticket=readTicket();stage='idle';visibleUntil=0;retries=0;
    openSheet('连接微信','<div class="wechat-bind" id="wechatBinding"><p id="wechatStatus" role="status" aria-live="polite">正在查看微信连接…</p><img id="wechatQR" class="wechat-qr" alt="小麦的微信 ClawBot 临时绑定二维码" width="320" height="320" hidden><a class="wechat-link" id="wechatOfficial" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" hidden>打开微信官方绑定入口</a><button type="button" class="wechat-main" id="wechatGet">获取二维码</button><div id="wechatPinBox" hidden><label>微信配对数字<input id="wechatPin" inputmode="numeric" autocomplete="one-time-code" maxlength="12" pattern="[0-9]{4,12}"></label><button type="button" class="wechat-main" id="wechatPinSend">提交配对数字</button></div><button type="button" class="wechat-secondary" id="wechatRetry" hidden>重新查询绑定状态</button><button type="button" class="wechat-secondary" id="wechatBack">返回设置</button></div>','wechat-bind');
    $('wechatGet').onclick=()=>run('start');
    $('wechatRetry').onclick=()=>{retries=0;run(ticket?'poll':'view')};
    $('wechatBack').onclick=settings;
    const submit=()=>{const pin=$('wechatPin').value.trim();if(!/^\d{4,12}$/.test(pin)){status(errors.invalid_pin);$('wechatPin').focus();return}$('wechatPin').value='';run('poll',pin)};
    $('wechatPinSend').onclick=submit;
    $('wechatPin').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();submit()}};
    if(ticket)$('wechatGet').hidden=true;
    run('view');
  }
  function resume(){
    if(!foreground())return;
    const saved=readTicket();
    if(saved&&saved!==ticket){ticket=saved;interrupt()}
    if(visibleUntil&&Date.now()>=visibleUntil)expireDisplay();
    if(ticket&&!controller&&stage!=='pin')run('poll');
  }
  window.addEventListener('pageshow',resume);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer);else resume()});
  function mount(){
    const box=$('wechatSettings');if(!box)return;
    box.innerHTML='<div class="wechat-card"><strong>微信 ClawBot</strong><p>用 UU 的微信绑定小麦。</p><button id="wechatConnect" type="button">连接微信</button></div>';
    $('wechatConnect').onclick=guide;
  }
  window.XM_WECHAT={settings:mount,settingsPage:()=>settings(),guide,leave};
})();
