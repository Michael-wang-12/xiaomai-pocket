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
      const message=sync?.enabled?sync.status:(id==='pocketSyncStatus'?'用 UU 的原专属链接打开，即可在两台手机间同步。':'');
      if(el.textContent!==message)el.textContent=message;
    }
  }
  function mount(){
    const box=$('syncSettings');if(!box)return;
    box.innerHTML='<div class="about-entry"><div><strong>设备同步</strong><small id="pocketSyncStatus" role="status" aria-live="polite"></small></div><button id="pocketSyncNow" type="button">立即同步</button></div>';
    const sync=window.XM_SYNC,button=$('pocketSyncNow');button.hidden=!sync?.enabled;
    if(sync?.enabled){
      const note=document.createElement('p');
      note.textContent='两台手机共用这一份口袋。持有完整专属链接的人可以查看和更改聊天、偏好和互动进度。';
      box.append(note);button.onclick=()=>sync.refresh();
    }
    updateStatus();
  }
  window.XM_POCKET_APP={read,apply,mount,status:updateStatus,legacyGame:Boolean(initial&&initial.version===1),legacyLast:initial?.last,legacySettings};
  window.addEventListener('xiaomai-sync-status',updateStatus);
})();
