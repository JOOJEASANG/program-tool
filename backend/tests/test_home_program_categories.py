from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_home_lists_categorized_programs_and_split_design_entries():
    home = (ROOT / "index.html").read_text(encoding="utf-8")
    assert "stage:'categorized-program-home-v1'" in home
    assert "all:{label:'전체 프로그램'" in home
    assert "design:{label:'디자인 프로그램'" in home
    assert "pdf:{label:'PDF 프로그램'" in home
    assert "content:{label:'문서 · 이미지'" in home

    expected_design_entries = (
        "design-editor/?app=cover&mode=cover&preset=cover-a4",
        "design-editor/?app=poster&mode=poster&preset=poster-a4",
        "design-editor/?app=invitation&mode=invitation&preset=invitation-a4",
        "design-editor/?app=leaflet&mode=leaflet3&preset=leaflet-3-roll",
    )
    for entry in expected_design_entries:
        assert entry in home
    assert "포스터 · 전단지" in home

    assert "url:'pdf-editor/'" in home
    assert "url:'pdf-preflight/'" in home
    assert "url:'document-editor/'" in home
    assert "url:'image-editor/'" in home


def test_design_entries_share_one_editor_engine_instead_of_copying_programs():
    home = (ROOT / "index.html").read_text(encoding="utf-8")
    shell = (ROOT / "design-editor" / "index.html").read_text(encoding="utf-8")

    assert home.count("design-editor/?app=") == 4
    assert "const APP_CONFIG={" in shell
    assert "query.set('app',app);" in shell
    assert "stage:'single-sidebar-general-engine-shell-no-legacy-fallback'" in shell
    assert "productStage:'shared-design-engine-product-entry-v1'" in shell
