/* eggframe · app.js */

/* ── STATE ─────────────────────────────────────────────────── */
const S = {
  photos:[], slots:[], gallery:[], mosaicRegions:[],
  photoCount:1, layout:'1x1', ratio:'1:1', gap:0, bgColor:'#FFFFFF',
  wm:{ on:false, color:'#ffffff', opacity:30 },
  mosaicTool:'rect', lb:{ open:false, src:'photos', idx:0, zoom:100, px:0, py:0 },
};
let pidSeq=0, gidSeq=0, dragPhotoId=null;

/* ── LAYOUTS ─────────────────────────────────────────────────── */
const LAYOUTS = {
  1:[{key:'1x1',cols:1,rows:1,areas:[['a']]}],
  2:[{key:'2h',cols:2,rows:1,areas:[['a','b']]},{key:'2v',cols:1,rows:2,areas:[['a'],['b']]}],
  3:[{key:'3h',cols:3,rows:1,areas:[['a','b','c']]},{key:'3v',cols:1,rows:3,areas:[['a'],['b'],['c']]},
     {key:'2t1',cols:2,rows:2,areas:[['a','a'],['b','c']]},{key:'1t2',cols:2,rows:2,areas:[['a','b'],['c','c']]}],
  4:[{key:'4g',cols:2,rows:2,areas:[['a','b'],['c','d']]},{key:'4h',cols:4,rows:1,areas:[['a','b','c','d']]},
     {key:'1L3',cols:2,rows:2,areas:[['a','b'],['a','c']]},{key:'3L1',cols:2,rows:2,areas:[['a','b'],['c','b']]}],
};
const RATIOS={'1:1':[1,1],'4:5':[4,5],'3:4':[3,4],'9:16':[9,16],'16:9':[16,9],'5:4':[5,4],'4:3':[4,3],'3:2':[3,2]};
const $=s=>document.querySelector(s);

/* ── PHOTOS ─────────────────────────────────────────────────── */
function addPhotos(files){
  Promise.all([...files].map(f=>new Promise(r=>{
    const rd=new FileReader();
    rd.onload=e=>r({id:++pidSeq,src:e.target.result,name:f.name,heart:false});
    rd.readAsDataURL(f);
  }))).then(items=>{S.photos.push(...items);renderPhotoList();updateDropZone();});
}
function renderPhotoList(){
  const el=$('#photo-list'); el.innerHTML='';
  S.photos.forEach((p,i)=>{
    const d=document.createElement('div');
    d.className='photo-item'; d.dataset.id=p.id; d.draggable=true;
    d.innerHTML=`<img src="${p.src}" /><div class="photo-overlay">
      <button class="photo-btn" data-a="heart">${p.heart?'🧡':'🤍'}</button>
      <button class="photo-btn" data-a="view">🔍</button>
      <button class="photo-btn" data-a="del">🗑️</button></div>`;
    d.addEventListener('dragstart',e=>{dragPhotoId=p.id;d.classList.add('dragging');e.dataTransfer.effectAllowed='copy';});
    d.addEventListener('dragend',()=>{d.classList.remove('dragging');dragPhotoId=null;});
    d.querySelector('[data-a=heart]').onclick=e=>{e.stopPropagation();p.heart=!p.heart;renderPhotoList();};
    d.querySelector('[data-a=del]').onclick=e=>{e.stopPropagation();deletePhoto(p.id);};
    d.querySelector('[data-a=view]').onclick=e=>{e.stopPropagation();openLb('photos',i);};
    d.onclick=()=>openLb('photos',i);
    el.appendChild(d);
  });
}
function deletePhoto(id){
  S.photos=S.photos.filter(x=>x.id!==id);
  S.slots=S.slots.map(s=>s&&s.id===id?null:s);
  renderPhotoList(); renderCanvas(); updateDropZone();
}
function updateDropZone(){ $('#drop-zone').style.display=S.photos.length?'none':'flex'; }
$('#file-input').onchange=e=>addPhotos(e.target.files);
$('#drop-zone').onclick=()=>$('#file-input').click();
['dragover','dragleave','drop'].forEach(ev=>$('#drop-zone').addEventListener(ev,e=>{
  e.preventDefault();
  if(ev==='dragover')$('#drop-zone').classList.add('drag-over');
  else if(ev==='dragleave')$('#drop-zone').classList.remove('drag-over');
  else{$('#drop-zone').classList.remove('drag-over');addPhotos(e.dataTransfer.files);}
}));

