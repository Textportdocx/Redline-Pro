"""Creates the test PDFs used by the tests. Needs: pip install reportlab"""
import os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, A3, landscape

OUT = os.path.join(os.path.dirname(__file__), '..', 'tests', 'pdfs')
os.makedirs(OUT, exist_ok=True)

def schematic(path, variant='A', dx=0, dy=0):
    c = canvas.Canvas(path, pagesize=landscape(A3)); c.translate(dx, dy); c.setLineWidth(0.6)
    for i in range(6):
        x = 60 + i * 120
        c.line(x, 300, x + 60, 300); c.rect(x + 60, 290, 30, 20); c.drawString(x + 62, 314, f"R{i+1}")
        c.circle(x + 30, 200, 12); c.drawString(x + 22, 170, f"U{i+1}")
    c.line(60, 300, 60, 150); c.line(60, 150, 780, 150)
    c.setStrokeColorRGB(0, 0, 1); c.line(60, 400, 780, 400); c.setStrokeColorRGB(0, 0, 0)
    c.drawString(60, 430, "NET VCC_3V3  VALUE 10k")
    if variant == 'A':
        c.rect(600, 600, 30, 30)                                    # part that is removed in B
    else:
        c.rect(400, 500, 40, 20); c.drawString(402, 525, "R99")      # added part
        c.setFillColorRGB(1, 1, 1); c.rect(55, 422, 260, 18, fill=1, stroke=0); c.setFillColorRGB(0, 0, 0)
        c.drawString(60, 430, "NET VCC_3V3  VALUE 22k")              # changed value
        c.line(780, 150, 780, 300)                                   # added wire
    c.showPage(); c.save()

def pages(path, changed):
    c = canvas.Canvas(path, pagesize=A4)
    def page(w, h, title):
        c.setFont('Helvetica', 14); c.drawString(40, h - 50, title); c.setFont('Helvetica', 11); y = h - 90
        for i in range(1, 18):
            v = '22k' if (changed and i == 3) else '10k'
            c.drawString(40, y, f"Line {i}: The quick brown fox jumps over the lazy dog. Value R{i}={v}"); y -= 22
        c.drawString(40, 60, "Footer text here"); c.rect(20, 20, w - 40, h - 40)
    page(*A4, "PORTRAIT A4 page"); c.showPage()
    c.setPageSize(landscape(A4)); page(*landscape(A4), "LANDSCAPE A4 page"); c.showPage()
    c.setPageSize(A3); page(*A3, "PORTRAIT A3 tall page"); c.showPage(); c.save()

schematic(f'{OUT}/A.pdf', 'A'); schematic(f'{OUT}/B.pdf', 'B'); schematic(f'{OUT}/Bshift.pdf', 'A', 6, -4)
pages(f'{OUT}/mixed.pdf', False); pages(f'{OUT}/mixedB.pdf', True)
print('Test PDFs written to', os.path.abspath(OUT))
