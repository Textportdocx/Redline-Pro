(() => {
const { PDFDocument, StandardFonts, rgb, degrees, LineCapStyle, PDFName, PDFString, PDFHexString, PDFArray, PDFDict, PDFRef } = PDFLib;
const $ = s => document.querySelector(s);
const E = {
  bytes: null, doc: null, n: 0, cur: 0, zoom: 1, tool: 'select',
  ann: {}, annUndo: [], annRedo: [], clip: null,
  sel: null, hist: [], name: 'document.pdf', pages: new Set(),
  vp: null, img: null, tmp: null, polyPts: [], drag: null, pan: null, erasing: false,
  eraserMode: 'object', eraserCur: null, nextPinNum: 1, toolSettings: {},
  tok: 0, comments: [], selC: null, d: 1, stamp: null, path: null, savedBytes: null,
  redo: [], meas: {}, confirmed: false, customFonts: {}
};
Object.defineProperty(E, 'E', { get: () => E, enumerable: false });
const F = { q: '', hits: [], i: -1, run: 0 };
const st = t => { const el = $('#est'); if (el) el.textContent = t; };
const LOAD = { updateMetadata: false };
const clampEdZoom = z => Math.max(0.05, Math.min(64.0, Number.isFinite(z) && z > 0 ? z : 1.0));
const K = () => clampEdZoom(E.zoom) * 4 / 3, DPR = () => Math.max(1, window.devicePixelRatio || 1);
const BASE = 0.85; // text baseline offset in em
const hexRgb = h => {
  h = String(h || '#000000'); if (/^#[0-9a-f]{3}$/i.test(h)) h = '#' + [...h.slice(1)].map(c => c + c).join('');
  if (!/^#[0-9a-f]{6}$/i.test(h)) h = '#000000';
  return rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
};
const baseName = () => E.name.replace(/\.pdf$/i, '');
function safeText(font, s) { let o = ''; for (const ch of String(s)) { if (ch === '\n') { o += ch; continue; } try { font.encodeText(ch); o += ch; } catch (e) { o += '?'; } } return o; }
function canEncodeAll(font, s) {
  for (const ch of String(s || '')) {
    if (ch === '\n' || ch === '\r') continue;
    try { font.encodeText(ch); } catch (e) { return false; }
  }
  return true;
}

// ---------- Rich Font Catalog & CSS Stack Resolver ----------
const FONT_STACKS = {
  'Helvetica': 'Helvetica, Arial, "Liberation Sans", sans-serif',
  'Arial': 'Arial, Helvetica, sans-serif',
  'Segoe UI': '"Segoe UI", system-ui, -apple-system, sans-serif',
  'Calibri': 'Calibri, Candara, "Segoe UI", Optima, sans-serif',
  'Verdana': 'Verdana, Geneva, sans-serif',
  'Tahoma': 'Tahoma, Geneva, Verdana, sans-serif',
  'Trebuchet MS': '"Trebuchet MS", "Lucida Grande", sans-serif',
  'Impact': 'Impact, Haettenschweiler, "Arial Black", sans-serif',
  'Times': '"Times New Roman", Times, Georgia, serif',
  'Georgia': 'Georgia, "Times New Roman", Times, serif',
  'Garamond': 'Garamond, Baskerville, "Times New Roman", serif',
  'Cambria': 'Cambria, Georgia, serif',
  'Palatino': '"Palatino Linotype", "Book Antiqua", Palatino, serif',
  'Courier': '"Courier New", Courier, monospace',
  'Consolas': 'Consolas, "Liberation Mono", Menlo, Courier, monospace',
  'Lucida Console': '"Lucida Console", Monaco, Consolas, monospace',
  'Brush Script MT': '"Brush Script MT", "Segoe Script", cursive',
  'Comic Sans MS': '"Comic Sans MS", "Chalkboard SE", cursive'
};
const cssFam = f => {
  if (!f) return FONT_STACKS.Helvetica;
  if (FONT_STACKS[f]) return FONT_STACKS[f];
  return `"${String(f).replace(/"/g, '')}", Helvetica, Arial, sans-serif`;
};
function getFontOptionsList() {
  const base = [
    { label: 'Helvetica (Standard Sans)', value: 'Helvetica' },
    { label: 'Arial', value: 'Arial' },
    { label: 'Segoe UI', value: 'Segoe UI' },
    { label: 'Calibri', value: 'Calibri' },
    { label: 'Verdana', value: 'Verdana' },
    { label: 'Tahoma', value: 'Tahoma' },
    { label: 'Trebuchet MS', value: 'Trebuchet MS' },
    { label: 'Impact (Headline)', value: 'Impact' },
    { label: 'Times New Roman (Standard Serif)', value: 'Times' },
    { label: 'Georgia', value: 'Georgia' },
    { label: 'Garamond', value: 'Garamond' },
    { label: 'Cambria', value: 'Cambria' },
    { label: 'Palatino Linotype', value: 'Palatino' },
    { label: 'Courier New (Standard Mono)', value: 'Courier' },
    { label: 'Consolas (Technical Mono)', value: 'Consolas' },
    { label: 'Lucida Console (CAD Mono)', value: 'Lucida Console' },
    { label: 'Brush Script (Signature)', value: 'Brush Script MT' },
    { label: 'Comic Sans MS', value: 'Comic Sans MS' }
  ];
  for (const customName of Object.keys(E.customFonts || {})) {
    base.push({ label: `${customName} (Custom Loaded Font)`, value: customName });
  }
  return base;
}

async function loadCustomFontFile() {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.ttf,.otf,.woff,.woff2';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    try {
      const rawName = f.name.replace(/\.(ttf|otf|woff2?)$/i, '').replace(/[-_]+/g, ' ').trim() || 'CustomFont';
      const buf = await f.arrayBuffer();
      if (typeof FontFace !== 'undefined') {
        const face = new FontFace(rawName, buf);
        await face.load();
        document.fonts.add(face);
      }
      E.customFonts[rawName] = new Uint8Array(buf);
      const grp = $('#eCustomFontGroup');
      const sel = $('#eFontFam');
      if (sel) {
        if (grp) {
          grp.hidden = false;
          if (![...grp.options].some(o => o.value === rawName)) {
            grp.appendChild(new Option(`${rawName} (Custom)`, rawName));
          }
        } else {
          sel.add(new Option(`${rawName} (Custom)`, rawName));
        }
        sel.value = rawName;
      }
      if (E.sel && E.sel.t === 'text') {
        pushAnnState('Change font family');
        E.sel.fam = rawName;
        overlay();
      }
      st(`Loaded custom font "${rawName}" — ready for text annotations!`);
      if (window.rpToast) window.rpToast(`Loaded custom font: ${rawName}`);
    } catch (err) {
      st('Could not load font file: ' + (err.message || err));
    }
  };
  inp.click();
}

// ---------- Snapshot-Based Annotation Undo / Redo ----------
function cloneAnns(map) {
  const out = {};
  for (const k of Object.keys(map || {})) {
    out[k] = (map[k] || []).map(a => ({
      ...a,
      _loadingImg: false,
      pts: a.pts ? a.pts.map(p => [...p]) : undefined
    }));
  }
  return out;
}
function pushAnnState(label = 'Edit annotation') {
  E.annUndo.push({
    label,
    ann: cloneAnns(E.ann),
    meas: cloneAnns(E.meas)
  });
  if (E.annUndo.length > 40) E.annUndo.shift();
  E.annRedo = [];
}

function updateDocInspector() {
  const nm = $('#eInfoName'), sub = $('#eInfoSub'), dim = $('#eInfoDim'), pgs = $('#eInfoPages'), sz = $('#eInfoSize'), an = $('#eInfoAnnots');
  if (!nm) return;
  if (!E.bytes || !E.doc) {
    nm.textContent = 'No Document Loaded';
    if (sub) sub.textContent = 'Open or drop a PDF to inspect';
    if (dim) dim.textContent = '—';
    if (pgs) pgs.textContent = '0';
    if (sz) sz.textContent = '—';
    if (an) an.textContent = '0';
    return;
  }
  nm.textContent = E.name || 'document.pdf';
  const kb = E.bytes.length / 1024;
  const sizeStr = kb >= 1024 ? (kb / 1024).toFixed(2) + ' MB' : kb.toFixed(0) + ' KB';
  if (sub) sub.textContent = E.path ? String(E.path) : 'In-Memory Studio Buffer';
  if (pgs) pgs.textContent = String(E.n);
  if (sz) sz.textContent = sizeStr;
  const drawnCount = Object.values(E.ann).reduce((acc, l) => acc + (l ? l.length : 0), 0);
  const measCount = Object.values(E.meas).reduce((acc, l) => acc + (l ? l.length : 0), 0);
  const commCount = (E.comments || []).filter(c => !c.irt).length;
  if (an) an.textContent = String(drawnCount + measCount + commCount);
  if (dim && E.vp) {
    const wMm = (E.vp.width * 25.4 / 72).toFixed(0), hMm = (E.vp.height * 25.4 / 72).toFixed(0);
    const wIn = (E.vp.width / 72).toFixed(1), hIn = (E.vp.height / 72).toFixed(1);
    dim.textContent = `${wMm}×${hMm} mm (${wIn}×${hIn}")`;
  }
}

function syncHudBar() {
  const hud = $('#e-floating-hud');
  if (hud) hud.hidden = !E.doc;
  const lbl = $('#eHudPageLabel');
  if (lbl) lbl.textContent = `Page ${E.n ? E.cur + 1 : 0} / ${E.n || 0}`;
  const zp = $('#eZoomPreset');
  if (zp) {
    if (E.fitMode === 'page') zp.value = 'page';
    else if (E.fitMode === 'width') zp.value = 'width';
    else {
      const zStr = String(Math.round(E.zoom * 100) / 100);
      if ([...zp.options].some(o => o.value === zStr)) zp.value = zStr;
    }
  }
  if ($('#eHudSelect')) $('#eHudSelect').classList.toggle('on', E.tool === 'select');
  if ($('#eHudHand')) $('#eHudHand').classList.toggle('on', E.tool === 'hand');
  if ($('#eHudMeasure')) $('#eHudMeasure').classList.toggle('on', E.tool === 'measure');
}

// ---------- dialog (with Engineering Symbol Bar support) ----------
const ENG_SYMBOLS = ['Ω', 'µ', '±', '⌀', '°', 'Δ', '≤', '≥', '×', '÷', '✓', '✗', '©', '®', '™', '→'];
function dialog(title, fields, ok = 'OK') {
  return new Promise(res => {
    $('#dT').textContent = title; const box = $('#dB'); box.innerHTML = ''; const els = {};
    let lastTextEl = null;
    fields.forEach(d => {
      if (d.type === 'html') { const p = document.createElement('div'); p.innerHTML = d.label; box.append(p); return; }
      if (d.type === 'note') { const p = document.createElement('div'); p.className = 'nt'; p.textContent = d.label; box.append(p); return; }
      if (d.type === 'symbols') {
        const bar = document.createElement('div');
        bar.className = 'rp-sym-bar';
        bar.innerHTML = `<small style="color:var(--mute2);margin-right:4px">Insert Symbol:</small>` + ENG_SYMBOLS.map(sym => `<button type="button" class="rp-sym-btn" data-sym="${sym}">${sym}</button>`).join('');
        bar.querySelectorAll('.rp-sym-btn').forEach(btn => {
          btn.onclick = () => {
            const target = lastTextEl || box.querySelector('textarea,input[type=text]');
            if (!target) return;
            const s0 = target.selectionStart ?? target.value.length;
            const s1 = target.selectionEnd ?? target.value.length;
            target.value = target.value.slice(0, s0) + btn.dataset.sym + target.value.slice(s1);
            target.focus();
            target.selectionStart = target.selectionEnd = s0 + btn.dataset.sym.length;
          };
        });
        box.append(bar);
        return;
      }
      const l = document.createElement('label'); l.className = 'fl'; l.append(d.label); let el;
      if (d.type === 'select') {
        el = document.createElement('select');
        d.options.forEach(o => el.add(new Option(o.label || o, o.value ?? o)));
        el.value = d.value ?? el.options[0].value;
      } else if (d.type === 'textarea') {
        el = document.createElement('textarea'); el.rows = d.rows || 4; el.value = d.value || '';
        l.style.flexDirection = 'column'; l.style.alignItems = 'stretch';
        lastTextEl = el;
      } else if (d.type === 'pad') {
        el = makePad(); l.style.flexDirection = 'column'; l.style.alignItems = 'stretch';
      } else {
        el = document.createElement('input'); el.type = d.type || 'text';
        if (el.type === 'checkbox') el.checked = !!d.value; else el.value = d.value ?? '';
        if (d.min != null) el.min = d.min; if (d.max != null) el.max = d.max;
        if (el.type === 'text') lastTextEl = el;
      }
      els[d.id] = { el, d }; l.append(el); box.append(l);
    });
    $('#dO').textContent = ok; $('#dlg').hidden = false;
    const first = box.querySelector('input,textarea,select'); if (first) first.focus();
    const done = v => {
      box.querySelectorAll('canvas').forEach(cv => { cv.width = 0; cv.height = 0; });
      box.innerHTML = '';
      $('#dlg').hidden = true; $('#dF').onsubmit = null; $('#dC').onclick = null; res(v);
    };
    $('#dC').onclick = () => done(null);
    $('#dF').onsubmit = ev => {
      ev.preventDefault(); const out = {};
      for (const id in els) { const { el, d } = els[id]; out[id] = d.type === 'checkbox' ? el.checked : d.type === 'number' ? +el.value : d.type === 'pad' ? el.getData() : el.value; }
      done(out);
    };
  });
}
function makePad() {
  const c = document.createElement('canvas'); c.width = 400; c.height = 150; c.className = 'pad'; const x = c.getContext('2d');
  x.lineWidth = 3; x.lineCap = 'round'; x.strokeStyle = '#111'; let down = false, b = null;
  const pt = e => [e.offsetX * c.width / c.clientWidth, e.offsetY * c.height / c.clientHeight];
  c.onpointerdown = e => { down = true; c.setPointerCapture(e.pointerId); const [px, py] = pt(e); x.beginPath(); x.moveTo(px, py); x.lineTo(px + .1, py); x.stroke(); };
  c.onpointermove = e => { if (!down) return; const [px, py] = pt(e); x.lineTo(px, py); x.stroke(); b = b ? [Math.min(b[0], px), Math.min(b[1], py), Math.max(b[2], px), Math.max(b[3], py)] : [px, py, px, py]; };
  c.onpointerup = () => down = false;
  c.getData = () => { if (!b) return null; const m = 6, x0 = Math.max(0, b[0] - m), y0 = Math.max(0, b[1] - m), w = Math.min(c.width, b[2] + m) - x0, h = Math.min(c.height, b[3] + m) - y0; const t = document.createElement('canvas'); t.width = w; t.height = h; t.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h); const url = t.toDataURL('image/png'); t.width = 0; t.height = 0; return url; };
  return c;
}

// ---------- document load / history ----------
async function reload(light) {
  const prevDoc = E.doc;
  const newDoc = await pdfjsLib.getDocument({ data: E.bytes.slice() }).promise;
  E.doc = newDoc;
  if (prevDoc && prevDoc !== newDoc) {
    if (E._renderTask && typeof E._renderTask.cancel === 'function') {
      try { E._renderTask.cancel(); } catch (e) {}
      E._renderTask = null;
    }
    if (typeof prevDoc.destroy === 'function') {
      try { await prevDoc.destroy(); } catch (e) {}
    }
  }
  E.n = E.doc.numPages;
  E.cur = Math.max(0, Math.min(E.cur, E.n - 1)); if (!light) { E.pages = new Set([E.cur]); E.sel = null; E.selC = null; }
  if (light) { try { E.comments = readComments(await PDFDocument.load(E.bytes, LOAD)); } catch (e) { E.comments = []; } renderComments(); }
  else { E.comments = []; renderComments(); const b = E.bytes; setTimeout(async () => { try { const c = readComments(await PDFDocument.load(b, LOAD)); if (b === E.bytes) { E.comments = c; renderComments(); overlay(); updateDocInspector(); } } catch (e) {} }, 60); }
  $('#eN').textContent = E.n; $('#esz').textContent = (E.bytes.length / 1024).toFixed(0) + ' KB · ' + E.n + ' page' + (E.n === 1 ? '' : 's');
  $('#eempty').hidden = true; $('#ewrap').hidden = false;
  if ($('#e-floating-hud')) $('#e-floating-hud').hidden = false;
  await Promise.all([light ? 0 : thumbs(), renderPage()]);
  updateDocInspector();
  syncHudBar();
}
async function openBytes(bytes, name, path, keepTab) {
  if (window.TABS && !keepTab) window.TABS.beforeOpen();
  window.busy(true);
  try {
    let u8 = bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(bytes);
    if (/\.(png|jpe?g|webp|bmp|gif)$/i.test(name || '') && window.imageBytesToPDF) {
      u8 = await window.imageBytesToPDF(u8, name);
      name = String(name).replace(/\.[^.]+$/, '') + '.pdf';
    }
    E.bytes = u8; E.name = name || 'document.pdf'; E.path = path || null; E.confirmed = false;
    E.hist = []; E.redo = []; E.ann = {}; E.annUndo = []; E.annRedo = []; E.meas = {};
    E.cur = 0; E.fitMode = 'page'; E.lastCur = -1; closeFind();
    await reload(); E.savedBytes = E.bytes; st('Opened ' + E.name); window.addRecent(E.name, path, null, E.bytes); if (window.updateTitle) window.updateTitle();
  } catch (e) {
    if (window.TABS && !keepTab && window.TABS.rollbackOpen) window.TABS.rollbackOpen();
    const isPasswordErr = !!(e && (e.name === 'PasswordException' || /password|encrypt/i.test(e.message || '')));
    if (isPasswordErr) {
      const encMsg = 'This document is password-protected or encrypted. Please decrypt or unlock the file before comparing or markup.';
      st(encMsg);
      if (window.showEncryptedPdfNotice) window.showEncryptedPdfNotice(name);
      else if (window.showToast) window.showToast(encMsg, 4500);
    } else {
      const msg = 'Could not open ' + name + ': ' + (e.message || 'invalid or encrypted PDF');
      st(msg);
      if (window.showToast) window.showToast(msg, 4000);
    }
    if (!E.doc) {
      E.bytes = null;
      if ($('#ewrap')) $('#ewrap').hidden = true;
      if ($('#eempty')) $('#eempty').hidden = false;
      if ($('#e-floating-hud')) $('#e-floating-hud').hidden = true;
    }
  }
  finally { window.busy(false); }
}
async function openFile(f) { if (f) openBytes(await f.arrayBuffer(), f.name, f.path); }
const push = () => { E.hist.push(E.bytes); if (E.hist.length > 15) E.hist.shift(); E.redo = []; };
async function edit(fn, msg) {
  if (!E.bytes) { st('Open a PDF first.'); return; }
  try {
    await commit(true);
    const doc = await PDFDocument.load(E.bytes, LOAD), out = (await fn(doc)) || doc, nb = await out.save();
    push(); E.bytes = nb; E.ann = {}; E.annUndo = []; E.annRedo = []; await reload(); if (msg) st(msg);
  } catch (e) { st('Error: ' + (e.message || e)); }
}
async function undo() {
  if (E.annUndo.length) {
    const snap = E.annUndo.pop();
    E.annRedo.push({ label: snap.label, ann: cloneAnns(E.ann), meas: cloneAnns(E.meas) });
    E.ann = snap.ann;
    E.meas = snap.meas;
    E.sel = null;
    overlay(); updateDocInspector(); st(`Undone: ${snap.label}`);
    return;
  }
  if (E.hist.length) { E.redo.push(E.bytes); E.bytes = E.hist.pop(); E.ann = {}; E.annUndo = []; await reload(); st('Undone page operation'); }
  else st('Nothing to undo');
}
async function redo() {
  if (E.annRedo.length) {
    const snap = E.annRedo.pop();
    E.annUndo.push({ label: snap.label, ann: cloneAnns(E.ann), meas: cloneAnns(E.meas) });
    E.ann = snap.ann;
    E.meas = snap.meas;
    E.sel = null;
    overlay(); updateDocInspector(); st(`Redone: ${snap.label}`);
    return;
  }
  if (E.redo.length) { E.hist.push(E.bytes); E.bytes = E.redo.pop(); E.ann = {}; E.annUndo = []; await reload(); st('Redone page operation'); }
  else st('Nothing to redo');
}

// ---------- annotations ----------
const _scratchCanvas = document.createElement('canvas');
const _scratchCtx = _scratchCanvas.getContext('2d');
function measureTextBox(a) {
  const c = _scratchCtx;
  const sz = a.size || 14;
  c.font = `${a.italic ? 'italic ' : ''}${a.bold ? 'bold ' : ''}${sz}px ${cssFam(a.fam)}`;
  const ls = String(a.text || '').split('\n');
  const maxW = Math.max(12, ...ls.map(l => c.measureText(l).width));
  const totalH = Math.max(sz * 1.2, ls.length * sz * 1.22);
  return [maxW, totalH, ls];
}

function applyDash(c, dash, lw, s) {
  if (dash === 'dashed') c.setLineDash([Math.max(5, lw * 3) * s, Math.max(3, lw * 2) * s]);
  else if (dash === 'dotted') c.setLineDash([Math.max(1.5, lw) * s, Math.max(3, lw * 2) * s]);
  else c.setLineDash([]);
}

function drawAnn(c, a, s) {
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  c.globalAlpha = a.op == null ? 1 : a.op;
  c.strokeStyle = c.fillStyle = a.color || '#000';
  const lw = a.size || 2;
  c.lineWidth = lw * s;
  applyDash(c, a.dash, lw, s);

  if (a._editingInline) { c.restore(); return; }
  switch (a.t) {
    case 'text': {
      c.setLineDash([]);
      const sz = a.size || 14;
      const [tw, th, ls] = measureTextBox(a);
      const pad = a.bgBox ? 5 : 0;
      if (a.bgBox) {
        c.save();
        c.fillStyle = a.bgColor || '#fffbeb';
        c.fillRect((a.x - pad) * s, (a.y - pad * 0.5) * s, (tw + pad * 2) * s, (th + pad) * s);
        c.strokeStyle = a.color || '#e11d48';
        c.lineWidth = 1.2 * s;
        c.strokeRect((a.x - pad) * s, (a.y - pad * 0.5) * s, (tw + pad * 2) * s, (th + pad) * s);
        c.restore();
      }
      c.font = `${a.italic ? 'italic ' : ''}${a.bold ? 'bold ' : ''}${sz * s}px ${cssFam(a.fam)}`;
      c.fillStyle = a.color || '#000';
      const align = a.align || 'left';
      ls.forEach((l, i) => {
        const lineW = c.measureText(l).width;
        const lx = align === 'center' ? (a.x * s + (tw * s - lineW) / 2) : align === 'right' ? (a.x * s + tw * s - lineW) : (a.x * s);
        const ly = (a.y + sz * (BASE + i * 1.22)) * s;
        c.fillText(l, lx, ly);
        if (a.underline) {
          c.beginPath();
          c.lineWidth = Math.max(1, sz * 0.07) * s;
          c.moveTo(lx, ly + sz * 0.12 * s);
          c.lineTo(lx + lineW, ly + sz * 0.12 * s);
          c.stroke();
        }
        if (a.strike) {
          c.beginPath();
          c.lineWidth = Math.max(1, sz * 0.07) * s;
          c.moveTo(lx, ly - sz * 0.3 * s);
          c.lineTo(lx + lineW, ly - sz * 0.3 * s);
          c.stroke();
        }
      });
      break;
    }
    case 'rect':
      if (a.fill) { c.save(); c.globalAlpha = (a.op == null ? 1 : a.op) * .28; c.fillStyle = a.bgColor || a.color; c.fillRect(a.x * s, a.y * s, a.w * s, a.h * s); c.restore(); }
      c.strokeRect(a.x * s, a.y * s, a.w * s, a.h * s);
      break;
    case 'circle': {
      const rx = Math.abs(a.w) / 2 * s, ry = Math.abs(a.h) / 2 * s;
      const cx = (a.x + a.w / 2) * s, cy = (a.y + a.h / 2) * s;
      c.beginPath();
      c.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
      if (a.fill) { c.save(); c.globalAlpha = (a.op == null ? 1 : a.op) * .28; c.fillStyle = a.bgColor || a.color; c.fill(); c.restore(); }
      c.stroke();
      break;
    }
    case 'poly': {
      if (!a.pts || a.pts.length < 2) break;
      c.beginPath();
      a.pts.forEach((p, i) => i ? c.lineTo(p[0] * s, p[1] * s) : c.moveTo(p[0] * s, p[1] * s));
      if (a.closed || a.fill) c.closePath();
      if (a.fill && a.pts.length >= 3) { c.save(); c.globalAlpha = (a.op == null ? 1 : a.op) * .25; c.fillStyle = a.bgColor || a.color; c.fill(); c.restore(); }
      c.stroke();
      break;
    }
    case 'checkmk': {
      c.setLineDash([]);
      c.strokeStyle = a.color || '#059669';
      c.lineWidth = Math.max(2.5, (a.w || 22) * 0.14) * s;
      c.beginPath();
      c.moveTo((a.x + a.w * 0.15) * s, (a.y + a.h * 0.55) * s);
      c.lineTo((a.x + a.w * 0.42) * s, (a.y + a.h * 0.82) * s);
      c.lineTo((a.x + a.w * 0.88) * s, (a.y + a.h * 0.18) * s);
      c.stroke();
      break;
    }
    case 'crossmk': {
      c.setLineDash([]);
      c.strokeStyle = a.color || '#e11d48';
      c.lineWidth = Math.max(2.5, (a.w || 22) * 0.14) * s;
      c.beginPath();
      c.moveTo((a.x + a.w * 0.18) * s, (a.y + a.h * 0.18) * s);
      c.lineTo((a.x + a.w * 0.82) * s, (a.y + a.h * 0.82) * s);
      c.moveTo((a.x + a.w * 0.82) * s, (a.y + a.h * 0.18) * s);
      c.lineTo((a.x + a.w * 0.18) * s, (a.y + a.h * 0.82) * s);
      c.stroke();
      break;
    }
    case 'pin': {
      c.setLineDash([]);
      const pw = (a.w || a.size || 24) * s;
      const ph = (a.h || (a.w ? a.w * 1.25 : 30)) * s;
      const cx = (a.x + (a.w || 24) / 2) * s;
      const headCy = a.y * s + pw * 0.45;
      const tipY = a.y * s + ph;
      const r = pw * 0.44;
      c.fillStyle = a.color || '#f59e0b';
      c.strokeStyle = '#ffffff';
      c.lineWidth = Math.max(1.5, pw * 0.07);
      // Teardrop pin head + needle tip
      c.beginPath();
      c.arc(cx, headCy, r, Math.PI * 0.82, Math.PI * 0.18, false);
      c.lineTo(cx, tipY);
      c.closePath();
      c.fill();
      c.stroke();
      // Pin badge label
      const badgeTxt = String(a.pinNum || '1');
      c.fillStyle = '#ffffff';
      c.font = `bold ${Math.max(8, r * 0.95)}px sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(badgeTxt, cx, headCy);
      // Optional callout tag next to pin
      if (a.text) {
        c.font = `bold ${Math.max(9, pw * 0.42)}px sans-serif`;
        const tw = c.measureText(a.text).width;
        const padX = 5 * s, boxH = Math.max(14 * s, pw * 0.62);
        const bx = cx + r + 4 * s, by = headCy - boxH / 2;
        c.fillStyle = 'rgba(15, 23, 42, 0.9)';
        c.fillRect(bx, by, tw + padX * 2, boxH);
        c.strokeStyle = a.color || '#f59e0b';
        c.lineWidth = 1.2 * s;
        c.strokeRect(bx, by, tw + padX * 2, boxH);
        c.fillStyle = '#f8fafc';
        c.textAlign = 'left';
        c.fillText(a.text, bx + padX, headCy);
      }
      break;
    }
    case 'highlight': c.setLineDash([]); c.globalAlpha = .35; c.fillRect(a.x * s, a.y * s, a.w * s, a.h * s); break;
    case 'whiteout': c.setLineDash([]); c.fillStyle = '#fff'; c.fillRect(a.x * s, a.y * s, a.w * s, a.h * s); break;
    case 'redact': c.setLineDash([]); c.fillStyle = '#000'; c.fillRect(a.x * s, a.y * s, a.w * s, a.h * s); break;
    case 'line': case 'arrow': {
      c.beginPath(); c.moveTo(a.x1 * s, a.y1 * s); c.lineTo(a.x2 * s, a.y2 * s); c.stroke();
      c.setLineDash([]);
      if (a.t === 'arrow') for (const h of arrowHead(a)) { c.beginPath(); c.moveTo(a.x2 * s, a.y2 * s); c.lineTo(h[0] * s, h[1] * s); c.stroke(); }
      break;
    }
    case 'draw':
      c.beginPath(); a.pts.forEach((p, i) => i ? c.lineTo(p[0] * s, p[1] * s) : c.moveTo(p[0] * s, p[1] * s));
      if (a.pts.length === 1) c.lineTo(a.pts[0][0] * s + .1, a.pts[0][1] * s);
      c.stroke();
      break;
    case 'image':
      c.setLineDash([]);
      if (a.img) {
        c.drawImage(a.img, a.x * s, a.y * s, a.w * s, a.h * s);
      } else if (a.dataUrl && !a._loadingImg) {
        a._loadingImg = true;
        loadImg(a.dataUrl).then(im => { a.img = im; a._loadingImg = false; overlay(); }).catch(() => { a._loadingImg = false; });
      }
      break;
    case 'stamp':
      c.setLineDash([]);
      c.lineWidth = 3 * s; c.strokeRect(a.x * s, a.y * s, a.w * s, a.h * s);
      c.font = `bold ${(a.fs || 18) * s}px ${cssFam(a.fam || 'Helvetica')}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(a.text, (a.x + a.w / 2) * s, (a.y + a.h / 2) * s);
      break;
    case 'meas': {
      c.setLineDash([]);
      c.strokeStyle = c.fillStyle = '#0066ff'; c.lineWidth = 1.6 * s; c.beginPath(); c.moveTo(a.x1 * s, a.y1 * s); c.lineTo(a.x2 * s, a.y2 * s); c.stroke();
      [[a.x1, a.y1], [a.x2, a.y2]].forEach(([px, py]) => { c.beginPath(); c.arc(px * s, py * s, 3 * s, 0, 7); c.fill(); });
      const len = Math.hypot(a.x2 - a.x1, a.y2 - a.y1), isEng = window.CAMState && window.CAMState.unitSystem === 'english';
      const t = isEng ? ((len * 1000 / 72).toFixed(1) + ' mil (' + (len * 25.4 / 72).toFixed(2) + ' mm)') : ((len * 25.4 / 72).toFixed(2) + ' mm (' + (len * 1000 / 72).toFixed(1) + ' mil)');
      c.font = `bold ${11.5 * s}px sans-serif`; const tw = c.measureText(t).width, mx = (a.x1 + a.x2) / 2 * s, my = (a.y1 + a.y2) / 2 * s - 8 * s;
      c.fillStyle = 'rgba(255,255,255,.94)'; c.fillRect(mx - tw / 2 - 5 * s, my - 12 * s, tw + 10 * s, 17 * s);
      c.strokeStyle = '#0066ff'; c.lineWidth = 1 * s; c.strokeRect(mx - tw / 2 - 5 * s, my - 12 * s, tw + 10 * s, 17 * s);
      c.fillStyle = '#0044cc'; c.textAlign = 'center'; c.fillText(t, mx, my);
      break;
    }
    case 'area': {
      const pts = a.pts || [];
      if (!pts.length) break;
      c.setLineDash([5 * s, 3 * s]);
      c.strokeStyle = a.color || '#10b981';
      c.lineWidth = Math.max(1.5, (a.size || 2) * s);
      c.beginPath();
      pts.forEach((p, i) => i ? c.lineTo(p[0] * s, p[1] * s) : c.moveTo(p[0] * s, p[1] * s));
      if (pts.length >= 3) {
        c.closePath();
        c.fillStyle = 'rgba(16, 185, 129, 0.18)';
        c.fill();
      }
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = a.color || '#10b981';
      pts.forEach(([px, py]) => { c.beginPath(); c.arc(px * s, py * s, 3 * s, 0, Math.PI * 2); c.fill(); });
      if (pts.length >= 3) {
        let sum = 0, perim = 0, cx = 0, cy = 0;
        for (let i = 0; i < pts.length; i++) {
          const j = (i + 1) % pts.length;
          sum += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
          perim += Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]);
          cx += pts[i][0]; cy += pts[i][1];
        }
        const areaPt2 = Math.abs(sum) / 2;
        cx = (cx / pts.length) * s; cy = (cy / pts.length) * s;
        const isEng = window.CAMState && window.CAMState.unitSystem === 'english';
        const areaMM2 = areaPt2 * Math.pow(25.4 / 72, 2);
        const areaIn2 = areaPt2 / (72 * 72);
        const perimMM = perim * (25.4 / 72);
        const perimMil = perim * (1000 / 72);
        const lbl = isEng
          ? `Area: ${areaIn2.toFixed(3)} in² (${areaMM2.toFixed(1)} mm²) · P: ${perimMil.toFixed(0)} mil`
          : `Area: ${areaMM2.toFixed(1)} mm² (${areaIn2.toFixed(3)} in²) · P: ${perimMM.toFixed(1)} mm`;
        c.font = `bold ${11 * s}px sans-serif`;
        const tw = c.measureText(lbl).width;
        c.fillStyle = 'rgba(15, 23, 42, 0.92)';
        c.fillRect(cx - tw / 2 - 6 * s, cy - 10 * s, tw + 12 * s, 18 * s);
        c.strokeStyle = a.color || '#10b981';
        c.lineWidth = 1.2 * s;
        c.strokeRect(cx - tw / 2 - 6 * s, cy - 10 * s, tw + 12 * s, 18 * s);
        c.fillStyle = '#34d399';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(lbl, cx, cy - 1 * s);
      }
      break;
    }
    case 'crect': c.globalAlpha = .25; c.fillRect(a.x * s, a.y * s, a.w * s, a.h * s); c.globalAlpha = 1; c.setLineDash([5 * s, 4 * s]); c.lineWidth = 1.5 * s; c.strokeRect(a.x * s, a.y * s, a.w * s, a.h * s); break;
    case 'cloud': {
      c.setLineDash([]);
      const pts = [{ x: a.x * s, y: a.y * s }, { x: (a.x + a.w) * s, y: a.y * s }, { x: (a.x + a.w) * s, y: (a.y + a.h) * s }, { x: a.x * s, y: (a.y + a.h) * s }];
      if (typeof MeasureEngine !== "undefined" && MeasureEngine.drawRevisionCloud) {
        MeasureEngine.drawRevisionCloud(c, pts, a.revText || "Δ Rev 2", { color: a.color || "#e11d48", lineWidth: Math.max(1.5, (a.size || 2) * s), scallopSize: 14 * s });
      } else {
        c.strokeRect(a.x * s, a.y * s, a.w * s, a.h * s);
      }
      break;
    }
    case 'leader': {
      const x1 = (a.x1 != null ? a.x1 : a.x) * s, y1 = (a.y1 != null ? a.y1 : a.y) * s;
      const x2 = (a.x2 != null ? a.x2 : a.x + 60) * s, y2 = (a.y2 != null ? a.y2 : a.y - 40) * s;
      if (typeof MeasureEngine !== "undefined" && MeasureEngine.drawLeaderCallout) {
        MeasureEngine.drawLeaderCallout(c, { x: x1, y: y1 }, { x: x2, y: y2 }, a.text || "Callout", { color: a.color || "#e11d48", lineWidth: Math.max(1.5, (a.size || 2) * s) });
      } else {
        c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      }
      break;
    }
  }
  c.restore();
}
function arrowHead(a) { const ang = Math.atan2(a.y2 - a.y1, a.x2 - a.x1), L = Math.max(8, (a.size || 2) * 4); return [ang + 2.7, ang - 2.7].map(t => [a.x2 + L * Math.cos(t), a.y2 + L * Math.sin(t)]); }
function bbox(a) {
  if (a.t === 'line' || a.t === 'arrow') {
    const x1 = a.x1 != null ? a.x1 : a.x, y1 = a.y1 != null ? a.y1 : a.y;
    return [Math.min(x1, a.x2), Math.min(y1, a.y2), Math.max(12, Math.abs(a.x2 - x1)), Math.max(12, Math.abs(a.y2 - y1))];
  }
  if (a.t === 'meas') {
    const x1 = a.x1 != null ? a.x1 : a.x, y1 = a.y1 != null ? a.y1 : a.y;
    const mx = (x1 + a.x2) / 2, my = (y1 + a.y2) / 2 - 8;
    const minX = Math.min(x1, a.x2, mx - 68), maxX = Math.max(x1, a.x2, mx + 68);
    const minY = Math.min(y1, a.y2, my - 15), maxY = Math.max(y1, a.y2, my + 8);
    return [minX, minY, Math.max(20, maxX - minX), Math.max(20, maxY - minY)];
  }
  if (a.t === 'leader') {
    const x1 = a.x1 != null ? a.x1 : a.x, y1 = a.y1 != null ? a.y1 : a.y;
    const x2 = a.x2 != null ? a.x2 : a.x + 60, y2 = a.y2 != null ? a.y2 : a.y - 40;
    const txt = String(a.text || 'Callout');
    const c = _scratchCtx;
    c.font = '12px sans-serif';
    const lines = txt.split('\n');
    const maxW = Math.max(24, ...lines.map(l => c.measureText(l).width));
    const boxW = maxW + 14, boxH = lines.length * 16 + 14;
    const boxX = x2 > x1 ? x2 : x2 - boxW;
    const boxY = y2 - boxH / 2;
    const minX = Math.min(x1, x2, boxX), maxX = Math.max(x1, x2, boxX + boxW);
    const minY = Math.min(y1, y2, boxY), maxY = Math.max(y1, y2, boxY + boxH);
    return [minX, minY, Math.max(20, maxX - minX), Math.max(20, maxY - minY)];
  }
  if (a.t === 'pin') {
    const pw = a.w || a.size || 24;
    const ph = a.h || Math.round(pw * 1.25);
    if (!a.text) return [a.x, a.y, pw, ph];
    const c = _scratchCtx;
    c.font = `bold ${Math.max(9, pw * 0.42)}px sans-serif`;
    const tw = c.measureText(a.text).width;
    const extraW = (pw * 0.44) + 6 + tw + 12;
    return [a.x, a.y, pw / 2 + extraW, ph];
  }
  if (a.t === 'draw' || a.t === 'poly' || a.t === 'area') { const xs = a.pts.map(p => p[0]), ys = a.pts.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(10, Math.max(...xs) - Math.min(...xs)), Math.max(10, Math.max(...ys) - Math.min(...ys))]; }
  if (a.t === 'text') {
    const [tw, th] = measureTextBox(a);
    if (a.bgBox) return [a.x - 5, a.y - 2.5, tw + 10, th + 5];
    return [a.x, a.y, tw, th];
  }
  return [a.x, a.y, a.w, a.h];
}
function moveAnn(a, dx, dy) {
  if ('x1' in a) { a.x1 += dx; a.x2 += dx; a.y1 += dy; a.y2 += dy; } else if (a.pts) a.pts.forEach(p => { p[0] += dx; p[1] += dy; }); else { a.x += dx; a.y += dy; }
}
function hitHandle(a, x, y) {
  if (!a) return null;
  const [bx, by, bw, bh] = bbox(a), t = 8 / K();
  const corners = { nw: [bx - 4, by - 4], ne: [bx + bw + 4, by - 4], sw: [bx - 4, by + bh + 4], se: [bx + bw + 4, by + bh + 4] };
  for (const [k, [cx, cy]] of Object.entries(corners)) {
    if (Math.abs(x - cx) <= t && Math.abs(y - cy) <= t) return k;
  }
  return null;
}
function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
function hitAnnAt(a, x, y, rad) {
  const strokeTol = Math.max(rad, (a.size || 2) / 2 + 4 / K());
  if (a.t === 'line' || a.t === 'arrow' || a.t === 'meas') {
    if (distToSeg(x, y, a.x1, a.y1, a.x2, a.y2) <= strokeTol) return true;
    if (a.t === 'meas') {
      const mx = (a.x1 + a.x2) / 2, my = (a.y1 + a.y2) / 2 - 8;
      if (Math.abs(x - mx) <= 55 + rad && Math.abs(y - (my - 3)) <= 12 + rad) return true;
    }
    return false;
  }
  if (a.t === 'leader') {
    const x1 = a.x1 != null ? a.x1 : a.x, y1 = a.y1 != null ? a.y1 : a.y;
    const x2 = a.x2 != null ? a.x2 : a.x + 60, y2 = a.y2 != null ? a.y2 : a.y - 40;
    if (distToSeg(x, y, x1, y1, x2, y2) <= strokeTol) return true;
    const [bx, by, bw, bh] = bbox(a);
    return x >= bx - rad && x <= bx + bw + rad && y >= by - rad && y <= by + bh + rad;
  }
  if (a.t === 'rect' && !a.fill) {
    const x0 = a.x, y0 = a.y, x1 = a.x + a.w, y1 = a.y + a.h;
    return (
      distToSeg(x, y, x0, y0, x1, y0) <= strokeTol ||
      distToSeg(x, y, x1, y0, x1, y1) <= strokeTol ||
      distToSeg(x, y, x1, y1, x0, y1) <= strokeTol ||
      distToSeg(x, y, x0, y1, x0, y0) <= strokeTol
    );
  }
  if (a.t === 'circle' && !a.fill) {
    const rx = Math.max(4, Math.abs(a.w) / 2), ry = Math.max(4, Math.abs(a.h) / 2);
    const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
    const normDist = Math.hypot((x - cx) / rx, (y - cy) / ry);
    const tolNorm = strokeTol / Math.min(rx, ry);
    return Math.abs(normDist - 1) <= Math.max(0.18, tolNorm);
  }
  if (a.t === 'draw' || a.t === 'poly' || a.t === 'area') {
    const pts = a.pts || [];
    if (pts.length === 1) return Math.hypot(x - pts[0][0], y - pts[0][1]) <= strokeTol;
    for (let i = 0; i < pts.length - 1; i++) {
      if (distToSeg(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) <= strokeTol) return true;
    }
    if ((a.closed || a.fill) && pts.length >= 3) {
      if (distToSeg(x, y, pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1]) <= strokeTol) return true;
      const [bx, by, bw, bh] = bbox(a);
      if (a.fill && x >= bx - rad && x <= bx + bw + rad && y >= by - rad && y <= by + bh + rad) return true;
    }
    return false;
  }
  const [bx, by, bw, bh] = bbox(a);
  return x >= bx - rad && x <= bx + bw + rad && y >= by - rad && y <= by + bh + rad;
}
function hit(x, y, customRad) {
  const list = [...(E.ann[E.cur] || []), ...(E.meas[E.cur] || [])], t = customRad != null ? customRad : 6 / K();
  for (let i = list.length - 1; i >= 0; i--) {
    if (hitAnnAt(list[i], x, y, t)) return list[i];
  }
  return null;
}
function densifyStrokeForBrush(pts, x, y, hitRad) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[i];
    out.push(p0);
    if (i + 1 < pts.length) {
      const p1 = pts[i + 1];
      const segLen = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      if (segLen > 3 && distToSeg(x, y, p0[0], p0[1], p1[0], p1[1]) <= hitRad + 2) {
        const steps = Math.min(40, Math.ceil(segLen / 2.5));
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          out.push([p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t]);
        }
      }
    }
  }
  return out;
}
function eraseAtPoint(x, y) {
  const rad = (+$('#eSize').value || 18) / K();
  const mode = ($('#eEraserMode') && $('#eEraserMode').value) || E.eraserMode || 'object';
  let changed = false;
  if (mode === 'brush') {
    const filterList = list => {
      const next = [];
      for (const a of (list || [])) {
        if (a.t === 'draw' && Array.isArray(a.pts) && a.pts.length >= 1) {
          const hitRad = rad + (a.size || 2) / 2;
          if (a.pts.length === 1) {
            if (Math.hypot(a.pts[0][0] - x, a.pts[0][1] - y) <= hitRad) {
              changed = true;
              if (E.sel === a) E.sel = null;
            } else {
              next.push(a);
            }
            continue;
          }
          const densePts = densifyStrokeForBrush(a.pts, x, y, hitRad);
          let curSeg = [];
          let anyRemoved = false;
          for (const p of densePts) {
            if (Math.hypot(p[0] - x, p[1] - y) <= hitRad) {
              anyRemoved = true;
              if (curSeg.length >= 2) next.push({ ...a, pts: curSeg });
              curSeg = [];
            } else {
              curSeg.push(p);
            }
          }
          if (anyRemoved) {
            changed = true;
            if (E.sel === a) E.sel = null;
            if (curSeg.length >= 2) next.push({ ...a, pts: curSeg });
          } else {
            next.push(a);
          }
        } else if (hitAnnAt(a, x, y, rad)) {
          changed = true;
          if (E.sel === a) E.sel = null;
        } else {
          next.push(a);
        }
      }
      return next;
    };
    E.ann[E.cur] = filterList(E.ann[E.cur]);
    E.meas[E.cur] = filterList(E.meas[E.cur]);
  } else {
    const target = hit(x, y, rad);
    if (target) {
      changed = true;
      E.ann[E.cur] = (E.ann[E.cur] || []).filter(a => a !== target);
      E.meas[E.cur] = (E.meas[E.cur] || []).filter(a => a !== target);
      if (E.sel === target) E.sel = null;
    }
  }
  return changed;
}
function overlay() {
  const o = $('#eov'); if (!o) return;
  const c = o.getContext('2d'), s = K() * E.d; c.clearRect(0, 0, o.width, o.height);
  (E.ann[E.cur] || []).forEach(a => drawAnn(c, a, s));
  (E.meas[E.cur] || []).forEach(a => drawAnn(c, a, s));
  if (E.tmp) drawAnn(c, E.tmp, s);
  if (E.tool === 'eraser' && E.eraserCur) {
    const r = (+$('#eSize').value || 18) * E.d;
    c.save();
    c.beginPath();
    c.arc(E.eraserCur[0] * s, E.eraserCur[1] * s, Math.max(4, r), 0, Math.PI * 2);
    c.fillStyle = 'rgba(239, 68, 68, 0.14)';
    c.fill();
    c.strokeStyle = '#ef4444';
    c.lineWidth = 1.5 * E.d;
    c.setLineDash([4 * E.d, 3 * E.d]);
    c.stroke();
    c.restore();
  }
  if (E.hov && E.tool === 'edittext') { c.save(); c.fillStyle = 'rgba(26,115,232,.14)'; c.strokeStyle = '#1a73e8'; c.lineWidth = 1.5 * E.d; const h = E.hov; c.fillRect((h.x - 1) * s, (h.base - h.h * .85) * s, (h.w + 2) * s, h.h * 1.15 * s); c.strokeRect((h.x - 1) * s, (h.base - h.h * .85) * s, (h.w + 2) * s, h.h * 1.15 * s); c.restore(); }
  F.hits.forEach((h, k) => { if (h.p !== E.cur) return; c.fillStyle = k === F.i ? 'rgba(255,140,0,.55)' : 'rgba(255,200,0,.35)'; c.fillRect(h.x * s, h.y * s, h.w * s, h.h * s); if (k === F.i) { c.strokeStyle = '#e65100'; c.lineWidth = 2 * E.d; c.strokeRect(h.x * s, h.y * s, h.w * s, h.h * s); } });
  const cm = E.comments.find(m => m.key === E.selC && m.page === E.cur);
  if (cm && cm.rect.length === 4 && E.vp) { const [a, b] = E.vp.convertToViewportPoint(cm.rect[0], cm.rect[1]), [c2, d2] = E.vp.convertToViewportPoint(cm.rect[2], cm.rect[3]); c.save(); c.setLineDash([6, 4]); c.strokeStyle = '#1a3cff'; c.lineWidth = 2 * E.d; c.strokeRect((Math.min(a, c2) - 3) * s, (Math.min(b, d2) - 3) * s, (Math.abs(c2 - a) + 6) * s, (Math.abs(d2 - b) + 6) * s); c.restore(); }
  if (E.sel) {
    const [x, y, w, h] = bbox(E.sel); c.save(); c.setLineDash([6, 4]); c.strokeStyle = '#38bdf8'; c.lineWidth = 1.75 * E.d;
    c.strokeRect((x - 4) * s, (y - 4) * s, (w + 8) * s, (h + 8) * s);
    c.setLineDash([]); c.fillStyle = '#38bdf8';
    [[x - 4, y - 4], [x + w + 4, y - 4], [x - 4, y + h + 4], [x + w + 4, y + h + 4]].forEach(([hx, hy]) => {
      c.fillRect((hx - 3) * s, (hy - 3) * s, 6 * s, 6 * s);
    });
    c.restore();
  }
}
function addAnn(a, skipHistory) {
  if (!skipHistory) pushAnnState(`Add ${a.t}`);
  (E.ann[E.cur] = E.ann[E.cur] || []).push(a);
  if (a.op == null && ['rect', 'circle', 'poly', 'line', 'arrow', 'draw', 'text', 'cloud', 'leader', 'checkmk', 'crossmk', 'pin'].includes(a.t)) {
    a.op = Math.max(.1, Math.min(1, (+$('#eOp').value || 100) / 100));
  }
  if (['rect', 'circle', 'poly'].includes(a.t) && a.fill == null) {
    a.fill = $('#eFill').checked;
    if ($('#eBgColor')) a.bgColor = $('#eBgColor').value;
  }
  if (['rect', 'circle', 'poly', 'line', 'arrow', 'leader', 'draw'].includes(a.t) && !a.dash && $('#eDash')) {
    a.dash = $('#eDash').value;
  }
  E.sel = a; overlay(); updateDocInspector();
}

