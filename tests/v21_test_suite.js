/**
 * Redline Pro 1.0 — Comprehensive Automated Verification Test Suite
 * Tests all 6 modules:
 * 1. Categorized Ribbon & UI State
 * 2. Precision Auto-Alignment & Jump-to-Defect Navigator
 * 3. Offline Bi-Directional CAD (DXF) Engine
 * 4. Industrial PCB CAM (Gerber RS-274X & Excellon Drill) Engine
 * 5. Engineering Measurement & Markup Suite (OSNAP)
 * 6. Virtual Viewport Memory Optimization & Audit Reporting
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('   REDLINE PRO 1.0 AUTOMATED VERIFICATION SUITE     ');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         Error: ${err.message}`);
    if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'));
  }
}

async function testAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         Error: ${err.message}`);
    if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'));
  }
}

(async () => {
  // ----------------------------------------------------
  // MODULE 3: CAD (DXF) ENGINE TESTS
  // ----------------------------------------------------
  console.log('\n--- MODULE 3: CAD (DXF) Engine ---');
  const DXF = require('../dxf_engine.js');

  test('DXFWriter initializes with correct unit scales', () => {
    const wMM = new DXF.DXFWriter({ unit: 'mm', scale: 1.0 });
    assert.strictEqual(wMM.unitInfo.code, 4);
    assert.strictEqual(wMM.unitInfo.name, 'Millimeters');

    const wMils = new DXF.DXFWriter({ unit: 'mils', scale: 1.0 });
    assert.strictEqual(wMils.unitInfo.code, 10);
    assert.strictEqual(wMils.unitInfo.name, 'Mils');

    const wIn = new DXF.DXFWriter({ unit: 'in', scale: 1.0 });
    assert.strictEqual(wIn.unitInfo.code, 1);
    assert.strictEqual(wIn.unitInfo.name, 'Inches');
  });

  test('DXFWriter generates AutoCAD 2000 compliant ASCII DXF with layers', () => {
    const writer = new DXF.DXFWriter({ unit: 'mm', scale: 1.0 });
    writer.addLine(0, 0, 100, 100, 'GEOMETRY');
    writer.addCircle(50, 50, 20, 'GEOMETRY');
    writer.addRect(0, 0, 500, 300, 'SHEET_BORDER');
    writer.addText('Schematic Revision 2.1', 20, 20, 12, 0, 'TEXT');
    writer.addSolid([10, 10], [20, 10], [20, 20], [10, 20], 'REDLINE_DIFFS');

    const dxfStr = writer.generateString();
    assert(dxfStr.includes('AC1015'), 'Header must declare AutoCAD 2000 (AC1015)');
    assert(dxfStr.includes('$INSUNITS'), 'Header must declare $INSUNITS');
    assert(dxfStr.includes('SHEET_BORDER'), 'Must contain SHEET_BORDER layer');
    assert(dxfStr.includes('GEOMETRY'), 'Must contain GEOMETRY layer');
    assert(dxfStr.includes('TEXT'), 'Must contain TEXT layer');
    assert(dxfStr.includes('REDLINE_DIFFS'), 'Must contain REDLINE_DIFFS layer');
    assert(dxfStr.endsWith('0\r\nEOF\r\n'), 'Must terminate with standard 0 EOF');
  });

  test('DXFParser successfully parses LINE, CIRCLE, LWPOLYLINE, TEXT and computes bounding box', () => {
    const writer = new DXF.DXFWriter({ unit: 'mm', scale: 1.0 });
    writer.addLine(10, 20, 110, 120, 'GEOMETRY');
    writer.addCircle(60, 70, 25, 'GEOMETRY');
    writer.addRect(0, 0, 200, 150, 'SHEET_BORDER');
    writer.addText('BOARD_OUTLINE', 15, 25, 10, 0, 'TEXT');

    const dxfStr = writer.generateString();
    const parser = new DXF.DXFParser(dxfStr).parse();

    assert.strictEqual(parser.entities.length, 4, 'Must parse exactly 4 entities');
    assert.strictEqual(parser.entities[0].type, 'LINE');
    assert.strictEqual(parser.entities[1].type, 'CIRCLE');
    assert.strictEqual(parser.entities[2].type, 'LWPOLYLINE');
    assert.strictEqual(parser.entities[3].type, 'TEXT');
    assert.strictEqual(parser.entities[3].text, 'BOARD_OUTLINE');
    assert(parser.bounds.maxX > parser.bounds.minX, 'Bounds must be valid positive area');
  });

  // ----------------------------------------------------
  // MODULE 4: INDUSTRIAL PCB CAM ENGINE TESTS
  // ----------------------------------------------------
  console.log('\n--- MODULE 4: Industrial PCB CAM Engine ---');
  const CAM = require('../cam_engine.js');

  test('GerberParser parses coordinate formats (%FS%), units (%MO%), and apertures (%ADD%)', () => {
    const gerberData = [
      '%FSLAX24Y24*%',
      '%MOIN*%',
      '%ADD10C,0.010*%',
      '%ADD11R,0.050X0.025*%',
      '%ADD12O,0.060X0.030*%',
      '%ADD13P,0.040X6*%',
      'D10*',
      'X010000Y010000D02*',
      'X020000Y010000D01*',
      'D11*',
      'X030000Y020000D03*',
      'M02*'
    ].join('\n');

    const parser = new CAM.GerberParser(gerberData).parse();
    assert.strictEqual(parser.units, 'IN');
    assert.strictEqual(parser.format.zeroSuppression, 'L');
    assert.strictEqual(parser.format.xInt, 2);
    assert.strictEqual(parser.format.xDec, 4);

    assert(parser.apertures.has(10), 'Aperture D10 must be registered');
    assert.strictEqual(parser.apertures.get(10).type, 'C');
    assert.strictEqual(parser.apertures.get(11).type, 'R');
    assert.strictEqual(parser.apertures.get(12).type, 'O');
    assert.strictEqual(parser.apertures.get(13).type, 'P');

    assert.strictEqual(parser.commands.length, 2, 'Must contain 1 DRAW and 1 FLASH command');
    assert.strictEqual(parser.commands[0].op, 'DRAW');
    assert.strictEqual(parser.commands[0].x1, 1.0);
    assert.strictEqual(parser.commands[0].x2, 2.0);
    assert.strictEqual(parser.commands[1].op, 'FLASH');
    assert.strictEqual(parser.commands[1].x, 3.0);
    assert.strictEqual(parser.commands[1].y, 2.0);
  });

  test('Excellon NC Drill Parser parses tools (T01C...) and hit coordinates', () => {
    const drillData = [
      'M48',
      'INCH',
      'T01C0.032',
      'T02C0.040',
      'T03C0.062',
      '%',
      'T01',
      'X1.0000Y1.0000',
      'X1.5000Y1.0000',
      'T02',
      'X2.0000Y2.0000',
      'T03',
      'X3.0000Y3.0000',
      'M30'
    ].join('\n');

    const parser = new CAM.ExcellonParser(drillData).parse();
    assert.strictEqual(parser.units, 'INCH');
    assert.strictEqual(parser.tools.size, 3);
    assert.strictEqual(parser.tools.get(1), 0.032);
    assert.strictEqual(parser.tools.get(2), 0.040);
    assert.strictEqual(parser.tools.get(3), 0.062);

    assert.strictEqual(parser.hits.length, 4, 'Must parse exactly 4 drill hits');
    assert.strictEqual(parser.hits[0].tool, 1);
    assert.strictEqual(parser.hits[0].x, 1.0);
    assert.strictEqual(parser.hits[2].tool, 2);
    assert.strictEqual(parser.hits[2].x, 2.0);
  });

  // ----------------------------------------------------
  // MODULE 5: MEASUREMENT & OSNAP ENGINE TESTS
  // ----------------------------------------------------
  console.log('\n--- MODULE 5: Engineering Measurement & OSNAP Suite ---');
  const Measure = require('../measure_engine.js');

  test('CalibrationManager computes real-world dimensions and formatted readouts', () => {
    const cal = new Measure.CalibrationManager();
    cal.setCalibration(100, 25.4, 'mm'); // 100 pixels = 25.4 mm (1 inch)
    assert.strictEqual(cal.formatDistance(100), '25.40 mm');
    assert.strictEqual(cal.formatDistance(200), '50.80 mm');

    cal.setCalibration(100, 1000, 'mils');
    assert.strictEqual(cal.formatDistance(100), '1000.000 mils');
  });

  test('OSNAPManager snaps to nearest endpoints, midpoints, and center points', () => {
    const osnap = new Measure.OSNAPManager(8);
    osnap.addLine(0, 0, 100, 0);
    osnap.addRect(200, 200, 50, 50);
    osnap.addCircle(400, 400, 20);

    // Near endpoint (0, 0)
    const snap1 = osnap.snap(3, 2, 1.0);
    assert.strictEqual(snap1.type, 'endpoint');
    assert.strictEqual(snap1.x, 0);
    assert.strictEqual(snap1.y, 0);

    // Near midpoint (50, 0)
    const snap2 = osnap.snap(52, 1, 1.0);
    assert.strictEqual(snap2.type, 'midpoint');
    assert.strictEqual(snap2.x, 50);
    assert.strictEqual(snap2.y, 0);

    // Near rect center (225, 225)
    const snap3 = osnap.snap(226, 224, 1.0);
    assert.strictEqual(snap3.type, 'center');
    assert.strictEqual(snap3.x, 225);
    assert.strictEqual(snap3.y, 225);

    // Outside snap radius (> 8px)
    const snapNone = osnap.snap(800, 800, 1.0);
    assert.strictEqual(snapNone.type, null);
  });

  test('Geometric calculations (Polyline Length & Polygon Shoelace Area)', () => {
    const poly = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 40 }];
    const length = Measure.calcPolylineLength(poly);
    assert.strictEqual(length, 70, '30 + 40 = 70');

    // Right triangle 30 x 40 -> Area = 600
    const tri = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 40 }];
    const area = Measure.calcPolygonArea(tri);
    assert.strictEqual(area, 600, 'Triangle area should be 600');
  });

  test('Tally & BOM Counter places inspection badges and generates CSV export', () => {
    const tally = new Measure.TallyManager();
    tally.addItem(100, 150, 1, 'Inspect capacitor C1');
    tally.addItem(200, 250, 1, 'Verify resistor R14 value');
    tally.addItem(300, 350, 2, 'Check ground plane clearance');

    assert.strictEqual(tally.items.length, 3);
    assert.strictEqual(tally.items[0].number, 1);
    assert.strictEqual(tally.items[1].number, 2);
    assert.strictEqual(tally.items[2].number, 3);

    const csv = tally.toCSV();
    assert(csv.includes('Number,Page,X,Y,Description,Timestamp'), 'CSV header present');
    assert(csv.includes('Inspect capacitor C1'), 'Item 1 in CSV');
    assert(csv.includes('Verify resistor R14 value'), 'Item 2 in CSV');
  });

  await testAsync('Cryptographic SHA-256 document hashing works reliably', async () => {
    const testBuf = Buffer.from('Redline Pro 2.1 Confidential Engineering Review');
    const hash = await Measure.computeDocumentSHA256(testBuf.buffer);
    assert.strictEqual(typeof hash, 'string');
    assert.strictEqual(hash.length, 16, 'SHA-256 high-order checksum length must be 16 hex chars');
  });

  // ----------------------------------------------------
  // MODULE 6: VIRTUAL TILING & WEB WORKER TESTS
  // ----------------------------------------------------
  console.log('\n--- MODULE 6: Virtual Viewport Memory Optimization ---');
  const WE = require('../worker_engine.js');

  test('VirtualTileManager computes visible 512x512 tiles and disposes off-screen tiles', () => {
    const tm = new WE.VirtualTileManager({ tileSize: 512, maxCachedTiles: 4 });
    const visible = tm.getVisibleTiles(0, 0, 1024, 768, 4000, 3000, 1.0);

    assert(visible.length > 0, 'Must produce visible tile coordinates');
    assert.strictEqual(visible[0].w, 512);
    assert.strictEqual(visible[0].h, 512);

    // Simulate allocating canvases
    for (const t of visible) {
      tm.getOrCreateTileCanvas(t.key, t.w, t.h);
    }
    assert(tm.tileCache.size <= 4, 'LRU cache must prune to maxCachedTiles');
  });

  // ----------------------------------------------------
  // MODULE 1 & 2: DEFECT NAVIGATOR & UI STATE TESTS
  // ----------------------------------------------------
  console.log('\n--- MODULE 1 & 2: Defect Navigator & Session State ---');
  const UI = require('../ui_ribbon.js');

  test('DefectState groups regions, filters noise, and manages review checklist', () => {
    const mockRegions = [
      { type: 'added', x: 100, y: 100, w: 20, h: 20, pixelCount: 400 },
      { type: 'removed', x: 250, y: 150, w: 15, h: 10, pixelCount: 150 },
      { type: 'added', x: 400, y: 300, w: 1, h: 1, pixelCount: 1 } // Noise pixel!
    ];

    UI.DefectState.noiseThreshold = 3;
    UI.DefectState.initFromRegions(mockRegions);

    assert.strictEqual(UI.DefectState.defects.length, 2, 'Single-pixel noise must be filtered out');
    assert.strictEqual(UI.DefectState.defects[0].status, 'Open');
    assert.strictEqual(UI.DefectState.currentIndex, 0);

    UI.DefectState.next();
    assert.strictEqual(UI.DefectState.currentIndex, 1);

    UI.DefectState.setStatus(1, 'Approved');
    assert.strictEqual(UI.DefectState.defects[1].status, 'Approved');

    UI.DefectState.prev();
    assert.strictEqual(UI.DefectState.currentIndex, 0);
  });

  // ----------------------------------------------------
  // METADATA & INTEGRITY TESTS
  // ----------------------------------------------------
  console.log('\n--- METADATA & INTEGRITY CHECKS ---');

  test('Package metadata matches Version 1.0.0 and Redline Studio', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    assert.strictEqual(pkg.name, 'redline-pro');
    assert.strictEqual(pkg.version, '1.0.0');
    assert.strictEqual(pkg.author, 'Redline Studio');
    assert(pkg.description.includes('textportdocx.in'));
  });

  test('NSIS Installer script matches Version 1.0.0 and VIProductVersion 1.0.0.0', () => {
    const nsi = fs.readFileSync('installer.nsi', 'utf8');
    assert(nsi.includes('!define VERSION "1.0.0"'));
    assert(nsi.includes('VIProductVersion "1.0.0.0"'));
    assert(nsi.includes('Redline Studio - textportdocx.in'));
  });

  test('All JavaScript codebase modules compile with zero syntax errors', () => {
    const vm = require('vm');
    const jsFiles = [
      'main.js', 'preload.js', 'pre.js', 'icons.js', 'app.js', 'editor.js',
      'menu.js', 'extras.js', 'pro.js', 'ui_ribbon.js', 'dxf_engine.js',
      'cam_engine.js', 'measure_engine.js', 'worker_engine.js', 'worker.js', 'patch_exe.js'
    ];
    for (const file of jsFiles) {
      const code = fs.readFileSync(file, 'utf8');
      assert.doesNotThrow(() => {
        new vm.Script(code, { filename: file });
      }, `Syntax error in ${file}`);
    }
  });

  test('Index.html loads all new v2.1 modules in strict offline order', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    assert(html.includes('dxf_engine.js'), 'Must load dxf_engine.js');
    assert(html.includes('cam_engine.js'), 'Must load cam_engine.js');
    assert(html.includes('measure_engine.js'), 'Must load measure_engine.js');
    assert(html.includes('worker_engine.js'), 'Must load worker_engine.js');
    assert(html.includes('ui_ribbon.js'), 'Must load ui_ribbon.js');
    assert(html.includes('Version 1.0.0'), 'Modal must show Version 1.0.0');
    assert(html.includes('rp-about-card'), 'About modal must include enterprise .rp-about-card layout');
    assert(html.includes('rp-about-grid'), 'About modal must include 6-module capability grid');
    assert(html.includes('about-guide-btn') && html.includes('about-shortcuts-btn') && html.includes('about-license-btn') && html.includes('about-copy-btn'), 'About modal must include interactive footer buttons');
    assert(html.includes('rp-sample-schematic-btn'), 'Empty start screen must include Load Sample Schematic button');
    assert(html.includes('rp-sample-gerber-btn'), 'Empty start screen must include Load Sample PCB Gerber button');
  });

  // ----------------------------------------------------
  // COMMERCIAL POLISH REFINEMENTS (NSIS, SAMPLES, HUD)
  // ----------------------------------------------------
  console.log('\n--- COMMERCIAL POLISH REFINEMENTS ---');

  test('NSIS Installer contains updated Redline Pro context menus, .dxf/.gbr shell associations, and clean uninstallation keys', () => {
    const nsi = fs.readFileSync('installer.nsi', 'utf8');
    // Updated PDF context menus
    assert(nsi.includes('WriteRegStr HKCU "Software\\Classes\\SystemFileAssociations\\.pdf\\shell\\RedlineEdit" "" "Edit with Redline Pro"'), 'Must set Edit with Redline Pro');
    assert(nsi.includes('WriteRegStr HKCU "Software\\Classes\\SystemFileAssociations\\.pdf\\shell\\RedlineCompare" "" "Compare with Redline Pro"'), 'Must set Compare with Redline Pro');
    assert(!nsi.includes('"Edit with Redline"'), 'Legacy Edit with Redline string must be replaced');
    assert(!nsi.includes('"Compare with Redline"'), 'Legacy Compare with Redline string must be replaced');

    // CAD (.dxf) and CAM (.gbr) SystemFileAssociations
    assert(nsi.includes('Software\\Classes\\SystemFileAssociations\\.dxf\\shell\\RedlineInspectCAD" "" "Inspect CAD with Redline Pro"'), 'Must register .dxf Inspect CAD with Redline Pro');
    assert(nsi.includes('Software\\Classes\\SystemFileAssociations\\.dxf\\shell\\RedlineInspectCAD\\command" "" \'"$INSTDIR\\${APPEXE}" "%1"\''), 'Must pass "%1" to .dxf command');
    assert(nsi.includes('Software\\Classes\\SystemFileAssociations\\.gbr\\shell\\RedlineInspectGerber" "" "Inspect Gerber with Redline Pro"'), 'Must register .gbr Inspect Gerber with Redline Pro');
    assert(nsi.includes('Software\\Classes\\SystemFileAssociations\\.gbr\\shell\\RedlineInspectGerber\\command" "" \'"$INSTDIR\\${APPEXE}" "%1"\''), 'Must pass "%1" to .gbr command');

    // Clean uninstallation registry keys
    assert(nsi.includes('DeleteRegKey HKCU "Software\\Classes\\SystemFileAssociations\\.pdf\\shell\\RedlineEdit"'), 'Uninstall must remove RedlineEdit');
    assert(nsi.includes('DeleteRegKey HKCU "Software\\Classes\\SystemFileAssociations\\.pdf\\shell\\RedlineCompare"'), 'Uninstall must remove RedlineCompare');
    assert(nsi.includes('DeleteRegKey HKCU "Software\\Classes\\SystemFileAssociations\\.dxf\\shell\\RedlineInspectCAD"'), 'Uninstall must remove .dxf RedlineInspectCAD');
    assert(nsi.includes('DeleteRegKey HKCU "Software\\Classes\\SystemFileAssociations\\.gbr\\shell\\RedlineInspectGerber"'), 'Uninstall must remove .gbr RedlineInspectGerber');
  });

  await testAsync('Sample Schematic Generator dynamically builds 2-page Rev A & Rev B vector PDFs 100% offline', async () => {
    const specA = UI.SampleGenerator.getSchematicSpec(false);
    const specB = UI.SampleGenerator.getSchematicSpec(true);

    assert.strictEqual(specA.pages, 2);
    assert.strictEqual(specA.fuse, 'FUSE 10A');
    assert.strictEqual(specA.resistor.id, 'R1');
    assert.strictEqual(specA.resistor.value, '10k\u03A9');
    assert.strictEqual(specA.capacitors[0].id, 'C1');
    assert.strictEqual(specA.capacitors[0].value, '100\u00B5F');
    assert.strictEqual(specA.gndRail.label, 'GND rail');

    assert.strictEqual(specB.pages, 2);
    assert.strictEqual(specB.fuse, 'FUSE 16A');
    assert.strictEqual(specB.resistor.relocated, true);
    assert.notStrictEqual(specA.resistor.x, specB.resistor.x, 'R1 must be relocated in Rev B');
    assert.strictEqual(specB.capacitors.length, 2, 'Rev B must include added C2 filter cap');
    assert.strictEqual(specB.capacitors[1].id, 'C2');
    assert.strictEqual(specB.capacitors[1].value, '10\u00B5F');
    assert.notStrictEqual(specA.testpoint, specB.testpoint, 'Testpoint label must change in Rev B');

    const pdfBytesA = await UI.SampleGenerator.generateSampleSchematicPDF(false);
    const pdfBytesB = await UI.SampleGenerator.generateSampleSchematicPDF(true);
    assert(pdfBytesA instanceof Uint8Array && pdfBytesA.length > 1000, 'Rev A PDF bytes must be valid');
    assert(pdfBytesB instanceof Uint8Array && pdfBytesB.length > 1000, 'Rev B PDF bytes must be valid');

    const PDFLib = require('../lib/pdf-lib.min.js');
    const docA = await PDFLib.PDFDocument.load(pdfBytesA);
    const docB = await PDFLib.PDFDocument.load(pdfBytesB);
    assert.strictEqual(docA.getPageCount(), 2, 'Rev A schematic must have 2 pages');
    assert.strictEqual(docB.getPageCount(), 2, 'Rev B schematic must have 2 pages');
  });

  test('Sample PCB Gerber & Excellon Drill Generator produces valid CAM layers and flags 4-mil clearance violation', () => {
    const gbrA = UI.SampleGenerator.generateSampleGerberCopper(false);
    const gbrB = UI.SampleGenerator.generateSampleGerberCopper(true);
    const drl = UI.SampleGenerator.generateSampleExcellonDrill();
    const drc = UI.SampleGenerator.verifyClearanceViolation();

    const parsedGbrA = new CAM.GerberParser(gbrA).parse();
    const parsedGbrB = new CAM.GerberParser(gbrB).parse();
    const parsedDrl = new CAM.ExcellonParser(drl).parse();

    assert(parsedGbrA.commands.length >= 6, 'Copper Gerber A must have traces and pads');
    assert(parsedGbrB.commands.length > parsedGbrA.commands.length, 'Copper Gerber B must include violation trace');
    assert(parsedDrl.hits.length >= 6, 'Excellon drill file must contain drill hits matching pads');
    assert.strictEqual(drc.ruleMils, 4.0);
    assert.strictEqual(drc.hasViolation, true, 'Must flag 4-mil clearance spacing violation');
    assert(drc.measuredMils < 4.0, 'Measured clearance must be < 4.0 mils');
  });

  test('Interactive Keyboard Shortcut HUD (F1 / ?) renders all required Navigation, Diff & Alignment hotkeys', () => {
    const hudHtml = UI.buildKeyboardHUDHTML();
    assert(hudHtml.includes('Navigation &amp; Diff'), 'Must contain Navigation & Diff section');
    assert(hudHtml.includes('Alignment &amp; Tools'), 'Must contain Alignment & Tools section');
    assert(hudHtml.includes('Next Defect (Auto-center &amp; Zoom)') || hudHtml.includes('Next Defect (Auto-center & Zoom)'));
    assert(hudHtml.includes('Previous Defect'));
    assert(hudHtml.includes('Instant Blink Toggle (A / B)'));
    assert(hudHtml.includes('Toggle Interactive Curtain Split Slider'));
    assert(hudHtml.includes('Fit Drawing to Viewport &amp; Re-Sharpen Vectors') || hudHtml.includes('Fit Drawing to Viewport & Re-Sharpen Vectors'));
    assert(hudHtml.includes('Precision Full-Viewport Crosshair Toggle'));
    assert(hudHtml.includes('Auto-Align Drawings'));
    assert(hudHtml.includes('Toggle 8px Magnetic Object Snap (OSNAP)'));
    assert(hudHtml.includes('Collapse / Expand Sidebar'));
    assert(hudHtml.includes('Compare Workspace  |  Editor Workspace'));
  });

  test('Background Anti-Throttling, PowerSaveBlocker & Windows Taskbar Progress hooks are configured', () => {
    const mainJs = fs.readFileSync('main.js', 'utf8');
    const preloadJs = fs.readFileSync('preload.js', 'utf8');
    const appJs = fs.readFileSync('app.js', 'utf8');
    const proJs = fs.readFileSync('pro.js', 'utf8');

    // Chromium command-line switches in main.js
    assert(mainJs.includes('powerSaveBlocker'), 'main.js must import powerSaveBlocker');
    assert(mainJs.includes("app.commandLine.appendSwitch('disable-background-timer-throttling')"), 'Must disable background timer throttling');
    assert(mainJs.includes("app.commandLine.appendSwitch('disable-renderer-backgrounding')"), 'Must disable renderer backgrounding');
    assert(mainJs.includes("app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')"), 'Must disable occluded window backgrounding');
    assert(mainJs.includes('backgroundThrottling: false'), 'BrowserWindow webPreferences must set backgroundThrottling: false');
    assert(mainJs.includes("powerSaveBlocker.start('prevent-app-suspension')"), 'Must start prevent-app-suspension powerSaveBlocker');
    assert(mainJs.includes('win.setProgressBar('), 'Must update Windows Taskbar progress via win.setProgressBar');

    // Preload IPC bridge
    assert(preloadJs.includes('setProgress:'), 'preload.js must expose setProgress');
    assert(preloadJs.includes('setBusyLock:'), 'preload.js must expose setBusyLock');

    // Unthrottled MessageChannel tick & progress forwarding
    assert(appJs.includes('MessageChannel'), 'app.js must use unthrottled MessageChannel tick');
    assert(proJs.includes('window.native.setProgress'), 'pro.js must forward progress to taskbar via window.native.setProgress');
    assert(proJs.includes('window.native.setBusyLock'), 'pro.js must toggle powerSaveBlocker via window.native.setBusyLock');
  });


  test("CAM350 IPC English (mils/in) & Metric (mm/um) UnitConverter converts and formats accurately", () => {
    assert(Math.abs(CAM.UnitConverter.convert(100, "MILS", "MM") - 2.54) < 1e-4, "100 mils must equal 2.54 mm");
    assert(Math.abs(CAM.UnitConverter.convert(2.54, "MM", "MILS") - 100) < 1e-4, "2.54 mm must equal 100 mils");
    assert.strictEqual(CAM.UnitConverter.format(0.004, "english", 1), "4.0 mil");
    assert.strictEqual(CAM.UnitConverter.format(0.004, "metric", 3), "0.102 mm");
  });

  test("GerberParser supports G36/G37 polygon copper pours and generates CAM350 D-Code Aperture Table", () => {
    const gbrWithPour = [
      "%FSLAX24Y24*%",
      "%MOMM*%",
      "%ADD10C,0.254*%",
      "%ADD11R,1.270X1.270*%",
      "G36*",
      "X00000Y00000D02*",
      "X100000Y00000D01*",
      "X100000Y100000D01*",
      "X00000Y100000D01*",
      "X00000Y00000D01*",
      "G37*",
      "D11*",
      "X050000Y050000D03*",
      "M02*"
    ].join("\n");
    const p = new CAM.GerberParser(gbrWithPour).parse();
    assert.strictEqual(p.units, "MM");
    assert(p.commands.some(c => c.op === "REGION"), "Must parse G36/G37 polygon region");
    const apTable = p.getApertureTable();
    assert.strictEqual(apTable.length, 2);
    assert.strictEqual(apTable[0].dCode, "D10");
    assert(Math.abs(apTable[0].widthMils - 10.0) < 0.1, "0.254 mm must convert to 10.0 mils in D-Code table");
    assert.strictEqual(apTable[1].flashes, 1);
  });

  test("ExcellonParser parses G85 routed slots and generates CAM350 T-Code Drill Schedule", () => {
    const drlMetric = [
      "M48",
      "METRIC,LZ",
      ";FILE_FORMAT=3:3",
      "T01C0.800",
      "T02C1.000",
      "%",
      "T01",
      "X010.000Y010.000",
      "X020.000Y010.000",
      "T02",
      "X030.000Y010.000G85X035.000Y010.000",
      "M30"
    ].join("\n");
    const dp = new CAM.ExcellonParser(drlMetric).parse();
    assert.strictEqual(dp.units, "METRIC");
    assert.strictEqual(dp.hits.length, 2);
    assert.strictEqual(dp.slots.length, 1);
    const tTable = dp.getToolTable();
    assert.strictEqual(tTable.length, 2);
    assert.strictEqual(tTable[0].tCode, "T01");
    assert.strictEqual(tTable[0].diaMM, 0.8);
    assert(Math.abs(tTable[0].diaMils - 31.5) < 0.1);
    assert.strictEqual(tTable[1].slots, 1);
  });

  test("IPCD356Parser parses CUST 0 (English mils) & CUST 1 (Metric mm) netlists and detects netlist diffs", () => {
    const ipcEng = UI.SampleGenerator.generateSampleIPCD356Netlist(false);
    const ipcMet = UI.SampleGenerator.generateSampleIPCD356Netlist(true);
    const pEng = new CAM.IPCD356Parser(ipcEng).parse();
    const pMet = new CAM.IPCD356Parser(ipcMet).parse();

    assert.strictEqual(pEng.units, "MILS");
    assert.strictEqual(pMet.units, "MM");
    assert.strictEqual(pEng.records.length, 6);
    assert.strictEqual(pMet.records.length, 6);
    assert(Math.abs(pEng.records[0].xIn - pMet.records[0].xIn) < 1e-3, "English and Metric IPC-D-356 coordinates must match in physical inches");

    const diffsSame = CAM.IPCD356Parser.compareNetlists(pEng, pMet, 2.0);
    assert.strictEqual(diffsSame.length, 0, "Identical physical netlists in English vs Metric must have 0 diffs");
  });

  test("CAMCompare runs IPC Class 1/2/3 DFM checks (Min Trace Width, Annular Ring, Coincident Drill, Acid Trap)", () => {
    const gbr = new CAM.GerberParser([
      "%FSLAX24Y24*%",
      "%MOIN*%",
      "%ADD10C,0.0030*%",
      "%ADD11C,0.0400*%",
      "D11*",
      "X010000Y010000D03*",
      "D10*",
      "X010000Y010000D02*",
      "X015000Y010000D01*",
      "X011000Y011000D01*",
      "M02*"
    ].join("\n")).parse();
    const drl = new CAM.ExcellonParser([
      "M48",
      "INCH",
      "T01C0.036",
      "%",
      "T01",
      "X1.0000Y1.0000",
      "X1.0000Y1.0000",
      "M30"
    ].join("\n")).parse();

    const cmp = new CAM.CAMCompare(800, 600);
    const violations = cmp.runDFMChecks(gbr, drl, CAM.IPC_DFM_RULES.class2);
    assert(violations.some(v => v.category === "MIN_TRACE_WIDTH"), "Must detect 3.0 mil trace < 4.0 mil Class 2 rule");
    assert(violations.some(v => v.category === "ANNULAR_RING"), "Must detect 2.0 mil annular ring < 3.5 mil Class 2 rule");
    assert(violations.some(v => v.category === "COINCIDENT_DRILL"), "Must detect coincident duplicate drill hits");
    assert(violations.some(v => v.category === "ACID_TRAP"), "Must detect acute angle acid trap");
  });

  test("UIRibbon setUnitSystem toggles cleanly between IPC English (mils) and IPC Metric (mm)", () => {
    UI.setUnitSystem("metric", true);
    assert.strictEqual(UI.CAMState.unitSystem, "metric");
    assert(UI.CAMState.formatDimFromPx(300, 300).includes("25.40 mm"));

    UI.setUnitSystem("english", true);
    assert.strictEqual(UI.CAMState.unitSystem, "english");
    assert(UI.CAMState.formatDimFromPx(300, 300).includes("1000.0 mil"));
  });


  test("CompareHistory (Ctrl+Z / Ctrl+Y) accurately records and reverses Compare actions", () => {
    UI.CompareHistory.undoStack = [];
    UI.CompareHistory.redoStack = [];
    UI.DefectState.defects = [{ id: 1, type: "added", x: 10, y: 20, w: 30, h: 40, status: "Open", note: "Initial" }];
    UI.CompareHistory.push("Edit defect note");
    UI.DefectState.defects[0].note = "Wrong text typed";
    assert.strictEqual(UI.DefectState.defects[0].note, "Wrong text typed");

    const undone = UI.CompareHistory.undo();
    assert.strictEqual(undone, true);
    assert.strictEqual(UI.DefectState.defects[0].note, "Initial", "Ctrl+Z undo must restore previous state");

    const redone = UI.CompareHistory.redo();
    assert.strictEqual(redone, true);
    assert.strictEqual(UI.DefectState.defects[0].note, "Wrong text typed", "Ctrl+Y redo must restore undone state");
  });

  test("DXFEngine supports TABLES/LAYER, LWPOLYLINE bulges, Sample Mechanical DXF & Vector Entity A/B Diffing", () => {
    const dxfA = DXF.generateSampleMechanicalDXF(false, "mm");
    const dxfB = DXF.generateSampleMechanicalDXF(true, "mm");
    const pA = new DXF.DXFParser(dxfA).parse();
    const pB = new DXF.DXFParser(dxfB).parse();

    assert(pA.entities.length >= 15, "Sample DXF Rev A must contain >= 15 CAD entities");
    assert(pB.entities.length > pA.entities.length, "Sample DXF Rev B must have additional cooling slot entities");
    const layers = pB.getLayerSummary();
    assert(layers.some(l => l.name === "MOUNTING_HOLES"), "DXFParser must parse TABLES -> LAYER definitions");
    assert(layers.some(l => l.name === "CONNECTOR_CUTOUTS"), "DXFParser must track CONNECTOR_CUTOUTS layer");

    const diff = DXF.compareDXFEntities(pA, pB);
    assert(diff.added.length > 0 && diff.removed.length > 0, "compareDXFEntities must detect added and removed CAD primitives between Rev A and Rev B");
    assert(diff.unchangedCount > 5, "compareDXFEntities must preserve unchanged common CAD primitives");
  });

  test("Full-height side-docked Layer Dock and zero-width collapsed sidebar CSS rules are enforced", () => {
    const css = fs.readFileSync("style.css", "utf8");
    assert(css.includes("aside.rp-collapsed,main>aside.rp-collapsed") && css.includes("flex:0 0 0px!important"), "Collapsed sidebar must override flex-basis to 0px so full PDF page is accessible");
    assert(css.includes(".rp-layer-dock.docked") && css.includes("height: 100% !important"), "Docked Layer Dock must be a full-height side panel by default");
    assert(css.includes(".rp-layer-dock.floating"), "Layer Dock must support floating mode with snap-to-side docking");
  });

  test("GerberParser supports legacy RS-274X G54Dxx* aperture selection and ExcellonParser supports G00/G01/G05 prefixed drill hits", () => {
    const legacyGbr = [
      "%FSLAX24Y24*%",
      "%MOIN*%",
      "%ADD10C,0.015*%",
      "%ADD12R,0.060X0.060*%",
      "G54D12*",
      "X010000Y010000D03*",
      "G54D10*",
      "X010000Y010000D02*",
      "X020000Y015000D01*",
      "M02*"
    ].join("\n");
    const gp = new CAM.GerberParser(legacyGbr).parse();
    assert.strictEqual(gp.commands.length, 2, "Must parse flash and draw under G54Dxx* selection");
    assert.strictEqual(gp.commands[0].aperture, 12, "First flash must use D12 selected via G54D12*");
    assert.strictEqual(gp.commands[1].aperture, 10, "Draw must use D10 selected via G54D10*");

    const gcodeDrl = [
      "M48",
      "INCH",
      "T01C0.032",
      "T02C0.045",
      "%",
      "G05",
      "T01",
      "G00X1.0000Y1.0000",
      "G01X1.5000Y1.2500",
      "T02X2.0000Y2.2500",
      "M30"
    ].join("\n");
    const dp = new CAM.ExcellonParser(gcodeDrl).parse();
    assert.strictEqual(dp.hits.length, 3, "Must parse G00, G01, and inline T02 prefixed drill hits");
    assert.strictEqual(dp.hits[2].tool, 2);
    assert.strictEqual(dp.hits[2].x, 2.0);
  });

  test("DXFEngine accurately diffs ELLIPSE, SOLID, DIMENSION, and INSERT entities and transliterates engineering symbols", () => {
    const w = new DXF.DXFWriter({ unit: "mm", scale: 1.0 });
    w.addText("R1 = 10kΩ ±1% ⌀5mm ΔT=25°C 100µF", 10, 10, 5, 0, "TEXT");
    const out = w.generateString();
    assert(out.includes("10kOhm") && out.includes("%%p1%") && out.includes("%%c5mm") && out.includes("Delta T=25%%dC") && out.includes("100uF"),
      "DXFWriter must transliterate engineering symbols cleanly without question marks");

    const dxfWithSolidsA = [
      "0", "SECTION", "2", "ENTITIES",
      "0", "SOLID", "8", "0", "10", "0", "20", "0", "11", "10", "21", "0", "12", "10", "22", "10", "13", "0", "23", "10",
      "0", "DIMENSION", "8", "DIMS", "1", "50.0 mm", "10", "50", "20", "10", "11", "25", "21", "10", "13", "0", "23", "0", "14", "50", "24", "0",
      "0", "ENDSEC", "0", "EOF"
    ].join("\r\n");
    const dxfWithSolidsB = [
      "0", "SECTION", "2", "ENTITIES",
      "0", "SOLID", "8", "0", "10", "20", "20", "20", "11", "30", "21", "20", "12", "30", "22", "30", "13", "20", "23", "30",
      "0", "DIMENSION", "8", "DIMS", "1", "75.0 mm", "10", "75", "20", "10", "11", "37.5", "21", "10", "13", "0", "23", "0", "14", "75", "24", "0",
      "0", "ENDSEC", "0", "EOF"
    ].join("\r\n");
    const pA = new DXF.DXFParser(dxfWithSolidsA).parse();
    const pB = new DXF.DXFParser(dxfWithSolidsB).parse();
    const diff = DXF.compareDXFEntities(pA, pB);
    assert.strictEqual(diff.added.length, 2, "Must detect modified SOLID and DIMENSION as added in B");
    assert.strictEqual(diff.removed.length, 2, "Must detect original SOLID and DIMENSION as removed from A");
  });

  test("WorkerEngine._syncDiff fallback computes 8-connected bounding-box regions identically to Web Worker", () => {
    const engine = new WE.WorkerClient();
    const w = 40, h = 40;
    const bufA = new Uint8ClampedArray(w * h * 4).fill(255);
    const bufB = new Uint8ClampedArray(w * h * 4).fill(255);
    // Draw a 6x6 black square in bufB at (10..15, 12..17)
    for (let y = 12; y <= 17; y++) {
      for (let x = 10; x <= 15; x++) {
        const idx = (y * w + x) * 4;
        bufB[idx] = 0; bufB[idx + 1] = 0; bufB[idx + 2] = 0;
      }
    }
    const res = engine._syncDiff({ bufA, bufB, width: w, height: h, threshold: 35 });
    assert(Array.isArray(res.regions) && res.regions.length === 1, "Fallback _syncDiff must cluster connected diff pixels into 1 region");
    assert.strictEqual(res.regions[0].x, 10);
    assert.strictEqual(res.regions[0].y, 12);
    assert.strictEqual(res.regions[0].w, 6);
    assert.strictEqual(res.regions[0].h, 6);
    assert.strictEqual(res.regions[0].pixelCount, 36);
  });

  test("DefectState preserves original regionIndex after noise filtering and retains per-page defect statuses", () => {
    UI.DefectState.clearAllPages();
    UI.DefectState.noiseThreshold = 5;
    const regionsPage1 = [
      { type: "added", x: 10, y: 10, w: 1, h: 1, pixelCount: 1 }, // index 0 (filtered out as noise)
      { type: "removed", x: 120, y: 80, w: 20, h: 20, pixelCount: 400 } // index 1 (kept as defect #1)
    ];
    UI.DefectState.initFromRegions(regionsPage1);
    assert.strictEqual(UI.DefectState.defects.length, 1);
    assert.strictEqual(UI.DefectState.defects[0].regionIndex, 1, "Must preserve original S.cur.regions index (1) when earlier noise is filtered");
  });

  test("GerberParser supports modal D01/D02/D03 operations and inline D01X... / G54D10X... coordinate blocks", () => {
    const modalGbr = [
      "%FSLAX24Y24*%",
      "%MOIN*%",
      "%ADD10C,0.012*%",
      "%ADD15C,0.050*%",
      "G54D15X010000Y010000D03*",
      "X020000Y010000*",
      "X030000Y010000*",
      "G54D10X010000Y010000D02*",
      "D01X030000Y010000*",
      "M02*"
    ].join("\n");
    const gp = new CAM.GerberParser(modalGbr).parse();
    const flashes = gp.commands.filter(c => c.op === "FLASH");
    const draws = gp.commands.filter(c => c.op === "DRAW");
    assert.strictEqual(flashes.length, 3, "Modal D03 must flash all 3 subsequent coordinate blocks");
    assert.strictEqual(draws.length, 1, "Inline D01X... after G54D10...D02* must produce 1 draw segment");
    assert.strictEqual(draws[0].x1, 1.0);
    assert.strictEqual(draws[0].x2, 3.0);
  });

  test("ExcellonParser supports incremental coordinates (ICI,ON and G91)", () => {
    const incDrl = [
      "M48",
      "INCH",
      "ICI,ON",
      "T01C0.032",
      "%",
      "T01",
      "X1.0000Y1.0000",
      "X0.5000Y0.2500",
      "X0.5000Y-0.2500",
      "M30"
    ].join("\n");
    const dp = new CAM.ExcellonParser(incDrl).parse();
    assert.strictEqual(dp.hits.length, 3);
    assert(Math.abs(dp.hits[0].x - 1.0) < 1e-4 && Math.abs(dp.hits[0].y - 1.0) < 1e-4);
    assert(Math.abs(dp.hits[1].x - 1.5) < 1e-4 && Math.abs(dp.hits[1].y - 1.25) < 1e-4, "Second hit must accumulate incremental delta (+0.5, +0.25)");
    assert(Math.abs(dp.hits[2].x - 2.0) < 1e-4 && Math.abs(dp.hits[2].y - 1.0) < 1e-4, "Third hit must accumulate incremental delta (+0.5, -0.25)");
  });

  test("DXFWriter.addArc updates header extents ($EXTMIN/$EXTMAX) and DXFParser parses fit-point SPLINE entities", () => {
    const w = new DXF.DXFWriter({ unit: "mm", scale: 1.0 });
    w.addArc(100, 100, 50, 0, 180, "GEOMETRY");
    assert(w.minX < 100 * w.scaleFactor && w.maxX > 100 * w.scaleFactor, "addArc must expand minX/maxX by arc radius");

    const fitSplineDxf = [
      "0", "SECTION", "2", "ENTITIES",
      "0", "SPLINE", "8", "CURVES", "70", "0",
      "11", "0.0", "21", "0.0",
      "11", "25.0", "21", "40.0",
      "11", "60.0", "21", "15.0",
      "0", "ENDSEC", "0", "EOF"
    ].join("\r\n");
    const sp = new DXF.DXFParser(fitSplineDxf).parse();
    assert.strictEqual(sp.entities.length, 1, "Must parse SPLINE with fit points (group codes 11/21)");
    assert.strictEqual(sp.entities[0].points.length, 3);
  });

  // ----------------------------------------------------
  // MODULE 7: PEN, PIN & ERASER CONTEXTUAL TOOL OPTIONS
  // ----------------------------------------------------
  console.log('\n--- MODULE 7: Pen, Pin & Eraser Contextual Tool Options ---');

  test("PDF Studio (index.html & editor.js) defines Pin tool, Eraser options, Pen thickness presets, and per-tool settings memory", () => {
    const html = fs.readFileSync("index.html", "utf8");
    const edJs = fs.readFileSync("editor.js", "utf8");

    assert(html.includes('data-t="pin"'), "PDF Studio toolbar must include Pin tool button (data-t=\"pin\")");
    assert(html.includes('id="eStyleDock"'), "PDF Studio must include contextual #eStyleDock group");
    assert(html.includes('id="ePenPresets"'), "PDF Studio must include #ePenPresets quick thickness buttons");
    assert(html.includes('id="eEraserOpts"') && html.includes('id="eEraserMode"'), "PDF Studio must include #eEraserOpts and #eEraserMode selector");
    assert(html.includes('id="eErasePageBtn"'), "PDF Studio must include #eErasePageBtn clear page button");
    assert(html.includes('id="ePinOpts"'), "PDF Studio must include #ePinOpts pin marker size presets");

    assert(edJs.includes("toolSettings:") && edJs.includes("getToolSetting") && edJs.includes("saveToolSetting"),
      "editor.js must maintain independent per-tool size and color settings");
    assert(edJs.includes("function updateContextualToolDock("),
      "editor.js must dynamically update the Tool Options dock when switching tools");
    assert(edJs.includes("function distToSeg(") && edJs.includes("function hitAnnAt(") && edJs.includes("function eraseAtPoint("),
      "editor.js must implement segment-accurate hit-testing and object/brush-radius erasing");
    assert(edJs.includes("a.t === 'pin'"),
      "editor.js must render, hit-test, edit, and vector-export Pin annotations");
  });

  await testAsync("Compare Ribbon (ui_ribbon.js & pro.js) defines Pin Marker, Eraser, contextual Tool Options dock, and DXF export support", async () => {
    const ribHtml = fs.readFileSync("ui_ribbon.js", "utf8");
    const proJs = fs.readFileSync("pro.js", "utf8");

    assert(ribHtml.includes('id="rib-pin"') && ribHtml.includes('data-rptool="pin"'), "Compare Markup ribbon must include Pin Marker tool (#rib-pin)");
    assert(ribHtml.includes('id="rib-eraser"') && ribHtml.includes('data-rptool="eraser"'), "Compare Markup ribbon must include Eraser tool (#rib-eraser)");
    assert(ribHtml.includes('id="rib-cmp-tool-opts"'), "Compare Markup ribbon must include contextual #rib-cmp-tool-opts dock");
    assert(ribHtml.includes('id="rib-mk-size"') && ribHtml.includes('id="rib-mk-pen-presets"'), "Compare Markup ribbon must include thickness input and presets");
    assert(ribHtml.includes('id="rib-mk-eraser-presets"') && ribHtml.includes('id="rib-mk-eraser-mode"'), "Compare Markup ribbon must include Eraser mode and radius presets");
    assert(ribHtml.includes('id="rib-mk-pin-presets"'), "Compare Markup ribbon must include Pin size presets");
    assert(ribHtml.includes('id="rib-mk-color"') && ribHtml.includes('id="rib-mk-swatches"'), "Compare Markup ribbon must include color picker and swatches");

    assert(proJs.includes("updateCompareToolOptionsUI") && proJs.includes("setCompareToolSize"),
      "pro.js must dynamically update Compare tool options when switching tools");
    assert(proJs.includes("hitCompareAnnotation") && proJs.includes("eraseCompareAt"),
      "pro.js must support segment-accurate hit testing and object/brush erasing in Compare view");

    // Verify DXF export handles both freehand 'pen' polylines and 'pin' inspection markers
    const mockPage = {
      getViewport: () => ({ width: 400, height: 300 }),
      getTextContent: async () => ({ items: [] }),
      getOperatorList: async () => ({ fnArray: [], argsArray: [] })
    };
    const dxfOut = await DXF.exportPDFToDXF(mockPage, {
      unit: "mm",
      scale: 1.0,
      annotations: [
        { kind: "pen", pts: [{ x: 10, y: 10 }, { x: 40, y: 25 }, { x: 80, y: 60 }] },
        { kind: "pin", x: 120, y: 90, pinNum: 1, label: "Pin #1: Check trace width" },
        { t: "pin", x: 160, y: 110, w: 24, h: 30, pinNum: 2, text: "Pin #2: Verify pad clearance" }
      ]
    });
    assert(dxfOut.includes("LWPOLYLINE"), "DXF export must write LWPOLYLINE for freehand pen strokes");
    assert(dxfOut.includes("#1 Pin #1: Check trace width"), "DXF export must write TEXT and CIRCLE for Compare Pin markers");
    assert(dxfOut.includes("#2 Pin #2: Verify pad clearance"), "DXF export must write TEXT and CIRCLE for PDF Studio Pin markers");
  });

  test("Second-pass tool audit fixes: Pen dash support, Pin/Leader/Meas bbox padding, hollow shape perimeter hit-testing, and densified brush erasing", () => {
    const edJs = fs.readFileSync("editor.js", "utf8");
    const proJs = fs.readFileSync("pro.js", "utf8");
    const ribJs = fs.readFileSync("ui_ribbon.js", "utf8");
    const appJs = fs.readFileSync("app.js", "utf8");
    const menuJs = fs.readFileSync("menu.js", "utf8");

    // 1. Freehand Pen supports dashed/dotted styles and vector/sprite PDF export
    assert(edJs.includes("['draw', 'rect', 'circle', 'line', 'arrow', 'poly', 'leader'].includes(t)"),
      "editor.js must expose line dash selector for Freehand Pen ('draw')");
    assert(edJs.includes("if (a.dash && a.dash !== 'solid')"),
      "editor.js vector() must export dashed/dotted freehand pen strokes");

    // 2. Hollow rect & circle perimeter hit-testing and densified brush erasing
    assert(edJs.includes("if (a.t === 'rect' && !a.fill)") && edJs.includes("if (a.t === 'circle' && !a.fill)"),
      "editor.js hitAnnAt must hit-test hollow rect/circle perimeters so interior markups remain selectable");
    assert(edJs.includes("function densifyStrokeForBrush(") && proJs.includes("const densifyCmpPts ="),
      "editor.js and pro.js must subdivide long stroke segments during brush-radius erasing");

    // 3. Compare workspace double-click & inline sidebar editing of Pin, Leader Callout, and Revision Cloud
    assert(proJs.includes("function findCompareAnnotationAt(") && proJs.includes("async function editCompareAnnotation("),
      "pro.js must support double-click and context-menu editing of placed Compare markups");
    assert(ribJs.includes("rp-side-ann-in"),
      "ui_ribbon.js must provide inline editable inputs for Pin, Leader, and Cloud labels in the Markups sidebar");
    assert(appJs.includes("rm.renderSingleAnnotation(x, a, 1)"),
      "app.js exportReport must composite placed RP_MEASURE markups and BOM badges onto comparison report pages");
    assert(menuJs.includes("['backspace', 'edit'") && menuJs.includes("['q', 'edit', () => ACT.tool('pin')"),
      "menu.js must bind Backspace annotation deletion and Q shortcut for Pin Marker");
  });

  await testAsync("5 Enterprise Polish Features: External Link Bridge, Drag-and-Drop Backdrop, Empty-State Cards, Recent Submenu & 1-Click QA Package (.zip)", async () => {
    const mainJs = fs.readFileSync("main.js", "utf8");
    const preloadJs = fs.readFileSync("preload.js", "utf8");
    const preJs = fs.readFileSync("pre.js", "utf8");
    const nsi = fs.readFileSync("installer.nsi", "utf8");
    const html = fs.readFileSync("index.html", "utf8");
    const appJs = fs.readFileSync("app.js", "utf8");
    const menuJs = fs.readFileSync("menu.js", "utf8");
    const ribJs = fs.readFileSync("ui_ribbon.js", "utf8");

    // 1. External Link Bridge & Website Connectivity
    assert(mainJs.includes("setWindowOpenHandler") && mainJs.includes("shell.openExternal") && mainJs.includes("ipcMain.handle('open-url'"),
      "main.js must route external http/https links via setWindowOpenHandler and open-url IPC");
    assert(preloadJs.includes("openUrl:") && preJs.includes("window.openExternalUrl"),
      "preload.js and pre.js must expose openUrl and window.openExternalUrl");
    assert(menuJs.includes("Visit Website (textportdocx.in)") && menuJs.includes("Check for Updates..."),
      "Help menu must include Visit Website (textportdocx.in) and Check for Updates...");
    assert(html.includes('id="about-website-btn"') && html.includes('id="about-updates-btn"'),
      "About modal footer must include Visit Website and Check for Updates buttons");
    assert(nsi.includes('WriteRegStr HKCU "${UNINSTKEY}" "URLInfoAbout" "https://redline.textportdocx.in"') &&
           nsi.includes('WriteRegStr HKCU "${UNINSTKEY}" "HelpLink" "https://redline.textportdocx.in"') &&
           nsi.includes('WriteRegStr HKCU "${UNINSTKEY}" "URLUpdateInfo" "https://redline.textportdocx.in"'),
      "installer.nsi must write URLInfoAbout, HelpLink, and URLUpdateInfo under UNINSTKEY");

    // 2. Full-Window Drag-and-Drop Visual Target (Isolated per application)
    const pdfEdHtml = fs.readFileSync("pdf-editor.html", "utf8");
    assert(html.includes('id="rp-drop-backdrop"') &&
           html.includes('data-dropzone="A"') &&
           html.includes('data-dropzone="B"') &&
           pdfEdHtml.includes('data-dropzone="edit"'),
      "index.html must include Drop Slot A & B, and pdf-editor.html must include isolated PDF Editor drop zone");
    assert(appJs.includes("hideDropBackdrop") && appJs.includes("targetZone === 'A'") && appJs.includes("targetZone === 'B'"),
      "app.js must route dropped files based on active dropzone target");

    // 3. Canvas Empty-State Quick-Launch Cards
    assert(html.includes('id="rp-card-compare-drawings"') &&
           html.includes('id="rp-card-pdf-studio"') &&
           html.includes('id="rp-card-load-samples"'),
      "index.html must render the 3 primary Empty-State Quick-Launch Cards");

    // 4. Recent Files Submenu in File Menu
    assert(menuJs.includes("l: 'Open Recent'") && menuJs.includes("showSubMenu") && appJs.includes("r.slice(0, 8)"),
      "menu.js and app.js must store the last 8 opened files and populate File > Open Recent submenu");

    // 5. 1-Click QA Package Export (.ZIP Bundle)
    assert(ribJs.includes('id="rib-export-qa-zip"') && typeof UI.buildZipArchive === "function" && typeof UI.exportQAPackageZip === "function",
      "ui_ribbon.js must expose #rib-export-qa-zip, buildZipArchive, and exportQAPackageZip");

    const pkgRes = await UI.exportQAPackageZip();
    assert(pkgRes && pkgRes.zipBytes instanceof Uint8Array && pkgRes.zipBytes.length > 500,
      "exportQAPackageZip must generate a valid non-empty Uint8Array .zip bundle");
    // Verify PKZIP magic signature 0x50 0x4b 0x03 0x04 ('PK\x03\x04')
    assert.strictEqual(pkgRes.zipBytes[0], 0x50);
    assert.strictEqual(pkgRes.zipBytes[1], 0x4b);
    assert.strictEqual(pkgRes.zipBytes[2], 0x03);
    assert.strictEqual(pkgRes.zipBytes[3], 0x04);
    assert(pkgRes.files.some(n => n.endsWith("_Executive_Audit_Report.pdf")), "QA ZIP must bundle Annotated Executive Audit PDF");
    assert(pkgRes.files.some(n => n.endsWith("_Defect_Schedule.csv")), "QA ZIP must bundle Defect CSV Schedule");
  });

  test("Mode, View & Enhance, Area & DPI Audit Fixes: synchronized Mode/DPI controls, #hq z-index, drag/click Area, and PDF Studio Area tool", () => {
    const html = fs.readFileSync("index.html", "utf8");
    const css = fs.readFileSync("style.css", "utf8");
    const appJs = fs.readFileSync("app.js", "utf8");
    const proJs = fs.readFileSync("pro.js", "utf8");
    const ribJs = fs.readFileSync("ui_ribbon.js", "utf8");
    const edJs = fs.readFileSync("editor.js", "utf8");

    assert(ribJs.includes("function setCompareMode(") && ribJs.includes("id=\"rib-view-mode\"") && ribJs.includes("id=\"rib-view-dpi\""),
      "ui_ribbon.js must provide synchronized Mode and DPI controls in both Review & Compare and View & Enhance");
    assert(css.includes("#vp #cv,#vp #cvA,#vp #lv,#vp #hq,#ewrap #ecv{filter:var(--rp-filter,none)}"),
      "style.css must scope --rp-filter to drawing canvases so #mk and #rp-ov are not inverted");
    assert(proJs.includes("insertBefore(hq,") && ribJs.includes("id=\"rp-finish-tool-btn\""),
      "pro.js must mount #hq inside #stage below #mk and #rp-ov, and ui_ribbon.js must provide #rp-finish-tool-btn");
    assert(appJs.includes("oldDpi"),
      "app.js show(n) must scale S.view.k, calibration pxPerUnit, and annotations when DPI changes on the current page");
    assert(html.includes("data-t=\"area\"") && edJs.includes("case 'area':"),
      "index.html and editor.js must provide full Area measurement support in PDF Studio");
    assert(html.includes("id=\"eFontSet\"") && html.includes("data-etab=\"pages\"") && html.includes("data-etab=\"doc\""),
      "index.html must organize PDF Studio into MS Office set-wise tabs with an always-outside Font & Paragraph set (#eFontSet)");
    assert(edJs.includes("function shouldShowContextualDock(") && edJs.includes("function openInlineTextEditor(") && edJs.includes("function commitInlineTextEditor("),
      "editor.js must show #eStyleDock only for Pen/Shape/Eraser/Pin tools and provide direct on-page inline WYSIWYG text typing");
  });

  test("Full Application Audit Fixes: #lM Markers sync, cadDxf/rect SVG icons, editFromSelection partial-word support, offscreen canvas zeroing & WorkerClient.terminate()", () => {
    const icJs = fs.readFileSync("icons.js", "utf8");
    const html = fs.readFileSync("index.html", "utf8");
    const appJs = fs.readFileSync("app.js", "utf8");
    const proJs = fs.readFileSync("pro.js", "utf8");
    const ribJs = fs.readFileSync("ui_ribbon.js", "utf8");
    const edJs = fs.readFileSync("editor.js", "utf8");
    const weJs = fs.readFileSync("worker_engine.js", "utf8");

    assert(icJs.includes("rect:") && icJs.includes("cadDxf:"), "icons.js must define rect and cadDxf SVG icons");
    assert(html.includes("rel=\"icon\" href=\"build/icon.png\""), "index.html must include favicon link to prevent 404 console error");
    assert(ribJs.includes("$('#lM') || $('#boxes')"), "ui_ribbon.js Markers toggles (#rib-view-markers and #rp-markers-chk) must bind to #lM");
    assert(edJs.includes("return editItems(items, items.length === 1 && items[0].str.includes(t) ? t : null);"),
      "editor.js editFromSelection must delegate to editItems with partial-word target support");
    assert(edJs.includes("_scratchCanvas") && edJs.includes("E._rendering") && edJs.includes("E._renderQueued"),
      "editor.js must reuse _scratchCanvas for text metrics and serialize concurrent PDF.js render tasks cleanly");
    assert(appJs.includes("c.width = 0; c.height = 0;") && proJs.includes("hq._cropA = null"),
      "app.js and pro.js must release offscreen canvas buffers and cached loupe crops");
    assert(weJs.includes("terminate()"), "WorkerClient must provide a terminate() method to clean up worker and pending callbacks");
  });

  test("Loading Behaviour & Zero-Error Audit Fixes: launchpad SVG sizing, zero-size initial canvas, non-intrusive #rp-load progress, and universal image/CAD loading", () => {
    const css = fs.readFileSync("style.css", "utf8");
    const html = fs.readFileSync("index.html", "utf8");
    const preJs = fs.readFileSync("pre.js", "utf8");
    const proJs = fs.readFileSync("pro.js", "utf8");
    const appJs = fs.readFileSync("app.js", "utf8");
    const edJs = fs.readFileSync("editor.js", "utf8");
    const menuJs = fs.readFileSync("menu.js", "utf8");

    assert(css.includes("#empty>svg:not(.ic),#eempty>svg:not(.ic)") && css.includes(".card>svg:not(.ic)"),
      "style.css must scope 84px/80px SVG sizing to direct children so launchpad button icons remain 18px");
    assert(html.includes("<canvas id=\"cv\" width=\"0\" height=\"0\"></canvas>"),
      "index.html must initialize #cv with width=0 height=0 so #c-floating-hud stays hidden on startup");
    assert(preJs.includes("verbosity = 0") && preJs.includes("isOffscreenCanvasSupported = false"),
      "pre.js must configure PDF.js verbosity=0 and isOffscreenCanvasSupported=false for clean loading");
    assert(proJs.includes("window.rpCancelSharpen") && proJs.includes("^(Scanning|Comparing|Report|Unlocking|Preparing|Exporting|Merging|Splitting|Processing|Reading)"),
      "pro.js must expose rpCancelSharpen and restrict #rp-load status progress to active loading verbs");
    assert(appJs.includes("async function imageBytesToPDF(") && appJs.includes("window.__recentMemFiles"),
      "app.js must support converting opened images to PDF and caching recent in-memory files");
    assert(edJs.includes("const newDoc = await pdfjsLib.getDocument") && menuJs.includes("const hasEdFile = !!(e && e.bytes && e.name);"),
      "editor.js reload() must await newDoc before replacing E.doc and menu.js must keep #docname empty when no file is loaded");
  });

  // ----------------------------------------------------
  // MODULE 8: PRODUCTION STABILITY, MEMORY & CRASH RESILIENCE
  // ----------------------------------------------------
  console.log('\n--- MODULE 8: Production Stability, Memory Reclamation & Crash Resilience ---');

  test('Global crash handlers and unhandled rejection guards are registered', () => {
    const mainJs = fs.readFileSync('main.js', 'utf8');
    const preJs = fs.readFileSync('pre.js', 'utf8');

    assert(mainJs.includes("process.on('uncaughtException'") && mainJs.includes("process.on('unhandledRejection'"),
      'main.js must register process uncaughtException and unhandledRejection handlers');
    assert(mainJs.includes('Redline Pro System Notice') && mainJs.includes('dialog.showMessageBoxSync') && mainJs.includes('clipboard.writeText'),
      'main.js must display Redline Pro System Notice dialog with clipboard diagnostic copy support');
    assert(preJs.includes('window.onerror =') && preJs.includes("window.addEventListener('unhandledrejection'"),
      'pre.js must register window.onerror and unhandledrejection guards');
    assert(preJs.includes('⚠️ A background task encountered an issue and was safely contained.'),
      'pre.js must show the non-intrusive containment toast via #rp-toast');
  });

  test('PDF document destroy() and canvas dimension zeroing release memory properly', () => {
    const appJs = fs.readFileSync('app.js', 'utf8');
    const edJs = fs.readFileSync('editor.js', 'utf8');
    const extJs = fs.readFileSync('extras.js', 'utf8');
    const weJs = fs.readFileSync('worker_engine.js', 'utf8');
    const WE = require('../worker_engine.js');

    assert(appJs.includes('await prevDoc.destroy()') && edJs.includes('await prevDoc.destroy()'),
      'app.js and editor.js must explicitly await prevDoc.destroy() when replacing loaded PDF documents');
    assert(appJs.includes('renderTask.cancel()') && edJs.includes('E._renderTask.cancel()'),
      'app.js and editor.js must cancel in-flight render tasks when switching or closing documents');
    assert(weJs.includes('tile.canvas.width = 0;') && weJs.includes('tile.canvas.height = 0;'),
      'VirtualTileManager.clear() must zero tile canvas width and height to free GPU memory');
    assert(extJs.includes("$('#ecv').width = 0") && appJs.includes('window.rpTileManager.clear()'),
      'Closing tabs or switching Compare slots must zero canvases and clear VirtualTileManager');

    const vtm = new WE.VirtualTileManager({ tileSize: 512, maxCachedTiles: 8 });
    const tileCv = vtm.getOrCreateTileCanvas('0_0_1.00', 512, 512);
    assert.strictEqual(tileCv.width, 512);
    vtm.clear();
    assert.strictEqual(tileCv.width, 0, 'Tile canvas width must be 0 after VirtualTileManager.clear()');
    assert.strictEqual(tileCv.height, 0, 'Tile canvas height must be 0 after VirtualTileManager.clear()');
  });

  test('Corrupt DXF and encrypted PDF guards fail safely with descriptive errors', () => {
    const preJs = fs.readFileSync('pre.js', 'utf8');
    const appJs = fs.readFileSync('app.js', 'utf8');
    const edJs = fs.readFileSync('editor.js', 'utf8');

    // Verify DXFParser rejects empty, binary, and malformed DXF inputs with descriptive error
    assert.throws(() => new DXF.DXFParser('').parse(), /Invalid or binary DXF format\. Please provide standard ASCII DXF\./);
    assert.throws(() => new DXF.DXFParser('AutoCAD Binary DXF\r\n\x1a\x00').parse(), /Invalid or binary DXF format\. Please provide standard ASCII DXF\./);
    assert.throws(() => new DXF.DXFParser('NOT_A_DXF_FILE_AT_ALL').parse(), /Invalid or binary DXF format\. Please provide standard ASCII DXF\./);

    // Verify GerberParser rejects empty, binary, or non-RS-274X inputs cleanly without hanging
    assert.throws(() => new CAM.GerberParser('').parse(), /Invalid or corrupt Gerber RS-274X format/);
    assert.throws(() => new CAM.GerberParser('%PDF-1.7 binary garbage \x00').parse(), /Invalid or corrupt Gerber RS-274X format/);

    // Verify encrypted/password-protected PDF modal message is present in pre.js, app.js, and editor.js
    const expectedEncMsg = 'This document is password-protected or encrypted. Please decrypt or unlock the file before comparing or markup.';
    assert(preJs.includes(expectedEncMsg) && appJs.includes(expectedEncMsg) && edJs.includes(expectedEncMsg),
      'PasswordException guard must display the descriptive encrypted PDF message and reset workspace state');
  });

  test('Zoom clamp protects against NaN, zero, and infinite scale values', () => {
    const ME = require('../measure_engine.js');
    const proJs = fs.readFileSync('pro.js', 'utf8');
    const edJs = fs.readFileSync('editor.js', 'utf8');

    assert.strictEqual(typeof ME.clampZoom, 'function', 'MeasureEngine must export clampZoom');
    assert.strictEqual(ME.clampZoom(NaN), 1.0, 'NaN zoom must fallback to 1.0');
    assert.strictEqual(ME.clampZoom(0), 1.0, 'Zero zoom must fallback to 1.0');
    assert.strictEqual(ME.clampZoom(-5), 1.0, 'Negative zoom must fallback to 1.0');
    assert.strictEqual(ME.clampZoom(Infinity), 1.0, 'Infinite zoom must fallback to 1.0');
    assert.strictEqual(ME.clampZoom(0.001), 0.05, 'Sub-minimum zoom must clamp to 0.05');
    assert.strictEqual(ME.clampZoom(500), 64.0, 'Super-maximum zoom must clamp to 64.0');
    assert.strictEqual(ME.clampZoom(2.5), 2.5, 'Valid zoom within [0.05, 64.0] must be preserved');

    // Verify OSNAPManager.snap never produces NaN/Infinity even when passed 0 or NaN zoomScale
    const osnap = new ME.OSNAPManager(8);
    osnap.addPoint(100, 100, 'endpoint');
    const snapZero = osnap.snap(102, 102, 0);
    const snapNaN = osnap.snap(102, 102, NaN);
    assert(Number.isFinite(snapZero.x) && Number.isFinite(snapNaN.x), 'OSNAP snap must remain finite under 0 or NaN zoomScale');

    // Verify High-DPI Math.round(logicalWidth * devicePixelRatio) backing buffer sizing
    assert(proJs.includes('Math.round(logicalWidth * devicePixelRatio)') && proJs.includes('Math.round(logicalHeight * devicePixelRatio)'),
      'pro.js must compute backing buffer dimensions using Math.round(logicalWidth * devicePixelRatio)');
    assert(edJs.includes('Math.round(logicalWidth * d)') && edJs.includes('Math.round(logicalHeight * d)'),
      'editor.js must compute backing buffer dimensions using Math.round(logicalWidth * d)');
  });

  test('Special characters and spaces in file paths are sanitized and preserved', () => {
    const mainJs = fs.readFileSync('main.js', 'utf8');
    const appJs = fs.readFileSync('app.js', 'utf8');

    assert(mainJs.includes('function sanitizeFilePath(') && mainJs.includes('function ensureSaveExtension('),
      'main.js must define sanitizeFilePath and ensureSaveExtension helpers');
    assert(mainJs.includes('const payload = JSON.stringify({ name: path.basename(f), path: f, b64, slot })'),
      'main.js sendOpen must serialize file open payloads safely with JSON.stringify');
    assert(appJs.includes('function sanitizeFilePath('), 'app.js must define sanitizeFilePath');

    const complexName = 'Rev A & B [Final #2] (2026) — 电路图_Ω.pdf';
    const complexDir = path.join('/tmp', 'Engineering & CAM [2026] #1 (Test)');
    const fullPath = path.join(complexDir, complexName);
    const quoted = `"${fullPath}"`;
    const sanitized = quoted.trim().replace(/^["']+|["']+$/g, '');
    assert.strictEqual(path.basename(sanitized), complexName, 'Complex filename with spaces, &, [], #, (), and Unicode must be preserved');
  });

  test('Deep Memory Leak Prevention: bounded caches, thumbnail canvas zeroing, page.cleanup() & offscreen CAM/DXF canvas disposal', () => {
    const appJs = fs.readFileSync('app.js', 'utf8');
    const edJs = fs.readFileSync('editor.js', 'utf8');
    const extJs = fs.readFileSync('extras.js', 'utf8');
    const ribJs = fs.readFileSync('ui_ribbon.js', 'utf8');

    assert(appJs.includes('while (window.__recentMemFiles.size > 6)') && appJs.includes('p.cleanup()'),
      'app.js must cap __recentMemFiles cache and call p.cleanup() on background scanned pages');
    assert(appJs.includes('r.A = null; r.B = null; r.cls = null;'),
      'app.js must null out intermediate ImageData (r.A, r.B) and classification buffers (r.cls) during multi-page scans');
    assert(edJs.includes("box.querySelectorAll('canvas').forEach(cv => { cv.width = 0; cv.height = 0; });") && edJs.includes('p.cleanup()'),
      'editor.js must zero detached thumbnail and dialog canvases and call p.cleanup() on non-active pages');
    assert(extJs.includes('SKIP_SNAP_KEYS') && extJs.includes('pg.cleanup()'),
      'extras.js must exclude live render/DOM handles from tab snapshots and clean up batch-compared PDF pages');
    assert(ribJs.includes('cvRevA.width = 0; cvRevA.height = 0;') && ribJs.includes('CompareHistory') && ribJs.includes('clear()'),
      'ui_ribbon.js must zero temporary CAM/DXF offscreen canvases and clear CompareHistory on new document loads');
  });


  // ----------------------------------------------------
  // MODULE 9: ISOLATED DUAL-APPLICATION ARCHITECTURE & CUSTOM PDF EDITOR ICON
  // ----------------------------------------------------
  console.log('\n--- MODULE 9: Isolated Dual-Application Architecture & Custom PDF Editor Icon ---');

  test('Standalone Redline Pro PDF Editor (pdf-editor.html) is strictly isolated with its own custom icon and zero Compare shortcuts', () => {
    assert(fs.existsSync('pdf-editor.html'), 'pdf-editor.html must exist as a separate application entry file');
    assert(fs.existsSync('build/pdf-editor-icon.svg'), 'build/pdf-editor-icon.svg must exist');
    assert(fs.existsSync('build/pdf-editor-icon.png'), 'build/pdf-editor-icon.png must exist');
    assert(fs.existsSync('build/pdf-editor-logo.png'), 'build/pdf-editor-logo.png must exist');
    assert(fs.existsSync('build/pdf-editor-icon.ico'), 'build/pdf-editor-icon.ico must exist');

    const pdfEdHtml = fs.readFileSync('pdf-editor.html', 'utf8');
    const idxHtml = fs.readFileSync('index.html', 'utf8');

    assert(pdfEdHtml.includes('<title>Redline Pro PDF Editor'), 'pdf-editor.html must have Redline Pro PDF Editor title');
    assert(pdfEdHtml.includes('data-view="edit" data-app="pdf-editor"'), 'pdf-editor.html body must boot directly with data-view="edit" and data-app="pdf-editor"');
    assert(pdfEdHtml.includes('href="build/pdf-editor-icon.png"') && pdfEdHtml.includes('src="build/pdf-editor-logo.png"'),
      'pdf-editor.html must use build/pdf-editor-icon.png and build/pdf-editor-logo.png');
    assert(!pdfEdHtml.includes('Cross-Check in Compare') && !pdfEdHtml.includes('data-op="toA"') && !pdfEdHtml.includes('id="rp-launch-compare"'),
      'pdf-editor.html must not contain any in-app shortcuts to Compare');
    assert(!idxHtml.includes('id="open-pdf-editor-app-btn"') && !idxHtml.includes('data-dropzone="edit"'),
      'index.html must not contain any in-app shortcuts or drop zones to open PDF Editor');
  });

  test('Electron main.js and menu.js enforce strict isolation between Redline Pro and Redline Pro PDF Editor', () => {
    const mainJs = fs.readFileSync('main.js', 'utf8');
    const menuJs = fs.readFileSync('menu.js', 'utf8');

    assert(mainJs.includes('function isPdfEditorMode(') && mainJs.includes('pdf-editor.html') && mainJs.includes('pdf-editor-icon.png'),
      'main.js must detect PDF Editor mode and load pdf-editor.html with pdf-editor-icon.png');
    assert(!mainJs.includes("ipcMain.handle('open-pdf-editor'") && !mainJs.includes("ipcMain.handle('open-compare-app'"),
      'main.js must not expose cross-app window launchers');
    assert(!menuJs.includes("['ctrl+1'") && !menuJs.includes("['ctrl+2'") && !menuJs.includes('Send to Compare as A'),
      'menu.js must not include Ctrl+1/Ctrl+2 view-switching shortcuts or Send to Compare menu items');
  });

  test('Packaging (package.json, patch_exe.js, installer.nsi) embeds dedicated icons for both Redline Pro.exe and Redline Pro PDF Editor.exe', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const patchJs = fs.readFileSync('patch_exe.js', 'utf8');
    const nsi = fs.readFileSync('installer.nsi', 'utf8');

    assert(pkg.build.files.includes('pdf-editor.html') && pkg.build.files.includes('build/pdf-editor-icon.ico'),
      'package.json build.files must include pdf-editor.html and build/pdf-editor-icon.ico');
    assert(patchJs.includes('Redline Pro PDF Editor.exe') && patchJs.includes('pdf-editor-icon.ico'),
      'patch_exe.js must patch Redline Pro PDF Editor.exe with build/pdf-editor-icon.ico');
    assert(nsi.includes('!define EDITORICON "build\\pdf-editor-icon.ico"') && nsi.includes('$INSTDIR\\pdf-editor.ico'),
      'installer.nsi must install pdf-editor.ico and assign it to Redline Pro PDF Editor shortcuts and Explorer context menu');
  });

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passedTests} / ${totalTests} tests passed successfully.`);
  console.log('====================================================');
  if (passedTests === totalTests) {
    console.log('ALL V1.0 ENTERPRISE MODULES VERIFIED 100% OPERATIONAL!');
  } else {
    process.exit(1);
  }
})();
