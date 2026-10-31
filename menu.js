// ===== Menu bar, shortcuts, preferences, help, external open =====
(() => {
const V = () => document.body.dataset.view, ED = () => V() === 'edit', E = () => RE.E;
const hasDoc = () => ED() ? !!E().bytes : !!(S.A && S.B);
const recents = () => { try { return JSON.parse(localStorage.getItem('recent') || '[]'); } catch (e) { return []; } };
async function openRecent(r) {
  if (!r) return;
  let f = r.path ? await window.native.readFile(r.path) : null;
  if (!f && window.__recentMemFiles) {
    const mem = window.__recentMemFiles.get(r.path || r.name) || window.__recentMemFiles.get(r.name);
    if (mem && mem.bytes) f = { name: mem.name || r.name, path: mem.path || r.path || '', bytes: mem.bytes };
  }
  if (!f && /^Sample_/i.test(r.name || '')) {
    if (/Gerber/i.test(r.name) && window.loadSampleGerber) return window.loadSampleGerber();
    if (/DXF|Enclosure/i.test(r.name) && window.loadSampleDXF) return window.loadSampleDXF();
    if (window.loadSampleSchematic) return window.loadSampleSchematic();
  }
  if (!f) {
    try { localStorage.setItem('recent', JSON.stringify(recents().filter(x => (x.path || x.name) !== (r.path || r.name)))); } catch (e) {}
    const msg = 'Recent file is no longer on disk: ' + (r.path || r.name);
    st2(msg);
    if (window.rpToast) window.rpToast(msg);
    return;
  }
  const u = b2u(f.bytes);
  if (/\.redline$/i.test(f.name) && window.UIRibbon && window.UIRibbon.restoreSessionFromText) {
    setView('compare');
    await window.UIRibbon.restoreSessionFromText(new TextDecoder().decode(u));
    return;
  }
  if (/\.(dxf|gbr|ger|art|top|bot|gtl|gbl|gbs|gts|gto|gbo|gtp|gbp|gko|gm1|drl|xln|ipc|d356|net)$/i.test(f.name) && window.openExternalCADOrCAM) {
    await window.openExternalCADOrCAM(u, f.name, f.path, r.slot || null);
    return;
  }
  if (ED()) RE.openBytes(u, f.name, f.path);
  else compareLoadBytes(r.slot || (!S.A ? 'A' : 'B'), u, f.name, f.path);
}
const st2 = t => (ED() ? $('#est') : $('#st')).textContent = t;
const ensureEd = () => { if (!ED()) setView('edit'); };
const op = id => () => { ensureEd(); ACT.op(id); };
const needEd = () => !ED();

const MENUS = {
  File: () => [
    { l: 'Open PDF in Editor...', ic: 'open', k: 'Ctrl+O', a: () => { ensureEd(); ACT.eOpen(); } },
    { l: 'Open A (Base / Original) in Compare...', ic: 'openA', k: 'Ctrl+O', a: () => { setView('compare'); ACT.openA(); } },
    { l: 'Open B (Revised / New) in Compare...', ic: 'openB', k: 'Ctrl+Shift+O', a: () => { setView('compare'); ACT.openB(); } },
    '-',
    { l: 'Load Sample Drawings...', ic: 'open', a: () => window.promptSampleDrawings && window.promptSampleDrawings() },
    { l: '⚡ Load Sample Schematic (Rev A vs Rev B)', ic: 'open', a: () => window.loadSampleSchematic && window.loadSampleSchematic() },
    { l: '⚡ Load Sample PCB Gerber (Copper + Drill + IPC-D-356)', ic: 'pcbCam', a: () => window.loadSampleGerber && window.loadSampleGerber() },
    '-',
    { l: 'Save', ic: 'save', k: 'Ctrl+S', a: ACT.eSave, dis: needEd }, { l: 'Save as...', ic: 'saveas', k: 'Ctrl+Shift+S', a: ACT.eSaveAs, dis: needEd },
    '-',
    ...(ED() ? [{ l: 'Export pages as PNG...', ic: 'png', a: op('png') }, { l: 'Export text...', ic: 'textdoc', a: op('text') }, { l: 'Export comments (CSV)', ic: 'csv', a: () => $('#cCsv').click() }, { l: 'Export comments (text)', ic: 'textdoc', a: () => $('#cTxt').click() }]
      : [{ l: 'Export QA Package (.zip)...', ic: 'packageZip', a: () => window.exportQAPackageZip && window.exportQAPackageZip() }, { l: 'Save comparison image (PNG)...', ic: 'png', a: ACT.savePng }, { l: 'Save differences list (CSV)...', ic: 'csv', a: ACT.saveCsv }, { l: 'Comparison report (PDF)...', ic: 'report', a: ACT.report }]),
    { l: 'Print...', ic: 'print', k: 'Ctrl+P', a: op('print'), dis: needEd }, { l: 'Show file in folder', ic: 'open', a: () => ACT.reveal(), dis: () => !(ED() && ACT.hasPath()) },
    '-',
    {
      l: 'Open Recent',
      ic: 'recent',
      sub: [
        { h: 'Recent Drawings (Last 8)' },
        ...(recents().length
          ? recents().slice(0, 8).map((r, idx) => ({ l: `${idx + 1}. ${r.name}`, ic: 'open', tip: r.path, a: () => openRecent(r) }))
          : [{ l: '(No recent drawings yet)', dis: () => true }]),
        '-',
        { l: 'Clear Recent Drawings', ic: 'trash', a: () => { try { localStorage.removeItem('recent'); if (window.__recentMemFiles) window.__recentMemFiles.clear(); } catch (e) {} }, dis: () => !recents().length }
      ]
    },
    ...(recents().length ? recents().slice(0, 8).map(r => ({ l: r.name, ic: 'open', tip: r.path, a: () => openRecent(r) })) : []),
    '-', { l: 'Exit', ic: 'x', k: 'Alt+F4', a: () => window.native.quit() }
  ],
  Edit: () => [
    { l: 'Undo', ic: 'undo', k: 'Ctrl+Z', a: () => ED() ? ACT.eUndo() : (ACT.cUndo && ACT.cUndo()) }, { l: 'Redo', ic: 'redo', k: 'Ctrl+Y', a: () => ED() ? ACT.eRedo() : (ACT.cRedo && ACT.cRedo()) },
    '-',
    { l: 'Select all pages', ic: 'selectall', k: 'Ctrl+A', a: op('selAll'), dis: needEd }, { l: 'Select no pages', a: op('selNone'), dis: needEd }, { l: 'Select odd pages', a: op('selOdd'), dis: needEd }, { l: 'Select even pages', a: op('selEven'), dis: needEd }, { l: 'Invert selection', a: op('selInv'), dis: needEd },
    { l: 'Delete selected pages', ic: 'trash', k: 'Ctrl+Del', a: op('del'), dis: needEd },
    '-', { l: 'Clear measurements & markups', ic: 'ruler', a: () => {
      if (ED()) ACT.clearMeasure();
      else if ($('#rib-clear-markups')) $('#rib-clear-markups').click();
    } },
    '-', { l: 'Preferences...', ic: 'gear', k: 'Ctrl+,', a: prefs }
  ],
  View: () => [
    { l: 'Compare', ck: () => !ED(), a: () => setView('compare'), k: 'Ctrl+1' }, { l: 'Editor', ck: () => ED(), a: () => setView('edit'), k: 'Ctrl+2' },
    '-',
    ...(ED() ? [] : [
      {
        l: 'Comparison Mode',
        ic: 'tabCompare',
        sub: [
          { h: 'Visual Comparison Mode' },
          { l: '1. Overlay on paper', k: '1', a: () => window.UIRibbon && window.UIRibbon.setCompareMode ? window.UIRibbon.setCompareMode('paper') : ACT.cMode(0) },
          { l: '2. Overlay dark (CAM)', k: '2', a: () => window.UIRibbon && window.UIRibbon.setCompareMode ? window.UIRibbon.setCompareMode('over') : ACT.cMode(1) },
          { l: '3. Differences only', k: '3', a: () => window.UIRibbon && window.UIRibbon.setCompareMode ? window.UIRibbon.setCompareMode('diff') : ACT.cMode(2) },
          { l: '4. Side by side', k: '4', a: () => window.UIRibbon && window.UIRibbon.setCompareMode ? window.UIRibbon.setCompareMode('side') : ACT.cMode(3) },
          { l: '5. Blink A / B', k: '5', a: () => window.UIRibbon && window.UIRibbon.setCompareMode ? window.UIRibbon.setCompareMode('blink') : ACT.cMode(4) },
          { l: '6. Curtain Split Slider', k: 'C', a: () => window.UIRibbon && window.UIRibbon.setCompareMode ? window.UIRibbon.setCompareMode('curtain') : null },
          { l: '7. Base (A) only', k: '6', a: () => window.UIRibbon && window.UIRibbon.setCompareMode ? window.UIRibbon.setCompareMode('A') : ACT.cMode(5) },
          { l: '8. Revised (B) only', k: '7', a: () => window.UIRibbon && window.UIRibbon.setCompareMode ? window.UIRibbon.setCompareMode('B') : ACT.cMode(6) }
        ]
      },
      {
        l: 'View & Enhance Filter',
        ic: 'tabView',
        sub: [
          { h: 'Signal & Line Enhancement' },
          { l: 'Normal (Unfiltered)', a: () => window.setEnhanced && window.setEnhanced('off') },
          { l: 'High Contrast (Boost Lines)', a: () => window.setEnhanced && window.setEnhanced('enh') },
          { l: 'Extra Dark (Fine Scans)', a: () => window.setEnhanced && window.setEnhanced('dark') },
          { l: 'Blueprint CAD Mode', a: () => window.setEnhanced && window.setEnhanced('blue') }
        ]
      },
      {
        l: 'Resolution (DPI)',
        ic: 'gear',
        sub: [
          { h: 'Rasterization & Analysis DPI' },
          ...['150', '200', '300', '400', '600'].map(d => ({
            l: `${d} dpi`,
            a: () => {
              const mainDpi = $('#dpi');
              if (mainDpi) { mainDpi.value = d; mainDpi.dispatchEvent(new Event('change')); }
            }
          }))
        ]
      },
      {
        l: 'Inspection Optics',
        ic: 'loupe',
        sub: [
          { l: 'Split Curtain Slider', k: 'C', a: () => $('#rib-curtain-toggle') && $('#rib-curtain-toggle').click() },
          { l: '4x Optical Loupe', k: 'L', a: () => $('#rib-loupe-toggle') && $('#rib-loupe-toggle').click() },
          { l: 'Calibrated Reference Grid', k: 'G', a: () => $('#rib-grid-toggle') && $('#rib-grid-toggle').click() },
          { l: 'Full-Viewport Crosshair', k: 'X', a: () => $('#rib-crosshair-toggle') && $('#rib-crosshair-toggle').click() },
          { l: 'Show / Hide Difference Markers', k: 'M', a: () => ACT.toggleMarkers && ACT.toggleMarkers() }
        ]
      },
      '-'
    ]),
    { l: 'Zoom in', ic: 'zoomin', k: 'Ctrl+=', a: () => ED() ? ACT.eZoomIn() : ACT.cZoomIn() }, { l: 'Zoom out', ic: 'zoomout', k: 'Ctrl+-', a: () => ED() ? ACT.eZoomOut() : ACT.cZoomOut() }, { l: 'Fit page', ic: 'fit', k: 'Ctrl+0', a: () => ED() ? ACT.eFit() : ACT.cFit() }, { l: 'Fit width', a: ACT.eFitWidth, dis: needEd }, { l: 'Actual size (100%)', a: ACT.eActual, dis: needEd },
    '-',
    { l: 'Night mode (invert page colours)', ic: 'moon', k: 'Ctrl+Shift+N', ck: () => ACT.nightOn(), a: ACT.night, dis: needEd },
    { l: 'Page thumbnails', ck: () => !$('#thumbs').hidden && !$('#thumbs').classList.contains('rp-collapsed'), a: ACT.toggleThumbs, dis: needEd },
    { l: 'Side panel', k: 'Ctrl+B', ck: () => ED() ? !$('#etools').classList.contains('rp-collapsed') : !$('#view-compare aside').classList.contains('rp-collapsed'), a: () => {
      if (ED()) ACT.togglePanel();
      else {
        const as = $('#view-compare aside');
        if (as) { as.classList.toggle('rp-collapsed'); window.dispatchEvent(new Event('resize')); }
      }
    } },
    '-',
    { l: 'Full screen', k: 'F11', a: () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen() }
  ],
  Tools: () => ED() ? [
    { h: 'Pages' },
    { l: 'Rotate left', ic: 'rotL', k: 'Ctrl+Shift+R', a: op('rotL') }, { l: 'Rotate right', ic: 'rotR', k: 'Ctrl+R', a: op('rotR') }, { l: 'Rotate 180', ic: 'rot180', a: op('rot180') },
    { l: 'Duplicate', ic: 'copy', k: 'Ctrl+D', a: op('dup') }, { l: 'Insert blank page', ic: 'blank', k: 'Ctrl+Shift+B', a: op('blank') }, { l: 'Insert PDF after this page...', ic: 'insertPdf', a: op('insertpdf') },
    { l: 'Extract pages to a new file...', ic: 'extract', a: op('extract') }, { l: 'Reverse page order', ic: 'reverse', a: op('reverse') }, { l: 'Crop margins...', ic: 'crop', a: op('crop') }, { l: 'Resize page dimensions (A4, A3, Letter, ANSI)...', ic: 'pageSize', a: op('resize') }, { l: 'Bates numbering stamp...', ic: 'bates', a: op('bates') },
    '-', { h: 'Document' },
    { l: 'Merge PDFs...', ic: 'merge', a: op('merge') }, { l: 'Images to PDF...', ic: 'images', a: op('images') }, { l: 'Split...', ic: 'split', a: op('split') },
    { l: 'Header and footer...', ic: 'headerFooter', a: op('hf') }, { l: 'Page numbers...', ic: 'pageNums', a: op('nums') }, { l: 'Load custom font (.ttf / .otf / .woff)...', ic: 'fontFile', a: () => RE.loadCustomFontFile && RE.loadCustomFontFile() }, { l: 'Watermark...', ic: 'watermark', a: op('wm') },
    { l: 'Flatten to images...', ic: 'flatten', a: op('flatten') }, { l: 'Properties...', ic: 'info', a: op('meta') }, { l: 'Optimize', ic: 'zap', a: op('opt') },
    '-', { l: 'Edit text', ic: 'edittext', k: 'E', a: ACT.editText }, { l: 'Find in document...', ic: 'search', k: 'Ctrl+F', a: ACT.find }, { l: 'Measure distance', ic: 'ruler', k: 'M', a: ACT.measure }, { l: 'Go to page...', k: 'Ctrl+G', a: () => ACT.eGotoDialog() },
    '-', { l: 'Send to Compare as A', ic: 'sendA', a: op('toA') }, { l: 'Send to Compare as B', ic: 'sendB', a: op('toB') },
    '-', { h: 'Tabs' }, { l: 'Next tab', k: 'Ctrl+Tab', a: () => window.TABS.step(1) }, { l: 'Close tab', k: 'Ctrl+W', a: () => window.TABS.closeCur() }
  ] : [
    { l: 'Auto-align B to A', ic: 'align', k: 'A', a: ACT.align, dis: () => !S.cur }, { l: 'Swap A and B', ic: 'swap', k: 'S', a: ACT.swap }, { l: 'Go to page...', k: 'Ctrl+G', a: () => ACT.cGotoDialog() },
    '-', { l: 'Next difference', ic: 'next', k: 'N', a: ACT.nextDiff, dis: () => !S.cur }, { l: 'Previous difference', ic: 'prev', k: 'P', a: ACT.prevDiff, dis: () => !S.cur }, { l: 'Mark all on this page as reviewed', ic: 'check', a: ACT.markAll, dis: () => !S.cur },
    '-', { l: 'Ignore area (drag on the drawing)', ic: 'ignore', k: 'I', ck: () => S.ignMode, a: ACT.ignore }, { l: 'Clear all ignore areas', a: ACT.clearIgnore },
    '-', { l: 'Re-scan all pages', a: ACT.rescan, dis: () => !(S.A && S.B) }, { l: 'Comparison report (PDF)...', ic: 'report', a: ACT.report, dis: () => !(S.A && S.B) },
    '-', { h: 'Text & Batch Compare' }, { l: 'Text differences (word by word)...', ic: 'textDiff', k: 'Ctrl+T', a: () => ACT.textDiff(), dis: () => !(S.A && S.B) }, { l: 'Batch compare two folders...', ic: 'open', a: () => ACT.batch() },
    '-', { h: 'CAD & CAM (CAM350 / IPC / DXF)' },
    { l: 'CAM350 Workbench (D-Codes / Drills / IPC-D-356)...', ic: 'pcbCam', a: () => window.showCAM350WorkbenchModal && window.showCAM350WorkbenchModal('format') },
    { l: 'Open Gerber / Drill / IPC-D-356...', ic: 'pcbDual', a: () => window.UIRibbon && window.UIRibbon.promptCAMCompare() },
    { l: 'Run IPC Class 1/2/3 DFM & Clearance Scan', ic: 'clearance', a: () => window.UIRibbon && window.UIRibbon.runCAMClearanceScan() },
    { l: 'AutoCAD DXF Workbench (Layers & Vector Diff)...', ic: 'layers', a: () => window.showDXFWorkbenchModal && window.showDXFWorkbenchModal('layers') },
    { l: '⚡ Load Sample AutoCAD DXF (Rev A vs Rev B)', ic: 'tabCad', a: () => window.loadSampleDXF && window.loadSampleDXF() },
    { l: 'Import AutoCAD DXF...', ic: 'dxfIn', a: () => window.UIRibbon && window.UIRibbon.promptDXFImport() },
    { l: 'Export AutoCAD DXF...', ic: 'dxfOut', a: () => window.UIRibbon && window.UIRibbon.promptDXFExport() },
    { l: '3-Point Fiducial Alignment...', ic: 'fiducial', a: () => window.UIRibbon && window.UIRibbon.FiducialAligner.start() },
    '-', { h: 'Audit & Session' },
    { l: 'Executive Audit Report (PDF)...', ic: 'auditPdf', a: () => window.UIRibbon && window.UIRibbon.generateExecutiveAuditReport() },
    { l: 'Export Defect Checklist (CSV)...', ic: 'csv', a: () => window.UIRibbon && window.UIRibbon.exportDefectsCSV() },
    { l: 'Save Session (.redline)...', ic: 'sessionSave', a: () => window.UIRibbon && window.UIRibbon.saveSessionFile() },
    { l: 'Load Session (.redline)...', ic: 'sessionLoad', a: () => window.UIRibbon && window.UIRibbon.loadSessionFile() }
  ],
  Settings: () => [
    { h: 'IPC & CAM Measurement Units' },
    { l: 'IPC English (mils / inches)', ck: () => window.CAMState && window.CAMState.unitSystem === 'english', k: 'U', a: () => window.setUnitSystem && window.setUnitSystem('english') },
    { l: 'IPC Metric (mm / microns)', ck: () => window.CAMState && window.CAMState.unitSystem === 'metric', a: () => window.setUnitSystem && window.setUnitSystem('metric') },
    '-',
    { h: 'Appearance' },
    { l: 'Dark theme', ic: 'moon', ck: () => document.documentElement.dataset.theme === 'dark', a: () => window.setTheme('dark') },
    { l: 'Light theme', ic: 'sun', ck: () => document.documentElement.dataset.theme === 'light', a: () => window.setTheme('light') },
    '-',
    { l: 'Preferences...', ic: 'gear', k: 'Ctrl+,', a: prefs },
    { l: 'Show shortcut hints in title bar', ck: () => { try { return localStorage.getItem('showShortcutHint') !== 'false'; } catch (e) { return true; } }, a: () => {
      const hint = $('#rp-shortcut-hint');
      if (!hint) return;
      hint.hidden = !hint.hidden;
      try { localStorage.setItem('showShortcutHint', String(!hint.hidden)); } catch (e) {}
    } }
  ],
  Help: () => [
    { l: 'Quick guide', ic: 'book', a: guide },
    { l: 'Keyboard Shortcuts', ic: 'keyboard', k: '?', a: () => window.showKeyboardHUD ? window.showKeyboardHUD() : shortcuts() },
    '-',
    { l: 'Load Sample Drawings...', ic: 'open', a: () => window.promptSampleDrawings && window.promptSampleDrawings() },
    { l: '⚡ Load Sample Schematic (Rev A vs Rev B)', ic: 'open', a: () => window.loadSampleSchematic && window.loadSampleSchematic() },
    { l: '⚡ Load Sample PCB Gerber (Copper + Drill + IPC-D-356)', ic: 'pcbCam', a: () => window.loadSampleGerber && window.loadSampleGerber() },
    '-',
    { l: 'Visit Website (textportdocx.in)', ic: 'globe', a: () => window.openExternalUrl && window.openExternalUrl('https://redline.textportdocx.in') },
    { l: 'Check for Updates...', ic: 'zap', a: () => window.checkForUpdates ? window.checkForUpdates() : (window.openExternalUrl && window.openExternalUrl('https://redline.textportdocx.in')) },
    '-',
    { l: 'Help centre', ic: 'help', a: () => window.rpHelp() },
    { l: 'License', ic: 'shield', a: () => window.showTerms(true) },
    { l: 'About Redline Pro', ic: 'info', a: () => $('#modal').hidden = false }
  ]
};

let openName = null, dd = null, subDd = null;
function closeSubMenu() { if (subDd) { subDd.remove(); subDd = null; } }
function closeMenu() { closeSubMenu(); if (dd) { dd.remove(); dd = null; } document.querySelectorAll('.mb.open').forEach(b => b.classList.remove('open')); openName = null; }
function showSubMenu(parentBtn, items) {
  closeSubMenu();
  subDd = document.createElement('div');
  subDd.className = 'dd rp-submenu';
  items.forEach(it => {
    if (it === '-') { const s = document.createElement('div'); s.className = 'msep'; subDd.append(s); return; }
    if (it.h) { const h = document.createElement('div'); h.className = 'mh'; h.textContent = it.h; subDd.append(h); return; }
    const b = document.createElement('button'); b.className = 'mi'; b.disabled = !!(it.dis && it.dis()); if (it.tip) b.title = it.tip;
    b.innerHTML = (it.ic ? ic(it.ic) : '<span style="width:16px"></span>') + `<span class="l"></span>` + (it.k ? `<span class="k">${it.k}</span>` : '');
    b.querySelector('.l').textContent = it.l;
    b.onclick = e => { e.stopPropagation(); closeMenu(); it.a && it.a(); };
    subDd.append(b);
  });
  document.body.append(subDd);
  const pr = parentBtn.getBoundingClientRect();
  const leftPos = (pr.right + subDd.offsetWidth + 8 < innerWidth) ? (pr.right + 2) : Math.max(4, pr.left - subDd.offsetWidth - 2);
  subDd.style.left = leftPos + 'px';
  subDd.style.top = Math.max(4, Math.min(pr.top, innerHeight - subDd.offsetHeight - 8)) + 'px';
}
function openMenu(name, btn) {
  closeMenu(); openName = name; btn.classList.add('open'); dd = document.createElement('div'); dd.className = 'dd';
  MENUS[name]().forEach(it => {
    if (it === '-') { const s = document.createElement('div'); s.className = 'msep'; dd.append(s); return; }
    if (it.h) { const h = document.createElement('div'); h.className = 'mh'; h.textContent = it.h; dd.append(h); return; }
    const b = document.createElement('button'); b.className = 'mi' + (it.sub ? ' has-sub' : ''); b.disabled = !!(it.dis && it.dis()); if (it.tip) b.title = it.tip;
    b.innerHTML = (it.ck ? `<span class="ck">${it.ck() ? '&#10003;' : ''}</span>` : (it.ic ? ic(it.ic) : '<span style="width:16px"></span>')) + `<span class="l"></span>` + (it.sub ? `<span class="k">&#9656;</span>` : (it.k ? `<span class="k">${it.k}</span>` : ''));
    b.querySelector('.l').textContent = it.l;
    if (it.sub) {
      b.onmouseenter = () => showSubMenu(b, it.sub);
      b.onclick = e => { e.stopPropagation(); showSubMenu(b, it.sub); };
    } else {
      b.onmouseenter = () => closeSubMenu();
      b.onclick = () => { closeMenu(); it.a && it.a(); };
    }
    dd.append(b);
  });
  document.body.append(dd); const r = btn.getBoundingClientRect(); dd.style.left = Math.min(r.left, innerWidth - dd.offsetWidth - 6) + 'px'; dd.style.top = r.bottom + 2 + 'px';
  const h = dd.getBoundingClientRect().height; if (r.bottom + h > innerHeight) dd.style.maxHeight = innerHeight - r.bottom - 10 + 'px', dd.style.overflow = 'auto';
}
const bar = $('#menubar');
Object.keys(MENUS).forEach(n => { const b = document.createElement('button'); b.className = 'mb'; b.textContent = n; b.onclick = e => { e.stopPropagation(); openName === n ? closeMenu() : openMenu(n, b); }; b.onmouseenter = () => { if (openName && openName !== n) openMenu(n, b); }; bar.append(b); });
document.addEventListener('click', () => closeMenu()); addEventListener('blur', closeMenu);

// ----- preferences -----
async function prefs() {
  const P = window.PREF;
  const curUnits = (window.CAMState && window.CAMState.unitSystem) || 'english';
  const r = await dialog('Preferences', [
    { type: 'select', id: 'unitSystem', label: 'IPC / CAM Measurement Units', value: curUnits, options: [{ label: 'IPC English (mils / inches)', value: 'english' }, { label: 'IPC Metric (mm / microns)', value: 'metric' }] },
    { type: 'select', id: 'dpi', label: 'Compare quality', value: String(P.dpi), options: [{ label: '150 dpi (fast)', value: '150' }, { label: '200 dpi', value: '200' }, { label: '300 dpi (default)', value: '300' }, { label: '400 dpi', value: '400' }, { label: '600 dpi', value: '600' }] },
    { type: 'number', id: 'tol', label: 'Compare tolerance (0-150)', value: P.tol, min: 0, max: 150 }, { type: 'number', id: 'edge', label: 'Edge tolerance (px)', value: P.edge, min: 0, max: 4 }, { type: 'number', id: 'minpx', label: 'Minimum size (px)', value: P.minpx, min: 1, max: 50 },
    { type: 'number', id: 'scanMax', label: 'Scan every page automatically up to', value: P.scanMax, min: 1, max: 500 },
    { type: 'select', id: 'startView', label: 'Open on start', value: P.startView, options: [{ label: 'Compare', value: 'compare' }, { label: 'Editor', value: 'edit' }] },
    { id: 'author', label: 'Your name (for comments)', value: (() => { try { return localStorage.getItem('author') || ''; } catch (e) { return ''; } })() },
    { type: 'checkbox', id: 'confirmSave', label: 'Ask before saving over the original file', value: P.confirmSave },
    { type: 'note', label: 'Quality and tolerance changes apply the next time pages are compared.' }
  ], 'Save');
  if (!r) return;
  if (r.unitSystem && window.setUnitSystem) window.setUnitSystem(r.unitSystem, true);
  Object.assign(P, { dpi: +r.dpi, tol: r.tol, edge: r.edge, minpx: r.minpx, scanMax: r.scanMax, startView: r.startView, confirmSave: r.confirmSave }); savePrefs();
  $('#dpi').value = String(P.dpi); $('#tol').value = P.tol; $('#edge').value = P.edge; $('#minpx').value = P.minpx;
  if ($('#rib-dpi')) $('#rib-dpi').value = String(P.dpi);
  if ($('#rib-view-dpi')) $('#rib-view-dpi').value = String(P.dpi);
  if ($('#rp-diff-thresh')) $('#rp-diff-thresh').value = P.tol;
  if ($('#rp-tol-val')) $('#rp-tol-val').textContent = P.tol;
  if ($('#rp-noise-thresh')) $('#rp-noise-thresh').value = P.minpx;
  if ($('#rp-noise-val')) $('#rp-noise-val').textContent = P.minpx;
  if ($('#rp-edge-thresh')) $('#rp-edge-thresh').value = P.edge;
  if ($('#rp-edge-val')) $('#rp-edge-val').textContent = P.edge;
  try { localStorage.setItem('author', r.author.trim()); } catch (e) {} const a = $('#cAuthor'); if (a) a.value = r.author.trim();
  $('#dpi').dispatchEvent(new Event('change'));
}
ACT.prefs = prefs;

// ----- help -----
const pretty = k => k.split('+').map(p => ({ ctrl: 'Ctrl', shift: 'Shift', alt: 'Alt', pageup: 'Page Up', pagedown: 'Page Down', delete: 'Delete', escape: 'Esc', space: 'Space', backspace: 'Backspace', home: 'Home', end: 'End' }[p] || (p.length === 1 ? p.toUpperCase() : p.toUpperCase()))).join('+');
function shortcuts() {
  if (window.showKeyboardHUD) return window.showKeyboardHUD();
  const groups = {}; KEYS.forEach(([k, scope, , g, d]) => { const t = (scope === 'all' ? 'Everywhere' : scope === 'edit' ? 'Editor' : 'Compare') + ' - ' + g; (groups[t] = groups[t] || []).push([k, d]); });
  const html = Object.keys(groups).map(t => `<div class="mh">${t}</div><div class="sh">` + groups[t].map(([k, d]) => `<b>${pretty(k)}</b><span>${d}</span>`).join('') + '</div>').join('');
  dialog('Keyboard shortcuts', [{ type: 'html', label: html }], 'Close');
}
function guide() {
  dialog('Quick guide', [{ type: 'html', label: '<div class="mh">Compare Drawings & PCB CAM (CAM350 / IPC)</div><div class="nt">1. File → Open A and Open B (or drop PDFs, Gerber RS-274X, Excellon Drill, IPC-D-356, or DXF files on the window).\n2. Switch between IPC English (mils/in) and Metric (mm/µm) anytime using the Units dropdown or pressing U.\n3. Open the CAD & CAM tab for CAM350 Workbench: D-Code Aperture Table, T-Code Drill Schedule, IPC-D-356 Netlist Inspector, Outline/Skeleton Render Modes, Mirror Bottom Layer, and IPC Class 1/2/3 DFM Clearance Scans.\n4. Export a PNG, a list (CSV), AutoCAD .dxf, or an Executive Audit Report (PDF).</div><div class="mh">Edit and comment on PDFs</div><div class="nt">Open a PDF in the Editor. Draw tools are fixed into the page when you save. Comment tools (Note, Highlight, Underline, Strikeout) stay in the PDF as real comments; the Comments tab lists them, with reply, resolve and export.\nPage tools are on the right: rotate, delete, reorder (drag thumbnails), crop, merge, split, header and footer, watermark and more.</div>' }], 'Close');
}

// ----- title, external open, start -----
window.updateTitle = () => {
  let t, d = '';
  if (ED()) {
    const e = E();
    const hasEdFile = !!(e && e.bytes && e.name);
    d = hasEdFile ? e.name + (window.isDirty() ? '  \u2022 unsaved' : '') : '';
    t = (hasEdFile ? e.name + (window.isDirty() ? ' *' : '') + ' - ' : '') + 'Redline Pro';
  } else {
    d = (S.A && S.B) ? (S.names.A || 'Rev A') + '  vs  ' + (S.names.B || 'Rev B')
      : S.A ? 'Base (A): ' + (S.names.A || 'Loaded')
      : S.B ? 'New (B): ' + (S.names.B || 'Loaded')
      : '';
    t = (d ? d + ' - ' : '') + 'Redline Pro';
  }
  document.title = t; $('#docname').textContent = d;
};
setInterval(window.updateTitle, 1200);
window.openExternal = ({ name, path, b64, slot }) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); if (/\.redline$/i.test(name) && window.UIRibbon && window.UIRibbon.restoreSessionFromText) { setView('compare'); window.UIRibbon.restoreSessionFromText(new TextDecoder().decode(u)); return; } if (/\.(dxf|gbr|ger|art|top|bot|gtl|gbl|gbs|gts|gto|gbo|gtp|gbp|gko|gm1|drl|xln|ipc|d356|net)$/i.test(name) && window.openExternalCADOrCAM) { window.openExternalCADOrCAM(u, name, path, slot); return; } if (slot) { setView('compare'); compareLoadBytes(slot, u, name, path); return; } setView('edit'); RE.openBytes(u, name, path); };

