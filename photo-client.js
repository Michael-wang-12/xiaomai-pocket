(()=>{
 const $=id=>document.getElementById(id),form=$('chatForm'),MAX_INPUT=20*1024*1024,MAX_BYTES=700*1024,MAX_EDGE=1280,TTL=600000;
 let draft=null,active=null,activeTimer=0,processing=false,generation=0,pendingQuestion='';
 const style=document.createElement('style');style.textContent='.photo-button{position:relative;width:38px;min-width:38px;min-height:35px;border-radius:10px;background:#edf2e7;color:#456443;font-size:25px}.photo-button.has-photo:after{content:"";position:absolute;right:4px;top:4px;width:5px;height:5px;border-radius:50%;background:#6e9158}.photo-source-options{display:flex;gap:10px;margin:14px 0}.photo-source-options button{flex:1;padding:14px 8px;border-radius:12px;background:#e9efdf;min-height:48px}.photo-preview{display:block;max-width:100%;max-height:36svh;object-fit:contain;border-radius:14px;background:#edf1e7;margin:12px auto}.photo-question{display:block;box-sizing:border-box;width:100%;font:16px/1.65 inherit;font-family:inherit;font-size:16px;line-height:1.65;border:1px solid #c8d6be;border-radius:12px;padding:11px;min-height:85px;margin:8px 0}.photo-actions{display:flex;gap:10px;margin:14px 0}.photo-actions button{min-height:44px;border-radius:12px;padding:10px 14px}.photo-actions .primary{flex:1}.photo-keep{display:flex;gap:9px;align-items:flex-start;font-size:12px;line-height:1.65;margin:14px 0}.photo-keep input{margin-top:4px;flex:none}.photo-context{display:flex;align-items:center;gap:9px;margin:0 2px 8px;background:#eaf0e3;border-radius:12px;padding:7px;font-size:10px;color:#52694b}.photo-context img{width:38px;height:38px;object-fit:cover;border-radius:8px}.photo-context span{flex:1;min-width:0;line-height:1.6}.photo-context button{min-width:34px;min-height:34px;background:#fff8;border-radius:9px}.photo-error{color:#976229;font-size:12px}.conversation>small{display:block;color:#718365;font-size:10px;margin-top:7px}';document.head.append(style);
 const button=document.createElement('button');button.type='button';button.className='photo-button';button.id='photoButton';button.textContent='＋';button.setAttribute('aria-label','添加照片');form.prepend(button);
 const chip=document.createElement('div');chip.id='photoContext';chip.className='photo-context';chip.hidden=true;const chipImage=document.createElement('img');chipImage.alt='本次对话使用的照片';const chipText=document.createElement('span');const removeActive=document.createElement('button');removeActive.type='button';removeActive.textContent='×';removeActive.setAttribute('aria-label','不再发送这张照片');chip.append(chipImage,chipText,removeActive);form.before(chip);
 const album=document.createElement('input'),camera=document.createElement('input');for(const field of [album,camera]){field.type='file';field.accept='image/*';field.hidden=true;document.body.append(field);field.addEventListener('change',()=>{const file=field.files?.[0];field.value='';if(file)void selectFile(file)})}album.id='photoAlbumInput';camera.id='photoCameraInput';camera.setAttribute('capture','environment');
 function sync(){button.disabled=processing||window.XM_AI?.busy;button.textContent='＋';button.classList.toggle('has-photo',Boolean(draft));button.setAttribute('aria-label',draft?'照片待确认，打开预览':'添加照片');removeActive.disabled=Boolean(window.XM_AI?.busy)}
 new MutationObserver(sync).observe(form,{attributes:true,attributeFilter:['aria-busy']});
 function clearActive(){clearTimeout(activeTimer);activeTimer=0;active=null;chip.hidden=true;chipImage.removeAttribute('src')}
 function setActive(photo){clearActive();if(!photo)return;active={...photo,expires:Date.now()+TTL};chipImage.src=photo.dataUrl;chipText.textContent='本次聊天继续使用这张照片\n仅在本次打开保留，10分钟后移除';chip.hidden=false;activeTimer=setTimeout(clearActive,TTL)}
 removeActive.onclick=()=>{clearActive();toast('后续消息不再附带这张照片')};
 function releasePreview(){$('photoPreview')?.removeAttribute('src')}
 function clear(){generation++;draft=null;processing=false;pendingQuestion='';releasePreview();clearActive();sync()}
 function cancelPending(){generation++;draft=null;processing=false;pendingQuestion='';releasePreview();sync()}
 document.addEventListener('click',e=>{if(dialogKind.startsWith('photo')&&(e.target===$('veil')||e.target.closest('#closeSheet')))cancelPending()},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&dialogKind.startsWith('photo'))cancelPending()},true);
 function sourcePicker(){if(!XM_AI.online){toast('请通过智能版链接打开，再和小麦聊照片。');return}if(XM_AI.busy)return;if(draft){preview();return}pendingQuestion=$('chatInput').value.trim().slice(0,600);openSheet('给小麦看张照片','<p>先选择照片或拍一张，预览确认后才会发送。</p><div class="photo-source-options"><button id="chooseAlbum">从相册选择</button><button id="takePhoto">拍一张</button></div><p>照片会通过现有聊天服务交给模型查看，使用现有 API 额度。原图不写入聊天存档。</p>','photo-source');$('chooseAlbum').onclick=()=>album.click();$('takePhoto').onclick=()=>camera.click()}
 button.onclick=sourcePicker;
 function jpegBlob(canvas,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('照片没能压缩，请换一张再试。')),'image/jpeg',quality))}
 function dataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('照片没能读取，请重新选择。'));reader.readAsDataURL(blob)})}
 async function compress(file){
  if(!file||!file.size||file.size>MAX_INPUT)throw Error('请选择20MB以内的照片。');
  if(file.type&&!/^image\/(?:jpeg|png|webp|heic|heif)$/i.test(file.type))throw Error('请选择JPEG、PNG或手机拍摄的普通照片。');
  const url=URL.createObjectURL(file),image=new Image();
  try{
   await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('这张照片格式暂时读不到，试试重新拍一张，或选JPEG、PNG照片。'));image.src=url});
   if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>50000000)throw Error('这张照片分辨率过高，请先选择普通尺寸。');
   const canvas=document.createElement('canvas'),ratio=Math.min(1,MAX_EDGE/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));const ctx=canvas.getContext('2d');if(!ctx)throw Error('照片没能准备好，请重新打开页面。');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
   let blob;for(const quality of [.82,.66,.5,.35]){blob=await jpegBlob(canvas,quality);if(blob.size<=MAX_BYTES)break}
   if(!blob||blob.size>MAX_BYTES)throw Error('照片压缩后仍然偏大，请换一张较小的照片。');
   return {dataUrl:await dataUrl(blob),width:canvas.width,height:canvas.height,bytes:blob.size};
  }finally{URL.revokeObjectURL(url);image.src=''}
 }
 async function selectFile(file){
  if(XM_AI.busy)return false;const token=++generation;draft=null;processing=true;sync();openSheet('正在准备照片','<p>正在缩小照片，确认后才会发送……</p>','photo-preparing');
  try{const photo=await compress(file);if(token!==generation||dialogKind!=='photo-preparing'||$('veil').hidden)return false;draft=photo;preview();return true}
  catch(error){if(token===generation&&dialogKind==='photo-preparing'){openSheet('这张照片还没准备好','<p id="photoReadError" class="photo-error"></p><button class="primary" id="chooseAgain">重新选择</button>','photo-source');$('photoReadError').textContent=error.message;$('chooseAgain').onclick=()=>{draft=null;sourcePicker()}}return false}
  finally{if(token===generation){processing=false;sync()}}
 }
 function preview(){
  if(!draft)return;openSheet('确认后发给小麦','<img id="photoPreview" class="photo-preview" alt="待发送的照片预览"><p id="photoSize" class="small"></p><label for="photoQuestion">想和小麦聊什么？</label><textarea id="photoQuestion" class="photo-question" maxlength="600" rows="3" placeholder="比如：这杯咖啡看起来怎么样？"></textarea><label class="photo-keep"><input id="keepPhoto" type="checkbox"><span>本次打开继续围绕这张照片聊。它会随后续消息一起发送，最多保留10分钟，可随时移除。</span></label><p class="small">不勾选时只用于这一条消息。聊天记录只留“发过照片”的标记，刷新后不保存原图。</p><div class="photo-actions"><button id="cancelPhoto">移除</button><button class="primary" id="sendPhoto">确认发送</button></div>','photo-preview');
  $('photoPreview').src=draft.dataUrl;$('photoSize').textContent=draft.width+' × '+draft.height+' · '+Math.ceil(draft.bytes/1024)+'KB';$('photoQuestion').value=pendingQuestion;
  $('cancelPhoto').onclick=()=>{draft=null;pendingQuestion='';releasePreview();sync();closeSheet();toast('照片已移除')};
  $('sendPhoto').onclick=async()=>{
   if(XM_AI.busy||!draft)return;const token=++generation,photo=draft,question=$('photoQuestion').value.trim().slice(0,600)||'看看这张照片，跟我聊聊。',keep=$('keepPhoto').checked;pendingQuestion=question;draft=null;releasePreview();setActive(keep?photo:null);sync();closeSheet();$('chatInput').value='';
   const ok=await XM_AI.send(question,photo);if(token!==generation)return;if(ok){pendingQuestion='';sync()}else{draft=photo;sync();toast('照片还在预览里，可以点相机按钮再试')}
  };
 }
 window.addEventListener('pagehide',clear);
 window.XM_PHOTO={select:selectFile,clear,get busy(){return processing},get hasPendingPhoto(){return Boolean(draft)},get current(){if(active&&Date.now()>=active.expires)clearActive();return active?{dataUrl:active.dataUrl,width:active.width,height:active.height}:null}};
 sync();
})();
