// Phase sequences use the existing dressed sprite atlases; no flat-image turns.
const REACTIONS={
 head:[[[0,450,'settle','','看向你'],[9,850,'smallnod','shy','抓抓头发'],[17,700,'glance','shy','有点不好意思'],[0,900,'settle','','又凑近一点']],[[4,600,'proudpause','proud','发型要乱了'],[9,900,'smallnod','','理理头发'],[5,650,'chuckle','pleased','还是笑了'],[0,800,'settle','','站好给你摸']]],
 cheek:[[[8,450,'hesitate','surprised','愣了一下'],[10,700,'recoil','','往旁边躲'],[4,850,'proudpause','proud','看你一眼'],[5,700,'chuckle','pleased','没忍住笑']],[[0,400,'settle','','嗯？'],[10,700,'recoil','','被你戳到了'],[9,700,'glance','shy','抓抓头发'],[2,850,'proudpause','proud','这回记住你了']]],
 hug:[[[0,500,'hesitate','','看着你'],[11,800,'leanclose','soft','伸手接住你'],[12,1400,'holdclose','soft','抱稳一点'],[0,750,'settle','pleased','还在你旁边']],[[9,550,'glance','shy','有点不好意思'],[11,650,'leanclose','soft','还是伸出手'],[12,1500,'holdclose','soft','这次抱久一点'],[5,750,'smallnod','pleased','偷偷开心']]],
 praise:[[[0,450,'hesitate','','听见了'],[9,700,'glance','shy','抓抓头发'],[4,1000,'proudpause','proud','有点小得意'],[5,850,'chuckle','pleased','藏不住开心']],[[17,600,'glance','shy','先低一下头'],[0,500,'smallnod','','又看向你'],[2,1200,'proudpause','proud','这句我爱听']]],
 company:[[[0,600,'settle','','靠近一点'],[16,1700,'listenclose','soft','坐下来听你说'],[16,1200,'smallnod','soft','我听着呢']],[[17,600,'glance','','认真听'],[16,1600,'listenclose','soft','安静坐在旁边'],[0,900,'smallnod','soft','轻轻点头']]],
 wave:[[[0,400,'hesitate','','看见你啦'],[1,1000,'wavehello','pleased','抬手打招呼'],[9,600,'smallnod','shy','理一下头发'],[0,650,'settle','pleased','站近一点']],[[17,450,'glance','','抬起头'],[1,1200,'wavehello','pleased','朝你招招手'],[2,800,'proudpause','proud','等到你了']]],
 laugh:[[[8,400,'hesitate','surprised','被你逗到了'],[5,800,'chuckle','pleased','笑出声'],[15,800,'chuckle','pleased','还没缓过来'],[0,850,'settle','pleased','看你一眼']],[[17,600,'glance','','先忍一下'],[9,600,'smallnod','shy','没忍住'],[5,1100,'chuckle','pleased','笑得很开心'],[4,700,'proudpause','proud','这回算你赢']]],
 encourage:[[[0,550,'listenclose','soft','听你说完'],[14,950,'fistbump','proud','给你碰个拳'],[2,1050,'proudpause','pleased','我站你这边']],[[16,700,'listenclose','soft','先坐近一点'],[0,500,'smallnod','','认真点头'],[14,1000,'fistbump','proud','一起加把劲']]],
 shy:[[[0,1000,'settle','shy','有点不好意思'],[17,1100,'glance','shy','轻轻低一下头'],[0,1100,'settle','shy','又看向你']],[[0,1200,'settle','shy','听见啦'],[17,1000,'glance','shy','藏一下笑'],[0,1100,'settle','shy','安静看着你']]],
 blush:[[[0,800,'settle','shy','突然有点不好意思'],[17,1300,'glance','blush','脸颊有点热'],[0,1300,'settle','blush','又看向你']],[[0,1100,'settle','shy','听见你说了'],[17,1100,'glance','blush','轻轻低一下头'],[0,1200,'settle','blush','还没完全缓过来']]],
 proud:[[[0,450,'settle','','嗯哼'],[4,1000,'proudpause','proud','抱臂看着你'],[2,950,'proudpause','pleased','有点小得意'],[0,700,'settle','pleased','藏不住笑']],[[9,700,'glance','shy','理理头发'],[4,1050,'proudpause','proud','站得更直一点'],[5,800,'chuckle','pleased','这句我收下了']]],
 surprised:[[[0,450,'settle','','嗯？'],[8,700,'hesitate','surprised','愣了一下'],[9,800,'glance','shy','抓抓头发'],[5,850,'chuckle','pleased','被你逗笑']],[[17,500,'glance','','抬起头'],[8,650,'hesitate','surprised','等等，你刚说什么'],[4,850,'proudpause','proud','反应过来了'],[0,800,'smallnod','pleased','又看着你']]],
 listen:[[[0,650,'listenclose','soft','看着你听'],[17,800,'glance','soft','想了一下'],[0,1000,'smallnod','soft','轻轻点头']],[[16,1300,'listenclose','soft','坐近一点听'],[16,1000,'smallnod','soft','我在听']],[[0,850,'settle','soft','听你说'],[9,700,'glance','','抓抓头发'],[0,900,'smallnod','soft','点点头']]]
};
REACTIONS.thumb=REACTIONS.proud;
for(const [id,variants]of Object.entries(REACTIONS))PLANS[id]={f:[...new Set(variants.flatMap(v=>v.map(p=>p[0])))],step:650,m:'settle',fx:''};
const reactionChoices=new Map();let reactionHistory=[];
// A short idle afterglow is separate from activeAction, so new interactions never wait for it.
const EMOTION_AFTERGLOW={
 shy:{frame:0,label:'还有点不好意思',hold:2600,blush:.24},
 blush:{frame:0,label:'脸颊还热着',hold:3300,blush:.36},
 proud:{frame:2,label:'藏着一点小得意',hold:2400,blush:0},
 pleased:{frame:0,label:'心情还不错',hold:3000,blush:0},
 soft:{frame:16,label:'安静听你说',hold:2500,blush:0}
};
let emotionTimers=[],emotionToken=0,residualEmotion='';
function clearEmotion(){
 emotionToken++;emotionTimers.forEach(clearTimeout);emotionTimers=[];residualEmotion='';
 const wrap=$('actorWrap');delete wrap.dataset.emotion;wrap.style.removeProperty('--emotion-blush');
 $('actor').querySelectorAll('.emotion-ghost').forEach(node=>node.remove());
 $('currentAction').classList.remove('emotion-label','emotion-fading');
}
function settleEmotion(kind){
 const tone=EMOTION_AFTERGLOW[kind];
 if(!tone||state.reduced||window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)return;
 clearEmotion();const token=emotionToken,wrap=$('actorWrap');residualEmotion=kind;
 wrap.dataset.emotion=kind;wrap.style.setProperty('--emotion-blush',String(tone.blush));
 $('currentAction').textContent=tone.label;$('currentAction').classList.add('emotion-label');$('currentAction').hidden=false;
 setFrame(tone.frame);
 emotionTimers.push(setTimeout(()=>{
  if(token!==emotionToken)return;
  // Cross-fade two dressed poses; the whole image is never rotated or flattened.
  const ghost=$('sprite').cloneNode(true);ghost.removeAttribute('id');ghost.removeAttribute('role');ghost.setAttribute('aria-hidden','true');ghost.className='sprite emotion-ghost';$('actor').prepend(ghost);
  wrap.dataset.emotion='fading';wrap.style.setProperty('--emotion-blush','0');$('currentAction').classList.add('emotion-fading');
  setFrame(state.energy<28?3:state.mood<38?4:0);
  // Force the starting opacity before asking CSS to blend into the neutral pose.
  void ghost.offsetWidth;ghost.style.opacity='0';
  emotionTimers.push(setTimeout(()=>{if(token!==emotionToken)return;clearEmotion();$('currentAction').hidden=true},1000));
 },tone.hold));
}
function playReaction(id,a){
 cancelMotion();const token=motionToken,variants=REACTIONS[id],previous=reactionChoices.get(id);
 const variant=previous===undefined?Math.floor(Math.random()*variants.length):(previous+1+Math.floor(Math.random()*(variants.length-1)))%variants.length;
 reactionChoices.set(id,variant);reactionHistory.push({id,variant});reactionHistory=reactionHistory.slice(-30);
 const phases=variants[variant];activeAction=id;frameHistory=[];$('actorWrap').dataset.action=id;$('prop').textContent='';showEffects('');$('currentAction').hidden=false;
 let elapsed=0,lastEmotion='';
 for(const [frame,ms,motion,expression,label]of (state.reduced?[phases.at(-1)]:phases)){
  const phase=()=>{if(token!==motionToken)return;setFrame(frame);$('actor').className='actor '+(state.reduced?'':motion);$('actorWrap').dataset.expression=expression;$('actorWrap').dataset.phase=label;$('currentAction').textContent=label;currentMotion=motion;if(expression)lastEmotion=expression};
  if(!elapsed)phase();else frameTimers.push(setTimeout(phase,elapsed));elapsed+=state.reduced?1400:ms;
 }
 poseTimer=setTimeout(()=>{if(token===motionToken)rest(lastEmotion)},elapsed+180);
}
