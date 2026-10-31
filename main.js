const { app, BrowserWindow, Menu, nativeTheme, dialog, ipcMain, shell, powerSaveBlocker, clipboard } = require('electron');

// Disable all renderer and timer throttling when minimized / occluded
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
const fs = require('fs');
const path = require('path');
const TD = process.env.REDLINE_TEST_DIR; // test hook: skip dialogs and write here
const TESTING = !!(TD || process.env.REDLINE_SELFTEST);
let win, force = false;

// ---- MODULE 1: Global Main Process Crash & Unhandled Rejection Boundaries ----
const diagnosticLog = [];
function recordMainDiagnostic(kind, errOrReason) {
  const ts = new Date().toISOString();
  const detail = (errOrReason && (errOrReason.stack || errOrReason.message))
    ? String(errOrReason.stack || errOrReason.message)
    : String(errOrReason);
  const entry = `[${ts}] [${kind}] ${detail}`;
  diagnosticLog.push(entry);
  if (diagnosticLog.length > 100) diagnosticLog.shift();

  if (!TESTING && !force && app && typeof app.isReady === 'function' && app.isReady()) {
    try {
      const choice = dialog.showMessageBoxSync(win && !win.isDestroyed() ? win : null, {
        type: 'warning',
        title: 'Redline Pro System Notice',
        message: 'An unexpected operation occurred and was safely contained.',
        detail: 'Your workspace remains active. Would you like to copy diagnostic details to the clipboard?',
        buttons: ['Continue', 'Copy Diagnostic Details'],
        defaultId: 0,
        cancelId: 0
      });
      if (choice === 1 && clipboard && typeof clipboard.writeText === 'function') {
        clipboard.writeText(diagnosticLog.join('\n\n'));
      }
    } catch (e) {}
  }
}
process.on('uncaughtException', (err) => {
  recordMainDiagnostic('uncaughtException', err);
});
process.on('unhandledRejection', (reason) => {
  recordMainDiagnostic('unhandledRejection', reason);
});

