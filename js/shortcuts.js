/* WordX – shortcuts.js : global keyboard shortcuts (all route through WX.act). */
(function () {
  'use strict';
  const WX = window.WX; const A = WX.act;
  const MAP = { b: 'bold', i: 'italic', u: 'underline', f: 'find', h: 'replace', k: 'link', e: 'alignCenter', l: 'alignLeft', r: 'alignRight', j: 'alignJustify', p: 'print', o: 'openFile', y: 'redo', z: 'undo', a: 'selectAll', Enter: 'pageBreak', '[': 'shrinkFont', ']': 'growFont' };
  WX.shortcuts = [['Ctrl+B', 'Bold'], ['Ctrl+I', 'Italic'], ['Ctrl+U', 'Underline'], ['Ctrl+S', 'Save'], ['Ctrl+P', 'Print'], ['Ctrl+Z', 'Undo'], ['Ctrl+Y', 'Redo'], ['Ctrl+A', 'Select all'], ['Ctrl+F', 'Find'], ['Ctrl+H', 'Replace'], ['Ctrl+K', 'Insert link'], ['Ctrl+E', 'Center'], ['Ctrl+L', 'Align left'], ['Ctrl+R', 'Align right'], ['Ctrl+J', 'Justify'], ['Ctrl+Enter', 'Page break'], ['Ctrl+Shift+E', 'Track changes'], ['Ctrl+Alt+1/2/3', 'Heading 1/2/3'], ['Ctrl+Alt+0', 'Normal text'], ['Ctrl+] / [', 'Grow / shrink font'], ['F7', 'Spelling'], ['F11', 'Full screen']];
  const fire = (name, ...a) => { try { const r = A[name] && A[name](...a); if (r && r.catch) r.catch((e) => WX.ui.toast(e.message, 'error')); } catch (e) { console.error(e); WX.ui.toast(e.message || 'Action failed', 'error'); } };
  document.addEventListener('keydown', (e) => {
    const k = e.key; const mod = e.ctrlKey || e.metaKey; const inEditor = !!(e.target.closest && e.target.closest('#editor')); const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || (e.target.isContentEditable && !inEditor);
    const screen = document.body.dataset.screen;
    if (mod && !e.altKey && k.toLowerCase() === 's') { e.preventDefault(); if (screen === 'editor') fire(e.shiftKey ? 'saveAs' : 'save'); return; }
    if (screen !== 'editor') { if (mod && k.toLowerCase() === 'o') { e.preventDefault(); fire('openFile'); } return; }
    if (k === 'F7') { e.preventDefault(); return fire('spelling'); } if (k === 'F11') { e.preventDefault(); return fire('fullscreen'); }
    if (k === 'Escape' && WX.state.view === 'read') return fire('setView', 'print');
    if (!mod || inField || document.querySelector('.modal-back')) return;
    if (e.altKey && /^[0-3]$/.test(k)) { e.preventDefault(); return fire('style', ['normal', 'h1', 'h2', 'h3'][+k]); }
    if (e.shiftKey && k.toLowerCase() === 'e') { e.preventDefault(); return fire('trackChanges'); }
    if (e.shiftKey && k.toLowerCase() === 'z') { e.preventDefault(); return fire('redo'); }
    if (e.shiftKey && (k === '>' || k === '.')) { e.preventDefault(); return fire('growFont'); } if (e.shiftKey && (k === '<' || k === ',')) { e.preventDefault(); return fire('shrinkFont'); }
    if (e.shiftKey && k.toLowerCase() === 'v') { e.preventDefault(); return fire('pastePlain'); }
    const name = MAP[k] || MAP[k.toLowerCase()]; if (!name || e.altKey) return;
    if (!inEditor && !['find', 'replace', 'print', 'openFile'].includes(name)) return; // let native fields keep their own shortcuts
    if (e.shiftKey && !['print'].includes(name)) return;
    e.preventDefault(); fire(name);
  }, true);
  WX.act.shortcutsHelp = () => WX.ui.dialog({ title: 'Keyboard shortcuts', width: '460px', body: '<table class="doc-list" style="font-size:13px">' + WX.shortcuts.map(([k, d]) => `<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`).join('') + '</table>', buttons: [{ label: 'Close', primary: true }] });
})();
