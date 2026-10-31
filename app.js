// ===== Redline: shared bits, theme, preferences =====
const $ = s => document.querySelector(s);
const ACT = window.ACT = window.ACT || {};
const PREF = Object.assign({ dpi: 300, tol: 40, edge: 1, minpx: 2, startView: 'compare', confirmSave: true, scanMax: 12 }, (() => { try { return JSON.parse(localStorage.getItem('prefs') || '{}'); } catch (e) { return {}; } })());
window.PREF = PREF; window.savePrefs = () => { try { localStorage.setItem('prefs', JSON.stringify(PREF)); } catch (e) {} };
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('theme', t); } catch (e) {}
  const tb = $('#theme');
  if (tb) {
    const icEl = tb.querySelector('[data-ic]');
    if (icEl) {
      icEl.dataset.ic = t === 'dark' ? 'sun' : 'moon';
      if (typeof hydrateIcons === 'function') hydrateIcons(tb);
    }
  }
}
window.setTheme = setTheme;
(function () { let t = null; try { t = localStorage.getItem('theme'); } catch (e) {} setTheme(t || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')); })();
if ($('#theme')) {
  $('#theme').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}
let busyN = 0; window.busy = on => { busyN = Math.max(0, busyN + (on ? 1 : -1)); $('#busy').hidden = busyN === 0; };
window.__recentMemFiles = window.__recentMemFiles || new Map();
window.addRecent = (name, path, slot = null, bytes = null) => {
  const cleanPath = (path && String(path).trim()) ? String(path).trim() : '';
  const cleanName = (name && String(name).trim()) ? String(name).trim() : (cleanPath ? cleanPath.split(/[\\/]/).pop() : '');
  if (!cleanName) return;
  const keyPath = cleanPath || cleanName;
  if (bytes && keyPath) {
    try {
      const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      if (u8.byteLength <= 24 * 1024 * 1024) {
        if (window.__recentMemFiles.has(keyPath)) window.__recentMemFiles.delete(keyPath);
        window.__recentMemFiles.set(keyPath, { name: cleanName, path: cleanPath, bytes: u8.slice() });
        while (window.__recentMemFiles.size > 6) {
          const oldestKey = window.__recentMemFiles.keys().next().value;
          window.__recentMemFiles.delete(oldestKey);
        }
      }
    } catch (e) {}
  }
  // Only persist items to localStorage if they have a real filesystem path or are in-memory session entries
  if (!cleanPath && /^Sample_/i.test(cleanName)) return;
  try {
    let r = JSON.parse(localStorage.getItem('recent') || '[]').filter(x => (x.path || x.name) !== keyPath && x.name !== cleanName);
    r.unshift({ name: cleanName, path: cleanPath, slot, at: Date.now() });
    localStorage.setItem('recent', JSON.stringify(r.slice(0, 8)));
  } catch (e) {}
};
const b2u = b => b instanceof Uint8Array ? b : new Uint8Array(b);
const getSafeAuthor = (fallback = 'Lead Engineer') => { try { return localStorage.getItem('author') || fallback; } catch (e) { return fallback; } };

// ===== Compare =====
pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
function clampZoom(zoom, min = 0.05, max = 64.0) {
  zoom = Math.max(0.05, Math.min(64.0, Number.isFinite(zoom) && zoom > 0 ? zoom : 1.0));
  return Math.max(min, Math.min(max, zoom));
}
function clampPan(val, fallback = 0) {
  return Number.isFinite(val) ? Math.max(-1e6, Math.min(1e6, val)) : fallback;
}
function sanitizeFilePath(rawPath) {
  if (typeof rawPath !== 'string') return '';
  return rawPath.trim().replace(/^["']+|["']+$/g, '');
}
window.clampZoom = clampZoom;
window.clampPan = clampPan;
window.sanitizeFilePath = sanitizeFilePath;
window.rpTileManager = (typeof WorkerEngine !== 'undefined' && WorkerEngine.VirtualTileManager)
  ? new WorkerEngine.VirtualTileManager()
  : null;

const S = { showTok: 0, A: null, B: null, docA: null, docB: null, renderTask: null, names: {}, n: 1, cur: null, sel: -1, mode: 'paper', view: { x: 0, y: 0, k: 1 }, phase: 0, timer: null, scan: {}, done: {}, ignore: [], ignMode: false, ig: null };
const st = t => $('#st').textContent = t;
const MAXDIM = 9000, MAXAREA = 45e6;
const tick = (() => {
  if (typeof MessageChannel !== 'undefined') {
    const mc = new MessageChannel(), q = [];
    mc.port1.onmessage = () => { const fn = q.shift(); if (fn) fn(); };
    return () => new Promise(r => { q.push(r); mc.port2.postMessage(0); });
  }
  return () => new Promise(r => setTimeout(r, 0));
})();
window.rpFastTick = tick;
const mm = (px, d) => (px / (d || 300) * 25.4).toFixed(1);
const mils = (px, d) => (px / (d || 300) * 1000).toFixed(1);
const isEnglishUnits = () => (window.CAMState && window.CAMState.unitSystem === 'english');
const fmtUnitVal = (px, d) => isEnglishUnits() ? mils(px, d) : mm(px, d);
const fmtUnitName = () => isEnglishUnits() ? 'mil' : 'mm';
let tok = 0, deb;
$('#dpi').value = String(PREF.dpi); $('#tol').value = PREF.tol; $('#edge').value = PREF.edge; $('#minpx').value = PREF.minpx;

function setLabel(k) {
  const txt = S[k] ? (k + ': ' + (S.names[k] || '').slice(0, 20) + ' (' + S[k].numPages + 'p)') : ('Open ' + (k === 'A' ? 'Base (A)' : 'New (B)'));
  const b = $('#open' + k + ' span'); if (b) b.textContent = txt;
  const rb = $('#rib-open' + k + ' span'); if (rb) rb.textContent = txt;
}

function clearMips() {
  if (Array.isArray(S.mips)) {
    for (let i = 1; i < S.mips.length; i++) {
      if (S.mips[i]) { S.mips[i].width = 0; S.mips[i].height = 0; }
    }
  }
  S.mips = null;
}
function clearRenderCache() {
  if (S.renderTask && typeof S.renderTask.cancel === 'function') {
    try { S.renderTask.cancel(); } catch (e) {}
    S.renderTask = null;
  }
  if (S.rc) {
    if (S.rc.a && S.rc.a.c) { S.rc.a.c.width = 0; S.rc.a.c.height = 0; }
    if (S.rc.b && S.rc.b.c) { S.rc.b.c.width = 0; S.rc.b.c.height = 0; }
  }
  S.rc = null;
  if (window.rpTileManager && typeof window.rpTileManager.clear === 'function') {
    window.rpTileManager.clear();
  }
  const cvA = $('#cvA');
  const curtainOn = !!(window.UIRibbon && window.UIRibbon.isCurtainActive && window.UIRibbon.isCurtainActive());
  if (cvA && !curtainOn) { cvA.width = 0; cvA.height = 0; cvA._gen = null; }
  else if (cvA) { cvA._gen = null; }
  const hq = $('#hq');
  if (hq) { hq.width = 0; hq.height = 0; hq.style.display = 'none'; hq._cropA = null; hq._cropB = null; }
}

async function imageBytesToPDF(bytes, name) {
  if (typeof PDFLib === 'undefined' || !PDFLib.PDFDocument) throw new Error('PDF engine not ready');
  const u8 = b2u(bytes);
  const doc = await PDFLib.PDFDocument.create();
  let img = null;
  const isPng = /\.png$/i.test(name) || (u8[0] === 0x89 && u8[1] === 0x50);
  const isJpg = /\.jpe?g$/i.test(name) || (u8[0] === 0xFF && u8[1] === 0xD8);
  if (isPng) {
    try { img = await doc.embedPng(u8); } catch (e) {}
  } else if (isJpg) {
    try { img = await doc.embedJpg(u8); } catch (e) {}
  }
  if (!img && typeof document !== 'undefined') {
    const blob = new Blob([u8]);
    const url = URL.createObjectURL(blob);
    try {
      const im = new Image();
      await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = url; });
      const c = document.createElement('canvas');
      c.width = im.naturalWidth || im.width || 800;
      c.height = im.naturalHeight || im.height || 600;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(im, 0, 0);
      const dataUrl = c.toDataURL('image/png');
      c.width = 0; c.height = 0;
      const pngBytes = Uint8Array.from(atob(dataUrl.split(',')[1]), ch => ch.charCodeAt(0));
      img = await doc.embedPng(pngBytes);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  if (!img) throw new Error('Unsupported image format');
  const pg = doc.addPage([img.width, img.height]);
  pg.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  return await doc.save();
}
window.imageBytesToPDF = imageBytesToPDF;

async function previewSingleSlot(k, pageNum = 1) {
  if (!S[k]) return;
  try {
    if (window.rpCancelSharpen) window.rpCancelSharpen();
    const n = Math.max(1, Math.min(S[k].numPages, pageNum || 1));
    S.n = n;
    if (S.cur) { S.cur.A = null; S.cur.B = null; S.cur.cls = null; }
    S.cur = null;
    S.scan = {};
    const pg = await S[k].getPage(n);
    const vp1 = pg.getViewport({ scale: 1 });
    const sc = Math.min((+$('#dpi').value || 300) / 72, MAXDIM / Math.max(vp1.width, vp1.height, 1), Math.sqrt(MAXAREA / Math.max(1, vp1.width * vp1.height)));
    const r = await render(k, n, sc);
    const cv = $('#cv');
    if (cv && r.c.width) {
      clearMips();
      S._isCAMScan = false;
      if ($('#lv')) { $('#lv')._src = null; $('#lv').style.display = 'none'; }
      if ($('#hq')) { $('#hq').style.display = 'none'; $('#hq')._cropA = null; $('#hq')._cropB = null; }
      if ($('#cvA')) { $('#cvA').style.display = 'none'; $('#cvA').width = 0; $('#cvA').height = 0; }
      cv.style.visibility = 'visible';
      cv.width = r.c.width;
      cv.height = r.c.height;
      cv.getContext('2d', { willReadFrequently: true }).drawImage(r.c, 0, 0);
      const mk = $('#mk');
      if (mk) { mk.width = cv.width; mk.height = cv.height; mk.getContext('2d').clearRect(0, 0, mk.width, mk.height); }
      if ($('#empty')) $('#empty').hidden = true;
      const P = $('#pages');
      if (P) {
        P.innerHTML = '';
        for (let i = 1; i <= S[k].numPages; i++) {
          const b = document.createElement('button');
          b.className = 'pg' + (i === n ? ' cur' : '');
          b.textContent = i;
          b.dataset.n = i;
          b.onclick = () => previewSingleSlot(k, i);
          P.appendChild(b);
        }
      }
      if ($('#sum')) {
        const other = k === 'A' ? 'Revised (B)' : 'Base (A)';
        $('#sum').innerHTML = `<b>Slot ${k} Preview:</b> ${(S.names[k] || '')} (Page ${n} of ${S[k].numPages})<br><span style="color:var(--mute)">Open ${other} to run full difference analysis.</span>`;
      }
      if ($('#list')) $('#list').innerHTML = '';
      if ($('#text')) $('#text').innerHTML = '';
      if (window.UIRibbon && window.UIRibbon.DefectState && window.UIRibbon.DefectState.clearAllPages) {
        window.UIRibbon.DefectState.clearAllPages();
      }
      fit();
      if (window.rpAfterPaint) window.rpAfterPaint();
    }
    if (r && r.c) { r.c.width = 0; r.c.height = 0; }
  } catch (e) {}
}

async function openBytes(k, buf, name, path, skipStart = false) {
  busy(true);
  try {
    if (window.rpCancelSharpen) window.rpCancelSharpen();
    tok++; S.showTok++;
    const safePath = sanitizeFilePath(path || '');
    st('Reading ' + name + '...'); await tick();
    let u8 = b2u(buf).slice();
    if (/\.(png|jpe?g|webp|bmp|gif)$/i.test(name || '')) {
      u8 = await imageBytesToPDF(u8, name);
    }
    S.gen = (S.gen || 0) + 1; clearRenderCache(); clearMips();
    const prevDoc = S[k];
    const doc = await pdfjsLib.getDocument({ data: u8.slice() }).promise;
    S[k] = doc;
    if (k === 'A') S.docA = doc;
    else if (k === 'B') S.docB = doc;
    S.rawBytes = S.rawBytes || {};
    S.rawBytes[k] = u8;
    if (prevDoc && prevDoc !== doc && typeof prevDoc.destroy === 'function') {
      try { await prevDoc.destroy(); } catch (e) {}
    }
    S.names[k] = name; S.paths = S.paths || {}; S.paths[k] = safePath;
    $('#dx').value = 0; $('#dy').value = 0; S.rotB = 0;
    if ($('#rp-cur-dx')) $('#rp-cur-dx').textContent = '0';
    if ($('#rp-cur-dy')) $('#rp-cur-dy').textContent = '0';
    if ($('#rp-rot-b')) $('#rp-rot-b').value = 0;
    if ($('#rp-cur-rot')) $('#rp-cur-rot').textContent = '0°';
    if (!skipStart && window.CompareHistory && typeof window.CompareHistory.clear === 'function') {
      window.CompareHistory.clear();
    }
    setLabel(k); window.addRecent(name, safePath, k, u8); if (window.updateTitle) window.updateTitle(); st('Loaded ' + name);
    if (skipStart) return;
    if (S.A && S.B) {
      await start();
    } else {
      await previewSingleSlot(k, 1);
      st(`Loaded ${k}: ${name} (${S[k].numPages}p) — Now open ${k === 'A' ? 'Revised (B)' : 'Base (A)'} to run comparison.`);
    }
  } catch (e) {
    const isPasswordErr = !!(e && (e.name === 'PasswordException' || /password|encrypt/i.test(e.message || '')));
    if (isPasswordErr) {
      const encMsg = 'This document is password-protected or encrypted. Please decrypt or unlock the file before comparing or markup.';
      st(encMsg);
      if (window.showEncryptedPdfNotice) window.showEncryptedPdfNotice(name);
      else if (window.showToast) window.showToast(encMsg, 4500);
    } else {
      const msg = 'Could not open ' + name + ': not a valid PDF or drawing.';
      st(msg);
      if (window.showToast) window.showToast(msg, 4000);
    }
    setLabel(k);
    if (!S.A && !S.B && $('#empty')) $('#empty').hidden = false;
    syncCompareHud();
  }
  finally { busy(false); }
}
async function loadFile(k, f, skipStart = false) {
  if (!f) return;
  const fPath = f.path || (window.native && window.native.getPathForFile ? window.native.getPathForFile(f) : '') || '';
  if (/\.redline$/i.test(f.name) && window.UIRibbon && window.UIRibbon.restoreSessionFromText) {
    await window.UIRibbon.restoreSessionFromText(await f.text());
    return;
  }
  const buf = await f.arrayBuffer();
  if (/\.(dxf|gbr|ger|art|top|bot|gtl|gbl|gbs|gts|gto|gbo|gtp|gbp|gko|gm1|drl|xln|ipc|d356|net)$/i.test(f.name) && window.openExternalCADOrCAM) {
    await window.openExternalCADOrCAM(new Uint8Array(buf), f.name, fPath || f.name, k, skipStart);
    return;
  }
  await openBytes(k, buf, f.name, fPath, skipStart);
}
window.CMP = S;
window.S = S;
window.loadFile = loadFile;
window.start = start;
window.show = show;
window.openBytes = openBytes;
window.compareLoadBytes = (k, bytes, name, path, skipStart = false) => openBytes(k, b2u(bytes).slice(), name, path, skipStart);
window.compareLoadPair = async (bytesA, nameA, pathA, bytesB, nameB, pathB) => {
  await openBytes('A', b2u(bytesA).slice(), nameA, pathA, true);
  await openBytes('B', b2u(bytesB).slice(), nameB, pathB, false);
};
async function pickCompare(k) {
  const files = await window.native.openFiles({
    title: 'Open Drawing or CAM Layer ' + k + (k === 'A' ? ' (Base / Original — or select 2 files for A & B)' : ' (Revised / New)'),
    multi: true,
    filters: [
      { name: 'All Supported Drawings (PDF, Gerber, Drill, IPC, DXF, Images)', extensions: ['pdf', 'dxf', 'gbr', 'ger', 'art', 'top', 'bot', 'gtl', 'gbl', 'gbs', 'gts', 'gto', 'gbo', 'gtp', 'gbp', 'gko', 'gm1', 'drl', 'xln', 'ipc', 'd356', 'net', 'png', 'jpg', 'jpeg', 'webp', 'bmp', 'redline'] },
      { name: 'PDF Documents', extensions: ['pdf'] },
      { name: 'PCB CAM & IPC-D-356', extensions: ['gbr', 'ger', 'art', 'gtl', 'gbl', 'gbs', 'gts', 'gto', 'gbo', 'drl', 'xln', 'ipc', 'd356', 'net'] },
      { name: 'AutoCAD DXF', extensions: ['dxf'] },
      { name: 'Images (PNG, JPG, WebP)', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }
    ]
  });
  if (!files || !files.length) return;
  if (files.length >= 2) {
    const fA = files[0], fB = files[1];
    const isCadA = /\.(dxf|gbr|ger|art|top|bot|gtl|gbl|gbs|gts|gto|gbo|gtp|gbp|gko|gm1|drl|xln|ipc|d356|net)$/i.test(fA.name);
    const isCadB = /\.(dxf|gbr|ger|art|top|bot|gtl|gbl|gbs|gts|gto|gbo|gtp|gbp|gko|gm1|drl|xln|ipc|d356|net)$/i.test(fB.name);
    if (isCadA && window.openExternalCADOrCAM) await window.openExternalCADOrCAM(b2u(fA.bytes), fA.name, fA.path, 'A', true);
    else await openBytes('A', b2u(fA.bytes), fA.name, fA.path, true);
    if (isCadB && window.openExternalCADOrCAM) await window.openExternalCADOrCAM(b2u(fB.bytes), fB.name, fB.path, 'B', false);
    else await openBytes('B', b2u(fB.bytes), fB.name, fB.path, false);
    return;
  }
  const f = files[0];
  if (/\.redline$/i.test(f.name) && window.UIRibbon && window.UIRibbon.restoreSessionFromText) {
    await window.UIRibbon.restoreSessionFromText(new TextDecoder().decode(b2u(f.bytes)));
    return;
  }
  if (/\.(dxf|gbr|ger|art|top|bot|gtl|gbl|gbs|gts|gto|gbo|gtp|gbp|gko|gm1|drl|xln|ipc|d356|net)$/i.test(f.name) && window.openExternalCADOrCAM) {
    await window.openExternalCADOrCAM(b2u(f.bytes), f.name, f.path, k);
    return;
  }
  await openBytes(k, b2u(f.bytes), f.name, f.path);
}
$('#openA').onclick = () => pickCompare('A'); $('#openB').onclick = () => pickCompare('B');
$('#swap').onclick = () => {
  if (window.rpPushCompareHistory) window.rpPushCompareHistory('Swap A and B');
  S.gen = (S.gen || 0) + 1; clearRenderCache(); clearMips();
  [S.A, S.B] = [S.B, S.A];
  [S.names.A, S.names.B] = [S.names.B, S.names.A];
  S.paths = S.paths || {};
  [S.paths.A, S.paths.B] = [S.paths.B, S.paths.A];
  const ndx = -(parseFloat($('#dx').value) || 0), ndy = -(parseFloat($('#dy').value) || 0), nrot = -(parseFloat(S.rotB) || 0);
  $('#dx').value = Number(ndx.toFixed(1)); $('#dy').value = Number(ndy.toFixed(1)); S.rotB = Number(nrot.toFixed(2));
  if ($('#rp-cur-dx')) $('#rp-cur-dx').textContent = $('#dx').value;
  if ($('#rp-cur-dy')) $('#rp-cur-dy').textContent = $('#dy').value;
  if ($('#rp-rot-b')) $('#rp-rot-b').value = S.rotB;
  if ($('#rp-cur-rot')) $('#rp-cur-rot').textContent = S.rotB + '°';
  if (window.CAMState) {
    [window.CAMState.parsedGerberA, window.CAMState.parsedGerberB] = [window.CAMState.parsedGerberB, window.CAMState.parsedGerberA];
    [window.CAMState.parsedDrillA, window.CAMState.parsedDrillB] = [window.CAMState.parsedDrillB, window.CAMState.parsedDrillA];
    [window.CAMState.parsedIPCA, window.CAMState.parsedIPCB] = [window.CAMState.parsedIPCB, window.CAMState.parsedIPCA];
    [window.__lastGerberA, window.__lastGerberB] = [window.__lastGerberB, window.__lastGerberA];
  }
  if (window.DXFState) {
    [window.DXFState.parsedA, window.DXFState.parsedB] = [window.DXFState.parsedB, window.DXFState.parsedA];
    [window.DXFState.rawA, window.DXFState.rawB] = [window.DXFState.rawB, window.DXFState.rawA];
    [window.DXFState.nameA, window.DXFState.nameB] = [window.DXFState.nameB, window.DXFState.nameA];
    if (window.DXFState.parsedA && window.DXFState.parsedB && typeof DXFEngine !== 'undefined') {
      window.DXFState.lastEntityDiff = DXFEngine.compareDXFEntities(window.DXFState.parsedA, window.DXFState.parsedB);
    }
  }
  setLabel('A'); setLabel('B');
  if (S.A && S.B) start();
  else if (S.A) previewSingleSlot('A');
  else if (S.B) previewSingleSlot('B');
};
let _dragDepth = 0;
function isExternalFileDrag(e) {
  if (!e || !e.dataTransfer || !e.dataTransfer.types) return false;
  const types = Array.from(e.dataTransfer.types);
  return types.includes('Files') && !types.includes('text/plain');
}
function hideDropBackdrop() {
  _dragDepth = 0;
  const bd = $('#rp-drop-backdrop');
  if (bd) {
    bd.hidden = true;
    bd.querySelectorAll('.rp-drop-zone').forEach(z => z.classList.remove('drag-hover'));
  }
}
addEventListener('dragenter', e => {
  if (!isExternalFileDrag(e)) return;
  e.preventDefault();
  _dragDepth++;
  const bd = $('#rp-drop-backdrop');
  if (bd) bd.hidden = false;
});
addEventListener('dragover', e => {
  e.preventDefault();
  if (!isExternalFileDrag(e)) return;
  const bd = $('#rp-drop-backdrop');
  if (bd && bd.hidden) bd.hidden = false;
  if (bd) {
    const zone = e.target && e.target.closest ? e.target.closest('.rp-drop-zone') : null;
    bd.querySelectorAll('.rp-drop-zone').forEach(z => z.classList.toggle('drag-hover', z === zone));
  }
});
addEventListener('dragleave', e => {
  if (!isExternalFileDrag(e)) return;
  _dragDepth = Math.max(0, _dragDepth - 1);
  if (_dragDepth === 0 || (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= innerWidth || e.clientY >= innerHeight)) {
    hideDropBackdrop();
  }
});
addEventListener('drop', async e => {
  e.preventDefault();
  const dropZoneEl = e.target && e.target.closest ? e.target.closest('.rp-drop-zone') : null;
  const targetZone = dropZoneEl ? dropZoneEl.dataset.dropzone : null;
  hideDropBackdrop();

  const rawFiles = [...(e.dataTransfer ? e.dataTransfer.files : [])];
  if (!rawFiles.length) return;
  const sessFile = rawFiles.find(x => /\.redline$/i.test(x.name));
  if (sessFile && window.UIRibbon && window.UIRibbon.restoreSessionFromText) {
    setView('compare');
    window.UIRibbon.restoreSessionFromText(await sessFile.text());
    return;
  }

  if (targetZone === 'edit' || (!targetZone && document.body.dataset.view === 'edit')) {
    setView('edit');
    const pdfs = rawFiles.filter(x => /\.pdf$/i.test(x.name));
    const imgs = rawFiles.filter(x => /\.(png|jpe?g|webp|bmp|gif)$/i.test(x.name));
    if (pdfs.length && window.editorDrop) window.editorDrop(pdfs);
    else if (imgs.length && window.RE && window.RE.ops) window.RE.ops.images(imgs, 'a4');
    return;
  }

  const allFiles = rawFiles.filter(x => /\.(pdf|dxf|gbr|ger|art|top|bot|gtl|gbl|gbs|gts|gto|gbo|gtp|gbp|gko|gm1|drl|xln|ipc|d356|net|png|jpe?g|webp|bmp|gif)$/i.test(x.name));
  if (!allFiles.length) {
    if (window.rpToast) window.rpToast('Unsupported file format. Drop PDF, Gerber, Drill, IPC-D-356, DXF, Image, or .redline files.');
    return;
  }

  setView('compare');
  if (targetZone === 'A') {
    if (allFiles.length >= 2) {
      await loadFile('A', allFiles[0], true);
      await loadFile('B', allFiles[1], false);
    } else {
      await loadFile('A', allFiles[0], false);
    }
  } else if (targetZone === 'B') {
    await loadFile('B', allFiles[0], false);
  } else if (allFiles.length >= 2) {
    await loadFile('A', allFiles[0], true);
    await loadFile('B', allFiles[1], false);
  } else if (allFiles.length === 1) {
    await loadFile(S.A ? 'B' : 'A', allFiles[0], false);
  }
});

async function render(k, n, scale, keepPageCache = true) {
  const c = document.createElement('canvas'); let text = [];
  if (S[k] && n <= S[k].numPages) {
    const p = await S[k].getPage(n), vp = p.getViewport({ scale });
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    const renderTask = p.render({ canvasContext: x, viewport: vp });
    S.renderTask = renderTask;
    await renderTask.promise;
    if (S.renderTask === renderTask) S.renderTask = null;
    text = (await p.getTextContent()).items.map(i => i.str.trim()).filter(Boolean);
    if (!keepPageCache && typeof p.cleanup === 'function') {
      try { p.cleanup(); } catch (e) {}
    }
  }
  return { c, text };
}

async function analyze(n, keep) {
  const dim = async k => { if (n > S[k].numPages) return [0, 0]; const v = (await S[k].getPage(n)).getViewport({ scale: 1 }); return [v.width, v.height]; };
  const [wa, ha] = await dim('A'), [wb, hb] = await dim('B');
  const sc = Math.min((+$('#dpi').value) / 72, MAXDIM / Math.max(wa, ha, wb, hb, 1), Math.sqrt(MAXAREA / (Math.max(wa, wb, 1) * Math.max(ha, hb, 1))));
  const ck = n + '|' + sc.toFixed(4) + '|' + (S.gen || 0); let a, b;
  let cachedHit = false;
  if (S.rc && S.rc.key === ck) { a = S.rc.a; b = S.rc.b; cachedHit = true; } else { a = await render('A', n, sc, !!keep); b = await render('B', n, sc, !!keep); if (keep) { clearRenderCache(); S.rc = { key: ck, a, b }; cachedHit = true; } }
  const W = Math.max(a.c.width, b.c.width, 1), H = Math.max(a.c.height, b.c.height, 1);
  const dx = parseFloat($('#dx').value) || 0, dy = parseFloat($('#dy').value) || 0, rotB = (parseFloat(S.rotB) || 0) * Math.PI / 180, tol = +$('#tol').value, mp = +$('#minpx').value, edge = +$('#edge').value | 0;
  const get = (src, ox, oy, rot = 0) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    if (src.width) {
      x.save();
      if (rot) { x.translate(W / 2 + ox, H / 2 + oy); x.rotate(rot); x.drawImage(src, -W / 2, -H / 2); }
      else { x.drawImage(src, ox, oy); }
      x.restore();
    }
    const imgData = x.getImageData(0, 0, W, H);
    c.width = 0; c.height = 0;
    return imgData;
  };
  const A = get(a.c, 0, 0, 0), B = get(b.c, dx, dy, rotB), pa = A.data, pb = B.data, a32 = new Uint32Array(pa.buffer), b32 = new Uint32Array(pb.buffer), cls = new Uint8Array(W * H);
  if (!cachedHit) {
    if (a && a.c) { a.c.width = 0; a.c.height = 0; }
    if (b && b.c) { b.c.width = 0; b.c.height = 0; }
  }
  const ign = S.ignore.filter(r => r.page == null || r.page === n).map(r => [r.x * sc, r.y * sc, (r.x + r.w) * sc, (r.y + r.h) * sc]);
  const near = (P, Q, x, y, i) => {
    let l0 = 255, l1 = 255, l2 = 255, h0 = 0, h1 = 0, h2 = 0;
    for (let oy = -edge; oy <= edge; oy++) { const yy = y + oy; if (yy < 0 || yy >= H) continue;
      for (let ox = -edge; ox <= edge; ox++) { const xx = x + ox; if (xx < 0 || xx >= W) continue; const j = (yy * W + xx) * 4;
        if (Q[j] < l0) l0 = Q[j]; if (Q[j] > h0) h0 = Q[j]; if (Q[j + 1] < l1) l1 = Q[j + 1]; if (Q[j + 1] > h1) h1 = Q[j + 1]; if (Q[j + 2] < l2) l2 = Q[j + 2]; if (Q[j + 2] > h2) h2 = Q[j + 2]; } }
    return P[i] >= l0 - tol && P[i] <= h0 + tol && P[i + 1] >= l1 - tol && P[i + 1] <= h1 + tol && P[i + 2] >= l2 - tol && P[i + 2] <= h2 + tol;
  };
  // Estimate background color from sheet corners so both white paper and dark PCB/CAD substrates classify Added vs Removed accurately
  const samplePts = [0, (W - 1) * 4, ((H - 1) * W) * 4, ((H - 1) * W + (W - 1)) * 4];
  let bgSrcR = 0, bgSrcG = 0, bgSrcB = 0;
  for (const si of samplePts) { bgSrcR += (pa[si] + pb[si]) / 2; bgSrcG += (pa[si + 1] + pb[si + 1]) / 2; bgSrcB += (pa[si + 2] + pb[si + 2]) / 2; }
  bgSrcR = Math.round(bgSrcR / samplePts.length); bgSrcG = Math.round(bgSrcG / samplePts.length); bgSrcB = Math.round(bgSrcB / samplePts.length);
  const isDarkSubstrate = (bgSrcR * 299 + bgSrcG * 587 + bgSrcB * 114) / 1000 < 128;

  const CS = 8, gw = Math.ceil(W / CS), gh = Math.ceil(H / CS), ca = new Uint32Array(gw * gh), cb = new Uint32Array(gw * gh);
  for (let y = 0, p = 0; y < H; y++) for (let x = 0; x < W; x++, p++) {
    if (a32[p] === b32[p]) continue;
    const i = p * 4, dr = pa[i] - pb[i], dg = pa[i + 1] - pb[i + 1], db = pa[i + 2] - pb[i + 2];
    if (Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db)) <= tol) continue;
    if (ign.length && ign.some(g => x >= g[0] && x < g[2] && y >= g[1] && y < g[3])) continue;
    if (edge > 0 && near(pa, pb, x, y, i) && near(pb, pa, x, y, i)) continue;
    let t;
    if (isDarkSubstrate) {
      const dA = Math.abs(pa[i] - bgSrcR) + Math.abs(pa[i + 1] - bgSrcG) + Math.abs(pa[i + 2] - bgSrcB);
      const dB = Math.abs(pb[i] - bgSrcR) + Math.abs(pb[i + 1] - bgSrcG) + Math.abs(pb[i + 2] - bgSrcB);
      t = dA >= dB ? 1 : 2;
    } else {
      t = (dr + dg + db) <= 0 ? 1 : 2;
    }
    cls[p] = t;
    const ci = (y / CS | 0) * gw + (x / CS | 0); t === 1 ? ca[ci]++ : cb[ci]++;
  }
  const on = new Uint8Array(gw * gh); for (let i = 0; i < on.length; i++) on[i] = (ca[i] + cb[i]) >= mp ? 1 : 0;
  const seen = new Uint8Array(gw * gh), regions = [];
  for (let s = 0; s < on.length; s++) {
    if (!on[s] || seen[s]) continue;
    let x0 = gw, y0 = gh, x1 = 0, y1 = 0, sa = 0, sb = 0; const q = [s]; seen[s] = 1;
    while (q.length) {
      const v = q.pop(), cx = v % gw, cy = v / gw | 0;
      x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy); sa += ca[v]; sb += cb[v];
      for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
        const nx = cx + ox, ny = cy + oy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const j = ny * gw + nx; if (on[j] && !seen[j]) { seen[j] = 1; q.push(j); }
      }
    }
    const x = Math.max(0, x0 * CS - 4), y = Math.max(0, y0 * CS - 4);
    const kind = sb === 0 ? 'r' : sa === 0 ? 'a' : (sa > 3 * sb ? 'r' : sb > 3 * sa ? 'a' : 'c');
    regions.push({ dpi: sc * 72, x, y, w: Math.min(W, (x1 + 1) * CS + 4) - x, h: Math.min(H, (y1 + 1) * CS + 4) - y, kind, sa, sb });
  }
  regions.sort((p, q) => (Math.round(p.y / 120) - Math.round(q.y / 120)) || (p.x - q.x));
  const cnt = t => { const m = {}; t.forEach(w => m[w] = (m[w] || 0) + 1); return m; };
  const ta = cnt(a.text), tb = cnt(b.text), rm = [], ad = [];
  for (const w in ta) if (ta[w] > (tb[w] || 0)) rm.push(w);
  for (const w in tb) if (tb[w] > (ta[w] || 0)) ad.push(w);
  return { W, H, A, B, cls, regions, rm, ad, n, dpi: sc * 72, isDarkSubstrate };
}