/* ── LAYOUT / OPTIONS ───────────────────────────────────────── */
function buildLayoutPicker(){
  const el=$('#layout-picker'); el.innerHTML='';
  (LAYOUTS[S.photoCount]||[]).forEach(l=>{
    const b=document.createElement('button');
    b.className='layout-btn'+(l.key===S.layout?' active':'');
    b.style.gridTemplateColumns=`repeat(${l.cols},1fr)`;
    b.style.gridTemplateRows=`repeat(${l.rows},1fr)`;
    const cells=[...new Set(l.areas.flat())]; const used=new Set();
    l.areas.forEach((row,ri)=>row.forEach((cell,ci)=>{
      if(used.has(cell))return; used.add(cell);
      const c=document.createElement('div'); c.className='cell';
      c.style.gridArea=`${ri+1}/${ci+1}`; b.appendChild(c);
    }));
    b.onclick=()=>{S.layout=l.key;buildLayoutPicker();resetSlots();renderCanvas();};
    el.appendChild(b);
  });
}
function resetSlots(){
  const l=(LAYOUTS[S.photoCount]||[])[0];
  if(!l)return;
  if(S.layout&&!(LAYOUTS[S.photoCount]||[]).find(x=>x.key===S.layout))S.layout=l.key;
  const count=[...new Set((LAYOUTS[S.photoCount]||[]).find(x=>x.key===S.layout)?.areas.flat()||[])].length;
  S.slots=Array(count).fill(null).map((_,i)=>S.slots[i]||null);
  S.mosaicRegions=[];
}

$('#count-minus').onclick=()=>{if(S.photoCount>1){S.photoCount--;updateCount();}};
$('#count-plus').onclick=()=>{if(S.photoCount<4){S.photoCount++;updateCount();}};
function updateCount(){
  $('#count-val').textContent=S.photoCount;
  const ls=LAYOUTS[S.photoCount]||[];
  if(!ls.find(x=>x.key===S.layout))S.layout=ls[0]?.key||'1x1';
  buildLayoutPicker(); resetSlots(); renderCanvas();
}

$('#gap-btns').querySelectorAll('.gap-btn').forEach(b=>b.onclick=()=>{
  S.gap=+b.dataset.gap;
  document.querySelectorAll('.gap-btn').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); renderCanvas();
});
document.querySelectorAll('.ratio-btn').forEach(b=>b.onclick=()=>{
  S.ratio=b.dataset.ratio;
  document.querySelectorAll('.ratio-btn').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); renderCanvas();
});
document.querySelectorAll('.swatch').forEach(b=>b.onclick=()=>{
  if(b.classList.contains('swatch-custom'))return;
  S.bgColor=b.dataset.color;
  document.querySelectorAll('.swatch').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); renderCanvas();
});
$('#bg-color').oninput=e=>{S.bgColor=e.target.value;renderCanvas();};

/* ── CANVAS RENDER ──────────────────────────────────────────── */
function renderCanvas(){
  const frame=$('#canvas-frame'), wrapper=$('#canvas-wrapper');
  const ld=(LAYOUTS[S.photoCount]||[]).find(x=>x.key===S.layout)||(LAYOUTS[1][0]);
  const [rw,rh]=RATIOS[S.ratio]||[1,1];
  const pw=wrapper.clientWidth-40, ph=wrapper.clientHeight-40;
  let w,h;
  if(pw/ph>rw/rh){h=ph;w=h*rw/rh;}else{w=pw;h=w*rh/rw;}
  frame.style.cssText=`width:${w}px;height:${h}px;gap:${S.gap}px;padding:${S.gap}px;background:${S.bgColor};
    grid-template-columns:repeat(${ld.cols},1fr);grid-template-rows:repeat(${ld.rows},1fr);
    grid-template-areas:${ld.areas.map(r=>'"'+r.join(' ')+'"').join(' ')};`;

  // remove old slots but keep mosaic canvas
  [...frame.children].forEach(c=>{if(c.id!=='mosaic-canvas')c.remove();});
  const cells=[...new Set(ld.areas.flat())];
  cells.forEach((cell,idx)=>{
    const slot=document.createElement('div');
    slot.className='canvas-slot'; slot.dataset.idx=idx; slot.style.gridArea=cell;
    const s=S.slots[idx]; const photo=s&&S.photos.find(p=>p.id===s.id);
    if(photo){
      slot.classList.add('filled');
      const img=document.createElement('img');
      img.src=photo.src; img.style.objectPosition=`${s.px||50}% ${s.py||50}%`;
      slot.appendChild(img);
      const clr=document.createElement('button'); clr.className='slot-clear'; clr.textContent='✕';
      clr.onclick=e=>{e.stopPropagation();S.slots[idx]=null;renderCanvas();};
      slot.appendChild(clr);
      initSlotPan(slot,idx);
    } else {
      const hint=document.createElement('span'); hint.className='slot-hint'; hint.textContent='+ 사진';
      slot.appendChild(hint);
      slot.onclick=()=>{if(S.photos.length){const unused=S.photos.find(p=>!S.slots.some(sl=>sl&&sl.id===p.id));S.slots[idx]={id:(unused||S.photos[0]).id,px:50,py:50};renderCanvas();}};
    }
    slot.addEventListener('dragover',e=>{e.preventDefault();slot.classList.add('drag-target');});
    slot.addEventListener('dragleave',()=>slot.classList.remove('drag-target'));
    slot.addEventListener('drop',e=>{e.preventDefault();slot.classList.remove('drag-target');if(dragPhotoId){S.slots[idx]={id:dragPhotoId,px:50,py:50};renderCanvas();}});
    frame.insertBefore(slot,frame.querySelector('#mosaic-canvas'));
  });
  syncMosaicCanvas(); redrawMosaic();
}

