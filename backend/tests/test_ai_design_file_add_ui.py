from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_design_enhancer_uses_one_explicit_upload_instead_of_ai_design_prompt():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    script = (ROOT / "js/design-bleed-enhancer.js").read_text(encoding="utf-8")
    manual = (ROOT / "js/program-manuals/ai-design-maker.js").read_text(encoding="utf-8")
    assert 'id="fileInput"' in page
    assert 'id="uploadZone"' in page
    assert 'id="trimWidth"' in page
    assert 'id="bleedMm"' in page
    assert 'id="processBtn"' in page
    assert 'id="generateBtn"' not in page
    assert "async function receiveFile(file)" in script
    assert "PDF·JPG·PNG·WEBP" in manual
    assert "updated:'2026-11-23'" in manual
