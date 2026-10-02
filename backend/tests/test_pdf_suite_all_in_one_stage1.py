from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HUB = ROOT / "pdf-suite" / "index.html"
LOCAL = ROOT / "js" / "pdf-suite" / "local-tools.js"
CLEAN = ROOT / "js" / "pdf-suite" / "clean-ui.js"
DIRECT_HOOK = ROOT / "js" / "pdf-suite" / "direct-tool-hook.js"
HOME = ROOT / "js" / "pdf-suite-home-launcher.js"
NAV_PREP = ROOT / "js" / "pdf-suite" / "unified-navigation-prep.js"
SINGLE = ROOT / "js" / "pdf-suite" / "single-page-shell.js"
PROTECTED_GUARD = ROOT / "js" / "pdf-suite" / "protected-tool-guard.js"
STABILITY = ROOT / "js" / "pdf-suite" / "workspace-stability.js"
SPECIALIST = ROOT / "js" / "pdf-suite" / "specialist-label.js"
HOSTING = ROOT / "scripts" / "prepare_hosting_dist.py"


def test_pdf_suite_source_is_reduced_to_clean_core_catalog():
    source = HUB.read_text(encoding="utf-8")

    for marker in (
        'data-pdf-suite="workspace-v3"',
        'id="pdfSuiteSourceCatalog"',
        "PDF 유틸리티 준비 중",
        "PDF 합치기",
        "페이지 추출·나누기",
        "시각적 페이지 정리",
        "빈 페이지 자동 제거",
        "전체 페이지 회전",
        "페이지 순서 역순",
        "이미지 → PDF",
        "PDF 이미지 변환",
        "검색 가능한 PDF",
        "텍스트·문서 추출",
        "여백·크롭·배경",
        "AES-256 암호 설정",
        "암호 해제",
        "PDF 프리플라이트",
        "안전 자동 수정",
        "PDF 압축",
        'id="local-tools"',
        'src="../js/pdf-suite/local-tools.js"',
    ):
        assert marker in source

    # The old catalog/roadmap UI is no longer user-facing. The source page only
    # keeps the minimum engine catalog needed by the runtime.
    for retired in (
        'id="suiteSearch"',
        'id="suiteFilters"',
        "하려는 PDF 작업만 찾으면",
        "추가 예정 기능",
        "future-wrap",
        "N-up 다면 배치",
        "소책자·중철 배치",
        "대형 분할 출력",
        "인쇄물 사전 검토",
        "PDF 정밀 편집",
        "메타데이터 정리",
        "폼 평면화",
    ):
        assert retired not in source

    assert '#pdfSuiteSourceCatalog{display:none!important}' in source
    assert 'html:not([data-pdf-utility-layout="centered"]) #pdfUtilitySplit{visibility:hidden!important}' in source


def test_pdf_suite_clean_ui_owns_final_presentation():
    clean = CLEAN.read_text(encoding="utf-8")
    hook = DIRECT_HOOK.read_text(encoding="utf-8")

    for marker in (
        "__programStudioPdfUtilityCleanUiV1",
        "PDF 합치기",
        "PDF 파일 검사",
        "PDF 압축",
        "PDF 암호 설정",
        "pdf-clean-quick-grid",
        "pdfUtilityCleanQuick",
        "pdfuc-categories",
        "pdfuc-modal .pdfuc-dialog",
        "min-height:300px",
        "pdfUtilityCleanUi='ready-v1'",
        "pdfUtilityCorePresentation='clean-16-tools'",
        "pdfUtilityCenteredRefinements='tool-first-v4-large-layout'",
    ):
        assert marker in clean

    for marker in (
        "ensureCenteredWorkspace",
        "ensureCenteredFixes",
        "ensureToolModalFlow",
        "/js/pdf-suite/clean-ui.js?v=20261002-1",
        "__programStudioPdfUtilityCenteredFixesV4",
        "pdf-utility-direct-hook-v3",
    ):
        assert marker in hook

    assert "centered-workspace-fixes.js" not in hook


def test_pdf_suite_local_tools_are_real_local_pdf_operations():
    source = LOCAL.read_text(encoding="utf-8")

    for marker in (
        "pdf-lib@1.17.1",
        "MAX_LOCAL_BYTES=120*1024*1024",
        "rotate(90)",
        "rotate(180)",
        "rotate(270)",
        "reversePages",
        "inspectMetadata",
        "sanitizeMetadata",
        "flattenForm",
        "doc.getForm().flatten()",
        "URL.createObjectURL",
        "서버로 업로드되지 않습니다",
    ):
        assert marker in source

    assert "fetch(" not in source
    assert "XMLHttpRequest" not in source