/* ── SLOT PAN ────────────────────────────────────────────────── */
function initSlotPan(slot,idx){
  let down=false,sx=0,sy=0,ox=50,oy=50;
  slot.addEventListener('mousedown',e=>{
    if(S.mosaicTool!=='select'&&$('#mosaic-canvas').classList.contains('drawing'))return;
    down=true; sx=e.clientX; sy=e.clientY; ox=S.slots[idx].px||50; oy=S.slots[idx].py||50;
    e.preventDefault();
  });
  window.addEventListener('mousemove',e=>{
    if(!down)return;
    const dx=(e.clientX-sx)/slot.offsetWidth*100, dy=(e.clientY-sy)/slot.offsetHeight*100;
    S.slots[idx].px=Math.max(0,Math.min(100,ox-dx));
    S.slots[idx].py=Math.max(0,Math.min(100,oy-dy));
    slot.querySelector('img').style.objectPosition=`${S.slots[idx].px}% ${S.slots[idx].py}%`;
  });
  window.addEventListener('mouseup',()=>{down=false;});
}

/* ── MOSAIC ─────────────────────────────────────────────────── */
function syncMosaicCanvas(){
  const cv=$('#mosaic-canvas'), f=$('#canvas-frame');
  cv.width=f.offsetWidth; cv.height=f.offsetHeight;
  cv.style.width='100%'; cv.style.height='100%';
}
function redrawMosaic(){
  const cv=$('#mosaic-canvas'), ctx=cv.getContext('2d');
  ctx.clearRect(0,0,cv.width,cv.height);
  S.mosaicRegions.forEach(r=>{
    ctx.fillStyle='rgba(45,140,122,0.35)'; ctx.strokeStyle='#2D8C7A'; ctx.lineWidth=2;
    if(r.type==='circle'){
      ctx.beginPath(); ctx.ellipse(r.x+r.w/2,r.y+r.h/2,Math.abs(r.w)/2,Math.abs(r.h)/2,0,0,Math.PI*2);
      ctx.fill(); ctx.stroke();
    } else {
      ctx.fillRect(r.x,r.y,r.w,r.h); ctx.strokeRect(r.x,r.y,r.w,r.h);
    }
  });
}

// mosaic tool buttons
document.querySelectorAll('.tool-btn').forEach(b=>b.onclick=()=>{
  S.mosaicTool=b.dataset.tool;
  document.querySelectorAll('.tool-btn').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  const cv=$('#mosaic-canvas');
  cv.classList.toggle('drawing', S.mosaicTool!=='select');
});
$('#mosaic-clear').onclick=()=>{S.mosaicRegions=[];redrawMosaic();};

