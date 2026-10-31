const fs = require('fs'), R = require('resedit');
const exePath = process.argv[2], icoPath = process.argv[3];
const exe = R.NtExecutable.from(fs.readFileSync(exePath)), res = R.NtExecutableResource.from(exe);
const ico = R.Data.IconFile.from(fs.readFileSync(icoPath));
const groups = R.Resource.IconGroupEntry.fromEntries(res.entries);
const g = groups[0]; R.Resource.IconGroupEntry.replaceIconsForResource(res.entries, g.id, g.lang, ico.icons.map(i => i.data));
const vi = R.Resource.VersionInfo.fromEntries(res.entries)[0], lang = vi.lang && vi.lang[0] ? vi.lang[0] : { lang: 1033, codepage: 1200 };
vi.setStringValues(lang, {
  ProductName: 'Redline Pro',
  FileDescription: 'Redline Pro - Engineering Review & Compare Studio',
  CompanyName: 'Redline Studio',
  LegalCopyright: 'Redline Studio - textportdocx.in',
  InternalName: 'Redline',
  OriginalFilename: 'Redline Pro.exe',
  ProductVersion: '1.0.0',
  FileVersion: '1.0.0'
});
vi.outputToResourceEntries(res.entries); res.outputResource(exe);
fs.writeFileSync(exePath, Buffer.from(exe.generate())); console.log('patched', exePath);
