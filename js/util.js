/* WordX – util.js
 * Shared helpers: DOM utils, event bus, HTML sanitizer, dialogs, popup menus,
 * colour picker, toasts and tooltips. Everything lives under window.WX. */
(function () {
  'use strict';
  const WX = (window.WX = window.WX || {});
  WX.state = Object.assign({ view: 'print', zoom: 1, autoFit: true, nativeSpell: true, theme: 'light', userName: 'You' }, WX.state || {});
  WX.act = WX.act || {}; // central action registry (used by ribbon, shortcuts, menus)

  /* ---------- tiny event bus ---------- */
  const handlers = {};
  WX.bus = {
    on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); },
    emit(ev, data) { (handlers[ev] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error('[bus:' + ev + ']', e); } }); },
  };

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  function el(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach((c) => { if (c != null) n.append(c.nodeType ? c : document.createTextNode(c)); });
    return n;
  }

  function icon(name, size) {
    const s = size || 18;
    const inner = (window.WX_ICONS && window.WX_ICONS[name]) || '';
    return `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = (p) => (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function debounce(fn, ms) { let t; const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; d.flush = (...a) => { clearTimeout(t); fn(...a); }; d.cancel = () => clearTimeout(t); return d; }

  function fmtDate(ts) {
    const d = new Date(ts), now = new Date();
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return 'Today, ' + time;
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Yesterday, ' + time;
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  }

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }
  function readFile(file, as) {
    return new Promise((res, rej) => {
      const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error || new Error('Could not read file'));
      as === 'arrayBuffer' ? r.readAsArrayBuffer(file) : as === 'dataURL' ? r.readAsDataURL(file) : r.readAsText(file);
    });
  }
  function pickFile(accept, multiple) {
    return new Promise((res) => {
      const i = el('input', { type: 'file', accept: accept || '', multiple: multiple ? '' : null, style: { display: 'none' } });
      i.addEventListener('change', () => { res(Array.from(i.files)); i.remove(); });
      i.addEventListener('cancel', () => { res([]); i.remove(); });
      document.body.appendChild(i); i.click();
    });
  }
  const scriptCache = {};
  function loadScript(src) {
    if (!scriptCache[src]) scriptCache[src] = new Promise((res, rej) => {
      const s = el('script', { src }); s.onload = res; s.onerror = () => { delete scriptCache[src]; rej(new Error('Failed to load ' + src)); }; document.head.appendChild(s);
    });
    return scriptCache[src];
  }
  const dataURLtoBlob = (u) => { const [h, b] = u.split(','); const m = /:(.*?)[;,]/.exec(h)[1]; const bin = h.includes('base64') ? atob(b) : decodeURIComponent(b); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: m }); };
  const hashText = async (t) => { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join(''); };

  /* ---------- HTML sanitiser (allow-list) ---------- */
  const ALLOWED = new Set(('a abbr b blockquote br caption code col colgroup div em font h1 h2 h3 h4 h5 h6 hr i img ins del li mark ol p pre s small span strike strong sub sup table tbody td tfoot th thead tr u ul figure figcaption ' +
    'svg g path rect circle ellipse line polyline polygon text tspan defs marker lineargradient stop title ' +
    'math mrow mi mn mo mfrac msqrt mroot msup msub msubsup munder mover munderover mtable mtr mtd mtext mspace mstyle semantics annotation').split(' '));
  const DROP_WITH_CONTENT = new Set('script style iframe object embed link meta noscript template head applet frame frameset form input button select textarea audio video canvas base'.split(' '));
  const SVGISH = new Set('svg g path rect circle ellipse line polyline polygon text tspan defs marker lineargradient stop'.split(' '));
  const MATHISH = (t) => t === 'math' || t.startsWith('m');
  const HTML_ATTRS = new Set('style class id href src alt title colspan rowspan width height align valign name target rel start type dir lang border cellpadding cellspacing bgcolor color face size span contenteditable spellcheck'.split(' '));

  function cleanStyle(css, allowAbs) {
    return css.split(';').map((d) => d.trim()).filter((d) => {
      if (!d) return false;
      const l = d.toLowerCase();
      if (/^(mso-|-webkit-text-size|-moz-)/.test(l)) return false;
      if (/expression\(|javascript:|behavior|binding|@import/.test(l)) return false;
      if (/url\(/.test(l) && !/url\(\s*['"]?data:image\//.test(l)) return false;
      if (!allowAbs && /^(position|z-index)\s*:/.test(l)) return false;
      if (/^position\s*:\s*fixed/.test(l)) return false;
      return true;
    }).join('; ');
  }
  function cleanNode(node, opts) {
    Array.from(node.childNodes).forEach((c) => {
      if (c.nodeType === 8) return c.remove();
      if (c.nodeType === 3) return;
      if (c.nodeType !== 1) return c.remove();
      const tag = c.tagName.toLowerCase().replace(/^.*:/, '');
      if (DROP_WITH_CONTENT.has(tag) || tag === 'title' && !c.closest('svg')) return c.remove();
      if (!ALLOWED.has(tag)) { cleanNode(c, opts); c.replaceWith(...Array.from(c.childNodes)); return; }
      const svg = SVGISH.has(tag) || !!c.closest('svg'), math = MATHISH(tag) && !svg && (tag === 'math' || !!c.closest('math'));
      const keepCls = (c.getAttribute('class') || '').split(/\s+/).filter((x) => /^(wx-|ml-)/.test(x) || (opts && opts.keepAllClasses && x));
      const abs = keepCls.includes('wx-abs') || keepCls.includes('wx-obj');
      Array.from(c.attributes).forEach((a) => {
        const n = a.name.toLowerCase();
        if (n.startsWith('on')) return c.removeAttribute(a.name);
        if (n === 'class') return keepCls.length ? c.setAttribute('class', keepCls.join(' ')) : c.removeAttribute('class');
        if (n === 'style') { const s = cleanStyle(a.value, abs); return s ? c.setAttribute('style', s) : c.removeAttribute('style'); }
        if (n === 'href' || n === 'xlink:href') {
          const v = a.value.trim();
          if (!(/^(https?:|mailto:|tel:|#)/i.test(v))) c.removeAttribute(a.name); return;
        }
        if (n === 'src') { if (!/^(data:image\/|https?:|blob:)/i.test(a.value.trim())) c.removeAttribute('src'); return; }
        if (svg || math) return;
        if (n.startsWith('data-')) return;
        if (!HTML_ATTRS.has(n)) c.removeAttribute(a.name);
      });
      if (tag === 'a' && c.getAttribute('href') && !c.getAttribute('href').startsWith('#')) { c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener noreferrer'); }
      cleanNode(c, opts);
    });
  }
  /** Returns sanitised HTML string for the given (untrusted) HTML. */
  function sanitize(html, opts) {
    const doc = new DOMParser().parseFromString('<!doctype html><body>' + html, 'text/html');
    cleanNode(doc.body, opts);
    return doc.body.innerHTML;
  }

  /* ---------- toast ---------- */
  function toast(msg, type, ms) {
    let host = $('#toasts'); if (!host) host = document.body.appendChild(el('div', { id: 'toasts', 'aria-live': 'polite' }));
    const t = el('div', { class: 'toast ' + (type || '') }, el('span', { html: icon(type === 'error' ? 'circle-x' : type === 'success' ? 'circle-check' : 'info', 16) }), el('span', { text: msg }));
    host.appendChild(t); requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, ms || (type === 'error' ? 5000 : 2600));
  }

  /* ---------- dialogs ---------- */
  function dialog(o) {
    const back = el('div', { class: 'modal-back' });
    const box = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', style: o.width ? { width: o.width } : null });
    const head = el('div', { class: 'modal-head' }, el('h3', { text: o.title || '' }), el('button', { class: 'icon-btn', 'aria-label': 'Close', html: icon('x', 18), onclick: () => dlg.close() }));
    const body = el('div', { class: 'modal-body' });
    if (typeof o.body === 'string') body.innerHTML = o.body; else if (o.body) body.append(o.body);
    const foot = el('div', { class: 'modal-foot' });
    const dlg = {
      el: box, body, close(v) { back.classList.remove('in'); document.removeEventListener('keydown', onKey, true); setTimeout(() => back.remove(), 150); if (o.onClose) o.onClose(v); if (dlg._res) dlg._res(v); },
      $: (s) => $(s, box), $$: (s) => $$(s, box),
    };
    (o.buttons || [{ label: 'Close' }]).forEach((b) => {
      const btn = el('button', { class: 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''), text: b.label });
      btn.addEventListener('click', async () => { const r = b.onClick ? await b.onClick(dlg) : undefined; if (r !== false) dlg.close(b.value); });
      foot.append(btn); b._el = btn;
    });
    box.append(head, body); if ((o.buttons || [1]).length) box.append(foot);
    back.append(box); document.body.append(back);
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); dlg.close(); }
      else if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON' && !e.target.isContentEditable) {
        const p = (o.buttons || []).find((b) => b.primary); if (p && p._el) { e.preventDefault(); p._el.click(); }
      }
    }
    document.addEventListener('keydown', onKey, true);
    back.addEventListener('mousedown', (e) => { if (e.target === back && !o.modalLock) dlg.close(); });
    requestAnimationFrame(() => { back.classList.add('in'); const f = $('input:not([type=hidden]):not([type=checkbox]),textarea,select', body); if (f && !o.noFocus) f.focus(); });
    if (o.onOpen) o.onOpen(dlg);
    dlg.promise = new Promise((r) => (dlg._res = r));
    return dlg;
  }
  const prompt = (title, label, value, extra) => new Promise((res) => {
    const inp = el('input', { type: 'text', value: value || '', class: 'input', style: { width: '100%' } });
    const body = el('div', { class: 'form' }, el('label', null, label || '', inp), extra || null);
    let done = false;
    dialog({ title, body, width: '420px', buttons: [{ label: 'Cancel', onClick: () => { done = true; res(null); } }, { label: 'OK', primary: true, onClick: () => { done = true; res(inp.value); } }], onClose: () => { if (!done) res(null); }, onOpen: () => setTimeout(() => { inp.focus(); inp.select(); }, 60) });
  });
  const confirm = (msg, okLabel, danger) => new Promise((res) => {
    let done = false;
    dialog({ title: 'Confirm', body: el('p', { text: msg }), width: '420px', buttons: [{ label: 'Cancel', onClick: () => { done = true; res(false); } }, { label: okLabel || 'OK', primary: !danger, danger: !!danger, onClick: () => { done = true; res(true); } }], onClose: () => { if (!done) res(false); } });
  });

  /* ---------- popup menus ---------- */
  let openMenu = null;
  function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', menuKey, true); } }
  function outside(e) { if (openMenu && !openMenu.contains(e.target) && !(e.target.closest && e.target.closest('.menu'))) closeMenu(); }
  function menuKey(e) { if (e.key === 'Escape') { closeMenu(); } }
  function buildMenu(items, cls) {
    const m = el('div', { class: 'menu ' + (cls || ''), role: 'menu' });
    items.forEach((it) => {
      if (!it) return;
      if (it.sep) return m.append(el('div', { class: 'menu-sep' }));
      if (it.header) return m.append(el('div', { class: 'menu-head', text: it.header }));
      const row = el('div', { class: 'menu-item' + (it.disabled ? ' disabled' : '') + (it.checked ? ' checked' : ''), role: 'menuitem' });
      if (it.html) row.innerHTML = it.html; else {
        row.append(el('span', { class: 'mi-ic', html: it.icon ? icon(it.icon, 16) : (it.checked ? icon('check', 16) : '') }), el('span', { class: 'mi-l', text: it.label }));
        if (it.shortcut) row.append(el('span', { class: 'mi-k', text: it.shortcut }));
        if (it.children) row.append(el('span', { class: 'mi-sub', html: icon('chevron-down', 14) }));
      }
      if (it.children) {
        let sub = null;
        row.addEventListener('mouseenter', () => {
          $$('.menu.sub').forEach((s) => s.remove());
          sub = buildMenu(it.children, 'sub'); document.body.append(sub);
          const r = row.getBoundingClientRect(); const w = sub.offsetWidth;
          sub.style.left = (r.right + w > innerWidth ? Math.max(4, r.left - w) : r.right - 2) + 'px'; sub.style.top = Math.min(r.top, innerHeight - sub.offsetHeight - 8) + 'px';
        });
      } else row.addEventListener('mouseenter', () => $$('.menu.sub').forEach((s) => s.remove()));
      if (!it.children) row.addEventListener('click', (e) => { if (it.disabled) return; e.stopPropagation(); closeMenu(); $$('.menu.sub').forEach((s) => s.remove()); if (it.action) it.action(it); });
      else row.addEventListener('click', (e) => e.stopPropagation());
      row.addEventListener('mousedown', (e) => e.preventDefault()); // keep editor selection
      m.append(row);
    });
    return m;
  }
  /** Show a popup menu anchored to an element or a {x,y} point. */
  function menu(anchor, items, opts) {
    closeMenu(); $$('.menu.sub').forEach((s) => s.remove());
    const m = buildMenu(items, opts && opts.cls); document.body.append(m); openMenu = m;
    let x, y;
    if (anchor.getBoundingClientRect) { const r = anchor.getBoundingClientRect(); x = r.left; y = r.bottom + 2; } else { x = anchor.x; y = anchor.y; }
    const w = m.offsetWidth, h = m.offsetHeight;
    if (x + w > innerWidth - 6) x = Math.max(6, innerWidth - w - 6);
    if (y + h > innerHeight - 6) y = anchor.getBoundingClientRect ? Math.max(6, anchor.getBoundingClientRect().top - h - 2) : Math.max(6, innerHeight - h - 6);
    m.style.left = x + 'px'; m.style.top = y + 'px'; m.classList.add('in');
    setTimeout(() => { document.addEventListener('mousedown', outside, true); document.addEventListener('keydown', menuKey, true); }, 0);
    return m;
  }
  /** Generic popover with arbitrary content node. */
  function popover(anchor, node, cls) {
    closeMenu(); $$('.menu.sub').forEach((s) => s.remove());
    const m = el('div', { class: 'menu popover ' + (cls || '') }, node); document.body.append(m); openMenu = m;
    const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: anchor.x, bottom: anchor.y, top: anchor.y };
    let x = r.left, y = r.bottom + 2; const w = m.offsetWidth, h = m.offsetHeight;
    if (x + w > innerWidth - 6) x = Math.max(6, innerWidth - w - 6);
    if (y + h > innerHeight - 6) y = Math.max(6, r.top - h - 2);
    m.style.left = x + 'px'; m.style.top = y + 'px'; m.classList.add('in');
    m.addEventListener('mousedown', (e) => { if (!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) e.preventDefault(); });
    setTimeout(() => { document.addEventListener('mousedown', outside, true); document.addEventListener('keydown', menuKey, true); }, 0);
    return m;
  }

  /* ---------- colour picker ---------- */
  function mix(hex, t, to) { const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * t)); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); }
  const BASE = ['#000000', '#ffffff', '#44546a', '#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47', '#c00000'];
  const STD = ['#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0'];
  function colorPicker(anchor, o) {
    const box = el('div', { class: 'cp' });
    const sw = (c, title) => el('button', { class: 'cp-sw', style: { background: c }, title: title || c, 'aria-label': title || c, onclick: () => { closeMenu(); o.onPick(c); } });
    if (o.noneLabel) box.append(el('button', { class: 'cp-none', text: o.noneLabel, onclick: () => { closeMenu(); o.onPick(null); } }));
    box.append(el('div', { class: 'cp-h', text: 'Theme colours' }));
    const grid = el('div', { class: 'cp-grid' });
    BASE.forEach((c) => grid.append(sw(c)));
    [[0.8, 255], [0.6, 255], [0.4, 255], [0.25, 0], [0.5, 0]].forEach(([t, to]) => BASE.forEach((c, i) => grid.append(sw(i === 0 && to === 255 ? mix('#000000', t, 255) : i === 1 && to === 0 ? mix('#ffffff', t * 0.5, 0) : mix(c, t, to)))));
    box.append(grid, el('div', { class: 'cp-h', text: 'Standard colours' }), el('div', { class: 'cp-grid' }, STD.map((c) => sw(c))));
    const custom = el('input', { type: 'color', value: o.current && /^#/.test(o.current) ? o.current : '#2b579a', class: 'cp-custom' });
    custom.addEventListener('change', () => { closeMenu(); o.onPick(custom.value); });
    box.append(el('label', { class: 'cp-more' }, 'More colours… ', custom));
    return popover(anchor, box, 'cp-pop');
  }

  /* ---------- tooltips ---------- */
  function initTooltips() {
    const tip = el('div', { id: 'tooltip', role: 'tooltip' }); document.body.append(tip);
    let t, cur;
    document.addEventListener('mouseover', (e) => {
      const n = e.target.closest && e.target.closest('[data-tip]'); if (n === cur) return; cur = n; clearTimeout(t); tip.classList.remove('in');
      if (!n || 'ontouchstart' in window && matchMedia('(pointer:coarse)').matches) return;
      t = setTimeout(() => {
        tip.textContent = n.getAttribute('data-tip'); const r = n.getBoundingClientRect();
        tip.style.left = '0px'; tip.style.top = '0px'; const w = tip.offsetWidth;
        tip.style.left = clamp(r.left + r.width / 2 - w / 2, 4, innerWidth - w - 4) + 'px'; tip.style.top = (r.bottom + 6 > innerHeight - 30 ? r.top - 30 : r.bottom + 6) + 'px'; tip.classList.add('in');
      }, 450);
    });
    document.addEventListener('mousedown', () => { clearTimeout(t); tip.classList.remove('in'); cur = null; }, true);
  }

  /* ---------- text/number helpers ---------- */
  function toRoman(n) { const m = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]; let s = ''; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; }
  function fmtNum(n, f) {
    if (f === 'i') return toRoman(n); if (f === 'I') return toRoman(n).toUpperCase();
    if (f === 'a' || f === 'A') { let s = '', x = n; while (x > 0) { x--; s = String.fromCharCode(97 + (x % 26)) + s; x = Math.floor(x / 26); } return f === 'A' ? s.toUpperCase() : s; }
    return String(n);
  }
  const pxToPt = (px) => Math.round(px * 0.75 * 10) / 10;
  const ptToPx = (pt) => pt / 0.75;

  WX.util = { $, $$, el, icon, esc, uid, clamp, debounce, fmtDate, download, readFile, pickFile, loadScript, dataURLtoBlob, hashText, sanitize, toRoman, fmtNum, pxToPt, ptToPx };
  WX.ui = { toast, dialog, prompt, confirm, menu, popover, closeMenu, colorPicker, initTooltips };
})();
