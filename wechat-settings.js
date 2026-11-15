(()=>{
  const $=id=>document.getElementById(id);
  const sessionKey='xiaomai-wechat-pending-v1';
  let ticket='',timer,displayTimer,controller,revision=0,stage='idle',visibleUntil=0,retries=0;
  let account=null,watchTimer,watchRequest,renewing=false;
  const relayMessages={
    online:'微信收发服务最近在线。',
    offline:'微信收发服务暂时离线。',
    expired:'微信授权已失效，收发消息需要重新授权。',
    unknown:'微信收发服务状态待确认。'
  };
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
  function open(){return Boolean($('wechatBinding')&&!$('veil').hidden)}
  function foreground(){return open()&&document.visibilityState!=='hidden'}
  function watching(){return document.visibilityState!=='hidden'&&!$('veil')?.hidden&&Boolean(open()||$('wechatSummary'))}
  function stopWatch(){
    clearTimeout(watchTimer);
    if(watchRequest)watchRequest.abort();
    watchRequest=null;
  }
  function scheduleWatch(delay=account?.status==='bound'&&account.relay!=='expired'?30000:8000){
    clearTimeout(watchTimer);
    if(watching())watchTimer=setTimeout(checkShared,delay);
  }
  function write(id,value){
    const element=$(id);
    if(element&&element.textContent!==value)element.textContent=value;
  }
  function drawCard(unavailable=false){
    if(!$('wechatSummary'))return;
    const bound=account?.status==='bound';
    const label=bound?(account.relay==='expired'?'授权已失效':'已连接'):'未连接';
    write('wechatSummary',unavailable?(bound?label+'（上次确认）':'暂时无法查询微信连接'):account?label:'正在查询微信连接…');
    write('wechatSummaryDetail',unavailable?'稍后会自动重试。':bound?relayMessages[account.relay]:'用 UU 的微信确认后，所有设备共用这个连接。');
    write('wechatConnect',bound||unavailable?'查看连接':'连接微信');
  }
  function recordAccount(data){
    const relay=Object.hasOwn(relayMessages,data.relay)?data.relay:'unknown';
    account={status:data.status,relay};
    drawCard();
  }
  async function requestBinding(body,signal){
    const url=new URL('wechat-bind',window.XIAOMAI_CHAT_CONFIG.endpoint);
    const res=await fetch(url.href,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',body:JSON.stringify(body),signal});
    const data=await res.json();
    if(!res.ok)throw Error(data.error||'binding_unavailable');
    return data;
  }
  async function checkShared(){
    if(!watching()||watchRequest)return;
    const request=new AbortController();
    watchRequest=request;
    const timeout=setTimeout(()=>request.abort(),12000);
    try{
      // No device ticket: this only reads UU's shared binding, even while another phone is pairing.
      const data=await requestBinding({action:'view'},request.signal);
      if(request!==watchRequest||!watching())return;
      if(data.status!=='idle'&&data.status!=='bound')throw Error('invalid_wechat_response');
      recordAccount(data);
      if(open()){
        if((renewing||(stage==='loading'&&ticket))&&['expired','unknown'].includes(data.relay))return;
        if(data.status==='bound'&&stage==='bound')showBound();
        else if(data.status==='bound'||stage==='bound'||(stage==='loading'&&!ticket)){
          interrupt();apply(data,'view',false);
        }
      }
    }catch{
      if(request!==watchRequest||!watching())return;
      drawCard(true);
      if(open()&&stage==='bound')write('wechatService','暂时无法刷新微信收发状态。');
    }finally{
      clearTimeout(timeout);
      if(request===watchRequest){watchRequest=null;scheduleWatch()}
    }
  }
  function interrupt(){
    revision++;clearTimeout(timer);clearTimeout(displayTimer);
    if(controller)controller.abort();
    controller=null;
  }
  function leave(){interrupt();stopWatch()}
  function clearCode(){
    clearTimeout(displayTimer);visibleUntil=0;
    const image=$('wechatQR'),link=$('wechatOfficial');
    image.hidden=true;image.removeAttribute('src');link.hidden=true;link.removeAttribute('href');
  }
  function status(value){$('wechatStatus').textContent=value}
  function showBound(){
    write('wechatStatus',account?.relay==='expired'?'云端已保存这次微信绑定。':'微信已连接，授权已保存。');
    $('wechatService').hidden=false;
    write('wechatService',relayMessages[account?.relay]||relayMessages.unknown);
    if(account?.relay==='expired')renew('获取二维码重新授权');
    else $('wechatGet').hidden=true;
  }
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
    if(data.renewal)renewing=true;
    stage=data.status;
    $('wechatService').hidden=stage!=='bound';
    if(stage==='waiting'&&previous==='scanned'&&action==='poll')stage='scanned';
    $('wechatPinBox').hidden=stage!=='pin';
    $('wechatRetry').hidden=true;$('wechatGet').hidden=true;
    if(data.officialUrl)showCode(data);
    if(stage==='waiting'||stage==='checking'){
      if(stage==='checking'||(visibleUntil&&Date.now()>=visibleUntil))clearCode();
      if($('wechatQR').hidden){
        status('正在核对微信绑定状态，也可以换一张新码。');renew('重新获取二维码');
      }else{
        status(renewing?'请用上次绑定的 UU 微信扫码，或点「打开微信官方绑定入口」重新授权。':'用另一部手机的微信扫一扫，或在这部手机上点「打开微信官方绑定入口」。请用 UU 的微信确认，再回到这里。');
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
      idle:'准备好后点「获取二维码」。首次在微信确认的账号会绑定到小麦，请用 UU 自己的微信操作。',
      expired:'这次绑定码已过期。准备好后可以重新获取。',
      pin_blocked:'这次配对数字已失效，请获取新的绑定码。',
      existing:'微信提示已有绑定，本次没有返回新的授权。可在微信 ClawBot 中查看原来的连接。'
    };
    renewing=false;
    if(stage==='bound'){remember('');showBound();return}
    if(!Object.hasOwn(messages,stage))throw Error('invalid_wechat_response');
    remember('');status(messages[stage]);
    renew(stage==='idle'?'获取二维码':'重新获取二维码');
  }
  const errors={
    binding_storage_unavailable:'暂时连不上保存微信授权的服务，请稍后重试。',
    binding_not_configured:'微信绑定服务暂时无法使用，请稍后重试。',
    wechat_unavailable:'暂时连不上微信，可以稍后重试。',
    wechat_rejected:'微信暂未接受这次请求，请稍后再试。',
    invalid_pin:'请输入微信显示的 4 至 12 位数字。',
    account_already_bound:'小麦已有一个已保存的微信绑定。',
    wrong_wechat_account:'扫码的微信与上次绑定的账号不同。请重新获取二维码，用 UU 原来的微信确认。',
    renewal_state_unavailable:'暂时无法核对原来的授权。请稍后点「重新查询绑定状态」。'
  };
  async function run(action,pin){
    if(!open())return;
    if(controller){if(action==='poll'&&!pin)return;interrupt()}
    clearTimeout(timer);
    const current=++revision,request=new AbortController();
    controller=request;
    if(action==='start'){
      renewing=account?.relay==='expired'||renewing;stage='starting';
      clearCode();$('wechatPinBox').hidden=true;$('wechatRetry').hidden=true;
      $('wechatGet').hidden=false;$('wechatGet').disabled=true;status('正在向微信获取新二维码…');
    }else if(pin){$('wechatPinSend').disabled=true;status('正在向微信核对配对数字…')}
    const timeout=setTimeout(()=>request.abort(),action==='poll'?48000:21000);
    try{
      const body={action};if(ticket&&action!=='start')body.session=ticket;if(pin)body.pin=pin;
      const data=await requestBinding(body,request.signal);
      if(current!==revision||!open())return;
      if(data.status==='bound'||data.status==='idle'){
        stopWatch();recordAccount(data);
        scheduleWatch(data.status==='bound'&&!data.relay?0:undefined);
      }
      retries=0;
      apply(data,action,Boolean(pin));
    }catch(error){
      if(current!==revision||!open())return;
      if(error.message==='wrong_wechat_account'){
        renewing=false;stage='bound';remember('');clearCode();
        recordAccount({status:'bound',relay:'expired'});showBound();
        $('wechatPinBox').hidden=true;$('wechatRetry').hidden=true;
        status(errors.wrong_wechat_account);return;
      }
      status(errors[error.message]||'这次没能取得微信状态，请点一下重试。');
      if(pin){$('wechatPinSend').disabled=false;return}
      if(ticket){
        $('wechatRetry').hidden=false;
        if($('wechatQR').hidden)renew('重新获取二维码');
        if(action==='poll'&&retries<3)schedulePoll(2000*(++retries));
      }else if(action==='start')renew('获取二维码');
      else $('wechatRetry').hidden=false;
    }finally{
      clearTimeout(timeout);if(current===revision)controller=null;
    }
  }
  function guide(){
    leave();ticket=readTicket();stage='loading';visibleUntil=0;retries=0;renewing=false;
    openSheet('连接微信','<div class="wechat-bind" id="wechatBinding"><p id="wechatStatus" role="status" aria-live="polite">正在查看微信连接…</p><p id="wechatService" role="status" hidden></p><img id="wechatQR" class="wechat-qr" alt="小麦的微信 ClawBot 临时绑定二维码" width="320" height="320" hidden><a class="wechat-link" id="wechatOfficial" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" hidden>打开微信官方绑定入口</a><button type="button" class="wechat-main" id="wechatGet" hidden>获取二维码</button><div id="wechatPinBox" hidden><label>微信配对数字<input id="wechatPin" inputmode="numeric" autocomplete="one-time-code" maxlength="12" pattern="[0-9]{4,12}"></label><button type="button" class="wechat-main" id="wechatPinSend">提交配对数字</button></div><button type="button" class="wechat-secondary" id="wechatRetry" hidden>重新查询绑定状态</button><button type="button" class="wechat-secondary" id="wechatBack">返回设置</button></div>','wechat-bind');
    $('wechatGet').onclick=()=>run('start');
    $('wechatRetry').onclick=()=>{retries=0;run(ticket?'poll':'view')};
    $('wechatBack').onclick=settings;
    const submit=()=>{const pin=$('wechatPin').value.trim();if(!/^\d{4,12}$/.test(pin)){status(errors.invalid_pin);$('wechatPin').focus();return}$('wechatPin').value='';run('poll',pin)};
    $('wechatPinSend').onclick=submit;
    $('wechatPin').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();submit()}};
    scheduleWatch();
    run('view');
  }
  function resume(){
    if(!watching())return;
    clearTimeout(watchTimer);
    checkShared();
    if(!foreground())return;
    const saved=readTicket();
    if(saved&&saved!==ticket){ticket=saved;interrupt()}
    if(visibleUntil&&Date.now()>=visibleUntil)expireDisplay();
    if(ticket&&!controller&&stage!=='pin')run('poll');
  }
  window.addEventListener('pageshow',resume);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(timer);stopWatch()}else resume()});
  function mount(){
    const box=$('wechatSettings');if(!box)return;
    stopWatch();
    box.innerHTML='<div class="wechat-card"><strong>微信 ClawBot · <span id="wechatSummary" role="status">正在查询微信连接…</span></strong><p id="wechatSummaryDetail" role="status"></p><button id="wechatConnect" type="button">连接微信</button></div>';
    $('wechatConnect').onclick=guide;
    drawCard();checkShared();
  }
  window.XM_WECHAT={settings:mount,settingsPage:()=>settings(),guide,leave};
})();