// ---------- page view ----------
async function renderPage() {
  if (!E.doc) return;
  if (E._rendering) {
    E._renderQueued = true;
    return E._renderPromise;
  }
  E._rendering = true;
  E._renderPromise = (async () => {
    do {
      E._renderQueued = false;
      if (!E.doc) break;
      const tok = ++E.tok, doc = E.doc;
      let off = null;
      try {
        const page = await doc.getPage(E.cur + 1), vp1 = page.getViewport({ scale: 1 }), _az = autoZoom(vp1), k = K(); let d = DPR(); const area = vp1.width * k * vp1.height * k * d * d; if (area > 6e7) d *= Math.sqrt(6e7 / area);
        const vp = page.getViewport({ scale: k * d });
        if (tok !== E.tok || doc !== E.doc) continue;
        const logicalWidth = vp1.width * k, logicalHeight = vp1.height * k;
        off = document.createElement('canvas');
        off.width = Math.max(1, Math.round(logicalWidth * d));
        off.height = Math.max(1, Math.round(logicalHeight * d));
        const x = off.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, off.width, off.height);
        const rt = page.render({ canvasContext: x, viewport: vp });
        E._renderTask = rt;
        await rt.promise;
        if (E._renderTask === rt) E._renderTask = null;
        if (tok !== E.tok || doc !== E.doc) continue;
        E.vp = vp1; E.d = d;
        const cv = $('#ecv'), o = $('#eov'); cv.width = o.width = off.width; cv.height = o.height = off.height;
        cv.style.width = o.style.width = vp1.width * k + 'px'; cv.style.height = o.style.height = vp1.height * k + 'px';
        cv.getContext('2d', { willReadFrequently: true }).drawImage(off, 0, 0);
        off.width = 0; off.height = 0; off = null;
        $('#ePg').value = E.cur + 1; if ($('#eZoomBadge')) $('#eZoomBadge').textContent = Math.round(E.zoom * 100) + '%'; markThumbs(); overlay(); hideSelBar();
        updateDocInspector(); syncHudBar();
        if (E.inlineText) syncInlineTextEditorStyle();
        if (E.lastCur !== E.cur) { $('#eview').scrollTop = 0; $('#eview').scrollLeft = 0; E.lastCur = E.cur; }
        buildTextLayer(page, vp1, k, tok);
      } catch (e) {
        if (tok === E.tok && doc === E.doc && (!e || e.name !== 'RenderingCancelledException')) st('Could not draw the page: ' + (e.message || e));
      } finally {
        if (off) { off.width = 0; off.height = 0; }
      }
    } while (E._renderQueued && E.doc);
    E._rendering = false;
  })();
  return E._renderPromise;
}
function autoZoom(v) {
  if (!E.fitMode) return; const ev = $('#eview'), w = ev.clientWidth - 56, h = ev.clientHeight - 72; if (w < 60 || h < 60) return;
  const zw = w / (v.width * 4 / 3), zh = h / (v.height * 4 / 3);
  const rawZ = E.fitMode === 'width' ? zw : Math.min(zw, zh);
  E.zoom = clampEdZoom(Math.max(0.1, Math.min(rawZ, E.fitMode === 'width' ? 4 : 3)));
}
function fit(mode) { if (!E.doc) return; E.fitMode = mode === 'width' ? 'width' : 'page'; renderPage(); }
const refit = () => { if (E.fitMode) renderPage(); };
addEventListener('resize', () => { if (E.fitMode && document.body.dataset.view === 'edit') { clearTimeout(E.rz); E.rz = setTimeout(renderPage, 100); } });
if (typeof ResizeObserver !== 'undefined' && $('#eview')) {
  let evLastW = 0;
  new ResizeObserver(entries => {
    for (const en of entries) {
      const w = Math.round(en.contentRect.width);
      if (w > 0 && Math.abs(w - evLastW) > 4) {
        evLastW = w;
        if (E.doc && E.fitMode && document.body.dataset.view === 'edit') {
          clearTimeout(E.rz);
          E.rz = setTimeout(renderPage, 90);
        }
      }
    }
  }).observe($('#eview'));
}
const goto = i => { if (!E.doc) return; E.cur = Math.max(0, Math.min(E.n - 1, i)); E.pages = new Set([E.cur]); E.sel = null; renderPage(); };
$('#ePrev').onclick = () => goto(E.cur - 1); $('#eNext').onclick = () => goto(E.cur + 1);
$('#ePg').onchange = e => goto((+e.target.value || 1) - 1);
$('#eZi').onclick = () => { E.fitMode = null; E.zoom = clampEdZoom(Math.min(6, clampEdZoom(E.zoom) * 1.25)); renderPage(); }; $('#eZo').onclick = () => { E.fitMode = null; E.zoom = clampEdZoom(Math.max(0.05, clampEdZoom(E.zoom) / 1.25)); renderPage(); }; $('#eFit').onclick = () => fit();
$('#eview').addEventListener('wheel', e => { if (e.ctrlKey) { e.preventDefault(); E.fitMode = null; E.zoom = clampEdZoom(Math.max(0.05, Math.min(6, clampEdZoom(E.zoom) * (e.deltaY < 0 ? 1.1 : 1 / 1.1)))); renderPage(); } }, { passive: false });

