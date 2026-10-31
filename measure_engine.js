/**
 * Redline Pro 2.1 — Engineering Measurement & Markup Suite (OSNAP)
 * Module 5: Precision Calibration, Distance, Cumulative Polyline, Area/Perimeter,
 * Magnetic Object Snap (OSNAP), Tally/BOM Counter, Scalloped Revision Clouds,
 * Leader Callouts, and Dynamic SHA-256 Engineering Stamps.
 * Redline Studio · textportdocx.in
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MeasureEngine = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * Scale Calibration State & Utilities
   */
  class CalibrationManager {
    constructor() {
      this.unit = 'mm';
      this.pxPerUnit = 72 / 25.4; // Default: PDF points per mm
      this.calibrated = false;
      this.points = []; // Calibration reference clicks
    }

    setCalibration(pixelDistance, realWorldDistance, unit = 'mm') {
      if (!pixelDistance || !realWorldDistance || realWorldDistance <= 0) return false;
      this.unit = unit;
      this.pxPerUnit = pixelDistance / realWorldDistance;
      this.calibrated = true;
      try {
        localStorage.setItem('rp_calibration', JSON.stringify({
          unit: this.unit,
          pxPerUnit: this.pxPerUnit,
          calibrated: true
        }));
      } catch (e) {}
      return true;
    }

    loadSaved() {
      try {
        const saved = localStorage.getItem('rp_calibration');
        if (saved) {
          const obj = JSON.parse(saved);
          this.unit = obj.unit || 'mm';
          this.pxPerUnit = obj.pxPerUnit || (72 / 25.4);
          this.calibrated = !!obj.calibrated;
        }
      } catch (e) {}
    }

    toRealDistance(pxDist) {
      return pxDist / this.pxPerUnit;
    }

    toRealArea(pxArea) {
      return pxArea / (this.pxPerUnit * this.pxPerUnit);
    }

    formatDistance(pxDist) {
      const real = this.toRealDistance(pxDist);
      const decimals = (this.unit === 'mils' || this.unit === 'in') ? 3 : 2;
      return `${real.toFixed(decimals)} ${this.unit}`;
    }

    formatArea(pxArea) {
      const real = this.toRealArea(pxArea);
      const unitLabel = this.unit === 'in' ? 'sq in' : (this.unit === 'mils' ? 'sq mils' : `${this.unit}²`);
      return `${real.toFixed(2)} ${unitLabel}`;
    }
  }

  /**
   * Magnetic Object Snap (OSNAP)
   * Snaps cursor to nearest vertices, line endpoints, midpoints, and center points within 8px radius.
   */
  class OSNAPManager {
    constructor(snapRadius = 8) {
      this.snapRadius = snapRadius;
      this.features = []; // List of { type: 'endpoint'|'midpoint'|'center', x, y }
      this.activeSnap = null;
    }

    clear() {
      this.features = [];
      this.activeSnap = null;
    }

    addPoint(x, y, type = 'endpoint') {
      this.features.push({ type, x, y });
    }

    addLine(x1, y1, x2, y2) {
      this.features.push({ type: 'endpoint', x: x1, y: y1 });
      this.features.push({ type: 'endpoint', x: x2, y: y2 });
      this.features.push({ type: 'midpoint', x: (x1 + x2) / 2, y: (y1 + y2) / 2 });
    }

    addRect(x, y, w, h) {
      this.addLine(x, y, x + w, y);
      this.addLine(x + w, y, x + w, y + h);
      this.addLine(x + w, y + h, x, y + h);
      this.addLine(x, y + h, x, y);
      this.features.push({ type: 'center', x: x + w / 2, y: y + h / 2 });
    }

    addCircle(cx, cy, r) {
      this.features.push({ type: 'center', x: cx, y: cy });
      this.features.push({ type: 'endpoint', x: cx + r, y: cy });
      this.features.push({ type: 'endpoint', x: cx - r, y: cy });
      this.features.push({ type: 'endpoint', x: cx, y: cy + r });
      this.features.push({ type: 'endpoint', x: cx, y: cy - r });
    }

    snap(cursorX, cursorY, zoomScale = 1.0) {
      const safeZoom = Math.max(0.05, Math.min(64.0, Number.isFinite(zoomScale) && zoomScale > 0 ? zoomScale : 1.0));
      const threshold = this.snapRadius / safeZoom;
      const threshSq = threshold * threshold;
      let closest = null;
      let minDistSq = threshSq;

      for (const f of this.features) {
        const dx = f.x - cursorX;
        const dy = f.y - cursorY;
        const distSq = dx * dx + dy * dy;
        if (distSq < minDistSq) {
          minDistSq = distSq;
          closest = f;
        }
      }

      this.activeSnap = closest;
      return closest ? { x: closest.x, y: closest.y, type: closest.type } : { x: cursorX, y: cursorY, type: null };
    }

    drawSnapMarker(ctx, snap, zoomScale = 1.0) {
      if (!snap || !snap.type) return;
      const safeZoom = Math.max(0.05, Math.min(64.0, Number.isFinite(zoomScale) && zoomScale > 0 ? zoomScale : 1.0));
      const size = 6 / safeZoom;
      zoomScale = safeZoom;

      ctx.save();
      ctx.lineWidth = 1.5 / zoomScale;
      ctx.strokeStyle = '#22c55e'; // Vibrant OSNAP green
      ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';

      if (snap.type === 'endpoint') {
        // Green Square for vertex/endpoint
        ctx.beginPath();
        ctx.rect(snap.x - size, snap.y - size, size * 2, size * 2);
        ctx.fill();
        ctx.stroke();
      } else if (snap.type === 'midpoint') {
        // Green Triangle for midpoint
        ctx.beginPath();
        ctx.moveTo(snap.x, snap.y - size);
        ctx.lineTo(snap.x + size, snap.y + size);
        ctx.lineTo(snap.x - size, snap.y + size);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (snap.type === 'center') {
        // Green Circle for center
        ctx.beginPath();
        ctx.arc(snap.x, snap.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /**
   * Tally & BOM Inspection Counter
   */
  class TallyManager {
    constructor() {
      this.items = []; // List of { id, number, x, y, page, label, timestamp }
      this.nextNum = 1;
    }

    clear() {
      this.items = [];
      this.nextNum = 1;
    }

    addItem(x, y, page = 1, label = '') {
      const item = {
        id: 'tally_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        number: this.nextNum++,
        x,
        y,
        page,
        label: label || `Inspection Item #${this.nextNum - 1}`,
        timestamp: new Date().toISOString()
      };
      this.items.push(item);
      return item;
    }

    removeItem(id) {
      const idx = this.items.findIndex(it => it.id === id);
      if (idx !== -1) {
        this.items.splice(idx, 1);
        // Renumber remaining items
        this.items.forEach((it, i) => it.number = i + 1);
        this.nextNum = this.items.length + 1;
      }
    }

    toCSV() {
      const headers = ['Number', 'Page', 'X', 'Y', 'Description', 'Timestamp'];
      const rows = this.items.map(it => [
        it.number,
        it.page,
        it.x.toFixed(2),
        it.y.toFixed(2),
        `"${(it.label || '').replace(/"/g, '""')}"`,
        it.timestamp
      ]);
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    }

    drawBadges(ctx, page = 1, zoomScale = 1.0) {
      const radius = 11 / zoomScale;
      const fontSize = Math.max(9, 11 / zoomScale);

      for (const it of this.items) {
        if (it.page !== page) continue;

        ctx.save();
        // Badge circle: high contrast gold/orange background
        ctx.beginPath();
        ctx.arc(it.x, it.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.lineWidth = 1.5 / zoomScale;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        // Badge text
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#18181b';
        ctx.fillText(String(it.number), it.x, it.y);
        ctx.restore();
      }
    }
  }

  /**
   * Geometry & Measurement Calculations
   */
  function calcDistance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function calcPolylineLength(points) {
    if (!points || points.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      total += calcDistance(points[i], points[i + 1]);
    }
    return total;
  }

  function calcPolygonArea(points) {
    if (!points || points.length < 3) return 0;
    let sum = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % n];
      sum += (p1.x * p2.y) - (p2.x * p1.y);
    }
    return Math.abs(sum) / 2;
  }

  /**
   * ANSI/ISO Scalloped Revision Clouds
   * Generates outward convex circular scallops along polygon edges with Revision Delta marker.
   */
  function drawRevisionCloud(ctx, points, revText = 'Δ Rev 1', options = {}) {
    if (!points || points.length < 2) return;

    const strokeColor = options.color || '#ef4444';
    const lineWidth = options.lineWidth || 2;
    const scallopSize = options.scallopSize || 14;

    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % n];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      if (segLen <= 0.1) continue;

      const numScallops = Math.max(1, Math.round(segLen / scallopSize));
      const stepX = dx / numScallops;
      const stepY = dy / numScallops;

      // Normal vector pointing outward (CW polygon: outward is normal to the right)
      const nx = -dy / segLen;
      const ny = dx / segLen;
      const bulge = scallopSize * 0.45;

      let curX = p1.x;
      let curY = p1.y;

      if (i === 0) ctx.moveTo(curX, curY);

      for (let s = 0; s < numScallops; s++) {
        const nextX = curX + stepX;
        const nextY = curY + stepY;
        const midX = (curX + nextX) / 2 + nx * bulge;
        const midY = (curY + nextY) / 2 + ny * bulge;

        ctx.quadraticCurveTo(midX, midY, nextX, nextY);
        curX = nextX;
        curY = nextY;
      }
    }
    ctx.stroke();

    // Draw Revision Delta Triangle if text provided
    if (revText) {
      const firstPt = points[0];
      const triSize = 14;
      const tx = firstPt.x;
      const ty = firstPt.y - 18;

      ctx.beginPath();
      ctx.moveTo(tx, ty - triSize);
      ctx.lineTo(tx + triSize * 0.9, ty + triSize * 0.6);
      ctx.lineTo(tx - triSize * 0.9, ty + triSize * 0.6);
      ctx.closePath();

      ctx.fillStyle = '#fee2e2';
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = strokeColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(revText, tx, ty + 1);
    }

    ctx.restore();
  }

  /**
   * Leader Callouts: Multi-point arrow with text box
   */
  function drawLeaderCallout(ctx, startPt, endPt, text = '', options = {}) {
    const color = options.color || '#ef4444';
    const lineWidth = options.lineWidth || 1.8;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth;

    // Leader line
    ctx.beginPath();
    ctx.moveTo(startPt.x, startPt.y);
    ctx.lineTo(endPt.x, endPt.y);
    ctx.stroke();

    // Arrowhead at startPt
    const angle = Math.atan2(endPt.y - startPt.y, endPt.x - startPt.x);
    const headLen = 10;
    ctx.beginPath();
    ctx.moveTo(startPt.x, startPt.y);
    ctx.lineTo(startPt.x + headLen * Math.cos(angle - Math.PI / 6), startPt.y + headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(startPt.x + headLen * Math.cos(angle + Math.PI / 6), startPt.y + headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    // Callout Text Box at endPt
    if (text) {
      const padding = 6;
      ctx.font = '12px sans-serif';
      const lines = text.split('\n');
      let maxW = 0;
      for (const l of lines) {
        const w = ctx.measureText(l).width;
        if (w > maxW) maxW = w;
      }
      const boxW = maxW + padding * 2;
      const boxH = lines.length * 16 + padding * 2;
      const boxX = endPt.x > startPt.x ? endPt.x : endPt.x - boxW;
      const boxY = endPt.y - boxH / 2;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.fillStyle = '#0f172a';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      lines.forEach((l, i) => {
        ctx.fillText(l, boxX + padding, boxY + padding + i * 16);
      });
    }

    ctx.restore();
  }

  /**
   * Cryptographic Document Hashing (SHA-256)
   */
  async function computeDocumentSHA256(arrayBuffer) {
    if (!arrayBuffer) return '0000000000000000';
    try {
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
        return hashHex.slice(0, 16); // High-order 16 hex chars
      }
    } catch (e) {
      console.warn('Crypto subtle unavailable, using fallback hash:', e);
    }
    // Fallback simple checksum
    const u8 = new Uint8Array(arrayBuffer);
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < u8.length; i++) {
      h1 = Math.imul(h1 ^ u8[i], 2654435761);
      h2 = Math.imul(h2 ^ u8[i], 1597334677);
    }
    return ((h1 >>> 0).toString(16) + (h2 >>> 0).toString(16)).toUpperCase().padStart(16, '0');
  }

  /**
   * Dynamic Engineering Stamps
   * APPROVED, REJECTED, REVISED & RESUBMIT, FOR REVIEW ONLY
   */
  const STAMP_TEMPLATES = {
    APPROVED: { title: 'APPROVED', color: '#16a34a', bg: 'rgba(22, 163, 74, 0.08)' },
    REJECTED: { title: 'REJECTED', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.08)' },
    'REVISED & RESUBMIT': { title: 'REVISED & RESUBMIT', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.08)' },
    'FOR REVIEW ONLY': { title: 'FOR REVIEW ONLY', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.08)' }
  };

  function drawEngineeringStamp(ctx, x, y, stampType = 'APPROVED', reviewer = 'Lead Engineer', docHash = 'A3F8E902B1764D5C') {
    const tmpl = STAMP_TEMPLATES[stampType] || STAMP_TEMPLATES.APPROVED;
    const w = 210;
    const h = 76;

    ctx.save();
    ctx.translate(x, y);

    // Double-line border standard for engineering stamps
    ctx.fillStyle = tmpl.bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = tmpl.color;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(0, 0, w, h);

    ctx.lineWidth = 1;
    ctx.strokeRect(3.5, 3.5, w - 7, h - 7);

    // Title
    ctx.fillStyle = tmpl.color;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(tmpl.title, w / 2, 8);

    // Separator line
    ctx.beginPath();
    ctx.moveTo(8, 29);
    ctx.lineTo(w - 8, 29);
    ctx.stroke();

    // Metadata lines
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 8);

    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`BY: ${reviewer.slice(0, 22)}`, 10, 33);
    ctx.fillText(`DATE: ${dateStr}`, 10, 46);
    ctx.fillText(`SHA256: ${docHash}`, 10, 59);

    ctx.restore();
  }

  function clampZoom(zoom, min = 0.05, max = 64.0) {
    zoom = Math.max(0.05, Math.min(64.0, Number.isFinite(zoom) && zoom > 0 ? zoom : 1.0));
    return Math.max(min, Math.min(max, zoom));
  }

  function clampPan(val, fallback = 0) {
    return Number.isFinite(val) ? Math.max(-1e6, Math.min(1e6, val)) : fallback;
  }

  return {
    CalibrationManager,
    clampZoom,
    clampPan,
    OSNAPManager,
    TallyManager,
    calcDistance,
    calcPolylineLength,
    calcPolygonArea,
    drawRevisionCloud,
    drawLeaderCallout,
    computeDocumentSHA256,
    drawEngineeringStamp,
    STAMP_TEMPLATES
  };
});
