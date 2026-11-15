# WordX – online word processor

Vanilla HTML5 / CSS3 / ES6 app (no build step, no framework). Open it through any static web server:

```
cd WordX && python3 -m http.server 8123      # then visit http://localhost:8123/
```
(`index.html` also works from `file://` for everything except PDF-text import, which needs the worker script over http.)

## What works (all verified in headless Chromium, see `tests/`)
- **Dashboard**: blank + 10 templates, recent / pinned / shared views, search, grid/list, thumbnails, upload & drag-drop (.docx .pdf .txt .md .html .wordx), rename / duplicate / pin / delete / download, full backup & restore.
- **Editor**: multi-page pagination (A3/A4/A5/Letter/Legal, orientation, margins), headers/footers with page numbers, columns, page/section breaks, watermark, borders, background, ruler with draggable margins & indents, zoom, print/web/read views, tables (merge/split, resize, styles), images (resize, wrap, position), shapes, icons, charts, diagrams, equations, text boxes, TOC, footnotes/endnotes, citations & bibliography, captions, cross-references, index, comments, track changes (accept/reject/compare), document protection, find & replace (regex), spelling (274k-word dictionary + suggestions), grammar, AutoCorrect, word count & readability.
- **Files**: IndexedDB storage, autosave ("Saving… / Saved. / Unsaved changes"), crash recovery, version history, DOCX / PDF / HTML / TXT / .wordx export, DOCX / PDF / HTML / TXT / MD import, print (vector text through the browser).
- **AI panel**: offline rule-based tools by default; optional backend proxy (`server/proxy-example.js`). **No API key is ever in the browser.**
- Dark mode, tooltips, context menus, keyboard shortcuts (Help → `WX.act.shortcutsHelp()`), responsive layout with collapsible ribbon and mobile formatting bar.

## Layout
`js/util.js` helpers & UI kit · `storage.js` IndexedDB · `editor.js` engine · `pagination.js` pages/ruler/zoom · `formatting.js` · `tables.js` · `images.js` · `insert.js` · `references.js` · `review.js` · `search.js` · `spellcheck.js` · `templates.js` · `file-import.js` · `file-export.js` · `document-manager.js` · `ai-assistant.js` · `toolbar.js` · `shortcuts.js` · `app.js`. Everything hangs off `window.WX`; every button calls `WX.act.<name>`.

## Honest limitations
- Pagination is block-level: a single paragraph or table row is not split across pages.
- Footnotes/endnotes are listed at the end of the document, not at each page bottom.
- DOCX made by WordX round-trips exactly (the source is embedded); DOCX from other apps goes through Mammoth, which drops alignment, fonts and floating objects. Comments and watermarks are not written to DOCX; floating images export inline.
- PDF export is image-based (exact look, text not selectable); use **Print → Save as PDF** for vector text.
- PDF import extracts text only. Legacy .doc / .rtf / .odt are not supported.
- "Shared" and collaboration UI store collaborators locally only; real-time sync needs a backend that is not part of this build.
- Track changes records typing and deletion, not formatting changes.

## Tests
`tests/*.js` are Playwright scripts (run with the app served on :8123): file operations & export round trips, feature smoke test, and scripts that click every ribbon button and every menu item watching for errors.
"# Wordify" 
