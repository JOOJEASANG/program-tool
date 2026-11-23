"""Verify the new upload-driven print enhancer browser smoke and output PDF."""
from html import unescape
from pathlib import Path
import re
import sys

import fitz
sys.path.insert(0,str(Path(__file__).resolve().parents[1] / 'backend'))
from services.design_bleed_extension import extend_print_bleed

html = Path(sys.argv[1]).read_text(encoding="utf-8")
if 'data-status="pass"' not in html:
    found = re.search(r'<pre id="result">(.*?)</pre>', html, re.S)
    raise SystemExit("Browser test failed: " + unescape(found.group(1) if found else "unknown"))
assert "PASS: file upload, preview, A4+3mm" in html

doc = fitz.open()
try:
    page = doc.new_page(width=210*72/25.4, height=297*72/25.4)
    page.insert_text((55, 75), "CUSTOMER SOURCE VECTOR", fontsize=14)
    source = doc.tobytes()
finally:
    doc.close()
result = extend_print_bleed(source, filename="customer.pdf", bleed_mm=3)
output = fitz.open(stream=result.pdf, filetype="pdf")
try:
    page = output[0]
    assert abs(page.rect.width - 216*72/25.4) < 0.1
    assert abs(page.trimbox.width - 210*72/25.4) < 0.1
    assert abs(page.bleedbox.width - 216*72/25.4) < 0.1
    assert "CUSTOMER SOURCE VECTOR" in page.get_text()
    assert page.get_images()
finally:
    output.close()
print("PASS: browser upload & trim, native PDF vector preserved, 3mm BleedBox.")
