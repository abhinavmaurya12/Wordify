/* WordX – storage.js
 * IndexedDB persistence: documents (full content), meta (lightweight list data),
 * versions (history) and settings. Falls back to an in-memory store if IndexedDB
 * is unavailable (the UI warns when that happens). */
(function () {
  'use strict';
  const WX = window.WX;
  const DB_NAME = 'wordx', DB_VER = 1;
  let db = null, mem = null;

  function open() {
    if (db || mem) return Promise.resolve();
    return new Promise((res) => {
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VER); } catch (e) { return fallback(e, res); }
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('docs')) d.createObjectStore('docs', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('versions')) d.createObjectStore('versions', { keyPath: 'vid' }).createIndex('docId', 'docId');
        if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
      };
      req.onsuccess = () => { db = req.result; db.onversionchange = () => db.close(); res(); };
      req.onerror = () => fallback(req.error, res);
      req.onblocked = () => fallback(new Error('blocked'), res);
    });
  }
  function fallback(err, res) {
    console.warn('IndexedDB unavailable, using memory store', err);
    mem = { docs: {}, meta: {}, versions: {}, settings: {} };
    WX.storage.volatile = true; res();
  }
  const p = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const tx = (stores, mode) => db.transaction(stores, mode);
  const done = (t) => new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('Transaction aborted')); });

  /** Metadata subset stored separately so dashboard listing stays fast. */
  function metaOf(d) {
    return { id: d.id, title: d.title, created: d.created, modified: d.modified, pinned: !!d.pinned, preview: d.preview || '', words: d.words || 0, pages: d.pages || 1,
      shared: d.shared || [], protect: !!(d.settings && d.settings.protect && d.settings.protect.mode), size: (d.content || '').length };
  }

  WX.storage = {
    volatile: false,
    open,
    async putDoc(d) {
      await open();
      if (mem) { mem.docs[d.id] = JSON.parse(JSON.stringify(d)); mem.meta[d.id] = metaOf(d); return; }
      const t = tx(['docs', 'meta'], 'readwrite'); t.objectStore('docs').put(d); t.objectStore('meta').put(metaOf(d)); await done(t);
    },
    async getDoc(id) { await open(); return mem ? mem.docs[id] && JSON.parse(JSON.stringify(mem.docs[id])) : p(tx(['docs']).objectStore('docs').get(id)); },
    async listMeta() { await open(); const l = mem ? Object.values(mem.meta) : await p(tx(['meta']).objectStore('meta').getAll()); return l.sort((a, b) => b.modified - a.modified); },
    async deleteDoc(id) {
      await open();
      if (mem) { delete mem.docs[id]; delete mem.meta[id]; return; }
      const vs = await WX.storage.listVersions(id);
      const t = tx(['docs', 'meta', 'versions'], 'readwrite'); t.objectStore('docs').delete(id); t.objectStore('meta').delete(id); vs.forEach((v) => t.objectStore('versions').delete(v.vid)); await done(t);
    },
    async addVersion(docId, content, label) {
      await open(); const v = { vid: WX.util.uid('v'), docId, ts: Date.now(), content, label: label || '' };
      if (mem) { (mem.versions[docId] = mem.versions[docId] || []).push(v); return v; }
      const vs = await WX.storage.listVersions(docId);
      const t = tx(['versions'], 'readwrite'); const s = t.objectStore('versions'); s.put(v);
      vs.sort((a, b) => b.ts - a.ts).slice(19).forEach((o) => s.delete(o.vid)); await done(t); return v; // keep 20
    },
    async listVersions(docId) {
      await open(); if (mem) return (mem.versions[docId] || []).slice().reverse();
      const l = await p(tx(['versions']).objectStore('versions').index('docId').getAll(docId)); return l.sort((a, b) => b.ts - a.ts);
    },
    async getSetting(key, def) { await open(); const r = mem ? mem.settings[key] && { value: mem.settings[key] } : await p(tx(['settings']).objectStore('settings').get(key)); return r ? r.value : def; },
    async setSetting(key, value) { await open(); if (mem) { mem.settings[key] = value; return; } const t = tx(['settings'], 'readwrite'); t.objectStore('settings').put({ key, value }); await done(t); },

    /** Full backup of every document (JSON). */
    async exportAll() {
      const metas = await WX.storage.listMeta(); const docs = [];
      for (const m of metas) docs.push(await WX.storage.getDoc(m.id));
      return { format: 'wordx-backup', version: 1, exported: Date.now(), docs, dictionary: await WX.storage.getSetting('userDict', []) };
    },
    async importAll(obj) {
      if (!obj || obj.format !== 'wordx-backup' || !Array.isArray(obj.docs)) throw new Error('Not a WordX backup file.');
      let n = 0;
      for (const d of obj.docs) {
        if (!d || !d.id) continue;
        const exists = await WX.storage.getDoc(d.id);
        if (exists) d.id = WX.util.uid('doc'); // never overwrite – import as a copy
        d.content = WX.util.sanitize(d.content || ''); d.modified = Date.now();
        await WX.storage.putDoc(d); n++;
      }
      return n;
    },
  };
})();
