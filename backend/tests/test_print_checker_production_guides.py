from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
INDEX = ROOT / "print-checker" / "index.html"
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
    assert "/js/print-checker/production-guides-v2.js?v=20260910-1" in index
    for legend in (
        "작업사이즈 전체 — 파란 실선",
        "재단선(실제사이즈) — 빨간 실선",
        "안쪽 여백 — 초록 점선",
        "접는선 — 주황 쇄선",
    ):
        assert legend in index

    assert "v2-transparent-production-overlay" in source
    assert "drawCoverGuides" in source
    assert "뒷면 안쪽 여백" in source
    assert "앞면 안쪽 여백" in source
    assert "drawInvitationFolds" in source
    assert "invitationFoldType" in source
    assert "작업사이즈 전체" in source
    assert "재단선(실제사이즈)" in source
    assert "#previewGuideLayer" in css and "display:none!important" in css
    assert "#previewCanvas" in css and "opacity:0!important" in css
    assert "#productionGuideLayer" in css and "background:transparent!important" in css
    assert "--pc-work-ratio" in css


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
