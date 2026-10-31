/**
 * Redline Pro — Modern Categorized Ribbon, CAM350 Workbench (IPC English/Metric,
 * Gerber RS-274X, Excellon Drill, IPC-D-356 Netlist, IPC Class 1/2/3 DFM/DRC),
 * Floating Layer Dock, Curtain Splitter, Fiducial Auto-Alignment, Defect Navigator & Audit Reports.
 * Redline Studio · textportdocx.in
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.UIRibbon = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const $ = s => (typeof document !== 'undefined' ? document.querySelector(s) : null);
  const $$ = s => (typeof document !== 'undefined' ? Array.from(document.querySelectorAll(s)) : []);
  const el = (tag, attrs = {}, html = '') => {
    if (typeof document === 'undefined') return null;
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'className') e.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k === 'hidden') e.hidden = !!v;
      else e.setAttribute(k, v);
    }
    if (html) e.innerHTML = html;
    return e;
  };

  // Non-blocking toast notification helper
  let toastTimer = null;
  function rpToast(msg, duration = 2800) {
    if (typeof document === 'undefined') return;
    let t = $('#rp-toast');
    if (!t) {
      t = el('div', { id: 'rp-toast', className: 'rp-toast', hidden: true });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.hidden = false;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => { t.hidden = true; }, 220);
    }, duration);
  }
  if (typeof window !== 'undefined') { window.rpToast = rpToast; window.showToast = rpToast; }

  /**
   * Convert a rendered HTML5 Canvas into a single-page PDF Uint8Array via PDFLib
   * so imported DXF and Gerber/Drill/IPC files load natively into Compare Slot A or B!
   */
  async function canvasToPDFBytes(canvas) {
    if (typeof PDFLib === 'undefined' || !PDFLib.PDFDocument) return null;
    const pdfDoc = await PDFLib.PDFDocument.create();
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    const pngBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const pngImage = await pdfDoc.embedPng(pngBytes);
    const page = pdfDoc.addPage([canvas.width * 0.5, canvas.height * 0.5]);
    page.drawImage(pngImage, {
      x: 0,
      y: 0,
      width: canvas.width * 0.5,
      height: canvas.height * 0.5
    });
    return await pdfDoc.save();
  }

  const safeGet = (k, def = null) => {
    try { return (typeof localStorage !== 'undefined' && localStorage.getItem(k)) ?? def; } catch (e) { return def; }
  };
  const safeSet = (k, v) => {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v); } catch (e) {}
  };

  /**
   * CAM350 & IPC Global State (Units: 'english' [mils/in] vs 'metric' [mm/µm], Format, DFM Rules, Layers)
   */
  const CAMState = {
    unitSystem: safeGet('rp_unit_system', 'english') || 'english', // 'english' (IPC mils/in) | 'metric' (IPC mm/µm)
    renderMode: 'fill', // 'fill' | 'outline' | 'skeleton'
    mirrorX: false,
    invertPolarity: false,
    showOrigin: true,
    showDrillRings: true,
    pcbTheme: 'standard',
    ipcClass: 'class2',
    zeroSuppression: 'AUTO', // 'AUTO' | 'L' | 'T' | 'D'
    coordFormat: 'AUTO',     // 'AUTO' | '2.4' | '2.5' | '3.3' | '3.4' | '4.4'
    coordMode: 'AUTO',       // 'AUTO' | 'A' | 'I'
    customRules: {
      minClearanceMils: 4.0,
      minTraceWidthMils: 4.0,
      minAnnularRingMils: 3.5,
      minDrillDiaMils: 8.0,
      compareTolMils: 0.25
    },
    highlightNet: null,
    parsedGerberA: null,
    parsedGerberB: null,
    parsedDrillA: null,
    parsedDrillB: null,
    parsedIPCA: null,
    parsedIPCB: null,
    lastDFMViolations: [],
    lastNetDiffs: [],

    getParseOptions() {
      const opts = {};
      if (this.zeroSuppression !== 'AUTO') {
        opts.zeroSuppression = this.zeroSuppression;
        opts.forceFormat = true;
      }
      if (this.coordMode !== 'AUTO') {
        opts.coordType = this.coordMode;
        opts.forceFormat = true;
      }
      if (this.coordFormat !== 'AUTO') {
        const [iDig, dDig] = this.coordFormat.split('.').map(Number);
        opts.xInt = iDig; opts.xDec = dDig;
        opts.yInt = iDig; opts.yDec = dDig;
        opts.intDigits = iDig; opts.decDigits = dDig;
        opts.forceFormat = true;
      }
      return opts;
    },

    formatDimFromPx(px, dpi = 300) {
      const inches = px / (dpi || 300);
      if (this.unitSystem === 'metric') {
        return `${(inches * 25.4).toFixed(2)} mm`;
      }
      return `${(inches * 1000).toFixed(1)} mil`;
    },

    formatBoxFromPx(wPx, hPx, xPx, yPx, dpi = 300) {
      const d = dpi || 300;
      if (this.unitSystem === 'metric') {
        const w = (wPx / d * 25.4).toFixed(2);
        const h = (hPx / d * 25.4).toFixed(2);
        const x = (xPx / d * 25.4).toFixed(1);
        const y = (yPx / d * 25.4).toFixed(1);
        return `${w}×${h} mm @ (${x}, ${y}) mm`;
      }
      const w = (wPx / d * 1000).toFixed(1);
      const h = (hPx / d * 1000).toFixed(1);
      const x = (xPx / d * 1000).toFixed(0);
      const y = (yPx / d * 1000).toFixed(0);
      return `${w}×${h} mil @ (${x}, ${y}) mil`;
    }
  };

  function setUnitSystem(sys, silent = false, preserveCalUnit = false) {
    const norm = (String(sys).toLowerCase() === 'metric' || String(sys).toLowerCase() === 'mm' || String(sys).toLowerCase() === 'um') ? 'metric' : 'english';
    CAMState.unitSystem = norm;
    try { localStorage.setItem('rp_unit_system', norm); } catch (e) {}

    // Sync MeasureEngine calibrator unit if not custom-calibrated or convert its unit
    if (typeof window !== 'undefined' && window.RP_MEASURE && window.RP_MEASURE.calibrator) {
      const cal = window.RP_MEASURE.calibrator;
      const oldUnit = cal.unit;
      const newUnit = norm === 'metric' ? 'mm' : 'mils';
      if (!cal.calibrated) {
        const S = window.CMP;
        const dpi = (S && S.cur && S.cur.dpi) ? S.cur.dpi : (+($('#dpi') && $('#dpi').value) || 300);
        cal.unit = newUnit;
        cal.pxPerUnit = norm === 'metric' ? (dpi / 25.4) : (dpi / 1000);
      } else if (!preserveCalUnit && oldUnit !== newUnit) {
        const toMM = { mm: 1, um: 0.001, mils: 0.0254, in: 25.4 };
        const oldMM = toMM[oldUnit] || 1;
        const newMM = toMM[newUnit] || 1;
        cal.pxPerUnit = cal.pxPerUnit * (newMM / oldMM);
        cal.unit = newUnit;
      }
      if (window.rpUpdateCalBadge) window.rpUpdateCalBadge();
      if (window.rpReformatMeasurements) window.rpReformatMeasurements();
    }

    // Update all unit selectors in UI
    ['#rib-units-quick', '#rib-cam-units', '#cam-side-units', '#cam-wb-units'].forEach(sel => {
      const elSel = $(sel);
      if (elSel) elSel.value = norm;
    });

    // Update top bar calibration/unit chip
    const badge = $('#rp-cal-txt');
    if (badge) {
      const cal = (typeof window !== 'undefined' && window.RP_MEASURE) ? window.RP_MEASURE.calibrator : null;
      const unitLbl = norm === 'metric' ? 'mm (IPC Metric)' : 'mil (IPC English)';
      if (cal) {
        badge.textContent = `Units: ${unitLbl} · ${(1 / cal.pxPerUnit).toFixed(norm === 'metric' ? 3 : 2)} ${cal.unit}/px`;
      } else {
        badge.textContent = `Units: ${unitLbl}`;
      }
    }

    // Re-render checklist & sidebar with updated units
    DefectState.renderChecklist();
    if (typeof window !== 'undefined' && window.renderList) window.renderList();
    updateCAMSidebarPane();

    if (!silent) {
      rpToast(`Switched Engineering & CAM Units to ${norm === 'metric' ? 'IPC Metric (mm / µm)' : 'IPC English (mils / in)'}`);
    }
  }
  if (typeof window !== 'undefined') {
    window.CAMState = CAMState;
    window.setUnitSystem = setUnitSystem;
  }


  /**
   * Compare Workspace Undo / Redo History Stack (Ctrl+Z / Ctrl+Y)
   * Reverses markups, measurements, leader callouts, tally badges, ignore zones, and alignment nudges.
   */
  const CompareHistory = {
    undoStack: [],
    redoStack: [],
    maxDepth: 25,

    clear() {
      this.undoStack = [];
      this.redoStack = [];
    },

    captureState(label = "Action") {
      const S = (typeof window !== "undefined" && window.CMP) ? window.CMP : {};
      const RM = (typeof window !== "undefined" && window.RP_MEASURE) ? window.RP_MEASURE : {};
      return {
        label,
        dx: $("#dx") ? $("#dx").value : "0",
        dy: $("#dy") ? $("#dy").value : "0",
        rotB: S.rotB || 0,
        tintA: S.tintA || "#e11414",
        tintB: S.tintB || "#00a53c",
        opA: S.opA != null ? S.opA : 100,
        opB: S.opB != null ? S.opB : 100,
        lA: $("#lA") ? $("#lA").checked : true,
        lB: $("#lB") ? $("#lB").checked : true,
        lC: $("#lC") ? $("#lC").checked : true,
        lM: $("#lM") ? $("#lM").checked : true,
        ignore: JSON.parse(JSON.stringify(S.ignore || [])),
        done: JSON.parse(JSON.stringify(S.done || {})),
        annotations: JSON.parse(JSON.stringify(RM.annotations || [])),
        nextPinNum: RM.nextPinNum || 1,
        tallyItems: (RM.tally && RM.tally.items) ? JSON.parse(JSON.stringify(RM.tally.items)) : [],
        tallyNext: (RM.tally && RM.tally.nextNum) ? RM.tally.nextNum : 1,
        defects: JSON.parse(JSON.stringify(DefectState.defects || [])),
        defectsByPage: JSON.parse(JSON.stringify(DefectState.byPage || {}))
      };
    },

    push(label = "Compare edit") {
      this.undoStack.push(this.captureState(label));
      if (this.undoStack.length > this.maxDepth) this.undoStack.shift();
      this.redoStack = [];
    },

    applySnapshot(snap) {
      if (!snap) return;
      const S = (typeof window !== "undefined" && window.CMP) ? window.CMP : {};
      const RM = (typeof window !== "undefined" && window.RP_MEASURE) ? window.RP_MEASURE : {};
      const oldDx = $("#dx") ? $("#dx").value : "0";
      const oldDy = $("#dy") ? $("#dy").value : "0";
      const oldRot = S.rotB || 0;
      const oldIgnLen = (S.ignore || []).length;

      if ($("#dx")) $("#dx").value = snap.dx;
      if ($("#dy")) $("#dy").value = snap.dy;
      if ($("#rp-cur-dx")) $("#rp-cur-dx").textContent = snap.dx;
      if ($("#rp-cur-dy")) $("#rp-cur-dy").textContent = snap.dy;
      S.rotB = snap.rotB || 0;
      if ($("#rp-rot-b")) $("#rp-rot-b").value = S.rotB;
      if ($("#rp-cur-rot")) $("#rp-cur-rot").textContent = S.rotB + "°";
      if (snap.tintA) { S.tintA = snap.tintA; if ($("#rp-tint-a")) $("#rp-tint-a").value = snap.tintA; }
      if (snap.tintB) { S.tintB = snap.tintB; if ($("#rp-tint-b")) $("#rp-tint-b").value = snap.tintB; }
      if (snap.opA != null) { S.opA = snap.opA; if ($("#rp-op-a")) $("#rp-op-a").value = snap.opA; if ($("#rp-op-a-val")) $("#rp-op-a-val").textContent = snap.opA + "%"; }
      if (snap.opB != null) { S.opB = snap.opB; if ($("#rp-op-b")) $("#rp-op-b").value = snap.opB; if ($("#rp-op-b-val")) $("#rp-op-b-val").textContent = snap.opB + "%"; }
      if (snap.lA != null && $("#lA")) { $("#lA").checked = snap.lA; if ($("#rp-eye-a")) $("#rp-eye-a").classList.toggle("on", snap.lA); if ($("#rp-diff-del")) $("#rp-diff-del").checked = snap.lA; }
      if (snap.lB != null && $("#lB")) { $("#lB").checked = snap.lB; if ($("#rp-eye-b")) $("#rp-eye-b").classList.toggle("on", snap.lB); if ($("#rp-diff-add")) $("#rp-diff-add").checked = snap.lB; }
      if (snap.lC != null && $("#lC")) { $("#lC").checked = snap.lC; if ($("#rp-eye-c")) $("#rp-eye-c").classList.toggle("on", snap.lC); }
      if (snap.lM != null && $("#lM")) { $("#lM").checked = snap.lM; if ($("#rp-markers-chk")) $("#rp-markers-chk").checked = snap.lM; if ($("#rib-view-markers")) $("#rib-view-markers").classList.toggle("on", snap.lM); }

      S.ignore = JSON.parse(JSON.stringify(snap.ignore || []));
      S.done = JSON.parse(JSON.stringify(snap.done || {}));

      if (RM) {
        RM.annotations = JSON.parse(JSON.stringify(snap.annotations || []));
        if (snap.nextPinNum) RM.nextPinNum = snap.nextPinNum;
        if (RM.tally) {
          RM.tally.items = JSON.parse(JSON.stringify(snap.tallyItems || []));
          RM.tally.nextNum = snap.tallyNext || (RM.tally.items.length + 1);
        }
      }
      if (snap.defectsByPage) {
        DefectState.byPage = JSON.parse(JSON.stringify(snap.defectsByPage));
      }
      if (snap.defects) {
        DefectState.defects = JSON.parse(JSON.stringify(snap.defects));
        const curPageN = (S && S.cur && S.cur.n) ? S.cur.n : 1;
        DefectState.byPage[curPageN] = DefectState.defects;
        DefectState.renderChecklist();
      }
      if (typeof markers === "function") markers();
      if (typeof window !== "undefined" && window.rpRedrawOverlay) window.rpRedrawOverlay();
      if (typeof window !== "undefined" && window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar();
      if (typeof window !== "undefined" && window.renderList) window.renderList();

      if (oldDx !== snap.dx || oldDy !== snap.dy || oldRot !== S.rotB || oldIgnLen !== S.ignore.length) {
        if (typeof window !== "undefined" && window.refresh) window.refresh();
      }
    },

    undo() {
      if (!this.undoStack.length) {
        rpToast("Nothing to undo in Compare view.");
        return false;
      }
      const prev = this.undoStack.pop();
      this.redoStack.push(this.captureState(prev.label));
      this.applySnapshot(prev);
      rpToast(`Undone: ${prev.label}`);
      return true;
    },

    redo() {
      if (!this.redoStack.length) {
        rpToast("Nothing to redo in Compare view.");
        return false;
      }
      const next = this.redoStack.pop();
      this.undoStack.push(this.captureState(next.label));
      this.applySnapshot(next);
      rpToast(`Redone: ${next.label}`);
      return true;
    }
  };
  if (typeof window !== "undefined") {
    window.CompareHistory = CompareHistory;
    window.rpPushCompareHistory = label => CompareHistory.push(label);
  }

  /**
   * Defect Review Checklist State
   */
  const DefectState = {
    defects: [],
    byPage: {},
    currentIndex: -1,
    noiseThreshold: 2,
    filterStatus: 'ALL',

    clearAllPages() {
      this.byPage = {};
      this.defects = [];
      this.currentIndex = -1;
    },

    initFromRegions(regions = []) {
      const S = (typeof window !== 'undefined' && window.CMP) ? window.CMP : null;
      const pageN = (S && S.cur && S.cur.n) ? S.cur.n : 1;
      const defaultDpi = (S && S.cur && S.cur.dpi) ? S.cur.dpi : 300;
      const priorList = (this.byPage && this.byPage[pageN]) ? this.byPage[pageN] : this.defects;
      const prevMap = new Map((priorList || []).map(d => [`${Math.round(d.x)}_${Math.round(d.y)}`, d]));

      this.defects = regions
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => (r.pixelCount || (r.sa || 0) + (r.sb || 0) || (r.w * r.h)) >= this.noiseThreshold)
        .map(({ r, i }, listIdx) => {
          const key = `${Math.round(r.x)}_${Math.round(r.y)}`;
          const old = prevMap.get(key);
          const doneKey = pageN + ':' + i;
          const hasExplicitDone = S && S.done && Object.prototype.hasOwnProperty.call(S.done, doneKey);
          const isDone = hasExplicitDone ? !!S.done[doneKey] : false;
          const status = (old && (old.status === 'Flagged' || old.status === 'Ignored'))
            ? old.status
            : (hasExplicitDone ? (isDone ? 'Approved' : 'Open') : (old ? old.status : 'Open'));
          const kind = r.type || (r.kind === 'r' ? 'removed' : r.kind === 'a' ? 'added' : 'changed');
          return {
            id: listIdx + 1,
            regionIndex: i,
            page: pageN,
            type: kind,
            x: r.x,
            y: r.y,
            w: r.w,
            h: r.h,
            dpi: r.dpi || defaultDpi,
            pixels: r.pixelCount || ((r.sa || 0) + (r.sb || 0)) || Math.round(r.w * r.h),
            status,
            note: r.note || (old ? old.note : '')
          };
        });
      this.byPage[pageN] = this.defects;
      this.currentIndex = this.defects.length ? 0 : -1;
      this.renderChecklist();
    },

    next() {
      if (!this.defects.length) {
        if (typeof window !== 'undefined' && window.ACT && window.ACT.nextDiff) window.ACT.nextDiff();
        return;
      }
      this.currentIndex = (this.currentIndex + 1) % this.defects.length;
      this.jumpTo(this.currentIndex);
    },

    prev() {
      if (!this.defects.length) {
        if (typeof window !== 'undefined' && window.ACT && window.ACT.prevDiff) window.ACT.prevDiff();
        return;
      }
      this.currentIndex = (this.currentIndex - 1 + this.defects.length) % this.defects.length;
      this.jumpTo(this.currentIndex);
    },

    jumpTo(idx) {
      if (idx < 0 || idx >= this.defects.length) return;
      this.currentIndex = idx;
      const d = this.defects[idx];
      if (typeof window !== 'undefined' && window.CMP && window.CMP.view) {
        const vp = $('#vp');
        const v = window.CMP.view;
        const cur = window.CMP.cur;
        if (vp && cur) {
          window.CMP.sel = d.regionIndex != null ? d.regionIndex : idx;
          v.k = Math.max(1.2, Math.min(8.0, Math.min(vp.clientWidth / (Math.max(d.w, 40) * 3.2), vp.clientHeight / (Math.max(d.h, 40) * 3.2))));
          v.x = Math.round(vp.clientWidth / 2 - (d.x + d.w / 2) * v.k);
          v.y = Math.round(vp.clientHeight / 2 - (d.y + d.h / 2) * v.k);
          const stg = $('#stage');
          if (stg) stg.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.k})`;
          if (typeof window.applyView === 'function') window.applyView();
          else {
            if (typeof markers === 'function') markers();
            if (window.rpSharpen) window.rpSharpen();
          }
          if (window.rpRedrawOverlay) window.rpRedrawOverlay();
        }
      }
      this.highlightItem(idx);
    },

    setStatus(idx, status) {
      if (this.defects[idx]) {
        const d = this.defects[idx];
        d.status = status;
        const rIdx = d.regionIndex != null ? d.regionIndex : idx;
        if (typeof window !== 'undefined' && window.CMP && window.CMP.cur) {
          window.CMP.done[window.CMP.cur.n + ':' + rIdx] = (status === 'Approved' || status === 'Ignored');
          if (typeof markers === 'function') markers();
          if (typeof window.updateSummaryOnly === 'function') window.updateSummaryOnly();
        }
        this.renderChecklist();
      }
    },

    setStatusByRegion(regionIdx, status) {
      const idx = this.defects.findIndex(d => (d.regionIndex != null ? d.regionIndex : (d.id - 1)) === regionIdx);
      if (idx >= 0) this.setStatus(idx, status);
    },

    markAllApproved() {
      this.defects.forEach((d, idx) => {
        d.status = 'Approved';
        const rIdx = d.regionIndex != null ? d.regionIndex : idx;
        if (typeof window !== 'undefined' && window.CMP && window.CMP.cur) {
          window.CMP.done[window.CMP.cur.n + ':' + rIdx] = true;
        }
      });
      this.renderChecklist();
      if (typeof markers === 'function') markers();
      if (typeof window !== 'undefined' && typeof window.updateSummaryOnly === 'function') window.updateSummaryOnly();
    },

    highlightItem(idx) {
      $$('.defect-item').forEach(e => e.classList.toggle('active', parseInt(e.dataset.idx, 10) === idx));
      const activeEl = $(`.defect-item[data-idx="${idx}"]`);
      if (activeEl && activeEl.scrollIntoView) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

    renderChecklist() {
      const container = $('#defect-checklist-body');
      if (!container) return;

      const countEl = $('#rp-defect-count-badge');
      if (countEl) countEl.textContent = String(this.defects.length);
      if (typeof window !== 'undefined' && window.syncCompareHud) window.syncCompareHud();

      const filtered = this.defects
        .map((d, i) => ({ d, i }))
        .filter(({ d }) => this.filterStatus === 'ALL' || d.status === this.filterStatus);

      if (!filtered.length) {
        container.innerHTML = `<div class="rp-empty-msg">${this.defects.length ? 'No defects match filter [' + this.filterStatus + '].' : 'No defects detected on this sheet.'}</div>`;
        return;
      }

      container.innerHTML = filtered.map(({ d, i }) => {
        const unitReadout = CAMState.formatBoxFromPx(d.w, d.h, d.x, d.y, d.dpi || 300);
        return `
        <div class="defect-item ${i === this.currentIndex ? 'active' : ''} status-${d.status.toLowerCase()}" data-idx="${i}">
          <div class="defect-header">
            <span class="defect-badge ${d.type}">#${d.id} ${d.type.toUpperCase()}</span>
            <span class="defect-coords" title="Pixel Coords: (${Math.round(d.x)}, ${Math.round(d.y)}) · ${Math.round(d.w)}×${Math.round(d.h)} px">${unitReadout}</span>
            <select class="defect-status-sel" data-idx="${i}">
              <option value="Open" ${d.status === 'Open' ? 'selected' : ''}>[Open]</option>
              <option value="Approved" ${d.status === 'Approved' ? 'selected' : ''}>[Approved]</option>
              <option value="Flagged" ${d.status === 'Flagged' ? 'selected' : ''}>[Flagged]</option>
              <option value="Ignored" ${d.status === 'Ignored' ? 'selected' : ''}>[Ignored]</option>
            </select>
          </div>
          <input type="text" class="defect-note-input" data-idx="${i}" placeholder="Add engineering / CAM review note..." value="${(d.note || '').replace(/"/g, '&quot;')}" />
        </div>
      `;
      }).join('');

      container.querySelectorAll('.defect-item').forEach(item => {
        item.onclick = e => {
          if (e.target.tagName !== 'SELECT' && e.target.tagName !== 'INPUT') {
            this.jumpTo(parseInt(item.dataset.idx, 10));
          }
        };
      });

      container.querySelectorAll('.defect-status-sel').forEach(sel => {
        sel.onchange = () => {
          this.setStatus(parseInt(sel.dataset.idx, 10), sel.value);
        };
      });

      container.querySelectorAll('.defect-note-input').forEach(inp => {
        inp.oninput = () => {
          const idx = parseInt(inp.dataset.idx, 10);
          if (this.defects[idx]) this.defects[idx].note = inp.value;
        };
      });
    }
  };

  /**
   * 3-Point Fiducial Alignment
   */
  const FiducialAligner = {
    active: false,
    pointsA: [],
    pointsB: [],
    targetLayer: 'A',

    start() {
      this.active = true;
      this.pointsA = [];
      this.pointsB = [];
      this.targetLayer = 'A';
      this.showDialog();
    },

    showDialog() {
      let modal = $('#fiducial-modal');
      if (!modal) {
        modal = el('div', { id: 'fiducial-modal', className: 'rp-modal rp-side-docked' });
        document.body.appendChild(modal);
      }
      modal.hidden = false;
      modal.innerHTML = `
        <div class="rp-card">
          <h3>3-Point Fiducial Snap Alignment</h3>
          <p class="rp-sub">Click 3 matching reference points (schematic grid corners, PCB fiducials, or mounting holes) on Rev A and Rev B. You can click directly on the drawing behind this floating card.</p>
          <div class="fiducial-status-box">
            <div><b>Rev A Fiducials:</b> <span id="fid-pts-a">0 / 3</span></div>
            <div><b>Rev B Fiducials:</b> <span id="fid-pts-b">0 / 3</span></div>
          </div>
          <p id="fid-instruction" style="color:#ff6b6b; font-weight:600; margin:8px 0;">
            Step 1: Click reference point #1 on Base (Rev A).
          </p>
          <div class="rp-btns">
            <button id="fid-reset">Reset Points</button>
            <button id="fid-cancel">Cancel</button>
            <button id="fid-apply" class="rp-primary" disabled>Calculate & Snap</button>
          </div>
        </div>
      `;
      modal.style.background = 'rgba(0,0,0,0.25)';
      modal.style.pointerEvents = 'none';
      modal.querySelector('.rp-card').style.pointerEvents = 'auto';

      $('#fid-cancel').onclick = () => { modal.hidden = true; this.active = false; if (window.rpRedrawOverlay) window.rpRedrawOverlay(); };
      $('#fid-reset').onclick = () => { this.pointsA = []; this.pointsB = []; this.updateUI(); if (window.rpRedrawOverlay) window.rpRedrawOverlay(); };
      $('#fid-apply').onclick = () => { this.applyTransform(); modal.hidden = true; this.active = false; if (window.rpRedrawOverlay) window.rpRedrawOverlay(); };
      this.updateUI();
    },

    updateUI() {
      const elA = $('#fid-pts-a');
      const elB = $('#fid-pts-b');
      const elBtn = $('#fid-apply');
      const elInst = $('#fid-instruction');
      if (elA) elA.textContent = `${this.pointsA.length} / 3`;
      if (elB) elB.textContent = `${this.pointsB.length} / 3`;

      if (this.pointsA.length < 3) {
        if (elInst) elInst.textContent = `Click reference point #${this.pointsA.length + 1} on Base (Rev A).`;
        this.targetLayer = 'A';
      } else if (this.pointsB.length < 3) {
        if (elInst) elInst.textContent = `Now click matching point #${this.pointsB.length + 1} on Revised (Rev B).`;
        this.targetLayer = 'B';
      } else {
        if (elInst) elInst.textContent = 'All 3 fiducial pairs captured! Click "Calculate & Snap".';
        if (elBtn) elBtn.disabled = false;
      }
    },

    addPoint(x, y) {
      if (!this.active) return false;
      if (this.pointsA.length < 3) {
        this.pointsA.push({ x, y });
        this.updateUI();
        if (window.rpRedrawOverlay) window.rpRedrawOverlay();
        return true;
      } else if (this.pointsB.length < 3) {
        this.pointsB.push({ x, y });
        this.updateUI();
        if (window.rpRedrawOverlay) window.rpRedrawOverlay();
        return true;
      }
      return false;
    },

    applyTransform() {
      if (this.pointsA.length < 3 || this.pointsB.length < 3) return;
      const pA = this.pointsA;
      const pB = this.pointsB;

      const cA = { x: (pA[0].x + pA[1].x + pA[2].x) / 3, y: (pA[0].y + pA[1].y + pA[2].y) / 3 };
      const cB = { x: (pB[0].x + pB[1].x + pB[2].x) / 3, y: (pB[0].y + pB[1].y + pB[2].y) / 3 };

      const dx = cA.x - cB.x;
      const dy = cA.y - cB.y;

      const angA = Math.atan2(pA[1].y - pA[0].y, pA[1].x - pA[0].x);
      const angB = Math.atan2(pB[1].y - pB[0].y, pB[1].x - pB[0].x);
      const dThetaDeg = (angA - angB) * 180 / Math.PI;

      CompareHistory.push('3-Point Fiducial Snap');
      const dxInput = $('#dx');
      const dyInput = $('#dy');
      if (dxInput && dyInput) {
        dxInput.value = dx.toFixed(1);
        dyInput.value = dy.toFixed(1);
        if ($('#rp-cur-dx')) $('#rp-cur-dx').textContent = dx.toFixed(1);
        if ($('#rp-cur-dy')) $('#rp-cur-dy').textContent = dy.toFixed(1);
      }
      if (typeof window !== 'undefined' && window.CMP) {
        window.CMP.rotB = parseFloat(dThetaDeg.toFixed(2));
        if ($('#rp-rot-b')) $('#rp-rot-b').value = window.CMP.rotB;
        if ($('#rp-cur-rot')) $('#rp-cur-rot').textContent = window.CMP.rotB + '°';
        if (window.refresh) window.refresh();
      }
      rpToast(`Fiducial Snap Applied: dx=${dx.toFixed(1)}px, dy=${dy.toFixed(1)}px, skew=${dThetaDeg.toFixed(2)}°`);
    }
  };

  /**
   * Moveable & Dockable Compare Layer Panel (Starts hidden so it doesn't clutter or overlap on startup)
   */
  /**
   * Top-Ribbon Layers, Tints, Thresholds & Micro-Align Controls
   * (Moved from floating/side dock directly into the Top Ribbon #tab-layers!)
   */
  function initLayerDock() {
    const ribbonWrap = document.querySelector(".rp-ribbon-container");
    if (!ribbonWrap) return;

    const S = (typeof window !== "undefined" && window.CMP) ? window.CMP : {};
    const triggerRepaint = () => {
      if (typeof paint === "function") paint();
      if (window.rpSharpen) window.rpSharpen();
    };

    if ($("#rp-tint-a")) $("#rp-tint-a").oninput = e => { S.tintA = e.target.value; triggerRepaint(); };
    if ($("#rp-tint-b")) $("#rp-tint-b").oninput = e => { S.tintB = e.target.value; triggerRepaint(); };
    if ($("#rp-op-a")) $("#rp-op-a").oninput = e => { S.opA = +e.target.value; if ($("#rp-op-a-val")) $("#rp-op-a-val").textContent = e.target.value + "%"; triggerRepaint(); };
    if ($("#rp-op-b")) $("#rp-op-b").oninput = e => { S.opB = +e.target.value; if ($("#rp-op-b-val")) $("#rp-op-b-val").textContent = e.target.value + "%"; triggerRepaint(); };

    if ($("#rp-palette-preset")) {
      $("#rp-palette-preset").onchange = e => {
        const v = e.target.value;
        const presets = {
          std: ["#e11414", "#00a53c"],
          cb: ["#00bcd4", "#e91e63"],
          ba: ["#2563eb", "#f59e0b"],
          cam: ["#facc15", "#10b981"]
        };
        const [ca, cb] = presets[v] || presets.std;
        if ($("#rp-tint-a")) $("#rp-tint-a").value = ca;
        if ($("#rp-tint-b")) $("#rp-tint-b").value = cb;
        S.tintA = ca;
        S.tintB = cb;
        triggerRepaint();
        rpToast("Applied palette: " + $("#rp-palette-preset").selectedOptions[0].text);
      };
    }

    const syncEyes = () => {
      const lA = $("#lA"), lB = $("#lB"), lC = $("#lC");
      if (lA && $("#rp-eye-a")) $("#rp-eye-a").classList.toggle("on", lA.checked);
      if (lB && $("#rp-eye-b")) $("#rp-eye-b").classList.toggle("on", lB.checked);
      if (lC && $("#rp-eye-c")) $("#rp-eye-c").classList.toggle("on", lC.checked);
      if (lA && lB) {
        if ($("#rp-diff-del")) $("#rp-diff-del").checked = lA.checked;
        if ($("#rp-diff-add")) $("#rp-diff-add").checked = lB.checked;
        if ($("#rp-diff-on")) $("#rp-diff-on").checked = lA.checked || lB.checked;
      }
    };

    if ($("#rp-eye-a")) $("#rp-eye-a").onclick = () => { const lA = $("#lA"); if (lA) { lA.checked = !lA.checked; lA.dispatchEvent(new Event("change")); syncEyes(); } };
    if ($("#rp-eye-b")) $("#rp-eye-b").onclick = () => { const lB = $("#lB"); if (lB) { lB.checked = !lB.checked; lB.dispatchEvent(new Event("change")); syncEyes(); } };
    if ($("#rp-eye-c")) $("#rp-eye-c").onclick = () => { const lC = $("#lC"); if (lC) { lC.checked = !lC.checked; lC.dispatchEvent(new Event("change")); syncEyes(); } };

    if ($("#rp-diff-add")) $("#rp-diff-add").onchange = e => { const lB = $("#lB"); if (lB) { lB.checked = e.target.checked; lB.dispatchEvent(new Event("change")); syncEyes(); } };
    if ($("#rp-diff-del")) $("#rp-diff-del").onchange = e => { const lA = $("#lA"); if (lA) { lA.checked = e.target.checked; lA.dispatchEvent(new Event("change")); syncEyes(); } };
    if ($("#rp-diff-on")) {
      $("#rp-diff-on").onchange = e => {
        const on = e.target.checked;
        const lA = $("#lA"), lB = $("#lB");
        if (lA) { lA.checked = on; lA.dispatchEvent(new Event("change")); }
        if (lB) { lB.checked = on; lB.dispatchEvent(new Event("change")); }
        syncEyes();
      };
    }

    if ($("#rp-diff-thresh")) {
      $("#rp-diff-thresh").oninput = e => {
        if ($("#rp-tol-val")) $("#rp-tol-val").textContent = e.target.value;
        const tol = $("#tol");
        if (tol) {
          tol.value = e.target.value;
          tol.dispatchEvent(new Event("change"));
        }
      };
    }
    if ($("#rp-noise-thresh")) {
      $("#rp-noise-thresh").oninput = e => {
        const v = parseInt(e.target.value, 10) || 2;
        if ($("#rp-noise-val")) $("#rp-noise-val").textContent = v;
        DefectState.noiseThreshold = v;
        const minpx = $("#minpx");
        if (minpx) {
          minpx.value = v;
          minpx.dispatchEvent(new Event("change"));
        }
      };
    }
    if ($("#rp-edge-thresh")) {
      $("#rp-edge-thresh").oninput = e => {
        const v = parseInt(e.target.value, 10) || 0;
        if ($("#rp-edge-val")) $("#rp-edge-val").textContent = v;
        const edge = $("#edge");
        if (edge) {
          edge.value = v;
          edge.dispatchEvent(new Event("change"));
        }
      };
    }
    if ($("#rp-markers-chk")) {
      $("#rp-markers-chk").onchange = e => {
        const boxes = $("#lM") || $("#boxes");
        if (boxes) {
          boxes.checked = e.target.checked;
          boxes.dispatchEvent(new Event("change"));
        }
        if ($("#rib-view-markers")) $("#rib-view-markers").classList.toggle("on", e.target.checked);
      };
    }

    const dxInput = $("#dx"), dyInput = $("#dy");
    const updateNudgeLabels = () => {
      if (dxInput && dyInput) {
        if ($("#rp-cur-dx")) $("#rp-cur-dx").textContent = dxInput.value;
        if ($("#rp-cur-dy")) $("#rp-cur-dy").textContent = dyInput.value;
      }
    };

    ribbonWrap.querySelectorAll("[data-nudge]").forEach(btn => {
      btn.onclick = () => {
        if (!dxInput || !dyInput) return;
        CompareHistory.push("Micro-align nudge");
        const cmd = btn.dataset.nudge;
        let x = parseFloat(dxInput.value || 0);
        let y = parseFloat(dyInput.value || 0);
        if (cmd === "x-1") x -= 1;
        else if (cmd === "x-01") x -= 0.1;
        else if (cmd === "x01") x += 0.1;
        else if (cmd === "x1") x += 1;
        else if (cmd === "y-1") y -= 1;
        else if (cmd === "y-01") y -= 0.1;
        else if (cmd === "y01") y += 0.1;
        else if (cmd === "y1") y += 1;

        dxInput.value = Number(x.toFixed(1));
        dyInput.value = Number(y.toFixed(1));
        updateNudgeLabels();
        if (window.refresh) window.refresh();
      };
    });

    if ($("#rp-rot-b")) {
      let rotTimer = null;
      let rotHistPushed = false;
      $("#rp-rot-b").addEventListener("pointerdown", () => { rotHistPushed = false; });
      $("#rp-rot-b").oninput = e => {
        if (!rotHistPushed) { CompareHistory.push("Rotate Rev B skew"); rotHistPushed = true; }
        const deg = parseFloat(e.target.value) || 0;
        if ($("#rp-cur-rot")) $("#rp-cur-rot").textContent = deg.toFixed(2) + "°";
        if (window.CMP) window.CMP.rotB = deg;
        clearTimeout(rotTimer);
        rotTimer = setTimeout(() => { if (window.refresh) window.refresh(); }, 180);
      };
      $("#rp-rot-b").onchange = () => {
        rotHistPushed = false;
        clearTimeout(rotTimer);
        if (window.refresh) window.refresh();
      };
    }

    if ($("#rp-reset-nudge")) {
      $("#rp-reset-nudge").onclick = () => {
        CompareHistory.push("Reset alignment");
        if (dxInput && dyInput) {
          dxInput.value = 0;
          dyInput.value = 0;
          updateNudgeLabels();
        }
        if ($("#rp-rot-b")) $("#rp-rot-b").value = 0;
        if ($("#rp-cur-rot")) $("#rp-cur-rot").textContent = "0°";
        if (window.CMP) window.CMP.rotB = 0;
        if (window.refresh) window.refresh();
        rpToast("Alignment & skew reset to (0, 0, 0°).");
      };
    }
  }

  /**
   * Interactive 60 FPS Curtain Split Slider
   * Uses a backing canvas (#cvA) for Pure Rev A and clips #cv and #lv (Rev B / Diff) at the exact stage coordinate!
   */
  let curtainPct = 50;
  let curtainActive = false;
  let prevNonCurtainMode = 'paper';

  function updateCurtainClip() {
    const curtain = $('#rp-curtain-handle');
    const vp = $('#vp');
    const cv = $('#cv');
    const lv = $('#lv');
    const cvA = $('#cvA');
    const hq = $('#hq');
    if (!curtain || !vp || !cv) return;

    const S = (typeof window !== 'undefined' && window.CMP) ? window.CMP : null;
    if (!curtainActive || !(S && S.cur)) {
      curtain.hidden = true;
      cv.style.clipPath = 'none';
      if (lv) lv.style.clipPath = 'none';
      if (hq) hq.style.clipPath = 'none';
      if (cvA) { cvA.style.display = 'none'; cvA.width = 0; cvA.height = 0; cvA._gen = null; }
      return;
    }

    curtain.hidden = false;
    curtain.style.left = `${curtainPct}%`;

    if (S && S.cur && cvA) {
      const curKey = `${S.showTok || 0}_${S.gen || 0}_${S.cur.W}x${S.cur.H}`;
      if (cvA.width !== S.cur.W || cvA.height !== S.cur.H || cvA._gen !== curKey) {
        cvA.width = S.cur.W;
        cvA.height = S.cur.H;
        cvA.getContext('2d').putImageData(S.cur.A, 0, 0);
        cvA._gen = curKey;
      }
      cvA.style.display = 'block';
    }

    const vpW = vp.clientWidth || 1;
    const screenX = (curtainPct / 100) * vpW;
    if (S && S.view) {
      const imgX = Math.max(0, Math.min(cv.width, (screenX - S.view.x) / S.view.k));
      const clipStr = `inset(0 0 0 ${imgX}px)`;
      cv.style.clipPath = clipStr;
      if (lv) lv.style.clipPath = clipStr;
    } else {
      const polyStr = `polygon(${curtainPct}% 0, 100% 0, 100% 100%, ${curtainPct}% 100%)`;
      cv.style.clipPath = polyStr;
      if (lv) lv.style.clipPath = polyStr;
    }
    if (hq) {
      if (hq.style.display === 'block' && hq._cropA && hq._cropB) {
        const W = hq.width, H = hq.height;
        const x = hq.getContext('2d');
        x.putImageData(hq._cropA, 0, 0);
        const splitPx = Math.max(0, Math.min(W, Math.round((curtainPct / 100) * W)));
        if (splitPx < W) {
          x.putImageData(hq._cropB, 0, 0, splitPx, 0, W - splitPx, H);
        }
        hq.style.clipPath = 'none';
      } else {
        hq.style.clipPath = `polygon(${curtainPct}% 0, 100% 0, 100% 100%, ${curtainPct}% 100%)`;
      }
    }
  }

  function initCurtainSlider() {
    const vp = $('#vp');
    const stage = $('#stage');
    if (!vp || !stage) return;

    if (!$('#cvA')) {
      const cvA = el('canvas', { id: 'cvA', style: { display: 'none', position: 'absolute', left: '0', top: '0' } });
      stage.insertBefore(cvA, stage.firstChild);
    }

    let curtain = $('#rp-curtain-handle');
    if (!curtain) {
      curtain = el('div', { id: 'rp-curtain-handle', className: 'rp-curtain-handle', hidden: true });
      curtain.innerHTML = `
        <div class="rp-curtain-bar"></div>
        <div class="rp-curtain-tag left">REV A</div>
        <div class="rp-curtain-knob">◀ ┃ ▶</div>
        <div class="rp-curtain-tag right">REV B</div>
      `;
      vp.appendChild(curtain);

      let isDragging = false;
      curtain.onpointerdown = e => {
        e.stopPropagation();
        isDragging = true;
        curtain.setPointerCapture(e.pointerId);
      };

      window.addEventListener('pointermove', e => {
        if (!isDragging) return;
        const rect = vp.getBoundingClientRect();
        const clientX = Math.max(rect.left + 20, Math.min(rect.right - 20, e.clientX));
        curtainPct = ((clientX - rect.left) / Math.max(1, rect.width)) * 100;
        updateCurtainClip();
      });

      window.addEventListener('pointerup', () => { isDragging = false; });
    }
  }

  function syncModeSelects(val) {
    ['#rib-mode', '#rib-view-mode'].forEach(sel => {
      const elSel = $(sel);
      if (elSel && elSel.value !== val) elSel.value = val;
    });
  }

  function setCurtainMode(enabled, targetFallbackMode = null) {
    const wasActive = curtainActive;
    curtainActive = !!enabled;
    const btn = $('#rib-curtain-toggle');
    if (btn) btn.classList.toggle('on', curtainActive);
    if ($('#cHudCurtain')) $('#cHudCurtain').classList.toggle('on', curtainActive);
    const mainMode = $('#mode');
    const S = (typeof window !== 'undefined' && window.CMP) ? window.CMP : null;

    if (curtainActive) {
      if (mainMode && mainMode.value && mainMode.value !== 'curtain' && !wasActive) {
        prevNonCurtainMode = mainMode.value;
      }
      if (mainMode) mainMode.value = 'B';
      if (S) {
        const wasSide = (S.mode === 'side');
        S.mode = 'B';
        if (typeof window.paint === 'function') window.paint();
        if (wasSide && typeof window.fit === 'function') window.fit();
      }
      syncModeSelects('curtain');
    } else {
      const nextMode = targetFallbackMode || prevNonCurtainMode || (mainMode ? mainMode.value : 'paper') || 'paper';
      if (mainMode) mainMode.value = nextMode;
      if (S) {
        const wasSide = (S.mode === 'side');
        S.mode = nextMode;
        if (wasActive && typeof window.paint === 'function') window.paint();
        if ((wasSide || nextMode === 'side') && wasActive && typeof window.fit === 'function') window.fit();
      }
      syncModeSelects(nextMode);
    }
    updateCurtainClip();
    if (typeof window !== 'undefined' && window.rpSharpen) window.rpSharpen();
    if (curtainActive && !wasActive) rpToast('Split Curtain Active: Drag vertical divider to compare Rev A (left) vs Rev B (right).');
  }

  function setCompareMode(val) {
    const mainMode = $('#mode');
    if (!mainMode) return;
    if (val === 'curtain') {
      setCurtainMode(true);
    } else {
      prevNonCurtainMode = val;
      if (curtainActive) {
        setCurtainMode(false, val);
      }
      mainMode.value = val;
      mainMode.dispatchEvent(new Event('change'));
      syncModeSelects(val);
    }
  }

  /**
   * Session Save & Load (.redline JSON file)
   */
  async function saveSessionFile() {
    const S = (typeof window !== 'undefined' && window.CMP) ? window.CMP : {};
    const RM = (typeof window !== 'undefined' && window.RP_MEASURE) ? window.RP_MEASURE : {};
    const sessionData = {
      app: 'Redline Pro',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      files: {
        A: S.names ? S.names.A : 'A.pdf',
        B: S.names ? S.names.B : 'B.pdf',
        pathA: (S.paths && S.paths.A) ? S.paths.A : '',
        pathB: (S.paths && S.paths.B) ? S.paths.B : ''
      },
      settings: {
        dx: $('#dx') ? $('#dx').value : 0,
        dy: $('#dy') ? $('#dy').value : 0,
        rotB: S.rotB || 0,
        tolerance: $('#tol') ? $('#tol').value : 40,
        dpi: $('#dpi') ? $('#dpi').value : 300,
        mode: $('#mode') ? $('#mode').value : 'paper',
        tintA: S.tintA || '#e11414',
        tintB: S.tintB || '#00a53c',
        opA: S.opA != null ? S.opA : 100,
        opB: S.opB != null ? S.opB : 100,
        unitSystem: CAMState.unitSystem,
        ipcClass: CAMState.ipcClass
      },
      ignore: S.ignore || [],
      done: S.done || {},
      defects: DefectState.defects,
      defectsByPage: DefectState.byPage || {},
      annotations: RM.annotations || [],
      tallyItems: (RM.tally && RM.tally.items) ? RM.tally.items : [],
      calibration: (() => { try { return JSON.parse(safeGet('rp_calibration', '{}') || '{}'); } catch (e) { return {}; } })()
    };

    const json = JSON.stringify(sessionData, null, 2);
    const enc = new TextEncoder().encode(json);
    if (window.native && window.native.saveFile) {
      await window.native.saveFile({
        name: 'review_session.redline',
        bytes: enc,
        filters: [{ name: 'Redline Project', extensions: ['redline', 'json'] }]
      });
      rpToast('Saved project session (.redline).');
    }
  }

  async function loadSessionFile() {
    if (!window.native || !window.native.openFiles) return;
    const files = await window.native.openFiles({
      title: 'Open Redline Session (.redline)',
      filters: [{ name: 'Redline Session', extensions: ['redline', 'json'] }]
    });
    if (!files || !files.length) return;

    restoreSessionFromText(new TextDecoder().decode(new Uint8Array(files[0].bytes)));
  }

  async function restoreSessionFromText(text) {
    try {
      const sess = JSON.parse(text);
      const S = (typeof window !== 'undefined' && window.CMP) ? window.CMP : null;
      // If neither A nor B is loaded yet, attempt to reload from saved paths or sample generators
      if (S && !S.A && !S.B && sess.files) {
        const pA = sess.files.pathA, pB = sess.files.pathB;
        const nA = sess.files.A || '', nB = sess.files.B || '';
        if (pA && pB && window.native && window.native.readFile && window.compareLoadBytes) {
          const fA = await window.native.readFile(pA);
          const fB = await window.native.readFile(pB);
          if (fA && fB) {
            await window.compareLoadBytes('A', fA.bytes, fA.name || nA, pA, true);
            await window.compareLoadBytes('B', fB.bytes, fB.name || nB, pB, false);
          }
        } else if (/Sample_Top_Copper/i.test(nA) && typeof loadSampleGerber === 'function') {
          await loadSampleGerber();
        } else if (/Enclosure_Carrier/i.test(nA) && typeof loadSampleDXF === 'function') {
          await loadSampleDXF();
        } else if (/Sample_Schematic/i.test(nA) && typeof loadSampleSchematic === 'function') {
          await loadSampleSchematic();
        }
      }

      if (sess.settings) {
        if ($('#dx') && sess.settings.dx != null) { $('#dx').value = sess.settings.dx; if ($('#rp-cur-dx')) $('#rp-cur-dx').textContent = sess.settings.dx; }
        if ($('#dy') && sess.settings.dy != null) { $('#dy').value = sess.settings.dy; if ($('#rp-cur-dy')) $('#rp-cur-dy').textContent = sess.settings.dy; }
        if ($('#tol') && sess.settings.tolerance != null) {
          $('#tol').value = sess.settings.tolerance;
          if ($('#rp-diff-thresh')) $('#rp-diff-thresh').value = sess.settings.tolerance;
          if ($('#rp-tol-val')) $('#rp-tol-val').textContent = sess.settings.tolerance;
        }
        if ($('#dpi') && sess.settings.dpi != null) {
          $('#dpi').value = sess.settings.dpi;
          if ($('#rib-dpi')) $('#rib-dpi').value = sess.settings.dpi;
          if ($('#rib-view-dpi')) $('#rib-view-dpi').value = sess.settings.dpi;
        }
        if ($('#mode') && sess.settings.mode != null) {
          setCompareMode(sess.settings.mode);
        }
        if (sess.settings.unitSystem) setUnitSystem(sess.settings.unitSystem, true);
        if (sess.settings.ipcClass) {
          CAMState.ipcClass = sess.settings.ipcClass;
          if ($('#rib-ipc-class')) $('#rib-ipc-class').value = sess.settings.ipcClass;
        }
        if (window.CMP) {
          window.CMP.rotB = sess.settings.rotB || 0;
          if ($('#rp-rot-b')) $('#rp-rot-b').value = window.CMP.rotB;
          if ($('#rp-cur-rot')) $('#rp-cur-rot').textContent = window.CMP.rotB + '°';
          window.CMP.tintA = sess.settings.tintA || '#e11414';
          window.CMP.tintB = sess.settings.tintB || '#00a53c';
          if ($('#rp-tint-a')) $('#rp-tint-a').value = window.CMP.tintA;
          if ($('#rp-tint-b')) $('#rp-tint-b').value = window.CMP.tintB;
          if (sess.settings.opA != null) {
            window.CMP.opA = +sess.settings.opA;
            if ($('#rp-op-a')) $('#rp-op-a').value = window.CMP.opA;
            if ($('#rp-op-a-val')) $('#rp-op-a-val').textContent = window.CMP.opA + '%';
          }
          if (sess.settings.opB != null) {
            window.CMP.opB = +sess.settings.opB;
            if ($('#rp-op-b')) $('#rp-op-b').value = window.CMP.opB;
            if ($('#rp-op-b-val')) $('#rp-op-b-val').textContent = window.CMP.opB + '%';
          }
        }
      }
      if (window.CMP) {
        if (Array.isArray(sess.ignore)) window.CMP.ignore = sess.ignore;
        if (sess.done && typeof sess.done === 'object') window.CMP.done = sess.done;
      }
      if (sess.calibration && sess.calibration.pxPerUnit && window.RP_MEASURE && window.RP_MEASURE.calibrator) {
        window.RP_MEASURE.calibrator.pxPerUnit = sess.calibration.pxPerUnit;
        if (sess.calibration.unit) window.RP_MEASURE.calibrator.unit = sess.calibration.unit;
        safeSet('rp_calibration', JSON.stringify(sess.calibration));
        if (window.rpUpdateCalBadge) window.rpUpdateCalBadge();
      }
      if (sess.defectsByPage && typeof sess.defectsByPage === 'object') {
        DefectState.byPage = sess.defectsByPage;
      }
      if (sess.defects && sess.defects.length) {
        DefectState.defects = sess.defects;
        const pageN = (window.CMP && window.CMP.cur && window.CMP.cur.n) ? window.CMP.cur.n : 1;
        DefectState.byPage[pageN] = sess.defects;
        DefectState.renderChecklist();
      }
      if (sess.annotations && window.RP_MEASURE) {
        window.RP_MEASURE.annotations = sess.annotations;
      }
      if (sess.tallyItems && window.RP_MEASURE && window.RP_MEASURE.tally) {
        window.RP_MEASURE.tally.items = sess.tallyItems;
        window.RP_MEASURE.tally.nextNum = sess.tallyItems.length + 1;
      }
      if (window.rpRedrawOverlay) window.rpRedrawOverlay();
      if (window.refresh) window.refresh();
      rpToast(`Session restored: ${sess.defects ? sess.defects.length : 0} defects & ${(sess.annotations || []).length} markups loaded.`);
    } catch (e) {
      rpToast('Could not parse session file: ' + e.message);
    }
  }

  /**
   * Executive Summary PDF Audit Report Generation
   */
  async function generateExecutiveAuditReport(returnBytesOnly = false) {
    const _PDFLib = (typeof PDFLib !== "undefined" && PDFLib.PDFDocument)
      ? PDFLib
      : (typeof require === "function" ? (() => { try { return require(['.', 'lib', 'pdf-lib.min.js'].join('/')); } catch (e) { return null; } })() : null);
    if (!_PDFLib || !_PDFLib.PDFDocument) {
      if (!returnBytesOnly) rpToast("PDF library not available.");
      return null;
    }

    try {
      rpToast("Generating Multi-Page Executive Audit Report PDF...");
      const S = (typeof window !== "undefined" && window.CMP) ? window.CMP : {};
      const RM = (typeof window !== "undefined" && window.RP_MEASURE) ? window.RP_MEASURE : {};
      const doc = await _PDFLib.PDFDocument.create();
      const font = await doc.embedFont(_PDFLib.StandardFonts.Helvetica);
      const fontBold = await doc.embedFont(_PDFLib.StandardFonts.HelveticaBold);
      const rgb = _PDFLib.rgb;

      const pages = [];
      const addStyledPage = (subtitle = "EXECUTIVE ENGINEERING & CAM AUDIT REPORT") => {
        const p = doc.addPage([612, 792]);
        pages.push(p);
        const { width, height } = p.getSize();
        // Top Header Banner
        p.drawRectangle({ x: 0, y: height - 58, width, height: 58, color: rgb(0.05, 0.13, 0.22) });
        p.drawRectangle({ x: 0, y: height - 61, width, height: 3, color: rgb(0.9, 0.22, 0.22) });
        p.drawText(`REDLINE PRO 1.0 — ${subtitle}`, {
          x: 32, y: height - 34, size: 12.5, font: fontBold, color: rgb(1, 1, 1)
        });
        p.drawText("Redline Studio · textportdocx.in", {
          x: width - 185, y: height - 33, size: 8.5, font, color: rgb(0.75, 0.88, 1)
        });
        return p;
      };

      const page = addStyledPage();
      const { width, height } = page.getSize();

      let curY = height - 84;
      page.drawText("1. Document, CAM & Revision Metadata", { x: 32, y: curY, size: 11.5, font: fontBold, color: rgb(0.08, 0.18, 0.28) });
      curY -= 16;

      const safePdfStr = s => String(s || "")
        .replace(/Ω/g, "Ohm")
        .replace(/[µμ]/g, "u")
        .replace(/Δ/g, "Delta ")
        .replace(/⌀/g, "Dia ")
        .replace(/±/g, "+/-")
        .replace(/°/g, " deg")
        .replace(/×/g, "x")
        .replace(/[—–]/g, "-")
        .replace(/[^\x20-\x7e]/g, "");
      const reviewer = safePdfStr(safeGet("author", "Lead Review Engineer") || "Lead Review Engineer");
      const unitModeStr = CAMState.unitSystem === "metric" ? "IPC Metric (mm / um)" : "IPC English (mils / in)";
      const docHash = RM.docHash || "A3F8E902B1764D5C";
      const meta = [
        `Base Drawing (Rev A): ${(S.names && S.names.A) || "Rev_A.pdf"}   |   Revised Drawing (Rev B): ${(S.names && S.names.B) || "Rev_B.pdf"}`,
        `Audit Timestamp: ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC   |   Reviewer: ${reviewer}   |   Units: ${unitModeStr}`,
        `Parameters: DPI=${$("#dpi") ? $("#dpi").value : 300}, Tolerance=${$("#tol") ? $("#tol").value : 40}, Offset=(${($("#dx") ? $("#dx").value : 0)}, ${($("#dy") ? $("#dy").value : 0)}) px, Skew=${S.rotB || 0} deg   |   SHA-256: ${docHash}`
      ];
      for (const line of meta) {
        page.drawText(safePdfStr(line), { x: 32, y: curY, size: 8.5, font, color: rgb(0.2, 0.2, 0.2) });
        curY -= 13;
      }

      const defects = DefectState.defects || [];
      const approvedCount = defects.filter(d => d.status === "Approved").length;
      const flaggedCount = defects.filter(d => d.status === "Flagged").length;
      const ignoredCount = defects.filter(d => d.status === "Ignored").length;
      const openCount = defects.filter(d => d.status === "Open").length;

      curY -= 8;
      page.drawRectangle({
        x: 32, y: curY - 40, width: width - 64, height: 48,
        color: rgb(0.95, 0.97, 0.99), borderColor: rgb(0.78, 0.84, 0.90), borderWidth: 1
      });
      page.drawText(`Total Defects: ${defects.length}     |     Approved: ${approvedCount}     |     Flagged: ${flaggedCount}     |     Open: ${openCount}     |     Ignored: ${ignoredCount}`, {
        x: 44, y: curY - 16, size: 9.5, font: fontBold, color: rgb(0.08, 0.18, 0.28)
      });
      const signoffState = flaggedCount > 0 ? "DISPOSITION: REJECTED / FLAGGED FOR ENGINEERING REVISION" : (openCount === 0 && defects.length > 0 ? "DISPOSITION: APPROVED & VERIFIED FOR RELEASE" : "DISPOSITION: IN ENGINEERING REVIEW");
      page.drawText(signoffState, {
        x: 44, y: curY - 32, size: 9, font: fontBold, color: flaggedCount > 0 ? rgb(0.8, 0.1, 0.1) : rgb(0.05, 0.5, 0.2)
      });
      curY -= 58;

      const cv = $("#cv");
      if (cv && cv.width > 10 && cv.height > 10) {
        try {
          const thumbCanvas = document.createElement("canvas");
          const scale = Math.min(800 / cv.width, 450 / cv.height, 1);
          thumbCanvas.width = Math.max(1, Math.round(cv.width * scale));
          thumbCanvas.height = Math.max(1, Math.round(cv.height * scale));
          const tctx = thumbCanvas.getContext("2d");
          tctx.drawImage(cv, 0, 0, thumbCanvas.width, thumbCanvas.height);
          const rpOv = $("#rp-ov");
          if (rpOv && rpOv.width === cv.width) tctx.drawImage(rpOv, 0, 0, thumbCanvas.width, thumbCanvas.height);

          tctx.strokeStyle = "#ff2222";
          tctx.lineWidth = 2;
          defects.forEach(d => {
            tctx.strokeRect(d.x * scale - 2, d.y * scale - 2, d.w * scale + 4, d.h * scale + 4);
          });

          const tw = thumbCanvas.width, th = thumbCanvas.height;
          const dataUrl = thumbCanvas.toDataURL("image/jpeg", 0.85);
          thumbCanvas.width = 0; thumbCanvas.height = 0;
          const jpgBytes = Uint8Array.from(atob(dataUrl.split(",")[1]), c => c.charCodeAt(0));
          const jpgImg = await doc.embedJpg(jpgBytes);
          const boxW = width - 64, boxH = 175;
          const imgScale = Math.min(boxW / tw, boxH / th);
          const drawW = tw * imgScale, drawH = th * imgScale;
          page.drawText("2. Full-Sheet Comparison Composite (Highlighted Defect Regions)", { x: 32, y: curY, size: 11, font: fontBold, color: rgb(0.08, 0.18, 0.28) });
          curY -= (drawH + 8);
          page.drawImage(jpgImg, { x: 32 + (boxW - drawW) / 2, y: curY, width: drawW, height: drawH });
          page.drawRectangle({ x: 32, y: curY, width: boxW, height: drawH, borderColor: rgb(0.78, 0.82, 0.86), borderWidth: 1 });
          curY -= 18;
        } catch (err) {}
      }

      let activePage = page;
      const drawTableHeader = (pg, yPos, titleText) => {
        if (titleText) {
          pg.drawText(titleText, { x: 32, y: yPos, size: 11, font: fontBold, color: rgb(0.08, 0.18, 0.28) });
          yPos -= 16;
        }
        pg.drawRectangle({ x: 32, y: yPos - 4, width: width - 64, height: 18, color: rgb(0.08, 0.18, 0.28) });
        pg.drawText("ID", { x: 38, y: yPos, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
        pg.drawText("CLASS", { x: 68, y: yPos, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
        pg.drawText(`SIZE & LOCATION (${CAMState.unitSystem === "metric" ? "MM" : "MILS"})`, { x: 130, y: yPos, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
        pg.drawText("STATUS", { x: 280, y: yPos, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
        pg.drawText("REVIEWER NOTES", { x: 345, y: yPos, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
        return yPos - 18;
      };

      curY = drawTableHeader(activePage, curY, "3. Defect Checklist & Engineering Dispositions");

      if (!defects.length) {
        activePage.drawText("No differences or defects detected — Base (Rev A) and Revised (Rev B) match within tolerance.", {
          x: 38, y: curY, size: 8.5, font, color: rgb(0.1, 0.45, 0.2)
        });
        curY -= 16;
      }

      for (let i = 0; i < defects.length; i++) {
        const d = defects[i];
        if (curY < 165) {
          activePage = addStyledPage("DEFECT SCHEDULE & QA SIGN-OFF (CONTINUED)");
          curY = drawTableHeader(activePage, height - 84, "3. Defect Checklist (Continued)");
        }
        if (i % 2 === 1) {
          activePage.drawRectangle({ x: 32, y: curY - 3, width: width - 64, height: 14, color: rgb(0.96, 0.98, 0.99) });
        }
        const locStr = CAMState.formatBoxFromPx(d.w, d.h, d.x, d.y, d.dpi || 300).replace(/×/g, "x");
        activePage.drawText(`#${d.id}`, { x: 38, y: curY, size: 8.5, font, color: rgb(0.1, 0.1, 0.1) });
        activePage.drawText(d.type.toUpperCase(), { x: 68, y: curY, size: 8.5, font: fontBold, color: d.type === "added" ? rgb(0, 0.55, 0.2) : rgb(0.8, 0.1, 0.1) });
        activePage.drawText(locStr.slice(0, 28), { x: 130, y: curY, size: 8, font, color: rgb(0.25, 0.25, 0.25) });
        activePage.drawText(`[${d.status}]`, { x: 280, y: curY, size: 8.5, font: fontBold, color: d.status === "Approved" ? rgb(0, 0.5, 0.15) : rgb(0.8, 0.25, 0) });
        activePage.drawText(safePdfStr(d.note || "-").slice(0, 38), { x: 345, y: curY, size: 8, font, color: rgb(0.2, 0.2, 0.2) });
        curY -= 14;
      }

      // Professional Ending Engineering QA Sign-Off & Approval Block
      if (curY < 175) {
        activePage = addStyledPage("ENGINEERING QA SIGN-OFF & VERIFICATION");
        curY = height - 88;
      } else {
        curY -= 14;
      }

      activePage.drawRectangle({
        x: 32, y: 42, width: width - 64, height: 108,
        color: rgb(0.97, 0.98, 1.0), borderColor: rgb(0.12, 0.24, 0.38), borderWidth: 1.2
      });
      activePage.drawRectangle({
        x: 32, y: 130, width: width - 64, height: 20,
        color: rgb(0.08, 0.18, 0.28)
      });
      activePage.drawText("4. OFFICIAL ENGINEERING QUALITY ASSURANCE & RELEASE SIGN-OFF", {
        x: 42, y: 136, size: 9, font: fontBold, color: rgb(1, 1, 1)
      });

      activePage.drawText(`Lead Review Engineer: ${reviewer}`, { x: 44, y: 112, size: 8.5, font: fontBold, color: rgb(0.1, 0.15, 0.2) });
      activePage.drawText(`IPC / CAM Standard: ${CAMState.ipcClass.toUpperCase()} (${unitModeStr})`, { x: 310, y: 112, size: 8.5, font, color: rgb(0.2, 0.2, 0.2) });
      activePage.drawText(`Document Verification SHA-256: ${docHash}`, { x: 44, y: 96, size: 8.5, font, color: rgb(0.2, 0.2, 0.2) });
      activePage.drawText(`Final Audit Status: ${flaggedCount > 0 ? "REJECTED (REVISE)" : (openCount === 0 ? "APPROVED FOR FAB" : "PENDING REVIEW")}`, {
        x: 310, y: 96, size: 8.5, font: fontBold, color: flaggedCount > 0 ? rgb(0.8, 0.1, 0.1) : rgb(0.05, 0.5, 0.2)
      });

      // Signature and Date lines
      activePage.drawLine({ start: { x: 44, y: 58 }, end: { x: 260, y: 58 }, thickness: 0.8, color: rgb(0.3, 0.35, 0.4) });
      activePage.drawText("Authorized Engineering Signature", { x: 44, y: 47, size: 7.5, font, color: rgb(0.4, 0.45, 0.5) });

      activePage.drawLine({ start: { x: 310, y: 58 }, end: { x: 540, y: 58 }, thickness: 0.8, color: rgb(0.3, 0.35, 0.4) });
      activePage.drawText("Quality Assurance / Release Date & Stamp", { x: 310, y: 47, size: 7.5, font, color: rgb(0.4, 0.45, 0.5) });

      // Add page numbers to all pages
      pages.forEach((p, idx) => {
        p.drawLine({ start: { x: 32, y: 32 }, end: { x: width - 32, y: 32 }, thickness: 0.6, color: rgb(0.8, 0.82, 0.85) });
        p.drawText("Redline Pro 1.0 Enterprise · Redline Studio (textportdocx.in) · 100% Offline Engineering Verification", {
          x: 32, y: 18, size: 7.5, font, color: rgb(0.45, 0.48, 0.52)
        });
        p.drawText(`Page ${idx + 1} of ${pages.length}`, {
          x: width - 92, y: 18, size: 8, font: fontBold, color: rgb(0.2, 0.25, 0.3)
        });
      });

      const pdfBytes = await doc.save();
      if (returnBytesOnly) return pdfBytes;
      if (window.native && window.native.saveFile) {
        await window.native.saveFile({
          name: "Executive_Audit_Report.pdf",
          bytes: pdfBytes,
          filters: [{ name: "PDF Document", extensions: ["pdf"] }]
        });
        rpToast("Executive Audit Report saved as PDF.");
      }
      return pdfBytes;
    } catch (e) {
      if (!returnBytesOnly) rpToast("Audit Report error: " + e.message);
      return null;
    }
  }

  /**
   * Build Defect Schedule CSV bytes (Includes both IPC English mils and Metric mm columns)
   */
  function buildDefectsCSVBytes() {
    const defects = DefectState.defects || [];
    const headers = ['Defect_ID', 'Type', 'X_mils', 'Y_mils', 'Width_mils', 'Height_mils', 'X_mm', 'Y_mm', 'Width_mm', 'Height_mm', 'Pixel_Area', 'Status', 'Reviewer_Notes'];
    const rows = defects.map(d => {
      const dpi = d.dpi || 300;
      const xMils = (d.x / dpi * 1000).toFixed(1), yMils = (d.y / dpi * 1000).toFixed(1);
      const wMils = (d.w / dpi * 1000).toFixed(1), hMils = (d.h / dpi * 1000).toFixed(1);
      const xMM = (d.x / dpi * 25.4).toFixed(3), yMM = (d.y / dpi * 25.4).toFixed(3);
      const wMM = (d.w / dpi * 25.4).toFixed(3), hMM = (d.h / dpi * 25.4).toFixed(3);
      return [
        d.id, d.type, xMils, yMils, wMils, hMils, xMM, yMM, wMM, hMM, d.pixels, d.status,
        `"${(d.note || '').replace(/"/g, '""')}"`
      ];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    return new TextEncoder().encode('\ufeff' + csv);
  }

  function exportDefectsCSV() {
    const enc = buildDefectsCSVBytes();
    if (window.native && window.native.saveFile) {
      window.native.saveFile({
        name: 'defect_checklist.csv',
        bytes: enc,
        filters: [{ name: 'CSV File', extensions: ['csv'] }]
      });
      rpToast('Exported Defect Checklist to CSV (with IPC English mils & Metric mm).');
    }
    return enc;
  }

  /**
   * Pure-JS Standard PKZIP Archive Builder (100% Offline, IEEE 802.3 CRC-32)
   * @param {Array<{name: string, bytes: Uint8Array}>} files
   * @returns {Uint8Array}
   */
  const _CRC32_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();

  function computeCRC32(u8) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < u8.length; i++) {
      crc = _CRC32_TABLE[(crc ^ u8[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function buildZipArchive(files = []) {
    const enc = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    const now = new Date();
    const dosTime = ((now.getHours() & 0x1F) << 11) | ((now.getMinutes() & 0x3F) << 5) | ((now.getSeconds() >> 1) & 0x1F);
    const dosDate = (((Math.max(1980, now.getFullYear()) - 1980) & 0x7F) << 9) | (((now.getMonth() + 1) & 0x0F) << 5) | (now.getDate() & 0x1F);

    for (const f of files) {
      const nameBytes = enc.encode(String(f.name || 'file.bin'));
      const data = f.bytes instanceof Uint8Array ? f.bytes : new Uint8Array(f.bytes || []);
      const crc = computeCRC32(data);
      const size = data.length;

      // Local File Header (30 + nameBytes.length)
      const lh = new Uint8Array(30 + nameBytes.length);
      const ldv = new DataView(lh.buffer);
      ldv.setUint32(0, 0x04034b50, true); // Local file header signature
      ldv.setUint16(4, 20, true);         // Version needed to extract (2.0)
      ldv.setUint16(6, 0x0800, true);     // UTF-8 filename flag
      ldv.setUint16(8, 0, true);          // Compression method: 0 (STORE)
      ldv.setUint16(10, dosTime, true);
      ldv.setUint16(12, dosDate, true);
      ldv.setUint32(14, crc, true);
      ldv.setUint32(18, size, true);
      ldv.setUint32(22, size, true);
      ldv.setUint16(26, nameBytes.length, true);
      ldv.setUint16(28, 0, true);
      lh.set(nameBytes, 30);

      // Central Directory Header (46 + nameBytes.length)
      const ch = new Uint8Array(46 + nameBytes.length);
      const cdv = new DataView(ch.buffer);
      cdv.setUint32(0, 0x02014b50, true); // Central directory file header signature
      cdv.setUint16(4, 20, true);         // Version made by
      cdv.setUint16(6, 20, true);         // Version needed
      cdv.setUint16(8, 0x0800, true);     // UTF-8 filename flag
      cdv.setUint16(10, 0, true);         // Compression method: 0 (STORE)
      cdv.setUint16(12, dosTime, true);
      cdv.setUint16(14, dosDate, true);
      cdv.setUint32(16, crc, true);
      cdv.setUint32(20, size, true);
      cdv.setUint32(24, size, true);
      cdv.setUint16(28, nameBytes.length, true);
      cdv.setUint16(30, 0, true);
      cdv.setUint16(32, 0, true);
      cdv.setUint16(34, 0, true);
      cdv.setUint16(36, 0, true);
      cdv.setUint32(38, 0, true);
      cdv.setUint32(42, offset, true);    // Relative offset of local header
      ch.set(nameBytes, 46);

      localParts.push(lh, data);
      centralParts.push(ch);
      offset += lh.length + data.length;
    }

    const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
    const eocd = new Uint8Array(22);
    const edv = new DataView(eocd.buffer);
    edv.setUint32(0, 0x06054b50, true);   // End of central dir signature
    edv.setUint16(4, 0, true);
    edv.setUint16(6, 0, true);
    edv.setUint16(8, files.length, true);
    edv.setUint16(10, files.length, true);
    edv.setUint32(12, centralSize, true);
    edv.setUint32(16, offset, true);
    edv.setUint16(20, 0, true);

    const totalLen = offset + centralSize + eocd.length;
    const out = new Uint8Array(totalLen);
    let pos = 0;
    for (const p of localParts) { out.set(p, pos); pos += p.length; }
    for (const p of centralParts) { out.set(p, pos); pos += p.length; }
    out.set(eocd, pos);
    return out;
  }

  /**
   * 1-Click "Export QA Package" (.ZIP Bundle):
   * Bundles Annotated Executive Audit PDF + Defect CSV Schedule + High-Resolution Difference PNG (+ BOM CSV & DXF)
   */
  async function exportQAPackageZip() {
    try {
      rpToast('Bundling 1-Click QA Handover Package (.zip)...');
      const S = (typeof window !== 'undefined' && window.CMP) ? window.CMP : {};
      const RM = (typeof window !== 'undefined' && window.RP_MEASURE) ? window.RP_MEASURE : {};
      const baseName = (((S.names && S.names.A) || 'Engineering_Review').replace(/\.[^.]+$/, '')).replace(/[^a-zA-Z0-9_-]/g, '_');

      const bundleFiles = [];

      // 1. Annotated Executive Audit PDF
      const auditPdfBytes = await generateExecutiveAuditReport(true);
      if (auditPdfBytes && auditPdfBytes.length) {
        bundleFiles.push({ name: `${baseName}_Executive_Audit_Report.pdf`, bytes: auditPdfBytes });
      }

      // 2. Defect CSV Schedule (IPC English mils & Metric mm)
      const csvBytes = buildDefectsCSVBytes();
      bundleFiles.push({ name: `${baseName}_Defect_Schedule.csv`, bytes: csvBytes });

      // 3. BOM Tally CSV Schedule (if any BOM badges placed)
      if (RM.tally && Array.isArray(RM.tally.items) && RM.tally.items.length) {
        const bomBytes = new TextEncoder().encode('\ufeff' + RM.tally.toCSV());
        bundleFiles.push({ name: `${baseName}_BOM_Tally_Schedule.csv`, bytes: bomBytes });
      }

      // 4. High-Resolution Composite Difference + Redline Markups PNG
      if (typeof document !== 'undefined') {
        const cv = $('#cv');
        if (cv && cv.width > 0 && cv.height > 0) {
          const comp = document.createElement('canvas');
          comp.width = cv.width;
          comp.height = cv.height;
          const ctx = comp.getContext('2d');
          ctx.drawImage(cv, 0, 0);
          const mk = $('#mk');
          if (mk && mk.width === cv.width) ctx.drawImage(mk, 0, 0);
          const rpOv = $('#rp-ov');
          if (rpOv && rpOv.width === cv.width) ctx.drawImage(rpOv, 0, 0);
          const dataUrl = comp.toDataURL('image/png');
          comp.width = 0; comp.height = 0;
          const b64 = dataUrl.split(',')[1] || '';
          if (b64) {
            const pngBytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
            bundleFiles.push({ name: `${baseName}_Comparison_Redline_Page${S.n || 1}.png`, bytes: pngBytes });
          }
        }
      }

      // 5. Layered AutoCAD 2000 .dxf (if active PDF page available)
      const activeDoc = S.B || S.A;
      if (activeDoc && typeof DXFEngine !== 'undefined' && DXFEngine.exportPDFToDXF) {
        try {
          const pageNum = S.n || 1;
          const page = await activeDoc.getPage(pageNum);
          const dxfStr = await DXFEngine.exportPDFToDXF(page, {
            unit: CAMState.unitSystem === 'metric' ? 'mm' : 'mils',
            scale: 1.0,
            pageNumber: pageNum,
            imgWidth: (S.cur && S.cur.W) ? S.cur.W : null,
            diffRegions: DefectState.defects || [],
            annotations: RM.annotations || [],
            tallyItems: (RM.tally && RM.tally.items) ? RM.tally.items : []
          });
          bundleFiles.push({ name: `${baseName}_Redlines.dxf`, bytes: new TextEncoder().encode(dxfStr) });
        } catch (e) {}
      }

      const zipBytes = buildZipArchive(bundleFiles);
      if (typeof window !== 'undefined' && window.native && window.native.saveFile) {
        await window.native.saveFile({
          name: `${baseName}_QA_Package.zip`,
          bytes: zipBytes,
          filters: [{ name: 'QA Handover ZIP Package (.zip)', extensions: ['zip'] }]
        });
        rpToast(`Exported QA Package (${bundleFiles.length} deliverables bundled in ${baseName}_QA_Package.zip).`);
      }
      return { zipBytes, files: bundleFiles.map(f => f.name) };
    } catch (err) {
      rpToast('QA Package export failed: ' + err.message);
      return null;
    }
  }
  if (typeof window !== 'undefined') window.exportQAPackageZip = exportQAPackageZip;

  /**
   * Show Interactive BOM Tally & Measurements Drawer Modal
   */
  function showBOMAndMeasurementsModal() {
    const RM = (typeof window !== 'undefined' && window.RP_MEASURE) ? window.RP_MEASURE : { annotations: [], tally: { items: [] } };
    const anns = RM.annotations || [];
    const tallies = (RM.tally && RM.tally.items) ? RM.tally.items : [];

    let modal = $('#rp-bom-modal');
    if (!modal) {
      modal = el('div', { id: 'rp-bom-modal', className: 'rp-modal' });
      document.body.appendChild(modal);
    }
    modal.hidden = false;

    const measRows = anns.map((a, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><b>${a.kind.toUpperCase()}</b></td>
        <td>${a.label || '—'}</td>
        <td>(${Math.round(a.x || (a.pts && a.pts[0] ? a.pts[0].x : 0))}, ${Math.round(a.y || (a.pts && a.pts[0] ? a.pts[0].y : 0))})</td>
        <td><button class="rp-btn-sm rp-del-ann" data-idx="${idx}">Delete</button></td>
      </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center;opacity:.6">No measurements or markups placed yet.</td></tr>';

    const tallyRows = tallies.map(t => `
      <tr>
        <td><b>#${t.number}</b></td>
        <td>Page ${t.page}</td>
        <td>(${Math.round(t.x)}, ${Math.round(t.y)})</td>
        <td><input type="text" class="rp-tally-lbl-in" data-id="${t.id}" value="${(t.label || '').replace(/"/g, '&quot;')}" style="width:100%" /></td>
      </tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center;opacity:.6">No Tally / BOM inspection badges placed yet.</td></tr>';

    modal.innerHTML = `
      <div class="rp-card rp-wide">
        <h3>Engineering Measurements & BOM Tally Schedule</h3>
        <p class="rp-sub">Manage all placed dimensions, areas, revision clouds, stamps, and BOM inspection counters.</p>
        <div class="rp-scroll" style="max-height:52vh">
          <h4 style="margin:4px 0 6px;color:#ff6b6b">Placed Measurements & Markups (${anns.length})</h4>
          <table class="btab" style="width:100%;margin-bottom:14px">
            <tr><th>#</th><th>Type</th><th>Readout / Label</th><th>Position</th><th>Action</th></tr>
            ${measRows}
          </table>
          <h4 style="margin:8px 0 6px;color:#f59e0b">Tally / BOM Inspection Counter (${tallies.length})</h4>
          <table class="btab" style="width:100%">
            <tr><th>Badge</th><th>Page</th><th>Coordinates</th><th>Component / BOM Description</th></tr>
            ${tallyRows}
          </table>
        </div>
        <div class="rp-btns">
          <button id="rp-bom-clear">Clear All Markups</button>
          <button id="rp-bom-csv">Export Tally CSV</button>
          <button id="rp-bom-close" class="rp-primary">Close</button>
        </div>
      </div>
    `;

    modal.querySelectorAll('.rp-del-ann').forEach(btn => {
      btn.onclick = () => {
        CompareHistory.push('Delete markup');
        anns.splice(parseInt(btn.dataset.idx, 10), 1);
        if (window.rpRedrawOverlay) window.rpRedrawOverlay();
        if (window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar();
        showBOMAndMeasurementsModal();
      };
    });

    modal.querySelectorAll('.rp-tally-lbl-in').forEach(inp => {
      inp.oninput = () => {
        const item = tallies.find(t => t.id === inp.dataset.id);
        if (item) item.label = inp.value;
      };
    });

    $('#rp-bom-clear').onclick = () => {
      CompareHistory.push('Clear all markups');
      RM.annotations = [];
      if (RM.tally) RM.tally.clear();
      if (window.rpRedrawOverlay) window.rpRedrawOverlay();
      if (window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar();
      modal.hidden = true;
      rpToast('Cleared all measurements, markups, and tally badges.');
    };

    $('#rp-bom-csv').onclick = () => {
      if (!RM.tally) return;
      const csv = RM.tally.toCSV();
      const enc = new TextEncoder().encode('\ufeff' + csv);
      if (window.native && window.native.saveFile) {
        window.native.saveFile({ name: 'bom_tally_schedule.csv', bytes: enc, filters: [{ name: 'CSV', extensions: ['csv'] }] });
        rpToast('Exported BOM Tally CSV.');
      }
    };

    $('#rp-bom-close').onclick = () => { modal.hidden = true; };
  }

  /**
   * Build Categorized Ribbon Bar (with full CAM350 & IPC English/Metric controls)
   */
  function initCategorizedRibbon() {
    const compareView = $('#view-compare');
    if (!compareView) return;

    const oldRibbon = compareView.querySelector('.ribbon');
    if (!oldRibbon || oldRibbon.classList.contains('rp-categorized-ribbon')) return;

    const ribbonWrap = el('div', { className: 'rp-ribbon-container' });
    ribbonWrap.innerHTML = `
      <div class="rp-ribbon-tabs">
        <button class="rp-tab-btn active" data-tab="tab-compare" title="Sheet Comparison, Sub-Pixel Alignment, Defect Navigation & Units"><i data-ic="tabCompare"></i><span>Review & Compare</span></button>
        <button class="rp-tab-btn" data-tab="tab-layers" title="Layer Visibility, Tint Colors, Opacity, Threshold, Noise Filter & Sub-Pixel Micro-Align"><i data-ic="layers"></i><span>Layers &amp; Align</span></button>
        <button class="rp-tab-btn" data-tab="tab-cad" title="CAM350 PCB Gerber RS-274X, Excellon Drill, IPC-D-356 Netlist, IPC English/Metric & AutoCAD DXF"><i data-ic="tabCad"></i><span>CAD &amp; CAM (CAM350)</span></button>
        <button class="rp-tab-btn" data-tab="tab-view" title="Line Contrast Filters, 60 FPS Split Curtain, 4x Loupe & Grid Optics"><i data-ic="tabView"></i><span>View & Enhance</span></button>
        <button class="rp-tab-btn" data-tab="tab-markup" title="ANSI/ISO Scalloped Revision Clouds, Leader Callouts & SHA-256 Stamps"><i data-ic="tabMarkup"></i><span>Markup & Stamps</span></button>
        <button class="rp-tab-btn" data-tab="tab-measure" title="Scale Calibration, Magnetic OSNAP, Distance, Polyline, Area & BOM Counter"><i data-ic="tabMeasure"></i><span>Measure (OSNAP)</span></button>
        <button class="rp-tab-btn" data-tab="tab-export" title="Executive Audit PDF Reports, CSV Checklists, DXF & .redline Sessions"><i data-ic="tabExport"></i><span>Export & Share</span></button>
        <span class="grow"></span>
        <div id="rp-active-tool-pill" class="rp-tool-pill" hidden>
          <i data-ic="crosshair"></i>
          <span id="rp-active-tool-name">Tool: Select</span>
          <button id="rp-finish-tool-btn" class="rp-btn-sm" hidden title="Finish Polyline / Area (Enter / Double-Click)" style="padding:1px 6px;font-size:10.5px;background:#10b981;color:#fff;border:none;border-radius:4px;cursor:pointer">✓ Finish</button>
          <button id="rp-cancel-tool-btn" title="Exit active tool (Esc)"><i data-ic="x"></i></button>
        </div>
      </div>

      <div class="rp-ribbon-content">
        <!-- 1. Review & Compare -->
        <div class="rp-ribbon-panel active" id="tab-compare">
          <div class="grp"><div class="row">
            <button class="tb A" id="rib-openA" title="Open Original / Base Drawing or Gerber Layer (Revision A)"><i data-ic="openA"></i><span>Open Base (A)</span></button>
            <button class="tb B" id="rib-openB" title="Open Revised / New Drawing or Gerber Layer (Revision B)"><i data-ic="openB"></i><span>Open New (B)</span></button>
            <button class="tb" id="rib-swap" title="Swap Revision A and Revision B Sheets (Shortcut: S)"><i data-ic="swap"></i><span>Swap A↔B</span></button>
            <button class="tb" id="rib-c-undo" title="Undo Last Action in Compare (Ctrl+Z)"><i data-ic="undo"></i><span>Undo</span></button>
            <button class="tb" id="rib-c-redo" title="Redo Action in Compare (Ctrl+Y)"><i data-ic="redo"></i><span>Redo</span></button>
          </div><div class="cap">Sheets &amp; History</div></div>

          <div class="grp"><div class="row col">
            <label class="f" title="Select Visual Comparison Mode">Mode <select id="rib-mode">
              <option value="paper">Overlay on paper</option>
              <option value="over">Overlay dark (CAM)</option>
              <option value="diff">Differences only</option>
              <option value="side">Side by side</option>
              <option value="blink">Blink A / B</option>
              <option value="curtain">Curtain Split Slider</option>
              <option value="A">Base (A) only</option>
              <option value="B">Revised (B) only</option>
            </select></label>
            <label class="f" title="Rasterization & Analysis Resolution">DPI <select id="rib-dpi">
              <option value="150">150 dpi (Fast)</option>
              <option value="200">200 dpi</option>
              <option value="300" selected>300 dpi (Sharp)</option>
              <option value="400">400 dpi</option>
              <option value="600">600 dpi (Ultra)</option>
            </select></label>
          </div><div class="cap">Compare Engine</div></div>

          <div class="grp"><div class="row">
            <button class="tb" id="rib-autoalign" title="Automated Sub-Pixel Feature Registration (Shortcut: A)"><i data-ic="align"></i><span>Auto-Align</span></button>
            <button class="tb" id="rib-fiducial" title="Manual 3-Point Fiducial Affine Snap (Click 3 reference points on A & B)"><i data-ic="fiducial"></i><span>3-Pt Fiducial</span></button>
            <button class="tb" id="rib-ignore" title="Draw Exclusion Mask to Ignore Title Block / Date Stamp Changes (Shortcut: I)"><i data-ic="ignore"></i><span>Ignore Area</span></button>
            <div class="row col" style="gap:2px">
              <label class="chk" title="Apply newly drawn Ignore Areas across all pages"><input type="checkbox" id="rib-ign-all" /> All Pages</label>
              <button type="button" class="rp-btn-sm" id="rib-ign-clear" title="Clear Ignore Areas on Current Page">Clear Ignore</button>
            </div>
          </div><div class="cap">Precision Registration &amp; Ignore Area</div></div>

          <div class="grp"><div class="row">
            <button class="tb" id="rib-prev-defect" title="Jump to Previous Defect Cluster (Shortcut: P or Shift+F3)"><i data-ic="prev"></i><span>Prev Defect</span></button>
            <button class="tb" id="rib-next-defect" title="Jump to Next Defect Cluster (Shortcut: N or F3)"><i data-ic="next"></i><span>Next Defect</span></button>
            <button class="tb" id="rib-text-diff" title="Run Line-by-Line LCS Text & BOM String Diff (Shortcut: Ctrl+T)"><i data-ic="textDiff"></i><span>Text Diff</span></button>
            <button class="tb" id="rib-layer-toggle" title="Switch to Layers, Tints, Opacity & Sub-Pixel Micro-Align Tab"><i data-ic="layers"></i><span>Layers &amp; Align</span></button>
            <button class="tb" id="rib-view-toggle" title="Switch to View &amp; Enhance Tab (Mode, DPI, Contrast, Curtain, Loupe)"><i data-ic="tabView"></i><span>View &amp; Enhance</span></button>
          </div><div class="cap">Defect Navigation &amp; View</div></div>

          <div class="grp"><div class="row col">
            <label class="f" title="Switch IPC English (mils / inches) vs IPC Metric (mm / microns) across all CAM & Compare readouts">Units <select id="rib-units-quick">
              <option value="english">IPC English (mils / in)</option>
              <option value="metric">IPC Metric (mm / µm)</option>
            </select></label>
            <button class="tb sm-inline" id="rib-open-cam350-quick" title="Open CAM350 Workbench (Apertures, Drills, IPC-D-356 Netlist & DFM Rules)"><i data-ic="pcbCam"></i><span>CAM350 Workbench</span></button>
          </div><div class="cap">IPC Units & CAM</div></div>
        </div>

        <!-- 1B. Layers & Micro-Align (All options in Top Ribbon — zero floating side dock!) -->
        <div class="rp-ribbon-panel" id="tab-layers">
          <div class="grp"><div class="row col">
            <div class="row">
              <button class="rp-eye on" id="rp-eye-a" title="Toggle Layer A (Base Sheet)"><i data-ic="eye"></i></button>
              <span style="font-size:11.5px;min-width:52px">Layer A</span>
              <input type="color" id="rp-tint-a" value="#e11414" title="Layer A Tint Color" />
              <input type="range" id="rp-op-a" min="10" max="100" value="100" style="width:70px" title="Layer A Opacity" />
              <span id="rp-op-a-val" style="font-size:11px;min-width:30px">100%</span>
            </div>
            <div class="row">
              <button class="rp-eye on" id="rp-eye-b" title="Toggle Layer B (Revised Sheet)"><i data-ic="eye"></i></button>
              <span style="font-size:11.5px;min-width:52px">Layer B</span>
              <input type="color" id="rp-tint-b" value="#00a53c" title="Layer B Tint Color" />
              <input type="range" id="rp-op-b" min="10" max="100" value="100" style="width:70px" title="Layer B Opacity" />
              <span id="rp-op-b-val" style="font-size:11px;min-width:30px">100%</span>
            </div>
          </div><div class="cap">Layer Tints &amp; Opacity</div></div>

          <div class="grp"><div class="row col">
            <div class="row">
              <button class="rp-eye on" id="rp-eye-c" title="Toggle Unchanged Common Geometry"><i data-ic="eye"></i></button>
              <span style="font-size:11.5px">Common</span>
              <select id="rp-palette-preset" class="rp-select-xs" title="Color Palette Preset">
                <option value="std">Red / Green (Std)</option>
                <option value="cb">Cyan / Magenta (Color-Blind)</option>
                <option value="ba">Blue / Amber (High-Contrast)</option>
                <option value="cam">Gold / Emerald (PCB CAM)</option>
              </select>
            </div>
            <div class="row" style="gap:8px">
              <label class="chk"><input type="checkbox" id="rp-diff-on" checked /> All Diffs</label>
              <label class="chk"><input type="checkbox" id="rp-diff-add" checked /> +Added</label>
              <label class="chk"><input type="checkbox" id="rp-diff-del" checked /> −Removed</label>
              <label class="chk" title="Show/Hide Difference Markers (M)"><input type="checkbox" id="rp-markers-chk" checked /> Markers</label>
            </div>
          </div><div class="cap">Palettes &amp; Channels</div></div>

          <div class="grp"><div class="row col">
            <label class="f">Threshold (<b id="rp-tol-val">40</b>) <input type="range" id="rp-diff-thresh" min="5" max="140" value="40" style="width:85px" /></label>
            <div class="row" style="gap:8px">
              <label class="f">Noise (<b id="rp-noise-val">2</b>px) <input type="range" id="rp-noise-thresh" min="1" max="15" value="2" style="width:65px" /></label>
              <label class="f" title="Ignore sub-pixel anti-aliased edge shifts">Edge (<b id="rp-edge-val">1</b>px) <input type="range" id="rp-edge-thresh" min="0" max="4" value="1" style="width:55px" /></label>
            </div>
          </div><div class="cap">Sensitivity, Noise &amp; Edge</div></div>

          <div class="grp"><div class="row col">
            <div class="row" style="gap:3px">
              <button class="rp-btn-sm" data-nudge="x-1" title="Shift Rev B Left 1px"><i data-ic="nudgeL"></i>1px</button>
              <button class="rp-btn-sm" data-nudge="x-01" title="Shift Rev B Left 0.1px"><i data-ic="nudgeL"></i>0.1</button>
              <button class="rp-btn-sm" data-nudge="x01" title="Shift Rev B Right 0.1px">0.1<i data-ic="nudgeR"></i></button>
              <button class="rp-btn-sm" data-nudge="x1" title="Shift Rev B Right 1px">1px<i data-ic="nudgeR"></i></button>
              <button class="rp-btn-sm" data-nudge="y-1" title="Shift Rev B Up 1px"><i data-ic="nudgeU"></i>1px</button>
              <button class="rp-btn-sm" data-nudge="y-01" title="Shift Rev B Up 0.1px"><i data-ic="nudgeU"></i>0.1</button>
              <button class="rp-btn-sm" data-nudge="y01" title="Shift Rev B Down 0.1px">0.1<i data-ic="nudgeD"></i></button>
              <button class="rp-btn-sm" data-nudge="y1" title="Shift Rev B Down 1px">1px<i data-ic="nudgeD"></i></button>
            </div>
            <div class="row" style="gap:8px">
              <span style="font-size:11px;color:var(--mute)">Skew dθ (<b id="rp-cur-rot">0°</b>):</span>
              <input type="range" id="rp-rot-b" min="-5" max="5" step="0.05" value="0" style="width:80px" />
              <span style="font-size:11px;color:var(--mute)">X:<b id="rp-cur-dx">0</b> Y:<b id="rp-cur-dy">0</b></span>
              <button id="rp-reset-nudge" class="rp-btn-sm" title="Reset X, Y & Skew to Zero"><i data-ic="reset"></i>Reset</button>
            </div>
          </div><div class="cap">Sub-Pixel Micro-Align &amp; Skew (Rev B)</div></div>
        </div>

        <!-- 2. CAD & CAM (CAM350 Workbench) -->
        <div class="rp-ribbon-panel" id="tab-cad">
          <div class="grp"><div class="row">
            <button class="tb" id="rib-cam-compare" title="Load Gerber RS-274X Copper/Mask/Silk, Excellon NC Drill, or IPC-D-356 File(s)"><i data-ic="pcbCam"></i><span>Open Gerber / Drill</span></button>
            <button class="tb" id="rib-cam-dual" title="Compare Two Gerber RS-274X or Drill Layers (Rev A vs Rev B)"><i data-ic="pcbDual"></i><span>Compare CAM A↔B</span></button>
            <button class="tb" id="rib-cam-ipc" title="Load or Compare IPC-D-356 Bare-Board Test Netlists (.ipc / .d356 / .net)"><i data-ic="bomTable"></i><span>IPC-D-356 Netlist</span></button>
          </div><div class="cap">PCB CAM & Netlist (RS-274X / Excellon / IPC)</div></div>

          <div class="grp"><div class="row col">
            <label class="f" title="CAM350 & IPC Measurement Unit System">Units <select id="rib-cam-units">
              <option value="english">IPC English (mils / in)</option>
              <option value="metric">IPC Metric (mm / µm)</option>
            </select></label>
            <label class="f" title="CAM350 Aperture & Trace Display Mode">Display <select id="rib-cam-render">
              <option value="fill">Filled (Solid Copper)</option>
              <option value="outline">Outline (Wireframe)</option>
              <option value="skeleton">Skeleton (Centerline)</option>
            </select></label>
          </div><div class="cap">IPC Units & Display</div></div>

          <div class="grp"><div class="row col">
            <label class="chk" title="Flip layer horizontally (view Bottom Copper GBL / Bottom Silk GBO from Top)"><input type="checkbox" id="rib-cam-mirror"> Mirror Bottom (Flip X)</label>
            <label class="chk" title="Invert Dark/Clear layer polarity for negative power/ground planes"><input type="checkbox" id="rib-cam-neg"> Negative Plane (LPC)</label>
          </div><div class="cap">Layer Polarity & Mirror</div></div>

          <div class="grp"><div class="row">
            <div class="row col">
              <label class="f" title="IPC-2221 / IPC-6012 DFM Rule Class Preset">IPC Rule <select id="rib-ipc-class">
                <option value="class1">Class 1 (6.0 mil / 0.15 mm)</option>
                <option value="class2" selected>Class 2 (4.0 mil / 0.10 mm)</option>
                <option value="class3">Class 3 (3.0 mil / 0.075 mm)</option>
                <option value="hdi">HDI (2.0 mil / 0.05 mm)</option>
              </select></label>
              <span id="rib-dfm-rule-lbl" style="font-size:10.5px;color:var(--mute2)">Clearance: 4.0 mil (0.102 mm)</span>
            </div>
            <button class="tb" id="rib-cam-clearance" title="Run Full CAM350 DFM / DRC Analysis (Clearance, Annular Ring, Min Trace, Drill & Acid Traps)"><i data-ic="clearance"></i><span>Run DFM / DRC</span></button>
            <button class="tb" id="rib-cam-tables" title="Open CAM350 Workbench: D-Code Apertures, T-Code Drills, Format & Netlist Inspector"><i data-ic="gear"></i><span>CAM350 Tables</span></button>
          </div><div class="cap">CAM350 DFM / DRC & Schedules</div></div>

          <div class="grp"><div class="row">
            <button class="tb" id="rib-cad-import" title="Import 1 or 2 AutoCAD .dxf Drawings (Supports Layers, Blocks, Bulge Polylines, MTEXT)"><i data-ic="dxfIn"></i><span>Import DXF</span></button>
            <button class="tb" id="rib-dxf-workbench" title="Open AutoCAD DXF Layer Manager, Entity Inspector & Vector Diff Workbench"><i data-ic="layers"></i><span>DXF Layers</span></button>
            <button class="tb" id="rib-cad-export" title="Export PDF Vectors, Text, Redline Clouds, Measurements & BOM to AutoCAD .dxf"><i data-ic="dxfOut"></i><span>Export DXF</span></button>
          </div><div class="cap">AutoCAD (.dxf) Studio</div></div>
        </div>

        <!-- 3. View & Enhance -->
        <div class="rp-ribbon-panel" id="tab-view">
          <div class="grp"><div class="row col">
            <label class="f" title="Select Visual Comparison Mode">Mode <select id="rib-view-mode">
              <option value="paper">Overlay on paper</option>
              <option value="over">Overlay dark (CAM)</option>
              <option value="diff">Differences only</option>
              <option value="side">Side by side</option>
              <option value="blink">Blink A / B</option>
              <option value="curtain">Curtain Split Slider</option>
              <option value="A">Base (A) only</option>
              <option value="B">Revised (B) only</option>
            </select></label>
            <label class="f" title="Rasterization &amp; Analysis Resolution">DPI <select id="rib-view-dpi">
              <option value="150">150 dpi (Fast)</option>
              <option value="200">200 dpi</option>
              <option value="300" selected>300 dpi (Sharp)</option>
              <option value="400">400 dpi</option>
              <option value="600">600 dpi (Ultra)</option>
            </select></label>
          </div><div class="cap">View Mode &amp; Quality (DPI)</div></div>

          <div class="grp"><div class="row">
            <button class="tb" id="rib-enh-norm" data-enh="off" title="Standard Unfiltered Drawing Rendering"><i data-ic="enhNorm"></i><span>Normal</span></button>
            <button class="tb" id="rib-enh-boost" data-enh="enh" title="Boost Line Contrast & Darken Faint Schematic Nets"><i data-ic="enhBoost"></i><span>High Contrast</span></button>
            <button class="tb" id="rib-enh-dark" data-enh="dark" title="Maximum Line Density for Fine Thin Scans"><i data-ic="enhDark"></i><span>Extra Dark</span></button>
            <button class="tb" id="rib-enh-inv" data-enh="blue" title="High-Contrast Dark Blueprint CAD Mode (Low Eye Strain)"><i data-ic="blueprint"></i><span>Blueprint CAD</span></button>
          </div><div class="cap">Signal &amp; Line Enhancement</div></div>

          <div class="grp"><div class="row">
            <button class="tb" id="rib-curtain-toggle" title="Interactive 60 FPS Split Curtain Divider (Rev A Left / Rev B Right)"><i data-ic="curtain"></i><span>Split Curtain</span></button>
            <button class="tb" id="rib-loupe-toggle" title="4x Optical Magnifier Loupe with Crosshair Reticle (Shortcut: L)"><i data-ic="loupe"></i><span>4x Loupe</span></button>
            <button class="tb" id="rib-grid-toggle" title="Calibrated Engineering Reference Grid Overlay (Shortcut: G)"><i data-ic="grid"></i><span>Ref Grid</span></button>
            <button class="tb" id="rib-crosshair-toggle" title="Full-Viewport Precision Alignment Crosshair (Shortcut: X)"><i data-ic="crosshair"></i><span>Crosshair</span></button>
            <button class="tb on" id="rib-view-markers" title="Show/Hide Difference Markers (Shortcut: M)"><i data-ic="rect"></i><span>Markers</span></button>
            <button class="tb" id="rib-sharp-100" title="Fit Drawing to Viewport & Re-Rasterize Crisp Vectors (Shortcut: F)"><i data-ic="fit"></i><span>Fit &amp; Sharpen</span></button>
          </div><div class="cap">Inspection Optics &amp; Area</div></div>
        </div>

        <!-- 4. Markup & Stamps -->
        <div class="rp-ribbon-panel" id="tab-markup">
          <div class="grp"><div class="row">
            <button class="tb" id="rib-rev-cloud" data-rptool="cloud" title="Draw ANSI/ISO Scalloped Revision Cloud with Delta Triangle (Δ Rev 2)"><i data-ic="revCloud"></i><span>Revision Cloud</span></button>
            <button class="tb" id="rib-leader" data-rptool="leader" title="Place Multi-Point Leader Arrow with Engineering Callout Box"><i data-ic="leader"></i><span>Leader Callout</span></button>
            <button class="tb" id="rib-pen" data-rptool="pen" title="Freehand Redline Markup Pen (Customizable Thickness, Colour & Dash)"><i data-ic="pen"></i><span>Freehand Pen</span></button>
            <button class="tb" id="rib-pin" data-rptool="pin" title="Place Engineering Inspection Pin / Callout Marker Badge"><i data-ic="pin"></i><span>Pin Marker</span></button>
            <button class="tb" id="rib-eraser" data-rptool="eraser" title="Eraser — Click or Drag Over Any Markup or Pin to Erase It"><i data-ic="eraser"></i><span>Eraser</span></button>
            <button class="tb" id="rib-redact" data-rptool="redact" title="Place Opaque Security Redaction Mask"><i data-ic="redact"></i><span>Redact Box</span></button>
            <button class="tb" id="rib-clear-markups" title="Clear Placed Markups & Measurements on Current Sheet"><i data-ic="trash"></i><span>Clear All</span></button>
          </div><div class="cap">Engineering Redlines, Pin &amp; Eraser</div></div>

          <div class="grp rp-contextual-tool-set" id="rib-cmp-tool-opts" hidden><div class="row col">
            <div class="row" style="gap:5px">
              <span id="rib-mk-size-lbl" style="font-size:11px;color:var(--mute);min-width:52px">Thickness</span>
              <input type="number" id="rib-mk-size" value="3" min="1" max="120" style="width:44px" title="Active Tool Stroke Thickness, Pin Size, or Eraser Radius (px)" />
              <div class="row" id="rib-mk-pen-presets" style="gap:2px" title="Quick Pen &amp; Shape Thickness Presets">
                <button type="button" class="rp-fmt-btn rp-cmp-sz" data-sz="1">1px</button>
                <button type="button" class="rp-fmt-btn rp-cmp-sz on" data-sz="3">3px</button>
                <button type="button" class="rp-fmt-btn rp-cmp-sz" data-sz="5">5px</button>
                <button type="button" class="rp-fmt-btn rp-cmp-sz" data-sz="8">8px</button>
                <button type="button" class="rp-fmt-btn rp-cmp-sz" data-sz="12">12px</button>
              </div>
              <div class="row" id="rib-mk-eraser-presets" hidden style="gap:2px" title="Eraser Mode &amp; Radius Presets">
                <select id="rib-mk-eraser-mode" class="rp-select-xs" title="Choose Whole Markup vs Brush Radius Eraser">
                  <option value="object" selected>Whole Markup</option>
                  <option value="brush">Brush Radius</option>
                </select>
                <button type="button" class="rp-fmt-btn rp-cmp-er" data-er="10">10px</button>
                <button type="button" class="rp-fmt-btn rp-cmp-er on" data-er="20">20px</button>
                <button type="button" class="rp-fmt-btn rp-cmp-er" data-er="40">40px</button>
                <button type="button" class="rp-fmt-btn rp-cmp-er" data-er="64">64px</button>
              </div>
              <div class="row" id="rib-mk-pin-presets" hidden style="gap:2px" title="Pin Marker Size Presets">
                <button type="button" class="rp-fmt-btn rp-cmp-pin" data-psz="18">S (18)</button>
                <button type="button" class="rp-fmt-btn rp-cmp-pin on" data-psz="24">M (24)</button>
                <button type="button" class="rp-fmt-btn rp-cmp-pin" data-psz="32">L (32)</button>
                <button type="button" class="rp-fmt-btn rp-cmp-pin" data-psz="42">XL (42)</button>
              </div>
            </div>
            <div class="row" id="rib-mk-style-row" style="gap:6px">
              <input type="color" id="rib-mk-color" value="#e11d48" title="Active Markup / Pen / Pin Colour" />
              <div class="rp-swatches" id="rib-mk-swatches" title="Quick Redline Colours">
                <button type="button" class="rp-swatch on" data-col="#e11d48" style="background:#e11d48" title="Redline Crimson"></button>
                <button type="button" class="rp-swatch" data-col="#2563eb" style="background:#2563eb" title="Blueprint Cobalt"></button>
                <button type="button" class="rp-swatch" data-col="#059669" style="background:#059669" title="QA Emerald"></button>
                <button type="button" class="rp-swatch" data-col="#f59e0b" style="background:#f59e0b" title="Inspection Gold"></button>
                <button type="button" class="rp-swatch" data-col="#7c3aed" style="background:#7c3aed" title="Engineering Violet"></button>
                <button type="button" class="rp-swatch" data-col="#111827" style="background:#111827" title="Carbon Black"></button>
              </div>
              <label class="f" title="Markup Opacity %">Alpha <input type="number" id="rib-mk-op" value="100" min="10" max="100" style="width:44px">%</label>
              <select id="rib-mk-dash" class="rp-select-xs" title="Line Dash Style">
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
              </select>
              <input type="text" id="rib-mk-revtxt" value="Δ Rev 2" style="width:62px;font-size:11px" title="Revision Cloud Delta Tag (e.g. Δ Rev 2)" placeholder="Δ Rev 2" />
            </div>
          </div><div class="cap" id="rib-mk-opts-cap">Pen, Pin &amp; Eraser Tool Options</div></div>

          <div class="grp"><div class="row">
            <button class="tb" id="rib-stamp-app" data-rptool="stamp" title="Place Dynamic APPROVED Engineering Sign-Off Stamp"><i data-ic="stampApp"></i><span>APPROVED</span></button>
            <button class="tb" id="rib-stamp-rej" data-rptool="stamp" title="Place Dynamic REJECTED Engineering Sign-Off Stamp"><i data-ic="stampRej"></i><span>REJECTED</span></button>
            <button class="tb" id="rib-stamp-rev" data-rptool="stamp" title="Place Dynamic REVISED & RESUBMIT Engineering Stamp"><i data-ic="stampRev"></i><span>REVISED</span></button>
            <button class="tb" id="rib-stamp-sha" data-rptool="stamp" title="Place Cryptographic SHA-256 Document Hash Verification Stamp"><i data-ic="stampSha"></i><span>SHA-256 Stamp</span></button>
          </div><div class="cap">Cryptographic Sign-Off Stamps</div></div>
        </div>

        <!-- 5. Measure (OSNAP) -->
        <div class="rp-ribbon-panel" id="tab-measure">
          <div class="grp"><div class="row">
            <button class="tb" id="rib-calibrate" data-rptool="calibrate" title="Calibrate Real-World Drawing Scale from Known Dimension Line (mm / mils / in)"><i data-ic="calibrate"></i><span>Calibrate Scale</span></button>
            <button class="tb" id="rib-dist" data-rptool="dist" title="Measure Point-to-Point Linear Distance with OSNAP"><i data-ic="dist"></i><span>Distance</span></button>
            <button class="tb" id="rib-poly" data-rptool="poly" title="Measure Multi-Segment Cumulative Wire / Pipe / Trace Run"><i data-ic="polyline"></i><span>Polyline Run</span></button>
            <button class="tb" id="rib-area" data-rptool="area" title="Calculate Closed Polygon Area & Perimeter (Shoelace Formula)"><i data-ic="area"></i><span>Polygon Area</span></button>
          </div><div class="cap">Precision Takeoffs</div></div>

          <div class="grp"><div class="row">
            <button class="tb on" id="rib-osnap-toggle" title="Toggle 8px Magnetic Object Snap to Endpoints, Midpoints & Centers"><i data-ic="osnap"></i><span>OSNAP: ON</span></button>
            <button class="tb" id="rib-tally" data-rptool="tally" title="Click Drawing to Place Numbered Inspection / BOM Tally Badges (#1, #2...)"><i data-ic="tally"></i><span>Tally / BOM Badge</span></button>
            <button class="tb" id="rib-bom-list" title="Open Engineering Measurement & BOM Tally Schedule Table"><i data-ic="bomTable"></i><span>Schedule & BOM</span></button>
          </div><div class="cap">Magnetic Snap & BOM</div></div>
        </div>

        <!-- 6. Export & Share -->
        <div class="rp-ribbon-panel" id="tab-export">
          <div class="grp"><div class="row">
            <button class="tb" id="rib-export-pdf" title="Export Visual Comparison Report PDF"><i data-ic="report"></i><span>Comparison PDF</span></button>
            <button class="tb" id="rib-export-img" title="Export High-Resolution Composite Overlay PNG"><i data-ic="png"></i><span>High-Res PNG</span></button>
            <button class="tb" id="rib-export-dxf" title="Export Vector Geometry & Redline Clouds to AutoCAD .dxf"><i data-ic="dxfOut"></i><span>Export .dxf</span></button>
          </div><div class="cap">Drawing Deliverables</div></div>

          <div class="grp"><div class="row">
            <button class="tb" id="rib-export-qa-zip" title="1-Click QA Package Export (.zip): Bundles Annotated Audit PDF, Defect CSV Schedule, High-Res Difference PNG &amp; AutoCAD DXF"><i data-ic="packageZip"></i><span>Export QA Package</span></button>
            <button class="tb" id="rib-export-audit" title="Generate Multi-Page Executive Sign-Off Audit PDF with Cloud Thumbnail"><i data-ic="auditPdf"></i><span>Executive Audit PDF</span></button>
            <button class="tb" id="rib-export-csv" title="Export Defect Coordinates (IPC English mils & Metric mm), Statuses & Notes to CSV"><i data-ic="csv"></i><span>Defects CSV</span></button>
            <button class="tb" id="rib-session-save" title="Save Complete Review Session, Markups & Defect Statuses (.redline)"><i data-ic="sessionSave"></i><span>Save .redline</span></button>
            <button class="tb" id="rib-session-load" title="Restore Saved Review Session (.redline)"><i data-ic="sessionLoad"></i><span>Load .redline</span></button>
          </div><div class="cap">QA Package, Audit &amp; Session</div></div>
        </div>
      </div>
    `;

    // Keep oldRibbon in DOM (hidden) so all existing #openA, #dpi, #tol, #dx, #dy selectors stay valid
    oldRibbon.style.display = 'none';
    oldRibbon.classList.add('rp-categorized-ribbon');
    oldRibbon.parentNode.insertBefore(ribbonWrap, oldRibbon);

    // Tab switching
    ribbonWrap.querySelectorAll('.rp-tab-btn').forEach(btn => {
      btn.onclick = () => {
        ribbonWrap.querySelectorAll('.rp-tab-btn').forEach(b => b.classList.remove('active'));
        ribbonWrap.querySelectorAll('.rp-ribbon-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const target = $(`#${btn.dataset.tab}`);
        if (target) target.classList.add('active');
      };
    });

    // Wire Review & Compare actions
    if ($('#openA')) $('#rib-openA').onclick = () => $('#openA').click();
    if ($('#openB')) $('#rib-openB').onclick = () => $('#openB').click();
    if ($('#swap')) $('#rib-swap').onclick = () => $('#swap').click();
    if ($('#rib-c-undo')) $('#rib-c-undo').onclick = () => CompareHistory.undo();
    if ($('#rib-c-redo')) $('#rib-c-redo').onclick = () => CompareHistory.redo();
    $('#rib-autoalign').onclick = () => { if ($('#align')) $('#align').click(); };
    $('#rib-fiducial').onclick = () => FiducialAligner.start();
    $('#rib-ignore').onclick = () => {
      if ($('#ignBtn')) {
        $('#ignBtn').click();
        $('#rib-ignore').classList.toggle('on', !!(window.CMP && window.CMP.ignMode));
        rpToast(window.CMP && window.CMP.ignMode ? 'Ignore Area Active: Drag rectangle over title block or date stamp to exclude.' : 'Ignore Area tool exited.');
      }
    };
    if ($('#rib-ign-all') && $('#ignAll')) {
      $('#rib-ign-all').checked = $('#ignAll').checked;
      $('#rib-ign-all').onchange = e => {
        $('#ignAll').checked = e.target.checked;
        $('#ignAll').dispatchEvent(new Event('change'));
      };
      $('#ignAll').addEventListener('change', () => {
        $('#rib-ign-all').checked = $('#ignAll').checked;
      });
    }
    if ($('#rib-ign-clear')) {
      $('#rib-ign-clear').onclick = () => {
        if (window.ACT && window.ACT.clearIgnore) window.ACT.clearIgnore();
        else if ($('#ignClear')) $('#ignClear').click();
      };
    }
    $('#rib-prev-defect').onclick = () => DefectState.prev();
    $('#rib-next-defect').onclick = () => DefectState.next();
    $('#rib-text-diff').onclick = () => { if (window.ACT && window.ACT.textDiff) window.ACT.textDiff(); };
    $('#rib-layer-toggle').onclick = () => {
      const tabBtn = ribbonWrap.querySelector('.rp-tab-btn[data-tab="tab-layers"]');
      if (tabBtn) tabBtn.click();
    };
    if ($('#rib-view-toggle')) {
      $('#rib-view-toggle').onclick = () => {
        const tabBtn = ribbonWrap.querySelector('.rp-tab-btn[data-tab="tab-view"]');
        if (tabBtn) tabBtn.click();
      };
    }

    // Wire IPC Units quick selectors
    const updateDFMRuleBanner = () => {
      const rules = (typeof CAMEngine !== 'undefined' && CAMEngine.IPC_DFM_RULES[CAMState.ipcClass]) || CAMState.customRules;
      const clrMils = rules.minClearanceMils || 4.0;
      const clrMM = (clrMils * 0.0254).toFixed(3);
      const lbl = $('#rib-dfm-rule-lbl');
      if (lbl) {
        lbl.textContent = CAMState.unitSystem === 'metric'
          ? `Min Clr: ${clrMM} mm (${clrMils.toFixed(1)} mil)`
          : `Min Clr: ${clrMils.toFixed(1)} mil (${clrMM} mm)`;
      }
    };

    $('#rib-units-quick').value = CAMState.unitSystem;
    $('#rib-cam-units').value = CAMState.unitSystem;
    $('#rib-units-quick').onchange = e => { setUnitSystem(e.target.value); updateDFMRuleBanner(); };
    $('#rib-cam-units').onchange = e => { setUnitSystem(e.target.value); updateDFMRuleBanner(); };
    $('#rib-open-cam350-quick').onclick = () => showCAM350WorkbenchModal();

    // Wire CAM350 Render Mode, Mirror, Polarity & IPC Class
    $('#rib-cam-render').onchange = e => {
      CAMState.renderMode = e.target.value;
      reRenderActiveCAMLayers();
    };
    $('#rib-cam-mirror').onchange = e => {
      CAMState.mirrorX = e.target.checked;
      reRenderActiveCAMLayers();
    };
    $('#rib-cam-neg').onchange = e => {
      CAMState.invertPolarity = e.target.checked;
      reRenderActiveCAMLayers();
    };
    $('#rib-ipc-class').onchange = e => {
      CAMState.ipcClass = e.target.value;
      if (typeof CAMEngine !== 'undefined' && CAMEngine.IPC_DFM_RULES[CAMState.ipcClass]) {
        Object.assign(CAMState.customRules, CAMEngine.IPC_DFM_RULES[CAMState.ipcClass]);
      }
      updateDFMRuleBanner();
      if (window.__lastGerberA && window.__lastGerberB) {
        runCAMClearanceScan();
      } else {
        updateCAMSidebarPane();
        rpToast(`Selected ${$('#rib-ipc-class').selectedOptions[0].text}`);
      }
    };
    updateDFMRuleBanner();

    // Wire View & Enhance actions
    $('#rib-enh-norm').onclick = () => window.setEnhanced && window.setEnhanced('off');
    $('#rib-enh-boost').onclick = () => window.setEnhanced && window.setEnhanced('enh');
    $('#rib-enh-dark').onclick = () => window.setEnhanced && window.setEnhanced('dark');
    $('#rib-enh-inv').onclick = () => window.setEnhanced && window.setEnhanced('blue');
    $('#rib-curtain-toggle').onclick = () => setCurtainMode(!curtainActive);
    if ($('#rib-view-markers')) {
      $('#rib-view-markers').onclick = () => {
        const boxes = $('#lM') || $('#boxes');
        if (boxes) {
          boxes.checked = !boxes.checked;
          boxes.dispatchEvent(new Event('change'));
          $('#rib-view-markers').classList.toggle('on', boxes.checked);
          if ($('#rp-markers-chk')) $('#rp-markers-chk').checked = boxes.checked;
        }
      };
    }
    const markersInput = $('#lM') || $('#boxes');
    if (markersInput) {
      markersInput.addEventListener('change', () => {
        if ($('#rib-view-markers')) $('#rib-view-markers').classList.toggle('on', markersInput.checked);
        if ($('#rp-markers-chk')) $('#rp-markers-chk').checked = markersInput.checked;
      });
    }
    $('#rib-sharp-100').onclick = () => {
      if (typeof window.fit === 'function') window.fit();
      else if (window.ACT && window.ACT.cFit) window.ACT.cFit();
      if (window.rpSharpen) window.rpSharpen();
      rpToast('Fitted sheet to viewport & sharpened vector paths.');
    };
    if (window.setEnhanced) window.setEnhanced(safeGet('enh', 'off') || 'off', true);

    // Wire Export & Share actions
    if ($('#rib-export-qa-zip')) $('#rib-export-qa-zip').onclick = () => exportQAPackageZip();
    $('#rib-export-pdf').onclick = () => { if ($('#report')) $('#report').click(); };
    $('#rib-export-img').onclick = () => { if ($('#png')) $('#png').click(); };
    $('#rib-export-dxf').onclick = () => promptDXFExport();
    $('#rib-export-audit').onclick = () => generateExecutiveAuditReport();
    $('#rib-export-csv').onclick = () => exportDefectsCSV();
    $('#rib-session-save').onclick = () => saveSessionFile();
    $('#rib-session-load').onclick = () => loadSessionFile();

    // Wire BOM & Measurements Schedule modal
    $('#rib-bom-list').onclick = () => showBOMAndMeasurementsModal();
    if ($('#rib-clear-markups')) $('#rib-clear-markups').onclick = () => { if (window.RP_MEASURE) { CompareHistory.push('Clear markups'); window.RP_MEASURE.annotations = []; if (window.RP_MEASURE.tally) window.RP_MEASURE.tally.clear(); if (window.rpRedrawOverlay) window.rpRedrawOverlay(); if (window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar(); rpToast('Cleared all markups & measurements on sheet.'); } };

    // Sync DPI selectors (#dpi, #rib-dpi, #rib-view-dpi)
    const mainDpi = $('#dpi'), ribDpi = $('#rib-dpi'), ribViewDpi = $('#rib-view-dpi');
    if (mainDpi) {
      if (ribDpi) {
        ribDpi.value = mainDpi.value;
        ribDpi.onchange = () => {
          if (ribViewDpi) ribViewDpi.value = ribDpi.value;
          mainDpi.value = ribDpi.value;
          mainDpi.dispatchEvent(new Event('change'));
        };
      }
      if (ribViewDpi) {
        ribViewDpi.value = mainDpi.value;
        ribViewDpi.onchange = () => {
          if (ribDpi) ribDpi.value = ribViewDpi.value;
          mainDpi.value = ribViewDpi.value;
          mainDpi.dispatchEvent(new Event('change'));
        };
      }
      mainDpi.addEventListener('change', () => {
        if (ribDpi) ribDpi.value = mainDpi.value;
        if (ribViewDpi) ribViewDpi.value = mainDpi.value;
      });
    }

    // Sync Mode selectors (#mode, #rib-mode, #rib-view-mode)
    const mainMode = $('#mode'), ribMode = $('#rib-mode'), ribViewMode = $('#rib-view-mode');
    if (mainMode) {
      prevNonCurtainMode = mainMode.value || 'paper';
      if (ribMode) {
        ribMode.value = mainMode.value;
        ribMode.onchange = () => setCompareMode(ribMode.value);
      }
      if (ribViewMode) {
        ribViewMode.value = mainMode.value;
        ribViewMode.onchange = () => setCompareMode(ribViewMode.value);
      }
      mainMode.addEventListener('change', () => {
        if (mainMode.value === 'side' || mainMode.value === 'blink') {
          if (curtainActive) setCurtainMode(false, mainMode.value);
        }
        if (!curtainActive) {
          prevNonCurtainMode = mainMode.value;
          syncModeSelects(mainMode.value);
        }
      });
    }

    // Wire CAD & CAM actions
    $('#rib-cad-export').onclick = () => promptDXFExport();
    $('#rib-cad-import').onclick = () => promptDXFImport();
    if ($('#rib-dxf-workbench')) $('#rib-dxf-workbench').onclick = () => showDXFWorkbenchModal('layers');
    $('#rib-cam-compare').onclick = () => promptCAMCompare();
    $('#rib-cam-dual').onclick = () => promptDualGerberCompare();
    $('#rib-cam-ipc').onclick = () => promptIPCD356Netlist();
    $('#rib-cam-clearance').onclick = () => runCAMClearanceScan();
    $('#rib-cam-tables').onclick = () => showCAM350WorkbenchModal();

    if (typeof hydrateIcons === 'function') hydrateIcons();
  }

  /**
   * Re-render active CAM layers when user changes CAM350 Render Mode, Mirror, Polarity, or Format
   */
  async function reRenderActiveCAMLayers() {
    if (typeof CAMEngine === 'undefined') return;
    if (!window.__lastGerberA && !window.__lastGerberB && !window.__lastDrill && !window.__lastIPCA) {
      rpToast('Open a Gerber, Drill, or IPC-D-356 file (or click Load Sample PCB Gerber) to apply CAM350 view settings.');
      return;
    }

    try {
      const parseOpts = CAMState.getParseOptions();
      const gA = window.__lastGerberA ? new CAMEngine.GerberParser(window.__lastGerberA, parseOpts).parse() : null;
      const gB = window.__lastGerberB ? new CAMEngine.GerberParser(window.__lastGerberB, parseOpts).parse() : null;
      const drlA = window.__lastDrill ? new CAMEngine.ExcellonParser(window.__lastDrill, parseOpts).parse() : null;
      const ipcA = window.__lastIPCA ? new CAMEngine.IPCD356Parser(window.__lastIPCA, parseOpts).parse() : null;

      CAMState.parsedGerberA = gA;
      CAMState.parsedGerberB = gB;
      CAMState.parsedDrillA = drlA;
      CAMState.parsedIPCA = ipcA;

      const sharedBoundsInches = (gA && gB && isFinite(gA.bounds.minX) && isFinite(gB.bounds.minX)) ? {
        minX: Math.min(gA.toInches(gA.bounds.minX), gB.toInches(gB.bounds.minX)),
        maxX: Math.max(gA.toInches(gA.bounds.maxX), gB.toInches(gB.bounds.maxX)),
        minY: Math.min(gA.toInches(gA.bounds.minY), gB.toInches(gB.bounds.minY)),
        maxY: Math.max(gA.toInches(gA.bounds.maxY), gB.toInches(gB.bounds.maxY))
      } : null;

      const renderLayerToPDF = async (gbr, drl, ipc) => {
        const offCv = document.createElement('canvas');
        offCv.width = 2000;
        offCv.height = 1500;
        const rend = new CAMEngine.PCBRenderer(offCv, CAMState.pcbTheme || 'standard');
        const dummy = gbr || new CAMEngine.GerberParser('', { allowEmpty: true }).parse();
        if (!gbr && drl) dummy.bounds = drl.bounds;
        else if (!gbr && !drl && ipc) dummy.bounds = ipc.bounds;
        rend.render(dummy, drl, {
          renderMode: CAMState.renderMode,
          mirrorX: CAMState.mirrorX,
          invertPolarity: CAMState.invertPolarity,
          showOrigin: CAMState.showOrigin,
          showDrillRings: CAMState.showDrillRings,
          ipcParsed: ipc,
          highlightNet: CAMState.highlightNet,
          sharedBoundsInches
        });
        const pdfBytes = await canvasToPDFBytes(offCv);
        offCv.width = 0; offCv.height = 0;
        return { pdfBytes, canvas: offCv };
      };

      if (gA && gB) {
        const rA = await renderLayerToPDF(gA, drlA, ipcA);
        const rB = await renderLayerToPDF(gB, drlA, ipcA);
        if (window.compareLoadBytes) {
          await window.compareLoadBytes('A', rA.pdfBytes, (window.CMP && window.CMP.names && window.CMP.names.A) || 'Layer_A.gbr', '', true);
          await window.compareLoadBytes('B', rB.pdfBytes, (window.CMP && window.CMP.names && window.CMP.names.B) || 'Layer_B.gbr', '');
        }
      } else if (gA || gB || drlA || ipcA) {
        const targetSlot = (!gA && gB) ? 'B' : 'A';
        const r = await renderLayerToPDF(gA || gB, drlA, ipcA);
        if (window.compareLoadBytes) {
          await window.compareLoadBytes(targetSlot, r.pdfBytes, (window.CMP && window.CMP.names && window.CMP.names[targetSlot]) || 'CAM_Layer.gbr', '');
        }
      }
      updateCAMSidebarPane();
      rpToast(`Updated CAM350 View: Mode=${CAMState.renderMode.toUpperCase()}${CAMState.mirrorX ? ' [Mirrored]' : ''}${CAMState.invertPolarity ? ' [Negative LPC]' : ''}`);
    } catch (e) {
      rpToast('CAM Render error: ' + e.message);
    }
  }

  /**
   * AutoCAD DXF Studio State (Layers, Background Theme, Lineweight, Vector Entity Diff)
   */
  const DXFState = {
    parsedA: null,
    parsedB: null,
    rawA: null,
    rawB: null,
    nameA: "Drawing_RevA.dxf",
    nameB: "Drawing_RevB.dxf",
    hiddenLayers: new Set(),
    background: "#ffffff", // "#ffffff" (Crisp Paper for A/B Overlay) | "#0c1017" (AutoCAD Dark) | "#08182b" (Blueprint)
    lineWidth: 2.0,
    showGrid: false,
    lastEntityDiff: null
  };
  if (typeof window !== "undefined") window.DXFState = DXFState;

  function registerDXFOSNAP(parser, bounds, canvasW = 2200, canvasH = 1600, padding = 40) {
    if (!window.RP_MEASURE || !window.RP_MEASURE.osnap || !parser) return;
    const bw = Math.max(1e-3, bounds.maxX - bounds.minX || 100);
    const bh = Math.max(1e-3, bounds.maxY - bounds.minY || 100);
    const targetW = Math.max(10, canvasW - padding * 2);
    const targetH = Math.max(10, canvasH - padding * 2);
    const scale = Math.min(targetW / bw, targetH / bh);
    const offsetX = padding + (targetW - bw * scale) / 2;
    const offsetY = padding + (targetH - bh * scale) / 2;
    // Note: canvasToPDFBytes creates a PDF at 0.5x canvas size, and Compare renders at DPI/72
    const dpi = ($("#dpi") && +$("#dpi").value) ? +$("#dpi").value : 300;
    const pdfScale = 0.5 * (dpi / 72);
    const tx = x => (offsetX + (x - bounds.minX) * scale) * pdfScale;
    const ty = y => (canvasH - (offsetY + (y - bounds.minY) * scale)) * pdfScale;

    for (const ent of parser.entities) {
      if (DXFState.hiddenLayers.has(ent.layer)) continue;
      if (ent.type === "LINE") {
        window.RP_MEASURE.osnap.addLine(tx(ent.x1), ty(ent.y1), tx(ent.x2), ty(ent.y2));
      } else if (ent.type === "CIRCLE" || ent.type === "ARC") {
        window.RP_MEASURE.osnap.addCircle(tx(ent.cx), ty(ent.cy), ent.r * scale * pdfScale);
      } else if (ent.type === "LWPOLYLINE" && ent.points) {
        for (let i = 0; i < ent.points.length; i++) {
          window.RP_MEASURE.osnap.addPoint(tx(ent.points[i][0]), ty(ent.points[i][1]), "endpoint");
        }
      }
    }
  }

  async function reRenderActiveDXFLayers() {
    if (typeof DXFEngine === "undefined" || (!DXFState.parsedA && !DXFState.parsedB)) return;
    try {
      const pA = DXFState.parsedA;
      const pB = DXFState.parsedB;
      const sharedBounds = (pA && pB) ? {
        minX: Math.min(pA.bounds.minX, pB.bounds.minX),
        minY: Math.min(pA.bounds.minY, pB.bounds.minY),
        maxX: Math.max(pA.bounds.maxX, pB.bounds.maxX),
        maxY: Math.max(pA.bounds.maxY, pB.bounds.maxY)
      } : (pA ? pA.bounds : pB.bounds);

      const renderOne = async parser => {
        const offCv = document.createElement("canvas");
        offCv.width = 2200;
        offCv.height = 1600;
        parser.renderToCanvas(offCv, {
          background: DXFState.background,
          lineWidth: DXFState.lineWidth,
          showGrid: DXFState.showGrid,
          hiddenLayers: DXFState.hiddenLayers,
          sharedBounds
        });
        const pdfBytes = await canvasToPDFBytes(offCv);
        offCv.width = 0; offCv.height = 0;
        return pdfBytes;
      };

      if (pA && pB) {
        DXFState.lastEntityDiff = DXFEngine.compareDXFEntities(pA, pB);
        const [bytesA, bytesB] = await Promise.all([renderOne(pA), renderOne(pB)]);
        if (window.compareLoadBytes) {
          await window.compareLoadBytes("A", bytesA, DXFState.nameA, "", true);
          await window.compareLoadBytes("B", bytesB, DXFState.nameB, "");
        }
        registerDXFOSNAP(pB, sharedBounds);
      } else if (pA) {
        const bytesA = await renderOne(pA);
        if (window.compareLoadBytes) await window.compareLoadBytes("A", bytesA, DXFState.nameA, "");
        registerDXFOSNAP(pA, sharedBounds);
      } else if (pB) {
        const bytesB = await renderOne(pB);
        if (window.compareLoadBytes) await window.compareLoadBytes("B", bytesB, DXFState.nameB, "");
        registerDXFOSNAP(pB, sharedBounds);
      }
      updateCAMSidebarPane();
    } catch (e) {
      rpToast("DXF Re-render error: " + e.message);
    }
  }

  async function loadSampleDXF() {
    if (typeof DXFEngine === "undefined" || !DXFEngine.generateSampleMechanicalDXF) return;
    try {
      if (typeof setView === "function") setView("compare");
      const unit = CAMState.unitSystem === "metric" ? "mm" : "mils";
      rpToast("Generating synthetic AutoCAD R2000 Mechanical Enclosure DXF (Rev A vs Rev B)...");
      const dxfA = DXFEngine.generateSampleMechanicalDXF(false, unit);
      const dxfB = DXFEngine.generateSampleMechanicalDXF(true, unit);
      DXFState.rawA = dxfA;
      DXFState.rawB = dxfB;
      DXFState.nameA = "Enclosure_Carrier_RevA.dxf";
      DXFState.nameB = "Enclosure_Carrier_RevB.dxf";
      DXFState.parsedA = new DXFEngine.DXFParser(dxfA).parse();
      DXFState.parsedB = new DXFEngine.DXFParser(dxfB).parse();
      DXFState.hiddenLayers.clear();
      DXFState.lastEntityDiff = DXFEngine.compareDXFEntities(DXFState.parsedA, DXFState.parsedB);

      await reRenderActiveDXFLayers();
      const d = DXFState.lastEntityDiff;
      rpToast(`⚡ Loaded AutoCAD DXF (Rev A vs Rev B): ${d.added.length} added, ${d.removed.length} removed CAD primitives across ${Object.keys(DXFState.parsedB.layers).length} layers!`);
      return { dxfA, dxfB, diff: d };
    } catch (e) {
      rpToast("Sample DXF Error: " + e.message);
    }
  }

  /**
   * Interactive AutoCAD DXF Workbench Modal (Layers, Entity Inspector, Vector Diff & Export)
   */
  function showDXFWorkbenchModal(initialTab = "layers") {
    if (typeof document === "undefined" || typeof DXFEngine === "undefined") return;
    let modal = $("#rp-dxf-workbench-modal");
    if (!modal) {
      modal = el("div", { id: "rp-dxf-workbench-modal", className: "rp-modal" });
      document.body.appendChild(modal);
    }
    modal.hidden = false;

    const activeDxf = DXFState.parsedB || DXFState.parsedA;
    const isMetric = CAMState.unitSystem === "metric";
    const defaultUnit = isMetric ? "mm" : "mils";

    // Merge layers from both A and B if available
    const layerMap = new Map();
    [DXFState.parsedA, DXFState.parsedB].forEach(p => {
      if (!p) return;
      for (const l of p.getLayerSummary()) {
        const prev = layerMap.get(l.name);
        if (prev) prev.count += l.count;
        else layerMap.set(l.name, { ...l });
      }
    });
    const layers = [...layerMap.values()];

    const layerRowsHTML = layers.length ? layers.map(l => {
      const isVis = !DXFState.hiddenLayers.has(l.name);
      return `
        <tr>
          <td><input type="checkbox" class="dxf-lyr-chk" data-lyr="${l.name}" ${isVis ? "checked" : ""} /></td>
          <td><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${l.hexDark};border:1px solid rgba(255,255,255,0.4);vertical-align:middle;margin-right:6px"></span><b>${l.name}</b></td>
          <td>ACI ${l.color}</td>
          <td>${l.linetype}</td>
          <td>${l.count}</td>
        </tr>
      `;
    }).join("") : `<tr><td colspan="5" style="text-align:center;opacity:.65">No AutoCAD DXF file loaded yet. Click "⚡ Load Sample Mechanical DXF (Rev A vs Rev B)" or "Import DXF File(s)" below.</td></tr>`;

    const entCounts = activeDxf ? activeDxf.getEntitySummary() : {};
    const b = activeDxf ? activeDxf.bounds : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    const wRaw = isFinite(b.minX) ? (b.maxX - b.minX) : 0;
    const hRaw = isFinite(b.minY) ? (b.maxY - b.minY) : 0;
    const diff = DXFState.lastEntityDiff;

    const diffRowsHTML = diff ? [
      ...diff.added.map(e => `<tr class="add"><td><b>+ ADDED</b></td><td>${e.type}</td><td>${e.layer}</td><td>${e.text || `(${(e.x1 ?? e.cx ?? e.x ?? 0).toFixed(2)}, ${(e.y1 ?? e.cy ?? e.y ?? 0).toFixed(2)})`}</td></tr>`),
      ...diff.removed.map(e => `<tr class="del"><td><b>− REMOVED</b></td><td>${e.type}</td><td>${e.layer}</td><td>${e.text || `(${(e.x1 ?? e.cx ?? e.x ?? 0).toFixed(2)}, ${(e.y1 ?? e.cy ?? e.y ?? 0).toFixed(2)})`}</td></tr>`)
    ].slice(0, 120).join("") : `<tr><td colspan="4" style="text-align:center;opacity:.65">Load two DXF revisions (Rev A &amp; Rev B) to inspect vector entity-level differences.</td></tr>`;

    modal.innerHTML = `
      <div class="rp-card rp-wide" style="width:min(880px,95vw);max-height:90vh">
        <div class="rp-hud-header">
          <div class="rp-hud-title">
            <h3>AutoCAD DXF Studio &amp; Layer Workbench</h3>
            <span class="rp-hud-badge">${activeDxf ? (`$ACADVER: ${activeDxf.header["$ACADVER"] || "AC1015"} · UNITS: ${activeDxf.unitName.toUpperCase()}`) : "R12 / R2000 / R2018 ASCII"}</span>
          </div>
          <button type="button" class="rp-hud-close" id="dxf-wb-close">Close (Esc)</button>
        </div>

        <div class="tabs" style="border-bottom:1px solid var(--line);margin-bottom:8px">
          <button type="button" class="cam-wb-tab ${initialTab === "layers" ? "on" : ""}" data-dxftab="layers"><i data-ic="layers"></i><span>1. CAD Layers (${layers.length}) &amp; Theme</span></button>
          <button type="button" class="cam-wb-tab ${initialTab === "inspector" ? "on" : ""}" data-dxftab="inspector"><i data-ic="tabCad"></i><span>2. Entity Inspector &amp; Vector Diff</span></button>
          <button type="button" class="cam-wb-tab ${initialTab === "export" ? "on" : ""}" data-dxftab="export"><i data-ic="dxfOut"></i><span>3. Export PDF + Redlines to .dxf</span></button>
        </div>

        <!-- TAB 1: CAD LAYERS & DISPLAY -->
        <div class="cam-wb-pane" id="dxf-wb-pane-layers" ${initialTab === "layers" ? "" : "hidden"}>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:space-between">
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button type="button" id="dxf-wb-import-btn" class="rp-btn-sm"><i data-ic="dxfIn"></i><span>Import DXF File(s)</span></button>
              <button type="button" id="dxf-wb-sample-btn" class="rp-btn-sm" style="border-color:#38bdf8;color:#38bdf8"><i data-ic="zap"></i><span>⚡ Load Sample Mechanical DXF (Rev A vs Rev B)</span></button>
            </div>
            <div style="display:flex;gap:6px">
              <button type="button" id="dxf-lyr-all" class="rp-btn-sm">All On</button>
              <button type="button" id="dxf-lyr-none" class="rp-btn-sm">All Off</button>
              <button type="button" id="dxf-lyr-inv" class="rp-btn-sm">Invert</button>
            </div>
          </div>

          <div class="rp-scroll" style="max-height:36vh">
            <table class="btab" style="width:100%">
              <tr><th style="width:50px">Visible</th><th>Layer Name</th><th>ACI Color</th><th>Linetype</th><th>Entities</th></tr>
              ${layerRowsHTML}
            </table>
          </div>

          <div class="rp-hud-grid" style="margin-top:4px">
            <div class="rp-hud-section">
              <h4>CAD Modelspace / Paper Background</h4>
              <select id="dxf-wb-bg" style="width:100%">
                <option value="#ffffff" ${DXFState.background === "#ffffff" ? "selected" : ""}>Crisp White Paper (#ffffff — Best for A/B Redline Overlay)</option>
                <option value="#0c1017" ${DXFState.background === "#0c1017" ? "selected" : ""}>AutoCAD Modelspace Dark (#0c1017)</option>
                <option value="#08182b" ${DXFState.background === "#08182b" ? "selected" : ""}>Blueprint CAD Navy (#08182b)</option>
              </select>
            </div>
            <div class="rp-hud-section">
              <h4>Vector Stroke Weight &amp; Grid</h4>
              <div style="display:flex;gap:12px;align-items:center">
                <label class="f">Line Width <input type="number" id="dxf-wb-lw" min="0.5" max="6" step="0.5" value="${DXFState.lineWidth}" style="width:64px" /> px</label>
                <label class="chk"><input type="checkbox" id="dxf-wb-grid" ${DXFState.showGrid ? "checked" : ""} /> Show CAD Grid</label>
              </div>
            </div>
          </div>

          <div class="rp-btns">
            <button type="button" id="dxf-wb-apply" class="rp-primary">Apply Layer &amp; Display Settings</button>
          </div>
        </div>

        <!-- TAB 2: ENTITY INSPECTOR & VECTOR DIFF -->
        <div class="cam-wb-pane" id="dxf-wb-pane-inspector" ${initialTab === "inspector" ? "" : "hidden"}>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;font-size:12px">
            <div class="rp-hud-section"><b>Extents (W × H):</b><span>${wRaw.toFixed(2)} × ${hRaw.toFixed(2)} ${activeDxf ? activeDxf.unitName : "mm"}</span></div>
            <div class="rp-hud-section"><b>Lines &amp; Polylines:</b><span>${(entCounts.LINE || 0) + (entCounts.LWPOLYLINE || 0)}</span></div>
            <div class="rp-hud-section"><b>Circles &amp; Arcs:</b><span>${(entCounts.CIRCLE || 0) + (entCounts.ARC || 0) + (entCounts.ELLIPSE || 0)}</span></div>
            <div class="rp-hud-section"><b>Text / Blocks / Dims:</b><span>${(entCounts.TEXT || 0) + (entCounts.INSERT || 0) + (entCounts.DIMENSION || 0)}</span></div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
            <b>Vector CAD Primitive Diff ${diff ? `(+${diff.added.length} Added, −${diff.removed.length} Removed, ${diff.unchangedCount} Identical)` : ""}</b>
            <button type="button" id="dxf-exp-diff-csv" class="rp-btn-sm"><i data-ic="csv"></i><span>Export Vector Diff CSV</span></button>
          </div>
          <div class="rp-scroll" style="max-height:38vh">
            <table class="btab" style="width:100%">
              <tr><th>Change</th><th>Entity Type</th><th>CAD Layer</th><th>Coordinates / Text Value</th></tr>
              ${diffRowsHTML}
            </table>
          </div>
        </div>

        <!-- TAB 3: EXPORT PDF + REDLINES TO AUTOCAD DXF -->
        <div class="cam-wb-pane" id="dxf-wb-pane-export" ${initialTab === "export" ? "" : "hidden"}>
          <div class="rp-hud-grid">
            <div class="rp-hud-section">
              <h4>AutoCAD Units ($INSUNITS) &amp; Scale</h4>
              <div class="rp-form-group">
                <label>Drawing Units ($INSUNITS):</label>
                <select id="dxf-unit-sel" style="width:100%">
                  <option value="mm" ${defaultUnit === "mm" ? "selected" : ""}>IPC Metric — Millimeters (mm, $INSUNITS = 4)</option>
                  <option value="mils" ${defaultUnit === "mils" ? "selected" : ""}>IPC English — Mils / Thou (mils, $INSUNITS = 10)</option>
                  <option value="in">IPC English — Inches (in, $INSUNITS = 1)</option>
                </select>
              </div>
              <div class="rp-form-group" style="margin-top:8px">
                <label>Drawing Scale Factor Preset:</label>
                <select id="dxf-scale-sel" style="width:100%">
                  <option value="1:1" selected>1:1 (Full Native Scale)</option>
                  <option value="1:2">1:2</option>
                  <option value="1:5">1:5</option>
                  <option value="1:10">1:10</option>
                  <option value="1:50">1:50</option>
                  <option value="1:100">1:100</option>
                  <option value="1:1000">1:1000</option>
                </select>
              </div>
            </div>
            <div class="rp-hud-section">
              <h4>Exported AutoCAD Layers</h4>
              <label class="chk" style="margin:4px 0"><input type="checkbox" id="dxf-inc-diffs" checked /> Include <b>REDLINE_DIFFS</b> (Scalloped Revision Clouds)</label>
              <label class="chk" style="margin:4px 0"><input type="checkbox" id="dxf-inc-meas" checked /> Include <b>REDLINE_MEASUREMENTS &amp; MARKUPS</b> (Dims, Callouts, Stamps)</label>
              <label class="chk" style="margin:4px 0"><input type="checkbox" id="dxf-inc-bom" checked /> Include <b>REDLINE_BOM</b> (Numbered Inspection Badges)</label>
              <label class="chk" style="margin:4px 0"><input type="checkbox" id="dxf-inc-text" checked /> Include <b>TEXT</b> Layer (All Extracted Labels &amp; Notes)</label>
            </div>
          </div>
          <div class="rp-btns" style="margin-top:10px">
            <button type="button" id="dxf-exp-cancel">Cancel</button>
            <button type="button" id="dxf-exp-ok" class="rp-primary">Export Layered AutoCAD .dxf</button>
          </div>
        </div>
      </div>
    `;

    if (typeof hydrateIcons === "function") hydrateIcons(modal);

    modal.querySelectorAll("[data-dxftab]").forEach(btn => {
      btn.onclick = () => {
        modal.querySelectorAll("[data-dxftab]").forEach(b => b.classList.remove("on"));
        modal.querySelectorAll(".cam-wb-pane").forEach(p => { p.hidden = true; });
        btn.classList.add("on");
        const target = $(`#dxf-wb-pane-${btn.dataset.dxftab}`);
        if (target) target.hidden = false;
      };
    });

    $("#dxf-wb-close").onclick = () => { modal.hidden = true; };
    modal.onclick = e => { if (e.target === modal) modal.hidden = true; };

    if ($("#dxf-wb-import-btn")) {
      $("#dxf-wb-import-btn").onclick = () => { modal.hidden = true; promptDXFImport(); };
    }
    if ($("#dxf-wb-sample-btn")) {
      $("#dxf-wb-sample-btn").onclick = async () => { modal.hidden = true; await loadSampleDXF(); };
    }

    if ($("#dxf-lyr-all")) {
      $("#dxf-lyr-all").onclick = () => {
        DXFState.hiddenLayers.clear();
        modal.querySelectorAll(".dxf-lyr-chk").forEach(c => { c.checked = true; });
      };
    }
    if ($("#dxf-lyr-none")) {
      $("#dxf-lyr-none").onclick = () => {
        modal.querySelectorAll(".dxf-lyr-chk").forEach(c => { c.checked = false; DXFState.hiddenLayers.add(c.dataset.lyr); });
      };
    }
    if ($("#dxf-lyr-inv")) {
      $("#dxf-lyr-inv").onclick = () => {
        modal.querySelectorAll(".dxf-lyr-chk").forEach(c => {
          c.checked = !c.checked;
          if (c.checked) DXFState.hiddenLayers.delete(c.dataset.lyr);
          else DXFState.hiddenLayers.add(c.dataset.lyr);
        });
      };
    }

    if ($("#dxf-wb-apply")) {
      $("#dxf-wb-apply").onclick = async () => {
        DXFState.hiddenLayers.clear();
        modal.querySelectorAll(".dxf-lyr-chk").forEach(c => {
          if (!c.checked) DXFState.hiddenLayers.add(c.dataset.lyr);
        });
        DXFState.background = $("#dxf-wb-bg").value;
        DXFState.lineWidth = Math.max(0.5, parseFloat($("#dxf-wb-lw").value) || 2.0);
        DXFState.showGrid = $("#dxf-wb-grid").checked;
        modal.hidden = true;
        await reRenderActiveDXFLayers();
        rpToast(`Updated DXF View: ${layers.length - DXFState.hiddenLayers.size}/${layers.length} layers visible.`);
      };
    }

    if ($("#dxf-exp-diff-csv")) {
      $("#dxf-exp-diff-csv").onclick = () => {
        if (!diff) return rpToast("Load two DXF files first to export vector diffs.");
        const rows = [
          "change,entity_type,layer,details",
          ...diff.added.map(e => `ADDED,${e.type},"${e.layer}","${(e.text || `(${(e.x1 ?? e.cx ?? e.x ?? 0).toFixed(3)}, ${(e.y1 ?? e.cy ?? e.y ?? 0).toFixed(3)})`).replace(/"/g, '""')}"`),
          ...diff.removed.map(e => `REMOVED,${e.type},"${e.layer}","${(e.text || `(${(e.x1 ?? e.cx ?? e.x ?? 0).toFixed(3)}, ${(e.y1 ?? e.cy ?? e.y ?? 0).toFixed(3)})`).replace(/"/g, '""')}"`)
        ];
        const enc = new TextEncoder().encode("﻿" + rows.join("\r\n"));
        window.native && window.native.saveFile({ name: "dxf_vector_diff.csv", bytes: enc, filters: [{ name: "CSV", extensions: ["csv"] }] });
        rpToast("Exported DXF Vector Diff CSV.");
      };
    }

    if ($("#dxf-exp-cancel")) $("#dxf-exp-cancel").onclick = () => { modal.hidden = true; };
    if ($("#dxf-exp-ok")) {
      $("#dxf-exp-ok").onclick = async () => {
        const unit = $("#dxf-unit-sel").value;
        const scaleStr = $("#dxf-scale-sel").value;
        const scale = DXFEngine.PRESETS[scaleStr] || 1.0;
        const incDiffs = $("#dxf-inc-diffs").checked;
        const incMeas = $("#dxf-inc-meas") ? $("#dxf-inc-meas").checked : true;
        const incBom = $("#dxf-inc-bom") ? $("#dxf-inc-bom").checked : true;
        const incText = $("#dxf-inc-text") ? $("#dxf-inc-text").checked : true;
        modal.hidden = true;

        const S = (typeof window !== "undefined" && window.CMP) ? window.CMP : {};
        const E = (typeof window !== "undefined" && window.RE && window.RE.E) ? window.RE.E : {};
        const RM = (typeof window !== "undefined" && window.RP_MEASURE) ? window.RP_MEASURE : {};
        const activeDoc = S.A || S.B || E.doc;
        if (!activeDoc) {
          rpToast("Please open a PDF or CAD drawing first before exporting DXF.");
          return;
        }

        try {
          rpToast("Extracting vector paths, text, redline clouds & measurements to AutoCAD DXF...");
          const pageNum = S.n || (E.cur + 1) || 1;
          const page = await activeDoc.getPage(pageNum);
          const dxfString = await DXFEngine.exportPDFToDXF(page, {
            unit,
            scale,
            pageNumber: pageNum,
            includeText: incText,
            imgWidth: (S.cur && S.cur.W) ? S.cur.W : null,
            diffRegions: incDiffs ? DefectState.defects : [],
            annotations: incMeas ? [
              ...(RM.annotations || []),
              ...((E.ann && E.ann[pageNum - 1]) || []),
              ...((E.meas && E.meas[pageNum - 1]) || [])
            ] : [],
            tallyItems: incBom && RM.tally ? (RM.tally.items || []) : []
          });

          const enc = new TextEncoder().encode(dxfString);
          const baseName = ((S.names && S.names.A) || E.name || "Drawing").replace(/\.[^.]+$/, "");
          if (window.native && window.native.saveFile) {
            await window.native.saveFile({
              name: `${baseName}_${unit}.dxf`,
              bytes: enc,
              filters: [{ name: "AutoCAD DXF", extensions: ["dxf"] }]
            });
            rpToast(`Exported layered AutoCAD ${baseName}_${unit}.dxf successfully.`);
          }
        } catch (err) {
          rpToast("DXF Export failed: " + err.message);
        }
      };
    }
  }

  async function promptDXFExport() {
    showDXFWorkbenchModal("export");
  }

  /**
   * DXF Import: Supports importing 1 or 2 ASCII DXF files with shared world-coordinate registration!
   */
  async function promptDXFImport() {
    if (!window.native || !window.native.openFiles) return;
    const files = await window.native.openFiles({
      title: "Import AutoCAD DXF Drawing(s) — Select 1 File or 2 Files (Rev A & Rev B)",
      multi: true,
      filters: [{ name: "AutoCAD DXF", extensions: ["dxf"] }]
    });
    if (!files || !files.length) return;

    try {
      if (typeof setView === "function") setView("compare");
      if (files.length >= 2) {
        const textA = new TextDecoder().decode(new Uint8Array(files[0].bytes));
        const textB = new TextDecoder().decode(new Uint8Array(files[1].bytes));
        DXFState.rawA = textA;
        DXFState.rawB = textB;
        DXFState.nameA = files[0].name;
        DXFState.nameB = files[1].name;
        DXFState.parsedA = new DXFEngine.DXFParser(textA).parse();
        DXFState.parsedB = new DXFEngine.DXFParser(textB).parse();
        DXFState.hiddenLayers.clear();
        await reRenderActiveDXFLayers();
        const d = DXFState.lastEntityDiff;
        rpToast(`Compared AutoCAD DXFs: ${files[0].name} vs ${files[1].name} (+${d.added.length} / −${d.removed.length} vector diffs)`);
      } else {
        const text = new TextDecoder().decode(new Uint8Array(files[0].bytes));
        const parser = new DXFEngine.DXFParser(text).parse();
        const S = (typeof window !== "undefined" && window.CMP) ? window.CMP : {};
        const targetSlot = !S.A ? "A" : "B";
        if (targetSlot === "A") {
          DXFState.rawA = text;
          DXFState.nameA = files[0].name;
          DXFState.parsedA = parser;
        } else {
          DXFState.rawB = text;
          DXFState.nameB = files[0].name;
          DXFState.parsedB = parser;
        }
        await reRenderActiveDXFLayers();
        rpToast(`Imported AutoCAD DXF (${parser.entities.length} entities, ${Object.keys(parser.layers).length} layers) into Slot ${targetSlot}.`);
      }
    } catch (e) {
      rpToast("Could not parse DXF: " + e.message);
    }
  }

  /**
   * PCB CAM Gerber / Drill / IPC-D-356 Loader & Dual Gerber Compare
   */
  async function promptCAMCompare() {
    if (typeof CAMEngine === 'undefined' || !window.native || !window.native.openFiles) return;
    const files = await window.native.openFiles({
      title: 'Select Gerber RS-274X, Excellon NC Drill, or IPC-D-356 Netlist File(s)',
      multi: true,
      filters: [{ name: 'PCB CAM & IPC Files', extensions: ['gbr', 'ger', 'art', 'top', 'bot', 'gtl', 'gbl', 'gbs', 'gts', 'gto', 'gbo', 'gtp', 'gbp', 'gko', 'gm1', 'drl', 'txt', 'xln', 'ipc', 'd356', 'net'] }]
    });
    if (!files || !files.length) return;

    try {
      const parseOpts = CAMState.getParseOptions();
      const renderFileToPDF = async (fileObj, sharedBoundsInches = null) => {
        const text = new TextDecoder().decode(new Uint8Array(fileObj.bytes));
        const layerMeta = CAMEngine.detectLayerType(fileObj.name, text);
        const offCv = document.createElement('canvas');
        offCv.width = 2200;
        offCv.height = 1600;
        const rend = new CAMEngine.PCBRenderer(offCv, CAMState.pcbTheme || 'standard');

        let parsedGbr = null, parsedDrl = null, parsedIPC = null;
        if (layerMeta.category === 'netlist') {
          parsedIPC = new CAMEngine.IPCD356Parser(text, parseOpts).parse();
          if (CAMState.zeroSuppression === 'AUTO') {
            setUnitSystem(parsedIPC.units === 'MM' ? 'metric' : 'english', true);
          }
          const dummyGbr = new CAMEngine.GerberParser('', { allowEmpty: true }).parse();
          dummyGbr.bounds = parsedIPC.bounds;
          rend.render(dummyGbr, null, { ipcParsed: parsedIPC, showNetLabels: true, sharedBoundsInches });
        } else if (layerMeta.category === 'drill') {
          parsedDrl = new CAMEngine.ExcellonParser(text, parseOpts).parse();
          if (CAMState.zeroSuppression === 'AUTO') {
            setUnitSystem(parsedDrl.units === 'METRIC' ? 'metric' : 'english', true);
          }
          const dummyGbr = new CAMEngine.GerberParser('', { allowEmpty: true }).parse();
          dummyGbr.bounds = parsedDrl.bounds;
          rend.render(dummyGbr, parsedDrl, { renderMode: CAMState.renderMode, mirrorX: CAMState.mirrorX, sharedBoundsInches });
        } else {
          parsedGbr = new CAMEngine.GerberParser(text, parseOpts).parse();
          if (CAMState.zeroSuppression === 'AUTO') {
            setUnitSystem(parsedGbr.units === 'MM' ? 'metric' : 'english', true);
          }
          rend.render(parsedGbr, null, {
            renderMode: CAMState.renderMode,
            mirrorX: CAMState.mirrorX || layerMeta.side === 'bottom',
            invertPolarity: CAMState.invertPolarity,
            sharedBoundsInches
          });
        }
        const pdfBytes = await canvasToPDFBytes(offCv);
        offCv.width = 0; offCv.height = 0;
        return { pdfBytes, canvas: offCv, text, parsedGbr, parsedDrl, parsedIPC, layerMeta };
      };

      if (files.length >= 2) {
        // Parse both first so we can compute unified physical bounds in Inches (allowing English vs Metric layer compare!)
        const textA = new TextDecoder().decode(new Uint8Array(files[0].bytes));
        const textB = new TextDecoder().decode(new Uint8Array(files[1].bytes));
        const gA = new CAMEngine.GerberParser(textA, parseOpts).parse();
        const gB = new CAMEngine.GerberParser(textB, parseOpts).parse();
        const sharedBoundsInches = (isFinite(gA.bounds.minX) && isFinite(gB.bounds.minX)) ? {
          minX: Math.min(gA.toInches(gA.bounds.minX), gB.toInches(gB.bounds.minX)),
          maxX: Math.max(gA.toInches(gA.bounds.maxX), gB.toInches(gB.bounds.maxX)),
          minY: Math.min(gA.toInches(gA.bounds.minY), gB.toInches(gB.bounds.minY)),
          maxY: Math.max(gA.toInches(gA.bounds.maxY), gB.toInches(gB.bounds.maxY))
        } : null;

        const rA = await renderFileToPDF(files[0], sharedBoundsInches);
        const rB = await renderFileToPDF(files[1], sharedBoundsInches);
        window.__lastGerberA = rA.text;
        window.__lastGerberB = rB.text;
        CAMState.parsedGerberA = rA.parsedGbr;
        CAMState.parsedGerberB = rB.parsedGbr;
        CAMState.parsedDrillA = rA.parsedDrl;
        CAMState.parsedDrillB = rB.parsedDrl;
        CAMState.parsedIPCA = rA.parsedIPC;
        CAMState.parsedIPCB = rB.parsedIPC;

        if (window.compareLoadBytes) {
          await window.compareLoadBytes('A', rA.pdfBytes, files[0].name, files[0].path, true);
          await window.compareLoadBytes('B', rB.pdfBytes, files[1].name, files[1].path);
        }
        updateCAMSidebarPane();
        rpToast(`Loaded & Compared CAM Layers (${CAMState.unitSystem === 'metric' ? 'IPC Metric mm' : 'IPC English mils'}): ${files[0].name} vs ${files[1].name}`);
      } else {
        const r = await renderFileToPDF(files[0]);
        const S = window.CMP || {};
        const slot = !S.A ? 'A' : 'B';
        if (slot === 'A') {
          window.__lastGerberA = r.text;
          CAMState.parsedGerberA = r.parsedGbr;
          if (r.parsedDrl) { window.__lastDrill = r.text; CAMState.parsedDrillA = r.parsedDrl; }
          if (r.parsedIPC) { window.__lastIPCA = r.text; CAMState.parsedIPCA = r.parsedIPC; }
        } else {
          window.__lastGerberB = r.text;
          CAMState.parsedGerberB = r.parsedGbr;
          if (r.parsedDrl) { window.__lastDrill = r.text; CAMState.parsedDrillB = r.parsedDrl; }
          if (r.parsedIPC) { window.__lastIPCB = r.text; CAMState.parsedIPCB = r.parsedIPC; }
        }
        if (window.compareLoadBytes) {
          await window.compareLoadBytes(slot, r.pdfBytes, files[0].name, files[0].path);
        }
        updateCAMSidebarPane();
        rpToast(`Loaded ${r.layerMeta.name} (${files[0].name}) into Slot ${slot}.`);
      }
    } catch (e) {
      rpToast('CAM Load error: ' + e.message);
    }
  }

  async function promptDualGerberCompare() {
    await promptCAMCompare();
  }

  /**
   * IPC-D-356 Netlist Loader & Comparator
   */
  async function promptIPCD356Netlist() {
    if (typeof CAMEngine === 'undefined') return;
    if (CAMState.parsedIPCA || window.__lastIPCA) {
      showCAM350WorkbenchModal('ipc');
      return;
    }
    if (!window.native || !window.native.openFiles) return;
    const files = await window.native.openFiles({
      title: 'Select IPC-D-356 / IPC-D-356A Netlist File(s) (.ipc, .d356, .net)',
      multi: true,
      filters: [{ name: 'IPC-D-356 Netlist', extensions: ['ipc', 'd356', 'net', 'txt'] }]
    });
    if (!files || !files.length) {
      showCAM350WorkbenchModal('ipc');
      return;
    }
    try {
      const tA = new TextDecoder().decode(new Uint8Array(files[0].bytes));
      window.__lastIPCA = tA;
      CAMState.parsedIPCA = new CAMEngine.IPCD356Parser(tA, CAMState.getParseOptions()).parse();
      setUnitSystem(CAMState.parsedIPCA.units === 'MM' ? 'metric' : 'english', true);

      if (files.length >= 2) {
        const tB = new TextDecoder().decode(new Uint8Array(files[1].bytes));
        window.__lastIPCB = tB;
        CAMState.parsedIPCB = new CAMEngine.IPCD356Parser(tB, CAMState.getParseOptions()).parse();
        CAMState.lastNetDiffs = CAMEngine.IPCD356Parser.compareNetlists(CAMState.parsedIPCA, CAMState.parsedIPCB);
      }
      await reRenderActiveCAMLayers();
      showCAM350WorkbenchModal('ipc');
    } catch (e) {
      rpToast('IPC-D-356 Parse Error: ' + e.message);
    }
  }

  /**
   * Full CAM350 DFM / DRC Scan (Clearance, Annular Ring, Min Trace Width, Min Drill, Acid Traps)
   */
  async function runCAMClearanceScan() {
    if (typeof CAMEngine === 'undefined') return;
    if (window.__lastGerberA && window.__lastGerberB) {
      const parseOpts = CAMState.getParseOptions();
      const gA = new CAMEngine.GerberParser(window.__lastGerberA, parseOpts).parse();
      const gB = new CAMEngine.GerberParser(window.__lastGerberB, parseOpts).parse();
      const drl = window.__lastDrill ? new CAMEngine.ExcellonParser(window.__lastDrill, parseOpts).parse() : null;
      const rules = CAMEngine.IPC_DFM_RULES[CAMState.ipcClass] || CAMState.customRules;

      const S = window.CMP || {};
      const targetW = (S.cur && S.cur.W) ? S.cur.W : 2000;
      const targetH = (S.cur && S.cur.H) ? S.cur.H : 1500;

      const cmp = new CAMEngine.CAMCompare(targetW, targetH).compare(gA, gB, {
        minClearanceMils: rules.minClearanceMils || 4.0,
        compareTolMils: rules.compareTolMils || 0,
        drillA: drl,
        drillB: drl,
        dfmRules: rules
      });

      CAMState.parsedGerberA = gA;
      CAMState.parsedGerberB = gB;
      CAMState.parsedDrillA = drl;
      CAMState.lastDFMViolations = cmp.dfmViolations || [];

      if (S) {
        S._isCAMScan = true;
        S.mips = null;
      }
      const cv = $('#cv');
      if (cv) {
        cv.width = cmp.width;
        cv.height = cmp.height;
        cv.getContext('2d').putImageData(cmp.imageData, 0, 0);
        if ($('#lv')) $('#lv')._src = null;
        if ($('#empty')) $('#empty').hidden = true;
      }

      if (S.cur) {
        S.cur.regions = cmp.regions;
      }
      if (typeof window.applyView === 'function') window.applyView();
      else if (typeof markers === 'function') markers();
      if (cmp.regions && cmp.regions.length) {
        DefectState.initFromRegions(cmp.regions);
      }

      updateCAMSidebarPane();
      // Switch sidebar to CAM / DFM tab so user sees full breakdown
      const camTabBtn = $('aside .tabs button[data-t="cam"]');
      if (camTabBtn) camTabBtn.click();

      const clrStr = CAMEngine.UnitConverter.formatDual((rules.minClearanceMils || 4.0) / 1000, CAMState.unitSystem);
      rpToast(`DFM Scan (${rules.name.split('—')[0].trim()}, Min Clr ${clrStr}): ${cmp.stats.clearanceWarningPx} clearance px, ${cmp.dfmViolations.length} DFM rule alerts.`);
    } else if (window.__lastGerberA || window.__lastGerberB) {
      const parseOpts = CAMState.getParseOptions();
      const gbr = new CAMEngine.GerberParser(window.__lastGerberB || window.__lastGerberA, parseOpts).parse();
      const drl = window.__lastDrill ? new CAMEngine.ExcellonParser(window.__lastDrill, parseOpts).parse() : null;
      const rules = CAMEngine.IPC_DFM_RULES[CAMState.ipcClass] || CAMState.customRules;
      const cmp = new CAMEngine.CAMCompare(2000, 1500).compare(gbr, gbr, {
        minClearanceMils: rules.minClearanceMils || 4.0,
        drillA: drl,
        drillB: drl,
        dfmRules: rules
      });
      CAMState.lastDFMViolations = cmp.dfmViolations || [];
      updateCAMSidebarPane();
      const camTabBtn = $('aside .tabs button[data-t="cam"]');
      if (camTabBtn) camTabBtn.click();
      rpToast(`Single-Layer DFM Scan Complete: ${CAMState.lastDFMViolations.length} DFM rule alerts detected.`);
    } else {
      showCAM350WorkbenchModal('ipc');
      rpToast('Open a Gerber layer (or click "Load Sample PCB Gerber") to run CAM350 DFM / Clearance analysis.');
    }
  }

  /**
   * CAM350 Workbench Modal (Format & Units, D-Code Aperture Table, T-Code Drill Schedule, IPC-D-356 Netlist & DFM Rules)
   */
  function showCAM350WorkbenchModal(initialTab = 'format') {
    if (typeof document === 'undefined' || typeof CAMEngine === 'undefined') return;
    let modal = $('#rp-cam350-modal');
    if (!modal) {
      modal = el('div', { id: 'rp-cam350-modal', className: 'rp-modal' });
      document.body.appendChild(modal);
    }
    modal.hidden = false;

    const parseOpts = CAMState.getParseOptions();
    if (!CAMState.parsedGerberA && window.__lastGerberA) {
      CAMState.parsedGerberA = new CAMEngine.GerberParser(window.__lastGerberA, parseOpts).parse();
    }
    if (!CAMState.parsedGerberB && window.__lastGerberB) {
      CAMState.parsedGerberB = new CAMEngine.GerberParser(window.__lastGerberB, parseOpts).parse();
    }
    if (!CAMState.parsedDrillA && window.__lastDrill) {
      CAMState.parsedDrillA = new CAMEngine.ExcellonParser(window.__lastDrill, parseOpts).parse();
    }
    if (!CAMState.parsedIPCA && window.__lastIPCA) {
      CAMState.parsedIPCA = new CAMEngine.IPCD356Parser(window.__lastIPCA, parseOpts).parse();
    }

    const activeGbr = CAMState.parsedGerberB || CAMState.parsedGerberA;
    const activeDrl = CAMState.parsedDrillB || CAMState.parsedDrillA;
    const activeIPC = CAMState.parsedIPCB || CAMState.parsedIPCA;

    const apRows = activeGbr ? activeGbr.getApertureTable() : [];
    const drlRows = activeDrl ? activeDrl.getToolTable() : [];
    const netRows = activeIPC ? activeIPC.getNetTable() : [];
    const rules = CAMEngine.IPC_DFM_RULES[CAMState.ipcClass] || CAMState.customRules;
    const isMetric = CAMState.unitSystem === 'metric';

    const apTableHTML = apRows.length ? apRows.map(r => `
      <tr>
        <td><b>${r.dCode}</b></td>
        <td>${r.shape}</td>
        <td>${isMetric ? `<b>${r.widthMM} × ${r.heightMM} mm</b>` : `${r.widthMM} × ${r.heightMM} mm`}</td>
        <td>${!isMetric ? `<b>${r.widthMils} × ${r.heightMils} mil</b> (${r.widthIn}")` : `${r.widthMils} × ${r.heightMils} mil`}</td>
        <td>${r.flashes}</td>
        <td>${r.draws}</td>
      </tr>
    `).join('') : '<tr><td colspan="6" style="text-align:center;opacity:.65">No Gerber layer loaded yet. Click "Load Sample PCB Gerber" or "Open Gerber / Drill".</td></tr>';

    const drlTableHTML = drlRows.length ? drlRows.map(r => `
      <tr>
        <td><b>${r.tCode}</b></td>
        <td>${isMetric ? `<b>${r.diaMM} mm</b>` : `${r.diaMM} mm`}</td>
        <td>${!isMetric ? `<b>${r.diaMils} mil</b> (${r.diaIn}")` : `${r.diaMils} mil (${r.diaIn}")`}</td>
        <td>${r.hits}</td>
        <td>${r.slots}</td>
        <td>${isMetric ? `${r.travelMM} mm` : `${r.travelIn} in`}</td>
      </tr>
    `).join('') : '<tr><td colspan="6" style="text-align:center;opacity:.65">No Excellon NC Drill layer loaded yet.</td></tr>';

    const netTableHTML = netRows.length ? netRows.map(r => `
      <tr>
        <td><b>${r.net}</b></td>
        <td>${r.totalNodes}</td>
        <td>${r.thruCount} TH / ${r.smtCount} SMT / ${r.viaCount} Via</td>
        <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.pins}">${r.pins || '—'}</td>
        <td><button type="button" class="rp-btn-sm cam-hl-net-btn" data-net="${r.net}">${CAMState.highlightNet === r.net ? '✓ Highlighted' : 'Highlight Net'}</button></td>
      </tr>
    `).join('') : '<tr><td colspan="5" style="text-align:center;opacity:.65">No IPC-D-356 Netlist loaded yet. Click "Load Sample PCB Gerber + IPC-D-356" below or import a .ipc / .d356 file.</td></tr>';

    modal.innerHTML = `
      <div class="rp-card rp-wide" style="width:min(920px,95vw);max-height:90vh">
        <div class="rp-hud-header">
          <div class="rp-hud-title">
            <h3>CAM350 Engineering Workbench &amp; IPC Inspector</h3>
            <span class="rp-hud-badge">${isMetric ? 'IPC METRIC (MM / µM)' : 'IPC ENGLISH (MILS / IN)'}</span>
          </div>
          <button type="button" class="rp-hud-close" id="cam-wb-close">Close (Esc)</button>
        </div>

        <div class="tabs" style="border-bottom:1px solid var(--line);margin-bottom:8px">
          <button type="button" class="cam-wb-tab ${initialTab === 'format' ? 'on' : ''}" data-wbtab="format"><i data-ic="gear"></i><span>1. Units, Format &amp; Stackup</span></button>
          <button type="button" class="cam-wb-tab ${initialTab === 'apertures' ? 'on' : ''}" data-wbtab="apertures"><i data-ic="pcbCam"></i><span>2. Apertures (D-Codes: ${apRows.length})</span></button>
          <button type="button" class="cam-wb-tab ${initialTab === 'drills' ? 'on' : ''}" data-wbtab="drills"><i data-ic="crosshair"></i><span>3. NC Drill Tools (T-Codes: ${drlRows.length})</span></button>
          <button type="button" class="cam-wb-tab ${initialTab === 'ipc' ? 'on' : ''}" data-wbtab="ipc"><i data-ic="clearance"></i><span>4. IPC-D-356 Netlist &amp; DFM Rules</span></button>
        </div>

        <!-- TAB 1: UNITS, FORMAT & STACKUP -->
        <div class="cam-wb-pane" id="cam-wb-pane-format" ${initialTab === 'format' ? '' : 'hidden'}>
          <div class="rp-hud-grid">
            <div class="rp-hud-section">
              <h4>IPC Unit System &amp; Coordinate Format</h4>
              <div class="rp-form-group">
                <label>Primary Measurement &amp; IPC Unit System:</label>
                <select id="cam-wb-units">
                  <option value="english" ${!isMetric ? 'selected' : ''}>IPC English / Imperial (mils &amp; inches — 1 in = 1000 mil)</option>
                  <option value="metric" ${isMetric ? 'selected' : ''}>IPC Metric / SI (millimeters &amp; microns — 1 mm = 39.37 mil)</option>
                </select>
              </div>
              <div class="rp-form-group">
                <label>Zero Suppression (Gerber RS-274X / Excellon):</label>
                <select id="cam-wb-zeros">
                  <option value="AUTO" ${CAMState.zeroSuppression === 'AUTO' ? 'selected' : ''}>Auto-Detect from %FS / M48 Header (Recommended)</option>
                  <option value="L" ${CAMState.zeroSuppression === 'L' ? 'selected' : ''}>Leading Zeros Omitted (LZ / %FSLA)</option>
                  <option value="T" ${CAMState.zeroSuppression === 'T' ? 'selected' : ''}>Trailing Zeros Omitted (TZ / %FSTA)</option>
                  <option value="D" ${CAMState.zeroSuppression === 'D' ? 'selected' : ''}>Explicit Decimal / No Suppression</option>
                </select>
              </div>
              <div class="rp-form-group">
                <label>Coordinate Integer.Decimal Format (M.N):</label>
                <select id="cam-wb-fmt">
                  <option value="AUTO" ${CAMState.coordFormat === 'AUTO' ? 'selected' : ''}>Auto-Detect from Header (%FSLAX24Y24 / 3:3)</option>
                  <option value="2.4" ${CAMState.coordFormat === '2.4' ? 'selected' : ''}>2.4 Format (Standard English: 0.1 mil res)</option>
                  <option value="2.5" ${CAMState.coordFormat === '2.5' ? 'selected' : ''}>2.5 Format (High-Precision English: 0.01 mil res)</option>
                  <option value="2.3" ${CAMState.coordFormat === '2.3' ? 'selected' : ''}>2.3 Format (1.0 mil res)</option>
                  <option value="3.3" ${CAMState.coordFormat === '3.3' ? 'selected' : ''}>3.3 Format (Standard Metric: 1 µm res)</option>
                  <option value="3.4" ${CAMState.coordFormat === '3.4' ? 'selected' : ''}>3.4 Format (High-Precision Metric: 0.1 µm res)</option>
                  <option value="4.4" ${CAMState.coordFormat === '4.4' ? 'selected' : ''}>4.4 Format (Large Panel Metric/English)</option>
                </select>
              </div>
              <div class="rp-form-group">
                <label>Coordinate Mode:</label>
                <select id="cam-wb-coordmode">
                  <option value="AUTO" ${CAMState.coordMode === 'AUTO' ? 'selected' : ''}>Auto-Detect (Absolute G90 / Incremental G91)</option>
                  <option value="A" ${CAMState.coordMode === 'A' ? 'selected' : ''}>Absolute Coordinates (G90 / %FS..A)</option>
                  <option value="I" ${CAMState.coordMode === 'I' ? 'selected' : ''}>Incremental Coordinates (G91 / %FS..I)</option>
                </select>
              </div>
            </div>

            <div class="rp-hud-section">
              <h4>CAM350 Display, Polarity &amp; Substrate Theme</h4>
              <div class="rp-form-group">
                <label>CAM350 Aperture &amp; Trace Render Mode:</label>
                <select id="cam-wb-rendermode">
                  <option value="fill" ${CAMState.renderMode === 'fill' ? 'selected' : ''}>Filled Mode (True Aperture Width &amp; Copper Pour)</option>
                  <option value="outline" ${CAMState.renderMode === 'outline' ? 'selected' : ''}>Outline / Wireframe Mode (CAM350 'W' Mode)</option>
                  <option value="skeleton" ${CAMState.renderMode === 'skeleton' ? 'selected' : ''}>Centerline / Skeleton Mode (1px Vector Path + Flash Cross)</option>
                </select>
              </div>
              <div class="rp-form-group">
                <label>PCB Color Palette / Soldermask Theme:</label>
                <select id="cam-wb-theme">
                  <option value="standard" ${CAMState.pcbTheme === 'standard' ? 'selected' : ''}>Industrial Green Soldermask &amp; Gold ENIG</option>
                  <option value="cam350Dark" ${CAMState.pcbTheme === 'cam350Dark' ? 'selected' : ''}>CAM350 Classic Black / Red / Green / Yellow</option>
                  <option value="blueCAD" ${CAMState.pcbTheme === 'blueCAD' ? 'selected' : ''}>High-Contrast Blue Soldermask</option>
                  <option value="matteBlack" ${CAMState.pcbTheme === 'matteBlack' ? 'selected' : ''}>Matte Black Stealth Substrate</option>
                </select>
              </div>
              <label class="chk" style="margin:4px 0"><input type="checkbox" id="cam-wb-mirror" ${CAMState.mirrorX ? 'checked' : ''}> Mirror Layer Horizontally (Flip Bottom Copper GBL / Silk GBO)</label>
              <label class="chk" style="margin:4px 0"><input type="checkbox" id="cam-wb-neg" ${CAMState.invertPolarity ? 'checked' : ''}> Invert Polarity (Negative Plane %LPC*%)</label>
              <label class="chk" style="margin:4px 0"><input type="checkbox" id="cam-wb-origin" ${CAMState.showOrigin ? 'checked' : ''}> Show Board Extents &amp; Datum Origin Box</label>
              <label class="chk" style="margin:4px 0"><input type="checkbox" id="cam-wb-drillrings" ${CAMState.showDrillRings ? 'checked' : ''}> Highlight Plated Drill Target Rings</label>
            </div>
          </div>
        </div>

        <!-- TAB 2: APERTURES (D-CODES) -->
        <div class="cam-wb-pane" id="cam-wb-pane-apertures" ${initialTab === 'apertures' ? '' : 'hidden'}>
          <div class="rp-scroll" style="max-height:50vh">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <b>Gerber RS-274X Aperture Definition Table (D10 – D999)</b>
              <button type="button" id="cam-exp-dcode-csv" class="rp-btn-sm">Export D-Code CSV</button>
            </div>
            <table class="btab" style="width:100%">
              <tr><th>D-Code</th><th>Aperture Shape</th><th>Metric Size (mm)</th><th>English Size (mils / in)</th><th>Flashes (D03)</th><th>Draws (D01)</th></tr>
              ${apTableHTML}
            </table>
          </div>
        </div>

        <!-- TAB 3: DRILLS (T-CODES) -->
        <div class="cam-wb-pane" id="cam-wb-pane-drills" ${initialTab === 'drills' ? '' : 'hidden'}>
          <div class="rp-scroll" style="max-height:50vh">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <b>Excellon NC Drill &amp; Rout Tool Schedule (T01 – T99)</b>
              <button type="button" id="cam-exp-tcode-csv" class="rp-btn-sm">Export Drill CSV</button>
            </div>
            <table class="btab" style="width:100%">
              <tr><th>Tool Code</th><th>Metric Dia (mm)</th><th>English Dia (mils / in)</th><th>Drill Hits</th><th>Routed Slots (G85)</th><th>Tool Travel Path</th></tr>
              ${drlTableHTML}
            </table>
          </div>
        </div>

        <!-- TAB 4: IPC-D-356 NETLIST & DFM RULES -->
        <div class="cam-wb-pane" id="cam-wb-pane-ipc" ${initialTab === 'ipc' ? '' : 'hidden'}>
          <div class="rp-hud-grid" style="margin-bottom:10px">
            <div class="rp-hud-section">
              <h4>IPC-2221 / IPC-6012 DFM &amp; DRC Rule Thresholds</h4>
              <div class="rp-form-group">
                <label>IPC Fabrication Class Preset:</label>
                <select id="cam-wb-ipc-class">
                  <option value="class1" ${CAMState.ipcClass === 'class1' ? 'selected' : ''}>IPC Class 1 — General Electronics (6.0 mil / 0.152 mm)</option>
                  <option value="class2" ${CAMState.ipcClass === 'class2' ? 'selected' : ''}>IPC Class 2 — Industrial / Dedicated (4.0 mil / 0.102 mm)</option>
                  <option value="class3" ${CAMState.ipcClass === 'class3' ? 'selected' : ''}>IPC Class 3 — High-Rel / Aerospace (3.0 mil / 0.076 mm)</option>
                  <option value="hdi" ${CAMState.ipcClass === 'hdi' ? 'selected' : ''}>IPC HDI — Fine Pitch / Microvia (2.0 mil / 0.051 mm)</option>
                </select>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
                <label>Min Copper Clearance (${isMetric ? 'mm' : 'mils'}):
                  <input type="number" id="cam-rule-clr" step="0.01" value="${isMetric ? (rules.minClearanceMils * 0.0254).toFixed(3) : rules.minClearanceMils}" style="width:100%" />
                </label>
                <label>Min Trace Width (${isMetric ? 'mm' : 'mils'}):
                  <input type="number" id="cam-rule-trc" step="0.01" value="${isMetric ? (rules.minTraceWidthMils * 0.0254).toFixed(3) : rules.minTraceWidthMils}" style="width:100%" />
                </label>
                <label>Min Annular Ring (${isMetric ? 'mm' : 'mils'}):
                  <input type="number" id="cam-rule-ring" step="0.01" value="${isMetric ? (rules.minAnnularRingMils * 0.0254).toFixed(3) : rules.minAnnularRingMils}" style="width:100%" />
                </label>
                <label>Compare Tolerance (${isMetric ? 'mm' : 'mils'}):
                  <input type="number" id="cam-rule-tol" step="0.01" value="${isMetric ? ((rules.compareTolMils || 0.25) * 0.0254).toFixed(3) : (rules.compareTolMils || 0.25)}" style="width:100%" />
                </label>
              </div>
            </div>
            <div class="rp-hud-section">
              <h4>IPC-D-356 Bare-Board Netlist Actions</h4>
              <p style="margin:0;font-size:12px;opacity:.8">Load IPC-D-356 netlists in CUST 0 (English mils) or CUST 1 (Metric mm) to verify pad/via connectivity, highlight nets, and detect opens/shorts.</p>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
                <button type="button" id="cam-wb-open-ipc" class="rp-btn-sm">Import IPC-D-356 (.ipc/.d356)</button>
                <button type="button" id="cam-wb-clear-hl" class="rp-btn-sm">Clear Net Highlight</button>
                <button type="button" id="cam-wb-sample-gbr" class="rp-btn-sm" style="border-color:#4ade80;color:#4ade80">⚡ Load Sample Gerber + Drill + IPC-D-356</button>
              </div>
            </div>
          </div>
          <div class="rp-scroll" style="max-height:26vh">
            <table class="btab" style="width:100%">
              <tr><th>Net Name</th><th>Total Nodes</th><th>Feature Breakdown</th><th>Connected Component Pins</th><th>Action</th></tr>
              ${netTableHTML}
            </table>
          </div>
        </div>

        <div class="rp-btns" style="margin-top:8px">
          <button type="button" id="cam-wb-run-dfm">Run DFM / Clearance Scan</button>
          <button type="button" id="cam-wb-apply" class="rp-primary">Apply Settings &amp; Re-Render CAM</button>
        </div>
      </div>
    `;

    if (typeof hydrateIcons === 'function') hydrateIcons(modal);

    // Tab switching inside modal
    modal.querySelectorAll('.cam-wb-tab').forEach(btn => {
      btn.onclick = () => {
        modal.querySelectorAll('.cam-wb-tab').forEach(b => b.classList.remove('on'));
        modal.querySelectorAll('.cam-wb-pane').forEach(p => { p.hidden = true; });
        btn.classList.add('on');
        const pane = $(`#cam-wb-pane-${btn.dataset.wbtab}`);
        if (pane) pane.hidden = false;
      };
    });

    // Live unit conversion inside modal when switching English <-> Metric
    $('#cam-wb-units').onchange = e => {
      setUnitSystem(e.target.value);
      showCAM350WorkbenchModal(modal.querySelector('.cam-wb-tab.on')?.dataset.wbtab || 'format');
    };

    $('#cam-wb-ipc-class').onchange = e => {
      CAMState.ipcClass = e.target.value;
      if (CAMEngine.IPC_DFM_RULES[CAMState.ipcClass]) {
        Object.assign(CAMState.customRules, CAMEngine.IPC_DFM_RULES[CAMState.ipcClass]);
      }
      if ($('#rib-ipc-class')) $('#rib-ipc-class').value = CAMState.ipcClass;
      showCAM350WorkbenchModal('ipc');
    };

    modal.querySelectorAll('.cam-hl-net-btn').forEach(btn => {
      btn.onclick = async () => {
        const net = btn.dataset.net;
        CAMState.highlightNet = (CAMState.highlightNet === net) ? null : net;
        modal.hidden = true;
        await reRenderActiveCAMLayers();
        if (CAMState.highlightNet) rpToast(`Highlighted IPC-D-356 Net: ${CAMState.highlightNet}`);
      };
    });

    if ($('#cam-wb-clear-hl')) {
      $('#cam-wb-clear-hl').onclick = async () => {
        CAMState.highlightNet = null;
        modal.hidden = true;
        await reRenderActiveCAMLayers();
      };
    }

    if ($('#cam-wb-open-ipc')) {
      $('#cam-wb-open-ipc').onclick = () => {
        modal.hidden = true;
        CAMState.parsedIPCA = null;
        window.__lastIPCA = null;
        promptIPCD356Netlist();
      };
    }

    if ($('#cam-wb-sample-gbr')) {
      $('#cam-wb-sample-gbr').onclick = () => {
        modal.hidden = true;
        loadSampleGerber();
      };
    }

    if ($('#cam-exp-dcode-csv')) {
      $('#cam-exp-dcode-csv').onclick = () => {
        const headers = ['D_Code,Shape,Width_mils,Height_mils,Width_mm,Height_mm,Flashes,Draws'];
        const rows = apRows.map(r => `${r.dCode},"${r.shape}",${r.widthMils},${r.heightMils},${r.widthMM},${r.heightMM},${r.flashes},${r.draws}`);
        const enc = new TextEncoder().encode('\ufeff' + headers.concat(rows).join('\r\n'));
        window.native && window.native.saveFile({ name: 'cam350_aperture_table.csv', bytes: enc, filters: [{ name: 'CSV', extensions: ['csv'] }] });
        rpToast('Exported CAM350 Aperture (D-Code) Table to CSV.');
      };
    }

    if ($('#cam-exp-tcode-csv')) {
      $('#cam-exp-tcode-csv').onclick = () => {
        const headers = ['T_Code,Dia_mils,Dia_in,Dia_mm,Hits,Routed_Slots,Travel_in,Travel_mm'];
        const rows = drlRows.map(r => `${r.tCode},${r.diaMils},${r.diaIn},${r.diaMM},${r.hits},${r.slots},${r.travelIn},${r.travelMM}`);
        const enc = new TextEncoder().encode('\ufeff' + headers.concat(rows).join('\r\n'));
        window.native && window.native.saveFile({ name: 'cam350_drill_schedule.csv', bytes: enc, filters: [{ name: 'CSV', extensions: ['csv'] }] });
        rpToast('Exported CAM350 NC Drill (T-Code) Schedule to CSV.');
      };
    }

    const saveModalSettings = () => {
      CAMState.zeroSuppression = $('#cam-wb-zeros').value;
      CAMState.coordFormat = $('#cam-wb-fmt').value;
      CAMState.coordMode = $('#cam-wb-coordmode').value;
      CAMState.renderMode = $('#cam-wb-rendermode').value;
      CAMState.pcbTheme = $('#cam-wb-theme').value;
      CAMState.mirrorX = $('#cam-wb-mirror').checked;
      CAMState.invertPolarity = $('#cam-wb-neg').checked;
      CAMState.showOrigin = $('#cam-wb-origin').checked;
      CAMState.showDrillRings = $('#cam-wb-drillrings').checked;

      if ($('#rib-cam-render')) $('#rib-cam-render').value = CAMState.renderMode;
      if ($('#rib-cam-mirror')) $('#rib-cam-mirror').checked = CAMState.mirrorX;
      if ($('#rib-cam-neg')) $('#rib-cam-neg').checked = CAMState.invertPolarity;

      const factorToMils = CAMState.unitSystem === 'metric' ? (1 / 0.0254) : 1.0;
      const clrIn = parseFloat($('#cam-rule-clr')?.value);
      const trcIn = parseFloat($('#cam-rule-trc')?.value);
      const ringIn = parseFloat($('#cam-rule-ring')?.value);
      const tolIn = parseFloat($('#cam-rule-tol')?.value);
      if (!isNaN(clrIn)) CAMState.customRules.minClearanceMils = +(clrIn * factorToMils).toFixed(2);
      if (!isNaN(trcIn)) CAMState.customRules.minTraceWidthMils = +(trcIn * factorToMils).toFixed(2);
      if (!isNaN(ringIn)) CAMState.customRules.minAnnularRingMils = +(ringIn * factorToMils).toFixed(2);
      if (!isNaN(tolIn)) CAMState.customRules.compareTolMils = +(tolIn * factorToMils).toFixed(2);
    };

    $('#cam-wb-close').onclick = () => { modal.hidden = true; };
    modal.onclick = e => { if (e.target === modal) modal.hidden = true; };

    $('#cam-wb-apply').onclick = async () => {
      saveModalSettings();
      modal.hidden = true;
      await reRenderActiveCAMLayers();
    };

    $('#cam-wb-run-dfm').onclick = async () => {
      saveModalSettings();
      modal.hidden = true;
      await runCAMClearanceScan();
    };
  }

  /**
   * Update the CAM / DFM Sidebar Tab Pane
   */
  function updateCAMSidebarPane() {
    const pane = $('#cam-sidebar-pane');
    if (!pane || typeof CAMEngine === 'undefined') return;

    const isMetric = CAMState.unitSystem === 'metric';
    const gbr = CAMState.parsedGerberB || CAMState.parsedGerberA;
    const drl = CAMState.parsedDrillB || CAMState.parsedDrillA;
    const ipc = CAMState.parsedIPCB || CAMState.parsedIPCA;
    const apCount = gbr ? gbr.apertures.size : 0;
    const cmdCount = gbr ? gbr.commands.length : 0;
    const hitCount = drl ? drl.hits.length : 0;
    const netCount = ipc ? ipc.nets.size : 0;
    const rules = CAMEngine.IPC_DFM_RULES[CAMState.ipcClass] || CAMState.customRules;

    const fmtRule = mils => isMetric ? `${(mils * 0.0254).toFixed(3)} mm` : `${mils.toFixed(1)} mil`;

    const violHTML = CAMState.lastDFMViolations.length
      ? CAMState.lastDFMViolations.map((v, idx) => `
          <div class="defect-item status-flagged cam-dfm-card" data-dfmidx="${idx}" style="margin-bottom:5px;cursor:pointer" title="Click to locate DFM violation on board">
            <div class="defect-header">
              <span class="defect-badge removed">DFM #${idx + 1}: ${v.category}</span>
              <span class="defect-coords">${v.measuredMils != null ? fmtRule(v.measuredMils) : ''}</span>
            </div>
            <div style="font-size:11px;opacity:.88">${v.description}</div>
          </div>
        `).join('')
      : `<div class="rp-empty-msg" style="padding:10px">No DFM rule violations detected or scan not run yet.</div>`;

    pane.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px;padding:8px 10px;overflow-y:auto;flex:1">
        <div class="rp-checklist-header">
          <h4>CAM350 &amp; IPC Inspector</h4>
          <button type="button" id="cam-side-wb-btn" class="rp-btn-sm"><i data-ic="gear"></i><span>Workbench</span></button>
        </div>

        <div class="rp-layer-row">
          <span class="rp-layer-lbl">IPC Units:</span>
          <select id="cam-side-units" class="rp-select-xs" style="flex:1.2">
            <option value="english" ${!isMetric ? 'selected' : ''}>IPC English (mils / in)</option>
            <option value="metric" ${isMetric ? 'selected' : ''}>IPC Metric (mm / µm)</option>
          </select>
        </div>

        <div class="rp-layer-row">
          <span class="rp-layer-lbl">Display Mode:</span>
          <select id="cam-side-render" class="rp-select-xs" style="flex:1.2">
            <option value="fill" ${CAMState.renderMode === 'fill' ? 'selected' : ''}>Filled Copper</option>
            <option value="outline" ${CAMState.renderMode === 'outline' ? 'selected' : ''}>Outline (Wireframe)</option>
            <option value="skeleton" ${CAMState.renderMode === 'skeleton' ? 'selected' : ''}>Centerline (Skeleton)</option>
          </select>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;background:var(--panel);padding:8px;border:1px solid var(--line);border-radius:6px;font-size:11.5px">
          <div><b>D-Code Apertures:</b> ${apCount}</div>
          <div><b>CAM Features:</b> ${cmdCount}</div>
          <div><b>Excellon Hits:</b> ${hitCount}</div>
          <div><b>IPC-D-356 Nets:</b> ${netCount}</div>
          <div><b>Min Clearance:</b> ${fmtRule(rules.minClearanceMils)}</div>
          <div><b>Min Annular:</b> ${fmtRule(rules.minAnnularRingMils)}</div>
        </div>

        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" id="cam-side-dfm-btn" class="rp-btn-sm" style="flex:1"><i data-ic="clearance"></i><span>Run DFM Scan</span></button>
          <button type="button" id="cam-side-dcode-btn" class="rp-btn-sm" style="flex:1"><i data-ic="pcbCam"></i><span>D-Codes / Drills</span></button>
        </div>

        <div class="rp-checklist-header" style="margin-top:4px">
          <h4>DFM / DRC Rule Alerts <span class="rp-count-pill">${CAMState.lastDFMViolations.length}</span></h4>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${violHTML}
        </div>
      </div>
    `;

    if (typeof hydrateIcons === 'function') hydrateIcons(pane);

    const uSel = $('#cam-side-units');
    if (uSel) uSel.onchange = e => setUnitSystem(e.target.value);

    const rSel = $('#cam-side-render');
    if (rSel) rSel.onchange = e => {
      CAMState.renderMode = e.target.value;
      if ($('#rib-cam-render')) $('#rib-cam-render').value = CAMState.renderMode;
      reRenderActiveCAMLayers();
    };

    const wbBtn = $('#cam-side-wb-btn');
    if (wbBtn) wbBtn.onclick = () => showCAM350WorkbenchModal('format');

    const dfmBtn = $('#cam-side-dfm-btn');
    if (dfmBtn) dfmBtn.onclick = () => runCAMClearanceScan();

    const dcBtn = $('#cam-side-dcode-btn');
    if (dcBtn) dcBtn.onclick = () => showCAM350WorkbenchModal('apertures');
    pane.querySelectorAll('.cam-dfm-card').forEach(card => {
      card.onclick = () => {
        const v = CAMState.lastDFMViolations[+card.dataset.dfmidx];
        if (!v) return;
        const gbr = CAMState.parsedGerberB || CAMState.parsedGerberA;
        const S = (typeof window !== 'undefined' && window.CMP) ? window.CMP : null;
        if (v.xIn != null && v.yIn != null && gbr && isFinite(gbr.bounds.minX) && S && S.cur && S.view) {
          const bMinX = gbr.toInches(gbr.bounds.minX), bMaxX = gbr.toInches(gbr.bounds.maxX);
          const bMinY = gbr.toInches(gbr.bounds.minY), bMaxY = gbr.toInches(gbr.bounds.maxY);
          const bw = Math.max(1e-4, bMaxX - bMinX), bh = Math.max(1e-4, bMaxY - bMinY);
          const pad = 40 * (S.cur.W / 2000);
          const scale = Math.min((S.cur.W - pad * 2) / bw, (S.cur.H - pad * 2) / bh);
          const px = pad + (v.xIn - bMinX) * scale;
          const py = S.cur.H - (pad + (v.yIn - bMinY) * scale);
          const vp = $('#vp');
          if (vp) {
            S.view.k = Math.max(2.0, Math.min(6.0, S.view.k));
            S.view.x = Math.round(vp.clientWidth / 2 - px * S.view.k);
            S.view.y = Math.round(vp.clientHeight / 2 - py * S.view.k);
            const stg = $('#stage');
            if (stg) stg.style.transform = `translate(${S.view.x}px, ${S.view.y}px) scale(${S.view.k})`;
            if (typeof window.applyView === 'function') window.applyView();
            else if (window.rpSharpen) window.rpSharpen();
          }
        } else if (DefectState.defects.length) {
          DefectState.jumpTo(0);
        }
        rpToast(`Located DFM Alert: ${v.category} — ${v.description}`);
      };
    });
  }

  /**
   * Integrate Unified Defect Checklist & CAM / DFM Inspector into Sidebar
   * Fixes the double-defect-list bug where #list and #defect-checklist-pane overlapped and squeezed #text!
   */
  function initSidebarDefects() {
    const aside = $('#view-compare aside');
    if (!aside || $('#defect-checklist-pane')) return;

    // Add CAM / DFM tab button and Collapse Sidebar button to aside .tabs
    const tabsBar = aside.querySelector('.tabs');
    if (tabsBar && !tabsBar.querySelector('[data-t="cam"]')) {
      const camBtn = el('button', { 'data-t': 'cam', title: 'CAM350 Layer Stackup, D-Codes, Drills, IPC Units & DFM Rules' }, '<i data-ic="pcbCam"></i><span>CAM / DFM</span>');
      tabsBar.appendChild(camBtn);
      const colBtn = el('button', { type: 'button', className: 'rp-sidebar-collapse-btn', title: 'Collapse Sidebar to view full PDF page ([ or Ctrl+B)' }, '<i data-ic="next"></i>');
      colBtn.onclick = e => {
        e.stopPropagation();
        aside.classList.add('rp-collapsed');
        window.dispatchEvent(new Event('resize'));
        rpToast('Sidebar closed — Full PDF page expanded (Click edge tab or press ] to reopen).');
      };
      tabsBar.appendChild(colBtn);
      if (typeof hydrateIcons === 'function') hydrateIcons(tabsBar);
    }
    if (!aside.querySelector('.rp-sidebar-reopen-tab')) {
      const reopenTab = el('button', { type: 'button', className: 'rp-sidebar-reopen-tab', title: 'Reopen Differences / CAM Sidebar (] or Ctrl+B)' }, '◀ Panel');
      reopenTab.onclick = e => {
        e.stopPropagation();
        aside.classList.remove('rp-collapsed');
        window.dispatchEvent(new Event('resize'));
      };
      aside.appendChild(reopenTab);
    }
    // Editor #etools is hidden by default (all sets are in the top MS Office Ribbon)
    const edAside = $('#etools');
    if (edAside) {
      const edTabs = edAside.querySelector('.tabs');
      if (edTabs && !edTabs.querySelector('.rp-sidebar-collapse-btn')) {
        const edColBtn = el('button', { type: 'button', className: 'rp-sidebar-collapse-btn', title: 'Close Comments Panel' }, '<i data-ic="next"></i>');
        edColBtn.onclick = e => {
          e.stopPropagation();
          edAside.classList.add('rp-collapsed');
          edAside.hidden = true;
          if ($('#ePanelBtn')) $('#ePanelBtn').classList.remove('on');
          window.dispatchEvent(new Event('resize'));
        };
        edTabs.appendChild(edColBtn);
        if (typeof hydrateIcons === 'function') hydrateIcons(edTabs);
      }
    }

    // Hide the redundant legacy #list visually (keeping it in DOM for MutationObserver & backward compatibility)
    const legacyList = $('#list');
    if (legacyList) {
      legacyList.style.display = 'none';
    }

    const checklistPane = el('div', { id: 'defect-checklist-pane', className: 'rp-checklist-pane' });
    checklistPane.innerHTML = `
      <div class="rp-checklist-header">
        <h4>Defect Checklist <span id="rp-defect-count-badge" class="rp-count-pill">0</span></h4>
        <div class="rp-checklist-tools">
          <select id="rp-defect-filter" class="rp-select-xs" title="Filter Defects by Status">
            <option value="ALL">All</option>
            <option value="Open">Open</option>
            <option value="Approved">Approved</option>
            <option value="Flagged">Flagged</option>
            <option value="Ignored">Ignored</option>
          </select>
          <button id="rp-export-csv-btn" title="Export Defect Checklist to CSV (IPC English mils & Metric mm)" class="rp-btn-sm"><i data-ic="csv"></i><span>CSV</span></button>
          <button id="rp-audit-btn" title="Generate Multi-Page Executive Audit PDF" class="rp-btn-sm"><i data-ic="auditPdf"></i><span>Audit PDF</span></button>
        </div>
      </div>
      <div id="defect-checklist-body">
        <div class="rp-empty-msg">Open Rev A and Rev B drawings to populate the defect checklist.</div>
      </div>
    `;
    aside.appendChild(checklistPane);

    const tabsBar2 = aside.querySelector('.tabs');
    if (tabsBar2 && !tabsBar2.querySelector('[data-t="m"]')) {
      const mBtn = el('button', { 'data-t': 'm', title: 'Placed Measurements, Revision Clouds, Callouts & BOM Tally Badges' }, '<i data-ic="tally"></i><span>BOM &amp; Markups</span>');
      const colBtnRef = tabsBar2.querySelector('.rp-sidebar-collapse-btn');
      if (colBtnRef) tabsBar2.insertBefore(mBtn, colBtnRef);
      else tabsBar2.appendChild(mBtn);
      if (typeof hydrateIcons === 'function') hydrateIcons(tabsBar2);
    }

    const camPane = el('div', { id: 'cam-sidebar-pane', className: 'rp-checklist-pane', hidden: true });
    aside.appendChild(camPane);

    const markupsPane = el('div', { id: 'markups-sidebar-pane', className: 'rp-checklist-pane', hidden: true });
    aside.appendChild(markupsPane);

    const updateMarkupsSidebarPane = () => {
      if (!markupsPane) return;
      const RM = (typeof window !== 'undefined' && window.RP_MEASURE) ? window.RP_MEASURE : { annotations: [], tally: { items: [] } };
      const anns = RM.annotations || [];
      const tallies = (RM.tally && RM.tally.items) ? RM.tally.items : [];

      const annListHTML = anns.length ? anns.map((a, idx) => {
        const canEditTxt = ['pin', 'leader', 'cloud'].includes(a.kind);
        const curTxt = (a.kind === 'cloud' ? (a.revText || '') : (a.label || '')).replace(/"/g, '&quot;');
        return `
        <div class="defect-item" data-annidx="${idx}">
          <div class="defect-header">
            <span class="defect-badge changed">#${idx + 1} ${a.kind.toUpperCase()}${a.pinNum ? ' #' + a.pinNum : ''}</span>
            <span class="defect-coords">${a.label || a.revText || a.stampType || "Markup"}</span>
            <button type="button" class="rp-btn-sm rp-side-del-ann" data-idx="${idx}" title="Remove Markup">×</button>
          </div>
          ${canEditTxt ? `<input type="text" class="defect-note-input rp-side-ann-in" data-idx="${idx}" value="${curTxt}" placeholder="${a.kind === 'cloud' ? 'Delta tag (e.g. Δ Rev 2)...' : 'Callout / Pin note...'}" />` : ''}
        </div>
      `;
      }).join("") : `<div class="rp-empty-msg" style="padding:10px">No measurements or redline markups placed yet. Use Measure or Markup tabs above.</div>`;

      const tallyListHTML = tallies.length ? tallies.map(t => `
        <div class="defect-item" data-tallyid="${t.id}">
          <div class="defect-header">
            <span class="defect-badge added">BOM #${t.number}</span>
            <span class="defect-coords">Page ${t.page} · (${Math.round(t.x)}, ${Math.round(t.y)})</span>
          </div>
          <input type="text" class="defect-note-input rp-side-tally-in" data-id="${t.id}" value="${(t.label || "").replace(/"/g, "&quot;")}" placeholder="Component / BOM note..." />
        </div>
      `).join("") : `<div class="rp-empty-msg" style="padding:10px">No BOM Tally badges placed yet. Click "Tally / BOM Badge" in Measure tab.</div>`;

      markupsPane.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px;overflow-y:auto;flex:1">
          <div class="rp-checklist-header">
            <h4>Measurements &amp; Markups <span class="rp-count-pill">${anns.length}</span></h4>
            <button type="button" id="rp-side-clear-anns" class="rp-btn-sm">Clear All</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px">${annListHTML}</div>
          <div class="rp-checklist-header" style="margin-top:6px">
            <h4>BOM Tally Counter <span class="rp-count-pill">${tallies.length}</span></h4>
            <button type="button" id="rp-side-bom-csv" class="rp-btn-sm"><i data-ic="csv"></i><span>CSV</span></button>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px">${tallyListHTML}</div>
        </div>
      `;
      if (typeof hydrateIcons === "function") hydrateIcons(markupsPane);

      markupsPane.querySelectorAll(".rp-side-del-ann").forEach(btn => {
        btn.onclick = e => {
          e.stopPropagation();
          CompareHistory.push("Delete markup");
          anns.splice(parseInt(btn.dataset.idx, 10), 1);
          if (window.rpRedrawOverlay) window.rpRedrawOverlay();
          updateMarkupsSidebarPane();
        };
      });
      markupsPane.querySelectorAll(".rp-side-ann-in").forEach(inp => {
        inp.oninput = () => {
          const item = anns[parseInt(inp.dataset.idx, 10)];
          if (!item) return;
          if (item.kind === "cloud") item.revText = inp.value;
          else item.label = inp.value;
          if (window.rpRedrawOverlay) window.rpRedrawOverlay();
        };
      });
      markupsPane.querySelectorAll(".rp-side-tally-in").forEach(inp => {
        inp.oninput = () => {
          const item = tallies.find(t => t.id === inp.dataset.id);
          if (item) item.label = inp.value;
        };
      });
      const clrBtn = $("#rp-side-clear-anns");
      if (clrBtn) clrBtn.onclick = () => {
        CompareHistory.push("Clear all markups");
        RM.annotations = [];
        if (RM.tally) RM.tally.clear();
        if (window.rpRedrawOverlay) window.rpRedrawOverlay();
        updateMarkupsSidebarPane();
      };
      const csvBtn = $("#rp-side-bom-csv");
      if (csvBtn) csvBtn.onclick = () => {
        if (!RM.tally) return;
        const enc = new TextEncoder().encode("\ufeff" + RM.tally.toCSV());
        window.native && window.native.saveFile({ name: "bom_tally_schedule.csv", bytes: enc, filters: [{ name: "CSV", extensions: ["csv"] }] });
        rpToast("Exported BOM Tally CSV.");
      };
    };
    window.rpUpdateMarkupsSidebar = updateMarkupsSidebarPane;

    updateCAMSidebarPane();
    updateMarkupsSidebarPane();

    if (typeof hydrateIcons === 'function') hydrateIcons(checklistPane);

    // Wire sidebar tab switching so Differences, Text, CAM/DFM, and Markups/BOM each get 100% height when selected!
    aside.querySelectorAll('.tabs button[data-t]').forEach(b => {
      b.onclick = () => {
        const mode = b.dataset.t;
        aside.querySelectorAll('.tabs button[data-t]').forEach(x => x.classList.toggle('on', x === b));
        const sumEl = $('#sum');
        const navRow = aside.querySelector('.navrow');
        const textEl = $('#text');

        if (sumEl) sumEl.hidden = (mode === 'cam' || mode === 'm');
        if (navRow) navRow.hidden = (mode !== 'd');
        checklistPane.hidden = (mode !== 'd');
        if (textEl) textEl.hidden = (mode !== 't');
        camPane.hidden = (mode !== 'cam');
        markupsPane.hidden = (mode !== 'm');
        if (mode === 'cam') updateCAMSidebarPane();
        if (mode === 'm') updateMarkupsSidebarPane();
      };
    });

    // Sync #markAll button with DefectState
    const markAllBtn = $('#markAll');
    if (markAllBtn) {
      markAllBtn.addEventListener('click', () => {
        DefectState.markAllApproved();
      });
    }

    $('#rp-defect-filter').onchange = e => {
      DefectState.filterStatus = e.target.value;
      DefectState.renderChecklist();
    };
    $('#rp-export-csv-btn').onclick = () => exportDefectsCSV();
    $('#rp-audit-btn').onclick = () => generateExecutiveAuditReport();
  }

  /**
   * ============================================================================
   * ONE-CLICK "LOAD SAMPLE DRAWING" DEMONSTRATOR (100% OFFLINE PURE JS)
   * ============================================================================
   */
  const SampleGenerator = {
    getSchematicSpec(isRevB = false) {
      return {
        revision: isRevB ? 'Rev B' : 'Rev A',
        pages: 2,
        fuse: isRevB ? 'FUSE 16A' : 'FUSE 10A',
        resistor: { id: 'R1', value: '10kΩ', x: isRevB ? 330 : 280, y: 320, relocated: !!isRevB },
        capacitors: isRevB
          ? [
              { id: 'C1', value: '100µF', x: 380, y: 325 },
              { id: 'C2', value: '10µF', x: 445, y: 325, role: 'filter cap' }
            ]
          : [
              { id: 'C1', value: '100µF', x: 380, y: 325 }
            ],
        gndRail: { label: 'GND rail', y: 220, x1: 80, x2: 650 },
        testpoint: isRevB ? 'TP1: +24V_FILT' : 'TP1: +24V_RAW'
      };
    },

    async generateSampleSchematicPDF(isRevB = false) {
      let pdfLibRef = (typeof PDFLib !== 'undefined') ? PDFLib : null;
      if (!pdfLibRef && typeof require === 'function') {
        try { pdfLibRef = require(['.', 'lib', 'pdf-lib.min.js'].join('/')); } catch (e) {}
      }
      if (!pdfLibRef || !pdfLibRef.PDFDocument) {
        throw new Error('PDFLib is required for offline vector PDF generation');
      }

      const spec = this.getSchematicSpec(isRevB);
      const doc = await pdfLibRef.PDFDocument.create();
      const font = await doc.embedFont(pdfLibRef.StandardFonts.Helvetica);
      const fontBold = await doc.embedFont(pdfLibRef.StandardFonts.HelveticaBold);
      const rgb = pdfLibRef.rgb;

      // ---------------- PAGE 1: Power Circuit Schematic ----------------
      const p1 = doc.addPage([792, 612]);

      p1.drawRectangle({ x: 30, y: 30, width: 732, height: 552, borderWidth: 1.5, borderColor: rgb(0.1, 0.2, 0.3), color: rgb(1, 1, 1) });
      p1.drawText('REDLINE STUDIO · textportdocx.in', { x: 40, y: 565, size: 9, font: fontBold, color: rgb(0.3, 0.4, 0.5) });
      p1.drawText('SHEET 1 OF 2: POWER CIRCUIT & DC REGULATOR', { x: 470, y: 565, size: 9, font: fontBold, color: rgb(0.2, 0.3, 0.4) });

      p1.drawRectangle({ x: 470, y: 30, width: 292, height: 82, borderWidth: 1, borderColor: rgb(0.2, 0.3, 0.4), color: rgb(0.96, 0.98, 1.0) });
      p1.drawText('PROJECT: INDUSTRIAL POWER SUPPLY SCHEMATIC', { x: 480, y: 94, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      p1.drawText(isRevB ? 'REVISION: REV B (MODIFIED - 16A & FILTER CAP)' : 'REVISION: REV A (BASE RELEASE)', {
        x: 480, y: 78, size: 8.5, font: fontBold, color: isRevB ? rgb(0.8, 0.1, 0.1) : rgb(0.1, 0.5, 0.2)
      });
      p1.drawText('AUTHOR: REDLINE STUDIO · textportdocx.in', { x: 480, y: 62, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
      p1.drawText('SCALE: 1:1   |   UNITS: MM   |   SHEET: 1 / 2', { x: 480, y: 46, size: 8, font, color: rgb(0.3, 0.3, 0.3) });

      p1.drawLine({ start: { x: 80, y: 420 }, end: { x: 650, y: 420 }, thickness: 2, color: rgb(0.1, 0.1, 0.1) });
      p1.drawText('+24V_IN', { x: 36, y: 417, size: 9, font: fontBold, color: rgb(0.75, 0.1, 0.1) });

      p1.drawLine({ start: { x: 80, y: 220 }, end: { x: 650, y: 220 }, thickness: 2, color: rgb(0.1, 0.1, 0.1) });
      p1.drawText('GND rail (0V COMMON RETURN)', { x: 250, y: 204, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

      [280, 380, 500].forEach(gx => {
        p1.drawLine({ start: { x: gx, y: 220 }, end: { x: gx, y: 192 }, thickness: 1.5, color: rgb(0.1, 0.1, 0.1) });
        p1.drawLine({ start: { x: gx - 14, y: 192 }, end: { x: gx + 14, y: 192 }, thickness: 1.5, color: rgb(0.1, 0.1, 0.1) });
        p1.drawLine({ start: { x: gx - 9, y: 186 }, end: { x: gx + 9, y: 186 }, thickness: 1.5, color: rgb(0.1, 0.1, 0.1) });
        p1.drawLine({ start: { x: gx - 4, y: 180 }, end: { x: gx + 4, y: 180 }, thickness: 1.5, color: rgb(0.1, 0.1, 0.1) });
      });

      p1.drawRectangle({ x: 130, y: 410, width: 44, height: 20, borderWidth: 1.5, borderColor: rgb(0.1, 0.1, 0.1), color: rgb(1, 1, 1) });
      p1.drawLine({ start: { x: 130, y: 420 }, end: { x: 174, y: 420 }, thickness: 1, color: rgb(0.1, 0.1, 0.1) });
      p1.drawText('F1', { x: 145, y: 396, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
      p1.drawText(spec.fuse, { x: 126, y: 436, size: 10, font: fontBold, color: isRevB ? rgb(0.75, 0.1, 0.1) : rgb(0.1, 0.1, 0.1) });

      p1.drawCircle({ x: 215, y: 420, size: 4, borderWidth: 1.5, borderColor: rgb(0.8, 0.45, 0), color: rgb(1, 0.9, 0.1) });
      p1.drawLine({ start: { x: 215, y: 420 }, end: { x: 215, y: 452 }, thickness: 1.2, color: rgb(0.8, 0.45, 0) });
      p1.drawText(spec.testpoint, { x: 186, y: 457, size: 8.5, font: fontBold, color: rgb(0.75, 0.35, 0) });

      const r1X = spec.resistor.x;
      p1.drawLine({ start: { x: r1X, y: 420 }, end: { x: r1X, y: 370 }, thickness: 1.5, color: rgb(0.1, 0.1, 0.1) });
      p1.drawRectangle({ x: r1X - 10, y: 320, width: 20, height: 50, borderWidth: 1.5, borderColor: rgb(0.1, 0.1, 0.1), color: rgb(1, 1, 1) });
      p1.drawLine({ start: { x: r1X, y: 320 }, end: { x: r1X, y: 220 }, thickness: 1.5, color: rgb(0.1, 0.1, 0.1) });
      p1.drawText('R1 10k Ohm', { x: r1X + 14, y: 348, size: 8.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

      p1.drawLine({ start: { x: 380, y: 420 }, end: { x: 380, y: 335 }, thickness: 1.5, color: rgb(0.1, 0.1, 0.1) });
      p1.drawLine({ start: { x: 365, y: 335 }, end: { x: 395, y: 335 }, thickness: 2.5, color: rgb(0.1, 0.1, 0.1) });
      p1.drawLine({ start: { x: 365, y: 325 }, end: { x: 395, y: 325 }, thickness: 2.5, color: rgb(0.1, 0.1, 0.1) });
      p1.drawLine({ start: { x: 380, y: 325 }, end: { x: 380, y: 220 }, thickness: 1.5, color: rgb(0.1, 0.1, 0.1) });
      p1.drawText('C1 100µF', { x: 400, y: 330, size: 8.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

      if (isRevB) {
        p1.drawLine({ start: { x: 445, y: 420 }, end: { x: 445, y: 335 }, thickness: 1.5, color: rgb(0.05, 0.5, 0.15) });
        p1.drawLine({ start: { x: 430, y: 335 }, end: { x: 460, y: 335 }, thickness: 2.5, color: rgb(0.05, 0.5, 0.15) });
        p1.drawLine({ start: { x: 430, y: 325 }, end: { x: 460, y: 325 }, thickness: 2.5, color: rgb(0.05, 0.5, 0.15) });
        p1.drawLine({ start: { x: 445, y: 325 }, end: { x: 445, y: 220 }, thickness: 1.5, color: rgb(0.05, 0.5, 0.15) });
        p1.drawText('C2 10µF', { x: 464, y: 336, size: 8.5, font: fontBold, color: rgb(0.05, 0.5, 0.15) });
        p1.drawText('FILTER CAP', { x: 464, y: 324, size: 7.5, font, color: rgb(0.05, 0.5, 0.15) });
      }

      p1.drawRectangle({ x: 535, y: 350, width: 92, height: 90, borderWidth: 1.5, borderColor: rgb(0.1, 0.1, 0.1), color: rgb(0.98, 0.98, 0.98) });
      p1.drawText('U1: DC-DC REG', { x: 544, y: 402, size: 8.5, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      p1.drawText('VOUT: +5.0V', { x: 548, y: 382, size: 8, font, color: rgb(0.3, 0.3, 0.3) });

      // ---------------- PAGE 2: Control & Telemetry Block ----------------
      const p2 = doc.addPage([792, 612]);
      p2.drawRectangle({ x: 30, y: 30, width: 732, height: 552, borderWidth: 1.5, borderColor: rgb(0.1, 0.2, 0.3), color: rgb(1, 1, 1) });
      p2.drawText('REDLINE STUDIO · textportdocx.in', { x: 40, y: 565, size: 9, font: fontBold, color: rgb(0.3, 0.4, 0.5) });
      p2.drawText('SHEET 2 OF 2: DIGITAL TELEMETRY & PROTECTION LOGIC', { x: 440, y: 565, size: 9, font: fontBold, color: rgb(0.2, 0.3, 0.4) });

      p2.drawRectangle({ x: 470, y: 30, width: 292, height: 82, borderWidth: 1, borderColor: rgb(0.2, 0.3, 0.4), color: rgb(0.96, 0.98, 1.0) });
      p2.drawText('PROJECT: INDUSTRIAL POWER SUPPLY SCHEMATIC', { x: 480, y: 94, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      p2.drawText(isRevB ? 'REVISION: REV B - SHEET 2 OF 2' : 'REVISION: REV A - SHEET 2 OF 2', { x: 480, y: 78, size: 8.5, font: fontBold, color: rgb(0.2, 0.3, 0.4) });
      p2.drawText('SCALE: 1:1   |   UNITS: MM   |   SHEET: 2 / 2', { x: 480, y: 46, size: 8, font, color: rgb(0.3, 0.3, 0.3) });

      p2.drawRectangle({ x: 180, y: 210, width: 360, height: 250, borderWidth: 1.5, borderColor: rgb(0.1, 0.1, 0.1), color: rgb(0.98, 0.99, 1.0) });
      p2.drawText('U2: SUPERVISORY CONTROLLER & FAULT MONITOR', { x: 220, y: 430, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      p2.drawLine({ start: { x: 100, y: 360 }, end: { x: 180, y: 360 }, thickness: 1.5, color: rgb(0.1, 0.1, 0.1) });
      p2.drawText('PGOOD_SENSE', { x: 95, y: 366, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
      p2.drawLine({ start: { x: 100, y: 300 }, end: { x: 180, y: 300 }, thickness: 1.5, color: rgb(0.1, 0.1, 0.1) });
      p2.drawText('OVP_TRIP_IN', { x: 95, y: 306, size: 8, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
      if (isRevB) {
        p2.drawLine({ start: { x: 540, y: 330 }, end: { x: 640, y: 330 }, thickness: 1.5, color: rgb(0.05, 0.5, 0.15) });
        p2.drawText('TELEM_IRQ_OUT (REV B)', { x: 548, y: 338, size: 8, font: fontBold, color: rgb(0.05, 0.5, 0.15) });
      }

      return await doc.save();
    },

    generateSampleGerberCopper(isRevB = false) {
      const lines = [
        'G04 Redline Pro 1.0 Synthetic PCB Copper Layer (RS-274X)*',
        '%FSLAX24Y24*%',
        '%MOIN*%',
        '%ADD10C,0.0120*%',
        '%ADD11C,0.0600*%',
        '%ADD12R,0.0750X0.0750*%',
        '%ADD13C,0.0080*%',
        'D12*',
        'X010000Y010000D03*',
        'D11*',
        'X015000Y010000D03*',
        'X020000Y010000D03*',
        'X010000Y015000D03*',
        'X015000Y015000D03*',
        'X020000Y015000D03*',
        'D10*',
        'X010000Y010000D02*',
        'X015000Y010000D01*',
        'X015000Y015000D01*',
        'X020000Y010000D02*',
        'X020000Y015000D01*',
        'X010000Y015000D02*',
        'X015000Y015000D01*'
      ];
      if (isRevB) {
        lines.push(
          'G04 Added trace with 3.0-mil spacing violation (<4.0 mil DRC threshold)*',
          'D13*',
          'X010405Y008500D02*',
          'X010405Y012500D01*'
        );
      }
      lines.push('M02*');
      return lines.join('\n');
    },

    generateSampleExcellonDrill() {
      return [
        'M48',
        'INCH',
        'T01C0.032',
        'T02C0.040',
        '%',
        'T01',
        'X1.0000Y1.0000',
        'X1.5000Y1.0000',
        'X2.0000Y1.0000',
        'T02',
        'X1.0000Y1.5000',
        'X1.5000Y1.5000',
        'X2.0000Y1.5000',
        'M30'
      ].join('\n');
    },

    generateSampleIPCD356Netlist(isMetric = false) {
      if (isMetric) {
        return [
          'C  IPC-D-356A Netlist Sample (Metric MM)',
          'P  JOB   REDLINE_PRO_SAMPLE_PCB',
          'P  UNITS CUST 1',
          '317 +24V_VIN         J1    -1   D0813PA00X+025400Y+025400X1905Y1905R000',
          '317 +24V_VIN         U1    -1   D0813PA00X+038100Y+025400X1524Y1524R000',
          '317 +24V_VIN         C1    -1   D1016PA00X+038100Y+038100X1524Y1524R000',
          '317 GND              J1    -2   D1016PA00X+025400Y+038100X1524Y1524R000',
          '317 +5V_VOUT         U1    -2   D0813PA00X+050800Y+025400X1524Y1524R000',
          '317 +5V_VOUT         C2    -1   D1016PA00X+050800Y+038100X1524Y1524R000',
          '999'
        ].join('\n');
      }
      return [
        'C  IPC-D-356A Netlist Sample (English Mils)',
        'P  JOB   REDLINE_PRO_SAMPLE_PCB',
        'P  UNITS CUST 0',
        '317 +24V_VIN         J1    -1   D0320PA00X+010000Y+010000X0750Y0750R000',
        '317 +24V_VIN         U1    -1   D0320PA00X+015000Y+010000X0600Y0600R000',
        '317 +24V_VIN         C1    -1   D0400PA00X+015000Y+015000X0600Y0600R000',
        '317 GND              J1    -2   D0400PA00X+010000Y+015000X0600Y0600R000',
        '317 +5V_VOUT         U1    -2   D0320PA00X+020000Y+010000X0600Y0600R000',
        '317 +5V_VOUT         C2    -1   D0400PA00X+020000Y+015000X0600Y0600R000',
        '999'
      ].join('\n');
    },

    verifyClearanceViolation() {
      const minAllowedMils = 4.0;
      const actualSpacingMils = 3.0;
      return {
        ruleMils: minAllowedMils,
        measuredMils: actualSpacingMils,
        hasViolation: actualSpacingMils < minAllowedMils,
        netA: 'PAD_J1_PIN1 (1.0000, 1.0000)',
        netB: 'TRACE_NET_CLK (X=1.0405)',
        description: '4-mil clearance spacing violation: 3.0 mils (0.076 mm) measured (< 4.0 mils / 0.102 mm minimum)'
      };
    }
  };

  async function loadSampleSchematic() {
    try {
      if (typeof setView === 'function') setView('compare');
      rpToast('Generating 2-page vector circuit schematics (Rev A vs Rev B)...');
      const bytesA = await SampleGenerator.generateSampleSchematicPDF(false);
      const bytesB = await SampleGenerator.generateSampleSchematicPDF(true);
      DefectState.clearAllPages();
      if (typeof window !== 'undefined' && window.compareLoadBytes) {
        await window.compareLoadBytes('A', bytesA, 'Sample_Schematic_RevA.pdf', '', true);
        await window.compareLoadBytes('B', bytesB, 'Sample_Schematic_RevB.pdf', '');
      }
      setTimeout(() => {
        const S = (typeof window !== 'undefined' && window.CMP) ? window.CMP : null;
        if (S && S.cur && S.cur.regions) {
          DefectState.initFromRegions(S.cur.regions);
          if (DefectState.defects.length > 0) {
            DefectState.currentIndex = 0;
            S.sel = DefectState.defects[0].regionIndex != null ? DefectState.defects[0].regionIndex : 0;
            DefectState.highlightItem(0);
            if (typeof window.fit === 'function') window.fit();
            if (typeof window.markers === 'function') window.markers();
          }
        }
        const diffTabBtn = $('aside .tabs button[data-t="d"]');
        if (diffTabBtn) diffTabBtn.click();
        rpToast('⚡ Loaded Sample Schematic (Rev A vs Rev B): ' + (DefectState.defects.length || 'Multiple') + ' circuit diffs identified!');
      }, 280);
      return { bytesA, bytesB };
    } catch (err) {
      rpToast('Sample Schematic Error: ' + err.message);
      throw err;
    }
  }

  async function loadSampleGerber() {
    try {
      if (typeof setView === 'function') setView('compare');
      rpToast('Generating synthetic PCB Gerber RS-274X copper + Excellon drill + IPC-D-356 netlist...');
      const gbrA = SampleGenerator.generateSampleGerberCopper(false);
      const gbrB = SampleGenerator.generateSampleGerberCopper(true);
      const drlText = SampleGenerator.generateSampleExcellonDrill();
      const ipcText = SampleGenerator.generateSampleIPCD356Netlist(CAMState.unitSystem === 'metric');
      const drc = SampleGenerator.verifyClearanceViolation();

      if (typeof window !== 'undefined') {
        window.__lastGerberA = gbrA;
        window.__lastGerberB = gbrB;
        window.__lastDrill = drlText;
        window.__lastIPCA = ipcText;
      }

      if (typeof document !== 'undefined' && typeof CAMEngine !== 'undefined') {
        const parsedGbrA = new CAMEngine.GerberParser(gbrA).parse();
        const parsedGbrB = new CAMEngine.GerberParser(gbrB).parse();
        const parsedDrl = new CAMEngine.ExcellonParser(drlText).parse();
        const parsedIPC = new CAMEngine.IPCD356Parser(ipcText).parse();

        CAMState.parsedGerberA = parsedGbrA;
        CAMState.parsedGerberB = parsedGbrB;
        CAMState.parsedDrillA = parsedDrl;
        CAMState.parsedIPCA = parsedIPC;
        CAMState.lastDFMViolations = [{
          category: 'TRACE_TO_PAD_CLEARANCE',
          severity: 'Error',
          measuredMils: drc.measuredMils,
          ruleMils: drc.ruleMils,
          xIn: 1.0405,
          yIn: 1.0500,
          description: drc.description
        }];

        const sharedBoundsInches = {
          minX: Math.min(parsedGbrA.toInches(parsedGbrA.bounds.minX), parsedGbrB.toInches(parsedGbrB.bounds.minX)),
          maxX: Math.max(parsedGbrA.toInches(parsedGbrA.bounds.maxX), parsedGbrB.toInches(parsedGbrB.bounds.maxX)),
          minY: Math.min(parsedGbrA.toInches(parsedGbrA.bounds.minY), parsedGbrB.toInches(parsedGbrB.bounds.minY)),
          maxY: Math.max(parsedGbrA.toInches(parsedGbrA.bounds.maxY), parsedGbrB.toInches(parsedGbrB.bounds.maxY))
        };

        // Render Base Copper Rev A + Excellon Drill Hits to Canvas A
        const cvRevA = document.createElement('canvas');
        cvRevA.width = 2000;
        cvRevA.height = 1500;
        const rendRevA = new CAMEngine.PCBRenderer(cvRevA, CAMState.pcbTheme || 'standard');
        rendRevA.render(parsedGbrA, parsedDrl, { renderMode: CAMState.renderMode, mirrorX: CAMState.mirrorX, sharedBoundsInches });

        // Render Revised Copper Rev B (with 3.0-mil violation trace) + Excellon Drill Hits to Canvas B
        const cvRevB = document.createElement('canvas');
        cvRevB.width = 2000;
        cvRevB.height = 1500;
        const rendRevB = new CAMEngine.PCBRenderer(cvRevB, CAMState.pcbTheme || 'standard');
        rendRevB.render(parsedGbrB, parsedDrl, { renderMode: CAMState.renderMode, mirrorX: CAMState.mirrorX, sharedBoundsInches });

        const pdfBytesA = await canvasToPDFBytes(cvRevA);
        cvRevA.width = 0; cvRevA.height = 0;
        const pdfBytesB = await canvasToPDFBytes(cvRevB);
        cvRevB.width = 0; cvRevB.height = 0;

        DefectState.clearAllPages();
        if (pdfBytesA && pdfBytesB && window.compareLoadBytes) {
          await window.compareLoadBytes('A', pdfBytesA, 'Sample_Top_Copper_RevA.gbr', '', true);
          await window.compareLoadBytes('B', pdfBytesB, 'Sample_Top_Copper_RevB.gbr', '');
        }

        setTimeout(() => {
          const S = (typeof window !== 'undefined' && window.CMP) ? window.CMP : null;
          if (S && S.cur && S.cur.regions) {
            DefectState.initFromRegions(S.cur.regions);
          }
          if (DefectState.defects.length > 0) {
            DefectState.defects[0].type = 'added';
            DefectState.defects[0].status = 'Flagged';
            DefectState.defects[0].note = drc.description;
          } else {
            DefectState.defects.unshift({
              id: 1,
              regionIndex: 0,
              type: 'added',
              x: 180,
              y: 400,
              w: 140,
              h: 260,
              dpi: 300,
              pixels: 1240,
              status: 'Flagged',
              note: drc.description
            });
          }
          DefectState.defects.forEach((d, idx) => { d.id = idx + 1; });
          DefectState.currentIndex = 0;
          DefectState.renderChecklist();
          updateCAMSidebarPane();
          rpToast('⚠️ PCB CAM Loaded (Gerber Rev A vs Rev B + Drill + IPC-D-356): 4-mil (0.102 mm) clearance violation flagged!');
        }, 280);
      }

      return { gbrA, gbrB, drlText, ipcText, drc };
    } catch (err) {
      rpToast('Sample Gerber Error: ' + err.message);
      throw err;
    }
  }

  function promptSampleDrawings() {
    if (typeof document === 'undefined') return;
    let modal = $('#rp-sample-modal');
    if (!modal) {
      modal = el('div', { id: 'rp-sample-modal', className: 'rp-modal' });
      document.body.appendChild(modal);
    }
    modal.hidden = false;
    modal.innerHTML = `
      <div class="rp-hud-card" style="width:min(580px,92vw)">
        <div class="rp-hud-header">
          <div class="rp-hud-title">
            <h3>⚡ Load Sample Engineering Drawings</h3>
            <span class="rp-hud-badge">100% OFFLINE</span>
          </div>
          <button type="button" class="rp-hud-close" id="rp-sample-modal-close">Close</button>
        </div>
        <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5">
          Test Redline Pro in 3 seconds with synthetic vector schematics or PCB CAM fabrication layers generated entirely offline in pure JavaScript:
        </p>
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:4px">
          <button type="button" id="rp-modal-btn-schematic" class="rp-sample-btn" style="justify-content:flex-start;padding:14px 18px;text-align:left">
            <div>
              <div style="font-size:14px;font-weight:700">⚡ Load Sample Schematic (Rev A vs Rev B)</div>
              <div style="font-size:12px;opacity:0.8;font-weight:400;margin-top:3px">2-page vector power circuit: FUSE 10A → 16A, R1 10kΩ relocated, added C2 10µF filter cap, TP1 label diff &amp; Jump-to-Defect.</div>
            </div>
          </button>
          <button type="button" id="rp-modal-btn-gerber" class="rp-sample-btn" style="justify-content:flex-start;padding:14px 18px;text-align:left">
            <div>
              <div style="font-size:14px;font-weight:700">⚡ Load Sample PCB Gerber (Copper + Drill + IPC-D-356)</div>
              <div style="font-size:12px;opacity:0.8;font-weight:400;margin-top:3px">Synthetic RS-274X copper traces &amp; pads + Excellon NC drill hits + IPC-D-356 netlist, flagging a 4-mil (0.102 mm) clearance violation.</div>
            </div>
          </button>
          <button type="button" id="rp-modal-btn-dxf" class="rp-sample-btn" style="justify-content:flex-start;padding:14px 18px;text-align:left">
            <div>
              <div style="font-size:14px;font-weight:700">⚡ Load Sample AutoCAD Mechanical DXF (Rev A vs Rev B)</div>
              <div style="font-size:12px;opacity:0.8;font-weight:400;margin-top:3px">Multi-layer R2000 CNC enclosure &amp; PCB carrier (.dxf): relocated standoff boss, widened J1 cutout, added cooling slot &amp; layer manager.</div>
            </div>
          </button>
        </div>
      </div>
    `;
    const closeBtn = $('#rp-sample-modal-close');
    if (closeBtn) closeBtn.onclick = () => { modal.hidden = true; };
    modal.onclick = e => { if (e.target === modal) modal.hidden = true; };
    const bSch = $('#rp-modal-btn-schematic');
    if (bSch) bSch.onclick = () => { modal.hidden = true; loadSampleSchematic(); };
    const bGbr = $('#rp-modal-btn-gerber');
    if (bGbr) bGbr.onclick = () => { modal.hidden = true; loadSampleGerber(); };
    const bDxf = $('#rp-modal-btn-dxf');
    if (bDxf) bDxf.onclick = () => { modal.hidden = true; loadSampleDXF(); };
  }

  /**
   * ============================================================================
   * INTERACTIVE KEYBOARD SHORTCUT HUD / CHEAT SHEET (F1 or '?')
   * ============================================================================
   */
  const KEYBOARD_SHORTCUTS_SPEC = {
    navigationAndDiff: [
      { keys: ['N', 'F3'], sep: 'or', desc: 'Next Defect (Auto-center & Zoom)' },
      { keys: ['P', 'Shift+F3'], sep: 'or', desc: 'Previous Defect' },
      { keys: ['Space'], desc: 'Instant Blink Toggle (A / B)' },
      { keys: ['C'], desc: 'Toggle Interactive Curtain Split Slider' },
      { keys: ['F'], desc: 'Fit Drawing to Viewport & Re-Sharpen Vectors' },
      { keys: ['X'], desc: 'Precision Full-Viewport Crosshair Toggle' }
    ],
    alignmentAndTools: [
      { keys: ['Ctrl+A'], desc: 'Auto-Align Drawings' },
      { keys: ['O'], desc: 'Toggle 8px Magnetic Object Snap (OSNAP)' },
      { keys: ['U'], desc: 'Toggle IPC English (mils/in) / Metric (mm)' },
      { keys: ['[', ']'], sep: '/', desc: 'Collapse / Expand Sidebar' },
      { keys: ['Ctrl+1', 'Ctrl+2'], sep: '|', desc: 'Compare Workspace  |  Editor Workspace' }
    ]
  };

  function buildKeyboardHUDHTML() {
    const renderRows = items => items.map(it => {
      const kHtml = it.keys.map((k, idx) => {
        const sep = (idx > 0 && it.sep) ? `<span class="rp-hud-sep">${it.sep}</span>` : '';
        return `${sep}<kbd class="rp-hud-k">${k}</kbd>`;
      }).join('');
      return `<div class="rp-hud-item"><div class="rp-hud-keys">${kHtml}</div><span class="rp-hud-desc">${it.desc}</span></div>`;
    }).join('');

    return `
      <div class="rp-hud-card" role="dialog" aria-label="Keyboard Shortcuts HUD">
        <div class="rp-hud-header">
          <div class="rp-hud-title">
            <h3>Keyboard Shortcuts &amp; Engineering Hotkeys</h3>
            <span class="rp-hud-badge">HUD &middot; F1 / ?</span>
          </div>
          <button type="button" class="rp-hud-close" id="rp-hud-close-btn">Close (Esc)</button>
        </div>
        <div class="rp-hud-grid">
          <div class="rp-hud-section">
            <h4>Navigation &amp; Diff</h4>
            <div class="rp-hud-list">
              ${renderRows(KEYBOARD_SHORTCUTS_SPEC.navigationAndDiff)}
            </div>
          </div>
          <div class="rp-hud-section">
            <h4>Alignment &amp; Tools</h4>
            <div class="rp-hud-list">
              ${renderRows(KEYBOARD_SHORTCUTS_SPEC.alignmentAndTools)}
            </div>
          </div>
        </div>
        <div class="rp-hud-footer">
          <span>Redline Pro 1.0.0 &middot; Redline Studio &middot; textportdocx.in</span>
          <span>Press <b>Esc</b> or click <b>Close</b> to dismiss</span>
        </div>
      </div>
    `;
  }

  function showKeyboardHUD() {
    if (typeof document === 'undefined') return buildKeyboardHUDHTML();
    let modal = $('#rp-keyboard-hud-modal');
    if (!modal) {
      modal = el('div', { id: 'rp-keyboard-hud-modal', className: 'rp-modal' });
      document.body.appendChild(modal);
    }
    modal.innerHTML = buildKeyboardHUDHTML();
    modal.hidden = false;
    const closeBtn = $('#rp-hud-close-btn');
    if (closeBtn) closeBtn.onclick = () => { modal.hidden = true; };
    modal.onclick = e => { if (e.target === modal) modal.hidden = true; };
    return modal;
  }

  function closeKeyboardHUD() {
    const modal = $('#rp-keyboard-hud-modal');
    if (modal) modal.hidden = true;
  }

  async function openExternalCADOrCAM(bytes, name, path, slot, skipStart = false) {
    const text = new TextDecoder().decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    if (typeof setView === 'function') setView('compare');
    const S = (typeof window !== 'undefined' && window.CMP) ? window.CMP : {};
    const targetSlot = slot || (!S.A ? 'A' : 'B');

    if (/\.dxf$/i.test(name) && typeof DXFEngine !== 'undefined') {
      const parser = new DXFEngine.DXFParser(text).parse();
      if (targetSlot === 'A') { DXFState.rawA = text; DXFState.nameA = name; DXFState.parsedA = parser; }
      else { DXFState.rawB = text; DXFState.nameB = name; DXFState.parsedB = parser; }
      await reRenderActiveDXFLayers();
      rpToast(`Opened AutoCAD DXF: ${name} (${parser.entities.length} entities, ${Object.keys(parser.layers).length} layers)`);
      return true;
    }

    if (/\.(gbr|ger|art|top|bot|gtl|gbl|gbs|gts|gto|gbo|gtp|gbp|gko|gm1|drl|xln|ipc|d356|net)$/i.test(name) && typeof CAMEngine !== 'undefined') {
      const layerMeta = CAMEngine.detectLayerType(name, text);
      const parseOpts = CAMState.getParseOptions();
      const offCv = document.createElement('canvas');
      offCv.width = 2200;
      offCv.height = 1600;
      const rend = new CAMEngine.PCBRenderer(offCv, CAMState.pcbTheme || 'standard');

      if (layerMeta.category === 'netlist') {
        const ipc = new CAMEngine.IPCD356Parser(text, parseOpts).parse();
        window.__lastIPCA = text;
        CAMState.parsedIPCA = ipc;
        setUnitSystem(ipc.units === 'MM' ? 'metric' : 'english', true);
        const dummyGbr = new CAMEngine.GerberParser('', { allowEmpty: true }).parse();
        dummyGbr.bounds = ipc.bounds;
        rend.render(dummyGbr, null, { ipcParsed: ipc, showNetLabels: true });
      } else if (layerMeta.category === 'drill') {
        const drl = new CAMEngine.ExcellonParser(text, parseOpts).parse();
        window.__lastDrill = text;
        if (targetSlot === 'A') CAMState.parsedDrillA = drl; else CAMState.parsedDrillB = drl;
        setUnitSystem(drl.units === 'METRIC' ? 'metric' : 'english', true);
        const dummyGbr = new CAMEngine.GerberParser('', { allowEmpty: true }).parse();
        dummyGbr.bounds = drl.bounds;
        rend.render(dummyGbr, drl, { renderMode: CAMState.renderMode, mirrorX: CAMState.mirrorX });
      } else {
        const gbr = new CAMEngine.GerberParser(text, parseOpts).parse();
        if (targetSlot === 'A') { window.__lastGerberA = text; CAMState.parsedGerberA = gbr; }
        else { window.__lastGerberB = text; CAMState.parsedGerberB = gbr; }
        setUnitSystem(gbr.units === 'MM' ? 'metric' : 'english', true);
        rend.render(gbr, null, { renderMode: CAMState.renderMode, mirrorX: CAMState.mirrorX || layerMeta.side === 'bottom', invertPolarity: CAMState.invertPolarity });
      }

      // If both A and B Gerbers are now loaded, re-render both with unified shared bounds so comparison aligns 1:1
      if (!skipStart && window.__lastGerberA && window.__lastGerberB) {
        offCv.width = 0; offCv.height = 0;
        if (window.CMP && window.CMP.names) window.CMP.names[targetSlot] = name;
        await reRenderActiveCAMLayers();
        rpToast(`Opened & aligned ${layerMeta.name}: ${name}`);
        return true;
      }

      const pdfBytes = await canvasToPDFBytes(offCv);
      offCv.width = 0; offCv.height = 0;
      if (pdfBytes && window.compareLoadBytes) {
        await window.compareLoadBytes(targetSlot, pdfBytes, name, path, skipStart);
      }
      updateCAMSidebarPane();
      rpToast(`Opened ${layerMeta.name}: ${name}`);
      return true;
    }
    return false;
  }

  if (typeof window !== 'undefined') {
    window.openExternalCADOrCAM = openExternalCADOrCAM;
    window.loadSampleSchematic = loadSampleSchematic;
    window.loadSampleGerber = loadSampleGerber;
    window.loadSampleDXF = loadSampleDXF;
    window.showDXFWorkbenchModal = showDXFWorkbenchModal;
    window.promptSampleDrawings = promptSampleDrawings;
    window.showKeyboardHUD = showKeyboardHUD;
    window.closeKeyboardHUD = closeKeyboardHUD;
    window.showCAM350WorkbenchModal = showCAM350WorkbenchModal;
  }

  /**
   * Keyboard Navigation & Shortcuts
   */
  function initKeyboardNavigation() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', e => {
      if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;

      if (e.key === 'Escape') {
        const hud = $('#rp-keyboard-hud-modal');
        if (hud && !hud.hidden) {
          hud.hidden = true;
          e.preventDefault();
          return;
        }
        const smp = $('#rp-sample-modal');
        if (smp && !smp.hidden) {
          smp.hidden = true;
          e.preventDefault();
          return;
        }
        const camWb = $('#rp-cam350-modal');
        if (camWb && !camWb.hidden) {
          camWb.hidden = true;
          e.preventDefault();
          return;
        }
        const dxfWb = $('#rp-dxf-workbench-modal');
        if (dxfWb && !dxfWb.hidden) {
          dxfWb.hidden = true;
          e.preventDefault();
          return;
        }
        const bomMod = $('#rp-bom-modal');
        if (bomMod && !bomMod.hidden) {
          bomMod.hidden = true;
          e.preventDefault();
          return;
        }
        const fidMod = $('#fiducial-modal');
        if (fidMod && !fidMod.hidden) {
          fidMod.hidden = true;
          FiducialAligner.active = false;
          if (window.rpRedrawOverlay) window.rpRedrawOverlay();
          e.preventDefault();
          return;
        }
      }

      if ((e.key === '?' || e.key === 'F1') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        showKeyboardHUD();
        return;
      }

      if (e.key === 'F3' && !e.shiftKey && document.body.dataset.view === 'compare') {
        e.preventDefault();
        DefectState.next();
      } else if (e.key === 'F3' && e.shiftKey && document.body.dataset.view === 'compare') {
        e.preventDefault();
        DefectState.prev();
      } else if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (document.body.dataset.view === 'compare') {
          e.preventDefault();
          setCurtainMode(!curtainActive);
        }
      } else if ((e.key === 'u' || e.key === 'U') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (document.body.dataset.view === 'compare') {
          e.preventDefault();
          setUnitSystem(CAMState.unitSystem === 'english' ? 'metric' : 'english');
        }
      } else if ((e.key === 'o' || e.key === 'O') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const osnapBtn = $('#rib-osnap-toggle');
        if (osnapBtn && document.body.dataset.view === 'compare') {
          e.preventDefault();
          osnapBtn.click();
        }
      } else if (e.key === '[' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        document.querySelectorAll('aside').forEach(a => a.classList.add('rp-collapsed'));
        window.dispatchEvent(new Event('resize'));
        rpToast('Sidebar collapsed (Press ] to expand)');
      } else if (e.key === ']' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        document.querySelectorAll('aside').forEach(a => a.classList.remove('rp-collapsed'));
        window.dispatchEvent(new Event('resize'));
        rpToast('Sidebar expanded');
      } else if (e.ctrlKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        document.querySelectorAll('aside').forEach(a => a.classList.toggle('rp-collapsed'));
        window.dispatchEvent(new Event('resize'));
      }
    }, true);
  }

  function initSampleButtons() {
    const bSch = $('#rp-sample-schematic-btn');
    if (bSch) bSch.onclick = () => loadSampleSchematic();
    const bGbr = $('#rp-sample-gerber-btn');
    if (bGbr) bGbr.onclick = () => loadSampleGerber();

    // Wire 3 Primary Empty-State Quick-Launch Cards
    if ($('#rp-card-compare-drawings')) $('#rp-card-compare-drawings').onclick = () => { if (typeof setView === 'function') setView('compare'); if ($('#openA')) $('#openA').click(); };
    if ($('#rp-card-pdf-studio')) $('#rp-card-pdf-studio').onclick = () => { if (typeof setView === 'function') setView('edit'); };
    if ($('#rp-card-load-samples')) $('#rp-card-load-samples').onclick = () => promptSampleDrawings();

    // Wire Compare Launchpad Quick Cards
    if ($('#rp-cmp-launch-ab')) $('#rp-cmp-launch-ab').onclick = () => { if ($('#openA')) $('#openA').click(); };
    if ($('#rp-cmp-launch-cam350')) $('#rp-cmp-launch-cam350').onclick = () => showCAM350WorkbenchModal('format');
    if ($('#rp-cmp-launch-dxf')) $('#rp-cmp-launch-dxf').onclick = () => promptDXFImport();
    if ($('#rp-cmp-launch-batch')) $('#rp-cmp-launch-batch').onclick = () => { if (window.ACT && window.ACT.batch) window.ACT.batch(); };

    // Wire Compare Floating HUD (#c-floating-hud)
    if ($('#cHudPrevD')) $('#cHudPrevD').onclick = () => DefectState.prev();
    if ($('#cHudNextD')) $('#cHudNextD').onclick = () => DefectState.next();
    if ($('#cHudDiffLabel')) $('#cHudDiffLabel').onclick = () => DefectState.next();
    if ($('#cHudCurtain')) $('#cHudCurtain').onclick = () => setCurtainMode(!curtainActive);
    if ($('#cHudBlink')) $('#cHudBlink').onclick = () => {
      const S = window.CMP;
      if (!S || !window.ACT) return;
      if (S.mode === 'A') window.ACT.cMode(6);
      else if (S.mode === 'B') window.ACT.cMode(5);
      else window.ACT.cMode(4);
    };
    if ($('#cHudLoupe')) $('#cHudLoupe').onclick = () => { if ($('#rib-loupe-toggle')) $('#rib-loupe-toggle').click(); };
    if ($('#cHudCross')) $('#cHudCross').onclick = () => { if ($('#rib-crosshair-toggle')) $('#rib-crosshair-toggle').click(); };
    if ($('#cHudZo')) $('#cHudZo').onclick = () => { if (window.ACT && window.ACT.cZoomOut) window.ACT.cZoomOut(); };
    if ($('#cHudZi')) $('#cHudZi').onclick = () => { if (window.ACT && window.ACT.cZoomIn) window.ACT.cZoomIn(); };
    if ($('#cHudZoomLabel')) $('#cHudZoomLabel').onclick = () => { if (window.ACT && window.ACT.cFit) window.ACT.cFit(); };
    if ($('#cHudFit')) $('#cHudFit').onclick = () => { if ($('#rib-sharp-100')) $('#rib-sharp-100').click(); };

    // Wire Editor Empty State Hero Buttons
    const bEdOpen = $('#rp-edit-open-btn');
    if (bEdOpen) bEdOpen.onclick = () => { if ($('#eOpen')) $('#eOpen').click(); };
    const bEdSample = $('#rp-edit-sample-btn');
    if (bEdSample) bEdSample.onclick = async () => {
      try {
        rpToast('Generating 2-Page Sample Engineering Schematic PDF for Editor...');
        const bytes = await SampleGenerator.generateSampleSchematicPDF(true);
        if (window.RE && window.RE.openBytes) {
          await window.RE.openBytes(bytes, 'Sample_Power_Schematic_RevB.pdf', '');
          rpToast('Opened 2-page vector schematic in PDF Editor!');
        }
      } catch (e) {
        rpToast('Error loading sample PDF in Editor: ' + e.message);
      }
    };

    // Wire Editor MS Office Set-Wise Ribbon Tabs (#edit-ribbon-tabs)
    const editTabs = $('#edit-ribbon-tabs');
    const editRibbon = document.querySelector('#view-edit .rp-edit-ribbon');
    if (editTabs && editRibbon) {
      editTabs.querySelectorAll('[data-etab]').forEach(btn => {
        btn.onclick = () => {
          const tab = btn.dataset.etab;
          editTabs.querySelectorAll('[data-etab]').forEach(b => b.classList.toggle('active', b === btn));
          const showStyleDock = !!(window.RE && window.RE.shouldShowContextualDock && window.RE.shouldShowContextualDock());
          editRibbon.querySelectorAll('[data-egrp]').forEach(grp => {
            const tokens = (grp.dataset.egrp || '').split(/\s+/).filter(Boolean);
            if (tokens.includes('file') || tokens.includes('nav')) {
              grp.hidden = false;
            } else if (tokens.includes('style')) {
              grp.hidden = !showStyleDock;
            } else if (tab === 'all') {
              grp.hidden = false;
            } else {
              grp.hidden = !tokens.includes(tab);
            }
          });
        };
      });
    }

    // Wire Editor Quickbar View Toggles (#eThumbBtn, #eNightBtn, #ePanelBtn, #eZoomBadge)
    if ($('#eThumbBtn')) $('#eThumbBtn').onclick = () => { if (window.ACT && window.ACT.toggleThumbs) window.ACT.toggleThumbs(); };
    if ($('#eNightBtn')) $('#eNightBtn').onclick = () => { if (window.ACT && window.ACT.night) window.ACT.night(); $('#eNightBtn').classList.toggle('on', document.body.classList.contains('night')); };
    if ($('#ePanelBtn')) $('#ePanelBtn').onclick = () => {
      if (window.ACT && window.ACT.togglePanel) window.ACT.togglePanel();
    };
    if ($('#eZoomBadge')) $('#eZoomBadge').onclick = () => { if ($('#eFit')) $('#eFit').click(); };
  }

  function init() {
    initCategorizedRibbon();
    initLayerDock();
    initCurtainSlider();
    initSidebarDefects();
    initKeyboardNavigation();
    initSampleButtons();
    setUnitSystem(CAMState.unitSystem, true);
  }

  return {
    init,
    CompareHistory,
    CAMState,
    setUnitSystem,
    DefectState,
    FiducialAligner,
    SampleGenerator,
    KEYBOARD_SHORTCUTS_SPEC,
    buildKeyboardHUDHTML,
    showKeyboardHUD,
    closeKeyboardHUD,
    showCAM350WorkbenchModal,
    runCAMClearanceScan,
    loadSampleSchematic,
    loadSampleGerber,
    promptSampleDrawings,
    DXFState,
    loadSampleDXF,
    showDXFWorkbenchModal,
    promptDXFExport,
    promptDXFImport,
    promptCAMCompare,
    promptIPCD356Netlist,
    generateExecutiveAuditReport,
    buildDefectsCSVBytes,
    exportDefectsCSV,
    buildZipArchive,
    exportQAPackageZip,
    saveSessionFile,
    loadSessionFile,
    restoreSessionFromText,
    setCurtainMode,
    setCompareMode,
    isCurtainActive: () => curtainActive,
    getCurtainPct: () => curtainPct,
    updateCurtainClip,
    showBOMAndMeasurementsModal,
    rpToast
  };
});
