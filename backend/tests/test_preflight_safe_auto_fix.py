from pathlib import Path

import fitz

from services.preflight_auto_fix import auto_fix_pdf_bytes


ROOT = Path(__file__).resolve().parents[2]


def _sample_pdf(sizes):
    doc = fitz.open()
    try:
        for index, (width, height) in enumerate(sizes, start=1):
            page = doc.new_page(width=width, height=height)
            page.insert_text((36, 48), f"PAGE-{index}", fontsize=12)
        return doc.tobytes(garbage=4, deflate=True)
    finally:
        doc.close()


def test_auto_fix_normalizes_to_dominant_size_and_pads_booklet():
    source = _sample_pdf([
        (595.28, 841.89),
        (595.28, 841.89),
        (419.53, 595.28),
    ])

    result = auto_fix_pdf_bytes(
        source,
        normalize_page_size=True,
        pad_mode="booklet",
    )

    assert result.added_blank_pages == 1
    assert result.normalize_page_size is True
    fixed = fitz.open(stream=result.data, filetype="pdf")
    try:
        assert len(fixed) == 4
        sizes = [(round(page.rect.width, 1), round(page.rect.height, 1)) for page in fixed]
        assert len(set(sizes)) == 1
        assert sizes[0] == (595.3, 841.9)
        assert "PAGE-1" in fixed[0].get_text()
        assert "PAGE-3" in fixed[2].get_text()
        assert not fixed[3].get_text().strip()
    finally:
        fixed.close()


def test_auto_fix_even_padding_preserves_existing_page_sizes():
    source = _sample_pdf([
        (595.28, 841.89),
        (419.53, 595.28),
        (612.0, 792.0),
    ])

    result = auto_fix_pdf_bytes(
        source,
        normalize_page_size=False,
        pad_mode="even",
    )

    assert result.added_blank_pages == 1
    fixed = fitz.open(stream=result.data, filetype="pdf")
    try:
        assert len(fixed) == 4
        assert round(fixed[0].rect.width, 1) == 595.3
        assert round(fixed[1].rect.width, 1) == 419.5
        assert round(fixed[2].rect.width, 1) == 612.0
        assert (round(fixed[3].rect.width, 1), round(fixed[3].rect.height, 1)) == (612.0, 792.0)
    finally:
        fixed.close()


def test_auto_fix_frontend_and_routes_are_wired():
    frontend = (ROOT / "js" / "pdf-print-auto-fix.js").read_text(encoding="utf-8")
    app_version = (ROOT / "js" / "app-version.js").read_text(encoding="utf-8")
    runtime = (ROOT / "js" / "sw-register.js").read_text(encoding="utf-8")
    main = (ROOT / "backend" / "main.py").read_text(encoding="utf-8")
    router = (ROOT / "backend" / "routers" / "preflight_auto_fix.py").read_text(encoding="utf-8")

    assert "안전 자동 수정" in frontend
    assert "페이지 규격 자동 통일" in frontend
    assert "양면 인쇄용 짝수 맞춤" in frontend
    assert "소책자용 4의 배수 맞춤" in frontend
    assert "자동으로 수정하지 않는 항목" in frontend
    assert "utility.state.files[index]=replacement" in frontend
    assert "await utility.runBatchCheck()" in frontend
    assert "/api/preflight/auto-fix" in frontend
    assert "/api/preflight/auto-fix-storage" in frontend
    assert "pdfPrintAutoFixScriptV1" in app_version
    assert "pdfPrintAutoFixScriptV1" in runtime
    assert "preflight_auto_fix_bp" in main
    assert '@preflight_auto_fix_bp.route("/auto-fix"' in router
    assert '@preflight_auto_fix_bp.route("/auto-fix-storage"' in router