// overlay pixels for the three overlay-type modes
function overlayData(r, m) {
  const W = r.W, H = r.H, o = new ImageData(W, H), o32 = new Uint32Array(o.data.buffer), pa = r.A.data, pb = r.B.data, a32 = new Uint32Array(pa.buffer), b32 = new Uint32Array(pb.buffer), c = r.cls, paper = m === 'paper', darkSub = !!r.isDarkSubstrate;
  const lA = $('#lA').checked, lB = $('#lB').checked, lC = $('#lC').checked, dim = m === 'diff' ? 20 : 120;
  const pk = (R, G, B) => (255 << 24) | (B << 16) | (G << 8) | R, bgR = paper ? 255 : 6, bgG = paper ? 255 : 10, bgB = paper ? 255 : 8, bg = pk(bgR, bgG, bgB);
  const hex2rgb = (h, def) => { if (!h || h.length < 7) return def; return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]; };
  const rgbA = hex2rgb(S.tintA, paper ? [225, 20, 20] : [255, 64, 64]);
  const rgbB = hex2rgb(S.tintB, paper ? [0, 165, 60] : [61, 255, 122]);
  const opA = (S.opA != null ? S.opA : 100) / 100, opB = (S.opB != null ? S.opB : 100) / 100;
  const cA = pk(Math.round(bgR + (rgbA[0] - bgR) * opA), Math.round(bgG + (rgbA[1] - bgG) * opA), Math.round(bgB + (rgbA[2] - bgB) * opA));
  const cB = pk(Math.round(bgR + (rgbB[0] - bgR) * opB), Math.round(bgG + (rgbB[1] - bgG) * opB), Math.round(bgB + (rgbB[2] - bgB) * opB));
  for (let p = 0, i = 0; p < c.length; p++, i += 4) {
    const t = c[p];
    if (t === 0 && a32[p] === 0xFFFFFFFF && b32[p] === 0xFFFFFFFF) { o32[p] = lC || !paper ? bg : bg; continue; }
    if (t === 1) { o32[p] = lA ? cA : bg; continue; }
    if (t === 2) { o32[p] = lB ? cB : bg; continue; }
    if (!lC) { o32[p] = bg; continue; }
    if (paper) {
      if (darkSub) {
        const lum = Math.max((pa[i] + pa[i + 1] + pa[i + 2]) / 3, (pb[i] + pb[i + 1] + pb[i + 2]) / 3);
        const v = Math.round(255 - Math.max(0, lum - 20) * 0.55);
        o32[p] = pk(v, v, v);
      } else {
        o32[p] = pk(255 - (255 - pb[i]) * .45, 255 - (255 - pb[i + 1]) * .45, 255 - (255 - pb[i + 2]) * .45);
      }
    } else {
      const ink = darkSub
        ? Math.max((pa[i] + pa[i + 1] + pa[i + 2]) / 3, (pb[i] + pb[i + 1] + pb[i + 2]) / 3) / 255
        : Math.max(255 - (pa[i] + pa[i + 1] + pa[i + 2]) / 3, 255 - (pb[i] + pb[i + 1] + pb[i + 2]) / 3) / 255;
      const v = Math.round(8 + ink * dim);
      o32[p] = pk(v, v + 4, v + 2);
    }
  }
  return o;
}
function paint() {
  const r = S.cur; if (!r) return; clearMips(); S._isCAMScan = false;
  const cv = $('#cv'), x = cv.getContext('2d', { willReadFrequently: true }), W = r.W, H = r.H, m = S.mode, side = m === 'side';
  const curtainOn = !!(window.UIRibbon && window.UIRibbon.isCurtainActive && window.UIRibbon.isCurtainActive());
  cv.width = (!curtainOn && side) ? W * 2 + 24 : W; cv.height = H;
  if (curtainOn) x.putImageData(r.B, 0, 0);
  else if (m === 'A' || (m === 'blink' && S.phase === 0)) x.putImageData(r.A, 0, 0);
  else if (m === 'B' || (m === 'blink' && S.phase === 1)) x.putImageData(r.B, 0, 0);
  else if (side) { x.fillStyle = '#3a4a44'; x.fillRect(0, 0, cv.width, H); x.putImageData(r.A, 0, 0); x.putImageData(r.B, W + 24, 0); }
  else x.putImageData(overlayData(r, m), 0, 0);
  markers(); applyView(); if (window.rpAfterPaint) window.rpAfterPaint();
}
function markers() {
  const r = S.cur; if (!r) return;
  const m = $('#mk'), cv = $('#cv'); m.width = cv.width; m.height = cv.height; const x = m.getContext('2d'), k = S.view.k, offs = S.mode === 'side' ? [0, r.W + 24] : [0], pp = S.mode === 'paper';
  igList().forEach(g => offs.forEach(o => {
    const q = igPx(g), sel = g.id === S.igSel; x.fillStyle = 'rgba(120,130,125,.35)'; x.fillRect(o + q.x, q.y, q.w, q.h); x.setLineDash(sel ? [] : [8 / k, 5 / k]); x.lineWidth = (sel ? 2.5 : 1.5) / k; x.strokeStyle = sel ? '#1a3cff' : '#8a9a93'; x.strokeRect(o + q.x, q.y, q.w, q.h); x.setLineDash([]);
    x.fillStyle = '#5c6b65'; x.font = `${11 / k}px sans-serif`; x.fillText('ignored' + (g.page == null ? ' (all pages)' : ' (this page)'), o + q.x + 3 / k, q.y + 13 / k);
    if (sel && o === 0) { x.fillStyle = '#fff'; x.strokeStyle = '#1a3cff'; x.lineWidth = 1.5 / k; HANDLES.forEach(h => { const [hx, hy] = hpos(q, h), hs = 5 / k; x.fillRect(hx - hs, hy - hs, hs * 2, hs * 2); x.strokeRect(hx - hs, hy - hs, hs * 2, hs * 2); }); }
  }));
  if (S.ig) { x.fillStyle = 'rgba(120,130,125,.3)'; x.fillRect(S.ig.x, S.ig.y, S.ig.w, S.ig.h); x.strokeStyle = '#8a9a93'; x.lineWidth = 1.5 / k; x.strokeRect(S.ig.x, S.ig.y, S.ig.w, S.ig.h); }
  if (!$('#lM').checked) return;
  r.regions.forEach((g, i) => {
    const sel = i === S.sel, dn = S.done[r.n + ':' + i];
    x.lineWidth = (sel ? 3.5 : 1.6) / k; x.strokeStyle = sel ? (pp ? '#1a3cff' : '#ffffff') : dn ? '#8a9a93' : (pp ? '#ff8a00' : '#ffd23d');
    offs.forEach(o => { if (sel) { x.fillStyle = pp ? 'rgba(26,60,255,.10)' : 'rgba(255,255,255,.14)'; x.fillRect(o + g.x, g.y, g.w, g.h); } x.strokeRect(o + g.x, g.y, g.w, g.h); });
  });
}
function buildMip(L) {
  if (!S.mips) S.mips = [$('#cv')];
  for (let i = 1; i <= L; i++) if (!S.mips[i]) {
    const s = S.mips[i - 1], c = document.createElement('canvas'); c.width = Math.max(1, s.width >> 1); c.height = Math.max(1, s.height >> 1);
    const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(s, 0, 0, c.width, c.height); S.mips[i] = c;
  }
}
function syncCompareHud() {
  const hud = $('#c-floating-hud'), cv = $('#cv'), emp = $('#empty');
  if (!hud) return;
  const hasLoadedDrawing = !!(cv && cv.width > 0 && (S.cur || S.A || S.B) && (!emp || emp.hidden));
  hud.hidden = !hasLoadedDrawing;
  const zLbl = $('#cHudZoomLabel');
  if (zLbl && S.view) zLbl.textContent = Math.round(S.view.k * 100) + '%';
  const dLbl = $('#cHudDiffLabel');
  if (dLbl) {
    const cnt = (window.UIRibbon && window.UIRibbon.DefectState && window.UIRibbon.DefectState.defects.length)
      ? window.UIRibbon.DefectState.defects.length
      : (S.cur && S.cur.regions ? S.cur.regions.length : 0);
    dLbl.textContent = cnt + (cnt === 1 ? ' Diff' : ' Diffs');
  }
}
window.syncCompareHud = syncCompareHud;
function applyView() {
  const v = S.view, cv = $('#cv'), lv = $('#lv');
  v.k = clampZoom(v.k, 0.05, 64.0);
  v.x = clampPan(v.x, 0);
  v.y = clampPan(v.y, 0);
  $('#stage').style.transform = `translate(${v.x}px,${v.y}px) scale(${v.k})`;
  syncCompareHud();
  let L = 0; if (S.cur && v.k < 0.6) L = Math.min(4, Math.max(1, Math.floor(Math.log2(1 / v.k))));
  if (L) {
    buildMip(L); const m = S.mips[L];
    if (lv._src !== m) { lv.width = m.width; lv.height = m.height; lv.getContext('2d').drawImage(m, 0, 0); lv._src = m; }
    lv.style.width = cv.width + 'px'; lv.style.height = cv.height + 'px'; lv.style.display = 'block'; cv.style.visibility = 'hidden';
  } else { lv.style.display = 'none'; cv.style.visibility = 'visible'; }
  cv.style.imageRendering = v.k >= 2.5 ? 'pixelated' : 'auto';
}
function fit() {
  const vp = $('#vp'), cv = $('#cv'); if (!cv.width || !vp.clientWidth) return;
  const k = clampZoom(Math.min(vp.clientWidth / cv.width, vp.clientHeight / cv.height) * .98, 0.05, 64.0);
  S.view = { k, x: clampPan((vp.clientWidth - cv.width * k) / 2), y: clampPan((vp.clientHeight - cv.height * k) / 2) }; applyView(); markers();
}
function zoomBy(f) {
  const vp = $('#vp'), v = S.view, mx = vp.clientWidth / 2, my = vp.clientHeight / 2;
  const prevK = clampZoom(v.k, 0.05, 64.0);
  const k = clampZoom(prevK * (Number.isFinite(f) && f > 0 ? f : 1.0), 0.05, 64.0);
  v.x = clampPan(mx - (mx - v.x) * k / prevK);
  v.y = clampPan(my - (my - v.y) * k / prevK);
  v.k = k;
  applyView(); markers(); if (window.rpRedrawOverlay) window.rpRedrawOverlay();
}
window.paint = paint; window.markers = markers; window.applyView = applyView; window.fit = fit; window.zoomBy = zoomBy;
function focusRegion(i) {
  if (!S.cur || !S.cur.regions) return;
  const g = S.cur.regions[i]; if (!g) return; S.sel = i;
  const vp = $('#vp'), k = Math.max(.05, Math.min(16, Math.min(vp.clientWidth / (Math.max(g.w, 20) * 3), vp.clientHeight / (Math.max(g.h, 20) * 3))));
  S.view = { k, x: vp.clientWidth / 2 - (g.x + g.w / 2) * k, y: vp.clientHeight / 2 - (g.y + g.h / 2) * k };
  applyView(); markers(); renderList();
  if (window.UIRibbon && window.UIRibbon.DefectState) {
    const ds = window.UIRibbon.DefectState;
    const dIdx = ds.defects.findIndex(d => (d.regionIndex ?? (d.id - 1)) === i);
    if (dIdx !== -1) {
      ds.currentIndex = dIdx;
      ds.highlightItem(dIdx);
    }
  }
  const el = document.querySelector('.it.sel'); if (el) el.scrollIntoView({ block: 'nearest' });
}
const KIND = { r: ['Removed', 't-r'], a: ['Added', 't-a'], c: ['Changed', 't-c'] };
function updateSummaryOnly() {
  const r = S.cur; if (!r) return;
  const c = k => r.regions.filter(g => g.kind === k).length, rv = r.regions.filter((g, i) => S.done[r.n + ':' + i]).length;
  $('#sum').innerHTML = r.regions.length ? `<b>${r.regions.length}</b> differences on page ${r.n}<br>${c('r')} removed, ${c('a')} added, ${c('c')} changed. Reviewed ${rv}.` : `<b style="color:var(--g)">No differences</b> on page ${r.n}`;
}
window.updateSummaryOnly = updateSummaryOnly;
function renderList() {
  const r = S.cur, L = $('#list'); if (!r || !L) return; L.innerHTML = '';
  const uName = fmtUnitName();
  r.regions.forEach((g, i) => {
    const d = document.createElement('div'), dn = S.done[r.n + ':' + i];
    const kindInfo = KIND[g.kind] || KIND.c;
    d.className = 'it' + (i === S.sel ? ' sel' : '') + (dn ? ' done' : '');
    d.innerHTML = `<input type="checkbox" ${dn ? 'checked' : ''} title="Mark as reviewed"><div><span class="tag ${kindInfo[1]}">${kindInfo[0]}</span> #${i + 1}<small>${fmtUnitVal(g.w, g.dpi)} x ${fmtUnitVal(g.h, g.dpi)} ${uName} at (${fmtUnitVal(g.x, g.dpi)}, ${fmtUnitVal(g.y, g.dpi)}) ${uName}</small></div>`;
    d.onclick = e => { if (e.target.tagName === 'INPUT') { S.done[r.n + ':' + i] = e.target.checked; renderList(); markers(); } else focusRegion(i); };
    L.appendChild(d);
  });
  updateSummaryOnly();
  if (window.UIRibbon && window.UIRibbon.DefectState) {
    window.UIRibbon.DefectState.initFromRegions(r.regions);
  }
  const w = (l, c) => l.length ? l.slice(0, 300).map(t => `<span class="w ${c}">${t.replace(/</g, '&lt;')}</span>`).join('') : '<small>None</small>';
  $('#text').innerHTML = `<h3>Text only in A</h3>${w(r.rm, 'r')}<h3>Text only in B</h3>${w(r.ad, 'a')}`;
}
window.renderList = renderList;
async function show(n) {
  S.n = n; const my = ++S.showTok; busy(true); st('Comparing page ' + n + '...'); await tick();
  try {
    const first = !S.cur || S.cur.n !== n;
    const oldW = (!first && S.cur) ? S.cur.W : 0;
    const oldDpi = (!first && S.cur) ? S.cur.dpi : 0;
    const res = await analyze(n, true);
    if (my !== S.showTok) {
      if (res) { res.A = null; res.B = null; res.cls = null; }
      return;
    }
    if (S.cur && S.cur !== res) { S.cur.A = null; S.cur.B = null; S.cur.cls = null; }
    S.cur = res; S.sel = -1; $('#empty').hidden = true;
    document.querySelectorAll('.pg').forEach(b => b.classList.toggle('cur', b.dataset.n == n));
    if (!first && oldW > 0 && res.W > 0 && oldW !== res.W) {
      const scaleRatio = res.W / oldW;
      if (S.view && S.view.k) {
        S.view.k = S.view.k * (oldW / res.W);
      }
      if (window.RP_MEASURE) {
        const rm = window.RP_MEASURE;
        if (Array.isArray(rm.annotations)) {
          rm.annotations.forEach(a => {
            if (a.page != null && a.page !== n) return;
            if (typeof a.x === 'number') a.x *= scaleRatio;
            if (typeof a.y === 'number') a.y *= scaleRatio;
            if (Array.isArray(a.pts)) a.pts.forEach(p => { p.x *= scaleRatio; p.y *= scaleRatio; });
          });
        }
        if (rm.tally && Array.isArray(rm.tally.items)) {
          rm.tally.items.forEach(it => {
            if (it.page === n) { it.x *= scaleRatio; it.y *= scaleRatio; }
          });
        }
        if (rm.calibrator && rm.calibrator.calibrated && oldDpi > 0 && res.dpi > 0) {
          rm.calibrator.pxPerUnit *= (res.dpi / oldDpi);
          if (window.rpUpdateCalBadge) window.rpUpdateCalBadge();
        }
      }
    }
    paint(); renderList();
    if (first || !S.view || !S.view.k) fit();
    else { applyView(); markers(); if (window.rpSharpen) window.rpSharpen(); }
    st('Page ' + n + ': ' + S.cur.regions.length + ' differences. ' + S.cur.W + ' x ' + S.cur.H + ' px at ' + Math.round(S.cur.dpi) + ' dpi');
  } catch (e) { st('Could not compare page ' + n + ': ' + (e.message || e)); } finally { busy(false); }
}
async function scanAll(my) {
  const N = Math.max(S.A.numPages, S.B.numPages), P = $('#pages'); busy(true);
  try {
    for (let n = 1; n <= N; n++) {
      if (my !== tok) return; st('Scanning page ' + n + ' of ' + N + '...');
      const r = S.cur && n === S.cur.n ? S.cur : await analyze(n, false);
      if (my !== tok) {
        if (r && r !== S.cur) { r.A = null; r.B = null; r.cls = null; }
        return;
      }
      S.scan[n] = r.regions;
      if (r && r !== S.cur) { r.A = null; r.B = null; r.cls = null; }
      const b = P.querySelector(`.pg[data-n="${n}"]`); if (b) { b.classList.remove('same', 'diff'); b.classList.add(r.regions.length ? 'diff' : 'same'); b.title = r.regions.length + ' differences'; }
      await tick();
    }
    const bad = Object.values(S.scan).filter(x => x.length).length;
    const dpiTail = S.cur ? ` · Page ${S.cur.n}: ${S.cur.W} × ${S.cur.H} px at ${Math.round(S.cur.dpi)} dpi` : '';
    st((bad ? bad + ' of ' + N + ' pages have differences.' : 'No differences on any page.') + dpiTail);
  } finally { busy(false); }
}
function addScanBtn(P, N) { if (P.querySelector('.sm')) return; const b = document.createElement('button'); b.className = 'sm'; b.textContent = 'Scan all ' + N + ' pages'; b.onclick = () => { b.remove(); scanAll(tok); }; P.appendChild(b); }
async function start() {
  if (S.cur) { S.cur.A = null; S.cur.B = null; S.cur.cls = null; }
  const my = ++tok, N = Math.max(S.A.numPages, S.B.numPages); S.scan = {}; S.cur = null; S.n = 1;
  S._lastDpi = +$('#dpi').value || 300;
  if (window.UIRibbon && window.UIRibbon.DefectState && window.UIRibbon.DefectState.clearAllPages) {
    window.UIRibbon.DefectState.clearAllPages();
  }
  const P = $('#pages'); P.innerHTML = '';
  for (let n = 1; n <= N; n++) { const b = document.createElement('button'); b.className = 'pg'; b.textContent = n; b.dataset.n = n; b.onclick = () => show(n); P.appendChild(b); }
  await show(1);
  if (N > PREF.scanMax) { addScanBtn(P, N); st('Page 1 compared. Click "Scan all" to check every page.'); return; }
  await scanAll(my);
}
window.refresh = refresh; async function refresh() {
  if (!(S.A && S.B)) {
    if (S.A) await previewSingleSlot('A');
    else if (S.B) await previewSingleSlot('B');
    return;
  }
  const N = Math.max(S.A.numPages, S.B.numPages), P = $('#pages');
  if (!S.cur || P.querySelectorAll('.pg').length !== N) return start();
  const my = ++tok; S.scan = {}; P.querySelectorAll('.pg').forEach(b => b.classList.remove('same', 'diff'));
  await show(Math.min(S.n, N)); if (my !== tok) return;
  if (N > PREF.scanMax) { addScanBtn(P, N); return; }
  await scanAll(my);
}
const redo = () => { clearTimeout(deb); deb = setTimeout(refresh, 300); };
S._lastDpi = +$('#dpi').value || 300;
['tol', 'minpx', 'edge', 'dx', 'dy'].forEach(id => {
  const el = $('#' + id);
  if (!el) return;
  el.onchange = () => {
    if (id === 'tol') {
      if ($('#rp-diff-thresh')) $('#rp-diff-thresh').value = el.value;
      if ($('#rp-tol-val')) $('#rp-tol-val').textContent = el.value;
    } else if (id === 'minpx') {
      const v = parseInt(el.value, 10) || 2;
      if ($('#rp-noise-thresh')) $('#rp-noise-thresh').value = v;
      if ($('#rp-noise-val')) $('#rp-noise-val').textContent = v;
      if (window.UIRibbon && window.UIRibbon.DefectState) window.UIRibbon.DefectState.noiseThreshold = v;
    } else if (id === 'edge') {
      const v = parseInt(el.value, 10) || 0;
      if ($('#rp-edge-thresh')) $('#rp-edge-thresh').value = v;
      if ($('#rp-edge-val')) $('#rp-edge-val').textContent = v;
    } else if (id === 'dx' && $('#rp-cur-dx')) {
      $('#rp-cur-dx').textContent = el.value;
    } else if (id === 'dy' && $('#rp-cur-dy')) {
      $('#rp-cur-dy').textContent = el.value;
    }
    redo();
  };
});
$('#dpi').onchange = () => {
  const newDpi = +$('#dpi').value || 300;
  const oldDpi = S._lastDpi || 300;
  S._lastDpi = newDpi;
  PREF.dpi = newDpi;
  if (window.savePrefs) window.savePrefs();
  if (oldDpi > 0 && newDpi !== oldDpi) {
    const ratio = newDpi / oldDpi;
    const dxVal = parseFloat($('#dx').value) || 0;
    const dyVal = parseFloat($('#dy').value) || 0;
    if (dxVal !== 0 || dyVal !== 0) {
      $('#dx').value = Number((dxVal * ratio).toFixed(1));
      $('#dy').value = Number((dyVal * ratio).toFixed(1));
      if ($('#rp-cur-dx')) $('#rp-cur-dx').textContent = $('#dx').value;
      if ($('#rp-cur-dy')) $('#rp-cur-dy').textContent = $('#dy').value;
    }
  }
  redo();
};
['lA', 'lB', 'lC'].forEach(id => $('#' + id).onchange = paint);
$('#lM').onchange = () => {
  if ($('#rp-markers-chk')) $('#rp-markers-chk').checked = $('#lM').checked;
  if ($('#rib-view-markers')) $('#rib-view-markers').classList.toggle('on', $('#lM').checked);
  markers();
};
$('#mode').onchange = e => {
  const prevMode = S.mode;
  S.mode = e.target.value; clearInterval(S.timer); S.timer = null;
  if (S.mode === 'blink') S.timer = setInterval(() => { if (document.body.dataset.view === 'compare') { S.phase ^= 1; paint(); } }, 600);
  if (S.cur) {
    paint();
    if (!S.view || !S.view.k || prevMode === 'side' || S.mode === 'side') fit();
    else { applyView(); markers(); }
    if (window.rpSharpen) window.rpSharpen();
  } else if (S.A || S.B) {
    const slot = (S.mode === 'B' && S.B) ? 'B' : (S.A ? 'A' : 'B');
    previewSingleSlot(slot);
  }
};
function nextDiff(d) {
  if (!S.cur) return; const n = S.cur.regions.length, i = S.sel + d;
  if (i >= 0 && i < n) return focusRegion(i);
  const pages = Object.keys(S.scan).map(Number).filter(p => S.scan[p].length).sort((a, b) => a - b), p = d > 0 ? pages.find(x => x > S.cur.n) : [...pages].reverse().find(x => x < S.cur.n);
  if (p) show(p).then(() => focusRegion(d > 0 ? 0 : S.cur.regions.length - 1)); else st(d > 0 ? 'No more differences.' : 'No earlier differences.');
}
$('#nextD').onclick = () => nextDiff(1); $('#prevD').onclick = () => nextDiff(-1);
$('#markAll').onclick = () => { if (!S.cur) return; if (window.rpPushCompareHistory) window.rpPushCompareHistory('Mark all reviewed'); S.cur.regions.forEach((g, i) => S.done[S.cur.n + ':' + i] = true); renderList(); markers(); };
document.querySelectorAll('aside .tabs button[data-t]').forEach(b => b.onclick = () => {
  document.querySelectorAll('aside .tabs button[data-t]').forEach(x => x.classList.toggle('on', x === b));
  $('#list').hidden = b.dataset.t !== 'd'; $('#text').hidden = b.dataset.t !== 't';
});

