/* WordX – insert.js
 * Insert-tab objects: shapes, icons, symbols, equations (MathML), charts (SVG),
 * SmartArt-like diagrams, text boxes, bookmarks and date/time. Objects are inline
 * <span class="wx-obj"> elements holding SVG + a JSON description so they stay editable. */
(function () {
  'use strict';
  const WX = window.WX; const { el, esc, icon } = WX.util; const E = () => WX.editor;
  const N = (WX.insert = {});
  const PAL = ['#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47', '#264478', '#9e480e'];
  const svgWrap = (vb, inner, extra) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="100%" height="100%" ${extra || ''}>${inner}</svg>`;
  const RENDER = {};

  function make(kind, data, w, h) {
    const s = el('span', { class: 'wx-obj', contenteditable: 'false', 'data-kind': kind, style: { width: w + 'px', height: h + 'px' } });
    s.setAttribute('data-json', JSON.stringify(data)); RENDER[kind](s, data); return s;
  }
  const dataOf = (s) => { try { return JSON.parse(s.getAttribute('data-json')); } catch (e) { return {}; } };
  const place = (s) => { E().insertInline(s); WX.images.select(s); WX.page.schedule(); };
  const update = (s, d) => { E().run(() => { s.setAttribute('data-json', JSON.stringify(d)); RENDER[s.dataset.kind](s, d); }); WX.images.select(s); };

  /* ---------- shapes ---------- */
  const star = () => { let p = []; for (let k = 0; k < 10; k++) { const a = (-90 + k * 36) * Math.PI / 180, r = k % 2 ? 20 : 48; p.push((50 + r * Math.cos(a)).toFixed(1) + ',' + (50 + r * Math.sin(a)).toFixed(1)); } return p.join(' '); };
  const SHAPES = {
    rect: ['Rectangle', (a) => `<rect x="2" y="2" width="96" height="96" ${a}/>`], rounded: ['Rounded rectangle', (a) => `<rect x="2" y="2" width="96" height="96" rx="16" ${a}/>`],
    ellipse: ['Oval', (a) => `<ellipse cx="50" cy="50" rx="48" ry="48" ${a}/>`], triangle: ['Triangle', (a) => `<polygon points="50,3 97,97 3,97" ${a}/>`],
    rtriangle: ['Right triangle', (a) => `<polygon points="3,3 97,97 3,97" ${a}/>`], diamond: ['Diamond', (a) => `<polygon points="50,3 97,50 50,97 3,50" ${a}/>`],
    pentagon: ['Pentagon', (a) => `<polygon points="50,3 97,38 79,95 21,95 3,38" ${a}/>`], hexagon: ['Hexagon', (a) => `<polygon points="25,5 75,5 97,50 75,95 25,95 3,50" ${a}/>`],
    star: ['Star', (a) => `<polygon points="${star()}" ${a}/>`], arrowR: ['Right arrow', (a) => `<polygon points="3,35 60,35 60,8 97,50 60,92 60,65 3,65" ${a}/>`],
    arrowL: ['Left arrow', (a) => `<polygon points="97,35 40,35 40,8 3,50 40,92 40,65 97,65" ${a}/>`], arrowU: ['Up arrow', (a) => `<polygon points="35,97 35,40 8,40 50,3 92,40 65,40 65,97" ${a}/>`],
    plus: ['Cross', (a) => `<polygon points="35,3 65,3 65,35 97,35 97,65 65,65 65,97 35,97 35,65 3,65 3,35 35,35" ${a}/>`], heart: ['Heart', (a) => `<path d="M50 90 C10 60 3 35 20 20 C33 9 46 16 50 28 C54 16 67 9 80 20 C97 35 90 60 50 90Z" ${a}/>`],
    callout: ['Speech bubble', (a) => `<path d="M6 8 H94 V68 H40 L20 92 V68 H6 Z" ${a}/>`], line: ['Line', (a) => `<line x1="3" y1="97" x2="97" y2="3" ${a}/>`],
  };
  N.SHAPES = SHAPES;
  RENDER.shape = (s, d) => {
    const a = `fill="${d.fill || 'none'}" stroke="${d.stroke || 'none'}" stroke-width="${d.sw == null ? 2 : d.sw}" vector-effect="non-scaling-stroke" stroke-linejoin="round"`;
    const t = d.text ? `<text x="50" y="52" text-anchor="middle" dominant-baseline="middle" font-size="13" font-family="Arial" fill="${d.tc || '#fff'}">${esc(d.text)}</text>` : '';
    s.innerHTML = svgWrap('0 0 100 100', SHAPES[d.shape][1](a) + t, 'preserveAspectRatio="none"');
  };
  N.insertShape = (id) => place(make('shape', { shape: id, fill: id === 'line' ? 'none' : '#4472c4', stroke: '#2f5496', sw: 2, text: '', tc: '#ffffff' }, id === 'line' ? 160 : 130, id === 'line' ? 60 : 100));
  N.shapesMenu = function (anchor) {
    const g = el('div', { class: 'grid-pick', style: { gridTemplateColumns: 'repeat(6,44px)', gap: '6px' } });
    Object.keys(SHAPES).forEach((k) => { const b = el('button', { class: 'btn small', 'data-tip': SHAPES[k][0], style: { width: '44px', height: '40px', padding: '4px', justifyContent: 'center' }, onclick: () => { WX.ui.closeMenu(); N.insertShape(k); } }); b.innerHTML = svgWrap('0 0 100 100', SHAPES[k][1]('fill="#4472c4" stroke="#2f5496" stroke-width="4"'), 'width="28" height="28"'); g.append(b); });
    WX.ui.popover(anchor, el('div', null, el('div', { class: 'grid-lab', text: 'Shapes' }), g));
  };
  function editShape(s) {
    const d = dataOf(s);
    WX.ui.dialog({ title: 'Format shape', width: '400px', body: `<div class="form"><label>Fill colour <input type="color" id="sh-f" value="${d.fill && d.fill !== 'none' ? d.fill : '#4472c4'}"> <span><input type="checkbox" id="sh-nf" ${d.fill === 'none' ? 'checked' : ''}> No fill</span></label>
      <label>Outline <input type="color" id="sh-s" value="${d.stroke && d.stroke !== 'none' ? d.stroke : '#2f5496'}"></label><label>Outline width <input class="input" type="number" id="sh-w" min="0" max="20" value="${d.sw == null ? 2 : d.sw}"></label>
      <label>Text <input class="input" id="sh-t" value="${esc(d.text || '')}"></label><label>Text colour <input type="color" id="sh-tc" value="${d.tc || '#ffffff'}"></label></div>`,
      buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, onClick: (x) => update(s, Object.assign(d, { fill: x.$('#sh-nf').checked ? 'none' : x.$('#sh-f').value, stroke: x.$('#sh-s').value, sw: +x.$('#sh-w').value, text: x.$('#sh-t').value, tc: x.$('#sh-tc').value })) }] });
  }

  /* ---------- icons ---------- */
  RENDER.icon = (s, d) => { s.innerHTML = svgWrap('0 0 24 24', window.WX_ICONS[d.name] || '', `fill="none" stroke="${d.color}" stroke-width="${d.sw || 2}" stroke-linecap="round" stroke-linejoin="round"`); };
  N.iconDialog = function () {
    const names = Object.keys(window.WX_ICONS); let pick = names[0];
    const body = el('div', { class: 'form' }); const q = el('input', { class: 'input', placeholder: 'Search icons' }); const grid = el('div', { class: 'sym-grid', style: { gridTemplateColumns: 'repeat(8,1fr)', maxHeight: '240px', overflow: 'auto' } });
    const col = el('input', { type: 'color', value: '#2f5496' }), size = el('input', { class: 'input', type: 'number', value: 48, min: 12, max: 400, style: { width: '80px' } });
    const draw = () => { grid.innerHTML = ''; names.filter((n) => n.includes(q.value.toLowerCase())).forEach((n) => grid.append(el('button', { title: n, class: n === pick ? 'sel' : '', style: n === pick ? { background: 'var(--accent-soft)', borderColor: 'var(--accent)' } : null, html: icon(n, 22), onclick: () => { pick = n; draw(); } }))); };
    q.addEventListener('input', draw); draw(); body.append(q, grid, el('div', { class: 'side-row' }, 'Colour ', col, ' Size (px) ', size));
    WX.ui.dialog({ title: 'Insert icon', width: '480px', body, buttons: [{ label: 'Cancel' }, { label: 'Insert', primary: true, onClick: () => { const z = +size.value || 48; place(make('icon', { name: pick, color: col.value, sw: 2 }, z, z)); } }] });
  };
  function editIcon(s) { const d = dataOf(s); WX.ui.dialog({ title: 'Icon colour', width: '320px', body: `<div class="form"><label>Colour <input type="color" id="ic-c" value="${d.color}"></label></div>`, buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, onClick: (x) => update(s, Object.assign(d, { color: x.$('#ic-c').value })) }] }); }

  /* ---------- symbols ---------- */
  const SYMS = { Common: '© ® ™ § ¶ † ‡ • … – — ‘ ’ “ ” « » ¡ ¿ ° ′ ″ ‰ № ℓ ✓ ✗ ★ ☆ ♥ ♦ ♣ ♠ ☺ ☎ ✉ ✂', Math: '± × ÷ ≠ ≈ ≤ ≥ ∞ √ ∛ ∑ ∏ ∫ ∂ ∆ ∇ ∈ ∉ ⊂ ⊃ ∪ ∩ ∧ ∨ ¬ ∀ ∃ ∅ ∝ ∴ ∵ ⊕ ⊗ ⊥ ∥ ∠ ¼ ½ ¾ ⅓ ⅔ ² ³ ⁿ ‰ π', Greek: 'α β γ δ ε ζ η θ ι κ λ μ ν ξ ο π ρ σ τ υ φ χ ψ ω Α Β Γ Δ Ε Ζ Η Θ Λ Ξ Π Σ Φ Ψ Ω', Arrows: '← → ↑ ↓ ↔ ↕ ⇐ ⇒ ⇑ ⇓ ⇔ ↩ ↪ ↗ ↘ ↙ ↖ ➔ ➜ ➤ ▲ ▼ ◄ ►', Currency: '$ € £ ¥ ¢ ₹ ₽ ₩ ₪ ₫ ₿ ฿ ₺ ₴ ₦', Latin: 'À Á Â Ã Ä Å Æ Ç È É Ê Ë Ì Í Î Ï Ñ Ò Ó Ô Õ Ö Ø Ù Ú Û Ü Ý ß à á â ã ä å æ ç è é ê ë ì í î ï ñ ò ó ô õ ö ø ù ú û ü ý ÿ' };
  N.symbolDialog = function () {
    const body = el('div', { class: 'form' }); const sel = el('select', { class: 'input' }, Object.keys(SYMS).map((k) => el('option', { text: k }))); const grid = el('div', { class: 'sym-grid' });
    const draw = () => { grid.innerHTML = ''; SYMS[sel.value].split(' ').forEach((c) => grid.append(el('button', { text: c, onmousedown: (e) => e.preventDefault(), onclick: () => E().insertText(c) }))); }; sel.addEventListener('change', draw); draw();
    WX.ui.dialog({ title: 'Insert symbol', width: '520px', body: (body.append(sel, grid, el('p', { class: 'muted', text: 'Click a symbol to insert it at the cursor.' })), body), buttons: [{ label: 'Close' }], noFocus: true });
  };

  /* ---------- equations: linear syntax -> MathML ---------- */
  const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', omega: 'ω', Delta: 'Δ', Sigma: 'Σ', Omega: 'Ω', infty: '∞', inf: '∞', times: '×', cdot: '·', pm: '±', leq: '≤', geq: '≥', neq: '≠', approx: '≈', partial: '∂', nabla: '∇', to: '→' };
  const BIG = { sum: '∑', prod: '∏', int: '∫', lim: 'lim' };
  function tokenize(s) { const t = []; const re = /\s*(\\?[A-Za-z]+|\d+(?:\.\d+)?|<=|>=|!=|\+-|->|\S)/g; let m; while ((m = re.exec(s))) t.push(m[1].replace(/^\\/, '')); return t; }
  function mathml(src) {
    const t = tokenize(src); let i = 0; const peek = () => t[i], next = () => t[i++];
    const OPS = { '<=': '≤', '>=': '≥', '!=': '≠', '+-': '±', '->': '→', '*': '·' };
    function atom() {
      const k = next(); if (k == null) return '<mrow/>';
      if (k === '(') { const e = seq(')'); if (peek() === ')') next(); return { group: e }; }
      if (/^\d/.test(k)) return `<mn>${k}</mn>`;
      if (k === 'sqrt') { const a = atom(); return `<msqrt>${str(a, true)}</msqrt>`; }
      if (k === 'root') { const a = atom(), b = atom(); return `<mroot>${str(b, true)}${str(a, true)}</mroot>`; }
      if (BIG[k]) return { big: k };
      if (GREEK[k]) return `<mi>${GREEK[k]}</mi>`;
      if (OPS[k]) return `<mo>${OPS[k]}</mo>`;
      if (/^[A-Za-z]+$/.test(k)) return k.length === 1 ? `<mi>${k}</mi>` : `<mi mathvariant="normal">${k}</mi>`;
      return `<mo>${esc(k)}</mo>`;
    }
    const str = (a, strip) => typeof a === 'string' ? a : a.group != null ? (strip ? a.group : `<mo>(</mo>${a.group}<mo>)</mo>`) : a.big ? `<mo>${BIG[a.big]}</mo>` : '';
    function scripts() {
      let base = atom();
      while (peek() === '^' || peek() === '_') {
        let sub = null, sup = null;
        while (peek() === '^' || peek() === '_') { const o = next(); const a = str(atom(), true); o === '^' ? (sup = a) : (sub = a); }
        const b = str(base); const big = base && base.big;
        base = big && big !== 'int' ? (sub && sup ? `<munderover>${b}${sub}${sup}</munderover>` : sub ? `<munder>${b}${sub}</munder>` : `<mover>${b}${sup}</mover>`) : sub && sup ? `<msubsup>${b}${sub}${sup}</msubsup>` : sub ? `<msub>${b}${sub}</msub>` : `<msup>${b}${sup}</msup>`;
      }
      return base;
    }
    function frac() { let l = scripts(); while (peek() === '/') { next(); const r = scripts(); l = `<mfrac>${str(l, true)}${str(r, true)}</mfrac>`; } return l; }
    function seq(end) { let o = ''; while (i < t.length && peek() !== end) o += str(frac()); return o; }
    return `<math xmlns="http://www.w3.org/1998/Math/MathML">${seq()}</math>`;
  }
  RENDER.eq = (s, d) => { s.innerHTML = mathml(d.src); s.style.width = ''; s.style.height = ''; s.classList.add('wx-eq'); s.setAttribute('data-src', d.src); };
  N.equationDialog = function (existing) {
    const d = existing ? dataOf(existing) : { src: '' };
    const tpl = [['a/b', 'Fraction'], ['x^2', 'Power'], ['x_i', 'Subscript'], ['sqrt(x)', 'Square root'], ['root(3, x)', 'Root'], ['sum_(i=1)^n i', 'Sum'], ['int_0^1 x dx', 'Integral'], ['lim_(x->0) sin(x)/x', 'Limit'], ['(-b +- sqrt(b^2 - 4ac))/(2a)', 'Quadratic'], ['E = mc^2', 'E = mc²'], ['alpha + beta <= pi', 'Greek']];
    const inp = el('textarea', { rows: 2, class: 'input', placeholder: 'e.g. (a+b)/c   x^2   sqrt(x)   sum_(i=1)^n i' }); inp.value = d.src; const prev = el('div', { class: 'card', style: { fontSize: '22px', minHeight: '56px', textAlign: 'center', color: 'var(--text)' } });
    const draw = () => { prev.innerHTML = inp.value.trim() ? mathml(inp.value) : '<span class="muted" style="font-size:13px">Preview</span>'; }; inp.addEventListener('input', draw); draw();
    const row = el('div', { class: 'side-row' }, tpl.map(([s, l]) => el('button', { class: 'ai-chip', text: l, onclick: () => { inp.value = s; draw(); inp.focus(); } })));
    WX.ui.dialog({ title: existing ? 'Edit equation' : 'Insert equation', width: '560px', body: el('div', { class: 'form' }, el('label', null, 'Equation (linear format)', inp), prev, row, el('p', { class: 'muted', text: 'Use / for fractions, ^ and _ for scripts, sqrt(), root(n, x), sum, int, lim, and Greek names such as alpha, pi, theta.' })),
      buttons: [{ label: 'Cancel' }, { label: existing ? 'Update' : 'Insert', primary: true, onClick: () => { const v = inp.value.trim(); if (!v) return false; if (existing) update(existing, { src: v }); else { const s = el('span', { class: 'wx-obj wx-eq', contenteditable: 'false', 'data-kind': 'eq' }); s.setAttribute('data-json', JSON.stringify({ src: v })); RENDER.eq(s, { src: v }); place(s); } } }] });
  };

  /* ---------- charts ---------- */
  const parseCSV = (csv) => csv.trim().split(/\n/).map((l) => l.split(/[,\t;]/).map((c) => c.trim()));
  function chartSVG(d) {
    const rows = parseCSV(d.csv); let head = rows[0]; const hasHead = isNaN(parseFloat(head[1])); const body = hasHead ? rows.slice(1) : rows; if (!hasHead) head = ['', ...body[0].slice(1).map((_, i) => 'Series ' + (i + 1))];
    const labels = body.map((r) => r[0]), ns = Math.max(1, head.length - 1); const S = []; for (let k = 1; k <= ns; k++) S.push(body.map((r) => parseFloat(r[k]) || 0));
    const W = 480, H = 300, l = 46, r = 14, t = d.title ? 40 : 16, b = (ns > 1 || d.type === 'pie' ? 56 : 40); const pw = W - l - r, ph = H - t - b; let g = '';
    if (d.title) g += `<text x="${W / 2}" y="24" text-anchor="middle" font-size="16" font-weight="600" fill="#333">${esc(d.title)}</text>`;
    if (d.type === 'pie') {
      const vals = S[0].map((v) => Math.max(0, v)), tot = vals.reduce((a, c) => a + c, 0) || 1; const cx = 170, cy = t + (H - t - 16) / 2, R = Math.min(110, (H - t - 24) / 2); let a0 = -Math.PI / 2;
      vals.forEach((v, i) => { const a1 = a0 + v / tot * 2 * Math.PI; const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0), x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1); g += vals.length === 1 || v / tot > 0.9999 ? `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${PAL[i % 8]}"/>` : `<path d="M${cx} ${cy} L${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}Z" fill="${PAL[i % 8]}" stroke="#fff" stroke-width="1.5"/>`; a0 = a1; });
      labels.forEach((lb, i) => { g += `<rect x="320" y="${t + 6 + i * 20}" width="12" height="12" fill="${PAL[i % 8]}"/><text x="338" y="${t + 16 + i * 20}" font-size="12" fill="#333">${esc(lb.slice(0, 18))} (${Math.round(vals[i] / tot * 100)}%)</text>`; });
      return svgWrap(`0 0 ${W} ${H}`, g, 'font-family="Arial,sans-serif"');
    }
    const max = Math.max(1, ...S.flat()); const step = niceStep(max / 5); const top = Math.ceil(max / step) * step;
    for (let v = 0; v <= top + 1e-9; v += step) { const y = t + ph - v / top * ph; g += `<line x1="${l}" x2="${W - r}" y1="${y}" y2="${y}" stroke="#ddd"/><text x="${l - 6}" y="${y + 4}" text-anchor="end" font-size="11" fill="#666">${+v.toFixed(2)}</text>`; }
    const n = labels.length, gw = pw / n;
    if (d.type === 'line') {
      S.forEach((s, k) => { const pts = s.map((v, i) => `${(l + gw * (i + 0.5)).toFixed(1)},${(t + ph - v / top * ph).toFixed(1)}`); g += `<polyline points="${pts.join(' ')}" fill="none" stroke="${PAL[k % 8]}" stroke-width="2.5"/>` + pts.map((p) => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="3.5" fill="${PAL[k % 8]}"/>`).join(''); });
    } else {
      const bw = gw * 0.72 / ns; S.forEach((s, k) => s.forEach((v, i) => { const h = v / top * ph; g += `<rect x="${(l + gw * i + gw * 0.14 + bw * k).toFixed(1)}" y="${(t + ph - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${PAL[k % 8]}"/>`; }));
    }
    labels.forEach((lb, i) => { g += `<text x="${l + gw * (i + 0.5)}" y="${t + ph + 16}" text-anchor="middle" font-size="11" fill="#444">${esc(lb.slice(0, Math.max(5, Math.floor(gw / 6))))}</text>`; });
    g += `<line x1="${l}" x2="${W - r}" y1="${t + ph}" y2="${t + ph}" stroke="#888"/>`;
    if (ns > 1) head.slice(1).forEach((h, k) => { g += `<rect x="${l + k * 100}" y="${H - 18}" width="10" height="10" fill="${PAL[k % 8]}"/><text x="${l + 14 + k * 100}" y="${H - 9}" font-size="11" fill="#333">${esc(h.slice(0, 12))}</text>`; });
    return svgWrap(`0 0 ${W} ${H}`, g, 'font-family="Arial,sans-serif"');
  }
  function niceStep(x) { const p = Math.pow(10, Math.floor(Math.log10(x || 1))); const m = x / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
  RENDER.chart = (s, d) => { s.innerHTML = chartSVG(d); };
  N.chartDialog = function (existing) {
    const d = existing ? dataOf(existing) : { type: 'bar', title: 'Sales by quarter', csv: 'Quarter,2024,2025\nQ1,12,15\nQ2,18,21\nQ3,14,19\nQ4,22,27' };
    const type = el('select', { class: 'input' }, ['bar', 'line', 'pie'].map((t) => el('option', { value: t, text: { bar: 'Column chart', line: 'Line chart', pie: 'Pie chart' }[t], selected: d.type === t }))); const title = el('input', { class: 'input', value: d.title }); const csv = el('textarea', { rows: 7, class: 'input', style: { fontFamily: 'monospace' } }); csv.value = d.csv; const prev = el('div', { class: 'card', style: { height: '220px', background: '#fff' } });
    const draw = () => { try { prev.innerHTML = chartSVG({ type: type.value, title: title.value, csv: csv.value }); } catch (e) { prev.textContent = 'Check the data format.'; } }; [type, title, csv].forEach((x) => x.addEventListener('input', draw)); draw();
    WX.ui.dialog({ title: existing ? 'Edit chart' : 'Insert chart', width: '600px', body: el('div', { class: 'form' }, el('label', null, 'Chart type', type), el('label', null, 'Title', title), el('label', null, 'Data (first row = series names; first column = categories)', csv), prev),
      buttons: [{ label: 'Cancel' }, { label: existing ? 'Update' : 'Insert', primary: true, onClick: () => { const nd = { type: type.value, title: title.value, csv: csv.value }; try { chartSVG(nd); } catch (e) { WX.ui.toast('Chart data is invalid.', 'error'); return false; } existing ? update(existing, nd) : place(make('chart', nd, 480, 300)); } }] });
  };

  /* ---------- SmartArt-like diagrams ---------- */
  const wrapTxt = (s, n) => { const w = s.split(/\s+/), out = []; let l = ''; w.forEach((x) => { if ((l + ' ' + x).trim().length > n && l) { out.push(l); l = x; } else l = (l + ' ' + x).trim(); }); if (l) out.push(l); return out.slice(0, 4); };
  const label = (cx, cy, s, n, fill) => { const ls = wrapTxt(s, n); return `<text text-anchor="middle" font-size="13" fill="${fill || '#fff'}" font-weight="600">${ls.map((x, i) => `<tspan x="${cx}" y="${cy + (i - (ls.length - 1) / 2) * 15 + 4}">${esc(x)}</tspan>`).join('')}</text>`; };
  const THEMES = { blue: ['#4472c4', '#2f5496'], green: ['#70ad47', '#507e32'], orange: ['#ed7d31', '#c55a11'], purple: ['#7030a0', '#4f2270'] };
  function diagramSVG(d) {
    const items = d.items.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 12); const [c1, c2] = THEMES[d.theme] || THEMES.blue; let g = '', W = 480, H = 200;
    const defs = `<defs><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#666"/></marker></defs>`; const n = items.length; if (!n) return svgWrap('0 0 480 100', '');
    if (d.layout === 'process') {
      const per = Math.min(n, 4), rows = Math.ceil(n / per), bw = (W - 20 - (per - 1) * 34) / per, bh = 64; H = rows * (bh + 30) + 10;
      items.forEach((s, i) => { const r = Math.floor(i / per), c = i % per, x = 10 + c * (bw + 34), y = 10 + r * (bh + 30); g += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="8" fill="${i % 2 ? c2 : c1}"/>` + label(x + bw / 2, y + bh / 2, s, Math.floor(bw / 7.5)); if (i < n - 1 && c < per - 1) g += `<line x1="${x + bw + 4}" y1="${y + bh / 2}" x2="${x + bw + 30}" y2="${y + bh / 2}" stroke="#666" stroke-width="2" marker-end="url(#ar)"/>`; });
    } else if (d.layout === 'list') {
      const bh = 40; H = n * (bh + 8) + 4; items.forEach((s, i) => { const y = 4 + i * (bh + 8); g += `<rect x="10" y="${y}" width="${W - 20}" height="${bh}" rx="6" fill="${i % 2 ? c2 : c1}"/><text x="${W / 2}" y="${y + bh / 2 + 5}" text-anchor="middle" font-size="14" font-weight="600" fill="#fff">${esc(s.slice(0, 60))}</text>`; });
    } else if (d.layout === 'cycle') {
      H = 300; const cx = W / 2, cy = H / 2, R = 100, bw = 96, bh = 44; items.forEach((s, i) => { const a = -Math.PI / 2 + i / n * 2 * Math.PI, x = cx + R * 1.5 * Math.cos(a), y = cy + R * Math.sin(a) * 1.05; const a2 = -Math.PI / 2 + (i + 1) / n * 2 * Math.PI; const mx = cx + R * 1.5 * Math.cos((a + a2) / 2), my = cy + R * 1.05 * Math.sin((a + a2) / 2); g += `<path d="M${(x).toFixed(1)} ${(y).toFixed(1)} L${mx.toFixed(1)} ${my.toFixed(1)}" stroke="#666" stroke-width="2" marker-end="url(#ar)" fill="none"/>`; });
      items.forEach((s, i) => { const a = -Math.PI / 2 + i / n * 2 * Math.PI, x = cx + R * 1.5 * Math.cos(a), y = cy + R * 1.05 * Math.sin(a); g += `<rect x="${x - bw / 2}" y="${y - bh / 2}" width="${bw}" height="${bh}" rx="8" fill="${i % 2 ? c2 : c1}"/>` + label(x, y, s, 13); });
    } else if (d.layout === 'hierarchy') {
      H = 210; const kids = items.slice(1), bw = Math.min(110, (W - 20 - (kids.length - 1) * 12) / Math.max(1, kids.length)), tw = kids.length * bw + (kids.length - 1) * 12, x0 = (W - tw) / 2;
      g += `<rect x="${W / 2 - 70}" y="8" width="140" height="48" rx="8" fill="${c2}"/>` + label(W / 2, 32, items[0], 18);
      kids.forEach((s, i) => { const x = x0 + i * (bw + 12); g += `<path d="M${W / 2} 56 V100 H${x + bw / 2} V128" fill="none" stroke="#666" stroke-width="1.8"/><rect x="${x}" y="128" width="${bw}" height="56" rx="8" fill="${c1}"/>` + label(x + bw / 2, 156, s, Math.floor(bw / 7.5)); });
    } else { // pyramid
      const lh = 46; H = n * lh + 8; items.forEach((s, i) => { const y = 4 + i * lh, topW = (i / n) * (W - 40) + 30, botW = ((i + 1) / n) * (W - 40) + 30; g += `<polygon points="${W / 2 - topW / 2},${y} ${W / 2 + topW / 2},${y} ${W / 2 + botW / 2},${y + lh - 3} ${W / 2 - botW / 2},${y + lh - 3}" fill="${i % 2 ? c2 : c1}"/><text x="${W / 2}" y="${y + lh / 2 + 3}" text-anchor="middle" font-size="13" font-weight="600" fill="#fff">${esc(s.slice(0, 34))}</text>`; });
    }
    return svgWrap(`0 0 ${W} ${H}`, defs + g, 'font-family="Arial,sans-serif"');
  }
  RENDER.diagram = (s, d) => { s.innerHTML = diagramSVG(d); const m = /viewBox="0 0 480 (\d+)"/.exec(s.innerHTML); if (m && !s.dataset.sized) { s.style.height = Math.round(parseInt(s.style.width) * (+m[1]) / 480) + 'px'; } };
  N.diagramDialog = function (existing) {
    const d = existing ? dataOf(existing) : { layout: 'process', theme: 'blue', items: 'Plan\nDesign\nBuild\nLaunch' };
    const lay = el('select', { class: 'input' }, [['process', 'Basic process'], ['list', 'Vertical list'], ['cycle', 'Cycle'], ['hierarchy', 'Hierarchy (first line = top)'], ['pyramid', 'Pyramid']].map(([v, l]) => el('option', { value: v, text: l, selected: d.layout === v })));
    const th = el('select', { class: 'input' }, Object.keys(THEMES).map((v) => el('option', { value: v, text: v, selected: d.theme === v }))); const it = el('textarea', { rows: 6, class: 'input' }); it.value = d.items; const prev = el('div', { class: 'card', style: { background: '#fff', maxHeight: '240px', overflow: 'auto' } });
    const draw = () => { prev.innerHTML = diagramSVG({ layout: lay.value, theme: th.value, items: it.value }); const s = prev.querySelector('svg'); if (s) { s.removeAttribute('height'); } }; [lay, th, it].forEach((x) => x.addEventListener('input', draw)); draw();
    WX.ui.dialog({ title: existing ? 'Edit diagram' : 'Insert diagram', width: '560px', body: el('div', { class: 'form' }, el('label', null, 'Layout', lay), el('label', null, 'Colour', th), el('label', null, 'Items (one per line)', it), prev),
      buttons: [{ label: 'Cancel' }, { label: existing ? 'Update' : 'Insert', primary: true, onClick: () => { const nd = { layout: lay.value, theme: th.value, items: it.value }; if (!it.value.trim()) return false; if (existing) { delete existing.dataset.sized; update(existing, nd); } else { const s = make('diagram', nd, 480, 200); place(s); } } }] });
  };

  /* ---------- text box, bookmark, date/time ---------- */
  N.textBox = function () { if (!E().isEditable()) return; const t = el('div', { class: 'wx-textbox' }, el('p', { text: 'Text box' })); E().insertBlock(t); const p = t.querySelector('p'); const r = document.createRange(); r.selectNodeContents(p); E().setRange(r); };
  N.bookmarkDialog = function () {
    const e = E(); e.restore(); const saved = e.saveSel(); const list = () => Array.from(e.el.querySelectorAll('a.wx-bookmark[id]'));
    const inp = el('input', { class: 'input', placeholder: 'Bookmark name (letters, numbers, _)' }); const box = el('div', { class: 'list-box' });
    const draw = () => { box.innerHTML = ''; const l = list(); if (!l.length) box.append(el('div', { class: 'list-row muted', text: 'No bookmarks yet.' })); l.forEach((b) => box.append(el('div', { class: 'list-row' }, el('span', { style: { flex: 1 }, text: b.id }), el('button', { class: 'btn small', text: 'Go to', onclick: () => { e.scrollTo(b); } }), el('button', { class: 'btn small danger', text: 'Delete', onclick: () => { e.run(() => b.remove()); draw(); } })))); }; draw();
    WX.ui.dialog({ title: 'Bookmarks', width: '460px', body: el('div', { class: 'form' }, inp, box), buttons: [{ label: 'Close' }, { label: 'Add', primary: true, onClick: () => { const n = inp.value.trim().replace(/\s+/g, '_'); if (!/^[A-Za-z][\w-]*$/.test(n)) { WX.ui.toast('Use a name that starts with a letter (letters, digits, _ or -).', 'error'); return false; } if (e.el.querySelector('[id="' + n + '"]')) { WX.ui.toast('That name is already used.', 'error'); return false; } e.loadSel(saved); e.insertInline(el('a', { class: 'wx-bookmark', id: n })); } }] });
  };
  N.dateDialog = function () {
    const now = new Date(); const f = [now.toLocaleDateString(), now.toLocaleDateString(undefined, { dateStyle: 'full' }), now.toLocaleDateString(undefined, { dateStyle: 'long' }), now.toISOString().slice(0, 10), now.toLocaleTimeString(), now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), now.toLocaleString(), now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })];
    let sel = f[0]; const box = el('div', { class: 'list-box' }, f.map((x, i) => el('div', { class: 'list-row' + (i ? '' : ' sel'), text: x, onclick: (ev) => { sel = x; box.querySelectorAll('.list-row').forEach((r) => r.classList.remove('sel')); ev.currentTarget.classList.add('sel'); }, ondblclick: () => { E().insertText(x); document.querySelector('.modal-back .modal-head .icon-btn').click(); } })));
    WX.ui.dialog({ title: 'Date and time', width: '400px', body: box, buttons: [{ label: 'Cancel' }, { label: 'Insert', primary: true, onClick: () => E().insertText(sel) }] });
  };

  N.edit = function (s) { const k = s.dataset.kind; if (!E().isEditable()) return; ({ shape: editShape, icon: editIcon, eq: N.equationDialog, chart: N.chartDialog, diagram: N.diagramDialog })[k](s); };
  /** Re-render loaded objects (after import) so older HTML still shows. */
  Object.assign(WX.act, { insertShapesMenu: (a) => N.shapesMenu(a), insertIcon: N.iconDialog, insertSymbol: N.symbolDialog, insertEquation: () => N.equationDialog(), insertChart: () => N.chartDialog(), insertSmartArt: () => N.diagramDialog(), insertTextBox: N.textBox, insertBookmark: N.bookmarkDialog, insertDateTime: N.dateDialog });
})();
