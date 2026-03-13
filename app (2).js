/* ═══════════════════════════════════════════════════════════
   eggframe · app.js
   모듈: state, photos, canvas, gallery, lightbox, export
   ═══════════════════════════════════════════════════════════ */

/* ── STATE ─────────────────────────────────────────────────── */
const state = {
  photos:  [],       // { id, src, name, heart }
  slots:   [],       // { photoId | null }
  layout:  '1x1',
  ratio:   '1:1',
  gap:     8,
  bgColor: '#F5F4F0',
  gallery: [],       // { id, thumb, slots, layout, ratio, gap, bgColor, heart, ts }
  lb: { open: false, source: 'photos', index: 0, zoom: 100, panX: 0, panY: 0 },
};

let photoIdSeq   = 0;
let galleryIdSeq = 0;
let dragSrcPhotoId = null;   // 왼쪽 패널 → 슬롯 드래그
let dragSrcIdx     = null;   // 패널 내 순서 드래그

/* ── LAYOUT DEFINITIONS ─────────────────────────────────────── */
const LAYOUTS = [
  { key:'1x1',  label:'1',  cols:1, rows:1, areas:[['a']] },
  { key:'2h',   label:'2↔', cols:2, rows:1, areas:[['a','b']] },
  { key:'2v',   label:'2↕', cols:1, rows:2, areas:[['a'],['b']] },
  { key:'3h',   label:'3↔', cols:3, rows:1, areas:[['a','b','c']] },
  { key:'2+1',  label:'2+1',cols:2, rows:2, areas:[['a','a'],['b','c']] },
  { key:'4',    label:'4',  cols:2, rows:2, areas:[['a','b'],['c','d']] },
];

const RATIOS = { '1:1':[1,1], '4:5':[4,5], '16:9':[16,9], '9:16':[9,16] };

/* ── DOM REFS ───────────────────────────────────────────────── */
const $ = (s) => document.querySelector(s);
const photoGrid    = $('#photo-grid');
const dropZone     = $('#drop-zone');
const fileInput    = $('#file-input');
const canvasFrame  = $('#canvas-frame');
const layoutPicker = $('#layout-picker');
const ratioSelect  = $('#ratio-select');
const gapSlider    = $('#gap-slider');
const gapValue     = $('#gap-value');
const bgColorInput = $('#bg-color');
const galleryList  = $('#gallery-list');
const lightbox     = $('#lightbox');
const lbImg        = $('#lb-img');
const lbCounter    = $('#lb-counter');
const lbFilmstrip  = $('#lb-filmstrip');
const lbZoom       = $('#lb-zoom');
const lbPrev       = $('#lb-prev');
const lbNext       = $('#lb-next');
const lbHeart      = $('#lb-heart');
const lbDelete     = $('#lb-delete');
const lbDownload   = $('#lb-download');

/* ══════════════════════════════════════════════════════════════
   PHOTOS
══════════════════════════════════════════════════════════════ */
function addPhotos(files) {
  const readers = [...files].map(f => new Promise(res => {
    const r = new FileReader();
    r.onload = e => res({ id: ++photoIdSeq, src: e.target.result, name: f.name, heart: false });
    r.readAsDataURL(f);
  }));
  Promise.all(readers).then(items => {
    state.photos.push(...items);
    renderPhotoGrid();
    updateDropZoneVisibility();
  });
}