(function initMosaicDraw(){
  const cv=$('#mosaic-canvas'); let down=false,sx=0,sy=0;
  cv.addEventListener('mousedown',e=>{
    if(!cv.classList.contains('drawing'))return;
    down=true; const r=cv.getBoundingClientRect();
    sx=e.clientX-r.left; sy=e.clientY-r.top;
  });
  cv.addEventListener('mousemove',e=>{
    if(!down)return;
    const r=cv.getBoundingClientRect(),cx=e.clientX-r.left,cy=e.clientY-r.top;
    redrawMosaic();
    const ctx=cv.getContext('2d');
    ctx.fillStyle='rgba(45,140,122,0.35)'; ctx.strokeStyle='#2D8C7A'; ctx.lineWidth=2;
    if(S.mosaicTool==='circle'){
      ctx.beginPath(); ctx.ellipse(sx+(cx-sx)/2,sy+(cy-sy)/2,Math.abs(cx-sx)/2,Math.abs(cy-sy)/2,0,0,Math.PI*2);
      ctx.fill(); ctx.stroke();
    } else { ctx.fillRect(sx,sy,cx-sx,cy-sy); ctx.strokeRect(sx,sy,cx-sx,cy-sy); }
  });
  cv.addEventListener('mouseup',e=>{
    if(!down)return; down=false;
    const r=cv.getBoundingClientRect(),cx=e.clientX-r.left,cy=e.clientY-r.top;
    if(Math.abs(cx-sx)>5||Math.abs(cy-sy)>5)
      S.mosaicRegions.push({x:Math.min(sx,cx),y:Math.min(sy,cy),w:Math.abs(cx-sx),h:Math.abs(cy-sy),type:S.mosaicTool});
    redrawMosaic();
  });
})();

/* ── WATERMARK ──────────────────────────────────────────────── */
$('#wm-toggle').onchange=e=>{S.wm.on=e.target.checked;};
$('#wm-color').oninput=e=>{S.wm.color=e.target.value;};
$('#wm-opacity').oninput=e=>{S.wm.opacity=+e.target.value;$('#wm-opacity-val').textContent=e.target.value+'%';};

async function drawWatermark(ctx,w,h){
  if(!S.wm.on)return;
  const img=new Image(); img.src='watermark.png';
  await new Promise(r=>{img.onload=r;img.onerror=r;});
  const size=Math.min(w,h)*0.12, px=w-size-12, py=h-size-30;
  ctx.save(); ctx.globalAlpha=S.wm.opacity/100;
  // circle clip
  ctx.beginPath(); ctx.arc(px+size/2,py+size/2,size/2,0,Math.PI*2); ctx.clip();
  if(img.complete&&img.naturalWidth>0) ctx.drawImage(img,px,py,size,size);
  else{ctx.fillStyle='rgba(255,255,255,0.5)';ctx.fill();}
  ctx.restore();
  // text
  ctx.save(); ctx.globalAlpha=S.wm.opacity/100;
  ctx.fillStyle=S.wm.color; ctx.font=`bold ${size*0.28}px Sora,sans-serif`;
  ctx.textAlign='center';
  ctx.fillText('📷 @Work_Penguin', px+size/2, py+size+size*0.32);
  ctx.restore();
}

/* ── EXPORT ─────────────────────────────────────────────────── */
async function buildExportCanvas(){
  const frame=$('#canvas-frame'), dpr=2;
  const cw=frame.offsetWidth*dpr, ch=frame.offsetHeight*dpr;
  const canvas=document.createElement('canvas'); canvas.width=cw; canvas.height=ch;
  const ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr);
  ctx.fillStyle=S.bgColor; ctx.fillRect(0,0,frame.offsetWidth,frame.offsetHeight);
  const fr=frame.getBoundingClientRect();
  await Promise.all([...frame.querySelectorAll('.canvas-slot.filled')].map(slot=>new Promise(res=>{
    const img=slot.querySelector('img'); if(!img)return res();
    const sr=slot.getBoundingClientRect();
    const x=sr.left-fr.left, y=sr.top-fr.top, sw=sr.width, sh=sr.height;
    const im=new Image(); im.onload=()=>{
      const sc=Math.max(sw/im.naturalWidth,sh/im.naturalHeight);
      const dw=im.naturalWidth*sc, dh=im.naturalHeight*sc;
      const s=slot.dataset.idx?S.slots[+slot.dataset.idx]:null;
      const bx=(s?.px||50)/100, by=(s?.py||50)/100;
      const ox=x+(sw-dw)*bx, oy=y+(sh-dh)*by;
      ctx.save(); ctx.rect(x,y,sw,sh); ctx.clip(); ctx.drawImage(im,ox,oy,dw,dh); ctx.restore(); res();
    }; im.onerror=res; im.src=img.src;
  })));
  // mosaic pixelation
  S.mosaicRegions.forEach(r=>{
    const scl=dpr, rx=r.x*scl/dpr,ry=r.y*scl/dpr,rw=r.w,rh=r.h;
    const bs=16, id=ctx.getImageData(rx,ry,rw||1,rh||1);
    for(let py=0;py<rh;py+=bs)for(let px2=0;px2<rw;px2+=bs){
      const ci=(py*Math.ceil(rw)+px2)*4;
      const cr=id.data[ci]||128,cg=id.data[ci+1]||128,cb=id.data[ci+2]||128;
      ctx.fillStyle=`rgb(${cr},${cg},${cb})`;
      if(r.type==='circle'){ctx.beginPath();ctx.ellipse(rx+rw/2,ry+rh/2,Math.min(px2+bs/2,rw/2),Math.min(py+bs/2,rh/2),0,0,Math.PI*2);ctx.fill();}
      else ctx.fillRect(rx+px2,ry+py,bs,bs);
    }
  });
  await drawWatermark(ctx,frame.offsetWidth,frame.offsetHeight);
  return canvas;
}
async function doExport(){const c=await buildExportCanvas();const a=document.createElement('a');a.href=c.toDataURL('image/png');a.download=`eggframe_${Date.now()}.png`;a.click();}
$('#btn-export').onclick=doExport;
$('#btn-dl-canvas').onclick=doExport;

