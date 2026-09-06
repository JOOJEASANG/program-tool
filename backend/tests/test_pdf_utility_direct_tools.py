from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BRIDGE = ROOT / "js" / "pdf-suite" / "direct-tool-bridge.js"
HOOK = ROOT / "js" / "pdf-suite" / "direct-tool-hook.js"
HOSTING = ROOT / "scripts" / "prepare_hosting_dist.py"
RUNNER = ROOT / "scripts" / "run_pdf_program_shell_smoke.sh"


def test_pdf_utility_menu_has_direct_workflow_bridge():
    bridge = BRIDGE.read_text(encoding="utf-8")
    hook = HOOK.read_text(encoding="utf-8")

    for marker in (
        "시각적 페이지 정리",
        "빈 페이지 자동 제거",
        "이미지 → PDF",
        "PDF 이미지 변환",
        "여백·크롭·배경",
        "AES-256 암호 설정",
        "암호 해제",
        "PDF 프리플라이트",
        "안전 자동 수정",
        "PDF 압축",
        "문서 구조·인쇄 진단",
        "pdf-utility-direct-tools-v1",
        "/api/pdf-tools/",
        "/api/preflight/check",
        "/api/preflight/auto-fix",
        "/api/pdf-utility/background-cleanup-crop-storage",
    ):
        assert marker in bridge

    assert "PUBLIC_TYPES=new Set(['visual','image-to-pdf','pdf-to-image'])" in bridge
    assert "ProgramStudioPdfUtilityDirectBridge" in bridge
    assert "stopImmediatePropagation" in hook
    assert "pdfUtilityStageBody" in hook
    assert "pdf-utility-direct-hook-v1" in hook


def test_direct_bridge_is_hosted_before_protected_guard_and_browser_smoked():
    hosting = HOSTING.read_text(encoding="utf-8")
    runner = RUNNER.read_text(encoding="utf-8")

    for marker in (
        "data-pdf-suite-direct-tool-bridge",
        "data-pdf-suite-direct-tool-hook",
        "direct-tool-bridge.js?v=20260906-1",
        "direct-tool-hook.js?v=20260906-1",
    ):
        assert marker in hosting

    assert hosting.index("PDF_SUITE_DIRECT_BRIDGE_MARKER") < hosting.index("PDF_SUITE_PROTECTED_GUARD_MARKER")
    assert "pdf-utility-direct-tools-smoke.html" in runner
    assert "PDF Utility menu opens exact workflows directly without a legacy intermediate page" in runner
