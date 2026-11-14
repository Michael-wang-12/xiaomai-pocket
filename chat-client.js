(()=>{
  const $=id=>document.getElementById(id),input=$('chatInput'),form=$('chatForm'),send=form.querySelector('button');
  const mode=$('chatMode'),historyButton=$('chatHistoryButton'),config=window.XIAOMAI_CHAT_CONFIG||{};
  const endpoint=typeof config.endpoint==='string'?config.endpoint:'';
  const memoryKey='xiaomai-dialogue-preferences-v1',exampleKey='xiaomai-expression-examples-v1',retentionKey='xiaomai-chat-retention-v1';
  let access='',busy=false,sequence=0,controller=null,entries=[],effort='medium',preferences=[],examples=[],retention='30',storageProblem='';
  const uid=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10),limits=new Set(['off','7','30','forever']);
  try{const saved=JSON.parse(localStorage.getItem(memoryKey)||'[]');if(Array.isArray(saved))preferences=[...new Set(saved.filter(x=>typeof x==='string'&&x.trim()&&x.length<=120))].slice(-12)}catch{}
  try{const saved=JSON.parse(localStorage.getItem(exampleKey)||'[]');if(Array.isArray(saved))examples=saved.filter(x=>x&&typeof x.id==='string'&&typeof x.prompt==='string'&&x.prompt.length<=200&&typeof x.original==='string'&&x.original.length<=400&&typeof x.preferred==='string'&&x.preferred.trim()&&x.preferred.length<=400).slice(-6)}catch{}
  try{const saved=localStorage.getItem('xiaomai-reasoning');if(['low','medium','high'].includes(saved))effort=saved;const r=localStorage.getItem(retentionKey);if(limits.has(r))retention=r}catch{}
  try{const shared=new URLSearchParams(location.hash.slice(1)).get('pocket');if(shared&&/^[\w-]{32,128}$/.test(shared))sessionStorage.setItem('xiaomai-chat-access',shared);access=sessionStorage.getItem('xiaomai-chat-access')||''}catch{}
  const online=Boolean(endpoint&&access),chatKey='xiaomai-conversations-v1-'+(online?'smart':'preset');
  function prune(){const cutoff=retention==='forever'||retention==='off'?0:Date.now()-Number(retention)*86400000;entries=entries.filter(x=>x.at>=cutoff).slice(-200)}
  try{
    if(retention!=='off'){
      const saved=JSON.parse(localStorage.getItem(chatKey)||'null');
      if(saved!==null&&(!saved||saved.version!==1||!Array.isArray(saved.entries)))throw Error();
      if(saved)entries=saved.entries.filter(x=>x&&['user','assistant','notice'].includes(x.role)&&typeof x.id==='string'&&x.id.length<=80&&typeof x.text==='string'&&x.text.trim()&&x.text.length<=800&&Number.isFinite(x.at)&&x.at>0&&x.at<=Date.now()+86400000).map(x=>({...x,replyTo:typeof x.replyTo==='string'?x.replyTo:'',pending:false}));
      prune();
      if(saved?.entries.some(x=>x?.pending))entries.push({id:uid(),role:'notice',text:'上次没有收到完整回答，可以重新发那句话。未完成的回复不会被当作聊天记忆。',at:Date.now()});
    }
  }catch{storageProblem='之前的聊天存档未能读取，原存档暂未覆盖。清空聊天后可以重新开始保存。'}
  const actions=new Set(['none','company','hug','five','fist','wave','thumb','laugh','encourage','night','blush','shy','proud','surprised','listen']);
  $('composer').addEventListener('pointerdown',e=>{if(e.target.closest('button')&&document.activeElement===input)e.preventDefault()});
  const memoryButton=document.createElement('button');memoryButton.type='button';memoryButton.className='history-link';memoryButton.id='chatMemoryButton';historyButton.before(memoryButton);
  const teachButton=document.createElement('button');teachButton.type='button';teachButton.className='history-link';teachButton.id='chatTeachButton';teachButton.textContent='教这句';memoryButton.before(teachButton);
  const lastReply=()=>[...entries].reverse().find(x=>x.role==='assistant');
  function updateMemoryButton(){memoryButton.textContent=preferences.length||examples.length?'偏好与例句 '+(preferences.length+examples.length):'偏好与例句';teachButton.disabled=busy||!lastReply()}
  function savePreferences(next){try{localStorage.setItem(memoryKey,JSON.stringify(next));preferences=next;updateMemoryButton();return true}catch{add('notice','这次没能保存偏好，刷新后的记忆以「偏好与例句」里显示的内容为准。');toast('偏好没有保存成功');return false}}
  function saveExamples(next){try{localStorage.setItem(exampleKey,JSON.stringify(next));examples=next;updateMemoryButton();return true}catch{toast('例句未能保存，请先腾出浏览器存储空间');return false}}
  function applyMemory(memory){if(!memory||typeof memory.text!=='string'||memory.text.length>120)return;const text=memory.text.trim();let next;if(memory.operation==='remember'&&text)next=[...preferences.filter(x=>x!==text),text].slice(-12);else if(memory.operation==='forget'&&preferences.includes(text))next=preferences.filter(x=>x!==text);else if(memory.operation==='clear')next=[];else return;if(savePreferences(next))toast(memory.operation==='remember'?'已记住这条偏好 · 本浏览器':'已忘记所选偏好')}
  function saveConversation(){
    if(storageProblem)return false;
    try{prune();if(retention==='off')localStorage.removeItem(chatKey);else localStorage.setItem(chatKey,JSON.stringify({version:1,entries}));return true}
    catch{storageProblem='聊天暂未保存，浏览器存储可能已满或不可用。当前对话可以继续，刷新后可能丢失。';toast('聊天暂未保存');return false}
  }
  function pairs(){prune();const users=new Map(entries.filter(x=>x.role==='user').map(x=>[x.id,x])),used=new Set(),result=[];for(const e of entries){const u=users.get(e.replyTo);if(e.role==='assistant'&&u&&!used.has(u.id)){result.push({role:'user',content:u.text},{role:'assistant',content:e.text});used.add(u.id)}}return result.slice(-12)}
  function refreshEffort(){document.querySelectorAll('[data-effort]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.effort===effort));b.disabled=busy});$('modelControls').hidden=!online}
  $('modelControls').onclick=e=>{const b=e.target.closest('[data-effort]');if(!b||busy)return;effort=b.dataset.effort;try{localStorage.setItem('xiaomai-reasoning',effort)}catch{}refreshEffort()};
  function setBusy(value){busy=value;send.disabled=value;memoryButton.disabled=value;send.textContent=value?'…':'↑';send.setAttribute('aria-label',value?'小麦正在思考':'发送');form.setAttribute('aria-busy',String(value));mode.textContent=value?'小麦正在认真想…':online?'智能对话 · OpenAI':'本机趣味对话';refreshEffort();updateMemoryButton()}
  function add(role,text,extra={}){const entry={id:uid(),role,text,at:Date.now(),...extra};entries.push(entry);saveConversation();updateMemoryButton();if(dialogKind==='chat-history')renderHistory();return entry}
  function renderPreferences(){
    const box=$('chatPreferences');if(!box)return;box.replaceChildren();
    for(const [index,text]of preferences.entries()){const row=document.createElement('div');row.className='preference-row';const p=document.createElement('p');p.textContent=text;const b=document.createElement('button');b.type='button';b.textContent='删除';b.setAttribute('aria-label','删除偏好 '+(index+1));b.onclick=()=>{if(savePreferences(preferences.filter((_,i)=>i!==index)))renderPreferences()};row.append(p,b);box.append(row)}
    if(!preferences.length){const p=document.createElement('p');p.textContent='可以说：记住，以后回答短一点。';box.append(p)}
    const list=$('expressionExamples');list.replaceChildren();
    for(const e of [...examples].reverse()){const row=document.createElement('div');row.className='expression-example';const p=document.createElement('p');p.textContent='你说：'+e.prompt+'\n希望小麦这样接：'+e.preferred;const b=document.createElement('button');b.type='button';b.textContent='修改';b.onclick=()=>showTeaching(null,e);const d=document.createElement('button');d.type='button';d.textContent='删除';d.onclick=()=>{if(saveExamples(examples.filter(x=>x.id!==e.id)))renderPreferences()};row.append(p,b,d);list.append(row)}
    if(!examples.length){const p=document.createElement('p');p.textContent='在回复上长按，或点「教这句」，留下你认可的接话方式。';list.append(p)}
  }
  function showPreferences(){openSheet('偏好与说话例句','<p>偏好最多12条，例句最多6组。只保存在当前浏览器，智能聊天时随消息发送，换手机不会同步。你可以随时修改或删除。</p><h3>交流偏好</h3><div id="chatPreferences"></div><button class="primary" id="clearPreferences">忘记全部偏好</button><h3>你教的说话例句</h3><div id="expressionExamples"></div>','chat-preferences');renderPreferences();$('clearPreferences').onclick=()=>{if(savePreferences([])){renderPreferences();toast('已忘记本浏览器的偏好')}}}
  function showTeaching(entry,example){
    if(busy){toast('等小麦说完再教这句吧');return}
    if(!entry&&!example)return;
    const user=entry&&entries.find(x=>x.id===entry.replyTo),existing=example||examples.find(x=>x.entryId===entry?.id);
    openSheet('这句不像你？教我怎么说','<p>写下你希望的接话方式。保存后，智能聊天中的相似话题会参考这组例句，不会把它当成真实经历。</p><div class="teaching-source" id="teachingSource"></div><label for="teachingText">希望小麦这样回答</label><textarea id="teachingText" class="teaching-text" maxlength="400" rows="4" placeholder="用你觉得像小麦的方式接这句话……"></textarea><p class="small" id="teachingHint"></p><div class="teaching-buttons"><button class="primary" id="saveTeaching">保存这组例句</button><button id="cancelTeaching">取消</button></div><p id="teachingError" role="status"></p>','chat-teaching');
    const prompt=existing?.prompt||(user?.text||'日常接话').slice(0,200),original=existing?.original||(entry?.text||'').slice(0,400);
    $('teachingSource').textContent='你说：'+prompt+'\n原来的回答：'+original;
    $('teachingText').value=existing?.preferred||'';
    const count=()=>$('teachingHint').textContent=$('teachingText').value.length+'/400字 · 最多6组'+(!existing&&examples.length>=6?'，保存会替换最早的一组':'');count();$('teachingText').oninput=count;
    $('cancelTeaching').onclick=history;
    $('saveTeaching').onclick=()=>{
      const preferred=$('teachingText').value.trim();if(!preferred){$('teachingError').textContent='先写一句你希望小麦怎么回答。';$('teachingText').focus();return}
      const next={id:existing?.id||uid(),entryId:entry?.id||existing?.entryId||'',prompt,original,preferred,at:Date.now()};
      if(!saveExamples([...examples.filter(x=>x.id!==next.id),next].slice(-6)))return;
      const target=entry||entries.find(x=>x.id===existing?.entryId);if(target){target.text=preferred;target.edited=true;saveConversation();if(lastReply()?.id===target.id)say(preferred)}
      history();toast('例句已保存，下次聊天会参考');
    };
  }
  function longPress(node,entry){let timer=0,start=null,opened=false;node.addEventListener('pointerdown',e=>{if(e.target.closest('button')||busy)return;opened=false;start={x:e.clientX,y:e.clientY};timer=setTimeout(()=>{opened=true;showTeaching(entry)},600)});const cancel=()=>{clearTimeout(timer);start=null};node.addEventListener('pointermove',e=>{if(start&&Math.abs(e.clientX-start.x)+Math.abs(e.clientY-start.y)>12)cancel()});node.addEventListener('pointerup',cancel);node.addEventListener('pointercancel',cancel);node.addEventListener('contextmenu',e=>{if(opened)e.preventDefault()})}
  function renderHistory(){
    const box=$('chatHistory');if(!box)return;prune();box.replaceChildren();
    for(const entry of entries){const row=document.createElement('div');row.className='conversation '+entry.role;row.dataset.entryId=entry.id;const name=document.createElement('b');name.textContent=entry.role==='user'?'你':entry.role==='assistant'?'小麦':'提示';const time=document.createElement('time');time.dateTime=new Date(entry.at).toISOString();time.textContent=new Date(entry.at).toLocaleString([],{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});const text=document.createElement('p');text.textContent=entry.text;row.append(name,time,text);
      if(entry.role==='assistant'){const b=document.createElement('button');b.className='teach-entry';b.type='button';b.textContent=entry.edited?'你教的表达 · 再修改':'这句不像你';b.disabled=busy;b.onclick=()=>showTeaching(entry);row.append(b);longPress(row,entry)}box.append(row)}
    if(!entries.length){const p=document.createElement('p');p.textContent='想聊什么都可以，从一句你好开始。';box.append(p)}box.scrollTop=box.scrollHeight;
    if($('chatStorageWarning'))$('chatStorageWarning').textContent=storageProblem;
  }
  function clear(){sequence++;controller?.abort();controller=null;entries=[];storageProblem='';setBusy(false);saveConversation();say('从这句重新开始吧，我听着。');renderHistory();toast('聊天记录已清空')}
  function history(){
    openSheet('和小麦接着聊','<p id="chatPrivacy"></p><label class="retention-setting" for="chatRetention">聊天记录保留<select id="chatRetention"><option value="7">7天</option><option value="30">30天</option><option value="forever">一直保留</option><option value="off">仅本次打开</option></select></label><p id="chatStorageWarning" class="storage-warning" role="status"></p><div id="chatHistory" class="conversation-list" role="log" aria-live="polite"></div><button class="primary" id="clearConversation">清空聊天记录</button>','chat-history');
    $('chatPrivacy').textContent=(online?'智能回复由 OpenAI 生成。最近六轮完整对话、保存的偏好与例句会随新消息发送。':'当前使用本机预设对话。')+'记录最多保留最近200条，仅在当前浏览器。清除网站数据会丢失；偏好与例句单独管理。';
    $('chatRetention').value=retention;$('chatRetention').onchange=e=>{const next=e.target.value;try{localStorage.setItem(retentionKey,next);retention=next;if(!saveConversation())return;renderHistory();toast(next==='off'?'聊天仅保留在本次打开期间':'已更新聊天保留时间')}catch{toast('保留设置没能保存，请稍后再试')}};
    $('clearConversation').onclick=()=>{if(confirm('清空本浏览器的聊天记录？已教的偏好和例句会保留。'))clear()};renderHistory();
  }
  memoryButton.onclick=showPreferences;teachButton.onclick=()=>showTeaching(lastReply());
  // The compact reply always teaches the latest completed message.
  let peekTimer=0,peekStart=null;$('replyPeek').addEventListener('pointerdown',e=>{peekStart={x:e.clientX,y:e.clientY};peekTimer=setTimeout(()=>showTeaching(lastReply()),600)});const cancelPeek=()=>{clearTimeout(peekTimer);peekStart=null};$('replyPeek').addEventListener('pointerup',cancelPeek);$('replyPeek').addEventListener('pointercancel',cancelPeek);$('replyPeek').addEventListener('pointermove',e=>{if(peekStart&&Math.abs(e.clientX-peekStart.x)+Math.abs(e.clientY-peekStart.y)>12)cancelPeek()});
  const errors={access_required:'这条智能聊天链接暂时不可用了。请向分享者获取新链接，动作和小游戏仍能玩。',not_configured:'小麦的智能聊天还在准备中，先一起玩个小游戏吧。',too_many_requests:'消息来得有点快，等一分钟再和小麦聊吧。',model_limit:'模型额度或请求量暂时受限，请稍后再试。'};
  async function readReply(response,onPartial){
    if(!response.ok){const error=await response.json();throw Object.assign(Error('request failed'),{code:error.error})}
    if(!response.headers?.get('content-type')?.includes('application/x-ndjson'))return response.json();
    let pending='',answer=null;function line(raw){if(!raw.trim())return;const item=JSON.parse(raw);if(item.type==='delta'&&typeof item.text==='string'&&item.text.length<=800)onPartial(item.text);if(item.type==='done')answer=item;if(item.type==='error')throw Object.assign(Error('stream failed'),{code:item.error})}
    if(response.body?.getReader){const reader=response.body.getReader(),decoder=new TextDecoder();try{while(true){const {value,done}=await reader.read();if(done){pending+=decoder.decode();break}pending+=decoder.decode(value,{stream:true});let end;while((end=pending.indexOf('\n'))>=0){line(pending.slice(0,end));pending=pending.slice(end+1)}if(pending.length>20000)throw Error('invalid stream')}if(pending.trim())line(pending)}finally{reader.releaseLock()}}
    else for(const raw of(await response.text()).split('\n'))line(raw);if(!answer)throw Error('incomplete stream');return answer;
  }
  async function chat(text){
    text=String(text||'').trim().slice(0,600);if(!text)return;if(busy){toast('等小麦说完这一句，再继续聊吧');return}
    const context=pairs(),previous=lastReply(),user=add('user',text,{pending:online});
    if(!online){offlineChat(text);add('assistant',$('speech').textContent,{replyTo:user.id});return}
    setBusy(true);const id=++sequence,actionCount=XM.state.total,requestController=new AbortController();controller=requestController;const timer=setTimeout(()=>requestController.abort(),110000);
    try{
      const response=await fetch(endpoint,{method:'POST',credentials:'omit',redirect:'error',headers:{'Content-Type':'application/json','X-Xiaomai-Access':access},body:JSON.stringify({message:text,history:context,outfit:XM.state.outfit,scene:XM.state.scene,effort,clientVersion:3,preferences,examples:examples.map(({prompt,original,preferred})=>({prompt,original,preferred})),lastReplyAt:previous?.at||0,timezoneOffset:new Date().getTimezoneOffset(),stream:true}),signal:requestController.signal});
      const data=await readReply(response,partial=>{if(id===sequence){say(partial);mode.textContent='小麦正在说…'}});if(id!==sequence)return;
      if(typeof data.reply!=='string'||!data.reply.trim()||data.reply.length>800||!actions.has(data.action))throw Error('invalid reply');
      user.pending=false;add('assistant',data.reply,{replyTo:user.id});window.XM.showAIReply(data.reply,data.action,XM.state.total===actionCount);applyMemory(data.memory);
    }catch(error){if(id!==sequence)return;user.pending=false;const message=errors[error.code]||'这次没连上小麦的智能对话，请稍后再发一次。你的穿搭和游戏进度都还在。';add('notice',message);say(message);toast(message)}
    finally{clearTimeout(timer);if(id===sequence){controller=null;setBusy(false)}}
  }
  form.onsubmit=e=>{e.preventDefault();if(busy){toast('等小麦说完这一句，再继续聊吧');return}const text=input.value.trim();if(!text)return;input.value='';void chat(text)};
  historyButton.onclick=history;
  window.XM_AI={send:chat,history,clear,get preferences(){return [...preferences]},get examples(){return examples.map(x=>({...x}))},get entries(){return entries.map(x=>({...x}))},get retention(){return retention},get busy(){return busy},get online(){return online},get effort(){return effort},get model(){return 'gpt-6.1-terra'},get turns(){return pairs()}};
  input.maxLength=600;setBusy(false);if(lastReply())say(lastReply().text);if(storageProblem)toast('之前的聊天暂未读取，请打开聊天记录查看');else saveConversation();
})();
