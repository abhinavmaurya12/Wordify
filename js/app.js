/* WordX – app.js : boot sequence and global error handling. */
(function () {
  'use strict';
  const WX = window.WX;
  function fatal(e) { const b = document.getElementById('boot-error'); console.error(e); if (b) { b.hidden = false; b.textContent = 'WordX could not start: ' + (e && e.message || e); } }
  window.addEventListener('error', (e) => { if (e.message && !/ResizeObserver/.test(e.message)) console.error(e.error || e.message); });
  window.addEventListener('unhandledrejection', (e) => { console.error(e.reason); if (WX.ui && e.reason && e.reason.message && !/AbortError/.test(e.reason.name || '')) WX.ui.toast(e.reason.message, 'error'); });
  async function boot() {
    try {
      WX.ui.initTooltips && WX.ui.initTooltips();
      WX.editor.init(); WX.page.init(); WX.tables.init && WX.tables.init(); WX.images.init && WX.images.init(); WX.refs.init && WX.refs.init(); WX.review.init && WX.review.init(); WX.spell.init && WX.spell.init();
      WX.toolbar.init(); await WX.docs.init(); document.body.classList.add('ready');
    } catch (e) { fatal(e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
