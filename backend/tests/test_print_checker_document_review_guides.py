from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_document_review_uses_solid_guides_and_crop_marks():
    script = (ROOT / "js" / "print-checker" / "preview-surface.js").read_text(encoding="utf-8")

    assert "context.setLineDash = function ()" in script
    assert "return nativeSetLineDash([]);" in script
    assert "function drawCropMarks" in script
    assert "사방 재단표시" in script
    assert "TRIM_COLOR = '#2563eb'" in script
    assert "CROP_COLOR = '#111827'" in script


def test_document_review_removes_unused_safety_controls_and_report():
    script = (ROOT / "js" / "print-checker" / "preview-surface.js").read_text(encoding="utf-8")
    index = (ROOT / "print-checker" / "index.html").read_text(encoding="utf-8")

    assert "document.getElementById('safeZone')" in script
    assert "document.getElementById('bookBindingSafe')" in script
    assert "input.closest('.spec-field')?.remove()" in script
    assert "label === '안전영역 안내'" in script
    assert "PDF 문서·재단선·전체 페이지" in script
    assert "/js/print-checker/preview-surface.js?v=20260930-2" in index
