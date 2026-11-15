// All devices visiting this site share the same pocket.
(() => {
  'use strict';
  const app = window.XM_POCKET_APP;
  const prefix = 'xiaomai-pocket-sync-v1.';
  const headKey = prefix + 'head', flightKey = prefix + 'sending', rowPrefix = prefix + 'edit.';
  const presetKey = 'xiaomai-conversations-v1-preset';
  const endpoint = window.XIAOMAI_CHAT_CONFIG?.endpoint;
  const enabled = Boolean(app && endpoint);
  let status = enabled ? '正在查看云端记录…' : '当前页面未连接云端同步';
  const notify = text => {
    if (text === status) return;
    status = text;
    window.dispatchEvent(new Event('xiaomai-sync-status'));
  };
  window.XM_SYNC = {enabled, get status() {return status;}, changed, refresh, beforeChat};
  if (!enabled) return;

  // Each edit gets its own durable key. Another tab cannot replace an offline edit.
  // A frozen batch also keeps its device/sequence if a response gets lost.
  const volatile = new Map();
  const removed = new Set();
  let storageLimited = false;
  function raw(key) {
    if (removed.has(key)) return null;
    if (volatile.has(key)) return volatile.get(key);
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function get(key) {
    try { return JSON.parse(raw(key)); } catch { return null; }
  }
  function put(key, value) {
    const data = JSON.stringify(value);
    removed.delete(key);
    try {
      localStorage.setItem(key, data);
      volatile.delete(key);
    } catch {
      volatile.set(key, data);
      storageLimited = true;
    }
  }
  function drop(key) {
    volatile.delete(key);
    try { localStorage.removeItem(key); } catch { removed.add(key); }
  }
  function rowKeys() {
    const keys = new Set(volatile.keys());
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) keys.add(key);
      }
    } catch {}
    return [...keys].filter(key => key.startsWith(rowPrefix) && !removed.has(key)).sort();
  }
  function randomId() {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  const writer = randomId();
  let serial = 0;
  const copy = value => JSON.parse(JSON.stringify(value));
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const listKeys = ['retention', 'effort', 'smallTalk'];
  let metadata = get(headKey);
  if (!metadata?.device) metadata = {device:randomId(), ack:0, revision:0, epoch:0};
  let appliedRevision = -1, screenRevision = metadata.revision, screenEpoch = metadata.epoch;
  let writeEpoch = screenEpoch, localClearEpoch = -1, pendingClear = '', applying = false;
  let timer, running, retryDelay = 2500, lastActivity = Date.now(), lastPull = 0;
  let privateIds = new Set();

  function sample() {
    const s = app.read();
    const messages = s.entries || [];
    if (s.retention === 'off') privateIds = new Set(messages.map(item => item.id));
    else if (privateIds.size) privateIds = new Set(messages.filter(item => privateIds.has(item.id)).map(item => item.id));
    const entries = messages.filter(item => s.retention !== 'off' && !privateIds.has(item.id)).map(item => {
      const e = {id:item.id, role:item.role, at:item.at, text:item.text, source:item.source==='wechat'?'wechat':'web'};
      if (e.source==='wechat' && item.timeUnknown===true) e.timeUnknown=true;
      if (item.replyTo) e.replyTo = item.replyTo;
      for (const flag of ['photo', 'edited', 'spontaneous']) if (item[flag] === true) e[flag] = true;
      return e;
    });
    const examples = (s.examples || []).map(item => {
      const e = {id:item.id, prompt:item.prompt, original:item.original, preferred:item.preferred};
      if (typeof item.entryId === 'string') e.entryId = item.entryId;
      if (Number.isFinite(item.at)) e.at = item.at;
      return e;
    });
    return {game:s.game ? copy(s.game) : null, entries, examples, preferences:[...(s.preferences || [])],
      retention:s.retention, effort:s.effort, smallTalk:s.smallTalk};
  }
  let local = sample();
  function enqueue(content) {
    const key = rowPrefix + Date.now().toString(36).padStart(11, '0') + '.' + writer + '.' + (++serial).toString(36).padStart(6, '0');
    put(key, {writer, baseRev:screenRevision, messageEpoch:writeEpoch, ...(pendingClear ? {afterClear:pendingClear} : {}), ...content});
  }
  if (!metadata.initialized) {
    const seed = {};
    if (app.legacyGame && local.game) {
      seed.game = copy(local.game);
      if (Number.isFinite(app.legacyLast) && app.legacyLast > 0) seed.game.last = app.legacyLast;
    }
    for (const field of ['entries', 'examples', 'preferences']) if (local[field].length) seed[field] = local[field];
    for (const field of listKeys) if (app.legacySettings?.[field]) seed[field] = local[field];
    if (Object.keys(seed).length) enqueue({baseline:seed});
    metadata.initialized = true;
    put(headKey, metadata);
  }
  // A local clear could have been queued before Safari closed the previous page.
  for (const key of rowKeys()) {
    const row = get(key);
    if (row?.changes?.clearChat && row.messageEpoch + 1 >= writeEpoch) {
      writeEpoch = localClearEpoch = row.messageEpoch + 1;
      pendingClear = row.clearTag || '';
    } else if (row?.afterClear && row.messageEpoch === writeEpoch) {
      pendingClear = row.afterClear;
    }
  }

  function changedItems(before, after, key) {
    const previous = new Map(before.map(item => [item[key], item]));
    return after.filter(item => !same(previous.get(item[key]), item));
  }
  function gameChanged(before, after) {
    if (!before || !after) return before !== after;
    // Opening/closing Safari refreshes last even when no interaction took place.
    const {last:oldLast, ...oldGame} = before;
    const {last:newLast, ...newGame} = after;
    return !same(oldGame, newGame);
  }
  function difference(before, after, reason) {
    const changes = {};
    const entries = changedItems(before.entries, after.entries, 'id');
    if (entries.length) changes.entries = entries;
    const add = after.preferences.filter(value => !before.preferences.includes(value));
    const remove = before.preferences.filter(value => !after.preferences.includes(value));
    if (add.length || remove.length) changes.preferences = {add,remove};
    const put = changedItems(before.examples, after.examples, 'id');
    const removedIds = before.examples.filter(old => !after.examples.some(item => item.id === old.id)).map(item => item.id);
    if (put.length || removedIds.length) changes.examples = {put,remove:removedIds};
    if (after.game && gameChanged(before.game, after.game)) changes.game = {before:before.game,after:after.game};
    for (const field of listKeys) if (before[field] !== after[field]) changes[field] = after[field];
    if (reason === 'clearChat' || (before.retention !== 'off' && after.retention === 'off')) changes.clearChat = true;
    if (reason === 'clearPreferences') changes.clearPreferences = true;
    return changes;
  }
  function finishPreset(removeSource, result) {
    metadata = {...(get(headKey) || metadata), presetImported:true};
    if (result) {
      metadata.revision = result.revision;
      metadata.epoch = result.messageEpoch;
    }
    put(headKey, metadata);
    if (removeSource) drop(presetKey);
  }
  async function migratePreset(result) {
    if ((get(headKey) || metadata).presetImported) return result;
    const archive = get(presetKey);
    if (archive?.version !== 1 || !Array.isArray(archive.entries)) {
      finishPreset(false);
      return result;
    }
    // A preset-only browser used a different local archive before public sync.
    // Check the current cloud generation before transmitting any old messages.
    if (result.messageEpoch !== 0 || result.snapshot.retention === 'off' || local.retention === 'off') {
      finishPreset(true);
      return result;
    }
    const now = Date.now(), day = 86400000;
    const cutoff = ['7','30'].includes(local.retention) ? now - Number(local.retention) * day : 0;
    const byId = new Map();
    for (const item of archive.entries) {
      if (!item || typeof item.id !== 'string' || !item.id.trim() || item.id.length > 80 ||
        !['user','assistant','notice'].includes(item.role) || typeof item.text !== 'string' ||
        !item.text.trim() || item.text.length > 800 || !Number.isSafeInteger(item.at) ||
        item.at <= 0 || item.at < cutoff || item.at > now + day) continue;
      const entry = {id:item.id,role:item.role,text:item.text,at:item.at,source:'web'};
      if (typeof item.replyTo === 'string' && item.replyTo.trim() && item.replyTo.length <= 80) entry.replyTo = item.replyTo;
      for (const flag of ['photo','edited','spontaneous']) if (item[flag] === true) entry[flag] = true;
      byId.set(entry.id,entry);
    }
    const cloud = new Map(result.snapshot.entries.map(item => [item.id,item]));
    const entries = [...byId.values()].filter(item => {
      const saved = cloud.get(item.id);
      return !saved || (item.role === 'assistant' && saved.role === 'assistant' && item.edited && !saved.edited);
    }).sort((a,b) => a.at - b.at || a.id.localeCompare(b.id)).slice(-200);
    if (entries.length) {
      // Keep the main device's acknowledgements intact when it already synced in v8.7.
      const imported = await request({device:'preset_' + metadata.device,seq:1,baseRev:0,messageEpoch:0,baseline:{entries}});
      result = {...imported, ack:result.ack};
    }
    finishPreset(true, result);
    return result;
  }
  function scrubMessages(row) {
    let modified = false;
    for (const group of ['baseline','changes']) {
      if (row?.[group]?.entries) {delete row[group].entries; modified = true;}
    }
    return modified;
  }
  function capture(reason) {
    if (applying) return false;
    const next = sample(), changes = difference(local, next, reason);
    local = next;
    if (!Object.keys(changes).length) return false;
    if (changes.clearChat) {
      finishPreset(true);
      // A chat clear or "this session only" also removes plaintext from offline batches.
      for (const key of rowKeys()) {
        const row = get(key);
        if (scrubMessages(row)) put(key, row);
      }
      const flight = get(flightKey);
      if (scrubMessages(flight?.body)) put(flightKey, flight);
    }
    if (changes.clearChat) {
      const tag = randomId();
      enqueue({changes, clearTag:tag});
      pendingClear = tag;
      localClearEpoch = ++writeEpoch;
    } else enqueue({changes});
    return true;
  }
  function changed(reason) {
    if (!enabled || applying || !capture(reason)) return;
    notify(storageLimited ? '本机暂存空间不足，请保持页面打开以完成同步' :
      navigator.onLine === false ? '已在本机记录，联网后同步' : '有新记录，等待同步…');
    if (!running) schedule(650);
  }

  function compact(rows) {
    const changes = {}, messages = new Map(), add = new Set(), remove = new Set();
    const putExamples = new Map(), removeExamples = new Set();
    for (const row of rows) {
      const edit = row.changes;
      if (!edit) continue;
      if (edit.clearChat) {changes.clearChat = true; messages.clear();}
      if (edit.clearPreferences) {changes.clearPreferences = true; add.clear(); remove.clear();}
      for (const entry of edit.entries || []) messages.set(entry.id, entry);
      for (const value of edit.preferences?.remove || []) {add.delete(value); remove.add(value);}
      for (const value of edit.preferences?.add || []) {remove.delete(value); add.add(value);}
      for (const id of edit.examples?.remove || []) {putExamples.delete(id); removeExamples.add(id);}
      for (const item of edit.examples?.put || []) {removeExamples.delete(item.id); putExamples.set(item.id,item);}
      if (edit.game) changes.game = {before:changes.game ? changes.game.before : edit.game.before, after:edit.game.after};
      for (const field of listKeys) if (owns(edit, field)) changes[field] = edit[field];
    }
    if (messages.size) changes.entries = [...messages.values()].slice(-200);
    if (add.size || remove.size) changes.preferences = {add:[...add], remove:[...remove]};
    if (putExamples.size || removeExamples.size) changes.examples = {put:[...putExamples.values()], remove:[...removeExamples]};
    return changes;
  }
  function nextJob() {
    const existing = get(flightKey);
    if (existing?.body) return existing;
    const keys = rowKeys();
    if (!keys.length) return null;
    const meta = get(headKey) || metadata, ids = [], rows = [];
    for (const key of keys) {
      const row = get(key);
      if (!row) continue;
      const first = rows[0];
      if (first && (first.writer !== row.writer || first.baseRev !== row.baseRev || first.messageEpoch !== row.messageEpoch || first.afterClear !== row.afterClear ||
        row.baseline || first.baseline || row.changes?.clearChat || row.changes?.clearPreferences || rows.length >= 16)) break;
      if (first && (row.changes?.preferences || row.changes?.examples)) {
        const combined = compact([...rows, row]);
        if (combined.preferences?.add.length > 24 || combined.preferences?.remove.length > 24 ||
          combined.examples?.put.length > 12 || combined.examples?.remove.length > 12) break;
      }
      ids.push(key); rows.push(row);
      if (row.changes?.clearChat || row.changes?.clearPreferences) break;
    }
    if (!rows.length) return null;
    const first = rows[0], body = {device:meta.device, seq:meta.ack + 1, baseRev:first.baseRev, messageEpoch:first.messageEpoch};
    if (first.clearTag) body.clearTag = first.clearTag;
    if (first.afterClear) body.afterClear = first.afterClear;
    if (first.baseline) body.baseline = first.baseline;
    if (!first.baseline) body.changes = compact(rows);
    const job = {ids, body};
    put(flightKey, job);
    return job;
  }
  async function request(body) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 16000);
    try {
      const data = JSON.stringify(body);
      const res = await fetch(new URL('pocket-sync', endpoint).href, {
        method:'POST', mode:'cors', credentials:'omit', redirect:'error', cache:'no-store', referrerPolicy:'no-referrer',
        headers:{'Content-Type':'application/json'}, body:data,
        keepalive:document.hidden && new Blob([data]).size < 55000, signal:controller.signal
      });
      if (!res.ok) throw Object.assign(new Error('sync refused'), {http:res.status});
      const result = await res.json();
      if (!Number.isSafeInteger(result.revision) || !Number.isSafeInteger(result.messageEpoch) ||
        !Array.isArray(result.snapshot?.entries) || !Number.isSafeInteger(result.ack) ||
        (body.seq && result.ack < body.seq)) throw new Error('incomplete sync');
      return result;
    } finally {clearTimeout(timeout);}
  }
  async function exchange() {
    let result;
    for (let turn = 0; turn < 12; turn++) {
      const job = nextJob();
      if (!job && result) break;
      metadata = get(headKey) || metadata;
      result = await request(job ? job.body : {device:metadata.device});
      lastPull = Date.now();
      metadata = {...metadata, ack:Math.max(metadata.ack, result.ack), revision:result.revision, epoch:result.messageEpoch};
      put(headKey, metadata);
      if (job) {
        for (const key of job.ids) drop(key);
        drop(flightKey);
      }
      // Changes made while fetch was running are already in the journal. An
      // explicit sample also catches a save made immediately before the response.
      capture();
      if (!rowKeys().length) {
        result = await migratePreset(result);
        capture();
        if (!rowKeys().length) break;
      }
    }
    if (rowKeys().length) return false;
    if (result && (appliedRevision !== result.revision || screenEpoch !== result.messageEpoch)) {
      applying = true;
      try {
        const ownClear = result.messageEpoch === localClearEpoch && result.clearTag === pendingClear;
        const chatReset = result.messageEpoch !== screenEpoch && !ownClear;
        app.apply(result.snapshot, {chatReset});
        local = sample();
        screenRevision = appliedRevision = result.revision;
        writeEpoch = screenEpoch = result.messageEpoch;
        localClearEpoch = -1; pendingClear = '';
      } finally { applying = false; }
    }
    return true;
  }
  async function locked(work) {
    if (navigator.locks?.request) return navigator.locks.request(prefix + 'exchange', work);
    // Older browsers don't have Web Locks. Give another tab's active request time
    // to finish; immutable local edits are still collected while it owns the lease.
    const key = prefix + 'lease';
    const lease = get(key);
    if (lease && lease.owner !== writer && lease.until > Date.now()) return false;
    put(key, {owner:writer, until:Date.now()+35000});
    await new Promise(resolve => setTimeout(resolve, 36));
    if (get(key)?.owner !== writer) return false;
    const renewal = setInterval(() => {
      if (get(key)?.owner === writer) put(key, {owner:writer,until:Date.now()+35000});
    }, 7000);
    try { return await work(); }
    finally {clearInterval(renewal); if (get(key)?.owner === writer) drop(key);}
  }
  function schedule(delay) {
    clearTimeout(timer);
    if (!document.hidden && navigator.onLine !== false) timer = setTimeout(refresh, delay);
  }
  function beforeChat() {
    if (!enabled || navigator.onLine === false) return;
    if (running || Date.now() - lastPull > 8000) return refresh();
  }
  function refresh() {
    if (!enabled) return Promise.resolve(false);
    if (running) return running;
    clearTimeout(timer);
    if (navigator.onLine === false) {notify('当前离线，联网后自动同步'); return Promise.resolve(false);}
    notify('正在同步记录…');
    running = Promise.resolve().then(() => locked(exchange)).then(done => {
      retryDelay = 2500;
      if (!done) {notify('有记录等待同步…'); schedule(1000); return false;}
      const clock = new Date().toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit',hour12:false});
      notify('已同步 · ' + clock);
      const delay = app.historyVisible?.() ? 10000 : Date.now() - lastActivity < 300000 ? 25000 : 180000;
      schedule(delay);
      return true;
    }).catch(error => {
      if (error.http === 401 || error.http === 403) {notify('同步服务暂未接受请求，请稍后再试'); return false;}
      notify(storageLimited ? '本机暂存空间不足，请保持页面打开并重试' :
        rowKeys().length ? '云端暂未连上，新记录在本机等待重试' : '云端暂未连上，可以稍后重试');
      schedule(retryDelay); retryDelay = Math.min(60000, retryDelay * 2);
      return false;
    }).finally(() => {running = null;});
    return running;
  }
  window.addEventListener('online', refresh);
  window.addEventListener('offline', () => {clearTimeout(timer); notify('当前离线，联网后自动同步');});
  window.addEventListener('pageshow', () => {if (!lastPull || Date.now()-lastPull>3000) refresh();});
  document.addEventListener('visibilitychange', () => {
    clearTimeout(timer);
    if (!document.hidden) {lastActivity = Date.now(); refresh();}
    else if (rowKeys().length) refresh();
  });
  const active = () => {
    const wasIdle = Date.now()-lastActivity >= 240000;
    lastActivity = Date.now();
    if (wasIdle || Date.now()-lastPull > 35000) schedule(500);
  };
  document.addEventListener('pointerdown', active, {passive:true});
  document.addEventListener('keydown', active);
  window.addEventListener('storage', event => {
    if (event.key === headKey && !document.hidden && !running) schedule(350);
  });
  refresh();
})();
