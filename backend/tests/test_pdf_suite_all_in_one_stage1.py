from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HUB = ROOT / "pdf-suite" / "index.html"
LOCAL = ROOT / "js" / "pdf-suite" / "local-tools.js"
HOME = ROOT / "js" / "pdf-suite-home-launcher.js"
NAV_PREP = ROOT / "js" / "pdf-suite" / "unified-navigation-prep.js"
SINGLE = ROOT / "js" / "pdf-suite" / "single-page-shell.js"
SPECIALIST = ROOT / "js" / "pdf-suite" / "specialist-label.js"
HOSTING = ROOT / "scripts" / "prepare_hosting_dist.py"


def test_pdf_suite_exposes_eight_real_work_areas_and_separates_planned_tools():
    source = HUB.read_text(encoding="utf-8")

    for marker in (
        "01 · PAGE & DOCUMENT",
        "02 · CONVERT & EXTRACT",
        "03 · EDIT & LAYOUT",
        "04 · SECURITY & PRIVACY",
        "05 · PRINT & PUBLISHING",
        "06 · SCAN & OCR",
        "07 · OPTIMIZE & COMPATIBILITY",
        "08 · INSPECT & ANALYZE",
        "PDF 합치기",
        "페이지 추출·나누기",
        "PDF 프리플라이트",
        "AES-256 암호 설정",
        "N-up 다면 배치",
        "대형 분할 출력",
        "data-status=\"planned\"",
        "한국어 OCR",
        "PDF/A",
        "영구 Redaction",
        "전자서명",
    ):
        assert marker in source

    assert 'href="../pdf-preflight/"' in source
    assert 'href="../pdf-editor/"' in source
    assert 'href="../print-checker/"' in source
    assert 'src="../js/pdf-suite/local-tools.js"' in source


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


def test_pdf_suite_is_staged_with_combined_editor_and_split_utility_workspace():
    hosting = HOSTING.read_text(encoding="utf-8")
    home = HOME.read_text(encoding="utf-8")
    nav_prep = NAV_PREP.read_text(encoding="utf-8")
    single = SINGLE.read_text(encoding="utf-8")
    specialist = SPECIALIST.read_text(encoding="utf-8")

    for marker in (
        'PDF_SUITE_HTML = "pdf-suite/index.html"',
        "data-pdf-suite-daily-free",
        "pdf-daily-free.js",
        "pdf-suite-home-launcher.js?v=20260906-5",
        "data-pdf-suite-unified-navigation-prep",
        "unified-navigation-prep.js?v=20260906-2",
        "data-pdf-suite-unified-workspace",
        "unified-workspace.js",
        "data-pdf-suite-unified-quota",
        "unified-quota.js",
        "data-pdf-suite-single-page-workspace",
        "single-page-shell.js?v=20260906-3",
        "data-pdf-specialist-label",
        "specialist-label.js?v=20260906-5",
        "_patch_pdf_suite_entry_points()",
    ):
        assert marker in hosting

    assert "guardTool" not in hosting
    assert 'programId:"preflight"' not in hosting

    for marker in (
        "name:'인쇄물 사전 검토'",
        "name:'PDF 편집 · N-UP · 소책자 배치'",
        "name:'PDF 유틸리티'",
        "print-checker/",
        "pdf-editor/",
        "pdf-suite/",
        "normalizePrograms",
        "pdf-home-three-programs-v5",
    ):
        assert marker in home
    assert "id:'booklet'" not in home

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
        "N-up 다면 배치",
        "소책자·중철 배치",
        "책자 출력 배치",
        "인쇄물 사전 검토",
        "removeSeparatedTools",
        "pdfu-sidebar",
        "pdfu-stage",
        "작업 · 실시간 결과 화면",
        "activateTool",
        "mountFrame",
        "pdf-utility-split-workspace-v3",
    ):
        assert marker in single

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
