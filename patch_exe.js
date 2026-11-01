const fs = require('fs'), path = require('path'), R = require('resedit');
const exePath = process.argv[2], icoPath = process.argv[3];
const pdfEditorIcoPath = process.argv[4] || path.join(path.dirname(icoPath), 'pdf-editor-icon.ico');

function patchBinary(targetExePath, icoFilePath, meta) {
  const exe = R.NtExecutable.from(fs.readFileSync(targetExePath)), res = R.NtExecutableResource.from(exe);
  const ico = R.Data.IconFile.from(fs.readFileSync(icoFilePath));
  const groups = R.Resource.IconGroupEntry.fromEntries(res.entries);
  const g = groups[0]; R.Resource.IconGroupEntry.replaceIconsForResource(res.entries, g.id, g.lang, ico.icons.map(i => i.data));
  const vi = R.Resource.VersionInfo.fromEntries(res.entries)[0], lang = vi.lang && vi.lang[0] ? vi.lang[0] : { lang: 1033, codepage: 1200 };
  vi.setStringValues(lang, meta);
  vi.outputToResourceEntries(res.entries); res.outputResource(exe);
  fs.writeFileSync(targetExePath, Buffer.from(exe.generate()));
  console.log('patched', targetExePath, 'with icon', icoFilePath);
}

// 1. Patch primary executable (Redline Pro.exe) with build/icon.ico
patchBinary(exePath, icoPath, {
  ProductName: 'Redline Pro',
  FileDescription: 'Redline Pro - Engineering Review & Compare Studio',
  CompanyName: 'Redline Studio',
  LegalCopyright: 'Redline Studio - textportdocx.in',
  InternalName: 'Redline',
  OriginalFilename: 'Redline Pro.exe',
  ProductVersion: '1.0.0',
  FileVersion: '1.0.0'
});

// 2. Generate & patch separate PDF Editor executable (Redline Pro PDF Editor.exe) with build/pdf-editor-icon.ico
const dir = path.dirname(exePath);
const pdfEditorExePath = path.join(dir, 'Redline Pro PDF Editor.exe');
if (path.resolve(exePath) !== path.resolve(pdfEditorExePath)) {
  fs.copyFileSync(exePath, pdfEditorExePath);
  const useEditorIcon = fs.existsSync(pdfEditorIcoPath) ? pdfEditorIcoPath : icoPath;
  patchBinary(pdfEditorExePath, useEditorIcon, {
    ProductName: 'Redline Pro PDF Editor',
    FileDescription: 'Redline Pro PDF Editor - Enterprise PDF Markup & Editing Studio',
    CompanyName: 'Redline Studio',
    LegalCopyright: 'Redline Studio - textportdocx.in',
    InternalName: 'RedlineProPdfEditor',
    OriginalFilename: 'Redline Pro PDF Editor.exe',
    ProductVersion: '1.0.0',
    FileVersion: '1.0.0'
  });
}