// Wire Floating HUD Controls
if ($('#eHudFirst')) $('#eHudFirst').onclick = () => goto(0);
if ($('#eHudPrev')) $('#eHudPrev').onclick = () => goto(E.cur - 1);
if ($('#eHudNext')) $('#eHudNext').onclick = () => goto(E.cur + 1);
if ($('#eHudLast')) $('#eHudLast').onclick = () => goto(E.n - 1);
if ($('#eHudPageLabel')) $('#eHudPageLabel').onclick = () => ACT.eGotoDialog && ACT.eGotoDialog();
if ($('#eHudSelect')) $('#eHudSelect').onclick = () => setTool('select');
if ($('#eHudHand')) $('#eHudHand').onclick = () => setTool('hand');
if ($('#eHudMeasure')) $('#eHudMeasure').onclick = () => setTool('measure');
if ($('#eHudZo')) $('#eHudZo').onclick = () => $('#eZo').click();
if ($('#eHudZi')) $('#eHudZi').onclick = () => $('#eZi').click();
if ($('#eZoomPreset')) {
  $('#eZoomPreset').onchange = e => {
    const v = e.target.value;
    if (v === 'page' || v === 'width') fit(v);
    else { E.fitMode = null; E.zoom = Math.max(.1, Math.min(6, +v || 1)); renderPage(); }
  };
}

// ---------- thumbnails ----------
let io;
async function thumbs() {
  const box = $('#thumbs');
  if (box) box.querySelectorAll('canvas').forEach(cv => { cv.width = 0; cv.height = 0; });
  box.innerHTML = ''; if (io) io.disconnect(); const doc = E.doc;
  const head = document.createElement('div');
  head.className = 'rp-thumbs-header';
  head.innerHTML = `<span>PAGES (${E.n})</span>`;
  box.append(head);
  io = new IntersectionObserver(es => es.forEach(async en => {
    if (!en.isIntersecting) return; const d = en.target; io.unobserve(d); const i = +d.dataset.i;
    try {
      if (doc !== E.doc) return;
      const p = await doc.getPage(i + 1), v1 = p.getViewport({ scale: 1 }), s = 104 / v1.width, v = p.getViewport({ scale: s * DPR() }), c = d.querySelector('canvas');
      if (!c) return;
      c.width = Math.round(v.width); c.height = Math.round(v.height); c.style.width = '104px'; c.style.height = v1.height * s + 'px';
      await p.render({ canvasContext: c.getContext('2d'), viewport: v }).promise;
      if (i !== E.cur && typeof p.cleanup === 'function') { try { p.cleanup(); } catch (e) {} }
    } catch (e) {}
  }), { root: box, rootMargin: '400px' });
  for (let i = 0; i < E.n; i++) {
    const d = document.createElement('div'); d.className = 'th'; d.dataset.i = i; d.draggable = true;
    d.innerHTML = `<canvas width="104" height="134" style="width:104px;height:134px"></canvas><span>Page ${i + 1}</span>`;
    d.onclick = e => {
      if (e.ctrlKey || e.metaKey) { E.pages.has(i) ? E.pages.delete(i) : E.pages.add(i); markThumbs(); }
      else if (e.shiftKey) { const a = Math.min(E.cur, i), b = Math.max(E.cur, i); E.pages = new Set(); for (let j = a; j <= b; j++) E.pages.add(j); markThumbs(); }
      else goto(i);
    };
    d.ondragstart = e => { e.dataTransfer.setData('text/plain', String(i)); if (!E.pages.has(i)) E.pages = new Set([i]); };
    d.ondragover = e => { e.preventDefault(); d.classList.add('over'); }; d.ondragleave = () => d.classList.remove('over');
    d.ondrop = e => { e.preventDefault(); d.classList.remove('over'); reorder([...E.pages].sort((a, b) => a - b), i); };
    box.append(d); io.observe(d);
  }
  markThumbs();
}
function markThumbs() { document.querySelectorAll('.th').forEach(d => { const i = +d.dataset.i; d.classList.toggle('cur', i === E.cur); d.classList.toggle('sel', E.pages.has(i)); }); }
const targets = () => E.pages.size ? [...E.pages].sort((a, b) => a - b) : [E.cur];

// ---------- High-DPI Super-Sampled Sprite Renderer for Custom Fonts, Unicode & Rich Shapes ----------
async function renderAnnToHighResPng(a, scale = 4) {
  const [bx, by, bw, bh] = bbox(a);
  const pad = Math.max(12, (a.size || 14) * 0.8);
  const wPt = Math.max(16, bw + pad * 2);
  const hPt = Math.max(16, bh + pad * 2);
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(wPt * scale);
  cv.height = Math.ceil(hPt * scale);
  const ctx = cv.getContext('2d');
  const shifted = { ...a };
  if ('x1' in shifted) {
    shifted.x1 = a.x1 - (bx - pad);
    shifted.y1 = a.y1 - (by - pad);
    shifted.x2 = a.x2 - (bx - pad);
    shifted.y2 = a.y2 - (by - pad);
  } else if (shifted.pts) {
    shifted.pts = a.pts.map(p => [p[0] - (bx - pad), p[1] - (by - pad)]);
  } else {
    shifted.x = a.x - (bx - pad);
    shifted.y = a.y - (by - pad);
  }
  drawAnn(ctx, shifted, scale);
  const dataUrl = cv.toDataURL('image/png');
  cv.width = 0; cv.height = 0;
  const raw = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
  return { raw, xPt: bx - pad, yPt: by - pad, wPt, hPt };
}

// ---------- commit annotations into the PDF ----------
async function commit(noReload) {
  if (E.inlineText) commitInlineTextEditor();
  const pageSet = new Set([
    ...Object.keys(E.ann).filter(k => E.ann[k] && E.ann[k].length),
    ...Object.keys(E.meas).filter(k => E.meas[k] && E.meas[k].length)
  ]);
  if (!pageSet.size) return;
  const doc = await PDFDocument.load(E.bytes, LOAD), font = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  for (const k of pageSet) {
    const i = +k;
    const list = [...(E.ann[k] || []), ...(E.meas[k] || [])];
    const pj = await E.doc.getPage(i + 1), vp = pj.getViewport({ scale: 1 });
    if (list.some(a => a.t === 'redact' || a.flat)) await rasterize(doc, i, pj, vp, list);
    else await vector(doc, doc.getPage(i), vp, list, font, bold);
  }
  const nb = await doc.save(); push(); E.bytes = nb; E.ann = {}; E.meas = {}; E.annUndo = []; E.annRedo = []; E.sel = null;
  if (!noReload) await reload();
}
async function vector(doc, page, vp, list, font, bold) {
  const FN = { Helvetica: ['Helvetica', 'HelveticaBold', 'HelveticaOblique', 'HelveticaBoldOblique'], Times: ['TimesRoman', 'TimesRomanBold', 'TimesRomanItalic', 'TimesRomanBoldItalic'], Courier: ['Courier', 'CourierBold', 'CourierOblique', 'CourierBoldOblique'] }, fc = {};
  const getFont = async (fam, b, it) => { const nm = (FN[fam] || FN.Helvetica)[(b ? 1 : 0) + (it ? 2 : 0)]; return fc[nm] || (fc[nm] = await doc.embedFont(StandardFonts[nm])); };
  const P = (x, y) => vp.convertToPdfPoint(x, y), R = degrees(vp.rotation || 0);
  const dashArrOf = a => {
    const lw = a.size || 2;
    if (a.dash === 'dashed') return [Math.max(5, lw * 3), Math.max(3, lw * 2)];
    if (a.dash === 'dotted') return [Math.max(1.5, lw), Math.max(3, lw * 2)];
    return undefined;
  };
  for (const a of list) {
    const col = a.color ? hexRgb(a.color) : rgb(0, 0, 0);
    if (a.t === 'text') {
      const isStdFam = !a.fam || a.fam === 'Helvetica' || a.fam === 'Times' || a.fam === 'Courier';
      const tf = isStdFam ? await getFont(a.fam || 'Helvetica', a.bold, a.italic) : font;
      const plainStd = isStdFam && !a.underline && !a.strike && !a.bgBox && (!a.align || a.align === 'left') && canEncodeAll(tf, a.text);
      if (plainStd) {
        a.text.split('\n').forEach((l, i) => {
          if (!l) return;
          const [X, Y] = P(a.x, a.y + a.size * (BASE + i * 1.22));
          page.drawText(safeText(tf, l), { x: X, y: Y, size: a.size, font: tf, color: col, opacity: a.op == null ? 1 : a.op, rotate: R });
        });
      } else {
        // Render rich font / custom .ttf / Unicode / underlined / boxed text as 4x Super-Sampled Transparent PNG Sprite
        const spr = await renderAnnToHighResPng(a, 4);
        const pngImg = await doc.embedPng(spr.raw);
        const [X, Y] = P(spr.xPt, spr.yPt + spr.hPt);
        page.drawImage(pngImg, { x: X, y: Y, width: spr.wPt, height: spr.hPt, rotate: R });
      }
    } else if (a.t === 'rect' || a.t === 'highlight' || a.t === 'whiteout') {
      const [x1, y1] = P(a.x, a.y), [x2, y2] = P(a.x + a.w, a.y + a.h), o = { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
      const borderDashArray = dashArrOf(a);
      if (a.t === 'rect') page.drawRectangle({ ...o, borderColor: col, borderWidth: a.size, borderOpacity: a.op == null ? 1 : a.op, ...(borderDashArray ? { borderDashArray } : {}), ...(a.fill ? { color: a.bgColor ? hexRgb(a.bgColor) : col, opacity: .28 * (a.op == null ? 1 : a.op) } : {}) });
      else if (a.t === 'highlight') page.drawRectangle({ ...o, color: col, opacity: .35 });
      else page.drawRectangle({ ...o, color: rgb(1, 1, 1) });
    } else if (a.t === 'circle' || a.t === 'poly' || a.t === 'area' || a.t === 'checkmk' || a.t === 'crossmk' || a.t === 'pin' || a.t === 'cloud' || a.t === 'leader' || a.t === 'meas') {
      const spr = await renderAnnToHighResPng(a, 4);
      const pngImg = await doc.embedPng(spr.raw);
      const [X, Y] = P(spr.xPt, spr.yPt + spr.hPt);
      page.drawImage(pngImg, { x: X, y: Y, width: spr.wPt, height: spr.hPt, rotate: R });
    } else if (a.t === 'line' || a.t === 'arrow') {
      const dashArray = dashArrOf(a);
      const seg = (p, q, useDash) => { const [X1, Y1] = P(p[0], p[1]), [X2, Y2] = P(q[0], q[1]); page.drawLine({ start: { x: X1, y: Y1 }, end: { x: X2, y: Y2 }, thickness: a.size, color: col, opacity: a.op == null ? 1 : a.op, lineCap: LineCapStyle.Round, ...(useDash && dashArray ? { dashArray } : {}) }); };
      seg([a.x1, a.y1], [a.x2, a.y2], true); if (a.t === 'arrow') arrowHead(a).forEach(h => seg([a.x2, a.y2], h, false));
    } else if (a.t === 'draw') {
      if (a.dash && a.dash !== 'solid') {
        const spr = await renderAnnToHighResPng(a, 4);
        const pngImg = await doc.embedPng(spr.raw);
        const [X, Y] = P(spr.xPt, spr.yPt + spr.hPt);
        page.drawImage(pngImg, { x: X, y: Y, width: spr.wPt, height: spr.hPt, rotate: R });
      } else {
        if (a.pts.length === 1) {
          const [X1, Y1] = P(a.pts[0][0], a.pts[0][1]), [X2, Y2] = P(a.pts[0][0] + 0.1, a.pts[0][1]);
          page.drawLine({ start: { x: X1, y: Y1 }, end: { x: X2, y: Y2 }, thickness: a.size, color: col, opacity: a.op == null ? 1 : a.op, lineCap: LineCapStyle.Round });
        }
        for (let j = 1; j < a.pts.length; j++) { const [X1, Y1] = P(...a.pts[j - 1]), [X2, Y2] = P(...a.pts[j]); page.drawLine({ start: { x: X1, y: Y1 }, end: { x: X2, y: Y2 }, thickness: a.size, color: col, opacity: a.op == null ? 1 : a.op, lineCap: LineCapStyle.Round }); }
      }
    } else if (a.t === 'stamp') {
      const isCustomFam = a.fam && a.fam !== 'Helvetica';
      if (!isCustomFam && canEncodeAll(bold, a.text)) {
        const [x1, y1] = P(a.x, a.y), [x2, y2] = P(a.x + a.w, a.y + a.h); page.drawRectangle({ x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1), borderColor: col, borderWidth: 3 });
        const tw = bold.widthOfTextAtSize(safeText(bold, a.text), a.fs), [X, Y] = P(a.x + (a.w - tw) / 2, a.y + a.h / 2 + a.fs * .35); page.drawText(safeText(bold, a.text), { x: X, y: Y, size: a.fs, font: bold, color: col, rotate: R });
      } else {
        const spr = await renderAnnToHighResPng(a, 4);
        const pngImg = await doc.embedPng(spr.raw);
        const [X, Y] = P(spr.xPt, spr.yPt + spr.hPt);
        page.drawImage(pngImg, { x: X, y: Y, width: spr.wPt, height: spr.hPt, rotate: R });
      }
    } else if (a.t === 'image') {
      const raw = Uint8Array.from(atob(a.dataUrl.split(',')[1]), c => c.charCodeAt(0)), img = /jpe?g/.test(a.dataUrl.slice(0, 30)) ? await doc.embedJpg(raw) : await doc.embedPng(raw), [X, Y] = P(a.x, a.y + a.h);
      page.drawImage(img, { x: X, y: Y, width: a.w, height: a.h, rotate: R });
    }
  }
}
async function rasterize(doc, i, pj, vp, list, s = 3) {
  const v = pj.getViewport({ scale: s }), c = document.createElement('canvas'); c.width = v.width; c.height = v.height;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); await pj.render({ canvasContext: x, viewport: v }).promise;
  list.forEach(a => drawAnn(x, a, s));
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  c.width = 0; c.height = 0;
  const img = await doc.embedPng(new Uint8Array(await blob.arrayBuffer()));
  const np = doc.insertPage(i, [vp.width, vp.height]); np.drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height }); doc.removePage(i + 1);
}


