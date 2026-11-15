/* WordX – spellcheck.js
 * Offline English spelling (bundled word list, edit-distance suggestions, personal dictionary),
 * rule based grammar suggestions and AutoCorrect / auto-format-as-you-type. */
(function () {
  'use strict';
  const WX = window.WX; const { el, esc } = WX.util; const E = () => WX.editor;
  const SP = (WX.spell = { dict: null, user: new Set(), ignore: new Set(), loading: null });
  const DEFAULTS = { replace: true, capitalize: true, smartQuotes: true, autoformat: true, autolink: true };
  const BASE_MAP = { teh: 'the', adn: 'and', taht: 'that', hte: 'the', recieve: 'receive', recieved: 'received', wich: 'which', thier: 'their', definately: 'definitely', seperate: 'separate', occured: 'occurred', untill: 'until', becuase: 'because', beleive: 'believe', freind: 'friend', alot: 'a lot', wierd: 'weird', accomodate: 'accommodate', acheive: 'achieve', tommorow: 'tomorrow', goverment: 'government', enviroment: 'environment', dont: "don't", cant: "can't", wont: "won't", doesnt: "doesn't", didnt: "didn't", isnt: "isn't", wasnt: "wasn't", couldnt: "couldn't", shouldnt: "shouldn't", wouldnt: "wouldn't", im: "I'm", ive: "I've", youre: "you're", thats: "that's", "i'm": "I'm", "i'll": "I'll", "i've": "I've", "i'd": "I'd", '(c)': '©', '(r)': '®', '(tm)': '™', '-->': '→', '<--': '←', '--': '—', '...': '…', '1/2': '½', '1/4': '¼', '3/4': '¾', ':)': '🙂', ':(': '🙁' };
  SP.opts = Object.assign({}, DEFAULTS); SP.custom = {};

  SP.load = function () {
    if (SP.dict) return Promise.resolve(); if (SP.loading) return SP.loading;
    SP.loading = WX.util.loadScript('js/vendor/dictionary-en.js').then(async () => { SP.dict = new Set(window.WX_DICT_EN.split(' ')); window.WX_DICT_EN = null; (await WX.storage.getSetting('userDict', [])).forEach((w) => SP.user.add(w)); WX.bus.emit('dictloaded'); }).catch((e) => { SP.loading = null; console.warn('Dictionary failed to load', e); throw e; });
    return SP.loading;
  };
  SP.loadSettings = async function () { const s = await WX.storage.getSetting('autocorrect', null); if (s) { Object.assign(SP.opts, s.opts); SP.custom = s.custom || {}; } };
  const saveSettings = () => WX.storage.setSetting('autocorrect', { opts: SP.opts, custom: SP.custom });
  const CONTR = new Set(["can't", "won't", "shan't", "ain't", "let's", "o'clock"]);
  SP.known = function (w) {
    if (!SP.dict) return true; w = w.replace(/[’]/g, "'").replace(/^'+|'+$/g, ''); if (!w) return true; const l = w.toLowerCase();
    if (SP.dict.has(l) || SP.user.has(l) || SP.ignore.has(l) || CONTR.has(l)) return true;
    const m = /^(.+?)(n't|'s|'re|'ve|'ll|'d|'m|'t)$/.exec(l); if (m && (SP.dict.has(m[1]) || SP.user.has(m[1]))) return true;
    if (l.endsWith("s'") && SP.dict.has(l.slice(0, -2))) return true; return false;
  };
  /** Candidate corrections (edit distance 1, then 2) ranked by similarity. */
  SP.suggest = function (word) {
    const w = word.toLowerCase().replace(/’/g, "'"); const A = 'abcdefghijklmnopqrstuvwxyz'; const has = (x) => SP.dict.has(x);
    const e1 = (s) => { const o = new Set(); for (let i = 0; i <= s.length; i++) { const L = s.slice(0, i), R = s.slice(i); if (R) o.add(L + R.slice(1)); if (R.length > 1) o.add(L + R[1] + R[0] + R.slice(2)); for (const c of A) { if (R) o.add(L + c + R.slice(1)); o.add(L + c + R); } } return o; };
    const one = [...e1(w)].filter(has); let out = one.map((x) => [x, 1]);
    if (out.length < 5 && w.length <= 9) { const seen = new Set(one); for (const x of e1(w)) for (const y of e1(x)) if (!seen.has(y) && has(y)) { seen.add(y); out.push([y, 2]); if (out.length > 60) break; } }
    out.sort((a, b) => a[1] - b[1] || (b[0][0] === w[0]) - (a[0][0] === w[0]) || Math.abs(a[0].length - w.length) - Math.abs(b[0].length - w.length) || a[0].localeCompare(b[0]));
    const cap = word[0] !== word[0].toLowerCase(), up = word.length > 1 && word === word.toUpperCase();
    return out.slice(0, 6).map(([x]) => (up ? x.toUpperCase() : cap ? x[0].toUpperCase() + x.slice(1) : x));
  };
  SP.addWord = function (w) { SP.user.add(w.toLowerCase()); WX.storage.setSetting('userDict', Array.from(SP.user)); };

  /* ---------- scanning ---------- */
  function scan() {
    const out = []; const tw = document.createTreeWalker(E().el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement.closest('.wx-obj,.wx-toc,del.wx-del,pre,a[href],.wx-index,svg,math') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) }); let n;
    while ((n = tw.nextNode())) {
      const re = /[A-Za-zÀ-ɏ]+(?:['’][A-Za-z]+)*/g; let m; while ((m = re.exec(n.data))) {
        const w = m[0], pc = n.data[m.index - 1], nc = n.data[m.index + w.length];
        if (w.length < 2 || /[\d@\/\\_.]/.test(pc || '') && pc !== '.' || /[\d@\/\\_]/.test(nc || '')) continue; if (w === w.toUpperCase() && w.length <= 6) continue; if (/[a-z][A-Z]/.test(w)) continue;
        if (!SP.known(w)) out.push({ node: n, start: m.index, end: m.index + w.length, word: w });
      }
    } return out;
  }
  SP.scan = scan;

  /* ---------- spelling panel ---------- */
  let skip = 0;
  SP.openSpelling = async function () {
    try { await SP.load(); } catch (e) { return WX.ui.toast('The dictionary could not be loaded.', 'error'); } skip = 0; SP.ignore.clear(); renderSpell();
  };
  function renderSpell() {
    WX.side.open('spell', 'Spelling', (body) => {
      body.innerHTML = ''; const list = scan(); const cur = list[skip];
      if (!cur) { body.append(el('div', { class: 'empty', html: '<b>Spelling check complete</b>No more misspelled words found.' })); return; }
      const r = document.createRange(); r.setStart(cur.node, cur.start); r.setEnd(cur.node, cur.end); const s = getSelection(); s.removeAllRanges(); s.addRange(r); cur.node.parentElement.scrollIntoView({ block: 'center' });
      const blk = cur.node.parentElement.closest(E().BLOCK_SEL) || cur.node.parentElement; const t = blk.textContent; const idx = t.indexOf(cur.word);
      const ctx = esc(t.slice(Math.max(0, idx - 40), idx)) + '<mark>' + esc(cur.word) + '</mark>' + esc(t.slice(idx + cur.word.length, idx + cur.word.length + 40));
      const sug = SP.suggest(cur.word); let pick = sug[0] || ''; const input = el('input', { class: 'input', value: pick, 'aria-label': 'Replacement' });
      const sbox = el('div', { class: 'list-box', style: { margin: '8px 0' } }, sug.length ? sug.map((x, i) => el('div', { class: 'list-row' + (i ? '' : ' sel'), text: x, onclick: (ev) => { input.value = x; sbox.querySelectorAll('.list-row').forEach((q) => q.classList.remove('sel')); ev.currentTarget.classList.add('sel'); } })) : [el('div', { class: 'list-row muted', text: '(no suggestions)' })]);
      const change = (all) => { const v = input.value; if (!v) return; E().pushHistory(); const apply = (c) => { c.node.data = c.node.data.slice(0, c.start) + v + c.node.data.slice(c.end); }; if (all) { scan().filter((c) => c.word === cur.word).reverse().forEach(apply); } else apply(cur); E().changed({ immediate: true }); renderSpell(); };
      const btn = (l, f, cls) => el('button', { class: 'btn small ' + (cls || ''), text: l, onclick: f });
      body.append(el('div', { class: 'muted', text: `Not in dictionary (${list.length} left)` }), el('div', { class: 'card', html: ctx, style: { marginTop: '6px' } }), input, sbox,
        el('div', { class: 'side-row' }, btn('Change', () => change(false), 'primary'), btn('Change all', () => change(true))), el('div', { class: 'side-row' }, btn('Ignore', () => { skip++; renderSpell(); }), btn('Ignore all', () => { SP.ignore.add(cur.word.toLowerCase()); renderSpell(); }), btn('Add to dictionary', () => { SP.addWord(cur.word); renderSpell(); })));
    });
  }

  /* ---------- grammar ---------- */
  const rangeFor = (b, s, e) => WX.util.rangeFor(b, s, e);
  const VOWEL_EXC = /^(uni|use|usu|usa|eu|one|once|ubi|uti|ura)/i, H_SILENT = /^(hour|honest|honou?r|heir)/i;
  const RULES = [
    { re: /\b(\w+)\s+\1\b/gi, msg: 'Repeated word', fix: (m) => m[1] },
    { re: /\b([Aa])\s+([aeiou]\w*)/g, ok: (m) => !VOWEL_EXC.test(m[2]), msg: 'Use “an” before a vowel sound', fix: (m) => (m[1] === 'A' ? 'An ' : 'an ') + m[2] },
    { re: /\b([Aa]n)\s+([bcdfgjklmnpqrstvwxz]\w*)/g, ok: (m) => !H_SILENT.test(m[2]), msg: 'Use “a” before a consonant sound', fix: (m) => (m[1] === 'An' ? 'A ' : 'a ') + m[2] },
    { re: /\b(could|should|would|must)\s+of\b/gi, msg: '“of” should be “have”', fix: (m) => m[1] + ' have' },
    { re: /[^\S\n]{2,}(?=\S)/g, msg: 'Extra spaces', fix: () => ' ' },
    { re: /\s+([,.;:!?])/g, msg: 'Space before punctuation', fix: (m) => m[1] },
    { re: /\b(alot)\b/gi, msg: '“a lot” is two words', fix: () => 'a lot' },
    { re: /\b(its)\s+(a|the|not|been|going|time|my|very)\b/gi, msg: 'Did you mean “it’s” (it is)?', fix: (m) => "it's " + m[2] },
    { re: /\b(your)\s+(welcome|right|wrong)\b/gi, msg: 'Did you mean “you’re”?', fix: (m) => "you're " + m[2] },
    { re: /\b(is|are|was|were|been|being|be)\s+(\w{3,}ed)\b/gi, msg: 'Possible passive voice – consider active voice', fix: null, style: true },
  ];
  function grammarScan() {
    const out = [];
    Array.from(E().el.querySelectorAll(E().BLOCK_SEL)).filter((b) => E().isLeaf(b) && !b.closest('.wx-toc,.wx-index,pre,.wx-bib')).forEach((b) => {
      const t = b.textContent; if (!t.trim()) return;
      RULES.forEach((ru) => { ru.re.lastIndex = 0; let m; while ((m = ru.re.exec(t))) { if (!m[0].length) { ru.re.lastIndex++; continue; } if (ru.ok && !ru.ok(m)) continue; out.push({ b, s: m.index, e: m.index + m[0].length, msg: ru.msg, fix: ru.fix ? ru.fix(m) : null, style: ru.style }); } });
      const lm = /^(\s*)([a-z])/.exec(t); if (lm && !/^H[1-6]$/.test(b.tagName) && t.length > 3 && /\s/.test(t)) out.push({ b, s: lm[1].length, e: lm[1].length + 1, msg: 'Sentence should start with a capital letter', fix: lm[2].toUpperCase() });
      const re2 = /[.!?]\s+([a-z])/g; let m2; while ((m2 = re2.exec(t))) { const pre = t.slice(0, m2.index + 1); if (!/\b(e\.g|i\.e|etc|vs|mr|mrs|ms|dr|no|approx|fig)\.$/i.test(pre)) out.push({ b, s: m2.index + m2[0].length - 1, e: m2.index + m2[0].length, msg: 'Capitalise the first word of a sentence', fix: m2[1].toUpperCase() }); }
      (t.match(/[^.!?]+[.!?]*/g) || []).forEach((sn) => { const wc = (sn.match(/\S+/g) || []).length; if (wc > 40) out.push({ b, s: t.indexOf(sn), e: t.indexOf(sn) + Math.min(sn.length, 60), msg: `Long sentence (${wc} words) – consider splitting`, fix: null, style: true }); });
      if (t.trim().split(/\s+/).length > 7 && !/[.!?:;…)"”']\s*$/.test(t) && b.tagName === 'P' && !b.closest('td,th')) out.push({ b, s: Math.max(0, t.length - 1), e: t.length, msg: 'Paragraph has no ending punctuation', fix: null, style: true });
    }); return out;
  }
  SP.openGrammar = function () {
    WX.side.open('grammar', 'Grammar & style', (body) => {
      body.innerHTML = ''; const list = grammarScan();
      body.append(el('div', { class: 'ai-note', text: 'Rule-based suggestions that run entirely in your browser. They are hints, not corrections you must accept.' }), el('div', { class: 'muted', style: { margin: '10px 0' }, text: list.length ? `${list.length} suggestion${list.length > 1 ? 's' : ''}` : 'No issues found 🎉' }));
      list.slice(0, 150).forEach((g) => {
        const t = g.b.textContent; const card = el('div', { class: 'card' }, el('div', { class: 'who', text: g.msg }), el('div', { class: 'quote', html: esc(t.slice(Math.max(0, g.s - 25), g.s)) + '<mark>' + esc(t.slice(g.s, g.e)) + '</mark>' + esc(t.slice(g.e, g.e + 25)) }));
        const acts = el('div', { class: 'acts' }); if (g.fix != null) acts.append(el('button', { class: 'btn small primary', text: g.fix ? `Change to “${g.fix.length > 24 ? g.fix.slice(0, 22) + '…' : g.fix}”` : 'Remove', onclick: () => { const r = rangeFor(g.b, g.s, g.e); if (!r) return; E().pushHistory(); r.deleteContents(); if (g.fix) r.insertNode(document.createTextNode(g.fix)); g.b.normalize(); E().changed({ immediate: true }); SP.openGrammar(); } }));
        acts.append(el('button', { class: 'btn small', text: 'Show', onclick: () => { const r = rangeFor(g.b, g.s, g.e); if (r) { const s = getSelection(); s.removeAllRanges(); s.addRange(r); g.b.scrollIntoView({ block: 'center', behavior: 'smooth' }); } } })); card.append(acts); body.append(card);
      });
    });
  };

  /* ---------- AutoCorrect while typing ---------- */
  const NOCAP = /\b(e\.g|i\.e|etc|vs|mr|mrs|ms|dr|prof|no|fig|approx)\.\s+$/i;
  function onInput(e) {
    if (!E().isEditable() || e.inputType !== 'insertText' || !e.data) return; const r = E().range(); if (!r || !r.collapsed || r.startContainer.nodeType !== 3) return;
    if (e.data === ' ') return onSpace(r); if (SP.opts.smartQuotes && (e.data === '"' || e.data === "'")) smartQuote(r, e.data);
  }
  function smartQuote(r, ch) {
    const n = r.startContainer, o = r.startOffset; const prev = n.data[o - 2]; const open = !prev || /[\s(\[{—–-]/.test(prev);
    const c = ch === '"' ? (open ? '“' : '”') : (open ? '‘' : '’'); n.data = n.data.slice(0, o - 1) + c + n.data.slice(o); const nr = document.createRange(); nr.setStart(n, o); nr.collapse(true); E().setRange(nr);
  }
  function onSpace(r) {
    const n = r.startContainer, caret = r.startOffset; const before = n.data.slice(0, caret - 1); const m = /(\S+)$/.exec(before); if (!m) return; let word = m[1]; const start = before.length - word.length; const blk = E().closestLeaf(n); if (!blk || blk.closest('pre')) return;
    const setCaret = (node, off) => { const nr = document.createRange(); nr.setStart(node, off); nr.collapse(true); E().setRange(nr); };
    const pr = document.createRange(); pr.setStart(blk, 0); pr.setEnd(n, start); const pre = pr.toString();
    if (SP.opts.autoformat && blk.tagName === 'P' && !pre && /^(-|\*|•|1\.|1\))$/.test(word) && blk.textContent.trim() === word) { n.data = n.data.slice(caret); setCaret(n, 0); document.execCommand(word === '1.' || word === '1)' ? 'insertOrderedList' : 'insertUnorderedList'); return; }
    if (SP.opts.autolink && /^(https?:\/\/\S+\.\S+|www\.\S+\.\S+)$/i.test(word.replace(/[.,;:!?)]+$/, ''))) {
      const core = word.replace(/[.,;:!?)]+$/, ''); const t2 = n.splitText(start); const t3 = t2.splitText(core.length); const a = el('a', { href: /^www\./i.test(core) ? 'https://' + core : core, target: '_blank', rel: 'noopener noreferrer' }); t2.parentNode.insertBefore(a, t2); a.appendChild(t2); setCaret(t3, Math.min(t3.length, caret - 1 - start - core.length + 0) + 0 === 0 ? 0 : Math.min(t3.length, caret - (start + core.length))); return;
    }
    const core = word.replace(/[.,;:!?)"”]+$/, ''), tail = word.slice(core.length); let rep = null; const key = core.toLowerCase();
    if (SP.opts.replace) { const map = Object.assign({}, BASE_MAP, SP.custom); if (Object.prototype.hasOwnProperty.call(map, key) && !(core.length > 1 && key === 'im' && core !== 'im' && core !== 'Im')) { rep = map[key]; if (/^[a-z]/.test(rep) && core[0] !== core[0].toLowerCase()) rep = core === core.toUpperCase() && core.length > 1 ? rep.toUpperCase() : rep[0].toUpperCase() + rep.slice(1); } else if (core === 'i') rep = 'I'; }
    let w2 = rep != null ? rep : core;
    if (SP.opts.capitalize && /^[a-z]/.test(w2) && (!pre.trim() || /[.!?]\s+$/.test(pre)) && !NOCAP.test(pre) && !/^\s*$/.test(w2) && !(blk.tagName === 'LI' && false)) { if (!/^(www\.|http)/i.test(w2)) w2 = w2[0].toUpperCase() + w2.slice(1); }
    if (w2 === core) return; n.data = n.data.slice(0, start) + w2 + tail + n.data.slice(start + word.length); setCaret(n, start + w2.length + tail.length + 1);
  }

  /* ---------- options dialog ---------- */
  SP.optionsDialog = function () {
    const o = SP.opts; const chk = (k, l) => `<label class="inline"><input type="checkbox" data-k="${k}" ${o[k] ? 'checked' : ''}> ${l}</label>`; const custom = Object.assign({}, SP.custom);
    const table = el('div', { class: 'list-box' }); const f1 = el('input', { class: 'input', placeholder: 'Replace' }), f2 = el('input', { class: 'input', placeholder: 'With' });
    const draw = () => { table.innerHTML = ''; const k = Object.keys(custom); if (!k.length) table.append(el('div', { class: 'list-row muted', text: 'No custom entries.' })); k.forEach((x) => table.append(el('div', { class: 'list-row' }, el('span', { style: { flex: 1 }, text: `${x}  →  ${custom[x]}` }), el('button', { class: 'btn small danger', text: 'Delete', onclick: () => { delete custom[x]; draw(); } })))); }; draw();
    const body = el('div', { class: 'form' }); body.innerHTML = [chk('replace', 'Replace text as you type (typos, symbols like (c) and --)'), chk('capitalize', 'Capitalise first letter of sentences'), chk('smartQuotes', 'Straight quotes → smart quotes'), chk('autoformat', 'Automatic bulleted / numbered lists ("- " or "1. ")'), chk('autolink', 'Turn web addresses into hyperlinks')].join('');
    body.append(el('h4', { text: 'Custom replacements' }), table, el('div', { class: 'side-row' }, f1, f2, el('button', { class: 'btn small', text: 'Add', onclick: () => { if (f1.value && f2.value) { custom[f1.value.toLowerCase()] = f2.value; f1.value = f2.value = ''; draw(); } } })));
    const sp = el('label', { class: 'inline' }, (() => { const c = el('input', { type: 'checkbox', id: 'ac-native' }); c.checked = WX.state.nativeSpell !== false; return c; })(), ' Underline misspelled words as I type (browser spell checker)'); body.append(sp);
    WX.ui.dialog({ title: 'AutoCorrect options', width: '540px', body, buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, onClick: (d) => { d.$$('input[data-k]').forEach((c) => { o[c.dataset.k] = c.checked; }); SP.custom = custom; WX.state.nativeSpell = d.$('#ac-native').checked; E().el.spellcheck = WX.state.nativeSpell; saveSettings(); WX.bus.emit('selection'); } }] });
  };
  SP.toggleNative = function () { WX.state.nativeSpell = WX.state.nativeSpell === false; E().el.spellcheck = WX.state.nativeSpell; WX.bus.emit('selection'); WX.ui.toast('Check spelling as you type: ' + (WX.state.nativeSpell ? 'on' : 'off')); };

  SP.init = function () {
    SP.loadSettings(); WX.bus.on('input', onInput);
    setTimeout(() => SP.load().catch(() => {}), 2500);
    E().ctxProviders.push((e) => {
      if (!SP.dict || !E().isEditable() || !document.caretRangeFromPoint) return null; const p = document.caretRangeFromPoint(e.clientX, e.clientY); if (!p || p.startContainer.nodeType !== 3 || !E().el.contains(p.startContainer)) return null;
      const t = p.startContainer.data, o = p.startOffset; let a = o, b = o; while (a > 0 && /[A-Za-z'’]/.test(t[a - 1])) a--; while (b < t.length && /[A-Za-z'’]/.test(t[b])) b++; const w = t.slice(a, b); if (w.length < 2 || SP.known(w) || /\d/.test(w)) return null;
      const node = p.startContainer; const sug = SP.suggest(w); const sel = () => { const r = document.createRange(); r.setStart(node, a); r.setEnd(node, b); E().setRange(r); };
      return [...(sug.length ? sug.slice(0, 5).map((s) => ({ label: s, html: `<b>${esc(s)}</b>`, action: () => { sel(); document.execCommand('insertText', false, s); E().changed({ immediate: true }); } })) : [{ label: '(no suggestions)', disabled: true }]), { sep: true }, { label: 'Add to dictionary', action: () => { SP.addWord(w); WX.ui.toast('Added “' + w + '”'); } }, { label: 'Ignore all', action: () => SP.ignore.add(w.toLowerCase()) }].map((i) => (i.html ? Object.assign(i, { html: `<span class="mi-ic"></span><span class="mi-l">${i.html}</span>` }) : i));
    });
  };
  Object.assign(WX.act, { spelling: SP.openSpelling, grammar: SP.openGrammar, autocorrect: SP.optionsDialog, toggleSpellAsYouType: SP.toggleNative });
})();