// ---- MODULE 5: Safe File Paths & Extension Preservation ----
function sanitizeFilePath(rawPath) {
  if (typeof rawPath !== 'string') return '';
  let cleaned = rawPath.trim().replace(/^["']+|["']+$/g, '');
  if (!cleaned) return '';
  return path.normalize(cleaned);
}
function ensureSaveExtension(filePath, defaultName, filters) {
  if (!filePath) return filePath;
  const cleanP = sanitizeFilePath(filePath);
  const curExt = path.extname(cleanP);
  if (curExt) return cleanP;
  const defExt = defaultName ? path.extname(String(defaultName)) : '';
  if (defExt) return cleanP + defExt;
  if (Array.isArray(filters) && filters[0] && Array.isArray(filters[0].extensions) && filters[0].extensions[0]) {
    const ext = String(filters[0].extensions[0]).replace(/^\./, '');
    if (ext && ext !== '*') return `${cleanP}.${ext}`;
  }
  return cleanP;
}

if (!TESTING && !app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', (e, argv) => {
  if (!win) return; if (win.isMinimized()) win.restore(); win.focus();
  handleArgs(argv);
});
// Explorer right-click "Compare with Redline": first file goes to A, the next one (within 5 s) to B
let cmpN = 0, cmpT = null;
function handleArgs(argv) {
  const files = (argv || []).slice(1)
    .map(a => sanitizeFilePath(a))
    .filter(a => a && /\.(pdf|dxf|gbr|ger|art|top|bot|gtl|gbl|gbs|gts|gto|gbo|gtp|gbp|gko|gm1|drl|xln|ipc|d356|net|redline|png|jpe?g|webp|bmp)$/i.test(a) && fs.existsSync(a));
  if (!files.length) return;
  if ((argv || []).includes('--compare')) files.forEach(f => { sendOpen(f, cmpN % 2 ? 'B' : 'A'); cmpN++; clearTimeout(cmpT); cmpT = setTimeout(() => cmpN = 0, 5000); });
  else files.forEach(f => sendOpen(f));
}

function sendOpen(rawFile, slot) {
  try {
    if (!win || win.isDestroyed()) return;
    const f = sanitizeFilePath(rawFile);
    if (!f || !fs.existsSync(f)) return;
    const b64 = fs.readFileSync(f).toString('base64');
    const payload = JSON.stringify({ name: path.basename(f), path: f, b64, slot })
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029');
    const run = () => {
      if (win && !win.isDestroyed()) {
        win.webContents.executeJavaScript(`window.openExternal && window.openExternal(${payload})`).catch(() => {});
      }
    };
    if (win.webContents.isLoading()) win.webContents.once('did-finish-load', run);
    else run();
  } catch (e) { /* unreadable file: ignore */ }
}

function create() {
  // Keep native Edit roles active for <input>/<textarea> Ctrl+Z/Y/X/C/V/A while hiding the OS menu bar
  const editMenu = Menu.buildFromTemplate([
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    }
  ]);
  Menu.setApplicationMenu(editMenu);
  win = new BrowserWindow({
    width: 1500, height: 920, minWidth: 980, minHeight: 600, show: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0b100e' : '#f2f5f3', title: 'Redline Pro',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, preload: path.join(__dirname, 'preload.js'), spellcheck: false }
  });
  win.setMenuBarVisibility(false);
  if (win.webContents && typeof win.webContents.setBackgroundThrottling === 'function') {
    win.webContents.setBackgroundThrottling(false);
  }
  win.once('ready-to-show', () => win.show());
  if (TESTING) win.webContents.on('console-message', (e, l, msg, line, src) => { if (l >= 2) console.log('CONSOLE-ERR', String(msg).slice(0, 220), String(src).split('/').pop() + ':' + line); });
  win.webContents.on('did-finish-load', () => { if (!TESTING) handleArgs(process.argv); });
  win.on('close', async e => {
    if (force) return; e.preventDefault();
    let dirty = false; try { dirty = await win.webContents.executeJavaScript('!!(window.isDirty && window.isDirty())'); } catch (x) {}
    if (!dirty) { force = true; clearRecovery(); win.close(); return; }
    const r = await dialog.showMessageBox(win, { type: 'warning', buttons: ['Cancel', 'Close without saving'], defaultId: 0, cancelId: 0, title: 'Unsaved changes', message: 'You have unsaved changes.', detail: 'If you close now they will be lost.' });
    if (r.response === 1) { force = true; clearRecovery(); win.close(); }
  });
  // Route all external http/https window.open and navigation attempts to the OS default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      shell.openExternal(url).catch(() => {});
    }
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      e.preventDefault();
      shell.openExternal(url).catch(() => {});
    }
  });
  // native Cut / Copy / Paste menu for text boxes (Electron has none by default)
  win.webContents.on('context-menu', (e, p) => {
    if (!p.isEditable) return;
    Menu.buildFromTemplate([{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { type: 'separator' }, { role: 'selectAll' }]).popup({ window: win });
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.once('did-finish-load', () => { if (win && !win.isDestroyed() && !win.isVisible()) win.show(); });
}
app.whenReady().then(create);
app.on('window-all-closed', () => app.quit());

const readOne = rawP => {
  const p = sanitizeFilePath(rawP);
  return { name: path.basename(p), path: p, bytes: new Uint8Array(fs.readFileSync(p)) };
};
ipcMain.handle('open-files', async (e, o = {}) => {
  const r = await dialog.showOpenDialog(win, { title: o.title || 'Open', properties: ['openFile', ...(o.multi ? ['multiSelections'] : [])], filters: o.filters || [{ name: 'PDF', extensions: ['pdf'] }] });
  if (r.canceled) return [];
  const out = [];
  for (const p of r.filePaths) { try { out.push(readOne(p)); } catch (err) {} }
  return out;
});
ipcMain.handle('read-file', (e, p) => { try { return readOne(p); } catch (x) { return null; } });
ipcMain.handle('write-file', (e, { path: rawP, bytes }) => {
  const p = sanitizeFilePath(rawP);
  fs.writeFileSync(p, Buffer.from(bytes));
  return p;
});
ipcMain.handle('save-file', async (e, { name, bytes, filters }) => {
  let p;
  if (TD) p = path.join(TD, name);
  else {
    const r = await dialog.showSaveDialog(win, { defaultPath: name, filters });
    if (r.canceled || !r.filePath) return null;
    p = r.filePath;
  }
  p = ensureSaveExtension(p, name, filters);
  fs.writeFileSync(p, Buffer.from(bytes));
  return p;
});
ipcMain.handle('save-many', async (e, { files }) => {
  let dir;
  if (TD) dir = TD;
  else { const r = await dialog.showOpenDialog(win, { title: 'Choose a folder to save the files in', properties: ['openDirectory', 'createDirectory'] }); if (r.canceled) return null; dir = r.filePaths[0]; }
  for (const f of files) fs.writeFileSync(path.join(dir, f.name), Buffer.from(f.bytes));
  return dir;
});
// ---- auto-save / crash recovery ----
const recDir = () => path.join(app.getPath('userData'), 'recovery');
function clearRecovery() { try { fs.rmSync(recDir(), { recursive: true, force: true }); } catch (e) {} }
ipcMain.handle('rec-write', (e, list) => {
  clearRecovery(); if (!list || !list.length) return 0; fs.mkdirSync(recDir(), { recursive: true });
  const meta = list.map((f, i) => {
    const file = 'r' + i + '.pdf';
    fs.writeFileSync(path.join(recDir(), file), Buffer.from(f.bytes));
    return { file, name: f.name, path: f.path, ann: f.ann || {}, meas: f.meas || {}, at: Date.now() };
  });
  fs.writeFileSync(path.join(recDir(), 'list.json'), JSON.stringify(meta)); return meta.length;
});
ipcMain.handle('rec-list', () => {
  try { return JSON.parse(fs.readFileSync(path.join(recDir(), 'list.json'), 'utf8')).map(m => ({ ...m, bytes: fs.readFileSync(path.join(recDir(), m.file)) })); } catch (e) { return []; }
});
ipcMain.handle('rec-clear', () => clearRecovery());
ipcMain.handle('pick-folder', async (e, title) => {
  const r = await dialog.showOpenDialog(win, { title, properties: ['openDirectory'] }); if (r.canceled) return null;
  const dir = r.filePaths[0]; return { dir, files: fs.readdirSync(dir).filter(n => /\.pdf$/i.test(n)).map(n => path.join(dir, n)) };
});
ipcMain.handle('mtime', (e, p) => { try { return fs.statSync(p).mtimeMs; } catch (x) { return 0; } });
ipcMain.handle('quit', () => { win.close(); });
ipcMain.handle('reveal', (e, p) => { shell.showItemInFolder(p); });
ipcMain.handle('open-url', async (e, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});

// ---- Background execution lock (powerSaveBlocker) & Windows Taskbar Progress ----
let psbId = null;
function setPowerSaveLock(active) {
  try {
    if (active) {
      if (psbId == null || !powerSaveBlocker.isStarted(psbId)) {
        psbId = powerSaveBlocker.start('prevent-app-suspension');
      }
    } else if (psbId != null) {
      if (powerSaveBlocker.isStarted(psbId)) powerSaveBlocker.stop(psbId);
      psbId = null;
    }
  } catch (e) {}
  return psbId != null;
}

function updateTaskbarProgress(frac) {
  try {
    if (!win || win.isDestroyed()) return;
    if (frac == null || frac < 0) {
      win.setProgressBar(-1);
      setPowerSaveLock(false);
    } else {
      const clamped = Math.max(0, Math.min(1, Number(frac) || 0));
      win.setProgressBar(clamped);
      setPowerSaveLock(clamped < 1);
    }
  } catch (e) {}
}

ipcMain.handle('set-progress', (e, frac) => { updateTaskbarProgress(frac); return true; });
ipcMain.handle('set-busy-lock', (e, active) => setPowerSaveLock(!!active));
ipcMain.on('set-progress', (e, frac) => updateTaskbarProgress(frac));
ipcMain.on('set-busy-lock', (e, active) => setPowerSaveLock(!!active));
app.on('will-quit', () => setPowerSaveLock(false));

// Test hook (used only for automated checks): run a script in the page, print the result, save a screenshot, quit.
if (process.env.REDLINE_SELFTEST) app.whenReady().then(() => setTimeout(async () => {
  try {
    const r = await win.webContents.executeJavaScript(fs.readFileSync(process.env.REDLINE_SELFTEST, 'utf8'));
    console.log('SELFTEST', JSON.stringify(r));
    if (process.env.REDLINE_SHOT) fs.writeFileSync(process.env.REDLINE_SHOT, (await win.webContents.capturePage()).toPNG());
  } catch (e) { console.log('SELFTEST-ERROR', e.message); }
  force = true; app.quit();
}, 1500));