// ----- shortcuts -----
const KEYS = [
  ['ctrl+1', 'all', () => setView('compare'), 'View', 'Compare view'], ['ctrl+2', 'all', () => setView('edit'), 'View', 'Editor view'],
  ['ctrl+o', 'all', () => ED() ? ACT.eOpen() : ACT.openA(), 'File', 'Open PDF (Compare: open A)'], ['ctrl+shift+o', 'all', () => { setView('compare'); ACT.openB(); }, 'File', 'Open B in Compare'],
  ['ctrl+,', 'all', () => ACT.prefs(), 'General', 'Preferences'], ['f1', 'all', () => shortcuts(), 'General', 'Keyboard shortcuts'], ['?', 'all', () => shortcuts(), 'General', 'Keyboard shortcuts'],
  ['f11', 'all', () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(), 'General', 'Full screen'], ['ctrl+shift+d', 'all', () => window.setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'), 'General', 'Light / dark theme'],
  ['ctrl+0', 'all', () => ED() ? ACT.eFit() : ACT.cFit(), 'Zoom', 'Fit page'], ['ctrl+9', 'all', () => ED() ? ACT.eFitWidth() : ACT.cFit(), 'Zoom', 'Fit width'], ['ctrl+shift+0', 'edit', () => ACT.eActual(), 'Zoom', 'Actual size (100%)'],
  ['ctrl+=', 'all', () => ED() ? ACT.eZoomIn() : ACT.cZoomIn(), 'Zoom', 'Zoom in'], ['ctrl++', 'all', () => ED() ? ACT.eZoomIn() : ACT.cZoomIn(), 'Zoom', 'Zoom in'], ['ctrl+-', 'all', () => ED() ? ACT.eZoomOut() : ACT.cZoomOut(), 'Zoom', 'Zoom out'],
  ['escape', 'edit', () => ACT.eEscape(), 'General', 'Back to Select tool, clear selection, close Find'], ['escape', 'compare', () => ACT.cEscape(), 'General', 'Stop ignore mode, deselect'],
  // editor: tools
  ['v', 'edit', () => ACT.tool('select'), 'Tools', 'Select / move / select text'], ['e', 'edit', () => ACT.tool('edittext'), 'Tools', 'Edit existing text'], ['t', 'edit', () => ACT.tool('text'), 'Tools', 'Add text'],
  ['b', 'edit', () => ACT.tool('rect'), 'Tools', 'Box'], ['o', 'edit', () => ACT.tool('circle'), 'Tools', 'Circle / Ellipse'], ['l', 'edit', () => ACT.tool('line'), 'Tools', 'Line'], ['a', 'edit', () => ACT.tool('arrow'), 'Tools', 'Arrow'], ['p', 'edit', () => ACT.tool('draw'), 'Tools', 'Pen'], ['q', 'edit', () => ACT.tool('pin'), 'Tools', 'Pin Marker'], ['y', 'edit', () => ACT.tool('poly'), 'Tools', 'Polygon / Polyline'], ['c', 'edit', () => ACT.tool('cloud'), 'Tools', 'Revision Cloud'], ['d', 'edit', () => ACT.tool('leader'), 'Tools', 'Leader Callout'], ['z', 'edit', () => ACT.tool('eraser'), 'Tools', 'Eraser'],
  ['w', 'edit', () => ACT.tool('whiteout'), 'Tools', 'Whiteout'], ['x', 'edit', () => ACT.tool('redact'), 'Tools', 'Redact'], ['i', 'edit', () => ACT.tool('image'), 'Tools', 'Image'], ['g', 'edit', () => ACT.tool('sign'), 'Tools', 'Signature'], ['s', 'edit', () => ACT.tool('stamp'), 'Tools', 'Stamp'],
  ['n', 'edit', () => ACT.tool('cnote'), 'Comments', 'Note'], ['h', 'edit', () => ACT.tool('chl'), 'Comments', 'Highlight'], ['u', 'edit', () => ACT.tool('cul'), 'Comments', 'Underline'], ['k', 'edit', () => ACT.tool('cst'), 'Comments', 'Strikeout'], ['m', 'edit', () => ACT.tool('measure'), 'Tools', 'Measure'],
  // editor: file, edit, pages
  ['ctrl+s', 'edit', () => ACT.eSave(), 'File', 'Save'], ['ctrl+shift+s', 'edit', () => ACT.eSaveAs(), 'File', 'Save as'], ['ctrl+p', 'edit', () => ACT.op('print'), 'File', 'Print'],
  ['ctrl+z', 'all', () => ED() ? ACT.eUndo() : (ACT.cUndo && ACT.cUndo()), 'Edit', 'Undo'], ['ctrl+y', 'all', () => ED() ? ACT.eRedo() : (ACT.cRedo && ACT.cRedo()), 'Edit', 'Redo'], ['ctrl+shift+z', 'all', () => ED() ? ACT.eRedo() : (ACT.cRedo && ACT.cRedo()), 'Edit', 'Redo'],
  ['ctrl+f', 'edit', () => ACT.find(), 'Edit', 'Find in document'], ['f3', 'edit', () => ACT.findStep(1), 'Edit', 'Next match'], ['shift+f3', 'edit', () => ACT.findStep(-1), 'Edit', 'Previous match'],
  ['delete', 'edit', () => { if (!ACT.eDeleteAnn()) return false; }, 'Edit', 'Delete selected item'], ['backspace', 'edit', () => { if (!ACT.eDeleteAnn()) return false; }, 'Edit', 'Delete selected item'], ['ctrl+delete', 'edit', () => ACT.op('del'), 'Pages', 'Delete selected pages'],
  ['ctrl+a', 'edit', () => ACT.op('selAll'), 'Pages', 'Select all pages'], ['ctrl+r', 'edit', () => ACT.op('rotR'), 'Pages', 'Rotate right'], ['ctrl+shift+r', 'edit', () => ACT.op('rotL'), 'Pages', 'Rotate left'],
  ['ctrl+d', 'edit', () => ACT.op('dup'), 'Pages', 'Duplicate page'], ['ctrl+shift+b', 'edit', () => ACT.op('blank'), 'Pages', 'Insert blank page'], ['ctrl+shift+n', 'edit', () => ACT.night(), 'View', 'Night mode'],
  ['pageup', 'edit', () => ACT.ePage(-1), 'Pages', 'Previous page'], ['pagedown', 'edit', () => ACT.ePage(1), 'Pages', 'Next page'], ['ctrl+home', 'edit', () => ACT.eFirst(), 'Pages', 'First page'], ['ctrl+end', 'edit', () => ACT.eLast(), 'Pages', 'Last page'], ['ctrl+g', 'edit', () => ACT.eGotoDialog(), 'Pages', 'Go to page'],
  // compare
  ['n', 'compare', () => (window.UIRibbon && window.UIRibbon.DefectState && window.UIRibbon.DefectState.defects.length ? window.UIRibbon.DefectState.next() : ACT.nextDiff()), 'Differences', 'Next Defect (Auto-center & Zoom)'],
  ['f3', 'compare', () => (window.UIRibbon && window.UIRibbon.DefectState && window.UIRibbon.DefectState.defects.length ? window.UIRibbon.DefectState.next() : ACT.nextDiff()), 'Differences', 'Next Defect (Auto-center & Zoom)'],
  ['p', 'compare', () => (window.UIRibbon && window.UIRibbon.DefectState && window.UIRibbon.DefectState.defects.length ? window.UIRibbon.DefectState.prev() : ACT.prevDiff()), 'Differences', 'Previous Defect'],
  ['shift+f3', 'compare', () => (window.UIRibbon && window.UIRibbon.DefectState && window.UIRibbon.DefectState.defects.length ? window.UIRibbon.DefectState.prev() : ACT.prevDiff()), 'Differences', 'Previous Defect'],
  ['space', 'compare', () => {
    if (S.mode === 'A') ACT.cMode(6);
    else if (S.mode === 'B') ACT.cMode(5);
    else if (S.mode === 'blink') { S.phase ^= 1; if (typeof paint === 'function') paint(); if (window.rpSharpen) window.rpSharpen(); }
    else ACT.cMode(4);
  }, 'Navigation & Diff', 'Instant Blink Toggle (A / B)'],
  ['shift+space', 'compare', () => ACT.markAll(), 'Differences', 'Mark all on page reviewed'],
  ['f', 'compare', () => { ACT.cFit(); if (window.rpSharpen) window.rpSharpen(); }, 'View', 'Fit Drawing to Viewport & Re-Sharpen Vectors'],
  ['m', 'compare', () => ACT.toggleMarkers(), 'View', 'Show / hide markers'],
  ['1', 'compare', () => ACT.cMode(0), 'View modes', 'Overlay on paper'], ['2', 'compare', () => ACT.cMode(1), 'View modes', 'Overlay dark'], ['3', 'compare', () => ACT.cMode(2), 'View modes', 'Differences only'], ['4', 'compare', () => ACT.cMode(3), 'View modes', 'Side by side'], ['5', 'compare', () => ACT.cMode(4), 'View modes', 'Blink A / B'], ['6', 'compare', () => ACT.cMode(5), 'View modes', 'A only'], ['7', 'compare', () => ACT.cMode(6), 'View modes', 'B only'],
  ['ctrl+a', 'compare', () => ACT.align(), 'Alignment', 'Auto-Align Drawings'],
  ['a', 'compare', () => ACT.align(), 'Actions', 'Auto-align'], ['s', 'compare', () => ACT.swap(), 'Actions', 'Swap A and B'], ['i', 'compare', () => ACT.ignore(), 'Actions', 'Draw ignore areas'], ['r', 'compare', () => ACT.rescan(), 'Actions', 'Re-scan all pages'],
  ['delete', 'compare', () => { if (!ACT.hasIgnoreSel()) return false; ACT.delIgnoreSel(); }, 'Actions', 'Delete selected ignore area'], ['backspace', 'compare', () => { if (!ACT.hasIgnoreSel()) return false; ACT.delIgnoreSel(); }, 'Actions', 'Delete selected ignore area'],
  ['ctrl+e', 'compare', () => ACT.savePng(), 'Export', 'Save comparison image'], ['ctrl+shift+e', 'compare', () => ACT.report(), 'Export', 'Comparison report (PDF)'], ['ctrl+shift+c', 'compare', () => ACT.saveCsv(), 'Export', 'Differences list (CSV)'],
  ['pageup', 'compare', () => ACT.cPage(-1), 'Pages', 'Previous page'], ['pagedown', 'compare', () => ACT.cPage(1), 'Pages', 'Next page'], ['ctrl+home', 'compare', () => ACT.cFirst(), 'Pages', 'First page'], ['ctrl+end', 'compare', () => ACT.cLast(), 'Pages', 'Last page'], ['ctrl+g', 'compare', () => ACT.cGotoDialog(), 'Pages', 'Go to page']
];
const KMAP = {}; KEYS.forEach(r => (KMAP[r[0]] = KMAP[r[0]] || []).push(r));
function keyOf(e) {
  let k = e.key; if (k === ' ') k = 'space'; else if (k.length === 1) k = k.toLowerCase(); else k = k.toLowerCase().replace('arrow', '');
  const c = e.ctrlKey || e.metaKey, symbol = k.length === 1 && !/[a-z0-9]/.test(k);
  return (c ? 'ctrl+' : '') + (e.altKey ? 'alt+' : '') + (e.shiftKey && !symbol ? 'shift+' : '') + k;
}
addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#modal').hidden) { $('#modal').hidden = true; return; }
  if (e.key === 'Escape') closeMenu();
  if (!$('#dlg').hidden || !$('#modal').hidden || e.isComposing) return;
  const k = keyOf(e), list = KMAP[k]; if (!list) return;
  const typing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable, ctrl = k.startsWith('ctrl+');
  if (typing && (!ctrl || /^ctrl\+(shift\+)?[acvxyz]$/.test(k))) return;
  if (document.body.dataset.view === 'edit' && ctrl === false && getSelection && !getSelection().isCollapsed && ['delete', 'backspace'].includes(k)) return;
  const row = list.find(r => r[1] === 'all' || (r[1] === 'edit') === ED()); if (!row) return;
  if (row[2]() === false) return; e.preventDefault();
});
$('#close').onclick = () => $('#modal').hidden = true; $('#modal').onclick = e => { if (e.target.id === 'modal') $('#modal').hidden = true; };
if ($('#about-btn')) $('#about-btn').onclick = () => { $('#modal').hidden = false; };
if ($('#brand-about')) $('#brand-about').onclick = () => { $('#modal').hidden = false; };
window.checkForUpdates = async () => {
  const r = await dialog('Check for Updates — Redline Pro', [
    { type: 'html', label: '<div style="display:flex;flex-direction:column;gap:8px"><div><b>Installed Version:</b> Redline Pro 1.0.0 (Enterprise Engineering Edition)</div><div><b>Publisher:</b> Redline Studio &middot; <a href="https://redline.textportdocx.in" class="rp-ext-link">https://redline.textportdocx.in</a></div><div style="color:var(--mute);font-size:12px">Redline Pro runs 100% offline with zero background network calls. Click below to open the official release page in your default browser to check for new versions.</div></div>' }
  ], 'Visit redline.textportdocx.in');
  if (r && window.openExternalUrl) window.openExternalUrl('https://redline.textportdocx.in');
};
if ($('#about-website-btn')) $('#about-website-btn').onclick = () => { if (window.openExternalUrl) window.openExternalUrl('https://redline.textportdocx.in'); };
if ($('#about-updates-btn')) $('#about-updates-btn').onclick = () => { $('#modal').hidden = true; window.checkForUpdates(); };
if ($('#about-guide-btn')) $('#about-guide-btn').onclick = () => { $('#modal').hidden = true; guide(); };
if ($('#about-shortcuts-btn')) $('#about-shortcuts-btn').onclick = () => { $('#modal').hidden = true; shortcuts(); };
if ($('#about-license-btn')) $('#about-license-btn').onclick = () => { $('#modal').hidden = true; if (window.showTerms) window.showTerms(true); };
if ($('#about-copy-btn')) $('#about-copy-btn').onclick = async () => {
  const units = (window.CAMState && window.CAMState.unitSystem === 'metric') ? 'IPC Metric (mm/µm)' : 'IPC English (mil/in)';
  const theme = document.documentElement.dataset.theme || 'dark';
  const dpi = ($('#dpi') && $('#dpi').value) || '300';
  const info = [
    'Redline Pro — Version 1.0.0 (Enterprise Engineering Edition)',
    'Publisher: Redline Studio · textportdocx.in',
    'License: 100% Free for Personal & Commercial Use (100% Offline / Zero Telemetry)',
    'Engines: PDF.js + PDF-Lib Vector Core · AutoCAD DXF R12/R2000 · CAM350 Gerber RS-274X / Excellon / IPC-D-356 · OSNAP Measure',
    'Active Settings: ' + dpi + ' DPI · ' + units + ' · Theme: ' + theme
  ].join('\n');
  try { await navigator.clipboard.writeText(info); } catch (e) {}
  const lbl = $('#about-copy-lbl');
  if (lbl) { lbl.textContent = 'Copied!'; setTimeout(() => { lbl.textContent = 'Copy Diagnostics'; }, 1800); }
};
const TIP = { 'pin': 'Pin Marker Badge', 'eraser': 'Eraser (Z)', 'select': 'Select (V)', 'edittext': 'Edit text (E)', 'text': 'Text (T)', 'rect': 'Box (B)', 'line': 'Line (L)', 'arrow': 'Arrow (A)', 'draw': 'Pen (P)', 'whiteout': 'Whiteout (W)', 'redact': 'Redact (X)', 'image': 'Image (I)', 'sign': 'Signature (G)', 'stamp': 'Stamp (S)', 'cnote': 'Note (N)', 'chl': 'Highlight (H)', 'cul': 'Underline (U)', 'cst': 'Strikeout (K)', 'measure': 'Measure (M)' };
document.querySelectorAll('[data-t]').forEach(b => { if (!b.title && TIP[b.dataset.t]) b.title = TIP[b.dataset.t]; });
const BT = { eSave: 'Save (Ctrl+S)', eSaveAs: 'Save as (Ctrl+Shift+S)', eUndo: 'Undo (Ctrl+Z)', eRedo: 'Redo (Ctrl+Y)', eFind: 'Find (Ctrl+F)', eOpen: 'Open (Ctrl+O)', openA: 'Open A (Ctrl+O)', openB: 'Open B (Ctrl+Shift+O)', align: 'Auto-align (A)', swap: 'Swap A and B (S)', ignBtn: 'Draw an ignore area (I). Right-click an area to delete it', report: 'Comparison report (Ctrl+Shift+E)', png: 'Save image (Ctrl+E)', csv: 'Differences list (Ctrl+Shift+C)', prevD: 'Previous difference (P)', nextD: 'Next difference (N)', eFit: 'Fit page (Ctrl+0)', eZi: 'Zoom in (Ctrl +)', eZo: 'Zoom out (Ctrl -)' };
Object.keys(BT).forEach(id => { const el = document.getElementById(id); if (el) el.title = BT[id]; });
hydrateIcons(); if (PREF.startView === 'edit') setView('edit'); window.updateTitle();
})();
