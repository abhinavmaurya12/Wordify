/* WordX – editor.js
 * Core editing engine. The document is a normalised tree of top-level blocks
 * (p, h1-h6, ul/ol, table, blockquote, pre, hr, page-break) inside one editable
 * surface that pagination.js lays out onto physical page sheets. This module owns:
 *   - selection save/restore helpers and block helpers
 *   - snapshot based undo/redo (per document)
 *   - paste / drop sanitising, tab handling, context menu
 *   - the change pipeline (dirty flag -> history, pagination, autosave) */
(function () {
  'use strict';
  const WX = window.WX; const { $, el, esc, debounce } = WX.util;
  const ed = (WX.editor = {});
  const BLOCK_SEL = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,pre,td,th';
  const NESTED_SEL = 'p,h1,h2,h3,h4,h5,h6,blockquote,pre,ul,ol,table,td,th';
  const TOP_BLOCKS = /^(P|H[1-6]|UL|OL|TABLE|BLOCKQUOTE|PRE|HR|DIV)$/;
  ed.BLOCK_SEL = BLOCK_SEL; ed.doc = null; ed.ctxProviders = []; ed.pasteHooks = [];
  let lastRange = null;

  ed.defaultSettings = () => ({
    page: { size: 'A4', orient: 'portrait', margins: { t: 96, r: 96, b: 96, l: 96 }, bg: '#ffffff', border: null, watermark: null },
    hf: { header: '', footer: '', firstHeader: '', firstFooter: '', differentFirst: false, startNumber: 1, numFormat: '1' },
    protect: null, trackChanges: false, columns: 1,
  });
  ed.defaultMeta = () => ({ comments: [], sources: [], citationStyle: 'APA', userWords: [] });

  /* ---------- init ---------- */
  ed.init = function () {
    ed.el = $('#editor'); ed.paper = $('#paper'); ed.scroller = $('#canvas-scroll');
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); document.execCommand('styleWithCSS', false, true); } catch (e) { /* ignore */ }
    document.addEventListener('selectionchange', () => { const s = ed.sel(); if (s) lastRange = s.getRangeAt(0).cloneRange(); WX.bus.emit('selection'); });
    ed.el.addEventListener('beforeinput', onBeforeInput);
    ed.el.addEventListener('input', onInput);
    ed.el.addEventListener('keydown', onKeyDown);
    ed.el.addEventListener('paste', onPaste);
    ed.el.addEventListener('copy', (e) => { /* keep native */ });
    ed.el.addEventListener('dragover', (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault(); });
    ed.el.addEventListener('drop', onDrop);
    ed.el.addEventListener('click', onClick);
    ed.el.addEventListener('contextmenu', onContext);
    ed.el.addEventListener('dblclick', (e) => WX.bus.emit('dblclick', e));
    ed.el.addEventListener('focus', () => WX.bus.emit('focus'));
  };

  /* ---------- selection helpers ---------- */
  ed.sel = () => { const s = window.getSelection(); return s && s.rangeCount && ed.el.contains(s.anchorNode) ? s : null; };
  ed.range = () => { const s = ed.sel(); return s ? s.getRangeAt(0) : null; };
  ed.restore = () => {
    if (!ed.el.isContentEditable && !ed.protectedSelectable) return;
    if (!ed.sel()) { ed.el.focus({ preventScroll: true }); if (lastRange && ed.el.contains(lastRange.startContainer)) { const s = getSelection(); s.removeAllRanges(); s.addRange(lastRange); } else ed.caretToEnd(); }
  };
  ed.setRange = (r) => { const s = getSelection(); s.removeAllRanges(); s.addRange(r); lastRange = r.cloneRange(); };
  ed.caretToEnd = () => { const r = document.createRange(); r.selectNodeContents(ed.el); r.collapse(false); ed.setRange(r); };
  ed.caretIn = (node, atEnd) => { const r = document.createRange(); r.selectNodeContents(node); r.collapse(!atEnd); ed.setRange(r); };
  const pathOf = (n) => { const p = []; while (n && n !== ed.el) { p.unshift(Array.prototype.indexOf.call(n.parentNode.childNodes, n)); n = n.parentNode; } return p; };
  const nodeAt = (p) => { let n = ed.el; for (const i of p) { n = n && n.childNodes[i]; } return n; };
  ed.saveSel = () => { const r = ed.range(); return r ? { s: pathOf(r.startContainer), so: r.startOffset, e: pathOf(r.endContainer), eo: r.endOffset } : null; };
  ed.loadSel = (o) => {
    if (!o) return;
    try {
      const s = nodeAt(o.s), e = nodeAt(o.e); if (!s || !e) return;
      const r = document.createRange(); r.setStart(s, Math.min(o.so, s.nodeType === 3 ? s.length : s.childNodes.length)); r.setEnd(e, Math.min(o.eo, e.nodeType === 3 ? e.length : e.childNodes.length)); ed.setRange(r);
    } catch (err) { /* selection restore is best effort */ }
  };

  /* ---------- block helpers ---------- */
  ed.closestLeaf = (n) => { while (n && n !== ed.el) { if (n.nodeType === 1 && n.matches(BLOCK_SEL)) return n; n = n.parentNode; } return null; };
  ed.topBlock = (n) => { while (n && n.parentNode !== ed.el) n = n.parentNode; return n && n.nodeType === 1 ? n : null; };
  ed.isLeaf = (b) => b.tagName === 'LI' || !b.querySelector(NESTED_SEL);
  /** All leaf blocks touched by the selection (paragraphs, headings, list items, cells). */
  ed.leafBlocks = (r) => {
    r = r || ed.range(); if (!r) return [];
    const start = ed.closestLeaf(r.startContainer);
    if (r.collapsed) return start ? [start] : [];
    const root = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentNode;
    const out = [];
    const cands = Array.from((ed.el.contains(root) ? root : ed.el).querySelectorAll(BLOCK_SEL));
    if (start && !cands.includes(start)) cands.unshift(start);
    cands.forEach((b) => { if (ed.isLeaf(b) && r.intersectsNode(b) && !out.includes(b)) out.push(b); });
    return out;
  };
  ed.replaceTag = (node, tag) => {
    if (node.tagName.toLowerCase() === tag) return node;
    const n = document.createElement(tag); Array.from(node.attributes).forEach((a) => n.setAttribute(a.name, a.value));
    while (node.firstChild) n.appendChild(node.firstChild); node.replaceWith(n); return n;
  };
  const isEmptyBlock = (b) => !b.textContent.replace(/[​\s]/g, '') && !b.querySelector('img,svg,table,hr,math,.wx-obj');

  /** Turn stray inline content / generic divs at the top level into proper paragraphs. */
  ed.normalize = function (root) {
    root = root || ed.el; let run = [];
    const flush = (before) => { if (!run.length) return; if (run.every((n) => n.nodeType === 3 && !n.textContent.trim())) { run.forEach((n) => n.remove()); run = []; return; } const p = document.createElement('p'); run[0].before(p); run.forEach((n) => p.appendChild(n)); run = []; };
    Array.from(root.childNodes).forEach((n) => {
      if (n.nodeType === 8) return n.remove();
      if (n.nodeType === 1 && TOP_BLOCKS.test(n.tagName) && !(n.tagName === 'DIV' && n.classList.contains('wx-inline'))) {
        flush();
        if (n.tagName === 'DIV' && !/wx-(pagebreak|cols|textbox|notes|toc|sectionbreak|comment|abs)/.test(n.className)) {
          if (n.querySelector('p,h1,h2,h3,h4,h5,h6,ul,ol,table,blockquote,pre,div')) { ed.normalize(n); n.replaceWith(...Array.from(n.childNodes)); } else ed.replaceTag(n, 'p');
        }
      } else if (n.nodeType === 3 && !n.textContent.trim() && !run.length) n.remove();
      else run.push(n);
    });
    flush();
    if (root === ed.el && !root.firstChild) root.innerHTML = '<p><br></p>';
    // every table cell needs content so the caret can enter it
    $$all('td,th', root).forEach((c) => { if (!c.firstChild) c.innerHTML = '<br>'; });
  };
  const $$all = (s, r) => Array.from((r || document).querySelectorAll(s));

  /** Clean copy of the editor content: no layout-only artefacts. */
  ed.cleanClone = function (root) {
    const c = (root || ed.el).cloneNode(true);
    c.querySelectorAll('[data-wx-push]').forEach((n) => { n.removeAttribute('data-wx-push'); n.style.removeProperty('--wx-push'); if (!n.getAttribute('style')) n.removeAttribute('style'); });
    c.querySelectorAll('.wx-selected,.wx-cellsel,.wx-find-hit,.wx-sel-obj').forEach((n) => { n.classList.remove('wx-selected', 'wx-cellsel', 'wx-find-hit', 'wx-sel-obj'); if (!n.getAttribute('class')) n.removeAttribute('class'); });
    c.querySelectorAll('.wx-handles').forEach((n) => n.remove());
    return c;
  };
  ed.getHTML = () => ed.cleanClone().innerHTML;

  /* ---------- load / commit ---------- */
  ed.load = function (doc) {
    ed.doc = doc;
    ed.el.innerHTML = doc.content && doc.content.trim() ? doc.content : '<p><br></p>';
    ed.normalize();
    ed.el.spellcheck = WX.state.nativeSpell !== false;
    ed.updateEditable();
    WX.page.apply(true);
    if (!doc._h) doc._h = { undo: [], redo: [], cur: { html: ed.getHTML(), sel: null } };
    WX.bus.emit('docloaded', doc);
  };
  ed.commit = function () { if (!ed.doc) return; ed.doc.content = ed.getHTML(); };
  ed.updateEditable = function () {
    const prot = ed.doc && ed.doc.settings.protect && ed.doc.settings.protect.mode && !ed.doc._unlocked;
    const ro = WX.state.view === 'read' || (prot && ed.doc.settings.protect.mode !== 'tracked');
    ed.el.contentEditable = ro ? 'false' : 'true'; ed.protectedSelectable = ro;
    document.body.classList.toggle('doc-locked', !!prot); WX.bus.emit('editable', !ro);
  };
  ed.isEditable = () => ed.el.isContentEditable;

  /* ---------- change pipeline & history ---------- */
  const snap = () => ({ html: ed.getHTML(), sel: ed.saveSel() });
  ed.pushHistory = function () {
    const d = ed.doc; if (!d) return; const h = d._h; const s = snap();
    if (s.html === h.cur.html) { h.cur.sel = s.sel; return; }
    h.undo.push(h.cur); h.cur = s; h.redo.length = 0;
    let total = 0; for (let i = h.undo.length - 1; i >= 0; i--) { total += h.undo[i].html.length; if (total > 40e6 || h.undo.length - i > 100) { h.undo.splice(0, i + 1); break; } }
  };
  const pushDeb = debounce(() => ed.pushHistory(), 450);
  ed.changed = function (o) {
    const d = ed.doc; if (!d) return; o = o || {};
    d.dirty = true; d.lastEdit = Date.now();
    if (o.immediate) { pushDeb.cancel(); ed.pushHistory(); } else pushDeb();
    WX.page.schedule(); WX.bus.emit('dirty', d);
  };
  /** Run a mutation that must be a single undo step. */
  ed.run = function (fn) { ed.restore(); pushDeb.flush(); const r = fn(); ed.changed({ immediate: true }); return r; };
  function applySnap(s) {
    ed.el.innerHTML = s.html; ed.normalize(); ed.loadSel(s.sel); ed.doc.dirty = true; WX.page.paginate(); WX.bus.emit('dirty', ed.doc); WX.bus.emit('selection'); WX.bus.emit('restored');
  }
  ed.undo = function () { pushDeb.flush(); const h = ed.doc._h; if (!h.undo.length) return; h.redo.push(h.cur); h.cur = h.undo.pop(); applySnap(h.cur); };
  ed.redo = function () { pushDeb.flush(); const h = ed.doc._h; if (!h.redo.length) return; h.undo.push(h.cur); h.cur = h.redo.pop(); applySnap(h.cur); };
  ed.canUndo = () => !!(ed.doc && ed.doc._h && (ed.doc._h.undo.length || ed.doc._h.cur.html !== ed.getHTML()));
  ed.canRedo = () => !!(ed.doc && ed.doc._h && ed.doc._h.redo.length);

  /* ---------- input pipeline ---------- */
  function onBeforeInput(e) {
    if (e.inputType === 'historyUndo') { e.preventDefault(); return ed.undo(); }
    if (e.inputType === 'historyRedo') { e.preventDefault(); return ed.redo(); }
    if (!ed.isEditable()) return e.preventDefault();
    WX.bus.emit('beforeinput', e);
  }
  function onInput(e) {
    // keep structure valid (e.g. after select-all + delete)
    let needs = !ed.el.firstChild; for (let n = ed.el.firstChild; n && !needs; n = n.nextSibling) if (n.nodeType !== 1 || !TOP_BLOCKS.test(n.tagName)) needs = true;
    if (needs) { const sel = ed.saveSel(); ed.normalize(); if (!ed.sel()) { ed.loadSel(sel); if (!ed.sel()) ed.caretIn(ed.el.firstChild); } }
    WX.bus.emit('input', e); ed.changed();
  }
  function onKeyDown(e) {
    if (e.defaultPrevented) return;
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const r = ed.range(); if (!r) return; const cell = ed.closestLeaf(r.startContainer);
      const li = cell && cell.closest('li'); const td = cell && cell.closest('td,th');
      if (li) { e.preventDefault(); e.shiftKey ? WX.act.outdent() : WX.act.indent(); return; }
      if (td && WX.tables) { e.preventDefault(); WX.tables.tabMove(td, e.shiftKey); return; }
      e.preventDefault(); if (!e.shiftKey) ed.insertTab();
    }
    WX.bus.emit('keydown', e);
  }
  ed.insertTab = function () {
    document.execCommand('insertHTML', false, '<span class="wx-tab" style="white-space:pre">\t</span>');
    const r = ed.range(); const t = r && r.startContainer.parentElement && r.startContainer.parentElement.closest('.wx-tab');
    if (t) { const n = document.createRange(); n.setStartAfter(t); n.collapse(true); ed.setRange(n); }
  };

  /* ---------- paste / drop ---------- */
  function textToHtml(t) { return t.replace(/\r/g, '').split('\n').map((l) => `<p>${esc(l) || '<br>'}</p>`).join(''); }
  function insertClean(html, plain) {
    if (plain) {
      const t = html; if (!t.includes('\n')) return document.execCommand('insertText', false, t);
      return document.execCommand('insertHTML', false, textToHtml(t));
    }
    document.execCommand('insertHTML', false, WX.util.sanitize(html));
  }
  function onPaste(e) {
    e.preventDefault(); if (!ed.isEditable()) return;
    const cd = e.clipboardData; if (!cd) return;
    const files = Array.from(cd.files || []).filter((f) => /^image\//.test(f.type));
    if (files.length && WX.images) { files.forEach((f) => WX.images.insertFile(f)); return; }
    const html = cd.getData('text/html'), text = cd.getData('text/plain');
    ed.restore(); pushDeb.flush();
    for (const h of ed.pasteHooks) if (h(e, html, text)) return;
    if (html && !ed.plainPaste) insertClean(html); else insertClean(text, true);
    ed.plainPaste = false;
    ed.normalize(); ed.changed({ immediate: true });
  }
  ed.pasteFromClipboard = async function (plain) {
    try {
      if (!plain && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const it of items) {
          const img = it.types.find((t) => t.startsWith('image/')); if (img && WX.images) { return WX.images.insertFile(await it.getType(img)); }
          if (it.types.includes('text/html')) { const h = await (await it.getType('text/html')).text(); ed.restore(); insertClean(h); ed.normalize(); return ed.changed({ immediate: true }); }
        }
      }
      const t = await navigator.clipboard.readText(); ed.restore(); insertClean(t, true); ed.changed({ immediate: true });
    } catch (err) { WX.ui.toast('Clipboard access was blocked – use Ctrl+V to paste.', 'error'); }
  };
  async function onDrop(e) {
    const dt = e.dataTransfer; if (!dt || !dt.files || !dt.files.length) return;
    e.preventDefault(); const files = Array.from(dt.files);
    const imgs = files.filter((f) => /^image\//.test(f.type));
    if (imgs.length && WX.images) {
      const pos = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null; if (pos) ed.setRange(pos);
      imgs.forEach((f) => WX.images.insertFile(f));
    } else if (files[0]) WX.docs.importFile(files[0]);
  }
  function onClick(e) {
    const a = e.target.closest && e.target.closest('a[href]');
    if (a && (e.ctrlKey || e.metaKey || !ed.isEditable())) { e.preventDefault(); const h = a.getAttribute('href'); if (h.startsWith('#')) { const t = ed.el.querySelector('[id="' + CSS.escape(h.slice(1)) + '"]'); if (t) t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } else window.open(h, '_blank', 'noopener'); }
    WX.bus.emit('click', e);
  }

  /* ---------- insertion helpers ---------- */
  /** Insert a block-level node (table, hr, TOC…) at the caret, splitting the paragraph if needed. */
  ed.insertBlock = function (node) {
    ed.restore(); pushDeb.flush();
    let r = ed.range(); if (!r) { ed.caretToEnd(); r = ed.range(); }
    if (!r.collapsed) r.deleteContents();
    let top = ed.topBlock(r.startContainer);
    if (!top) { ed.el.appendChild(node); }
    else if (/^(P|H[1-6]|BLOCKQUOTE|PRE)$/.test(top.tagName)) {
      if (isEmptyBlock(top)) top.before(node);
      else {
        const tail = document.createRange(); tail.setStart(r.startContainer, r.startOffset); tail.setEndAfter(top.lastChild || top);
        const frag = tail.extractContents(); const clone = top.cloneNode(false); clone.appendChild(frag);
        top.after(node);
        if (!clone.firstChild) clone.innerHTML = '<br>'; node.after(clone);
        if (isEmptyBlock(top) && top.parentNode) top.remove();
      }
    } else top.after(node);
    if (!node.nextElementSibling) node.after(Object.assign(document.createElement('p'), { innerHTML: '<br>' }));
    ed.changed({ immediate: true }); return node;
  };
  /** Insert an inline node at the caret and put the caret after it. */
  ed.insertInline = function (node, keepSel) {
    ed.restore(); pushDeb.flush(); let r = ed.range(); if (!r) { ed.caretToEnd(); r = ed.range(); }
    if (!r.collapsed) r.deleteContents();
    r.insertNode(node);
    if (!keepSel) { const n = document.createRange(); n.setStartAfter(node); n.collapse(true); ed.setRange(n); }
    ed.changed({ immediate: true }); return node;
  };
  ed.insertHTML = function (html) { ed.restore(); pushDeb.flush(); document.execCommand('insertHTML', false, html); ed.normalize(); ed.changed({ immediate: true }); };
  ed.insertText = function (t) { ed.restore(); pushDeb.flush(); document.execCommand('insertText', false, t); ed.changed({ immediate: true }); };
  ed.selectedText = () => { const s = ed.sel(); return s ? s.toString() : ''; };
  ed.scrollTo = (node) => { const n = node.nodeType === 1 ? node : node.parentElement; if (n) n.scrollIntoView({ block: 'center', behavior: 'smooth' }); };

  /* ---------- context menu ---------- */
  function onContext(e) {
    if (e.shiftKey) return; e.preventDefault();
    const r = ed.range(); const onSel = r && !r.collapsed;
    if (!onSel || e.target.closest('table,.wx-obj,img')) { const p = document.caretRangeFromPoint && document.caretRangeFromPoint(e.clientX, e.clientY); if (p && ed.el.contains(p.startContainer) && !(r && !r.collapsed)) ed.setRange(p); }
    const ro = !ed.isEditable(); let items = [];
    ed.ctxProviders.forEach((p) => { const i = p(e); if (i && i.length) items = items.concat(i, [{ sep: true }]); });
    const a = e.target.closest && e.target.closest('a[href]');
    if (a) items.push({ label: 'Open link', icon: 'link', action: () => window.open(a.href, '_blank', 'noopener') }, { label: 'Edit link…', action: () => { ed.setRange((() => { const n = document.createRange(); n.selectNodeContents(a); return n; })()); WX.act.link(); } }, { label: 'Remove link', disabled: ro, action: () => { ed.setRange((() => { const n = document.createRange(); n.selectNodeContents(a); return n; })()); WX.act.unlink(); } }, { sep: true });
    items.push(
      { label: 'Cut', icon: 'scissors', shortcut: 'Ctrl+X', disabled: ro || !onSel, action: () => { ed.restore(); document.execCommand('cut'); } },
      { label: 'Copy', icon: 'copy', shortcut: 'Ctrl+C', disabled: !onSel, action: () => { ed.restore(); document.execCommand('copy'); } },
      { label: 'Paste', icon: 'clipboard-paste', shortcut: 'Ctrl+V', disabled: ro, action: () => ed.pasteFromClipboard(false) },
      { label: 'Paste as plain text', disabled: ro, action: () => ed.pasteFromClipboard(true) },
      { label: 'Select all', shortcut: 'Ctrl+A', action: () => WX.act.selectAll() },
      { sep: true },
      { label: 'Bold', icon: 'bold', shortcut: 'Ctrl+B', disabled: ro, action: () => WX.act.bold() },
      { label: 'Italic', icon: 'italic', shortcut: 'Ctrl+I', disabled: ro, action: () => WX.act.italic() },
      { label: 'Hyperlink…', icon: 'link', shortcut: 'Ctrl+K', disabled: ro, action: () => WX.act.link() },
      { label: 'New comment', icon: 'message-square-plus', disabled: !onSel, action: () => WX.act.addComment() },
    );
    WX.ui.menu({ x: e.clientX, y: e.clientY }, items);
  }

  /* ---------- core actions ---------- */
  Object.assign(WX.act, {
    undo: () => ed.undo(), redo: () => ed.redo(),
    selectAll: () => { ed.restore(); document.execCommand('selectAll'); },
    cut: () => { ed.restore(); document.execCommand('cut'); },
    copy: () => { ed.restore(); document.execCommand('copy'); },
    paste: () => ed.pasteFromClipboard(false),
    pastePlain: () => ed.pasteFromClipboard(true),
  });
})();