// ---------- text layer: select, copy, mark up and edit existing text ----------
function buildTextLayer(page, vp1, k, tok) {
  const tl = $('#etl'); tl.innerHTML = ''; tl.style.setProperty('--scale-factor', k); tl.style.width = vp1.width * k + 'px'; tl.style.height = vp1.height * k + 'px'; E.titems = []; E.hov = null;
  page.getTextContent().then(tc => {
    if (tok !== E.tok) return;
    const vp = page.getViewport({ scale: 1 }), fi = {};
    const info = fn => fi[fn] || (fi[fn] = (() => { try { const f = page.commonObjs.get(fn); return { bold: !!f.bold || /bold|black|heavy/i.test(f.name || ''), italic: !!f.italic || /italic|oblique/i.test(f.name || '') }; } catch (e) { return { bold: false, italic: false }; } })());
    if (vp.rotation === 0) tc.items.forEach(it => {
      if (!it.str || !it.str.trim()) return; const t = pdfjsLib.Util.transform(vp.transform, it.transform); if (Math.abs(t[1]) > .01 || Math.abs(t[2]) > .01) return;
      const f = info(it.fontName); E.titems.push({ str: it.str, x: t[4], base: t[5], w: it.width * vp.scale, h: Math.hypot(t[2], t[3]), fam: (tc.styles[it.fontName] || {}).fontFamily || 'sans-serif', bold: f.bold, italic: f.italic });
    });
    try { pdfjsLib.renderTextLayer({ textContentSource: tc, container: tl, viewport: page.getViewport({ scale: k }), textDivs: [] }); } catch (e) {}
  }).catch(() => {});
}
function setPE() {
  const o = $('#eov'), tl = $('#etl'), sel = E.tool === 'select';
  o.style.pointerEvents = sel ? 'none' : 'auto';
  tl.style.pointerEvents = sel ? 'auto' : 'none';
  if (!sel) { try { getSelection().removeAllRanges(); } catch (e) {} }
  hideSelBar();
}
const wrapEl = $('#ewrap');
wrapEl.addEventListener('mousemove', e => {
  if (E.tool !== 'select' || !E.doc) return;
  const r = $('#ecv').getBoundingClientRect(), px = (e.clientX - r.left) / K(), py = (e.clientY - r.top) / K();
  const hdl = E.sel ? hitHandle(E.sel, px, py) : null;
  const h = !!hdl || !!hit(px, py), o = $('#eov'), want = h ? 'auto' : 'none';
  if (o.style.pointerEvents !== want) o.style.pointerEvents = want;
  o.style.cursor = hdl ? ((hdl === 'nw' || hdl === 'se') ? 'nwse-resize' : 'nesw-resize') : (h ? 'move' : 'default');
});
wrapEl.addEventListener('pointerdown', e => {
  if (E.inlineText && e.target.id !== 'eov' && !e.target.closest('#rp-inline-text-box')) {
    commitInlineTextEditor();
  }
  if (E.tool === 'select' && e.target.id !== 'eov') {
    if (E.sel) { E.sel = null; updateContextualToolDock('select'); overlay(); }
    if (!e.target.closest('#selbar')) hideSelBar();
  }
});
wrapEl.addEventListener('dblclick', e => {
  if (!E.doc || E.tool !== 'select' || e.target.closest('#rp-inline-text-box')) return;
  const r = $('#ecv').getBoundingClientRect(), px = (e.clientX - r.left) / K(), py = (e.clientY - r.top) / K();
  const a = hit(px, py);
  if (a && a.t === 'text') {
    e.preventDefault();
    openInlineTextEditor({ mode: 'editAnn', ann: a });
    return;
  }
  const it = itemAt(px, py);
  if (it) {
    e.preventDefault();
    try { getSelection().removeAllRanges(); } catch (err) {}
    hideSelBar();
    openInlineTextEditor({ mode: 'pdfItem', item: it });
  }
});
function selInfo() { const s = getSelection(); if (!s || s.isCollapsed || !s.rangeCount) return null; const r = s.getRangeAt(0); if (!$('#etl').contains(r.commonAncestorContainer)) return null; const txt = s.toString(); return txt.trim() ? { r, txt } : null; }
function selBoxes() {
  const info = selInfo(); if (!info) return []; const cr = $('#ecv').getBoundingClientRect(), k = K(), lw = cr.width / k, lh = cr.height / k;
  let rects = [...info.r.getClientRects()].filter(q => q.width > 1 && q.height > 1).map(q => ({ x0: (q.left - cr.left) / k, y0: (q.top - cr.top) / k, x1: (q.right - cr.left) / k, y1: (q.bottom - cr.top) / k })).filter(q => (q.x1 - q.x0) < lw * .98 || (q.y1 - q.y0) < lh * .5);
  rects.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0); const out = [];
  for (const q of rects) { const l = out[out.length - 1]; if (l && Math.abs(l.y0 - q.y0) < (l.y1 - l.y0) * .6 && q.x0 <= l.x1 + 2) { l.x1 = Math.max(l.x1, q.x1); l.y0 = Math.min(l.y0, q.y0); l.y1 = Math.max(l.y1, q.y1); } else out.push({ ...q }); }
  return out;
}
function hideSelBar() { const b = $('#selbar'); if (b) b.hidden = true; }
function showSelBar() {
  const info = selInfo(); if (!info || E.tool !== 'select') return hideSelBar(); const b = $('#selbar'), rr = info.r.getBoundingClientRect(); b.hidden = false;
  const bw = b.offsetWidth, bh = b.offsetHeight; b.style.left = Math.max(6, Math.min(innerWidth - bw - 6, rr.left + rr.width / 2 - bw / 2)) + 'px'; b.style.top = (rr.top - bh - 10 > 50 ? rr.top - bh - 10 : rr.bottom + 10) + 'px';
}
$('#etl').addEventListener('mouseup', () => setTimeout(showSelBar, 10));
$('#eview').addEventListener('scroll', hideSelBar);
async function copySel() { const info = selInfo(); if (!info) return; const t = info.txt.trim(); try { await navigator.clipboard.writeText(t); } catch (e) { document.execCommand('copy'); } st('Copied ' + t.length + ' characters'); hideSelBar(); }
async function markFromSelection(sub, color) {
  const boxes = selBoxes(); if (!boxes.length) return st('Select some text first.'); if (!await ensureAuthor()) return;
  const r = await dialog('Comment (optional)', [{ type: 'textarea', id: 'v', label: '', rows: 3 }], 'Add'); if (!r) return;
  getSelection().removeAllRanges(); hideSelBar(); await addMarkup(E.cur, sub, null, r.v || '', color, boxes);
}
function itemAt(x, y) {
  const L = E.titems || [];
  for (let i = L.length - 1; i >= 0; i--) {
    const t = L[i];
    if (x >= t.x - 4 && x <= t.x + t.w + 6 && y >= t.base - t.h * 1.05 && y <= t.base + t.h * 0.45) return t;
  }
  let best = null, bestD = 14;
  for (let i = L.length - 1; i >= 0; i--) {
    const t = L[i];
    const cx = Math.max(t.x, Math.min(t.x + t.w, x));
    const cy = Math.max(t.base - t.h * 0.9, Math.min(t.base + t.h * 0.25, y));
    const d = Math.hypot(x - cx, y - cy);
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}
function itemsIn(boxes) {
  return (E.titems || []).filter(t => boxes.some(b => Math.min(t.x + t.w, b.x1) - Math.max(t.x, b.x0) > 1 && Math.min(t.base + t.h * .25, b.y1) - Math.max(t.base - t.h * .85, b.y0) > t.h * .35))
    .sort((a, b) => Math.abs(a.base - b.base) < a.h * .5 ? a.x - b.x : a.base - b.base);
}
const famOf = t => /serif/.test(t.fam) && !/sans/.test(t.fam) ? 'Times' : /mono/.test(t.fam) ? 'Courier' : 'Helvetica';
async function editItems(items, sub) {
  if (!E.titems || !E.titems.length) return st('Editing text needs an upright page that has real text (not a scan).');
  if (!items.length) return st('Click directly on a piece of text, or select it first.');
  const single = items.length === 1 && sub && items[0].str.includes(sub);
  const detectedFam = famOf(items[0]);
  const fields = [
    single ? { type: 'textarea', id: 'v', label: 'Replace the selected text with:', rows: 2, value: sub }
      : { type: 'textarea', id: 'v', label: items.length > 1 ? 'Edit the text (one line for each piece of text):' : 'Edit the text:', rows: Math.min(6, items.length + 1), value: items.map(t => t.str).join('\n') },
    { type: 'symbols' },
    { type: 'select', id: 'fam', label: 'Font Family', value: detectedFam, options: getFontOptionsList() },
    { type: 'number', id: 'sz', label: 'Font Size (pt)', value: Math.round(items[0].h || 12), min: 4, max: 140 },
    { type: 'color', id: 'col', label: 'Text colour', value: '#000000' },
    { type: 'checkbox', id: 'flat', label: 'Flatten page to raster image (removes underlying text layer)', value: false },
    { type: 'checkbox', id: 'bold', label: 'Bold', value: !!items[0].bold },
    { type: 'checkbox', id: 'italic', label: 'Italic', value: !!items[0].italic }
  ];
  const r = await dialog(single ? 'Replace Selected PDF Text' : 'Edit PDF Text In-Place', fields, 'Apply'); if (!r) return;
  pushAnnState('In-place PDF text edit');
  const g = 'g' + Date.now(), cm = _scratchCtx, lines = single ? null : r.v.split('\n'); let n = 0;
  items.forEach((t, j) => {
    const fam = r.fam || famOf(t); cm.font = `${r.bold ? 'bold ' : ''}${t.h}px ${cssFam(fam)}`; let xs = t.x, newStr;
    if (single) { const idx = t.str.indexOf(sub), pre = t.str.slice(0, idx), suf = t.str.slice(idx + sub.length), all = cm.measureText(t.str).width || 1; xs = t.x + cm.measureText(pre).width * (t.w / all); newStr = r.v + suf; }
    else { newStr = j === items.length - 1 ? lines.slice(j).join(' ') : (lines[j] ?? ''); }
    n++;
    addAnn({ t: 'whiteout', x: xs - 1.5, y: t.base - t.h * .88, w: (t.x + t.w - xs) + 4, h: t.h * 1.2 + 2, color: '#ffffff', size: 1, g, op: 1, flat: !!r.flat }, true);
    if (newStr) addAnn({ t: 'text', x: xs, y: t.base - (r.sz || t.h) * BASE, text: newStr, color: r.col, size: r.sz || t.h, fam, bold: !!r.bold, italic: !!r.italic, g, op: 1 }, true);
  });
  try { getSelection().removeAllRanges(); } catch (e) {} hideSelBar(); st(n ? 'Text updated. Press Ctrl+Z to undo or Save to keep.' : 'Nothing was changed.');
}
function editFromSelection() {
  const info = selInfo();
  if (!info) return st('Select some text first.');
  const items = itemsIn(selBoxes()), t = info.txt.trim();
  return editItems(items, items.length === 1 && items[0].str.includes(t) ? t : null);
}
$('#sbCopy').onclick = copySel; $('#sbHl').onclick = () => markFromSelection('Highlight', '#ffe600'); $('#sbUl').onclick = () => markFromSelection('Underline', '#e11d48'); $('#sbSt').onclick = () => markFromSelection('StrikeOut', '#e11d48'); $('#sbEd').onclick = editFromSelection;

// ---------- pointer tools & contextual tool-options dock ----------
const TOOLS_SIZE = { cnote: 14, chl: 14, cul: 14, cst: 14, stamp: 18, text: 14, cloud: 2, leader: 2, rect: 2, circle: 2, poly: 2, line: 2, arrow: 2, draw: 3, eraser: 18, pin: 24, checkmk: 22, crossmk: 22, select: 14, hand: 14, edittext: 14, measure: 2, area: 2, highlight: 14, whiteout: 14, redact: 14, image: 14, sign: 14 };
const TOOLS_DEFAULT_COLOR = { draw: '#e11d48', rect: '#e11d48', circle: '#e11d48', poly: '#e11d48', line: '#e11d48', arrow: '#e11d48', cloud: '#e11d48', leader: '#e11d48', text: '#e11d48', pin: '#f59e0b', checkmk: '#059669', crossmk: '#e11d48', highlight: '#ffe600', chl: '#ffe600', cul: '#e11d48', cst: '#e11d48', cnote: '#ffc400', measure: '#0066ff', area: '#10b981' };

function getToolSetting(t, key, fallback) {
  if (E.toolSettings[t] && E.toolSettings[t][key] != null) return E.toolSettings[t][key];
  return fallback;
}
function saveToolSetting(t, key, val) {
  if (!t) return;
  E.toolSettings[t] = E.toolSettings[t] || {};
  E.toolSettings[t][key] = val;
}

function syncSizePresetsUI(val) {
  const n = Math.round(+val || 0);
  document.querySelectorAll('#ePenPresets .rp-sz-pre').forEach(b => b.classList.toggle('on', +b.dataset.sz === n));
  document.querySelectorAll('#eEraserOpts .rp-er-pre').forEach(b => b.classList.toggle('on', +b.dataset.er === n));
  document.querySelectorAll('#ePinOpts .rp-pin-pre').forEach(b => b.classList.toggle('on', +b.dataset.psz === n));
}

function shouldShowContextualDock(activeTool) {
  const t = (activeTool === 'select' && E.sel && E.sel.t) ? E.sel.t : (activeTool || E.tool || 'select');
  return ['draw', 'rect', 'circle', 'line', 'arrow', 'poly', 'cloud', 'leader', 'eraser', 'pin', 'checkmk', 'crossmk'].includes(t);
}

function updateContextualToolDock(activeTool) {
  const t = (activeTool === 'select' && E.sel && E.sel.t) ? E.sel.t : (activeTool || E.tool || 'select');
  const isStroke = ['draw', 'rect', 'circle', 'line', 'arrow', 'poly', 'cloud', 'leader'].includes(t);
  const isShapeFill = ['rect', 'circle', 'poly'].includes(t);
  const isEraser = t === 'eraser';
  const isPinOrTick = ['pin', 'checkmk', 'crossmk'].includes(t);
  const showDock = shouldShowContextualDock(activeTool);

  // Font & Paragraph Set (#eFontSet / #eRowFont / #eRowTextFmt) is ALWAYS visible outside in its own MS Office set!
  if ($('#eRowFont')) $('#eRowFont').hidden = false;
  if ($('#eRowTextFmt')) $('#eRowTextFmt').hidden = false;

  // Contextual Tool Options (#eStyleDock) ONLY appears when Pen, Shape, Eraser, or Pin is active/selected!
  if ($('#eStyleDock')) $('#eStyleDock').hidden = !showDock;
  if ($('#ePenPresets')) $('#ePenPresets').hidden = !isStroke;
  if ($('#eEraserOpts')) $('#eEraserOpts').hidden = !isEraser;
  if ($('#ePinOpts')) $('#ePinOpts').hidden = !isPinOrTick;
  if ($('#eColorStrokeCol')) $('#eColorStrokeCol').hidden = isEraser;
  if ($('#eDashWrap')) $('#eDashWrap').hidden = !(['draw', 'rect', 'circle', 'line', 'arrow', 'poly', 'leader'].includes(t));
  if ($('#eFillWrap')) $('#eFillWrap').hidden = !isShapeFill;
  if ($('#eStrokeDec')) $('#eStrokeDec').hidden = isEraser || isPinOrTick;
  if ($('#eStrokeInc')) $('#eStrokeInc').hidden = isEraser || isPinOrTick;

  const lbl = $('#eSizeLbl');
  if (lbl) {
    if (t === 'draw') lbl.textContent = 'Pen Width';
    else if (isStroke) lbl.textContent = 'Stroke (px)';
    else if (isEraser) lbl.textContent = 'Eraser (px)';
    else if (isPinOrTick) lbl.textContent = 'Badge (px)';
    else lbl.textContent = 'Width (px)';
  }
  const cap = $('#eStyleCap');
  if (cap) {
    const capMap = {
      draw: 'Pen Options (Width, Dash, Colour & Alpha)',
      eraser: 'Eraser Options (Mode & Brush Radius)',
      pin: 'Pin Marker Options (Badge Size & Colour)',
      checkmk: 'Checkmark Options (Size & Colour)',
      crossmk: 'Cross Mark Options (Size & Colour)',
      rect: 'Box Options (Stroke Width, Dash, Fill & Colour)',
      circle: 'Circle Options (Stroke Width, Dash, Fill & Colour)',
      poly: 'Polygon Options (Stroke Width, Dash, Fill & Colour)',
      line: 'Line Options (Width, Dash & Colour)',
      arrow: 'Arrow Options (Width, Dash & Colour)',
      cloud: 'Revision Cloud Options (Width & Colour)',
      leader: 'Callout Options (Width & Colour)'
    };
    cap.textContent = capMap[t] || 'Active Tool Options';
  }
  if ($('#eSize')) syncSizePresetsUI($('#eSize').value);
}

function syncSwatchHighlight(col) {
  const low = String(col || '').toLowerCase();
  document.querySelectorAll('#eSwatches .rp-swatch').forEach(b => b.classList.toggle('on', (b.dataset.col || '').toLowerCase() === low));
}
function getActiveAlign() {
  if ($('#eAlignC') && $('#eAlignC').classList.contains('on')) return 'center';
  if ($('#eAlignR') && $('#eAlignR').classList.contains('on')) return 'right';
  return 'left';
}
function setActiveAlignUI(al) {
  ['#eAlignL', '#eAlignC', '#eAlignR'].forEach(sel => {
    const b = $(sel);
    if (b) b.classList.toggle('on', b.dataset.align === (al || 'left'));
  });
}
function syncFontSizeUI(ptVal) {
  const v = Math.max(4, Math.min(200, Math.round(+ptVal || 14)));
  if ($('#eFontSize')) $('#eFontSize').value = v;
  if ($('#eFontSizePreset')) {
    const match = [...$('#eFontSizePreset').options].some(o => +o.value === v);
    if (match) $('#eFontSizePreset').value = String(v);
  }
}
function syncRibbonFromSelectedAnn(a) {
  if (!a) { updateContextualToolDock(E.tool); return; }
  if (a.color) {
    $('#eColor').value = a.color;
    syncSwatchHighlight(a.color);
    if (a.t === 'text' && $('#eTextColor')) $('#eTextColor').value = a.color;
  }
  const sz = a.t === 'stamp' ? (a.fs || 18) : (['pin', 'checkmk', 'crossmk'].includes(a.t) ? (a.w || a.size || 22) : (a.size || 14));
  if (a.t === 'text' || a.t === 'stamp') {
    syncFontSizeUI(sz);
  } else if ($('#eSize')) {
    $('#eSize').value = Math.round(sz);
    syncSizePresetsUI(sz);
  }
  if (a.op != null && $('#eOp')) $('#eOp').value = Math.round(a.op * 100);
  if ($('#eFill')) $('#eFill').checked = !!a.fill;
  if (a.bgColor && $('#eBgColor')) $('#eBgColor').value = a.bgColor;
  if (a.dash && $('#eDash')) $('#eDash').value = a.dash;
  if (a.t === 'text') {
    if ($('#eFontFam')) $('#eFontFam').value = a.fam || 'Helvetica';
    if ($('#eBold')) $('#eBold').classList.toggle('on', !!a.bold);
    if ($('#eItalic')) $('#eItalic').classList.toggle('on', !!a.italic);
    if ($('#eUnderline')) $('#eUnderline').classList.toggle('on', !!a.underline);
    if ($('#eStrike')) $('#eStrike').classList.toggle('on', !!a.strike);
    if ($('#eTextBg')) $('#eTextBg').checked = !!a.bgBox;
    setActiveAlignUI(a.align || 'left');
  }
  updateContextualToolDock('select');
}

function setTool(t) {
  if (E.inlineText) commitInlineTextEditor();
  // Save current tool's size, color, opacity & dash before switching
  if (E.tool && !['text', 'edittext', 'select', 'hand'].includes(E.tool) && $('#eSize')) {
    saveToolSetting(E.tool, 'size', +$('#eSize').value || TOOLS_SIZE[E.tool] || 2);
  }
  if (E.tool && $('#eColor') && E.tool !== 'eraser') saveToolSetting(E.tool, 'color', $('#eColor').value);
  if (E.tool && $('#eOp') && E.tool !== 'eraser') saveToolSetting(E.tool, 'op', +$('#eOp').value || 100);
  if (E.tool && $('#eDash') && E.tool !== 'eraser') saveToolSetting(E.tool, 'dash', $('#eDash').value || 'solid');

  E.tool = t;
  E.polyPts = [];
  E.tmp = null;
  E.eraserCur = null;
  if (t !== 'select') E.sel = null;
  document.querySelectorAll('.rp-edit-ribbon button[data-t], #tools button, #ctools button, #mtools button[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === t));

  const savedSize = getToolSetting(t, 'size', TOOLS_SIZE[t] != null ? TOOLS_SIZE[t] : 3);
  if (!['text', 'edittext'].includes(t) && $('#eSize')) $('#eSize').value = savedSize;

  const savedCol = getToolSetting(t, 'color', TOOLS_DEFAULT_COLOR[t] || null);
  if (savedCol && $('#eColor')) $('#eColor').value = savedCol;
  const savedOp = getToolSetting(t, 'op', 100);
  if ($('#eOp') && t !== 'eraser') $('#eOp').value = savedOp;
  const savedDash = getToolSetting(t, 'dash', 'solid');
  if ($('#eDash') && t !== 'eraser') $('#eDash').value = savedDash;

  syncSwatchHighlight($('#eColor') ? $('#eColor').value : '#e11d48');
  updateContextualToolDock(t);

  E.img = null; E.stamp = null;
  $('#eov').style.cursor = t === 'select' ? 'default' : t === 'hand' ? 'grab' : (t === 'text' || t === 'edittext') ? 'text' : 'crosshair';
  if (t === 'image') pickImage(); if (t === 'sign') signPad(); if (t === 'stamp') stampPad();
  E.hov = null; setPE(); syncHudBar(); overlay();
  if (t === 'text') st('Type Text active — click anywhere on the PDF page to start typing directly on the page!');
  else if (t === 'edittext') st('Edit PDF Text active — click on any text on the PDF page to edit it in-place right on the page!');
  else if (t === 'hand') st('Hand tool active — drag anywhere on the page to pan.');
  else if (t === 'draw') st(`Freehand Pen active (${savedSize}px) — drag on the page to draw, or adjust Pen Width in the ribbon.`);
  else if (t === 'poly') st('Polygon/Polyline tool — click points on the page, double-click or press Enter to finish.');
  else if (t === 'area') st('Area Measurement tool — drag a rectangle or click polygon vertices (double-click or Enter to finish).');
  else if (t === 'eraser') st(`Eraser active (${E.eraserMode === 'brush' ? 'Brush Radius' : 'Whole Markup'}, ${savedSize}px) — click or drag over any markup to erase.`);
  else if (t === 'pin') st(`Pin Marker active (${savedSize}px) — click on the page to place a numbered inspection pin.`);
  else if (t === 'checkmk' || t === 'crossmk') st(`Click on the page to place a ${t === 'checkmk' ? 'Checkmark (✓)' : 'Cross (✗)'} (${savedSize}px).`);
  else if (t === 'select') st('Select tool — click an annotation to move/resize/style it, or double-click any text to edit inline.');
}
document.querySelectorAll('.rp-edit-ribbon button[data-t], #tools button, #ctools button, #mtools button[data-t]').forEach(b => b.onclick = () => setTool(b.dataset.t));

function applyFontSizeValue(val, recordUndo = true) {
  const v = Math.max(4, Math.min(200, Math.round(+val || 14)));
  syncFontSizeUI(v);
  saveToolSetting('text', 'size', v);
  if (E.inlineText) {
    E.inlineText.size = v;
    syncInlineTextEditorStyle();
  }
  if (E.sel && (E.sel.t === 'text' || E.sel.t === 'stamp')) {
    if (recordUndo) pushAnnState('Change font size');
    if (E.sel.t === 'stamp') E.sel.fs = v;
    else E.sel.size = v;
    overlay();
  }
}

function applyEditorSizeValue(val, recordUndo = true) {
  const v = Math.max(1, Math.min(200, +val || 1));
  if (E.tool === 'text' || E.tool === 'edittext' || (E.sel && E.sel.t === 'text') || E.inlineText) {
    applyFontSizeValue(v, recordUndo);
    return;
  }
  if ($('#eSize')) $('#eSize').value = v;
  syncSizePresetsUI(v);
  saveToolSetting(E.tool, 'size', v);
  if (E.sel) {
    if (recordUndo) pushAnnState('Change size');
    if (E.sel.t === 'stamp') E.sel.fs = v;
    else if (['pin', 'checkmk', 'crossmk'].includes(E.sel.t)) {
      E.sel.size = v;
      E.sel.w = v;
      E.sel.h = E.sel.t === 'pin' ? Math.round(v * 1.25) : v;
    } else {
      E.sel.size = v;
    }
  }
  overlay();
}

// Wire Swatches, Presets, Eraser Options, Pin Options & MS Office Font Controls
if ($('#eLoadFontBtn')) $('#eLoadFontBtn').onclick = loadCustomFontFile;
if ($('#eFontSizePreset')) {
  $('#eFontSizePreset').onchange = e => applyFontSizeValue(+e.target.value, true);
}
if ($('#eFontSize')) {
  $('#eFontSize').addEventListener('input', e => { if (+e.target.value >= 4) applyFontSizeValue(+e.target.value, false); });
  $('#eFontSize').addEventListener('change', e => { if (+e.target.value >= 4) applyFontSizeValue(+e.target.value, true); });
}
if ($('#eFontDec')) {
  $('#eFontDec').onclick = () => {
    const cur = +($('#eFontSize') ? $('#eFontSize').value : ($('#eSize') ? $('#eSize').value : 14)) || 14;
    const step = cur <= 10 ? 1 : 2;
    applyFontSizeValue(Math.max(4, cur - step), true);
  };
}
if ($('#eFontInc')) {
  $('#eFontInc').onclick = () => {
    const cur = +($('#eFontSize') ? $('#eFontSize').value : ($('#eSize') ? $('#eSize').value : 14)) || 14;
    const step = cur < 10 ? 1 : 2;
    applyFontSizeValue(Math.min(200, cur + step), true);
  };
}
if ($('#eStrokeDec')) {
  $('#eStrokeDec').onclick = () => {
    const cur = +$('#eSize').value || 3;
    applyEditorSizeValue(Math.max(1, cur - 1), true);
  };
}
if ($('#eStrokeInc')) {
  $('#eStrokeInc').onclick = () => {
    const cur = +$('#eSize').value || 3;
    applyEditorSizeValue(Math.min(120, cur + 1), true);
  };
}
if ($('#eClearMeasBtn')) {
  $('#eClearMeasBtn').onclick = () => ACT.clearMeasure && ACT.clearMeasure();
}
if ($('#eTextColor')) {
  let _txtColUndo = false;
  $('#eTextColor').addEventListener('pointerdown', () => { _txtColUndo = false; });
  $('#eTextColor').addEventListener('input', e => {
    const col = e.target.value;
    saveToolSetting('text', 'color', col);
    if (E.inlineText) {
      E.inlineText.color = col;
      syncInlineTextEditorStyle();
    }
    if (E.sel && (E.sel.t === 'text' || E.sel.t === 'stamp')) {
      if (!_txtColUndo) { pushAnnState('Change font colour'); _txtColUndo = true; }
      E.sel.color = col;
      overlay();
    }
  });
  $('#eTextColor').addEventListener('change', () => { _txtColUndo = false; });
}
document.querySelectorAll('#ePenPresets .rp-sz-pre').forEach(btn => {
  btn.onclick = () => applyEditorSizeValue(+btn.dataset.sz, true);
});
document.querySelectorAll('#eEraserOpts .rp-er-pre').forEach(btn => {
  btn.onclick = () => applyEditorSizeValue(+btn.dataset.er, false);
});
document.querySelectorAll('#ePinOpts .rp-pin-pre').forEach(btn => {
  btn.onclick = () => applyEditorSizeValue(+btn.dataset.psz, true);
});
if ($('#eEraserMode')) {
  $('#eEraserMode').onchange = e => {
    E.eraserMode = e.target.value;
    st(`Eraser mode: ${E.eraserMode === 'brush' ? 'Brush Radius (splits freehand strokes)' : 'Whole Markup (removes touched object)'}`);
  };
}
if ($('#eErasePageBtn')) {
  $('#eErasePageBtn').onclick = () => {
    const hasAnns = (E.ann[E.cur] && E.ann[E.cur].length) || (E.meas[E.cur] && E.meas[E.cur].length);
    if (!hasAnns) return st('No markups on this page to clear.');
    pushAnnState('Clear page markups');
    E.ann[E.cur] = [];
    E.meas[E.cur] = [];
    E.sel = null;
    overlay();
    updateDocInspector();
    st('Cleared all markups on current page.');
  };
}
document.querySelectorAll('#eSwatches .rp-swatch').forEach(btn => {
  btn.onclick = () => {
    const col = btn.dataset.col || '#e11d48';
    $('#eColor').value = col;
    syncSwatchHighlight(col);
    saveToolSetting(E.tool, 'color', col);
    if (E.sel) { pushAnnState('Change colour'); E.sel.color = col; overlay(); }
  };
});
let _colUndoPushed = false;
$('#eColor').addEventListener('pointerdown', () => { _colUndoPushed = false; });
$('#eColor').addEventListener('input', e => {
  syncSwatchHighlight(e.target.value);
  saveToolSetting(E.tool, 'color', e.target.value);
  if (E.sel) {
    if (!_colUndoPushed) { pushAnnState('Change colour'); _colUndoPushed = true; }
    E.sel.color = e.target.value;
    overlay();
  }
});
$('#eColor').addEventListener('change', () => { _colUndoPushed = false; });
$('#eSize').addEventListener('input', e => {
  if (+e.target.value > 0) applyEditorSizeValue(+e.target.value, false);
});
$('#eSize').addEventListener('change', e => {
  if (+e.target.value > 0) applyEditorSizeValue(+e.target.value, true);
});
$('#eOp').addEventListener('input', e => {
  const opVal = Math.max(.1, Math.min(1, (+e.target.value || 100) / 100));
  saveToolSetting(E.tool, 'op', Math.round(opVal * 100));
  if (E.sel) { E.sel.op = opVal; overlay(); }
});
$('#eOp').addEventListener('change', e => {
  const opVal = Math.max(.1, Math.min(1, (+e.target.value || 100) / 100));
  saveToolSetting(E.tool, 'op', Math.round(opVal * 100));
  if (E.sel) { pushAnnState('Change opacity'); E.sel.op = opVal; overlay(); }
});
$('#eFill').addEventListener('change', e => {
  if (E.sel && ['rect', 'circle', 'poly'].includes(E.sel.t)) {
    pushAnnState('Toggle fill');
    E.sel.fill = e.target.checked;
    if ($('#eBgColor')) E.sel.bgColor = $('#eBgColor').value;
    overlay();
  }
});
if ($('#eBgColor')) {
  let _bgUndoPushed = false;
  $('#eBgColor').addEventListener('pointerdown', () => { _bgUndoPushed = false; });
  $('#eBgColor').addEventListener('input', e => {
    if (E.inlineText) {
      E.inlineText.bgColor = e.target.value;
      syncInlineTextEditorStyle();
    }
    if (E.sel) {
      if (!_bgUndoPushed) { pushAnnState('Change fill colour'); _bgUndoPushed = true; }
      E.sel.bgColor = e.target.value;
      overlay();
    }
  });
  $('#eBgColor').addEventListener('change', () => { _bgUndoPushed = false; });
}
if ($('#eDash')) {
  $('#eDash').addEventListener('change', e => {
    saveToolSetting(E.tool, 'dash', e.target.value);
    if (E.sel) { pushAnnState('Change line style'); E.sel.dash = e.target.value; overlay(); }
  });
}
if ($('#eFontFam')) {
  $('#eFontFam').addEventListener('change', e => {
    if (E.inlineText) {
      E.inlineText.fam = e.target.value;
      syncInlineTextEditorStyle();
    }
    if (E.sel && (E.sel.t === 'text' || E.sel.t === 'stamp')) {
      pushAnnState('Change font family');
      E.sel.fam = e.target.value;
      overlay();
    }
  });
}
['#eBold', '#eItalic', '#eUnderline', '#eStrike'].forEach(sel => {
  const b = $(sel);
  if (!b) return;
  b.onclick = () => {
    b.classList.toggle('on');
    if (E.inlineText) {
      if (sel === '#eBold') E.inlineText.bold = b.classList.contains('on');
      if (sel === '#eItalic') E.inlineText.italic = b.classList.contains('on');
      if (sel === '#eUnderline') E.inlineText.underline = b.classList.contains('on');
      if (sel === '#eStrike') E.inlineText.strike = b.classList.contains('on');
      syncInlineTextEditorStyle();
    }
    if (E.sel && E.sel.t === 'text') {
      pushAnnState('Change text formatting');
      if (sel === '#eBold') E.sel.bold = b.classList.contains('on');
      if (sel === '#eItalic') E.sel.italic = b.classList.contains('on');
      if (sel === '#eUnderline') E.sel.underline = b.classList.contains('on');
      if (sel === '#eStrike') E.sel.strike = b.classList.contains('on');
      overlay();
    }
  };
});
['#eAlignL', '#eAlignC', '#eAlignR'].forEach(sel => {
  const b = $(sel);
  if (!b) return;
  b.onclick = () => {
    setActiveAlignUI(b.dataset.align);
    if (E.inlineText) {
      E.inlineText.align = b.dataset.align;
      syncInlineTextEditorStyle();
    }
    if (E.sel && E.sel.t === 'text') {
      pushAnnState('Change text alignment');
      E.sel.align = b.dataset.align;
      overlay();
    }
  };
});
if ($('#eTextBg')) {
  $('#eTextBg').addEventListener('change', e => {
    if (E.inlineText) {
      E.inlineText.bgBox = e.target.checked;
      if ($('#eBgColor')) E.inlineText.bgColor = $('#eBgColor').value;
      syncInlineTextEditorStyle();
    }
    if (E.sel && E.sel.t === 'text') {
      pushAnnState('Toggle text box background');
      E.sel.bgBox = e.target.checked;
      if ($('#eBgColor')) E.sel.bgColor = $('#eBgColor').value;
      overlay();
    }
  });
}

function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
async function pickImage() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/webp';
  inp.onchange = async () => { const f = inp.files[0]; if (!f) return setTool('select'); const url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); }); E.img = { dataUrl: url, img: await loadImg(url) }; st('Click on the page to place the image.'); };
  inp.click();
}
async function signPad() {
  const r = await dialog('Draw your signature', [{ type: 'pad', id: 'sig', label: '' }, { type: 'note', label: 'Draw with the mouse or touch. It is placed as an image you can move and resize.' }], 'Use');
  if (!r || !r.sig) return setTool('select'); E.img = { dataUrl: r.sig, img: await loadImg(r.sig) }; st('Click on the page to place the signature.');
}

