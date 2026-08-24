from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
REFINE = ROOT / "js" / "home-header-footer-refine.js"


def test_logged_in_greeting_block_is_removed_from_home_body():
    source = REFINE.read_text(encoding="utf-8")
    assert ".greeting{display:none!important}" in source
    assert "function removeGreetingBlock()" in source
    assert "document.getElementById('greeting')?.remove()" in source
    assert "removeGreetingBlock()" in source
