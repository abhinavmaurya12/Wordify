// Adds extra lucide icons (and aliases for renamed ones) to js/icons.js: node tools/add-icons.js <lucide-static/icons>
const fs = require('fs'), path = require('path'); const dir = process.argv[2]; const file = path.join(__dirname, '../js/icons.js');
global.window = {}; eval(fs.readFileSync(file, 'utf8')); const out = window.WX_ICONS;
const alias = { outdent: 'indent-decrease', indent: 'indent-increase', home: 'house', 'more-vertical': 'ellipsis-vertical' };
const extra = 'plug cpu between-vertical-start a-arrow-up a-arrow-down chevrons-up-down paint-bucket mouse-pointer-2 layout-template corner-down-right text-select rotate-3d file scissors-line-dashed droplets palette frame arrow-up-from-line arrow-down-from-line table-of-contents notebook-text library check-check gauge messages-square message-square-x git-pull-request-draft chevron-left chevron-right move-horizontal layout-grid maximize-2 swatch-book table-properties between-horizontal-start between-horizontal-end between-vertical-end merge align-vertical-justify-start align-vertical-justify-center align-vertical-justify-end settings-2 a-large-small'.split(' ');
const rd = (n) => { const f = path.join(dir, n + '.svg'); if (!fs.existsSync(f)) return null; return fs.readFileSync(f, 'utf8').replace(/^[\s\S]*?viewBox="0 0 24 24"[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/\s+/g, ' ').trim(); };
extra.forEach((n) => { const s = rd(n); if (s) out[n] = s; else console.log('missing', n); });
Object.entries(alias).forEach(([a, n]) => { const s = rd(n); if (s) out[a] = s; else console.log('missing', n); });
fs.writeFileSync(file, '/* Auto-generated from lucide-static (ISC license). */\nwindow.WX_ICONS=' + JSON.stringify(out) + ';\n'); console.log('icons:', Object.keys(out).length);
