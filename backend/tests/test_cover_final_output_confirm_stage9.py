import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CONFIRM = ROOT / "js" / "cover-final-output-confirm.js"
REGISTER = ROOT / "js" / "sw-register.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_cover_final_output_confirm_behavior.cjs"


def test_cover_final_confirm_loads_after_quality_before_output_guards():
    source = REGISTER.read_text(encoding="utf-8")
    quality = source.index("/js/cover-image-print-quality.js")
    confirm = source.index("/js/cover-final-output-confirm.js")
    output = source.index("/js/cover-output-performance-safety.js")
    assert quality < confirm < output
    assert source.count("coverFinalOutputConfirmScriptV1") == 1


def test_cover_final_confirm_intercepts_only_primary_pdf_once():
    source = CONFIRM.read_text(encoding="utf-8")
    for marker in (
        "const button = byId('pdfBtn')",
        "button.addEventListener('click', stopInitialOutput, { capture: true })",
        "data-cover-output-confirmed-once",
        "trigger.setAttribute(BYPASS_ATTRIBUTE, '1')",
        "trigger.removeAttribute(BYPASS_ATTRIBUTE)",
        "trigger.click()",
        "event.stopImmediatePropagation()",
    ):
        assert marker in source
    install_section = source[source.index("function install()") : source.index("window.CoverFinalOutputConfirm")]
    assert "guidePdfBtn" not in install_section
    assert "pngBtn" not in install_section


def test_cover_final_confirm_runs_preflight_and_blocks_errors():
    source = CONFIRM.read_text(encoding="utf-8")
    for marker in (
        "typeof button?.onclick === 'function' ? button.onclick() : null",
        "summarizePreflight(preflightItems)",
        "blocked: errors > 0",
        "create.disabled = summary.preflight.blocked",
        "오류 수정 필요",
        "important = summary.preflightItems.filter((item) => item.level !== 'ok').slice(0, 8)",
    ):
        assert marker in source


def test_cover_final_confirm_has_compact_accessible_dialog():
    source = CONFIRM.read_text(encoding="utf-8")
    for marker in (
        "role', 'dialog'",
        "aria-modal', 'true'",
        "aria-labelledby', 'coverFinalOutputConfirmTitle'",
        "최종 출력 확인",
        "계속 편집",
        "300DPI PDF 생성",
        "event.key === 'Escape'",
        "@media(max-width:520px)",
        "document.documentElement.style.overflow = 'hidden'",
    ):
        assert marker in source
    assert "setInterval(" not in source
    assert "eval(" not in source


def test_cover_final_confirm_displays_output_contract():
    source = CONFIRM.read_text(encoding="utf-8")
    for marker in (
        "완성 규격",
        "책등 폭",
        "전체 펼침",
        "재단 여백",
        "본문 페이지",
        "이미지 맞춤",
        "저장 파일 · ",
        "_300DPI_RGB.pdf",
        "window.CoverImagePrintQuality?.update?.()",
    ):
        assert marker in source


def test_cover_final_confirm_behavior_executes():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "cover-final-output-confirm behavior passed" in result.stdout
