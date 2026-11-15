const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage(); let errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); }); p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.addInitScript(() => { window.print = () => {}; });
  await p.goto('http://localhost:8123/index.html'); await p.waitForTimeout(1000); await p.evaluate(() => WX.docs.fromTemplate('report')); await p.waitForTimeout(500);
  const skip = /Delete|Remove table|Full screen|Print|Close document|Back to Home|Export|Download|Open file|Save a copy|Rename|Duplicate/i;
  let tested = 0;
  for (const t of ['home', 'insert', 'layout', 'references', 'review', 'view', 'file']) {
    let n;
    if (t === 'file') n = 1; else { await p.waitForTimeout(300); await p.evaluate((t) => { document.querySelectorAll('.modal-back').forEach(m => m.remove()); WX.ui.closeMenu(); document.querySelector(`.rtab[data-tab=${t}]`).click(); }, t); n = await p.evaluate((t) => document.querySelectorAll(`.rpanel[data-tab=${t}] button.rbtn:not(.split-main)`).length, t); }
    for (let i = 0; i < n; i++) {
      const sel = t === 'file' ? '#btn-file' : null;
      const open = async () => { await p.evaluate(() => { const h = document.querySelector('#editor p'); const r = document.createRange(); r.selectNodeContents(h); const s = getSelection(); s.removeAllRanges(); s.addRange(r); WX.editor.saveSel && WX.editor.saveSel(); WX.ui.closeMenu(); document.querySelectorAll('.modal-back').forEach(m => m.remove()); });
        if (t === 'file') await p.evaluate(() => document.getElementById('btn-file').click()); else await p.evaluate(([t, i]) => document.querySelectorAll(`.rpanel[data-tab=${t}] button.rbtn:not(.split-main)`)[i].click(), [t, i]); await p.waitForTimeout(120); };
      await open(); const items = await p.evaluate(() => Array.from(document.querySelectorAll('.menu > .menu-item')).map(x => x.textContent.trim())); if (!items.length) continue;
      const bl = await p.evaluate(([t, i]) => t === 'file' ? 'File' : (document.querySelectorAll(`.rpanel[data-tab=${t}] button.rbtn:not(.split-main)`)[i].getAttribute('aria-label')), [t, i]);
      for (let k = 0; k < items.length; k++) {
        if (skip.test(items[k])) continue; await open(); const before = errs.length;
        await p.evaluate((k) => { const it = document.querySelectorAll('.menu > .menu-item')[k]; if (it) it.dispatchEvent(new MouseEvent('click', { bubbles: true })); }, k); await p.waitForTimeout(150);
        const toast = await p.evaluate(() => (Array.from(document.querySelectorAll('.toast')).slice(-1)[0] || {}).textContent);
        tested++; if (errs.length > before) console.log('ERR', t, bl, '>', items[k], errs.slice(before).join(' | ')); if (toast && /unavailable|failed|Error/i.test(toast)) console.log('TOAST', t, bl, '>', items[k], toast);
        await p.evaluate(() => { document.querySelectorAll('.modal-back').forEach(m => m.remove()); WX.ui.closeMenu(); WX.side.close(); });
      }
    }
  }
  console.log('menu items tested', tested); console.log(errs.join('\n') || 'no errors'); await b.close();
})();
