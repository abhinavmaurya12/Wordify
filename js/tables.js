/* WordX – tables.js
 * Table engine: insertion, row/column operations (span aware), merge/split,
 * rectangular cell selection by dragging, column resizing, styles and shading. */
(function () {
  'use strict';
  const WX = window.WX; const { el } = WX.util; const E = () => WX.editor;
  const T = (WX.tables = {});

  const cellOf = () => { const r = E().range(); if (!r) return null; const n = r.startContainer.nodeType === 3 ? r.startContainer.parentElement : r.startContainer; return n && n.closest ? n.closest('td,th') : null; };
  T.inTable = () => !!cellOf() && E().el.contains(cellOf());
  /** Build the logical grid: grid[row][col] -> cell element (spanning cells repeat). */
  function gridOf(table) {
    const g = [];
    Array.from(table.rows).forEach((tr, r) => {
      g[r] = g[r] || []; let c = 0;
      Array.from(tr.cells).forEach((cell) => {
        while (g[r][c]) c++;
        const rs = cell.rowSpan || 1, cs = cell.colSpan || 1;
        for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) { g[r + i] = g[r + i] || []; g[r + i][c + j] = cell; }
        c += cs;
      });
    });
    return g;
  }
  const posOf = (g, cell) => { for (let r = 0; r < g.length; r++) for (let c = 0; c < (g[r] || []).length; c++) if (g[r][c] === cell) return { r, c }; return null; };
  const newCell = (tag) => { const c = document.createElement(tag || 'td'); c.innerHTML = '<br>'; return c; };

  T.insert = function (rows, cols, style) {
    if (!E().isEditable()) return;
    const t = el('table', { class: style || 'wx-t-grid' }); const tb = el('tbody');
    for (let r = 0; r < rows; r++) { const tr = el('tr'); for (let c = 0; c < cols; c++) tr.append(newCell()); tb.append(tr); } t.append(tb);
    E().insertBlock(t); E().caretIn(t.querySelector('td')); WX.bus.emit('selection');
  };
  T.insertDialog = function () {
    WX.ui.dialog({ title: 'Insert table', width: '340px', body: '<div class="form grid2"><label>Columns<input class="input" type="number" id="tb-c" min="1" max="20" value="3"></label><label>Rows<input class="input" type="number" id="tb-r" min="1" max="100" value="3"></label></div>',
      buttons: [{ label: 'Cancel' }, { label: 'Insert', primary: true, onClick: (d) => T.insert(Math.min(100, +d.$('#tb-r').value || 1), Math.min(20, +d.$('#tb-c').value || 1)) }] });
  };
  T.gridPicker = function (anchor) {
    const R = 8, C = 10; const lab = el('div', { class: 'grid-lab', text: 'Insert table' });
    const g = el('div', { class: 'grid-pick', style: { gridTemplateColumns: `repeat(${C},18px)` } });
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) g.append(el('i', { 'data-r': r + 1, 'data-c': c + 1 }));
    g.addEventListener('mouseover', (e) => { const i = e.target.closest('i'); if (!i) return; const rr = +i.dataset.r, cc = +i.dataset.c; g.querySelectorAll('i').forEach((x) => x.classList.toggle('on', +x.dataset.r <= rr && +x.dataset.c <= cc)); lab.textContent = `${cc} × ${rr} table`; });
    g.addEventListener('click', (e) => { const i = e.target.closest('i'); if (!i) return; WX.ui.closeMenu(); T.insert(+i.dataset.r, +i.dataset.c); });
    const more = el('button', { class: 'cp-more', text: 'Insert Table…', onclick: () => { WX.ui.closeMenu(); T.insertDialog(); } });
    WX.ui.popover(anchor, el('div', null, lab, g, more));
  };

  /* ---------- selection of cells ---------- */
  const sel = () => Array.from(E().el.querySelectorAll('.wx-cellsel'));
  const clearSel = () => sel().forEach((c) => { c.classList.remove('wx-cellsel'); if (!c.getAttribute('class')) c.removeAttribute('class'); });
  T.selectedCells = () => { const s = sel(); if (s.length) return s; const c = cellOf(); return c ? [c] : []; };
  function rect(cells) {
    const t = cells[0].closest('table'); const g = gridOf(t); let r1 = 1e9, r2 = -1, c1 = 1e9, c2 = -1;
    cells.forEach((cell) => { for (let r = 0; r < g.length; r++) for (let c = 0; c < g[r].length; c++) if (g[r][c] === cell) { r1 = Math.min(r1, r); r2 = Math.max(r2, r); c1 = Math.min(c1, c); c2 = Math.max(c2, c); } });
    return { g, r1, r2, c1, c2, t };
  }
  function selectRect(a, b) {
    const t = a.closest('table'); if (!t || t !== b.closest('table')) return; const g = gridOf(t); const pa = posOf(g, a), pb = posOf(g, b); if (!pa || !pb) return;
    let r1 = Math.min(pa.r, pb.r), r2 = Math.max(pa.r, pb.r), c1 = Math.min(pa.c, pb.c), c2 = Math.max(pa.c, pb.c);
    for (let k = 0; k < 4; k++) { // grow so merged cells are fully included
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) { const x = posOf(g, g[r][c]); const cl = g[r][c]; const rs = cl.rowSpan || 1, cs = cl.colSpan || 1; r1 = Math.min(r1, x.r); c1 = Math.min(c1, x.c); r2 = Math.max(r2, x.r + rs - 1); c2 = Math.max(c2, x.c + cs - 1); }
    }
    clearSel(); const seen = new Set(); for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) { const cell = g[r][c]; if (cell && !seen.has(cell)) { seen.add(cell); cell.classList.add('wx-cellsel'); } }
  }

  /* ---------- structure operations ---------- */
  const run = (fn) => { if (!E().isEditable()) return; E().run(() => { const c = cellOf(); if (!c) return; fn(c, c.closest('table')); clearSel(); }); WX.page.schedule(); };
  function insertRow(after) {
    run((cell, t) => {
      const cells = T.selectedCells(); const { g, r1, r2 } = rect(cells.length ? cells : [cell]); const at = after ? r2 + 1 : r1; const cols = g[0].length; const ref = g[after ? r2 : r1];
      const tr = document.createElement('tr'); const seen = new Set();
      for (let c = 0; c < cols; c++) {
        const above = g[at] && g[at][c]; const spans = above && posOf(g, above).r < at && at < g.length;
        if (spans) { if (!seen.has(above)) { seen.add(above); above.rowSpan = (above.rowSpan || 1) + 1; } c += (above.colSpan || 1) - 1; continue; }
        const n = newCell(ref[c].tagName === 'TH' && !after && false ? 'th' : 'td'); n.style.cssText = ref[c].style.cssText.replace(/width:[^;]+;?/, ''); tr.append(n);
      }
      const refRow = (after ? g[r2][0] : g[r1][0]).parentElement; after ? refRow.after(tr) : refRow.before(tr);
      if (after && g[r2] && cells.some((cc) => (cc.rowSpan || 1) > 1)) { /* span handled above */ }
    });
  }
  function insertCol(after) {
    run((cell, t) => {
      const cells = T.selectedCells(); const { g, c1, c2 } = rect(cells.length ? cells : [cell]); const at = after ? c2 + 1 : c1; const done = new Set();
      g.forEach((row, r) => {
        const here = row[at], before = row[at - 1];
        if (here && before && here === before) { if (!done.has(here)) { done.add(here); here.colSpan = (here.colSpan || 1) + 1; } return; }
        const n = newCell(row[Math.min(at, row.length - 1)].tagName === 'TH' ? 'th' : 'td');
        if (here) here.before(n); else { const last = row[row.length - 1]; if (done.has(last)) return; done.add(last); last.after(n); }
      });
      const cg = t.querySelector('colgroup'); if (cg) cg.remove(); // widths re-equalise
    });
  }
  function deleteRow() {
    run((cell, t) => {
      const cells = T.selectedCells(); const { g, r1, r2 } = rect(cells.length ? cells : [cell]);
      if (r2 - r1 + 1 >= g.length) return T.deleteTable();
      for (let r = r2; r >= r1; r--) {
        const tr = t.rows[r]; const seen = new Set();
        g[r].forEach((c) => { if (seen.has(c)) return; seen.add(c); const p = posOf(g, c); const rs = c.rowSpan || 1;
          if (p.r < r) c.rowSpan = Math.max(1, rs - 1);
          else if (rs > 1 && g[r + 1]) { c.rowSpan = rs - 1; const next = t.rows[r + 1]; let ref = null; for (let cc = p.c + 1; cc < g[r + 1].length; cc++) { const x = g[r + 1][cc]; if (x && x.parentElement === next) { ref = x; break; } } ref ? ref.before(c) : next.append(c); }
        });
        tr.remove(); g.splice(r, 1);
      }
    });
  }
  function deleteCol() {
    run((cell, t) => {
      const cells = T.selectedCells(); const { g, c1, c2 } = rect(cells.length ? cells : [cell]);
      if (c2 - c1 + 1 >= g[0].length) return T.deleteTable();
      const done = new Set();
      g.forEach((row) => { for (let c = c1; c <= c2; c++) { const x = row[c]; if (!x || done.has(x + ':' + c)) continue; done.add(x + ':' + c); if ((x.colSpan || 1) > 1) x.colSpan = x.colSpan - 1; else x.remove(); } });
      const cg = t.querySelector('colgroup'); if (cg) cg.remove();
    });
  }
  T.deleteTable = function () { const c = cellOf(); if (!c) return; E().run(() => { const t = c.closest('table'); const nx = t.nextElementSibling || t.previousElementSibling; t.remove(); if (!E().el.firstChild) E().el.innerHTML = '<p><br></p>'; else if (nx) E().caretIn(nx); }); };
  function merge() {
    const cells = sel(); if (cells.length < 2) return WX.ui.toast('Select two or more cells by dragging across them.');
    run((cell, t) => {
      const { g, r1, r2, c1, c2 } = rect(cells); const tl = g[r1][c1]; const parts = [];
      cells.forEach((c) => { if (c !== tl) { if (c.textContent.trim() || c.querySelector('img,svg')) parts.push(c.innerHTML); c.remove(); } });
      if (parts.length) tl.innerHTML = (tl.textContent.trim() ? tl.innerHTML + '<br>' : '') + parts.join('<br>');
      tl.rowSpan = r2 - r1 + 1; tl.colSpan = c2 - c1 + 1; if (tl.rowSpan === 1) tl.removeAttribute('rowspan'); if (tl.colSpan === 1) tl.removeAttribute('colspan');
    });
  }
  function split() {
    run((cell, t) => {
      const g = gridOf(t); const p = posOf(g, cell); const rs = cell.rowSpan || 1, cs = cell.colSpan || 1;
      if (rs === 1 && cs === 1) { // split a plain cell into two columns
        const n = newCell(cell.tagName.toLowerCase()); cell.after(n); const cols = g[0].length;
        g.forEach((row, r) => { if (r === p.r) return; const x = row[p.c]; if (x && x !== cell) { if (row[p.c + 1] === x || row[p.c - 1] === x) x.colSpan = (x.colSpan || 1) + 1; else x.colSpan = (x.colSpan || 1) + 1; } }); return;
      }
      cell.removeAttribute('rowspan'); cell.removeAttribute('colspan');
      for (let r = 0; r < rs; r++) for (let c = 0; c < cs; c++) {
        if (!r && !c) continue; const n = newCell(cell.tagName.toLowerCase()); const row = t.rows[p.r + r];
        let ref = null; for (let cc = p.c + c + 1; cc < (g[p.r + r] || []).length; cc++) { const x = g[p.r + r][cc]; if (x && x !== cell && x.parentElement === row) { ref = x; break; } } ref ? ref.before(n) : row.append(n);
      }
    });
  }

  /* ---------- formatting ---------- */
  T.styles = [['wx-t-grid', 'Table Grid'], ['wx-t-plain', 'Plain (no borders)'], ['wx-t-header', 'Header row (blue)'], ['wx-t-banded', 'Banded rows'], ['wx-t-lines', 'Horizontal lines']];
  function setStyle(cls) { run((c, t) => { T.styles.forEach(([k]) => t.classList.remove(k)); t.classList.add(cls); Array.from(t.querySelectorAll('td,th')).forEach((x) => { x.style.removeProperty('border'); x.style.removeProperty('border-top'); x.style.removeProperty('border-left'); x.style.removeProperty('border-right'); x.style.removeProperty('border-bottom'); }); }); }
  function shade(color) { run(() => { T.selectedCells().forEach((c) => { color ? (c.style.backgroundColor = color) : c.style.removeProperty('background-color'); if (!c.getAttribute('style')) c.removeAttribute('style'); }); }); }
  function cellBorders(kind) {
    run((cell, t) => {
      const cells = T.selectedCells(); const all = sel().length === 0; const targets = all ? Array.from(t.querySelectorAll('td,th')) : cells; const css = '1px solid #444';
      if (kind === 'none' && all) { T.styles.forEach(([k]) => t.classList.remove(k)); t.classList.add('wx-t-plain'); }
      if (kind === 'all' && all) { T.styles.forEach(([k]) => t.classList.remove(k)); t.classList.add('wx-t-grid'); }
      const { g, r1, r2, c1, c2 } = rect(targets);
      targets.forEach((c) => {
        const p = posOf(g, c); const rs = c.rowSpan || 1, cs = c.colSpan || 1; const set = (s, v) => { c.style['border-' + s] = v; };
        if (kind === 'none') ['top', 'right', 'bottom', 'left'].forEach((s) => set(s, 'none'));
        else if (kind === 'all') ['top', 'right', 'bottom', 'left'].forEach((s) => set(s, css));
        else if (kind === 'outside') { if (p.r === r1) set('top', css); if (p.r + rs - 1 === r2) set('bottom', css); if (p.c === c1) set('left', css); if (p.c + cs - 1 === c2) set('right', css); }
        else if (kind === 'inside') { if (p.r > r1) set('top', css); if (p.r + rs - 1 < r2) set('bottom', css); if (p.c > c1) set('left', css); if (p.c + cs - 1 < c2) set('right', css); }
        else if (kind === 'top' && p.r === r1) set('top', css); else if (kind === 'bottom' && p.r + rs - 1 === r2) set('bottom', css);
        else if (kind === 'left' && p.c === c1) set('left', css); else if (kind === 'right' && p.c + cs - 1 === c2) set('right', css);
      });
    });
  }
  function vAlign(v) { run(() => T.selectedCells().forEach((c) => { c.style.verticalAlign = v; })); }
  function tableAlign(a) { run((c, t) => { t.style.marginLeft = a === 'left' ? '0' : 'auto'; t.style.marginRight = a === 'right' ? '0' : 'auto'; if (t.style.width === '100%') t.style.width = '70%'; if (a === 'left') t.style.marginLeft = '0'; if (a === 'left') t.style.marginRight = 'auto'; }); }
  function headerRow() { run((c, t) => { const first = t.rows[0]; const on = !first.cells[0] || first.cells[0].tagName !== 'TH'; Array.from(first.cells).forEach((x) => { const n = E().replaceTag(x, on ? 'th' : 'td'); n.style.textAlign = on ? 'left' : ''; if (!on && !n.getAttribute('style')) n.removeAttribute('style'); }); if (on && !T.styles.some(([k]) => t.classList.contains(k))) t.classList.add('wx-t-grid'); }); }
  function autofit(mode) { run((c, t) => { const cg = t.querySelector('colgroup'); if (cg) cg.remove(); if (mode === 'window') { t.style.width = '100%'; t.style.tableLayout = 'fixed'; } else if (mode === 'contents') { t.style.width = 'auto'; t.style.tableLayout = 'auto'; } else { t.style.tableLayout = 'fixed'; } }); }
  function distribute(what) {
    run((c, t) => {
      if (what === 'cols') { const cg = t.querySelector('colgroup'); if (cg) cg.remove(); Array.from(t.querySelectorAll('td,th')).forEach((x) => x.style.removeProperty('width')); }
      else { const h = Math.max(...Array.from(t.rows).map((r) => r.offsetHeight)); Array.from(t.rows).forEach((r) => { r.style.height = h + 'px'; }); }
    });
  }
  function propsDialog() {
    const c = cellOf(); if (!c) return; const t = c.closest('table');
    WX.ui.dialog({ title: 'Table properties', width: '420px', body: `<div class="form"><label>Preferred width (%)<input class="input" type="number" min="10" max="100" id="tp-w" value="${parseInt(t.style.width) || 100}"></label>
      <label>Cell padding (px)<input class="input" type="number" min="0" max="30" id="tp-p" value="${parseInt(c.style.padding) || 4}"></label>
      <label>Style <select class="input" id="tp-s">${T.styles.map(([k, l]) => `<option value="${k}" ${t.classList.contains(k) ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>`,
      buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, onClick: (d) => run((cc, tt) => { tt.style.width = Math.min(100, +d.$('#tp-w').value || 100) + '%'; const p = +d.$('#tp-p').value; tt.querySelectorAll('td,th').forEach((x) => { x.style.padding = p + 'px'; }); T.styles.forEach(([k]) => tt.classList.remove(k)); tt.classList.add(d.$('#tp-s').value); }) }] });
  }

  /* ---------- column resize ---------- */
  function ensureColgroup(t) {
    let cg = t.querySelector('colgroup'); const g = gridOf(t); const n = g[0] ? g[0].length : 0; if (cg && cg.children.length === n) return cg;
    if (cg) cg.remove(); cg = document.createElement('colgroup'); const w = t.getBoundingClientRect().width / (WX.state.zoom || 1);
    const widths = []; for (let c = 0; c < n; c++) { const cell = g[0][c]; widths.push(cell.getBoundingClientRect().width / (WX.state.zoom || 1) / (cell.colSpan || 1)); }
    const sum = widths.reduce((a, b) => a + b, 0) || 1; widths.forEach((x) => { const col = document.createElement('col'); col.style.width = (x / sum * 100).toFixed(2) + '%'; cg.append(col); });
    t.prepend(cg); t.style.tableLayout = 'fixed'; return cg;
  }
  function edgeAt(e) {
    const td = e.target.closest && e.target.closest('td,th'); if (!td || !E().el.contains(td)) return null;
    const r = td.getBoundingClientRect(), z = WX.state.zoom || 1; if (r.right - e.clientX > 4 * z || r.right - e.clientX < -2) return null;
    const g = gridOf(td.closest('table')); const p = posOf(g, td); if (!p) return null; const endCol = p.c + (td.colSpan || 1) - 1; if (endCol >= g[0].length - 1) return null; return { td, col: endCol };
  }
  function initResize() {
    const ed = E().el; let drag = null;
    ed.addEventListener('mousemove', (e) => { if (drag) return; ed.classList.toggle('wx-col-resize', !!(E().isEditable() && edgeAt(e))); });
    ed.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; const edge = E().isEditable() && edgeAt(e);
      if (edge) {
        e.preventDefault(); const t = edge.td.closest('table'); const cg = ensureColgroup(t); const cols = Array.from(cg.children); const tw = t.getBoundingClientRect().width;
        drag = { t, cols, i: edge.col, x: e.clientX, a: parseFloat(cols[edge.col].style.width) / 100 * tw, b: parseFloat(cols[edge.col + 1].style.width) / 100 * tw, tw };
        const mv = (ev) => { const d = (ev.clientX - drag.x) / (WX.state.zoom || 1); const na = Math.max(24, drag.a + d), nb = Math.max(24, drag.b - (na - drag.a)); const tot = drag.a + drag.b; const fa = Math.min(na, tot - 24); cols[drag.i].style.width = (fa / tw * 100).toFixed(2) + '%'; cols[drag.i + 1].style.width = ((tot - fa) / tw * 100).toFixed(2) + '%'; };
        const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); drag = null; E().changed({ immediate: true }); }; document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up); return;
      }
      // rectangular cell selection
      clearSel(); const td = e.target.closest && e.target.closest('td,th'); if (!td || !E().isEditable() && !E().protectedSelectable) return;
      const start = td; let moved = false;
      const mv = (ev) => { const t2 = document.elementFromPoint(ev.clientX, ev.clientY); const c2 = t2 && t2.closest && t2.closest('td,th'); if (c2 && c2 !== start && c2.closest('table') === start.closest('table')) { moved = true; selectRect(start, c2); getSelection().removeAllRanges(); } else if (c2 === start && moved) { clearSel(); } };
      const up = () => { document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up); if (moved) { const cells = sel(); if (cells.length) { const r = document.createRange(); r.selectNodeContents(cells[0]); r.collapse(true); E().setRange(r); } } WX.bus.emit('selection'); };
      document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
    });
    document.addEventListener('mousedown', (e) => { if (!e.target.closest('#editor') && !e.target.closest('.menu') && !e.target.closest('#ribbon')) clearSel(); });
  }
  T.tabMove = function (td, back) {
    const cells = Array.from(td.closest('table').querySelectorAll('td,th')); const i = cells.indexOf(td); const next = cells[i + (back ? -1 : 1)];
    if (next) return E().caretIn(next);
    if (!back) { insertRow(true); const c = cellOf(); const t = (c || td).closest('table'); E().caretIn(t.rows[t.rows.length - 1].cells[0]); }
  };
  T.init = function () {
    initResize();
    E().ctxProviders.push((e) => {
      if (!e.target.closest || !e.target.closest('td,th') || !E().isEditable()) return null;
      const c = e.target.closest('td,th'); if (!sel().length) E().caretIn(c);
      return [{ label: 'Insert row above', icon: 'between-vertical-start', action: () => insertRow(false) }, { label: 'Insert row below', action: () => insertRow(true) }, { label: 'Insert column left', action: () => insertCol(false) }, { label: 'Insert column right', action: () => insertCol(true) }, { sep: true },
        { label: 'Delete row', action: deleteRow }, { label: 'Delete column', action: deleteCol }, { label: 'Delete table', icon: 'trash-2', action: T.deleteTable }, { sep: true },
        { label: 'Merge cells', icon: 'table-cells-merge', disabled: sel().length < 2, action: merge }, { label: 'Split cell', icon: 'table-cells-split', action: split }, { label: 'Table properties…', action: propsDialog }];
    });
  };

  Object.assign(WX.act, {
    tableInsertRowAbove: () => insertRow(false), tableInsertRowBelow: () => insertRow(true), tableInsertColLeft: () => insertCol(false), tableInsertColRight: () => insertCol(true),
    tableDeleteRow: deleteRow, tableDeleteCol: deleteCol, tableDelete: T.deleteTable, tableMerge: merge, tableSplit: split, tableStyle: setStyle, tableShade: shade, tableBorders: cellBorders,
    tableVAlign: vAlign, tableAlign, tableHeaderRow: headerRow, tableAutofit: autofit, tableDistribute: distribute, tableProps: propsDialog,
  });
})();