def test_pdf_suite_is_staged_with_existing_engines_and_clean_final_workspace():
    hosting = HOSTING.read_text(encoding="utf-8")
    home = HOME.read_text(encoding="utf-8")
    nav_prep = NAV_PREP.read_text(encoding="utf-8")
    single = SINGLE.read_text(encoding="utf-8")
    protected_guard = PROTECTED_GUARD.read_text(encoding="utf-8")
    stability = STABILITY.read_text(encoding="utf-8")
    specialist = SPECIALIST.read_text(encoding="utf-8")

    for marker in (
        'PDF_SUITE_HTML = "pdf-suite/index.html"',
        "data-pdf-suite-first-paint-guard",
        "pdf-suite-home-launcher.js?v=20260910-3",
        '"ai-design-maker",',
        '"smart-print-layout",',
        'OUTPUT / "ai-design-maker/index.html"',
        'OUTPUT / "smart-print-layout/index.html"',
        "data-pdf-suite-unified-navigation-prep",
        "unified-navigation-prep.js?v=20260906-2",
        "data-pdf-suite-unified-workspace",
        "unified-workspace.js",
        "data-pdf-suite-single-page-workspace",
        "single-page-shell.js?v=20260911-4",
        "data-pdf-suite-protected-tool-guard",
        "protected-tool-guard.js?v=20260906-1",
        "data-pdf-suite-workspace-stability",
        "workspace-stability.js?v=20260911-2",
        "data-pdf-specialist-label",
        "specialist-label.js?v=20260906-5",
        "_patch_pdf_suite_entry_points()",
    ):
        assert marker in hosting

    # Usage-count/quota injection is retired. Access is handled only by the
    # shared login + administrator-approval gate.
    for retired in (
        "data-pdf-suite-daily-free",
        "pdf-daily-free.js",
        "data-pdf-suite-unified-quota",
        "unified-quota.js",
    ):
        assert retired not in hosting
    assert "guardTool" not in hosting
    assert 'programId:"preflight"' not in hosting

    for marker in (
        "name:'디자인 검토'",
        "name:'AI 디자인 제작'",
        "name:'스마트 인쇄배치'",
        "name:'PDF배치'",
        "name:'PDF편집'",
        "name:'PDF 유틸리티'",
        "print-checker/",
        "smart-print-layout/",
        "pdf-editor/",
        "pdf-editor-advanced",
        "pdf-suite/",
        "normalizePrograms",
        "pdf-home-six-programs-v9",
    ):
        assert marker in home
    assert "id:'booklet'" not in home
    assert home.index("id:'ai-design-maker'") < home.index("id:'smart-print-layout'") < home.index("id:'pdf-editor'") < home.index("id:'pdf-editor-advanced'") < home.index("id:'pdf-suite'")

    # Transitional engine modules remain available, but the source page no
    # longer exposes their old UI. They feed the centered/clean final surface.
    for marker in (
        "removeEditorOwnedUtilityTools",
        "pdfUtilityEditorOverlapRemoved",
        "pdf-editor",
        "pdf-suite-unified-navigation-prep-v2",
    ):
        assert marker in nav_prep

    for marker in (
        "페이지 · 문서",
        "변환 · OCR",
        "편집 · 보안",
        "최적화 · 검사",
        "removeSeparatedTools",
        "pdfu-sidebar",
        "pdfu-stage",
        "activateTool",
        "pdf-utility-split-workspace-v3",
    ):
        assert marker in single

    for marker in (
        "isProtectedSource",
        "showLoginRequired",
        "showAuthChecking",
        "로그인 후 사용",
        "iframe[data-pdfu-frame=\"preflight\"]",
        "pdfUtilityProtectedGuard",
        "pdf-utility-protected-tool-guard-v1",
    ):
        assert marker in protected_guard

    for marker in (
        "pdfu-local-workgrid",
        "pdfu-local-controls",
        "pdfu-local-result",
        "expectedOverlayIds",
        "closeInlineOverlays",
        "wrapDirectBridge",
        "document.body.style.overflow=''",
        "pdfUtilityWorkspaceStability",
        "pdfUtilityMenuAudit",
        "pdf-utility-workspace-stability-v2",
    ):
        assert marker in stability

    for marker in (
        "PDF 편집 · N-UP · 소책자 배치 · Program Studio",
        "removeEditorSidebarShortcuts",
        "pdfEditorSidebarShortcuts='removed'",
        "PDF 유틸리티 내부 엔진",
    ):
        assert marker in specialist

    assert "소책자 · 중철 배치 열기" not in specialist
    assert "프로그램 목록으로 돌아가기" not in specialist
    assert "../booklet/" not in specialist
    assert "pdf-editor-booklet-link" not in specialist
    assert "pdf-editor-specialist-link" not in specialist
    assert "pdfSuiteHomeChip" not in home
