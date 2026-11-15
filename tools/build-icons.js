// Generates js/icons.js from lucide-static SVGs (run: node tools/build-icons.js <path-to-lucide-static/icons>)
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
const names = `bold italic underline strikethrough superscript subscript baseline highlighter case-sensitive eraser align-left align-center align-right align-justify list list-ordered list-tree indent-increase indent-decrease text-cursor paintbrush paint-roller table image shapes smile link bookmark hash panel-top panel-bottom calendar-clock square-dashed omega sigma minus chart-column network workflow file-text ruler columns-2 undo-2 redo-2 save printer search replace message-square git-compare check x book-open moon sun maximize zoom-in zoom-out grid-3x3 sparkles lock folder-open house star pin trash-2 copy pencil share-2 download upload menu chevron-down chevron-up plus spell-check pilcrow heading quote file-plus files clipboard-paste scissors rows-3 type text list-checks scroll-text book-marked library-big tags captions link-2 refresh-cw expand eye layout ellipsis history settings square tag arrow-up-down combine split table-cells-merge table-cells-split grid-2x2 rows-2 columns-3 trash box square-plus file-image file-code file-type circle-check circle-x info wand-sparkles languages bot send cloud users shield unlock arrow-left arrow-right arrow-up arrow-down panel-left panel-right glasses crop image-plus layers message-square-plus rotate-ccw wrap-text remove-formatting heading-1 heading-2 fullscreen move scan-text file-down file-up folder-down text-quote bring-to-front send-to-back copy-plus sheet book-open-text sliders-horizontal circle triangle hexagon minus-circle arrow-right-left clock calendar file-spreadsheet rectangle-horizontal ellipsis-vertical heart zap sun-moon database mail phone globe map-pin lightbulb flag bell user camera music cog trending-up chart-pie chart-line chart-bar`.split(/\s+/);
let out = {}, miss = [];
for (const n of names) {
  const f = path.join(dir, n + '.svg');
  if (!fs.existsSync(f)) { miss.push(n); continue; }
  const s = fs.readFileSync(f, 'utf8');
  const inner = s.replace(/^[\s\S]*?viewBox="0 0 24 24"[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/\s+/g, ' ').trim();
  out[n] = inner;
}
fs.writeFileSync(path.join(__dirname, '../js/icons.js'),
 '/* Auto-generated from lucide-static (ISC license). */\nwindow.WX_ICONS=' + JSON.stringify(out) + ';\n');
console.log('icons:', Object.keys(out).length, 'missing:', miss.join(','));
