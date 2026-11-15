/* WordX – pagination.js
 * Page layout engine. The editable flow is measured block by block; any block that
 * would cross the bottom margin of a physical page is pushed to the next page with a
 * transient margin (data-wx-push, stripped on save). Physical sheets, headers, footers,
 * watermark, page borders and the ruler are rendered on a layer behind the text. */
(function () {
  'use strict';
  const WX = window.WX; const { $, el, esc, clamp, fmtNum } = WX.util;
  const P = (WX.page = {});
  const SIZES = { A4: [794, 1123], A3: [1123, 1587], A5: [559, 794], Letter: [816, 1056], Legal: [816, 1344] };
  const GAP = 32; P.SIZES = SIZES; P.GAP = GAP; P.pages = 1;
  let timer = null, rafId = 0, ro = null;
  const ed = () => WX.editor;

  P.metrics = function (s) {
    s = s || ed().doc.settings; const pg = s.page; let [w, h] = SIZES[pg.size] || SIZES.A4;
    if (pg.orient === 'landscape') [w, h] = [h, w];
    const m = pg.margins; return { W: w, H: h, mt: m.t, mr: m.r, mb: m.b, ml: m.l, PH: h + GAP, cw: w - m.l - m.r, ch: h - m.t - m.b };
  };

  /** (Re)apply page geometry to the DOM and repaginate. */
  P.apply = function () {
    const e = ed(); if (!e.doc) return;
    const view = WX.state.view, m = P.metrics();
    document.body.dataset.view = view;
    if (view === 'print') { e.paper.style.width = m.W + 'px'; e.el.style.padding = `${m.mt}px ${m.mr}px ${m.mb}px ${m.ml}px`; }
    else { e.paper.style.width = ''; e.el.style.padding = ''; }
    $('#paper').style.setProperty('--page-bg', e.doc.settings.page.bg || '#fff');
    P.paginate(true); P.renderRuler(); P.fit();
  };
  P.schedule = function () { clearTimeout(timer); timer = setTimeout(() => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(() => P.paginate()); }, 90); };

  function units() {
    const u = [];
    Array.from(ed().el.children).forEach((c) => {
      if (c.classList.contains('wx-abs') || c.classList.contains('wx-handles')) return;
      if (c.tagName === 'UL' || c.tagName === 'OL') Array.from(c.children).forEach((li) => li.tagName === 'LI' && u.push(li)); else u.push(c);
    });
    return u;
  }
  const isHeading = (n) => /^H[1-4]$/.test(n.tagName) || n.classList.contains('wx-title');

  P.paginate = function (forceSheets) {
    const e = ed(); if (!e.doc) return 1; const el_ = e.el;
    el_.querySelectorAll('[data-wx-push]').forEach((n) => { n.removeAttribute('data-wx-push'); n.style.removeProperty('--wx-push'); if (!n.getAttribute('style')) n.removeAttribute('style'); });
    let pages = 1; const m = P.metrics();
    if (WX.state.view === 'print') {
      const u = units(); const { PH, H, mt, mb, ch } = m; let minTop = 0;
      const pageOf = (y) => Math.max(0, Math.floor(y / PH));
      const push = (n, target) => {
        const m0 = parseFloat(getComputedStyle(n).marginTop) || 0; n.setAttribute('data-wx-push', '1');
        let v = m0 + target - n.offsetTop; n.style.setProperty('--wx-push', v + 'px');
        for (let k = 0; k < 2; k++) { const err = target - n.offsetTop; if (Math.abs(err) < 0.5) break; v += err; n.style.setProperty('--wx-push', v + 'px'); } // margin-collapse correction
      };
      let end = 0;
      for (let i = 0; i < u.length; i++) {
        const n = u[i]; let top = n.offsetTop; const h = n.offsetHeight;
        if (minTop && top < minTop) { push(n, minTop); top = n.offsetTop; } minTop = 0;
        const p = pageOf(top); const limit = p * PH + H - mb; const pageTop = p * PH + mt;
        const brk = n.classList.contains('wx-pagebreak') || (n.classList.contains('wx-sectionbreak') && n.dataset.kind !== 'continuous');
        if (!brk && top + h > limit + 0.5 && h <= ch + 0.5 && top > pageTop + 1) {
          const target = (p + 1) * PH + mt; const prev = u[i - 1];
          if (prev && isHeading(prev) && !prev.hasAttribute('data-wx-push') && prev.offsetTop > pageTop + 1) push(prev, target); // keep heading with next block
          else push(n, target);
        } else if (!brk && h > 0 && top >= limit - 0.5) push(n, (p + 1) * PH + mt); // starts inside the bottom margin
        if (brk) minTop = (pageOf(n.offsetTop) + 1) * PH + mt;
        end = Math.max(end, n.offsetTop + n.offsetHeight);
      }
      if (minTop && u.length) { /* trailing page break: content ends on next page */ end = Math.max(end, minTop + 1); }
      pages = Math.max(1, pageOf(end - 1) + 1);
      el_.style.minHeight = pages * PH - GAP + 'px';
    } else el_.style.minHeight = '';
    const sig = pages + '|' + JSON.stringify([e.doc.settings.page, e.doc.settings.hf, e.doc.title]) + WX.state.view;
    if (forceSheets || sig !== P._sig) { P._sig = sig; renderSheets(pages); }
    P.pages = pages; e.doc.pages = pages; WX.bus.emit('paginated', pages); P.updateBox();
    return pages;
  };

  /* ---------- sheets (paper, header/footer, watermark, border) ---------- */
  function resolveTokens(html, i, pages) {
    const hf = ed().doc.settings.hf;
    return html.replace(/\{PAGE\}/g, fmtNum((hf.startNumber || 1) + i, hf.numFormat || '1')).replace(/\{PAGES\}/g, fmtNum(pages, hf.numFormat || '1'))
      .replace(/\{DATE\}/g, new Date().toLocaleDateString()).replace(/\{TITLE\}/g, esc(ed().doc.title || ''));
  }
  function renderSheets(pages) {
    const host = $('#sheets'); host.innerHTML = '';
    if (WX.state.view !== 'print') { host.style.display = 'none'; return; } host.style.display = '';
    const s = ed().doc.settings, m = P.metrics(), pg = s.page, hf = s.hf;
    for (let i = 0; i < pages; i++) {
      const sh = el('div', { class: 'sheet', style: { top: i * m.PH + 'px', width: m.W + 'px', height: m.H + 'px', background: pg.bg || '#fff' }, 'data-page': i + 1 });
      if (pg.border) sh.append(el('div', { class: 'sheet-border', style: { inset: (pg.border.inset || 24) + 'px', border: `${pg.border.width || 1}px ${pg.border.style || 'solid'} ${pg.border.color || '#000'}` } }));
      if (pg.watermark && pg.watermark.text) {
        const w = pg.watermark; sh.append(el('div', { class: 'wm', style: { color: w.color || '#999', opacity: w.opacity == null ? 0.25 : w.opacity, fontSize: (w.size || 96) + 'px', transform: `translate(-50%,-50%) rotate(${w.angle == null ? -45 : w.angle}deg)` }, text: w.text }));
      }
      const first = hf.differentFirst && i === 0;
      const hh = first ? hf.firstHeader : hf.header, ff = first ? hf.firstFooter : hf.footer;
      if (hh) sh.append(el('div', { class: 'hf hdr', style: { left: m.ml + 'px', right: m.mr + 'px', maxHeight: Math.max(24, m.mt - 52) + 'px' }, html: resolveTokens(hh, i, pages) }));
      if (ff) sh.append(el('div', { class: 'hf ftr', style: { left: m.ml + 'px', right: m.mr + 'px', maxHeight: Math.max(24, m.mb - 52) + 'px' }, html: resolveTokens(ff, i, pages) }));
      host.append(sh);
    }
  }

  /* ---------- zoom ---------- */
  P.setZoom = function (z, silent) {
    z = clamp(z, 0.25, 4); WX.state.zoom = z; $('#zoom-inner').style.transform = `scale(${z})`;
    const lab = $('#zoom-label'); if (lab) lab.textContent = Math.round(z * 100) + '%'; const sl = $('#zoom-slider'); if (sl) sl.value = Math.round(z * 100);
    P.updateBox(); P.renderRuler(); WX.bus.emit('zoom', z); if (!silent) WX.state.autoFit = false;
  };
  P.updateBox = function () {
    const paper = $('#paper'), h = $('#zoom-holder'), z = WX.state.zoom || 1; if (!paper || !h) return;
    h.style.width = paper.offsetWidth * z + 'px'; h.style.height = paper.offsetHeight * z + 'px';
  };
  P.fit = function () {
    if (!WX.state.autoFit) return P.updateBox();
    const sc = $('#canvas-scroll'), w = sc.clientWidth - (innerWidth < 700 ? 12 : 48); const pw = $('#paper').offsetWidth || 794;
    P.setZoom(WX.state.view === 'print' ? Math.min(1, w / pw) : Math.min(1, w / pw), true);
  };
  P.fitMode = function (mode) { // 'width' | 'page'
    const sc = $('#canvas-scroll'), m = P.metrics(); const pw = $('#paper').offsetWidth;
    if (mode === 'page') P.setZoom(Math.min((sc.clientHeight - 40) / m.H, (sc.clientWidth - 40) / pw)); else P.setZoom((sc.clientWidth - 48) / pw);
  };
  P.toPaper = (cx, cy) => { const r = $('#paper').getBoundingClientRect(), z = WX.state.zoom || 1; return { x: (cx - r.left) / z, y: (cy - r.top) / z }; };
  P.pageOf = function (node) {
    const n = node.nodeType === 1 ? node : node.parentElement; if (!n || WX.state.view !== 'print') return 1;
    const r = n.getBoundingClientRect(), pr = $('#paper').getBoundingClientRect(), z = WX.state.zoom || 1;
    return clamp(Math.floor((r.top - pr.top) / z / P.metrics().PH) + 1, 1, P.pages);
  };
  P.currentPage = function () {
    const r = ed().range(); if (!r) return 1; let n = r.startContainer; if (n.nodeType === 3) n = n.parentElement; return P.pageOf(n);
  };
  P.goto = function (n) {
    const sc = $('#canvas-scroll'), pr = $('#zoom-holder').offsetTop, z = WX.state.zoom || 1;
    sc.scrollTo({ top: pr + (n - 1) * P.metrics().PH * z - 10, behavior: 'smooth' });
  };

  /* ---------- ruler ---------- */
  P.renderRuler = function () {
    const host = $('#ruler'); if (!host) return;
    if (!WX.state.showRuler || WX.state.view !== 'print' || !ed().doc) { host.style.display = 'none'; return; }
    host.style.display = ''; const m = P.metrics(), z = WX.state.zoom || 1;
    host.style.width = m.W * z + 'px';
    let ticks = '';
    for (let x = 0; x <= m.W; x += 12) {
      const d = x - m.ml; if (d % 12 !== 0) continue; const k = d / 12; const inch = k / 8;
      if (x < 0 || x > m.W) continue;
      if (k % 8 === 0) { if (k !== 0) ticks += `<text x="${x}" y="14" text-anchor="middle">${Math.abs(inch)}</text>`; else ticks += `<line x1="${x}" x2="${x}" y1="8" y2="16"/>`; }
      else if (k % 4 === 0) ticks += `<line x1="${x}" x2="${x}" y1="9" y2="15"/>`; else ticks += `<line x1="${x}" x2="${x}" y1="11" y2="13"/>`;
    }
    host.innerHTML = `<div class="ruler-inner" style="width:${m.W}px;transform:scale(${z})">
      <div class="r-dark" style="left:0;width:${m.ml}px"></div><div class="r-dark" style="right:0;width:${m.mr}px"></div>
      <svg width="${m.W}" height="22">${ticks}</svg>
      <div class="rm rm-ml" data-k="ml" style="left:${m.ml - 3}px" data-tip="Left margin"></div><div class="rm rm-mr" data-k="mr" style="left:${m.W - m.mr - 3}px" data-tip="Right margin"></div>
      <div class="ri ri-fl" data-k="fl" data-tip="First line indent"></div><div class="ri ri-li" data-k="li" data-tip="Left indent"></div><div class="ri ri-ri" data-k="ri" data-tip="Right indent"></div></div>`;
    P.updateIndents();
  };
  P.updateIndents = function () {
    const host = $('#ruler'); if (!host || host.style.display === 'none') return; const r = ed().range(); const m = P.metrics();
    const b = r && ed().closestLeaf(r.startContainer); let left = 0, first = 0, right = 0;
    if (b) { const cs = getComputedStyle(b); left = parseFloat(b.style.marginLeft) || 0; first = parseFloat(b.style.textIndent) || 0; right = parseFloat(b.style.marginRight) || 0; if (b.tagName === 'LI') { left = parseFloat(cs.marginLeft) || 0; } }
    const set = (k, x) => { const n = host.querySelector(`[data-k=${k}]`); if (n) n.style.left = x - 5 + 'px'; };
    set('li', m.ml + left); set('fl', m.ml + left + first); set('ri', m.W - m.mr - right);
  };
  function rulerDrag(e) {
    const h = e.target.closest('.rm,.ri'); if (!h) return; e.preventDefault(); h.setPointerCapture(e.pointerId);
    const k = h.dataset.k, z = WX.state.zoom || 1, x0 = e.clientX, s = ed().doc.settings.page.margins, m = P.metrics();
    const blocks = ed().leafBlocks(); const start = blocks.map((b) => ({ b, l: parseFloat(b.style.marginLeft) || 0, f: parseFloat(b.style.textIndent) || 0, r: parseFloat(b.style.marginRight) || 0 }));
    const move = (ev) => {
      const dx = Math.round((ev.clientX - x0) / z / 6) * 6;
      if (k === 'ml') s.l = clamp(m.ml + dx, 24, m.W - m.mr - 120); else if (k === 'mr') s.r = clamp(m.mr - dx, 24, m.W - m.ml - 120);
      if (k === 'ml' || k === 'mr') { P.apply(); return; }
      start.forEach((o) => {
        if (k === 'li') { o.b.style.marginLeft = Math.max(0, o.l + dx) + 'px'; } else if (k === 'fl') { o.b.style.textIndent = clamp(o.f + dx, -(o.l), 600) + 'px'; } else if (k === 'ri') o.b.style.marginRight = Math.max(0, o.r - dx) + 'px';
      });
      P.paginate(); P.updateIndents();
    };
    const up = () => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); ed().changed({ immediate: true }); P.renderRuler(); };
    h.addEventListener('pointermove', move); h.addEventListener('pointerup', up);
  }

  /* ---------- thumbnails / overview ---------- */
  P.thumb = function (page, scale) {
    const m = P.metrics(); const c = document.getElementById('paper').cloneNode(true);
    c.removeAttribute('id'); c.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id')); c.querySelectorAll('[contenteditable]').forEach((n) => n.removeAttribute('contenteditable'));
    c.querySelectorAll('.wx-handles').forEach((n) => n.remove());
    c.style.cssText = `position:absolute;left:0;top:${-(page - 1) * m.PH}px;width:${m.W}px;transform:none`;
    const win = el('div', { style: { width: m.W + 'px', height: m.H + 'px', overflow: 'hidden', position: 'relative', transform: `scale(${scale})`, transformOrigin: '0 0', background: '#fff' } }, c);
    return el('div', { class: 'thumb', style: { width: m.W * scale + 'px', height: m.H * scale + 'px' } }, win);
  };
  P.overview = function () {
    if (WX.state.view !== 'print') return WX.ui.toast('Switch to Print Layout to see multiple pages.');
    const grid = el('div', { class: 'overview' }); const dlg = WX.ui.dialog({ title: `All pages (${P.pages})`, body: grid, width: 'min(1100px,96vw)', buttons: [{ label: 'Close' }] });
    const cols = innerWidth < 700 ? 2 : 4, sc = Math.min(0.3, (Math.min(1100, innerWidth * 0.96) - 80) / cols / P.metrics().W);
    for (let i = 1; i <= Math.min(P.pages, 60); i++) { const t = P.thumb(i, sc); const w = el('button', { class: 'ov-page', onclick: () => { dlg.close(); P.goto(i); } }, t, el('span', { text: i })); grid.append(w); }
  };

  /* ---------- init ---------- */
  P.init = function () {
    WX.state.zoom = 1; WX.state.autoFit = true; WX.state.showRuler = true; WX.state.view = 'print';
    ro = new ResizeObserver(() => P.updateBox()); ro.observe($('#paper'));
    window.addEventListener('resize', WX.util.debounce(() => { P.fit(); P.renderRuler(); }, 120));
    $('#ruler').addEventListener('pointerdown', rulerDrag);
    WX.bus.on('selection', WX.util.debounce(P.updateIndents, 60));
    WX.bus.on('dblclick', (ev) => {
      if (WX.state.view !== 'print') return; const p = P.toPaper(ev.clientX, ev.clientY), m = P.metrics(); const y = p.y % m.PH;
      if (y < m.mt - 4 && y < 80) WX.act.headerFooter('header'); else if (y > m.H - m.mb + 4 && y < m.H) WX.act.headerFooter('footer');
    });
  };

  /* ================= layout actions ================= */
  const update = (fn, rec) => { const d = ed().doc; fn(d.settings); P.apply(); ed().changed({ immediate: true }); };
  const MARGINS = { normal: [96, 96, 96, 96], narrow: [48, 48, 48, 48], moderate: [96, 72, 96, 72], wide: [96, 192, 96, 192], none: [0, 0, 0, 0] };
  Object.assign(WX.act, {
    pageSize: (s) => update((st) => { st.page.size = s; }),
    orientation: (o) => update((st) => { st.page.orient = o; }),
    margins: (k) => { const m = MARGINS[k]; update((st) => { st.page.margins = { t: m[0], r: m[1], b: m[2], l: m[3] }; }); },
    customMargins() {
      const mg = ed().doc.settings.page.margins; const f = (k, l) => `<label>${l}<input class="input" type="number" step="0.1" min="0" max="5" id="mg-${k}" value="${(mg[k] / 96).toFixed(2)}"> in</label>`;
      WX.ui.dialog({ title: 'Page margins', width: '380px', body: `<div class="form grid2">${f('t', 'Top')}${f('b', 'Bottom')}${f('l', 'Left')}${f('r', 'Right')}</div>`,
        buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, onClick: (d) => { const v = (k) => clamp(Math.round(parseFloat(d.$('#mg-' + k).value) * 96) || 0, 0, 480); update((st) => { st.page.margins = { t: v('t'), r: v('r'), b: v('b'), l: v('l') }; }); } }] });
    },
    pageBreak() { const d = el('div', { class: 'wx-pagebreak', contenteditable: 'false', 'data-label': 'Page Break' }); ed().insertBlock(d); ed().caretIn(d.nextElementSibling); },
    sectionBreak(kind) { const d = el('div', { class: 'wx-sectionbreak', contenteditable: 'false', 'data-kind': kind, 'data-label': kind === 'continuous' ? 'Section Break (Continuous)' : 'Section Break (Next Page)' }); ed().insertBlock(d); ed().caretIn(d.nextElementSibling); },
    columns(n) {
      const e = ed(); e.restore(); const r = e.range(); if (!r) return;
      const inCols = e.topBlock(r.startContainer);
      if (inCols && inCols.classList.contains('wx-cols')) { if (n === 1) { inCols.replaceWith(...Array.from(inCols.childNodes)); } else inCols.style.columnCount = n; return e.changed({ immediate: true }) || P.paginate(); }
      if (n === 1) return;
      let a = e.topBlock(r.startContainer), b = e.topBlock(r.endContainer); if (!a) return;
      if (r.collapsed) { a = e.el.firstElementChild; b = e.el.lastElementChild; }
      const wrap = el('div', { class: 'wx-cols', style: { columnCount: n, columnGap: '36px' } }); a.before(wrap);
      let cur = a; while (cur) { const nx = cur.nextElementSibling; wrap.append(cur); if (cur === b) break; cur = nx; }
      e.changed({ immediate: true });
    },
    pageColor(c) { update((st) => { st.page.bg = c || '#ffffff'; }); },
    pageBorders() {
      const cur = ed().doc.settings.page.border || { style: 'solid', color: '#000000', width: 2, inset: 24 };
      WX.ui.dialog({ title: 'Page borders', width: '400px', body: `<div class="form"><label><input type="checkbox" id="pb-on" ${ed().doc.settings.page.border ? 'checked' : ''}> Show page border</label>
        <label>Style <select class="input" id="pb-st">${['solid', 'dashed', 'dotted', 'double'].map((s) => `<option ${cur.style === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        <label>Colour <input type="color" id="pb-c" value="${cur.color}"></label><label>Width (px) <input class="input" type="number" min="1" max="12" id="pb-w" value="${cur.width}"></label>
        <label>Distance from edge (px) <input class="input" type="number" min="4" max="120" id="pb-i" value="${cur.inset}"></label></div>`,
        buttons: [{ label: 'Cancel' }, { label: 'Apply', primary: true, onClick: (d) => update((st) => { st.page.border = d.$('#pb-on').checked ? { style: d.$('#pb-st').value, color: d.$('#pb-c').value, width: +d.$('#pb-w').value || 1, inset: +d.$('#pb-i').value || 24 } : null; }) }] });
    },
    watermark() {
      const cur = ed().doc.settings.page.watermark || { text: 'CONFIDENTIAL', color: '#999999', opacity: 0.25, size: 96, angle: -45 };
      WX.ui.dialog({ title: 'Watermark', width: '420px', body: `<div class="form"><label>Text <input class="input" id="wm-t" value="${esc(cur.text)}"></label>
        <label>Colour <input type="color" id="wm-c" value="${cur.color}"></label><label>Size (px) <input class="input" type="number" id="wm-s" min="24" max="300" value="${cur.size}"></label>
        <label>Opacity <input type="range" id="wm-o" min="5" max="100" value="${Math.round(cur.opacity * 100)}"></label>
        <label>Layout <select class="input" id="wm-a"><option value="-45" ${cur.angle === -45 ? 'selected' : ''}>Diagonal</option><option value="0" ${cur.angle === 0 ? 'selected' : ''}>Horizontal</option></select></label></div>`,
        buttons: [{ label: 'Remove watermark', onClick: () => update((st) => { st.page.watermark = null; }) }, { label: 'Cancel' }, { label: 'Apply', primary: true, onClick: (d) => update((st) => { const t = d.$('#wm-t').value.trim(); st.page.watermark = t ? { text: t, color: d.$('#wm-c').value, size: +d.$('#wm-s').value || 96, opacity: d.$('#wm-o').value / 100, angle: +d.$('#wm-a').value } : null; }) }] });
    },
    headerFooter(which) {
      const hf = Object.assign({}, ed().doc.settings.hf); let area = which === 'footer' ? 'footer' : 'header';
      const names = { header: 'Header', footer: 'Footer', firstHeader: 'First page header', firstFooter: 'First page footer' };
      const sel = el('select', { class: 'input' }, Object.keys(names).map((k) => el('option', { value: k, text: names[k] })));
      const box = el('div', { class: 'hf-edit', contenteditable: 'true', spellcheck: 'true' });
      const tb = el('div', { class: 'hf-tb' });
      const btn = (l, fn, tip) => tb.append(el('button', { class: 'btn small', 'data-tip': tip || l, html: l, onmousedown: (e) => e.preventDefault(), onclick: fn }));
      btn('<b>B</b>', () => document.execCommand('bold')); btn('<i>I</i>', () => document.execCommand('italic')); btn('<u>U</u>', () => document.execCommand('underline'));
      btn(WX.util.icon('align-left', 14), () => document.execCommand('justifyLeft'), 'Left'); btn(WX.util.icon('align-center', 14), () => document.execCommand('justifyCenter'), 'Center'); btn(WX.util.icon('align-right', 14), () => document.execCommand('justifyRight'), 'Right');
      [['Page #', '{PAGE}'], ['Pages', '{PAGES}'], ['Date', '{DATE}'], ['Title', '{TITLE}']].forEach(([l, t]) => btn(l, () => document.execCommand('insertText', false, t), 'Insert ' + l));
      const diff = el('input', { type: 'checkbox' }); diff.checked = !!hf.differentFirst;
      const load = () => { box.innerHTML = hf[area] || '<p><br></p>'; }; const save = () => { const c = WX.util.sanitize(box.innerHTML); hf[area] = box.textContent.trim() ? c : ''; };
      sel.value = area; load(); sel.addEventListener('change', () => { save(); area = sel.value; load(); });
      WX.ui.dialog({ title: 'Header & Footer', width: '640px', body: el('div', { class: 'form' }, el('label', null, 'Edit ', sel), tb, box, el('label', { class: 'inline' }, diff, ' Different first page'), el('p', { class: 'muted', text: 'Use the Page #/Pages buttons to insert automatic page numbers. Double-click a header or footer on the page to edit it.' })),
        buttons: [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: () => { save(); hf.differentFirst = diff.checked; update((st) => { st.hf = Object.assign(st.hf, hf); }); } }] });
    },
    pageNumber(pos) { // 'header-left' ... 'footer-right' | 'remove'
      update((st) => {
        if (pos === 'remove') { ['header', 'footer', 'firstHeader', 'firstFooter'].forEach((k) => { st.hf[k] = (st.hf[k] || '').replace(/<p[^>]*>\s*\{PAGE\}\s*<\/p>/g, '').replace(/\{PAGE\}/g, ''); }); return; }
        const [where, al] = pos.split('-'); const k = where; st.hf[k] = (st.hf[k] || '').replace(/<p[^>]*>\s*\{PAGE\}\s*<\/p>/g, '') + `<p style="text-align:${al}">{PAGE}</p>`;
        if (st.hf.differentFirst) st.hf[k === 'header' ? 'firstHeader' : 'firstFooter'] = st.hf[k === 'header' ? 'firstHeader' : 'firstFooter'] || '';
      });
    },
    pageNumberFormat() {
      const hf = ed().doc.settings.hf;
      WX.ui.dialog({ title: 'Page number format', width: '380px', body: `<div class="form"><label>Number format <select class="input" id="pn-f">${[['1', '1, 2, 3'], ['i', 'i, ii, iii'], ['I', 'I, II, III'], ['a', 'a, b, c'], ['A', 'A, B, C']].map(([v, l]) => `<option value="${v}" ${hf.numFormat === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label>Start at <input class="input" type="number" id="pn-s" value="${hf.startNumber || 1}"></label></div>`,
        buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, onClick: (d) => update((st) => { st.hf.numFormat = d.$('#pn-f').value; st.hf.startNumber = parseInt(d.$('#pn-s').value, 10) || 1; }) }] });
    },
    zoomIn: () => P.setZoom((WX.state.zoom || 1) + 0.1), zoomOut: () => P.setZoom((WX.state.zoom || 1) - 0.1),
    zoomTo: (z) => P.setZoom(z), fitWidth: () => P.fitMode('width'), fitPage: () => P.fitMode('page'), multiPage: () => P.overview(),
    toggleRuler() { WX.state.showRuler = !WX.state.showRuler; P.renderRuler(); WX.bus.emit('viewchange'); },
    toggleGrid() { document.body.classList.toggle('show-grid'); WX.bus.emit('viewchange'); },
    setView(v) {
      WX.state.view = v; document.body.classList.toggle('read-mode', v === 'read'); document.body.classList.toggle('web-mode', v === 'web');
      ed().updateEditable(); P.apply(); WX.state.autoFit = true; P.fit(); WX.bus.emit('viewchange');
    },
    fullscreen() { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => WX.ui.toast('Full screen is not available in this browser.', 'error')); },
  });
  document.addEventListener('fullscreenchange', () => WX.bus.emit('viewchange'));
})();