async function openRichTextDialog(initial = {}) {
  const fam = initial.fam || ($('#eFontFam') ? $('#eFontFam').value : 'Helvetica');
  const size = initial.size || (+$('#eSize').value || 14);
  const bold = initial.bold != null ? initial.bold : ($('#eBold') ? $('#eBold').classList.contains('on') : false);
  const italic = initial.italic != null ? initial.italic : ($('#eItalic') ? $('#eItalic').classList.contains('on') : false);
  const underline = initial.underline != null ? initial.underline : ($('#eUnderline') ? $('#eUnderline').classList.contains('on') : false);
  const strike = initial.strike != null ? initial.strike : ($('#eStrike') ? $('#eStrike').classList.contains('on') : false);
  const align = initial.align || getActiveAlign();
  const bgBox = initial.bgBox != null ? initial.bgBox : ($('#eTextBg') ? $('#eTextBg').checked : false);
  const bgColor = initial.bgColor || ($('#eBgColor') ? $('#eBgColor').value : '#fffbeb');
  const color = initial.color || ($('#eColor') ? $('#eColor').value : '#e11d48');

  return await dialog(initial.title || 'Add Rich Text Annotation', [
    { type: 'textarea', id: 'v', label: 'Text Content (Multi-line & Unicode supported):', rows: 4, value: initial.text || '' },
    { type: 'symbols' },
    { type: 'select', id: 'fam', label: 'Font Family', value: fam, options: getFontOptionsList() },
    { type: 'number', id: 'size', label: 'Font Size (pt)', value: size, min: 4, max: 200 },
    { type: 'select', id: 'align', label: 'Text Alignment', value: align, options: [{ label: 'Left Align', value: 'left' }, { label: 'Center Align', value: 'center' }, { label: 'Right Align', value: 'right' }] },
    { type: 'color', id: 'color', label: 'Text Colour', value: color },
    { type: 'checkbox', id: 'bold', label: 'Bold', value: bold },
    { type: 'checkbox', id: 'italic', label: 'Italic', value: italic },
    { type: 'checkbox', id: 'underline', label: 'Underline', value: underline },
    { type: 'checkbox', id: 'strike', label: 'Strikethrough', value: strike },
    { type: 'checkbox', id: 'bgBox', label: 'Draw Background Callout Box', value: bgBox },
    { type: 'color', id: 'bgColor', label: 'Box Background Colour', value: bgColor }
  ], initial.okLabel || 'Add Text');
}

// ---------- Direct On-Page WYSIWYG Inline Text Editor (MS Office / Acrobat Style) ----------
function syncInlineTextEditorStyle() {
  const stObj = E.inlineText;
  const box = $('#rp-inline-text-box');
  const ta = $('#rp-inline-textarea');
  if (!stObj || !box || !ta) return;
  const k = K();
  box.style.left = Math.round(stObj.x * k) + 'px';
  box.style.top = Math.round(stObj.y * k) + 'px';

  const scaledPx = Math.max(10, (stObj.size || 14) * k);
  ta.style.fontFamily = cssFam(stObj.fam || 'Helvetica');
  ta.style.fontSize = scaledPx + 'px';
  ta.style.lineHeight = '1.22';
  ta.style.fontWeight = stObj.bold ? 'bold' : 'normal';
  ta.style.fontStyle = stObj.italic ? 'italic' : 'normal';
  const dec = [];
  if (stObj.underline) dec.push('underline');
  if (stObj.strike) dec.push('line-through');
  ta.style.textDecoration = dec.length ? dec.join(' ') : 'none';
  ta.style.textAlign = stObj.align || 'left';
  ta.style.color = stObj.color || '#111827';
  ta.style.background = stObj.bgBox ? (stObj.bgColor || '#fffbeb') : 'rgba(255, 255, 255, 0.94)';

  // Auto-resize width & height to fit typed lines
  const lines = String(ta.value || ta.placeholder || 'Type here').split('\n');
  const c = _scratchCtx;
  c.font = `${stObj.italic ? 'italic ' : ''}${stObj.bold ? 'bold ' : ''}${scaledPx}px ${cssFam(stObj.fam || 'Helvetica')}`;
  const maxW = Math.max(130, ...lines.map(l => c.measureText(l || ' ').width + 28));
  ta.style.width = Math.ceil(maxW) + 'px';
  ta.style.height = Math.ceil(Math.max(scaledPx * 1.45, lines.length * scaledPx * 1.25 + 10)) + 'px';
}

function openInlineTextEditor(opts = {}) {
  if (E.inlineText) commitInlineTextEditor();
  const wrap = $('#ewrap');
  if (!wrap || !E.doc) return null;

  const mode = opts.mode || 'new'; // 'new' | 'editAnn' | 'pdfItem'
  const ann = opts.ann || null;
  const pdfItem = opts.item || null;

  const defaultFam = (pdfItem ? famOf(pdfItem) : (ann ? ann.fam : ($('#eFontFam') ? $('#eFontFam').value : 'Helvetica'))) || 'Helvetica';
  const defaultSize = pdfItem ? Math.round(pdfItem.h || 12) : (ann ? (ann.size || 14) : (+($('#eFontSize') ? $('#eFontSize').value : 14) || 14));
  const defaultColor = pdfItem ? '#111827' : (ann ? (ann.color || '#111827') : ($('#eTextColor') ? $('#eTextColor').value : ($('#eColor') ? $('#eColor').value : '#111827')));
  const defaultBold = pdfItem ? !!pdfItem.bold : (ann ? !!ann.bold : ($('#eBold') ? $('#eBold').classList.contains('on') : false));
  const defaultItalic = pdfItem ? !!pdfItem.italic : (ann ? !!ann.italic : ($('#eItalic') ? $('#eItalic').classList.contains('on') : false));
  const defaultUnderline = ann ? !!ann.underline : ($('#eUnderline') ? $('#eUnderline').classList.contains('on') : false);
  const defaultStrike = ann ? !!ann.strike : ($('#eStrike') ? $('#eStrike').classList.contains('on') : false);
  const defaultAlign = ann ? (ann.align || 'left') : getActiveAlign();
  const defaultBgBox = ann ? !!ann.bgBox : ($('#eTextBg') ? $('#eTextBg').checked : false);
  const defaultBgColor = ann ? (ann.bgColor || '#fffbeb') : ($('#eBgColor') ? $('#eBgColor').value : '#fffbeb');
  const startX = pdfItem ? pdfItem.x : (ann ? ann.x : (opts.x || 50));
  const startY = pdfItem ? (pdfItem.base - defaultSize * BASE) : (ann ? ann.y : (opts.y || 50));
  const initialText = pdfItem ? pdfItem.str : (ann ? (ann.text || '') : (opts.text || ''));

  // Sync top MS Office Font ribbon controls to match this text box
  if ($('#eFontFam')) $('#eFontFam').value = defaultFam;
  syncFontSizeUI(defaultSize);
  if ($('#eTextColor')) $('#eTextColor').value = defaultColor;
  if ($('#eBold')) $('#eBold').classList.toggle('on', defaultBold);
  if ($('#eItalic')) $('#eItalic').classList.toggle('on', defaultItalic);
  if ($('#eUnderline')) $('#eUnderline').classList.toggle('on', defaultUnderline);
  if ($('#eStrike')) $('#eStrike').classList.toggle('on', defaultStrike);
  if ($('#eTextBg')) $('#eTextBg').checked = defaultBgBox;
  if ($('#eBgColor')) $('#eBgColor').value = defaultBgColor;
  setActiveAlignUI(defaultAlign);

  // Temporarily hide existing annotation while editing it inline so it doesn't double-render underneath
  if (mode === 'editAnn' && ann) {
    ann._editingInline = true;
    overlay();
  }

  E.inlineText = {
    mode,
    ann,
    pdfItem,
    x: startX,
    y: startY,
    fam: defaultFam,
    size: defaultSize,
    color: defaultColor,
    bold: defaultBold,
    italic: defaultItalic,
    underline: defaultUnderline,
    strike: defaultStrike,
    align: defaultAlign,
    bgBox: defaultBgBox,
    bgColor: defaultBgColor
  };

  let box = $('#rp-inline-text-box');
  if (box) box.remove();
  box = document.createElement('div');
  box.id = 'rp-inline-text-box';
  box.className = 'rp-inline-text-box';
  box.innerHTML = `
    <div class="rp-inline-text-bar" id="rp-inline-drag-bar">
      <span class="rp-inline-drag-lbl" title="Drag to reposition text box on page">⠿ ${mode === 'pdfItem' ? 'Edit PDF Text' : 'Type on PDF'}</span>
      <div class="rp-inline-syms">
        ${['Ω', 'µ', '±', '⌀', '°', 'Δ', '✓', '✗'].map(s => `<button type="button" class="rp-inline-sym" data-sym="${s}" title="Insert ${s}">${s}</button>`).join('')}
      </div>
      <button type="button" class="rp-inline-ok" id="rp-inline-text-ok" title="Apply Text to PDF Page (Ctrl+Enter)">✓ Done</button>
      <button type="button" class="rp-inline-cancel" id="rp-inline-text-cancel" title="Cancel (Esc)">✕</button>
    </div>
    <textarea id="rp-inline-textarea" rows="1" placeholder="Type text here..."></textarea>
  `;
  wrap.appendChild(box);

  const ta = box.querySelector('#rp-inline-textarea');
  ta.value = initialText;
  syncInlineTextEditorStyle();

  // Prevent pointer events inside the inline box from triggering canvas drawing
  box.addEventListener('pointerdown', ev => ev.stopPropagation());
  box.addEventListener('click', ev => ev.stopPropagation());
  box.addEventListener('dblclick', ev => ev.stopPropagation());

  // Dragging the inline text box via its mini-bar
  const dragBar = box.querySelector('#rp-inline-drag-bar');
  let dragState = null;
  dragBar.addEventListener('pointerdown', ev => {
    if (ev.target.tagName === 'BUTTON') return;
    ev.preventDefault();
    ev.stopPropagation();
    dragState = { sx: ev.clientX, sy: ev.clientY, ox: E.inlineText.x, oy: E.inlineText.y };
    dragBar.setPointerCapture(ev.pointerId);
  });
  dragBar.addEventListener('pointermove', ev => {
    if (!dragState || !E.inlineText) return;
    E.inlineText.x = dragState.ox + (ev.clientX - dragState.sx) / K();
    E.inlineText.y = dragState.oy + (ev.clientY - dragState.sy) / K();
    syncInlineTextEditorStyle();
  });
  dragBar.addEventListener('pointerup', () => {
    dragState = null;
    if (ta) ta.focus();
  });

  // Quick symbol buttons
  box.querySelectorAll('.rp-inline-sym').forEach(btn => {
    btn.onclick = ev => {
      ev.preventDefault();
      ev.stopPropagation();
      const sym = btn.dataset.sym;
      const s0 = ta.selectionStart ?? ta.value.length;
      const s1 = ta.selectionEnd ?? ta.value.length;
      ta.value = ta.value.slice(0, s0) + sym + ta.value.slice(s1);
      syncInlineTextEditorStyle();
      ta.focus();
      ta.selectionStart = ta.selectionEnd = s0 + sym.length;
    };
  });

  box.querySelector('#rp-inline-text-ok').onclick = ev => {
    ev.preventDefault();
    ev.stopPropagation();
    commitInlineTextEditor();
  };
  box.querySelector('#rp-inline-text-cancel').onclick = ev => {
    ev.preventDefault();
    ev.stopPropagation();
    cancelInlineTextEditor();
  };

  ta.addEventListener('input', () => syncInlineTextEditorStyle());
  ta.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      cancelInlineTextEditor();
    } else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey || (E.inlineText && E.inlineText.mode === 'pdfItem' && !ev.shiftKey))) {
      ev.preventDefault();
      ev.stopPropagation();
      commitInlineTextEditor();
    }
  });

  setTimeout(() => {
    ta.focus();
    if (mode === 'pdfItem' || mode === 'editAnn') ta.select();
  }, 10);

  st(mode === 'pdfItem'
    ? 'Editing PDF text inline — type replacement text and press Enter or click ✓ Done (use Font bar above to change font/size/color).'
    : 'Typing directly on PDF — use Font bar above to change font/size/style, press Ctrl+Enter or click ✓ Done when finished.');
  return E.inlineText;
}

function commitInlineTextEditor() {
  const stObj = E.inlineText;
  if (!stObj) return false;
  const box = $('#rp-inline-text-box');
  const ta = $('#rp-inline-textarea');
  const rawVal = ta ? ta.value : '';
  const textVal = rawVal.replace(/\r\n/g, '\n').trimEnd();

  if (box) box.remove();
  E.inlineText = null;

  if (stObj.mode === 'editAnn' && stObj.ann) {
    delete stObj.ann._editingInline;
    if (!textVal.trim()) {
      pushAnnState('Delete empty text annotation');
      E.ann[E.cur] = (E.ann[E.cur] || []).filter(a => a !== stObj.ann);
      if (E.sel === stObj.ann) E.sel = null;
      overlay(); updateDocInspector();
      return true;
    }
    pushAnnState('Edit text annotation');
    Object.assign(stObj.ann, {
      x: stObj.x,
      y: stObj.y,
      text: textVal,
      fam: stObj.fam,
      size: stObj.size,
      color: stObj.color,
      bold: !!stObj.bold,
      italic: !!stObj.italic,
      underline: !!stObj.underline,
      strike: !!stObj.strike,
      align: stObj.align || 'left',
      bgBox: !!stObj.bgBox,
      bgColor: stObj.bgColor || '#fffbeb'
    });
    E.sel = stObj.ann;
    overlay(); updateDocInspector();
    st('Updated text annotation on page.');
    return true;
  }

  if (stObj.mode === 'pdfItem' && stObj.pdfItem) {
    const t = stObj.pdfItem;
    if (textVal === t.str && stObj.fam === famOf(t) && stObj.size === Math.round(t.h || 12) && stObj.color === '#111827') {
      overlay();
      return false;
    }
    pushAnnState('In-place PDF text edit');
    const g = 'g' + Date.now();
    addAnn({ t: 'whiteout', x: t.x - 1.5, y: t.base - t.h * .88, w: t.w + 4, h: t.h * 1.2 + 2, color: '#ffffff', size: 1, g, op: 1 }, true);
    if (textVal.trim()) {
      addAnn({
        t: 'text',
        x: stObj.x,
        y: stObj.y,
        text: textVal,
        color: stObj.color || '#111827',
        size: stObj.size || t.h,
        fam: stObj.fam || famOf(t),
        bold: !!stObj.bold,
        italic: !!stObj.italic,
        underline: !!stObj.underline,
        strike: !!stObj.strike,
        align: stObj.align || 'left',
        bgBox: !!stObj.bgBox,
        bgColor: stObj.bgColor || '#fffbeb',
        g,
        op: 1
      }, true);
    }
    overlay(); updateDocInspector();
    st('PDF text updated in-place. Press Ctrl+Z to undo or Save to keep.');
    return true;
  }

  if (!textVal.trim()) {
    overlay();
    return false;
  }
  addAnn({
    t: 'text',
    x: stObj.x,
    y: stObj.y,
    text: textVal,
    color: stObj.color || '#111827',
    size: +stObj.size || 14,
    fam: stObj.fam || 'Helvetica',
    bold: !!stObj.bold,
    italic: !!stObj.italic,
    underline: !!stObj.underline,
    strike: !!stObj.strike,
    align: stObj.align || 'left',
    bgBox: !!stObj.bgBox,
    bgColor: stObj.bgColor || '#fffbeb'
  });
  st('Placed text on PDF page — click another spot to type more, or switch to Select (V) to move/resize.');
  return true;
}

function cancelInlineTextEditor() {
  const stObj = E.inlineText;
  const box = $('#rp-inline-text-box');
  if (box) box.remove();
  if (stObj && stObj.mode === 'editAnn' && stObj.ann) {
    delete stObj.ann._editingInline;
  }
  E.inlineText = null;
  overlay();
  st('Cancelled text edit.');
}

