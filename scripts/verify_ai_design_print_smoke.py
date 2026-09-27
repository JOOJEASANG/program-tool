"""Validate actual PDF paths, original pixels, transparency and rendered text."""
import base64
from html import unescape
from pathlib import Path
import re
import sys

import pymupdf

html_path = Path(sys.argv[1])
html = html_path.read_text()
if 'data-status="pass"' not in html:
    raise SystemExit('Browser test failed: ' + unescape(re.search(r'<pre id="result">(.*?)</pre>', html, re.S)[1]))
encoded = re.search(r'<pre id="pdf-output">(.*?)</pre>', html, re.S)[1]
pdf_path = html_path.with_suffix('.pdf')
pdf_path.write_bytes(base64.b64decode(encoded))
with pymupdf.open(pdf_path) as doc:
    assert len(doc) == 1
    page = doc[0]
    assert abs(page.rect.width - 216 * 72 / 25.4) < .01
    assert abs(page.trimbox.width - 210 * 72 / 25.4) < .01
    images = page.get_images()
    assert any(image[2:4] == (1426, 2000) for image in images), 'Background resampled'
    assert any(image[1] > 0 and image[2:4] == (200, 100) for image in images), 'Logo alpha lost'
    assert len(page.get_drawings()) >= 21, 'Text/shape vectors missing'
    pix = page.get_pixmap()
    # Extraction alone did not detect a CFF subset rendering defect: inspect pixels.
    for x0, y0, x1, y1 in [(50, 165, 215, 205), (205, 295, 230, 360), (357, 295, 380, 340)]:
        dark = sum(max(pix.pixel(x, y)[:3]) < 180 for y in range(y0, y1) for x in range(x0, x1))
        assert dark > 30, 'Korean glyphs missing from rendered PDF'
    pix.save(str(html_path.with_suffix('.png')))
print('Print PDF verified: dimensions, original pixels, alpha, vector paths, horizontal/rotated/vertical Korean.')
