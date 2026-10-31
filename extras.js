// ===== Redline 2.0 additions =====
// Right-click menus, editor tabs, auto-save + crash recovery, file-changed warning,
// editable copy of password PDFs, text differences and batch folder compare.
(() => {
const $ = s => document.querySelector(s);
const E = RE.E, S = window.CMP;
const ED = () => document.body.dataset.view === 'edit';
const est = t => $('#est').textContent = t, cst = t => $('#st').textContent = t;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const op = id => () => ACT.op(id);
const enc = s => new TextEncoder().encode(s);

// ---------------------------------------------------------------- tabs
const T = { list: [], cur: -1, sig: '' };
const SKIP_SNAP_KEYS = new Set(['doc', '_renderTask', '_renderPromise', '_rendering', '_renderQueued', 'vp', 'titems', 'hov', 'inlineText']);
const snap = () => { const o = {}; for (const k in E) if (!SKIP_SNAP_KEYS.has(k)) o[k] = E[k]; o.pages = new Set(E.pages || []); return o; };
const dirtyOf = t => !!t.bytes && (
  t.bytes !== t.savedBytes ||
  Object.values(t.ann || {}).some(l => l && l.length) ||
  Object.values(t.meas || {}).some(l => l && l.length)
);
T.beforeOpen = () => {
  T._prevSnap = E.bytes ? snap() : null;
  if (E.bytes && T.cur >= 0) T.list[T.cur] = T._prevSnap;
  if (T.list.length && T.list[T.list.length - 1].name === '...') {
    T.cur = T.list.length - 1;
  } else {
    T.list.push({ name: '...' }); T.cur = T.list.length - 1;
  }
  setTimeout(T.render, 50);
};
T.rollbackOpen = () => {
  if (T.list.length && T.list[T.list.length - 1].name === '...') {
    T.list.pop();
    T.cur = T.list.length - 1;
    if (T._prevSnap) Object.assign(E, T._prevSnap);
    T.render();
  }
};
T.switchTo = async i => {
  if (i === T.cur || !T.list[i]) return;
  if (T.cur >= 0 && T.list[T.cur]) T.list[T.cur] = snap();
  Object.assign(E, T.list[i]); T.cur = i;
  window.busy(true);
  try { await RE.reload(false); window.editorShown && window.editorShown(); window.updateTitle && window.updateTitle(); }
  catch (e) { est('Could not show that tab: ' + e.message); }
  finally { window.busy(false); T.render(); }
};
T.close = async i => {
  const t = i === T.cur ? snap() : T.list[i]; if (!t) return;
  if (dirtyOf(t)) {
    const ok = await RE.dialog('Unsaved changes', [{ type: 'note', label: (t.name || 'This file') + ' has unsaved changes. Close it anyway?' }], 'Close without saving');
    if (!ok) return;
  }
  T.list.splice(i, 1);
  if (i === T.cur) {
    T.cur = -1;
    if (T.list.length) { await T.switchTo(Math.min(i, T.list.length - 1)); return; }
    if (E._renderTask && typeof E._renderTask.cancel === 'function') {
      try { E._renderTask.cancel(); } catch (e) {}
      E._renderTask = null;
    }
    try { if (E.doc && typeof E.doc.destroy === 'function') await E.doc.destroy(); } catch (e) {}
    if ($('#ecv')) { $('#ecv').width = 0; $('#ecv').height = 0; }
    if ($('#eov')) { $('#eov').width = 0; $('#eov').height = 0; }
    if (window.rpTileManager && typeof window.rpTileManager.clear === 'function') window.rpTileManager.clear();
    Object.assign(E, {
      bytes: null, doc: null, n: 0, cur: 0,
      ann: {}, meas: {}, annUndo: [], annRedo: [],
      sel: null, selC: null, pages: new Set(),
      stack: [], hist: [], redo: [], comments: [],
      name: 'document.pdf', path: null, savedBytes: null
    });
    if ($('#thumbs')) $('#thumbs').querySelectorAll('canvas').forEach(cv => { cv.width = 0; cv.height = 0; });
    $('#ewrap').hidden = true; $('#eempty').hidden = false; $('#thumbs').innerHTML = ''; $('#eN').textContent = '0'; $('#esz').textContent = '';
    if ($('#e-floating-hud')) $('#e-floating-hud').hidden = true;
    RE.renderComments();
    if (RE.updateDocInspector) RE.updateDocInspector();
    window.updateTitle && window.updateTitle();
  } else if (i < T.cur) T.cur--;
  T.render();
};
T.closeCur = () => T.cur >= 0 && T.close(T.cur);
T.step = d => T.list.length > 1 && T.switchTo((T.cur + d + T.list.length) % T.list.length);
T.render = () => {
  if (T.cur >= 0 && T.list[T.cur]) T.list[T.cur] = { ...T.list[T.cur], name: E.name, _d: dirtyOf(E) };
  const sig = T.cur + '|' + T.list.map((t, i) => (i === T.cur ? t.name + t._d : t.name + dirtyOf(t))).join('|');
  if (sig === T.sig) return; T.sig = sig;
  const bar = $('#etabs'); bar.hidden = T.list.length < 2; bar.innerHTML = '';
  T.list.forEach((t, i) => {
    const d = document.createElement('div'); d.className = 'tab' + (i === T.cur ? ' on' : '');
    const dirty = i === T.cur ? dirtyOf(E) : dirtyOf(t);
    d.innerHTML = `<span title="${esc(t.path || t.name)}">${esc(t.name)}${dirty ? ' \u2022' : ''}</span><b title="Close (Ctrl+W)">\u00d7</b>`;
    d.onclick = e => { if (e.target.tagName === 'B') T.close(i); else T.switchTo(i); };
    d.onauxclick = e => { if (e.button === 1) T.close(i); };
    d.oncontextmenu = e => { e.preventDefault(); window.showCtx(e.clientX, e.clientY, [
      { l: 'Close tab', a: () => T.close(i) },
      { l: 'Close other tabs', a: async () => { await T.switchTo(i); for (let k = T.list.length - 1; k >= 0; k--) if (k !== T.cur) await T.close(k); }, dis: T.list.length < 2 },
      '-', { l: 'Show in folder', a: () => t.path && window.native.reveal(t.path), dis: !t.path }]); };
    bar.append(d);
  });
};
setInterval(T.render, 900);
window.TABS = T;
const curDirty = window.isDirty;
window.isDirty = () => curDirty() || T.list.some((t, i) => i !== T.cur && dirtyOf(t));
addEventListener('keydown', e => {
  if (!ED() || !e.ctrlKey) return;
  if (e.key === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); T.step(e.shiftKey ? -1 : 1); }
  else if (e.key.toLowerCase() === 'w') { e.preventDefault(); e.stopImmediatePropagation(); T.closeCur(); }
}, true);

// ---------------------------------------------------------------- right-click menus (Editor)
const K = () => E.zoom * 4 / 3;
$('#eview').addEventListener('contextmenu', e => {
  if (!E.doc || e.target.closest('input,textarea,select')) return;
  e.preventDefault();
  const ov = $('#eov'), b = ov && ov.getBoundingClientRect();
  const inPage = b && e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom;
  const items = [];
  if (inPage) {
    const x = (e.clientX - b.left) / K(), y = (e.clientY - b.top) / K();
    const a = RE.hit(x, y);
    if (a) {
      E.sel = a; RE.overlay();
      items.push(
        { h: 'Selected Annotation (' + a.t.toUpperCase() + ')' },
        ...(['text', 'leader', 'cloud', 'stamp', 'pin'].includes(a.t) ? [{ l: 'Edit text / formatting...', ic: 'edittext', a: () => $('#eov').dispatchEvent(new MouseEvent('dblclick', { clientX: e.clientX, clientY: e.clientY })) }] : []),
        { l: 'Duplicate item', ic: 'copy', k: 'Ctrl+D', a: () => RE.duplicateSelectedAnn && RE.duplicateSelectedAnn() },
        { l: 'Bring to front', ic: 'layers', a: () => RE.bringSelToFront && RE.bringSelToFront() },
        { l: 'Send to back', ic: 'flatten', a: () => RE.sendSelToBack && RE.sendSelToBack() },
        { l: 'Delete item', ic: 'trash', k: 'Del', a: () => ACT.eDeleteAnn() },
        '-'
      );
    }
    if (RE.selInfo()) items.push({ h: 'Selected text' },
      { l: 'Copy text', ic: 'copy', k: 'Ctrl+C', a: () => RE.copySel() },
      { l: 'Highlight', a: () => $('#sbHl').click() }, { l: 'Underline', a: () => $('#sbUl').click() },
      { l: 'Strikeout', a: () => $('#sbSt').click() }, { l: 'Edit this text', ic: 'edittext', a: () => $('#sbEd').click() }, '-');
    items.push({ h: 'Add Markup or Note' },
      { l: 'Note (PDF Comment)', ic: 'note', k: 'N', a: () => ACT.tool('cnote') },
      { l: 'Text Box', ic: 'text', k: 'T', a: () => ACT.tool('text') },
      { l: 'Revision Cloud (Δ Rev)', ic: 'revCloud', a: () => { RE.addAnn({ t: 'cloud', x, y, w: 120, h: 60, revText: 'Δ Rev 2', color: $('#eColor').value || '#e11d48', size: 2 }); } },
      { l: 'Leader Callout Arrow', ic: 'leader', a: () => { RE.addAnn({ t: 'leader', x1: x, y1: y, x2: x + 70, y2: y - 40, text: 'Callout', color: $('#eColor').value || '#e11d48', size: 2 }); } },
      { l: 'Box / Rectangle', ic: 'box', k: 'B', a: () => ACT.tool('rect') },
      { l: 'Circle / Ellipse', ic: 'circle', a: () => ACT.tool('circle') },
      { l: 'Polygon / Polyline', ic: 'polygon', a: () => ACT.tool('poly') },
      { l: 'Arrow', ic: 'arrow', k: 'A', a: () => ACT.tool('arrow') },
      { l: 'Checkmark Tick (✓)', ic: 'checkMark', a: () => { RE.addAnn({ t: 'checkmk', x: x - 11, y: y - 11, w: 22, h: 22, color: '#059669', size: 3 }); } },
      { l: 'Cross Mark (✗)', ic: 'crossMark', a: () => { RE.addAnn({ t: 'crossmk', x: x - 11, y: y - 11, w: 22, h: 22, color: '#e11d48', size: 3 }); } },
      { l: 'Pen', ic: 'pen', k: 'P', a: () => ACT.tool('draw') },
      { l: 'Pin Marker Badge', ic: 'pin', a: () => ACT.tool('pin') },
      { l: 'Eraser', ic: 'eraser', k: 'Z', a: () => ACT.tool('eraser') },
      { l: 'Redact Box', ic: 'redact', a: () => ACT.tool('redact') },
      '-',
      { h: 'Engineering Stamps' },
      { l: 'Stamp: APPROVED', ic: 'stampApp', a: () => { RE.addAnn({ t: 'stamp', x, y, w: 150, h: 36, fs: 18, text: 'APPROVED', color: '#0b8a3d' }); } },
      { l: 'Stamp: REJECTED', ic: 'stampRej', a: () => { RE.addAnn({ t: 'stamp', x, y, w: 150, h: 36, fs: 18, text: 'REJECTED', color: '#d62d2d' }); } },
      { l: 'Stamp: REVISED', ic: 'stampRev', a: () => { RE.addAnn({ t: 'stamp', x, y, w: 180, h: 36, fs: 15, text: 'REVISED & RESUBMIT', color: '#b57a00' }); } },
      { l: 'Stamp: FOR REVIEW', ic: 'stampSha', a: () => { RE.addAnn({ t: 'stamp', x, y, w: 165, h: 36, fs: 15, text: 'FOR REVIEW ONLY', color: '#1a3cff' }); } },
      '-');
  }
  items.push(
    { l: 'Undo', k: 'Ctrl+Z', a: ACT.eUndo }, { l: 'Redo', k: 'Ctrl+Y', a: ACT.eRedo }, '-',
    { h: 'This page' },
    { l: 'Rotate right', ic: 'rotR', a: op('rotR') }, { l: 'Rotate left', ic: 'rotL', a: op('rotL') },
    { l: 'Duplicate page', ic: 'copy', a: op('dup') }, { l: 'Insert blank page after', ic: 'blank', a: op('blank') },
    { l: 'Extract page to new file...', ic: 'extract', a: op('extract') }, { l: 'Delete page', ic: 'trash', a: op('del') }, '-',
    { l: 'Zoom in', a: ACT.eZoomIn }, { l: 'Zoom out', a: ACT.eZoomOut }, { l: 'Fit page', a: ACT.eFit }, '-',
    { l: 'Find...', ic: 'search', k: 'Ctrl+F', a: ACT.find }, { l: 'Print...', k: 'Ctrl+P', a: op('print') },
    { l: 'Send to Compare as A', ic: 'send', a: op('toA') }, { l: 'Send to Compare as B', ic: 'send', a: op('toB') });
  window.showCtx(e.clientX, e.clientY, items);
});
$('#thumbs').addEventListener('contextmenu', e => {
  const th = e.target.closest('.th'); if (!th || !E.doc) return;
  e.preventDefault(); const i = +th.dataset.i;
  if (!E.pages.has(i)) th.click();
  const n = E.pages.size;
  window.showCtx(e.clientX, e.clientY, [{ h: n > 1 ? n + ' pages selected' : 'Page ' + (i + 1) },
    { l: 'Rotate right', ic: 'rotR', a: op('rotR') }, { l: 'Rotate left', ic: 'rotL', a: op('rotL') }, { l: 'Rotate 180', a: op('rot180') },
    { l: 'Duplicate', ic: 'copy', a: op('dup') }, { l: 'Insert blank page after', ic: 'blank', a: op('blank') }, { l: 'Insert PDF after...', ic: 'merge', a: op('insertpdf') },
    { l: 'Extract to new file...', ic: 'extract', a: op('extract') }, { l: 'Save as image (PNG)...', a: op('png') }, '-',
    { l: 'Select all pages', a: op('selAll') }, { l: 'Select odd pages', a: op('selOdd') }, { l: 'Select even pages', a: op('selEven') }, '-',
    { l: n > 1 ? 'Delete ' + n + ' pages' : 'Delete page', ic: 'trash', k: 'Ctrl+Del', a: op('del') }]);
});

// ---------------------------------------------------------------- auto-save + crash recovery
function serializeAnnMap(map) {
  const out = {};
  for (const k of Object.keys(map || {})) {
    out[k] = (map[k] || []).map(a => {
      const copy = { ...a };
      delete copy.img;
      delete copy._loadingImg;
      return copy;
    });
  }
  return out;
}
async function autosave() {
  try {
    const cur = snap(), all = T.list.map((t, i) => i === T.cur ? cur : t);
    if (!all.length && E.bytes) all.push(cur);
    const dirty = all.filter(dirtyOf).map(t => ({
      bytes: t.bytes,
      name: t.name,
      path: t.path || null,
      ann: serializeAnnMap(t.ann),
      meas: serializeAnnMap(t.meas)
    }));
    await window.native.recWrite(dirty);
  } catch (e) { /* never interrupt the user */ }
}
if (window.native.recWrite) {
  setInterval(autosave, 60000);
  setTimeout(async () => {
    const list = await window.native.recList(); if (!list || !list.length) return;
    const when = new Date(Math.max(...list.map(f => f.at))).toLocaleString();
    const r = await RE.dialog('Restore unsaved work?', [{ type: 'html', label: `Redline was closed before these files were saved (last auto-save ${esc(when)}):<ul>${list.map(f => '<li>' + esc(f.name) + '</li>').join('')}</ul>` },
      { type: 'note', label: 'Restored files open as unsaved tabs.' }], 'Restore');
    if (!r) { window.native.recClear(); return; }
    window.setView('edit');
    for (const f of list) {
      await RE.openBytes(new Uint8Array(f.bytes), f.name, f.path);
      if (f.ann) E.ann = f.ann;
      if (f.meas) E.meas = f.meas;
      E.savedBytes = null;
      RE.overlay();
      if (RE.updateDocInspector) RE.updateDocInspector();
    }
    try { window.native.recClear(); } catch (e) {}
    est('Restored ' + list.length + ' file(s). Save them with Ctrl+S.');
  }, 1200);
}

// ---------------------------------------------------------------- file changed by another program
const mt = new Map(); let asking = false;
setInterval(async () => {
  if (asking || !E.path || !window.native.mtime) return;
  const m = await window.native.mtime(E.path); if (!m) return;
  const key = E.path, old = mt.get(key);
  if (old == null || E.bytes === E.savedBytes && E.__mtBytes !== E.bytes) {
    if (mt.size >= 32 && !mt.has(key)) mt.delete(mt.keys().next().value);
    mt.set(key, m); E.__mtBytes = E.bytes; return;
  }
  if (m <= old) return;
  mt.set(key, m); asking = true;
  const r = await RE.dialog('File changed', [{ type: 'note', label: E.name + ' was changed by another program.' + (window.isDirty() ? ' Reloading discards your unsaved changes here.' : '') }], 'Reload');
  asking = false;
  if (r) { const f = await window.native.readFile(key); if (f) RE.openBytes(new Uint8Array(f.bytes), f.name, f.path, true); }
}, 4000);

// ---------------------------------------------------------------- editable copy of a password PDF
setInterval(async () => {
  if (!window.__unlocked || !ED() || !E.doc) return; window.__unlocked = false;
  let locked = false; try { await PDFLib.PDFDocument.load(E.bytes); } catch (e) { locked = /encrypt/i.test(e.message || ''); }
  if (!locked) return;
  const r = await RE.dialog('Make an editable copy?', [{ type: 'note', label: 'This PDF is encrypted. You can view, find, print and compare it, but saving edits needs an unlocked copy. The copy keeps every page exactly as it looks, but pages become images (text is no longer selectable).' },
    { type: 'select', id: 'dpi', label: 'Quality', options: [{ label: 'Normal (150 dpi)', value: 150 }, { label: 'High (300 dpi)', value: 300 }] }], 'Make copy');
  if (!r) return;
  window.busy(true);
  try {
    const nd = await PDFLib.PDFDocument.create(), sc = (+r.dpi) / 72;
    for (let i = 1; i <= E.doc.numPages; i++) {
      est('Unlocking page ' + i + ' of ' + E.doc.numPages + '...');
      const p = await E.doc.getPage(i), v1 = p.getViewport({ scale: 1 }), v = p.getViewport({ scale: sc });
      const c = document.createElement('canvas'); c.width = Math.ceil(v.width); c.height = Math.ceil(v.height);
      await p.render({ canvasContext: c.getContext('2d'), viewport: v }).promise;
      const jpgBlob = await new Promise(res => c.toBlob(res, 'image/jpeg', .92));
      c.width = 0; c.height = 0;
      const png = await nd.embedJpg(await jpgBlob.arrayBuffer());
      nd.addPage([v1.width, v1.height]).drawImage(png, { x: 0, y: 0, width: v1.width, height: v1.height });
    }
    const out = await nd.save();
    await RE.openBytes(out, E.name.replace(/\.pdf$/i, '') + '_unlocked.pdf', null, true); E.savedBytes = null;
    est('Editable copy ready. Use Save As to keep it.');
  } catch (e) { est('Could not make a copy: ' + e.message); } finally { window.busy(false); }
}, 1500);

// ---------------------------------------------------------------- text differences
async function pageLines(doc, n) {
  if (!doc || n > doc.numPages) return [];
  const pg = await doc.getPage(n);
  const tc = await pg.getTextContent(), rows = [];
  if (typeof pg.cleanup === 'function') { try { pg.cleanup(); } catch (e) {} }
  for (const it of tc.items) {
    if (!it.str || !it.str.trim()) continue;
    const y = it.transform[5], x = it.transform[4];
    let r = rows.find(r => Math.abs(r.y - y) < 2.5); if (!r) rows.push(r = { y, parts: [] });
    r.parts.push({ x, s: it.str });
  }
  return rows.sort((a, b) => b.y - a.y).map(r => r.parts.sort((a, b) => a.x - b.x).map(p => p.s).join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
}
function diffLines(a, b) {
  const n = a.length, m = b.length;
  if (n * m > 4e6) return [...a.map(s => ['-', s]), ...b.map(s => ['+', s])];
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < n && j < m) { if (a[i] === b[j]) { out.push(['=', a[i]]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) out.push(['-', a[i++]]); else out.push(['+', b[j++]]); }
  while (i < n) out.push(['-', a[i++]]); while (j < m) out.push(['+', b[j++]]);
  return out;
}
async function docDiff(A, B, progress) {
  const pages = Math.max(A.numPages, B.numPages), res = [];
  for (let p = 1; p <= pages; p++) {
    progress && progress(p, pages);
    const d = diffLines(await pageLines(A, p), await pageLines(B, p)).filter(x => x[0] !== '=');
    res.push({ p, d, rem: d.filter(x => x[0] === '-').length, add: d.filter(x => x[0] === '+').length });
  }
  return res;
}
ACT.textDiff = async () => {
  if (!(S.A && S.B)) return cst('Open A and B first.');
  window.busy(true); let res;
  try { res = await docDiff(S.A, S.B, (p, n) => cst('Reading text, page ' + p + ' of ' + n + '...')); } finally { window.busy(false); }
  const rem = res.reduce((s, r) => s + r.rem, 0), add = res.reduce((s, r) => s + r.add, 0);
  cst('Text differences: ' + rem + ' removed, ' + add + ' added lines.');
  const body = res.filter(r => r.d.length).map(r => `<div class="pg">Page ${r.p}  (-${r.rem} / +${r.add})</div>` + r.d.map(([k, s]) => `<div class="${k === '-' ? 'del' : 'add'}">${k} ${esc(s)}</div>`).join('')).join('')
    || '<p>No text differences found. (Drawings without real text, such as scans, need the visual compare.)</p>';
  const r = await RE.dialog('Text differences: ' + (S.names.A || 'A') + ' vs ' + (S.names.B || 'B'), [
    { type: 'html', label: `<p><b>${rem}</b> lines removed, <b>${add}</b> lines added, on ${res.filter(r => r.d.length).length} of ${res.length} pages.</p><div class="tdiff">${body}</div>` }], 'Export as text file');
  if (!r) return;
  const txt = `Redline text differences\nA: ${S.names.A}\nB: ${S.names.B}\n\n` + res.filter(r => r.d.length).map(r => `=== Page ${r.p} ===\n` + r.d.map(([k, s]) => k + ' ' + s).join('\n')).join('\n\n') + '\n';
  window.native.saveFile({ name: 'text_differences.txt', bytes: enc('\ufeff' + txt), filters: [{ name: 'Text', extensions: ['txt'] }] });
};
addEventListener('keydown', e => { if (!ED() && e.ctrlKey && e.key.toLowerCase() === 't') { e.preventDefault(); e.stopImmediatePropagation(); ACT.textDiff(); } }, true);

// ---------------------------------------------------------------- batch compare two folders
let lastBatch = null;
ACT.batch = async () => {
  const a = await window.native.pickFolder('Folder with the ORIGINAL drawings (A)'); if (!a) return;
  const b = await window.native.pickFolder('Folder with the REVISED drawings (B)'); if (!b) return;
  const base = p => p.split(/[\\/]/).pop(), key = p => base(p).toLowerCase();
  const mapB = new Map(b.files.map(f => [key(f), f])), rows = [];
  window.busy(true);
  try {
    for (const [i, fa] of a.files.entries()) {
      cst(`Batch: ${i + 1} of ${a.files.length}  ${base(fa)}`);
      const fb = mapB.get(key(fa)); mapB.delete(key(fa));
      if (!fb) { rows.push({ name: base(fa), st: 'Only in A' }); continue; }
      let A = null, B = null;
      try {
        const [ra, rb] = await Promise.all([window.native.readFile(fa), window.native.readFile(fb)]);
        A = await pdfjsLib.getDocument({ data: new Uint8Array(ra.bytes) }).promise;
        B = await pdfjsLib.getDocument({ data: new Uint8Array(rb.bytes) }).promise;
        const res = await docDiff(A, B), rem = res.reduce((s, r) => s + r.rem, 0), add = res.reduce((s, r) => s + r.add, 0);
        const pages = res.filter(r => r.d.length).map(r => r.p);
        rows.push({ name: base(fa), pa: A.numPages, pb: B.numPages, rem, add, pages: pages.join(' '), st: A.numPages !== B.numPages || rem || add ? 'Different' : 'Same text', fa, fb });
      } catch (e) { rows.push({ name: base(fa), st: 'Error: ' + e.message }); }
      finally {
        if (A && typeof A.destroy === 'function') { try { await A.destroy(); } catch (e) {} }
        if (B && typeof B.destroy === 'function') { try { await B.destroy(); } catch (e) {} }
      }
    }
    for (const fb of mapB.values()) rows.push({ name: base(fb), st: 'Only in B' });
  } finally { window.busy(false); }
  lastBatch = rows;
  const diff = rows.filter(r => r.st === 'Different').length;
  cst(`Batch done: ${rows.length} files, ${diff} different.`);
  const tbl = `<p>${rows.length} files: <b>${diff}</b> different, ${rows.filter(r => r.st === 'Same text').length} same text, ${rows.filter(r => /^Only/.test(r.st)).length} unmatched. Click a file name to open it in Compare.</p>
  <div style="max-height:50vh;overflow:auto"><table class="btab"><tr><th>File</th><th>Result</th><th>Pages A/B</th><th>-lines</th><th>+lines</th><th>Changed pages</th></tr>
  ${rows.map((r, i) => `<tr><td>${r.fa ? `<a href="#" class="bopen" data-i="${i}">${esc(r.name)}</a>` : esc(r.name)}</td><td>${esc(r.st)}</td><td>${r.pa ?? ''}${r.pb != null ? ' / ' + r.pb : ''}</td><td>${r.rem ?? ''}</td><td>${r.add ?? ''}</td><td>${esc(r.pages || '')}</td></tr>`).join('')}</table></div>
  <p class="nt">Batch compare checks the text in each drawing. Open a file in Compare for the full pixel-by-pixel check.</p>`;
  const r = await RE.dialog('Batch compare', [{ type: 'html', label: tbl }], 'Export CSV');
  if (!r) return;
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const csv = 'file,result,pages_a,pages_b,lines_removed,lines_added,changed_pages\n' + rows.map(r => [q(r.name), q(r.st), r.pa ?? '', r.pb ?? '', r.rem ?? '', r.add ?? '', q(r.pages)].join(',')).join('\n') + '\n';
  window.native.saveFile({ name: 'batch_compare.csv', bytes: enc('\ufeff' + csv), filters: [{ name: 'CSV', extensions: ['csv'] }] });
};
document.addEventListener('click', async e => {
  const a = e.target.closest('.bopen'); if (!a || !lastBatch) return; e.preventDefault();
  const r = lastBatch[+a.dataset.i]; $('#dC').click(); window.setView('compare');
  const [fa, fb] = await Promise.all([window.native.readFile(r.fa), window.native.readFile(r.fb)]);
  if (!fa || !fb) return cst('Could not read batch comparison files.');
  await window.compareLoadBytes('A', fa.bytes, fa.name, fa.path, true);
  await window.compareLoadBytes('B', fb.bytes, fb.name, fb.path, false);
});
})();