function renderPhotoGrid() {
  photoGrid.innerHTML = '';
  state.photos.forEach((p, idx) => {
    const div = document.createElement('div');
    div.className = 'photo-item';
    div.dataset.id = p.id;
    div.dataset.idx = idx;
    div.draggable = true;
    div.innerHTML = `
      <img src="${p.src}" alt="${p.name}" />
      <div class="photo-overlay">
        <button class="photo-btn" data-action="heart" title="즐겨찾기">${p.heart ? '🧡' : '🤍'}</button>
        <button class="photo-btn" data-action="view"  title="전체보기">🔍</button>
        <button class="photo-btn" data-action="del"   title="삭제">🗑️</button>
      </div>`;
    // 드래그 (패널→슬롯)
    div.addEventListener('dragstart', e => {
      dragSrcPhotoId = p.id;
      dragSrcIdx = idx;
      div.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'copy';
    });
    div.addEventListener('dragend', () => {
      div.classList.remove('dragging');
      dragSrcPhotoId = null;
      dragSrcIdx = null;
    });
    // 버튼들
    div.querySelector('[data-action=heart]').addEventListener('click', e => { e.stopPropagation(); togglePhotoHeart(p.id); });
    div.querySelector('[data-action=del]' ).addEventListener('click', e => { e.stopPropagation(); deletePhoto(p.id); });
    div.querySelector('[data-action=view]').addEventListener('click', e => { e.stopPropagation(); openLightbox('photos', idx); });
    div.addEventListener('click', () => openLightbox('photos', idx));
    photoGrid.appendChild(div);
  });
}

function togglePhotoHeart(id) {
  const p = state.photos.find(x => x.id === id);
  if (p) { p.heart = !p.heart; renderPhotoGrid(); }
}

function deletePhoto(id) {
  state.photos = state.photos.filter(x => x.id !== id);
  // 슬롯에서도 제거
  state.slots = state.slots.map(s => s === id ? null : s);
  renderPhotoGrid();
  renderCanvas();
  updateDropZoneVisibility();
}

function updateDropZoneVisibility() {
  dropZone.style.display = state.photos.length ? 'none' : 'flex';
}

/* ── 파일 입력 ────────────────────────────────────────────── */
fileInput.addEventListener('change', e => addPhotos(e.target.files));
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); addPhotos(e.dataTransfer.files); });
$('#panel-photos').addEventListener('dragover', e => e.preventDefault());
$('#panel-photos').addEventListener('drop', e => { e.preventDefault(); addPhotos(e.dataTransfer.files); });

/* ══════════════════════════════════════════════════════════════
   LAYOUT PICKER
══════════════════════════════════════════════════════════════ */
function buildLayoutPicker() {
  layoutPicker.innerHTML = '';
  LAYOUTS.forEach(l => {
    const btn = document.createElement('button');
    btn.className = 'layout-btn' + (l.key === state.layout ? ' active' : '');
    btn.title = l.label;
    btn.dataset.key = l.key;
    // 미니 프리뷰 grid
    btn.style.gridTemplateColumns = `repeat(${l.cols},1fr)`;
    btn.style.gridTemplateRows    = `repeat(${l.rows},1fr)`;
    // 유니크 셀 레터
    const cells = [...new Set(l.areas.flat())];
    const used  = new Set();
    l.areas.forEach((row, ri) => row.forEach((cell, ci) => {
      const d = document.createElement('div');
      d.className = 'cell';
      if (!used.has(cell)) {
        d.style.gridArea = `${ri+1}/${ci+1}`;
        used.add(cell);
      }
      btn.appendChild(d);
    }));
    btn.addEventListener('click', () => { state.layout = l.key; resetSlots(); buildLayoutPicker(); renderCanvas(); });
    layoutPicker.appendChild(btn);
  });
}

function resetSlots() {
  const l = LAYOUTS.find(x => x.key === state.layout);
  const count = [...new Set(l.areas.flat())].length;
  state.slots = Array(count).fill(null);
}

