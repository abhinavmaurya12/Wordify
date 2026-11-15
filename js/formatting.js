/* WordX – formatting.js
 * Character & paragraph formatting commands, styles gallery, lists, hyperlinks,
 * change-case, clear formatting and the format painter. All commands go through
 * WX.editor.run() so each is a single undo step. */
(function () {
  'use strict';
  const WX = window.WX; const { el, esc, ptToPx } = WX.util;
  const E = () => WX.editor;
  const F = (WX.fmt = {});
  const STYLE_CLASSES = ['wx-title', 'wx-subtitle', 'wx-quote', 'wx-intense', 'wx-nospace', 'wx-caption'];

  F.FONTS = ['Calibri', 'Arial', 'Arial Black', 'Cambria', 'Candara', 'Comic Sans MS', 'Consolas', 'Courier New', 'Garamond', 'Georgia', 'Helvetica', 'Impact', 'Lucida Sans', 'Palatino Linotype', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'];
  const GENERIC = { 'Courier New': 'monospace', Consolas: 'monospace', Georgia: 'serif', 'Times New Roman': 'serif', Cambria: 'serif', Garamond: 'serif', 'Palatino Linotype': 'serif' };
  F.fontStack = (n) => `'${n}', ${n === 'Calibri' ? "Carlito, 'Segoe UI', " : ''}${GENERIC[n] === 'serif' ? "'Liberation Serif', serif" : GENERIC[n] === 'monospace' ? "'Liberation Mono', monospace" : "'Liberation Sans', Arial, sans-serif"}`;
  F.SIZES = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
  F.STYLES = [
    { id: 'normal', label: 'Normal', tag: 'p', cls: '' }, { id: 'nospace', label: 'No Spacing', tag: 'p', cls: 'wx-nospace' },
    { id: 'title', label: 'Title', tag: 'p', cls: 'wx-title' }, { id: 'subtitle', label: 'Subtitle', tag: 'p', cls: 'wx-subtitle' },
    { id: 'h1', label: 'Heading 1', tag: 'h1', cls: '' }, { id: 'h2', label: 'Heading 2', tag: 'h2', cls: '' }, { id: 'h3', label: 'Heading 3', tag: 'h3', cls: '' }, { id: 'h4', label: 'Heading 4', tag: 'h4', cls: '' },
    { id: 'quote', label: 'Quote', tag: 'p', cls: 'wx-quote' }, { id: 'intense', label: 'Intense Quote', tag: 'p', cls: 'wx-intense' },
    { id: 'caption', label: 'Caption', tag: 'p', cls: 'wx-caption' }, { id: 'code', label: 'Code', tag: 'pre', cls: '' },
  ];
  const can = () => { if (!E().isEditable()) { WX.ui.toast('This document is read-only.'); return false; } return true; };
  const run = (fn) => { if (!can()) return; return E().run(fn); };
  const cmd = (name, val, css) => run(() => { document.execCommand('styleWithCSS', false, !!css); document.execCommand(name, false, val); });
  F.run = run;

  /* ---------- character formatting ---------- */
  function fontSize(pt) {
    run(() => {
      const r = E().range(); if (!r) return;
      if (r.collapsed) { // caret: drop a zero-width span so subsequent typing uses the size
        const s = el('span', { style: { fontSize: pt + 'pt' } }, '​'); r.insertNode(s); const n = document.createRange(); n.setStart(s.firstChild, 1); n.collapse(true); E().setRange(n); return;
      }
      document.execCommand('styleWithCSS', false, true); document.execCommand('fontSize', false, '7');
      E().el.querySelectorAll('font[size="7"],span[style*="xxx-large"],span[style*="-webkit-xxx-large"]').forEach((n) => {
        if (n.tagName === 'FONT') { const s = el('span'); while (n.firstChild) s.appendChild(n.firstChild); n.replaceWith(s); n = s; }
        n.style.fontSize = pt + 'pt'; n.querySelectorAll('[style*="font-size"]').forEach((c) => c.style.removeProperty('font-size'));
      });
    });
  }
  function fontName(n) { cmd('fontName', F.fontStack(n), true); }
  function stepSize(dir) { const cur = F.queryState().fontSize || 11; const l = F.SIZES; const next = dir > 0 ? l.find((s) => s > cur) || cur + 2 : [...l].reverse().find((s) => s < cur) || Math.max(1, cur - 1); fontSize(next); }

  /* ---------- change case ---------- */
  function changeCase(mode) {
    run(() => {
      const e = E(); let r = e.range(); if (!r) return; const s = e.sel();
      if (r.collapsed) { s.modify('move', 'backward', 'word'); s.modify('extend', 'forward', 'word'); r = s.getRangeAt(0); }
      const root = r.commonAncestorContainer.nodeType === 3 ? r.commonAncestorContainer.parentNode : r.commonAncestorContainer;
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const nodes = []; let n; while ((n = tw.nextNode())) if (r.intersectsNode(n)) nodes.push(n);
      if (!nodes.length && r.commonAncestorContainer.nodeType === 3) nodes.push(r.commonAncestorContainer);
      let atStart = true;
      nodes.forEach((t) => {
        const a = t === r.startContainer ? r.startOffset : 0, b = t === r.endContainer ? r.endOffset : t.length; let seg = t.data.slice(a, b);
        if (mode === 'upper') seg = seg.toUpperCase(); else if (mode === 'lower') seg = seg.toLowerCase();
        else if (mode === 'toggle') seg = seg.replace(/./g, (c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()));
        else if (mode === 'title') seg = seg.toLowerCase().replace(/(^|[\s\-("'])([a-zÀ-ɏ])/g, (m, p, c) => p + c.toUpperCase());
        else if (mode === 'sentence') { seg = seg.toLowerCase().replace(/(^|[.!?]\s+)([a-z])/g, (m, p, c) => p + c.toUpperCase()); if (atStart) seg = seg.replace(/^(\s*)([a-z])/, (m, p, c) => p + c.toUpperCase()); }
        atStart = false; t.data = t.data.slice(0, a) + seg + t.data.slice(b);
      });
    });
  }

  /* ---------- clear formatting ---------- */
  function clearFormatting() {
    run(() => {
      const e = E(); document.execCommand('removeFormat');
      const r = e.range(); const sp = e.saveSel();
      e.leafBlocks(r).forEach((b) => {
        STYLE_CLASSES.forEach((c) => b.classList.remove(c)); if (!b.getAttribute('class')) b.removeAttribute('class'); b.removeAttribute('style');
        if (/^H[1-6]$/.test(b.tagName) || b.tagName === 'PRE' || b.tagName === 'BLOCKQUOTE') e.replaceTag(b, 'p');
      });
      if (r && !r.collapsed) e.range() && e.el.querySelectorAll('span[style]').forEach((s) => { if (r.intersectsNode(s) && !s.closest('.wx-obj,table')) { /* strip remaining inline style from selected spans */ s.removeAttribute('style'); } });
      e.loadSel(sp);
    });
  }

  /* ---------- styles ---------- */
  function applyStyle(id) {
    const st = F.STYLES.find((s) => s.id === id); if (!st) return;
    run(() => {
      const e = E(); const sp = e.saveSel();
      e.leafBlocks().forEach((b) => {
        STYLE_CLASSES.forEach((c) => b.classList.remove(c));
        let n = b; if (b.tagName !== 'LI' && b.tagName !== 'TD' && b.tagName !== 'TH') n = e.replaceTag(b, st.tag);
        if (st.cls) n.classList.add(st.cls); if (!n.getAttribute('class')) n.removeAttribute('class');
        if (st.id !== 'normal') { n.style.removeProperty('font-size'); n.style.removeProperty('font-family'); n.style.removeProperty('color'); }
      });
      e.loadSel(sp);
    });
  }
  F.currentStyle = function () {
    const r = E().range(); if (!r) return 'normal'; const b = E().closestLeaf(r.startContainer); if (!b) return 'normal';
    const c = STYLE_CLASSES.find((x) => b.classList.contains(x)); if (c) return F.STYLES.find((s) => s.cls === c).id;
    const t = b.tagName.toLowerCase(); if (/^h[1-4]$/.test(t)) return t; if (t === 'pre') return 'code'; return 'normal';
  };

  /* ---------- state query for the ribbon ---------- */
  F.queryState = function () {
    const e = E(), r = e.range(); const out = {};
    if (!r) return out;
    let n = r.startContainer; if (n.nodeType === 3) n = n.parentElement; if (!n || !e.el.contains(n)) return out;
    const cs = getComputedStyle(n);
    const q = (c) => { try { return document.queryCommandState(c); } catch (x) { return false; } };
    Object.assign(out, { bold: q('bold'), italic: q('italic'), underline: q('underline'), strike: q('strikeThrough'), sup: q('superscript'), sub: q('subscript'),
      ul: !!n.closest('ul'), ol: !!n.closest('ol'), fontSize: Math.round(parseFloat(cs.fontSize) * 0.75 * 10) / 10, fontName: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), style: F.currentStyle(),
      align: (() => { const b = e.closestLeaf(n); const a = b ? getComputedStyle(b).textAlign : 'left'; return a === 'start' ? 'left' : a === 'end' ? 'right' : a; })(),
      inTable: !!n.closest('table'), color: cs.color });
    return out;
  };

  /* ---------- lists ---------- */
  function listCmd(kind, type) {
    run(() => {
      const e = E(); document.execCommand(kind === 'ul' ? 'insertUnorderedList' : 'insertOrderedList');
      const r = e.range(); const n = r && (r.startContainer.nodeType === 3 ? r.startContainer.parentElement : r.startContainer); const list = n && n.closest(kind);
      if (list && type) { list.style.listStyleType = type; list.querySelectorAll(kind).forEach((l) => l.style.removeProperty('list-style-type')); }
    });
  }
  function multilevel(kind) {
    run(() => {
      const e = E(); let r = e.range(); let n = r && (r.startContainer.nodeType === 3 ? r.startContainer.parentElement : r.startContainer); let list = n && n.closest('ul,ol');
      if (!list) { document.execCommand(kind === 'bullet' ? 'insertUnorderedList' : 'insertOrderedList'); r = e.range(); n = r && (r.startContainer.nodeType === 3 ? r.startContainer.parentElement : r.startContainer); list = n && n.closest('ul,ol'); }
      if (!list) return; while (list.parentElement && list.parentElement.closest('ul,ol') && e.el.contains(list.parentElement.closest('ul,ol'))) list = list.parentElement.closest('ul,ol');
      let root = list; if (kind !== 'bullet' && root.tagName === 'UL') root = e.replaceTag(root, 'ol'); if (kind === 'bullet' && root.tagName === 'OL') root = e.replaceTag(root, 'ul');
      root.className = root.className.replace(/\bml-\S+/g, '').trim(); root.classList.add('ml-' + kind); root.style.removeProperty('list-style-type');
    });
  }
  function indent() {
    if (!can()) return; const e = E(); const bl = e.leafBlocks(); if (!bl.length) return;
    run(() => {
      if (bl.some((b) => b.tagName === 'LI')) document.execCommand('indent');
      bl.forEach((b) => { if (b.tagName !== 'LI') b.style.marginLeft = (parseFloat(b.style.marginLeft) || 0) + 48 + 'px'; });
    });
  }
  function outdent() {
    if (!can()) return; const e = E(); const bl = e.leafBlocks(); if (!bl.length) return;
    run(() => {
      if (bl.some((b) => b.tagName === 'LI')) document.execCommand('outdent');
      bl.forEach((b) => { if (b.tagName !== 'LI') { const v = Math.max(0, (parseFloat(b.style.marginLeft) || 0) - 48); v ? (b.style.marginLeft = v + 'px') : b.style.removeProperty('margin-left'); if (!b.getAttribute('style')) b.removeAttribute('style'); } });
    });
  }

  /* ---------- paragraph spacing / borders / shading ---------- */
  const blocksApply = (fn) => run(() => E().leafBlocks().forEach((b) => { fn(b); if (!b.getAttribute('style')) b.removeAttribute('style'); }));
  F.borderPref = { style: 'solid', color: '#222222', width: 1 };
  function borders(kind) {
    const bp = F.borderPref, css = `${bp.width}px ${bp.style} ${bp.color}`;
    blocksApply((b) => {
      ['Top', 'Right', 'Bottom', 'Left'].forEach((s) => b.style.removeProperty('border-' + s.toLowerCase()));
      b.style.removeProperty('padding');
      if (kind === 'none') return;
      const sides = kind === 'box' || kind === 'all' ? ['top', 'right', 'bottom', 'left'] : [kind];
      sides.forEach((s) => { b.style['border-' + s] = css; }); b.style.padding = '2px 6px';
    });
  }
  function shading(c) { blocksApply((b) => { c ? (b.style.backgroundColor = c) : b.style.removeProperty('background-color'); }); }
  function bordersDialog() {
    const bp = F.borderPref;
    WX.ui.dialog({ title: 'Borders and Shading', width: '400px', body: `<div class="form"><label>Apply to <select class="input" id="bd-k">${[['box', 'Box'], ['bottom', 'Bottom'], ['top', 'Top'], ['left', 'Left'], ['right', 'Right'], ['none', 'None']].map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
      <label>Style <select class="input" id="bd-s">${['solid', 'dashed', 'dotted', 'double'].map((s) => `<option ${bp.style === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      <label>Colour <input type="color" id="bd-c" value="${bp.color}"></label><label>Width (px) <input type="number" class="input" min="1" max="10" id="bd-w" value="${bp.width}"></label>
      <label>Shading <input type="color" id="bd-bg" value="#ffffff"> <input type="checkbox" id="bd-bgon"> apply</label></div>`,
      buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, onClick: (d) => { F.borderPref = { style: d.$('#bd-s').value, color: d.$('#bd-c').value, width: +d.$('#bd-w').value || 1 }; borders(d.$('#bd-k').value); if (d.$('#bd-bgon').checked) shading(d.$('#bd-bg').value); } }] });
  }
  function paragraphDialog() {
    const b = E().leafBlocks()[0]; if (!b) return; const cs = getComputedStyle(b);
    const pt = (px) => Math.round(parseFloat(px) * 0.75 * 10) / 10 || 0; const lh = b.style.lineHeight || (cs.lineHeight === 'normal' ? '1.15' : (parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)).toFixed(2));
    const f = (id, l, v, step) => `<label>${l}<input class="input" type="number" step="${step || 1}" id="${id}" value="${v}"></label>`;
    WX.ui.dialog({ title: 'Paragraph', width: '460px', body: `<div class="form grid2">
      <label>Alignment <select class="input" id="pg-al">${['left', 'center', 'right', 'justify'].map((a) => `<option ${cs.textAlign === a ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
      ${f('pg-ls', 'Line spacing (×)', lh, 0.05)}${f('pg-li', 'Left indent (pt)', pt(cs.marginLeft))}${f('pg-ri', 'Right indent (pt)', pt(cs.marginRight))}${f('pg-fi', 'First line (pt)', pt(cs.textIndent))}
      ${f('pg-sb', 'Space before (pt)', pt(cs.marginTop))}${f('pg-sa', 'Space after (pt)', pt(cs.marginBottom))}</div>`,
      buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, onClick: (d) => { const v = (i) => parseFloat(d.$('#' + i).value) || 0; blocksApply((x) => { x.style.textAlign = d.$('#pg-al').value; x.style.lineHeight = v('pg-ls') || ''; if (x.tagName !== 'LI') x.style.marginLeft = ptToPx(v('pg-li')) + 'px'; x.style.marginRight = ptToPx(v('pg-ri')) + 'px'; x.style.textIndent = ptToPx(v('pg-fi')) + 'px'; x.style.marginTop = ptToPx(v('pg-sb')) + 'px'; x.style.marginBottom = ptToPx(v('pg-sa')) + 'px'; }); } }] });
  }

  /* ---------- hyperlink ---------- */
  function linkDialog() {
    if (!can()) return; const e = E(); e.restore(); const r = e.range(); if (!r) return;
    const startEl = r.startContainer.nodeType === 3 ? r.startContainer.parentElement : r.startContainer; const existing = startEl && startEl.closest('a[href]');
    const bms = Array.from(e.el.querySelectorAll('a.wx-bookmark[id]')).map((b) => b.id);
    const saved = e.saveSel();
    const text = existing ? existing.textContent : r.toString();
    WX.ui.dialog({ title: existing ? 'Edit hyperlink' : 'Insert hyperlink', width: '480px', body: `<div class="form"><label>Text to display <input class="input" id="lk-t" value="${esc(text)}"></label>
      <label>Address <input class="input" id="lk-u" placeholder="https://example.com or name@mail.com" value="${esc(existing ? existing.getAttribute('href') : '')}"></label>
      ${bms.length ? `<label>…or place in this document <select class="input" id="lk-b"><option value="">(none)</option>${bms.map((b) => `<option value="${esc(b)}">${esc(b)}</option>`).join('')}</select></label>` : ''}</div>`,
      buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, onClick: (d) => {
        let url = d.$('#lk-u').value.trim(); const bm = d.$('#lk-b') && d.$('#lk-b').value; if (bm) url = '#' + bm;
        if (!url) return WX.ui.toast('Enter an address.', 'error') || false;
        if (!/^(https?:|mailto:|tel:|#)/i.test(url)) url = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url) ? 'mailto:' + url : 'https://' + url;
        const label = d.$('#lk-t').value;
        e.loadSel(saved); e.restore();
        run(() => {
          if (existing && e.el.contains(existing)) { existing.setAttribute('href', url); if (label && label !== existing.textContent) existing.textContent = label; return; }
          const rr = e.range();
          if (rr.collapsed || (label && label !== rr.toString())) { const a = el('a', { href: url, text: label || url }); rr.deleteContents(); rr.insertNode(a); const n = document.createRange(); n.setStartAfter(a); n.collapse(true); e.setRange(n); }
          else { document.execCommand('createLink', false, url); }
          e.el.querySelectorAll('a[href]').forEach((a) => { if (!a.getAttribute('href').startsWith('#')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } });
        });
      } }] });
  }

  /* ---------- format painter ---------- */
  F.painter = null;
  function formatPainter() {
    if (F.painter) { F.painter = null; document.body.classList.remove('painting'); return WX.bus.emit('selection'); }
    const r = E().range(); if (!r) return; let n = r.startContainer.nodeType === 3 ? r.startContainer.parentElement : r.startContainer; const cs = getComputedStyle(n); const q = F.queryState();
    let bg = null; for (let x = n; x && x !== E().el; x = x.parentElement) { if (x.style && x.style.backgroundColor && x.style.backgroundColor !== 'transparent') { bg = x.style.backgroundColor; break; } }
    F.painter = { bold: q.bold, italic: q.italic, underline: q.underline, strike: q.strike, sup: q.sup, sub: q.sub, color: cs.color, bg, font: q.fontName, size: q.fontSize };
    document.body.classList.add('painting'); WX.bus.emit('selection');
  }
  document.addEventListener('mouseup', () => {
    if (!F.painter) return; setTimeout(() => {
      const r = E().range(); if (!r || r.collapsed) return; const p = F.painter; F.painter = null; document.body.classList.remove('painting');
      run(() => {
        const q = F.queryState(); const t = (name, want, have) => { if (!!want !== !!have) document.execCommand(name); };
        document.execCommand('styleWithCSS', false, false); t('bold', p.bold, q.bold); t('italic', p.italic, q.italic); t('underline', p.underline, q.underline); t('strikeThrough', p.strike, q.strike);
        document.execCommand('styleWithCSS', false, true); document.execCommand('foreColor', false, p.color); document.execCommand('hiliteColor', false, p.bg || 'transparent');
        document.execCommand('fontName', false, F.fontStack(p.font)); const sv = E().saveSel(); fontSizeNoRun(p.size); E().loadSel(sv);
      });
      WX.bus.emit('selection');
    }, 0);
  });
  function fontSizeNoRun(pt) {
    document.execCommand('fontSize', false, '7');
    E().el.querySelectorAll('font[size="7"],span[style*="xxx-large"]').forEach((n) => { if (n.tagName === 'FONT') { const s = el('span'); while (n.firstChild) s.appendChild(n.firstChild); n.replaceWith(s); n = s; } n.style.fontSize = pt + 'pt'; n.querySelectorAll('[style*="font-size"]').forEach((c) => c.style.removeProperty('font-size')); });
  }

  /* ---------- horizontal rule ---------- */
  function hr() { if (!can()) return; const h = document.createElement('hr'); E().insertBlock(h); E().caretIn(h.nextElementSibling); }

  /* ---------- action registry ---------- */
  Object.assign(WX.act, {
    bold: () => cmd('bold', null, false), italic: () => cmd('italic', null, false), underline: () => cmd('underline', null, false), strike: () => cmd('strikeThrough', null, false),
    superscript: () => cmd('superscript', null, false), subscript: () => cmd('subscript', null, false),
    textColor: (c) => cmd('foreColor', c || '#000000', true), highlight: (c) => cmd('hiliteColor', c || 'transparent', true),
    fontName, fontSize, growFont: () => stepSize(1), shrinkFont: () => stepSize(-1), changeCase, clearFormat: clearFormatting, style: applyStyle,
    alignLeft: () => cmd('justifyLeft', null, true), alignCenter: () => cmd('justifyCenter', null, true), alignRight: () => cmd('justifyRight', null, true), alignJustify: () => cmd('justifyFull', null, true),
    bullets: (t) => listCmd('ul', t), numbering: (t) => listCmd('ol', t), multilevel, indent, outdent,
    lineSpacing: (v) => blocksApply((b) => { b.style.lineHeight = v; }),
    spaceBefore: (pt) => blocksApply((b) => { b.style.marginTop = ptToPx(pt) + 'px'; }), spaceAfter: (pt) => blocksApply((b) => { b.style.marginBottom = ptToPx(pt) + 'px'; }),
    borders, bordersDialog, shading, paragraphDialog, link: linkDialog, unlink: () => cmd('unlink'), formatPainter, hr,
  });
})();
