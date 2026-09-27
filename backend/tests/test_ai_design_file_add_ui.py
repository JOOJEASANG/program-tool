from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_ai_design_file_add_ui_contract():
    sidebar = (ROOT / "js" / "program-sidebar-actions.js").read_text(encoding="utf-8")
    manual = (ROOT / "js" / "program-manuals" / "ai-design-maker.js").read_text(encoding="utf-8")

    assert "directCoverSection.remove()" in sidebar
    assert "title.textContent = '파일 추가'" in sidebar
    assert "ps-ai-file-add-button" in sidebar
    assert "plus.textContent = '+'" in sidebar
    assert "직접 만든 표지 배경 업로드 영역은 제거했습니다." in manual
    assert "{ label: '직접 파일 업로드'" not in manual
    assert "updated: '2026-09-28'" in manual