/* ══════════════════════════════════════════════════════════════
   CANVAS
══════════════════════════════════════════════════════════════ */
function renderCanvas() {
  const l = LAYOUTS.find(x => x.key === state.layout);
  const [rw, rh] = RATIOS[state.ratio];
  const wrapper = $('#canvas-wrapper');
  const pw = wrapper.clientWidth  - 48;
  const ph = wrapper.clientHeight - 48;
  let w, h;
  if (pw / ph > rw / rh) { h = ph; w = h * rw / rh; }
  else { w = pw; h = w * rh / rw; }

  canvasFrame.style.width  = w + 'px';
  canvasFrame.style.height = h + 'px';
  canvasFrame.style.gap    = state.gap + 'px';
  canvasFrame.style.padding = state.gap + 'px';
  canvasFrame.style.background = state.bgColor;
  canvasFrame.style.gridTemplateColumns = `repeat(${l.cols}, 1fr)`;
  canvasFrame.style.gridTemplateRows    = `repeat(${l.rows}, 1fr)`;

  // template-areas
  const areaStr = l.areas.map(row => '"' + row.join(' ') + '"').join(' ');
  canvasFrame.style.gridTemplateAreas = areaStr;

  canvasFrame.innerHTML = '';
  const cells = [...new Set(l.areas.flat())];
  cells.forEach((cell, idx) => {
    const slot = document.createElement('div');
    slot.className = 'canvas-slot';
    slot.dataset.idx = idx;
    slot.style.gridArea = cell;

    const photoId = state.slots[idx];
    const photo   = state.photos.find(p => p.id === photoId);

    if (photo) {
      slot.classList.add('filled');
      const img = document.createElement('img');
      img.src = photo.src;
      slot.appendChild(img);
      const clr = document.createElement('button');
      clr.className = 'slot-clear';
      clr.textContent = '✕';
      clr.addEventListener('click', e => { e.stopPropagation(); state.slots[idx] = null; renderCanvas(); });
      slot.appendChild(clr);
    } else {
      const hint = document.createElement('span');
      hint.className = 'slot-hint';
      hint.textContent = '+ 사진';
      slot.appendChild(hint);
    }

    // 슬롯 클릭 → 첫 번째 사진 배치 (or 파일선택)
    slot.addEventListener('click', () => {
      if (!photo && state.photos.length > 0) {
        const unused = state.photos.find(p => !state.slots.includes(p.id));
        state.slots[idx] = unused ? unused.id : state.photos[0].id;
        renderCanvas();
      }
    });
    // 드래그 수신
    slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('drag-target'); });
    slot.addEventListener('dragleave', () => slot.classList.remove('drag-target'));
    slot.addEventListener('drop', e => {
      e.preventDefault(); slot.classList.remove('drag-target');
      if (dragSrcPhotoId !== null) { state.slots[idx] = dragSrcPhotoId; renderCanvas(); }
    });
    canvasFrame.appendChild(slot);
  });
}

/* ── 툴바 컨트롤 ──────────────────────────────────────────── */
ratioSelect.addEventListener('change', () => { state.ratio = ratioSelect.value; renderCanvas(); });
gapSlider.addEventListener('input', () => { state.gap = +gapSlider.value; gapValue.textContent = state.gap + 'px'; renderCanvas(); });
bgColorInput.addEventListener('input', () => { state.bgColor = bgColorInput.value; renderCanvas(); });

/* ══════════════════════════════════════════════════════════════
   GALLERY (localStorage)
══════════════════════════════════════════════════════════════ */
function loadGallery() {
  try { state.gallery = JSON.parse(localStorage.getItem('eggframe_gallery') || '[]'); }
  catch { state.gallery = []; }
  galleryIdSeq = state.gallery.reduce((m, g) => Math.max(m, g.id), 0);
  renderGallery();
}

function saveGallery() {
  localStorage.setItem('eggframe_gallery', JSON.stringify(state.gallery));
}

function saveCurrentToGallery() {
  const canvas = document.createElement('canvas');
  exportToCanvas(canvas).then(() => {
    const thumb = canvas.toDataURL('image/jpeg', 0.6);
    const entry = {
      id: ++galleryIdSeq,
      thumb,
      slots: [...state.slots],
      layout: state.layout,
      ratio:  state.ratio,
      gap:    state.gap,
      bgColor: state.bgColor,
      heart: false,
      ts: Date.now(),
    };
    state.gallery.unshift(entry);
    saveGallery();
    renderGallery();
  });
}

