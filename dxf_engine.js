/**
 * Redline Pro — Offline Bi-Directional AutoCAD DXF Engine (R12 / R2000 / R2018 ASCII)
 * Full support for HEADER ($INSUNITS, $EXTMIN/$EXTMAX), TABLES (LAYER colors, linetypes, on/off state),
 * BLOCKS & INSERT (nested block references with scale/rotation), LINE, LWPOLYLINE (with bulge arcs),
 * POLYLINE + VERTEX, CIRCLE, ARC, ELLIPSE, SPLINE, SOLID, POINT, DIMENSION, TEXT & MTEXT formatting,
 * Vector Entity-Level DXF A/B Diffing, and Multi-Layer PDF+Redline+Measurement to DXF Export.
 * Redline Studio · textportdocx.in
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DXFEngine = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // AutoCAD Color Indices (ACI) standard palette
  const ACI = {
    BYBLOCK: 0,
    RED: 1,
    YELLOW: 2,
    GREEN: 3,
    CYAN: 4,
    BLUE: 5,
    MAGENTA: 6,
    WHITE: 7,
    GRAY: 8,
    LIGHT_GRAY: 9,
    ORANGE: 30,
    VIOLET: 200,
    BYLAYER: 256
  };

  // Extended AutoCAD ACI color lookup table
  const ACI_PALETTE_DARK = {
    1: '#ef4444', // Red
    2: '#eab308', // Yellow
    3: '#22c55e', // Green
    4: '#06b6d4', // Cyan
    5: '#3b82f6', // Blue
    6: '#ec4899', // Magenta
    7: '#f8fafc', // White on Dark Modelspace
    8: '#94a3b8', // Dark Gray
    9: '#cbd5e1', // Light Gray
    10: '#f87171',
    11: '#fca5a5',
    20: '#fb923c',
    30: '#f97316',
    40: '#f59e0b',
    50: '#eab308',
    60: '#84cc16',
    70: '#22c55e',
    80: '#10b981',
    90: '#14b8a6',
    100: '#06b6d4',
    110: '#0ea5e9',
    120: '#3b82f6',
    130: '#6366f1',
    140: '#8b5cf6',
    150: '#a855f7',
    160: '#d946ef',
    170: '#ec4899',
    190: '#f43f5e',
    200: '#c084fc',
    250: '#475569',
    251: '#64748b',
    252: '#94a3b8',
    253: '#cbd5e1',
    254: '#e2e8f0',
    255: '#ffffff'
  };

  const ACI_PALETTE_LIGHT = {
    ...ACI_PALETTE_DARK,
    2: '#b45309', // Darker amber/gold on white paper for readability
    3: '#15803d', // Crisp engineering green on white paper
    4: '#0e7490', // Deep cyan on white paper
    5: '#1d4ed8', // Deep cobalt blue on white paper
    6: '#be185d', // Deep magenta on white paper
    7: '#0f172a', // AutoCAD ACI 7 = Black/Dark Slate on White Paper!
    8: '#475569',
    9: '#64748b',
    50: '#a16207',
    254: '#334155',
    255: '#1e293b'
  };

  // Standard AutoCAD $INSUNITS definitions
  const UNITS = {
    unitless: { code: 0, name: 'Unitless', ptFactor: 1.0, toMM: 1.0, toMils: 39.3700787 },
    in: { code: 1, name: 'Inches', ptFactor: 1 / 72, toMM: 25.4, toMils: 1000 },
    ft: { code: 2, name: 'Feet', ptFactor: 1 / (72 * 12), toMM: 304.8, toMils: 12000 },
    mm: { code: 4, name: 'Millimeters', ptFactor: 25.4 / 72, toMM: 1.0, toMils: 39.3700787 },
    cm: { code: 5, name: 'Centimeters', ptFactor: 2.54 / 72, toMM: 10.0, toMils: 393.700787 },
    m: { code: 6, name: 'Meters', ptFactor: 0.0254 / 72, toMM: 1000.0, toMils: 39370.0787 },
    mils: { code: 10, name: 'Mils', ptFactor: 1000 / 72, toMM: 0.0254, toMils: 1.0 },
    um: { code: 13, name: 'Microns (IPC Metric)', ptFactor: 25400 / 72, toMM: 0.001, toMils: 0.03937 }
  };

  const INSUNITS_CODE_MAP = {
    0: 'unitless',
    1: 'in',
    2: 'ft',
    4: 'mm',
    5: 'cm',
    6: 'm',
    10: 'mils',
    13: 'um'
  };

  const PRESETS = {
    '1:1': 1.0,
    '1:2': 2.0,
    '1:5': 5.0,
    '1:10': 10.0,
    '1:20': 20.0,
    '1:50': 50.0,
    '1:100': 100.0,
    '1:1000': 1000.0
  };

  // Matrix math helpers for affine transformations (PDF CTM)
  function identityMatrix() {
    return [1, 0, 0, 1, 0, 0];
  }

  function multiplyMatrix(m1, m2) {
    return [
      m1[0] * m2[0] + m1[2] * m2[1],
      m1[1] * m2[0] + m1[3] * m2[1],
      m1[0] * m2[2] + m1[2] * m2[3],
      m1[1] * m2[2] + m1[3] * m2[3],
      m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
      m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
    ];
  }

  function transformPoint(m, x, y) {
    return [
      m[0] * x + m[2] * y + m[4],
      m[1] * x + m[3] * y + m[5]
    ];
  }

  // Strip AutoCAD MTEXT inline control codes (\A1;, \P, \f...;, {\H...;text}, %%c, %%d, %%p)
  function cleanDXFText(raw) {
    if (!raw) return '';
    return String(raw)
      .replace(/\\P/g, '\n')
      .replace(/\\[A-Za-z][^;]*;/g, '')
      .replace(/\{|\}/g, '')
      .replace(/%%[cC]/g, '⌀')
      .replace(/%%[dD]/g, '°')
      .replace(/%%[pP]/g, '±')
      .replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .trim();
  }

  // Sanitize engineering symbols for ASCII DXF TEXT entities
  function sanitizeAsciiDXFText(str) {
    return String(str || '')
      .replace(/[\r\n]+/g, ' ')
      .replace(/[ΩΩ]/g, 'Ohm')
      .replace(/[µμ]/g, 'u')
      .replace(/Δ/g, 'Delta ')
      .replace(/⌀/g, '%%c')
      .replace(/°/g, '%%d')
      .replace(/±/g, '%%p')
      .replace(/×/g, 'x')
      .replace(/÷/g, '/')
      .replace(/≤/g, '<=')
      .replace(/≥/g, '>=')
      .replace(/✓/g, 'OK')
      .replace(/✗/g, 'X')
      .replace(/→/g, '->')
      .replace(/↔/g, '<->')
      .replace(/·/g, '-')
      .replace(/[^\x20-\x7E]/g, '?');
  }

  // Convert LWPOLYLINE / POLYLINE segment with AutoCAD bulge (tan(theta/4)) into interpolated points
  function tessellateBulgeSegment(p1, p2, bulge, segments = 12) {
    if (!bulge || Math.abs(bulge) < 1e-6) return [p2];
    const x1 = p1[0], y1 = p1[1], x2 = p2[0], y2 = p2[1];
    const dx = x2 - x1, dy = y2 - y1;
    const chord = Math.hypot(dx, dy);
    if (chord < 1e-9) return [p2];

    const theta = 4 * Math.atan(bulge);
    const radius = Math.abs(chord / (2 * Math.sin(theta / 2)));
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const d = Math.sqrt(Math.max(0, radius * radius - (chord * chord) / 4));
    const sign = (bulge > 0 ? 1 : -1) * (Math.abs(bulge) <= 1 ? 1 : -1);
    const nx = -dy / chord, ny = dx / chord;
    const cx = mx + sign * d * nx;
    const cy = my + sign * d * ny;

    const startAng = Math.atan2(y1 - cy, x1 - cx);
    const pts = [];
    const steps = Math.max(4, Math.min(32, Math.ceil(Math.abs(theta) / (Math.PI / segments))));
    for (let s = 1; s <= steps; s++) {
      const ang = startAng + (theta * s) / steps;
      pts.push([cx + radius * Math.cos(ang), cy + radius * Math.sin(ang)]);
    }
    return pts;
  }

  // Bezier curve flattening into line segments for CAD polylines
  function flattenCubicBezier(p0, p1, p2, p3, tolerance = 0.5) {
    const points = [p0];
    function subdivide(t0, t1, pt0, pt1, pt2, pt3) {
      const midX = (pt0[0] + 3 * pt1[0] + 3 * pt2[0] + pt3[0]) / 8;
      const midY = (pt0[1] + 3 * pt1[1] + 3 * pt2[1] + pt3[1]) / 8;
      const chordMidX = (pt0[0] + pt3[0]) / 2;
      const chordMidY = (pt0[1] + pt3[1]) / 2;
      const dx = midX - chordMidX;
      const dy = midY - chordMidY;
      const distSq = dx * dx + dy * dy;

      if (distSq <= tolerance * tolerance || (t1 - t0) < 0.05) {
        points.push([midX, midY], pt3);
      } else {
        const midT = (t0 + t1) / 2;
        const q0 = pt0;
        const q1 = [(pt0[0] + pt1[0]) / 2, (pt0[1] + pt1[1]) / 2];
        const q2 = [(pt0[0] + 2 * pt1[0] + pt2[0]) / 4, (pt0[1] + 2 * pt1[1] + pt2[1]) / 4];
        const q3 = [midX, midY];

        const r0 = [midX, midY];
        const r1 = [(pt1[0] + 2 * pt2[0] + pt3[0]) / 4, (pt1[1] + 2 * pt2[1] + pt3[1]) / 4];
        const r2 = [(pt2[0] + pt3[0]) / 2, (pt2[1] + pt3[1]) / 2];
        const r3 = pt3;

        subdivide(t0, midT, q0, q1, q2, q3);
        subdivide(midT, t1, r0, r1, r2, r3);
      }
    }
    subdivide(0, 1, p0, p1, p2, p3);
    return points;
  }

  /**
   * DXFWriter: Generates standard AutoCAD R12/2000 ASCII DXF files
   */
  class DXFWriter {
    constructor(options = {}) {
      this.unit = options.unit || 'mm';
      this.scale = options.scale || 1.0;
      this.unitInfo = UNITS[this.unit] || UNITS.mm;
      this.scaleFactor = this.unitInfo.ptFactor * this.scale;
      this.layers = new Set([
        '0',
        'SHEET_BORDER',
        'GEOMETRY',
        'TEXT',
        'REDLINE_DIFFS',
        'REDLINE_MARKUPS',
        'REDLINE_MEASUREMENTS',
        'REDLINE_BOM'
      ]);
      this.entities = [];
      this.minX = Infinity;
      this.minY = Infinity;
      this.maxX = -Infinity;
      this.maxY = -Infinity;
    }

    _coord(pt) {
      const x = pt[0] * this.scaleFactor;
      const y = pt[1] * this.scaleFactor;
      if (x < this.minX) this.minX = x;
      if (x > this.maxX) this.maxX = x;
      if (y < this.minY) this.minY = y;
      if (y > this.maxY) this.maxY = y;
      return [x, y];
    }

    addLine(x1, y1, x2, y2, layer = 'GEOMETRY', color = null) {
      this.layers.add(layer);
      const [p1x, p1y] = this._coord([x1, y1]);
      const [p2x, p2y] = this._coord([x2, y2]);
      this.entities.push({
        type: 'LINE',
        layer,
        color,
        p1: [p1x, p1y],
        p2: [p2x, p2y]
      });
    }

    addCircle(cx, cy, r, layer = 'GEOMETRY', color = null) {
      this.layers.add(layer);
      const [px, py] = this._coord([cx, cy]);
      const rad = r * this.scaleFactor;
      if (px - rad < this.minX) this.minX = px - rad;
      if (px + rad > this.maxX) this.maxX = px + rad;
      if (py - rad < this.minY) this.minY = py - rad;
      if (py + rad > this.maxY) this.maxY = py + rad;
      this.entities.push({
        type: 'CIRCLE',
        layer,
        color,
        center: [px, py],
        radius: rad
      });
    }

    addArc(cx, cy, r, startAngleDeg, endAngleDeg, layer = 'GEOMETRY', color = null) {
      this.layers.add(layer);
      const [px, py] = this._coord([cx, cy]);
      const rad = r * this.scaleFactor;
      if (px - rad < this.minX) this.minX = px - rad;
      if (px + rad > this.maxX) this.maxX = px + rad;
      if (py - rad < this.minY) this.minY = py - rad;
      if (py + rad > this.maxY) this.maxY = py + rad;
      this.entities.push({
        type: 'ARC',
        layer,
        color,
        center: [px, py],
        radius: rad,
        startAngle: startAngleDeg,
        endAngle: endAngleDeg
      });
    }

    addPolyline(points, closed = false, layer = 'GEOMETRY', color = null, bulges = null) {
      if (!points || points.length < 2) return;
      this.layers.add(layer);
      const transformed = points.map(p => this._coord(p));
      this.entities.push({
        type: 'LWPOLYLINE',
        layer,
        color,
        closed: !!closed,
        points: transformed,
        bulges: bulges || null
      });
    }

    addRevisionCloud(x, y, w, h, label = '', layer = 'REDLINE_DIFFS', color = ACI.RED) {
      const corners = [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h]
      ];
      // Build scalloped LWPOLYLINE vertices with bulge = 0.52 along each edge
      const pts = [];
      const bulges = [];
      const step = Math.max(8, Math.min(24, Math.min(w, h) / 4));
      for (let i = 0; i < 4; i++) {
        const p1 = corners[i];
        const p2 = corners[(i + 1) % 4];
        const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
        const n = Math.max(2, Math.round(len / step));
        for (let k = 0; k < n; k++) {
          const t = k / n;
          pts.push([p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t]);
          bulges.push(0.52);
        }
      }
      this.addPolyline(pts, true, layer, color, bulges);
      if (label) {
        this.addText(label, x, y + h + 4, 9, 0, layer, color);
      }
    }

    addRect(x, y, w, h, layer = 'GEOMETRY', color = null) {
      const pts = [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h]
      ];
      this.addPolyline(pts, true, layer, color);
    }

    addSolid(p1, p2, p3, p4, layer = 'REDLINE_DIFFS', color = ACI.RED) {
      this.layers.add(layer);
      const t1 = this._coord(p1);
      const t2 = this._coord(p2);
      const t3 = this._coord(p3);
      const t4 = this._coord(p4 || p3);
      this.entities.push({
        type: 'SOLID',
        layer,
        color,
        p1: t1,
        p2: t2,
        p3: t3,
        p4: t4
      });
    }

    addText(text, x, y, height = 12, rotationDeg = 0, layer = 'TEXT', color = null) {
      if (!text || !String(text).trim()) return;
      this.layers.add(layer);
      const [px, py] = this._coord([x, y]);
      const h = height * this.scaleFactor;
      this.entities.push({
        type: 'TEXT',
        layer,
        color,
        text: sanitizeAsciiDXFText(text),
        pos: [px, py],
        height: Math.max(0.1, h),
        rotation: rotationDeg
      });
    }

    generateString() {
      const lines = [];
      const out = (code, val) => {
        lines.push(String(code).trim());
        lines.push(String(val).trim());
      };

      // 1. HEADER SECTION
      out(0, 'SECTION');
      out(2, 'HEADER');
      out(9, '$ACADVER');
      out(1, 'AC1015'); // AutoCAD 2000 standard
      out(9, '$INSUNITS');
      out(70, this.unitInfo.code);
      out(9, '$EXTMIN');
      out(10, isFinite(this.minX) ? this.minX.toFixed(4) : 0);
      out(20, isFinite(this.minY) ? this.minY.toFixed(4) : 0);
      out(30, 0);
      out(9, '$EXTMAX');
      out(10, isFinite(this.maxX) ? this.maxX.toFixed(4) : 100);
      out(20, isFinite(this.maxY) ? this.maxY.toFixed(4) : 100);
      out(30, 0);
      out(0, 'ENDSEC');

      // 2. TABLES SECTION (Layers)
      out(0, 'SECTION');
      out(2, 'TABLES');
      out(0, 'TABLE');
      out(2, 'LAYER');
      out(70, this.layers.size);

      const layerColors = {
        '0': ACI.WHITE,
        'SHEET_BORDER': ACI.CYAN,
        'GEOMETRY': ACI.WHITE,
        'TEXT': ACI.YELLOW,
        'REDLINE_DIFFS': ACI.RED,
        'REDLINE_MARKUPS': ACI.MAGENTA,
        'REDLINE_MEASUREMENTS': ACI.GREEN,
        'REDLINE_BOM': ACI.ORANGE
      };

      for (const lyr of this.layers) {
        out(0, 'LAYER');
        out(2, lyr);
        out(70, 0);
        out(62, layerColors[lyr] || ACI.WHITE);
        out(6, 'CONTINUOUS');
      }
      out(0, 'ENDTAB');
      out(0, 'ENDSEC');

      // 3. BLOCKS SECTION
      out(0, 'SECTION');
      out(2, 'BLOCKS');
      out(0, 'ENDSEC');

      // 4. ENTITIES SECTION
      out(0, 'SECTION');
      out(2, 'ENTITIES');

      for (const ent of this.entities) {
        out(0, ent.type);
        out(8, ent.layer);
        if (ent.color != null) out(62, ent.color);

        switch (ent.type) {
          case 'LINE':
            out(10, ent.p1[0].toFixed(4));
            out(20, ent.p1[1].toFixed(4));
            out(30, 0);
            out(11, ent.p2[0].toFixed(4));
            out(21, ent.p2[1].toFixed(4));
            out(31, 0);
            break;
          case 'CIRCLE':
            out(10, ent.center[0].toFixed(4));
            out(20, ent.center[1].toFixed(4));
            out(30, 0);
            out(40, ent.radius.toFixed(4));
            break;
          case 'ARC':
            out(10, ent.center[0].toFixed(4));
            out(20, ent.center[1].toFixed(4));
            out(30, 0);
            out(40, ent.radius.toFixed(4));
            out(50, ent.startAngle.toFixed(2));
            out(51, ent.endAngle.toFixed(2));
            break;
          case 'LWPOLYLINE':
            out(90, ent.points.length);
            out(70, ent.closed ? 1 : 0);
            for (let idx = 0; idx < ent.points.length; idx++) {
              const pt = ent.points[idx];
              out(10, pt[0].toFixed(4));
              out(20, pt[1].toFixed(4));
              if (ent.bulges && ent.bulges[idx]) {
                out(42, ent.bulges[idx].toFixed(4));
              }
            }
            break;
          case 'SOLID':
            out(10, ent.p1[0].toFixed(4));
            out(20, ent.p1[1].toFixed(4));
            out(30, 0);
            out(11, ent.p2[0].toFixed(4));
            out(21, ent.p2[1].toFixed(4));
            out(31, 0);
            out(12, ent.p3[0].toFixed(4));
            out(22, ent.p3[1].toFixed(4));
            out(32, 0);
            out(13, ent.p4[0].toFixed(4));
            out(23, ent.p4[1].toFixed(4));
            out(33, 0);
            break;
          case 'TEXT':
            out(10, ent.pos[0].toFixed(4));
            out(20, ent.pos[1].toFixed(4));
            out(30, 0);
            out(40, ent.height.toFixed(4));
            out(1, ent.text);
            if (ent.rotation) out(50, ent.rotation.toFixed(2));
            break;
        }
      }

      out(0, 'ENDSEC');
      out(0, 'EOF');
      return lines.join('\r\n') + '\r\n';
    }
  }

  /**
   * PDFToDXFExporter: Extracts PDF.js vector operators, text, redline diff clouds,
   * placed measurements, leader callouts, and BOM tally badges into layered AutoCAD DXF.
   */
  async function exportPDFToDXF(page, options = {}) {
    const writer = new DXFWriter({
      unit: options.unit || 'mm',
      scale: options.scale || 1.0
    });

    const viewport = page.getViewport({ scale: 1.0 });
    const pageWidth = viewport.width;
    const pageHeight = viewport.height;
    const imgToPdfFactor = options.imgWidth ? (pageWidth / options.imgWidth) : 1.0;
    const targetPage = options.pageNumber != null ? options.pageNumber : null;

    // Draw SHEET_BORDER
    writer.addRect(0, 0, pageWidth, pageHeight, 'SHEET_BORDER', ACI.CYAN);

    // Add comparison diff regions (as scalloped revision clouds or bounding rects)
    if (options.diffRegions && options.diffRegions.length) {
      for (const r of options.diffRegions) {
        const dpiScale = r.dpi ? (72 / r.dpi) : imgToPdfFactor;
        const rx = r.x * dpiScale;
        const rw = r.w * dpiScale;
        const rh = r.h * dpiScale;
        const ry = pageHeight - (r.y * dpiScale + rh);
        const col = r.type === 'added' ? ACI.GREEN : (r.type === 'removed' ? ACI.RED : ACI.YELLOW);
        if (options.scallopedDiffs !== false) {
          writer.addRevisionCloud(rx, ry, rw, rh, `#${r.id || ''} ${(r.type || 'DIFF').toUpperCase()}`, 'REDLINE_DIFFS', col);
        } else {
          writer.addRect(rx, ry, rw, rh, 'REDLINE_DIFFS', col);
        }
      }
    }

    // Export Placed Measurements & Redline Markups (from RP_MEASURE or Editor annotations)
    if (options.annotations && options.annotations.length) {
      for (const a of options.annotations) {
        if (targetPage != null && a.page != null && a.page !== targetPage) continue;
        const sc = imgToPdfFactor;
        const toPdfPt = pt => [pt.x * sc, pageHeight - pt.y * sc];
        if ((a.kind === 'dist' || a.kind === 'poly') && a.pts && a.pts.length >= 2) {
          const pts = a.pts.map(toPdfPt);
          writer.addPolyline(pts, false, 'REDLINE_MEASUREMENTS', ACI.GREEN);
          if (a.label) {
            const mid = pts[Math.floor(pts.length / 2)];
            writer.addText(a.label, mid[0], mid[1] + 4, 9, 0, 'REDLINE_MEASUREMENTS', ACI.GREEN);
          }
        } else if (a.kind === 'area' && a.pts && a.pts.length >= 3) {
          const pts = a.pts.map(toPdfPt);
          writer.addPolyline(pts, true, 'REDLINE_MEASUREMENTS', ACI.GREEN);
          if (a.label) {
            writer.addText(a.label, pts[0][0], pts[0][1] + 4, 9, 0, 'REDLINE_MEASUREMENTS', ACI.GREEN);
          }
        } else if (a.kind === 'cloud' && a.pts && a.pts.length >= 2) {
          const xs = a.pts.map(p => p.x * sc), ys = a.pts.map(p => pageHeight - p.y * sc);
          const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
          writer.addRevisionCloud(x0, y0, w, h, a.revText || 'REV', 'REDLINE_MARKUPS', ACI.MAGENTA);
        } else if (a.kind === 'leader' && a.pts && a.pts.length >= 2) {
          const p1 = toPdfPt(a.pts[0]), p2 = toPdfPt(a.pts[1]);
          writer.addLine(p1[0], p1[1], p2[0], p2[1], 'REDLINE_MARKUPS', ACI.MAGENTA);
          if (a.label) writer.addText(a.label, p2[0] + 4, p2[1], 10, 0, 'REDLINE_MARKUPS', ACI.MAGENTA);
        } else if (a.kind === 'pen' && a.pts && a.pts.length >= 2) {
          const pts = a.pts.map(toPdfPt);
          writer.addPolyline(pts, false, 'REDLINE_MARKUPS', ACI.RED);
        } else if (a.kind === 'pin') {
          const px = (a.x || 0) * sc, py = pageHeight - (a.y || 0) * sc;
          writer.addCircle(px, py, 6, 'REDLINE_MARKUPS', ACI.ORANGE);
          writer.addText(`#${a.pinNum || 1} ${a.label || 'PIN'}`, px + 8, py - 3, 9, 0, 'REDLINE_MARKUPS', ACI.ORANGE);
        } else if (a.kind === 'stamp') {
          const sx = (a.x || 50) * sc, sy = pageHeight - ((a.y || 50) * sc + 36);
          writer.addRect(sx, sy, 160, 36, 'REDLINE_MARKUPS', ACI.GREEN);
          writer.addText(`${a.stampType || 'APPROVED'} (${a.docHash || ''})`, sx + 8, sy + 12, 10, 0, 'REDLINE_MARKUPS', ACI.GREEN);
        } else if (a.t) {
          // Support PDF Editor annotations (a.t = 'rect'|'circle'|'line'|'arrow'|'poly'|'draw'|'text'|'cloud'|'leader'|'stamp'|'meas')
          if (a.t === 'rect' || a.t === 'highlight' || a.t === 'whiteout' || a.t === 'redact') {
            writer.addRect(a.x, pageHeight - (a.y + a.h), a.w, a.h, 'REDLINE_MARKUPS', ACI.MAGENTA);
          } else if (a.t === 'circle') {
            writer.addCircle(a.x + a.w / 2, pageHeight - (a.y + a.h / 2), Math.max(a.w, a.h) / 2, 'REDLINE_MARKUPS', ACI.MAGENTA);
          } else if (a.t === 'line' || a.t === 'arrow' || a.t === 'meas' || a.t === 'leader') {
            const x1 = a.x1 != null ? a.x1 : a.x, y1 = a.y1 != null ? a.y1 : a.y;
            const lyr = a.t === 'meas' ? 'REDLINE_MEASUREMENTS' : 'REDLINE_MARKUPS';
            const col = a.t === 'meas' ? ACI.GREEN : ACI.MAGENTA;
            writer.addLine(x1, pageHeight - y1, a.x2, pageHeight - a.y2, lyr, col);
            if (a.text) writer.addText(a.text, a.x2 + 4, pageHeight - a.y2, 10, 0, lyr, col);
          } else if ((a.t === 'poly' || a.t === 'draw') && a.pts && a.pts.length >= 2) {
            writer.addPolyline(a.pts.map(p => [p[0], pageHeight - p[1]]), !!a.closed, 'REDLINE_MARKUPS', ACI.MAGENTA);
          } else if (a.t === 'cloud') {
            writer.addRevisionCloud(a.x, pageHeight - (a.y + a.h), a.w, a.h, a.revText || 'REV', 'REDLINE_MARKUPS', ACI.RED);
          } else if (a.t === 'text' && a.text) {
            writer.addText(a.text, a.x, pageHeight - (a.y + (a.size || 12)), a.size || 12, 0, 'REDLINE_MARKUPS', ACI.YELLOW);
          } else if (a.t === 'pin') {
            const px = a.x + (a.w || 24) / 2, py = pageHeight - (a.y + (a.h || 30));
            writer.addCircle(px, py, 6, 'REDLINE_MARKUPS', ACI.ORANGE);
            writer.addText(`#${a.pinNum || 1} ${a.text || 'PIN'}`, px + 8, py - 3, 9, 0, 'REDLINE_MARKUPS', ACI.ORANGE);
          } else if (a.t === 'stamp') {
            writer.addRect(a.x, pageHeight - (a.y + a.h), a.w, a.h, 'REDLINE_MARKUPS', ACI.GREEN);
            writer.addText(a.text || 'APPROVED', a.x + 6, pageHeight - (a.y + a.h * 0.65), a.fs || 14, 0, 'REDLINE_MARKUPS', ACI.GREEN);
          }
        }
      }
    }

    // Export BOM Tally Counter Badges
    if (options.tallyItems && options.tallyItems.length) {
      for (const t of options.tallyItems) {
        if (targetPage != null && t.page != null && t.page !== targetPage) continue;
        const sc = imgToPdfFactor;
        const tx = t.x * sc, ty = pageHeight - t.y * sc;
        writer.addCircle(tx, ty, 8, 'REDLINE_BOM', ACI.ORANGE);
        writer.addText(`#${t.number}: ${t.label || 'BOM'}`, tx + 10, ty - 3, 9, 0, 'REDLINE_BOM', ACI.ORANGE);
      }
    }

    // Extract PDF Text Content
    if (options.includeText !== false) {
      try {
        const textContent = await page.getTextContent();
        if (textContent && textContent.items) {
          for (const item of textContent.items) {
            if (!item.str || !item.str.trim()) continue;
            const tr = item.transform;
            const x = tr[4];
            const y = tr[5];
            const fontSize = Math.sqrt(tr[0] * tr[0] + tr[1] * tr[1]) || 10;
            const rotationRad = Math.atan2(tr[1], tr[0]);
            const rotationDeg = (rotationRad * 180) / Math.PI;

            writer.addText(item.str, x, y, fontSize, rotationDeg, 'TEXT', ACI.YELLOW);
          }
        }
      } catch (e) {
        console.warn('PDF text extraction error for DXF:', e);
      }
    }

    // Extract PDF Vector Graphics via Operator List
    try {
      const opList = await page.getOperatorList();
      const fnArray = opList.fnArray;
      const argsArray = opList.argsArray;

      const OPS = (typeof pdfjsLib !== 'undefined' && pdfjsLib.OPS) ? pdfjsLib.OPS : {
        save: 10,
        restore: 11,
        transform: 12,
        moveTo: 13,
        lineTo: 14,
        curveTo: 15,
        closePath: 18,
        rectangle: 19,
        stroke: 20,
        fill: 22,
        eoFill: 23,
        constructPath: 91
      };

      const ctmStack = [identityMatrix()];
      let currentCTM = identityMatrix();
      let currentPath = [];
      let currentPoint = [0, 0];

      for (let i = 0; i < fnArray.length; i++) {
        const fn = fnArray[i];
        const args = argsArray[i];

        if (fn === OPS.save) {
          ctmStack.push([...currentCTM]);
        } else if (fn === OPS.restore) {
          if (ctmStack.length > 1) {
            currentCTM = ctmStack.pop();
          }
        } else if (fn === OPS.transform) {
          const m = [args[0], args[1], args[2], args[3], args[4], args[5]];
          currentCTM = multiplyMatrix(currentCTM, m);
        } else if (fn === OPS.moveTo) {
          const pt = transformPoint(currentCTM, args[0], args[1]);
          currentPoint = pt;
          currentPath.push({ op: 'move', pt });
        } else if (fn === OPS.lineTo) {
          const pt = transformPoint(currentCTM, args[0], args[1]);
          currentPath.push({ op: 'line', pt0: currentPoint, pt1: pt });
          currentPoint = pt;
        } else if (fn === OPS.curveTo) {
          const cp1 = transformPoint(currentCTM, args[0], args[1]);
          const cp2 = transformPoint(currentCTM, args[2], args[3]);
          const endPt = transformPoint(currentCTM, args[4], args[5]);
          currentPath.push({ op: 'curve', pt0: currentPoint, cp1, cp2, endPt });
          currentPoint = endPt;
        } else if (fn === OPS.rectangle) {
          const [rx, ry, rw, rh] = args;
          const p1 = transformPoint(currentCTM, rx, ry);
          const p2 = transformPoint(currentCTM, rx + rw, ry);
          const p3 = transformPoint(currentCTM, rx + rw, ry + rh);
          const p4 = transformPoint(currentCTM, rx, ry + rh);
          const isBorder = (Math.abs(rw - pageWidth) < 10 && Math.abs(rh - pageHeight) < 10);
          const lyr = isBorder ? 'SHEET_BORDER' : 'GEOMETRY';
          writer.addPolyline([p1, p2, p3, p4], true, lyr);
        } else if (fn === OPS.constructPath) {
          const pathOps = args[0];
          const coords = args[1];
          let coordIdx = 0;

          for (let pIdx = 0; pIdx < pathOps.length; pIdx++) {
            const pathOp = pathOps[pIdx];
            if (pathOp === OPS.moveTo) {
              const pt = transformPoint(currentCTM, coords[coordIdx], coords[coordIdx + 1]);
              coordIdx += 2;
              currentPoint = pt;
              currentPath.push({ op: 'move', pt });
            } else if (pathOp === OPS.lineTo) {
              const pt = transformPoint(currentCTM, coords[coordIdx], coords[coordIdx + 1]);
              coordIdx += 2;
              currentPath.push({ op: 'line', pt0: currentPoint, pt1: pt });
              currentPoint = pt;
            } else if (pathOp === OPS.curveTo) {
              const cp1 = transformPoint(currentCTM, coords[coordIdx], coords[coordIdx + 1]);
              const cp2 = transformPoint(currentCTM, coords[coordIdx + 2], coords[coordIdx + 3]);
              const endPt = transformPoint(currentCTM, coords[coordIdx + 4], coords[coordIdx + 5]);
              coordIdx += 6;
              currentPath.push({ op: 'curve', pt0: currentPoint, cp1, cp2, endPt });
              currentPoint = endPt;
            } else if (pathOp === OPS.closePath) {
              currentPath.push({ op: 'close' });
            } else if (pathOp === OPS.rectangle) {
              const rx = coords[coordIdx];
              const ry = coords[coordIdx + 1];
              const rw = coords[coordIdx + 2];
              const rh = coords[coordIdx + 3];
              coordIdx += 4;
              const p1 = transformPoint(currentCTM, rx, ry);
              const p2 = transformPoint(currentCTM, rx + rw, ry);
              const p3 = transformPoint(currentCTM, rx + rw, ry + rh);
              const p4 = transformPoint(currentCTM, rx, ry + rh);
              const isBorder = (Math.abs(rw - pageWidth) < 10 && Math.abs(rh - pageHeight) < 10);
              writer.addPolyline([p1, p2, p3, p4], true, isBorder ? 'SHEET_BORDER' : 'GEOMETRY');
            }
          }
        } else if (fn === OPS.stroke || fn === OPS.fill || fn === OPS.eoFill) {
          if (currentPath.length > 0) {
            let polyline = [];
            for (const seg of currentPath) {
              if (seg.op === 'move') {
                if (polyline.length > 1) {
                  writer.addPolyline(polyline, false, 'GEOMETRY');
                }
                polyline = [seg.pt];
              } else if (seg.op === 'line') {
                if (!polyline.length) polyline.push(seg.pt0);
                polyline.push(seg.pt1);
              } else if (seg.op === 'curve') {
                const curvedPts = flattenCubicBezier(seg.pt0, seg.cp1, seg.cp2, seg.endPt, 0.5);
                if (!polyline.length) polyline.push(curvedPts[0]);
                for (let k = 1; k < curvedPts.length; k++) {
                  polyline.push(curvedPts[k]);
                }
              } else if (seg.op === 'close') {
                if (polyline.length > 2) {
                  writer.addPolyline(polyline, true, 'GEOMETRY');
                  polyline = [];
                }
              }
            }
            if (polyline.length > 1) {
              writer.addPolyline(polyline, false, 'GEOMETRY');
            }
            currentPath = [];
          }
        }
      }
    } catch (e) {
      console.warn('PDF operator extraction error for DXF:', e);
    }

    return writer.generateString();
  }

  /**
   * DXFParser: Industrial Client-Side ASCII DXF Parser
   * Supports HEADER ($ACADVER, $INSUNITS, $EXTMIN/$EXTMAX), TABLES (LAYER colors, linetypes, visibility),
   * BLOCKS & INSERT (block instances with X/Y scale & rotation), LINE, LWPOLYLINE (with bulge arcs),
   * POLYLINE + VERTEX + SEQEND, CIRCLE, ARC, ELLIPSE, SPLINE, SOLID/TRACE, POINT, DIMENSION, TEXT & MTEXT.
   */
  class DXFParser {
    constructor(dxfContent) {
      this.content = dxfContent || '';
      this.entities = [];
      this.header = {};
      this.layers = {}; // layerName -> { name, color, linetype, visible, count }
      this.blocks = {}; // blockName -> { name, baseX, baseY, entities: [] }
      this.insunitsCode = 4; // Default mm
      this.unitName = 'mm';
      this.bounds = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity
      };
    }

    _updateBounds(x, y) {
      if (!isFinite(x) || !isFinite(y)) return;
      if (x < this.bounds.minX) this.bounds.minX = x;
      if (x > this.bounds.maxX) this.bounds.maxX = x;
      if (y < this.bounds.minY) this.bounds.minY = y;
      if (y > this.bounds.maxY) this.bounds.maxY = y;
    }

    _ensureLayer(name, color = 7, linetype = 'CONTINUOUS', visible = true) {
      const lyr = name || '0';
      if (!this.layers[lyr]) {
        this.layers[lyr] = {
          name: lyr,
          color: Math.abs(color || 7),
          linetype: linetype || 'CONTINUOUS',
          visible: color >= 0 && visible !== false,
          count: 0
        };
      }
      return this.layers[lyr];
    }

    _parseEntityRecord(entType, pairs, startIdx, endIdx, updateGlobalBounds = true) {
      const entData = {
        type: entType,
        layer: '0',
        color: null, // null means BYLAYER (256)
        trueColor: null,
        linetype: null,
        x: 0,
        y: 0,
        x2: 0,
        y2: 0,
        x3: 0,
        y3: 0,
        x4: 0,
        y4: 0,
        radiusOrHeight: 0,
        ratio: 1,
        startAngle: 0,
        endAngle: 360,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        flags: 0,
        text: '',
        blockName: ''
      };

      const lwVertices = []; // [{ x, y, bulge }]
      const splinePts = [];
      const splineFitPts = [];
      let curLwVtx = null;
      let curSplineX = null;
      let curSplineFitX = null;

      for (let j = startIdx; j < endIdx; j++) {
        const { code, val } = pairs[j];
        if (code === 8) entData.layer = val || '0';
        else if (code === 6) entData.linetype = val;
        else if (code === 62) entData.color = parseInt(val, 10);
        else if (code === 420) entData.trueColor = parseInt(val, 10);
        else if (code === 2 && (entType === 'INSERT' || entType === 'DIMENSION')) entData.blockName = val;
        else if (code === 10) {
          const num = parseFloat(val);
          if (entType === 'LWPOLYLINE') {
            if (curLwVtx) lwVertices.push(curLwVtx);
            curLwVtx = { x: num, y: 0, bulge: 0 };
          } else if (entType === 'SPLINE') {
            curSplineX = num;
          } else {
            entData.x = num;
          }
        } else if (code === 20) {
          const num = parseFloat(val);
          if (entType === 'LWPOLYLINE' && curLwVtx) {
            curLwVtx.y = num;
          } else if (entType === 'SPLINE' && curSplineX != null) {
            splinePts.push([curSplineX, num]);
            curSplineX = null;
          } else {
            entData.y = num;
          }
        } else if (code === 42 && entType === 'LWPOLYLINE' && curLwVtx) {
          curLwVtx.bulge = parseFloat(val) || 0;
        } else if (code === 11) {
          const num = parseFloat(val);
          if (entType === 'SPLINE') curSplineFitX = num;
          else entData.x2 = num;
        } else if (code === 21) {
          const num = parseFloat(val);
          if (entType === 'SPLINE' && curSplineFitX != null) {
            splineFitPts.push([curSplineFitX, num]);
            curSplineFitX = null;
          } else entData.y2 = num;
        }
        else if (code === 12) entData.x3 = parseFloat(val);
        else if (code === 22) entData.y3 = parseFloat(val);
        else if (code === 13) entData.x4 = parseFloat(val);
        else if (code === 23) entData.y4 = parseFloat(val);
        else if (code === 40) entData.radiusOrHeight = parseFloat(val);
        else if (code === 41) entData.scaleX = parseFloat(val) || 1;
        else if (code === 42 && entType === 'INSERT') entData.scaleY = parseFloat(val) || 1;
        else if (code === 50) {
          const ang = parseFloat(val) || 0;
          entData.startAngle = ang;
          entData.rotation = ang;
        } else if (code === 51) entData.endAngle = parseFloat(val) || 360;
        else if (code === 70) entData.flags = parseInt(val, 10) || 0;
        else if (code === 1 || code === 3) {
          entData.text = (entData.text ? entData.text + '' : '') + val;
        }
      }
      if (curLwVtx) lwVertices.push(curLwVtx);

      const bound = (x, y) => { if (updateGlobalBounds) this._updateBounds(x, y); };
      const lyrInfo = this._ensureLayer(entData.layer);
      if (updateGlobalBounds) lyrInfo.count++;

      if (entType === 'LINE') {
        if (!isNaN(entData.x) && !isNaN(entData.y) && !isNaN(entData.x2) && !isNaN(entData.y2)) {
          bound(entData.x, entData.y);
          bound(entData.x2, entData.y2);
          return {
            type: 'LINE',
            layer: entData.layer,
            color: entData.color,
            trueColor: entData.trueColor,
            linetype: entData.linetype,
            x1: entData.x,
            y1: entData.y,
            x2: entData.x2,
            y2: entData.y2
          };
        }
      } else if (entType === 'CIRCLE') {
        const r = entData.radiusOrHeight || 1;
        bound(entData.x - r, entData.y - r);
        bound(entData.x + r, entData.y + r);
        return {
          type: 'CIRCLE',
          layer: entData.layer,
          color: entData.color,
          trueColor: entData.trueColor,
          cx: entData.x,
          cy: entData.y,
          r
        };
      } else if (entType === 'ARC') {
        const r = entData.radiusOrHeight || 1;
        bound(entData.x - r, entData.y - r);
        bound(entData.x + r, entData.y + r);
        return {
          type: 'ARC',
          layer: entData.layer,
          color: entData.color,
          trueColor: entData.trueColor,
          cx: entData.x,
          cy: entData.y,
          r,
          startAngle: entData.startAngle || 0,
          endAngle: entData.endAngle || 360
        };
      } else if (entType === 'ELLIPSE') {
        const mx = entData.x2 || 10, my = entData.y2 || 0;
        const majorR = Math.hypot(mx, my) || 10;
        const minorR = majorR * (entData.radiusOrHeight || 0.5);
        const rot = Math.atan2(my, mx);
        bound(entData.x - majorR, entData.y - majorR);
        bound(entData.x + majorR, entData.y + majorR);
        return {
          type: 'ELLIPSE',
          layer: entData.layer,
          color: entData.color,
          trueColor: entData.trueColor,
          cx: entData.x,
          cy: entData.y,
          rx: majorR,
          ry: minorR,
          rotation: rot
        };
      } else if (entType === 'LWPOLYLINE' && lwVertices.length > 1) {
        const closed = (entData.flags & 1) === 1;
        const pts = [];
        for (let idx = 0; idx < lwVertices.length; idx++) {
          const v1 = lwVertices[idx];
          pts.push([v1.x, v1.y]);
          bound(v1.x, v1.y);
          if (v1.bulge && (idx < lwVertices.length - 1 || closed)) {
            const v2 = lwVertices[(idx + 1) % lwVertices.length];
            const arcPts = tessellateBulgeSegment([v1.x, v1.y], [v2.x, v2.y], v1.bulge);
            for (let k = 0; k < arcPts.length - 1; k++) {
              pts.push(arcPts[k]);
              bound(arcPts[k][0], arcPts[k][1]);
            }
          }
        }
        return {
          type: 'LWPOLYLINE',
          layer: entData.layer,
          color: entData.color,
          trueColor: entData.trueColor,
          closed,
          points: pts
        };
      } else if (entType === 'SPLINE' && (splinePts.length > 1 || splineFitPts.length > 1)) {
        const usePts = splinePts.length > 1 ? splinePts : splineFitPts;
        usePts.forEach(pt => bound(pt[0], pt[1]));
        return {
          type: 'LWPOLYLINE',
          layer: entData.layer,
          color: entData.color,
          trueColor: entData.trueColor,
          closed: (entData.flags & 1) === 1,
          points: usePts
        };
      } else if (entType === 'SOLID' || entType === 'TRACE') {
        const pts = [
          [entData.x, entData.y],
          [entData.x2, entData.y2],
          [entData.x4 || entData.x3, entData.y4 || entData.y3],
          [entData.x3, entData.y3]
        ];
        pts.forEach(pt => bound(pt[0], pt[1]));
        return {
          type: 'SOLID',
          layer: entData.layer,
          color: entData.color,
          trueColor: entData.trueColor,
          points: pts
        };
      } else if (entType === 'POINT') {
        bound(entData.x, entData.y);
        return {
          type: 'POINT',
          layer: entData.layer,
          color: entData.color,
          x: entData.x,
          y: entData.y
        };
      } else if (entType === 'INSERT' && entData.blockName) {
        bound(entData.x, entData.y);
        return {
          type: 'INSERT',
          layer: entData.layer,
          color: entData.color,
          blockName: entData.blockName,
          x: entData.x,
          y: entData.y,
          scaleX: entData.scaleX || 1,
          scaleY: entData.scaleY || 1,
          rotation: entData.rotation || 0
        };
      } else if (entType === 'DIMENSION') {
        bound(entData.x, entData.y);
        if (entData.x2 || entData.y2) bound(entData.x2, entData.y2);
        return {
          type: 'DIMENSION',
          layer: entData.layer,
          color: entData.color,
          blockName: entData.blockName,
          x1: entData.x,
          y1: entData.y,
          x2: entData.x2 || entData.x,
          y2: entData.y2 || entData.y,
          text: cleanDXFText(entData.text)
        };
      } else if (entType === 'TEXT' || entType === 'MTEXT' || entType === 'ATTRIB') {
        const cleaned = cleanDXFText(entData.text);
        if (!isNaN(entData.x) && !isNaN(entData.y) && cleaned) {
          bound(entData.x, entData.y);
          return {
            type: 'TEXT',
            layer: entData.layer,
            color: entData.color,
            trueColor: entData.trueColor,
            x: entData.x,
            y: entData.y,
            height: entData.radiusOrHeight || 10,
            rotation: entData.rotation || 0,
            text: cleaned
          };
        }
      }
      return null;
    }

    parse() {
      const raw = typeof this.content === 'string' ? this.content : String(this.content || '');
      const trimmed = raw.trim();
      if (!trimmed || /^AutoCAD Binary DXF/i.test(trimmed) || raw.includes('\x00')) {
        throw new Error('Invalid or binary DXF format. Please provide standard ASCII DXF.');
      }
      if (!/\b(SECTION|HEADER|TABLES|BLOCKS|ENTITIES|LINE|LWPOLYLINE|POLYLINE|CIRCLE|ARC|ELLIPSE|SPLINE|SOLID|TEXT|MTEXT|INSERT|DIMENSION|EOF)\b/i.test(trimmed)) {
        throw new Error('Invalid or binary DXF format. Please provide standard ASCII DXF.');
      }
      const lines = raw.split(/\r?\n/);
      const pairs = [];
      for (let i = 0; i < lines.length - 1; i += 2) {
        const code = parseInt(lines[i].trim(), 10);
        const val = lines[i + 1] != null ? lines[i + 1].trim() : '';
        if (!isNaN(code)) {
          pairs.push({ code, val });
        }
      }

      if (!pairs.length) {
        throw new Error('Invalid or binary DXF format. Please provide standard ASCII DXF.');
      }
      this._ensureLayer('0', 7, 'CONTINUOUS', true);

      let currentSection = null;
      let i = 0;

      while (i < pairs.length) {
        const p = pairs[i];
        if (p.code === 0 && p.val === 'SECTION') {
          i++;
          if (i < pairs.length && pairs[i].code === 2) {
            currentSection = pairs[i].val;
          }
          i++;
          continue;
        }

        if (p.code === 0 && p.val === 'ENDSEC') {
          currentSection = null;
          i++;
          continue;
        }

        if (currentSection === 'HEADER') {
          if (p.code === 9) {
            const varName = p.val;
            i++;
            if (i < pairs.length) {
              this.header[varName] = pairs[i].val;
              if (varName === '$INSUNITS') {
                this.insunitsCode = parseInt(pairs[i].val, 10) || 0;
                this.unitName = INSUNITS_CODE_MAP[this.insunitsCode] || 'mm';
              }
            }
          }
          i++;
        } else if (currentSection === 'TABLES') {
          if (p.code === 0 && p.val === 'LAYER') {
            i++;
            let lyrName = '0', lyrColor = 7, lyrLtype = 'CONTINUOUS', lyrFlags = 0;
            while (i < pairs.length && pairs[i].code !== 0) {
              if (pairs[i].code === 2) lyrName = pairs[i].val;
              else if (pairs[i].code === 62) lyrColor = parseInt(pairs[i].val, 10);
              else if (pairs[i].code === 6) lyrLtype = pairs[i].val;
              else if (pairs[i].code === 70) lyrFlags = parseInt(pairs[i].val, 10);
              i++;
            }
            const isVisible = lyrColor >= 0 && (lyrFlags & 1) === 0;
            this._ensureLayer(lyrName, Math.abs(lyrColor), lyrLtype, isVisible);
            continue;
          }
          i++;
        } else if (currentSection === 'BLOCKS') {
          if (p.code === 0 && p.val === 'BLOCK') {
            i++;
            let blkName = '', baseX = 0, baseY = 0;
            while (i < pairs.length && pairs[i].code !== 0) {
              if (pairs[i].code === 2 || pairs[i].code === 3) blkName = pairs[i].val || blkName;
              else if (pairs[i].code === 10) baseX = parseFloat(pairs[i].val) || 0;
              else if (pairs[i].code === 20) baseY = parseFloat(pairs[i].val) || 0;
              i++;
            }
            const blkEntities = [];
            while (i < pairs.length && !(pairs[i].code === 0 && pairs[i].val === 'ENDBLK')) {
              if (pairs[i].code === 0) {
                const eType = pairs[i].val;
                const start = ++i;
                while (i < pairs.length && pairs[i].code !== 0) i++;
                const ent = this._parseEntityRecord(eType, pairs, start, i, false);
                if (ent) blkEntities.push(ent);
              } else {
                i++;
              }
            }
            if (blkName) {
              this.blocks[blkName] = { name: blkName, baseX, baseY, entities: blkEntities };
            }
            continue;
          }
          i++;
        } else if (currentSection === 'ENTITIES') {
          if (p.code === 0) {
            const entType = p.val;
            if (entType === 'POLYLINE') {
              // Classic AutoCAD R12/R14 POLYLINE + VERTEX + SEQEND
              i++;
              let lyr = '0', col = null, flags = 0;
              while (i < pairs.length && pairs[i].code !== 0) {
                if (pairs[i].code === 8) lyr = pairs[i].val;
                else if (pairs[i].code === 62) col = parseInt(pairs[i].val, 10);
                else if (pairs[i].code === 70) flags = parseInt(pairs[i].val, 10) || 0;
                i++;
              }
              const vtxList = [];
              while (i < pairs.length && !(pairs[i].code === 0 && pairs[i].val === 'SEQEND')) {
                if (pairs[i].code === 0 && pairs[i].val === 'VERTEX') {
                  i++;
                  let vx = 0, vy = 0, vBulge = 0;
                  while (i < pairs.length && pairs[i].code !== 0) {
                    if (pairs[i].code === 10) vx = parseFloat(pairs[i].val) || 0;
                    else if (pairs[i].code === 20) vy = parseFloat(pairs[i].val) || 0;
                    else if (pairs[i].code === 42) vBulge = parseFloat(pairs[i].val) || 0;
                    i++;
                  }
                  vtxList.push({ x: vx, y: vy, bulge: vBulge });
                } else {
                  i++;
                }
              }
              if (i < pairs.length && pairs[i].val === 'SEQEND') i++;
              if (vtxList.length > 1) {
                const closed = (flags & 1) === 1;
                const pts = [];
                for (let idx = 0; idx < vtxList.length; idx++) {
                  const v1 = vtxList[idx];
                  pts.push([v1.x, v1.y]);
                  this._updateBounds(v1.x, v1.y);
                  if (v1.bulge && (idx < vtxList.length - 1 || closed)) {
                    const v2 = vtxList[(idx + 1) % vtxList.length];
                    const arcPts = tessellateBulgeSegment([v1.x, v1.y], [v2.x, v2.y], v1.bulge);
                    for (let k = 0; k < arcPts.length - 1; k++) {
                      pts.push(arcPts[k]);
                      this._updateBounds(arcPts[k][0], arcPts[k][1]);
                    }
                  }
                }
                const lyrInfo = this._ensureLayer(lyr);
                lyrInfo.count++;
                this.entities.push({
                  type: 'LWPOLYLINE',
                  layer: lyr,
                  color: col,
                  closed,
                  points: pts
                });
              }
              continue;
            }

            const start = ++i;
            while (i < pairs.length && pairs[i].code !== 0) i++;
            const parsedEnt = this._parseEntityRecord(entType, pairs, start, i, true);
            if (parsedEnt) {
              // If INSERT references a known block, transform its child entities to expand world bounds accurately
              if (parsedEnt.type === 'INSERT' && this.blocks[parsedEnt.blockName]) {
                const blk = this.blocks[parsedEnt.blockName];
                const rad = (parsedEnt.rotation || 0) * Math.PI / 180;
                const cosR = Math.cos(rad), sinR = Math.sin(rad);
                const sx = parsedEnt.scaleX || 1, sy = parsedEnt.scaleY || 1;
                const bx = blk.baseX || 0, by = blk.baseY || 0;
                const mapWorld = (lx, ly) => {
                  const dx = (lx - bx) * sx;
                  const dy = (ly - by) * sy;
                  return [
                    parsedEnt.x + dx * cosR - dy * sinR,
                    parsedEnt.y + dx * sinR + dy * cosR
                  ];
                };
                for (const be of blk.entities) {
                  if (be.type === 'LINE') {
                    const [wx1, wy1] = mapWorld(be.x1, be.y1);
                    const [wx2, wy2] = mapWorld(be.x2, be.y2);
                    this._updateBounds(wx1, wy1);
                    this._updateBounds(wx2, wy2);
                  } else if (be.type === 'CIRCLE' || be.type === 'ARC') {
                    const [wcx, wcy] = mapWorld(be.cx, be.cy);
                    const br = be.r * Math.max(Math.abs(sx), Math.abs(sy));
                    this._updateBounds(wcx - br, wcy - br);
                    this._updateBounds(wcx + br, wcy + br);
                  } else if ((be.type === 'LWPOLYLINE' || be.type === 'SOLID') && be.points) {
                    for (const pt of be.points) {
                      const [wx, wy] = mapWorld(pt[0], pt[1]);
                      this._updateBounds(wx, wy);
                    }
                  } else if (be.type === 'TEXT' || be.type === 'POINT') {
                    const [wx, wy] = mapWorld(be.x, be.y);
                    this._updateBounds(wx, wy);
                  }
                }
              }
              this.entities.push(parsedEnt);
            }
            continue;
          }
          i++;
        } else {
          i++;
        }
      }

      if (!isFinite(this.bounds.minX)) {
        this.bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      }
      return this;
    }

    /**
     * Summarize Layers & Entity Counts for the AutoCAD DXF Workbench
     */
    getLayerSummary() {
      return Object.values(this.layers).map(l => ({
        name: l.name,
        color: l.color,
        hexDark: ACI_PALETTE_DARK[l.color] || '#f8fafc',
        hexLight: ACI_PALETTE_LIGHT[l.color] || '#0f172a',
        linetype: l.linetype || 'CONTINUOUS',
        visible: l.visible !== false,
        count: l.count || 0
      }));
    }

    getEntitySummary() {
      const counts = { LINE: 0, LWPOLYLINE: 0, CIRCLE: 0, ARC: 0, ELLIPSE: 0, INSERT: 0, TEXT: 0, DIMENSION: 0, SOLID: 0, POINT: 0 };
      for (const e of this.entities) {
        counts[e.type] = (counts[e.type] || 0) + 1;
      }
      return counts;
    }

    /**
     * Resolve stroke/fill color for an entity based on TrueColor, explicit ACI, or Layer ACI
     * Automatically adapts ACI 7 (White/Black) to the canvas background!
     */
    _resolveColor(ent, isLightBg) {
      if (ent.trueColor != null && ent.trueColor > 0) {
        return '#' + (ent.trueColor & 0xFFFFFF).toString(16).padStart(6, '0');
      }
      const lyr = this.layers[ent.layer];
      const aci = (ent.color != null && ent.color !== 256 && ent.color !== 0)
        ? Math.abs(ent.color)
        : (lyr && lyr.color ? Math.abs(lyr.color) : 7);
      const pal = isLightBg ? ACI_PALETTE_LIGHT : ACI_PALETTE_DARK;
      return pal[aci] || (isLightBg ? '#0f172a' : '#f8fafc');
    }

    /**
     * Render parsed DXF entities to a 2D HTML Canvas
     */
    renderToCanvas(canvas, options = {}) {
      const ctx = canvas.getContext('2d');
      const bounds = options.sharedBounds || this.bounds;
      const bw = Math.max(1e-3, bounds.maxX - bounds.minX || 100);
      const bh = Math.max(1e-3, bounds.maxY - bounds.minY || 100);

      const padding = options.padding != null ? options.padding : 40;
      const targetW = Math.max(10, canvas.width - padding * 2);
      const targetH = Math.max(10, canvas.height - padding * 2);

      const scale = Math.min(targetW / bw, targetH / bh);
      const offsetX = padding + (targetW - bw * scale) / 2;
      const offsetY = padding + (targetH - bh * scale) / 2;

      const tx = x => offsetX + (x - bounds.minX) * scale;
      const ty = y => canvas.height - (offsetY + (y - bounds.minY) * scale);

      const bg = options.background || '#0c1017';
      const isLightBg = /^#?(fff|ffffff|f[0-9a-f]{5}|e[0-9a-f]{5})/i.test(bg.trim());

      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Optional calibrated CAD grid
      if (options.showGrid) {
        ctx.save();
        ctx.strokeStyle = isLightBg ? 'rgba(148, 163, 184, 0.22)' : 'rgba(56, 189, 248, 0.12)';
        ctx.lineWidth = 1;
        const gridStep = Math.max(40, Math.round(targetW / 16));
        ctx.beginPath();
        for (let gx = padding; gx <= canvas.width - padding; gx += gridStep) {
          ctx.moveTo(gx, padding); ctx.lineTo(gx, canvas.height - padding);
        }
        for (let gy = padding; gy <= canvas.height - padding; gy += gridStep) {
          ctx.moveTo(padding, gy); ctx.lineTo(canvas.width - padding, gy);
        }
        ctx.stroke();
        ctx.restore();
      }

      const baseLw = Math.max(1, options.lineWidth || 1.6);
      ctx.lineWidth = baseLw;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const hiddenLayers = options.hiddenLayers || new Set();

      const drawEntity = (ent, parentTransform = null) => {
        const lyrObj = this.layers[ent.layer];
        if (lyrObj && lyrObj.visible === false) return;
        if (hiddenLayers.has && hiddenLayers.has(ent.layer)) return;

        const mapPt = (x, y) => {
          if (!parentTransform) return [tx(x), ty(y)];
          const { bx, by, ix, iy, sx, sy, cosR, sinR } = parentTransform;
          const dx = (x - bx) * sx;
          const dy = (y - by) * sy;
          const wx = ix + dx * cosR - dy * sinR;
          const wy = iy + dx * sinR + dy * cosR;
          return [tx(wx), ty(wy)];
        };

        const col = this._resolveColor(ent, isLightBg);
        ctx.strokeStyle = col;
        ctx.fillStyle = col;

        // Linetype dash support
        const ltype = String(ent.linetype || (lyrObj && lyrObj.linetype) || 'CONTINUOUS').toUpperCase();
        if (ltype.includes('DASH') || ltype.includes('HIDDEN')) ctx.setLineDash([8, 5]);
        else if (ltype.includes('CENTER')) ctx.setLineDash([14, 4, 3, 4]);
        else if (ltype.includes('DOT') || ltype.includes('PHANTOM')) ctx.setLineDash([3, 4]);
        else ctx.setLineDash([]);

        if (ent.type === 'LINE') {
          const [x1, y1] = mapPt(ent.x1, ent.y1);
          const [x2, y2] = mapPt(ent.x2, ent.y2);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        } else if (ent.type === 'CIRCLE') {
          const [cx, cy] = mapPt(ent.cx, ent.cy);
          const rScale = parentTransform ? Math.abs(parentTransform.sx) : 1;
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(0.5, ent.r * scale * rScale), 0, Math.PI * 2);
          ctx.stroke();
        } else if (ent.type === 'ARC') {
          const [cx, cy] = mapPt(ent.cx, ent.cy);
          const rScale = parentTransform ? Math.abs(parentTransform.sx) : 1;
          const rotOff = parentTransform ? parentTransform.rotDeg : 0;
          const sRad = (360 - (ent.endAngle + rotOff)) * Math.PI / 180;
          const eRad = (360 - (ent.startAngle + rotOff)) * Math.PI / 180;
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(0.5, ent.r * scale * rScale), sRad, eRad);
          ctx.stroke();
        } else if (ent.type === 'ELLIPSE') {
          const [cx, cy] = mapPt(ent.cx, ent.cy);
          ctx.beginPath();
          ctx.ellipse(cx, cy, Math.max(1, ent.rx * scale), Math.max(1, ent.ry * scale), -ent.rotation, 0, Math.PI * 2);
          ctx.stroke();
        } else if (ent.type === 'LWPOLYLINE' && ent.points && ent.points.length > 1) {
          ctx.beginPath();
          const [p0x, p0y] = mapPt(ent.points[0][0], ent.points[0][1]);
          ctx.moveTo(p0x, p0y);
          for (let p = 1; p < ent.points.length; p++) {
            const [px, py] = mapPt(ent.points[p][0], ent.points[p][1]);
            ctx.lineTo(px, py);
          }
          if (ent.closed) ctx.closePath();
          ctx.stroke();
        } else if (ent.type === 'SOLID' && ent.points && ent.points.length >= 3) {
          ctx.save();
          ctx.globalAlpha = 0.35;
          ctx.beginPath();
          const [p0x, p0y] = mapPt(ent.points[0][0], ent.points[0][1]);
          ctx.moveTo(p0x, p0y);
          for (let p = 1; p < ent.points.length; p++) {
            const [px, py] = mapPt(ent.points[p][0], ent.points[p][1]);
            ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.stroke();
          ctx.restore();
        } else if (ent.type === 'POINT') {
          const [px, py] = mapPt(ent.x, ent.y);
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (ent.type === 'INSERT') {
          const blk = this.blocks[ent.blockName];
          if (blk && blk.entities) {
            const rad = (ent.rotation || 0) * Math.PI / 180;
            const tf = {
              bx: blk.baseX || 0,
              by: blk.baseY || 0,
              ix: ent.x,
              iy: ent.y,
              sx: ent.scaleX || 1,
              sy: ent.scaleY || 1,
              cosR: Math.cos(rad),
              sinR: Math.sin(rad),
              rotDeg: ent.rotation || 0
            };
            for (const subEnt of blk.entities) {
              drawEntity(subEnt, tf);
            }
          }
        } else if (ent.type === 'DIMENSION') {
          if (ent.blockName && this.blocks[ent.blockName]) {
            for (const subEnt of this.blocks[ent.blockName].entities) {
              drawEntity(subEnt, null);
            }
          } else {
            const [x1, y1] = mapPt(ent.x1, ent.y1);
            const [x2, y2] = mapPt(ent.x2, ent.y2);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            if (ent.text) {
              ctx.font = `bold ${Math.max(10, 11)}px Consolas, sans-serif`;
              ctx.fillText(ent.text, (x1 + x2) / 2, (y1 + y2) / 2 - 4);
            }
          }
        } else if (ent.type === 'TEXT') {
          const [px, py] = mapPt(ent.x, ent.y);
          const fontSize = Math.max(9, Math.min(48, (ent.height || 10) * scale));
          ctx.save();
          ctx.translate(px, py);
          if (ent.rotation) ctx.rotate(-ent.rotation * Math.PI / 180);
          ctx.font = `${fontSize}px "Segoe UI", Arial, sans-serif`;
          const lines = String(ent.text).split('\n');
          lines.forEach((ln, idx) => ctx.fillText(ln, 0, idx * fontSize * 1.15));
          ctx.restore();
        }
      };

      for (const ent of this.entities) {
        drawEntity(ent, null);
      }
      ctx.setLineDash([]);
    }
  }

  /**
   * Vector-Level DXF Entity Comparator (Compares two parsed DXF drawings at the CAD primitive level)
   */
  function compareDXFEntities(parsedA, parsedB, tol = 0.05) {
    const q = n => Math.round((Number(n) || 0) / Math.max(1e-5, tol)) * tol;
    const sigOf = e => {
      if (e.type === 'LINE') {
        const p1 = `${q(e.x1).toFixed(3)},${q(e.y1).toFixed(3)}`;
        const p2 = `${q(e.x2).toFixed(3)},${q(e.y2).toFixed(3)}`;
        return `LINE|${e.layer}|` + (p1 < p2 ? `${p1}->${p2}` : `${p2}->${p1}`);
      }
      if (e.type === 'CIRCLE') return `CIRCLE|${e.layer}|${q(e.cx).toFixed(3)},${q(e.cy).toFixed(3)}|R${q(e.r).toFixed(3)}`;
      if (e.type === 'ARC') return `ARC|${e.layer}|${q(e.cx).toFixed(3)},${q(e.cy).toFixed(3)}|R${q(e.r).toFixed(3)}|${q(e.startAngle).toFixed(1)}_${q(e.endAngle).toFixed(1)}`;
      if (e.type === 'ELLIPSE') return `ELLIPSE|${e.layer}|${q(e.cx).toFixed(3)},${q(e.cy).toFixed(3)}|${q(e.rx).toFixed(3)}x${q(e.ry).toFixed(3)}|${q(e.rotation).toFixed(2)}`;
      if (e.type === 'LWPOLYLINE') return `POLY|${e.layer}|${e.closed ? 'C' : 'O'}|` + (e.points || []).map(p => `${q(p[0]).toFixed(2)},${q(p[1]).toFixed(2)}`).join(';');
      if (e.type === 'SOLID') return `SOLID|${e.layer}|` + (e.points || []).map(p => `${q(p[0]).toFixed(2)},${q(p[1]).toFixed(2)}`).join(';');
      if (e.type === 'DIMENSION') return `DIM|${e.layer}|${q(e.x1).toFixed(2)},${q(e.y1).toFixed(2)}->${q(e.x2).toFixed(2)},${q(e.y2).toFixed(2)}|${e.text || ''}`;
      if (e.type === 'TEXT') return `TEXT|${e.layer}|${q(e.x).toFixed(2)},${q(e.y).toFixed(2)}|${e.text}`;
      if (e.type === 'INSERT') return `INSERT|${e.layer}|${e.blockName}|${q(e.x).toFixed(2)},${q(e.y).toFixed(2)}|${q(e.scaleX || 1).toFixed(2)}_${q(e.scaleY || 1).toFixed(2)}_${q(e.rotation || 0).toFixed(1)}`;
      return `${e.type}|${e.layer}|${q(e.x ?? e.x1 ?? e.cx ?? 0).toFixed(2)},${q(e.y ?? e.y1 ?? e.cy ?? 0).toFixed(2)}`;
    };

    const mapA = new Map();
    for (const e of (parsedA.entities || [])) {
      const s = sigOf(e);
      if (!mapA.has(s)) mapA.set(s, []);
      mapA.get(s).push(e);
    }
    const mapB = new Map();
    for (const e of (parsedB.entities || [])) {
      const s = sigOf(e);
      if (!mapB.has(s)) mapB.set(s, []);
      mapB.get(s).push(e);
    }

    const added = [];
    const removed = [];
    let unchangedCount = 0;

    for (const [sig, listA] of mapA.entries()) {
      const listB = mapB.get(sig) || [];
      const common = Math.min(listA.length, listB.length);
      unchangedCount += common;
      for (let k = common; k < listA.length; k++) removed.push(listA[k]);
    }
    for (const [sig, listB] of mapB.entries()) {
      const listA = mapA.get(sig) || [];
      const common = Math.min(listA.length, listB.length);
      for (let k = common; k < listB.length; k++) added.push(listB[k]);
    }

    return {
      added,
      removed,
      unchangedCount,
      totalA: (parsedA.entities || []).length,
      totalB: (parsedB.entities || []).length
    };
  }

  /**
   * Built-in Synthetic AutoCAD DXF Generator (Rev A vs Rev B Mechanical / PCB Enclosure Drawing)
   * Generates a multi-layer AutoCAD R2000 ASCII DXF with BLOCKS/INSERT, LWPOLYLINE with Bulge slots,
   * mounting holes, keepout zones, and engineering dimensions.
   */
  function generateSampleMechanicalDXF(isRevB = false, unit = 'mm') {
    const w = new DXFWriter({ unit, scale: 1.0 });
    // Note: DXFWriter scales by ptFactor, so to write exact mm coordinates we pass points = mm / ptFactor
    const f = 1 / w.scaleFactor;

    // 1. SHEET_BORDER & TITLE_BLOCK
    w.addRect(0 * f, 0 * f, 240 * f, 160 * f, 'SHEET_BORDER', ACI.CYAN);
    w.addRect(150 * f, 5 * f, 85 * f, 32 * f, 'TITLE_BLOCK', ACI.CYAN);
    w.addText('REDLINE STUDIO - CNC ENCLOSURE & PCB CARRIER', 154 * f, 28 * f, 3.2 * f, 0, 'TITLE_BLOCK', ACI.YELLOW);
    w.addText(isRevB ? 'REV: B (ECO-204: SLOT WIDENED & BOSS SHIFTED)' : 'REV: A (INITIAL PRODUCTION RELEASE)', 154 * f, 19 * f, 2.8 * f, 0, 'TITLE_BLOCK', isRevB ? ACI.RED : ACI.GREEN);
    w.addText(`UNITS: ${unit.toUpperCase()}  |  TOLERANCE: +/-0.05mm`, 154 * f, 10 * f, 2.5 * f, 0, 'TITLE_BLOCK', ACI.WHITE);

    // 2. BOARD_OUTLINE (160 x 100 mm enclosure profile at (25, 42))
    w.addRect(25 * f, 42 * f, 160 * f, 100 * f, 'BOARD_OUTLINE', ACI.WHITE);

    // 3. MOUNTING_HOLES (4 corner M4 mounting holes + center standoff boss)
    const holes = [
      [35, 52, 4.2],
      [175, 52, 4.2],
      [35, 132, 4.2],
      [175, 132, 4.2]
    ];
    for (const [hx, hy, dia] of holes) {
      w.addCircle(hx * f, hy * f, (dia / 2) * f, 'MOUNTING_HOLES', ACI.GREEN);
      w.addCircle(hx * f, hy * f, (dia * 0.95) * f, 'MOUNTING_HOLES', ACI.GRAY);
    }

    // Center Standoff Boss (Relocated in Rev B from X=95 to X=108, diameter changed 6mm -> 8mm!)
    const bossX = isRevB ? 108 : 95;
    const bossR = isRevB ? 4.0 : 3.0;
    w.addCircle(bossX * f, 92 * f, bossR * f, 'MOUNTING_HOLES', isRevB ? ACI.RED : ACI.GREEN);
    w.addLine((bossX - 6) * f, 92 * f, (bossX + 6) * f, 92 * f, 'CENTERLINES', ACI.CYAN);
    w.addLine(bossX * f, 86 * f, bossX * f, 98 * f, 'CENTERLINES', ACI.CYAN);

    // 4. CONNECTOR_CUTOUTS (USB-C / RJ45 / Ventilation Slots)
    const slotW = isRevB ? 34 : 26; // Widened in Rev B!
    w.addRect(48 * f, 62 * f, slotW * f, 14 * f, 'CONNECTOR_CUTOUTS', ACI.MAGENTA);
    w.addText(isRevB ? 'J1 CUTOUT (34x14mm REV B)' : 'J1 CUTOUT (26x14mm REV A)', 48 * f, 79 * f, 3.0 * f, 0, 'TEXT', ACI.YELLOW);

    // Ventilation array slots (Rev B adds an extra 5th cooling slot!)
    const slotCount = isRevB ? 5 : 4;
    for (let s = 0; s < slotCount; s++) {
      const sx = 125 + s * 10;
      w.addRect(sx * f, 60 * f, 5 * f, 35 * f, 'VENT_SLOTS', ACI.ORANGE);
    }

    // 5. DIMENSIONS & CALLOUTS
    w.addLine(25 * f, 32 * f, 185 * f, 32 * f, 'DIMENSIONS', ACI.YELLOW);
    w.addText('160.00 mm (6299.2 mil)', 92 * f, 34 * f, 3.2 * f, 0, 'DIMENSIONS', ACI.YELLOW);
    w.addText(isRevB ? 'STANDOFF X = 108.00 mm (ECO-204)' : 'STANDOFF X = 95.00 mm', (bossX - 14) * f, 102 * f, 3.0 * f, 0, 'DIMENSIONS', isRevB ? ACI.RED : ACI.YELLOW);

    return w.generateString();
  }

  return {
    UNITS,
    INSUNITS_CODE_MAP,
    PRESETS,
    ACI,
    ACI_PALETTE_DARK,
    ACI_PALETTE_LIGHT,
    DXFWriter,
    DXFParser,
    exportPDFToDXF,
    compareDXFEntities,
    generateSampleMechanicalDXF
  };
});
