from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
REFINE = ROOT / "js" / "home-header-footer-refine.js"


def test_logged_in_greeting_block_is_removed_from_home_body():
    source = REFINE.read_text(encoding="utf-8")
    assert ".greeting{display:none!important}" in source
    assert "function removeGreetingBlock()" in source
    assert "document.getElementById('greeting')?.remove()" in source
    assert "removeGreetingBlock()" in source


def test_home_keeps_one_clear_content_hierarchy_and_restores_console_hero():
    source = REFINE.read_text(encoding="utf-8")
    for marker in (
        "#homeDashboardV2,#homePrintWorkflow,#homePremiumOverview,.home-premium-overview{display:none!important}",
        "function removeDuplicateHomeBlocks()",
        "document.getElementById(id)?.remove()",
        "필요한 프로그램만 선택하세요",
        "body[data-home-clean-simple=\"1\"] .grid{grid-template-columns:repeat(4,minmax(0,1fr))!important",
        "home-console-brand",
        "PRODUCTION STUDIO",
        "PDF 편집·인쇄배치",
        "function decorateHeroConsole()",
        "stage:'home-clean-hierarchy-hero-footer-v2'",
    ):
        assert marker in source
    assert "home-premium-ui.js" not in source
    assert "home-hero-console-v2.js" not in source


def test_footer_business_name_is_kept_once_even_if_other_runtime_adds_it_again():
    source = REFINE.read_text(encoding="utf-8")
    for marker in (
        "function dedupeBusinessName(footer,label,name)",
        "footer.querySelectorAll('.footer-business-name').forEach",
        "if((node.textContent||'').trim()===normalized)node.remove()",
        "currentBusinessName=name",
        "dedupeBusinessName(footer,label,name)",
        "function keepDetailedBusinessHidden()",
    ):
        assert marker in source
