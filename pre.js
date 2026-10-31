// Browser fallback shim for window.native and safe localStorage when running outside Electron or in restricted frames
(function () {
  if (typeof window === 'undefined') return;

  // Ensure window.localStorage never throws a SecurityError / DOMException in restricted contexts
  try {
    const testKey = '__rp_ls_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
  } catch (e) {
    const memStore = Object.create(null);
    const safeStorage = {
      getItem: k => (Object.prototype.hasOwnProperty.call(memStore, k) ? memStore[k] : null),
      setItem: (k, v) => { memStore[String(k)] = String(v); },
      removeItem: k => { delete memStore[String(k)]; },
      clear: () => { for (const k of Object.keys(memStore)) delete memStore[k]; },
      key: i => Object.keys(memStore)[i] || null,
      get length() { return Object.keys(memStore).length; }
    };
    try {
      Object.defineProperty(window, 'localStorage', { value: safeStorage, configurable: true, writable: true });
    } catch (err) {}
  }

  const triggerDownload = (bytes, filename) => {
    const b = new Blob([bytes]);
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'output.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const virtualFiles = new Map();
  const rememberVirtualFile = (key, rec) => {
    if (!key) return;
    if (virtualFiles.has(key)) virtualFiles.delete(key);
    virtualFiles.set(key, rec);
    while (virtualFiles.size > 32) {
      const oldestKey = virtualFiles.keys().next().value;
      virtualFiles.delete(oldestKey);
    }
  };
  if (!window.native) {
    window.native = {
      openFiles: o => new Promise(resolve => {
        const inp = document.createElement('input');
        inp.type = 'file';
        if (o && o.multi) inp.multiple = true;
        if (o && o.filters && o.filters[0] && o.filters[0].extensions) {
          inp.accept = o.filters.flatMap(f => f.extensions.map(e => '.' + e)).join(',');
        }
        let settled = false;
        const finish = val => {
          if (settled) return;
          settled = true;
          resolve(val);
        };
        inp.onchange = async () => {
          const files = Array.from(inp.files || []);
          const out = await Promise.all(files.map(async f => {
            const bytes = new Uint8Array(await f.arrayBuffer());
            const pth = f.webkitRelativePath || f.name;
            const rec = { name: f.name, path: pth, bytes, at: f.lastModified || Date.now() };
            rememberVirtualFile(pth, rec);
            rememberVirtualFile(f.name, rec);
            return rec;
          }));
          finish(out);
        };
        inp.addEventListener('cancel', () => finish([]));
        inp.click();
      }),
      readFile: async p => virtualFiles.get(p) || null,
      writeFile: async ({ path, bytes }) => {
        triggerDownload(bytes, path || 'output.pdf');
        return path;
      },
      saveFile: async ({ name, bytes }) => {
        triggerDownload(bytes, name || 'output.pdf');
        return name;
      },
      saveMany: async ({ files }) => {
        for (const f of (files || [])) {
          triggerDownload(f.bytes, f.name);
        }
        return 'Downloads';
      },
      quit: () => window.close(),
      reveal: () => {},
      recWrite: async () => 0,
      recList: async () => [],
      recClear: async () => {},
      pickFolder: () => new Promise(resolve => {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.multiple = true;
        inp.accept = '.pdf';
        let settled = false;
        const finish = val => { if (settled) return; settled = true; resolve(val); };
        inp.onchange = async () => {
          const files = Array.from(inp.files || []).filter(f => /\.pdf$/i.test(f.name));
          if (!files.length) return finish(null);
          const paths = [];
          for (const f of files) {
            const bytes = new Uint8Array(await f.arrayBuffer());
            const pth = f.webkitRelativePath || f.name;
            const rec = { name: f.name, path: pth, bytes, at: f.lastModified || Date.now() };
            rememberVirtualFile(pth, rec);
            rememberVirtualFile(f.name, rec);
            paths.push(pth);
          }
          finish({ dir: 'Selected_Drawings', path: 'Selected_Drawings', files: paths });
        };
        inp.addEventListener('cancel', () => finish(null));
        inp.click();
      }),
      mtime: async () => 0,
      setProgress: async () => true,
      setBusyLock: async () => false,
      getPathForFile: f => (f && (f.path || f.webkitRelativePath || f.name)) || '',
      openUrl: async u => {
        if (typeof u === 'string' && /^https?:\/\//i.test(u)) {
          window.open(u, '_blank', 'noopener,noreferrer');
          return true;
        }
        return false;
      }
    };
  }

  window.openExternalUrl = u => {
    const target = /^https?:\/\//i.test(String(u || '')) ? u : 'https://redline.textportdocx.in';
    if (window.native && typeof window.native.openUrl === 'function') {
      return window.native.openUrl(target);
    }
    window.open(target, '_blank', 'noopener,noreferrer');
    return Promise.resolve(true);
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('click', e => {
      const a = e.target && e.target.closest ? e.target.closest('a[href^="http://"], a[href^="https://"]') : null;
      if (a && a.href) {
        e.preventDefault();
        window.openExternalUrl(a.href);
      }
    });
  }

  // ---- MODULE 1: Renderer Process Global Crash & Unhandled Rejection Boundaries ----
  window.__rpDiagnosticBuffer = window.__rpDiagnosticBuffer || [];
  function isBenignWorkerOrRenderAbort(errOrMsg) {
    const s = String((errOrMsg && (errOrMsg.name || errOrMsg.message || errOrMsg)) || '');
    return /RenderingCancelledException|Worker was destroyed|Worker terminated|AbortException|PageClosedException|ResizeObserver loop/i.test(s);
  }
  window.isBenignWorkerOrRenderAbort = isBenignWorkerOrRenderAbort;

  window.showToast = function (msg, duration = 4000) {
    if (typeof window.rpToast === 'function') return window.rpToast(msg, duration);
    if (typeof document === 'undefined' || !document.body) return;
    let t = document.querySelector('#rp-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'rp-toast';
      t.className = 'rp-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.hidden = false;
    t.classList.add('show');
    clearTimeout(t._fallbackTimer);
    t._fallbackTimer = setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => { t.hidden = true; }, 220);
    }, duration);
  };

  window.showEncryptedPdfNotice = function (fileName = '') {
    const noticeMsg = 'This document is password-protected or encrypted. Please decrypt or unlock the file before comparing or markup.';
    window.showToast(noticeMsg, 4500);
    if (typeof document !== 'undefined' && document.body) {
      let m = document.querySelector('#rp-encrypted-pdf-modal');
      if (!m) {
        m = document.createElement('div');
        m.id = 'rp-encrypted-pdf-modal';
        m.className = 'rp-modal';
        document.body.appendChild(m);
      }
      const safeTitle = String(fileName || 'Encrypted PDF').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      m.innerHTML = `<div class="rp-card"><h3>Protected Document (${safeTitle})</h3><p style="margin:8px 0;line-height:1.5">${noticeMsg}</p><div class="rp-btns"><button type="button" class="rp-primary" id="rp-enc-ok">OK</button></div></div>`;
      m.hidden = false;
      const btn = m.querySelector('#rp-enc-ok');
      if (btn) btn.onclick = () => { m.hidden = true; };
      m.onclick = ev => { if (ev.target === m) m.hidden = true; };
    }
    return noticeMsg;
  };

  window.onerror = function (msg, url, line, col, error) {
    if (isBenignWorkerOrRenderAbort(error || msg)) return true;
    window.__rpDiagnosticBuffer.push({
      ts: new Date().toISOString(),
      type: 'onerror',
      msg: String(msg),
      url: String(url || ''),
      line: line || 0,
      col: col || 0,
      stack: error && error.stack ? String(error.stack) : ''
    });
    if (window.__rpDiagnosticBuffer.length > 100) window.__rpDiagnosticBuffer.shift();
    try {
      const busyEl = typeof document !== 'undefined' && document.querySelector('#busy');
      if (busyEl && !busyEl.hidden && typeof window.busy === 'function') window.busy(false);
      if (typeof window.rpProgress === 'function') window.rpProgress(null);
    } catch (e) {}
    window.showToast('⚠️ A background task encountered an issue and was safely contained.', 4000);
    return true;
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event ? event.reason : null;
    if (isBenignWorkerOrRenderAbort(reason)) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      return;
    }
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    window.__rpDiagnosticBuffer.push({
      ts: new Date().toISOString(),
      type: 'unhandledrejection',
      msg: String((reason && (reason.message || reason)) || 'Unhandled rejection'),
      stack: reason && reason.stack ? String(reason.stack) : ''
    });
    if (window.__rpDiagnosticBuffer.length > 100) window.__rpDiagnosticBuffer.shift();
    try {
      const busyEl = typeof document !== 'undefined' && document.querySelector('#busy');
      if (busyEl && !busyEl.hidden && typeof window.busy === 'function') window.busy(false);
      if (typeof window.rpProgress === 'function') window.rpProgress(null);
    } catch (e) {}
    window.showToast('⚠️ A background task encountered an issue and was safely contained.', 4000);
  });
})();