const ov = $('#eov'); const pt = e => [e.offsetX / K(), e.offsetY / K()];
ov.onpointerdown = async e => {
  if (!E.doc) return; const [x, y] = pt(e), col = $('#eColor').value, size = +$('#eSize').value || 2, t = E.tool;
  if (t === 'hand' || e.button === 1) {
    const ev = $('#eview');
    E.pan = { sx: e.clientX, sy: e.clientY, sl: ev.scrollLeft, st: ev.scrollTop };
    ov.style.cursor = 'grabbing';
    ov.setPointerCapture(e.pointerId);
    return;
  }
  if (t === 'eraser') {
    E.eraserCur = [x, y];
    pushAnnState('Erase markup');
    const erased = eraseAtPoint(x, y);
    E.erasedAny = erased;
    overlay();
    if (erased) updateDocInspector();
    E.erasing = true;
    ov.setPointerCapture(e.pointerId);
    return;
  }
  if (t === 'pin') {
    const pSz = Math.max(12, +$('#eSize').value || 24);
    const pH = Math.round(pSz * 1.25);
    const pinNum = E.nextPinNum++;
    addAnn({ t: 'pin', x: x - pSz / 2, y: y - pH, w: pSz, h: pH, size: pSz, pinNum, text: '', color: col || '#f59e0b' });
    st(`Placed Inspection Pin #${pinNum} — double-click in Select mode to add/edit callout note.`);
    return;
  }
  if (t === 'checkmk' || t === 'crossmk') {
    const mSz = Math.max(10, +$('#eSize').value || 22);
    addAnn({ t, x: x - mSz / 2, y: y - mSz / 2, w: mSz, h: mSz, color: col || (t === 'checkmk' ? '#059669' : '#e11d48'), size: mSz });
    return;
  }
  if (t === 'poly' || t === 'area') {
    const prev = E.polyPts[E.polyPts.length - 1];
    if (E.polyPts.length >= 3 && Math.hypot(x - E.polyPts[0][0], y - E.polyPts[0][1]) <= 10 / K()) {
      finishPolygonTool();
      return;
    }
    if (!prev || Math.hypot(x - prev[0], y - prev[1]) > 2 / K()) {
      E.polyPts.push([x, y]);
    }
    E._polyDragStart = (E.polyPts.length === 1 && t === 'area') ? [x, y] : null;
    E.tmp = {
      t,
      pts: [...E.polyPts, [x, y]],
      color: col || (t === 'area' ? '#10b981' : '#e11d48'),
      size,
      dash: $('#eDash') ? $('#eDash').value : 'solid',
      fill: t === 'area' ? true : $('#eFill').checked,
      bgColor: $('#eBgColor') ? $('#eBgColor').value : col
    };
    overlay();
    return;
  }
  if (E.inlineText) {
    const hadText = commitInlineTextEditor();
    if (hadText && (t === 'text' || t === 'edittext')) return;
  }
  if (t === 'edittext') {
    const existingAnn = hit(x, y);
    if (existingAnn && existingAnn.t === 'text') {
      openInlineTextEditor({ mode: 'editAnn', ann: existingAnn });
      return;
    }
    const it = itemAt(x, y);
    if (it) openInlineTextEditor({ mode: 'pdfItem', item: it });
    else openInlineTextEditor({ mode: 'new', x, y });
    return;
  }
  if (t === 'select') {
    const hdl = E.sel ? hitHandle(E.sel, x, y) : null;
    if (hdl && E.sel) {
      pushAnnState('Resize annotation');
      const [bx, by, bw, bh] = bbox(E.sel);
      E.drag = { x, y, hdl, orig: { ...E.sel, pts: E.sel.pts ? E.sel.pts.map(p => [...p]) : undefined, bx, by, bw, bh } };
      ov.setPointerCapture(e.pointerId);
      return;
    }
    E.sel = hit(x, y);
    if (E.sel) {
      pushAnnState('Move annotation');
      E.drag = { x, y, moved: false };
      ov.setPointerCapture(e.pointerId);
      syncRibbonFromSelectedAnn(E.sel);
    } else {
      updateContextualToolDock('select');
    }
    overlay(); return;
  }
  if (t === 'text') {
    const existingAnn = hit(x, y);
    if (existingAnn) {
      E.sel = existingAnn;
      pushAnnState('Move annotation');
      E.drag = { x, y, moved: false };
      ov.setPointerCapture(e.pointerId);
      syncRibbonFromSelectedAnn(existingAnn);
      overlay();
      return;
    }
    openInlineTextEditor({ mode: 'new', x, y });
    return;
  }
  if ((t === 'image' || t === 'sign') && E.img) { const w = Math.min(160, E.img.img.width), h = w * E.img.img.height / E.img.img.width; addAnn({ t: 'image', x: x - w / 2, y: y - h / 2, w, h, img: E.img.img, dataUrl: E.img.dataUrl }); E.img = null; setTool('select'); return; }
  if (t === 'measure') { E.tmp = { t: 'meas', x1: x, y1: y, x2: x, y2: y, color: '#0066ff', size: 1.5 }; ov.setPointerCapture(e.pointerId); return; }
  if (t === 'cnote') { if (!await ensureAuthor()) return; const r = await dialog('Add note', [{ type: 'textarea', id: 'v', label: '', rows: 4 }, { type: 'note', label: 'Saved in the PDF as a real comment. Other PDF viewers can read it.' }], 'Add'); if (r && r.v) await addNote(E.cur, x, y, r.v); return; }
  if (t === 'stamp') { if (!E.stamp) return; const fs = 20, c = _scratchCtx; c.font = `bold ${fs}px Helvetica,Arial,sans-serif`; const w = c.measureText(E.stamp.text).width + 28, h = 34; addAnn({ t: 'stamp', x: x - w / 2, y: y - h / 2, w, h, fs, text: E.stamp.text, color: E.stamp.color }); E.stamp = null; setTool('select'); return; }
  if (t === 'chl' || t === 'cul' || t === 'cst') E.tmp = { t: 'crect', x, y, w: 0, h: 0, ox: x, oy: y, color: col, size: 1, kind: t };
  else if (t === 'draw') E.tmp = { t: 'draw', pts: [[x, y]], color: col, size, dash: $('#eDash') ? $('#eDash').value : 'solid' };
  else if (t === 'line' || t === 'arrow' || t === 'leader') E.tmp = { t, x1: x, y1: y, x2: x, y2: y, text: 'Callout', color: col, size, dash: $('#eDash') ? $('#eDash').value : 'solid' };
  else if (['rect', 'circle', 'cloud', 'highlight', 'whiteout', 'redact'].includes(t)) E.tmp = { t, x, y, w: 0, h: 0, ox: x, oy: y, revText: 'Δ Rev 2', color: col, size, dash: $('#eDash') ? $('#eDash').value : 'solid', fill: $('#eFill').checked, bgColor: $('#eBgColor') ? $('#eBgColor').value : col };
  if (E.tmp) ov.setPointerCapture(e.pointerId);
};
ov.onpointermove = e => {
  if (E.pan) {
    const ev = $('#eview');
    ev.scrollLeft = E.pan.sl - (e.clientX - E.pan.sx);
    ev.scrollTop = E.pan.st - (e.clientY - E.pan.sy);
    return;
  }
  const [x, y] = pt(e);
  if (E.tool === 'eraser') {
    E.eraserCur = [x, y];
    if (E.erasing) {
      if (eraseAtPoint(x, y)) {
        E.erasedAny = true;
        updateDocInspector();
      }
    }
    overlay();
    if (E.erasing) return;
  }
  if ((E.tool === 'poly' || E.tool === 'area') && E.polyPts.length && E.tmp) {
    if (E.tool === 'area' && E._polyDragStart && e.buttons === 1 && E.polyPts.length === 1) {
      const [sx, sy] = E._polyDragStart;
      if (Math.hypot(x - sx, y - sy) > 8 / K()) {
        E.tmp.pts = [[sx, sy], [x, sy], [x, y], [sx, y]];
        overlay();
        return;
      }
    }
    E.tmp.pts = [...E.polyPts, [x, y]];
    overlay();
    return;
  }
  if (E.tool === 'edittext') { const it = itemAt(x, y); if (it !== E.hov) { E.hov = it; overlay(); } return; }
  if (E.drag && E.sel) {
    E.drag.moved = true;
    if (E.drag.hdl) {
      const o = E.drag.orig, dx = x - E.drag.x, dy = y - E.drag.y, m = E.drag.hdl;
      if (('w' in E.sel) && ('h' in E.sel)) {
        let x0 = o.x, y0 = o.y, x1 = o.x + o.w, y1 = o.y + o.h;
        if (m.includes('w')) x0 += dx;
        if (m.includes('e')) x1 += dx;
        if (m.includes('n')) y0 += dy;
        if (m.includes('s')) y1 += dy;
        E.sel.x = Math.min(x0, x1);
        E.sel.y = Math.min(y0, y1);
        E.sel.w = Math.max(12, Math.abs(x1 - x0));
        E.sel.h = Math.max(12, Math.abs(y1 - y0));
        if (E.sel.t === 'stamp' && o.fs) {
          E.sel.fs = Math.max(8, Math.round(o.fs * (E.sel.h / Math.max(12, o.h))));
        }
      } else if (E.sel.t === 'text') {
        const scale = Math.max(0.3, (o.bh + (m.includes('s') ? dy : -dy)) / Math.max(10, o.bh));
        E.sel.size = Math.max(6, Math.min(200, Math.round((o.size || 14) * scale)));
        if ($('#eSize')) $('#eSize').value = E.sel.size;
      } else if ('x2' in E.sel) {
        if (m === 'nw' || m === 'sw') { E.sel.x1 = x; E.sel.y1 = y; }
        else { E.sel.x2 = x; E.sel.y2 = y; }
      } else if (E.sel.pts && o.pts) {
        let x0 = o.bx, y0 = o.by, x1 = o.bx + o.bw, y1 = o.by + o.bh;
        if (m.includes('w')) x0 += dx;
        if (m.includes('e')) x1 += dx;
        if (m.includes('n')) y0 += dy;
        if (m.includes('s')) y1 += dy;
        const nx = Math.min(x0, x1), ny = Math.min(y0, y1);
        const nw = Math.max(12, Math.abs(x1 - x0)), nh = Math.max(12, Math.abs(y1 - y0));
        const sx = nw / Math.max(1, o.bw), sy = nh / Math.max(1, o.bh);
        E.sel.pts = o.pts.map(p => [nx + (p[0] - o.bx) * sx, ny + (p[1] - o.by) * sy]);
      }
    } else {
      moveAnn(E.sel, x - E.drag.x, y - E.drag.y);
      E.drag = { ...E.drag, x, y };
    }
    overlay();
    return;
  }
  const a = E.tmp; if (!a) return;
  if (a.t === 'draw') a.pts.push([x, y]);
  else if ('x1' in a) { a.x2 = x; a.y2 = y; }
  else {
    let w = Math.abs(x - a.ox), h = Math.abs(y - a.oy);
    if (e.shiftKey && (a.t === 'circle' || a.t === 'rect')) { w = h = Math.max(w, h); }
    a.x = x < a.ox ? a.ox - w : a.ox;
    a.y = y < a.oy ? a.oy - h : a.oy;
    a.w = w; a.h = h;
  }
  overlay();
};
ov.onpointerup = async () => {
  if (E.pan) { E.pan = null; ov.style.cursor = E.tool === 'hand' ? 'grab' : 'default'; return; }
  if (E.erasing) { if (!E.erasedAny && E.annUndo.length) E.annUndo.pop(); E.erasing = false; E.erasedAny = false; return; }
  if (E.tool === 'poly' || E.tool === 'area') {
    if (E.tool === 'area' && E._polyDragStart && E.tmp && E.tmp.pts && E.tmp.pts.length === 4 && E.polyPts.length === 1) {
      const pts = E.tmp.pts;
      E.polyPts = [];
      E._polyDragStart = null;
      E.tmp = null;
      pushAnnState('Add area measurement');
      (E.meas[E.cur] = E.meas[E.cur] || []).push({
        t: 'area',
        pts,
        closed: true,
        color: $('#eColor').value || '#10b981',
        size: +$('#eSize').value || 2
      });
      overlay(); updateDocInspector();
      return;
    }
    E._polyDragStart = null;
    return; // finished on dblclick or Enter
  }
  if (E.drag) {
    if (!E.drag.moved && !E.drag.hdl && E.annUndo.length) E.annUndo.pop();
    E.drag = null;
  }
  const a = E.tmp; if (!a) return; E.tmp = null;
  const [, , w, h] = bbox(a);
  if (a.t === 'meas') {
    if (w > 2 || h > 2) {
      pushAnnState('Add measurement');
      (E.meas[E.cur] = E.meas[E.cur] || []).push(a);
    }
    overlay(); updateDocInspector();
    return;
  }
  if (a.t === 'crect') { overlay(); if (w > 3 && h > 3) finishMarkup(a); return; }
  if (a.t === 'leader' && (w > 4 || h > 4)) {
    const r = await dialog('Leader Callout Text', [{ id: 'txt', label: 'Annotation Text', value: 'Check tolerance & clearance' }, { type: 'symbols' }], 'Add Callout');
    if (r && r.txt) { a.text = r.txt; addAnn(a); } else overlay();
    return;
  }
  if (w > 2 || h > 2 || a.t === 'draw') { delete a.ox; delete a.oy; addAnn(a); } else overlay();
};

function finishPolygonTool() {
  if ((E.tool !== 'poly' && E.tool !== 'area') || E.polyPts.length < (E.tool === 'area' ? 3 : 2)) {
    E.polyPts = []; E.tmp = null; overlay(); return;
  }
  const pts = [...E.polyPts];
  const toolType = E.tool;
  E.polyPts = [];
  E.tmp = null;
  if (toolType === 'area') {
    pushAnnState('Add area measurement');
    (E.meas[E.cur] = E.meas[E.cur] || []).push({
      t: 'area',
      pts,
      closed: true,
      color: $('#eColor').value || '#10b981',
      size: +$('#eSize').value || 2
    });
    overlay(); updateDocInspector();
  } else {
    addAnn({
      t: 'poly',
      pts,
      closed: pts.length >= 3,
      color: $('#eColor').value,
      size: +$('#eSize').value || 2,
      dash: $('#eDash') ? $('#eDash').value : 'solid',
      fill: $('#eFill').checked,
      bgColor: $('#eBgColor') ? $('#eBgColor').value : $('#eColor').value
    });
  }
}

ov.ondblclick = async e => {
  if (!E.doc) return;
  if (E.tool === 'poly' || E.tool === 'area') {
    e.preventDefault();
    finishPolygonTool();
    return;
  }
  if (!['select', 'text', 'edittext'].includes(E.tool)) return;
  const [x, y] = pt(e), a = hit(x, y) || E.sel;
  if (!a) return;
  E.sel = a; overlay();
  if (a.t === 'text') {
    openInlineTextEditor({ mode: 'editAnn', ann: a });
  } else if (a.t === 'leader') {
    const r = await dialog('Edit Leader Callout', [{ id: 'v', label: 'Callout Text', value: a.text || 'Callout' }, { type: 'symbols' }], 'Update');
    if (r && r.v) { pushAnnState('Edit callout'); a.text = r.v; overlay(); }
  } else if (a.t === 'cloud') {
    const r = await dialog('Edit Revision Cloud Label', [{ id: 'v', label: 'Delta Tag', value: a.revText || 'Δ Rev 2' }, { type: 'symbols' }], 'Update');
    if (r && r.v != null) { pushAnnState('Edit revision cloud'); a.revText = r.v; overlay(); }
  } else if (a.t === 'stamp') {
    const r = await dialog('Edit Stamp Text', [{ id: 'v', label: 'Stamp Label', value: a.text || 'APPROVED' }], 'Update');
    if (r && r.v) { pushAnnState('Edit stamp'); a.text = r.v; overlay(); }
  } else if (a.t === 'pin') {
    const r = await dialog(`Edit Inspection Pin #${a.pinNum || 1}`, [
      { id: 'v', label: 'Pin Callout Tag / Note', value: a.text || '' },
      { type: 'symbols' },
      { type: 'color', id: 'col', label: 'Pin Colour', value: a.color || '#f59e0b' }
    ], 'Update Pin');
    if (r) { pushAnnState('Edit pin'); a.text = r.v || ''; if (r.col) a.color = r.col; overlay(); }
  }
};
ov.addEventListener('pointerleave', () => {
  if (E.eraserCur) { E.eraserCur = null; overlay(); }
});

// Keyboard Nudge, Polygon Enter, Copy/Paste/Duplicate Selected Annotation
function duplicateSelectedAnn() {
  if (!E.sel) return false;
  const copy = JSON.parse(JSON.stringify(E.sel));
  if (E.sel.img) copy.img = E.sel.img;
  if (copy.t === 'pin') copy.pinNum = E.nextPinNum++;
  moveAnn(copy, 14, 14);
  if (copy.t === 'meas' || copy.t === 'area') {
    pushAnnState('Duplicate measurement');
    (E.meas[E.cur] = E.meas[E.cur] || []).push(copy);
    E.sel = copy; overlay(); updateDocInspector();
  } else {
    addAnn(copy);
  }
  st('Duplicated selected annotation');
  return true;
}
function bringSelToFront() {
  if (!E.sel) return;
  const isMeas = (E.sel.t === 'meas' || E.sel.t === 'area') && E.meas[E.cur] && E.meas[E.cur].includes(E.sel);
  const bucket = isMeas ? E.meas : E.ann;
  if (!bucket[E.cur]) return;
  pushAnnState('Bring to front');
  const list = bucket[E.cur].filter(a => a !== E.sel);
  list.push(E.sel);
  bucket[E.cur] = list;
  overlay();
}
function sendSelToBack() {
  if (!E.sel) return;
  const isMeas = (E.sel.t === 'meas' || E.sel.t === 'area') && E.meas[E.cur] && E.meas[E.cur].includes(E.sel);
  const bucket = isMeas ? E.meas : E.ann;
  if (!bucket[E.cur]) return;
  pushAnnState('Send to back');
  const list = bucket[E.cur].filter(a => a !== E.sel);
  list.unshift(E.sel);
  bucket[E.cur] = list;
  overlay();
}

addEventListener('keydown', e => {
  if (document.body.dataset.view !== 'edit' || !E.doc) return;
  if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;

  const c = e.ctrlKey || e.metaKey;
  if (c && e.key.toLowerCase() === 'c' && E.sel && !selInfo()) {
    E.clip = JSON.parse(JSON.stringify(E.sel));
    if (E.sel.img) E.clip.img = E.sel.img;
    st('Copied annotation to clipboard');
    return;
  }
  if (c && e.key.toLowerCase() === 'v' && E.clip) {
    e.preventDefault();
    const copy = JSON.parse(JSON.stringify(E.clip));
    if (E.clip.img) copy.img = E.clip.img;
    moveAnn(copy, 14, 14);
    addAnn(copy);
    st('Pasted annotation');
    return;
  }
  if (!E.sel) return;
  const step = e.shiftKey ? 10 : 1;
  if (e.key === 'ArrowLeft') { e.preventDefault(); pushAnnState('Nudge annotation'); moveAnn(E.sel, -step, 0); overlay(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); pushAnnState('Nudge annotation'); moveAnn(E.sel, step, 0); overlay(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); pushAnnState('Nudge annotation'); moveAnn(E.sel, 0, -step); overlay(); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); pushAnnState('Nudge annotation'); moveAnn(E.sel, 0, step); overlay(); }
});

// ---------- page and document operations ----------
async function reorder(moved, j) {
  const all = [...Array(E.n).keys()], rest = all.filter(x => !moved.includes(x)), pos = rest.filter(x => x < j).length, order = [...rest.slice(0, pos), ...moved, ...rest.slice(pos)];
  if (order.every((v, i) => v === all[i])) return;
  E.cur = order.indexOf(moved[0]);
  await edit(async d => { const nd = await PDFDocument.create(), cp = await nd.copyPages(d, order); cp.forEach(p => nd.addPage(p)); const t = d.getTitle(), a = d.getAuthor(); if (t) nd.setTitle(t); if (a) nd.setAuthor(a); return nd; }, 'Pages reordered');
}
async function save(name, bytes, mime, filters) {
  if (window.native) { const p = await window.native.saveFile({ name, bytes, filters }); if (p) st('Saved ' + p); return p; }
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  st('Saved ' + name);
}
async function saveMany(files) {
  if (window.native) { const d = await window.native.saveMany({ files }); if (d) st('Saved ' + files.length + ' files to ' + d); return d; }
  files.forEach(f => {
    const url = URL.createObjectURL(new Blob([f.bytes]));
    const a = document.createElement('a'); a.href = url; a.download = f.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  });
}
const PDFF = [{ name: 'PDF', extensions: ['pdf'] }];
function parseRanges(s, n) {
  const out = []; for (const part of s.split(',').map(x => x.trim()).filter(Boolean)) {
    const m = part.match(/^(\d*)\s*-\s*(\d*)$/); let a, b; if (m) { a = +m[1] || 1; b = +m[2] || n; } else if (/^\d+$/.test(part)) a = b = +part; else throw new Error('Bad range: ' + part);
    if (a < 1 || b > n || a > b) throw new Error('Range out of bounds: ' + part); out.push([a - 1, b - 1]);
  } return out;
}
const STD_FONT_MAP = {
  Helvetica: StandardFonts.HelveticaBold,
  Times: StandardFonts.TimesRomanBold,
  Courier: StandardFonts.CourierBold
};
const STD_FONT_REG_MAP = {
  Helvetica: StandardFonts.Helvetica,
  Times: StandardFonts.TimesRoman,
  Courier: StandardFonts.Courier
};

