/* WordX – review.js
 * Statistics (word/char count, reading time, readability), comments, track changes
 * (accept / reject / navigate), document comparison and document protection. */
(function () {
  'use strict';
  const WX = window.WX; const { el, esc, icon } = WX.util; const E = () => WX.editor;
  const V = (WX.review = {});
  const q = (s) => Array.from(E().el.querySelectorAll(s));
  const author = () => WX.state.userName || 'You';

  /* ---------- statistics ---------- */
  const syl = (w) => { w = w.toLowerCase().replace(/[^a-z]/g, ''); if (w.length <= 3) return w ? 1 : 0; w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, ''); const m = w.match(/[aeiouy]{1,2}/g); return m ? m.length : 1; };
  V.docText = () => { const c = E().cleanClone(); c.querySelectorAll('del.wx-del,.wx-notes sup').forEach((n) => n.remove()); const blocks = Array.from(c.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,td,th,pre,blockquote')); return blocks.length ? blocks.map((b) => b.textContent).join('\n') : c.textContent; };
  V.stats = function (text) {
    text = (text == null ? V.docText() : text).replace(/​/g, ''); const words = text.match(/[A-Za-z0-9À-ɏ][\w'’\-À-ɏ]*/g) || [];
    const sentences = (text.match(/[^.!?\n]+[.!?]+(\s|$)|[^.!?\n]+$/gm) || []).filter((s) => /\w/.test(s)); const paras = text.split('\n').filter((p) => p.trim());
    const syls = words.reduce((a, w) => a + syl(w), 0); const W = words.length || 1, S = Math.max(1, sentences.length);
    const flesch = 206.835 - 1.015 * (W / S) - 84.6 * (syls / W), grade = 0.39 * (W / S) + 11.8 * (syls / W) - 15.59;
    return { words: words.length, chars: text.replace(/\n/g, '').length, charsNoSpace: text.replace(/\s/g, '').length, paragraphs: paras.length, sentences: sentences.length, minutes: Math.max(words.length ? 1 : 0, Math.round(words.length / 200)), flesch: Math.max(0, Math.min(100, Math.round(flesch))), grade: Math.max(0, Math.round(grade * 10) / 10), avgWords: Math.round(W / S * 10) / 10, avgChars: Math.round(words.reduce((a, w) => a + w.length, 0) / W * 10) / 10 };
  };
  const level = (f) => f >= 90 ? 'Very easy' : f >= 80 ? 'Easy' : f >= 70 ? 'Fairly easy' : f >= 60 ? 'Plain English' : f >= 50 ? 'Fairly difficult' : f >= 30 ? 'Difficult' : 'Very difficult';
  V.updateStatus = function () {
    if (!E().doc) return; const sel = E().selectedText(); const s = V.stats(sel && sel.trim() ? sel : null); const d = E().doc; d.words = V.stats().words;
    document.getElementById('sb-words').textContent = (sel && sel.trim() ? `${s.words} of ${d.words} words` : `${d.words} word${d.words === 1 ? '' : 's'}`);
    document.getElementById('sb-page').textContent = `Page ${WX.page.currentPage()} of ${WX.page.pages}`;
    const tr = document.getElementById('sb-track'); if (tr) tr.hidden = !trackOn();
  };
  V.statsDialog = function () {
    const sel = E().selectedText().trim(); const s = V.stats(sel ? sel : null);
    const t = (l, v) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
    WX.ui.dialog({ title: sel ? 'Word count (selection)' : 'Word count', width: '460px', body: `<div class="stat-grid">${t('Pages', sel ? '–' : WX.page.pages)}${t('Words', s.words)}${t('Characters (no spaces)', s.charsNoSpace)}${t('Characters (with spaces)', s.chars)}${t('Paragraphs', s.paragraphs)}${t('Sentences', s.sentences)}${t('Reading time', s.minutes + ' min')}${t('Avg words / sentence', s.avgWords)}</div>`, buttons: [{ label: 'Close' }] });
  };
  V.readabilityDialog = function () {
    const s = V.stats(); WX.ui.dialog({ title: 'Readability statistics', width: '460px', body: `<div class="stat-grid"><div class="stat"><b>${s.flesch}</b><span>Flesch Reading Ease (${level(s.flesch)})</span></div><div class="stat"><b>${s.grade}</b><span>Flesch–Kincaid grade level</span></div><div class="stat"><b>${s.avgWords}</b><span>Words per sentence</span></div><div class="stat"><b>${s.avgChars}</b><span>Characters per word</span></div><div class="stat"><b>${s.sentences}</b><span>Sentences</span></div><div class="stat"><b>${s.words}</b><span>Words</span></div></div><p class="muted" style="margin-top:10px">Higher Reading Ease = easier text. Most business writing aims for 60–70.</p>`, buttons: [{ label: 'Close' }] });
  };

  /* ---------- wrap helper (comments, index marks) ---------- */
  V.wrapRange = function (range, tag, attrs) {
    const root = range.commonAncestorContainer.nodeType === 3 ? range.commonAncestorContainer.parentNode : range.commonAncestorContainer; const nodes = [];
    if (range.commonAncestorContainer.nodeType === 3) nodes.push(range.commonAncestorContainer); else { const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) if (range.intersectsNode(n) && n.data.length) nodes.push(n); }
    const made = []; nodes.forEach((n) => {
      let t = n; const a = n === range.startContainer ? range.startOffset : 0, b = n === range.endContainer ? range.endOffset : n.length; if (a >= b) return;
      if (b < t.length) t.splitText(b); if (a > 0) t = t.splitText(a);
      const w = el(tag, attrs); t.parentNode.insertBefore(w, t); w.appendChild(t); made.push(w);
    }); return made;
  };
  const unwrap = (n) => { const p = n.parentNode; if (!p) return; while (n.firstChild) p.insertBefore(n.firstChild, n); n.remove(); p.normalize(); };

  /* ---------- comments ---------- */
  const comments = () => { const d = E().doc; d.meta = d.meta || E().defaultMeta(); return d.meta.comments; };
  V.addComment = function () {
    let r = E().range(); if (!r) { E().restore(); r = E().range(); } if (!r) return;
    if (r.collapsed) { const s = E().sel(); s.modify('move', 'backward', 'word'); s.modify('extend', 'forward', 'word'); r = s.getRangeAt(0); if (r.collapsed) return WX.ui.toast('Select some text to comment on.'); }
    const id = WX.util.uid('c'); const quote = r.toString().slice(0, 120);
    E().ed_run ? 0 : 0; E().pushHistory(); V.wrapRange(r, 'span', { class: 'wx-comment', 'data-cid': id });
    comments().push({ id, text: '', quote, author: author(), time: Date.now(), resolved: false, replies: [] }); E().changed({ immediate: true });
    V.openPanel(id, true);
  };
  V.openPanel = function (focusId, edit) {
    WX.side.open('comments', 'Comments', (body) => {
      body.innerHTML = ''; const live = new Set(q('.wx-comment').map((s) => s.dataset.cid)); const d = E().doc; d.meta.comments = d.meta.comments.filter((c) => live.has(c.id)); const order = q('.wx-comment').map((s) => s.dataset.cid);
      const list = d.meta.comments.slice().sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      if (!list.length) body.append(el('div', { class: 'empty', html: '<b>No comments</b>Select text and choose “New comment”.' }));
      list.forEach((c) => {
        const card = el('div', { class: 'card' + (c.resolved ? ' resolved' : '') + (c.id === focusId ? ' active' : ''), 'data-cid': c.id });
        card.append(el('div', { html: `<span class="who">${esc(c.author)}</span> <span class="when">${WX.util.fmtDate(c.time)}</span>` }), el('div', { class: 'quote', text: c.quote }));
        const ta = el('textarea', { rows: 2, placeholder: 'Write a comment…' }); ta.value = c.text; ta.addEventListener('change', () => { c.text = ta.value; E().changed(); });
        card.append(ta);
        c.replies.forEach((r) => card.append(el('div', { style: { margin: '6px 0 0 10px', borderLeft: '2px solid var(--border-strong)', paddingLeft: '8px' }, html: `<span class="who">${esc(r.author)}</span> <span class="when">${WX.util.fmtDate(r.time)}</span><div>${esc(r.text)}</div>` })));
        const rep = el('input', { class: 'input', placeholder: 'Reply…', style: { width: '100%', marginTop: '6px' } }); rep.addEventListener('keydown', (e) => { if (e.key === 'Enter' && rep.value.trim()) { c.replies.push({ text: rep.value.trim(), author: author(), time: Date.now() }); E().changed(); V.openPanel(c.id); } }); card.append(rep);
        card.append(el('div', { class: 'acts' }, el('button', { class: 'btn small', text: c.resolved ? 'Reopen' : 'Resolve', onclick: () => { c.resolved = !c.resolved; q(`.wx-comment[data-cid="${c.id}"]`).forEach((s) => s.classList.toggle('resolved', c.resolved)); E().changed(); V.openPanel(c.id); } }), el('button', { class: 'btn small danger', text: 'Delete', onclick: () => { q(`.wx-comment[data-cid="${c.id}"]`).forEach(unwrap); d.meta.comments = d.meta.comments.filter((x) => x !== c); E().changed({ immediate: true }); V.openPanel(); } })));
        card.addEventListener('click', (e) => { if (e.target.closest('textarea,input,button')) return; const s = E().el.querySelector(`.wx-comment[data-cid="${c.id}"]`); if (s) E().scrollTo(s); q('.wx-comment').forEach((x) => x.classList.toggle('active', x.dataset.cid === c.id)); });
        body.append(card); if (edit && c.id === focusId) setTimeout(() => ta.focus(), 80);
      });
    });
  };
  V.deleteAllComments = function () { E().run(() => q('.wx-comment').forEach(unwrap)); E().doc.meta.comments = []; if (WX.side.current === 'comments') V.openPanel(); };

  /* ---------- track changes ---------- */
  const trackOn = () => { const d = E().doc; return !!(d && (d.settings.trackChanges || (d.settings.protect && d.settings.protect.mode === 'tracked' && !d._unlocked))); };
  V.trackOn = trackOn;
  V.toggleTrack = function () { const d = E().doc; if (d.settings.protect && d.settings.protect.mode === 'tracked' && !d._unlocked) return WX.ui.toast('Track Changes is locked by document protection.'); d.settings.trackChanges = !d.settings.trackChanges; E().changed(); WX.bus.emit('selection'); V.updateStatus(); WX.ui.toast('Track Changes ' + (d.settings.trackChanges ? 'on' : 'off')); };
  const mine = (n) => { const e = n.nodeType === 3 ? n.parentElement : n; const i = e && e.closest && e.closest('ins.wx-ins'); return !!(i && i.dataset.author === author()); };
  function markDelete(range) {
    const root = range.commonAncestorContainer.nodeType === 3 ? range.commonAncestorContainer.parentNode : range.commonAncestorContainer; const nodes = [];
    if (range.commonAncestorContainer.nodeType === 3) nodes.push(range.commonAncestorContainer); else { const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) if (range.intersectsNode(n) && n.data.length) nodes.push(n); }
    const phs = []; let first = null, last = null; const at = { class: 'wx-del', 'data-author': author(), 'data-time': new Date().toISOString() };
    nodes.forEach((n) => {
      if (n.parentElement.closest('del.wx-del') || n.parentElement.closest('.wx-obj,.wx-toc')) return;
      let t = n; const a = n === range.startContainer ? range.startOffset : 0, b = n === range.endContainer ? range.endOffset : n.length; if (a >= b) return;
      if (b < t.length) t.splitText(b); if (a > 0) t = t.splitText(a);
      if (mine(t)) { const p = t.parentNode; const ph = document.createComment(''); p.replaceChild(ph, t); phs.push(ph); if (!first) first = ph; last = ph; return; }
      const w = el('del', at); t.parentNode.insertBefore(w, t); w.appendChild(t); first = first || w; last = w;
    });
    return { first, last, phs };
  }
  const dropPh = (m) => { (m.phs || []).forEach((c) => c.remove()); };
  function onBefore(e) {
    if (!trackOn() || !E().isEditable()) return; const t = e.inputType; const sel = E().sel(); if (!sel) return; let r = sel.getRangeAt(0);
    if (t === 'insertText' && e.data != null) {
      if (!r.collapsed) { e.preventDefault(); const m = markDelete(r); if (m.last) { const n = document.createRange(); n.setStartAfter(m.last); n.collapse(true); E().setRange(n); } dropPh(m); insertTracked(e.data); E().changed(); return; }
      const node = r.startContainer.nodeType === 3 ? r.startContainer.parentElement : r.startContainer; e.preventDefault(); const sc = r.startContainer; if (sc.nodeType === 3 && mine(sc)) { sc.insertData(r.startOffset, e.data); const n = document.createRange(); n.setStart(sc, r.startOffset + e.data.length); n.collapse(true); E().setRange(n); } else insertTracked(e.data); E().changed();
    } else if (/^delete/.test(t) && (t !== 'deleteByDrag')) {
      e.preventDefault(); const back = /Backward|Cut|Content$/.test(t) && !/Forward/.test(t);
      if (r.collapsed) { sel.modify('extend', back ? 'backward' : 'forward', /Word/.test(t) ? 'word' : 'character'); r = sel.getRangeAt(0); }
      const m = markDelete(r); const n = document.createRange(); if (m.first && m.last) { if (back || !r.collapsed) { n.setStartBefore(m.first); } else n.setStartAfter(m.last); n.collapse(true); if (!back && r) { n.setStartAfter(m.last); n.collapse(true); } E().setRange(n); } else sel.collapseToStart(); dropPh(m);
      E().el.querySelectorAll('ins.wx-ins').forEach((i) => { if (!i.textContent) i.remove(); }); E().changed({ immediate: true });
    }
  }
  function insertTracked(text) {
    const r = E().range(); const ins = el('ins', { class: 'wx-ins', 'data-author': author(), 'data-time': new Date().toISOString() }); const tn = document.createTextNode(text); ins.append(tn); r.insertNode(ins);
    const n = document.createRange(); n.setStart(tn, tn.length); n.collapse(true); E().setRange(n);
  }
  const marks = (sel) => q(sel || 'ins.wx-ins,del.wx-del');
  const inSel = (list) => { const r = E().range(); return r && !r.collapsed ? list.filter((n) => r.intersectsNode(n)) : list; };
  V.accept = (all) => E().run(() => { const l = all ? marks() : (() => { const x = inSel(marks()); return x.length ? x : [cursorMark()].filter(Boolean); })(); l.forEach((n) => (n.tagName === 'INS' ? unwrap(n) : n.remove())); });
  V.reject = (all) => E().run(() => { const l = all ? marks() : (() => { const x = inSel(marks()); return x.length ? x : [cursorMark()].filter(Boolean); })(); l.forEach((n) => (n.tagName === 'INS' ? n.remove() : unwrap(n))); });
  const cursorMark = () => { const r = E().range(); if (!r) return null; const n = r.startContainer.nodeType === 3 ? r.startContainer.parentElement : r.startContainer; return n.closest('ins.wx-ins,del.wx-del'); };
  V.nextChange = function (dir) {
    const l = marks(); if (!l.length) return WX.ui.toast('No tracked changes.'); const cur = cursorMark(); let i = cur ? l.indexOf(cur) + dir : (dir > 0 ? 0 : l.length - 1); i = (i + l.length) % l.length;
    const rg = document.createRange(); rg.selectNodeContents(l[i]); E().setRange(rg); E().scrollTo(l[i]);
  };

  /* ---------- compare ---------- */
  function diff(a, b) { // Myers-style via LCS on trimmed arrays
    let s = 0; while (s < a.length && s < b.length && a[s] === b[s]) s++; let ea = a.length, eb = b.length; while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
    const A = a.slice(s, ea), B = b.slice(s, eb), out = a.slice(0, s).map((v) => ({ t: '=', v }));
    if (A.length * B.length > 6e6) { A.forEach((v) => out.push({ t: '-', v })); B.forEach((v) => out.push({ t: '+', v })); }
    else { const n = A.length, m = B.length, L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1)); for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]); let i = 0, j = 0; while (i < n && j < m) { if (A[i] === B[j]) { out.push({ t: '=', v: A[i] }); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) out.push({ t: '-', v: A[i++] }); else out.push({ t: '+', v: B[j++] }); } while (i < n) out.push({ t: '-', v: A[i++] }); while (j < m) out.push({ t: '+', v: B[j++] }); }
    return out.concat(a.slice(ea).map((v) => ({ t: '=', v })));
  }
  const when = () => new Date().toISOString();
  function compareHTML(orig, rev) {
    const pa = orig.split('\n').filter((x) => x.trim()), pb = rev.split('\n').filter((x) => x.trim()); const ops = diff(pa, pb); let html = ''; const at = (c) => `class="${c}" data-author="Compare" data-time="${when()}"`;
    for (let k = 0; k < ops.length; k++) {
      const o = ops[k];
      if (o.t === '=') html += `<p>${esc(o.v)}</p>`;
      else if (o.t === '-' && ops[k + 1] && ops[k + 1].t === '+') { const w = diff(o.v.split(/(\s+)/), ops[k + 1].v.split(/(\s+)/)); html += '<p>' + w.map((x) => x.t === '=' ? esc(x.v) : x.t === '-' ? `<del ${at('wx-del')}>${esc(x.v)}</del>` : `<ins ${at('wx-ins')}>${esc(x.v)}</ins>`).join('') + '</p>'; k++; }
      else if (o.t === '-') html += `<p><del ${at('wx-del')}>${esc(o.v)}</del></p>`; else html += `<p><ins ${at('wx-ins')}>${esc(o.v)}</ins></p>`;
    } return html;
  }
  V.compareDialog = async function () {
    const metas = (await WX.storage.listMeta()).filter((m) => m.id !== E().doc.id); let src = null;
    const sel = el('select', { class: 'input' }, el('option', { value: '', text: '— choose a saved document —' }), metas.map((m) => el('option', { value: m.id, text: m.title })));
    const fileBtn = el('button', { class: 'btn', text: 'Choose a file (.docx .txt .html)…', onclick: async () => { const f = (await WX.util.pickFile('.docx,.txt,.html,.htm,.md'))[0]; if (!f) return; try { const r = await WX.fileio.parse(f); src = { title: f.name, text: htmlText(r.content) }; fileBtn.textContent = '✓ ' + f.name; sel.value = ''; } catch (e) { WX.ui.toast(e.message, 'error'); } } });
    WX.ui.dialog({ title: 'Compare documents', width: '500px', body: el('div', { class: 'form' }, el('p', { text: 'The open document is the original. Choose the revised version; the result opens as a new document with differences shown as tracked changes.' }), sel, fileBtn),
      buttons: [{ label: 'Cancel' }, { label: 'Compare', primary: true, onClick: async () => { if (sel.value) { const d = await WX.storage.getDoc(sel.value); src = { title: d.title, text: htmlText(d.content) }; } if (!src) { WX.ui.toast('Choose a revised document.', 'error'); return false; } E().commit(); const out = compareHTML(V.docText(), src.text); await WX.docs.newDoc({ title: `Comparison – ${E().doc.title} vs ${src.title}`.slice(0, 80), content: out }); WX.ui.toast('Comparison created – use Review ▸ Accept / Reject to resolve.', 'success'); } }] });
  };
  const htmlText = (h) => { const d = document.createElement('div'); d.innerHTML = WX.util.sanitize(h); d.querySelectorAll('del.wx-del').forEach((n) => n.remove()); return Array.from(d.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,td,th,pre,blockquote')).filter((b) => !b.querySelector('p,li,td')).map((b) => b.textContent).join('\n') || d.textContent; };

  /* ---------- protection ---------- */
  V.protectDialog = function () {
    const d = E().doc, p = d.settings.protect;
    if (p && p.mode && !d._unlocked) {
      return WX.ui.dialog({ title: 'Document is protected', width: '420px', body: `<div class="form"><p>Protection: <b>${{ readonly: 'Read-only', comments: 'Comments only', tracked: 'Tracked changes only' }[p.mode]}</b></p>${p.hash ? '<label>Password<input type="password" class="input" id="pr-pw"></label>' : ''}</div>`,
        buttons: [{ label: 'Cancel' }, { label: 'Stop protection', primary: true, onClick: async (x) => { if (p.hash && (await WX.util.hashText(x.$('#pr-pw').value)) !== p.hash) { WX.ui.toast('Incorrect password.', 'error'); return false; } d.settings.protect = null; d._unlocked = true; E().updateEditable(); E().changed(); WX.ui.toast('Protection removed.'); } }] });
    }
    WX.ui.dialog({ title: 'Restrict editing', width: '440px', body: `<div class="form"><label>Allow in this document <select class="input" id="pr-m"><option value="readonly">No changes (read-only)</option><option value="comments">Comments only</option><option value="tracked">Tracked changes only</option></select></label><label>Password (optional)<input type="password" class="input" id="pr-pw" autocomplete="new-password"></label>
      <p class="muted">Protection stops accidental edits inside WordX. It is not encryption: the file contents are not hidden.</p></div>`,
      buttons: [{ label: 'Cancel' }, { label: 'Start protection', primary: true, onClick: async (x) => { const pw = x.$('#pr-pw').value; d.settings.protect = { mode: x.$('#pr-m').value, hash: pw ? await WX.util.hashText(pw) : null }; d._unlocked = false; E().updateEditable(); E().changed(); WX.ui.toast('Protection on.'); } }] });
  };

  V.init = function () {
    WX.bus.on('beforeinput', onBefore);
    const upd = WX.util.debounce(V.updateStatus, 250); ['input', 'docloaded', 'paginated', 'restored'].forEach((ev) => WX.bus.on(ev, upd)); WX.bus.on('selection', upd);
    WX.bus.on('click', (e) => { const c = e.target.closest && e.target.closest('.wx-comment'); if (c) { V.openPanel(c.dataset.cid); setTimeout(() => { const card = document.querySelector(`#side-body .card[data-cid="${c.dataset.cid}"]`); if (card) card.scrollIntoView({ block: 'nearest' }); }, 60); } });
  };
  Object.assign(WX.act, { addComment: V.addComment, showComments: () => V.openPanel(), deleteComments: V.deleteAllComments, trackChanges: V.toggleTrack, acceptChange: () => V.accept(false), acceptAll: () => V.accept(true), rejectChange: () => V.reject(false), rejectAll: () => V.reject(true), nextChange: () => V.nextChange(1), prevChange: () => V.nextChange(-1), wordCount: V.statsDialog, readability: V.readabilityDialog, compare: V.compareDialog, protect: V.protectDialog });
})();
