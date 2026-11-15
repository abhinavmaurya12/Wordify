/* WordX – toolbar.js
 * Declarative ribbon (Home/Insert/Layout/References/Review/View + contextual Table tab),
 * File menu, title bar, side/nav panes, status bar and the mobile bar.
 * Every control calls WX.act.<name>, the same registry used by shortcuts and menus. */
(function () {
  'use strict';
  const WX = window.WX; const { el, esc, icon, $, $$ } = WX.util; const E = () => WX.editor; const ui = WX.ui; const A = WX.act;
  const T = (WX.toolbar = { tabs: {}, order: [], active: 'home' });
  const call = (name, ...a) => { const f = A[name]; if (!f) { ui.toast('Action “' + name + '” is unavailable.', 'error'); return; } try { const r = f(...a); if (r && r.catch) r.catch((e) => { console.error(e); ui.toast(e.message || 'Action failed', 'error'); }); } catch (e) { console.error(e); ui.toast(e.message || 'Action failed', 'error'); } };

  /* ---------- control factories ---------- */
  const toggles = []; // {node, test(state)}
  function btn(d) {
    const cls = 'rbtn ' + (d.lg ? 'lg' : 'sm') + (d.wide ? ' wide' : '');
    const b = el('button', { class: cls, type: 'button', 'data-tip': d.tip || d.label || '', 'aria-label': d.tip || d.label }); const ic = d.ic ? `<span class="ic">${icon(d.ic, d.lg ? 28 : 16)}</span>` : '';
    b.innerHTML = d.lg ? ic + `<span class="lbl">${esc(d.label || '')}${d.menu && !d.split ? icon('chevron-down', 10).replace('<svg', '<svg class="caret"') : ''}</span>` : ic + (d.label ? `<span>${esc(d.label)}</span>` : '') + (d.swatch ? '<i class="swatch"></i>' : '');
    if (d.swatch) { b.style.position = 'relative'; b.querySelector('.swatch').style.color = d.swatch; }
    b.addEventListener('mousedown', (e) => e.preventDefault());
    const run = () => { if (d.act) call(d.act, ...(d.args || [])); else if (d.fn) d.fn(b); };
    if (d.menu && !d.split) b.addEventListener('click', () => { WX.ui.closeMenu(); const m = d.menu(b); if (Array.isArray(m)) ui.menu(b, m); }); else b.addEventListener('click', run);
    if (d.on) toggles.push({ node: b, test: d.on });
    if (d.split) { const c = el('button', { class: 'rbtn sm split-caret', type: 'button', 'aria-label': (d.tip || d.label) + ' options', html: icon('chevron-down', 10) }); c.addEventListener('mousedown', (e) => e.preventDefault()); c.addEventListener('click', () => { const m = d.menu(c); if (Array.isArray(m)) ui.menu(c, m); }); b.classList.add('split-main'); return el('span', { style: { display: 'inline-flex' } }, b, c); }
    return b;
  }
  function sel(d) {
    const s = el('select', { class: 'rsel ' + (d.cls || ''), 'aria-label': d.tip, 'data-tip': d.tip }, (d.options || []).map((o) => el('option', { value: o[0], text: o[1] })));
    s.addEventListener('change', () => { const v = s.value; call(d.act, d.parse ? d.parse(v) : v); setTimeout(() => E().restore && E().restore(), 0); }); if (d.sync) toggles.push({ node: s, sync: d.sync }); return s;
  }
  const grp = (label, ...kids) => el('div', { class: 'rgroup' }, el('div', { class: 'rgroup-body' }, ...kids), el('div', { class: 'rgroup-label', text: label }));
  const col = (...k) => el('div', { class: 'rcol' }, ...k); const row = (...k) => el('div', { class: 'rrow' }, ...k);
  const sep = () => el('span', { class: 'rsep' });
  const M = (label, ic, act, args, extra) => Object.assign({ label, icon: ic, action: () => call(act, ...(args || [])) }, extra || {});

  /* ---------- tab registration ---------- */
  T.add = function (id, label, build, ctx) { T.tabs[id] = { id, label, build, ctx }; T.order.push(id); };
  T.show = function (id) {
    if (!T.tabs[id]) id = 'home'; T.active = id; $$('.rtab').forEach((t) => { const on = t.dataset.tab === id; t.classList.toggle('active', on); t.setAttribute('aria-selected', on); }); $$('.rpanel').forEach((p) => p.classList.toggle('active', p.dataset.tab === id));
  };
  function buildRibbon() {
    const tabs = $('#ribbon-tabs'), rb = $('#ribbon'); tabs.innerHTML = ''; rb.innerHTML = '';
    T.order.forEach((id) => { const t = T.tabs[id]; const b = el('button', { class: 'rtab' + (t.ctx ? ' ctx' : ''), role: 'tab', 'data-tab': id, text: t.label, hidden: !!t.ctx, onclick: () => { if (T.active === id && window.innerWidth < 900) toggleRibbon(); else { T.show(id); showRibbon(); } }, ondblclick: () => toggleRibbon() }); tabs.append(b); const p = el('div', { class: 'rpanel', 'data-tab': id, role: 'tabpanel' }); t.build(p); rb.append(p); });
    tabs.append(el('span', { class: 'rtab-spacer', style: { flex: 1 } }), el('button', { class: 'rtab', id: 'rb-collapse', 'aria-label': 'Collapse the ribbon', 'data-tip': 'Collapse the ribbon', html: icon('chevron-up', 16), onclick: toggleRibbon }));
    T.show('home'); if (window.innerWidth < 760) $('#ribbon').classList.add('collapsed');
  }
  function toggleRibbon() { const r = $('#ribbon'); r.classList.toggle('collapsed'); const c = r.classList.contains('collapsed'); const b = $('#rb-collapse'); if (b) b.innerHTML = icon(c ? 'chevron-down' : 'chevron-up', 16); setTimeout(() => WX.page.fit && WX.state.autoFit && WX.page.fit(), 50); }
  function showRibbon() { const r = $('#ribbon'); if (r.classList.contains('collapsed') && window.innerWidth >= 900) toggleRibbon(); else if (r.classList.contains('collapsed')) r.classList.remove('collapsed'); }
  A.toggleRibbon = toggleRibbon;

  /* ---------- HOME ---------- */
  const F = () => WX.fmt;
  T.add('home', 'Home', (p) => {
    p.append(
      grp('Clipboard', btn({ lg: 1, ic: 'clipboard-paste', label: 'Paste', tip: 'Paste (Ctrl+V)', split: true, act: 'paste', menu: () => [M('Paste', 'clipboard-paste', 'paste'), M('Paste as plain text', 'type', 'pastePlain')] }), col(btn({ ic: 'scissors', tip: 'Cut (Ctrl+X)', act: 'cut' }), btn({ ic: 'copy', tip: 'Copy (Ctrl+C)', act: 'copy' }), btn({ ic: 'paintbrush', tip: 'Format Painter', act: 'formatPainter' }))),
      grp('Font', col(row(sel({ cls: 'font', tip: 'Font', act: 'fontName', options: F().FONTS.map((f) => [f, f]), sync: (s, st) => { if (st.fontName && s !== document.activeElement) { if (!Array.from(s.options).some((o) => o.value === st.fontName)) s.add(new Option(st.fontName, st.fontName)); s.value = st.fontName; } } }),
        sel({ cls: 'size', tip: 'Font size (pt)', act: 'fontSize', parse: parseFloat, options: F().SIZES.map((s) => [s, s]), sync: (s, st) => { if (st.fontSize) { if (!Array.from(s.options).some((o) => +o.value === st.fontSize)) s.add(new Option(st.fontSize, st.fontSize)); s.value = st.fontSize; } } }),
        btn({ ic: 'a-arrow-up', tip: 'Increase font size (Ctrl+Shift+>)', act: 'growFont' }), btn({ ic: 'a-arrow-down', tip: 'Decrease font size (Ctrl+Shift+<)', act: 'shrinkFont' }),
        btn({ ic: 'case-sensitive', tip: 'Change case', menu: () => [M('Sentence case', null, 'changeCase', ['sentence']), M('lowercase', null, 'changeCase', ['lower']), M('UPPERCASE', null, 'changeCase', ['upper']), M('Capitalize Each Word', null, 'changeCase', ['title']), M('tOGGLE cASE', null, 'changeCase', ['toggle'])] }), btn({ ic: 'eraser', tip: 'Clear all formatting', act: 'clearFormat' })),
      row(btn({ ic: 'bold', tip: 'Bold (Ctrl+B)', act: 'bold', on: (s) => s.bold }), btn({ ic: 'italic', tip: 'Italic (Ctrl+I)', act: 'italic', on: (s) => s.italic }), btn({ ic: 'underline', tip: 'Underline (Ctrl+U)', act: 'underline', on: (s) => s.underline }), btn({ ic: 'strikethrough', tip: 'Strikethrough', act: 'strike', on: (s) => s.strike }), btn({ ic: 'subscript', tip: 'Subscript', act: 'subscript', on: (s) => s.sub }), btn({ ic: 'superscript', tip: 'Superscript', act: 'superscript', on: (s) => s.sup }), sep(), colorBtn2('Highlight colour', 'highlighter', 'highlight', '#ffff00', 'No colour'), colorBtn2('Font colour', 'a-large-small', 'textColor', '#c00000')))),
      grp('Paragraph', col(row(btn({ ic: 'list', tip: 'Bullets', split: true, act: 'bullets', on: (s) => s.ul, menu: () => [M('Disc', null, 'bullets', ['disc']), M('Circle', null, 'bullets', ['circle']), M('Square', null, 'bullets', ['square'])] }), btn({ ic: 'list-ordered', tip: 'Numbering', split: true, act: 'numbering', on: (s) => s.ol, menu: () => [['1, 2, 3', 'decimal'], ['a, b, c', 'lower-alpha'], ['A, B, C', 'upper-alpha'], ['i, ii, iii', 'lower-roman'], ['I, II, III', 'upper-roman']].map(([l, t]) => M(l, null, 'numbering', [t]))  }), btn({ ic: 'list-tree', tip: 'Multilevel list', menu: () => [M('1) a) i) numbered', null, 'multilevel', ['num']), M('1.1.1 legal', null, 'multilevel', ['legal']), M('I. A. 1. a. outline', null, 'multilevel', ['outline']), M('• ◦ ▪ bullets', null, 'multilevel', ['bullet'])] }), btn({ ic: 'outdent', tip: 'Decrease indent', act: 'outdent' }), btn({ ic: 'indent', tip: 'Increase indent', act: 'indent' })),
      row(btn({ ic: 'align-left', tip: 'Align left (Ctrl+L)', act: 'alignLeft', on: (s) => s.align === 'left' }), btn({ ic: 'align-center', tip: 'Center (Ctrl+E)', act: 'alignCenter', on: (s) => s.align === 'center' }), btn({ ic: 'align-right', tip: 'Align right (Ctrl+R)', act: 'alignRight', on: (s) => s.align === 'right' }), btn({ ic: 'align-justify', tip: 'Justify (Ctrl+J)', act: 'alignJustify', on: (s) => s.align === 'justify' }),
        btn({ ic: 'chevrons-up-down', tip: 'Line and paragraph spacing', menu: () => [...['1.0', '1.15', '1.5', '2.0', '2.5', '3.0'].map((v) => M(v, null, 'lineSpacing', [v])), { sep: true }, M('Add space before (12 pt)', null, 'spaceBefore', [12]), M('Remove space before', null, 'spaceBefore', [0]), M('Add space after (12 pt)', null, 'spaceAfter', [12]), M('Remove space after', null, 'spaceAfter', [0]), { sep: true }, M('Paragraph options…', 'settings-2', 'paragraphDialog')] }),
        btn({ ic: 'paint-bucket', tip: 'Shading', menu: (a) => { ui.colorPicker(a, { noneLabel: 'No colour', onPick: (c) => call('shading', c) }); } }),
        btn({ ic: 'square', tip: 'Borders', menu: () => [M('Bottom border', null, 'borders', ['bottom']), M('Top border', null, 'borders', ['top']), M('Left border', null, 'borders', ['left']), M('Right border', null, 'borders', ['right']), M('All borders', null, 'borders', ['all']), M('Box', null, 'borders', ['box']), M('No border', null, 'borders', ['none']), { sep: true }, M('Borders and shading…', null, 'bordersDialog')] })))),
      grp('Styles', col(btn({ lg: 1, ic: 'type', label: 'Styles', tip: 'Styles gallery', menu: () => F().STYLES.map((s) => ({ html: `<span class="style-sample ${s.id === 'nospace' ? '' : s.id === 'normal' ? '' : s.id.replace('intense', 'quote')}">${esc(s.label)}</span>`, label: s.label, action: () => call('style', s.id) })) }))),
      grp('Editing', col(btn({ ic: 'search', label: 'Find', tip: 'Find (Ctrl+F)', wide: 1, act: 'find' }), btn({ ic: 'replace', label: 'Replace', tip: 'Replace (Ctrl+H)', wide: 1, act: 'replace' }), btn({ ic: 'mouse-pointer-2', label: 'Select all', tip: 'Select all (Ctrl+A)', wide: 1, act: 'selectAll' }))));
  });
  function colorBtn2(tip, ic, act, def, none) { let cur = def; const w = btn({ ic, tip, swatch: cur, split: true, fn: () => call(act, cur), menu: (a) => { ui.colorPicker(a, { current: cur, noneLabel: none, onPick: (c) => { cur = c || (act === 'highlight' ? null : '#000000'); call(act, c); w.querySelector('.swatch').style.color = c || 'transparent'; w.querySelector('.rbtn').dataset.cur = cur || ''; } }); } }); return w; }

  /* ---------- INSERT ---------- */
  T.add('insert', 'Insert', (p) => {
    p.append(
      grp('Pages', btn({ lg: 1, ic: 'file-plus', label: 'Page break', tip: 'Page break (Ctrl+Enter)', act: 'pageBreak' }), btn({ lg: 1, ic: 'layout-template', label: 'Cover / blank', tip: 'Insert a title block', fn: () => { E().insertHTML('<p class="wx-title">Document title</p><p class="wx-subtitle">Subtitle</p><p><br></p>'); } })),
      grp('Tables', btn({ lg: 1, ic: 'table', label: 'Table', tip: 'Insert table', menu: (a) => { WX.tables.gridPicker(a); } })),
      grp('Illustrations', btn({ lg: 1, ic: 'image', label: 'Pictures', tip: 'Insert picture from your device', act: 'insertPicture' }), btn({ lg: 1, ic: 'shapes', label: 'Shapes', tip: 'Shapes', menu: (a) => { A.insertShapesMenu(a); } }), btn({ lg: 1, ic: 'smile', label: 'Icons', tip: 'Icons', act: 'insertIcon' }), btn({ lg: 1, ic: 'chart-column', label: 'Chart', tip: 'Chart', act: 'insertChart' }), btn({ lg: 1, ic: 'workflow', label: 'SmartArt', tip: 'Diagram / SmartArt', act: 'insertSmartArt' })),
      grp('Links', btn({ lg: 1, ic: 'link', label: 'Link', tip: 'Link (Ctrl+K)', act: 'link' }), btn({ lg: 1, ic: 'bookmark', label: 'Bookmark', tip: 'Bookmark', act: 'insertBookmark' }), btn({ lg: 1, ic: 'corner-down-right', label: 'Cross-ref', tip: 'Cross-reference', act: 'crossRef' })),
      grp('Header & Footer', btn({ lg: 1, ic: 'panel-top', label: 'Header', tip: 'Edit header', act: 'headerFooter', args: ['header'] }), btn({ lg: 1, ic: 'panel-bottom', label: 'Footer', tip: 'Edit footer', act: 'headerFooter', args: ['footer'] }), btn({ lg: 1, ic: 'hash', label: 'Page number', tip: 'Page number', menu: () => [M('Top left', null, 'pageNumber', ['header-left']), M('Top center', null, 'pageNumber', ['header-center']), M('Top right', null, 'pageNumber', ['header-right']), M('Bottom left', null, 'pageNumber', ['footer-left']), M('Bottom center', null, 'pageNumber', ['footer-center']), M('Bottom right', null, 'pageNumber', ['footer-right']), { sep: true }, M('Format page numbers…', null, 'pageNumberFormat'), M('Remove page numbers', null, 'pageNumber', ['remove'])] })),
      grp('Text', btn({ lg: 1, ic: 'text-select', label: 'Text box', tip: 'Text box', act: 'insertTextBox' }), btn({ lg: 1, ic: 'calendar-clock', label: 'Date & time', tip: 'Date and time', act: 'insertDateTime' }), btn({ lg: 1, ic: 'minus', label: 'Line', tip: 'Horizontal line', act: 'hr' })),
      grp('Symbols', btn({ lg: 1, ic: 'sigma', label: 'Equation', tip: 'Equation', act: 'insertEquation' }), btn({ lg: 1, ic: 'omega', label: 'Symbol', tip: 'Symbol', act: 'insertSymbol' })));
  });

  /* ---------- LAYOUT ---------- */
  T.add('layout', 'Layout', (p) => {
    const sizes = Object.keys(WX.page.SIZES);
    p.append(
      grp('Page Setup', btn({ lg: 1, ic: 'square-dashed', label: 'Margins', tip: 'Margins', menu: () => [M('Normal (1")', null, 'margins', ['normal']), M('Narrow (0.5")', null, 'margins', ['narrow']), M('Moderate', null, 'margins', ['moderate']), M('Wide', null, 'margins', ['wide']), M('None', null, 'margins', ['none']), { sep: true }, M('Custom margins…', null, 'customMargins')] }),
        btn({ lg: 1, ic: 'rotate-3d', label: 'Orientation', tip: 'Orientation', menu: () => [M('Portrait', 'file', 'orientation', ['portrait']), M('Landscape', 'monitor', 'orientation', ['landscape'])] }),
        btn({ lg: 1, ic: 'file', label: 'Size', tip: 'Paper size', menu: () => sizes.map((s) => M(s, null, 'pageSize', [s], { checked: E().doc && E().doc.settings.page.size === s })) }),
        btn({ lg: 1, ic: 'columns-3', label: 'Columns', tip: 'Columns', menu: () => [M('One', null, 'columns', [1]), M('Two', null, 'columns', [2]), M('Three', null, 'columns', [3])] }),
        btn({ lg: 1, ic: 'scissors-line-dashed', label: 'Breaks', tip: 'Breaks', menu: () => [M('Page break', null, 'pageBreak'), M('Section break (next page)', null, 'sectionBreak', ['nextpage']), M('Section break (continuous)', null, 'sectionBreak', ['continuous'])] })),
      grp('Page Background', btn({ lg: 1, ic: 'droplets', label: 'Watermark', tip: 'Watermark', act: 'watermark' }), btn({ lg: 1, ic: 'palette', label: 'Page colour', tip: 'Page colour', menu: (a) => { ui.colorPicker(a, { noneLabel: 'No colour', onPick: (c) => call('pageColor', c) }); } }), btn({ lg: 1, ic: 'frame', label: 'Page borders', tip: 'Page borders', act: 'pageBorders' })),
      grp('Paragraph', col(row(btn({ ic: 'indent', tip: 'Indent more', act: 'indent' }), btn({ ic: 'outdent', tip: 'Indent less', act: 'outdent' })), row(btn({ ic: 'arrow-up-from-line', label: 'Before 12pt', wide: 1, tip: 'Spacing before', act: 'spaceBefore', args: [12] }), btn({ ic: 'arrow-down-from-line', label: 'After 12pt', wide: 1, tip: 'Spacing after', act: 'spaceAfter', args: [12] })))));
  });

  /* ---------- REFERENCES ---------- */
  T.add('references', 'References', (p) => {
    p.append(
      grp('Table of Contents', btn({ lg: 1, ic: 'table-of-contents', label: 'Contents', tip: 'Table of contents', menu: () => [M('Insert table of contents', null, 'insertTOC'), M('Update table', null, 'updateTOC'), M('Remove table', null, 'removeTOC')] }), btn({ lg: 1, ic: 'refresh-cw', label: 'Update', tip: 'Update all fields', act: 'updateFields' })),
      grp('Footnotes', btn({ lg: 1, ic: 'superscript', label: 'Footnote', tip: 'Insert footnote', act: 'footnote' }), btn({ lg: 1, ic: 'notebook-text', label: 'Endnote', tip: 'Insert endnote', act: 'endnote' })),
      grp('Citations & Bibliography', btn({ lg: 1, ic: 'quote', label: 'Citation', tip: 'Insert citation', menu: (a) => { WX.refs.citationMenu(a); } }), btn({ lg: 1, ic: 'library', label: 'Sources', tip: 'Manage sources', act: 'sources' }), btn({ lg: 1, ic: 'book-open', label: 'Bibliography', tip: 'Insert bibliography', act: 'bibliography' })),
      grp('Captions', btn({ lg: 1, ic: 'captions', label: 'Caption', tip: 'Insert caption', act: 'caption' }), btn({ lg: 1, ic: 'corner-down-right', label: 'Cross-ref', tip: 'Cross-reference', act: 'crossRef' })),
      grp('Index', btn({ lg: 1, ic: 'tag', label: 'Mark entry', tip: 'Mark index entry', act: 'markEntry' }), btn({ lg: 1, ic: 'list-ordered', label: 'Index', tip: 'Insert index', act: 'insertIndex' })));
  });

  /* ---------- REVIEW ---------- */
  T.add('review', 'Review', (p) => {
    p.append(
      grp('Proofing', btn({ lg: 1, ic: 'spell-check', label: 'Spelling', tip: 'Spelling (F7)', act: 'spelling' }), btn({ lg: 1, ic: 'check-check', label: 'Grammar', tip: 'Grammar', act: 'grammar' }), btn({ lg: 1, ic: 'hash', label: 'Word count', tip: 'Word count', act: 'wordCount' }), btn({ lg: 1, ic: 'gauge', label: 'Readability', tip: 'Readability', act: 'readability' }), btn({ lg: 1, ic: 'wand-sparkles', label: 'AutoCorrect', tip: 'Proofing options', act: 'autocorrect' })),
      grp('Comments', btn({ lg: 1, ic: 'message-square-plus', label: 'New comment', tip: 'New comment', act: 'addComment' }), btn({ lg: 1, ic: 'messages-square', label: 'Show', tip: 'Show comments', act: 'showComments' }), btn({ lg: 1, ic: 'message-square-x', label: 'Delete all', tip: 'Delete all comments', act: 'deleteComments' })),
      grp('Tracking', btn({ lg: 1, ic: 'git-pull-request-draft', label: 'Track changes', tip: 'Track changes (Ctrl+Shift+E)', act: 'trackChanges', on: () => WX.review.trackOn() }), btn({ lg: 1, ic: 'check', label: 'Accept', tip: 'Accept change', menu: () => [M('Accept this change', null, 'acceptChange'), M('Accept all changes', null, 'acceptAll')] }), btn({ lg: 1, ic: 'x', label: 'Reject', tip: 'Reject change', menu: () => [M('Reject this change', null, 'rejectChange'), M('Reject all changes', null, 'rejectAll')] }), col(btn({ ic: 'chevron-left', label: 'Previous', wide: 1, tip: 'Previous change', act: 'prevChange' }), btn({ ic: 'chevron-right', label: 'Next', wide: 1, tip: 'Next change', act: 'nextChange' }))),
      grp('Compare & Protect', btn({ lg: 1, ic: 'git-compare', label: 'Compare', tip: 'Compare with a version or file', act: 'compare' }), btn({ lg: 1, ic: 'lock', label: 'Protect', tip: 'Restrict editing', act: 'protect' })),
      grp('AI', btn({ lg: 1, ic: 'sparkles', label: 'AI assistant', tip: 'AI assistant', act: 'toggleAI' })));
  });

  /* ---------- VIEW ---------- */
  T.add('view', 'View', (p) => {
    const chk = (k) => () => WX.state[k];
    p.append(
      grp('Views', btn({ lg: 1, ic: 'file-text', label: 'Print layout', tip: 'Print layout', act: 'setView', args: ['print'], on: () => WX.state.view === 'print' }), btn({ lg: 1, ic: 'globe', label: 'Web layout', tip: 'Web layout', act: 'setView', args: ['web'], on: () => WX.state.view === 'web' }), btn({ lg: 1, ic: 'book-open', label: 'Read mode', tip: 'Read mode', act: 'setView', args: ['read'], on: () => WX.state.view === 'read' })),
      grp('Show', col(row(btn({ ic: 'ruler', label: 'Ruler', wide: 1, tip: 'Show ruler', act: 'toggleRuler', on: () => WX.state.showRuler !== false })), row(btn({ ic: 'grid-3x3', label: 'Gridlines', wide: 1, tip: 'Show gridlines', act: 'toggleGrid', on: () => document.body.classList.contains('show-grid') })), row(btn({ ic: 'panel-left', label: 'Navigation pane', wide: 1, tip: 'Navigation pane', act: 'toggleNav', on: () => !$('#nav-pane').hidden }))),),
      grp('Zoom', btn({ lg: 1, ic: 'zoom-in', label: '100%', tip: 'Zoom to 100%', act: 'zoomTo', args: [1] }), btn({ lg: 1, ic: 'move-horizontal', label: 'Page width', tip: 'Fit page width', act: 'fitWidth' }), btn({ lg: 1, ic: 'maximize', label: 'One page', tip: 'Fit whole page', act: 'fitPage' }), btn({ lg: 1, ic: 'layout-grid', label: 'Pages', tip: 'Page overview', act: 'multiPage' })),
      grp('Window', btn({ lg: 1, ic: 'maximize-2', label: 'Full screen', tip: 'Full screen (F11)', act: 'fullscreen' }), btn({ lg: 1, ic: 'moon', label: 'Dark mode', tip: 'Toggle dark mode', act: 'toggleTheme' }), btn({ lg: 1, ic: 'history', label: 'Versions', tip: 'Version history', act: 'versions' })));
  });

  /* ---------- TABLE (contextual) ---------- */
  T.add('table', 'Table', (p) => {
    p.append(
      grp('Table Styles', btn({ lg: 1, ic: 'swatch-book', label: 'Style', tip: 'Table style', menu: () => WX.tables.styles.map(([k, l]) => M(l, null, 'tableStyle', [k])) }), btn({ lg: 1, ic: 'table-properties', label: 'Header row', tip: 'Toggle header row', act: 'tableHeaderRow' }), btn({ lg: 1, ic: 'paint-bucket', label: 'Shading', tip: 'Cell shading', menu: (a) => { ui.colorPicker(a, { noneLabel: 'No colour', onPick: (c) => call('tableShade', c) }); } }), btn({ lg: 1, ic: 'square', label: 'Borders', tip: 'Cell borders', menu: () => [M('All borders', null, 'tableBorders', ['all']), M('Outside borders', null, 'tableBorders', ['outside']), M('Inside borders', null, 'tableBorders', ['inside']), M('No border', null, 'tableBorders', ['none'])] })),
      grp('Rows & Columns', col(btn({ ic: 'between-horizontal-start', label: 'Insert above', wide: 1, tip: 'Insert row above', act: 'tableInsertRowAbove' }), btn({ ic: 'between-horizontal-end', label: 'Insert below', wide: 1, tip: 'Insert row below', act: 'tableInsertRowBelow' })), col(btn({ ic: 'between-vertical-start', label: 'Insert left', wide: 1, tip: 'Insert column left', act: 'tableInsertColLeft' }), btn({ ic: 'between-vertical-end', label: 'Insert right', wide: 1, tip: 'Insert column right', act: 'tableInsertColRight' })), col(btn({ ic: 'trash-2', label: 'Delete row', wide: 1, tip: 'Delete row', act: 'tableDeleteRow' }), btn({ ic: 'trash-2', label: 'Delete column', wide: 1, tip: 'Delete column', act: 'tableDeleteCol' }), btn({ ic: 'table', label: 'Delete table', wide: 1, tip: 'Delete table', act: 'tableDelete' }))),
      grp('Merge', btn({ lg: 1, ic: 'merge', label: 'Merge cells', tip: 'Merge selected cells', act: 'tableMerge' }), btn({ lg: 1, ic: 'split', label: 'Split cell', tip: 'Split cell', act: 'tableSplit' })),
      grp('Alignment', col(row(btn({ ic: 'align-vertical-justify-start', tip: 'Align top', act: 'tableVAlign', args: ['top'] }), btn({ ic: 'align-vertical-justify-center', tip: 'Align middle', act: 'tableVAlign', args: ['middle'] }), btn({ ic: 'align-vertical-justify-end', tip: 'Align bottom', act: 'tableVAlign', args: ['bottom'] })), row(btn({ ic: 'align-left', tip: 'Table left', act: 'tableAlign', args: ['left'] }), btn({ ic: 'align-center', tip: 'Table center', act: 'tableAlign', args: ['center'] }), btn({ ic: 'align-right', tip: 'Table right', act: 'tableAlign', args: ['right'] })))),
      grp('Cell Size', btn({ lg: 1, ic: 'maximize', label: 'AutoFit', tip: 'AutoFit', menu: () => [M('AutoFit to window', null, 'tableAutofit', ['window']), M('AutoFit to contents', null, 'tableAutofit', ['contents']), M('Fixed width', null, 'tableAutofit', ['fixed'])] }), btn({ lg: 1, ic: 'columns-3', label: 'Distribute', tip: 'Distribute columns evenly', act: 'tableDistribute' }), btn({ lg: 1, ic: 'settings-2', label: 'Properties', tip: 'Table properties', act: 'tableProps' })));
  }, true);

  /* ---------- state sync ---------- */
  function sync() {
    if (document.body.dataset.screen !== 'editor' || !E().doc) return; let st = {}; try { st = F().queryState() || {}; } catch (e) { /* ignore */ }
    toggles.forEach((t) => { try { if (t.test) t.node.classList.toggle('on', !!t.test(st)); if (t.sync) t.sync(t.node, st); } catch (e) { /* ignore */ } });
    const inT = WX.tables.inTable(); const tt = $('.rtab[data-tab="table"]'); if (tt && tt.hidden === inT) { tt.hidden = !inT; if (!inT && T.active === 'table') T.show('home'); else if (inT && T.active !== 'table') T.show('table'); }
    $$('#mobile-bar [data-st]').forEach((b) => b.classList.toggle('on', !!st[b.dataset.st]));
  }
  const syncD = WX.util.debounce(sync, 60);

  /* ---------- side pane manager ---------- */
  const side = (WX.side = { id: null, onClose: null });
  side.open = function (id, title, render, onClose) {
    if (side.id && side.id !== id && side.onClose) { try { side.onClose(); } catch (e) { /* ignore */ } }
    side.id = id; side.onClose = onClose || null; $('#side-title').textContent = title; $('#side-pane').hidden = false; const b = $('#side-body'); b.innerHTML = ''; side.render = render; render(b); WX.bus.emit('sidechange', id); fitSoon();
  };
  side.refresh = () => { if (side.id && side.render) side.render($('#side-body')); };
  side.close = function () { if (!side.id) return; const f = side.onClose; side.id = null; side.onClose = null; $('#side-pane').hidden = true; if (f) try { f(); } catch (e) { /* ignore */ } WX.bus.emit('sidechange', null); fitSoon(); };
  side.toggle = (id, title, render, onClose) => (side.id === id ? side.close() : side.open(id, title, render, onClose));
  const fitSoon = () => setTimeout(() => { if (WX.state.autoFit && WX.page.fit) WX.page.fit(); }, 30);

  /* ---------- navigation pane ---------- */
  const nav = { tab: 'headings' };
  function renderNav() {
    const body = $('#nav-body'); if (!body || $('#nav-pane').hidden || !E().doc) return; body.innerHTML = '';
    $$('.pane-tab', $('#nav-tabs')).forEach((b) => b.classList.toggle('active', b.dataset.t === nav.tab));
    if (nav.tab === 'headings') {
      const hs = Array.from(E().el.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter((h) => h.textContent.trim() && !h.closest('.wx-toc')); if (!hs.length) return void body.append(el('div', { class: 'muted', text: 'Add headings (Home → Styles) to build an outline you can click to jump around.' }));
      hs.forEach((h) => body.append(el('button', { class: 'nav-h l' + h.tagName[1], style: { paddingLeft: 8 + (+h.tagName[1] - 1) * 14 + 'px' }, text: h.textContent.trim(), onclick: () => { h.scrollIntoView({ block: 'center', behavior: 'smooth' }); const r = document.createRange(); r.selectNodeContents(h); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } })));
    } else if (nav.tab === 'pages') {
      const g = el('div', { class: 'nav-thumbs' }); const n = Math.min(WX.page.pages, 40); for (let i = 1; i <= n; i++) g.append(el('button', { onclick: () => WX.page.goto(i) }, WX.page.thumb(i, 100 / WX.page.metrics().W), el('div', { text: i }))); if (WX.page.pages > 40) g.append(el('div', { class: 'muted', text: '+' + (WX.page.pages - 40) + ' more pages' })); body.append(g);
    } else {
      const q = el('input', { class: 'input', placeholder: 'Search the document', style: { width: '100%', marginBottom: '8px' } }); const out = el('div'); q.addEventListener('input', () => { out.innerHTML = ''; if (!q.value) return; const rs = WX.search.collect(q.value, { cs: false, ww: false, re: false }); out.append(el('div', { class: 'muted', text: rs.length + ' result' + (rs.length === 1 ? '' : 's') })); rs.slice(0, 80).forEach((r) => { const t = r.startContainer.textContent; out.append(el('button', { class: 'nav-h', html: esc(t.slice(Math.max(0, r.startOffset - 20), r.startOffset)) + '<mark>' + esc(r.toString()) + '</mark>' + esc(t.slice(r.endOffset, r.endOffset + 30)), onclick: () => { const s = getSelection(); s.removeAllRanges(); s.addRange(r); r.startContainer.parentElement.scrollIntoView({ block: 'center' }); } })); }); }); body.append(q, out);
    }
  }
  const renderNavD = WX.util.debounce(renderNav, 400);
  A.toggleNav = function (tab) { const p = $('#nav-pane'); if (typeof tab === 'string') nav.tab = tab; p.hidden = typeof tab === 'string' ? false : !p.hidden; renderNav(); fitSoon(); sync(); };

  /* ---------- File menu ---------- */
  function fileMenu(anchor) {
    const D = WX.docs; ui.menu(anchor, [
      M('New document', 'file-plus', 'newDoc', null, { shortcut: 'Alt+N' }), M('Open file…', 'folder-open', 'openFile', null, { shortcut: 'Ctrl+O' }), M('Back to Home', 'home', 'goHome'), { sep: true },
      M('Save', 'save', 'save', null, { shortcut: 'Ctrl+S' }), M('Save a copy…', 'copy', 'saveAs'), M('Rename…', 'pencil', 'rename'), M('Duplicate', 'files', 'duplicate'), M('Version history', 'history', 'versions'), M('Share…', 'share-2', 'share'), { sep: true },
      { label: 'Export / Download', icon: 'download', children: [M('Word document (.docx)', null, 'exportDocx'), M('PDF', null, 'exportPdf'), M('Web page (.html)', null, 'exportHtml'), M('Plain text (.txt)', null, 'exportTxt'), M('WordX file (.wordx)', null, 'exportWordx')] },
      M('Print…', 'printer', 'print', null, { shortcut: 'Ctrl+P' }), M('Page setup…', 'file-cog', 'customMargins'), M('Document statistics', 'hash', 'wordCount'), { sep: true },
      M('Close document', 'x', 'closeTab'), M('Delete document…', 'trash-2', 'deleteDoc')]);
  }

  /* ---------- theme ---------- */
  function applyTheme(t) { WX.state.theme = t; document.documentElement.dataset.theme = t; $$('#btn-theme,#home-theme').forEach((b) => { if (b.id === 'btn-theme') b.innerHTML = icon(t === 'dark' ? 'sun' : 'moon', 18); else b.innerHTML = icon(t === 'dark' ? 'sun' : 'moon', 18) + '<span>' + (t === 'dark' ? 'Light mode' : 'Dark mode') + '</span>'; }); try { localStorage.setItem('wordx-theme', t); } catch (e) { /* ignore */ } toggles.forEach(() => 0); }
  A.toggleTheme = () => applyTheme(WX.state.theme === 'dark' ? 'light' : 'dark'); T.applyTheme = applyTheme;

  /* ---------- title bar / status bar / mobile bar ---------- */
  function initChrome() {
    $('#btn-home').title = 'Home'; $('#btn-file').innerHTML = 'File'; $('#btn-file').onclick = (e) => fileMenu(e.currentTarget);
    const ic = (id, n, s) => { const b = $(id); if (b) b.innerHTML = icon(n, s || 18); return b; };
    ic('#btn-undo', 'undo-2').onclick = () => call('undo'); ic('#btn-redo', 'redo-2').onclick = () => call('redo'); ic('#btn-comments', 'message-square').onclick = () => call('showComments'); ic('#btn-ai', 'sparkles').onclick = () => call('toggleAI'); $('#btn-theme').onclick = () => call('toggleTheme');
    ['btn-undo', 'btn-redo', 'btn-save', 'btn-comments', 'btn-ai', 'btn-theme', 'btn-home', 'btn-newtab'].forEach((i) => { const b = $('#' + i); if (b) b.setAttribute('data-tip', { 'btn-undo': 'Undo (Ctrl+Z)', 'btn-redo': 'Redo (Ctrl+Y)', 'btn-save': 'Save (Ctrl+S)', 'btn-comments': 'Comments', 'btn-ai': 'AI assistant', 'btn-theme': 'Dark / light mode', 'btn-home': 'Home', 'btn-newtab': 'New document' }[i]); });
    $('#home-theme').onclick = () => call('toggleTheme'); $('#nav-close').innerHTML = icon('x', 16); $('#nav-close').onclick = () => A.toggleNav(); $('#side-close').innerHTML = icon('x', 16); $('#side-close').onclick = () => side.close();
    const nt = $('#nav-tabs'); [['headings', 'Headings'], ['pages', 'Pages'], ['results', 'Results']].forEach(([k, l]) => nt.append(el('button', { class: 'pane-tab', 'data-t': k, text: l, onclick: () => { nav.tab = k; renderNav(); } })));
    const undoState = () => { $('#btn-undo').disabled = !E().canUndo(); $('#btn-redo').disabled = !E().canRedo(); };
    ['dirty', 'restored', 'docloaded', 'docswitched'].forEach((e) => WX.bus.on(e, () => { undoState(); renderNavD(); }));
    WX.bus.on('selection', syncD); WX.bus.on('docloaded', () => { sync(); renderNav(); }); WX.bus.on('input', syncD); WX.bus.on('paginated', () => { renderNavD(); });
    $('#home-menu-btn') && 0;
    // status bar
    const views = $('#sb-views'); [['print', 'file-text', 'Print layout'], ['web', 'globe', 'Web layout'], ['read', 'book-open', 'Read mode']].forEach(([v, i, t]) => views.append(el('button', { class: 'icon-btn small', 'data-v': v, 'data-tip': t, 'aria-label': t, html: icon(i, 15), onclick: () => call('setView', v) })));
    $('#zoom-out').innerHTML = icon('minus', 14); $('#zoom-in').innerHTML = icon('plus', 14); $('#zoom-out').onclick = () => call('zoomOut'); $('#zoom-in').onclick = () => call('zoomIn'); $('#zoom-label').onclick = () => call('fitWidth');
    $('#zoom-slider').addEventListener('input', (e) => call('zoomTo', +e.target.value / 100));
    $('#sb-words').onclick = () => call('wordCount');
    $('#sb-page').onclick = async () => { const v = await ui.prompt('Go to page', 'Page number (1–' + WX.page.pages + ')', String(WX.page.currentPage())); const n = parseInt(v, 10); if (n) WX.page.goto(Math.min(Math.max(1, n), WX.page.pages)); };
    const upd = WX.util.debounce(() => { if (!E().doc) return; $('#sb-page').textContent = `Page ${WX.page.currentPage()} of ${WX.page.pages}`; WX.review && WX.review.updateStatus && WX.review.updateStatus(); const z = Math.round(WX.state.zoom * 100); $('#zoom-label').textContent = z + '%'; $('#zoom-slider').value = z; $$('#sb-views button').forEach((b) => b.classList.toggle('on', b.dataset.v === WX.state.view)); const tr = $('#sb-track'); tr.hidden = !WX.review.trackOn(); }, 80);
    ['paginated', 'selection', 'zoom', 'viewchange', 'docloaded', 'input'].forEach((e) => WX.bus.on(e, upd)); $('#canvas-scroll').addEventListener('scroll', upd, { passive: true });
    WX.bus.on('viewchange', () => { document.body.dataset.view = WX.state.view; toggles.forEach((t) => t.test && t.node.classList.toggle('on', !!t.test({}))); fitSoon(); });
    $('#read-exit') && ($('#read-exit').onclick = () => call('setView', 'print')); $('#read-zoomin') && ($('#read-zoomin').onclick = () => call('zoomIn')); $('#read-zoomout') && ($('#read-zoomout').onclick = () => call('zoomOut'));
    // mobile bar
    const mb = $('#mobile-bar'); const m = (i, act, tip, st) => el('button', { class: 'icon-btn', 'aria-label': tip, 'data-st': st || null, html: icon(i, 20), onmousedown: (e) => e.preventDefault(), onclick: () => call(act) });
    mb.append(m('undo-2', 'undo', 'Undo'), m('redo-2', 'redo', 'Redo'), el('span', { class: 'mb-sep' }), m('bold', 'bold', 'Bold', 'bold'), m('italic', 'italic', 'Italic', 'italic'), m('underline', 'underline', 'Underline', 'underline'), el('span', { class: 'mb-sep' }), m('list', 'bullets', 'Bullets', 'ul'), m('list-ordered', 'numbering', 'Numbering', 'ol'), m('align-left', 'alignLeft', 'Align left'), m('align-center', 'alignCenter', 'Center'),
      el('button', { class: 'icon-btn', 'aria-label': 'More formatting', html: icon('a-large-small', 20), onmousedown: (e) => e.preventDefault(), onclick: (e) => ui.menu(e.currentTarget, [M('Heading 1', null, 'style', ['h1']), M('Heading 2', null, 'style', ['h2']), M('Normal text', null, 'style', ['normal']), { sep: true }, M('Strikethrough', null, 'strike'), M('Increase font size', null, 'growFont'), M('Decrease font size', null, 'shrinkFont'), M('Align right', null, 'alignRight'), M('Justify', null, 'alignJustify'), M('Insert link…', null, 'link'), M('Insert picture…', null, 'insertPicture'), M('Insert table…', null, 'tableInsertDialog')]) }),
      el('button', { class: 'icon-btn', 'aria-label': 'Show or hide the ribbon', html: icon('panel-top', 20), onclick: () => { toggleRibbon(); } }));
    A.tableInsertDialog = () => WX.tables.insertDialog();
  }

  T.init = function () { buildRibbon(); initChrome(); let t = 'light'; try { t = localStorage.getItem('wordx-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } catch (e) { /* ignore */ } applyTheme(t); };
})();
