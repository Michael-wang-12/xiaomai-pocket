(()=>{
  const input=document.getElementById('chatInput'),form=document.getElementById('chatForm'),send=form.querySelector('button');
  const mode=document.getElementById('chatMode'),historyButton=document.getElementById('chatHistoryButton');
  const config=window.XIAOMAI_CHAT_CONFIG||{};
  const endpoint=typeof config.endpoint==='string'?config.endpoint:'';
  let access='',busy=false,sequence=0,controller=null,turns=[],entries=[],effort='medium',preferences=[];
  const memoryKey='xiaomai-dialogue-preferences-v1';
  try{const saved=JSON.parse(localStorage.getItem(memoryKey)||'[]');if(Array.isArray(saved))preferences=[...new Set(saved.filter(x=>typeof x==='string'&&x.trim()&&x.length<=120))].slice(-12)}catch{}
  try{const saved=localStorage.getItem('xiaomai-reasoning');if(['low','medium','high'].includes(saved))effort=saved}catch{}
  try{const shared=new URLSearchParams(location.hash.slice(1)).get('pocket');if(shared&&/^[\w-]{32,128}$/.test(shared))sessionStorage.setItem('xiaomai-chat-access',shared);access=sessionStorage.getItem('xiaomai-chat-access')||''}catch{}
  const online=Boolean(endpoint&&access);
  // 保持键盘与输入框焦点，避免点击档位/聊天记录时布局移动吞掉这次点击。
  document.getElementById('composer').addEventListener('pointerdown',e=>{if(e.target.closest('button')&&document.activeElement===input)e.preventDefault()});
  const actions=new Set(['none','company','hug','five','fist','wave','thumb','laugh','encourage','night','blush']);
  const memoryButton=document.createElement('button');memoryButton.type='button';memoryButton.className='history-link';memoryButton.id='chatMemoryButton';historyButton.before(memoryButton);
  function updateMemoryButton(){memoryButton.textContent=preferences.length?'偏好记忆 '+preferences.length:'偏好记忆'}
  function savePreferences(next){try{localStorage.setItem(memoryKey,JSON.stringify(next));preferences=next;updateMemoryButton();return true}catch{add('notice','这次没能保存偏好。当前对话仍能继续，刷新后的记忆以「偏好记忆」里显示的内容为准。');toast('偏好没有保存成功');return false}}
  function applyMemory(memory){if(!memory||typeof memory.text!=='string'||memory.text.length>120)return;const text=memory.text.trim();let next;if(memory.operation==='remember'&&text)next=[...preferences.filter(x=>x!==text),text].slice(-12);else if(memory.operation==='forget'&&preferences.includes(text))next=preferences.filter(x=>x!==text);else if(memory.operation==='clear')next=[];else return;if(savePreferences(next))toast(memory.operation==='remember'?'已记住这条偏好 · 本浏览器':'已忘记所选偏好')}
  function renderPreferences(){const box=document.getElementById('chatPreferences');if(!box)return;box.replaceChildren();preferences.forEach((text,index)=>{const row=document.createElement('div');row.className='preference-row';const p=document.createElement('p');p.textContent=text;const b=document.createElement('button');b.type='button';b.textContent='删除';b.setAttribute('aria-label','删除偏好 '+(index+1));b.onclick=()=>{if(savePreferences(preferences.filter((_,i)=>i!==index)))renderPreferences()};row.append(p,b);box.append(row)});if(!preferences.length){const p=document.createElement('p');p.textContent='还没有记住的偏好。可以说：记住，以后回答短一点。';box.append(p)}}
  function showPreferences(){openSheet('小麦记住的偏好','<p>'+(online?'通过聊天说「记住」「以后请……」来教小麦。最多保留12条，仅保存在当前浏览器；聊天时随消息发送，换手机不会同步。':'当前使用本机预设对话，智能版可以通过聊天教小麦。这里仍能查看和删除之前保存的偏好。')+'你可以随时删除。</p><div id="chatPreferences"></div><button class="primary" id="clearPreferences">忘记全部偏好</button>','chat-preferences');renderPreferences();document.getElementById('clearPreferences').onclick=()=>{if(savePreferences([])){renderPreferences();toast('已忘记本浏览器的偏好')}}}
  memoryButton.onclick=showPreferences;updateMemoryButton();
  function refreshEffort(){document.querySelectorAll('[data-effort]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.effort===effort));b.disabled=busy});document.getElementById('modelControls').hidden=!online}
  document.getElementById('modelControls').onclick=e=>{const b=e.target.closest('[data-effort]');if(!b||busy)return;effort=b.dataset.effort;try{localStorage.setItem('xiaomai-reasoning',effort)}catch{}refreshEffort()};
  function setBusy(value){busy=value;send.disabled=value;memoryButton.disabled=value;send.textContent=value?'…':'↑';send.setAttribute('aria-label',value?'小麦正在思考':'发送');form.setAttribute('aria-busy',String(value));mode.textContent=value?'小麦正在认真想…':online?'智能对话 · 发送给 OpenAI':'本机趣味对话';refreshEffort()}
  function add(role,text){entries.push({role,text});entries=entries.slice(-40);if(dialogKind==='chat-history')renderHistory()}
  function renderHistory(){const box=document.getElementById('chatHistory');if(!box)return;box.replaceChildren();for(const entry of entries){const row=document.createElement('div');row.className='conversation '+entry.role;const name=document.createElement('b');name.textContent=entry.role==='user'?'你':entry.role==='assistant'?'小麦':'提示';const text=document.createElement('p');text.textContent=entry.text;row.append(name,text);box.append(row)}if(!entries.length){const hint=document.createElement('p');hint.textContent='想聊什么都可以，从一句你好开始。';box.append(hint)}box.scrollTop=box.scrollHeight}
  function clear(){sequence++;controller?.abort();controller=null;turns=[];entries=[];setBusy(false);renderHistory();toast('本次对话已清空')}
  function history(){openSheet('和小麦聊一会儿','<p id="chatPrivacy"></p><div id="chatHistory" class="conversation-list" role="log" aria-live="polite"></div><button class="primary" id="clearConversation">清空本次对话</button>','chat-history');document.getElementById('chatPrivacy').textContent=online?'智能回复由 OpenAI 生成，可能有误。最近六轮对话和本浏览器保存的偏好会随新消息发送；刷新或关闭后聊天记录清空，保存的偏好可在「偏好记忆」单独删除。':'当前使用本机预设对话，不会发送给模型。通过智能版分享链接打开后，可以和小麦连续聊天。';document.getElementById('clearConversation').onclick=clear;renderHistory()}
  const errors={access_required:'这条智能聊天链接暂时不可用了。请向分享者获取新链接，动作和小游戏仍能玩。',not_configured:'小麦的智能聊天还在准备中，先一起玩个小游戏吧。',too_many_requests:'消息来得有点快，等一分钟再和小麦聊吧。',model_limit:'模型额度或请求量暂时受限，请稍后再试。'};
  async function readReply(response,onPartial){
    if(!response.ok){const error=await response.json();throw Object.assign(Error('request failed'),{code:error.error})}
    if(!response.headers?.get('content-type')?.includes('application/x-ndjson'))return response.json();
    let pending='',answer=null;
    function line(raw){if(!raw.trim())return;const item=JSON.parse(raw);if(item.type==='delta'&&typeof item.text==='string'&&item.text.length<=800)onPartial(item.text);if(item.type==='done')answer=item;if(item.type==='error')throw Object.assign(Error('stream failed'),{code:item.error})}
    if(response.body?.getReader){const reader=response.body.getReader(),decoder=new TextDecoder();try{while(true){const {value,done}=await reader.read();if(done){pending+=decoder.decode();break}pending+=decoder.decode(value,{stream:true});let end;while((end=pending.indexOf('\n'))>=0){line(pending.slice(0,end));pending=pending.slice(end+1)}if(pending.length>20000)throw Error('invalid stream')}if(pending.trim())line(pending)}finally{reader.releaseLock()}}
    else for(const raw of (await response.text()).split('\n'))line(raw);
    if(!answer)throw Error('incomplete stream');return answer;
  }
  async function chat(text){
    text=String(text||'').trim().slice(0,600);if(!text)return;
    if(busy){toast('等小麦说完这一句，再继续聊吧');return}
    add('user',text);
    if(!online){offlineChat(text);add('assistant',document.getElementById('speech').textContent);return}
    setBusy(true);const id=++sequence,actionCount=XM.state.total;const requestController=new AbortController();controller=requestController;const timer=setTimeout(()=>requestController.abort(),110000);
    try{
      const response=await fetch(endpoint,{method:'POST',credentials:'omit',redirect:'error',headers:{'Content-Type':'application/json','X-Xiaomai-Access':access},body:JSON.stringify({message:text,history:turns.slice(-12),outfit:XM.state.outfit,scene:XM.state.scene,effort,clientVersion:2,preferences,stream:true}),signal:requestController.signal});
      const data=await readReply(response,partial=>{if(id===sequence){say(partial);mode.textContent='小麦正在说…'}});if(id!==sequence)return;
      if(typeof data.reply!=='string'||!data.reply.trim()||data.reply.length>800||!actions.has(data.action))throw Error('invalid reply');
      turns.push({role:'user',content:text},{role:'assistant',content:data.reply});turns=turns.slice(-12);
      add('assistant',data.reply);window.XM.showAIReply(data.reply,data.action,XM.state.total===actionCount);
      applyMemory(data.memory);
    }catch(error){if(id!==sequence)return;const message=errors[error.code]||'这次没连上小麦的智能对话，请稍后再发一次。你的穿搭和游戏进度都还在。';add('notice',message);say(message);toast(message)}
    finally{clearTimeout(timer);if(id===sequence){controller=null;setBusy(false)}}
  }
  form.onsubmit=e=>{e.preventDefault();if(busy){toast('等小麦说完这一句，再继续聊吧');return}const text=input.value.trim();if(!text)return;input.value='';void chat(text)};
  historyButton.onclick=history;
  window.XM_AI={send:chat,history,clear,get preferences(){return [...preferences]},get busy(){return busy},get online(){return online},get effort(){return effort},get model(){return 'gpt-6.1-terra'},get turns(){return turns.map(x=>({...x}))}};
  input.maxLength=600;setBusy(false);
})();
