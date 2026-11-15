/* WordX – document-manager.js
 * Document lifecycle: tabs, open/new/save/save-as/rename/duplicate/delete/pin, autosave,
 * crash recovery, version history, sharing UI, import dialogs and the Home dashboard. */
(function () {
  'use strict';
  const WX = window.WX; const { el, esc, icon, fmtDate, $ } = WX.util; const E = () => WX.editor; const ui = WX.ui;
  const D = (WX.docs = { open: [], cur: null, view: 'grid', nav: 'home', query: '' });
  const REC_KEY = 'wordx-recovery';
  const ACCEPT = '.docx,.pdf,.txt,.md,.html,.htm,.wordx,.json';
  let metas = [];

  /* ---------- helpers ---------- */
  function normalize(d) {
    d.settings = Object.assign(E().defaultSettings(), d.settings || {}); const ds = E().defaultSettings();
    d.settings.page = Object.assign({}, ds.page, d.settings.page); d.settings.hf = Object.assign({}, ds.hf, d.settings.hf);
    d.meta = Object.assign(E().defaultMeta(), d.meta || {}); d.shared = d.shared || []; return d;
  }
  D.make = function (o) {
    o = o || {}; const now = Date.now();
    return normalize({ id: WX.util.uid('doc'), title: (o.title || 'Untitled document').slice(0, 120), content: o.content || '<p><br></p>', settings: o.settings, meta: o.meta, created: now, modified: now, pinned: false });
  };
  function stats(d) {
    const tmp = document.createElement('div'); tmp.innerHTML = d.content; tmp.querySelectorAll('del.wx-del').forEach((n) => n.remove());
    const txt = (tmp.innerText || tmp.textContent || '').replace(/​/g, ''); d.words = (txt.match(/\S+/g) || []).length;
    if (D.cur === d) d.pages = WX.page.pages || 1;
    d.preview = d.content.slice(0, 6000);
  }
  const setStatus = (t, cls) => { const s = $('#save-status'); if (!s) return; s.textContent = t; s.className = cls || ''; };
  const dirtyAny = () => D.open.some((d) => d.dirty);

  /* ---------- persistence ---------- */
  D.persist = async function (d, opts) {
    opts = opts || {}; if (d === D.cur) E().commit(); stats(d);
    if (opts.touch !== false) d.modified = Date.now();
    const copy = {}; Object.keys(d).forEach((k) => { if (k[0] !== '_' && k !== 'dirty' && k !== 'lastEdit') copy[k] = d[k]; });
    await WX.storage.putDoc(copy); d.dirty = false; d._lastSave = Date.now();
    if (opts.version) await WX.storage.addVersion(d.id, d.content, opts.version);
    if (D.cur && D.cur.id === d.id) { try { const r = JSON.parse(localStorage.getItem(REC_KEY) || 'null'); if (r && r.id === d.id) localStorage.removeItem(REC_KEY); } catch (e) { /* ignore */ } }
    return copy;
  };
  D.save = async function (manual) {
    const d = D.cur; if (!d) return; setStatus('Saving...', 'saving');
    try {
      const auto = !manual; const needVersion = manual || !d._lastVer || Date.now() - d._lastVer > 5 * 60e3;
      await D.persist(d, { version: needVersion && d.content.length > 20 ? (manual ? 'Manual save' : 'Autosave') : null }); if (needVersion) d._lastVer = Date.now();
      setStatus('Saved.'); renderTabs(); if (manual) ui.toast(WX.storage.volatile ? 'Saved to memory only – this browser blocks permanent storage.' : 'Document saved.', WX.storage.volatile ? 'warn' : 'success');
      if (!auto) WX.bus.emit('saved', d);
    } catch (e) { console.error(e); setStatus('Unsaved changes', 'dirty'); ui.toast('Save failed: ' + (e && e.message || e), 'error'); }
  };
  let autoT = null, recT = null;
  function onDirty(d) {
    setStatus('Unsaved changes', 'dirty'); renderTabs(); clearTimeout(autoT); autoT = setTimeout(() => { if (D.cur && D.cur.dirty) D.save(false); }, 2000);
    clearTimeout(recT); recT = setTimeout(writeRecovery, 700);
  }
  function writeRecovery() {
    const d = D.cur; if (!d || !d.dirty) return;
    try { E().commit(); localStorage.setItem(REC_KEY, JSON.stringify({ id: d.id, title: d.title, content: d.content, settings: d.settings, meta: d.meta, created: d.created, ts: Date.now() })); } catch (e) { /* quota – autosave to IndexedDB still runs */ }
  }
  D.checkRecovery = async function () {
    let r = null; try { r = JSON.parse(localStorage.getItem(REC_KEY) || 'null'); } catch (e) { /* ignore */ } if (!r) return;
    const stored = await WX.storage.getDoc(r.id); if (stored && stored.modified >= r.ts && stored.content === r.content) { localStorage.removeItem(REC_KEY); return; }
    const ok = await ui.confirm(`WordX found unsaved changes to “${r.title}” from ${fmtDate(r.ts)} (the browser was closed before saving). Recover them?`, 'Recover');
    localStorage.removeItem(REC_KEY); if (!ok) return;
    const d = normalize({ id: stored ? WX.util.uid('doc') : r.id, title: r.title + (stored ? ' (recovered)' : ''), content: WX.util.sanitize(r.content), settings: r.settings, meta: r.meta, created: r.created || r.ts, modified: Date.now() });
    await WX.storage.putDoc(d); await D.openDoc(d.id); ui.toast('Document recovered.', 'success');
  };
  window.addEventListener('beforeunload', (e) => { if (dirtyAny()) { writeRecovery(); if (D.cur) { try { E().commit(); } catch (x) { /* ignore */ } } e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && D.cur && D.cur.dirty) { writeRecovery(); D.save(false); } });

  /* ---------- tabs & screens ---------- */
  function renderTabs() {
    const host = $('#doc-tabs'); if (!host) return; host.innerHTML = '';
    D.open.forEach((d) => {
      const t = el('div', { class: 'doc-tab' + (d === D.cur ? ' active' : ''), role: 'tab', tabindex: 0, 'aria-selected': d === D.cur, title: d.title, onclick: () => D.switchTo(d), ondblclick: () => D.rename(d.id),
        onkeydown: (e) => { if (e.key === 'Enter') D.switchTo(d); }, onauxclick: (e) => { if (e.button === 1) D.closeTab(d); } },
      d.dirty ? el('span', { class: 'dot', title: 'Unsaved changes' }) : null, el('span', { class: 't', text: d.title }),
      el('button', { class: 'x', 'aria-label': 'Close tab', html: icon('x', 12), onclick: (e) => { e.stopPropagation(); D.closeTab(d); } }));
      host.append(t);
    });
    const a = host.querySelector('.active'); if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    document.title = (D.cur ? D.cur.title + ' – ' : '') + 'WordX';
  }
  function showScreen(s) { document.body.dataset.screen = s; }
  D.showEditor = () => showScreen('editor');
  D.showHome = async function () { if (D.cur && D.cur.dirty) await D.save(false); showScreen('home'); document.title = 'WordX'; await D.renderHome(); };

  D.switchTo = async function (d) {
    if (D.cur === d && document.body.dataset.screen === 'editor') return;
    if (D.cur && D.cur !== d && D.cur.dirty) await D.save(false);
    if (D.cur) { try { E().commit(); D.cur._scroll = $('#canvas-scroll').scrollTop; } catch (e) { /* ignore */ } }
    D.cur = d; showScreen('editor'); E().load(d); renderTabs(); setStatus(d.dirty ? 'Unsaved changes' : 'Saved.', d.dirty ? 'dirty' : '');
    requestAnimationFrame(() => { $('#canvas-scroll').scrollTop = d._scroll || 0; if (WX.state.autoFit) WX.page.fit && WX.page.fit(); });
    WX.bus.emit('docswitched', d);
  };
  D.add = async function (d, persist) { if (persist !== false) await WX.storage.putDoc(d); D.open.push(d); await D.switchTo(d); return d; };
  D.newDoc = async function (opts) { const d = D.make(opts); await D.add(d); setTimeout(() => { E().el.focus(); E().caretIn && E().caretIn(E().el.firstChild); }, 60); return d; };
  D.fromTemplate = async function (id) { const t = WX.templates.make(id); if (!t) return ui.toast('Template not found.', 'error'); const d = D.make(t); await D.add(d); ui.toast('Created from template “' + t.title + '”.'); };
  D.openDoc = async function (id) {
    const ex = D.open.find((d) => d.id === id); if (ex) return D.switchTo(ex);
    try { const raw = await WX.storage.getDoc(id); if (!raw) return ui.toast('That document no longer exists.', 'error'); await D.add(normalize(raw), false); }
    catch (e) { console.error(e); ui.toast('Could not open document: ' + e.message, 'error'); }
  };
  D.closeTab = async function (d) {
    d = d || D.cur; if (!d) return; if (d.dirty) { if (d === D.cur) E().commit(); await D.persist(d); }
    const i = D.open.indexOf(d); D.open.splice(i, 1);
    if (D.cur === d) { D.cur = null; if (D.open.length) await D.switchTo(D.open[Math.min(i, D.open.length - 1)]); else { E().doc = null; await D.showHome(); } } renderTabs();
  };

  /* ---------- document actions ---------- */
  D.rename = async function (id) {
    const open = D.open.find((d) => d.id === id); const cur = open || await WX.storage.getDoc(id); if (!cur) return;
    const n = await ui.prompt('Rename document', 'Document name', cur.title); if (n == null) return; const t = n.trim().slice(0, 120); if (!t || t === cur.title) return;
    cur.title = t; if (open) { open.dirty = true; await D.persist(open); renderTabs(); WX.page.schedule(); setStatus('Saved.'); } else { cur.modified = Date.now(); await WX.storage.putDoc(cur); }
    if (document.body.dataset.screen === 'home') D.renderHome();
  };
  D.saveAs = async function () {
    const d = D.cur; if (!d) return; E().commit(); const n = await ui.prompt('Save a copy', 'Name for the copy', d.title + ' – copy'); if (n == null || !n.trim()) return;
    const c = D.make({ title: n.trim(), content: d.content, settings: JSON.parse(JSON.stringify(d.settings)), meta: JSON.parse(JSON.stringify(d.meta)) }); await D.add(c); ui.toast('Saved as “' + c.title + '”.', 'success');
  };
  D.duplicate = async function (id, openIt) {
    const open = D.open.find((x) => x.id === id); if (open && open === D.cur) E().commit(); const src = open || await WX.storage.getDoc(id); if (!src) return;
    const c = D.make({ title: src.title + ' (copy)', content: src.content, settings: JSON.parse(JSON.stringify(src.settings)), meta: JSON.parse(JSON.stringify(src.meta || {})) });
    if (openIt || (D.cur && D.cur.id === id && document.body.dataset.screen === 'editor')) await D.add(c); else { stats(c); await WX.storage.putDoc(c); D.renderHome(); } ui.toast('Document duplicated.', 'success');
  };
  D.remove = async function (id) {
    const m = metas.find((x) => x.id === id); const title = (D.open.find((d) => d.id === id) || m || {}).title || 'this document';
    if (!(await ui.confirm(`Delete “${title}”? This permanently removes it and its version history.`, 'Delete', true))) return;
    const o = D.open.find((d) => d.id === id); if (o) { o.dirty = false; D.open.splice(D.open.indexOf(o), 1); if (D.cur === o) { D.cur = null; E().doc = null; } }
    await WX.storage.deleteDoc(id); try { const r = JSON.parse(localStorage.getItem(REC_KEY) || 'null'); if (r && r.id === id) localStorage.removeItem(REC_KEY); } catch (e) { /* ignore */ }
    ui.toast('Document deleted.'); if (!D.cur) { if (D.open.length) await D.switchTo(D.open[0]); else await D.showHome(); } else renderTabs(); if (document.body.dataset.screen === 'home') D.renderHome();
  };
  D.pin = async function (id) {
    const o = D.open.find((d) => d.id === id); const d = o || await WX.storage.getDoc(id); if (!d) return; d.pinned = !d.pinned;
    if (o) await D.persist(o, { touch: false }); else await WX.storage.putDoc(d); ui.toast(d.pinned ? 'Pinned to the top.' : 'Unpinned.'); if (document.body.dataset.screen === 'home') D.renderHome();
  };
  D.exportDoc = async function (id, kind) {
    const o = D.open.find((d) => d.id === id);
    if (kind === 'pdf' || kind === 'print') { if (!o || o !== D.cur) { await D.openDoc(id); await new Promise((r) => setTimeout(r, 400)); } return WX.export.run(kind); }
    const d = o || await WX.storage.getDoc(id); if (!d) return; normalize(d); return WX.export.run(kind, d);
  };

  /* ---------- version history ---------- */
  D.versions = async function () {
    const d = D.cur; if (!d) return; E().commit(); const list = await WX.storage.listVersions(d.id); const body = el('div');
    body.append(el('p', { class: 'muted', text: 'Snapshots are taken on every manual save and about every five minutes while you work (last 20 kept).' }));
    const box = el('div', { class: 'ver-list' }); body.append(box);
    if (!list.length) box.append(el('div', { class: 'empty', html: '<b>No versions yet</b>Press Ctrl+S to save a snapshot.' }));
    list.forEach((v) => { const tmp = document.createElement('div'); tmp.innerHTML = v.content; const w = ((tmp.textContent || '').match(/\S+/g) || []).length;
      box.append(el('div', { class: 'ver-row', style: { display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' } }, el('div', { style: { flex: 1 } }, el('b', { text: new Date(v.ts).toLocaleString() }), el('div', { class: 'muted', text: `${v.label || 'Snapshot'} · ${w} words` })),
        el('button', { class: 'btn small', text: 'Restore', onclick: async () => { if (!(await ui.confirm('Replace the current content with this version? You can undo with Ctrl+Z.', 'Restore'))) return; E().pushHistory(); E().el.innerHTML = v.content; E().normalize(); E().changed({ immediate: true }); WX.page.paginate(); dlg.close(); ui.toast('Version restored.', 'success'); } }),
        el('button', { class: 'btn small', text: 'Open as copy', onclick: async () => { dlg.close(); const c = D.make({ title: d.title + ' (version ' + new Date(v.ts).toLocaleDateString() + ')', content: v.content, settings: JSON.parse(JSON.stringify(d.settings)) }); await D.add(c); } }))); });
    const dlg = ui.dialog({ title: 'Version history', body, width: '560px', buttons: [{ label: 'Save version now', onClick: async () => { await D.save(true); dlg.close(); } }, { label: 'Close', primary: true }] });
  };

  /* ---------- share (local-only until a backend is configured) ---------- */
  D.share = async function () {
    const d = D.cur; if (!d) return; const body = el('div', { class: 'form' }); const list = el('div'); const email = el('input', { class: 'input', type: 'email', placeholder: 'name@example.com' }); const role = el('select', { class: 'input' }, el('option', { value: 'edit', text: 'Can edit' }), el('option', { value: 'comment', text: 'Can comment' }), el('option', { value: 'view', text: 'Can view' }));
    const draw = () => { list.innerHTML = ''; (d.shared || []).forEach((s, i) => list.append(el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 0' } }, el('span', { style: { flex: 1 }, text: s.email + ' – ' + { edit: 'can edit', comment: 'can comment', view: 'can view' }[s.role] }), el('button', { class: 'icon-btn', 'aria-label': 'Remove', html: icon('x', 14), onclick: () => { d.shared.splice(i, 1); d.dirty = true; E().changed(); draw(); } })))); if (!(d.shared || []).length) list.append(el('div', { class: 'muted', text: 'Not shared with anyone yet.' })); };
    body.append(el('div', { class: 'shared-note', html: icon('info', 18) + '<div>Live collaboration needs a sync server, and none is configured in this offline build. Collaborators you add are recorded on this document so the list is ready when a backend is connected. To share now, send them a file below.</div>' }),
      el('div', { class: 'side-row', style: { display: 'flex', gap: '8px' } }, email, role, el('button', { class: 'btn', text: 'Add', onclick: () => { const v = email.value.trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return ui.toast('Enter a valid email address.', 'error'); d.shared = d.shared || []; if (d.shared.some((s) => s.email === v)) return ui.toast('Already added.'); d.shared.push({ email: v, role: role.value, added: Date.now() }); d.dirty = true; E().changed(); email.value = ''; draw(); } })), list,
      el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' } }, el('button', { class: 'btn', text: 'Download .docx', onclick: () => WX.export.run('docx') }), el('button', { class: 'btn', text: 'Download PDF', onclick: () => WX.export.run('pdf') }), el('button', { class: 'btn', text: 'Download .wordx', onclick: () => WX.export.run('wordx') }), el('button', { class: 'btn', text: 'Copy plain text', onclick: async () => { try { await navigator.clipboard.writeText(WX.review.docText()); ui.toast('Text copied.', 'success'); } catch (e) { ui.toast('Clipboard blocked by the browser.', 'error'); } } })));
    draw(); ui.dialog({ title: 'Share “' + d.title + '”', body, width: '520px', buttons: [{ label: 'Done', primary: true }] });
  };

  /* ---------- import ---------- */
  D.importFile = async function (file) {
    ui.toast('Opening ' + file.name + '…', null, 2500);
    try {
      const r = await WX.fileio.parse(file);
      if (r.backup) { if (await ui.confirm(`Restore ${r.backup.docs.length} document(s) from this backup? Existing documents are kept; restored ones are added as copies if the id exists.`, 'Restore')) { const n = await WX.storage.importAll(r.backup); ui.toast(`Restored ${n} document(s).`, 'success'); D.renderHome(); } return; }
      const d = D.make({ title: r.title, content: r.content, settings: r.settings, meta: r.meta }); await D.add(d);
      ui.toast(r.note || (r.warnings ? `Opened with ${r.warnings} conversion warning(s).` : 'Document opened.'), r.note || r.warnings ? 'warn' : 'success', 5000);
    } catch (e) { console.error(e); ui.toast(e.message || 'Could not open that file.', 'error', 6000); }
  };
  D.openFileDialog = async function () { const files = await WX.util.pickFile(ACCEPT, true); for (const f of files) await D.importFile(f); };
  function dropInit() {
    const hint = $('#drop-hint'); let n = 0; const has = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    window.addEventListener('dragenter', (e) => { if (has(e)) { n++; hint.hidden = false; } });
    window.addEventListener('dragleave', (e) => { if (has(e) && --n <= 0) { n = 0; hint.hidden = true; } });
    window.addEventListener('dragover', (e) => { if (has(e)) e.preventDefault(); });
    window.addEventListener('drop', async (e) => { n = 0; hint.hidden = true; if (!has(e)) return; const files = Array.from(e.dataTransfer.files); const docs = files.filter((f) => !/^image\//.test(f.type)); if (e.target.closest && e.target.closest('#editor') && !docs.length) return; e.preventDefault(); if (!docs.length) return ui.toast('Drop a .docx, .pdf, .txt, .md or .html file to open it.'); for (const f of docs) await D.importFile(f); }, true);
  }

  /* ---------- home dashboard ---------- */
  function thumb(html, tplCss) {
    const box = el('div', { class: 'doc-thumb' }); const pg = el('div', { class: 'thumb-page', html: WX.util.sanitize(html || '') }); box.append(pg);
    requestAnimationFrame(() => { const w = box.clientWidth || 168; pg.style.transform = `scale(${w / 794})`; }); return box;
  }
  function cardMenu(anchor, m) {
    const kinds = [['docx', 'Word (.docx)'], ['pdf', 'PDF'], ['html', 'Web page (.html)'], ['txt', 'Plain text'], ['wordx', 'WordX (.wordx)']];
    ui.menu(anchor, [{ label: 'Open', icon: 'file-text', action: () => D.openDoc(m.id) }, { label: 'Rename', icon: 'pencil', action: () => D.rename(m.id) }, { label: 'Duplicate', icon: 'copy', action: () => D.duplicate(m.id) }, { label: m.pinned ? 'Unpin' : 'Pin', icon: 'pin', action: () => D.pin(m.id) },
      { label: 'Download as', icon: 'download', children: kinds.map(([k, l]) => ({ label: l, action: () => D.exportDoc(m.id, k) })) }, { sep: true }, { label: 'Delete', icon: 'trash-2', action: () => D.remove(m.id) }]);
  }
  function card(m) {
    const c = el('div', { class: 'doc-card', tabindex: 0, role: 'button', 'aria-label': 'Open ' + m.title, onclick: () => D.openDoc(m.id), onkeydown: (e) => { if (e.key === 'Enter') D.openDoc(m.id); }, oncontextmenu: (e) => { e.preventDefault(); cardMenu({ getBoundingClientRect: () => ({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY, width: 0, height: 0 }) }, m); } });
    c.append(thumb(m.preview)); if (m.pinned) c.append(el('span', { class: 'doc-pin', html: icon('pin', 12), title: 'Pinned' }));
    c.append(el('div', { class: 'doc-meta' }, el('div', { class: 'doc-title', text: m.title }), el('div', { class: 'doc-sub' }, el('span', { text: fmtDate(m.modified) }), el('span', { text: '· ' + m.words + ' words' }))));
    const more = el('button', { class: 'icon-btn doc-more', 'aria-label': 'More actions', html: icon('more-vertical', 16), onclick: (e) => { e.stopPropagation(); cardMenu(more, m); } }); c.append(more); return c;
  }
  function listView(items) {
    const t = el('table', { class: 'doc-list' }, el('tbody')); items.forEach((m) => { const more = el('button', { class: 'icon-btn', 'aria-label': 'More actions', html: icon('more-vertical', 16), onclick: (e) => { e.stopPropagation(); cardMenu(more, m); } });
      t.firstChild.append(el('tr', { onclick: () => D.openDoc(m.id) }, el('td', { html: icon('file-text', 16) }), el('td', { text: m.title + (m.pinned ? ' 📌' : ''), style: { fontWeight: 600 } }), el('td', { class: 'muted', text: fmtDate(m.modified) }), el('td', { class: 'muted', text: m.words + ' words · ' + m.pages + ' pg' }), el('td', null, more))); }); return t;
  }
  D.renderHome = async function () {
    try { metas = await WX.storage.listMeta(); } catch (e) { metas = []; ui.toast('Could not read documents: ' + e.message, 'error'); }
    D.open.forEach((d) => { const m = metas.find((x) => x.id === d.id); if (m && d.dirty) { m.title = d.title; } });
    const nav = $('#home-nav-items'); nav.innerHTML = '';
    const cnt = { home: metas.length, pinned: metas.filter((m) => m.pinned).length, shared: metas.filter((m) => (m.shared || []).length).length };
    [['home', 'Home', 'home'], ['recent', 'Recent', 'clock'], ['pinned', 'Pinned', 'pin'], ['shared', 'Shared', 'users']].forEach(([id, label, ic]) => nav.append(el('button', { class: 'nav-item' + (D.nav === id ? ' active' : ''), onclick: () => { D.nav = id; D.renderHome(); closeMobileNav(); } }, el('span', { html: icon(ic, 18) }), label, cnt[id] != null ? el('span', { class: 'count', text: cnt[id] }) : null)));
    const host = $('#home-content'); host.innerHTML = '';
    const q = D.query.trim().toLowerCase(); let items = metas.slice();
    if (q) items = items.filter((m) => m.title.toLowerCase().includes(q) || (m.preview || '').replace(/<[^>]+>/g, ' ').toLowerCase().includes(q));
    if (D.nav === 'pinned') items = items.filter((m) => m.pinned); if (D.nav === 'shared') items = items.filter((m) => (m.shared || []).length);
    items.sort((a, b) => (D.nav === 'home' && !q ? (b.pinned - a.pinned) : 0) || b.modified - a.modified);
    if (D.nav === 'home' && !q) {
      const tpl = el('div', { class: 'tpl-row' }); const blank = el('button', { class: 'tpl-card blank', onclick: () => D.newDoc() }, el('div', { class: 'tpl-thumb', html: icon('plus', 44) }), el('div', { class: 'tpl-name', text: 'Blank document' })); tpl.append(blank);
      WX.templates.list.forEach((t) => { let html = ''; try { html = t.build().content; } catch (e) { /* ignore */ } tpl.append(el('button', { class: 'tpl-card', onclick: () => D.fromTemplate(t.id) }, (() => { const b = thumb(html); b.className = 'tpl-thumb'; b.style.height = '200px'; return b; })(), el('div', { class: 'tpl-name', text: t.name }))); });
      host.append(el('section', { class: 'h-section' }, el('h2', { text: 'Start a new document' }), tpl));
      const dz = el('div', { class: 'drop-zone' }, el('span', { html: icon('upload', 28) }), el('div', { style: { flex: 1 } }, el('b', { text: 'Open or upload a file' }), el('div', { class: 'muted', text: 'Drop .docx, .pdf, .txt, .md, .html or .wordx files here, or browse.' })), el('button', { class: 'btn primary', text: 'Browse files', onclick: D.openFileDialog }));
      dz.addEventListener('dragover', () => dz.classList.add('over')); dz.addEventListener('dragleave', () => dz.classList.remove('over')); dz.addEventListener('drop', () => dz.classList.remove('over')); host.append(el('section', { class: 'h-section' }, dz));
    }
    const titles = { home: 'Your documents', recent: 'Recent', pinned: 'Pinned documents', shared: 'Shared documents' };
    const tg = el('div', { class: 'view-toggle' }, ['grid', 'list'].map((v) => el('button', { class: 'icon-btn' + (D.view === v ? ' active' : ''), 'aria-label': v + ' view', 'aria-pressed': D.view === v, html: icon(v === 'grid' ? 'layout-grid' : 'list', 18), onclick: () => { D.view = v; WX.storage.setSetting('homeView', v); D.renderHome(); } })));
    const sec = el('section', { class: 'h-section' }, el('h2', null, q ? `Results for “${D.query}”` : titles[D.nav], el('span', { class: 'sub', text: items.length + (items.length === 1 ? ' document' : ' documents') }), tg));
    if (D.nav === 'shared') sec.append(el('div', { class: 'shared-note', html: icon('info', 18) + '<div>Documents you add collaborators to appear here. Receiving documents from others requires a sync server, which is not configured in this offline build.</div>' }));
    if (!items.length) sec.append(el('div', { class: 'empty', html: `<b>${q ? 'No matching documents' : D.nav === 'home' || D.nav === 'recent' ? 'No documents yet' : 'Nothing here yet'}</b>${q ? 'Try different words.' : D.nav === 'pinned' ? 'Use “Pin” in a document’s menu to keep it here.' : D.nav === 'shared' ? 'Use File → Share inside a document.' : 'Create one from a template above.'}` }));
    else if (D.view === 'list') sec.append(listView(items)); else sec.append(el('div', { class: 'doc-grid' }, items.map(card)));
    host.append(sec);
  };
  function closeMobileNav() { document.body.classList.remove('home-nav-open'); }

  D.initHome = function () {
    $('#home-new').innerHTML = icon('plus', 20) + '<span>New document</span>'; $('#home-new').onclick = () => D.newDoc();
    $('#home-open').innerHTML = icon('folder-open', 18) + '<span>Open file</span>'; $('#home-open').onclick = D.openFileDialog;
    $('#home-search-ic').innerHTML = icon('search', 16); let t; $('#home-search').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { D.query = e.target.value; D.renderHome(); }, 120); });
    $('#home-backup').innerHTML = icon('database', 18) + '<span>Backup all</span>';
    $('#home-backup').onclick = async () => { try { const b = await WX.storage.exportAll(); if (!b.docs.length) return ui.toast('There are no documents to back up.'); WX.util.download(new Blob([JSON.stringify(b)], { type: 'application/json' }), 'wordx-backup-' + new Date().toISOString().slice(0, 10) + '.wordx'); ui.toast(`Backed up ${b.docs.length} document(s). Restore by opening the file.`, 'success'); } catch (e) { ui.toast('Backup failed: ' + e.message, 'error'); } };
    $('#home-menu-btn').innerHTML = icon('menu', 20); $('#home-menu-btn').onclick = () => document.body.classList.toggle('home-nav-open');
    WX.storage.getSetting('homeView', 'grid').then((v) => { D.view = v; });
  };

  D.init = async function () {
    D.initHome(); dropInit(); WX.bus.on('dirty', onDirty);
    WX.bus.on('paginated', () => { if (D.cur) D.cur.pages = WX.page.pages; });
    $('#btn-home').onclick = () => D.showHome(); $('#btn-newtab').onclick = () => D.newDoc(); $('#btn-save').onclick = () => D.save(true);
    $('#btn-newtab').innerHTML = icon('plus', 16); $('#btn-home').innerHTML = icon('home', 18); $('#btn-save').innerHTML = icon('save', 18);
    setInterval(() => { if (D.cur && D.cur.dirty && Date.now() - (D.cur.lastEdit || 0) > 4000) D.save(false); }, 15000);
    await WX.storage.open(); if (WX.storage.volatile) ui.toast('Permanent storage is unavailable in this browser mode – documents will be lost when the tab closes. Use Download to keep them.', 'warn', 9000);
    showScreen('home'); await D.renderHome(); await D.checkRecovery();
  };
  Object.assign(WX.act, { newDoc: () => D.newDoc(), openFile: () => D.openFileDialog(), save: () => D.save(true), saveAs: () => D.saveAs(), rename: () => D.cur && D.rename(D.cur.id), duplicate: () => D.cur && D.duplicate(D.cur.id, true), deleteDoc: () => D.cur && D.remove(D.cur.id), pinDoc: () => D.cur && D.pin(D.cur.id), versions: () => D.versions(), share: () => D.share(), goHome: () => D.showHome(), closeTab: () => D.closeTab() });
})();
