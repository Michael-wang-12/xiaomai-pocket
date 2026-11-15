(()=>{
 const $=id=>document.getElementById(id),key='xiaomai-small-talk-v1';
 const modes={quiet:{label:'安静',min:0,max:0,hint:'小麦安静陪着你，不主动插话。'},occasional:{label:'偶尔',min:120000,max:240000,hint:'空闲约2～4分钟聊一句，输入或聊天时不打扰。'},lively:{label:'活泼',min:50000,max:90000,hint:'空闲约1分钟聊一句，输入或聊天时不打扰。'}};
 let mode='occasional';try{const saved=localStorage.getItem(key);if(modes[saved])mode=saved}catch{}
 const lines={
  general:[['盯我这么久，想什么呢？','proud'],['要不要跟我说件今天的小事？我听着。','listen'],['你先忙，我在旁边待会儿。','company'],['我刚想到，你今天有没有好好吃饭？','listen'],['这么安静，我都想跟着发会儿呆了。','company'],['要是想夸我，可以直接说。我接得住。','proud'],['让我猜猜，你是不是又在偷偷看我。','shy'],['今天有没有哪一刻，让你有一点点开心？','listen']],
  rain:[['这阵雨听着挺舒服。陪你待一会儿。','company'],['雨还在下，我们先不赶路。','listen']],
  night:[['这会儿安安静静的，正好陪你坐会儿。','company'],['今晚的星星，先分你一半。','shy']],
  sunset:[['这会儿的光刚刚好。一起发个呆？','company'],['有点舍不得这片晚霞，你呢？','listen']],
  scarf:[['围巾还暖着呢。你也别着凉。','shy']],cap:[['这顶帽子怎么样？我觉得还挺适合我。','proud']],headphone:[['戴着耳机也听得见你。想说什么就说。','listen']],leather:[['新外套怎么样？先说好，不接受敷衍夸奖。','proud'],['这身皮衣够帅吧？好啦，最想听你夸。','shy']],bomber:[['今天这身很适合出去走走，你觉得呢？','listen'],['这么看着我，是不是又想夸我了？','proud']],blackshirt:[['黑衬衫怎么样？你要是说好看，我可就记住了。','proud']],'blackshirt-tie':[['领带系好了，今天这身够精神吧？','proud']]
 };
 let observedActivity=lastInteraction,nextAt=0,recent=[],count=0;
 function schedule(now=Date.now()){observedActivity=lastInteraction;const m=modes[mode];nextAt=m.min?now+Math.round(m.min+Math.random()*(m.max-m.min)):Infinity}
 function active(){lastInteraction=Date.now();schedule(lastInteraction)}
 function paused(){const el=document.activeElement;return document.hidden||!document.hasFocus()||!$('veil').hidden||window.XM_AI?.busy||window.XM_PHOTO?.busy||window.XM_PHOTO?.hasPendingPhoto||Boolean(el?.matches('input,textarea,select,[contenteditable="true"]'))||Boolean(XM.activeAction)||Boolean(XM.pendingAction)}
 function choose(){const pool=[...lines.general,...(lines[XM.state.scene]||[]),...(lines[XM_WEAR.body(XM.state)]||[]),...Object.values(XM.state.accessories).flatMap(id=>lines[id]||[])];let available=pool.filter(([text])=>!recent.includes(text));if(!available.length)available=pool;const selected=available[Math.floor(Math.random()*available.length)];recent=[...recent,selected[0]].slice(-5);return selected}
 function tick(){
  const now=Date.now();if(observedActivity!==lastInteraction)schedule(lastInteraction);
  if(mode==='quiet'||now<nextAt)return false;
  if(paused()){schedule(now);return false}
  const [text,action]=choose();
  if(!window.XM_AI?.offerRemark(text,action)){schedule(now);return false}
  count++;lastInteraction=now;schedule(now);return true;
 }
 function settings(){const box=$('smallTalkSettings');if(!box)return;box.replaceChildren();const label=document.createElement('div');label.className='small-talk-label';label.textContent='主动搭话';const group=document.createElement('div');group.className='small-talk-options';group.setAttribute('role','group');group.setAttribute('aria-label','主动搭话频率');for(const [value,m]of Object.entries(modes)){const b=document.createElement('button');b.type='button';b.textContent=m.label;b.dataset.smallTalk=value;b.setAttribute('aria-pressed',String(value===mode));b.onclick=()=>{mode=value;let saved=true;try{localStorage.setItem(key,mode)}catch{saved=false}active();settings();window.XM_SYNC?.changed();toast(saved?'主动搭话 · '+m.label:'本次已切换，刷新后设置可能恢复')};group.append(b)}const hint=document.createElement('p');hint.className='small-talk-hint';hint.textContent=modes[mode].hint+' 只在当前页面停留时生效，不额外调用模型。';box.append(label,group,hint)}
 for(const event of ['pointerdown','keydown','input','wheel','scroll'])document.addEventListener(event,active,{passive:true,capture:event==='scroll'});
 document.addEventListener('visibilitychange',active);window.addEventListener('focus',active);
 schedule();setInterval(tick,5000);
 function applyMode(value){if(!Object.hasOwn(modes,value)||value===mode)return;mode=value;try{localStorage.setItem(key,mode)}catch{}active();settings()}
 window.XM_SMALL_TALK={settings,applyMode,check:tick,get mode(){return mode},get nextAt(){return nextAt},get count(){return count}};
})();