// ignore areas: draw, select, move, resize, delete (right-click or Delete key)
let igId = 1;
function igList() { return S.cur ? S.ignore.filter(g => g.page == null || g.page === S.cur.n) : []; }
function igPx(g) { const sc = S.cur.dpi / 72; return { x: g.x * sc, y: g.y * sc, w: g.w * sc, h: g.h * sc }; }
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'], CUR = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', move: 'move' };
function hpos(r, m) { const xx = m.includes('w') ? r.x : m.includes('e') ? r.x + r.w : r.x + r.w / 2, yy = m.includes('n') ? r.y : m.includes('s') ? r.y + r.h : r.y + r.h / 2; return [xx, yy]; }
function igHit(x, y) {
  if (!S.cur) return null; const hs = 8 / S.view.k, L = igList(), sel = L.find(g => g.id === S.igSel);
  if (sel) { const r = igPx(sel); for (const m of HANDLES) { const [hx, hy] = hpos(r, m); if (Math.abs(x - hx) <= hs && Math.abs(y - hy) <= hs) return { g: sel, mode: m }; } }
  for (let i = L.length - 1; i >= 0; i--) { const r = igPx(L[i]); if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { g: L[i], mode: 'move' }; }
  return null;
}
function delIgnore(id) { if (window.rpPushCompareHistory) window.rpPushCompareHistory('Delete ignore area'); S.ignore = S.ignore.filter(g => g.id !== id); if (S.igSel === id) S.igSel = null; markers(); redo(); st('Ignore area deleted'); }
$('#ignBtn').onclick = () => {
  if (!S.ignMode && window.RP_MEASURE && window.RP_MEASURE.activeTool && window.rpSetActiveTool) {
    window.rpSetActiveTool(null);
  }
  S.ignMode = !S.ignMode;
  $('#ignBtn').classList.toggle('on', S.ignMode);
  if ($('#rib-ignore')) $('#rib-ignore').classList.toggle('on', S.ignMode);
  $('#vp').classList.toggle('ign', S.ignMode);
  const pill = $('#rp-active-tool-pill'), pillName = $('#rp-active-tool-name'), finBtn = $('#rp-finish-tool-btn');
  if (pill && pillName) {
    if (S.ignMode) {
      pill.hidden = false;
      if (finBtn) finBtn.hidden = true;
      pillName.textContent = 'Active: Ignore Zone (Drag rectangle on drawing to exclude, Right-click to delete, Esc to exit)';
    } else if (!(window.RP_MEASURE && window.RP_MEASURE.activeTool)) {
      pill.hidden = true;
    }
  }
  st(S.ignMode ? 'Drag a rectangle over the area to ignore. Right-click an area to delete it, drag its handles to resize.' : 'Ignore mode off');
};
ACT.clearIgnore = () => { if (window.rpPushCompareHistory) window.rpPushCompareHistory('Clear ignore areas'); S.ignore = []; S.igSel = null; markers(); redo(); st('All ignore areas cleared'); };