function renderGallery() {
  if (state.gallery.length === 0) {
    galleryList.innerHTML = '<div class="gallery-empty">저장된 편집본이 없습니다</div>';
    return;
  }
  galleryList.innerHTML = '';
  state.gallery.forEach((g, idx) => {
    const div = document.createElement('div');
    div.className = 'gallery-thumb';
    div.innerHTML = `
      <img src="${g.thumb}" alt="저장본" />
      <div class="thumb-actions">
        <button class="thumb-btn" data-action="view"  title="보기">🔍</button>
        <button class="thumb-btn" data-action="load"  title="불러오기">↩️</button>
        <button class="thumb-btn" data-action="heart" title="즐겨찾기">${g.heart ? '🧡' : '🤍'}</button>
        <button class="thumb-btn" data-action="del"   title="삭제">🗑️</button>
      </div>`;
    div.querySelector('[data-action=view]' ).addEventListener('click', e => { e.stopPropagation(); openLightbox('gallery', idx); });
    div.querySelector('[data-action=load]' ).addEventListener('click', e => { e.stopPropagation(); loadGalleryEntry(g); });
    div.querySelector('[data-action=heart]').addEventListener('click', e => { e.stopPropagation(); g.heart = !g.heart; saveGallery(); renderGallery(); });
    div.querySelector('[data-action=del]'  ).addEventListener('click', e => { e.stopPropagation(); deleteGalleryEntry(g.id); });
    galleryList.appendChild(div);
  });
}

function loadGalleryEntry(g) {
  state.layout  = g.layout;
  state.ratio   = g.ratio;
  state.gap     = g.gap;
  state.bgColor = g.bgColor;
  state.slots   = [...g.slots];
  ratioSelect.value = g.ratio;
  gapSlider.value   = g.gap;
  gapValue.textContent = g.gap + 'px';
  bgColorInput.value = g.bgColor;
  buildLayoutPicker();
  renderCanvas();
}

function deleteGalleryEntry(id) {
  state.gallery = state.gallery.filter(g => g.id !== id);
  saveGallery();
  renderGallery();
}

/* ══════════════════════════════════════════════════════════════
   EXPORT / CANVAS RENDER
══════════════════════════════════════════════════════════════ */
async function exportToCanvas(canvas) {
  const frame = canvasFrame;
  const w = frame.offsetWidth;
  const h = frame.offsetHeight;
  canvas.width  = w * 2;
  canvas.height = h * 2;
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.fillStyle = state.bgColor;
  ctx.fillRect(0, 0, w, h);

  const slots = [...frame.querySelectorAll('.canvas-slot')];
  const draws = slots.map(slot => new Promise(res => {
    const img = slot.querySelector('img');
    if (!img) return res();
    const r  = slot.getBoundingClientRect();
    const fr = frame.getBoundingClientRect();
    const x  = r.left - fr.left;
    const y  = r.top  - fr.top;
    const im = new Image();
    im.onload = () => {
      const sw = r.width, sh = r.height;
      const scale = Math.max(sw / im.naturalWidth, sh / im.naturalHeight);
      const dw = im.naturalWidth * scale, dh = im.naturalHeight * scale;
      ctx.save();
      ctx.rect(x, y, sw, sh);
      ctx.clip();
      ctx.drawImage(im, x + (sw-dw)/2, y + (sh-dh)/2, dw, dh);
      ctx.restore();
      res();
    };
    im.src = img.src;
  }));
  await Promise.all(draws);
}

$('#btn-export').addEventListener('click', async () => {
  const canvas = document.createElement('canvas');
  await exportToCanvas(canvas);
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `eggframe_${Date.now()}.png`;
  a.click();
});
$('#btn-save').addEventListener('click', saveCurrentToGallery);

/* ══════════════════════════════════════════════════════════════
   LIGHTBOX
══════════════════════════════════════════════════════════════ */
function lbItems() {
  if (state.lb.source === 'photos')  return state.photos;
  if (state.lb.source === 'gallery') return state.gallery;
  return [];
}
function lbSrc(item) { return item.src || item.thumb; }
function lbHeartState(item) { return item.heart; }

function openLightbox(source, index) {
  state.lb = { open: true, source, index, zoom: 100, panX: 0, panY: 0 };
  lightbox.removeAttribute('hidden');
  renderLightbox();
}

function closeLightbox() {
  lightbox.setAttribute('hidden', '');
  state.lb.open = false;
}

