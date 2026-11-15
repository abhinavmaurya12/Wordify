# Wordify – Your Smart Document Workspace ✍️

<p align="center">
  <img src="assets/images/icon-512.png" alt="Wordify Logo" width="120">
</p>

<h3 align="center">Create. Edit. Format. Inspire.</h3>

<p align="center">
  A modern, browser-based word processor designed to make document creation simple, powerful, and accessible.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/HTML5-orange?style=for-the-badge&logo=html5&logoColor=white">
  <img src="https://img.shields.io/badge/CSS3-blue?style=for-the-badge&logo=css3&logoColor=white">
  <img src="https://img.shields.io/badge/JavaScript-ES6-yellow?style=for-the-badge&logo=javascript&logoColor=black">
  <img src="https://img.shields.io/badge/Platform-Web-green?style=for-the-badge">
</p>

---

## 🚀 About Wordify

**Wordify** is a feature-rich online word processor inspired by modern document editing applications.

It provides a powerful workspace where users can create, edit, format, organize, and export documents directly from their web browsers.

Built using HTML, CSS, and Vanilla JavaScript, Wordify requires no frontend build tools or frameworks.

Whether you're writing notes, preparing assignments, creating reports, or managing documents, Wordify provides the tools you need in one place.

## ✨ Key Features

### 📄 Document Management
- Create blank documents.
- Choose from 10 built-in templates.
- Upload and drag-and-drop documents.
- Rename, duplicate, pin, and delete documents.
- Recent, pinned, and shared document views.
- Grid and list layouts.
- Document search and thumbnails.
- Full backup and restore.

### 📝 Advanced Document Editor
- Multi-page document editing.
- A3, A4, A5, Letter, and Legal page sizes.
- Portrait and landscape orientation.
- Custom margins and page borders.
- Headers and footers with page numbers.
- Multiple columns and page breaks.
- Watermarks and background customization.
- Ruler with adjustable margins and indents.
- Zoom, print, web, and read views.

### 🎨 Formatting & Insertion
- Tables with resizing, merging, and splitting.
- Image insertion, resizing, and text wrapping.
- Shapes, icons, charts, and diagrams.
- Mathematical equations.
- Text boxes.
- Table of contents.
- Footnotes and endnotes.
- Captions and cross-references.

### 🔍 Writing & Review Tools
- Find and replace with regular expressions.
- Spell checking with suggestions.
- Grammar assistance.
- AutoCorrect.
- Word count and readability analysis.
- Citations and bibliography.
- Document comments.
- Track changes with accept and reject options.
- Document protection.

### 💾 File Management & Export
- Automatic document saving.
- IndexedDB-based local storage.
- Crash recovery.
- Document version history.
- DOCX import and export.
- PDF import and export.
- HTML, TXT, and Markdown import.
- HTML and TXT export.
- Wordify `.wordx` format.
- Browser printing.

### 🤖 AI Writing Assistant
- Built-in offline rule-based writing tools.
- Optional AI backend integration.
- Secure backend proxy architecture.
- API keys are never exposed in the browser.

### 🌙 User Experience
- Modern and responsive interface.
- Dark mode.
- Collapsible ribbon.
- Mobile formatting toolbar.
- Keyboard shortcuts.
- Tooltips and context menus.

## 🛠️ Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Application structure |
| CSS3 | Styling and responsive design |
| JavaScript ES6 | Editor functionality |
| IndexedDB | Local document storage |
| Playwright | Automated testing |
| Mammoth.js | DOCX text import |
| Chart.js | Charts and visualizations |

## 📂 Project Structure

```text
Wordify/
│
├── assets/
│   └── images/
│
├── css/
│
├── js/
│   ├── util.js
│   ├── storage.js
│   ├── editor.js
│   ├── pagination.js
│   ├── formatting.js
│   ├── tables.js
│   ├── images.js
│   ├── insert.js
│   ├── references.js
│   ├── review.js
│   ├── search.js
│   ├── spellcheck.js
│   ├── templates.js
│   ├── file-import.js
│   ├── file-export.js
│   ├── document-manager.js
│   ├── ai-assistant.js
│   ├── toolbar.js
│   ├── shortcuts.js
│   └── app.js
│
├── server/
├── tests/
├── tools/
│
├── index.html
├── manifest.json
├── sw.js
└── README.md
```

## ⚙️ Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/abhinavmaurya12/Wordify.git
```

### 2. Navigate to the project

```bash
cd Wordify
```

### 3. Start a local development server

Using Python:

```bash
python -m http.server 8123
```

### 4. Open in your browser

```text
http://localhost:8123
```

You can also open `index.html` directly in a browser for most features. PDF text import requires an HTTP server.

## 🌐 Deployment

Wordify can be deployed using static website hosting platforms such as:

- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages

No frontend build process is required.

## ⚠️ Current Limitations

- Pagination is block-level; individual paragraphs and table rows are not split across pages.
- Footnotes and endnotes appear at the end of the document.
- External DOCX files may lose some formatting during import.
- PDF export is image-based; browser printing can produce selectable vector text.
- PDF import extracts text only.
- Legacy DOC, RTF, and ODT formats are not supported.
- Collaboration interfaces currently store collaborator information locally; real-time synchronization requires an additional backend.
- Track changes records text insertion and deletion, not formatting changes.

## 🧪 Testing

The project includes Playwright-based automated tests.

Tests cover:
- File operations and export round trips.
- Feature smoke testing.
- Ribbon button interactions.
- Menu functionality.
- JavaScript error detection.

## 🎯 Project Goals

Wordify aims to provide an accessible and feature-rich document editing experience without requiring users to install desktop software.

Future improvements can include:
- Cloud-based document storage.
- Real-time collaboration.
- User authentication.
- Advanced AI writing features.
- Additional document formats.
- Cross-device synchronization.

## 👨‍💻 Developer

**Abhinav Maurya**

Java Full Stack Developer | Web Developer

- GitHub: [@abhinavmaurya12](https://github.com/abhinavmaurya12)
- Project: [Wordify](https://github.com/abhinavmaurya12/Wordify)

## ⭐ Support

If you find Wordify useful, consider giving this repository a ⭐ on GitHub.

Feel free to fork the project, explore the source code, and contribute improvements.

---

<p align="center">
  **Wordify – Turn Your Ideas Into Documents.**
</p>
