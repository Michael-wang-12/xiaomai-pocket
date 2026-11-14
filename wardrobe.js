// Garments and wearable slots are saved independently. Legacy full-look saves migrate once.
const XM_WEAR=(()=>{
 const clothes=['trench','leather','bomber','blackshirt'];
 const slots={head:['cap','headphone','crown','party'],eyes:['sunglass'],neck:['scarf'],chest:['flower']};
 const empty=()=>({head:'',eyes:'',neck:'',chest:'',tie:false});
 function normalize(raw={}){
  const accessories=empty(),saved=raw.accessories;
  if(saved&&typeof saved==='object'&&!Array.isArray(saved)){
   for(const [slot,ids]of Object.entries(slots))if(ids.includes(saved[slot]))accessories[slot]=saved[slot];
   accessories.tie=saved.tie===true;
  }
  const legacy=raw.outfit;
  for(const [slot,ids]of Object.entries(slots))if(ids.includes(legacy))accessories[slot]=legacy;
  if(legacy==='blackshirt-tie')accessories.tie=true;
  return {outfit:clothes.includes(legacy)?legacy:legacy==='blackshirt-tie'?'blackshirt':'trench',accessories};
 }
 const body=(state,outfit=state.outfit)=>outfit==='blackshirt'&&state.accessories.tie?'blackshirt-tie':outfit;
 const active=state=>[...Object.keys(slots).map(slot=>state.accessories[slot]).filter(Boolean),...(state.outfit==='blackshirt'&&state.accessories.tie?['tie']:[])];
 const bodySource=(frame,outfit)=>'assets/wear-'+outfit+'-'+SHEET_NAMES[sheetIndex(frame)]+(outfit==='trench'?'-v6.png':'-v5.png');
 const overlaySource=(id,frame)=>'assets/overlay-'+id+'-'+SHEET_NAMES[sheetIndex(frame)]+'-v6.png';
 const headSource=(id,frame)=>'assets/wear-'+id+'-'+SHEET_NAMES[sheetIndex(frame)]+(id==='cap'&&sheetIndex(frame)===1?'-v6.png':'-v5.png');
 function layers(frame,state,outfit=state.outfit){
  const list=[{id:'body',url:bodySource(frame,body(state,outfit))}];
  if(state.accessories.head)list.push({id:'head',url:headSource(state.accessories.head,frame)});
  for(const slot of ['eyes','chest','neck'])if(state.accessories[slot]&&!(slot==='chest'&&frame>=41&&frame<=48)&&!(slot==='eyes'&&frame>=42&&frame<=45))list.push({id:slot,url:overlaySource(state.accessories[slot],frame)});
  return list;
 }
 // Head-only replacement keeps caps/headphones fitted to hair without restoring an old coat.
 // Coordinates follow all 52 existing poses, including the 16 real side/back views.
 const heads=[
  [55,40,27],[49,40,27],[47,40,27],[50,46,28],[49,40,27],[47,42,27],[55,40,27],[49,42,28],[46,40,27],
  [55,44,28],[48,41,28],[48,40,28],[50,43,28],[49,42,28],[49,41,28],[50,43,29],[50,42,28],[49,43,28],
  [51,40,28],[51,40,28],[50,40,28],[51,40,28],[51,40,28],[51,40,28],[51,40,28],[51,40,28],[49,45,29],
  [52,40,28],[48,41,28],[52,40,28],[45,42,28],[54,43,29],[53,39,28],[49,40,28],[48,41,28],[54,41,28],
  [52,43,29],[51,43,29],[51,43,29],[51,43,29],[52,43,29],[53,43,29],[52,43,29],[51,43,29],[50,43,29],[49,43,29],[50,43,29],[51,43,29],[51,43,29],[51,43,29],[51,43,29],[51,43,29]
 ];
 const scarfFit=Array.from({length:52},(_,frame)=>{const sheet=frame>=36?4:Math.floor(frame/9);return sheet===0?[5.5,11.5,.9,.75]:sheet===1?[5,8,.9,.88]:sheet===2?[5.3,8,.9,.85]:sheet===3?[4,8,.92,.84]:[2.6,5.5,.95,.92]});
 const foreground={
  4:['34,42 66,42 68,55 61,60 36,57'],
  6:['0,0 100,0 100,8 0,8','30,7 41,7 39,30 33,34 29,22','64,7 75,7 77,21 73,34 67,31'],
  9:['28,19 38,19 44,31 41,48 32,45 27,30'],
  19:['37,35 51,34 58,39 57,46 47,51 37,46'],
  22:['35,37 42,32 55,33 61,39 59,47 51,51 42,48 34,43'],
  24:['30,39 48,37 53,46 67,49 66,59 57,64 43,57 32,55'],
  25:['36,33 43,34 44,44 41,50 35,46','59,32 64,32 65,47 61,51 56,43'],
  26:['27,48 35,43 43,45 56,46 65,48 72,60 70,90 26,90'],
  33:['34,30 43,28 48,31 54,34 61,35 63,47 57,53 37,47 31,40']
 };
 const frontMasks=new Map();
 function frontMask(frame){if(!foreground[frame])return '';if(!frontMasks.has(frame))frontMasks.set(frame,'url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'+foreground[frame].map(points=>'<polygon fill="white" points="'+points+'"/>').join('')+'</svg>')+'")');return frontMasks.get(frame)}
 const masks=new Map();
 function headShape(frame){
  if(masks.has(frame))return masks.get(frame);
  const [x,b,w]=heads[frame]||heads[0];
  const points=[[x-w,0],[x+w,0],[x+w,b-12],[x+18,b-5],[x+7,b],[x-7,b],[x-18,b-5],[x-w,b-12]];
  const polygon='polygon('+points.map(p=>p[0]+'% '+p[1]+'%').join(',')+')';
  const hole='M'+points.map(p=>p.join(' ')).join('L')+'Z';
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="white" fill-rule="evenodd" d="M0 0H100V100H0Z'+hole+'"/></svg>';
  const inverse='url("data:image/svg+xml,'+encodeURIComponent(svg)+'")';
  const value={polygon,inverse};masks.set(frame,value);return value;
 }
 function paint(sprite,frame,state,url){
  const turn=frame>=36,n=turn?frame-36:frame%9,cols=turn?4:3;
  const position=(n%cols)*100/(cols-1)+'% '+Math.floor(n/cols)*100/(cols-1)+'%';
  const size=turn?'400% 400%':'300% 300%';
  sprite.style.backgroundImage='none';sprite.style.backgroundSize=size;sprite.style.backgroundPosition=position;
  sprite.dataset.source=url;sprite.dataset.accessories=active(state).join(',');
  const wanted=layers(frame,state),shape=state.accessories.head?headShape(frame):null,front=(shape||state.accessories.neck)?frontMask(frame):'';
  if(front)wanted.push({id:'front',url});
  for(const old of [...sprite.children])if(!wanted.some(x=>x.id===old.dataset.layer))old.remove();
  for(const part of wanted){
   let el=sprite.querySelector('[data-layer="'+part.id+'"]');
   if(!el){el=document.createElement('div');el.className='sprite-layer wear-'+part.id;el.dataset.layer=part.id;el.setAttribute('aria-hidden','true');sprite.append(el)}
   el.style.backgroundImage='url("'+(part.id==='body'?url:part.url)+'")';el.style.backgroundSize=size;el.style.backgroundPosition=position;
   el.style.clipPath=part.id==='head'?shape.polygon:'';
   if(part.id==='neck'){const [x,y,sx,sy]=scarfFit[frame];el.style.transformOrigin='0 0';el.style.transform='translate('+x+'%,'+y+'%) scale('+sx+','+sy+')'}
   const mask=part.id==='front'?front:part.id==='body'&&shape?shape.inverse:'';el.style.maskImage=mask;el.style.webkitMaskImage=mask;
  }
 }
 return {clothes,slots,empty,normalize,body,active,bodySource,overlaySource,headSource,layers,paint,headShape};
})();