function renderLightbox() {
  const items = lbItems();
  if (!items.length) return;
  const item  = items[state.lb.index];
  lbImg.src = lbSrc(item);
  lbImg.style.transform = `scale(${state.lb.zoom / 100}) translate(${state.lb.panX}px,${state.lb.panY}px)`;
  lbCounter.textContent = `${state.lb.index + 1} / ${items.length}`;
  lbZoom.value = state.lb.zoom;
  lbHeart.textContent = lbHeartState(item) ? '🧡' : '🤍';
  // filmstrip
  lbFilmstrip.innerHTML = '';
  items.forEach((it, i) => {
    const d = document.createElement('div');
    d.className = 'lb-film-item' + (i === state.lb.index ? ' active' : '');
    d.innerHTML = `<img src="${lbSrc(it)}" alt="" />`;
    d.addEventListener('click', () => { state.lb.index = i; renderLightbox(); });
    lbFilmstrip.appendChild(d);
  });
  // scroll active into view
  const active = lbFilmstrip.querySelector('.active');
  if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

function lbNavigate(dir) {
  const items = lbItems();
  state.lb.index = (state.lb.index + dir + items.length) % items.length;
  state.lb.panX = 0; state.lb.panY = 0;
  renderLightbox();
}

lbPrev.addEventListener('click', () => lbNavigate(-1));
lbNext.addEventListener('click', () => lbNavigate(1));
$('#lb-backdrop').addEventListener('click', closeLightbox);
$('#lb-close').addEventListener('click', closeLightbox);

lbZoom.addEventListener('input', () => { state.lb.zoom = +lbZoom.value; renderLightbox(); });

lbHeart.addEventListener('click', () => {
  const item = lbItems()[state.lb.index];
  if (item) { item.heart = !item.heart; renderLightbox(); renderPhotoGrid(); saveGallery(); }
});
lbDelete.addEventListener('click', () => {
  if (state.lb.source === 'photos') {
    const item = state.photos[state.lb.index];
    if (item) deletePhoto(item.id);
    state.lb.index = Math.min(state.lb.index, state.photos.length - 1);
    if (!state.photos.length) { closeLightbox(); return; }
  } else {
    const item = state.gallery[state.lb.index];
    if (item) deleteGalleryEntry(item.id);
    state.lb.index = Math.min(state.lb.index, state.gallery.length - 1);
    if (!state.gallery.length) { closeLightbox(); return; }
  }
  renderLightbox();
});
lbDownload.addEventListener('click', () => {
  const item = lbItems()[state.lb.index];
  if (!item) return;
  const a = document.createElement('a');
  a.href = lbSrc(item);
  a.download = item.name || `eggframe_${Date.now()}.jpg`;
  a.click();
});

// 키보드
document.addEventListener('keydown', e => {
  if (!state.lb.open) return;
  if (e.key === 'ArrowLeft')  lbNavigate(-1);
  if (e.key === 'ArrowRight') lbNavigate(1);
  if (e.key === 'Escape')     closeLightbox();
  if (e.key === '+' || e.key === '=') { state.lb.zoom = Math.min(300, state.lb.zoom + 20); renderLightbox(); }
  if (e.key === '-')                   { state.lb.zoom = Math.max(50,  state.lb.zoom - 20); renderLightbox(); }
});

/* ── 라이트박스 드래그 패닝 ──────────────────────────────── */
(function initLbPan() {
  const viewer = $('#lb-viewer');
  let down = false, sx = 0, sy = 0;
  viewer.addEventListener('mousedown', e => { down = true; sx = e.clientX - state.lb.panX; sy = e.clientY - state.lb.panY; });
  window.addEventListener('mousemove', e => { if (!down) return; state.lb.panX = e.clientX - sx; state.lb.panY = e.clientY - sy; renderLightbox(); });
  window.addEventListener('mouseup', () => { down = false; });
  viewer.addEventListener('wheel', e => {
    e.preventDefault();
    state.lb.zoom = Math.max(50, Math.min(300, state.lb.zoom - Math.sign(e.deltaY) * 15));
    renderLightbox();
  }, { passive: false });
})();

/* ══════════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════════ */
function init() {
  resetSlots();
  buildLayoutPicker();
  renderCanvas();
  loadGallery();
  updateDropZoneVisibility();
  // 창 크기 변경 시 캔버스 재렌더
  window.addEventListener('resize', renderCanvas);
}

init();
