/* WordX – references.js
 * Table of contents, footnotes/endnotes, sources + citations + bibliography,
 * captions, cross-references and index. Everything is generated from the live
 * document and refreshed by "Update fields". */
(function () {
  'use strict';
  const WX = window.WX; const { el, esc, fmtNum } = WX.util; const E = () => WX.editor;
  const R = (WX.refs = {});
  const q = (s, r) => Array.from((r || E().el).querySelectorAll(s));
  const meta = () => { const d = E().doc; d.meta = d.meta || E().defaultMeta(); return d.meta; };
  let hid = 0;
  const ensureId = (h) => { if (!h.id) { do { h.id = 'wx-h-' + (++hid); } while (E().el.querySelectorAll('[id="' + h.id + '"]').length > 1); } return h.id; };
  const pageLabel = (node) => { const hf = E().doc.settings.hf; return fmtNum((hf.startNumber || 1) + WX.page.pageOf(node) - 1, hf.numFormat || '1'); };

  /* ---------- table of contents ---------- */
  const headings = (levels) => q('h1,h2,h3,h4,.wx-title').filter((h) => !h.closest('.wx-toc') && (h.classList.contains('wx-title') ? false : +h.tagName[1] <= levels) && h.textContent.trim());
  function buildTOC(box) {
    const lv = +box.dataset.levels || 3; box.innerHTML = '<span class="toc-h">Table of Contents</span>';
    const hs = headings(lv); if (!hs.length) { box.append(el('p', { text: 'No headings found. Apply Heading 1–3 styles to your titles, then update the table.' })); return; }
    hs.forEach((h) => { const p = el('p', { style: { marginLeft: (+h.tagName[1] - 1) * 18 + 'px' } }, el('a', { href: '#' + ensureId(h), text: h.textContent.trim() }), el('span', { class: 'dots' }), el('span', { class: 'pg', text: pageLabel(h) })); box.append(p); });
  }
  R.insertTOC = function (levels) {
    if (!E().isEditable()) return; const ex = q('.wx-toc')[0]; if (ex) { buildTOC(ex); E().changed({ immediate: true }); return WX.ui.toast('Table of contents updated.'); }
    const box = el('div', { class: 'wx-toc', contenteditable: 'false', 'data-levels': levels || 3 }); E().insertBlock(box); buildTOC(box); WX.page.paginate(); buildTOC(box); E().changed({ immediate: true });
  };
  R.updateTOC = function () { const t = q('.wx-toc'); if (!t.length) return false; WX.page.paginate(); t.forEach(buildTOC); return true; };
  R.removeTOC = function () { E().run(() => q('.wx-toc').forEach((t) => t.remove())); };

  /* ---------- footnotes & endnotes ---------- */
  function notesBlock(kind, create) {
    let b = q(`.wx-notes[data-kind="${kind}"]`)[0];
    if (!b && create) { b = el('div', { class: 'wx-notes', 'data-kind': kind }); if (kind === 'end') { b.append(el('p', { html: '<strong>Endnotes</strong>' })); E().el.append(b); } else { const en = q('.wx-notes[data-kind="end"]')[0]; en ? en.before(b) : E().el.append(b); } }
    return b;
  }
  R.insertNote = async function (kind) {
    if (!E().isEditable()) return; E().restore(); const saved = E().saveSel();
    const text = await WX.ui.prompt(kind === 'end' ? 'Insert endnote' : 'Insert footnote', 'Note text:', ''); if (text == null) return; E().loadSel(saved);
    const id = WX.util.uid('n'); const mk = el('sup', { class: kind === 'end' ? 'wx-en' : 'wx-fn', 'data-note': id, contenteditable: 'false', text: '0' });
    E().insertInline(mk);
    const b = notesBlock(kind, true); b.append(el('p', { 'data-note': id }, el('sup', { contenteditable: 'false', text: '0' }), ' ' + text));
    R.renumber(); E().changed({ immediate: true }); WX.page.schedule();
  };
  R.renumber = function () {
    let changed = false; const ed = E().el;
    ['foot', 'end'].forEach((kind) => {
      const marks = q(kind === 'end' ? 'sup.wx-en' : 'sup.wx-fn').filter((m) => !m.closest('.wx-notes')); const b = notesBlock(kind, false); if (!b) return;
      const byId = {}; Array.from(b.querySelectorAll('p[data-note]')).forEach((p) => { byId[p.dataset.note] = p; }); const order = [];
      marks.forEach((m, i) => { if (m.textContent !== String(i + 1)) { m.textContent = String(i + 1); changed = true; } const p = byId[m.dataset.note]; if (p) { order.push(p); const s = p.querySelector('sup'); if (s && s.textContent !== String(i + 1)) { s.textContent = String(i + 1); changed = true; } } });
      const cur = Array.from(b.querySelectorAll('p[data-note]')); if (cur.length !== order.length || cur.some((p, i) => p !== order[i])) { order.forEach((p) => b.append(p)); Object.values(byId).forEach((p) => { if (!order.includes(p)) p.remove(); }); changed = true; }
      if (!order.length) { b.remove(); changed = true; }
    });
    return changed;
  };

  /* ---------- sources, citations, bibliography ---------- */
  const lastName = (a) => { a = (a || '').trim(); if (!a) return 'Anon.'; if (a.includes(',')) return a.split(',')[0]; const w = a.split(/\s+/); return w[w.length - 1]; };
  const cite = (s, style) => style === 'MLA' ? `(${lastName(s.author)})` : style === 'Chicago' ? `(${lastName(s.author)} ${s.year || 'n.d.'})` : `(${lastName(s.author)}, ${s.year || 'n.d.'})`;
  const bibEntry = (s, style) => {
    const a = s.author || '', t = esc(s.title || ''), y = s.year || 'n.d.', p = esc(s.publisher || ''), u = s.url ? ' ' + esc(s.url) : '';
    if (style === 'MLA') return `${esc(a)}${a ? '. ' : ''}<em>${t}</em>. ${p ? p + ', ' : ''}${y}.${u}`;
    if (style === 'Chicago') return `${esc(a)}${a ? '. ' : ''}${y}. <em>${t}</em>. ${p}${p ? '.' : ''}${u}`;
    return `${esc(a)}${a ? ' ' : ''}(${y}). <em>${t}</em>. ${p}${p ? '.' : ''}${u}`;
  };
  R.sourcesDialog = function () {
    const m = meta(); const body = el('div', { class: 'form' }); const list = el('div', { class: 'list-box' });
    const style = el('select', { class: 'input' }, ['APA', 'MLA', 'Chicago'].map((s) => el('option', { text: s, selected: m.citationStyle === s }))); style.addEventListener('change', () => { m.citationStyle = style.value; R.updateCitations(); });
    const draw = () => { list.innerHTML = ''; if (!m.sources.length) list.append(el('div', { class: 'list-row muted', text: 'No sources yet. Add one below.' })); m.sources.forEach((s) => list.append(el('div', { class: 'list-row' }, el('span', { style: { flex: 1 }, html: `<b>${esc(lastName(s.author))}</b> (${esc(s.year || 'n.d.')}) – ${esc(s.title)}` }), el('button', { class: 'btn small', text: 'Edit', onclick: () => form(s) }), el('button', { class: 'btn small danger', text: 'Delete', onclick: () => { m.sources = m.sources.filter((x) => x !== s); draw(); } })))); };
    const f = {}; const fld = (k, l, ph) => { f[k] = el('input', { class: 'input', placeholder: ph || '' }); return el('label', null, l, f[k]); }; let editing = null;
    const grid = el('div', { class: 'form grid2' }, fld('author', 'Author', 'Last, First'), fld('year', 'Year'), fld('title', 'Title'), fld('publisher', 'Publisher / Journal / Site'), fld('url', 'URL (optional)'));
    const form = (s) => { editing = s; Object.keys(f).forEach((k) => { f[k].value = s ? s[k] || '' : ''; }); f.author.focus(); };
    body.append(el('label', null, 'Citation style', style), list, el('h4', { text: 'Add / edit source' }), grid, el('div', { class: 'side-row' }, el('button', { class: 'btn primary', text: 'Save source', onclick: () => { if (!f.title.value.trim() && !f.author.value.trim()) return WX.ui.toast('Enter an author or title.', 'error'); const o = { id: editing ? editing.id : WX.util.uid('src') }; Object.keys(f).forEach((k) => { o[k] = f[k].value.trim(); }); if (editing) Object.assign(editing, o); else m.sources.push(o); form(null); draw(); } })));
    draw(); WX.ui.dialog({ title: 'Manage sources', width: '600px', body, buttons: [{ label: 'Close' }], onClose: () => { R.updateCitations(); E().changed(); } });
  };
  R.citationMenu = function (anchor) {
    const m = meta(); const items = m.sources.map((s) => ({ label: `${lastName(s.author)} (${s.year || 'n.d.'}) – ${(s.title || '').slice(0, 30)}`, action: () => R.insertCitation(s.id) }));
    WX.ui.menu(anchor, [...items, items.length ? { sep: true } : null, { label: 'Add new source…', icon: 'plus', action: R.sourcesDialog }].filter(Boolean));
  };
  R.insertCitation = function (id) { const s = meta().sources.find((x) => x.id === id); if (!s) return; E().insertInline(el('span', { class: 'wx-cite', 'data-src': id, text: cite(s, meta().citationStyle) })); };
  R.updateCitations = function () { const m = meta(); q('.wx-cite').forEach((c) => { const s = m.sources.find((x) => x.id === c.dataset.src); if (s) c.textContent = cite(s, m.citationStyle); }); const b = q('.wx-bib')[0]; if (b) buildBib(b); };
  function buildBib(box) {
    const m = meta(), st = m.citationStyle; const title = st === 'MLA' ? 'Works Cited' : st === 'Chicago' ? 'Bibliography' : 'References';
    box.innerHTML = `<h2>${title}</h2>`; m.sources.slice().sort((a, b) => lastName(a.author).localeCompare(lastName(b.author))).forEach((s) => box.append(el('p', { style: { marginLeft: '36px', textIndent: '-36px' }, html: bibEntry(s, st) })));
  }
  R.insertBibliography = function () {
    if (!meta().sources.length) { WX.ui.toast('Add sources first.'); return R.sourcesDialog(); }
    const ex = q('.wx-bib')[0]; if (ex) { buildBib(ex); return E().changed({ immediate: true }); }
    const box = el('div', { class: 'wx-bib' }); E().insertBlock(box); buildBib(box); E().changed({ immediate: true });
  };

  /* ---------- captions & cross references ---------- */
  R.insertCaption = async function (label, where) {
    if (!E().isEditable()) return; E().restore(); const saved = E().saveSel(); const text = await WX.ui.prompt('Insert caption', `${label} caption text:`, ''); if (text == null) return; E().loadSel(saved);
    const obj = WX.images.selected(); const r = E().range(); let anchor = obj ? E().topBlock(obj) : r && E().topBlock(r.startContainer);
    if (!obj && label === 'Table' && r) { const t = (r.startContainer.nodeType === 3 ? r.startContainer.parentElement : r.startContainer).closest('table'); if (t) anchor = t; }
    const p = el('p', { class: 'wx-caption' }, label + ' ', el('span', { class: 'wx-seq', 'data-label': label, id: WX.util.uid('cap'), text: '0' }), ': ' + text);
    E().run(() => { if (!anchor) E().el.append(p); else (where === 'above' ? anchor.before(p) : anchor.after(p)); });
    R.renumberCaptions(); E().changed({ immediate: true });
  };
  R.renumberCaptions = function () { const n = {}; q('.wx-seq').forEach((s) => { const l = s.dataset.label; n[l] = (n[l] || 0) + 1; if (s.textContent !== String(n[l])) s.textContent = String(n[l]); }); q('a.wx-xref[data-kind="cap"]').forEach((a) => { const t = document.getElementById(a.dataset.target); const s = E().el.querySelector('[id="' + a.dataset.target + '"]'); if (s) a.textContent = s.dataset.label + ' ' + s.textContent; }); };
  R.crossRefDialog = function () {
    if (!E().isEditable()) return; E().restore(); const saved = E().saveSel(); const items = [];
    headings(4).forEach((h) => items.push({ kind: 'head', id: ensureId(h), text: h.textContent.trim(), group: 'Heading' }));
    q('a.wx-bookmark[id]').forEach((b) => items.push({ kind: 'bm', id: b.id, text: b.id, group: 'Bookmark' }));
    q('.wx-seq').forEach((s) => items.push({ kind: 'cap', id: s.id, text: s.dataset.label + ' ' + s.textContent, group: s.dataset.label }));
    if (!items.length) return WX.ui.toast('Nothing to refer to yet – add headings, bookmarks or captions first.');
    let pick = items[0]; const box = el('div', { class: 'list-box' }); const as = el('select', { class: 'input' }, [['text', 'Text / label'], ['page', 'Page number']].map(([v, l]) => el('option', { value: v, text: l })));
    items.forEach((it, i) => box.append(el('div', { class: 'list-row' + (i ? '' : ' sel'), html: `<span class="chip">${esc(it.group)}</span> ${esc(it.text)}`, onclick: (ev) => { pick = it; box.querySelectorAll('.list-row').forEach((r) => r.classList.remove('sel')); ev.currentTarget.classList.add('sel'); } })));
    WX.ui.dialog({ title: 'Cross-reference', width: '480px', body: el('div', { class: 'form' }, box, el('label', null, 'Insert reference to', as)), buttons: [{ label: 'Cancel' }, { label: 'Insert', primary: true, onClick: () => { E().loadSel(saved); const t = E().el.querySelector('[id="' + pick.id + '"]'); const txt = as.value === 'page' && t ? 'page ' + pageLabel(t) : pick.text; E().insertInline(el('a', { class: 'wx-xref', href: '#' + pick.id, 'data-target': pick.id, 'data-kind': pick.kind, text: txt })); } }] });
  };

  /* ---------- index ---------- */
  R.markEntry = async function () {
    if (!E().isEditable()) return; E().restore(); const r = E().range(); if (!r) return; const saved = E().saveSel(); const sel = r.toString().trim();
    const entry = await WX.ui.prompt('Mark index entry', 'Index entry:', sel); if (!entry) return; E().loadSel(saved);
    const rr = E().range(); if (rr.collapsed) E().insertInline(el('span', { class: 'wx-idx', 'data-entry': entry, text: entry })); else E().run(() => WX.review.wrapRange(rr, 'span', { class: 'wx-idx', 'data-entry': entry }));
  };
  function buildIndex(box) {
    const map = {}; q('.wx-idx').forEach((s) => { const k = s.dataset.entry.trim(); (map[k] = map[k] || new Set()).add(pageLabel(s)); });
    box.innerHTML = '<span class="toc-h">Index</span>'; const keys = Object.keys(map).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })); let cur = '';
    if (!keys.length) box.append(el('p', { text: 'No index entries. Select text and choose “Mark Entry”.' }));
    keys.forEach((k) => { const L = k[0].toUpperCase(); if (L !== cur) { cur = L; box.append(el('p', { html: `<strong>${esc(L)}</strong>`, style: { marginTop: '6px' } })); } box.append(el('p', { text: `${k}, ${Array.from(map[k]).join(', ')}` })); });
  }
  R.insertIndex = function () { const ex = q('.wx-index')[0]; if (ex) { buildIndex(ex); return E().changed({ immediate: true }); } const b = el('div', { class: 'wx-index wx-toc', contenteditable: 'false' }); E().insertBlock(b); WX.page.paginate(); buildIndex(b); E().changed({ immediate: true }); };

  /** Refresh every generated field. */
  R.updateAll = function (silent) {
    if (!E().doc) return; let ch = R.renumber(); R.renumberCaptions(); R.updateCitations(); WX.page.paginate();
    q('.wx-index').forEach(buildIndex); const toc = q('.wx-toc:not(.wx-index)'); toc.forEach(buildTOC); WX.page.paginate(); q('.wx-index').forEach(buildIndex); toc.forEach(buildTOC);
    E().changed({ immediate: true }); if (!silent) WX.ui.toast('Fields updated.', 'success');
  };
  R.init = function () {
    WX.bus.on('dirty', WX.util.debounce(() => { if (E().el.querySelector('.wx-fn,.wx-en,.wx-seq') && E().isEditable()) { const sel = E().saveSel(); if (R.renumber() || true) R.renumberCaptions(); E().loadSel(sel); } }, 900));
    WX.bus.on('click', (e) => { const m = e.target.closest && e.target.closest('sup.wx-fn,sup.wx-en'); if (m && !m.closest('.wx-notes')) { const p = E().el.querySelector(`.wx-notes p[data-note="${m.dataset.note}"]`); if (p) E().scrollTo(p); } });
  };
  Object.assign(WX.act, { insertTOC: R.insertTOC, updateTOC: R.updateTOC, removeTOC: R.removeTOC, footnote: () => R.insertNote('foot'), endnote: () => R.insertNote('end'), sources: R.sourcesDialog, bibliography: R.insertBibliography, caption: R.insertCaption, crossRef: R.crossRefDialog, markEntry: R.markEntry, insertIndex: R.insertIndex, updateFields: () => R.updateAll() });
})();