// ===== v1.6: password-protected PDFs =====
// Wraps pdf.js so any password-protected file asks for its password once.
// The password is remembered for this session, so re-renders after edits do not ask again.
(() => {
  if (typeof pdfjsLib === 'undefined' || !pdfjsLib.getDocument) return;
  try {
    const desc = Object.getOwnPropertyDescriptor(pdfjsLib, 'getDocument');
    if (desc && !desc.writable && !desc.set) {
      const mutable = Object.create(pdfjsLib);
      for (const k of Object.keys(pdfjsLib)) {
        try { Object.defineProperty(mutable, k, { value: pdfjsLib[k], writable: true, enumerable: true, configurable: true }); } catch (e) {}
      }
      window.pdfjsLib = mutable;
    }
  } catch (e) {}
  const orig = window.pdfjsLib.getDocument.bind(window.pdfjsLib);
  const known = new Map();
  const keyOf = d => {
    try {
      const u = d instanceof Uint8Array ? d : new Uint8Array(d);
      let h = 2166136261; const n = u.length, step = Math.max(1, Math.floor(n / 4096));
      for (let i = 0; i < n; i += step) { h ^= u[i]; h = Math.imul(h, 16777619); }
      return n + ':' + (h >>> 0);
    } catch (e) { return null; }
  };
  pdfjsLib.getDocument = src => {
    if (src && typeof src === 'object' && !(src instanceof Uint8Array) && !(src instanceof ArrayBuffer)) {
      if (src.verbosity == null) src.verbosity = 0;
      if (src.isOffscreenCanvasSupported == null) src.isOffscreenCanvasSupported = false;
    }
    const key = src && src.data ? keyOf(src.data) : null;
    const task = orig(src);
    task.onPassword = async (update, reason) => {
      if (key && known.has(key) && reason === 1) return update(known.get(key));
      const r = window.dialog ? await window.dialog(reason === 2 ? 'Wrong password - try again' : 'This PDF is password-protected', [
        { type: 'password', id: 'p', label: 'Password' },
        { type: 'note', label: 'The password is kept only while Redline is open.' }], 'Unlock') : null;
      if (!r) { task.destroy(); return; }
      if (key) {
        if (known.size >= 16 && !known.has(key)) known.delete(known.keys().next().value);
        known.set(key, r.p);
      }
      window.__unlocked = true;
      update(r.p);
    };
    return task;
  };
})();
