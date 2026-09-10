from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
INDEX = ROOT / "print-checker" / "index.html"
BOOKLET = ROOT / "js" / "print-checker" / "booklet-layout-only.js"
PAGE_LAYOUT = ROOT / "js" / "print-checker" / "page-layout-v2.js"


def text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_booklet_page_input_never_hides_html_imposition_board():
    booklet = text(BOOKLET)
    layout = text(PAGE_LAYOUT)
    index = text(INDEX)

    assert "suppress($('impositionGuide'),enabled)" not in booklet
    assert "keepImpositionGuideAvailable" in booklet
    assert "renderHtmlBookletLayout" in booklet
    assert "window.PrintCheckerPageLayout?.render?.()" in booklet
    assert "scheduleDraw" in booklet

    assert "bookletPages" in layout
    assert "bookletPlan(sourcePages)" in layout
    assert "앞면 배치" in layout
    assert "뒷면 배치" in layout
    assert "target.hidden = false" in layout

    assert "/js/print-checker/booklet-layout-only.js?v=20260910-3" in index
    assert "/js/print-checker/page-layout-v2.js?v=20260910-2" in index


def test_booklet_imposition_still_uses_sheet_front_back_pairs():
    booklet = text(BOOKLET)
    layout = text(PAGE_LAYOUT)

    assert "front:mapPair(sheet.front)" in booklet
    assert "back:mapPair(sheet.back)" in booklet
    assert "sheet.front" in layout
    assert "sheet.back" in layout
    assert "시트 ${sheet.sheet}" in layout
