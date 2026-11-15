/* WordX – ai-assistant.js
 * Side-panel assistant. Two providers:
 *  - "local": offline, rule-based (extractive summary, key points, clean-up, tone tweaks, titles).
 *  - "proxy": POSTs {action,text,options,prompt} to YOUR backend endpoint, which holds the API key
 *    and calls the model (see server/proxy-example.js). No key is ever stored in the browser. */
(function () {
  'use strict';
  const WX = window.WX; const { el, esc, icon } = WX.util; const E = () => WX.editor;
  const AI = (WX.ai = { cfg: { mode: 'local', endpoint: '' } });
  WX.storage.open().then(() => WX.storage.getSetting('ai', null)).then((c) => { if (c) AI.cfg = Object.assign(AI.cfg, c); }).catch(() => {});
  const save = () => WX.storage.setSetting('ai', AI.cfg);

  /* ---------- local text helpers ---------- */
  const STOP = new Set('a an the and or but if of to in on at for with by from as is are was were be been being it its this that these those i you he she we they them his her our your their not no so than then there here have has had do does did will would can could should may might also into over under about more most such very just'.split(' '));
  const sentences = (t) => (t.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || []).map((s) => s.trim()).filter(Boolean);
  const words = (t) => (t.toLowerCase().match(/[a-z']+/g) || []);
  function freq(t) { const f = {}; words(t).forEach((w) => { if (!STOP.has(w) && w.length > 2) f[w] = (f[w] || 0) + 1; }); return f; }
  function top(t, n) { const f = freq(t), sc = sentences(t).map((s, i) => ({ s, i, v: words(s).reduce((a, w) => a + (f[w] || 0), 0) / Math.sqrt(words(s).length + 3) })); return sc.sort((a, b) => b.v - a.v).slice(0, n).sort((a, b) => a.i - b.i).map((x) => x.s); }
  const CONTR = [["do not", "don't"], ["does not", "doesn't"], ["did not", "didn't"], ["cannot", "can't"], ["can not", "can't"], ["will not", "won't"], ["is not", "isn't"], ["are not", "aren't"], ["was not", "wasn't"], ["it is", "it's"], ["that is", "that's"], ["I am", "I'm"], ["we are", "we're"], ["they are", "they're"], ["you are", "you're"], ["I have", "I've"], ["would not", "wouldn't"], ["could not", "couldn't"], ["should not", "shouldn't"]];
  const keep = (a, b) => (a[0] === a[0].toUpperCase() ? b[0].toUpperCase() + b.slice(1) : b);
  const FILLER = /\b(very|really|basically|actually|literally|quite|just|simply|definitely|extremely|in order to|due to the fact that|at this point in time|it is important to note that)\b\s*/gi;
  const local = {
    summarize: (t) => top(t, Math.max(1, Math.min(5, Math.round(sentences(t).length / 4)))).join(' '),
    keypoints: (t) => top(t, Math.min(6, Math.max(2, Math.round(sentences(t).length / 3)))).map((s) => '• ' + s).join('\n'),
    fix: (t) => { let o = t.replace(/[ \t]{2,}/g, ' ').replace(/ +([,.;:!?])/g, '$1').replace(/([,.;:!?])(?=[A-Za-z])/g, '$1 ').replace(/\bi\b(?=[ ',.])/g, 'I').replace(/\b(\w+)\s+\1\b/gi, '$1').replace(/(^|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase());
      if (WX.spell && WX.spell.known) o = o.replace(/\b[a-z]{4,}\b/g, (w) => { if (WX.spell.known(w)) return w; const s = WX.spell.suggest(w); return s && s.length && s[0].length >= w.length - 1 && s[0].length <= w.length + 1 ? s[0] : w; }); return o; },
    concise: (t) => t.replace(FILLER, '').replace(/ {2,}/g, ' ').replace(/ ([,.])/g, '$1'),
    formal: (t) => CONTR.reduce((o, [full, c]) => o.replace(new RegExp("\\b" + c.replace("'", "['’]") + "\\b", 'gi'), (m) => keep(m, full)), t).replace(/\b(gonna)\b/gi, 'going to').replace(/\b(wanna)\b/gi, 'want to').replace(/\b(kids)\b/gi, 'children').replace(/!+/g, '.'),
    casual: (t) => CONTR.reduce((o, [full, c]) => o.replace(new RegExp('\\b' + full + '\\b', 'gi'), (m) => keep(m, c)), t),
    titles: (t) => { const f = Object.entries(freq(t)).sort((a, b) => b[1] - a[1]).slice(0, 4).map((x) => x[0][0].toUpperCase() + x[0].slice(1)); if (f.length < 2) return 'Not enough text to suggest titles.'; return [`${f[0]} and ${f[1]}`, `An Overview of ${f[0]}`, `${f.slice(0, 3).join(', ')}: Key Points`].map((x) => '• ' + x).join('\n'); },
  };
  const ACTIONS = [['summarize', 'Summarize', 'text'], ['keypoints', 'Key points', 'list'], ['fix', 'Fix spelling & grammar', 'spell-check'], ['concise', 'Make concise', 'minimize-2'], ['formal', 'Formal tone', 'briefcase'], ['casual', 'Casual tone', 'smile'], ['titles', 'Suggest titles', 'heading']];
  const PROXY_ONLY = [['expand', 'Expand', 'maximize-2'], ['rewrite', 'Rewrite', 'pen-line'], ['translate', 'Translate to…', 'languages'], ['continue', 'Continue writing', 'forward']];

  AI.run = async function (action, text, prompt, options) {
    if (AI.cfg.mode === 'proxy') {
      if (!/^https?:\/\//.test(AI.cfg.endpoint || '')) throw new Error('Set a valid backend endpoint in the AI settings.');
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 60000);
      try { const r = await fetch(AI.cfg.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, text, prompt: prompt || '', options: options || {} }), signal: ctl.signal });
        if (!r.ok) throw new Error('Backend returned ' + r.status + (r.status === 0 ? '' : '.')); const j = await r.json(); if (typeof j.text !== 'string') throw new Error('Backend response had no "text" field.'); return j.text; }
      catch (e) { throw new Error(e.name === 'AbortError' ? 'The backend timed out.' : e.message === 'Failed to fetch' ? 'Could not reach the backend (network or CORS).' : e.message); } finally { clearTimeout(to); }
    }
    if (!local[action]) throw new Error('“' + action + '” needs a connected AI backend. Open AI settings and add your proxy endpoint.');
    if (!text.trim()) throw new Error('Select some text first (or write something).'); return local[action](text);
  };

  function panel(body) {
    body.innerHTML = ''; let src = '', out = ''; const info = el('div', { class: 'ai-note' }); const outBox = el('div', { class: 'ai-out', hidden: true }); const acts = el('div', { class: 'side-row', hidden: true }); const prompt = el('textarea', { class: 'input', rows: 3, placeholder: AI.cfg.mode === 'proxy' ? 'Ask or instruct the AI about the selected text…' : 'Free-form prompts need a connected backend.', style: { width: '100%' } });
    const mode = () => { info.innerHTML = AI.cfg.mode === 'proxy' ? icon('plug', 14) + ' Connected to your backend: ' + esc(AI.cfg.endpoint || 'not set') : icon('cpu', 14) + ' Offline mode: simple rule-based tools that run in your browser. Connect a backend in settings for generative AI.'; };
    const target = () => { E().restore && E().restore(); const s = E().selectedText(); return s && s.trim() ? { text: s, sel: true } : { text: WX.review.docText(), sel: false }; };
    const go = async (action, label, pr) => { const t = target(); src = t.text; outBox.hidden = false; outBox.textContent = 'Working…'; acts.hidden = true; let options = {}; if (action === 'translate') { const l = await WX.ui.prompt('Translate', 'Target language', 'Spanish'); if (!l) return void (outBox.hidden = true); options.language = l; }
      try { out = await AI.run(action, src, pr, options); outBox.textContent = out || '(empty result)'; acts.hidden = !out; acts.dataset.sel = t.sel ? '1' : ''; } catch (e) { outBox.textContent = e.message; } };
    const chips = el('div', { class: 'sug' }); ACTIONS.concat(AI.cfg.mode === 'proxy' ? PROXY_ONLY : []).forEach(([a, l, i]) => chips.append(el('button', { class: 'ai-chip', html: icon(i, 14) + esc(l), onmousedown: (e) => e.preventDefault(), onclick: () => go(a, l) })));
    const ask = el('button', { class: 'btn primary small', text: 'Ask', onclick: () => { if (!prompt.value.trim()) return; go('custom', 'Ask', prompt.value.trim()); } });
    const apply = (how) => { if (!out) return; const html = out.split(/\n+/).map((l) => '<p>' + esc(l) + '</p>').join('');
      if (how === 'copy') return navigator.clipboard.writeText(out).then(() => WX.ui.toast('Copied.', 'success'), () => WX.ui.toast('Clipboard blocked by the browser.', 'error'));
      if (!E().isEditable()) return WX.ui.toast('This document is read-only.'); E().restore(); if (how === 'replace' && acts.dataset.sel) E().insertHTML(html); else { E().caretToEnd && E().caretToEnd(); E().insertHTML(html); } WX.ui.toast(how === 'replace' && acts.dataset.sel ? 'Replaced selection.' : 'Inserted.', 'success'); };
    acts.append(el('button', { class: 'btn small', text: 'Replace selection', onclick: () => apply('replace') }), el('button', { class: 'btn small', text: 'Insert at end', onclick: () => apply('insert') }), el('button', { class: 'btn small', text: 'Copy', onclick: () => apply('copy') }));
    const set = el('button', { class: 'btn small', html: icon('settings', 14) + ' AI settings', onclick: settings });
    mode(); body.append(info, el('div', { class: 'side-sec', style: { marginTop: '12px' } }, el('h4', { text: 'Selected text or whole document' }), chips), el('div', { class: 'side-sec' }, prompt, el('div', { class: 'side-row', style: { marginTop: '6px' } }, ask)), outBox, acts, set);
  }
  function settings() {
    const mode = el('select', { class: 'input' }, el('option', { value: 'local', text: 'Offline (rule-based, private)' }), el('option', { value: 'proxy', text: 'My backend proxy (generative AI)' })); mode.value = AI.cfg.mode; const ep = el('input', { class: 'input', type: 'url', placeholder: 'https://your-server.example.com/api/ai', value: AI.cfg.endpoint });
    const dlg = WX.ui.dialog({ title: 'AI settings', width: '520px', body: el('div', { class: 'form' }, el('label', null, 'Mode', mode), el('label', null, 'Backend endpoint (POST)', ep), el('div', { class: 'ai-note', html: 'WordX never stores or sends an API key. Your server holds the key and calls the model; WordX posts <code>{action, text, prompt, options}</code> and expects <code>{text}</code> back. A ready-to-run example is in <code>server/proxy-example.js</code>.' })),
      buttons: [{ label: 'Test connection', onClick: async () => { const c = Object.assign({}, AI.cfg); AI.cfg = { mode: 'proxy', endpoint: ep.value.trim() }; try { const r = await AI.run('custom', 'ping', 'Reply with OK'); WX.ui.toast('Backend replied: ' + r.slice(0, 60), 'success'); } catch (e) { WX.ui.toast(e.message, 'error', 6000); } AI.cfg = c; return false; } }, { label: 'Cancel' }, { label: 'Save', primary: true, onClick: () => { AI.cfg = { mode: mode.value, endpoint: ep.value.trim() }; if (AI.cfg.mode === 'proxy' && !/^https?:\/\//.test(AI.cfg.endpoint)) { WX.ui.toast('Enter a full http(s) URL.', 'error'); return false; } save(); WX.side.refresh(); WX.ui.toast('AI settings saved.', 'success'); } }] });
  }
  WX.act.toggleAI = () => WX.side.toggle('ai', 'AI assistant', panel);
  WX.act.aiSettings = settings;
})();