const ops = {
  async rot(delta) { const t = targets(); await edit(d => { t.forEach(i => { const p = d.getPage(i); p.setRotation(degrees(((p.getRotation().angle + delta) % 360 + 360) % 360)); }); }, 'Rotated ' + t.length + ' page(s)'); },
  async del() { const t = targets(); if (t.length >= E.n) return st('A PDF needs at least one page.'); E.cur = Math.max(0, Math.min(...t) - 1); await edit(d => { [...t].reverse().forEach(i => d.removePage(i)); }, 'Deleted ' + t.length + ' page(s)'); },
  async dup() {
    if (E.sel) { duplicateSelectedAnn(); return; }
    const t = targets(); await edit(async d => { for (let k = t.length - 1; k >= 0; k--) { const [c] = await d.copyPages(d, [t[k]]); d.insertPage(t[k] + 1, c); } }, 'Duplicated page(s)');
  },
  async blank() {
    if (!E.bytes) {
      const nd = await PDFDocument.create();
      nd.addPage([595.28, 841.89]);
      await openBytes(await nd.save(), 'Blank_Sheet.pdf');
      return st('Created new A4 blank sheet');
    }
    const i = E.cur; E.cur = i + 1; await edit(d => { const s = d.getPage(i).getSize(); d.insertPage(i + 1, [s.width, s.height]); }, 'Blank page inserted');
  },
  async extract(path) { const t = targets(); await commit(); const d = await PDFDocument.load(E.bytes, LOAD), nd = await PDFDocument.create(); (await nd.copyPages(d, t)).forEach(p => nd.addPage(p)); return save(baseName() + '_pages.pdf', await nd.save(), 'application/pdf', PDFF); },
  async merge(files) {
    const bufs = []; for (const f of files) bufs.push(new Uint8Array(await f.arrayBuffer()));
    if (!E.bytes) { const nd = await PDFDocument.create(); for (const b of bufs) { const s = await PDFDocument.load(b, LOAD); (await nd.copyPages(s, s.getPageIndices())).forEach(p => nd.addPage(p)); } E.name = 'merged.pdf'; E.hist = []; E.bytes = await nd.save(); E.ann = {}; E.cur = 0; await reload(); fit(); return st('Merged ' + files.length + ' files'); }
    await edit(async d => { for (const b of bufs) { const s = await PDFDocument.load(b, LOAD); (await d.copyPages(s, s.getPageIndices())).forEach(p => d.addPage(p)); } }, 'Merged ' + files.length + ' file(s) at the end');
  },
  async images(files, mode) {
    const items = []; for (const f of files) { const url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); }), im = await loadImg(url); items.push({ url, im, type: f.type }); }
    const add = async d => {
      for (const it of items) {
        let bytes, jpg = it.type === 'image/jpeg';
        if (jpg) bytes = Uint8Array.from(atob(it.url.split(',')[1]), c => c.charCodeAt(0)); else { const c = document.createElement('canvas'); c.width = it.im.naturalWidth; c.height = it.im.naturalHeight; c.getContext('2d').drawImage(it.im, 0, 0); const blob = await new Promise(r => c.toBlob(r, 'image/png')); c.width = 0; c.height = 0; bytes = new Uint8Array(await blob.arrayBuffer()); }
        const img = jpg ? await d.embedJpg(bytes) : await d.embedPng(bytes); let W = img.width, H = img.height;
        if (mode === 'a4') { W = 595.28; H = 841.89; const s = Math.min((W - 40) / img.width, (H - 40) / img.height), w = img.width * s, h = img.height * s, p = d.addPage([W, H]); p.drawImage(img, { x: (W - w) / 2, y: (H - h) / 2, width: w, height: h }); }
        else { const p = d.addPage([W, H]); p.drawImage(img, { x: 0, y: 0, width: W, height: H }); }
      }
    };
    if (!E.bytes) { const nd = await PDFDocument.create(); await add(nd); E.name = 'images.pdf'; E.hist = []; E.bytes = await nd.save(); E.ann = {}; E.cur = 0; await reload(); fit(); return st('Created PDF from ' + items.length + ' image(s)'); }
    await edit(add, 'Added ' + items.length + ' image page(s) at the end');
  },
  async split(p) {
    await commit(); const d = await PDFDocument.load(E.bytes, LOAD), files = [];
    const groups = p.mode === 'each' ? [...Array(E.n).keys()].map(i => [[i, i]]) : parseRanges(p.ranges, E.n).map(r => [r]);
    let k = 0; for (const g of groups) { k++; const idx = []; g.forEach(([a, b]) => { for (let i = a; i <= b; i++) idx.push(i); }); const nd = await PDFDocument.create(); (await nd.copyPages(d, idx)).forEach(x => nd.addPage(x)); files.push({ name: `${baseName()}_part${k}.pdf`, bytes: await nd.save() }); }
    return saveMany(files);
  },
  async png(p) {
    await commit(); const t = p.which === 'sel' ? targets() : [...Array(E.n).keys()], files = [];
    for (const i of t) { const pg = await E.doc.getPage(i + 1), v = pg.getViewport({ scale: p.dpi / 72 }), c = document.createElement('canvas'); c.width = Math.round(v.width); c.height = Math.round(v.height); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); await pg.render({ canvasContext: x, viewport: v }).promise; const blob = await new Promise(r => c.toBlob(r, 'image/png')); c.width = 0; c.height = 0; if (i !== E.cur && typeof pg.cleanup === 'function') { try { pg.cleanup(); } catch (e) {} } files.push({ name: `${baseName()}_p${i + 1}.png`, bytes: new Uint8Array(await blob.arrayBuffer()) }); }
    return saveMany(files);
  },
  async wm(p) {
    const t = p.which === 'sel' ? targets() : [...Array(E.n).keys()];
    await edit(async d => {
      const fontEnum = STD_FONT_MAP[p.fam] || StandardFonts.HelveticaBold;
      const font = await d.embedFont(fontEnum), col = hexRgb(p.color);
      for (const i of t) { const pg = d.getPage(i), mb = pg.getMediaBox(), R = ((pg.getRotation().angle % 360) + 360) % 360, th = (p.angle + R) * Math.PI / 180, w = font.widthOfTextAtSize(safeText(font, p.text), p.size), h = p.size * .7, cx = mb.x + mb.width / 2, cy = mb.y + mb.height / 2;
        pg.drawText(safeText(font, p.text), { x: cx - (w / 2 * Math.cos(th) - h / 2 * Math.sin(th)), y: cy - (w / 2 * Math.sin(th) + h / 2 * Math.cos(th)), size: p.size, font, color: col, opacity: p.opacity / 100, rotate: degrees(p.angle + R) }); }
    }, 'Watermark added');
  },
  async nums(p) {
    await edit(async d => {
      const fontEnum = STD_FONT_REG_MAP[p.fam] || StandardFonts.Helvetica;
      const font = await d.embedFont(fontEnum), N = d.getPageCount();
      d.getPages().forEach((pg, i) => {
        const txt = safeText(font, p.fmt.replace('{n}', i + p.start).replace('{N}', N + p.start - 1)), mb = pg.getMediaBox(), R = ((pg.getRotation().angle % 360) + 360) % 360, vw = R % 180 ? mb.height : mb.width, vh = R % 180 ? mb.width : mb.height, w = font.widthOfTextAtSize(txt, p.size);
        const [v, hz] = p.pos.split('-'), vy = v === 'top' ? 36 : vh - 36, vx = hz === 'left' ? 36 : hz === 'right' ? vw - 36 - w : (vw - w) / 2;
        let X, Y;
        if (R === 0) { X = mb.x + vx; Y = mb.y + mb.height - vy; } else if (R === 90) { X = mb.x + vy; Y = mb.y + vx; } else if (R === 180) { X = mb.x + mb.width - vx; Y = mb.y + vy; } else { X = mb.x + mb.width - vy; Y = mb.y + mb.height - vx; }
        pg.drawText(txt, { x: X, y: Y, size: p.size, font, color: rgb(.1, .1, .1), rotate: degrees(R) });
      });
    }, 'Page numbers added');
  },
  async bates(p) {
    const t = p.which === 'sel' ? targets() : [...Array(E.n).keys()];
    await edit(async d => {
      const font = await d.embedFont(StandardFonts.CourierBold), col = hexRgb(p.color || '#1e293b');
      t.forEach((pageIdx, seqIdx) => {
        const pg = d.getPage(pageIdx), mb = pg.getMediaBox(), R = ((pg.getRotation().angle % 360) + 360) % 360;
        const numStr = String((+p.start || 1) + seqIdx).padStart(+p.digits || 6, '0');
        const txt = safeText(font, `${p.prefix || 'DWG-'}${numStr}${p.suffix || ''}`);
        const vw = R % 180 ? mb.height : mb.width, vh = R % 180 ? mb.width : mb.height, w = font.widthOfTextAtSize(txt, p.size || 10);
        const [v, hz] = (p.pos || 'bottom-right').split('-'), vy = v === 'top' ? 28 : vh - 28, vx = hz === 'left' ? 32 : hz === 'right' ? vw - 32 - w : (vw - w) / 2;
        let X, Y;
        if (R === 0) { X = mb.x + vx; Y = mb.y + mb.height - vy; } else if (R === 90) { X = mb.x + vy; Y = mb.y + vx; } else if (R === 180) { X = mb.x + mb.width - vx; Y = mb.y + vy; } else { X = mb.x + mb.width - vy; Y = mb.y + mb.height - vx; }
        pg.drawText(txt, { x: X, y: Y, size: p.size || 10, font, color: col, rotate: degrees(R) });
      });
    }, `Bates numbering applied to ${t.length} page(s)`);
  },
  async resize(p) {
    const SIZES = {
      a4: [595.28, 841.89],
      a3: [841.89, 1190.55],
      letter: [612, 792],
      legal: [612, 1008],
      tabloid: [792, 1224],
      ansic: [1224, 1584],
      ansid: [1584, 2448]
    };
    const t = p.which === 'sel' ? targets() : [...Array(E.n).keys()];
    let [tw, th] = SIZES[p.preset] || SIZES.a4;
    if (p.orient === 'landscape') [tw, th] = [Math.max(tw, th), Math.min(tw, th)];
    else [tw, th] = [Math.min(tw, th), Math.max(tw, th)];
    await edit(d => {
      t.forEach(i => {
        const pg = d.getPage(i), { width, height } = pg.getSize();
        if (p.scaleContent && width > 0 && height > 0) {
          const sx = tw / width, sy = th / height, s = Math.min(sx, sy);
          pg.scaleContent(s, s);
        }
        pg.setSize(tw, th);
      });
    }, `Resized ${t.length} page(s) to ${p.preset.toUpperCase()} (${p.orient})`);
  },
  async text() {
    await commit(); let out = ''; for (let i = 1; i <= E.n; i++) { const tc = await (await E.doc.getPage(i)).getTextContent(); out += `--- Page ${i} ---\n` + tc.items.map(x => x.str + (x.hasEOL ? '\n' : '')).join('') + '\n\n'; }
    return save(baseName() + '.txt', new TextEncoder().encode(out), 'text/plain', [{ name: 'Text', extensions: ['txt'] }]);
  },
  async meta(p) { await edit(d => { d.setTitle(p.title); d.setAuthor(p.author); d.setSubject(p.subject); d.setKeywords(p.keywords.split(',').map(s => s.trim()).filter(Boolean)); }, 'Properties updated'); },
  async opt() { const before = E.bytes.length; await edit(async d => d, ''); st('Rewritten: ' + (before / 1024).toFixed(0) + ' KB to ' + (E.bytes.length / 1024).toFixed(0) + ' KB'); },
  async send(k) { if (!E.bytes) return st('Open a PDF first.'); await commit(); window.setView('compare'); await window.compareLoadBytes(k, E.bytes, E.name, E.path); }
};
const D = {
  which: { type: 'select', id: 'which', label: 'Pages', options: [{ label: 'All pages', value: 'all' }, { label: 'Selected pages', value: 'sel' }] },
  stdFam: { type: 'select', id: 'fam', label: 'Font Family', value: 'Helvetica', options: [{ label: 'Helvetica (Sans-Serif)', value: 'Helvetica' }, { label: 'Times New Roman (Serif)', value: 'Times' }, { label: 'Courier New (Monospace)', value: 'Courier' }] }
};
const ui = {
  rotL: () => ops.rot(-90), rotR: () => ops.rot(90), del: ops.del, dup: ops.dup, blank: ops.blank, extract: ops.extract, text: ops.text, opt: ops.opt, toA: () => ops.send('A'), toB: () => ops.send('B'),
  async split() { if (!E.bytes) return; const p = await dialog('Split PDF', [{ type: 'select', id: 'mode', label: 'Split', options: [{ label: 'Every page to its own file', value: 'each' }, { label: 'Custom ranges', value: 'ranges' }] }, { id: 'ranges', label: 'Ranges', value: '1-3,4-' }, { type: 'note', label: 'Ranges are used only for Custom ranges. Each range becomes one file. You choose the folder next.' }], 'Split'); if (p) try { await ops.split(p); } catch (e) { st('Error: ' + e.message); } },
  async png() { if (!E.bytes) return; const p = await dialog('Export pages as PNG', [D.which, { type: 'number', id: 'dpi', label: 'Resolution (dpi)', value: 150, min: 36, max: 400 }, { type: 'note', label: 'You choose the folder next.' }], 'Export'); if (p) await ops.png(p); },
  async wm() { if (!E.bytes) return; const p = await dialog('Watermark', [{ id: 'text', label: 'Text', value: 'CONFIDENTIAL' }, D.stdFam, { type: 'number', id: 'size', label: 'Size (pt)', value: 60, min: 8, max: 300 }, { type: 'number', id: 'opacity', label: 'Opacity %', value: 20, min: 1, max: 100 }, { type: 'number', id: 'angle', label: 'Angle (°)', value: 45, min: -180, max: 180 }, { type: 'color', id: 'color', label: 'Colour', value: '#888888' }, D.which], 'Apply'); if (p && p.text) await ops.wm(p); },
  async nums() { if (!E.bytes) return; const p = await dialog('Page numbers', [{ id: 'fmt', label: 'Format', value: 'Page {n} of {N}' }, D.stdFam, { type: 'select', id: 'pos', label: 'Position', options: [{ label: 'Bottom centre', value: 'bottom-center' }, { label: 'Bottom right', value: 'bottom-right' }, { label: 'Bottom left', value: 'bottom-left' }, { label: 'Top centre', value: 'top-center' }, { label: 'Top right', value: 'top-right' }, { label: 'Top left', value: 'top-left' }] }, { type: 'number', id: 'size', label: 'Size (pt)', value: 10, min: 6, max: 40 }, { type: 'number', id: 'start', label: 'First number', value: 1 }], 'Apply'); if (p) await ops.nums(p); },
  async bates() {
    if (!E.bytes) return;
    const p = await dialog('Bates Numbering Stamp', [
      { id: 'prefix', label: 'Prefix', value: 'DWG-' },
      { id: 'suffix', label: 'Suffix (optional)', value: '' },
      { type: 'number', id: 'digits', label: 'Zero-Pad Digits', value: 6, min: 1, max: 12 },
      { type: 'number', id: 'start', label: 'Starting Number', value: 1, min: 1 },
      { type: 'select', id: 'pos', label: 'Stamp Position', options: [{ label: 'Bottom Right', value: 'bottom-right' }, { label: 'Bottom Left', value: 'bottom-left' }, { label: 'Top Right', value: 'top-right' }, { label: 'Top Left', value: 'top-left' }] },
      { type: 'number', id: 'size', label: 'Font Size (pt)', value: 10, min: 6, max: 32 },
      { type: 'color', id: 'color', label: 'Stamp Colour', value: '#1e293b' },
      D.which
    ], 'Apply Bates #');
    if (p) await ops.bates(p);
  },
  async resize() {
    if (!E.bytes) return;
    const p = await dialog('Resize Page Dimensions', [
      { type: 'select', id: 'preset', label: 'Paper Size Preset', value: 'a4', options: [
        { label: 'ISO A4 (210 × 297 mm)', value: 'a4' },
        { label: 'ISO A3 (297 × 420 mm)', value: 'a3' },
        { label: 'US Letter (8.5 × 11 in)', value: 'letter' },
        { label: 'US Legal (8.5 × 14 in)', value: 'legal' },
        { label: 'Tabloid / ANSI B (11 × 17 in)', value: 'tabloid' },
        { label: 'ANSI C Schematic (17 × 22 in)', value: 'ansic' },
        { label: 'ANSI D Blueprint (22 × 34 in)', value: 'ansid' }
      ] },
      { type: 'select', id: 'orient', label: 'Orientation', value: 'portrait', options: [{ label: 'Portrait', value: 'portrait' }, { label: 'Landscape', value: 'landscape' }] },
      { type: 'checkbox', id: 'scaleContent', label: 'Scale page content proportionally to fit new size', value: true },
      D.which
    ], 'Resize Pages');
    if (p) await ops.resize(p);
  },
  async meta() { if (!E.bytes) return; const d = await PDFDocument.load(E.bytes, LOAD); const p = await dialog('Document properties', [{ id: 'title', label: 'Title', value: d.getTitle() || '' }, { id: 'author', label: 'Author', value: d.getAuthor() || '' }, { id: 'subject', label: 'Subject', value: d.getSubject() || '' }, { id: 'keywords', label: 'Keywords', value: d.getKeywords() || '' }], 'Save'); if (p) await ops.meta(p); }
};

// ---------- more operations ----------
const v2u = pg => { const mb = pg.getMediaBox(), R = ((pg.getRotation().angle % 360) + 360) % 360, vw = R % 180 ? mb.height : mb.width, vh = R % 180 ? mb.width : mb.height;
  return { vw, vh, R, f: (vx, vy) => R === 0 ? [mb.x + vx, mb.y + mb.height - vy] : R === 90 ? [mb.x + vy, mb.y + vx] : R === 180 ? [mb.x + mb.width - vx, mb.y + vy] : [mb.x + mb.width - vy, mb.y + mb.height - vx] }; };
const pickSet = which => which === 'sel' ? targets() : [...Array(E.n).keys()];
Object.assign(ops, {
  async reverse() { await edit(async d => { const nd = await PDFDocument.create(), order = d.getPageIndices().reverse(); (await nd.copyPages(d, order)).forEach(p => nd.addPage(p)); const t = d.getTitle(), a = d.getAuthor(); if (t) nd.setTitle(t); if (a) nd.setAuthor(a); return nd; }, 'Page order reversed'); },
  async insertpdf(files) { const f = files[0]; if (!f) return; const i = E.cur, src = await PDFDocument.load(new Uint8Array(await f.arrayBuffer()), LOAD); await edit(async d => { (await d.copyPages(src, src.getPageIndices())).forEach((p, k) => d.insertPage(i + 1 + k, p)); }, 'Inserted ' + src.getPageCount() + ' page(s) after page ' + (i + 1)); },
  async crop(p) {
    const t = pickSet(p.which), k = 72 / 25.4;
    await edit(d => { t.forEach(i => { const pg = d.getPage(i), g = v2u(pg), mb = pg.getMediaBox();
      if (p.reset) { pg.setCropBox(mb.x, mb.y, mb.width, mb.height); return; }
      const l = p.left * k, tp = p.top * k, r = p.right * k, b = p.bottom * k; if (l + r >= g.vw - 10 || tp + b >= g.vh - 10) throw new Error('The margins are larger than the page.');
      const c1 = g.f(l, tp), c2 = g.f(g.vw - r, g.vh - b); pg.setCropBox(Math.min(c1[0], c2[0]), Math.min(c1[1], c2[1]), Math.abs(c2[0] - c1[0]), Math.abs(c2[1] - c1[1])); }); }, p.reset ? 'Crop removed' : 'Pages cropped');
  },
  async hf(p) {
    const t = pickSet(p.which);
    await edit(async d => {
      const fontEnum = STD_FONT_REG_MAP[p.fam] || StandardFonts.Helvetica;
      const font = await d.embedFont(fontEnum), N = d.getPageCount(), date = new Date().toLocaleDateString(), M = p.margin * 72 / 25.4;
      for (const i of t) {
        const pg = d.getPage(i), g = v2u(pg), tok = s => safeText(font, s.replace(/\{n\}/g, i + 1).replace(/\{N\}/g, N).replace(/\{date\}/g, date).replace(/\{file\}/g, E.name));
        [['top', p.hl, p.hc, p.hr], ['bottom', p.fl, p.fc, p.fr]].forEach(([pos, l, c, r]) => [[l, 0], [c, 1], [r, 2]].forEach(([txt, al]) => {
          if (!txt) return; const s = tok(txt), w = font.widthOfTextAtSize(s, p.size), vx = al === 0 ? M : al === 2 ? g.vw - M - w : (g.vw - w) / 2, vy = pos === 'top' ? M + p.size * .8 : g.vh - M, [X, Y] = g.f(vx, vy);
          pg.drawText(s, { x: X, y: Y, size: p.size, font, color: rgb(.1, .1, .1), rotate: degrees(g.R) });
        }));
      }
    }, 'Header and footer added');
  },
  async flatten(p) { const t = pickSet(p.which); await commit(); await edit(async d => { for (const i of t) { const pj = await E.doc.getPage(i + 1), vp = pj.getViewport({ scale: 1 }); await rasterize(d, i, pj, vp, [], p.dpi / 72); } }, 'Flattened ' + t.length + ' page(s) to images'); },
  async print(p) {
    await commit(); const t = pickSet(p.which), box = $('#printarea'); box.innerHTML = ''; window.busy(true);
    try { for (const i of t) { st('Preparing page ' + (i + 1) + ' for printing...'); const pg = await E.doc.getPage(i + 1), v = pg.getViewport({ scale: p.dpi / 72 }), c = document.createElement('canvas'); c.width = v.width; c.height = v.height; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); await pg.render({ canvasContext: x, viewport: v }).promise; const im = new Image(); im.src = c.toDataURL('image/jpeg', .92); c.width = 0; c.height = 0; try { await im.decode(); } catch (e) {} box.append(im); } }
    finally { window.busy(false); } st('Opening the print dialog...'); window.print(); setTimeout(() => { box.innerHTML = ''; st('Ready'); }, 1500);
  }
});
const sel = f => { if (!E.n) return; E.pages = new Set(f([...Array(E.n).keys()])); markThumbs(); };
const toFile = f => new File([b2u(f.bytes)], f.name, { type: /\.pdf$/i.test(f.name) ? 'application/pdf' : /\.png$/i.test(f.name) ? 'image/png' : 'image/jpeg' });
const pickPdfs = async (title, multi) => (await window.native.openFiles({ title, multi })).map(toFile);
Object.assign(ui, {
  rot180: () => ops.rot(180), reverse: ops.reverse,
  selAll: () => sel(a => a), selNone: () => sel(() => []), selOdd: () => sel(a => a.filter(i => i % 2 === 0)), selEven: () => sel(a => a.filter(i => i % 2 === 1)), selInv: () => sel(a => a.filter(i => !E.pages.has(i))),
  async merge() { const f = await pickPdfs('Merge PDFs (choose the files to add)', true); if (f.length) await ops.merge(f); },
  async images() { const f = (await window.native.openFiles({ title: 'Choose images', multi: true, filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp'] }] })).map(toFile); if (!f.length) return; const p = await dialog('Images to PDF', [{ type: 'select', id: 'mode', label: 'Page size', options: [{ label: 'A4, image fitted', value: 'a4' }, { label: 'Same size as image', value: 'img' }] }], 'Create'); if (p) await ops.images(f, p.mode); },
  async insertpdf() { const f = await pickPdfs('Insert PDF after the current page', false); if (f.length) await ops.insertpdf(f); },
  async crop() { const p = await dialog('Crop pages', [{ type: 'number', id: 'top', label: 'Top margin (mm)', value: 10, min: 0 }, { type: 'number', id: 'right', label: 'Right margin (mm)', value: 10, min: 0 }, { type: 'number', id: 'bottom', label: 'Bottom margin (mm)', value: 10, min: 0 }, { type: 'number', id: 'left', label: 'Left margin (mm)', value: 10, min: 0 }, D.which, { type: 'checkbox', id: 'reset', label: 'Remove crop instead (show the full page again)', value: false }], 'Apply'); if (p) await ops.crop(p); },
  async hf() { const p = await dialog('Header and footer', [{ id: 'hl', label: 'Header left' }, { id: 'hc', label: 'Header centre' }, { id: 'hr', label: 'Header right' }, { id: 'fl', label: 'Footer left', value: '{file}' }, { id: 'fc', label: 'Footer centre', value: 'Page {n} of {N}' }, { id: 'fr', label: 'Footer right', value: '{date}' }, D.stdFam, { type: 'number', id: 'size', label: 'Size (pt)', value: 10, min: 6, max: 40 }, { type: 'number', id: 'margin', label: 'Margin (mm)', value: 10, min: 2, max: 60 }, D.which, { type: 'note', label: 'You can use {n} page number, {N} page count, {date} and {file}.' }], 'Apply'); if (p) await ops.hf(p); },
  async flatten() { const p = await dialog('Flatten pages to images', [D.which, { type: 'select', id: 'dpi', label: 'Quality', value: '200', options: ['150', '200', '300'] }, { type: 'note', label: 'Each page becomes a picture. Comments and form fields are fixed into it and text can no longer be selected. Undo is available.' }], 'Flatten'); if (p) { p.dpi = +p.dpi; await ops.flatten(p); } },
  async print() { const p = await dialog('Print', [D.which, { type: 'select', id: 'dpi', label: 'Quality', value: '150', options: ['100', '150', '200'] }], 'Print'); if (p) { p.dpi = +p.dpi; await ops.print(p); } }
});
const FREE = new Set(['merge', 'images', 'blank']);
ACT.op = async id => { if (!E.bytes && !FREE.has(id)) return st('Open a PDF first.'); try { await ui[id](); } catch (e) { st('Error: ' + (e.message || e)); } };
document.querySelectorAll('#etools [data-op], .rp-edit-ribbon [data-op]').forEach(b => b.onclick = () => ACT.op(b.dataset.op));

// Wire Launchpad Quick Action Cards
if ($('#rp-launch-blank')) $('#rp-launch-blank').onclick = () => ACT.op('blank');
if ($('#rp-launch-merge')) $('#rp-launch-merge').onclick = () => ACT.op('merge');
if ($('#rp-launch-images')) $('#rp-launch-images').onclick = () => ACT.op('images');
if ($('#rp-launch-compare')) $('#rp-launch-compare').onclick = () => window.setView && window.setView('compare');

// ---------- open, save ----------
async function pickEditor() {
  const f = (await window.native.openFiles({
    title: 'Open PDF or Image in Studio',
    filters: [
      { name: 'PDF & Image Documents', extensions: ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'bmp'] },
      { name: 'PDF Documents', extensions: ['pdf'] },
      { name: 'Images (Auto-Convert to PDF)', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }
    ]
  }))[0];
  if (!f) return;
  if (/\.(dxf|gbr|ger|art|top|bot|gtl|gbl|gbs|gts|gto|gbo|gtp|gbp|gko|gm1|drl|xln|ipc|d356|net)$/i.test(f.name) && window.openExternalCADOrCAM) {
    window.setView('compare');
    await window.openExternalCADOrCAM(b2u(f.bytes), f.name, f.path);
    return;
  }
  await openBytes(b2u(f.bytes), f.name, f.path);
}
async function doSave(asNew) {
  if (!E.bytes) return st('Open a PDF first.');
  try {
    await commit();
    if (!asNew && E.path) {
      if (window.PREF.confirmSave && !E.confirmed) { const r = await dialog('Save over the original?', [{ type: 'note', label: E.path + '\n\nThe file will be replaced with the edited version. Use Save as to keep the original.' }], 'Save'); if (!r) return; E.confirmed = true; }
      await window.native.writeFile({ path: E.path, bytes: E.bytes }); E.savedBytes = E.bytes; st('Saved ' + E.path); if (window.updateTitle) window.updateTitle(); return;
    }
    const p = await save(baseName() + '_edited.pdf', E.bytes, 'application/pdf', PDFF);
    if (p) { E.path = p; E.name = String(p).split(/[\\/]/).pop(); E.savedBytes = E.bytes; E.confirmed = true; window.addRecent(E.name, p); if (window.updateTitle) window.updateTitle(); }
  } catch (e) { st('Could not save: ' + (e.message || e)); }
}
$('#eOpen').onclick = pickEditor; $('#eSave').onclick = () => doSave(false); $('#eSaveAs').onclick = () => doSave(true);
$('#eUndo').onclick = undo; $('#eRedo').onclick = redo;
window.isDirty = () => !!E.bytes && (E.bytes !== E.savedBytes || Object.values(E.ann).some(l => l && l.length) || Object.values(E.meas).some(l => l && l.length));

// ---------- find in document ----------
function closeFind() { $('#fbar').hidden = true; F.hits = []; F.q = ''; F.i = -1; F.run++; if (E.doc) overlay(); }
function openFind() { if (!E.doc) return st('Open a PDF first.'); $('#fbar').hidden = false; $('#fq').focus(); $('#fq').select(); }
async function runFind(q) {
  const run = ++F.run; F.q = q; F.hits = []; F.i = -1; $('#fc').textContent = ''; overlay(); if (!q || !E.doc) return;
  const ql = q.toLowerCase(), doc = E.doc; window.busy(true);
  try {
    for (let p = 0; p < E.n; p++) {
      if (run !== F.run) return; const pg = await doc.getPage(p + 1), vp = pg.getViewport({ scale: 1 }), tc = await pg.getTextContent();
      for (const it of tc.items) {
        const low = it.str.toLowerCase(); let idx = low.indexOf(ql); if (idx < 0) continue; const t = pdfjsLib.Util.transform(vp.transform, it.transform), h = Math.hypot(t[2], t[3]), w = it.width * vp.scale;
        while (idx >= 0) { const x0 = t[4] + w * idx / it.str.length, x1 = t[4] + w * (idx + ql.length) / it.str.length; F.hits.push({ p, x: x0, y: t[5] - h * .8, w: Math.max(2, x1 - x0), h }); idx = low.indexOf(ql, idx + 1); }
      }
      if (p !== E.cur && typeof pg.cleanup === 'function') { try { pg.cleanup(); } catch (e) {} }
      if (F.hits.length && F.i < 0) { F.i = F.hits.findIndex(h => h.p >= E.cur); if (F.i < 0) F.i = 0; showHit(); }
      if (p % 4 === 3) await new Promise(r => setTimeout(r, 0));
    }
    if (run === F.run) $('#fc').textContent = F.hits.length ? (F.i + 1) + ' of ' + F.hits.length : 'No matches';
  } finally { window.busy(false); }
}
function showHit() { const h = F.hits[F.i]; if (!h) return; $('#fc').textContent = (F.i + 1) + ' of ' + F.hits.length; if (h.p !== E.cur) { E.cur = h.p; E.pages = new Set([h.p]); renderPage().then(scrollHit); } else { overlay(); scrollHit(); } }
function scrollHit() { const h = F.hits[F.i]; if (!h) return; const v = $('#eview'), w = $('#ewrap'); v.scrollTop = w.offsetTop + h.y * K() - v.clientHeight / 2; v.scrollLeft = w.offsetLeft + h.x * K() - v.clientWidth / 2; }
function stepFind(d) { if (!F.hits.length) return; F.i = (F.i + d + F.hits.length) % F.hits.length; showHit(); }
let fdeb; $('#fq').oninput = e => { clearTimeout(fdeb); fdeb = setTimeout(() => runFind(e.target.value), 250); };
$('#fq').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); if (F.q !== e.target.value) runFind(e.target.value); else stepFind(e.shiftKey ? -1 : 1); } else if (e.key === 'Escape') closeFind(); };
$('#fNext').onclick = () => stepFind(1); $('#fPrev').onclick = () => stepFind(-1); $('#fClose').onclick = closeFind; $('#eFind').onclick = openFind;