// context menu
let ctx = null;
function closeCtx() { if (ctx) { ctx.remove(); ctx = null; } }

function showCtx(x, y, items) {
  closeCtx(); ctx = document.createElement('div'); ctx.className = 'dd'; ctx.id = 'ctxmenu';
  items.forEach(it => {
    if (it === '-') { const s = document.createElement('div'); s.className = 'msep'; ctx.append(s); return; }
    if (it.h) { const h = document.createElement('div'); h.className = 'mh'; h.textContent = it.h; ctx.append(h); return; }
    const b = document.createElement('button'); b.className = 'mi'; b.innerHTML = (it.ic ? ic(it.ic) : '<span style="width:16px"></span>') + '<span class="l"></span>' + (it.k ? `<span class="k">${it.k}</span>` : '');
    b.querySelector('.l').textContent = it.l; b.disabled = !!it.dis; b.onclick = () => { closeCtx(); it.a(); }; ctx.append(b);
  });
  document.body.append(ctx); ctx.style.left = Math.max(4, Math.min(x, innerWidth - ctx.offsetWidth - 6)) + 'px'; ctx.style.top = Math.max(4, Math.min(y, innerHeight - ctx.offsetHeight - 6)) + 'px';
}
window.showCtx = showCtx;
document.addEventListener('mousedown', e => { if (ctx && !ctx.contains(e.target)) closeCtx(); }); addEventListener('blur', closeCtx);

