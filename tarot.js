(() => {
  'use strict';
  const chat = window.XIAOMAI_CHAT_CONFIG?.endpoint;
  const entry = document.createElement('button');
  entry.type = 'button';
  entry.className = 'history-link';
  entry.textContent = '✦ 塔罗';
  document.querySelector('#chatHistoryButton').before(entry);

  const style = document.createElement('style');
  style.textContent = `
    .tarot {color:#2e4437}
    .tarot [hidden]{display:none!important}
    .tarot label{display:grid;gap:5px;margin:12px 0;font-size:14px;font-weight:650}
    .tarot select,.tarot textarea{width:100%;box-sizing:border-box;padding:9px 11px;background:#fffefa;color:inherit;border:1px solid #c8d4c5;border-radius:9px;font:inherit;font-size:16px}
    .tarot .reverse-option{display:flex;align-items:center;gap:8px}
    .tarot .reverse-option input{width:18px;height:18px;accent-color:#375845}
    .tarot .deck{display:grid;grid-template-columns:repeat(auto-fit,minmax(76px,1fr));gap:12px;align-items:start;margin:14px 0;text-align:center}
    .tarot .table{padding:12px;border-radius:16px;background:radial-gradient(ellipse at top,#52735d,#263c32);color:#fff5dc}
    .tarot .card{width:min(100%,104px);aspect-ratio:2/3;position:relative;padding:0;margin:0 auto;background:transparent;border:0;perspective:600px;display:block}
    .tarot .card:focus-visible{outline:3px solid #f0d29c;outline-offset:4px}
    .tarot .planes{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .52s cubic-bezier(.3,.1,.2,1)}
    .tarot .open .planes{transform:rotateY(180deg)}
    .tarot .face{position:absolute;inset:0;display:flex;justify-content:center;align-items:center;flex-direction:column;gap:4px;border-radius:9px;backface-visibility:hidden;-webkit-backface-visibility:hidden;border:1px solid #beac76;box-shadow:0 4px 10px #12271d60}
    .tarot .back{color:#f5d99c;background:repeating-linear-gradient(45deg,#2a4539 0 5px,#304e40 5px 10px);font-size:32px}
    .tarot .back::after,.tarot .front::after{content:'';position:absolute;inset:5px;border:1px solid currentColor;opacity:.45;border-radius:5px;pointer-events:none}
    .tarot .front{transform:rotateY(180deg);background:radial-gradient(ellipse,#fffae5,#e6dbb8);color:#284436;padding:7px;font-size:12px;line-height:1.25}
    .tarot .symbol{font-size:30px;line-height:1;color:#74663a}
    .tarot .reversed .symbol{transform:rotate(180deg)}
    .tarot .position{font-size:12px;display:block;margin-top:6px}
    .tarot .direction{font-size:11px;color:#55462b}
    .tarot .dealing .card{animation:tarot-deal .58s both;animation-delay:calc(var(--order) * 60ms)}
    @keyframes tarot-deal{from{opacity:0;transform:translateY(-19px) rotate(-13deg) scale(.75)}to{opacity:1;transform:translateY(0) rotate(0deg) scale(1)}}
    .tarot .buttons{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:12px 0}
    .tarot .buttons button{min-height:44px}
    .tarot .reading{white-space:pre-wrap;overflow-wrap:anywhere;background:#f0f3e8;padding:12px;border-radius:10px}
    .tarot .card-notes{font-size:14px;margin:12px 0}.tarot details{margin:8px 0}.tarot summary{cursor:pointer}
    @media(prefers-reduced-motion:reduce){.tarot .card,.tarot .planes{animation:none!important;transition:none!important}}
    .tarot[data-reduced=true] .card,.tarot[data-reduced=true] .planes{animation:none!important;transition:none!important}
  `;
  document.head.append(style);

  const spreads = [
    ['one','单张聚焦',['观察焦点']],
    ['three','现状、卡点、下一步',['现状','卡点','下一步']],
    ['timeline','过去、现在、可能走向',['过去','现在','可能走向']],
    ['relationship','关系互动',['我的需求','互动现状','主要张力','可验证的一步']],
    ['decision','两项选择',['取舍标准','选项 A','选项 B','主要权衡','先验证什么']],
    ['celtic-cross','凯尔特十字',['核心处境','交叉影响','显性目标','根基','近期过去','近期走向','自身立场','外部环境','希望与顾虑','条件性结果']]
  ];
  const majorSymbols = ['☄','✦','☾','❀','♜','♧','♡','➶','♌','✧','◉','⚖','⌛','✿','⚗','♄','ϟ','✶','☽','☀','♢','◎'];
  const suitSymbols = {wands:'♣',cups:'♥',swords:'⚔',pentacles:'★'};
  function symbol(id) {
    const [suit,value]=id.split('-');
    return suit==='major' ? majorSymbols[Number(value)]||'✦' : suitSymbols[suit]||'✦';
  }
  function node(tag,text,klass) {
    const item=document.createElement(tag);
    if(text)item.textContent=text;
    if(klass)item.className=klass;
    return item;
  }
  async function post(url,body) {
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),115000);
    try {
      const response=await fetch(url,{method:'POST',credentials:'omit',redirect:'error',
        headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
      if(!response.ok)throw new Error(String(response.status));
      return response.json();
    } finally {clearTimeout(timer);}
  }

  entry.onclick=() => {
    openSheet('和小麦抽塔罗',`
      <section class="tarot">
        <label>牌阵 <select data-spread></select></label>
        <p data-layout></p>
        <label>想聊的问题（选填） <textarea maxlength="500" rows="2" placeholder="最近这件事，我该留意什么？"></textarea></label>
        <label class="reverse-option"><input type="checkbox" checked> 包含逆位</label>
        <div class="buttons"><button class="primary" data-draw>开始抽牌</button></div>
        <p role="status" data-status></p>
        <div class="table" hidden><div class="deck"></div></div>
        <div class="buttons" data-actions hidden>
          <button class="secondary" data-reveal>翻开全部</button>
          <button class="primary" data-read disabled>请小麦解读</button>
        </div>
        <div class="card-notes"></div>
        <div class="reading" aria-live="polite" hidden></div>
      </section>`, 'tarot');
    const root=document.querySelector('#sheetBody .tarot');
    root.dataset.reduced=String(Boolean(window.XM?.state?.reduced));
    const get=selector=>root.querySelector(selector);
    const select=get('[data-spread]'), status=get('[data-status]'), deck=get('.deck');
    const draw=get('[data-draw]'), read=get('[data-read]'), reveal=get('[data-reveal]');
    const reading=get('.reading'), layout=get('[data-layout]'), table=get('.table'), notes=get('.card-notes');
    let result,flips=[],busy=false;
    for(const [id,title,positions] of spreads)select.add(new Option(title+' · '+positions.length+' 张',id));
    select.value='three';
    function clear() {
      result=undefined; flips=[]; deck.replaceChildren(); notes.replaceChildren(); reading.textContent='';
      reading.hidden=table.hidden=get('[data-actions]').hidden=true;
      status.textContent=''; read.disabled=true; reveal.disabled=false;
    }
    function updateLayout() {
      layout.textContent=spreads.find(([id])=>id===select.value)[2].join(' · ');
    }
    select.onchange=()=>{clear();updateLayout();};
    updateLayout();
    function setBusy(value) {
      busy=value;
      draw.disabled=select.disabled=get('input').disabled=value;
      read.disabled=value||!result||flips.some(f=>!f.open);
    }
    function renderCards() {
      result.positions.forEach((card,index)=>{
        const reversed=card.orientation==='reversed', direction=reversed?'逆位':'正位';
        const button=node('button',null,'card'+(reversed?' reversed':''));
        button.type='button';
        button.style.setProperty('--order',String(index));
        button.setAttribute('aria-label','翻开 '+card.label);
        const wrap=node('div',null,'planes'), back=node('span','✧','face back');
        const front=node('span',null,'face front');
        back.setAttribute('aria-hidden','true');
        front.setAttribute('aria-hidden','true');
        front.append(node('span',symbol(card.card_id),'symbol'),node('strong',card.card_name),node('span',direction,'direction'));
        wrap.append(back,front);button.append(wrap);
        const tile=node('div');tile.append(button,node('span',card.label,'position'));deck.append(tile);
        const flip={open:false,reveal:()=>{
          if(flip.open)return;
          flip.open=true;
          button.classList.add('open');
          button.setAttribute('aria-label',[card.label,card.card_name,direction].join('，'));
          button.setAttribute('aria-disabled','true');
          const detail=node('details');
          detail.append(node('summary',card.label+' · '+card.card_name+direction),node('p',card.meaning));
          const ordered=Array.from(notes.children).find(el=>Number(el.dataset.order)>index);
          detail.dataset.order=String(index);
          notes.insertBefore(detail,ordered||null);
          if(flips.every(f=>f.open)){
            read.disabled=false;reveal.disabled=true;status.textContent='牌已翻开，可以请小麦解读。';
          }
        }};
        flips.push(flip);button.onclick=flip.reveal;
      });
      table.hidden=get('[data-actions]').hidden=false;
      deck.classList.remove('dealing');
      requestAnimationFrame(()=>deck.classList.add('dealing'));
    }
    draw.onclick=async()=>{
      if(busy)return;
      clear();
      if(!chat){status.textContent='请打开联网版小麦使用塔罗。';return;}
      setBusy(true);status.textContent='小麦在洗牌…';
      try {
        result=await post(new URL('tarot',chat),{spread:select.value,reversals:get('input').checked});
        if(!root.isConnected)return;
        renderCards();status.textContent='点牌背逐张翻开，或一次翻开全部。';
        draw.textContent='重新抽牌';
      } catch {status.textContent='这次没能抽到牌，请再试一次。';}
      finally {setBusy(false);}
    };
    reveal.onclick=()=>flips.forEach(f=>f.reveal());
    read.onclick=async()=>{
      if(busy||!result||flips.some(f=>!f.open))return;
      setBusy(true);reading.hidden=true;status.textContent='小麦在看这副牌…';
      try {
        const question=get('textarea').value.trim()||'这副牌里有哪些值得留意的线索？';
        const answer=await post(chat,{message:question,tarotTicket:result.ticket,clientVersion:3,effort:window.XM_AI?.effort||'medium'});
        if(!root.isConnected)return;
        reading.textContent=answer.reply;reading.hidden=false;status.textContent='';
      } catch(error) {
        status.textContent=error.message==='400'?'这副牌的解读已过期，可以重新抽牌。':'解读暂时没连上，可以用同一副牌重试。';
      } finally {setBusy(false);}
    };
  };
})();