Object.assign(ACT, {
  tool: t => setTool(t), ePage: d => goto(E.cur + d), eFirst: () => goto(0), eLast: () => goto(E.n - 1), findStep: d => { if (!$('#fbar').hidden || F.hits.length) stepFind(d); else openFind(); },
  eDeleteAnn: () => {
    if (!E.sel) return false;
    pushAnnState('Delete annotation');
    const l = E.ann[E.cur] || [], lm = E.meas[E.cur] || [], gs = E.sel, same = a => a === gs || (gs.g && a.g === gs.g);
    E.ann[E.cur] = l.filter(a => !same(a));
    E.meas[E.cur] = lm.filter(a => !same(a));
    E.sel = null; overlay(); updateDocInspector();
    return true;
  },
  eEscape: () => {
    if ((E.tool === 'poly' || E.tool === 'area') && E.polyPts.length) { E.polyPts = []; E.tmp = null; overlay(); return; }
    if (!$('#fbar').hidden) closeFind();
    else { try { getSelection().removeAllRanges(); } catch (e) {} hideSelBar(); E.sel = null; if (E.tool !== 'select') setTool('select'); else overlay(); }
  },
  eGotoDialog: async () => { if (!E.n) return; const r = await dialog('Go to page', [{ type: 'number', id: 'n', label: 'Page (1-' + E.n + ')', value: E.cur + 1, min: 1, max: E.n }], 'Go'); if (r) goto(r.n - 1); },
  hasAnnSel: () => !!E.sel, reveal: () => E.path && window.native.reveal(E.path), hasPath: () => !!E.path,
  eOpen: pickEditor, eSave: () => doSave(false), eSaveAs: () => doSave(true), eUndo: undo, eRedo: redo, find: openFind, measure: () => setTool('measure'),
  night: () => { document.body.classList.toggle('night'); if ($('#eNightBtn')) $('#eNightBtn').classList.toggle('on', document.body.classList.contains('night')); },
  eFit: () => fit(), eFitWidth: () => fit('width'), eActual: () => { E.fitMode = null; E.zoom = .75; renderPage(); }, editText: () => setTool('edittext'),
  eZoomIn: () => $('#eZi').click(), eZoomOut: () => $('#eZo').click(),
  toggleThumbs: () => {
    const th = $('#thumbs');
    if (!th) return;
    th.classList.toggle('rp-collapsed');
    th.hidden = th.classList.contains('rp-collapsed');
    if ($('#eThumbBtn')) $('#eThumbBtn').classList.toggle('on', !th.hidden);
    refit();
  },
  togglePanel: () => {
    const et = $('#etools');
    if (!et) return;
    const isNowCollapsed = et.classList.toggle('rp-collapsed');
    et.hidden = isNowCollapsed;
    if (!isNowCollapsed) setTab('c');
    if ($('#ePanelBtn')) $('#ePanelBtn').classList.toggle('on', !isNowCollapsed);
    window.dispatchEvent(new Event('resize'));
    refit();
  },
  clearMeasure: () => { pushAnnState('Clear measurements'); E.meas = {}; overlay(); updateDocInspector(); },
  nightOn: () => document.body.classList.contains('night')
});
addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#dlg').hidden) { $('#dC').click(); return; }
  if (e.key === 'Enter' && document.body.dataset.view === 'edit' && (E.tool === 'poly' || E.tool === 'area') && E.polyPts.length >= 2) {
    e.preventDefault();
    finishPolygonTool();
  }
});

// ---------- comments (real PDF annotations) ----------
const CT = { Text: 'Note', Highlight: 'Highlight', Underline: 'Underline', StrikeOut: 'Strikeout', Squiggly: 'Squiggly', FreeText: 'Text box', Square: 'Box', Circle: 'Circle', Line: 'Line', Ink: 'Drawing', Stamp: 'Stamp', Caret: 'Caret', Polygon: 'Polygon', PolyLine: 'Polyline' };
const getAuthor = () => { try { return localStorage.getItem('author') || ''; } catch (e) { return ''; } };
const pdfDate = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`; };
const showDate = s => { const m = /D:(\d{4})(\d\d)(\d\d)(\d\d)?(\d\d)?/.exec(s || ''); return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4] || '00'}:${m[5] || '00'}` : ''; };
const dtext = o => (o && o.decodeText) ? o.decodeText() : '';
const akey = (r, pi, i) => r instanceof PDFRef ? r.tag : 'p' + pi + 'i' + i;
function readComments(doc) {
  const out = [];
  doc.getPages().forEach((pg, pi) => {
    const an = pg.node.Annots(); if (!an) return;
    for (let i = 0; i < an.size(); i++) {
      const d = an.lookup(i); if (!(d instanceof PDFDict)) continue;
      const st = d.get(PDFName.of('Subtype')), sub = st && st.asString ? st.asString().slice(1) : ''; if (!CT[sub]) continue;
      const ra = d.lookup(PDFName.of('Rect')), rect = ra && ra.asArray ? ra.asArray().map(n => n.asNumber ? n.asNumber() : 0) : [], irt = d.get(PDFName.of('IRT')), key = akey(an.get(i), pi, i);
      out.push({ key, page: pi, sub, type: CT[sub], author: dtext(d.lookup(PDFName.of('T'))), date: showDate(dtext(d.lookup(PDFName.of('M')))), contents: dtext(d.lookup(PDFName.of('Contents'))), state: dtext(d.lookup(PDFName.of('State'))), rect, irt: irt instanceof PDFRef ? irt.tag : null });
    }
  });
  return out;
}
async function mutate(fn, msg) {
  if (!E.bytes) return;
  try { await commit(true); const doc = await PDFDocument.load(E.bytes, LOAD); await fn(doc); const nb = await doc.save(); push(); E.bytes = nb; await reload(true); if (msg) st(msg); }
  catch (e) { st('Error: ' + (e.message || e)); }
}
async function ensureAuthor() {
  if (getAuthor()) return true;
  const r = await dialog('Your name', [{ id: 'n', label: 'Name for comments', value: '' }, { type: 'note', label: 'It is saved in each comment you add. You can change it in the Comments tab.' }], 'Save');
  if (!r || !r.n.trim()) return false; try { localStorage.setItem('author', r.n.trim()); } catch (e) {} $('#cAuthor').value = r.n.trim(); return true;
}
const newId = () => 'rl-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const rgbArr = h => { const c = hexRgb(h); return [c.red, c.green, c.blue]; };
function baseAnnot(ctx, sub, rect, text, color, apRef) {
  const o = { Type: 'Annot', Subtype: sub, Rect: rect, F: 4, C: rgbArr(color), NM: PDFString.of(newId()), T: PDFHexString.fromText(getAuthor()), M: PDFString.of(pdfDate()), CreationDate: PDFString.of(pdfDate()), Contents: PDFHexString.fromText(text || '') };
  if (apRef) o.AP = { N: apRef }; return o;
}
async function addNote(pi, x, y, text) {
  const vp = (await E.doc.getPage(pi + 1)).getViewport({ scale: 1 }), [X, Y] = vp.convertToPdfPoint(x, y), color = $('#eColor').value;
  await mutate(doc => {
    const ctx = doc.context, c = rgbArr(color), ap = ctx.register(ctx.stream(`${c[0]} ${c[1]} ${c[2]} rg 0 0 18 18 re f 0.2 0.2 0.2 RG 0.8 w 0.4 0.4 17.2 17.2 re S 4 5 m 14 5 l S 4 9 m 14 9 l S 4 13 m 14 13 l S`, { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 18, 18], Resources: {} }));
    const ref = ctx.register(ctx.obj({ ...baseAnnot(ctx, 'Text', [X, Y - 18, X + 18, Y], text, color, ap), Name: 'Comment' })); doc.getPage(pi).node.addAnnot(ref);
  }, 'Note added');
  setTab('c');
}
async function addMarkup(pi, sub, r, text, color, boxesIn) {
  const pj = await E.doc.getPage(pi + 1), vp = pj.getViewport({ scale: 1 }), P = (x, y) => vp.convertToPdfPoint(x, y); let boxes = boxesIn ? boxesIn.map(q => [q.x0, q.y0, q.x1, q.y1]) : [];
  if (!boxesIn && vp.rotation === 0) {
    const tc = await pj.getTextContent();
    for (const it of tc.items) {
      if (!it.str.trim()) continue; const t = pdfjsLib.Util.transform(vp.transform, it.transform); if (Math.abs(t[1]) > .01 || Math.abs(t[2]) > .01) continue;
      const h = Math.hypot(t[2], t[3]), x0 = t[4], x1 = t[4] + it.width * vp.scale, y0 = t[5] - h * .8, y1 = t[5] + h * .2;
      const ox = Math.min(x1, r.x + r.w) - Math.max(x0, r.x), oy = Math.min(y1, r.y + r.h) - Math.max(y0, r.y);
      if (ox > 1 && oy > (y1 - y0) * .4) boxes.push([Math.max(x0, r.x), y0, Math.min(x1, r.x + r.w), y1]);
    }
  }
  if (!boxes.length && r) boxes = [[r.x, r.y, r.x + r.w, r.y + r.h]]; if (!boxes.length) return;
  const quads = boxes.map(([x0, y0, x1, y1]) => [P(x0, y0), P(x1, y0), P(x0, y1), P(x1, y1)]), all = quads.flat();
  const rect = [Math.min(...all.map(p => p[0])), Math.min(...all.map(p => p[1])), Math.max(...all.map(p => p[0])), Math.max(...all.map(p => p[1]))], c = rgbArr(color);
  let body = ''; const f = n => +n.toFixed(2);
  quads.forEach(([tl, tr, bl, br]) => {
    if (sub === 'Highlight') body += `${f(tl[0])} ${f(tl[1])} m ${f(tr[0])} ${f(tr[1])} l ${f(br[0])} ${f(br[1])} l ${f(bl[0])} ${f(bl[1])} l h f\n`;
    else if (sub === 'Underline') body += `${f(bl[0])} ${f(bl[1] + 1)} m ${f(br[0])} ${f(br[1] + 1)} l S\n`;
    else body += `${f((tl[0] + bl[0]) / 2)} ${f((tl[1] + bl[1]) / 2)} m ${f((tr[0] + br[0]) / 2)} ${f((tr[1] + br[1]) / 2)} l S\n`;
  });
  const content = (sub === 'Highlight' ? `/GS gs ${c[0]} ${c[1]} ${c[2]} rg\n` : `${c[0]} ${c[1]} ${c[2]} RG 1.2 w\n`) + body;
  await mutate(doc => {
    const ctx = doc.context, ap = ctx.register(ctx.stream(content, { Type: 'XObject', Subtype: 'Form', BBox: rect, Resources: { ExtGState: { GS: { Type: 'ExtGState', BM: 'Multiply' } } } }));
    const ref = ctx.register(ctx.obj({ ...baseAnnot(ctx, sub, rect, text, color, ap), QuadPoints: quads.flatMap(q => q.flat()) })); doc.getPage(pi).node.addAnnot(ref);
  }, sub === 'Highlight' ? 'Highlight added' : sub === 'Underline' ? 'Underline added' : 'Strikeout added');
  setTab('c');
}
async function finishMarkup(a) {
  if (!await ensureAuthor()) return;
  const r = await dialog('Comment (optional)', [{ type: 'textarea', id: 'v', label: '', rows: 3 }], 'Add'); if (!r) return;
  await addMarkup(E.cur, { chl: 'Highlight', cul: 'Underline', cst: 'StrikeOut' }[a.kind], a, r.v || '', a.color);
}
function findAnnot(doc, key) {
  const pages = doc.getPages();
  for (let pi = 0; pi < pages.length; pi++) { const an = pages[pi].node.Annots(); if (!an) continue; for (let i = 0; i < an.size(); i++) { const r = an.get(i); if (akey(r, pi, i) === key) return { an, i, d: an.lookup(i, PDFDict), ref: r, pi }; } }
  return null;
}
async function replyTo(c, text) {
  if (!await ensureAuthor()) return;
  if (text == null) { const r = await dialog('Reply', [{ type: 'textarea', id: 'v', label: '', rows: 3 }], 'Reply'); if (!r || !r.v) return; text = r.v; }
  await mutate(doc => {
    const f = findAnnot(doc, c.key); if (!f || !(f.ref instanceof PDFRef)) throw new Error('This comment cannot take replies.'); const ctx = doc.context, rc = c.rect.length === 4 ? c.rect : [20, 20, 38, 38];
    const ref = ctx.register(ctx.obj({ ...baseAnnot(ctx, 'Text', [rc[0], rc[1], rc[0] + 18, rc[1] + 18], text, '#ffc400'), IRT: f.ref, RT: 'R' })); doc.getPage(f.pi).node.addAnnot(ref);
  }, 'Reply added');
}
async function editC(c) {
  const r = await dialog('Edit comment', [{ type: 'textarea', id: 'v', label: '', rows: 4, value: c.contents }], 'Save'); if (!r) return;
  await mutate(doc => { const f = findAnnot(doc, c.key); if (!f) return; f.d.set(PDFName.of('Contents'), PDFHexString.fromText(r.v)); f.d.set(PDFName.of('M'), PDFString.of(pdfDate())); }, 'Comment updated');
}
async function toggleRes(c) {
  await mutate(doc => { const f = findAnnot(doc, c.key); if (!f) return; if (c.state === 'Completed') { f.d.delete(PDFName.of('State')); f.d.delete(PDFName.of('StateModel')); } else { f.d.set(PDFName.of('State'), PDFString.of('Completed')); f.d.set(PDFName.of('StateModel'), PDFString.of('Review')); } }, c.state === 'Completed' ? 'Reopened' : 'Marked resolved');
}
async function delC(c) {
  const keys = [c.key, ...E.comments.filter(x => x.irt === c.key).map(x => x.key)];
  await mutate(doc => { doc.getPages().forEach((pg, pi) => { const an = pg.node.Annots(); if (!an) return; for (let i = an.size() - 1; i >= 0; i--) if (keys.includes(akey(an.get(i), pi, i))) an.remove(i); }); }, 'Comment deleted');
}
async function clearComments(skipAsk) {
  if (!skipAsk) { const r = await dialog('Remove all comments', [{ type: 'note', label: 'This removes every note, highlight, underline, strikeout and reply from the PDF. You can undo it right after.' }], 'Remove all'); if (!r) return; }
  await mutate(doc => { doc.getPages().forEach((pg, pi) => { const an = pg.node.Annots(); if (!an) return; for (let i = an.size() - 1; i >= 0; i--) { const d = an.lookup(i); const st = d instanceof PDFDict && d.get(PDFName.of('Subtype')); if (st && st.asString && CT[st.asString().slice(1)]) an.remove(i); } }); }, 'All comments removed');
}
function card(c, reply) {
  const d = document.createElement('div'); d.className = 'cm' + (reply ? ' rp' : '') + (c.state === 'Completed' ? ' done' : '') + (c.key === E.selC ? ' sel' : '');
  const esc = t => String(t).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
  d.innerHTML = `<div class="ch"><b>${reply ? 'Reply' : esc(c.type)}</b> <span>p.${c.page + 1}</span> <span class="au">${esc(c.author || 'Unknown')}</span> <span>${esc(c.date)}</span>${c.state === 'Completed' ? ' <span class="ok">Resolved</span>' : ''}</div><div class="cb">${esc(c.contents) || '<i>(no text)</i>'}</div><div class="ca"></div>`;
  const acts = d.querySelector('.ca'), add = (t, f) => { const b = document.createElement('button'); b.textContent = t; b.onclick = e => { e.stopPropagation(); f(); }; acts.append(b); };
  if (!reply) add('Reply', () => replyTo(c)); add('Edit', () => editC(c)); if (!reply) add(c.state === 'Completed' ? 'Reopen' : 'Resolve', () => toggleRes(c)); add('Delete', () => delC(c));
  d.onclick = () => { E.selC = c.key; if (c.page !== E.cur) goto(c.page); else overlay(); renderComments(); };
  return d;
}
function renderComments() {
  const box = $('#clist'); if (!box) return; box.innerHTML = ''; const hide = $('#cHide').checked, only = $('#cPage').checked, top = E.comments.filter(c => !c.irt);
  const cTabSpan = $('#cTab span'); if (cTabSpan) cTabSpan.textContent = 'Comments (' + top.length + ')'; else $('#cTab').textContent = 'Comments (' + top.length + ')';
  top.filter(c => !(hide && c.state === 'Completed') && (!only || c.page === E.cur)).forEach(c => { box.append(card(c, false)); E.comments.filter(r => r.irt === c.key).forEach(r => box.append(card(r, true))); });
  if (!box.children.length) box.innerHTML = '<p class="note">No comments to show. Use Note, Highlight, Underline or Strikeout in the toolbar.</p>';
  updateDocInspector();
}
function setTab(t) { $('#pTools').hidden = t !== 't'; $('#pComments').hidden = t !== 'c'; $('#cTab').classList.toggle('on', t === 'c'); $('#tTab').classList.toggle('on', t === 't'); }
$('#tTab').onclick = () => setTab('t'); $('#cTab').onclick = () => setTab('c');
$('#cAuthor').value = getAuthor(); $('#cAuthor').onchange = e => { try { localStorage.setItem('author', e.target.value.trim()); } catch (x) {} };
$('#cHide').onchange = $('#cPage').onchange = renderComments;
$('#cClear').onclick = () => E.bytes && clearComments();
function commentRows() { return E.comments.map(c => { const p = c.irt ? E.comments.find(x => x.key === c.irt) : null; return { page: c.page + 1, type: c.irt ? 'Reply' : c.type, author: c.author, date: c.date, status: c.state === 'Completed' ? 'Resolved' : 'Open', text: c.contents, replyTo: p ? '#' + (E.comments.indexOf(p) + 1) : '' }; }); }
function csvText() { const rows = commentRows(), q = v => '"' + String(v).replace(/"/g, '""') + '"'; return 'no,page,type,author,date,status,reply_to,comment\n' + rows.map((r, i) => [i + 1, r.page, r.type, q(r.author), r.date, r.status, r.replyTo, q(r.text)].join(',')).join('\n') + '\n'; }
$('#cCsv').onclick = () => { if (!E.bytes) return; save(baseName() + '_comments.csv', new TextEncoder().encode('\ufeff' + csvText()), 'text/csv', [{ name: 'CSV', extensions: ['csv'] }]); };
$('#cTxt').onclick = () => { if (!E.bytes) return; const s = commentRows().map((r, i) => `#${i + 1}  Page ${r.page}  ${r.type}  ${r.status}\n    ${r.author || 'Unknown'}  ${r.date}${r.replyTo ? '  (reply to ' + r.replyTo + ')' : ''}\n    ${r.text || '(no text)'}\n`).join('\n'); save(baseName() + '_comments.txt', new TextEncoder().encode(s || 'No comments.\n'), 'text/plain', [{ name: 'Text', extensions: ['txt'] }]); };
async function stampPad() {
  const r = await dialog('Stamp', [{ type: 'select', id: 's', label: 'Stamp', options: ['APPROVED', 'REJECTED', 'REVIEWED', 'CHECKED', 'DRAFT', 'FOR COMMENT', 'VOID', 'CONFIDENTIAL', 'AS-BUILT', 'FINAL RELEASE'] }, { type: 'note', label: 'Click on the page to place it. The stamp is drawn into the page when you save.' }], 'Next');
  if (!r) return setTool('select'); const col = { APPROVED: '#0b8a3d', REJECTED: '#d62d2d', REVIEWED: '#1a3cff', CHECKED: '#0b8a3d', DRAFT: '#666666', 'FOR COMMENT': '#d97706', VOID: '#d62d2d', CONFIDENTIAL: '#b91c1c', 'AS-BUILT': '#0284c7', 'FINAL RELEASE': '#059669' }[r.s] || '#1a3cff'; E.stamp = { text: r.s, color: col }; st('Click on the page to place the stamp.');
}

window.editorDrop = async files => { if (!files.length) return; if (!E.bytes) openFile(files[0]); else try { await ops.merge(files); } catch (x) { st('Error: ' + x.message); } };
window.dialog = dialog; setPE();
window.editorShown = () => { if (E.doc) setTimeout(refit, 30); updateDocInspector(); syncHudBar(); };
updateContextualToolDock(E.tool);
window.RE = { reload, hit, hitAnnAt, eraseAtPoint, shouldShowContextualDock, updateContextualToolDock, applyEditorSizeValue, applyFontSizeValue, selInfo, copySel, setTool, overlay, editFromSelection, markFromSelection, editItems, itemsIn, selBoxes, itemAt, E, F, ui, doSave, runFind, redo, v2u, ops, commit, addAnn, dialog, openBytes, goto, reorder, undo, drawAnn, addNote, addMarkup, readComments, replyTo, toggleRes, delC, mutate, findAnnot, clearComments, renderComments, editC, setTab, updateDocInspector, loadCustomFontFile, duplicateSelectedAnn, bringSelToFront, sendSelToBack, openRichTextDialog, openInlineTextEditor, commitInlineTextEditor, cancelInlineTextEditor };
})();
