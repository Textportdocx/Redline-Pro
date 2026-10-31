// ===== Redline Pro 1.0.0 — Redline Studio (textportdocx.in) =====
(function () {
  const $ = s => document.querySelector(s), DPR = () => window.devicePixelRatio || 1, S = window.CMP;
  const el = (t, a, h) => { const e = document.createElement(t); Object.assign(e, a || {}); if (h != null) e.innerHTML = h; return e; };
  const safeGet = (k, def = null) => { try { const v = localStorage.getItem(k); return v != null ? v : def; } catch (e) { return def; } };
  const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const safeRemove = k => { try { localStorage.removeItem(k); } catch (e) {} };

  // License is accepted in the Windows installer; this only shows it (read-only).
  function showTerms() {
    const d = el('div', { className: 'rp-modal' }, `<div class="rp-card rp-wide"><h2>License Agreement &amp; Zero-Telemetry Guarantee</h2><p class="rp-sub">Redline Pro 1.0.0 &middot; Redline Studio &middot; textportdocx.in &middot; Free for Personal &amp; Commercial Use</p>
      <div class="rp-scroll" style="display:flex;flex-direction:column;gap:10px">
        <div><b>1. Grant of License (100% Free Commercial &amp; Personal Use)</b><br>Redline Studio grants you a perpetual, worldwide, royalty-free, non-exclusive license to install and use Redline Pro 1.0.0 on unlimited workstations for both personal and commercial engineering, PCB design, manufacturing, architectural, and quality-assurance workflows.</div>
        <div><b>2. 100% Offline &amp; Air-Gapped Privacy Guarantee</b><br>All PDF drawings, AutoCAD DXF files, Gerber RS-274X layers, Excellon NC drill files, IPC-D-356 netlists, and project sessions (.redline) are processed 100% locally on your machine. Redline Pro contains zero telemetry, zero analytics, zero cloud uploads, and makes zero external network requests.</div>
        <div><b>3. Intellectual Property &amp; Redistribution</b><br>Redline Pro is copyright &copy; 2026 Redline Studio (textportdocx.in). You may freely distribute unmodified copies of the official installer or portable package within your organization.</div>
        <div><b>4. Disclaimer of Warranty</b><br>This software is provided "AS IS" without warranty of any kind, express or implied. Verify critical fabrication clearances, drill schedules, and engineering tolerances prior to manufacturing release. The full license text is included in LICENSE.txt in the application folder.</div>
      </div>
      <div class="rp-btns"><button type="button" id="rp-lic-about">About Redline Pro</button><button type="button" class="rp-primary" id="rp-lic-close">Close</button></div></div>`);
    document.body.appendChild(d);
    d.onclick = e => { if (e.target === d) d.remove(); };
    d.querySelector('#rp-lic-close').onclick = () => d.remove();
    d.querySelector('#rp-lic-about').onclick = () => { d.remove(); if ($('#modal')) $('#modal').hidden = false; };
  }
  window.showTerms = showTerms;

  // ---------- Loading box with percentage (bottom-right) ----------
  const ld = el('div', { id: 'rp-load', hidden: true }, '<div class="rp-ring"></div><div><b id="rp-lt">Loading</b><div class="rp-bar"><i id="rp-lb"></i></div></div><span id="rp-lp">0%</span>');
  document.body.appendChild(ld);
  let ldN = 0, hideTimer = null;
  window.rpProgress = (label, frac) => {
    clearTimeout(hideTimer);
    if (window.native && window.native.setProgress) {
      try { window.native.setProgress(frac == null ? -1 : frac); } catch (e) {}
    }
    if (frac == null) { ld.hidden = true; return; }
    ld.hidden = false; $('#rp-lt').textContent = label || 'Loading'; const p = Math.max(0, Math.min(100, Math.round(frac * 100)));
    $('#rp-lb').style.width = p + '%'; $('#rp-lp').textContent = p + '%';
  };
  const gd = pdfjsLib.getDocument;
  pdfjsLib.getDocument = function (src) {
    if (src && typeof src === "object" && !ArrayBuffer.isView(src) && !(src instanceof ArrayBuffer)) {
      if (src.verbosity === undefined) src.verbosity = 0;
      if (src.isOffscreenCanvasSupported === undefined) src.isOffscreenCanvasSupported = false;
    }
    const t = gd.apply(this, arguments); ldN++;
    t.onProgress = p => window.rpProgress('Opening PDF', p.total ? p.loaded / p.total : .35);
    if (ld.hidden) window.rpProgress('Opening PDF', .15);
    t.promise.then(() => {
      if (--ldN <= 0) {
        ldN = 0;
        const stillBusy = $('#busy') && !$('#busy').hidden;
        if (stillBusy) {
          window.rpProgress('Rendering page...', .65);
        } else {
          window.rpProgress('Ready', 1);
          hideTimer = setTimeout(() => { if (!ldN && (!$('#busy') || $('#busy').hidden)) window.rpProgress(null); }, 260);
        }
      }
    }, () => {
      ldN = Math.max(0, ldN - 1);
      if (!ldN && (!$('#busy') || $('#busy').hidden)) window.rpProgress(null);
    });
    return t;
  };
  const observeStatusProgress = (elRef, defaultLabel) => {
    if (!elRef) return;
    new MutationObserver(() => {
      const txt = (elRef.textContent || '').trim();
      if (!txt) return;
      // Only trigger progress updates on active progress verbs, NEVER on completed summary messages like "2 of 2 pages have differences."
      const isBusy = $('#busy') && !$('#busy').hidden;
      if (!isBusy && !ldN) return;
      const m = /^(Scanning|Comparing|Report|Unlocking|Preparing|Exporting|Merging|Splitting|Processing|Reading)[^0-9]*(\d+)\s*(?:\/|of)\s*(\d+)/i.exec(txt);
      if (m && +m[3] >= 1) {
        const verb = m[1];
        const cur = +m[2], tot = +m[3];
        const lbl = verb.toLowerCase() === 'scanning' ? `Scanning page ${cur}/${tot}`
          : verb.toLowerCase() === 'comparing' ? `Comparing page ${cur}/${tot}`
          : `${verb} (${cur}/${tot})`;
        window.rpProgress(lbl, Math.min(0.98, Math.max(0.1, cur / tot)));
      } else if (/^Comparing page (\d+)/i.test(txt)) {
        window.rpProgress(txt.replace(/\.\.\.$/, ''), 0.55);
      } else if (/^Reading\s+/i.test(txt)) {
        window.rpProgress(txt.slice(0, 28), 0.25);
      } else if (/^Aligning/i.test(txt)) {
        window.rpProgress('Auto-Aligning...', 0.5);
      }
    }).observe(elRef, { childList: true, characterData: true, subtree: true });
  };
  observeStatusProgress($('#st'), 'Comparing pages');
  observeStatusProgress($('#est'), 'Processing pages');
  const ob = window.busy; let bt;
  window.busy = on => {
    ob(on);
    const isBusy = !$('#busy').hidden;
    if (window.native && window.native.setBusyLock) {
      try { window.native.setBusyLock(isBusy); } catch (e) {}
    }
    clearTimeout(bt);
    if (isBusy) {
      bt = setTimeout(() => { if (ld.hidden && !$('#busy').hidden) window.rpProgress('Working...', .45); }, 180);
    } else if (!ldN) {
      clearTimeout(hideTimer);
      window.rpProgress(null);
    }
  };

  // ---------- Enhanced View (darker, crisper lines; screen only) ----------
  const EV = { off: 'none', enh: 'contrast(1.45) brightness(.9) saturate(1.15)', dark: 'contrast(1.7) brightness(.78) saturate(1.2)', blue: 'invert(1) hue-rotate(180deg) contrast(1.3) brightness(.95)' };
  const EV_NAMES = { off: 'Normal (Unfiltered)', enh: 'High Contrast Boost', dark: 'Extra Dark Line Density', blue: 'Blueprint CAD Mode' };
  function setEnh(m, silent = false) {
    const mode = EV[m] ? m : 'off';
    safeSet('enh', mode);
    document.documentElement.style.setProperty('--rp-filter', EV[mode] || 'none');
    document.querySelectorAll('[data-enh]').forEach(b => b.classList.toggle('on', b.dataset.enh === mode));
    const mapId = { off: '#rib-enh-norm', enh: '#rib-enh-boost', dark: '#rib-enh-dark', blue: '#rib-enh-inv' };
    Object.entries(mapId).forEach(([k, sel]) => { const b = $(sel); if (b) b.classList.toggle('on', k === mode); });
    if (typeof renderViewportHUD === 'function' && window.RP_MEASURE && window.RP_MEASURE.loupeEnabled) {
      renderViewportHUD();
    }
    if (window.rpRedrawOverlay) window.rpRedrawOverlay();
    if (!silent && window.rpToast) {
      window.rpToast(`Signal & Line Enhancement: ${EV_NAMES[mode] || mode}`);
    }
  }
  window.setEnhanced = setEnh;

  // ---------- Sharp zoom in Compare: redraw the visible area from the PDF's own lines ----------
  const vp = $('#vp'), stg = $('#stage'), hq = el('canvas', { id: 'hq' });
  if (stg && $('#mk')) stg.insertBefore(hq, $('#mk'));
  else if (stg) stg.appendChild(hq);
  else vp.appendChild(hq);
  let hqT, hqTok = 0;
  const kick = d => {
    hq.style.display = 'none';
    hq._cropA = null;
    hq._cropB = null;
    hqTok++;
    clearTimeout(hqT);
    hqT = setTimeout(sharpen, d || 140);
    if (window.UIRibbon && window.UIRibbon.updateCurtainClip) window.UIRibbon.updateCurtainClip();
  };
  const pageScale = () => (S.cur && S.cur.dpi ? S.cur.dpi : (+$('#dpi').value)) / 72;
  async function crop(k, n, s, ox, oy, w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
    if (S[k] && n <= S[k].numPages) { const p = await S[k].getPage(n); await p.render({ canvasContext: x, viewport: p.getViewport({ scale: s, offsetX: -ox, offsetY: -oy }) }).promise; }
    const imgData = x.getImageData(0, 0, w, h);
    c.width = 0; c.height = 0;
    return imgData;
  }
  const hex2rgb = (h, def) => {
    if (!h || h.length < 7) return def;
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  };
  function maskOutsidePage(imgData, W, H, ox, oy, inv, RW, RH) {
    if (!imgData) return;
    const d = imgData.data;
    for (let yy = 0, i = 0; yy < H; yy++) {
      const py = Math.floor((yy + oy) * inv);
      const outY = py < 0 || py >= RH;
      for (let xx = 0; xx < W; xx++, i += 4) {
        if (outY) { d[i + 3] = 0; continue; }
        const px = Math.floor((xx + ox) * inv);
        if (px < 0 || px >= RW) d[i + 3] = 0;
      }
    }
  }
  async function sharpen() {
    const r = S.cur, v = S.view, d = DPR(), m = S.mode;
    const curtainOn = !!(window.UIRibbon && window.UIRibbon.isCurtainActive && window.UIRibbon.isCurtainActive());
    if (!r || (!curtainOn && (m === 'side' || m === 'blink')) || !r.cls || v.k * d <= 1.05 || S._isCAMScan || Math.abs(S.rotB || 0) > 0.001) { hq.style.display = 'none'; hq._cropA = null; hq._cropB = null; return; }
    const my = ++hqTok, W = Math.round(vp.clientWidth * d), H = Math.round(vp.clientHeight * d);
    if (!W || !H || W * H > 16e6) return;
    const s = pageScale() * v.k * d, ox = -v.x * d, oy = -v.y * d, dx = (parseFloat($('#dx').value) || 0) * v.k * d, dy = (parseFloat($('#dy').value) || 0) * v.k * d;
    const showA = !curtainOn && m === 'A';
    const showB = !curtainOn && m === 'B';
    let a = null, b = null;
    try { if (!showB) a = await crop('A', r.n, s, ox, oy, W, H); if (!showA) b = await crop('B', r.n, s, ox - dx, oy - dy, W, H); } catch (e) { return; }
    if (my !== hqTok) return;
    const RW = r.W, RH = r.H, inv = 1 / (v.k * d);
    hq.width = W; hq.height = H; hq.style.width = vp.clientWidth + 'px'; hq.style.height = vp.clientHeight + 'px';
    hq.style.transformOrigin = '0 0';
    hq.style.transform = `translate(${-v.x / v.k}px, ${-v.y / v.k}px) scale(${1 / v.k})`;
    const x = hq.getContext('2d');
    if (curtainOn && a && b) {
      maskOutsidePage(a, W, H, ox, oy, inv, RW, RH);
      maskOutsidePage(b, W, H, ox, oy, inv, RW, RH);
      hq._cropA = a;
      hq._cropB = b;
      x.putImageData(a, 0, 0);
      const splitPx = Math.max(0, Math.min(W, Math.round(((window.UIRibbon.getCurtainPct ? window.UIRibbon.getCurtainPct() : 50) / 100) * W)));
      if (splitPx < W) {
        x.putImageData(b, 0, 0, splitPx, 0, W - splitPx, H);
      }
      hq.style.clipPath = 'none';
      hq.style.display = 'block';
      return;
    }
    hq._cropA = null;
    hq._cropB = null;
    if (showA || showB) {
      const targetImg = showA ? a : b;
      maskOutsidePage(targetImg, W, H, ox, oy, inv, RW, RH);
      x.putImageData(targetImg, 0, 0);
      hq.style.display = 'block';
      if (window.UIRibbon && window.UIRibbon.updateCurtainClip) window.UIRibbon.updateCurtainClip();
      return;
    }
    const o = new ImageData(W, H), pa = a.data, pb = b.data, od = o.data, c = r.cls, paper = m === 'paper', darkSub = !!r.isDarkSubstrate;
    const lA = $('#lA').checked, lB = $('#lB').checked, lC = $('#lC').checked, dim = m === 'diff' ? 20 : 120;
    const bg = paper ? [255, 255, 255] : [6, 10, 8];
    const cA = hex2rgb(S.tintA, paper ? [225, 20, 20] : [255, 64, 64]);
    const cB = hex2rgb(S.tintB, paper ? [0, 165, 60] : [61, 255, 122]);
    const opA = (S.opA != null ? S.opA : 100) / 100, opB = (S.opB != null ? S.opB : 100) / 100;
    for (let yy = 0, i = 0; yy < H; yy++) {
      const py = Math.floor((yy + oy) * inv);
      if (py < 0 || py >= RH) continue;
      const row = py * RW;
      for (let xx = 0; xx < W; xx++, i += 4) {
        const px = Math.floor((xx + ox) * inv);
        if (px < 0 || px >= RW) continue;
        const t = c[row + px];
        const ia = darkSub ? (pa[i] + pa[i + 1] + pa[i + 2]) / 3 : 255 - (pa[i] + pa[i + 1] + pa[i + 2]) / 3;
        const ib = darkSub ? (pb[i] + pb[i + 1] + pb[i + 2]) / 3 : 255 - (pb[i] + pb[i + 1] + pb[i + 2]) / 3;
        let R, G, B;
        if (t === 1 || t === 2) {
          const on = t === 1 ? lA : lB, cc = t === 1 ? cA : cB, op = t === 1 ? opA : opB;
          const ink = on ? (Math.max(t === 1 ? ia : ib, 90) / 255) * op : 0;
          R = bg[0] + (cc[0] - bg[0]) * ink; G = bg[1] + (cc[1] - bg[1]) * ink; B = bg[2] + (cc[2] - bg[2]) * ink;
        } else if (!lC || (ia < 2 && ib < 2)) { R = bg[0]; G = bg[1]; B = bg[2]; }
        else if (paper) {
          if (darkSub) {
            const v = Math.round(255 - Math.max(0, Math.max(ia, ib) - 20) * 0.55);
            R = v; G = v; B = v;
          } else {
            R = 255 - (255 - pb[i]) * .45; G = 255 - (255 - pb[i + 1]) * .45; B = 255 - (255 - pb[i + 2]) * .45;
          }
        } else { R = 8 + Math.max(ia, ib) / 255 * dim; G = R + 4; B = R + 2; }
        od[i] = R; od[i + 1] = G; od[i + 2] = B; od[i + 3] = 255;
      }
    }
    x.putImageData(o, 0, 0);
    hq.style.display = 'block';
    if (window.UIRibbon && window.UIRibbon.updateCurtainClip) window.UIRibbon.updateCurtainClip();
  }
  let lastT = '';
  new MutationObserver(() => { if (stg.style.transform !== lastT) { lastT = stg.style.transform; kick(); } }).observe(stg, { attributes: true, attributeFilter: ['style'] });
  new MutationObserver(() => kick()).observe($('#cv'), { attributes: true });
  ['lA', 'lB', 'lC'].forEach(id => { const e = $('#' + id); e && e.addEventListener('change', () => kick()); });
  addEventListener('resize', () => kick(200));
  window.rpSharpen = sharpen;
  window.rpCancelSharpen = () => {
    hqTok++;
    clearTimeout(hqT);
    hq.style.display = 'none';
    hq._cropA = null;
    hq._cropB = null;
  };

  // ---------- Resizable / collapsible side panels ----------
  function resizable(panel, key) {
    const h = el('div', { className: 'rp-resize', title: 'Drag to resize. Double-click or Ctrl+B to collapse/expand.' });
    panel.style.position = 'relative';
    panel.appendChild(h);
    const w0 = +safeGet(key, 0); if (w0 >= 200) panel.style.width = w0 + 'px';
    h.onpointerdown = e => {
      e.preventDefault(); h.setPointerCapture(e.pointerId);
      const x0 = e.clientX, w = panel.classList.contains('rp-collapsed') ? (w0 >= 200 ? w0 : 330) : (panel.offsetWidth || 330);
      let dragged = false, rafId = 0;
      h.onpointermove = ev => {
        if (Math.abs(ev.clientX - x0) < 4 && !dragged) return;
        dragged = true;
        const cx = ev.clientX;
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          panel.classList.remove('rp-collapsed');
          const nw = Math.max(220, Math.min(innerWidth * .5, w + x0 - cx));
          panel.style.width = nw + 'px';
        });
      };
      h.onpointerup = () => {
        h.onpointermove = null;
        if (dragged && !panel.classList.contains('rp-collapsed') && panel.offsetWidth >= 200) {
          safeSet(key, panel.offsetWidth);
          dispatchEvent(new Event('resize'));
        }
      };
    };
    h.ondblclick = () => { panel.classList.toggle('rp-collapsed'); dispatchEvent(new Event('resize')); };
  }
  document.querySelectorAll('aside').forEach((a, i) => resizable(a, 'asideW' + i));

  // ---------- Top-bar scale/unit toggle and shortcut status ----------
  const status = el('div', { id: 'rp-top-status' }, `
    <span id="rp-cal-badge" class="rp-status-chip" style="cursor:pointer" title="Click to toggle IPC English (mils/in) vs IPC Metric (mm/µm) · Shortcut: U"><i data-ic="calibrate"></i><b id="rp-cal-txt">Units: mil (IPC English)</b></span>
    <span id="rp-shortcut-hint">U units · [ ] panels · L loupe · G grid · X crosshair</span>`);
  const top = document.querySelector('#top') || document.body.firstElementChild;
  const topSpacer = top.querySelector('.grow');
  top.insertBefore(status, topSpacer || null);
  if (typeof hydrateIcons === 'function') hydrateIcons(status);
  const calBadgeEl = status.querySelector('#rp-cal-badge');
  if (calBadgeEl) {
    calBadgeEl.onclick = () => {
      if (window.setUnitSystem && window.CAMState) {
        window.setUnitSystem(window.CAMState.unitSystem === 'english' ? 'metric' : 'english');
      }
    };
  }
  document.querySelectorAll('[data-enh]').forEach(b => b.onclick = () => setEnh(b.dataset.enh));
  setEnh(safeGet('enh', 'off') || 'off', true);
  const hintEl = status.querySelector('#rp-shortcut-hint');
  if (hintEl) hintEl.hidden = safeGet('showShortcutHint', 'true') === 'false';

  // ---------- Help centre ----------
  function help() {
    const d = el('div', { className: 'rp-modal' }, `<div class="rp-card rp-wide"><h2>Redline Pro 1.0 Enterprise Help</h2><p class="rp-sub">Redline Studio &middot; textportdocx.in &middot; Version 1.0.0 &middot; 100% Free &amp; Offline</p>
    <div class="rp-scroll rp-grid">
    <section><h4>Compare &amp; Auto-Align</h4><p>Open Base (Rev A) and Revised (Rev B). Use Auto-Align or 3-Point Fiducial Snap. N / F3 and P / Shift+F3 jump between defects.</p></section>
    <section><h4>60 FPS Split Curtain</h4><p>Toggle Split Curtain in View &amp; Enhance (or Mode selector, shortcut C) and drag the divider handle to reveal Rev A on the left and Rev B on the right.</p></section>
    <section><h4>CAM350 &amp; IPC English / Metric</h4><p>Full Gerber RS-274X, Excellon NC Drill &amp; Rout, and IPC-D-356 Netlist inspection. Switch between IPC English (mils/in) and Metric (mm/µm) with shortcut U.</p></section>
    <section><h4>Measure (OSNAP) &amp; BOM</h4><p>Calibrate scale against any known dimension, then measure point-to-point distances, cumulative polylines, closed polygon areas, and BOM tallies (shortcut O toggles OSNAP).</p></section>
    <section><h4>Markups &amp; Crypto Stamps</h4><p>Draw ANSI/ISO scalloped revision clouds (Δ Rev), leader callout arrows, and dynamic stamps with SHA-256 document hashes.</p></section>
    <section><h4>Inspection Optics</h4><p>Press L for the 4x Magnifier Loupe, G for the calibrated Reference Grid, and X for the full-viewport Precision Crosshair.</p></section>
    <section><h4>Audit Reports &amp; Sessions</h4><p>Save your review state to a .redline file, export CSV defect checklists, or generate a multi-page Executive Audit PDF.</p></section>
    <section><h4>Zero Telemetry Privacy</h4><p>100% client-side execution. No cloud uploads, no accounts, no network requests.</p></section></div>
    <div class="rp-sample-actions" style="margin:6px 0">
      <button type="button" id="rp-help-sample-sch" class="rp-sample-btn">⚡ Load Sample Schematic (Rev A vs Rev B)</button>
      <button type="button" id="rp-help-sample-gbr" class="rp-sample-btn">⚡ Load Sample PCB Gerber (Copper vs Drill)</button>
    </div>
    <div class="rp-btns"><button id="rp-hk">Keyboard Shortcuts (?)</button><button id="rp-tv">License</button><button class="rp-primary" id="rp-hc">Close</button></div></div>`);
    document.body.appendChild(d); d.onclick = e => { if (e.target === d) d.remove(); };
    d.querySelector('#rp-hc').onclick = () => d.remove();
    d.querySelector('#rp-tv').onclick = () => { d.remove(); showTerms(); };
    d.querySelector('#rp-hk').onclick = () => { d.remove(); if (window.showKeyboardHUD) window.showKeyboardHUD(); };
    d.querySelector('#rp-help-sample-sch').onclick = () => { d.remove(); if (window.loadSampleSchematic) window.loadSampleSchematic(); };
    d.querySelector('#rp-help-sample-gbr').onclick = () => { d.remove(); if (window.loadSampleGerber) window.loadSampleGerber(); };
  }
  window.rpHelp = help;

  // =========================================================================
  // REDLINE PRO 1.0 INTERACTIVE OVERLAY ENGINE (#rp-ov, Loupe, Grid, OSNAP)
  // =========================================================================
  const rpOv = el('canvas', { id: 'rp-ov', style: 'position:absolute;left:0;top:0;pointer-events:none;z-index:4;' });
  stg.appendChild(rpOv);

  const vpHud = el('canvas', { id: 'rp-hud', style: 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:12;' });
  vp.appendChild(vpHud);

  const RM = {
    activeTool: null, // 'calibrate'|'dist'|'poly'|'area'|'tally'|'cloud'|'leader'|'pen'|'pin'|'eraser'|'redact'|'stamp'
    osnapEnabled: true,
    loupeEnabled: false,
    gridEnabled: false,
    crosshairEnabled: false,
    stampType: 'APPROVED',
    docHash: 'A3F8E902B1764D5C',
    strokeWidth: 3,
    strokeColor: '#e11d48',
    opacity: 1.0,
    dash: 'solid',
    cloudRevText: 'Δ Rev 2',
    pinSize: 24,
    nextPinNum: 1,
    eraserRadius: 20,
    eraserMode: 'object',
    toolSettings: {
      pen: { size: 3, color: '#e11d48', dash: 'solid', opacity: 100 },
      cloud: { size: 2.5, color: '#ef4444', dash: 'solid', opacity: 100 },
      leader: { size: 2, color: '#ef4444', dash: 'solid', opacity: 100 },
      pin: { size: 24, color: '#f59e0b', dash: 'solid', opacity: 100 },
      eraser: { size: 20 },
      dist: { size: 2, color: '#06b6d4', dash: 'solid', opacity: 100 },
      poly: { size: 2.2, color: '#3b82f6', dash: 'solid', opacity: 100 },
      area: { size: 2, color: '#10b981', dash: 'solid', opacity: 100 }
    },
    points: [],
    cursorImg: { x: 0, y: 0 },
    cursorScreen: { x: -1, y: -1 },
    currentSnap: null,
    annotations: [],
    calibrator: (typeof MeasureEngine !== 'undefined') ? new MeasureEngine.CalibrationManager() : null,
    osnap: (typeof MeasureEngine !== 'undefined') ? new MeasureEngine.OSNAPManager(10) : null,
    tally: (typeof MeasureEngine !== 'undefined') ? new MeasureEngine.TallyManager() : null
  };
  window.RP_MEASURE = RM;

  if (RM.calibrator) RM.calibrator.loadSaved();

  function updateCalBadge() {
    const b = $('#rp-cal-txt') || $('#rp-cal-badge');
    if (b && RM.calibrator) {
      const isMet = window.CAMState ? window.CAMState.unitSystem === 'metric' : (RM.calibrator.unit === 'mm');
      const unitLbl = isMet ? 'mm (IPC Metric)' : 'mil (IPC English)';
      b.textContent = `Units: ${unitLbl} · ${(1 / RM.calibrator.pxPerUnit).toFixed(isMet ? 3 : 2)} ${RM.calibrator.unit}/px`;
    }
  }
  window.rpUpdateCalBadge = updateCalBadge;
  updateCalBadge();

  function updateCompareToolOptionsUI(tool) {
    const activeTool = tool !== undefined ? tool : RM.activeTool;
    const showOpts = ['pen', 'eraser', 'pin', 'cloud', 'leader'].includes(activeTool);
    if ($('#rib-cmp-tool-opts')) $('#rib-cmp-tool-opts').hidden = !showOpts;

    const t = activeTool || 'pen';
    const isEraser = t === 'eraser';
    const isPin = t === 'pin';
    const isStroke = !isEraser && !isPin;

    if ($('#rib-mk-pen-presets')) $('#rib-mk-pen-presets').hidden = !isStroke;
    if ($('#rib-mk-eraser-presets')) $('#rib-mk-eraser-presets').hidden = !isEraser;
    if ($('#rib-mk-pin-presets')) $('#rib-mk-pin-presets').hidden = !isPin;
    if ($('#rib-mk-style-row')) $('#rib-mk-style-row').hidden = isEraser;
    if ($('#rib-mk-revtxt')) $('#rib-mk-revtxt').hidden = (t !== 'cloud');
    if ($('#rib-mk-dash')) $('#rib-mk-dash').hidden = isPin;

    const lbl = $('#rib-mk-size-lbl');
    if (lbl) {
      if (isEraser) lbl.textContent = 'Radius (px)';
      else if (isPin) lbl.textContent = 'Pin (px)';
      else if (t === 'pen') lbl.textContent = 'Pen (px)';
      else lbl.textContent = 'Stroke (px)';
    }

    const cap = $('#rib-mk-opts-cap');
    if (cap) {
      const capMap = {
        pen: 'Freehand Pen Options (Thickness, Colour, Opacity & Dash)',
        eraser: 'Eraser Options (Mode & Brush Radius)',
        pin: 'Pin Marker Options (Badge Size & Colour)',
        cloud: 'Revision Cloud Options (Thickness, Delta Label & Colour)',
        leader: 'Leader Callout Options (Stroke Width & Colour)',
        redact: 'Redaction Box Options'
      };
      cap.textContent = capMap[t] || 'Pen, Pin & Eraser Tool Options';
    }

    const cfg = RM.toolSettings[t] || {};
    const curSz = isEraser ? (cfg.size || RM.eraserRadius || 20) : isPin ? (cfg.size || RM.pinSize || 24) : (cfg.size || RM.strokeWidth || 3);
    if ($('#rib-mk-size')) $('#rib-mk-size').value = curSz;
    if (isEraser) RM.eraserRadius = curSz;
    else if (isPin) RM.pinSize = curSz;
    else RM.strokeWidth = curSz;

    if (activeTool && cfg.color && !isEraser) {
      RM.strokeColor = cfg.color;
      if ($('#rib-mk-color')) $('#rib-mk-color').value = cfg.color;
      const low = String(cfg.color).toLowerCase();
      document.querySelectorAll('#rib-mk-swatches .rp-swatch').forEach(b => b.classList.toggle('on', (b.dataset.col || '').toLowerCase() === low));
    }
    if (activeTool && cfg.opacity != null && !isEraser) {
      RM.opacity = Math.max(0.1, Math.min(1.0, cfg.opacity / 100));
      if ($('#rib-mk-op')) $('#rib-mk-op').value = Math.round(RM.opacity * 100);
    }
    if (activeTool && cfg.dash && !isEraser && !isPin) {
      RM.dash = cfg.dash;
      if ($('#rib-mk-dash')) $('#rib-mk-dash').value = cfg.dash;
    }

    const roundSz = Math.round(curSz);
    document.querySelectorAll('#rib-mk-pen-presets .rp-cmp-sz').forEach(b => b.classList.toggle('on', +b.dataset.sz === roundSz));
    document.querySelectorAll('#rib-mk-eraser-presets .rp-cmp-er').forEach(b => b.classList.toggle('on', +b.dataset.er === roundSz));
    document.querySelectorAll('#rib-mk-pin-presets .rp-cmp-pin').forEach(b => b.classList.toggle('on', +b.dataset.psz === roundSz));
  }
  window.rpUpdateCompareToolOptionsUI = updateCompareToolOptionsUI;

  function setCompareToolSize(val) {
    const v = Math.max(1, Math.min(120, +val || 1));
    const t = RM.activeTool || 'pen';
    RM.toolSettings[t] = RM.toolSettings[t] || {};
    RM.toolSettings[t].size = v;
    if (t === 'eraser') RM.eraserRadius = v;
    else if (t === 'pin') RM.pinSize = v;
    else RM.strokeWidth = v;
    updateCompareToolOptionsUI(t);
    redrawOverlay();
  }
  window.rpSetCompareToolSize = setCompareToolSize;

  function setActiveTool(tool, label = '', btnId = null) {
    if (tool && S && S.ignMode) {
      S.ignMode = false;
      if ($('#ignBtn')) $('#ignBtn').classList.remove('on');
      if ($('#rib-ignore')) $('#rib-ignore').classList.remove('on');
      vp.classList.remove('ign');
    }
    RM.activeTool = tool;
    RM.points = [];
    document.querySelectorAll('[data-rptool]').forEach(b => {
      if (btnId) b.classList.toggle('on', b.id === btnId && !!tool);
      else b.classList.toggle('on', b.dataset.rptool === tool && (!label || b.textContent.includes(label.split(' ')[0])));
    });
    updateCompareToolOptionsUI(tool);
    const pill = $('#rp-active-tool-pill');
    const pillName = $('#rp-active-tool-name');
    const finBtn = $('#rp-finish-tool-btn');
    if (pill && pillName) {
      if (tool) {
        pill.hidden = false;
        if (finBtn) finBtn.hidden = !(tool === 'poly' || tool === 'area');
        pillName.textContent = `Active: ${label || tool.toUpperCase()} (${tool === 'poly' || tool === 'area' ? 'Click points & Double-click/Enter to finish, or drag box for Area' : 'Click or drag on drawing, Esc to exit'})`;
      } else if (!(S && S.ignMode)) {
        pill.hidden = true;
        if (finBtn) finBtn.hidden = true;
      }
    }
    vp.style.cursor = (tool || (S && S.ignMode)) ? 'crosshair' : '';
    redrawOverlay();
  }
  window.rpSetActiveTool = setActiveTool;
  RM.setTool = setActiveTool;

  function reformatAllMeasurementAnnotations() {
    const cal = RM.calibrator;
    if (!cal || typeof MeasureEngine === 'undefined') return;
    for (const a of (RM.annotations || [])) {
      if (a.kind === 'dist' && a.pts && a.pts.length >= 2) {
        const dPx = MeasureEngine.calcDistance(a.pts[0], a.pts[1]);
        a.label = cal.formatDistance(dPx);
      } else if (a.kind === 'poly' && a.pts && a.pts.length >= 2) {
        const lenPx = MeasureEngine.calcPolylineLength(a.pts);
        a.label = `Σ = ${cal.formatDistance(lenPx)}`;
      } else if (a.kind === 'area' && a.pts && a.pts.length >= 3) {
        const areaPx = MeasureEngine.calcPolygonArea(a.pts);
        const perimPx = MeasureEngine.calcPolylineLength([...a.pts, a.pts[0]]);
        a.label = `${cal.formatArea(areaPx)} (P: ${cal.formatDistance(perimPx)})`;
      }
    }
    redrawOverlay();
    if (window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar();
  }
  window.rpReformatMeasurements = reformatAllMeasurementAnnotations;

  function rebuildOSNAPFeatures() {
    if (!RM.osnap) return;
    RM.osnap.clear();
    const cv = $('#cv');
    if (cv && cv.width > 0 && cv.height > 0) {
      RM.osnap.addRect(0, 0, cv.width, cv.height);
    }
    if (S && S.cur && S.cur.regions) {
      for (const r of S.cur.regions) {
        RM.osnap.addRect(r.x, r.y, r.w, r.h);
      }
    }
    const curPage = (S && S.n) || 1;
    for (const a of RM.annotations) {
      if (a.page != null && a.page !== curPage) continue;
      if (a.pts) {
        for (let i = 0; i < a.pts.length; i++) {
          RM.osnap.addPoint(a.pts[i].x, a.pts[i].y, 'endpoint');
          if (i + 1 < a.pts.length) {
            RM.osnap.addLine(a.pts[i].x, a.pts[i].y, a.pts[i + 1].x, a.pts[i + 1].y);
          }
        }
      }
    }
  }

  function redrawOverlay() {
    const cv = $('#cv');
    if (!cv || !cv.width || !cv.height) return;
    if (rpOv.width !== cv.width || rpOv.height !== cv.height) {
      rpOv.width = cv.width;
      rpOv.height = cv.height;
    }
    const ctx = rpOv.getContext('2d');
    ctx.clearRect(0, 0, rpOv.width, rpOv.height);

    const k = (S && S.view && S.view.k) ? S.view.k : 1;

    if (RM.gridEnabled) {
      ctx.save();
      const stepPx = Math.max(25, Math.round((RM.calibrator ? RM.calibrator.pxPerUnit * (RM.calibrator.unit === 'mils' ? 200 : 10) : 50)));
      const isDarkBg = (S && (S.mode === 'over' || S.mode === 'diff' || (S.cur && S.cur.isDarkSubstrate))) || safeGet('enh', 'off') === 'blue';
      ctx.strokeStyle = isDarkBg ? 'rgba(56, 189, 248, 0.38)' : 'rgba(2, 132, 199, 0.35)';
      ctx.lineWidth = 1 / k;
      ctx.beginPath();
      for (let x = 0, i = 0; x <= rpOv.width; x += stepPx, i++) {
        if (i % 5 === 0) continue;
        ctx.moveTo(x, 0); ctx.lineTo(x, rpOv.height);
      }
      for (let y = 0, j = 0; y <= rpOv.height; y += stepPx, j++) {
        if (j % 5 === 0) continue;
        ctx.moveTo(0, y); ctx.lineTo(rpOv.width, y);
      }
      ctx.stroke();
      ctx.strokeStyle = isDarkBg ? 'rgba(56, 189, 248, 0.65)' : 'rgba(2, 132, 199, 0.62)';
      ctx.lineWidth = 1.6 / k;
      ctx.beginPath();
      for (let x = 0; x <= rpOv.width; x += stepPx * 5) { ctx.moveTo(x, 0); ctx.lineTo(x, rpOv.height); }
      for (let y = 0; y <= rpOv.height; y += stepPx * 5) { ctx.moveTo(0, y); ctx.lineTo(rpOv.width, y); }
      ctx.stroke();
      ctx.restore();
    }

    const curPage = (S && S.n) || 1;
    for (const a of RM.annotations) {
      if (a.page == null || a.page === curPage) {
        renderSingleAnnotation(ctx, a, k);
      }
    }

    if (RM.tally && RM.tally.items.length) {
      RM.tally.drawBadges(ctx, curPage, k);
    }

    if (window.UIRibbon && window.UIRibbon.FiducialAligner && window.UIRibbon.FiducialAligner.active) {
      const FA = window.UIRibbon.FiducialAligner;
      const drawFid = (pt, i, col, tag) => {
        ctx.save();
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.lineWidth = 2 / k;
        const r = 10 / k;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pt.x - r * 1.4, pt.y); ctx.lineTo(pt.x + r * 1.4, pt.y);
        ctx.moveTo(pt.x, pt.y - r * 1.4); ctx.lineTo(pt.x, pt.y + r * 1.4);
        ctx.stroke();
        ctx.font = `bold ${Math.max(10, 12 / k)}px sans-serif`;
        ctx.fillText(`${tag}${i + 1}`, pt.x + r * 1.3, pt.y - r * 0.8);
        ctx.restore();
      };
      FA.pointsA.forEach((p, i) => drawFid(p, i, '#ef4444', 'A'));
      FA.pointsB.forEach((p, i) => drawFid(p, i, '#22c55e', 'B'));
    }

    if (RM.activeTool === 'eraser' && RM.cursorScreen.x >= 0) {
      ctx.save();
      const erR = (RM.eraserRadius || 20) / k;
      ctx.beginPath();
      ctx.arc(RM.cursorImg.x, RM.cursorImg.y, Math.max(4 / k, erR), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.14)';
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.6 / k;
      ctx.setLineDash([4 / k, 3 / k]);
      ctx.stroke();
      ctx.restore();
    }

    if (RM.activeTool && RM.points.length > 0) {
      const previewPts = [...RM.points, RM.cursorImg];
      renderInProgressPreview(ctx, RM.activeTool, previewPts, k);
    }

    if (RM.osnapEnabled && RM.currentSnap && RM.currentSnap.type && RM.osnap) {
      RM.osnap.drawSnapMarker(ctx, RM.currentSnap, k);
    }
  }
  window.rpRedrawOverlay = redrawOverlay;

  function drawPillLabel(ctx, text, x, y, k, bgColor = 'rgba(15, 23, 42, 0.88)', textColor = '#38bdf8') {
    ctx.save();
    const fs = Math.max(10, 12 / k);
    ctx.font = `bold ${fs}px Consolas, monospace`;
    const padX = 6 / k, padY = 4 / k;
    const tw = ctx.measureText(text).width;
    const bw = tw + padX * 2, bh = fs + padY * 2;
    ctx.fillStyle = bgColor;
    ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh);
    ctx.strokeStyle = textColor;
    ctx.lineWidth = 1.2 / k;
    ctx.strokeRect(x - bw / 2, y - bh / 2, bw, bh);
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function applyCompareDash(ctx, dash, lw, k) {
    if (dash === 'dashed') ctx.setLineDash([Math.max(5, lw * 3) / k, Math.max(3, lw * 2) / k]);
    else if (dash === 'dotted') ctx.setLineDash([Math.max(1.5, lw) / k, Math.max(3, lw * 2) / k]);
    else ctx.setLineDash([]);
  }

  function renderSingleAnnotation(ctx, a, k) {
    ctx.save();
    ctx.globalAlpha = a.opacity != null ? a.opacity : 1.0;
    const lw = a.lineWidth || 2.5;
    applyCompareDash(ctx, a.dash, lw, k);

    if (a.kind === 'dist' && a.pts && a.pts.length >= 2) {
      const [p1, p2] = a.pts;
      ctx.strokeStyle = a.color || '#06b6d4';
      ctx.lineWidth = (a.lineWidth || 2) / k;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.setLineDash([]);
      const r = 4 / k;
      ctx.fillStyle = a.color || '#06b6d4';
      ctx.beginPath(); ctx.arc(p1.x, p1.y, r, 0, Math.PI * 2); ctx.arc(p2.x, p2.y, r, 0, Math.PI * 2); ctx.fill();
      drawPillLabel(ctx, a.label, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2 - 12 / k, k);
    } else if (a.kind === 'poly' && a.pts && a.pts.length >= 2) {
      ctx.strokeStyle = a.color || '#3b82f6';
      ctx.lineWidth = (a.lineWidth || 2.2) / k;
      ctx.beginPath();
      ctx.moveTo(a.pts[0].x, a.pts[0].y);
      for (let i = 1; i < a.pts.length; i++) ctx.lineTo(a.pts[i].x, a.pts[i].y);
      ctx.stroke();
      ctx.setLineDash([]);
      const last = a.pts[a.pts.length - 1];
      drawPillLabel(ctx, a.label, last.x, last.y - 14 / k, k, 'rgba(15, 23, 42, 0.9)', '#60a5fa');
    } else if (a.kind === 'area' && a.pts && a.pts.length >= 2) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
      ctx.strokeStyle = a.color || '#10b981';
      ctx.lineWidth = (a.lineWidth || 2) / k;
      ctx.beginPath();
      ctx.moveTo(a.pts[0].x, a.pts[0].y);
      for (let i = 1; i < a.pts.length; i++) ctx.lineTo(a.pts[i].x, a.pts[i].y);
      if (a.pts.length >= 3) {
        ctx.closePath();
        ctx.fill();
      }
      ctx.stroke();
      ctx.setLineDash([]);
      const rDot = 4 / k;
      ctx.fillStyle = a.color || '#10b981';
      for (const p of a.pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, rDot, 0, Math.PI * 2);
        ctx.fill();
      }
      const cx = a.pts.reduce((s, p) => s + p.x, 0) / a.pts.length;
      const cy = a.pts.reduce((s, p) => s + p.y, 0) / a.pts.length;
      drawPillLabel(ctx, a.label, cx, a.pts.length === 2 ? cy - 12 / k : cy, k, 'rgba(6, 78, 59, 0.92)', '#34d399');
    } else if (a.kind === 'cloud' && a.pts && a.pts.length >= 2 && typeof MeasureEngine !== 'undefined') {
      ctx.setLineDash([]);
      MeasureEngine.drawRevisionCloud(ctx, a.pts, a.revText != null ? a.revText : 'Δ Rev 2', { color: a.color || '#ef4444', lineWidth: (a.lineWidth || 2.2) / k, scallopSize: 16 });
    } else if (a.kind === 'leader' && a.pts && a.pts.length >= 2 && typeof MeasureEngine !== 'undefined') {
      ctx.setLineDash([]);
      MeasureEngine.drawLeaderCallout(ctx, a.pts[0], a.pts[1], a.label || 'Engineering Note', { color: a.color || '#ef4444', lineWidth: (a.lineWidth || 2) / k });
    } else if (a.kind === 'pen' && a.pts && a.pts.length >= 1) {
      ctx.strokeStyle = a.color || '#e11d48';
      ctx.lineWidth = (a.lineWidth || 3) / k;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(a.pts[0].x, a.pts[0].y);
      if (a.pts.length === 1) ctx.lineTo(a.pts[0].x + 0.1, a.pts[0].y);
      for (let i = 1; i < a.pts.length; i++) ctx.lineTo(a.pts[i].x, a.pts[i].y);
      ctx.stroke();
    } else if (a.kind === 'pin') {
      ctx.setLineDash([]);
      const pSz = (a.size || 24) / k;
      const pH = pSz * 1.25;
      const cx = a.x;
      const tipY = a.y;
      const headCy = tipY - pH + pSz * 0.45;
      const r = pSz * 0.44;
      ctx.fillStyle = a.color || '#f59e0b';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.2 / k, pSz * 0.07);
      ctx.beginPath();
      ctx.arc(cx, headCy, r, Math.PI * 0.82, Math.PI * 0.18, false);
      ctx.lineTo(cx, tipY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(8 / k, r * 0.95)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(a.pinNum || 1), cx, headCy);
      if (a.label) {
        drawPillLabel(ctx, a.label, cx, headCy - r - 10 / k, k, 'rgba(15, 23, 42, 0.92)', a.color || '#f59e0b');
      }
    } else if (a.kind === 'redact' && a.pts && a.pts.length >= 2) {
      ctx.setLineDash([]);
      const [p1, p2] = a.pts;
      ctx.fillStyle = '#000000';
      ctx.fillRect(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y), Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
    } else if (a.kind === 'stamp' && typeof MeasureEngine !== 'undefined') {
      ctx.setLineDash([]);
      MeasureEngine.drawEngineeringStamp(ctx, a.x, a.y, a.stampType, a.reviewer || 'Lead Engineer', a.docHash || RM.docHash);
    }
    ctx.restore();
  }

  function renderInProgressPreview(ctx, tool, pts, k) {
    if (pts.length < 2) return;
    const cal = RM.calibrator;
    const curCol = RM.strokeColor || '#e11d48';
    const curW = RM.strokeWidth || 3;
    const curOp = RM.opacity != null ? RM.opacity : 1.0;
    const curDash = RM.dash || 'solid';
    const curRev = ($('#rib-mk-revtxt') && $('#rib-mk-revtxt').value) || RM.cloudRevText || 'Δ Rev 2';
    if (tool === 'calibrate' || tool === 'dist') {
      const dPx = MeasureEngine.calcDistance(pts[0], pts[1]);
      const lbl = tool === 'calibrate' ? `${dPx.toFixed(1)} px (Click to set scale)` : (cal ? cal.formatDistance(dPx) : `${dPx.toFixed(1)} px`);
      renderSingleAnnotation(ctx, { kind: 'dist', pts, label: lbl, color: curCol, lineWidth: curW }, k);
    } else if (tool === 'poly') {
      const lenPx = MeasureEngine.calcPolylineLength(pts);
      const lbl = `Σ = ${cal ? cal.formatDistance(lenPx) : lenPx.toFixed(1) + ' px'}`;
      renderSingleAnnotation(ctx, { kind: 'poly', pts, label: lbl, color: curCol, lineWidth: curW }, k);
    } else if (tool === 'area') {
      let drawPts = pts;
      if (pts.length === 2 && RM._areaDragging && Math.abs(pts[1].x - pts[0].x) > 4 / k && Math.abs(pts[1].y - pts[0].y) > 4 / k) {
        const [p1, p2] = pts;
        drawPts = [
          { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y) },
          { x: Math.max(p1.x, p2.x), y: Math.min(p1.y, p2.y) },
          { x: Math.max(p1.x, p2.x), y: Math.max(p1.y, p2.y) },
          { x: Math.min(p1.x, p2.x), y: Math.max(p1.y, p2.y) }
        ];
      }
      const areaPx = drawPts.length >= 3 ? MeasureEngine.calcPolygonArea(drawPts) : 0;
      const perimPx = drawPts.length >= 3 ? MeasureEngine.calcPolylineLength([...drawPts, drawPts[0]]) : MeasureEngine.calcDistance(drawPts[0], drawPts[1]);
      const lbl = drawPts.length >= 3
        ? `Area: ${cal ? cal.formatArea(areaPx) : Math.round(areaPx) + ' px²'} | Perim: ${cal ? cal.formatDistance(perimPx) : Math.round(perimPx) + ' px'}`
        : `${cal ? cal.formatDistance(perimPx) : Math.round(perimPx) + ' px'} (Click 3+ vertices or drag box)`;
      renderSingleAnnotation(ctx, { kind: 'area', pts: drawPts, label: lbl, color: curCol, lineWidth: curW }, k);
    } else if (tool === 'cloud') {
      if (pts.length === 2) {
        const [p1, p2] = pts;
        const rectPts = [
          { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y) },
          { x: Math.max(p1.x, p2.x), y: Math.min(p1.y, p2.y) },
          { x: Math.max(p1.x, p2.x), y: Math.max(p1.y, p2.y) },
          { x: Math.min(p1.x, p2.x), y: Math.max(p1.y, p2.y) }
        ];
        renderSingleAnnotation(ctx, { kind: 'cloud', pts: rectPts, revText: curRev, color: curCol, lineWidth: curW, opacity: curOp }, k);
      } else {
        renderSingleAnnotation(ctx, { kind: 'cloud', pts, revText: curRev, color: curCol, lineWidth: curW, opacity: curOp }, k);
      }
    } else if (tool === 'leader') {
      renderSingleAnnotation(ctx, { kind: 'leader', pts: [pts[0], pts[1]], label: 'Callout...', color: curCol, lineWidth: curW, opacity: curOp }, k);
    } else if (tool === 'pen') {
      renderSingleAnnotation(ctx, { kind: 'pen', pts, color: curCol, lineWidth: curW, opacity: curOp, dash: curDash }, k);
    } else if (tool === 'redact') {
      renderSingleAnnotation(ctx, { kind: 'redact', pts: [pts[0], pts[pts.length - 1]] }, k);
    }
  }

  function renderViewportHUD() {
    const devicePixelRatio = DPR();
    const logicalWidth = vp.clientWidth || 1;
    const logicalHeight = vp.clientHeight || 1;
    const targetW = Math.max(1, Math.round(logicalWidth * devicePixelRatio));
    const targetH = Math.max(1, Math.round(logicalHeight * devicePixelRatio));
    if (vpHud.width !== targetW || vpHud.height !== targetH) {
      vpHud.width = targetW;
      vpHud.height = targetH;
      vpHud.style.width = logicalWidth + 'px';
      vpHud.style.height = logicalHeight + 'px';
    }
    const ctx = vpHud.getContext('2d');
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    const sx = RM.cursorScreen.x;
    const sy = RM.cursorScreen.y;

    if (RM.crosshairEnabled && sx >= 0 && sy >= 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 77, 77, 0.65)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(sx, 0); ctx.lineTo(sx, logicalHeight);
      ctx.moveTo(0, sy); ctx.lineTo(logicalWidth, sy);
      ctx.stroke();
      ctx.restore();
    }

    if (RM.loupeEnabled && sx >= 0 && sy >= 0) {
      const cv = $('#cv');
      if (cv && cv.width > 0) {
        const radius = 92;
        const zoom = 4;
        const srcR = radius / (zoom * ((S && S.view && S.view.k) || 1));

        ctx.save();
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.clip();

        ctx.fillStyle = '#0a120f';
        ctx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);

        ctx.imageSmoothingEnabled = false;
        const activeFilter = getComputedStyle(document.documentElement).getPropertyValue('--rp-filter').trim() || 'none';
        ctx.filter = activeFilter;
        const curtainOn = !!(window.UIRibbon && window.UIRibbon.isCurtainActive && window.UIRibbon.isCurtainActive());
        const cvA = $('#cvA');
        if (curtainOn && cvA && cvA.width === cv.width) {
          ctx.drawImage(
            cvA,
            RM.cursorImg.x - srcR, RM.cursorImg.y - srcR, srcR * 2, srcR * 2,
            sx - radius, sy - radius, radius * 2, radius * 2
          );
          const pct = (window.UIRibbon.getCurtainPct ? window.UIRibbon.getCurtainPct() : 50) / 100;
          const splitScreenX = pct * (vp.clientWidth || 1);
          const k = (S && S.view && S.view.k) || 1;
          const splitImgX = (splitScreenX - ((S && S.view && S.view.x) || 0)) / k;
          const relSplit = (splitImgX - (RM.cursorImg.x - srcR)) / (srcR * 2);
          const clipLeft = Math.max(sx - radius, Math.min(sx + radius, sx - radius + relSplit * (radius * 2)));
          if (clipLeft < sx + radius) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(clipLeft, sy - radius, (sx + radius) - clipLeft, radius * 2);
            ctx.clip();
            ctx.drawImage(
              cv,
              RM.cursorImg.x - srcR, RM.cursorImg.y - srcR, srcR * 2, srcR * 2,
              sx - radius, sy - radius, radius * 2, radius * 2
            );
            ctx.restore();
          }
        } else {
          ctx.drawImage(
            cv,
            RM.cursorImg.x - srcR, RM.cursorImg.y - srcR, srcR * 2, srcR * 2,
            sx - radius, sy - radius, radius * 2, radius * 2
          );
        }
        ctx.filter = 'none';
        const mk = $('#mk');
        if (mk && mk.width === cv.width && mk.height === cv.height && $('#lM') && $('#lM').checked) {
          ctx.drawImage(
            mk,
            RM.cursorImg.x - srcR, RM.cursorImg.y - srcR, srcR * 2, srcR * 2,
            sx - radius, sy - radius, radius * 2, radius * 2
          );
        }
        if (rpOv && rpOv.width === cv.width && rpOv.height === cv.height) {
          ctx.drawImage(
            rpOv,
            RM.cursorImg.x - srcR, RM.cursorImg.y - srcR, srcR * 2, srcR * 2,
            sx - radius, sy - radius, radius * 2, radius * 2
          );
        }

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx - radius, sy); ctx.lineTo(sx + radius, sy);
        ctx.moveTo(sx, sy - radius); ctx.lineTo(sx, sy + radius);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#ff4d4d';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  window.rpAfterPaint = () => {
    if (RM.calibrator && !RM.calibrator.calibrated) {
      const dpi = (S && S.cur && S.cur.dpi) ? S.cur.dpi : (+($('#dpi') && $('#dpi').value) || 300);
      const u = RM.calibrator.unit || 'mils';
      RM.calibrator.pxPerUnit = u === 'mm' ? (dpi / 25.4) : u === 'in' ? dpi : u === 'um' ? (dpi / 25400) : (dpi / 1000);
      updateCalBadge();
    }
    rebuildOSNAPFeatures();
    redrawOverlay();
    if (window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar();
    if (window.UIRibbon && window.UIRibbon.updateCurtainClip) window.UIRibbon.updateCurtainClip();
  };

  function getImgCoords(e) {
    const b = vp.getBoundingClientRect();
    const sx = e.clientX - b.left;
    const sy = e.clientY - b.top;
    RM.cursorScreen = { x: sx, y: sy };
    const k = (S && S.view && S.view.k) ? S.view.k : 1;
    const vx = (S && S.view) ? S.view.x : 0;
    const vy = (S && S.view) ? S.view.y : 0;
    const rawX = (sx - vx) / k;
    const rawY = (sy - vy) / k;

    if (RM.osnapEnabled && RM.osnap) {
      const snapped = RM.osnap.snap(rawX, rawY, k);
      RM.currentSnap = snapped;
      return { x: snapped.x, y: snapped.y, snapType: snapped.type };
    }
    RM.currentSnap = null;
    return { x: rawX, y: rawY, snapType: null };
  }

  function distToSegmentCmp(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function hitCompareAnnotation(a, x, y, rad) {
    if (a.kind === 'pin') {
      const sz = a.size || 24;
      return Math.hypot(x - a.x, y - (a.y - sz * 0.6)) <= Math.max(rad, sz * 0.75);
    }
    if (a.kind === 'stamp') {
      return x >= a.x - rad && x <= a.x + 210 + rad && y >= a.y - rad && y <= a.y + 76 + rad;
    }
    if (a.kind === 'redact' && a.pts && a.pts.length >= 2) {
      const [p1, p2] = a.pts;
      const x0 = Math.min(p1.x, p2.x), x1 = Math.max(p1.x, p2.x);
      const y0 = Math.min(p1.y, p2.y), y1 = Math.max(p1.y, p2.y);
      return x >= x0 - rad && x <= x1 + rad && y >= y0 - rad && y <= y1 + rad;
    }
    if (a.pts && a.pts.length >= 1) {
      const tol = Math.max(rad, (a.lineWidth || 3) / 2 + 4);
      if (a.pts.length === 1) return Math.hypot(x - a.pts[0].x, y - a.pts[0].y) <= tol;
      for (let i = 0; i < a.pts.length - 1; i++) {
        if (distToSegmentCmp(x, y, a.pts[i].x, a.pts[i].y, a.pts[i + 1].x, a.pts[i + 1].y) <= tol) return true;
      }
      if ((a.kind === 'cloud' || a.kind === 'area') && a.pts.length >= 3) {
        const last = a.pts[a.pts.length - 1];
        if (distToSegmentCmp(x, y, last.x, last.y, a.pts[0].x, a.pts[0].y) <= tol) return true;
      }
    }
    return false;
  }

  function eraseCompareAt(x, y, curPage) {
    const k = (S && S.view && S.view.k) ? S.view.k : 1;
    const rad = (RM.eraserRadius || 20) / k;
    const mode = ($('#rib-mk-eraser-mode') && $('#rib-mk-eraser-mode').value) || RM.eraserMode || 'object';
    let changed = false;

    if (mode === 'brush') {
      const densifyCmpPts = (pts, hitR) => {
        const out = [];
        for (let i = 0; i < pts.length; i++) {
          const p0 = pts[i];
          out.push(p0);
          if (i + 1 < pts.length) {
            const p1 = pts[i + 1];
            const segLen = Math.hypot(p1.x - p0.x, p1.y - p0.y);
            if (segLen > 3 && distToSegmentCmp(x, y, p0.x, p0.y, p1.x, p1.y) <= hitR + 2) {
              const steps = Math.min(40, Math.ceil(segLen / 2.5));
              for (let s = 1; s < steps; s++) {
                const t = s / steps;
                out.push({ x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t });
              }
            }
          }
        }
        return out;
      };
      const nextAnns = [];
      for (const a of RM.annotations) {
        if (a.page != null && a.page !== curPage) { nextAnns.push(a); continue; }
        if (a.kind === 'pen' && Array.isArray(a.pts) && a.pts.length >= 1) {
          const hitR = rad + (a.lineWidth || 3) / 2;
          if (a.pts.length === 1) {
            if (Math.hypot(a.pts[0].x - x, a.pts[0].y - y) <= hitR) changed = true;
            else nextAnns.push(a);
            continue;
          }
          const densePts = densifyCmpPts(a.pts, hitR);
          let seg = [];
          let cut = false;
          for (const p of densePts) {
            if (Math.hypot(p.x - x, p.y - y) <= hitR) {
              cut = true;
              if (seg.length >= 2) nextAnns.push({ ...a, pts: seg });
              seg = [];
            } else {
              seg.push(p);
            }
          }
          if (cut) {
            changed = true;
            if (seg.length >= 2) nextAnns.push({ ...a, pts: seg });
          } else {
            nextAnns.push(a);
          }
        } else if (hitCompareAnnotation(a, x, y, rad)) {
          changed = true;
        } else {
          nextAnns.push(a);
        }
      }
      RM.annotations = nextAnns;
    } else {
      const before = RM.annotations.length;
      RM.annotations = RM.annotations.filter(a => {
        if (a.page != null && a.page !== curPage) return true;
        return !hitCompareAnnotation(a, x, y, rad);
      });
      if (RM.annotations.length !== before) changed = true;
    }

    if (RM.tally && Array.isArray(RM.tally.items)) {
      const hitTally = RM.tally.items.find(it => it.page === curPage && Math.hypot(it.x - x, it.y - y) <= Math.max(rad, 14 / k));
      if (hitTally) {
        RM.tally.removeItem(hitTally.id);
        changed = true;
      }
    }
    return changed;
  }
  window.rpEraseCompareAt = eraseCompareAt;

  let penDown = false;
  let eraseDown = false;
  let erasedInStroke = false;
  let twoPtDragStart = null;
  vp.addEventListener('pointermove', e => {
    const pt = getImgCoords(e);
    RM.cursorImg = { x: pt.x, y: pt.y };
    if (twoPtDragStart && RM.activeTool === 'area' && RM.points.length === 1) {
      const k = (S && S.view && S.view.k) ? S.view.k : 1;
      RM._areaDragging = Math.hypot(pt.x - twoPtDragStart.x, pt.y - twoPtDragStart.y) > 8 / k;
    }

    if (penDown && (RM.activeTool === 'pen' || RM.activeTool === 'redact')) {
      RM.points.push({ x: pt.x, y: pt.y });
    }
    if (eraseDown && RM.activeTool === 'eraser') {
      const curPage = (S && S.n) || 1;
      if (eraseCompareAt(pt.x, pt.y, curPage)) {
        erasedInStroke = true;
        if (window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar();
      }
    }

    if (RM.calibrator && $('#pos') && ((S && S.cur) || ($('#cv') && $('#cv').width > 0))) {
      const dpi = (S && S.cur && S.cur.dpi) ? S.cur.dpi : 300;
      const isEng = window.CAMState && window.CAMState.unitSystem === 'english';
      const xMils = (pt.x / dpi * 1000).toFixed(1), yMils = (pt.y / dpi * 1000).toFixed(1);
      const xMM = (pt.x / dpi * 25.4).toFixed(2), yMM = (pt.y / dpi * 25.4).toFixed(2);
      const coordText = RM.calibrator.calibrated
        ? `X: ${RM.calibrator.formatDistance(pt.x)}, Y: ${RM.calibrator.formatDistance(pt.y)}`
        : (isEng ? `X: ${xMils} mil, Y: ${yMils} mil (${xMM}, ${yMM} mm)` : `X: ${xMM} mm, Y: ${yMM} mm (${xMils}, ${yMils} mil)`);
      const snapStr = pt.snapType ? ` [OSNAP: ${pt.snapType.toUpperCase()}]` : '';
      const zoomPct = (S && S.view) ? Math.round(S.view.k * 100) : 100;
      $('#pos').textContent = `${coordText} · ${zoomPct}%${snapStr}`;
    }

    if (RM.activeTool || RM.osnapEnabled) redrawOverlay();
    if (RM.loupeEnabled || RM.crosshairEnabled) renderViewportHUD();
  });

  vp.addEventListener('pointerleave', () => {
    RM.cursorScreen = { x: -1, y: -1 };
    RM.currentSnap = null;
    if (RM.osnapEnabled || RM.activeTool === 'eraser') redrawOverlay();
    if (RM.loupeEnabled || RM.crosshairEnabled) renderViewportHUD();
  });

  async function completeTwoPointTool(tool) {
    const cal = RM.calibrator;
    const curPage = (S && S.n) || 1;
    const curCol = RM.strokeColor || '#e11d48';
    const curW = RM.strokeWidth || 3;
    const curOp = RM.opacity != null ? RM.opacity : 1.0;
    const curDash = RM.dash || 'solid';

    if (tool === 'calibrate' && RM.points.length >= 2) {
      const dPx = MeasureEngine.calcDistance(RM.points[0], RM.points[1]);
      setActiveTool(null);
      const defUnit = (window.CAMState && window.CAMState.unitSystem === 'english') ? 'mils' : 'mm';
      if (window.dialog) {
        const res = await window.dialog('Calibrate Real-World Scale', [
          { type: 'note', label: `Reference line measured ${dPx.toFixed(2)} pixels on sheet.` },
          { type: 'number', id: 'val', label: 'Real-World Distance', value: defUnit === 'mils' ? 100 : 25.4, min: 0.001 },
          { type: 'select', id: 'unit', label: 'Measurement Unit (IPC)', value: defUnit, options: [
            { label: 'Mils / Thou (mil — IPC English)', value: 'mils' },
            { label: 'Inches (in — IPC English)', value: 'in' },
            { label: 'Millimeters (mm — IPC Metric)', value: 'mm' },
            { label: 'Microns (µm — IPC Metric)', value: 'um' }
          ] }
        ], 'Calibrate');
        if (res && res.val > 0 && cal) {
          cal.setCalibration(dPx, parseFloat(res.val), res.unit);
          if (window.setUnitSystem) window.setUnitSystem((res.unit === 'mm' || res.unit === 'um') ? 'metric' : 'english', true, true);
          updateCalBadge();
          reformatAllMeasurementAnnotations();
          if (window.rpToast) window.rpToast(`Scale Calibrated: ${dPx.toFixed(1)} px = ${res.val} ${res.unit}`);
        }
      }
    } else if (tool === 'dist' && RM.points.length >= 2) {
      const dPx = MeasureEngine.calcDistance(RM.points[0], RM.points[1]);
      const lbl = cal ? cal.formatDistance(dPx) : `${dPx.toFixed(1)} px`;
      if (window.rpPushCompareHistory) window.rpPushCompareHistory('Distance measurement');
      RM.annotations.push({ kind: 'dist', page: curPage, pts: [RM.points[0], RM.points[1]], label: lbl, color: curCol, lineWidth: curW, opacity: curOp, dash: curDash });
      RM.points = [];
      redrawOverlay();
      if (window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar();
      if (window.rpToast) window.rpToast(`Measured Distance: ${lbl}`);
    } else if (tool === 'leader' && RM.points.length >= 2) {
      const savedPts = [RM.points[0], RM.points[1]];
      setActiveTool(null);
      let note = 'Check tolerance & clearance';
      if (window.dialog) {
        const r = await window.dialog('Add Leader Callout', [
          { id: 'txt', label: 'Callout Annotation Text', value: 'Check tolerance & clearance' }
        ], 'Place Callout');
        if (!r) return;
        note = r.txt || note;
      }
      if (window.rpPushCompareHistory) window.rpPushCompareHistory('Leader callout');
      RM.annotations.push({ kind: 'leader', page: curPage, pts: savedPts, label: note, color: curCol, lineWidth: curW, opacity: curOp });
      redrawOverlay();
      if (window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar();
      if (window.rpToast) window.rpToast('Placed Leader Callout.');
    } else if (tool === 'cloud' && RM.points.length >= 2) {
      const [p1, p2] = RM.points;
      const rectPts = [
        { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y) },
        { x: Math.max(p1.x, p2.x), y: Math.min(p1.y, p2.y) },
        { x: Math.max(p1.x, p2.x), y: Math.max(p1.y, p2.y) },
        { x: Math.min(p1.x, p2.x), y: Math.max(p1.y, p2.y) }
      ];
      const revTxt = ($('#rib-mk-revtxt') && $('#rib-mk-revtxt').value) || RM.cloudRevText || 'Δ Rev 2';
      if (window.rpPushCompareHistory) window.rpPushCompareHistory('Revision cloud');
      RM.annotations.push({ kind: 'cloud', page: curPage, pts: rectPts, revText: revTxt, color: curCol, lineWidth: curW, opacity: curOp });
      RM.points = [];
      redrawOverlay();
      if (window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar();
      if (window.rpToast) window.rpToast(`Placed ANSI/ISO Scalloped Revision Cloud (${revTxt}).`);
    }
  }

  // Pointer Down on #vp: handle Fiducial Aligner & Interactive Measurement / Markup Tools
  vp.addEventListener('pointerdown', async e => {
    if (e.button !== 0) return;
    if (e.target && e.target.closest && e.target.closest('#empty, #c-floating-hud, #rp-curtain-handle, button, select, input, a, label')) return;

    if (window.UIRibbon && window.UIRibbon.FiducialAligner && window.UIRibbon.FiducialAligner.active) {
      const pt = getImgCoords(e);
      if (window.UIRibbon.FiducialAligner.addPoint(pt.x, pt.y)) {
        e.stopImmediatePropagation();
        e.preventDefault();
        return;
      }
    }

    if (!RM.activeTool) return;
    e.stopImmediatePropagation();
    e.preventDefault();

    const cv = $('#cv');
    if (!cv || !cv.width || !cv.height) {
      if (window.rpToast) window.rpToast('Open a drawing (or click Load Sample Schematic) first to measure or markup.');
      return;
    }

    const pt = getImgCoords(e);
    const tool = RM.activeTool;
    const curPage = (S && S.n) || 1;
    const curCol = RM.strokeColor || '#e11d48';
    const curOp = RM.opacity != null ? RM.opacity : 1.0;
    const k = (S && S.view && S.view.k) ? S.view.k : 1;

    if (tool === 'eraser') {
      if (window.rpPushCompareHistory) window.rpPushCompareHistory('Erase markup');
      eraseDown = true;
      erasedInStroke = eraseCompareAt(pt.x, pt.y, curPage);
      redrawOverlay();
      if (erasedInStroke && window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar();
      return;
    }

    if (tool === 'pin') {
      if (window.rpPushCompareHistory) window.rpPushCompareHistory('Place pin marker');
      const pinNum = RM.nextPinNum++;
      RM.annotations.push({
        kind: 'pin',
        page: curPage,
        x: pt.x,
        y: pt.y,
        size: RM.pinSize || 24,
        pinNum,
        color: curCol || '#f59e0b',
        opacity: curOp,
        label: `Pin #${pinNum}`
      });
      redrawOverlay();
      if (window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar();
      if (window.rpToast) window.rpToast(`Placed Inspection Pin #${pinNum} (${RM.pinSize || 24}px).`);
      return;
    }

    if (tool === 'tally') {
      if (RM.tally) {
        if (window.rpPushCompareHistory) window.rpPushCompareHistory('Add BOM badge');
        const badge = RM.tally.addItem(pt.x, pt.y, curPage, `BOM Item #${RM.tally.nextNum}`);
        redrawOverlay();
        if (window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar();
        if (window.rpToast) window.rpToast(`Placed Inspection Badge #${badge.number} at (${Math.round(pt.x)}, ${Math.round(pt.y)}).`);
      }
      return;
    }

    if (tool === 'stamp') {
      const reviewer = safeGet('author', 'Lead Engineer') || 'Lead Engineer';
      if (window.rpPushCompareHistory) window.rpPushCompareHistory(`Stamp ${RM.stampType}`);
      RM.annotations.push({
        kind: 'stamp',
        page: curPage,
        x: pt.x - 105,
        y: pt.y - 38,
        stampType: RM.stampType,
        reviewer,
        docHash: RM.docHash
      });
      setActiveTool(null);
      if (window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar();
      if (window.rpToast) window.rpToast(`Stamped [${RM.stampType}] with SHA-256 verification hash.`);
      return;
    }

    if (tool === 'pen' || tool === 'redact') {
      penDown = true;
      RM.points = [{ x: pt.x, y: pt.y }];
      return;
    }

    if (tool === 'poly' || tool === 'area') {
      if (e.detail >= 2 && RM.points.length >= (tool === 'area' ? 3 : 2)) {
        RM._areaDragging = false;
        twoPtDragStart = null;
        finishMultiPointTool();
        return;
      }
      if (tool === 'area' && RM.points.length >= 3 && Math.hypot(pt.x - RM.points[0].x, pt.y - RM.points[0].y) <= 14 / k) {
        RM._areaDragging = false;
        twoPtDragStart = null;
        finishMultiPointTool();
        return;
      }
      if (RM.points.length === 0) {
        twoPtDragStart = { x: pt.x, y: pt.y };
        RM._areaDragging = false;
      } else {
        twoPtDragStart = null;
        RM._areaDragging = false;
        const lastPt = RM.points[RM.points.length - 1];
        if (Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y) < 1.5 / k) {
          redrawOverlay();
          return;
        }
      }
      RM.points.push({ x: pt.x, y: pt.y });
      redrawOverlay();
      return;
    }

    if (RM.points.length === 0) {
      twoPtDragStart = { x: pt.x, y: pt.y };
    } else {
      twoPtDragStart = null;
    }
    RM.points.push({ x: pt.x, y: pt.y });

    if (['calibrate', 'dist', 'leader', 'cloud'].includes(tool) && RM.points.length >= 2) {
      twoPtDragStart = null;
      await completeTwoPointTool(tool);
    } else {
      redrawOverlay();
    }
  }, true);

  window.addEventListener('pointerup', async e => {
    if (eraseDown) {
      eraseDown = false;
      if (!erasedInStroke && window.CompareHistory && window.CompareHistory.undoStack.length) {
        window.CompareHistory.undoStack.pop();
      }
      erasedInStroke = false;
      return;
    }
    if (twoPtDragStart && RM.activeTool && RM.points.length === 1) {
      const startPt = twoPtDragStart;
      twoPtDragStart = null;
      const pt = getImgCoords(e);
      const k = (S && S.view && S.view.k) ? S.view.k : 1;
      const dragDist = Math.hypot(pt.x - startPt.x, pt.y - startPt.y);
      if (dragDist > 8 / k) {
        if (RM.activeTool === 'area' && Math.abs(pt.x - startPt.x) > 4 / k && Math.abs(pt.y - startPt.y) > 4 / k) {
          RM._areaDragging = false;
          RM.points = [
            { x: Math.min(startPt.x, pt.x), y: Math.min(startPt.y, pt.y) },
            { x: Math.max(startPt.x, pt.x), y: Math.min(startPt.y, pt.y) },
            { x: Math.max(startPt.x, pt.x), y: Math.max(startPt.y, pt.y) },
            { x: Math.min(startPt.x, pt.x), y: Math.max(startPt.y, pt.y) }
          ];
          finishMultiPointTool();
          return;
        } else if (['calibrate', 'dist', 'leader', 'cloud'].includes(RM.activeTool)) {
          RM.points.push({ x: pt.x, y: pt.y });
          await completeTwoPointTool(RM.activeTool);
          return;
        }
      }
      RM._areaDragging = false;
    }
    if (!penDown) return;
    penDown = false;
    const curPage = (S && S.n) || 1;
    if (RM.activeTool === 'pen' && RM.points.length >= 1) {
      if (window.rpPushCompareHistory) window.rpPushCompareHistory('Freehand pen markup');
      RM.annotations.push({
        kind: 'pen',
        page: curPage,
        pts: [...RM.points],
        color: RM.strokeColor || '#e11d48',
        lineWidth: RM.strokeWidth || 3,
        opacity: RM.opacity != null ? RM.opacity : 1.0,
        dash: RM.dash || 'solid'
      });
      RM.points = [];
      redrawOverlay();
      if (window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar();
    } else if (RM.activeTool === 'redact' && RM.points.length > 1) {
      if (window.rpPushCompareHistory) window.rpPushCompareHistory('Redaction box');
      RM.annotations.push({ kind: 'redact', page: curPage, pts: [RM.points[0], RM.points[RM.points.length - 1]] });
      RM.points = [];
      redrawOverlay();
      if (window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar();
      if (window.rpToast) window.rpToast('Placed Redaction Box.');
    }
  });

  function finishMultiPointTool() {
    const cal = RM.calibrator;
    const curPage = (S && S.n) || 1;
    const curCol = RM.strokeColor || '#3b82f6';
    const curW = RM.strokeWidth || 2.2;
    const curOp = RM.opacity != null ? RM.opacity : 1.0;
    const curDash = RM.dash || 'solid';
    if (RM.activeTool === 'poly' && RM.points.length >= 2) {
      const lenPx = MeasureEngine.calcPolylineLength(RM.points);
      const lbl = `Σ = ${cal ? cal.formatDistance(lenPx) : lenPx.toFixed(1) + ' px'}`;
      if (window.rpPushCompareHistory) window.rpPushCompareHistory('Polyline measurement');
      RM.annotations.push({ kind: 'poly', page: curPage, pts: [...RM.points], label: lbl, color: curCol, lineWidth: curW, opacity: curOp, dash: curDash });
      RM.points = [];
      redrawOverlay();
      if (window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar();
      if (window.rpToast) window.rpToast(`Completed Polyline Run: ${lbl}`);
    } else if (RM.activeTool === 'area' && RM.points.length >= 3) {
      const areaPx = MeasureEngine.calcPolygonArea(RM.points);
      const perimPx = MeasureEngine.calcPolylineLength([...RM.points, RM.points[0]]);
      const lbl = `${cal ? cal.formatArea(areaPx) : Math.round(areaPx) + ' px²'} (P: ${cal ? cal.formatDistance(perimPx) : Math.round(perimPx) + ' px'})`;
      if (window.rpPushCompareHistory) window.rpPushCompareHistory('Polygon area measurement');
      RM.annotations.push({ kind: 'area', page: curPage, pts: [...RM.points], label: lbl, color: curCol, lineWidth: curW, opacity: curOp, dash: curDash });
      RM.points = [];
      redrawOverlay();
      if (window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar();
      if (window.rpToast) window.rpToast(`Completed Polygon Area: ${lbl}`);
    }
  }

  function findCompareAnnotationAt(x, y, curPage) {
    const k = (S && S.view && S.view.k) ? S.view.k : 1;
    const tol = 10 / k;
    for (let i = RM.annotations.length - 1; i >= 0; i--) {
      const a = RM.annotations[i];
      if (a.page != null && a.page !== curPage) continue;
      if (hitCompareAnnotation(a, x, y, tol)) return { ann: a, idx: i };
    }
    return null;
  }

  async function editCompareAnnotation(a) {
    if (!a || !window.dialog) return;
    if (a.kind === 'pin') {
      const r = await window.dialog(`Edit Inspection Pin #${a.pinNum || 1}`, [
        { id: 'lbl', label: 'Pin Callout Tag / Note', value: a.label || `Pin #${a.pinNum || 1}` },
        { type: 'color', id: 'col', label: 'Pin Colour', value: a.color || '#f59e0b' }
      ], 'Update Pin');
      if (r) {
        if (window.rpPushCompareHistory) window.rpPushCompareHistory('Edit pin marker');
        a.label = r.lbl || '';
        if (r.col) a.color = r.col;
        redrawOverlay();
        if (window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar();
      }
    } else if (a.kind === 'leader') {
      const r = await window.dialog('Edit Leader Callout', [
        { id: 'lbl', label: 'Callout Annotation Text', value: a.label || 'Engineering Note' },
        { type: 'color', id: 'col', label: 'Callout Colour', value: a.color || '#ef4444' }
      ], 'Update Callout');
      if (r && r.lbl != null) {
        if (window.rpPushCompareHistory) window.rpPushCompareHistory('Edit leader callout');
        a.label = r.lbl;
        if (r.col) a.color = r.col;
        redrawOverlay();
        if (window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar();
      }
    } else if (a.kind === 'cloud') {
      const r = await window.dialog('Edit Revision Cloud', [
        { id: 'rev', label: 'Revision Delta Tag', value: a.revText || 'Δ Rev 2' },
        { type: 'color', id: 'col', label: 'Cloud Colour', value: a.color || '#ef4444' }
      ], 'Update Cloud');
      if (r && r.rev != null) {
        if (window.rpPushCompareHistory) window.rpPushCompareHistory('Edit revision cloud');
        a.revText = r.rev;
        if (r.col) a.color = r.col;
        redrawOverlay();
        if (window.rpUpdateMarkupsSidebar) window.rpUpdateMarkupsSidebar();
      }
    }
  }

  RM.hitAt = findCompareAnnotationAt;
  RM.editAnnotation = editCompareAnnotation;
  RM.renderSingleAnnotation = renderSingleAnnotation;

  vp.addEventListener('dblclick', async e => {
    if (RM.activeTool === 'poly' || RM.activeTool === 'area') {
      e.preventDefault();
      finishMultiPointTool();
      return;
    }
    const pt = getImgCoords(e);
    const curPage = (S && S.n) || 1;
    const hitRes = findCompareAnnotationAt(pt.x, pt.y, curPage);
    if (hitRes && ['pin', 'leader', 'cloud'].includes(hitRes.ann.kind)) {
      e.preventDefault();
      await editCompareAnnotation(hitRes.ann);
    }
  });

  addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
    if (e.key === 'Escape') {
      document.querySelectorAll('.rp-modal').forEach(m => { m.hidden = true; if (m.parentNode && !m.id) m.remove(); });
      if (RM.activeTool) {
        setActiveTool(null);
        if (window.rpToast) window.rpToast('Exited active tool.');
      }
    } else if (e.key === 'Enter' && (RM.activeTool === 'poly' || RM.activeTool === 'area')) {
      e.preventDefault();
      finishMultiPointTool();
    } else if ((e.key === 'l' || e.key === 'L') && !e.ctrlKey && !e.metaKey && document.body.dataset.view === 'compare') {
      $('#rib-loupe-toggle') && $('#rib-loupe-toggle').click();
    } else if ((e.key === 'g' || e.key === 'G') && !e.ctrlKey && !e.metaKey && document.body.dataset.view === 'compare') {
      $('#rib-grid-toggle') && $('#rib-grid-toggle').click();
    } else if ((e.key === 'x' || e.key === 'X') && !e.ctrlKey && !e.metaKey && document.body.dataset.view === 'compare') {
      $('#rib-crosshair-toggle') && $('#rib-crosshair-toggle').click();
    }
  });

  const listEl = $('#list');
  if (listEl) {
    new MutationObserver(() => {
      if (window.UIRibbon && window.UIRibbon.DefectState && S.cur && S.cur.regions) {
        window.UIRibbon.DefectState.initFromRegions(S.cur.regions);
        rebuildOSNAPFeatures();
      }
    }).observe(listEl, { childList: true });
  }

  function initRedlineProUI() {
    if (window.UIRibbon && window.UIRibbon.init) {
      window.UIRibbon.init();
    }

    const wire = (id, fn) => { const e = $(id); if (e) e.onclick = fn; };

    wire('#rp-cancel-tool-btn', () => {
      if (S && S.ignMode && $('#ignBtn')) $('#ignBtn').click();
      setActiveTool(null);
    });
    wire('#rp-finish-tool-btn', () => finishMultiPointTool());

    wire('#rib-calibrate', () => {
      setActiveTool(RM.activeTool === 'calibrate' ? null : 'calibrate', 'Calibrate Scale (Click 2 points)');
    });
    wire('#rib-dist', () => {
      setActiveTool(RM.activeTool === 'dist' ? null : 'dist', 'Distance (Click 2 points)');
    });
    wire('#rib-poly', () => {
      setActiveTool(RM.activeTool === 'poly' ? null : 'poly', 'Cumulative Polyline (Double-click to finish)');
    });
    wire('#rib-area', () => {
      setActiveTool(RM.activeTool === 'area' ? null : 'area', 'Polygon Area (Double-click to close)');
    });
    wire('#rib-tally', () => {
      setActiveTool(RM.activeTool === 'tally' ? null : 'tally', 'Tally / BOM Counter (Click to place badge)');
    });

    wire('#rib-osnap-toggle', () => {
      RM.osnapEnabled = !RM.osnapEnabled;
      const b = $('#rib-osnap-toggle');
      if (b) {
        b.classList.toggle('on', RM.osnapEnabled);
        const sp = b.querySelector('span'); if (sp) sp.textContent = `OSNAP: ${RM.osnapEnabled ? 'ON' : 'OFF'}`;
      }
      redrawOverlay();
      if (window.rpToast) window.rpToast(`Magnetic Object Snap (OSNAP) ${RM.osnapEnabled ? 'ENABLED' : 'DISABLED'}.`);
    });

    const ensureHudCursorPosition = () => {
      if (RM.cursorScreen.x < 0 || RM.cursorScreen.y < 0) {
        const cx = Math.round((vp.clientWidth || 600) / 2);
        const cy = Math.round((vp.clientHeight || 400) / 2);
        RM.cursorScreen = { x: cx, y: cy };
        const k = (S && S.view && S.view.k) ? S.view.k : 1;
        const vx = (S && S.view) ? S.view.x : 0;
        const vy = (S && S.view) ? S.view.y : 0;
        RM.cursorImg = { x: (cx - vx) / k, y: (cy - vy) / k };
      }
    };

    wire('#rib-loupe-toggle', () => {
      RM.loupeEnabled = !RM.loupeEnabled;
      if (RM.loupeEnabled) ensureHudCursorPosition();
      const b = $('#rib-loupe-toggle');
      if (b) b.classList.toggle('on', RM.loupeEnabled);
      if ($('#cHudLoupe')) $('#cHudLoupe').classList.toggle('on', RM.loupeEnabled);
      renderViewportHUD();
      if (window.rpToast) window.rpToast(`4x Magnifier Loupe ${RM.loupeEnabled ? 'ON (Move cursor over drawing)' : 'OFF'}.`);
    });

    wire('#rib-grid-toggle', () => {
      RM.gridEnabled = !RM.gridEnabled;
      const b = $('#rib-grid-toggle');
      if (b) b.classList.toggle('on', RM.gridEnabled);
      redrawOverlay();
      if (window.rpToast) window.rpToast(`Engineering Reference Grid ${RM.gridEnabled ? 'ON' : 'OFF'}.`);
    });

    wire('#rib-crosshair-toggle', () => {
      RM.crosshairEnabled = !RM.crosshairEnabled;
      if (RM.crosshairEnabled) ensureHudCursorPosition();
      const b = $('#rib-crosshair-toggle');
      if (b) b.classList.toggle('on', RM.crosshairEnabled);
      if ($('#cHudCross')) $('#cHudCross').classList.toggle('on', RM.crosshairEnabled);
      renderViewportHUD();
      if (window.rpToast) window.rpToast(`Precision Crosshair ${RM.crosshairEnabled ? 'ON' : 'OFF'}.`);
    });

    wire('#rib-rev-cloud', () => {
      setActiveTool(RM.activeTool === 'cloud' ? null : 'cloud', 'Revision Cloud (Click 2 corners)');
    });
    wire('#rib-leader', () => {
      setActiveTool(RM.activeTool === 'leader' ? null : 'leader', 'Leader Callout (Click arrow target then text box)');
    });
    wire('#rib-pen', () => {
      setActiveTool(RM.activeTool === 'pen' ? null : 'pen', `Freehand Redline Pen (${RM.strokeWidth || 3}px — Drag to draw)`);
    });
    wire('#rib-pin', () => {
      setActiveTool(RM.activeTool === 'pin' ? null : 'pin', `Pin Marker (${RM.pinSize || 24}px — Click to place badge)`);
    });
    wire('#rib-eraser', () => {
      setActiveTool(RM.activeTool === 'eraser' ? null : 'eraser', `Eraser (${RM.eraserRadius || 20}px — Click or drag over markup)`);
    });
    wire('#rib-redact', () => {
      setActiveTool(RM.activeTool === 'redact' ? null : 'redact', 'Redact Box (Drag to black out)');
    });

    // Wire Compare Tool Options controls (#rib-mk-*)
    if ($('#rib-mk-size')) {
      $('#rib-mk-size').oninput = e => { if (+e.target.value > 0) setCompareToolSize(+e.target.value); };
    }
    document.querySelectorAll('#rib-mk-pen-presets .rp-cmp-sz').forEach(btn => {
      btn.onclick = () => setCompareToolSize(+btn.dataset.sz);
    });
    document.querySelectorAll('#rib-mk-eraser-presets .rp-cmp-er').forEach(btn => {
      btn.onclick = () => setCompareToolSize(+btn.dataset.er);
    });
    document.querySelectorAll('#rib-mk-pin-presets .rp-cmp-pin').forEach(btn => {
      btn.onclick = () => setCompareToolSize(+btn.dataset.psz);
    });
    if ($('#rib-mk-eraser-mode')) {
      $('#rib-mk-eraser-mode').onchange = e => {
        RM.eraserMode = e.target.value;
        if (window.rpToast) window.rpToast(`Compare Eraser Mode: ${RM.eraserMode === 'brush' ? 'Brush Radius' : 'Whole Markup'}`);
      };
    }
    const setCmpColor = col => {
      RM.strokeColor = col;
      const t = RM.activeTool || 'pen';
      RM.toolSettings[t] = RM.toolSettings[t] || {};
      RM.toolSettings[t].color = col;
      if ($('#rib-mk-color')) $('#rib-mk-color').value = col;
      const low = String(col || '').toLowerCase();
      document.querySelectorAll('#rib-mk-swatches .rp-swatch').forEach(b => b.classList.toggle('on', (b.dataset.col || '').toLowerCase() === low));
      redrawOverlay();
    };
    if ($('#rib-mk-color')) {
      $('#rib-mk-color').oninput = e => setCmpColor(e.target.value);
    }
    document.querySelectorAll('#rib-mk-swatches .rp-swatch').forEach(btn => {
      btn.onclick = () => setCmpColor(btn.dataset.col || '#e11d48');
    });
    if ($('#rib-mk-op')) {
      $('#rib-mk-op').oninput = e => {
        const pct = Math.max(10, Math.min(100, +e.target.value || 100));
        RM.opacity = pct / 100;
        const t = RM.activeTool || 'pen';
        RM.toolSettings[t] = RM.toolSettings[t] || {};
        RM.toolSettings[t].opacity = pct;
        redrawOverlay();
      };
    }
    if ($('#rib-mk-dash')) {
      $('#rib-mk-dash').onchange = e => {
        RM.dash = e.target.value;
        const t = RM.activeTool || 'pen';
        RM.toolSettings[t] = RM.toolSettings[t] || {};
        RM.toolSettings[t].dash = RM.dash;
        redrawOverlay();
      };
    }
    if ($('#rib-mk-revtxt')) {
      $('#rib-mk-revtxt').oninput = e => {
        RM.cloudRevText = e.target.value || 'Δ Rev 2';
      };
    }
    updateCompareToolOptionsUI('pen');

    const activateStamp = async (type, btnId) => {
      RM.stampType = type;
      if (typeof MeasureEngine !== 'undefined' && S && S.cur && S.cur.A) {
        RM.docHash = await MeasureEngine.computeDocumentSHA256(S.cur.A.data.buffer);
      }
      setActiveTool('stamp', `${type} Stamp (Click sheet to place)`, btnId);
    };

    wire('#rib-stamp-app', () => activateStamp('APPROVED', 'rib-stamp-app'));
    wire('#rib-stamp-rej', () => activateStamp('REJECTED', 'rib-stamp-rej'));
    wire('#rib-stamp-rev', () => activateStamp('REVISED & RESUBMIT', 'rib-stamp-rev'));
    wire('#rib-stamp-sha', () => activateStamp('FOR REVIEW ONLY', 'rib-stamp-sha'));

    wire('#rp-sample-schematic-btn', () => window.loadSampleSchematic && window.loadSampleSchematic());
    wire('#rp-sample-gerber-btn', () => window.loadSampleGerber && window.loadSampleGerber());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRedlineProUI);
  } else {
    setTimeout(initRedlineProUI, 60);
  }

  safeRemove('termsOk');
})();
