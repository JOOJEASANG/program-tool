from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_page_info_supports_spread_half_selection():
    schema = read("backend/models/schemas.py")
    assert 'split_side: Optional[Literal["left", "right"]]' in schema


def test_pdf_engine_clips_spread_halves_before_layout():
    engine = read("backend/services/pdf_engine.py")
    assert 'split_side = getattr(page_info, "split_side", None)' in engine
    assert "clip_rect = fitz.Rect(" in engine
    assert "clip=clip_rect" in engine


def test_pdf_editor_loads_spread_split_stage1_module():
    version = read("js/app-version.js")
    split = read("js/pdf-editor/spread-split.js")
    assert "pdfEditorSpreadSplitScriptV1" in version
    assert "/js/pdf-editor/spread-split.js?v=20260825-1" in version
    assert "펼침면 좌우 분할" in split
    assert "splitSide" in split
    assert "firstPageSkip" in split
    assert "lastPageSkip" in split
    assert "readingOrder" in split
    assert "patchApiProcessPdf" in split


def test_spread_split_can_be_undone_without_reupload():
    split = read("js/pdf-editor/spread-split.js")
    assert "originalPages" in split
    assert "restoreOriginal" in split
    assert "다시 업로드하지 않고" in split
