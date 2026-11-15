/* WordX – file-export.js
 * DOCX (hand-written WordprocessingML via JSZip), PDF (page-exact via html2canvas + jsPDF),
 * HTML, TXT, .wordx package and print (vector text through the browser print engine). */
(function () {
  'use strict';
  const WX = window.WX; const { esc, download } = WX.util; const E = () => WX.editor;
  const X = (WX.export = {});
  const fname = (d, e) => ((d.title || 'Document').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Document') + '.' + e;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Return the doc to export; if it is the open document, flush editor state first. */
  X.current = function (doc) {
    if (!doc || (E().doc && doc.id === E().doc.id)) { E().commit(); if (WX.refs) { try { WX.refs.updateTOC(); E().commit(); } catch (e) { /* non-fatal */ } } return E().doc; } return doc;
  };

  /* Typography shared by HTML export and print (kept in sync with editor.css). */
  X.CSS = `body{margin:0;font-family:Calibri,Carlito,'Segoe UI','Liberation Sans',Arial,sans-serif;font-size:11pt;line-height:1.15;color:#111}
.doc p{margin:0 0 8pt}.doc ul,.doc ol{margin:0 0 8pt;padding-left:36px}.doc ol ol{list-style-type:lower-alpha}.doc ol ol ol{list-style-type:lower-roman}.doc ol ol ol ol{list-style-type:decimal}.doc h1,.doc h2,.doc h3,.doc h4{font-weight:600;margin:12pt 0 4pt;line-height:1.2;color:#2f5496;break-after:avoid}.doc h1{font-size:20pt}.doc h2{font-size:16pt}.doc h3{font-size:13pt;color:#1f3763}.doc h4{font-size:11pt;font-style:italic}
.doc .wx-title{font-size:28pt;font-weight:300;line-height:1.1}.doc .wx-subtitle{font-size:14pt;color:#5a6573}.doc .wx-quote{font-style:italic;color:#404040;text-align:center;margin:10pt 40px}.doc .wx-intense{font-style:italic;color:#2f5496;text-align:center;margin:14pt 40px;padding:10px 0;border-top:1px solid #2f5496;border-bottom:1px solid #2f5496}.doc .wx-nospace{margin:0}.doc .wx-caption{font-size:9pt;font-style:italic;color:#44546a}
.doc pre{font-family:Consolas,'Liberation Mono',monospace;font-size:10pt;background:#f4f5f7;padding:8px 10px;white-space:pre-wrap}.doc blockquote{margin:0 0 8pt 36px;padding-left:12px;border-left:3px solid #cfd6df}.doc a{color:#0563c1}.doc hr{border:0;border-top:1px solid #777;margin:10pt 0}
.doc table{border-collapse:collapse;margin:0 0 8pt;width:100%;table-layout:fixed}.doc td,.doc th{padding:4px 8px;vertical-align:top;word-break:break-word}.doc tr{break-inside:avoid}.doc table.wx-t-grid td,.doc table.wx-t-grid th{border:1px solid #8a8f98}
.doc table.wx-t-header th,.doc table.wx-t-header tr:first-child td{background:#2f5496;color:#fff;font-weight:600}.doc table.wx-t-header td,.doc table.wx-t-header th{border:1px solid #8a8f98}.doc table.wx-t-banded td,.doc table.wx-t-banded th{border:1px solid #c8cdd5}.doc table.wx-t-banded tr:nth-child(even) td{background:#eef2f8}.doc table.wx-t-banded tr:first-child td,.doc table.wx-t-banded th{background:#4472c4;color:#fff;font-weight:600}.doc table.wx-t-lines td,.doc table.wx-t-lines th{border-bottom:1px solid #b5bcc7}
.doc img{max-width:100%;height:auto}.doc .wx-float-left{float:left;margin:4px 14px 6px 0}.doc .wx-float-right{float:right;margin:4px 0 6px 14px}.doc .wx-block-center{display:block;margin:6px auto}.doc .wx-obj{display:inline-block;vertical-align:middle;line-height:0}.doc .wx-obj svg{display:block}.doc .wx-eq{line-height:normal}
.doc .wx-textbox{border:1px solid #555;padding:8px 10px;width:220px;margin:6px 0}.doc .wx-toc p{display:flex;gap:6px;margin:0 0 3pt}.doc .wx-toc .dots{flex:1;border-bottom:1px dotted #888;transform:translateY(-4px)}.doc .wx-toc a{color:inherit;text-decoration:none}.doc .toc-h{font-size:16pt;font-weight:600;color:#2f5496;display:block}
.doc .wx-notes{border-top:1px solid #888;margin-top:18pt;padding-top:6pt;font-size:9.5pt}.doc ins.wx-ins{color:#1558d6}.doc del.wx-del{color:#c5221f}.doc .wx-comment{background:rgba(251,188,4,.25)}.doc .wx-fn,.doc .wx-en{font-size:80%;vertical-align:super;line-height:0}.doc .wx-tab{white-space:pre}.doc a.wx-bookmark{display:none}.doc .wx-cols{margin:0 0 8pt}`;

  /* ================= TXT ================= */
  function toText(root) {
    const out = []; const walk = (n, pre) => {
      Array.from(n.childNodes).forEach((c) => {
        if (c.nodeType === 3) { if (c.data.trim()) out.push(pre + c.data.replace(/\s+/g, ' ')); return; } if (c.nodeType !== 1) return; const t = c.tagName;
        if (t === 'UL' || t === 'OL') { Array.from(c.children).forEach((li, i) => { const dir = Array.from(li.childNodes).filter((x) => !(x.nodeType === 1 && /^(UL|OL)$/.test(x.tagName))); const tx = dir.map((x) => x.textContent).join('').replace(/\s+/g, ' ').trim(); out.push(pre + (t === 'UL' ? '• ' : i + 1 + '. ') + tx); Array.from(li.children).filter((x) => /^(UL|OL)$/.test(x.tagName)).forEach((x) => walk({ childNodes: [x] }, pre + '    ')); }); }
        else if (t === 'TABLE') Array.from(c.rows).forEach((r) => out.push(Array.from(r.cells).map((x) => x.textContent.replace(/\s+/g, ' ').trim()).join('\t'))); else if (t === 'HR') out.push('------------------------------');
        else if (c.classList.contains('wx-pagebreak') || c.classList.contains('wx-sectionbreak')) out.push('\f'); else if (c.classList.contains('wx-obj')) out.push('[object]'); else if (/^(P|H[1-6]|PRE|BLOCKQUOTE)$/.test(t) && !c.querySelector('p,h1,h2,h3,li')) out.push(pre + c.textContent.replace(/\u200B/g, '').replace(/[ \t]+/g, ' ').trimEnd()); else if (t === 'DEL' && c.classList.contains('wx-del')) return; else walk(c, pre);
      });
    }; walk(root, ''); return out.join('\n');
  }
  const parse = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d; };
  X.txt = function (doc) { doc = X.current(doc); const d = parse(doc.content); d.querySelectorAll('del.wx-del,.wx-pagebreak .x').forEach((n) => n.remove()); download(new Blob(['\uFEFF' + toText(d)], { type: 'text/plain;charset=utf-8' }), fname(doc, 'txt')); };

  /* ================= HTML ================= */
  X.htmlString = function (doc, forPrint) {
    const m = WX.page.metrics(doc.settings); const bg = doc.settings.page.bg || '#fff';
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(doc.title)}</title><style>${X.CSS}${forPrint ? '' : `body{background:#e9ebef;padding:24px 0}.doc{box-sizing:border-box;max-width:${m.W}px;margin:0 auto;background:${bg};padding:${m.mt}px ${m.mr}px ${m.mb}px ${m.ml}px;box-shadow:0 2px 12px rgba(0,0,0,.2);min-height:${m.H}px}.wx-pagebreak,.wx-sectionbreak{border-top:1px dashed #bbb;margin:20px 0;height:0}@media(max-width:700px){.doc{padding:24px 18px}}`}</style></head><body><div class="doc">${doc.content}</div></body></html>`;
  };
  X.html = function (doc) { doc = X.current(doc); const d = parse(doc.content); d.querySelectorAll('.wx-pagebreak,.wx-sectionbreak').forEach((n) => { n.removeAttribute('contenteditable'); }); const c = Object.assign({}, doc, { content: d.innerHTML }); download(new Blob([X.htmlString(c)], { type: 'text/html;charset=utf-8' }), fname(doc, 'html')); };

  /* ================= WordX package ================= */
  X.wordx = function (doc) { doc = X.current(doc); const o = {}; Object.keys(doc).forEach((k) => { if (k[0] !== '_' && k !== 'dirty' && k !== 'lastEdit') o[k] = doc[k]; }); download(new Blob([JSON.stringify({ format: 'wordx-doc', version: 1, doc: o })], { type: 'application/json' }), fname(doc, 'wordx')); };

  /* ================= DOCX ================= */
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const xe = (s) => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const tw = (px) => Math.round(px * 15);
  const cx2d = document.createElement('canvas').getContext('2d');
  function hex(c) { if (!c || /^(transparent|inherit|initial|currentcolor)$/i.test(c)) return null; cx2d.fillStyle = '#000001'; cx2d.fillStyle = c; const v = cx2d.fillStyle; if (v[0] === '#') return v.slice(1).toUpperCase(); const m = /rgba?\(([^)]+)\)/.exec(v); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x)); if (p.length === 4 && p[3] === 0) return null; return p.slice(0, 3).map((n) => Math.round(n).toString(16).padStart(2, '0')).join('').toUpperCase(); }
  const bmName = (id) => { let n = String(id).replace(/[^\w]/g, '_'); if (!/^[A-Za-z]/.test(n)) n = 'b_' + n; return n.slice(0, 38); };
  const px = (v) => { const m = /^(-?[\d.]+)(px|pt)?$/.exec((v || '').trim()); if (!m) return null; return m[2] === 'pt' ? parseFloat(m[1]) / 0.75 : parseFloat(m[1]); };
  const fam = (f) => (f || '').split(',')[0].replace(/["']/g, '').trim();

  function mergeR(p, e) {
    const r = Object.assign({}, p); const t = e.tagName.toLowerCase(); const s = e.style || {};
    if (t === 'b' || t === 'strong' || /^h[1-6]$/.test(t) && false) r.b = 1; if (t === 'i' || t === 'em' || t === 'cite') r.i = 1; if (t === 'u') r.u = 1; if (t === 's' || t === 'strike') r.strike = 1; if (t === 'sup') r.sup = 1; if (t === 'sub') r.sub = 1;
    if (t === 'code') r.font = 'Consolas'; if (t === 'mark') r.shd = 'FFFF00'; if (t === 'a') { r.color = r.color || '0563C1'; r.u = 1; } if (t === 'ins') r.color = r.color || '1558D6'; if (t === 'font') { if (e.getAttribute('color')) r.color = hex(e.getAttribute('color')); if (e.getAttribute('face')) r.font = fam(e.getAttribute('face')); }
    if (s.fontWeight && (s.fontWeight === 'bold' || parseInt(s.fontWeight) >= 600)) r.b = 1; else if (s.fontWeight === 'normal' || (s.fontWeight && parseInt(s.fontWeight) < 600)) r.b = 0; if (s.fontStyle === 'italic') r.i = 1; else if (s.fontStyle === 'normal') r.i = 0;
    const td = (s.textDecorationLine || s.textDecoration || ''); if (/underline/.test(td)) r.u = 1; if (/line-through/.test(td)) r.strike = 1;
    if (s.color) r.color = hex(s.color) || r.color; if (s.backgroundColor) { const h = hex(s.backgroundColor); if (h) r.shd = h; } if (s.fontFamily) r.font = fam(s.fontFamily);
    if (s.fontSize) { const v = px(s.fontSize); if (v) r.sz = Math.round(v * 0.75 * 2); } if (s.verticalAlign === 'super') r.sup = 1; if (s.verticalAlign === 'sub') r.sub = 1; if (s.textTransform === 'uppercase') r.caps = 1;
    return r;
  }
  function rPr(r) {
    let x = ''; if (r.font) x += `<w:rFonts w:ascii="${xe(r.font)}" w:hAnsi="${xe(r.font)}" w:cs="${xe(r.font)}"/>`; if (r.b) x += '<w:b/><w:bCs/>'; if (r.i) x += '<w:i/><w:iCs/>'; if (r.caps) x += '<w:caps/>'; if (r.strike) x += '<w:strike/>';
    if (r.color) x += `<w:color w:val="${r.color}"/>`; if (r.sz) x += `<w:sz w:val="${r.sz}"/><w:szCs w:val="${r.sz}"/>`; if (r.u) x += '<w:u w:val="single"/>'; if (r.shd) x += `<w:shd w:val="clear" w:color="auto" w:fill="${r.shd}"/>`; if (r.sup) x += '<w:vertAlign w:val="superscript"/>'; else if (r.sub) x += '<w:vertAlign w:val="subscript"/>';
    return x ? `<w:rPr>${x}</w:rPr>` : '';
  }

  function Ctx(doc) { return { doc, rels: [], media: [], id: 100, imgs: new Map(), nums: [], absKeys: {}, abs: [], hf: false, del: false, cw: WX.page.metrics(doc.settings).cw, nid: 0 }; }
  function addRel(c, type, target, ext) { const id = 'rId' + (c.rels.length + 10); c.rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${xe(target)}"${ext ? ' TargetMode="External"' : ''}/>`); return id; }

  function textRuns(txt, r, c) {
    if (c.hf && /\{(PAGE|PAGES|DATE|TITLE)\}/.test(txt)) return txt.split(/(\{PAGE\}|\{PAGES\}|\{DATE\}|\{TITLE\})/).filter(Boolean).map((p) => p === '{PAGE}' ? `<w:fldSimple w:instr=" PAGE "><w:r>${rPr(r)}<w:t>1</w:t></w:r></w:fldSimple>` : p === '{PAGES}' ? `<w:fldSimple w:instr=" NUMPAGES "><w:r>${rPr(r)}<w:t>1</w:t></w:r></w:fldSimple>` : p === '{DATE}' ? `<w:r>${rPr(r)}<w:t>${xe(new Date().toLocaleDateString())}</w:t></w:r>` : p === '{TITLE}' ? `<w:r>${rPr(r)}<w:t>${xe(c.doc.title)}</w:t></w:r>` : textRuns(p, r, Object.assign({}, c, { hf: false }))).join('');
    txt = txt.replace(/[\u200B\r]/g, '').replace(/\n/g, ' '); if (!txt) return '';
    return `<w:r>${rPr(r)}<w:${c.del ? 'delText' : 't'} xml:space="preserve">${xe(txt)}</w:${c.del ? 'delText' : 't'}></w:r>`;
  }
  function drawing(rec, c, alt) {
    const id = ++c.id; return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${rec.cx}" cy="${rec.cy}"/><wp:docPr id="${id}" name="Picture ${id}" descr="${xe(alt || '')}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="image${id}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rec.rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${rec.cx}" cy="${rec.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  }
  function inline(node, r, c) {
    if (node.nodeType === 3) return textRuns(node.data, r, c); if (node.nodeType !== 1) return '';
    const t = node.tagName.toLowerCase(), cl = node.classList;
    if (t === 'br') return '<w:r><w:br/></w:r>'; if (t === 'img') { const rec = c.imgs.get(node); return rec ? drawing(rec, c, node.getAttribute('alt')) : textRuns(node.getAttribute('alt') || '', r, c); }
    if (cl.contains('wx-tab')) return '<w:r><w:tab/></w:r>';
    if (cl.contains('wx-obj')) { if (cl.contains('wx-eq')) return textRuns(node.getAttribute('data-src') || node.textContent, Object.assign({}, r, { i: 1, font: 'Cambria Math' }), c); const rec = c.imgs.get(node); return rec ? drawing(rec, c, node.getAttribute('data-alt')) : ''; }
    if (t === 'a' && cl.contains('wx-bookmark')) { const id = ++c.id; return `<w:bookmarkStart w:id="${id}" w:name="${bmName(node.id)}"/><w:bookmarkEnd w:id="${id}"/>`; }
    if (t === 'svg' || t === 'math') return '';
    const r2 = mergeR(r, node); const kids = () => Array.from(node.childNodes).map((k) => inline(k, r2, c)).join('');
    if (t === 'a') { const h = node.getAttribute('href') || ''; if (h.startsWith('#')) return `<w:hyperlink w:anchor="${bmName(h.slice(1))}" w:history="1">${kids()}</w:hyperlink>`; if (h) return `<w:hyperlink r:id="${addRel(c, 'hyperlink', h, true)}" w:history="1">${kids()}</w:hyperlink>`; return kids(); }
    if (t === 'ins' && cl.contains('wx-ins')) return `<w:ins w:id="${++c.id}" w:author="${xe(node.dataset.author || 'WordX')}" w:date="${node.dataset.time || new Date().toISOString()}">${kids()}</w:ins>`;
    if (t === 'del' && cl.contains('wx-del')) { const prev = c.del; c.del = true; const k = kids(); c.del = prev; return `<w:del w:id="${++c.id}" w:author="${xe(node.dataset.author || 'WordX')}" w:date="${node.dataset.time || new Date().toISOString()}">${k}</w:del>`; }
    return kids();
  }
  const bdr = (v) => { if (!v || /^none|^0/.test(v)) return null; const m = /([\d.]+)px\s+(\w+)\s+(.+)$/.exec(v.trim()); if (!m) return { sz: 6, val: 'single', color: '222222' }; return { sz: Math.max(2, Math.round(+m[1] * 6)), val: { dashed: 'dashed', dotted: 'dotted', double: 'double' }[m[2]] || 'single', color: hex(m[3]) || '222222' }; };
  const bx = (tag, b, sp) => `<w:${tag} w:val="${b.val}" w:sz="${b.sz}" w:space="${sp || 1}" w:color="${b.color}"/>`;

  function styleFor(e) {
    const cl = e.classList, t = e.tagName.toLowerCase(); if (cl.contains('wx-title')) return 'Title'; if (cl.contains('wx-subtitle')) return 'Subtitle'; if (cl.contains('wx-quote')) return 'Quote'; if (cl.contains('wx-intense')) return 'IntenseQuote'; if (cl.contains('wx-caption')) return 'Caption';
    if (/^h[1-4]$/.test(t)) return 'Heading' + t[1]; if (t === 'h5' || t === 'h6') return 'Heading4'; if (t === 'pre') return 'Code'; return null;
  }
  function pPr(e, o, c) {
    const s = e.style || {}; let x = ''; const st = o.style || styleFor(e); if (st) x += `<w:pStyle w:val="${st}"/>`; if (o.numId) x += `<w:numPr><w:ilvl w:val="${o.ilvl || 0}"/><w:numId w:val="${o.numId}"/></w:numPr>`;
    const bt = bdr(s.borderTop), bl = bdr(s.borderLeft), bb = bdr(s.borderBottom), br = bdr(s.borderRight) || null; let bq = e.tagName === 'BLOCKQUOTE' ? { sz: 18, val: 'single', color: 'CFD6DF' } : null;
    if (bt || bl || bb || br || bq) x += '<w:pBdr>' + (bt ? bx('top', bt, 2) : '') + (bl || bq ? bx('left', bl || bq, 4) : '') + (bb ? bx('bottom', bb, 2) : '') + (br ? bx('right', br, 4) : '') + '</w:pBdr>';
    const bg = hex(s.backgroundColor); if (bg) x += `<w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>`; else if (e.tagName === 'PRE') x += '<w:shd w:val="clear" w:color="auto" w:fill="F4F5F7"/>';
    if (o.tabs) x += o.tabs; let sp = ''; const mt = px(s.marginTop), mb = px(s.marginBottom); if (mt != null) sp += ` w:before="${tw(mt)}"`; if (mb != null) sp += ` w:after="${tw(mb)}"`; if (e.classList.contains('wx-nospace')) sp = ' w:before="0" w:after="0"';
    const lh = parseFloat(s.lineHeight); if (lh && !/px|pt/.test(s.lineHeight)) sp += ` w:line="${Math.round(lh * 240)}" w:lineRule="auto"`; if (sp) x += `<w:spacing${sp}/>`;
    const ml = px(s.marginLeft) || 0, mr = px(s.marginRight) || 0, ti = px(s.textIndent) || 0; let ind = ''; const left = ml + (o.indent || 0); if (left) ind += ` w:left="${tw(left)}"`; if (mr) ind += ` w:right="${tw(mr)}"`; if (ti > 0) ind += ` w:firstLine="${tw(ti)}"`; else if (ti < 0) ind += ` w:hanging="${tw(-ti)}"`; if (ind && !o.numId) x += `<w:ind${ind}/>`; else if (o.numId && (ti || mr)) x += `<w:ind${ind.replace(/ w:left="\d+"/, '')}/>`;
    const al = s.textAlign; if (al && al !== 'start') x += `<w:jc w:val="${{ left: 'left', right: 'right', center: 'center', justify: 'both', end: 'right' }[al] || 'left'}"/>`;
    return x ? `<w:pPr>${x}</w:pPr>` : '';
  }
  function para(e, c, o) {
    o = o || {}; let rb = o.rb || {}; if (e.tagName === 'PRE') rb = Object.assign({ font: 'Consolas' }, rb); const kids = Array.from(e.childNodes).filter((k) => !(k.nodeType === 1 && /^(UL|OL)$/.test(k.tagName)));
    let body = kids.map((k) => inline(k, mergeR(rb, e), c)).join(''); if (e.id && !e.closest('.wx-toc')) { const id = ++c.id; body = `<w:bookmarkStart w:id="${id}" w:name="${bmName(e.id)}"/>${body}<w:bookmarkEnd w:id="${id}"/>`; }
    return `<w:p>${pPr(e, o, c)}${body}</w:p>`;
  }
  const emptyP = '<w:p/>';

  /* --- numbering --- */
  const FM = { decimal: 'decimal', 'lower-alpha': 'lowerLetter', 'lower-latin': 'lowerLetter', 'upper-alpha': 'upperLetter', 'upper-latin': 'upperLetter', 'lower-roman': 'lowerRoman', 'upper-roman': 'upperRoman' };
  function absFor(c, key, fmts, bullets, legal) {
    if (c.absKeys[key] != null) return c.absKeys[key]; const id = c.abs.length; let lv = '';
    for (let i = 0; i < 9; i++) { const f = bullets ? 'bullet' : fmts[i % fmts.length]; const txt = bullets ? ['\u2022', 'o', '\u25AA'][i % 3] : legal ? Array.from({ length: i + 1 }, (_, k) => '%' + (k + 1)).join('.') + (i ? '' : '.') : '%' + (i + 1) + '.';
      lv += `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${f}"/><w:lvlText w:val="${txt}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 + 360 * i}" w:hanging="360"/></w:pPr>${bullets ? '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:hint="default"/></w:rPr>' : ''}</w:lvl>`; }
    c.abs.push(`<w:abstractNum w:abstractNumId="${id}"><w:multiLevelType w:val="multilevel"/>${lv}</w:abstractNum>`); c.absKeys[key] = id; return id;
  }
  function newNum(c, list, inherit) {
    const tag = list.tagName, cls = list.className, ty = (list.style.listStyleType || '').toLowerCase(); let abs;
    if (tag === 'UL') abs = absFor(c, 'ul', [], true); else if (/ml-legal/.test(cls)) abs = absFor(c, 'legal', ['decimal'], false, true); else if (/ml-outline/.test(cls)) abs = absFor(c, 'outline', ['upperRoman', 'upperLetter', 'decimal', 'lowerLetter']); else if (FM[ty]) abs = absFor(c, 'ol' + ty, [FM[ty], 'lowerLetter', 'lowerRoman']); else abs = absFor(c, 'ol', ['decimal', 'lowerLetter', 'lowerRoman']);
    const id = ++c.nid; const start = parseInt(list.getAttribute('start'), 10) || 1; c.nums.push(`<w:num w:numId="${id}"><w:abstractNumId w:val="${abs}"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="${start}"/></w:lvlOverride></w:num>`); return id;
  }
  function list(l, c, depth, parentNum, rb) {
    const shared = parentNum && /ml-(legal|outline|num)/.test(l.closest('.ml-legal,.ml-outline,.ml-num') ? l.closest('.ml-legal,.ml-outline,.ml-num').className : '') && l.tagName === l.parentElement.closest('ul,ol').tagName;
    const numId = shared ? parentNum : newNum(c, l); let out = '';
    Array.from(l.children).forEach((li) => { if (li.tagName !== 'LI') return; const hasBlock = Array.from(li.children).some((k) => /^(P|H[1-6])$/.test(k.tagName)); out += hasBlock ? '' : para(li, c, { numId, ilvl: Math.min(8, depth), style: 'ListParagraph', rb });
      if (hasBlock) Array.from(li.children).forEach((k, i) => { if (/^(UL|OL)$/.test(k.tagName)) return; out += para(k, c, { numId: i ? 0 : numId, ilvl: depth, style: 'ListParagraph', indent: i ? 720 + 360 * depth : 0, rb }); });
      Array.from(li.children).filter((k) => /^(UL|OL)$/.test(k.tagName)).forEach((k) => { out += list(k, c, depth + 1, numId, rb); }); });
    return out;
  }

  /* --- tables --- */
  function table(t, c, rb0) {
    const cls = t.className, rows = Array.from(t.rows); if (!rows.length) return ''; const pctW = parseFloat(t.style.width) || 100; const total = Math.round(tw(c.cw) * Math.min(100, pctW) / 100);
    let ncols = 0; const occ = []; rows.forEach((tr, ri) => { occ[ri] = occ[ri] || []; let col = 0; Array.from(tr.cells).forEach((cell) => { while (occ[ri][col]) col++; const cs = cell.colSpan || 1, rs = cell.rowSpan || 1; for (let k = 0; k < rs; k++) { occ[ri + k] = occ[ri + k] || []; for (let j = 0; j < cs; j++) occ[ri + k][col + j] = 1; } col += cs; }); ncols = Math.max(ncols, col, occ[ri].length); });
    let widths = new Array(ncols).fill(1 / ncols); const cg = t.querySelector('colgroup'); if (cg && cg.children.length === ncols) { const w = Array.from(cg.children).map((x) => parseFloat(x.style.width) || 0); const s = w.reduce((a, b) => a + b, 0); if (s > 0) widths = w.map((x) => x / s); }
    const gw = widths.map((w) => Math.round(w * total)); const hdr = /wx-t-header/.test(cls), banded = /wx-t-banded/.test(cls);
    const bc = /wx-t-plain/.test(cls) ? null : /wx-t-lines/.test(cls) ? 'B5BCC7' : /wx-t-banded/.test(cls) ? 'C8CDD5' : '8A8F98'; const B = (n, v) => `<w:${n} w:val="${v ? 'single' : 'nil'}" w:sz="4" w:space="0" w:color="${v || 'auto'}"/>`;
    const lines = /wx-t-lines/.test(cls); let x = `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/>${t.style.marginLeft === 'auto' && t.style.marginRight === 'auto' ? '<w:jc w:val="center"/>' : t.style.marginLeft === 'auto' ? '<w:jc w:val="right"/>' : ''}<w:tblBorders>${B('top', lines ? null : bc)}${B('left', lines ? null : bc)}${B('bottom', bc)}${B('right', lines ? null : bc)}${B('insideH', bc)}${B('insideV', lines ? null : bc)}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="110" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${gw.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
    const occ2 = []; rows.forEach((tr, ri) => {
      occ2[ri] = occ2[ri] || []; let col = 0; let cells = ''; const cont = () => { while (occ2[ri][col]) { const o = occ2[ri][col]; cells += `<w:tc><w:tcPr><w:tcW w:w="${o.w}" w:type="dxa"/>${o.span > 1 ? `<w:gridSpan w:val="${o.span}"/>` : ''}<w:vMerge/></w:tcPr><w:p/></w:tc>`; col += o.span; } };
      Array.from(tr.cells).forEach((cell) => {
        cont(); const cs = cell.colSpan || 1, rs = cell.rowSpan || 1; const w = gw.slice(col, col + cs).reduce((a, b) => a + b, 0); const first = ri === 0, even = ri % 2 === 1; let fill = hex(cell.style.backgroundColor); let rb = Object.assign({}, rb0); let tcb = ''; const sides = [['top', 'borderTop'], ['left', 'borderLeft'], ['bottom', 'borderBottom'], ['right', 'borderRight']].map(([n, p]) => { const v = cell.style[p]; if (!v) return ''; const b = bdr(v); return b ? bx(n, b, 0) : `<w:${n} w:val="nil"/>`; }).join(''); if (sides) tcb = `<w:tcBorders>${sides}</w:tcBorders>`;
        if (!fill && hdr && (first || cell.tagName === 'TH')) { fill = '2F5496'; rb.b = 1; rb.color = 'FFFFFF'; } else if (!fill && banded) { if (first || cell.tagName === 'TH') { fill = '4472C4'; rb.b = 1; rb.color = 'FFFFFF'; } else if (even) fill = 'EEF2F8'; } else if (cell.tagName === 'TH') rb.b = 1;
        const va = cell.style.verticalAlign; const body = blocks(cell, c, rb) || emptyP; const tail = /<\/w:tbl>$/.test(body) ? emptyP : '';
        cells += `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${cs > 1 ? `<w:gridSpan w:val="${cs}"/>` : ''}${rs > 1 ? '<w:vMerge w:val="restart"/>' : ''}${tcb}${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ''}${va === 'middle' ? '<w:vAlign w:val="center"/>' : va === 'bottom' ? '<w:vAlign w:val="bottom"/>' : ''}</w:tcPr>${body}${tail}</w:tc>`;
        for (let k = 1; k < rs; k++) { occ2[ri + k] = occ2[ri + k] || []; occ2[ri + k][col] = { span: cs, w }; } col += cs;
      }); cont(); x += `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells}</w:tr>`;
    });
    return x + '</w:tbl>' + emptyP.replace('<w:p/>', '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="120" w:lineRule="exact"/></w:pPr></w:p>');
  }

  /** Convert block-level children of `parent` to WordprocessingML. */
  function blocks(parent, c, rb, indent) {
    let out = '', run = [];
    const flush = () => { if (!run.length) return; if (run.some((n) => n.nodeType === 1 || (n.nodeType === 3 && n.data.trim()))) { const tmp = { tagName: 'P', style: {}, classList: { contains: () => false }, childNodes: run, id: '', closest: () => null }; out += para(tmp, c, { rb, indent }); } run = []; };
    Array.from(parent.childNodes).forEach((n) => {
      if (n.nodeType === 3 || n.nodeType !== 1) { if (n.nodeType === 3) run.push(n); return; } const t = n.tagName, cl = n.classList;
      if (/^(P|H[1-6]|PRE)$/.test(t)) { flush(); out += para(n, c, { rb, indent }); }
      else if (t === 'BLOCKQUOTE') { flush(); out += n.querySelector('p,h1,h2,h3,ul,ol') ? blocks(n, c, rb, (indent || 0) + 36) : para(n, c, { rb, indent: (indent || 0) + 36 }); }
      else if (t === 'UL' || t === 'OL') { flush(); out += list(n, c, 0, 0, rb); }
      else if (t === 'TABLE') { flush(); out += table(n, c, rb); }
      else if (t === 'HR') { flush(); out += '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="777777"/></w:pBdr></w:pPr></w:p>'; }
      else if (cl.contains('wx-pagebreak') || (cl.contains('wx-sectionbreak') && n.dataset.kind !== 'continuous')) { flush(); out += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'; }
      else if (cl.contains('wx-sectionbreak')) { flush(); }
      else if (cl.contains('wx-textbox')) { flush(); const tmp = document.createElement('table'); tmp.className = 'wx-t-grid'; tmp.style.width = '45%'; tmp.innerHTML = '<tbody><tr><td></td></tr></tbody>'; tmp.querySelector('td').innerHTML = n.innerHTML; out += table(tmp, c, rb); }
      else if (cl.contains('wx-toc')) { flush(); Array.from(n.children).forEach((p) => { if (p.tagName === 'SPAN') { out += `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr>${inline(p, { b: 1, sz: 32, color: '2F5496' }, c)}</w:p>`; return; } const a = p.querySelector('a'), pg = p.querySelector('.pg'); const ind = px(p.style.marginLeft) || 0; if (!a) { out += para(p, c, { rb }); return; } out += `<w:p><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${tw(c.cw)}"/></w:tabs><w:spacing w:after="60"/>${ind ? `<w:ind w:left="${tw(ind)}"/>` : ''}</w:pPr>${inline(a, rb || {}, c)}<w:r><w:tab/></w:r>${pg ? textRuns(pg.textContent, rb || {}, c) : ''}</w:p>`; }); }
      else if (t === 'DIV' || t === 'SECTION' || t === 'FIGURE' || t === 'ARTICLE') { flush(); out += blocks(n, c, rb, indent); }
      else if (t === 'SCRIPT' || t === 'STYLE') { /* skip */ } else run.push(n);
    }); flush(); return out;
  }

  /* --- images --- */
  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('image load failed')); i.src = src; });
  async function toPng(src, w, h, scale) { const i = await loadImg(src); const cw = Math.max(1, Math.round((w || i.naturalWidth || 300) * (scale || 1))), ch = Math.max(1, Math.round((h || i.naturalHeight || 150) * (scale || 1))); const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const g = cv.getContext('2d'); g.drawImage(i, 0, 0, cw, ch); return cv.toDataURL('image/png'); }
  const b64bytes = (u) => { const b = atob(u.split(',')[1]); const a = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
  async function preload(root, c) {
    const maxW = c.cw; let n = 0;
    const reg = async (el, dataUrl, w, h) => { const mime = /^data:image\/(\w+)/.exec(dataUrl); let ext = mime ? mime[1].toLowerCase() : 'png'; if (ext === 'jpg') ext = 'jpeg'; if (!/^(png|jpeg|gif)$/.test(ext)) { dataUrl = await toPng(dataUrl, w, h, 2); ext = 'png'; } let ww = w, hh = h; if (ww > maxW) { hh = hh * maxW / ww; ww = maxW; } const name = `image${++n}.${ext}`; c.media.push({ name, bytes: b64bytes(dataUrl) }); c.imgs.set(el, { rid: addRel(c, 'image', 'media/' + name), cx: Math.round(ww * 9525), cy: Math.round(hh * 9525) }); };
    for (const img of root.querySelectorAll('img')) { try { const src = img.getAttribute('src') || ''; if (!/^data:image\//.test(src)) continue; const i = await loadImg(src); let w = px(img.style.width) || parseFloat(img.getAttribute('width')) || i.naturalWidth; let h = px(img.style.height) || parseFloat(img.getAttribute('height')) || w * i.naturalHeight / (i.naturalWidth || 1); if (!px(img.style.height) && !img.getAttribute('height')) h = w * i.naturalHeight / (i.naturalWidth || 1); await reg(img, src, w, h); } catch (e) { /* skipped; alt text is exported instead */ } }
    for (const o of root.querySelectorAll('.wx-obj:not(.wx-eq)')) { try { const svg = o.querySelector('svg'); if (!svg) continue; const w = px(o.style.width) || 200, h = px(o.style.height) || 150; svg.setAttribute('width', w); svg.setAttribute('height', h); if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); const u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.outerHTML); const png = await toPng(u, w, h, 2); await reg(o, png, w, h); } catch (e) { /* skip object */ } }
  }

  const STYLES = () => { const h = (id, name, sz, color, extra) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${extra || 240}" w:after="80"/><w:outlineLvl w:val="${id.slice(-1) - 1}"/></w:pPr><w:rPr><w:b/><w:color w:val="${color}"/><w:sz w:val="${sz}"/></w:rPr></w:style>`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
${h('Heading1', 'heading 1', 40, '2F5496')}${h('Heading2', 'heading 2', 32, '2F5496', 200)}${h('Heading3', 'heading 3', 26, '1F3763', 160)}${h('Heading4', 'heading 4', 22, '2F5496', 120)}
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="160" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="56"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:color w:val="5A6573"/><w:spacing w:val="15"/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="200" w:after="160"/><w:ind w:left="864" w:right="864"/><w:jc w:val="center"/></w:pPr><w:rPr><w:i/><w:color w:val="404040"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="IntenseQuote"><w:name w:val="Intense Quote"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:pBdr><w:top w:val="single" w:sz="4" w:space="10" w:color="2F5496"/><w:bottom w:val="single" w:sz="4" w:space="10" w:color="2F5496"/></w:pBdr><w:spacing w:before="360" w:after="360"/><w:ind w:left="864" w:right="864"/><w:jc w:val="center"/></w:pPr><w:rPr><w:i/><w:color w:val="2F5496"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="200" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:i/><w:color w:val="44546A"/><w:sz w:val="18"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="120" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="20"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="40"/><w:ind w:left="720"/></w:pPr></w:style></w:styles>`; };

  function hfXml(html, c, tag) { const d = parse(html || ''); const cc = Object.assign({}, c, { hf: true }); const body = blocks(d, cc, null) || emptyP; return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:${tag} ${NS}>${body}</w:${tag}>`; }

  X.docxBlob = async function (doc) {
    doc = X.current(doc); const c = Ctx(doc); const root = parse(doc.content); const s = doc.settings; const m = WX.page.metrics(s);
    root.querySelectorAll('.wx-handles').forEach((n) => n.remove()); await preload(root, c);
    const bodyXml = blocks(root, c, null) || emptyP;
    const types = []; const hfRef = (type, html, kind) => { if (!html) return ''; const name = `${kind}${c.rels.length}.xml`; const rid = addRel(c, kind, name); c.hfFiles = c.hfFiles || []; c.hfFiles.push({ name, xml: hfXml(html, c, kind === 'header' ? 'hdr' : 'ftr'), kind }); return `<w:${kind}Reference w:type="${type}" r:id="${rid}"/>`; };
    const hf = s.hf; let refs = hfRef('default', hf.header, 'header') + hfRef('default', hf.footer, 'footer'); if (hf.differentFirst) refs += hfRef('first', hf.firstHeader || '<p></p>', 'header') + hfRef('first', hf.firstFooter || '<p></p>', 'footer');
    const nf = { 1: 'decimal', i: 'lowerRoman', I: 'upperRoman', a: 'lowerLetter', A: 'upperLetter' }[hf.numFormat] || 'decimal'; const pb = s.page.border; const bsz = pb ? Math.min(96, Math.max(2, Math.round((pb.width || 1) * 6))) : 0; const bs = pb ? { style: 'single', solid: 'single', dashed: 'dashed', dotted: 'dotted', double: 'double' }[pb.style] || 'single' : '';
    const bd = pb ? '<w:pgBorders w:offsetFrom="page">' + ['top', 'left', 'bottom', 'right'].map((n) => `<w:${n} w:val="${bs}" w:sz="${bsz}" w:space="${Math.round((pb.inset || 24) * 0.75)}" w:color="${(pb.color || '#000000').slice(1).toUpperCase()}"/>`).join('') + '</w:pgBorders>' : '';
    const sect = `<w:sectPr>${refs}<w:pgSz w:w="${tw(m.W)}" w:h="${tw(m.H)}"${m.W > m.H ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="${tw(m.mt)}" w:right="${tw(m.mr)}" w:bottom="${tw(m.mb)}" w:left="${tw(m.ml)}" w:header="720" w:footer="720" w:gutter="0"/>${bd}<w:pgNumType w:start="${hf.startNumber || 1}" w:fmt="${nf}"/>${hf.differentFirst ? '<w:titlePg/>' : ''}</w:sectPr>`;
    const bgc = s.page.bg && s.page.bg.toLowerCase() !== '#ffffff' ? s.page.bg.slice(1).toUpperCase() : null;
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}>${bgc ? `<w:background w:color="${bgc}"/>` : ''}<w:body>${bodyXml}${sect}</w:body></w:document>`;
    const zip = new JSZip(); const add = (n, d) => zip.file(n, d, { createFolders: false }); const hfs = c.hfFiles || [];
    add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Default Extension="json" ContentType="application/json"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>${hfs.map((h) => `<Override PartName="/word/${h.name}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.${h.kind}+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`);
    add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/><Relationship Id="rId4" Type="http://schemas.wordx.app/relationships/source" Target="docProps/wordx.json"/></Relationships>`);
    const now = new Date().toISOString();
    add('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xe(doc.title)}</dc:title><dc:creator>${xe(WX.state.userName || 'WordX')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date(doc.created || Date.now()).toISOString()}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
    add('docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>WordX</Application></Properties>');
    add('docProps/wordx.json', JSON.stringify({ title: doc.title, content: doc.content, settings: doc.settings, meta: doc.meta }));
    add('word/document.xml', documentXml); add('word/styles.xml', STYLES());
    add('word/numbering.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering ${NS}>${c.abs.join('')}${c.nums.join('')}</w:numbering>`);
    add('word/settings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings ${NS}><w:zoom w:percent="100"/>${bgc ? '<w:displayBackgroundShape/>' : ''}<w:defaultTabStop w:val="720"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`);
    hfs.forEach((h) => add('word/' + h.name, h.xml)); c.media.forEach((mm) => add('word/media/' + mm.name, mm.bytes));
    const base = ['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>', '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>', '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>'];
    add('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${base.join('')}${c.rels.join('')}</Relationships>`);
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE' });
  };
  X.docx = async function (doc) { const d = X.current(doc); const b = await X.docxBlob(d); download(b, fname(d, 'docx')); };

  /* ================= PDF (page-exact, image based) ================= */
  X.pdf = async function () {
    const doc = X.current(); const P = WX.page; const prev = { view: WX.state.view, zoom: WX.state.zoom, fit: WX.state.autoFit }; WX.ui.toast('Creating PDF…', null, 4000);
    try {
      if (prev.view !== 'print') WX.act.setView('print'); WX.images.deselect(); P.setZoom(1, true); await sleep(80); P.paginate(true); const m = P.metrics(), pages = P.pages; const paper = document.getElementById('paper');
      const { jsPDF } = window.jspdf; const pdf = new jsPDF({ unit: 'px', format: [m.W, m.H], orientation: m.W > m.H ? 'landscape' : 'portrait', hotfixes: ['px_scaling'], compress: true }); pdf.setProperties({ title: doc.title, creator: 'WordX' });
      for (let i = 0; i < pages; i++) {
        const cv = await html2canvas(paper, { scale: 2, x: 0, y: i * m.PH, width: m.W, height: m.H, backgroundColor: '#ffffff', useCORS: true, logging: false, ignoreElements: (e) => e.id === 'obj-layer',
          onclone: (d) => { const sh = d.getElementById('sheets'); if (sh) { sh.style.zIndex = '0'; } const ed = d.getElementById('editor'); if (ed) { ed.style.zIndex = '1'; ed.style.position = 'relative'; } const pp = d.getElementById('paper'); if (pp) pp.style.isolation = 'auto'; d.querySelectorAll('.wx-pagebreak,.wx-sectionbreak').forEach((n) => { n.style.visibility = 'hidden'; }); } });
        if (i) pdf.addPage([m.W, m.H], m.W > m.H ? 'landscape' : 'portrait'); pdf.addImage(cv.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, m.W, m.H);
      }
      const pr = paper.getBoundingClientRect(); E().el.querySelectorAll('a[href]').forEach((a) => { const href = a.getAttribute('href'); if (href.startsWith('#')) return; Array.from(a.getClientRects()).forEach((r) => { const y = r.top - pr.top, pg = Math.floor(y / m.PH); if (pg < 0 || pg >= pages) return; pdf.setPage(pg + 1); pdf.link(r.left - pr.left, y - pg * m.PH, r.width, r.height, { url: href }); }); });
      pdf.save(fname(doc, 'pdf')); WX.ui.toast('PDF saved.', 'success');
    } catch (e) { console.error(e); WX.ui.toast('PDF export failed: ' + e.message, 'error'); }
    finally { if (prev.view !== 'print') WX.act.setView(prev.view); WX.state.autoFit = prev.fit; P.setZoom(prev.zoom, true); P.fit(); }
  };

  /* ================= PRINT (vector text via browser engine) ================= */
  function boxCSS(html, pos) {
    if (!html || !html.trim()) return ''; const d = parse(html); const p = Array.from(d.querySelectorAll('p,div')).find((x) => x.textContent.trim()) || d; const al = p.style && p.style.textAlign; const where = al === 'center' ? 'center' : al === 'right' ? 'right' : 'left';
    const parts = p.textContent.split(/(\{PAGE\}|\{PAGES\}|\{DATE\}|\{TITLE\})/).filter(Boolean).map((t) => t === '{PAGE}' ? 'counter(page)' : t === '{PAGES}' ? 'counter(pages)' : '"' + (t === '{DATE}' ? new Date().toLocaleDateString() : t === '{TITLE}' ? WX.editor.doc.title : t).replace(/["\\]/g, '\\$&').replace(/\n/g, ' ') + '"');
    return `@${pos}-${where}{content:${parts.join(' ')};font:10pt Calibri,Carlito,Arial,sans-serif;color:#444;vertical-align:${pos === 'top' ? 'bottom' : 'top'}}`;
  }
  X.print = async function () {
    const doc = X.current(); const m = WX.page.metrics(doc.settings); const s = doc.settings; const hf = s.hf; const pb = s.page.border, wm = s.page.watermark;
    const css = `${X.CSS}@page{size:${m.W}px ${m.H}px;margin:${m.mt}px ${m.mr}px ${m.mb}px ${m.ml}px;${boxCSS(hf.header, 'top')}${boxCSS(hf.footer, 'bottom')}}${hf.differentFirst ? `@page :first{${boxCSS(hf.firstHeader, 'top') || '@top-left{content:none}@top-center{content:none}@top-right{content:none}'}${boxCSS(hf.firstFooter, 'bottom') || '@bottom-left{content:none}@bottom-center{content:none}@bottom-right{content:none}'}}` : ''}
html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{background:${s.page.bg || '#fff'}}.wx-pagebreak,.wx-sectionbreak{break-after:page;height:0;margin:0;visibility:hidden}.wm{position:fixed;left:50%;top:50%;font:700 ${wm ? wm.size : 96}px Arial,sans-serif;white-space:nowrap;color:${wm ? wm.color : '#999'};opacity:${wm ? wm.opacity : 0.25};transform:translate(-50%,-50%) rotate(${wm ? wm.angle : -45}deg);z-index:-1}
.pb{position:fixed;top:${pb ? (pb.inset || 24) - m.mt : 0}px;left:${pb ? (pb.inset || 24) - m.ml : 0}px;right:${pb ? (pb.inset || 24) - m.mr : 0}px;bottom:${pb ? (pb.inset || 24) - m.mb : 0}px;border:${pb ? `${pb.width || 1}px ${pb.style || 'solid'} ${pb.color || '#000'}` : 'none'}}`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.title)}</title><style>${css}</style></head><body>${wm && wm.text ? `<div class="wm">${esc(wm.text)}</div>` : ''}${pb ? '<div class="pb"></div>' : ''}<div class="doc">${doc.content}</div></body></html>`;
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'; document.body.appendChild(f);
    f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close(); await sleep(150);
    await Promise.all(Array.from(f.contentDocument.images).map((i) => (i.complete ? 1 : new Promise((r) => { i.onload = i.onerror = r; })))); await sleep(100);
    const w = f.contentWindow; const done = () => setTimeout(() => f.remove(), 500); w.addEventListener('afterprint', done); setTimeout(() => f.parentNode && f.remove(), 120000); w.focus(); w.print();
  };

  /** Dispatch used by menus: kind in docx|pdf|html|txt|wordx|print, optional doc. */
  X.run = async function (kind, doc) { try { if (kind === 'pdf' && doc && E().doc && doc.id !== E().doc.id) return WX.ui.toast('Open the document first to export it as PDF.'); await X[kind](doc); if (kind !== 'pdf' && kind !== 'print') WX.ui.toast('Export complete.', 'success'); } catch (e) { console.error(e); WX.ui.toast('Export failed: ' + e.message, 'error'); } };
  Object.assign(WX.act, { exportDocx: () => X.run('docx'), exportPdf: () => X.run('pdf'), exportHtml: () => X.run('html'), exportTxt: () => X.run('txt'), exportWordx: () => X.run('wordx'), print: () => X.run('print') });
})();
