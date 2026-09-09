from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HOME = ROOT / "index.html"


def test_home_search_is_visually_simple_and_does_not_gain_focus_border():
    home = HOME.read_text(encoding="utf-8")

    assert ".search-wrap{flex:1;max-width:460px" in home
    assert "border:1px solid transparent" in home
    assert ".search-wrap:focus-within{border-color:transparent;background:#f3f6f9;box-shadow:none}" in home
    assert "html.ps-ui-v2 .search:focus,html.ps-ui-v2 .search:focus-visible{outline:0!important;box-shadow:none!important}" in home
    assert 'id="search"' in home
    assert 'aria-label="프로그램 검색"' in home
