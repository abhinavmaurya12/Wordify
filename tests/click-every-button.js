const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage(); let errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); }); p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('dialog', d => d.dismiss());
  await p.addInitScript(() => { window.print = () => {}; });
  await p.goto('http://localhost:8123/index.html'); await p.waitForTimeout(1000); await p.evaluate(() => WX.docs.fromTemplate('report')); await p.waitForTimeout(500);
  const tabs = ['home', 'insert', 'layout', 'references', 'review', 'view'];
  for (const t of tabs) {
    await p.click(`.rtab[data-tab=${t}]`); const n = await p.evaluate((t) => document.querySelectorAll(`.rpanel[data-tab=${t}] button.rbtn`).length, t);
    for (let i = 0; i < n; i++) {
      // reselect some text so actions have a target
      await p.evaluate(() => { const h = document.querySelector('#editor p'); const r = document.createRange(); r.selectNodeContents(h); const s = getSelection(); s.removeAllRanges(); s.addRange(r); WX.editor.saveSel && WX.editor.saveSel(); });
      const label = await p.evaluate(([t, i]) => { const b = document.querySelectorAll(`.rpanel[data-tab=${t}] button.rbtn`)[i]; return b.getAttribute('aria-label') || b.textContent; }, [t, i]);
      if (/Full screen|Print|Dark|Delete all comments|Remove table|Delete table/i.test(label)) continue;
      const before = errs.length;
      try { await p.evaluate(([t, i]) => document.querySelectorAll(`.rpanel[data-tab=${t}] button.rbtn`)[i].click(), [t, i]); } catch (e) { errs.push('click fail ' + label); }
      await p.waitForTimeout(150);
      const res = await p.evaluate(() => ({ modal: !!document.querySelector('.modal-back'), menu: !!document.querySelector('.menu,.popover,.cp') , toast: Array.from(document.querySelectorAll('.toast')).map(x => x.textContent).slice(-1)[0] }));
      if (errs.length > before) console.log('ERR in', t, label, errs.slice(before).join(' | '));
      if (res.toast && /unavailable|failed/i.test(res.toast)) console.log('TOAST', t, label, res.toast);
      await p.keyboard.press('Escape'); await p.evaluate(() => { document.querySelectorAll('.modal-back').forEach(m => m.remove()); WX.ui.closeMenu(); WX.side.close(); }); 
    }
    console.log('tab', t, 'buttons', n);
  }
  console.log(errs.join('\n') || 'no errors'); await b.close();
})();
