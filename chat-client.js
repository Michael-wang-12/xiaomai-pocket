(()=>{
  const $=id=>document.getElementById(id),input=$('chatInput'),form=$('chatForm'),send=form.querySelector('button');
  const mode=$('chatMode'),historyButton=$('chatHistoryButton'),config=window.XIAOMAI_CHAT_CONFIG||{};
  const endpoint=typeof config.endpoint==='string'?config.endpoint:'';
  const memoryKey='xiaomai-dialogue-preferences-v1',exampleKey='xiaomai-expression-examples-v1',retentionKey='xiaomai-chat-retention-v1';
  let access='',busy=false,sequence=0,controller=null,entries=[],effort='medium',preferences=[],examples=[],retention='30',storageProblem='';
  const sessionOnly=new Set();
  const uid=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10),limits=new Set(['off','7','30','forever']);
  try{const saved=JSON.parse(localStorage.getItem(memoryKey)||'[]');if(Array.isArray(saved))preferences=[...new Set(saved.filter(x=>typeof x==='string'&&x.trim()&&x.length<=120))].slice(-12)}catch{}
  try{const saved=JSON.parse(localStorage.getItem(exampleKey)||'[]');if(Array.isArray(saved))examples=saved.filter(x=>x&&typeof x.id==='string'&&typeof x.prompt==='string'&&x.prompt.length<=200&&typeof x.original==='string'&&x.original.length<=400&&typeof x.preferred==='string'&&x.preferred.trim()&&x.preferred.length<=400).slice(-6)}catch{}
  try{const saved=localStorage.getItem('xiaomai-reasoning');if(['low','medium','high'].includes(saved))effort=saved;const r=localStorage.getItem(retentionKey);if(limits.has(r))retention=r}catch{}
  try{const shared=new URLSearchParams(location.hash.slice(1)).get('pocket');if(shared&&/^[\w-]{32,128}$/.test(shared))sessionStorage.setItem('xiaomai-chat-access',shared);access=sessionStorage.getItem('xiaomai-chat-access')||''}catch{}
  const online=Boolean(endpoint&&access),chatKey='xiaomai-conversations-v1-smart';
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
  function savePreferences(next,reason){try{localStorage.setItem(memoryKey,JSON.stringify(next));preferences=next;updateMemoryButton();window.XM_SYNC?.changed(reason);return true}catch{add('notice','这次没能保存偏好，刷新后的记忆以「偏好与例句」里显示的内容为准。');toast('偏好没有保存成功');return false}}
  function saveExamples(next){try{localStorage.setItem(exampleKey,JSON.stringify(next));examples=next;updateMemoryButton();window.XM_SYNC?.changed();return true}catch{toast('例句未能保存，请先腾出浏览器存储空间');return false}}
  function applyMemory(memory){if(!memory||typeof memory.text!=='string'||memory.text.length>120)return;const text=memory.text.trim();let next;if(memory.operation==='remember'&&text)next=[...preferences.filter(x=>x!==text),text].slice(-12);else if(memory.operation==='forget'&&preferences.includes(text))next=preferences.filter(x=>x!==text);else if(memory.operation==='clear')next=[];else return;if(savePreferences(next,memory.operation==='clear'?'clearPreferences':undefined))toast(memory.operation==='remember'?'小麦记住这条偏好了':'已忘记所选偏好')}
  function saveConversation(reason,fromCloud=false){
    if(storageProblem)return false;
    try{prune();if(retention==='off')localStorage.removeItem(chatKey);else localStorage.setItem(chatKey,JSON.stringify({version:1,entries:entries.filter(e=>!sessionOnly.has(e.id))}));if(!fromCloud)window.XM_SYNC?.changed(reason);return true}
    catch{storageProblem='聊天暂未保存，浏览器存储可能已满或不可用。当前对话可以继续，刷新后可能丢失。';toast('聊天暂未保存');return false}
  }
  function pairs(){prune();const users=new Map(entries.filter(x=>x.role==='user').map(x=>[x.id,x])),used=new Set(),result=[];for(const e of entries){const u=users.get(e.replyTo);if(e.role==='assistant'&&u&&!used.has(u.id)){result.push({role:'user',content:(u.photo?'[这条消息附带过照片，历史记录不含原图。] ':'')+u.text},{role:'assistant',content:e.text});used.add(u.id)}}return result.slice(-12)}
  function refreshEffort(){document.querySelectorAll('[data-effort]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.effort===effort));b.disabled=busy});$('modelControls').hidden=!online}
  $('modelControls').onclick=e=>{const b=e.target.closest('[data-effort]');if(!b||busy)return;effort=b.dataset.effort;try{localStorage.setItem('xiaomai-reasoning',effort)}catch{}refreshEffort();window.XM_SYNC?.changed()};
  function setBusy(value){busy=value;send.disabled=value;memoryButton.disabled=value;send.textContent=value?'…':'↑';send.setAttribute('aria-label',value?'小麦正在思考':'发送');form.setAttribute('aria-busy',String(value));mode.textContent=value?'小麦正在认真想…':online?'智能对话 · OpenAI':'预设对话';refreshEffort();updateMemoryButton()}
  function add(role,text,extra={}){const entry={id:uid(),role,text,at:Date.now(),...extra};if(retention==='off'||sessionOnly.has(entry.replyTo))sessionOnly.add(entry.id);entries.push(entry);saveConversation();updateMemoryButton();if(dialogKind==='chat-history')renderHistory();return entry}
  function renderPreferences(){
    const box=$('chatPreferences');if(!box)return;box.replaceChildren();
    for(const [index,text]of preferences.entries()){const row=document.createElement('div');row.className='preference-row';const p=document.createElement('p');p.textContent=text;const b=document.createElement('button');b.type='button';b.textContent='删除';b.setAttribute('aria-label','删除偏好 '+(index+1));b.onclick=()=>{if(savePreferences(preferences.filter((_,i)=>i!==index)))renderPreferences()};row.append(p,b);box.append(row)}
    if(!preferences.length){const p=document.createElement('p');p.textContent='可以说：记住，以后回答短一点。';box.append(p)}
    const list=$('expressionExamples');list.replaceChildren();
    for(const e of [...examples].reverse()){const row=document.createElement('div');row.className='expression-example';const p=document.createElement('p');p.textContent='你说：'+e.prompt+'\n希望小麦这样接：'+e.preferred;const b=document.createElement('button');b.type='button';b.textContent='修改';b.onclick=()=>showTeaching(null,e);const d=document.createElement('button');d.type='button';d.textContent='删除';d.onclick=()=>{if(saveExamples(examples.filter(x=>x.id!==e.id)))renderPreferences()};row.append(p,b,d);list.append(row)}
    if(!examples.length){const p=document.createElement('p');p.textContent='在回复上长按，或点「教这句」，留下你认可的接话方式。';list.append(p)}
  }
  function showPreferences(){openSheet('偏好与说话例句','<p>偏好最多 12 条，例句最多 6 组。'+(window.XM_SYNC?.enabled?'所有打开小麦网址的设备共享这些偏好和例句。智能聊天时，小麦会参考它们。':'保存在当前浏览器，可随时修改或删除。')+'</p><h3>交流偏好</h3><div id="chatPreferences"></div><button class="primary" id="clearPreferences">忘记全部偏好</button><h3>你教的说话例句</h3><div id="expressionExamples"></div>','chat-preferences');renderPreferences();$('clearPreferences').onclick=()=>{if(savePreferences([],'clearPreferences')){renderPreferences();toast('已忘记全部偏好')}}}
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
    for(const entry of entries){const row=document.createElement('div');row.className='conversation '+entry.role;row.dataset.entryId=entry.id;const name=document.createElement('b');name.textContent=entry.role==='user'?'你':entry.role==='assistant'?'小麦':'提示';const time=document.createElement('time');time.dateTime=new Date(entry.at).toISOString();time.textContent=new Date(entry.at).toLocaleString([],{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});const text=document.createElement('p');text.textContent=entry.text;row.append(name,time,text);if(entry.photo){const photoNote=document.createElement('small');photoNote.textContent='已发送照片 · 原图不在聊天存档中';row.append(photoNote)}
      if(entry.role==='assistant'){if(entry.spontaneous)name.textContent='小麦 · 主动搭话';const b=document.createElement('button');b.className='teach-entry';b.type='button';b.textContent=entry.edited?'你教的表达 · 再修改':'这句不像你';b.disabled=busy;b.onclick=()=>showTeaching(entry);row.append(b);longPress(row,entry)}box.append(row)}
    if(!entries.length){const p=document.createElement('p');p.textContent='想聊什么都可以，从一句你好开始。';box.append(p)}box.scrollTop=box.scrollHeight;
    if($('chatStorageWarning'))$('chatStorageWarning').textContent=storageProblem;
  }
  function clear(){sequence++;controller?.abort();controller=null;entries=[];sessionOnly.clear();storageProblem='';window.XM_PHOTO?.clear();setBusy(false);saveConversation('clearChat');say('从这句重新开始吧，我听着。');renderHistory();toast('聊天记录已清空')}
  function history(){
    openSheet('和小麦接着聊','<p id="chatPrivacy"></p><p class="small" id="chatSyncStatus" aria-live="polite"></p><label class="retention-setting" for="chatRetention">聊天记录保留<select id="chatRetention"><option value="7">7天</option><option value="30">30天</option><option value="forever">一直保留</option><option value="off">仅本次打开</option></select></label><p id="chatStorageWarning" class="storage-warning" role="status"></p><div id="chatHistory" class="conversation-list" role="log" aria-live="polite"></div><button class="primary" id="clearConversation">清空聊天记录</button>','chat-history');
    $('chatPrivacy').textContent=(online?'智能回复由 OpenAI 生成。最近六轮完整对话、保存的偏好与例句会随新消息发送。':'当前回复使用预设台词。')+(window.XM_SYNC?.enabled?'所有打开小麦网址的设备共享最近 200 条聊天。选「仅本次打开」会清空云端聊天，新对话只留在当前页面。':'聊天最多保留最近 200 条，保存在当前浏览器。');window.XM_POCKET_APP?.status();
    $('chatRetention').value=retention;$('chatRetention').onchange=e=>{const next=e.target.value;try{localStorage.setItem(retentionKey,next);if(next==='off')for(const e of entries)sessionOnly.add(e.id);retention=next;if(!saveConversation('retention'))return;renderHistory();toast(next==='off'?'聊天仅保留在本次打开期间':'已更新聊天保留时间')}catch{toast('保留设置没能保存，请稍后再试')}};
    $('clearConversation').onclick=()=>{if(confirm(window.XM_SYNC?.enabled?'清空所有设备和云端的聊天记录？已教的偏好和例句会保留。':'清空本浏览器的聊天记录？已教的偏好和例句会保留。'))clear()};renderHistory();
  }
  memoryButton.onclick=showPreferences;teachButton.onclick=()=>showTeaching(lastReply());
  // The compact reply always teaches the latest completed message.
  let peekTimer=0,peekStart=null;$('replyPeek').addEventListener('pointerdown',e=>{peekStart={x:e.clientX,y:e.clientY};peekTimer=setTimeout(()=>showTeaching(lastReply()),600)});const cancelPeek=()=>{clearTimeout(peekTimer);peekStart=null};$('replyPeek').addEventListener('pointerup',cancelPeek);$('replyPeek').addEventListener('pointercancel',cancelPeek);$('replyPeek').addEventListener('pointermove',e=>{if(peekStart&&Math.abs(e.clientX-peekStart.x)+Math.abs(e.clientY-peekStart.y)>12)cancelPeek()});
  const errors={access_required:'这条智能聊天链接暂时不可用了。请向分享者获取新链接，动作和小游戏仍能玩。',not_configured:'小麦的智能聊天还在准备中，先一起玩个小游戏吧。',too_many_requests:'消息来得有点快，等一分钟再和小麦聊吧。',model_limit:'模型额度或请求量暂时受限，请稍后再试。',photo_invalid:'这张照片暂时没能读取，请重新选择一张再试。',photo_too_large:'照片还是有些大，请选择较小的照片再试。',photo_unavailable:'这次没有读到照片，请稍后再试。文字聊天仍然可以继续。'};
  async function readReply(response,onPartial){
    if(!response.ok){const error=await response.json();throw Object.assign(Error('request failed'),{code:error.error})}
    if(!response.headers?.get('content-type')?.includes('application/x-ndjson'))return response.json();
    let pending='',answer=null;function line(raw){if(!raw.trim())return;const item=JSON.parse(raw);if(item.type==='delta'&&typeof item.text==='string'&&item.text.length<=800)onPartial(item.text);if(item.type==='done')answer=item;if(item.type==='error')throw Object.assign(Error('stream failed'),{code:item.error})}
    if(response.body?.getReader){const reader=response.body.getReader(),decoder=new TextDecoder();try{while(true){const {value,done}=await reader.read();if(done){pending+=decoder.decode();break}pending+=decoder.decode(value,{stream:true});let end;while((end=pending.indexOf('\n'))>=0){line(pending.slice(0,end));pending=pending.slice(end+1)}if(pending.length>20000)throw Error('invalid stream')}if(pending.trim())line(pending)}finally{reader.releaseLock()}}
    else for(const raw of(await response.text()).split('\n'))line(raw);if(!answer)throw Error('incomplete stream');return answer;
  }
  async function chat(text,attachment){
    const photo=attachment===undefined?window.XM_PHOTO?.current:attachment;
    text=String(text||'').trim().slice(0,600);if(!text&&photo)text='看看这张照片，跟我聊聊。';if(!text)return false;if(busy){toast('等小麦说完这一句，再继续聊吧');return false}
    if(photo&&(!online||typeof photo.dataUrl!=='string'||!photo.dataUrl.startsWith('data:image/jpeg;base64,')||photo.dataUrl.length>956000)){toast(!online?'请通过智能版链接打开，再和小麦聊照片。':'照片没能准备好，请重新选择。');return false}
    const pull=online?window.XM_SYNC?.beforeChat?.():null;
    const user=add('user',text,{pending:online,...(photo?{photo:true}:{})});
    if(!online){offlineChat(text);add('assistant',$('speech').textContent,{replyTo:user.id});return true}
    setBusy(true);const id=++sequence,actionCount=XM.state.total,requestController=new AbortController();controller=requestController;const timer=setTimeout(()=>requestController.abort(),110000);
    try{
      if(pull){
        let limit;try{await Promise.race([pull,new Promise(resolve=>{limit=setTimeout(resolve,1200)})])}finally{clearTimeout(limit)}
        if(id!==sequence)return false;
      }
      const context=pairs(),previous=lastReply();
      const response=await fetch(endpoint,{method:'POST',credentials:'omit',redirect:'error',headers:{'Content-Type':'application/json','X-Xiaomai-Access':access},body:JSON.stringify({message:text,history:context,outfit:XM_WEAR.body(XM.state),accessories:XM_WEAR.active(XM.state),scene:XM.state.scene,effort,clientVersion:3,preferences,examples:examples.map(({prompt,original,preferred})=>({prompt,original,preferred})),...(photo?{photo:{dataUrl:photo.dataUrl,width:photo.width,height:photo.height}}:{}),...(previous?.spontaneous&&Date.now()-previous.at<1800000?{recentRemark:{text:previous.text,at:previous.at}}:{}),lastReplyAt:previous?.at||0,timezoneOffset:new Date().getTimezoneOffset(),stream:true}),signal:requestController.signal});
      const data=await readReply(response,partial=>{if(id===sequence){say(partial);mode.textContent='小麦正在说…'}});if(id!==sequence)return false;
      if(typeof data.reply!=='string'||!data.reply.trim()||data.reply.length>800||!actions.has(data.action))throw Error('invalid reply');
      user.pending=false;add('assistant',data.reply,{replyTo:user.id});window.XM.showAIReply(data.reply,data.action,XM.state.total===actionCount);applyMemory(data.memory);return true;
    }catch(error){if(id!==sequence)return false;user.pending=false;const message=errors[error.code]||'这次没连上小麦的智能对话，请稍后再发一次。你的穿搭和游戏进度都还在。';add('notice',message);say(message);toast(message);return false}
    finally{clearTimeout(timer);if(id===sequence){controller=null;setBusy(false)}}
  }
  form.onsubmit=e=>{e.preventDefault();if(busy){toast('等小麦说完这一句，再继续聊吧');return}const text=input.value.trim();if(!text)return;input.value='';void chat(text)};
  historyButton.onclick=history;
  function offerRemark(text,action){if(busy||typeof text!=='string'||!text.trim())return false;const taught=examples.find(x=>x.original===text);text=(taught?.preferred||text).slice(0,400);add('assistant',text,{spontaneous:true});XM.showRemark(text,action);return true}
  function applyCloud(data,{chatReset=false}={}){
    const oldReply=lastReply(),oldText=oldReply?.text,oldRetention=retention;
    if(chatReset&&busy){
      sequence++;controller?.abort();controller=null;setBusy(false);
    }
    let prefsChanged=false;
    function storeSetting(key,value){try{localStorage.setItem(key,value)}catch{}}
    if(limits.has(data.retention)&&data.retention!==retention){
      retention=data.retention;storeSetting(retentionKey,retention);
      if($('chatRetention'))$('chatRetention').value=retention;
    }
    if(['low','medium','high'].includes(data.effort)&&data.effort!==effort){
      effort=data.effort;storeSetting('xiaomai-reasoning',effort);refreshEffort();
    }
    if(Array.isArray(data.preferences)&&JSON.stringify(data.preferences)!==JSON.stringify(preferences)){
      preferences=[...data.preferences];storeSetting(memoryKey,JSON.stringify(preferences));prefsChanged=true;
    }
    if(Array.isArray(data.examples)&&JSON.stringify(data.examples)!==JSON.stringify(examples)){
      examples=data.examples.map(e=>({...e}));storeSetting(exampleKey,JSON.stringify(examples));prefsChanged=true;
    }
    if(Array.isArray(data.entries)){
      const previous=new Map(entries.map(e=>[e.id,e]));
      if(retention==='off'){
        if(oldRetention!=='off'||chatReset)entries=entries.filter(e=>sessionOnly.has(e.id));
      }else{
        const incoming=data.entries.map(e=>{
          const local=previous.get(e.id);
          return local?Object.assign(local,e,{pending:Boolean(local.pending&&busy&&!chatReset)}):{...e,pending:false};
        });
        const persistedIds=new Set(incoming.map(e=>e.id));
        const temporary=entries.filter(e=>sessionOnly.has(e.id)&&!persistedIds.has(e.id));
        entries=[...incoming,...temporary].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
      }
      saveConversation(undefined,true);
      if(dialogKind==='chat-history')renderHistory();
      const reply=lastReply();
      if(!busy&&(oldReply?.id!==reply?.id||oldText!==reply?.text)){
        say(reply?.text||'从这句重新开始吧，我听着。');
      }
    }
    updateMemoryButton();if(prefsChanged&&dialogKind==='chat-preferences')renderPreferences();
  }
  window.XM_AI={applyCloud,persistentEntries:()=>retention==='off'?[]:entries.filter(e=>!sessionOnly.has(e.id)).map(e=>({...e})),send:chat,history,clear,offerRemark,get preferences(){return [...preferences]},get examples(){return examples.map(x=>({...x}))},get entries(){return entries.map(x=>({...x}))},get retention(){return retention},get busy(){return busy},get online(){return online},get effort(){return effort},get model(){return 'gpt-6.1-terra'},get turns(){return pairs()}};
  input.maxLength=600;setBusy(false);if(lastReply())say(lastReply().text);if(storageProblem)toast('之前的聊天暂未读取，请打开聊天记录查看');else saveConversation();
})();
