"""PDF editor B-series sheet labels and output geometry must match the print presets."""
from pathlib import Path
import re

HTML = (Path(__file__).resolve().parents[2] / "pdf-editor" / "index.html").read_text(encoding="utf-8")


def test_pdf_editor_b4_b5_print_menu_and_actual_size():
    for key, width, height in (("b4", 257, 364), ("b5", 182, 257)):
        assert f'<option value="{key}">{key.upper()} ({width}×{height}mm)</option>' in HTML
        assert re.search(rf"\b{key}:\[{width},{height}\]", HTML)
    assert "b4:[250,354]" not in HTML
    assert "b5:[176,250]" not in HTML


def test_pdf_editor_paper_preset_controls_output_and_page_detection():
    assert "Object.entries(PAPER)" in HTML
    assert "if (Math.abs(nw - pw) <= 3 && Math.abs(nh - ph) <= 3)" in HTML
    assert "[pw0, ph0] = PAPER[$('paperSize').value || 'a4']" in HTML
    assert "pw: landscape ? ph0 : pw0" in HTML
    assert "ph: landscape ? pw0 : ph0" in HTML