/* ── GALLERY ─────────────────────────────────────────────────── */
function loadGallery(){
  try{S.gallery=JSON.parse(localStorage.getItem('eggframe_gallery')||'[]');}catch{S.gallery=[];}
  gidSeq=S.gallery.reduce((m,g)=>Math.max(m,g.id),0); renderGallery();
}
function saveGallery(){localStorage.setItem('eggframe_gallery',JSON.stringify(S.gallery));}
$('#btn-save').onclick=async()=>{
  const c=await buildExportCanvas();
  S.gallery.unshift({id:++gidSeq,thumb:c.toDataURL('image/jpeg',.55),slots:[...S.slots],layout:S.layout,ratio:S.ratio,gap:S.gap,bgColor:S.bgColor,photoCount:S.photoCount,heart:false,sel:false,ts:Date.now()});
  saveGallery(); renderGallery();
};
function renderGallery(){
  const el=$('#gallery-list'), sz=$('#gallery-size').value;
  if(!S.gallery.length){el.innerHTML='<span class="gallery-empty">저장된 편집본 없음</span>';return;}
  el.innerHTML='';
  S.gallery.forEach((g,i)=>{
    const d=document.createElement('div'); d.className='gallery-thumb'+(g.sel?' selected':'');
    d.style.width=sz+'px'; d.style.height=sz+'px';
    d.innerHTML=`<img src="${g.thumb}" /><div class="gallery-check">✓</div>
      <div class="gallery-actions">
        <button class="g-btn" data-a="view">🔍</button>
        <button class="g-btn" data-a="load">↩️</button>
        <button class="g-btn" data-a="heart">${g.heart?'🧡':'🤍'}</button>
        <button class="g-btn" data-a="del">🗑️</button></div>`;
    d.onclick=()=>{g.sel=!g.sel;renderGallery();};
    d.querySelector('[data-a=view]').onclick=e=>{e.stopPropagation();openLb('gallery',i);};
    d.querySelector('[data-a=load]').onclick=e=>{e.stopPropagation();loadGalleryEntry(g);};
    d.querySelector('[data-a=heart]').onclick=e=>{e.stopPropagation();g.heart=!g.heart;saveGallery();renderGallery();};
    d.querySelector('[data-a=del]').onclick=e=>{e.stopPropagation();S.gallery.splice(i,1);saveGallery();renderGallery();};
    el.appendChild(d);
  });
}
$('#gallery-size').oninput=renderGallery;
$('#btn-select-all').onclick=()=>{const all=S.gallery.every(g=>g.sel);S.gallery.forEach(g=>g.sel=!all);renderGallery();};
$('#btn-dl-selected').onclick=async()=>{
  for(const g of S.gallery.filter(x=>x.sel)){const a=document.createElement('a');a.href=g.thumb;a.download=`eggframe_${g.ts}.jpg`;a.click();await new Promise(r=>setTimeout(r,150));}
};
function loadGalleryEntry(g){
  S.layout=g.layout; S.ratio=g.ratio; S.gap=g.gap; S.bgColor=g.bgColor;
  S.photoCount=g.photoCount||1; S.slots=[...g.slots]; S.mosaicRegions=[];
  $('#count-val').textContent=S.photoCount;
  document.querySelectorAll('.ratio-btn').forEach(b=>b.classList.toggle('active',b.dataset.ratio===S.ratio));
  document.querySelectorAll('.gap-btn').forEach(b=>b.classList.toggle('active',+b.dataset.gap===S.gap));
  $('#bg-color').value=S.bgColor;
  buildLayoutPicker(); renderCanvas();
}

