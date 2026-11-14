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
 shy:[[[8,450,'hesitate','surprised','诶？'],[9,850,'glance','shy','抓抓头发'],[17,900,'lookaside','shy','先低一下头'],[0,850,'smallnod','shy','又偷偷看你']],[[0,500,'hesitate','','听见啦'],[17,950,'glance','shy','藏一下笑'],[9,750,'lookaside','shy','理理头发'],[0,850,'settle','shy','还是看着你']]],
 blush:[[[8,450,'hesitate','surprised','突然被你逗到'],[9,800,'glance','shy','抓抓头发'],[17,1000,'lookaside','blush','耳根有点热'],[0,1100,'smallnod','blush','又看向你']],[[0,500,'hesitate','','等等'],[17,950,'glance','blush','先藏一下笑'],[9,800,'lookaside','blush','被你看出来了'],[2,1000,'proudpause','shy','还想逗你一下']],[[8,400,'hesitate','surprised','没想到你这么说'],[4,750,'proudpause','shy','努力装镇定'],[9,900,'glance','blush','还是有点脸红'],[0,1000,'leanclose','blush','凑近一点']]],
 proud:[[[0,450,'settle','','嗯哼'],[4,1000,'proudpause','proud','抱臂看着你'],[2,950,'proudpause','pleased','有点小得意'],[0,700,'settle','pleased','藏不住笑']],[[9,700,'glance','shy','理理头发'],[4,1050,'proudpause','proud','站得更直一点'],[5,800,'chuckle','pleased','这句我收下了']]],
 surprised:[[[0,450,'settle','','嗯？'],[8,700,'hesitate','surprised','愣了一下'],[9,800,'glance','shy','抓抓头发'],[5,850,'chuckle','pleased','被你逗笑']],[[17,500,'glance','','抬起头'],[8,650,'hesitate','surprised','等等，你刚说什么'],[4,850,'proudpause','proud','反应过来了'],[0,800,'smallnod','pleased','又看着你']]],
 listen:[[[0,650,'listenclose','soft','看着你听'],[17,800,'glance','soft','想了一下'],[0,1000,'smallnod','soft','轻轻点头']],[[16,1300,'listenclose','soft','坐近一点听'],[16,1000,'smallnod','soft','我在听']],[[0,850,'settle','soft','听你说'],[9,700,'glance','','抓抓头发'],[0,900,'smallnod','soft','点点头']]]
};
REACTIONS.thumb=REACTIONS.proud;
for(const [id,variants]of Object.entries(REACTIONS))PLANS[id]={f:[...new Set(variants.flatMap(v=>v.map(p=>p[0])))],step:650,m:'settle',fx:''};
const reactionChoices=new Map();let reactionHistory=[];
function playReaction(id,a){
 cancelMotion();const token=motionToken,variants=REACTIONS[id],previous=reactionChoices.get(id);
 const variant=previous===undefined?Math.floor(Math.random()*variants.length):(previous+1+Math.floor(Math.random()*(variants.length-1)))%variants.length;
 reactionChoices.set(id,variant);reactionHistory.push({id,variant});reactionHistory=reactionHistory.slice(-30);
 const phases=variants[variant];activeAction=id;frameHistory=[];$('actorWrap').dataset.action=id;$('prop').textContent='';showEffects('');$('currentAction').hidden=false;
 let elapsed=0;
 for(const [frame,ms,motion,expression,label]of (state.reduced?[phases.at(-1)]:phases)){
  const phase=()=>{if(token!==motionToken)return;setFrame(frame);$('actor').className='actor '+(state.reduced?'':motion);$('actorWrap').dataset.expression=expression;$('actorWrap').dataset.phase=label;$('currentAction').textContent=label;currentMotion=motion};
  if(!elapsed)phase();else frameTimers.push(setTimeout(phase,elapsed));elapsed+=state.reduced?1400:ms;
 }
 poseTimer=setTimeout(()=>{if(token===motionToken)rest()},elapsed+180);
}
