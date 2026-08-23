from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SHELL = ROOT / "design-editor" / "index.html"
LEGACY = ROOT / "perfect-binding-cover" / "index.html"
TOOLS_ALIAS = ROOT / "tools" / "perfect-binding-cover.html"


def test_stage78_unified_shell_has_no_executable_legacy_cover_fallback():
    source = SHELL.read_text(encoding="utf-8")
    assert "legacyCoverFallback" not in source
    assert "single-sidebar-general-engine-shell-no-legacy-fallback" in source
    assert "if(mode==='cover')return '/design-editor/general?embed=1&mode=cover&preset=cover-a4'" in source
    assert "Retired compatibility URL only" in source
    assert "src=\"/design-editor/general?embed=1&mode=cover&preset=cover-a4\"" in source


def test_stage78_legacy_cover_url_is_a_small_redirect_stub_not_an_editor():
    source = LEGACY.read_text(encoding="utf-8")
    assert "/design-editor/?mode=cover" in source
    assert "target.searchParams.set('mode','cover')" in source
    assert "location.replace(target.pathname+target.search+location.hash)" in source
    assert "책표지제작" in source and "Program Studio" in source
    assert len(source.encode("utf-8")) < 3000
    for retired_marker in (
        '<canvas',
        'id="pageCount"',
        'id="paperCaliper"',
        'id="spineDirection"',
        'id="pdfBtn"',
        'cover-template-manager.js',
        'cover-editor-preflight-project.js',
        'cover-editor-image-tools.js',
    ):
        assert retired_marker not in source


def test_stage78_both_old_cover_entrypoints_converge_on_unified_design_editor():
    legacy = LEGACY.read_text(encoding="utf-8")
    alias = TOOLS_ALIAS.read_text(encoding="utf-8")
    assert "/design-editor/?mode=cover" in legacy
    assert "/design-editor/?mode=cover" in alias
    assert "../perfect-binding-cover/" not in alias
    assert "../perfect-binding-cover/" not in legacy
