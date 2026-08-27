from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_repeat_two_frontend_is_removed_from_booklet_workflow():
    repeat_two = ROOT / "js" / "pdf-editor" / "booklet-repeat-two.js"
    app_version = (ROOT / "js" / "app-version.js").read_text(encoding="utf-8")
    booklet = (ROOT / "js" / "pdf-editor" / "booklet-sheet-preview.js").read_text(encoding="utf-8")

    assert not repeat_two.exists()
    assert "pdfBookletRepeatTwoScriptV1" not in app_version
    assert "booklet-repeat-two.js" not in app_version
    assert "const BOOKLET_NUP=2" in booklet
    assert "nup_default:BOOKLET_NUP" in booklet


def test_booklet_ui_does_not_force_four_up_or_duplicate_pages():
    booklet = (ROOT / "js" / "pdf-editor" / "booklet-sheet-preview.js").read_text(encoding="utf-8")

    assert "forceFourUp" not in booklet
    assert "duplicateBookPages" not in booklet
    assert "nup_default:4" not in booklet
    assert "BOOKLET_NUP=2" in booklet
