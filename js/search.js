/* WordX – search.js
 * Find & Replace panel: case / whole-word / regex options, live highlights using the
 * CSS Custom Highlight API (falls back to selection only), replace one / all. */
(function () {
  'use strict';
  const WX = window.WX; const { el, esc, icon } = WX.util; const E = () => WX.editor;
  const S = (WX.search = {});
  const st = { q: '', r: '', cs: false, ww: false, re: false, ranges: [], i: -1 };

  /** Map plain-text offsets inside `root` to a DOM Range. */
  WX.util.rangeFor = function (root, s, e) {
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let pos = 0, n, sn, so, en, eo;
    while ((n = tw.nextNode())) { const len = n.data.length; if (sn === undefined && s < pos + len) { sn = n; so = s - pos; } if (e <= pos + len) { en = n; eo = e - pos; break; } pos += len; }
    if (!sn || !en) return null; const r = document.createRange(); r.setStart(sn, so); r.setEnd(en, eo); return r;
  };
  const leafBlocks = () => Array.from(E().el.querySelectorAll(E().BLOCK_SEL)).filter((b) => E().isLeaf(b));
  function regex() {
    if (!st.q) return null; let src = st.re ? st.q : st.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); if (st.ww) src = '\\b(?:' + src + ')\\b';
    try { return new RegExp(src, 'g' + (st.cs ? '' : 'i') + 'u'); } catch (e) { try { return new RegExp(src, 'g' + (st.cs ? '' : 'i')); } catch (e2) { return null; } }
  }
  S.collect = function (query, opts) {
    if (query != null) Object.assign(st, { q: query }, opts || {}); const re = regex(); const out = []; if (!re) return out;
    leafBlocks().forEach((b) => { const text = b.textContent; re.lastIndex = 0; let m; while ((m = re.exec(text))) { if (!m[0].length) { re.lastIndex++; continue; } const r = WX.util.rangeFor(b, m.index, m.index + m[0].length); if (r) out.push(r); if (out.length > 5000) return; } });
    return out;
  };
  function paint() {
    if (!window.CSS || !CSS.highlights) return; CSS.highlights.delete('wx-find'); CSS.highlights.delete('wx-find-cur');
    if (st.ranges.length) CSS.highlights.set('wx-find', new Highlight(...st.ranges)); if (st.ranges[st.i]) CSS.highlights.set('wx-find-cur', new Highlight(st.ranges[st.i]));
  }
  S.clear = function () { st.ranges = []; st.i = -1; paint(); };
  function recompute(keep) { st.ranges = S.collect(); if (!keep) st.i = st.ranges.length ? 0 : -1; else st.i = Math.min(st.i, st.ranges.length - 1); paint(); }
  function goTo(i) {
    if (!st.ranges.length) return; st.i = (i + st.ranges.length) % st.ranges.length; const r = st.ranges[st.i];
    const s = getSelection(); s.removeAllRanges(); s.addRange(r.cloneRange()); const n = r.startContainer.parentElement; if (n) n.scrollIntoView({ block: 'center', behavior: 'smooth' }); paint(); S.onChange && S.onChange();
  }
  const replText = (r) => st.re ? (() => { try { return r.toString().replace(new RegExp(st.ww ? '\\b(?:' + st.q + ')\\b' : st.q, st.cs ? 'u' : 'iu'), st.r); } catch (e) { return st.r; } })() : st.r;
  function replaceRange(r) { const t = replText(r); r.deleteContents(); if (t) r.insertNode(document.createTextNode(t)); }
  function replaceOne() {
    if (!E().isEditable()) return WX.ui.toast('This document is read-only.'); if (!st.ranges.length) return; const i = st.i < 0 ? 0 : st.i;
    const sel = getSelection(); const cur = st.ranges[i]; const isSel = sel.rangeCount && sel.toString() === cur.toString();
    if (!isSel) return goTo(i); E().pushHistory(); replaceRange(cur); E().normalize(); E().changed({ immediate: true }); recompute(true); st.i = Math.min(i, st.ranges.length - 1); st.ranges.length ? goTo(st.i) : S.onChange && S.onChange();
  }
  function replaceAll() {
    if (!E().isEditable()) return WX.ui.toast('This document is read-only.'); recompute(); const n = st.ranges.length; if (!n) return WX.ui.toast('No matches found.');
    E().pushHistory(); st.ranges.slice().reverse().forEach(replaceRange); E().normalize(); E().changed({ immediate: true }); recompute(); WX.ui.toast(`Replaced ${n} occurrence${n > 1 ? 's' : ''}.`, 'success'); S.onChange && S.onChange();
  }

  S.open = function (withReplace) {
    const sel = E().selectedText(); if (sel && sel.length < 80 && !/\n/.test(sel)) st.q = sel.trim() || st.q;
    WX.side.open('find', withReplace ? 'Find and Replace' : 'Find', (body) => {
      body.innerHTML = ''; const f = el('input', { class: 'input', placeholder: 'Find…', value: st.q, 'aria-label': 'Find' }); const r = el('input', { class: 'input', placeholder: 'Replace with…', value: st.r, 'aria-label': 'Replace with' }); const info = el('div', { class: 'muted', style: { margin: '6px 0' } });
      const opt = (k, l) => { const c = el('input', { type: 'checkbox' }); c.checked = st[k]; c.addEventListener('change', () => { st[k] = c.checked; recompute(); draw(); }); return el('label', { class: 'inline', style: { display: 'flex', gap: '6px', alignItems: 'center', fontSize: '13px' } }, c, l); };
      const list = el('div'); const rep = el('div', { class: 'side-row', style: { display: withReplace ? '' : 'none' } }, r, el('button', { class: 'btn small', text: 'Replace', onclick: replaceOne }), el('button', { class: 'btn small', text: 'Replace all', onclick: replaceAll }));
      const draw = () => { info.textContent = !st.q ? '' : st.ranges.length ? `${st.i + 1} of ${st.ranges.length} match${st.ranges.length > 1 ? 'es' : ''}` : 'No matches'; list.innerHTML = ''; st.ranges.slice(0, 60).forEach((rg, i) => { const b = rg.startContainer.parentElement.closest(E().BLOCK_SEL) || rg.startContainer.parentElement; const t = b.textContent; const idx = t.indexOf(rg.toString()); const snip = t.slice(Math.max(0, idx - 24), idx) + '\u0001' + rg.toString() + '\u0002' + t.slice(idx + rg.toString().length, idx + rg.toString().length + 40); list.append(el('button', { class: 'nav-h', html: esc(snip).replace('\u0001', '<mark>').replace('\u0002', '</mark>'), onclick: () => { goTo(i); draw(); } })); }); };
      S.onChange = draw; r.addEventListener('input', () => { st.r = r.value; });
      let t; f.addEventListener('input', () => { st.q = f.value; clearTimeout(t); t = setTimeout(() => { recompute(); draw(); }, 120); });
      f.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (!st.ranges.length) recompute(); e.shiftKey ? goTo(st.i - 1) : goTo(st.i + 1); draw(); } });
      body.append(el('div', { class: 'side-row' }, f, el('button', { class: 'icon-btn', html: icon('chevron-up', 16), 'data-tip': 'Previous', onclick: () => { goTo(st.i - 1); draw(); } }), el('button', { class: 'icon-btn', html: icon('chevron-down', 16), 'data-tip': 'Next', onclick: () => { goTo(st.i + 1); draw(); } })), rep,
        el('div', { style: { display: 'flex', gap: '12px', flexWrap: 'wrap' } }, opt('cs', 'Match case'), opt('ww', 'Whole words'), opt('re', 'Regex')), info, list);
      if (!withReplace) body.append(el('button', { class: 'btn small', text: 'Show replace', onclick: () => S.open(true) }));
      recompute(); draw(); setTimeout(() => { f.focus(); f.select(); }, 30);
    }, () => S.clear());
  };
  S.state = st;
  Object.assign(WX.act, { find: () => S.open(false), replace: () => S.open(true) });
})();
