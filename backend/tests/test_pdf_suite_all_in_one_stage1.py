from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
HUB = ROOT / "pdf-suite" / "index.html"
LOCAL = ROOT / "js" / "pdf-suite" / "local-tools.js"
HOME = ROOT / "js" / "pdf-suite-home-launcher.js"
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


def test_pdf_suite_is_staged_with_approval_guard_and_home_launcher():
    hosting = HOSTING.read_text(encoding="utf-8")
    home = HOME.read_text(encoding="utf-8")

    for marker in (
        'PDF_SUITE_HTML = "pdf-suite/index.html"',
        "data-pdf-suite-auth-guard",
        'programId:"preflight"',
        "pdf-suite-home-launcher.js",
        "_patch_pdf_suite_entry_points()",
    ):
        assert marker in hosting

    for marker in (
        "PDF 올인원 · PDF로 할 수 있는 작업을 한곳에",
        "pdf-suite/",
        "dataPdfSuiteHomeChip",
    ):
        assert marker in home
