# Redline Pro & Redline Pro PDF Editor 1.0 — Two Separate Applications in One Codebase

**Publisher / Developer:** Redline Studio · [textportdocx.in](https://textportdocx.in)  
**Version:** 1.0.0  
**License:** 100% Free for both commercial and personal engineering use.  
**Privacy & Security:** 100% Offline. Zero telemetry, zero network calls, zero external API dependencies. All PDF, CAD, and CAM operations run completely client-side in pure JavaScript and Web Workers.

---

## Dual-Application Architecture (One Codebase, Two Separate Applications)

This repository delivers **two standalone applications** powered by a single unified codebase:

1. **Redline Pro (`index.html` / `Redline Pro.exe`)** — **Engineering Drawing Compare, AutoCAD DXF & CAM350 Verification Studio**
   - Dedicated to A/B schematic & drawing comparison, sub-pixel auto-alignment, 3-point fiducial registration, 60 FPS split curtain, 4x optical loupe, Gerber RS-274X & Excellon NC Drill inspection, IPC-D-356 netlist verification, IPC Class 1/2/3 DFM checks, bi-directional AutoCAD DXF studio, and Executive QA Audit Reports.
2. **Redline Pro PDF Editor (`pdf-editor.html` / `Redline Pro PDF Editor.exe`)** — **Enterprise PDF Markup, Typography, Measurement & Page Assembly Application**
   - Dedicated standalone PDF Editor application featuring MS Office-style ribbon tabs (`Home`, `Insert & Draw`, `Review & Measure`, `Page Layout`, `Document & Export`), direct on-page WYSIWYG typing, in-place PDF text editing, 18+ built-in fonts + custom `.TTF/.OTF/.WOFF` font loader, freehand pen, object/brush eraser, shapes, ANSI/ISO revision clouds, leader callouts, numbered inspection pins, QA stamps, handwritten signatures, permanent security redaction, calibrated distance & area measurement, multi-PDF merge/split/extract/crop/resize/Bates numbering, and multi-tab document management.
   - **Seamless Inter-App Bridge:** Launch **Redline Pro PDF Editor** directly from **Redline Pro** in its own independent native window (or vice versa), and send open PDFs from **Redline Pro PDF Editor** directly to **Redline Pro** Compare Slot A or Slot B with one click.

---

## Running from Source

Requires Node.js 18 or newer:

```bash
npm install

# Launch App 1: Redline Pro (Drawing & CAM Compare)
npm start

# Launch App 2: Redline Pro PDF Editor (Standalone PDF Editor)
npm run start:pdf-editor

# Launch Both Applications Simultaneously in Separate Windows
npm run start:both
```

On Windows, you can also double-click:
- `Start-Redline-Pro.bat` — Opens **Redline Pro**
- `Start-Redline-Pro-PDF-Editor.bat` — Opens **Redline Pro PDF Editor**

---

## Packaging for Distribution (Windows EXEs)

Run `Build-Windows-EXEs.bat` (or `npm run dist:all`):

```bash
# 1. Package unpacked Windows directory
npm run dist:dir

# 2. Patch "Redline Pro.exe" AND generate/patch "Redline Pro PDF Editor.exe"
npm run patch:exe

# 3. Build portable executable
npm run dist:portable

# 4. Build Windows NSIS Setup Installer (installs both apps + Desktop/Start Menu shortcuts)
npm run dist:setup
```

The NSIS installer (`RedlinePro-Setup-1.0.0.exe`) installs both `Redline Pro.exe` and `Redline Pro PDF Editor.exe`, creates Desktop and Start Menu shortcuts for both applications, and registers Windows Explorer right-click context menu entries (`Edit with Redline Pro PDF Editor` and `Compare with Redline Pro`).

---

## File Architecture

| File | Module / Responsibility |
|---|---|
| `index.html` | **App 1 Entry:** Redline Pro (Drawing Compare, CAD DXF & CAM350 Verification) |
| `pdf-editor.html` | **App 2 Entry:** Redline Pro PDF Editor (Standalone PDF Markup, Typography & Page Studio) |
| `main.js` | Electron dual-application main process, multi-window manager (`compareWin` & `editorWin`), IPC bridge, CLI/EXE routing (`--pdf-editor`, `--compare`, `--both`) |
| `preload.js` | Secure IPC bridge (`window.native`, including `openPdfEditor` and `openCompareApp`) |
| `patch_exe.js` | Builds and patches both `Redline Pro.exe` and `Redline Pro PDF Editor.exe` with PE VersionInfo metadata and icons |
| `installer.nsi` | NSIS installer script creating shortcuts and Explorer shell associations for both applications |
| `dxf_engine.js` | Module 3: AutoCAD R12/2000 ASCII DXF export and import engine |
| `cam_engine.js` | Module 4: Gerber RS-274X, Excellon NC Drill parser, PCB copper renderer, 4-mil clearance check |
| `measure_engine.js` | Module 5: Scale calibration, OSNAP, distance, polyline, area, tally BOM counter, revision clouds, SHA-256 stamps |
| `worker_engine.js` | Module 6: 512x512 virtual tile grid, memory manager, and Web Worker RPC bridge |
| `worker.js` | Module 6: Dedicated background Web Worker for heavy pixel diffing and cluster labeling |
| `ui_ribbon.js` | Module 1 & 2: Categorized ribbon tabs, floating layer dock, curtain slider, fiducial align, defect navigator |
| `pro.js` | Pro additions: Enhanced views (contrast/blueprint), sharp zoom (`#hq`), panel resizers, system hooks |
| `app.js` | Compare engine (`window.CMP`), pixel diffing, layer classification, zoom/pan transforms |
| `editor.js` | PDF Editor workspace (`window.RE`) and inter-app handoff to Compare |
| `extras.js` | Editor tabs, context menus, auto-save recovery, text LCS diff, batch compare |
| `style.css` | Complete stylesheet for both applications |