/* ── LIGHTBOX ───────────────────────────────────────────────── */
function lbList(){return S.lb.src==='photos'?S.photos:S.gallery;}
function lbSrc(x){return x.src||x.thumb;}
function openLb(src,idx){S.lb={open:true,src,idx,zoom:100,px:0,py:0};$('#lightbox').removeAttribute('hidden');renderLb();}
function closeLb(){$('#lightbox').setAttribute('hidden','');S.lb.open=false;}
function renderLb(){
  const items=lbList(); if(!items.length)return;
  const item=items[S.lb.idx];
  $('#lb-img').src=lbSrc(item);
  $('#lb-img').style.transform=`scale(${S.lb.zoom/100}) translate(${S.lb.px}px,${S.lb.py}px)`;
  $('#lb-counter').textContent=`${S.lb.idx+1} / ${items.length}`;
  $('#lb-zoom').value=S.lb.zoom;
  $('#lb-heart').textContent=item.heart?'🧡':'🤍';
  $('#lb-filmstrip').innerHTML='';
  items.forEach((it,i)=>{
    const d=document.createElement('div'); d.className='lb-film-item'+(i===S.lb.idx?' active':'');
    d.innerHTML=`<img src="${lbSrc(it)}" />`;
    d.onclick=()=>{S.lb.idx=i;renderLb();};
    $('#lb-filmstrip').appendChild(d);
  });
  $('#lb-filmstrip').querySelector('.active')?.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
}
function lbNav(d){const l=lbList();S.lb.idx=(S.lb.idx+d+l.length)%l.length;S.lb.px=0;S.lb.py=0;renderLb();}
$('#lb-prev').onclick=()=>lbNav(-1);
$('#lb-next').onclick=()=>lbNav(1);
$('#lb-backdrop').onclick=closeLb;
$('#lb-close').onclick=closeLb;
$('#lb-zoom').oninput=e=>{S.lb.zoom=+e.target.value;renderLb();};
$('#lb-heart').onclick=()=>{const it=lbList()[S.lb.idx];if(it){it.heart=!it.heart;renderLb();saveGallery();}};
$('#lb-delete').onclick=()=>{
  if(S.lb.src==='photos'){const it=S.photos[S.lb.idx];if(it)deletePhoto(it.id);}
  else{S.gallery.splice(S.lb.idx,1);saveGallery();renderGallery();}
  S.lb.idx=Math.max(0,S.lb.idx-1);
  if(!lbList().length){closeLb();return;} renderLb();
};
$('#lb-download').onclick=()=>{const it=lbList()[S.lb.idx];if(!it)return;const a=document.createElement('a');a.href=lbSrc(it);a.download=it.name||`eggframe_${Date.now()}.jpg`;a.click();};
document.addEventListener('keydown',e=>{
  if(!S.lb.open)return;
  if(e.key==='ArrowLeft')lbNav(-1); if(e.key==='ArrowRight')lbNav(1); if(e.key==='Escape')closeLb();
  if(e.key==='+'||e.key==='='){S.lb.zoom=Math.min(300,S.lb.zoom+20);renderLb();}
  if(e.key==='-'){S.lb.zoom=Math.max(50,S.lb.zoom-20);renderLb();}
});
(()=>{const v=$('#lb-viewer');let dn=false,sx=0,sy=0;
  v.addEventListener('mousedown',e=>{dn=true;sx=e.clientX-S.lb.px;sy=e.clientY-S.lb.py;});
  window.addEventListener('mousemove',e=>{if(!dn)return;S.lb.px=e.clientX-sx;S.lb.py=e.clientY-sy;renderLb();});
  window.addEventListener('mouseup',()=>{dn=false;});
  v.addEventListener('wheel',e=>{e.preventDefault();S.lb.zoom=Math.max(50,Math.min(300,S.lb.zoom-Math.sign(e.deltaY)*15));renderLb();},{passive:false});
})();

/* ── INIT ───────────────────────────────────────────────────── */
function init(){
  buildLayoutPicker(); resetSlots(); renderCanvas(); loadGallery(); updateDropZone();
  window.addEventListener('resize',renderCanvas);
}
init();
