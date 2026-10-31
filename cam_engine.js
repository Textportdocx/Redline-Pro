/**
 * Redline Pro — Industrial PCB CAM Engine (CAM350 Grade)
 * Supports Gerber RS-274X / RS-274D, Excellon NC Drill & Rout, IPC-D-356 / IPC-D-356A Netlists,
 * English (IPC Mils / Inches) & Metric (IPC MM / Microns) Unit Systems,
 * CAM350 Render Modes (Filled, Outline/Wireframe, Centerline/Skeleton, Translucent XOR),
 * Aperture (D-Code) & Drill (T-Code) Schedules, and IPC-2221 / IPC-6012 Class 1/2/3 DFM/DRC Checks.
 * Redline Studio · textportdocx.in
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CAMEngine = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Conversion Constants
  const MILS_TO_MM = 0.0254;
  const MM_TO_MILS = 1 / 0.0254;
  const INCH_TO_MM = 25.4;
  const MM_TO_INCH = 1 / 25.4;
  const INCH_TO_MILS = 1000;
  const MILS_TO_INCH = 0.001;
  const INCH_TO_PT = 72;
  const MM_TO_PT = 72 / 25.4;
  const MILS_TO_PT = 72 / 1000;

  /**
   * IPC English (Imperial: mils / in) & Metric (SI: mm / µm) Unit Converter
   */
  const UnitConverter = {
    toInches(val, fromUnit = 'IN') {
      const u = String(fromUnit || 'IN').toUpperCase();
      if (u === 'MM' || u === 'METRIC') return val / 25.4;
      if (u === 'MILS' || u === 'MIL' || u === 'THOU') return val / 1000;
      if (u === 'UM' || u === 'MICRON' || u === 'MICRONS') return val / 25400;
      return val; // IN / INCH
    },
    fromInches(inches, toUnit = 'MILS') {
      const u = String(toUnit || 'MILS').toUpperCase();
      if (u === 'MM' || u === 'METRIC') return inches * 25.4;
      if (u === 'MILS' || u === 'MIL' || u === 'ENGLISH') return inches * 1000;
      if (u === 'UM' || u === 'MICRON' || u === 'MICRONS') return inches * 25400;
      return inches; // IN / INCH
    },
    convert(val, fromUnit, toUnit) {
      return this.fromInches(this.toInches(val, fromUnit), toUnit);
    },
    format(inchesVal, system = 'english', precision = null) {
      const sys = String(system || 'english').toLowerCase();
      if (sys === 'metric' || sys === 'mm') {
        const mm = inchesVal * 25.4;
        const dec = precision != null ? precision : 3;
        return `${mm.toFixed(dec)} mm`;
      }
      if (sys === 'um' || sys === 'micron') {
        const um = inchesVal * 25400;
        return `${um.toFixed(1)} µm`;
      }
      if (sys === 'in' || sys === 'inch') {
        const dec = precision != null ? precision : 4;
        return `${inchesVal.toFixed(dec)} in`;
      }
      // Default IPC English = mils
      const mils = inchesVal * 1000;
      const dec = precision != null ? precision : 2;
      return `${mils.toFixed(dec)} mil`;
    },
    formatDual(inchesVal, primarySystem = 'english') {
      const mils = (inchesVal * 1000).toFixed(2);
      const mm = (inchesVal * 25.4).toFixed(3);
      return String(primarySystem).toLowerCase() === 'metric'
        ? `${mm} mm (${mils} mil)`
        : `${mils} mil (${mm} mm)`;
    }
  };

  /**
   * IPC-2221 / IPC-6012 DFM / DRC Class Presets (Values stored in mils, auto-convertible to mm)
   */
  const IPC_DFM_RULES = {
    class1: {
      id: 'class1',
      name: 'IPC Class 1 — General Electronic Products',
      minClearanceMils: 6.0,
      minTraceWidthMils: 6.0,
      minAnnularRingMils: 4.0,
      minDrillDiaMils: 12.0,
      minSolderMaskDamMils: 4.0,
      compareTolMils: 0.5
    },
    class2: {
      id: 'class2',
      name: 'IPC Class 2 — Dedicated Service / Industrial (Standard)',
      minClearanceMils: 4.0,
      minTraceWidthMils: 4.0,
      minAnnularRingMils: 3.5,
      minDrillDiaMils: 8.0,
      minSolderMaskDamMils: 3.0,
      compareTolMils: 0.25
    },
    class3: {
      id: 'class3',
      name: 'IPC Class 3 — High Reliability / Aerospace / Medical',
      minClearanceMils: 3.0,
      minTraceWidthMils: 3.0,
      minAnnularRingMils: 2.0,
      minDrillDiaMils: 6.0,
      minSolderMaskDamMils: 2.5,
      compareTolMils: 0.15
    },
    hdi: {
      id: 'hdi',
      name: 'IPC HDI — Fine-Pitch / Microvia Interconnect',
      minClearanceMils: 2.0,
      minTraceWidthMils: 2.0,
      minAnnularRingMils: 1.5,
      minDrillDiaMils: 4.0,
      minSolderMaskDamMils: 2.0,
      compareTolMils: 0.1
    }
  };

  // PCB Color Palettes (CAM350 & Industrial Themes)
  const PCB_THEMES = {
    standard: {
      substrate: '#0a2312', // Dark Green soldermask
      trace: '#c87533',     // Copper
      pad: '#facc15',       // Gold ENIG pads
      region: '#a35822',    // Copper pour polygon
      hole: '#050a06',      // Through-hole drill
      slot: '#020617',      // Routed slot
      silkscreen: '#f8fafc',// White silk
      netHighlight: '#38bdf8'
    },
    cam350Dark: {
      substrate: '#06080c', // CAM350 classic black background
      trace: '#ef4444',     // CAM350 Layer 1 Red
      pad: '#22c55e',       // CAM350 Flash Green
      region: '#b91c1c',
      hole: '#eab308',      // CAM350 Drill Yellow
      slot: '#f97316',
      silkscreen: '#f8fafc',
      netHighlight: '#00ffff'
    },
    blueCAD: {
      substrate: '#08182b',
      trace: '#38bdf8',
      pad: '#f59e0b',
      region: '#0284c7',
      hole: '#020617',
      slot: '#020617',
      silkscreen: '#ffffff',
      netHighlight: '#4ade80'
    },
    matteBlack: {
      substrate: '#121214',
      trace: '#b45309',
      pad: '#fbbf24',
      region: '#92400e',
      hole: '#000000',
      slot: '#000000',
      silkscreen: '#e2e8f0',
      netHighlight: '#38bdf8'
    }
  };

  /**
   * Auto-detect PCB Layer Type from filename or content (CAM350 Layer Table style)
   */
  function detectLayerType(filename = '', content = '') {
    const f = String(filename || '').toLowerCase();
    if (/\.(ipc|d356|net)$/i.test(f) || /^P\s+JOB|^P\s+UNITS|^[123]\d7\s/m.test(content)) {
      return { code: 'IPC', name: 'IPC-D-356 Netlist', category: 'netlist', side: 'both', color: '#38bdf8' };
    }
    if (/\.(drl|xln|ncd)$/i.test(f) || (/M48|T0*\d+C[0-9.]+/i.test(content) && !/%FS/i.test(content))) {
      return { code: 'DRL', name: 'NC Drill / Rout (Excellon)', category: 'drill', side: 'both', color: '#eab308' };
    }
    if (/\.gtl$|top.*cop|f[._-]?cu|l1\b/i.test(f)) {
      return { code: 'GTL', name: 'Top Copper (Signal)', category: 'copper', side: 'top', color: '#ef4444' };
    }
    if (/\.gbl$|bot.*cop|b[._-]?cu/i.test(f)) {
      return { code: 'GBL', name: 'Bottom Copper (Signal)', category: 'copper', side: 'bottom', color: '#3b82f6' };
    }
    if (/\.g[1-8]$|in.*cu|inner|gnd.*plane|pwr.*plane/i.test(f)) {
      return { code: 'GIN', name: 'Inner Copper / Plane', category: 'copper', side: 'inner', color: '#a855f7' };
    }
    if (/\.gts$|top.*mask|f[._-]?mask/i.test(f)) {
      return { code: 'GTS', name: 'Top Soldermask', category: 'mask', side: 'top', color: '#10b981' };
    }
    if (/\.gbs$|bot.*mask|b[._-]?mask/i.test(f)) {
      return { code: 'GBS', name: 'Bottom Soldermask', category: 'mask', side: 'bottom', color: '#059669' };
    }
    if (/\.gto$|top.*silk|f[._-]?silk/i.test(f)) {
      return { code: 'GTO', name: 'Top Silkscreen (Legend)', category: 'silk', side: 'top', color: '#f8fafc' };
    }
    if (/\.gbo$|bot.*silk|b[._-]?silk/i.test(f)) {
      return { code: 'GBO', name: 'Bottom Silkscreen (Legend)', category: 'silk', side: 'bottom', color: '#cbd5e1' };
    }
    if (/\.gtp$|top.*paste|f[._-]?paste/i.test(f)) {
      return { code: 'GTP', name: 'Top Solder Paste', category: 'paste', side: 'top', color: '#94a3b8' };
    }
    if (/\.gbp$|bot.*paste|b[._-]?paste/i.test(f)) {
      return { code: 'GBP', name: 'Bottom Solder Paste', category: 'paste', side: 'bottom', color: '#64748b' };
    }
    if (/\.gko$|\.gm[1-9]$|outline|edge[._-]?cuts|board/i.test(f)) {
      return { code: 'GKO', name: 'Board Outline / Mechanical', category: 'mech', side: 'both', color: '#f59e0b' };
    }
    return { code: 'GBR', name: 'Gerber CAM Layer', category: 'copper', side: 'top', color: '#c87533' };
  }

  /**
   * Gerber RS-274X / RS-274D Parser (CAM350 compatible)
   */
  class GerberParser {
    constructor(content, options = {}) {
      this.raw = content || '';
      this.options = options || {};
      this.units = options.units ? String(options.units).toUpperCase() : 'IN'; // 'IN' or 'MM'
      this.format = {
        zeroSuppression: options.zeroSuppression || 'L', // 'L' (Leading), 'T' (Trailing), 'D' (Direct/Decimal)
        coordType: options.coordType || 'A',             // 'A' (Absolute), 'I' (Incremental)
        xInt: options.xInt != null ? +options.xInt : 2,
        xDec: options.xDec != null ? +options.xDec : 4,
        yInt: options.yInt != null ? +options.yInt : 2,
        yDec: options.yDec != null ? +options.yDec : 4
      };
      this.apertures = new Map(); // D-code -> { type, params, flashes, draws }
      this.macros = new Map();    // Macro name -> definition string
      this.commands = [];         // Parsed drawing commands (DRAW, FLASH, REGION)
      this.layerPolarity = 'DARK';
      this.bounds = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity
      };
    }

    _parseCoordinate(str, intDigits, decDigits, suppression) {
      if (!str) return 0;
      const isNegative = str.startsWith('-');
      const cleanStr = str.replace(/[+-]/g, '');

      if (cleanStr.includes('.') || suppression === 'D') {
        return parseFloat(str);
      }

      const totalDigits = intDigits + decDigits;
      let padded = cleanStr;

      if (suppression === 'L') {
        while (padded.length < totalDigits) {
          padded = '0' + padded;
        }
      } else if (suppression === 'T') {
        while (padded.length < totalDigits) {
          padded = padded + '0';
        }
      }

      const splitPos = Math.max(0, padded.length - decDigits);
      const intPart = padded.slice(0, splitPos) || '0';
      const decPart = padded.slice(splitPos);
      const val = parseFloat(`${intPart}.${decPart}`);
      return isNegative ? -val : val;
    }

    _updateBounds(x, y, radius = 0) {
      if (!isFinite(x) || !isFinite(y)) return;
      if (x - radius < this.bounds.minX) this.bounds.minX = x - radius;
      if (x + radius > this.bounds.maxX) this.bounds.maxX = x + radius;
      if (y - radius < this.bounds.minY) this.bounds.minY = y - radius;
      if (y + radius > this.bounds.maxY) this.bounds.maxY = y + radius;
    }

    parse() {
      const text = typeof this.raw === 'string' ? this.raw : String(this.raw || '');
      if (!this.options.allowEmpty) {
        const trimmed = text.trim();
        if (!trimmed || text.includes('\x00') || /^%PDF-|^PK\x03\x04|^\x89PNG|^AutoCAD Binary DXF/i.test(trimmed)) {
          throw new Error('Invalid or corrupt Gerber RS-274X format. Please provide a valid RS-274X or RS-274D layer.');
        }
        const hasValidTokens = /%(FS|MO|ADD|AM|LP|TF|TA|TD|IN|IP|IR|LN|SR|OF)/i.test(trimmed) ||
          /(?:G0*[01234]|G36|G37|G54|G70|G71|G74|G75|G90|G91|D0*[123]|D[1-9]\d+|[XYIJ][+-]?\d+|M0*[012])\s*\*/i.test(trimmed);
        if (!hasValidTokens) {
          throw new Error('Invalid or corrupt Gerber RS-274X format. Please provide a valid RS-274X or RS-274D layer.');
        }
      }
      let pos = 0;
      const len = text.length;
      let prevPos = -1;
      let loopGuard = 0;
      const maxLoops = Math.max(250000, len + 100);

      let currentAperture = null;
      let currentX = 0;
      let currentY = 0;
      let lastOpCode = '1';             // Modal operation code ('1'=D01 Draw, '2'=D02 Move, '3'=D03 Flash)
      let currentInterpolation = 'G01'; // G01 linear, G02 cw, G03 ccw
      let currentPolarity = 'DARK';      // DARK or CLEAR
      let quadrantMode = 'MULTI';       // MULTI (G75) or SINGLE (G74)
      let inRegion = false;             // G36 / G37 polygon copper pour
      let currentRegionPts = [];

      const flushRegion = () => {
        if (currentRegionPts.length >= 3) {
          for (const pt of currentRegionPts) this._updateBounds(pt.x, pt.y, 0);
          this.commands.push({
            op: 'REGION',
            polarity: currentPolarity,
            points: [...currentRegionPts]
          });
        }
        currentRegionPts = [];
      };

      while (pos < len) {
        if (++loopGuard > maxLoops) {
          throw new Error('Corrupt Gerber coordinate stream: exceeded maximum parser iterations.');
        }
        if (pos <= prevPos) pos = prevPos + 1;
        prevPos = pos;
        while (pos < len && /\s/.test(text[pos])) pos++;
        if (pos >= len) break;

        // Extended RS-274X command enclosed in % ... %
        if (text[pos] === '%') {
          pos++;
          let endPct = text.indexOf('%', pos);
          if (endPct === -1) endPct = len;
          const extBlock = text.slice(pos, endPct);
          pos = endPct + 1;

          const extCmds = extBlock.split('*').map(s => s.trim()).filter(Boolean);
          for (const cmd of extCmds) {
            if (cmd.startsWith('FS')) {
              const m = /FS([LTD])?([AI])?.*X(\d)(\d)Y(\d)(\d)/.exec(cmd);
              if (m && !this.options.forceFormat) {
                if (m[1]) this.format.zeroSuppression = m[1];
                if (m[2]) this.format.coordType = m[2];
                this.format.xInt = parseInt(m[3], 10);
                this.format.xDec = parseInt(m[4], 10);
                this.format.yInt = parseInt(m[5], 10);
                this.format.yDec = parseInt(m[6], 10);
              }
            } else if (cmd.startsWith('MO')) {
              if (!this.options.forceUnits) {
                if (cmd.includes('MM')) this.units = 'MM';
                else if (cmd.includes('IN')) this.units = 'IN';
              }
            } else if (cmd.startsWith('AM')) {
              const name = cmd.slice(2).split(',')[0].trim();
              this.macros.set(name, cmd);
            } else if (cmd.startsWith('ADD')) {
              const m = /ADD(\d+)([a-zA-Z0-9_$-]+)(?:,(.*))?/.exec(cmd);
              if (m) {
                const code = parseInt(m[1], 10);
                const rawType = m[2].toUpperCase();
                const type = ['C', 'R', 'O', 'P'].includes(rawType) ? rawType : 'C';
                const params = m[3] ? m[3].split('X').map(parseFloat).filter(n => !isNaN(n)) : [0.01];
                this.apertures.set(code, {
                  code,
                  type,
                  macroName: ['C', 'R', 'O', 'P'].includes(rawType) ? null : rawType,
                  params: params.length ? params : [0.01],
                  flashes: 0,
                  draws: 0
                });
              }
            } else if (cmd.startsWith('LP')) {
              currentPolarity = cmd.includes('C') ? 'CLEAR' : 'DARK';
              this.layerPolarity = currentPolarity;
            }
          }
          continue;
        }

        let nextStar = text.indexOf('*', pos);
        if (nextStar === -1) nextStar = len;
        const stmt = text.slice(pos, nextStar).trim();
        pos = nextStar + 1;

        if (!stmt || stmt.startsWith('G04') || /^M0?[012]\b/.test(stmt)) continue;

        // Legacy & standard G-codes for units / coordinates
        if (!this.options.forceUnits) {
          if (/\bG70\b/.test(stmt)) this.units = 'IN';
          else if (/\bG71\b/.test(stmt)) this.units = 'MM';
        }
        if (!this.options.forceFormat) {
          if (/\bG90\b/.test(stmt)) this.format.coordType = 'A';
          else if (/\bG91\b/.test(stmt)) this.format.coordType = 'I';
        }

        // Region mode G36 / G37
        if (stmt.includes('G36')) {
          inRegion = true;
          currentRegionPts = [];
          if (stmt === 'G36') continue;
        }
        if (stmt.includes('G37')) {
          flushRegion();
          inRegion = false;
          if (stmt === 'G37') continue;
        }

        // Interpolation G01 / G02 / G03
        if (/G0*1(?!\d)/.test(stmt)) currentInterpolation = 'G01';
        else if (/G0*2(?!\d)/.test(stmt)) currentInterpolation = 'G02';
        else if (/G0*3(?!\d)/.test(stmt)) currentInterpolation = 'G03';
        if (stmt.includes('G74')) quadrantMode = 'SINGLE';
        else if (stmt.includes('G75')) quadrantMode = 'MULTI';

        // D-code aperture selection (D10 - D999, including legacy G54D10* and inline G54D10X... syntax)
        const dSel = /D0*([1-9]\d+)(?!\d)/.exec(stmt);
        if (dSel && parseInt(dSel[1], 10) >= 10) {
          currentAperture = parseInt(dSel[1], 10);
          if (!this.apertures.has(currentAperture)) {
            this.apertures.set(currentAperture, {
              code: currentAperture,
              type: 'C',
              params: [this.units === 'MM' ? 0.254 : 0.01],
              flashes: 0,
              draws: 0
            });
          }
        }

        // Parse coordinates X... Y... I... J...
        let xVal = currentX;
        let yVal = currentY;
        let iVal = 0;
        let jVal = 0;
        let hasCoord = false;

        const xMatch = /X([+-]?[\d.]+)/.exec(stmt);
        if (xMatch) {
          const parsedX = this._parseCoordinate(xMatch[1], this.format.xInt, this.format.xDec, this.format.zeroSuppression);
          xVal = this.format.coordType === 'I' ? currentX + parsedX : parsedX;
          hasCoord = true;
        }
        const yMatch = /Y([+-]?[\d.]+)/.exec(stmt);
        if (yMatch) {
          const parsedY = this._parseCoordinate(yMatch[1], this.format.yInt, this.format.yDec, this.format.zeroSuppression);
          yVal = this.format.coordType === 'I' ? currentY + parsedY : parsedY;
          hasCoord = true;
        }
        const iMatch = /I([+-]?[\d.]+)/.exec(stmt);
        if (iMatch) {
          iVal = this._parseCoordinate(iMatch[1], this.format.xInt, this.format.xDec, this.format.zeroSuppression);
        }
        const jMatch = /J([+-]?[\d.]+)/.exec(stmt);
        if (jMatch) {
          jVal = this._parseCoordinate(jMatch[1], this.format.yInt, this.format.yDec, this.format.zeroSuppression);
        }

        const opMatch = /D0?([123])(?!\d)/.exec(stmt);
        if (opMatch) lastOpCode = opMatch[1];
        const opCode = opMatch ? opMatch[1] : (hasCoord ? lastOpCode : null);

        if (inRegion) {
          if (opCode === '2') {
            if (currentRegionPts.length >= 3) flushRegion();
            currentRegionPts = [{ x: xVal, y: yVal }];
          } else if (opCode === '1') {
            if (!currentRegionPts.length) currentRegionPts.push({ x: currentX, y: currentY });
            currentRegionPts.push({ x: xVal, y: yVal });
          }
          currentX = xVal;
          currentY = yVal;
          continue;
        }

        const ap = this.apertures.get(currentAperture) || { code: currentAperture || 10, type: 'C', params: [0.01], flashes: 0, draws: 0 };
        const apSize = ap.params[0] || 0.01;

        if (opCode === '1') {
          this._updateBounds(xVal, yVal, apSize / 2);
          this._updateBounds(currentX, currentY, apSize / 2);
          if (ap.draws != null) ap.draws++;

          this.commands.push({
            op: 'DRAW',
            mode: currentInterpolation,
            quadrant: quadrantMode,
            aperture: currentAperture,
            apertureDef: ap,
            polarity: currentPolarity,
            x1: currentX,
            y1: currentY,
            x2: xVal,
            y2: yVal,
            i: iVal,
            j: jVal
          });
          currentX = xVal;
          currentY = yVal;
        } else if (opCode === '2') {
          currentX = xVal;
          currentY = yVal;
        } else if (opCode === '3') {
          this._updateBounds(xVal, yVal, Math.max(ap.params[0] || 0.02, ap.params[1] || 0.02) / 2);
          if (ap.flashes != null) ap.flashes++;

          this.commands.push({
            op: 'FLASH',
            aperture: currentAperture,
            apertureDef: ap,
            polarity: currentPolarity,
            x: xVal,
            y: yVal
          });
          currentX = xVal;
          currentY = yVal;
        }
      }

      if (inRegion) flushRegion();

      if (!isFinite(this.bounds.minX)) {
        this.bounds = { minX: 0, minY: 0, maxX: 1, maxY: 1 };
      }
      return this;
    }

    toInches(val) {
      return this.units === 'MM' ? val / 25.4 : val;
    }

    toMils(val) {
      return this.toInches(val) * 1000;
    }

    toMM(val) {
      return this.units === 'MM' ? val : val * 25.4;
    }

    /**
     * Returns CAM350-style Aperture Table (D-Codes) with both English (mils/in) and Metric (mm) dimensions
     */
    getApertureTable() {
      const rows = [];
      for (const [code, ap] of this.apertures.entries()) {
        const p0In = this.toInches(ap.params[0] || 0);
        const p1In = ap.params[1] != null ? this.toInches(ap.params[1]) : p0In;
        const shapeNames = { C: 'Circle', R: 'Rectangle', O: 'Obround', P: 'Polygon' };
        rows.push({
          dCode: `D${code}`,
          code,
          type: ap.type,
          shape: ap.macroName ? `Macro (${ap.macroName})` : (shapeNames[ap.type] || ap.type),
          widthMils: +(p0In * 1000).toFixed(2),
          heightMils: +(p1In * 1000).toFixed(2),
          widthIn: +p0In.toFixed(4),
          heightIn: +p1In.toFixed(4),
          widthMM: +(p0In * 25.4).toFixed(3),
          heightMM: +(p1In * 25.4).toFixed(3),
          flashes: ap.flashes || 0,
          draws: ap.draws || 0
        });
      }
      return rows.sort((a, b) => a.code - b.code);
    }
  }

  /**
   * Excellon NC Drill & Rout Parser (CAM350 compatible)
   */
  class ExcellonParser {
    constructor(content, options = {}) {
      this.raw = content || '';
      this.options = options || {};
      this.units = options.units ? (String(options.units).toUpperCase().startsWith('M') ? 'METRIC' : 'INCH') : 'INCH';
      this.zeroSuppression = options.zeroSuppression || 'L'; // 'L' or 'T'
      this.intDigits = options.intDigits || 2;
      this.decDigits = options.decDigits || 4;
      this.tools = new Map(); // Tool ID -> diameter
      this.toolMeta = new Map(); // Tool ID -> { diameter, plated, hits, slots }
      this.hits = [];  // List of { tool, diameter, x, y }
      this.slots = []; // List of { tool, diameter, x1, y1, x2, y2 }
      this.bounds = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity
      };
    }

    _parseExcellonNumber(str, isMetric) {
      if (!str) return 0;
      if (str.includes('.')) return parseFloat(str);
      const isNeg = str.startsWith('-');
      const clean = str.replace(/[+-]/g, '');
      const intD = this.options.intDigits || (isMetric ? 3 : 2);
      const decD = this.options.decDigits || (isMetric ? 3 : 4);
      const total = intD + decD;
      let padded = clean;
      if (this.zeroSuppression === 'T') {
        while (padded.length < total) padded += '0';
      } else {
        while (padded.length < total) padded = '0' + padded;
      }
      const splitPos = Math.max(0, padded.length - decD);
      const val = parseFloat(`${padded.slice(0, splitPos) || '0'}.${padded.slice(splitPos)}`);
      return isNeg ? -val : val;
    }

    parse() {
      const lines = this.raw.split(/\r?\n/);
      let currentTool = null;
      let isMetric = this.units === 'METRIC';
      let isIncremental = this.options.coordType === 'I';
      let lastX = 0;
      let lastY = 0;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Parse format hints in comments like ;FILE_FORMAT=2:4 or ;TYPE=PLATED
        if (trimmed.startsWith(';')) {
          const fmtMatch = /FILE_FORMAT\s*=\s*(\d+)\s*:\s*(\d+)/i.exec(trimmed);
          if (fmtMatch && !this.options.forceFormat) {
            this.intDigits = parseInt(fmtMatch[1], 10);
            this.decDigits = parseInt(fmtMatch[2], 10);
          }
          continue;
        }

        if (trimmed === 'M48' || trimmed === '%' || trimmed === 'M95' || trimmed === 'M30' || trimmed === 'M00') {
          continue;
        }

        // Units & Zero Suppression header
        if (!this.options.forceUnits) {
          if (trimmed.includes('INCH') || trimmed === 'M72') {
            this.units = 'INCH';
            isMetric = false;
            if (trimmed.includes('TZ')) this.zeroSuppression = 'T';
            else if (trimmed.includes('LZ')) this.zeroSuppression = 'L';
          } else if (trimmed.includes('METRIC') || trimmed === 'M71') {
            this.units = 'METRIC';
            isMetric = true;
            if (trimmed.includes('TZ')) this.zeroSuppression = 'T';
            else if (trimmed.includes('LZ')) this.zeroSuppression = 'L';
          }
        }
        if (!this.options.forceFormat) {
          if (/^ICI\s*,\s*ON/i.test(trimmed) || trimmed === 'G91') { isIncremental = true; continue; }
          if (/^ICI\s*,\s*OFF/i.test(trimmed) || trimmed === 'G90') { isIncremental = false; continue; }
        }

        // Tool Definition: T01C0.032 or T01F00S00C0.032
        const tDef = /^T0*(\d+)(?:F[\d.]+)?(?:S[\d.]+)?C([0-9.]+)/i.exec(trimmed);
        if (tDef) {
          const tId = parseInt(tDef[1], 10);
          const dia = parseFloat(tDef[2]);
          this.tools.set(tId, dia);
          this.toolMeta.set(tId, { id: tId, diameter: dia, hits: 0, slots: 0 });
          continue;
        }

        // Tool Selection: T01 or T1 (standalone or inline prefix)
        const tSel = /^T0*(\d+)(?![0-9]*C)/i.exec(trimmed);
        if (tSel) {
          currentTool = parseInt(tSel[1], 10);
          if (!this.tools.has(currentTool)) {
            const defDia = isMetric ? 0.8 : 0.032;
            this.tools.set(currentTool, defDia);
            this.toolMeta.set(currentTool, { id: currentTool, diameter: defDia, hits: 0, slots: 0 });
          }
          if (/^T0*\d+$/i.test(trimmed)) continue;
        }

        // Routed Slot: X...Y...G85X...Y...
        if (trimmed.includes('G85')) {
          const parts = trimmed.split('G85');
          const m1X = /X([+-]?[0-9.]+)/.exec(parts[0]);
          const m1Y = /Y([+-]?[0-9.]+)/.exec(parts[0]);
          const m2X = /X([+-]?[0-9.]+)/.exec(parts[1]);
          const m2Y = /Y([+-]?[0-9.]+)/.exec(parts[1]);
          const x1 = m1X ? this._parseExcellonNumber(m1X[1], isMetric) : lastX;
          const y1 = m1Y ? this._parseExcellonNumber(m1Y[1], isMetric) : lastY;
          const x2 = m2X ? this._parseExcellonNumber(m2X[1], isMetric) : x1;
          const y2 = m2Y ? this._parseExcellonNumber(m2Y[1], isMetric) : y1;
          const dia = this.tools.get(currentTool) || (isMetric ? 0.8 : 0.032);
          const rad = dia / 2;

          this.bounds.minX = Math.min(this.bounds.minX, x1 - rad, x2 - rad);
          this.bounds.maxX = Math.max(this.bounds.maxX, x1 + rad, x2 + rad);
          this.bounds.minY = Math.min(this.bounds.minY, y1 - rad, y2 - rad);
          this.bounds.maxY = Math.max(this.bounds.maxY, y1 + rad, y2 + rad);

          this.slots.push({ tool: currentTool, diameter: dia, x1, y1, x2, y2 });
          const meta = this.toolMeta.get(currentTool);
          if (meta) meta.slots++;
          lastX = x2;
          lastY = y2;
          continue;
        }

        // Standard Drill Hit: X...Y... (including optional leading G00/G01/G05 or Txx)
        if (/^(?:T0*\d+|G0*[015])?\s*[XY][+-]?[0-9.]+/i.test(trimmed)) {
          const xMatch = /X([+-]?[0-9.]+)/.exec(trimmed);
          const yMatch = /Y([+-]?[0-9.]+)/.exec(trimmed);
          const parsedX = xMatch ? this._parseExcellonNumber(xMatch[1], isMetric) : 0;
          const parsedY = yMatch ? this._parseExcellonNumber(yMatch[1], isMetric) : 0;
          const x = xMatch ? (isIncremental ? lastX + parsedX : parsedX) : lastX;
          const y = yMatch ? (isIncremental ? lastY + parsedY : parsedY) : lastY;
          lastX = x;
          lastY = y;

          const dia = this.tools.get(currentTool) || (isMetric ? 0.8 : 0.032);
          const rad = dia / 2;

          if (x - rad < this.bounds.minX) this.bounds.minX = x - rad;
          if (x + rad > this.bounds.maxX) this.bounds.maxX = x + rad;
          if (y - rad < this.bounds.minY) this.bounds.minY = y - rad;
          if (y + rad > this.bounds.maxY) this.bounds.maxY = y + rad;

          this.hits.push({
            tool: currentTool,
            diameter: dia,
            x,
            y
          });
          const meta = this.toolMeta.get(currentTool);
          if (meta) meta.hits++;
        }
      }

      if (!isFinite(this.bounds.minX)) {
        this.bounds = { minX: 0, minY: 0, maxX: 1, maxY: 1 };
      }
      return this;
    }

    toInches(val) {
      return this.units === 'METRIC' ? val / 25.4 : val;
    }

    /**
     * Returns CAM350-style NC Drill Tool Table (T-Codes) with English (mils/in) & Metric (mm)
     */
    getToolTable() {
      const rows = [];
      for (const [id, dia] of this.tools.entries()) {
        const diaIn = this.toInches(dia);
        const hitsForTool = this.hits.filter(h => h.tool === id);
        let travelIn = 0;
        for (let i = 1; i < hitsForTool.length; i++) {
          const dx = this.toInches(hitsForTool[i].x - hitsForTool[i - 1].x);
          const dy = this.toInches(hitsForTool[i].y - hitsForTool[i - 1].y);
          travelIn += Math.hypot(dx, dy);
        }
        const meta = this.toolMeta.get(id) || { hits: hitsForTool.length, slots: 0 };
        rows.push({
          tCode: `T${String(id).padStart(2, '0')}`,
          id,
          diaMils: +(diaIn * 1000).toFixed(2),
          diaIn: +diaIn.toFixed(4),
          diaMM: +(diaIn * 25.4).toFixed(3),
          hits: meta.hits,
          slots: meta.slots,
          travelIn: +travelIn.toFixed(2),
          travelMM: +(travelIn * 25.4).toFixed(1)
        });
      }
      return rows.sort((a, b) => a.id - b.id);
    }
  }

  /**
   * IPC-D-356 / IPC-D-356A Bare-Board Test Netlist Parser & Comparator
   * Supports CUST 0 (English Mils), CUST 1 (Metric MM), CUST 2 (English Inches)
   */
  class IPCD356Parser {
    constructor(content, options = {}) {
      this.raw = content || '';
      this.options = options || {};
      this.units = 'MILS'; // 'MILS', 'MM', or 'IN'
      this.custCode = 0;   // 0 = English (mils), 1 = Metric (mm), 2 = English (inches)
      this.records = [];   // List of { type, net, refDes, pin, midPoint, holeDiaIn, plated, access, xIn, yIn, rectWIn, rectHIn }
      this.nets = new Map(); // netName -> array of records
      this.bounds = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity
      };
    }

    parse() {
      const lines = this.raw.split(/\r?\n/);

      for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (!line || line.startsWith('C ') || line.startsWith('999')) continue;

        // Parameter Header (e.g. "P  UNITS CUST 0" or "P  UNITS CUST 1")
        if (line.startsWith('P ')) {
          if (/UNITS\s+CUST\s*1|UNITS\s+MM|METRIC/i.test(line)) {
            this.custCode = 1;
            this.units = 'MM';
          } else if (/UNITS\s+CUST\s*2|UNITS\s+IN/i.test(line)) {
            this.custCode = 2;
            this.units = 'IN';
          } else if (/UNITS\s+CUST\s*0|UNITS\s+MIL|ENGLISH/i.test(line)) {
            this.custCode = 0;
            this.units = 'MILS';
          }
          continue;
        }

        if (this.options.forceUnits) {
          this.units = String(this.options.forceUnits).toUpperCase();
        }

        // Test Record: starts with 3-digit operation code (317 = thru-hole, 327 = SMT, 307 = blind/buried, 367 = tooling)
        const opMatch = /^([0-9]{3})\s/.exec(line);
        if (!opMatch) continue;

        const opCode = opMatch[1];
        const netName = (line.slice(3, 17).trim()) || 'N/C';
        const compField = line.slice(20, 32).trim();
        let refDes = compField, pin = '';
        if (compField.includes('-')) {
          const [r, p] = compField.split('-');
          refDes = r.trim();
          pin = (p || '').trim();
        }
        const midPoint = line[31] === 'M';

        // Extract fields from remainder of record (columns 32+)
        const tail = line.slice(32);
        const holeMatch = /([DU])(\d+)/.exec(tail);
        const accessMatch = /A(\d\d)/.exec(tail);
        const coordMatch = /X([+-]?\d+)Y([+-]?\d+)/.exec(tail);

        // IPC-D-356 coordinate scaling:
        // CUST 0 (Mils): X/Y coords are in 0.1 mil (1/10000 inch), hole/pad sizes in 0.1 mil or 1 mil
        // CUST 1 (Metric): X/Y coords are in microns (0.001 mm), hole/pad sizes in microns (0.001 mm)
        const toInchesCoord = rawNum => {
          const v = parseFloat(rawNum);
          if (String(rawNum).includes('.')) {
            return this.units === 'MM' ? v / 25.4 : (this.units === 'MILS' ? v / 1000 : v);
          }
          if (this.units === 'MM') {
            // Standard IPC-D-356 Metric: integer in microns (0.001 mm)
            return (v / 1000) / 25.4;
          }
          // Standard IPC-D-356 English (CUST 0): integer in 0.1 mils (0.0001 inch)
          return v / 10000;
        };

        let xIn = 0, yIn = 0;
        if (coordMatch) {
          xIn = toInchesCoord(coordMatch[1]);
          yIn = toInchesCoord(coordMatch[2]);
        }

        let holeDiaIn = 0;
        let plated = true;
        if (holeMatch) {
          plated = holeMatch[1] === 'D';
          holeDiaIn = toInchesCoord(holeMatch[2]);
        }

        let rectWIn = 0.04, rectHIn = 0.04;
        const rectMatches = [...tail.matchAll(/X(\d+)Y(\d+)/g)];
        if (rectMatches.length >= 1) {
          const rm = rectMatches[rectMatches.length - 1];
          if (!coordMatch || rm.index !== coordMatch.index) {
            rectWIn = toInchesCoord(rm[1]);
            rectHIn = toInchesCoord(rm[2]);
          }
        }

        const padRad = Math.max(holeDiaIn, rectWIn, rectHIn, 0.02) / 2;
        if (xIn - padRad < this.bounds.minX) this.bounds.minX = xIn - padRad;
        if (xIn + padRad > this.bounds.maxX) this.bounds.maxX = xIn + padRad;
        if (yIn - padRad < this.bounds.minY) this.bounds.minY = yIn - padRad;
        if (yIn + padRad > this.bounds.maxY) this.bounds.maxY = yIn + padRad;

        const rec = {
          opCode,
          type: opCode === '317' ? 'THRU' : (opCode === '327' ? 'SMT' : (opCode === '307' ? 'VIA' : 'TOOL')),
          net: netName,
          refDes,
          pin,
          midPoint,
          plated,
          holeDiaIn,
          access: accessMatch ? `A${accessMatch[1]}` : 'A00',
          xIn,
          yIn,
          rectWIn,
          rectHIn
        };
        this.records.push(rec);
        if (!this.nets.has(netName)) this.nets.set(netName, []);
        this.nets.get(netName).push(rec);
      }

      if (!isFinite(this.bounds.minX)) {
        this.bounds = { minX: 0, minY: 0, maxX: 1, maxY: 1 };
      }
      return this;
    }

    getNetTable() {
      const rows = [];
      for (const [net, recs] of this.nets.entries()) {
        const smtCount = recs.filter(r => r.type === 'SMT').length;
        const thruCount = recs.filter(r => r.type === 'THRU').length;
        const viaCount = recs.filter(r => r.midPoint || r.type === 'VIA').length;
        rows.push({
          net,
          totalNodes: recs.length,
          pins: recs.filter(r => r.refDes && r.refDes !== 'VIA').map(r => r.pin ? `${r.refDes}-${r.pin}` : r.refDes).join(', '),
          smtCount,
          thruCount,
          viaCount
        });
      }
      return rows.sort((a, b) => b.totalNodes - a.totalNodes || a.net.localeCompare(b.net));
    }

    static compareNetlists(ipcA, ipcB, toleranceMils = 2.0) {
      const tolIn = toleranceMils / 1000;
      const diffs = [];
      const allNets = new Set([...ipcA.nets.keys(), ...ipcB.nets.keys()]);

      for (const net of allNets) {
        const recsA = ipcA.nets.get(net) || [];
        const recsB = ipcB.nets.get(net) || [];
        if (!recsA.length) {
          diffs.push({ type: 'ADDED_NET', net, countB: recsB.length, xIn: recsB[0].xIn, yIn: recsB[0].yIn, desc: `Net "${net}" added in Rev B (${recsB.length} nodes)` });
          continue;
        }
        if (!recsB.length) {
          diffs.push({ type: 'REMOVED_NET', net, countA: recsA.length, xIn: recsA[0].xIn, yIn: recsA[0].yIn, desc: `Net "${net}" removed in Rev B (had ${recsA.length} nodes)` });
          continue;
        }

        // Check for missing or added testpoints/pins within the net
        for (const rA of recsA) {
          const matchB = recsB.find(rB => Math.hypot(rA.xIn - rB.xIn, rA.yIn - rB.yIn) <= tolIn);
          if (!matchB) {
            const movedPin = rA.refDes && rA.pin ? recsB.find(rB => rB.refDes === rA.refDes && rB.pin === rA.pin) : null;
            if (movedPin) {
              const distMils = Math.hypot(movedPin.xIn - rA.xIn, movedPin.yIn - rA.yIn) * 1000;
              diffs.push({
                type: 'MOVED_NODE',
                net,
                node: `${rA.refDes}-${rA.pin}`,
                xIn: movedPin.xIn,
                yIn: movedPin.yIn,
                deltaMils: +distMils.toFixed(2),
                desc: `Net "${net}" pin ${rA.refDes}-${rA.pin} moved by ${distMils.toFixed(1)} mil (${(distMils * 0.0254).toFixed(3)} mm)`
              });
            } else {
              diffs.push({
                type: 'REMOVED_NODE',
                net,
                node: rA.refDes ? `${rA.refDes}-${rA.pin}` : 'Testpoint',
                xIn: rA.xIn,
                yIn: rA.yIn,
                desc: `Net "${net}" node ${rA.refDes ? rA.refDes + '-' + rA.pin : ''} missing at (${(rA.xIn * 1000).toFixed(1)}, ${(rA.yIn * 1000).toFixed(1)}) mil`
              });
            }
          }
        }

        for (const rB of recsB) {
          const matchA = recsA.find(rA => Math.hypot(rA.xIn - rB.xIn, rA.yIn - rB.yIn) <= tolIn);
          if (!matchA) {
            const wasMoved = rB.refDes && rB.pin && recsA.some(rA => rA.refDes === rB.refDes && rA.pin === rB.pin);
            if (!wasMoved) {
              diffs.push({
                type: 'ADDED_NODE',
                net,
                node: rB.refDes ? `${rB.refDes}-${rB.pin}` : 'Testpoint',
                xIn: rB.xIn,
                yIn: rB.yIn,
                desc: `Net "${net}" added node ${rB.refDes ? rB.refDes + '-' + rB.pin : ''} at (${(rB.xIn * 1000).toFixed(1)}, ${(rB.yIn * 1000).toFixed(1)}) mil`
              });
            }
          }
        }
      }

      // Check for Net Shorts (same physical coordinate assigned to different nets in A vs B)
      for (const rB of ipcB.records) {
        if (rB.net === 'N/C') continue;
        const conflictA = ipcA.records.find(rA => rA.net !== 'N/C' && rA.net !== rB.net && Math.hypot(rA.xIn - rB.xIn, rA.yIn - rB.yIn) <= tolIn);
        if (conflictA) {
          diffs.push({
            type: 'NET_CHANGE',
            net: rB.net,
            xIn: rB.xIn,
            yIn: rB.yIn,
            desc: `Net reassignment / potential short at (${(rB.xIn * 1000).toFixed(1)}, ${(rB.yIn * 1000).toFixed(1)}) mil: "${conflictA.net}" → "${rB.net}"`
          });
        }
      }

      return diffs;
    }
  }

  /**
   * PCBRenderer: Renders Gerber RS-274X layers, Excellon Drill/Slot files, and IPC-D-356 Netlists
   * Supports CAM350 Render Modes: 'fill' (Solid), 'outline' (Wireframe), 'skeleton' (Centerline)
   */
  class PCBRenderer {
    constructor(canvas, theme = 'standard') {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { willReadFrequently: true });
      this.theme = PCB_THEMES[theme] || PCB_THEMES.standard;
      this.lastTransform = null;
    }

    render(gerberParsed, drillParsed = null, options = {}) {
      const ctx = this.ctx;
      const cv = this.canvas;
      const renderMode = options.renderMode || 'fill'; // 'fill' | 'outline' | 'skeleton'
      const mirrorX = !!options.mirrorX;
      const invertPolarity = !!options.invertPolarity;
      const ipcParsed = options.ipcParsed || null;
      const highlightNet = options.highlightNet || null;

      // Normalize bounds into Gerber's native units (or Inches if forced)
      let minX = gerberParsed && isFinite(gerberParsed.bounds.minX) ? gerberParsed.bounds.minX : Infinity;
      let maxX = gerberParsed && isFinite(gerberParsed.bounds.maxX) ? gerberParsed.bounds.maxX : -Infinity;
      let minY = gerberParsed && isFinite(gerberParsed.bounds.minY) ? gerberParsed.bounds.minY : Infinity;
      let maxY = gerberParsed && isFinite(gerberParsed.bounds.maxY) ? gerberParsed.bounds.maxY : -Infinity;

      const gUnit = (gerberParsed && gerberParsed.units) || 'IN';
      const toGerberUnits = (valInInches) => (gUnit === 'MM' ? valInInches * 25.4 : valInInches);

      if (options.sharedBoundsInches) {
        minX = toGerberUnits(options.sharedBoundsInches.minX);
        maxX = toGerberUnits(options.sharedBoundsInches.maxX);
        minY = toGerberUnits(options.sharedBoundsInches.minY);
        maxY = toGerberUnits(options.sharedBoundsInches.maxY);
      } else {
        if (drillParsed && isFinite(drillParsed.bounds.minX)) {
          const dScale = (drillParsed.units === 'METRIC' ? (gUnit === 'MM' ? 1.0 : 1 / 25.4) : (gUnit === 'MM' ? 25.4 : 1.0));
          minX = Math.min(minX, drillParsed.bounds.minX * dScale);
          maxX = Math.max(maxX, drillParsed.bounds.maxX * dScale);
          minY = Math.min(minY, drillParsed.bounds.minY * dScale);
          maxY = Math.max(maxY, drillParsed.bounds.maxY * dScale);
        }
        if (ipcParsed && isFinite(ipcParsed.bounds.minX)) {
          minX = Math.min(minX, toGerberUnits(ipcParsed.bounds.minX));
          maxX = Math.max(maxX, toGerberUnits(ipcParsed.bounds.maxX));
          minY = Math.min(minY, toGerberUnits(ipcParsed.bounds.minY));
          maxY = Math.max(maxY, toGerberUnits(ipcParsed.bounds.maxY));
        }
      }

      if (!isFinite(minX)) {
        minX = 0; maxX = 1; minY = 0; maxY = 1;
      }

      const bw = maxX - minX || 1.0;
      const bh = maxY - minY || 1.0;

      const padding = options.padding != null ? options.padding : 30;
      const targetW = cv.width - padding * 2;
      const targetH = cv.height - padding * 2;

      const scale = Math.min(targetW / bw, targetH / bh);
      const offsetX = padding + (targetW - bw * scale) / 2;
      const offsetY = padding + (targetH - bh * scale) / 2;

      const tx = x => {
        const normX = mirrorX ? (maxX - (x - minX)) : x;
        return offsetX + (normX - minX) * scale;
      };
      const ty = y => cv.height - (offsetY + (y - minY) * scale);

      this.lastTransform = { minX, maxX, minY, maxY, scale, offsetX, offsetY, gUnit, mirrorX, tx, ty };

      // Background substrate
      if (!options.transparentBg) {
        ctx.fillStyle = invertPolarity ? this.theme.trace : this.theme.substrate;
        ctx.fillRect(0, 0, cv.width, cv.height);
      }

      // Optional CAM350 Origin Crosshair & Board Extents Box
      if (options.showOrigin) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(tx(minX), ty(maxY), bw * scale, bh * scale);
        ctx.restore();
      }

      // Draw Gerber Regions, Traces, Arcs, and Flashes
      if (gerberParsed && gerberParsed.commands) {
        for (const cmd of gerberParsed.commands) {
          const isClear = (cmd.polarity === 'CLEAR') !== invertPolarity;
          const traceColor = isClear ? this.theme.substrate : (options.overrideColor || this.theme.trace);
          const padColor = isClear ? this.theme.substrate : (options.overrideColor || this.theme.pad);
          const regionColor = isClear ? this.theme.substrate : (options.overrideColor || this.theme.region || this.theme.trace);

          if (cmd.op === 'REGION' && cmd.points && cmd.points.length >= 3) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(tx(cmd.points[0].x), ty(cmd.points[0].y));
            for (let i = 1; i < cmd.points.length; i++) {
              ctx.lineTo(tx(cmd.points[i].x), ty(cmd.points[i].y));
            }
            ctx.closePath();
            if (renderMode === 'outline' || renderMode === 'skeleton') {
              ctx.strokeStyle = regionColor;
              ctx.lineWidth = 1.5;
              ctx.stroke();
            } else {
              ctx.fillStyle = regionColor;
              ctx.fill();
            }
            ctx.restore();
          } else if (cmd.op === 'DRAW') {
            const ap = cmd.apertureDef;
            const dia = (ap && ap.params && ap.params[0]) ? ap.params[0] : 0.01;
            const fullWidth = Math.max(1, dia * scale);

            ctx.save();
            ctx.strokeStyle = traceColor;
            ctx.lineCap = (ap && ap.type === 'R') ? 'square' : 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = renderMode === 'skeleton' ? 1.2 : (renderMode === 'outline' ? 1.5 : fullWidth);

            ctx.beginPath();
            if ((cmd.mode === 'G02' || cmd.mode === 'G03') && (cmd.i || cmd.j)) {
              const cx = cmd.x1 + cmd.i;
              const cy = cmd.y1 + cmd.j;
              const rad = Math.hypot(cmd.i, cmd.j) * scale;
              const startAng = Math.atan2(ty(cmd.y1) - ty(cy), tx(cmd.x1) - tx(cx));
              const endAng = Math.atan2(ty(cmd.y2) - ty(cy), tx(cmd.x2) - tx(cx));
              // Canvas Y is inverted, so G02 (CW in Gerber) is CW in screen space unless mirrored
              const anticlockwise = (cmd.mode === 'G03') !== mirrorX;
              ctx.arc(tx(cx), ty(cy), Math.max(1, rad), startAng, endAng, anticlockwise);
            } else {
              ctx.moveTo(tx(cmd.x1), ty(cmd.y1));
              ctx.lineTo(tx(cmd.x2), ty(cmd.y2));
            }
            ctx.stroke();
            ctx.restore();
          } else if (cmd.op === 'FLASH') {
            const ap = cmd.apertureDef;
            const p = (ap && ap.params) ? ap.params : [0.05, 0.05];

            ctx.save();
            ctx.fillStyle = padColor;
            ctx.strokeStyle = padColor;
            ctx.lineWidth = 1.5;

            const drawOrFill = () => {
              if (renderMode === 'outline') ctx.stroke();
              else if (renderMode === 'skeleton') {
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(tx(cmd.x) - 3, ty(cmd.y));
                ctx.lineTo(tx(cmd.x) + 3, ty(cmd.y));
                ctx.moveTo(tx(cmd.x), ty(cmd.y) - 3);
                ctx.lineTo(tx(cmd.x), ty(cmd.y) + 3);
                ctx.stroke();
              } else {
                ctx.fill();
              }
            };

            if (!ap || ap.type === 'C') {
              const rad = Math.max(1.5, (p[0] / 2) * scale);
              ctx.beginPath();
              ctx.arc(tx(cmd.x), ty(cmd.y), rad, 0, Math.PI * 2);
              drawOrFill();
            } else if (ap.type === 'R') {
              const w = Math.max(2, p[0] * scale);
              const h = Math.max(2, (p[1] != null ? p[1] : p[0]) * scale);
              ctx.beginPath();
              ctx.rect(tx(cmd.x) - w / 2, ty(cmd.y) - h / 2, w, h);
              drawOrFill();
            } else if (ap.type === 'O') {
              const w = Math.max(2, p[0] * scale);
              const h = Math.max(2, (p[1] != null ? p[1] : p[0]) * scale);
              const r = Math.min(w, h) / 2;
              ctx.beginPath();
              if (ctx.roundRect) {
                ctx.roundRect(tx(cmd.x) - w / 2, ty(cmd.y) - h / 2, w, h, r);
              } else {
                ctx.rect(tx(cmd.x) - w / 2, ty(cmd.y) - h / 2, w, h);
              }
              drawOrFill();
            } else if (ap.type === 'P') {
              const rad = Math.max(1.5, (p[0] / 2) * scale);
              const nSides = parseInt(p[1], 10) || 6;
              ctx.beginPath();
              for (let s = 0; s < nSides; s++) {
                const ang = (s * 2 * Math.PI) / nSides;
                const px = tx(cmd.x) + rad * Math.cos(ang);
                const py = ty(cmd.y) + rad * Math.sin(ang);
                if (s === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
              }
              ctx.closePath();
              drawOrFill();
            }
            ctx.restore();
          }
        }
      }

      // Draw Excellon Drill Holes & Routed Slots
      if (drillParsed) {
        const dScale = (drillParsed.units === 'METRIC' ? (gUnit === 'MM' ? 1.0 : 1 / 25.4) : (gUnit === 'MM' ? 25.4 : 1.0));
        ctx.save();

        // Routed Slots
        if (drillParsed.slots && drillParsed.slots.length) {
          for (const slot of drillParsed.slots) {
            const x1 = tx(slot.x1 * dScale), y1 = ty(slot.y1 * dScale);
            const x2 = tx(slot.x2 * dScale), y2 = ty(slot.y2 * dScale);
            const w = Math.max(2, slot.diameter * dScale * scale);
            ctx.strokeStyle = renderMode === 'fill' ? (this.theme.slot || this.theme.hole) : '#eab308';
            ctx.lineWidth = renderMode === 'skeleton' ? 1.5 : w;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
        }

        // Drill Hits
        if (drillParsed.hits && drillParsed.hits.length) {
          for (const hit of drillParsed.hits) {
            const x = tx(hit.x * dScale);
            const y = ty(hit.y * dScale);
            const rad = Math.max(1.5, (hit.diameter / 2) * dScale * scale);

            ctx.beginPath();
            ctx.arc(x, y, rad, 0, Math.PI * 2);
            if (renderMode === 'outline' || renderMode === 'skeleton') {
              ctx.strokeStyle = '#eab308';
              ctx.lineWidth = 1.5;
              ctx.stroke();
              // CAM350 Drill Target X Cross
              ctx.beginPath();
              ctx.moveTo(x - rad * 0.7, y - rad * 0.7);
              ctx.lineTo(x + rad * 0.7, y + rad * 0.7);
              ctx.moveTo(x + rad * 0.7, y - rad * 0.7);
              ctx.lineTo(x - rad * 0.7, y + rad * 0.7);
              ctx.stroke();
            } else {
              ctx.fillStyle = this.theme.hole;
              ctx.fill();
              if (options.showDrillRings) {
                ctx.strokeStyle = 'rgba(234, 179, 8, 0.75)';
                ctx.lineWidth = 1;
                ctx.stroke();
              }
            }
          }
        }
        ctx.restore();
      }

      // Draw IPC-D-356 Netlist Testpoints & Highlighted Net
      if (ipcParsed && ipcParsed.records && ipcParsed.records.length) {
        ctx.save();
        for (const rec of ipcParsed.records) {
          const isHighlighted = highlightNet && rec.net === highlightNet;
          const x = tx(toGerberUnits(rec.xIn));
          const y = ty(toGerberUnits(rec.yIn));
          const rad = Math.max(3, (toGerberUnits(Math.max(rec.holeDiaIn, rec.rectWIn, 0.025)) / 2) * scale);

          if (isHighlighted || !gerberParsed || !gerberParsed.commands.length) {
            ctx.strokeStyle = isHighlighted ? '#38bdf8' : 'rgba(56, 189, 248, 0.75)';
            ctx.fillStyle = isHighlighted ? 'rgba(56, 189, 248, 0.35)' : 'rgba(56, 189, 248, 0.15)';
            ctx.lineWidth = isHighlighted ? 2.5 : 1.2;
            ctx.beginPath();
            ctx.arc(x, y, rad, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            if (isHighlighted || options.showNetLabels) {
              ctx.fillStyle = '#f8fafc';
              ctx.font = 'bold 10px Consolas, monospace';
              ctx.fillText(`${rec.net}${rec.refDes ? ' (' + rec.refDes + '-' + rec.pin + ')' : ''}`, x + rad + 3, y + 3);
            }
          }
        }
        ctx.restore();
      }
    }
  }

  /**
   * CAMCompare: Performs CAM350-style Gerber vs. Gerber, Drill vs. Drill, and IPC Class 1/2/3 DFM/DRC checking.
   * Automatically reconciles English (IN/MILS) vs Metric (MM) layers into a shared physical coordinate frame!
   */
  class CAMCompare {
    constructor(width = 1200, height = 900) {
      this.width = width;
      this.height = height;
    }

    /**
     * Run geometric IPC-2221 / IPC-6012 DFM checks on a parsed Gerber + Drill pair
     */
    runDFMChecks(gerberParsed, drillParsed = null, rules = IPC_DFM_RULES.class2) {
      const violations = [];
      if (!gerberParsed) return violations;

      const minTraceMils = rules.minTraceWidthMils || 4.0;
      const minRingMils = rules.minAnnularRingMils || 3.5;
      const minDrillMils = rules.minDrillDiaMils || 8.0;

      // 1. Check Minimum Trace Width on all DRAW apertures
      for (const cmd of gerberParsed.commands) {
        if (cmd.op === 'DRAW' && cmd.polarity !== 'CLEAR') {
          const ap = cmd.apertureDef;
          const diaMils = gerberParsed.toMils((ap && ap.params && ap.params[0]) || 0.01);
          if (diaMils < minTraceMils - 0.05) {
            violations.push({
              category: 'MIN_TRACE_WIDTH',
              severity: 'Warning',
              measuredMils: +diaMils.toFixed(2),
              ruleMils: minTraceMils,
              xIn: gerberParsed.toInches((cmd.x1 + cmd.x2) / 2),
              yIn: gerberParsed.toInches((cmd.y1 + cmd.y2) / 2),
              description: `Trace width ${diaMils.toFixed(2)} mil (${(diaMils * 0.0254).toFixed(3)} mm) < ${minTraceMils.toFixed(1)} mil minimum (D${cmd.aperture || 10})`
            });
          }
        }
      }

      // 2. Check Acute Angle Acid Traps (< 75 degrees between connected trace segments)
      const draws = gerberParsed.commands.filter(c => c.op === 'DRAW' && c.mode === 'G01');
      for (let i = 0; i < draws.length - 1; i++) {
        const s1 = draws[i], s2 = draws[i + 1];
        if (Math.abs(s1.x2 - s2.x1) < 1e-4 && Math.abs(s1.y2 - s2.y1) < 1e-4) {
          const v1x = s1.x1 - s1.x2, v1y = s1.y1 - s1.y2;
          const v2x = s2.x2 - s2.x1, v2y = s2.y2 - s2.y1;
          const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
          if (l1 > 0 && l2 > 0) {
            const cosAng = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (l1 * l2)));
            const angDeg = Math.acos(cosAng) * 180 / Math.PI;
            if (angDeg > 5 && angDeg < 75) {
              violations.push({
                category: 'ACID_TRAP',
                severity: 'Warning',
                measuredDeg: +angDeg.toFixed(1),
                xIn: gerberParsed.toInches(s1.x2),
                yIn: gerberParsed.toInches(s1.y2),
                description: `Acute trace corner (${angDeg.toFixed(1)}° < 75°) creates copper acid trap risk`
              });
            }
          }
        }
      }

      // 3. Check Drill-to-Pad Annular Ring & Minimum Drill Size & Coincident Drill Hits
      if (drillParsed && drillParsed.hits && drillParsed.hits.length) {
        const flashes = gerberParsed.commands.filter(c => c.op === 'FLASH');
        for (let idx = 0; idx < drillParsed.hits.length; idx++) {
          const hit = drillParsed.hits[idx];
          const hxIn = drillParsed.toInches(hit.x);
          const hyIn = drillParsed.toInches(hit.y);
          const hDiaMils = drillParsed.toInches(hit.diameter) * 1000;

          if (hDiaMils < minDrillMils - 0.05) {
            violations.push({
              category: 'MIN_DRILL_SIZE',
              severity: 'Warning',
              measuredMils: +hDiaMils.toFixed(2),
              ruleMils: minDrillMils,
              xIn: hxIn,
              yIn: hyIn,
              description: `Drill hole T${hit.tool} (${hDiaMils.toFixed(1)} mil / ${(hDiaMils * 0.0254).toFixed(3)} mm) < ${minDrillMils.toFixed(1)} mil minimum`
            });
          }

          // Check coincident / redundant drill hits
          for (let j = idx + 1; j < drillParsed.hits.length; j++) {
            const h2 = drillParsed.hits[j];
            const distMils = Math.hypot(hxIn - drillParsed.toInches(h2.x), hyIn - drillParsed.toInches(h2.y)) * 1000;
            if (distMils < 1.0) {
              violations.push({
                category: 'COINCIDENT_DRILL',
                severity: 'Error',
                measuredMils: +distMils.toFixed(2),
                xIn: hxIn,
                yIn: hyIn,
                description: `Coincident/overlapping drill hits (T${hit.tool} & T${h2.tool}) at (${(hxIn * 1000).toFixed(1)}, ${(hyIn * 1000).toFixed(1)}) mil`
              });
            }
          }

          // Find closest enclosing flash pad to verify annular ring
          let bestPad = null;
          let bestDistIn = Infinity;
          for (const fl of flashes) {
            const fxIn = gerberParsed.toInches(fl.x);
            const fyIn = gerberParsed.toInches(fl.y);
            const distIn = Math.hypot(hxIn - fxIn, hyIn - fyIn);
            const ap = fl.apertureDef;
            const padSizeIn = gerberParsed.toInches(Math.min(ap.params[0] || 0.05, ap.params[1] || ap.params[0] || 0.05));
            if (distIn < padSizeIn / 2 && distIn < bestDistIn) {
              bestDistIn = distIn;
              bestPad = { padSizeIn, distIn };
            }
          }
          if (bestPad) {
            const annularRingMils = ((bestPad.padSizeIn / 2) - (hDiaMils / 2000) - bestPad.distIn) * 1000;
            if (annularRingMils < minRingMils - 0.05) {
              violations.push({
                category: 'ANNULAR_RING',
                severity: annularRingMils < 0 ? 'Error' : 'Warning',
                measuredMils: +annularRingMils.toFixed(2),
                ruleMils: minRingMils,
                xIn: hxIn,
                yIn: hyIn,
                description: `${annularRingMils < 0 ? 'Pad breakout!' : 'Narrow annular ring:'} ${annularRingMils.toFixed(2)} mil (${(annularRingMils * 0.0254).toFixed(3)} mm) < ${minRingMils.toFixed(1)} mil rule`
              });
            }
          }
        }
      }

      // 4. Check Trace-to-Pad Minimum Copper Clearance (IPC-2221 / IPC-6012)
      const minClrMils = rules.minClearanceMils || 4.0;
      const allFlashes = gerberParsed.commands.filter(c => c.op === "FLASH" && c.polarity !== "CLEAR");
      const allDraws = gerberParsed.commands.filter(c => c.op === "DRAW" && c.polarity !== "CLEAR");
      for (const dCmd of allDraws) {
        const x1 = gerberParsed.toInches(dCmd.x1), y1 = gerberParsed.toInches(dCmd.y1);
        const x2 = gerberParsed.toInches(dCmd.x2), y2 = gerberParsed.toInches(dCmd.y2);
        const trAp = dCmd.apertureDef;
        const trRadMils = gerberParsed.toMils((trAp && trAp.params && trAp.params[0]) || 0.008) / 2;
        for (const fCmd of allFlashes) {
          const fx = gerberParsed.toInches(fCmd.x), fy = gerberParsed.toInches(fCmd.y);
          const pdAp = fCmd.apertureDef;
          const pdHalfMils = gerberParsed.toMils(Math.max((pdAp && pdAp.params && pdAp.params[0]) || 0.05, (pdAp && pdAp.params && pdAp.params[1]) || 0)) / 2;
          // Skip traces intentionally connected to this pad
          const dEnd1 = Math.hypot(x1 - fx, y1 - fy) * 1000;
          const dEnd2 = Math.hypot(x2 - fx, y2 - fy) * 1000;
          if (dEnd1 <= pdHalfMils + 0.5 || dEnd2 <= pdHalfMils + 0.5) continue;

          const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
          const t = l2 > 0 ? Math.max(0, Math.min(1, ((fx - x1) * dx + (fy - y1) * dy) / l2)) : 0;
          const cx = x1 + t * dx, cy = y1 + t * dy;
          const centerDistMils = Math.hypot(fx - cx, fy - cy) * 1000;
          const edgeToCenterMils = centerDistMils - pdHalfMils;
          const edgeToEdgeMils = Math.max(0.1, edgeToCenterMils - trRadMils);
          const effectiveClrMils = edgeToCenterMils > 0 ? Math.min(edgeToCenterMils, edgeToEdgeMils + trRadMils) : edgeToEdgeMils;
          if (effectiveClrMils > 0 && effectiveClrMils < minClrMils - 0.05) {
            violations.push({
              category: "TRACE_TO_PAD_CLEARANCE",
              severity: "Error",
              measuredMils: +effectiveClrMils.toFixed(2),
              ruleMils: minClrMils,
              xIn: cx,
              yIn: cy,
              description: `Trace-to-pad clearance ${effectiveClrMils.toFixed(2)} mil (${(effectiveClrMils * 0.0254).toFixed(3)} mm) < ${minClrMils.toFixed(1)} mil minimum`
            });
          }
        }
      }

      return violations;
    }

    /**
     * Compare two parsed Gerbers (even if one is INCH and the other is MM!)
     */
    compare(camA, camB, options = {}) {
      const w = this.width;
      const h = this.height;

      // Compute unified bounding box in Inches so English vs Metric files align 1:1 physically!
      const sharedBoundsInches = {
        minX: Math.min(camA.toInches(camA.bounds.minX), camB.toInches(camB.bounds.minX)),
        maxX: Math.max(camA.toInches(camA.bounds.maxX), camB.toInches(camB.bounds.maxX)),
        minY: Math.min(camA.toInches(camA.bounds.minY), camB.toInches(camB.bounds.minY)),
        maxY: Math.max(camA.toInches(camA.bounds.maxY), camB.toInches(camB.bounds.maxY))
      };

      const renderOpts = { ...options, sharedBoundsInches, renderMode: 'fill' };

      // Render Layer A to Offscreen Canvas
      const cvA = (typeof document !== 'undefined') ? document.createElement('canvas') : { width: w, height: h };
      cvA.width = w;
      cvA.height = h;
      const rendA = new PCBRenderer(cvA, 'standard');
      rendA.render(camA, options.drillA || null, renderOpts);

      // Render Layer B to Offscreen Canvas
      const cvB = (typeof document !== 'undefined') ? document.createElement('canvas') : { width: w, height: h };
      cvB.width = w;
      cvB.height = h;
      const rendB = new PCBRenderer(cvB, 'standard');
      rendB.render(camB, options.drillB || null, renderOpts);

      const ctxA = cvA.getContext('2d');
      const ctxB = cvB.getContext('2d');

      const imgA = ctxA.getImageData(0, 0, w, h);
      const imgB = ctxB.getImageData(0, 0, w, h);
      const dA = imgA.data;
      const dB = imgB.data;

      const resultImg = ctxA.createImageData(w, h);
      if (typeof document !== 'undefined') {
        cvA.width = 0; cvA.height = 0;
        cvB.width = 0; cvB.height = 0;
      }
      const resData = resultImg.data;

      let missingCopperPx = 0;
      let addedCopperPx = 0;
      let clearanceWarningPx = 0;
      let commonPx = 0;

      const minClearanceMils = options.minClearanceMils || 4.0;
      const compareTolMils = options.compareTolMils != null ? options.compareTolMils : 0;
      const bwInches = (sharedBoundsInches.maxX - sharedBoundsInches.minX) || 1.0;
      const pxPerMil = (w / (bwInches * 1000));
      const clearanceRadiusPx = Math.max(2, Math.round(minClearanceMils * pxPerMil));
      const tolRadiusPx = compareTolMils > 0 ? Math.min(4, Math.floor(compareTolMils * pxPerMil)) : 0;

      const binA = new Uint8Array(w * h);
      const binB = new Uint8Array(w * h);

      for (let i = 0, p = 0; i < dA.length; i += 4, p++) {
        const isCopperA = (dA[i] > 40 || dA[i + 1] > 70);
        const isCopperB = (dB[i] > 40 || dB[i + 1] > 70);
        if (isCopperA) binA[p] = 1;
        if (isCopperB) binB[p] = 1;
      }

      const hasNeighbor = (bin, x, y, rad) => {
        for (let dy = -rad; dy <= rad; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -rad; dx <= rad; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            if (bin[yy * w + xx]) return true;
          }
        }
        return false;
      };

      const CS = 12, gw = Math.ceil(w / CS), gh = Math.ceil(h / CS);
      const cellA = new Uint32Array(gw * gh);
      const cellB = new Uint32Array(gw * gh);
      const cellW = new Uint32Array(gw * gh);

      for (let y = 0, p = 0, i = 0; y < h; y++) {
        for (let x = 0; x < w; x++, p++, i += 4) {
          const inA = binA[p];
          const inB = binB[p];

          if (inA && !inB) {
            if (tolRadiusPx > 0 && hasNeighbor(binB, x, y, tolRadiusPx)) {
              commonPx++;
              resData[i] = 71; resData[i + 1] = 85; resData[i + 2] = 105; resData[i + 3] = 255;
            } else {
              missingCopperPx++;
              cellA[(y / CS | 0) * gw + (x / CS | 0)]++;
              resData[i] = 239; resData[i + 1] = 68; resData[i + 2] = 68; resData[i + 3] = 255;
            }
          } else if (!inA && inB) {
            if (tolRadiusPx > 0 && hasNeighbor(binA, x, y, tolRadiusPx)) {
              commonPx++;
              resData[i] = 71; resData[i + 1] = 85; resData[i + 2] = 105; resData[i + 3] = 255;
            } else {
              addedCopperPx++;
              cellB[(y / CS | 0) * gw + (x / CS | 0)]++;
              resData[i] = 34; resData[i + 1] = 197; resData[i + 2] = 94; resData[i + 3] = 255;
            }
          } else if (inA && inB) {
            commonPx++;
            resData[i] = 71; resData[i + 1] = 85; resData[i + 2] = 105; resData[i + 3] = 255;
          } else {
            resData[i] = 10; resData[i + 1] = 15; resData[i + 2] = 12; resData[i + 3] = 255;
          }
        }
      }

      // Check clearance warnings on boundary additions (Amber / Yellow: #f59e0b)
      const r = clearanceRadiusPx;
      for (let y = r; y < h - r; y += 2) {
        for (let x = r; x < w - r; x += 2) {
          const idx = y * w + x;
          if (binB[idx] && !binA[idx]) {
            let tooClose = false;
            for (let dy = -r; dy <= r; dy += 2) {
              for (let dx = -r; dx <= r; dx += 2) {
                if (dx * dx + dy * dy <= r * r && (dx !== 0 || dy !== 0)) {
                  const neighborIdx = (y + dy) * w + (x + dx);
                  if (binA[neighborIdx]) {
                    tooClose = true;
                    break;
                  }
                }
              }
              if (tooClose) break;
            }

            if (tooClose) {
              clearanceWarningPx++;
              cellW[(y / CS | 0) * gw + (x / CS | 0)]++;
              const pi = idx * 4;
              resData[pi] = 245;
              resData[pi + 1] = 158;
              resData[pi + 2] = 11;
              resData[pi + 3] = 255;
            }
          }
        }
      }

      // Extract clustered defect regions for Defect Navigator
      const regions = [];
      const seen = new Uint8Array(gw * gh);
      for (let s = 0; s < seen.length; s++) {
        if ((cellA[s] + cellB[s] + cellW[s]) < 2 || seen[s]) continue;
        let x0 = gw, y0 = gh, x1 = 0, y1 = 0, sa = 0, sb = 0, sw = 0;
        const q = [s];
        seen[s] = 1;
        while (q.length) {
          const v = q.pop(), cx = v % gw, cy = v / gw | 0;
          x0 = Math.min(x0, cx); x1 = Math.max(x1, cx);
          y0 = Math.min(y0, cy); y1 = Math.max(y1, cy);
          sa += cellA[v]; sb += cellB[v]; sw += cellW[v];
          for (let oy = -2; oy <= 2; oy++) {
            for (let ox = -2; ox <= 2; ox++) {
              const nx = cx + ox, ny = cy + oy;
              if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
              const j = ny * gw + nx;
              if ((cellA[j] + cellB[j] + cellW[j]) >= 2 && !seen[j]) {
                seen[j] = 1;
                q.push(j);
              }
            }
          }
        }
        const rx = Math.max(0, x0 * CS - 4);
        const ry = Math.max(0, y0 * CS - 4);
        const rw = Math.min(w, (x1 + 1) * CS + 4) - rx;
        const rh = Math.min(h, (y1 + 1) * CS + 4) - ry;
        const kind = sw > 4 ? 'c' : (sb === 0 ? 'r' : (sa === 0 ? 'a' : 'c'));
        regions.push({
          x: rx,
          y: ry,
          w: rw,
          h: rh,
          kind,
          type: sw > 4 ? 'clearance' : (kind === 'r' ? 'removed' : (kind === 'a' ? 'added' : 'changed')),
          sa,
          sb,
          sw,
          pixelCount: sa + sb + sw,
          dpi: (w / bwInches)
        });
      }

      const dfmViolations = this.runDFMChecks(camB, options.drillB || options.drillA || null, options.dfmRules || IPC_DFM_RULES.class2);

      return {
        width: w,
        height: h,
        imageData: resultImg,
        sharedBoundsInches,
        regions,
        dfmViolations,
        stats: {
          missingCopperPx,
          addedCopperPx,
          clearanceWarningPx,
          commonPx,
          dfmViolationCount: dfmViolations.length,
          isIdentical: (missingCopperPx === 0 && addedCopperPx === 0)
        }
      };
    }
  }

  return {
    GerberParser,
    ExcellonParser,
    IPCD356Parser,
    PCBRenderer,
    CAMCompare,
    PCB_THEMES,
    IPC_DFM_RULES,
    UnitConverter,
    detectLayerType
  };
});
