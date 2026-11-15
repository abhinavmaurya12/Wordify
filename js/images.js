/* WordX – images.js
 * Picture insertion (client-side down-scaling), selection frame with 8 resize handles,
 * wrapping / positioning (inline, float, centred, free, behind text), alt text, deletion. */
(function () {
  'use strict';
  const WX = window.WX; const { el, icon, $ } = WX.util; const E = () => WX.editor;
  const I = (WX.images = {}); let cur = null, frame = null, armed = false;
  const MAXW = 1600, WRAP = ['wx-float-left', 'wx-float-right', 'wx-block-center', 'wx-abs', 'wx-behind'];

  function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Image could not be decoded')); i.src = src; }); }
  /** Read a file; down-scale large rasters so documents stay small. */
  I.toDataURL = async function (file) {
    const raw = await WX.util.readFile(file, 'dataURL');
    if (/svg|gif/.test(file.type)) return raw;
    const img = await loadImg(raw); if (img.width <= MAXW && raw.length < 900000) return raw;
    const k = Math.min(1, MAXW / img.width); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const out = c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9); return out.length < raw.length ? out : raw;
  };
  I.insertFile = async function (file) {
    if (!E().isEditable()) return WX.ui.toast('This document is read-only.');
    if (!/^image\//.test(file.type)) return WX.ui.toast('Not an image file: ' + (file.name || ''), 'error');
    try {
      const src = await I.toDataURL(file); const im = await loadImg(src); const max = WX.page.metrics().cw || 600;
      const img = el('img', { src, alt: (file.name || 'Image').replace(/\.[^.]+$/, '') }); img.style.width = Math.min(im.width, max, 600) + 'px';
      E().insertInline(img); I.select(img);
    } catch (e) { WX.ui.toast('Could not insert image: ' + e.message, 'error'); }
  };
  I.pick = async function () { const f = await WX.util.pickFile('image/*', true); f.forEach((x) => I.insertFile(x)); };

  /* ---------- selection frame ---------- */
  function ensureFrame() {
    if (frame) return frame;
    frame = el('div', { class: 'wx-handles' }, ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((h) => el('i', { 'data-h': h })));
    const bar = el('div', { class: 'obj-bar' }); frame.append(bar); frame._bar = bar;
    const b = (ic, tip, fn) => bar.append(el('button', { html: icon(ic, 16), 'data-tip': tip, onmousedown: (e) => e.preventDefault(), onclick: (e) => { e.stopPropagation(); fn(); } }));
    b('align-justify', 'In line with text', () => wrap('inline')); b('panel-left', 'Wrap left (float left)', () => wrap('left')); b('panel-right', 'Wrap right (float right)', () => wrap('right')); b('align-center', 'Centre on own line', () => wrap('center'));
    b('move', 'Free position (in front of text)', () => wrap('free')); b('layers', 'Behind text', () => wrap('behind')); b('message-square-text', 'Alt text', altText); b('pencil', 'Edit object', () => cur && cur.dataset.kind && WX.insert.edit(cur)); b('trash-2', 'Delete', del);
    frame.addEventListener('pointerdown', onHandle); $('#obj-layer').append(frame); return frame;
  }
  function place() {
    if (!cur || !document.body.contains(cur) || !E().el.contains(cur)) return I.deselect();
    const f = ensureFrame(), r = cur.getBoundingClientRect(), pr = $('#paper').getBoundingClientRect(), z = WX.state.zoom || 1;
    f.style.display = ''; f.style.left = (r.left - pr.left) / z + 'px'; f.style.top = (r.top - pr.top) / z + 'px'; f.style.width = r.width / z + 'px'; f.style.height = r.height / z + 'px';
    f._bar.style.pointerEvents = 'auto'; f._bar.querySelector('[data-tip="Edit object"]').style.display = cur.dataset && cur.dataset.kind ? '' : 'none';
  }
  I.select = function (n) { cur = n; armed = true; place(); WX.bus.emit('objselect', n); };
  I.deselect = function () { cur = null; armed = false; if (frame) frame.style.display = 'none'; WX.bus.emit('objselect', null); };
  I.selected = () => cur;

  function setSize(w, h, keep) {
    w = Math.max(16, w); h = Math.max(16, h);
    if (cur.tagName === 'IMG') { cur.style.width = w + 'px'; cur.style.height = keep ? 'auto' : h + 'px'; cur.removeAttribute('width'); cur.removeAttribute('height'); }
    else { cur.style.width = w + 'px'; cur.style.height = h + 'px'; }
  }
  function onHandle(e) {
    const h = e.target.closest('i[data-h]'); if (!h || !cur) return; e.preventDefault(); h.setPointerCapture(e.pointerId);
    const d = h.dataset.h, z = WX.state.zoom || 1, r = cur.getBoundingClientRect(), w0 = r.width / z, h0 = r.height / z, x0 = e.clientX, y0 = e.clientY, ratio = w0 / h0;
    const mv = (ev) => {
      const dx = (ev.clientX - x0) / z, dy = (ev.clientY - y0) / z; let w = w0, hh = h0;
      if (d.includes('e')) w = w0 + dx; if (d.includes('w')) w = w0 - dx; if (d.includes('s')) hh = h0 + dy; if (d.includes('n')) hh = h0 - dy;
      if (d.length === 2) hh = w / ratio; setSize(w, hh, d.length === 2 && cur.tagName === 'IMG'); place();
    };
    const up = () => { h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); E().changed({ immediate: true }); WX.page.schedule(); setTimeout(place, 150); };
    h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up);
  }
  function wrap(mode) {
    if (!cur) return; E().run(() => {
      WRAP.forEach((c) => cur.classList.remove(c)); cur.style.removeProperty('left'); cur.style.removeProperty('top');
      if (mode === 'left') cur.classList.add('wx-float-left'); else if (mode === 'right') cur.classList.add('wx-float-right'); else if (mode === 'center') cur.classList.add('wx-block-center');
      else if (mode === 'free' || mode === 'behind') {
        const r = cur.getBoundingClientRect(), er = E().el.getBoundingClientRect(), z = WX.state.zoom || 1;
        cur.classList.add('wx-abs'); if (mode === 'behind') cur.classList.add('wx-behind'); cur.style.left = (r.left - er.left) / z + 'px'; cur.style.top = (r.top - er.top) / z + 'px';
      }
      if (!cur.getAttribute('class')) cur.removeAttribute('class');
    }); WX.page.paginate(); setTimeout(place, 50);
  }
  function altText() {
    if (!cur) return; const n = cur;
    WX.ui.prompt('Alt text', 'Describe this object for screen readers:', n.getAttribute('alt') || n.getAttribute('data-alt') || '').then((v) => { if (v == null) return; E().run(() => { n.tagName === 'IMG' ? n.setAttribute('alt', v) : n.setAttribute('data-alt', v); }); });
  }
  function del() { if (!cur) return; const n = cur; I.deselect(); E().run(() => n.remove()); WX.page.schedule(); }

  /* ---------- free-position dragging ---------- */
  function initDrag() {
    E().el.addEventListener('pointerdown', (e) => {
      const t = e.target.closest && e.target.closest('.wx-abs'); if (!t || t !== cur || e.button !== 0) return; e.preventDefault();
      const z = WX.state.zoom || 1, x0 = e.clientX, y0 = e.clientY, l0 = parseFloat(t.style.left) || 0, t0 = parseFloat(t.style.top) || 0;
      const mv = (ev) => { t.style.left = l0 + (ev.clientX - x0) / z + 'px'; t.style.top = t0 + (ev.clientY - y0) / z + 'px'; place(); };
      const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); E().changed({ immediate: true }); };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    });
  }

  I.init = function () {
    ensureFrame(); frame.style.display = 'none'; initDrag();
    WX.bus.on('click', (e) => { const t = e.target.closest && e.target.closest('img,.wx-obj'); if (t && E().el.contains(t)) I.select(t); else I.deselect(); });
    WX.bus.on('dblclick', (e) => { const t = e.target.closest && e.target.closest('.wx-obj[data-kind]'); if (t) WX.insert.edit(t); else if (e.target.tagName === 'IMG') altText(); });
    WX.bus.on('keydown', (e) => {
      if (cur && armed && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); del(); } else if (e.key === 'Escape') I.deselect(); else if (!/^(Shift|Control|Alt|Meta)$/.test(e.key)) armed = false;
    });
    ['paginated', 'input', 'zoom', 'viewchange', 'restored'].forEach((ev) => WX.bus.on(ev, () => { if (cur) requestAnimationFrame(place); }));
    WX.bus.on('docloaded', I.deselect);
    E().ctxProviders.push((e) => {
      const t = e.target.closest && e.target.closest('img,.wx-obj'); if (!t || !E().isEditable()) return null; I.select(t);
      return [{ label: 'In line with text', action: () => wrap('inline') }, { label: 'Wrap text left', action: () => wrap('left') }, { label: 'Wrap text right', action: () => wrap('right') }, { label: 'Centre', action: () => wrap('center') }, { label: 'Behind text', action: () => wrap('behind') }, { label: 'Alt text…', action: altText },
        t.dataset.kind ? { label: 'Edit…', icon: 'pencil', action: () => WX.insert.edit(t) } : null, { label: 'Delete', icon: 'trash-2', action: del }].filter(Boolean);
    });
  };
  WX.act.insertPicture = I.pick;
})();
