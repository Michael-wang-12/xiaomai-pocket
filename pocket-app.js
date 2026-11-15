// Adapts the game's existing state and persistence to one shared pocket.
(()=>{
  const clone=value=>JSON.parse(JSON.stringify(value));
  const localSetting=key=>{try{return localStorage.getItem(key)!==null}catch{return false}};
  const legacySettings={
    retention:localSetting('xiaomai-chat-retention-v1'),
    effort:localSetting('xiaomai-reasoning'),
    smallTalk:localSetting('xiaomai-small-talk-v1')
  };
  function read(){
    const chat=window.XM_AI;
    return {game:clone(state),entries:chat.persistentEntries(),preferences:chat.preferences,
      examples:chat.examples,retention:chat.retention,effort:chat.effort,smallTalk:XM_SMALL_TALK.mode};
  }
  function apply(snapshot,options){
    if(!snapshot)return;
    if(snapshot.game){
      const next=clean({...state,...snapshot.game});
      if(JSON.stringify(state)!==JSON.stringify(next)){
        const sceneChanged=state.scene!==next.scene;
        const clothesChanged=state.outfit!==next.outfit||JSON.stringify(state.accessories)!==JSON.stringify(next.accessories);
        state=next;checkDate();
        if(sceneChanged)applyScene(state.scene);
        if(clothesChanged){rest();updateWearLabel()}
        render();persist(true);
        if(dialogKind==='journal')journal();
        if($('soundToggle'))$('soundToggle').textContent=state.sound?'已开启':'已关闭';
        if($('motionToggle'))$('motionToggle').textContent=state.reduced?'已开启':'已关闭';
      }
    }
    XM_AI.applyCloud(snapshot,options);
    if(snapshot.smallTalk)XM_SMALL_TALK.applyMode(snapshot.smallTalk);
  }
  function updateStatus(){
    const sync=window.XM_SYNC;
    for(const id of ['pocketSyncStatus','chatSyncStatus']){
      const el=$(id);if(!el)continue;
      const message=sync?.status||'云端暂时未连接，请稍后重试。';
      if(el.textContent!==message)el.textContent=message;
    }
  }
  function mount(){
    const box=$('syncSettings');if(!box)return;
    box.innerHTML='<div class="about-entry"><div><strong>设备同步</strong><small id="pocketSyncStatus" role="status" aria-live="polite"></small></div><button id="pocketSyncNow" type="button">立即同步</button></div>';
    const note=document.createElement('p');
    note.textContent='手机、平板和电脑打开小麦就会自动同步，设备数量不限。能打开这个网址的人都能查看和更改共享记录。';
    box.append(note);
    $('pocketSyncNow').onclick=()=>{
      if(window.XM_SYNC?.enabled)return window.XM_SYNC.refresh();
      $('pocketSyncStatus').textContent='云端暂时未连接，请联网后刷新页面再试。';
    };
    updateStatus();
  }
  window.XM_POCKET_APP={read,apply,mount,status:updateStatus,legacyGame:Boolean(initial&&initial.version===1),legacyLast:initial?.last,legacySettings};
  window.addEventListener('xiaomai-sync-status',updateStatus);
})();
