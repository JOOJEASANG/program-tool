from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_classic_booklet_is_deployed_directly_to_pdf_editor_pages():
    injector = read("scripts/inject_boot_guard.py")

    assert 'PDF_BOOKLET_MARKER = "data-pdf-classic-booklet"' in injector
    assert '"pdf-editor/index.html"' in injector
    assert '"tools/pdf-editor.html"' in injector
    assert 'src="/js/pdf-editor/booklet-sheet-preview.js?v={version}"' in injector


def test_classic_booklet_keeps_normal_nup_and_hides_it_only_while_active():
    booklet = read("js/pdf-editor/booklet-sheet-preview.js")
    editor = read("pdf-editor/index.html")

    assert "const BOOKLET_NUP=2" in booklet
    assert "pdf-classic-booklet-active" in booklet
    assert "#nupGrid{display:none!important}" in booklet
    assert "previousNormalNup" in booklet
    assert "clickNup(restoreNup)" in booklet
    assert "nup_default:BOOKLET_NUP" in booklet

    for value in (1, 2, 4, 6, 8, 9):
        assert f'data-nup="{value}"' in editor
