from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_deployed_home_launcher_keeps_smart_layout_entry():
    launcher = (ROOT / "js/pdf-suite-home-launcher.js").read_text(encoding="utf-8")

    assert "id:'smart-print-layout'" in launcher
    assert "name:'스마트 인쇄배치'" in launcher
    assert "url:'smart-print-layout/'" in launcher
    assert "pdf-home-five-programs-v7" in launcher
    assert "four-programs" not in launcher


def test_hosting_allowlist_contains_smart_layout_directory():
    prepare = (ROOT / "scripts/prepare_hosting_dist.py").read_text(encoding="utf-8")

    assert '"smart-print-layout",' in prepare
    assert 'OUTPUT / "smart-print-layout/index.html"' in prepare
    assert "pdf-suite-home-launcher.js?v=20260910-1" in prepare