// pan / zoom / ignore interaction
const vp = $('#vp'); let drag = null;
const toImg = e => { const b = vp.getBoundingClientRect(); return [(e.clientX - b.left - S.view.x) / S.view.k, (e.clientY - b.top - S.view.y) / S.view.k]; };
vp.onpointerdown = e => {
  if (e.button === 2) return;
  if (e.target && e.target.closest && e.target.closest('#empty, #c-floating-hud, #rp-curtain-handle, button, select, input, a, label')) return;
  if (S.cur) {
    const [x, y] = toImg(e), h = igHit(x, y);
    if (h) { if (window.rpPushCompareHistory) window.rpPushCompareHistory('Adjust ignore area'); S.igSel = h.g.id; S.igDrag = { mode: h.mode, g: h.g, x0: x, y0: y, o: { ...h.g }, moved: false }; vp.setPointerCapture(e.pointerId); markers(); return; }
    if (S.igSel) { S.igSel = null; markers(); }
    if (S.ignMode) { S.ig = { x0: x, y0: y, x, y, w: 0, h: 0 }; vp.setPointerCapture(e.pointerId); return; }
  }
  drag = { x: e.clientX - S.view.x, y: e.clientY - S.view.y }; vp.setPointerCapture(e.pointerId); vp.classList.add('drag');
};
vp.onpointerup = () => {
  if (S.igDrag) { const d = S.igDrag; S.igDrag = null; if (d.moved) redo(); return; }
  if (S.ig) { const g = S.ig; S.ig = null; if (g.w > 4 && g.h > 4) { if (window.rpPushCompareHistory) window.rpPushCompareHistory('Add ignore area'); const sc = S.cur.dpi / 72, n = { id: igId++, x: g.x / sc, y: g.y / sc, w: g.w / sc, h: g.h / sc, page: $('#ignAll').checked ? null : S.cur.n }; S.ignore.push(n); S.igSel = n.id; redo(); } markers(); return; }
  drag = null; vp.classList.remove('drag');
};
vp.onpointermove = e => {
  const [x, y] = toImg(e);
  if (S.igDrag) {
    const d = S.igDrag, sc = S.cur.dpi / 72, dx = (x - d.x0) / sc, dy = (y - d.y0) / sc, g = d.g, o = d.o, m = d.mode; d.moved = true;
    if (m === 'move') { g.x = o.x + dx; g.y = o.y + dy; }
    else { let x0 = o.x, y0 = o.y, x1 = o.x + o.w, y1 = o.y + o.h; if (m.includes('w')) x0 += dx; if (m.includes('e')) x1 += dx; if (m.includes('n')) y0 += dy; if (m.includes('s')) y1 += dy; g.x = Math.min(x0, x1); g.y = Math.min(y0, y1); g.w = Math.max(3, Math.abs(x1 - x0)); g.h = Math.max(3, Math.abs(y1 - y0)); }
    markers(); return;
  }
  if (S.ig) { const g = S.ig; g.x = Math.min(g.x0, x); g.y = Math.min(g.y0, y); g.w = Math.abs(x - g.x0); g.h = Math.abs(y - g.y0); markers(); return; }
  if (drag) { S.view.x = e.clientX - drag.x; S.view.y = e.clientY - drag.y; applyView(); }
  else if (S.cur) { const h = igHit(x, y); vp.style.cursor = h ? CUR[h.mode] : (S.ignMode ? 'crosshair' : ''); }
  if (S.cur && !window.RP_MEASURE) $('#pos').textContent = `x ${fmtUnitVal(x, S.cur.dpi)} ${fmtUnitName()}   y ${fmtUnitVal(y, S.cur.dpi)} ${fmtUnitName()}   zoom ${Math.round(S.view.k * 100)}%`;
};
vp.oncontextmenu = e => {
  e.preventDefault(); if (!S.cur && !$('#cv').width) return;
  const [x, y] = toImg(e), h = igHit(x, y);
  if (h) {
    const g = h.g; S.igSel = g.id; markers();
    showCtx(e.clientX, e.clientY, [
      { h: 'Ignore Area #' + g.id },
      { l: 'Delete this ignore area', ic: 'trash', k: 'Del', a: () => delIgnore(g.id) },
      { l: g.page == null ? 'Apply to this page only' : 'Apply to all pages', a: () => { g.page = g.page == null ? S.cur.n : null; markers(); redo(); } },
      '-',
      { l: 'Delete all ignore areas', ic: 'trash', a: ACT.clearIgnore }
    ]);
    return;
  }

  const nearestDefectIdx = (S.cur && S.cur.regions) ? S.cur.regions.findIndex(r => Math.abs(x - (r.x + r.w / 2)) < Math.max(r.w, 40) && Math.abs(y - (r.y + r.h / 2)) < Math.max(r.h, 40)) : -1;

  const items = [];
  const hitAnnRes = (window.RP_MEASURE && window.RP_MEASURE.hitAt) ? window.RP_MEASURE.hitAt(x, y, S.n || 1) : null;
  if (hitAnnRes) {
    const ha = hitAnnRes.ann;
    items.push(
      { h: `Markup: ${ha.kind.toUpperCase()}${ha.pinNum ? ' #' + ha.pinNum : ''}` },
      ...(['pin', 'leader', 'cloud'].includes(ha.kind) ? [{
        l: 'Edit label / callout note...',
        ic: 'edittext',
        a: () => window.RP_MEASURE.editAnnotation && window.RP_MEASURE.editAnnotation(ha)
      }] : []),
      {
        l: 'Delete this markup',
        ic: 'trash',
        a: () => {
          if (window.rpPushCompareHistory) window.rpPushCompareHistory('Delete markup');
          window.RP_MEASURE.annotations.splice(hitAnnRes.idx, 1);
          if (window.rpRedrawOverlay) window.rpRedrawOverlay();
          if (window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar();
        }
      },
      '-'
    );
  }
  if (nearestDefectIdx !== -1) {
    const def = S.cur.regions[nearestDefectIdx];
    items.push(
      { h: `Defect #${nearestDefectIdx + 1} (${def.kind === 'r' ? 'Removed' : def.kind === 'a' ? 'Added' : 'Changed'})` },
      { l: 'Focus on this defect', ic: 'search', a: () => focusRegion(nearestDefectIdx) },
      { l: 'Mark defect as reviewed', ic: 'check', a: () => { S.done[S.cur.n + ':' + nearestDefectIdx] = true; renderList(); markers(); if (window.UIRibbon && window.UIRibbon.DefectState) window.UIRibbon.DefectState.setStatusByRegion(nearestDefectIdx, 'Approved'); } },
      '-'
    );
  }

  const placeCtxStamp = stampType => {
    if (!window.RP_MEASURE) return;
    if (window.rpPushCompareHistory) window.rpPushCompareHistory(`Stamp ${stampType}`);
    window.RP_MEASURE.annotations.push({
      kind: 'stamp',
      page: S.n || 1,
      x: x - 105,
      y: y - 38,
      stampType,
      reviewer: getSafeAuthor('Lead Engineer'),
      docHash: window.RP_MEASURE.docHash
    });
    if (window.rpRedrawOverlay) window.rpRedrawOverlay();
    if (window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar();
  };

  items.push(
    { h: 'CAM350 & IPC Units' },
    { l: `Switch Units: ${isEnglishUnits() ? 'IPC Metric (mm / µm)' : 'IPC English (mils / in)'}`, ic: 'calibrate', k: 'U', a: () => window.setUnitSystem && window.setUnitSystem(isEnglishUnits() ? 'metric' : 'english') },
    { l: 'Open CAM350 Workbench (D-Codes / Drills / IPC-D-356)...', ic: 'pcbCam', a: () => window.showCAM350WorkbenchModal && window.showCAM350WorkbenchModal('format') },
    { l: 'Run IPC Class 1/2/3 DFM & Clearance Scan', ic: 'clearance', a: () => window.UIRibbon && window.UIRibbon.runCAMClearanceScan() },
    '-',
    { h: 'Measure & Takeoffs' },
    { l: 'Measure distance from here', ic: 'dist', k: 'M', a: () => { if (window.rpSetActiveTool) window.rpSetActiveTool('dist', 'Distance'); } },
    { l: 'Measure cumulative polyline run', ic: 'polyline', a: () => { if (window.rpSetActiveTool) window.rpSetActiveTool('poly', 'Cumulative Polyline'); } },
    { l: 'Measure closed polygon area', ic: 'area', a: () => { if (window.rpSetActiveTool) window.rpSetActiveTool('area', 'Polygon Area'); } },
    { l: 'Place BOM inspection badge (#)', ic: 'tally', a: () => { if (window.RP_MEASURE && window.RP_MEASURE.tally) { if (window.rpPushCompareHistory) window.rpPushCompareHistory('Add BOM badge'); window.RP_MEASURE.tally.addItem(x, y, S.n || 1, 'Inspection Badge'); if (window.rpRedrawOverlay) window.rpRedrawOverlay(); if (window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar(); } } },
    { l: 'Calibrate drawing scale...', ic: 'calibrate', a: () => { if (window.rpSetActiveTool) window.rpSetActiveTool('calibrate', 'Calibrate Scale'); } },
    '-',
    { h: 'Markups & Sign-Off' },
    { l: 'Add scalloped revision cloud (Δ Rev)', ic: 'revCloud', a: () => { if (window.rpSetActiveTool) window.rpSetActiveTool('cloud', 'Revision Cloud'); } },
    { l: 'Add leader callout arrow here', ic: 'leader', a: () => { if (window.rpSetActiveTool) window.rpSetActiveTool('leader', 'Leader Callout'); } },
    { l: 'Freehand redline pen', ic: 'pen', a: () => { if (window.rpSetActiveTool) window.rpSetActiveTool('pen', 'Freehand Pen'); } },
    { l: 'Place inspection pin marker here', ic: 'pin', a: () => { if (window.rpSetActiveTool) window.rpSetActiveTool('pin', 'Pin Marker'); } },
    { l: 'Eraser (remove markup or pin)', ic: 'eraser', a: () => { if (window.rpSetActiveTool) window.rpSetActiveTool('eraser', 'Eraser'); } },
    { l: 'Security redaction box', ic: 'redact', a: () => { if (window.rpSetActiveTool) window.rpSetActiveTool('redact', 'Redact Box'); } },
    { l: 'Stamp: APPROVED', ic: 'stampApp', a: () => placeCtxStamp('APPROVED') },
    { l: 'Stamp: REJECTED', ic: 'stampRej', a: () => placeCtxStamp('REJECTED') },
    { l: 'Stamp: REVISED & RESUBMIT', ic: 'stampRev', a: () => placeCtxStamp('REVISED & RESUBMIT') },
    { l: 'Stamp: FOR REVIEW (SHA-256)', ic: 'stampSha', a: () => placeCtxStamp('FOR REVIEW ONLY') },
    { l: 'Clear placed markups on sheet', ic: 'trash', a: () => { if (window.RP_MEASURE) { if (window.rpPushCompareHistory) window.rpPushCompareHistory('Clear markups'); window.RP_MEASURE.annotations = []; if (window.RP_MEASURE.tally) window.RP_MEASURE.tally.clear(); if (window.rpRedrawOverlay) window.rpRedrawOverlay(); if (window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar(); } }, dis: !((window.RP_MEASURE && window.RP_MEASURE.annotations && window.RP_MEASURE.annotations.length) || (window.RP_MEASURE && window.RP_MEASURE.tally && window.RP_MEASURE.tally.items.length)) },
    '-',
    { h: 'Optics & Registration' },
    { l: 'Toggle 4x magnifier loupe', ic: 'loupe', k: 'L', a: () => { $('#rib-loupe-toggle') && $('#rib-loupe-toggle').click(); } },
    { l: 'Toggle calibrated reference grid', ic: 'grid', k: 'G', a: () => { $('#rib-grid-toggle') && $('#rib-grid-toggle').click(); } },
    { l: 'Toggle precision crosshair', ic: 'crosshair', k: 'X', a: () => { $('#rib-crosshair-toggle') && $('#rib-crosshair-toggle').click(); } },
    { l: 'Toggle 60 FPS split curtain', ic: 'curtain', k: 'C', a: () => { $('#rib-curtain-toggle') && $('#rib-curtain-toggle').click(); } },
    { l: 'Capture fiducial point here', ic: 'fiducial', a: () => { if (window.UIRibbon && window.UIRibbon.FiducialAligner) { if (!window.UIRibbon.FiducialAligner.active) window.UIRibbon.FiducialAligner.start(); window.UIRibbon.FiducialAligner.addPoint(x, y); } } },
    { l: S.ignMode ? 'Stop drawing ignore areas' : 'Draw ignore mask zone', ic: 'ignore', k: 'I', a: ACT.ignore },
    { l: 'Auto-align B to A', ic: 'align', k: 'A', a: ACT.align },
    { l: 'Swap A and B', ic: 'swap', k: 'S', a: () => $('#swap').click() },
    '-',
    { h: 'Edit & History' },
    { l: 'Undo last action', ic: 'undo', k: 'Ctrl+Z', a: () => ACT.cUndo && ACT.cUndo() },
    { l: 'Redo action', ic: 'redo', k: 'Ctrl+Y', a: () => ACT.cRedo && ACT.cRedo() },
    '-',
    { h: 'Navigation & View' },
    { l: 'Next difference', ic: 'next', k: 'N', a: () => nextDiff(1) },
    { l: 'Previous difference', ic: 'prev', k: 'P', a: () => nextDiff(-1) },
    { l: 'Fit to window & sharpen', ic: 'fit', k: 'F', a: () => { fit(); if (window.rpSharpen) window.rpSharpen(); } },
    { l: 'Zoom in (125%)', ic: 'zoomin', a: () => zoomBy(1.25) },
    { l: 'Zoom out (80%)', ic: 'zoomout', a: () => zoomBy(0.8) },
    '-',
    { h: 'Deliverables & Reports' },
    { l: 'Executive audit report (PDF)...', ic: 'auditPdf', a: () => window.UIRibbon && window.UIRibbon.generateExecutiveAuditReport() },
    { l: 'Export defect checklist (CSV)', ic: 'csv', a: () => window.UIRibbon && window.UIRibbon.exportDefectsCSV() },
    { l: 'Export drawing as AutoCAD .dxf...', ic: 'dxfOut', a: () => window.UIRibbon && window.UIRibbon.promptDXFExport() },
    { l: 'Save comparison image (PNG)', ic: 'png', a: () => $('#png').click() },
    { l: 'Save review session (.redline)', ic: 'sessionSave', a: () => window.UIRibbon && window.UIRibbon.saveSessionFile() }
  );

  showCtx(e.clientX, e.clientY, items);
};
vp.onwheel = e => {
  e.preventDefault(); const b = vp.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top, v = S.view;
  const prevK = clampZoom(v.k, 0.05, 64.0);
  const k = clampZoom(prevK * (e.deltaY < 0 ? 1.2 : 1 / 1.2), 0.05, 64.0);
  v.x = clampPan(mx - (mx - v.x) * k / prevK);
  v.y = clampPan(my - (my - v.y) * k / prevK);
  v.k = k;
  applyView(); clearTimeout(S.mt); S.mt = setTimeout(markers, 80);
};

// auto-align B to A
function grayOf(c, f) {
  const w = Math.max(1, Math.floor(c.width / f)), h = Math.max(1, Math.floor(c.height / f)), t = document.createElement('canvas'); t.width = w; t.height = h;
  const x = t.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(c, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, g = new Uint8Array(w * h); for (let i = 0; i < g.length; i++) g[i] = d[i * 4 + 1];
  t.width = 0; t.height = 0;
  return { g, w, h };
}
function sad(A, B, sx, sy, x0, y0, x1, y1) {
  let s = 0, n = 0;
  for (let y = y0; y < y1; y++) { const ay = y + sy; if (ay < 0 || ay >= A.h) continue; for (let x = x0; x < x1; x++) { const ax = x + sx; if (ax < 0 || ax >= A.w) continue; s += Math.abs(A.g[ay * A.w + ax] - B.g[y * B.w + x]); n++; } }
  return n > 1000 ? s / n : 1e9;
}
async function autoAlign() {
  if (!S.cur) {
    st('Open both drawings (Rev A and Rev B) first to auto-align.');
    if (window.rpToast) window.rpToast('Open both Base (A) and Revised (B) drawings first to run Auto-Align.');
    return;
  }
  busy(true); st('Aligning...'); await tick();
  let a = null, b = null;
  try {
    if (!S.A || !S.B) { st('Open both drawings (Rev A and Rev B) first to auto-align.'); return; }
    const sc = S.cur.dpi / 72; a = await render('A', S.n, sc); b = await render('B', S.n, sc); const f = 8, ga = grayOf(a.c, f), gb = grayOf(b.c, f);
    let best = 1e18, bx = 0, by = 0;
    for (let sy = -10; sy <= 10; sy++) for (let sx = -10; sx <= 10; sx++) { const s = sad(ga, gb, sx, sy, 0, 0, gb.w, gb.h); if (s < best) { best = s; bx = sx; by = sy; } }
    const A1 = grayOf(a.c, 1), B1 = grayOf(b.c, 1); let cx = 0, cy = 0, tw = 0;
    for (let y = 0; y < gb.h; y++) for (let x = 0; x < gb.w; x++) { const w = 255 - gb.g[y * gb.w + x]; cx += x * w; cy += y * w; tw += w; }
    cx = tw ? Math.round(cx / tw * f) : B1.w >> 1; cy = tw ? Math.round(cy / tw * f) : B1.h >> 1;
    const x0 = Math.max(0, cx - 500), x1 = Math.min(B1.w, cx + 500), y0 = Math.max(0, cy - 500), y1 = Math.min(B1.h, cy + 500);
    best = 1e18; let fx = bx * f, fy = by * f;
    for (let sy = by * f - 9; sy <= by * f + 9; sy++) for (let sx = bx * f - 9; sx <= bx * f + 9; sx++) { const s = sad(A1, B1, sx, sy, x0, y0, x1, y1); if (s < best) { best = s; fx = sx; fy = sy; } }
    if (window.rpPushCompareHistory) window.rpPushCompareHistory('Auto-align'); $('#dx').value = fx; $('#dy').value = fy; if ($('#rp-cur-dx')) $('#rp-cur-dx').textContent = String(fx); if ($('#rp-cur-dy')) $('#rp-cur-dy').textContent = String(fy); st('Aligned: B shifted by ' + fx + ', ' + fy + ' px'); if (window.rpToast) window.rpToast(`Auto-Aligned: Rev B shifted by (${fx}, ${fy}) px.`); redo();
  } finally {
    if (a && a.c) { a.c.width = 0; a.c.height = 0; }
    if (b && b.c) { b.c.width = 0; b.c.height = 0; }
    busy(false);
  }
}
$('#align').onclick = autoAlign;

// export
async function dl(blob, name, filters) {
  if (window.native) { const bytes = new Uint8Array(await blob.arrayBuffer()); const p = await window.native.saveFile({ name, bytes, filters }); if (p) st('Saved ' + p); return p; }
}
function savePng() {
  if (!S.cur && !($('#cv') && $('#cv').width)) return st('Compare two PDFs first.');
  const t = document.createElement('canvas'); t.width = $('#cv').width; t.height = $('#cv').height;
  const x = t.getContext('2d'); x.drawImage($('#cv'), 0, 0);
  if ($('#mk') && $('#mk').width) x.drawImage($('#mk'), 0, 0);
  if ($('#rp-ov') && $('#rp-ov').width) x.drawImage($('#rp-ov'), 0, 0);
  t.toBlob(b => { t.width = 0; t.height = 0; dl(b, 'redline_page' + (S.n || 1) + '.png', [{ name: 'PNG', extensions: ['png'] }]); });
}
function saveCsv() {
  if (!S.cur) return st('Compare two PDFs first.'); let s = 'page,no,type,x_mils,y_mils,width_mils,height_mils,x_mm,y_mm,width_mm,height_mm,reviewed\n';
  const pages = Object.keys(S.scan).length ? S.scan : { [S.cur.n]: S.cur.regions };
  for (const n in pages) pages[n].forEach((g, i) => s += [n, i + 1, (KIND[g.kind] || KIND.c)[0], mils(g.x, g.dpi), mils(g.y, g.dpi), mils(g.w, g.dpi), mils(g.h, g.dpi), mm(g.x, g.dpi), mm(g.y, g.dpi), mm(g.w, g.dpi), mm(g.h, g.dpi), S.done[n + ':' + i] ? 'yes' : 'no'].join(',') + '\n');
  dl(new Blob(['\ufeff' + s], { type: 'text/csv' }), 'redline_differences.csv', [{ name: 'CSV', extensions: ['csv'] }]);
}
$('#png').onclick = savePng; $('#csv').onclick = saveCsv;

const cleanPdfStr = s => String(s ?? '')
  .replace(/[ΩΩ]/g, 'Ohm')
  .replace(/[µμ]/g, 'u')
  .replace(/Δ/g, 'Delta ')
  .replace(/⌀/g, 'Dia.')
  .replace(/±/g, '+/-')
  .replace(/°/g, ' deg')
  .replace(/×/g, 'x')
  .replace(/[—–]/g, '-')
  .replace(/≤/g, '<=')
  .replace(/≥/g, '>=')
  .replace(/✓/g, 'OK')
  .replace(/✗/g, 'X')
  .replace(/→/g, '->')
  .replace(/↔/g, '<->')
  .replace(/[^\x20-\xff]/g, '?');

async function exportReport() {
  if (!S.A || !S.B) return st('Open both PDFs first.'); busy(true);
  try {
    const { PDFDocument, StandardFonts, rgb } = PDFLib, doc = await PDFDocument.create(), F = await doc.embedFont(StandardFonts.Helvetica), FB = await doc.embedFont(StandardFonts.HelveticaBold), N = Math.max(S.A.numPages, S.B.numPages), items = [];
    for (let n = 1; n <= N; n++) {
      st('Report: page ' + n + ' of ' + N + '...'); await tick(); const r = await analyze(n);
      if (!r.regions.length && !r.rm.length && !r.ad.length) { items.push({ n, regions: [], rm: [], ad: [] }); continue; }
      const c = document.createElement('canvas'); c.width = r.W; c.height = r.H; const x = c.getContext('2d'); x.putImageData(overlayData(r, 'paper'), 0, 0);
      const lw = Math.max(3, r.W / 700); x.lineWidth = lw; x.font = `bold ${Math.round(lw * 6)}px sans-serif`; x.textBaseline = 'top';
      r.regions.forEach((g, i) => { x.strokeStyle = '#ff8a00'; x.strokeRect(g.x, g.y, g.w, g.h); const t = String(i + 1), tw = x.measureText(t).width + lw * 3, by = g.y >= lw * 7 ? g.y - lw * 7 : g.y; x.fillStyle = '#ff8a00'; x.fillRect(g.x, by, tw, lw * 7); x.fillStyle = '#fff'; x.fillText(t, g.x + lw * 1.5, by + lw * 0.5); });
      if (window.RP_MEASURE) {
        const rm = window.RP_MEASURE;
        if (rm.renderSingleAnnotation && Array.isArray(rm.annotations)) {
          rm.annotations.filter(a => a.page == null || a.page === n).forEach(a => rm.renderSingleAnnotation(x, a, 1));
        }
        if (rm.tally && Array.isArray(rm.tally.items) && rm.tally.items.length) {
          rm.tally.drawBadges(x, n, 1);
        }
      }
      const k = Math.min(1, 2200 / c.width), o = document.createElement('canvas'); o.width = Math.round(c.width * k); o.height = Math.round(c.height * k); o.getContext('2d').drawImage(c, 0, 0, o.width, o.height);
      const iw = o.width, ih = o.height;
      const blob = await new Promise(res => o.toBlob(res, 'image/jpeg', .85));
      c.width = 0; c.height = 0; o.width = 0; o.height = 0;
      if (r && r !== S.cur) { r.A = null; r.B = null; r.cls = null; }
      items.push({ n, regions: r.regions, rm: r.rm, ad: r.ad, jpg: new Uint8Array(await blob.arrayBuffer()), iw, ih, dpi: r.dpi });
    }
    const uLbl = fmtUnitName();
    const PW = 842, PH = 595, M = 30;
    const allPages = [];
    const txt = (p, t, x, y, s, f = F, col = rgb(.1, .1, .1)) => p.drawText(cleanPdfStr(t), { x, y, size: s, font: f, color: col });
    const makePage = (subtitle = 'ENGINEERING DRAWING COMPARISON REPORT') => {
      const pg = doc.addPage([PW, PH]);
      allPages.push(pg);
      pg.drawRectangle({ x: 0, y: PH - 48, width: PW, height: 48, color: rgb(0.05, 0.13, 0.22) });
      pg.drawRectangle({ x: 0, y: PH - 51, width: PW, height: 3, color: rgb(0.9, 0.22, 0.22) });
      txt(pg, `REDLINE PRO 1.0 — ${subtitle}`, M, PH - 30, 13, FB, rgb(1, 1, 1));
      txt(pg, 'Redline Studio · textportdocx.in', PW - 195, PH - 29, 9, F, rgb(0.75, 0.88, 1));
      return pg;
    };

    let p = makePage('EXECUTIVE COMPARISON SUMMARY');
    txt(p, 'Base Drawing (Rev A): ' + (S.names.A || 'Rev_A.pdf'), M, PH - 74, 10.5, FB);
    txt(p, 'Revised Drawing (Rev B): ' + (S.names.B || 'Rev_B.pdf'), M + 400, PH - 74, 10.5, FB);
    txt(p, 'Date: ' + new Date().toLocaleString() + '    Quality: ' + $('#dpi').value + ' dpi    Tolerance: ' + $('#tol').value + '    Units: ' + (isEnglishUnits() ? 'IPC English (mils)' : 'IPC Metric (mm)'), M, PH - 92, 9.5, F, rgb(.3, .3, .3));
    const total = items.reduce((s, i) => s + i.regions.length, 0), bad = items.filter(i => i.regions.length).length;
    const totalReviewed = items.reduce((s, it) => s + it.regions.filter((g, i) => S.done[it.n + ':' + i]).length, 0);
    p.drawRectangle({ x: M, y: PH - 134, width: PW - 2 * M, height: 30, color: rgb(0.95, 0.97, 0.99), borderColor: rgb(0.8, 0.85, 0.9), borderWidth: 1 });
    txt(p, `Summary: ${total} total differences across ${bad} of ${N} pages   |   Reviewed: ${totalReviewed} of ${total}   |   Status: ${total === 0 ? 'IDENTICAL' : (totalReviewed === total ? 'ALL VERIFIED' : 'IN REVIEW')}`, M + 12, PH - 123, 11, FB, rgb(0.08, 0.18, 0.28));

    let y = PH - 160;
    p.drawRectangle({ x: M, y: y - 4, width: PW - 2 * M, height: 18, color: rgb(0.08, 0.18, 0.28) });
    txt(p, 'Sheet / Page', M + 8, y, 9.5, FB, rgb(1, 1, 1));
    txt(p, 'Detected Differences', M + 120, y, 9.5, FB, rgb(1, 1, 1));
    txt(p, 'Reviewed Status', M + 280, y, 9.5, FB, rgb(1, 1, 1));
    y -= 18;
    for (const it of items) {
      if (y < 60) { p = makePage('EXECUTIVE COMPARISON SUMMARY (CONT.)'); y = PH - 75; }
      const rv = it.regions.filter((g, i) => S.done[it.n + ':' + i]).length;
      txt(p, `Page ${it.n}`, M + 8, y, 9.5);
      txt(p, it.regions.length ? `${it.regions.length} difference(s)` : 'No differences (Identical)', M + 120, y, 9.5, F, it.regions.length ? rgb(.75, .1, .1) : rgb(.1, .5, .2));
      txt(p, it.regions.length ? `${rv} of ${it.regions.length} reviewed` : 'Verified', M + 280, y, 9.5);
      y -= 15;
    }

    for (const it of items.filter(i => i.jpg)) {
      p = makePage(`SHEET ${it.n}: VISUAL REDLINE OVERLAY (${it.regions.length} DIFFS)`);
      const img = await doc.embedJpg(it.jpg), aw = PW - 2 * M, ah = PH - 105, k = Math.min(aw / it.iw, ah / it.ih);
      p.drawImage(img, { x: M + (aw - it.iw * k) / 2, y: PH - 62 - it.ih * k, width: it.iw * k, height: it.ih * k });
      p.drawRectangle({ x: M + (aw - it.iw * k) / 2, y: PH - 62 - it.ih * k, width: it.iw * k, height: it.ih * k, borderColor: rgb(0.75, 0.8, 0.85), borderWidth: 1 });

      let yy = 0, pg = null;
      const head = () => {
        pg = makePage(`SHEET ${it.n}: ITEMIZED DIFFERENCE SCHEDULE & SIGN-OFF`);
        pg.drawRectangle({ x: M, y: PH - 82, width: PW - 2 * M, height: 18, color: rgb(0.08, 0.18, 0.28) });
        txt(pg, 'ID', M + 8, PH - 77, 9, FB, rgb(1, 1, 1));
        txt(pg, 'Class', M + 55, PH - 77, 9, FB, rgb(1, 1, 1));
        txt(pg, `Dimensions (${uLbl})`, M + 145, PH - 77, 9, FB, rgb(1, 1, 1));
        txt(pg, `Coordinates (${uLbl})`, M + 275, PH - 77, 9, FB, rgb(1, 1, 1));
        txt(pg, 'Reviewed', M + 415, PH - 77, 9, FB, rgb(1, 1, 1));
        yy = PH - 96;
      };
      if (it.regions.length) head();
      it.regions.forEach((g, i) => {
        if (yy < 155) head();
        if (i % 2 === 1) pg.drawRectangle({ x: M, y: yy - 3, width: PW - 2 * M, height: 13, color: rgb(0.96, 0.98, 0.99) });
        txt(pg, `#${i + 1}`, M + 8, yy, 9);
        txt(pg, (KIND[g.kind] || KIND.c)[0], M + 55, yy, 9, FB, g.kind === 'a' ? rgb(0, .5, .2) : rgb(.75, .1, .1));
        txt(pg, fmtUnitVal(g.w, it.dpi) + ' x ' + fmtUnitVal(g.h, it.dpi) + ' ' + uLbl, M + 145, yy, 9);
        txt(pg, '(' + fmtUnitVal(g.x, it.dpi) + ', ' + fmtUnitVal(g.y, it.dpi) + ') ' + uLbl, M + 275, yy, 9);
        txt(pg, S.done[it.n + ':' + i] ? 'Yes (Approved)' : 'Open', M + 415, yy, 9);
        yy -= 13;
      });
      if (it.rm.length || it.ad.length) {
        if (!pg || yy < 165) head();
        yy -= 8;
        txt(pg, 'Text only in A: ' + it.rm.slice(0, 20).join(', '), M, yy, 9, F, rgb(.75, .1, .1));
        yy -= 13;
        txt(pg, 'Text only in B: ' + it.ad.slice(0, 20).join(', '), M, yy, 9, F, rgb(0, .5, .2));
      }
    }

    // Add Professional Engineering QA Sign-Off & Release Block on the Final Page
    let lastPg = allPages[allPages.length - 1];
    if (y < 148 && allPages.length === 1) {
      lastPg = makePage('OFFICIAL ENGINEERING QUALITY ASSURANCE & SIGN-OFF');
    }
    const reviewer = getSafeAuthor('Lead Review Engineer');
    const docHash = (window.RP_MEASURE && window.RP_MEASURE.docHash) || 'A3F8E902B1764D5C';
    lastPg.drawRectangle({ x: M, y: 40, width: PW - 2 * M, height: 92, color: rgb(0.96, 0.98, 1.0), borderColor: rgb(0.1, 0.22, 0.36), borderWidth: 1.2 });
    lastPg.drawRectangle({ x: M, y: 114, width: PW - 2 * M, height: 18, color: rgb(0.08, 0.18, 0.28) });
    txt(lastPg, 'OFFICIAL ENGINEERING QUALITY ASSURANCE & REVISION RELEASE SIGN-OFF', M + 10, 119, 9, FB, rgb(1, 1, 1));
    txt(lastPg, `Reviewer: ${reviewer}   |   Units: ${isEnglishUnits() ? 'IPC English (mils/in)' : 'IPC Metric (mm)'}   |   SHA-256 Checksum: ${docHash}`, M + 12, 96, 9, FB, rgb(0.1, 0.15, 0.2));
    txt(lastPg, `Total Differences: ${total}   |   Verified/Reviewed: ${totalReviewed}   |   Final Disposition: ${total === 0 || totalReviewed === total ? 'APPROVED & VERIFIED' : 'PENDING ENGINEERING REVIEW'}`, M + 12, 80, 9, F, rgb(0.2, 0.25, 0.3));
    lastPg.drawLine({ start: { x: M + 12, y: 54 }, end: { x: M + 320, y: 54 }, thickness: 0.8, color: rgb(0.3, 0.35, 0.4) });
    txt(lastPg, 'Authorized Engineering Signature', M + 12, 44, 7.5, F, rgb(0.4, 0.45, 0.5));
    lastPg.drawLine({ start: { x: M + 380, y: 54 }, end: { x: PW - M - 20, y: 54 }, thickness: 0.8, color: rgb(0.3, 0.35, 0.4) });
    txt(lastPg, 'Quality Assurance Approval Date & Stamp', M + 380, 44, 7.5, F, rgb(0.4, 0.45, 0.5));

    // Footer bar & page numbering on all pages
    allPages.forEach((pgItem, idx) => {
      pgItem.drawLine({ start: { x: M, y: 28 }, end: { x: PW - M, y: 28 }, thickness: 0.6, color: rgb(0.8, 0.82, 0.85) });
      txt(pgItem, 'Redline Pro 1.0 Enterprise · Redline Studio (textportdocx.in) · Precision Engineering & CAM Verification', M, 15, 8, F, rgb(0.45, 0.48, 0.52));
      txt(pgItem, `Page ${idx + 1} of ${allPages.length}`, PW - M - 65, 15, 8.5, FB, rgb(0.2, 0.25, 0.3));
    });

    const bytes = await doc.save(); const pth = await window.native.saveFile({ name: 'comparison_report.pdf', bytes, filters: [{ name: 'PDF', extensions: ['pdf'] }] }); if (pth) st('Report saved: ' + pth); else st('Report cancelled');
  } catch (e) { st('Could not make the report: ' + (e.message || e)); } finally { busy(false); }
}
$('#report').onclick = exportReport;

Object.assign(ACT, { openA: () => pickCompare('A'), openB: () => pickCompare('B'), swap: () => $('#swap').click(), align: autoAlign, nextDiff: () => nextDiff(1), prevDiff: () => nextDiff(-1), markAll: () => $('#markAll').click(), rescan: () => S.A && S.B && start(), ignore: () => $('#ignBtn').click(), report: exportReport, savePng, saveCsv, cFit: fit, cZoomIn: () => zoomBy(1.25), cZoomOut: () => zoomBy(1 / 1.25) });
function setView(v) {
  closeCtx();
  if (v !== 'edit' && window.RE && window.RE.E && window.RE.E.inlineText && window.RE.commitInlineTextEditor) {
    window.RE.commitInlineTextEditor();
  }
  document.body.dataset.view = v; $('#view-compare').hidden = v !== 'compare'; $('#view-edit').hidden = v !== 'edit';
  document.querySelectorAll('#modes button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  if (v === 'compare' && S.cur) setTimeout(fit, 30); if (v === 'edit' && window.editorShown) window.editorShown(); if (window.updateTitle) window.updateTitle();
}
window.setView = setView;
document.querySelectorAll('#modes button').forEach(b => b.onclick = () => setView(b.dataset.v));
if (typeof ResizeObserver !== 'undefined' && $('#vp')) {
  let vpLastW = 0, vpLastH = 0;
  new ResizeObserver(entries => {
    for (const en of entries) {
      const w = Math.round(en.contentRect.width), h = Math.round(en.contentRect.height);
      if (w > 0 && h > 0 && (Math.abs(w - vpLastW) > 1 || Math.abs(h - vpLastH) > 1)) {
        const isInitial = (vpLastW === 0 || vpLastH === 0);
        const dw = vpLastW > 0 ? (w - vpLastW) : 0;
        const dh = vpLastH > 0 ? (h - vpLastH) : 0;
        vpLastW = w; vpLastH = h;
        if (document.body.dataset.view === 'compare' && $('#cv') && $('#cv').width > 0 && (S.cur || S.A || S.B) && $('#empty') && $('#empty').hidden) {
          if (!S.view || !S.view.k || isInitial) {
            fit();
          } else {
            // Preserve current zoom S.view.k and smoothly keep drawing centered!
            S.view.x = Math.round(S.view.x + dw / 2);
            S.view.y = Math.round(S.view.y + dh / 2);
            applyView();
            markers();
          }
          if (window.rpSharpen) setTimeout(window.rpSharpen, 80);
        }
      }
    }
  }).observe($('#vp'));
}
const NPAGES = () => Math.max(S.A ? S.A.numPages : 0, S.B ? S.B.numPages : 0), MODES = ['paper', 'over', 'diff', 'side', 'blink', 'A', 'B'];
Object.assign(ACT, {
  cGoto: n => { const N = NPAGES(); if (N) show(Math.max(1, Math.min(N, n))); }, cPage: d => ACT.cGoto(S.n + d), cFirst: () => ACT.cGoto(1), cLast: () => ACT.cGoto(NPAGES()),
  cMode: i => { if (window.UIRibbon && window.UIRibbon.setCompareMode) window.UIRibbon.setCompareMode(MODES[i]); else { if (window.UIRibbon && window.UIRibbon.setCurtainMode) window.UIRibbon.setCurtainMode(false); const s = $('#mode'); s.value = MODES[i]; s.dispatchEvent(new Event('change')); } }, toggleMarkers: () => { $('#lM').checked = !$('#lM').checked; $('#lM').dispatchEvent(new Event('change')); },
  toggleReviewed: () => { if (S.cur && S.sel >= 0) { const k = S.cur.n + ':' + S.sel; S.done[k] = !S.done[k]; if (window.UIRibbon && window.UIRibbon.DefectState) window.UIRibbon.DefectState.setStatusByRegion(S.sel, S.done[k] ? 'Approved' : 'Open'); renderList(); markers(); } },
  delIgnoreSel: () => { if (S.igSel) delIgnore(S.igSel); }, hasIgnoreSel: () => !!S.igSel,
  cEscape: () => {
    closeCtx();
    if (window.RP_MEASURE && window.RP_MEASURE.activeTool && window.rpSetActiveTool) window.rpSetActiveTool(null);
    if (window.UIRibbon && window.UIRibbon.FiducialAligner && window.UIRibbon.FiducialAligner.active) {
      window.UIRibbon.FiducialAligner.active = false;
      const fm = $('#fiducial-modal'); if (fm) fm.hidden = true;
      if (window.rpRedrawOverlay) window.rpRedrawOverlay();
    }
    if (S.ignMode) $('#ignBtn').click();
    else if (S.igSel || S.sel >= 0) { S.igSel = null; S.sel = -1; markers(); }
  },
  cUndo: () => window.CompareHistory && window.CompareHistory.undo(), cRedo: () => window.CompareHistory && window.CompareHistory.redo(),
  cGotoDialog: async () => { const N = NPAGES(); if (!N) return; const r = await window.dialog('Go to page', [{ type: 'number', id: 'n', label: 'Page (1-' + N + ')', value: S.n, min: 1, max: N }], 'Go'); if (r) ACT.cGoto(r.n); }
});
hydrateIcons(); setLabel('A'); setLabel('B');
