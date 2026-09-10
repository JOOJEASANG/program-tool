from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
INDEX = ROOT / "print-checker" / "index.html"
CORE = ROOT / "js" / "print-checker" / "print-checker.js"
GUIDES = ROOT / "js" / "print-checker" / "production-guides-v2.js"
GUIDE_CSS = ROOT / "css" / "print-checker-production-guides.css"
INJECT = ROOT / "scripts" / "inject_boot_guard.py"
HOSTING = ROOT / "scripts" / "prepare_hosting_dist.py"


def text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_print_checker_uses_distinct_transparent_production_guide_layers():
    index = text(INDEX)
    source = text(GUIDES)
    css = text(GUIDE_CSS)

    assert "/css/print-checker-production-guides.css?v=20260910-1" in index
    assert "/js/print-checker/production-guides-v2.js?v=20260910-2" in index
    for legend in (
        "작업사이즈 전체 — 파란 실선",
        "재단선(실제사이즈) — 빨간 실선",
        "안쪽 여백 — 초록 점선",
        "접는선 — 주황 쇄선",
    ):
        assert legend in index

    assert "v3-separated-fold-guides" in source
    assert "drawCoverGuides" in source
    assert "뒷면 안쪽 여백" in source
    assert "앞면 안쪽 여백" in source
    assert "작업사이즈 전체" in source
    assert "재단선(실제사이즈)" in source
    assert "#previewGuideLayer" in css and "display:none!important" in css
    assert "#previewCanvas" in css and "opacity:0!important" in css
    assert "#productionGuideLayer" in css and "background:transparent!important" in css
    assert "--pc-work-ratio" in css


def test_leaflet_and_invitation_fold_guides_are_separated():
    core = text(CORE)
    source = text(GUIDES)

    # 리플렛의 2/3/4단 접지 옵션은 원래 리플렛 폼에만 남아 있어야 한다.
    assert "leaflet:" in core and "hasFold: true" in core
    for fold_key in ("'2fold'", "'3roll'", "'3zfold'", "'4fold'"):
        assert fold_key in core
        assert fold_key in source

    assert "leafletFoldType: byId('foldType')?.value || '3roll'" in source
    assert "if (product === 'leaflet') drawLeafletFolds(ctx, specs, trim);" in source
    assert "리플렛 접지선" in source
    assert "emphasizedFoldLine" in source
    assert "width: 3.4" in source

    # 초대장/안내장은 반접기 또는 접지 없음만 제공한다. 3단/4단은 리플렛 전용이다.
    assert "if (product === 'invitation') drawInvitationFolds(ctx, specs, trim);" in source
    assert "초대장 반접기선" in source
    assert "반접기 · 가운데 1줄" in source
    assert "접지 없음" in source
    assert 'value="tri_z"' not in source
    assert 'value="tri_roll"' not in source
    assert "초대장·안내장은 반접기선만 별도로 표시합니다." in source


def test_program_manual_subsystem_is_not_injected_or_packaged_anymore():
    inject = text(INJECT)
    hosting = text(HOSTING)

    assert "program-manual" not in inject
    assert '"manuals"' not in hosting
    assert "program manual center" not in hosting

    retired = (
        ".github/workflows/manual-sync.yml",
        "css/program-manual-home-modal.css",
        "css/program-manuals.css",
        "docs/manuals/README.md",
        "manuals/index.html",
        "js/program-manuals/app.js",
        "js/program-manuals/catalog.js",
        "js/program-manuals/context-link.js",
        "js/program-manuals/home-modal.js",
        "js/program-manuals/pdf-editor-advanced.js",
        "js/program-manuals/pdf-editor.js",
        "js/program-manuals/pdf-suite.js",
        "js/program-manuals/print-checker.js",
        "js/program-manuals/smart-print-layout.js",
        "scripts/check_manual_sync.py",
        "scripts/run_program_manuals_browser_smoke.sh",
        "scripts/validate_program_manuals.py",
        "tests/browser/program-manuals-smoke.html",
    )
    for relative in retired:
        assert not (ROOT / relative).exists(), relative
