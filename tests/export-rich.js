const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1300, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8123/index.html'); await p.waitForTimeout(1000); await p.click('#home-new'); await p.waitForTimeout(400); await p.click('#editor');
  await p.evaluate(async () => {
    const E = WX.editor; E.insertHTML('<h1>Rich Test</h1><p>Intro with <b>bold</b>, <i>italic</i>, <u>under</u>, <span style="color:#c00000">red</span> and <span style="background-color:#ffff00">highlight</span>.</p><ol><li>First<ol><li>Nested a</li><li>Nested b</li></ol></li><li>Second</li></ol><ul><li>Bullet</li></ul>');
    WX.tables.insert(2, 3); WX.act.tableStyle('wx-t-header');
    const blob = await (await fetch('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC')).blob(); await WX.images.insertFile(new File([blob], 'a.png', { type: 'image/png' }));
    WX.insert.insertShape('rect'); WX.act.insertTOC();
    const s = E.doc.settings; s.hf.header = '<p style="text-align:center">Header {TITLE}</p>'; s.hf.footer = '<p style="text-align:right">Page {PAGE} of {PAGES}</p>'; WX.page.apply(); E.changed({ immediate: true });
  });
  await p.waitForTimeout(500);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => WX.act.exportDocx())]); await dl.saveAs('rich.docx');
  const [d2] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.evaluate(() => WX.act.exportPdf())]); await d2.saveAs('rich.pdf');
  await p.screenshot({ path: 'rich.png' }); console.log(errs.join('\n') || 'no errors'); await b.close();
})();
