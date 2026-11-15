/* WordX – file-import.js
 * Import .docx (exact restore for WordX-made files, mammoth conversion for others),
 * .pdf (text extraction via pdf.js), .txt/.md, .html and .wordx packages. */
(function () {
  'use strict';
  const WX = window.WX; const { esc } = WX.util;
  const F = (WX.fileio = {});
  const base = (n) => (n || 'Untitled').replace(/\.[^.]+$/, '');
  const ext = (n) => ((n || '').split('.').pop() || '').toLowerCase();

  F.parseText = (t, md) => {
    const lines = t.replace(/\r\n?/g, '\n').split('\n'); let html = '', list = null;
    const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
    lines.forEach((l) => {
      if (md) { let m;
        if ((m = /^(#{1,4})\s+(.*)$/.exec(l))) { closeList(); html += `<h${m[1].length}>${inl(m[2])}</h${m[1].length}>`; return; }
        if ((m = /^\s*[-*+]\s+(.*)$/.exec(l))) { if (list !== 'ul') { closeList(); html += '<ul>'; list = 'ul'; } html += `<li>${inl(m[1])}</li>`; return; }
        if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(l))) { if (list !== 'ol') { closeList(); html += '<ol>'; list = 'ol'; } html += `<li>${inl(m[1])}</li>`; return; }
        if (/^---+$/.test(l.trim())) { closeList(); html += '<hr>'; return; }
      }
      closeList(); html += `<p>${md ? inl(l) : esc(l)}</p>`.replace('<p></p>', '<p><br></p>');
    }); closeList(); return html;
  };
  const inl = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|\W)\*(.+?)\*/g, '$1<em>$2</em>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/\[(.+?)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');

  async function parseDocx(file) {
    const buf = await WX.util.readFile(file, 'arrayBuffer'); const zip = await JSZip.loadAsync(buf);
    const src = zip.file('docProps/wordx.json');
    if (src) { try { const j = JSON.parse(await src.async('string')); if (j && j.content != null) return { title: j.title || base(file.name), content: WX.util.sanitize(j.content), settings: j.settings, meta: j.meta, exact: true }; } catch (e) { /* fall through to mammoth */ } }
    const opts = { arrayBuffer: buf, styleMap: ["p[style-name='Title'] => p.wx-title:fresh", "p[style-name='Subtitle'] => p.wx-subtitle:fresh", "p[style-name='Quote'] => p.wx-quote:fresh", "p[style-name='Intense Quote'] => p.wx-intense:fresh", "p[style-name='Caption'] => p.wx-caption:fresh", "p[style-name='Heading 4'] => h4:fresh", "u => u"],
      convertImage: mammoth.images.imgElement((img) => img.read('base64').then((d) => ({ src: `data:${img.contentType};base64,${d}` }))) };
    const r = await mammoth.convertToHtml(opts, opts); const d = document.createElement('div'); d.innerHTML = WX.util.sanitize(r.value);
    d.querySelectorAll('table').forEach((t) => t.classList.add('wx-t-grid')); d.querySelectorAll('td,th').forEach((c) => { if (!c.firstChild) c.innerHTML = '<br>'; });
    const out = { title: base(file.name), content: d.innerHTML, warnings: r.messages.filter((m) => m.type === 'warning').length };
    try { // page size / margins from the first section
      const x = await zip.file('word/document.xml').async('string'); const xd = new DOMParser().parseFromString(x, 'application/xml'); const secs = xd.getElementsByTagName('w:sectPr'); const sp = secs[secs.length - 1];
      if (sp) { const s = WX.editor.defaultSettings(); const sz = sp.getElementsByTagName('w:pgSz')[0], mg = sp.getElementsByTagName('w:pgMar')[0]; const px = (v) => Math.round((+v || 0) / 15);
        if (sz) { let w = px(sz.getAttribute('w:w')), h = px(sz.getAttribute('w:h')); const land = sz.getAttribute('w:orient') === 'landscape' || w > h; if (land) [w, h] = [h, w]; const best = Object.entries(WX.page.SIZES).sort((a, b) => Math.abs(a[1][0] - w) + Math.abs(a[1][1] - h) - Math.abs(b[1][0] - w) - Math.abs(b[1][1] - h))[0]; s.page.size = best[0]; s.page.orient = land ? 'landscape' : 'portrait'; }
        if (mg) s.page.margins = { t: px(mg.getAttribute('w:top')), r: px(mg.getAttribute('w:right')), b: px(mg.getAttribute('w:bottom')), l: px(mg.getAttribute('w:left')) }; out.settings = s; }
    } catch (e) { /* defaults are fine */ }
    return out;
  }
  async function parsePdf(file) {
    await WX.util.loadScript('js/vendor/pdf.min.js'); const lib = window.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdf.worker.min.js';
    const pdf = await lib.getDocument({ data: new Uint8Array(await WX.util.readFile(file, 'arrayBuffer')) }).promise; let html = ''; const heights = [];
    const pages = []; for (let p = 1; p <= pdf.numPages; p++) { const tc = await (await pdf.getPage(p)).getTextContent(); pages.push(tc.items.filter((i) => i.str !== undefined)); tc.items.forEach((i) => i.height && heights.push(i.height)); }
    heights.sort((a, b) => a - b); const med = heights[Math.floor(heights.length / 2)] || 10;
    pages.forEach((items, pi) => {
      const lines = []; items.forEach((it) => { const y = Math.round(it.transform[5]); let l = lines.find((x) => Math.abs(x.y - y) < 3); if (!l) lines.push((l = { y, parts: [], h: it.height })); l.parts.push({ x: it.transform[4], s: it.str }); l.h = Math.max(l.h, it.height); });
      lines.sort((a, b) => b.y - a.y); let para = '', prevY = null, prevH = med;
      const flush = () => { if (para.trim()) html += `<p>${esc(para.trim())}</p>`; para = ''; };
      lines.forEach((l) => { const txt = l.parts.sort((a, b) => a.x - b.x).map((p) => p.s).join(' ').replace(/\s+/g, ' ').trim(); if (!txt) return; const gap = prevY == null ? 0 : prevY - l.y;
        if (l.h > med * 1.35 && txt.length < 120) { flush(); html += `<h2>${esc(txt)}</h2>`; } else { if (prevY != null && gap > prevH * 1.8) flush(); para += (para ? ' ' : '') + txt; } prevY = l.y; prevH = l.h || med; }); flush();
      if (pi < pages.length - 1) html += '<div class="wx-pagebreak" contenteditable="false" data-label="Page Break"></div>';
    });
    if (!html) throw new Error('No selectable text was found in this PDF (it may be a scanned image).');
    return { title: base(file.name), content: html, note: 'PDF text imported. Layout, fonts and images are not preserved.' };
  }
  /** Parse any supported file into {title, content, settings?, meta?} (or {backup}). */
  F.parse = async function (file) {
    const e = ext(file.name); if (file.size > 60e6) throw new Error('File is too large (limit 60 MB).');
    if (e === 'docx') return parseDocx(file);
    if (e === 'pdf') return parsePdf(file);
    if (e === 'txt' || e === 'md' || e === 'markdown' || e === 'text') return { title: base(file.name), content: F.parseText(await WX.util.readFile(file), e.startsWith('m')) };
    if (e === 'html' || e === 'htm') { const t = await WX.util.readFile(file); const d = new DOMParser().parseFromString(t, 'text/html'); return { title: (d.title || base(file.name)).trim(), content: WX.util.sanitize(d.body.innerHTML) }; }
    if (e === 'wordx' || e === 'json') {
      const j = JSON.parse(await WX.util.readFile(file)); if (j.format === 'wordx-backup') return { backup: j };
      if (j.format === 'wordx-doc' && j.doc) return { title: j.doc.title, content: WX.util.sanitize(j.doc.content || ''), settings: j.doc.settings, meta: j.doc.meta };
      throw new Error('This JSON file is not a WordX document.');
    }
    if (e === 'doc' || e === 'rtf' || e === 'odt') throw new Error(`.${e} files are not supported – save the file as .docx first.`);
    throw new Error('Unsupported file type: .' + e + ' (supported: .docx .pdf .txt .md .html .wordx)');
  };
})();
