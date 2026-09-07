from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CURATED = ROOT / "js" / "pdf-suite" / "curated-core.js"
HOSTING = ROOT / "scripts" / "prepare_hosting_dist.py"
SMOKE = ROOT / "tests" / "browser" / "pdf-utility-curated-core-smoke.html"
RUNNER = ROOT / "scripts" / "run_pdf_program_shell_smoke.sh"


def test_pdf_utility_curated_core_keeps_only_practical_workflows():
    source = CURATED.read_text(encoding="utf-8")

    for marker in (
        "PDF 검사 · 최적화",
        "페이지 · 문서",
        "변환 · OCR",
        "보안 · 정리",
        "'PDF 프리플라이트','PDF 압축','안전 자동 수정'",
        "'PDF 합치기','페이지 추출·나누기','시각적 페이지 정리','빈 페이지 자동 제거','전체 페이지 회전','페이지 순서 역순','여백·크롭·배경'",
        "'이미지 → PDF','PDF 이미지 변환','OCR 검색 가능한 PDF','본문 텍스트 추출 · TXT'",
        "'AES-256 암호 설정','암호 해제','메타데이터 정리','폼 평면화'",
        "['PDF 프리플라이트','PDF 파일 검사']",
        "['PDF 이미지 변환','PDF → 이미지']",
        "['OCR 검색 가능한 PDF','OCR · 검색 가능한 PDF']",
        "pdfUtilityCuratedCore='ready'",
        "pdf-utility-curated-core-v1",
    ):
        assert marker in source

    # These specialist engines remain available internally, but are not part of the curated menu allowlist.
    for non_core in (
        "책갈피·페이지 라벨 분석",
        "접근성·태그 기본 검사",
        "첨부파일 추출",
        "PDF 버전 비교",
        "영구 마스킹·Redaction",
    ):
        assert f"'{non_core}'" not in source.split("const GROUPS=[", 1)[1].split("const ALIASES", 1)[0]


def test_pdf_utility_upload_card_is_forced_to_one_solid_box():
    source = CURATED.read_text(encoding="utf-8")
    for marker in (
        ".pdfu-local-controls .drop",
        "display:flex!important",
        "width:100%!important",
        "border:2px dashed #bfd2e5!important",
        "box-sizing:border-box!important",
        ".pdfu-local-controls .local-head",
        "display:flex!important",
        ".pdfu-local-controls .local-badge",
        "position:static!important",
    ):
        assert marker in source


def test_curated_core_is_staged_and_browser_smoked():
    hosting = HOSTING.read_text(encoding="utf-8")
    smoke = SMOKE.read_text(encoding="utf-8")
    runner = RUNNER.read_text(encoding="utf-8")

    for marker in (
        'PDF_SUITE_CURATED_CORE_MARKER = "data-pdf-suite-curated-core"',
        'curated-core.js?v=20260907-1',
        "PDF_SUITE_CURATED_CORE_SNIPPET",
        "PDF_SUITE_CURATED_CORE_MARKER",
    ):
        assert marker in hosting

    for marker in (
        "PDF 파일 검사",
        "dataset.pdfUtilityCuratedCoreSmoke='pass'",
        "drop.getClientRects().length!==1",
        "PDF file inspection direct panel missing",
        "core menu count",
        "18 essential workflows",
    ):
        assert marker in smoke

    assert "pdf-utility-curated-core-smoke.html" in runner
    assert "curated utility core" in runner
