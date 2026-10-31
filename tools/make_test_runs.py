"""Fills the __A__ / __B__ ... placeholders in tests/*.js with base64 PDFs and writes tests/run/*_run.js"""
import base64, glob, os
root = os.path.join(os.path.dirname(__file__), '..', 'tests')
pdf = {'__A__': 'A.pdf', '__B__': 'B.pdf', '__BS__': 'Bshift.pdf', '__M__': 'mixed.pdf', '__MA__': 'mixed.pdf', '__MB__': 'mixedB.pdf'}
b64 = {k: base64.b64encode(open(os.path.join(root, 'pdfs', v), 'rb').read()).decode() for k, v in pdf.items()}
os.makedirs(os.path.join(root, 'run'), exist_ok=True)
for f in glob.glob(os.path.join(root, '*.js')):
    t = open(f).read()
    for k in sorted(b64, key=len, reverse=True): t = t.replace(k, b64[k])
    open(os.path.join(root, 'run', os.path.basename(f)[:-3] + '_run.js'), 'w').write(t)
print('wrote', len(glob.glob(os.path.join(root, 'run', '*_run.js'))), 'test scripts to tests/run')
