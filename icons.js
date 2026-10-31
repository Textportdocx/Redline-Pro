/**
 * Redline Pro — Enterprise Dual-Tone Vector Iconography Suite
 * Precision-crafted 24x24 CAD, CAM & PDF Studio icons with subtle depth fills
 * and crisp geometric vector strokes.
 * Redline Studio · textportdocx.in
 */
const IC = {
  // ===== 1. Core File, Folder & Session Operations =====
  open: '<path d="M3 8a2 2 0 0 1 2-2h4.2l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" fill="currentColor" fill-opacity="0.15"/><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><path d="M3 10h18" stroke-opacity="0.5"/>',
  openA: '<path d="M3 7a2 2 0 0 1 2-2h3.8l1.8 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" fill="currentColor" fill-opacity="0.15"/><path d="M9.2 17l2.8-6.8L14.8 17"/><path d="M10.1 14.8h3.8"/>',
  openB: '<path d="M3 7a2 2 0 0 1 2-2h3.8l1.8 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" fill="currentColor" fill-opacity="0.15"/><path d="M9.8 10.2h2.7a1.6 1.6 0 0 1 0 3.2H9.8h3a1.6 1.6 0 0 1 0 3.2H9.8v-6.4z"/>',
  save: '<path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="currentColor" fill-opacity="0.14"/><path d="M8 3v5h7V3"/><rect x="7.5" y="13" width="9" height="8" rx="1"/><path d="M13 5v1.5"/>',
  saveas: '<path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="currentColor" fill-opacity="0.14"/><path d="M8 3v5h7V3"/><circle cx="12" cy="14.5" r="3.5" fill="currentColor" fill-opacity="0.2"/><path d="M12 12.5v4M10 14.5h4"/>',
  undo: '<path d="M8.5 14L4 9.5 8.5 5"/><path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-4"/>',
  redo: '<path d="M15.5 14L20 9.5 15.5 5"/><path d="M19.5 9.5H10a5.5 5.5 0 0 0 0 11h4"/>',

  // ===== 2. PDF Editor Markup, Vector Draw & Redaction Tools =====
  select: '<path d="M5.5 3.5l13 7.5-5.8 1.9-2.2 6.1-5-15.5z" fill="currentColor" fill-opacity="0.18"/><path d="M5.5 3.5l13 7.5-5.8 1.9-2.2 6.1-5-15.5z"/><path d="M12.5 13l4.5 4.5"/>',
  hand: '<path d="M18 11V7.5a1.5 1.5 0 0 0-3 0V11m0-4.5v-2a1.5 1.5 0 0 0-3 0V11m0-4.5a1.5 1.5 0 0 0-3 0V12m0-3.5a1.5 1.5 0 0 0-3 0v7a6 6 0 0 0 6 6h2a5 5 0 0 0 5-5v-5.5a1.5 1.5 0 0 0-3 0" fill="currentColor" fill-opacity="0.14"/>',
  text: '<rect x="3" y="3" width="18" height="18" rx="2.5" fill="currentColor" fill-opacity="0.12" stroke-opacity="0.4"/><path d="M6.5 7.5V6h11v1.5M12 6v12M9.5 18h5"/>',
  bold: '<path d="M7 5h6.5a3.5 3.5 0 0 1 0 7H7V5z" fill="currentColor" fill-opacity="0.15"/><path d="M7 12h7.5a3.5 3.5 0 0 1 0 7H7v-7z"/>',
  italic: '<path d="M10 5h6M8 19h6M13.5 5l-3 14"/>',
  box: '<rect x="4" y="5" width="16" height="14" rx="1.5" fill="currentColor" fill-opacity="0.16"/><rect x="3" y="4" width="2.5" height="2.5" rx="0.5"/><rect x="18.5" y="4" width="2.5" height="2.5" rx="0.5"/><rect x="3" y="17.5" width="2.5" height="2.5" rx="0.5"/><rect x="18.5" y="17.5" width="2.5" height="2.5" rx="0.5"/>',
  line: '<path d="M5.5 18.5L18.5 5.5"/><circle cx="5" cy="19" r="2.2" fill="currentColor" fill-opacity="0.25"/><circle cx="19" cy="5" r="2.2" fill="currentColor" fill-opacity="0.25"/>',
  arrow: '<path d="M5 19L19 5"/><path d="M10 5h9v9"/><circle cx="5" cy="19" r="2" fill="currentColor" fill-opacity="0.25"/>',
  pen: '<path d="M12 20h9"/><path d="M16.2 3.8a2.2 2.2 0 0 1 3.1 3.1L7.5 18.8 3.5 20l1.2-4L16.2 3.8z" fill="currentColor" fill-opacity="0.16"/><path d="M14 6l3 3"/>',
  whiteout: '<path d="M7 20h13"/><path d="M4.5 13.5l8.5-8.5 5.5 5.5-8.5 8.5H6l-1.5-1.5v-4z" fill="currentColor" fill-opacity="0.15"/><path d="M9.5 8.5l5.5 5.5"/>',
  redact: '<rect x="3" y="5" width="18" height="14" rx="1.5" fill="currentColor" fill-opacity="0.22"/><path d="M3 9.5h18M3 14.5h18M8 5v14M16 5v14"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2" fill="currentColor" fill-opacity="0.12"/><circle cx="8.5" cy="9" r="2" fill="currentColor" fill-opacity="0.3"/><path d="M21 15.5l-4.8-4.8a1.2 1.2 0 0 0-1.7 0L6 19.5"/>',
  sign: '<path d="M3 16.5c2.5-5.5 4.5-8 5.6-5.2s-1.8 6.4 1.1 5.4 2.8-4.5 4.6-3.6 1.2 3.5 5.7 1.8"/><path d="M3 20.5h18" stroke-dasharray="2 2"/>',
  stamp: '<path d="M8.5 3.5h7v5.5l3 4.2H5.5l3-4.2V3.5z" fill="currentColor" fill-opacity="0.16"/><rect x="4" y="16.5" width="16" height="3.5" rx="1"/>',

  // ===== 3. PDF Review Comments & Text Annotations =====
  note: '<path d="M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V5a1 1 0 0 1 1-1z" fill="currentColor" fill-opacity="0.16"/><path d="M8 8.5h8M8 12h5.5"/>',
  highlight: '<path d="M4 20h6.5"/><path d="M13.8 4.2l5.5 5.5-7.8 7.8-5.5-5.5 7.8-7.8z" fill="currentColor" fill-opacity="0.2"/><path d="M6 12l-2 6 6-2"/>',
  underline: '<path d="M7 4v6.5a5 5 0 0 0 10 0V4"/><path d="M5 19.5h14" stroke-width="2.2"/>',
  strike: '<path d="M4 12h16" stroke-width="2.1"/><path d="M15.5 7c-.9-1.8-2.6-2.8-4.5-2.8-2.8 0-4 1.8-4 3.3 0 1.4 1.2 2.4 5 4.2"/><path d="M8.5 16.8c.9 1.8 2.6 2.8 4.5 2.8 2.8 0 4-1.8 4-3.3"/>',
  edittext: '<rect x="3" y="4" width="12" height="13" rx="1.5" fill="currentColor" fill-opacity="0.1" stroke-opacity="0.45"/><path d="M6 7.5h6M9 7.5v6"/><path d="M14 20.5l6.2-6.2 2.1 2.1-6.2 6.2-2.8.7.7-2.8z" fill="currentColor" fill-opacity="0.2"/>',

  // ===== 4. Page & Document Engineering Operations =====
  rotR: '<path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.2L21 8.5"/><path d="M21 3.5v5h-5"/><rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" fill-opacity="0.18"/>',
  rotL: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.2L3 8.5"/><path d="M3 3.5v5h5"/><rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" fill-opacity="0.18"/>',
  rot180: '<path d="M4.5 11A7.8 7.8 0 0 1 18 6.8l2 2M19.5 13A7.8 7.8 0 0 1 6 17.2l-2-2"/><path d="M20 4.5v4.3h-4.3M4 19.5v-4.3h4.3"/>',
  trash: '<path d="M6.5 7l.8 13a1 1 0 0 0 1 .9h7.4a1 1 0 0 0 1-.9L17.5 7" fill="currentColor" fill-opacity="0.14"/><path d="M4 7h16M9.5 7V4.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7M10 11v6M14 11v6"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="1.5" fill="currentColor" fill-opacity="0.16"/><path d="M5.5 15H4.8A1.3 1.3 0 0 1 3.5 13.7V4.8A1.3 1.3 0 0 1 4.8 3.5h8.9A1.3 1.3 0 0 1 15 4.8v.7"/>',
  blank: '<path d="M6 3h8l4.5 4.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="currentColor" fill-opacity="0.12"/><path d="M13.5 3v5H18.5M12 11.5v6M9 14.5h6"/>',
  extract: '<path d="M6 3h8l4.5 4.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="currentColor" fill-opacity="0.12"/><path d="M13.5 3v5H18.5M12 17v-6.5M9.2 13.3L12 10.5l2.8 2.8"/>',
  merge: '<path d="M6 4v5.5a4.5 4.5 0 0 0 4.5 4.5h3A4.5 4.5 0 0 0 18 9.5V4"/><path d="M12 14v6.5M9 17.5l3 3 3-3"/><circle cx="6" cy="4" r="1.5" fill="currentColor"/><circle cx="18" cy="4" r="1.5" fill="currentColor"/>',
  split: '<path d="M12 3.5v6.5M12 10L6 19.5M12 10l6 9.5"/><path d="M6 16v3.5h3.5M18 16v3.5h-3.5"/>',
  images: '<rect x="3" y="3.5" width="13.5" height="13.5" rx="1.5" fill="currentColor" fill-opacity="0.15"/><path d="M7.5 20.5H19a1.5 1.5 0 0 0 1.5-1.5V7.5"/><circle cx="7.5" cy="8" r="1.5" fill="currentColor"/><path d="M16.5 13l-3.5-3.5L5.5 17"/>',
  png: '<rect x="3" y="4" width="18" height="16" rx="2" fill="currentColor" fill-opacity="0.14"/><circle cx="8.5" cy="9.2" r="1.8" fill="currentColor"/><path d="M21 15.5l-4.5-4.5L7.5 19.5"/>',
  watermark: '<path d="M12 3.2c4.2 5 6.2 8 6.2 11.2a6.2 6.2 0 0 1-12.4 0c0-3.2 2-6.2 6.2-11.2z" fill="currentColor" fill-opacity="0.16"/><path d="M9.5 15.5a3 3 0 0 0 4.5.5"/>',
  hash: '<rect x="3.5" y="4" width="17" height="16" rx="2" fill="currentColor" fill-opacity="0.1" stroke-opacity="0.35"/><path d="M6.5 9.5h11M6.5 14.5h11M10.2 6L8.8 18M15.2 6l-1.4 12"/>',
  textdoc: '<path d="M6 3h8l4.5 4.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="currentColor" fill-opacity="0.12"/><path d="M13.5 3v5H18.5M8.5 11.5h7M8.5 15h7M8.5 8h3"/>',
  info: '<circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity="0.14"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r="0.8" fill="currentColor"/>',
  zap: '<path d="M13.2 2.5L4.5 13.5h6.8l-1 8 8.7-11h-6.8l1-8z" fill="currentColor" fill-opacity="0.18"/>',
  send: '<path d="M3.5 11.5L20.5 4l-6.5 16.5-3.2-6.8-7.3-2.2z" fill="currentColor" fill-opacity="0.16"/><path d="M10.8 13.7L20.5 4"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8" fill="currentColor" fill-opacity="0.14"/><path d="M19.8 19.8l-4.2-4.2"/>',
  ruler: '<path d="M3.5 16.2L16.2 3.5l4.3 4.3L7.8 20.5 3.5 16.2z" fill="currentColor" fill-opacity="0.15"/><path d="M7.2 12.5l2 2M10.2 9.5l2 2M13.2 6.5l2 2"/>',
  crop: '<rect x="6.5" y="6.5" width="11" height="11" fill="currentColor" fill-opacity="0.14" stroke-opacity="0.3"/><path d="M6.5 2.5v15h15M2.5 6.5h15v15"/>',
  reverse: '<path d="M7.5 4v16M4 16.5L7.5 20l3.5-3.5M16.5 20V4M13 7.5L16.5 4 20 7.5"/>',
  flatten: '<path d="M3 8.5L12 4l9 4.5L12 13 3 8.5z" fill="currentColor" fill-opacity="0.18"/><path d="M3 13l9 4.5 9-4.5M3 17l9 4.5 9-4.5"/>',
  print: '<path d="M7 8.5V3.5h10v5" fill="currentColor" fill-opacity="0.1"/><path d="M6.5 16.5H4a1 1 0 0 1-1-1v-5.5a1.5 1.5 0 0 1 1.5-1.5h15A1.5 1.5 0 0 1 21 10v5.5a1 1 0 0 1-1 1h-2.5"/><rect x="7" y="13.5" width="10" height="7" rx="0.8" fill="currentColor" fill-opacity="0.16"/>',

  // ===== 5. Navigation, Zoom, Theme & Workspace Controls =====
  zoomin: '<circle cx="10.8" cy="10.8" r="6.8" fill="currentColor" fill-opacity="0.14"/><path d="M19.8 19.8l-4.2-4.2M8 10.8h5.6M10.8 8v5.6"/>',
  zoomout: '<circle cx="10.8" cy="10.8" r="6.8" fill="currentColor" fill-opacity="0.14"/><path d="M19.8 19.8l-4.2-4.2M8 10.8h5.6"/>',
  fit: '<rect x="6.5" y="6.5" width="11" height="11" rx="1" fill="currentColor" fill-opacity="0.12" stroke-opacity="0.35"/><path d="M3.5 8.5V3.5h5M20.5 8.5V3.5h-5M3.5 15.5v5h5M20.5 15.5v5h-5"/>',
  prev: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  next: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
  pageFirst: '<path d="M16.5 5.5L10 12l6.5 6.5M7 5.5v13"/>',
  pageLast: '<path d="M7.5 5.5L14 12l-6.5 6.5M17 5.5v13"/>',
  moon: '<path d="M19.8 14.2A8 8 0 1 1 9.8 4.2a6.2 6.2 0 0 0 10 10z" fill="currentColor" fill-opacity="0.16"/>',
  sun: '<circle cx="12" cy="12" r="4.2" fill="currentColor" fill-opacity="0.2"/><path d="M12 2.2v2.3M12 19.5v2.3M2.2 12h2.3M19.5 12h2.3M5 5l1.6 1.6M17.4 17.4L19 19M5 19l1.6-1.6M17.4 6.6L19 5"/>',
  swap: '<path d="M4 8.5h15l-3.8-3.8M20 15.5H5l3.8 3.8"/>',
  align: '<circle cx="12" cy="12" r="3.5" fill="currentColor" fill-opacity="0.22"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  ignore: '<rect x="4" y="4" width="16" height="16" rx="1.5" fill="currentColor" fill-opacity="0.12" stroke-dasharray="3 2.5"/><path d="M4.5 19.5l15-15"/>',
  csv: '<rect x="3" y="4" width="18" height="16" rx="1.5" fill="currentColor" fill-opacity="0.12"/><path d="M3 9.5h18M3 14.8h18M9 4v16"/>',
  check: '<circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity="0.14" stroke-opacity="0.4"/><path d="M7.5 12.2l3.2 3.2 6.2-6.4"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  selectall: '<rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" fill-opacity="0.14"/><path d="M8 12.2l2.8 2.8 5.4-5.6"/>',
  gear: '<circle cx="12" cy="12" r="3.2" fill="currentColor" fill-opacity="0.2"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M5.2 18.8l1.9-1.9M16.9 7.1l1.9-1.9"/>',
  help: '<circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity="0.14"/><path d="M9.5 9.2a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.1.9-1.1 1.8"/><circle cx="12" cy="16.8" r="0.8" fill="currentColor"/>',
  report: '<path d="M6 3h8l4.5 4.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="currentColor" fill-opacity="0.14"/><path d="M13.5 3v5H18.5M8.5 17v-3.5M12 17v-6.5M15.5 17v-4.5"/>',

  // ===== 6. Ribbon Category Tab Icons =====
  tabCompare: '<rect x="3" y="3.5" width="11" height="14" rx="1.5" fill="currentColor" fill-opacity="0.16"/><path d="M10 6.5h9.5a1.5 1.5 0 0 1 1.5 1.5v11.5a1.5 1.5 0 0 1-1.5 1.5H10"/><path d="M12.8 16l2.7-4.8L18.2 16h-5.4z"/>',
  tabView: '<circle cx="12" cy="12" r="8.5" fill="currentColor" fill-opacity="0.14"/><path d="M12 3.5v17"/><path d="M12 7l5.5 2M12 12l6.5 2M12 16.5l4.5 1.5"/>',
  tabMarkup: '<path d="M5 15.2a3.2 3.2 0 0 1 3-5.2 4.2 4.2 0 0 1 7.4-1 3.2 3.2 0 0 1 3.1 6.2H5z" fill="currentColor" fill-opacity="0.18"/><path d="M12 15.2l-2.2 4.3h4.4L12 15.2z"/>',
  tabMeasure: '<path d="M3 18h18M3 14v7M21 14v7M7.5 18v-3M12 18v-4.5M16.5 18v-3"/><rect x="9.2" y="3.5" width="5.6" height="5.6" rx="1" fill="currentColor" fill-opacity="0.2"/>',
  tabCad: '<path d="M12 2.2l8.5 4.8v9.6L12 21.4l-8.5-4.8V7L12 2.2z" fill="currentColor" fill-opacity="0.15"/><path d="M12 11.8l8.5-4.8M12 11.8v9.6M12 11.8L3.5 7"/>',
  tabExport: '<path d="M6 3h8l4.5 4.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="currentColor" fill-opacity="0.14"/><path d="M12 10.5v7.5M9 13.5l3-3 3 3"/>',

  // ===== 7. Alignment, Diff & Layer Controls =====
  fiducial: '<circle cx="6" cy="6" r="2.5" fill="currentColor" fill-opacity="0.22"/><circle cx="18" cy="6" r="2.5" fill="currentColor" fill-opacity="0.22"/><circle cx="12" cy="18" r="2.5" fill="currentColor" fill-opacity="0.22"/><path d="M8.5 6h7M7.2 8.2l3.8 7.5M16.8 8.2l-3.8 7.5" stroke-dasharray="2 2"/>',
  textDiff: '<rect x="3" y="4" width="8" height="16" rx="1.2" fill="currentColor" fill-opacity="0.12"/><path d="M5 7.5h4M5 11h4M5 14.5h2.5M14 6.5h6M14 10.5h6M14 14.5h4"/><path d="M15.5 18.5h4.5M17.8 16.2v4.6"/>',
  layers: '<path d="M12 3L21 7.5 12 12 3 7.5 12 3z" fill="currentColor" fill-opacity="0.2"/><path d="M3 12l9 4.5 9-4.5"/><path d="M3 16.5L12 21l9-4.5"/>',
  eye: '<path d="M2 12s3.6-6.2 10-6.2S22 12 22 12s-3.6 6.2-10 6.2S2 12 2 12z" fill="currentColor" fill-opacity="0.14"/><circle cx="12" cy="12" r="3" fill="currentColor" fill-opacity="0.3"/>',
  pin: '<path d="M9 3.5h6l-.8 5.8 3.3 3.2v2H6.5v-2l3.3-3.2L9 3.5z" fill="currentColor" fill-opacity="0.16"/><path d="M12 14.5v6.5"/>',
  minimize: '<path d="M5 12h14"/>',
  reset: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.2L3 8.5"/><path d="M3 3.5v5h5"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/>',
  nudgeL: '<path d="M14.5 7l-5 5 5 5"/>',
  nudgeR: '<path d="M9.5 7l5 5-5 5"/>',
  nudgeU: '<path d="M7 14.5l5-5 5 5"/>',
  nudgeD: '<path d="M7 9.5l5 5 5-5"/>',

  // ===== 8. Optics, Contrast & Curtain Icons =====
  enhNorm: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5" fill="currentColor" fill-opacity="0.12"/><circle cx="12" cy="12" r="4.2"/>',
  enhBoost: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" fill-opacity="0.65"/>',
  enhDark: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5" fill="currentColor" fill-opacity="0.22"/><path d="M7 17L17 7M7 12h10M12 7v10"/>',
  blueprint: '<rect x="3" y="4" width="18" height="16" rx="2" fill="currentColor" fill-opacity="0.22"/><circle cx="12" cy="12" r="4.5"/><path d="M6 8h3M6 16h3M15 8h3M15 16h3"/>',
  curtain: '<rect x="3" y="4" width="9" height="16" rx="1" fill="currentColor" fill-opacity="0.2"/><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 2v20"/><path d="M8.5 10l-2 2 2 2M15.5 10l2 2-2 2"/>',
  loupe: '<circle cx="10.5" cy="10.5" r="6.8" fill="currentColor" fill-opacity="0.15"/><path d="M15.5 15.5L21 21"/><path d="M10.5 7.2v6.6M7.2 10.5h6.6"/>',
  grid: '<rect x="3.5" y="3.5" width="17" height="17" rx="1.5" fill="currentColor" fill-opacity="0.1"/><path d="M3.5 9h17M3.5 15h17M9 3.5v17M15 3.5v17"/>',
  crosshair: '<circle cx="12" cy="12" r="6.2" fill="currentColor" fill-opacity="0.12"/><path d="M12 2v20M2 12h20"/>',

  // ===== 9. Engineering Markups & Cryptographic Sign-Off Stamps =====
  revCloud: '<path d="M6 16a3 3 0 0 1-.5-5.9A4.2 4.2 0 0 1 13.2 8a3.5 3.5 0 0 1 5.8 2.5 3 3 0 0 1-.5 5.5H6z" fill="currentColor" fill-opacity="0.16"/><path d="M9.8 19.5l2.2-3.8 2.2 3.8H9.8z"/>',
  leader: '<path d="M4 19l5.8-5.8H20"/><path d="M4 19v-5.2M4 19h5.2"/><rect x="11.5" y="4.5" width="8.5" height="5.5" rx="1" fill="currentColor" fill-opacity="0.18"/>',
  stampApp: '<rect x="3" y="5" width="18" height="14" rx="2" fill="currentColor" fill-opacity="0.14"/><path d="M7.8 12.2l2.8 2.8 5.8-6"/>',
  stampRej: '<rect x="3" y="5" width="18" height="14" rx="2" fill="currentColor" fill-opacity="0.14"/><path d="M9 9l6 6M15 9l-6 6"/>',
  stampRev: '<rect x="3" y="5" width="18" height="14" rx="2" fill="currentColor" fill-opacity="0.14"/><path d="M12 8.2l3.8 6.8H8.2L12 8.2z"/>',
  stampSha: '<path d="M12 2.8l7.2 3.2v5.2c0 5.2-3.1 8.8-7.2 10.3-4.1-1.5-7.2-5.1-7.2-10.3V6L12 2.8z" fill="currentColor" fill-opacity="0.16"/><path d="M9.2 12.2l2.1 2.1 3.8-3.8"/>',

  // ===== 10. Precision Measurement & OSNAP Icons =====
  calibrate: '<path d="M3.5 17.5h17M3.5 13.5v7M20.5 13.5v7"/><path d="M7.8 9.5L4.8 12l3 2.5M16.2 9.5l3 2.5-3 2.5M5 12h14"/>',
  dist: '<path d="M4.5 18.5l14-14"/><circle cx="4.5" cy="18.5" r="2.4" fill="currentColor" fill-opacity="0.25"/><circle cx="18.5" cy="4.5" r="2.4" fill="currentColor" fill-opacity="0.25"/><path d="M11.5 15.5h6.5M14.8 12.2v6.6"/>',
  polyline: '<path d="M4 18.5l5-10.5 6 6.2 5-9.2"/><circle cx="4" cy="18.5" r="2.1" fill="currentColor"/><circle cx="9" cy="8" r="2.1" fill="currentColor"/><circle cx="15" cy="14.2" r="2.1" fill="currentColor"/><circle cx="20" cy="5" r="2.1" fill="currentColor"/>',
  area: '<path d="M5 6l13-2 2 13-14 3L5 6z" fill="currentColor" fill-opacity="0.18"/><circle cx="5" cy="6" r="1.9" fill="currentColor"/><circle cx="18" cy="4" r="1.9" fill="currentColor"/><circle cx="20" cy="17" r="1.9" fill="currentColor"/><circle cx="6" cy="20" r="1.9" fill="currentColor"/>',
  osnap: '<rect x="7.5" y="7.5" width="9" height="9" rx="1.2" fill="currentColor" fill-opacity="0.2"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  tally: '<circle cx="12" cy="12" r="8.5" fill="currentColor" fill-opacity="0.16"/><path d="M10.2 9.5L12 8v8M9.5 16h5"/>',
  bomTable: '<rect x="3" y="4" width="18" height="16" rx="1.8" fill="currentColor" fill-opacity="0.12"/><path d="M3 9h18M3 14.2h18M8.2 4v16M15.2 4v16"/>',

  // ===== 11. CAD (DXF) & Industrial PCB CAM (CAM350 / IPC) Icons =====
  dxfIn: '<path d="M12 2.8l8.2 4.6v9.2L12 21.2l-8.2-4.6V7.4L12 2.8z" fill="currentColor" fill-opacity="0.14"/><path d="M12 8v7.2M9 12.2l3 3 3-3"/>',
  dxfOut: '<path d="M12 2.8l8.2 4.6v9.2L12 21.2l-8.2-4.6V7.4L12 2.8z" fill="currentColor" fill-opacity="0.14"/><path d="M12 15.2V8M9 11l3-3 3 3"/>',
  pcbCam: '<rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" fill-opacity="0.15"/><circle cx="9" cy="9" r="1.6" fill="currentColor"/><circle cx="15" cy="15" r="1.6" fill="currentColor"/><path d="M10.2 10.2l3.6 3.6M9 15h2.2l1.8-1.8M15 9h-2.2L11 10.8"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  pcbDual: '<rect x="3" y="4" width="11" height="11" rx="1.5" fill="currentColor" fill-opacity="0.16"/><rect x="10" y="9" width="11" height="11" rx="1.5" fill="currentColor" fill-opacity="0.16"/><circle cx="7" cy="8" r="1.4" fill="currentColor"/><circle cx="16" cy="15" r="1.4" fill="currentColor"/><path d="M8.2 8.8l6.6 5.2"/>',
  clearance: '<path d="M4 4.5v15M20 4.5v15"/><path d="M7.8 12h8.4M10.2 9.5L7.5 12l2.7 2.5M13.8 9.5l2.7 2.5-2.7 2.5"/><path d="M12 2.8l2.2 3.8H9.8L12 2.8z" fill="currentColor"/>',

  // ===== 12. Audit PDF & Session Persistence Icons =====
  auditPdf: '<path d="M6 2.5h8.5L19 7v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1z" fill="currentColor" fill-opacity="0.14"/><path d="M14 2.5V7h4.5"/><path d="M8.8 14.2l2.2 2.2 4.4-4.4"/><path d="M8.8 9h5.5M8.8 18.2h6.5"/>',
  sessionSave: '<rect x="3" y="4" width="18" height="16" rx="2" fill="currentColor" fill-opacity="0.14"/><path d="M12 7.5v7M9 11.8l3 3 3-3"/><path d="M7 17h10"/>',
  sessionLoad: '<rect x="3" y="4" width="18" height="16" rx="2" fill="currentColor" fill-opacity="0.14"/><path d="M12 14.5v-7M9 10.2l3-3 3 3"/><path d="M7 17h10"/>',
  sparkle: '<path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2L12 3z" fill="currentColor" fill-opacity="0.2"/>',
  pdfStudio: '<rect x="3.5" y="3" width="14" height="18" rx="2" fill="currentColor" fill-opacity="0.15"/><path d="M7.5 8h6M7.5 12h4"/><path d="M14.5 19.5l5.5-5.5 2 2-5.5 5.5-2.6.6.6-2.6z" fill="currentColor" fill-opacity="0.25"/>',
  allTools: '<rect x="3.5" y="3.5" width="7.2" height="7.2" rx="1.5" fill="currentColor" fill-opacity="0.18"/><rect x="13.3" y="3.5" width="7.2" height="7.2" rx="1.5" fill="currentColor" fill-opacity="0.18"/><rect x="3.5" y="13.3" width="7.2" height="7.2" rx="1.5" fill="currentColor" fill-opacity="0.18"/><rect x="13.3" y="13.3" width="7.2" height="7.2" rx="1.5" fill="currentColor" fill-opacity="0.18"/>',
  sidebarLeft: '<rect x="3" y="4" width="18" height="16" rx="2" fill="currentColor" fill-opacity="0.1"/><rect x="3" y="4" width="6.5" height="16" rx="1.5" fill="currentColor" fill-opacity="0.26"/><path d="M9.5 4v16"/>',
  sidebarRight: '<rect x="3" y="4" width="18" height="16" rx="2" fill="currentColor" fill-opacity="0.1"/><rect x="14.5" y="4" width="6.5" height="16" rx="1.5" fill="currentColor" fill-opacity="0.26"/><path d="M14.5 4v16"/>',
  circle: '<circle cx="12" cy="12" r="8" fill="currentColor" fill-opacity="0.16"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  polygon: '<path d="M12 3.5l8 5.2-3 9.8H7l-3-9.8 8-5.2z" fill="currentColor" fill-opacity="0.16"/><circle cx="12" cy="3.5" r="1.6" fill="currentColor"/><circle cx="20" cy="8.7" r="1.6" fill="currentColor"/><circle cx="17" cy="18.5" r="1.6" fill="currentColor"/><circle cx="7" cy="18.5" r="1.6" fill="currentColor"/><circle cx="4" cy="8.7" r="1.6" fill="currentColor"/>',
  eraser: '<path d="M8.5 19.5h11"/><path d="M4.2 14.2l8.6-8.6a2 2 0 0 1 2.8 0l4.2 4.2a2 2 0 0 1 0 2.8l-6.8 6.8H7.2l-3-3a1.8 1.8 0 0 1 0-2.2z" fill="currentColor" fill-opacity="0.18"/><path d="M9 9.5l6.8 6.8"/>',
  checkMark: '<rect x="3.5" y="3.5" width="17" height="17" rx="3" fill="currentColor" fill-opacity="0.14"/><path d="M7.5 12.5l3.2 3.2 6.3-6.5" stroke-width="2.2"/>',
  crossMark: '<rect x="3.5" y="3.5" width="17" height="17" rx="3" fill="currentColor" fill-opacity="0.14"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke-width="2.1"/>',
  fontFile: '<path d="M4 19h6M7 19V6M4 7.5V6h6v1.5"/><path d="M13.5 19l3.2-9 3.3 9M14.4 16.5h4.7"/><circle cx="19" cy="5.5" r="2.5" fill="currentColor" fill-opacity="0.22"/><path d="M19 4v3M17.5 5.5h3"/>',
  alignLeft: '<path d="M4 6h16M4 10h11M4 14h16M4 18h9"/>',
  alignCenter: '<path d="M4 6h16M6.5 10h11M4 14h16M7.5 18h9"/>',
  alignRight: '<path d="M4 6h16M9 10h11M4 14h16M11 18h9"/>',
  insertPdf: '<path d="M6 3h8l4.5 4.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="currentColor" fill-opacity="0.12"/><path d="M13.5 3v5H18.5"/><path d="M2.5 13h9.5M9 10l3 3-3 3"/>',
  headerFooter: '<rect x="4" y="3" width="16" height="18" rx="1.8" fill="currentColor" fill-opacity="0.1"/><rect x="4" y="3" width="16" height="4.2" rx="1" fill="currentColor" fill-opacity="0.28"/><rect x="4" y="16.8" width="16" height="4.2" rx="1" fill="currentColor" fill-opacity="0.28"/><path d="M4 7.2h16M4 16.8h16"/>',
  pageNums: '<path d="M6 3h8l4.5 4.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="currentColor" fill-opacity="0.12"/><rect x="9.5" y="12.5" width="6.5" height="5.5" rx="1" fill="currentColor" fill-opacity="0.22"/><path d="M12.2 14l.8-.5v3.2"/>',
  bates: '<rect x="3" y="6" width="18" height="12" rx="2" fill="currentColor" fill-opacity="0.16"/><path d="M6.5 10v4M10 10h2.5v4H10zM15.5 10h2v4h-2z"/><path d="M3 14.5h18" stroke-opacity="0.4"/>',
  pageSize: '<rect x="5" y="4" width="14" height="16" rx="1.5" fill="currentColor" fill-opacity="0.14"/><path d="M8 12h8M8 12l2-2M8 12l2 2M16 12l-2-2M16 12l-2 2"/><path d="M12 7v10"/>',
  oddPages: '<rect x="4" y="4" width="7" height="9" rx="1" fill="currentColor" fill-opacity="0.26"/><rect x="13" y="4" width="7" height="9" rx="1" stroke-dasharray="2 2"/><rect x="4" y="15" width="7" height="5" rx="1" fill="currentColor" fill-opacity="0.26"/><rect x="13" y="15" width="7" height="5" rx="1" stroke-dasharray="2 2"/>',
  evenPages: '<rect x="4" y="4" width="7" height="9" rx="1" stroke-dasharray="2 2"/><rect x="13" y="4" width="7" height="9" rx="1" fill="currentColor" fill-opacity="0.26"/><rect x="4" y="15" width="7" height="5" rx="1" stroke-dasharray="2 2"/><rect x="13" y="15" width="7" height="5" rx="1" fill="currentColor" fill-opacity="0.26"/>',
  sendA: '<path d="M3 11.5L19 4l-5.5 15.5-3-6-7.5-2z" fill="currentColor" fill-opacity="0.16"/><path d="M15.5 20.5l2-5 2 5M16 19.2h3"/>',
  sendB: '<path d="M3 11.5L19 4l-5.5 15.5-3-6-7.5-2z" fill="currentColor" fill-opacity="0.16"/><path d="M16 15.5h2.2a1.2 1.2 0 0 1 0 2.4H16h2.4a1.2 1.2 0 0 1 0 2.4H16v-4.8z"/>',
  keyboard: '<rect x="2.5" y="5" width="19" height="14" rx="2" fill="currentColor" fill-opacity="0.15"/><path d="M6 9h2M10 9h2M14 9h2M18 9h.5M6 12.5h2M10 12.5h4M16 12.5h2M7.5 16h9"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21V5.5z" fill="currentColor" fill-opacity="0.15"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5A2.5 2.5 0 0 1 20 21V5.5z" fill="currentColor" fill-opacity="0.08"/>',
  shield: '<path d="M12 2.8l7.5 3.2v5.5c0 5-3.2 8.8-7.5 10.2-4.3-1.4-7.5-5.2-7.5-10.2V6L12 2.8z" fill="currentColor" fill-opacity="0.16"/>',
  globe: '<circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity="0.14"/><path d="M3.2 12h17.6M12 3a13.5 13.5 0 0 1 3.8 9 13.5 13.5 0 0 1-3.8 9 13.5 13.5 0 0 1-3.8-9A13.5 13.5 0 0 1 12 3z"/>',
  packageZip: '<path d="M4 7.5L12 3l8 4.5v9L12 21l-8-4.5v-9z" fill="currentColor" fill-opacity="0.16"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5M8 5.2l8 4.5"/>',
  recent: '<circle cx="12" cy="12" r="8.8" fill="currentColor" fill-opacity="0.14"/><path d="M12 7.2v5l3.5 2.2"/>',
  rect: '<rect x="4" y="5" width="16" height="14" rx="1.5" fill="currentColor" fill-opacity="0.16"/><rect x="3" y="4" width="2.5" height="2.5" rx="0.5"/><rect x="18.5" y="4" width="2.5" height="2.5" rx="0.5"/><rect x="3" y="17.5" width="2.5" height="2.5" rx="0.5"/><rect x="18.5" y="17.5" width="2.5" height="2.5" rx="0.5"/>',
  cadDxf: '<path d="M12 2.2l8.5 4.8v9.6L12 21.4l-8.5-4.8V7L12 2.2z" fill="currentColor" fill-opacity="0.15"/><path d="M12 11.8l8.5-4.8M12 11.8v9.6M12 11.8L3.5 7"/>'
};
window.IC = IC;

window.ic = n => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || IC.info}</svg>`;
window.hydrateIcons = (root = document) => root.querySelectorAll('[data-ic]').forEach(el => {
  const svgs = el.querySelectorAll(':scope > svg.ic');
  if (svgs.length === 1 && el.dataset.done === el.dataset.ic) return;
  svgs.forEach(s => s.remove());
  el.insertAdjacentHTML('afterbegin', ic(el.dataset.ic));
  el.dataset.done = el.dataset.ic;
});
