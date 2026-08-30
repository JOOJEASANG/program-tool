from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_divider_modal_browser_smoke_is_part_of_pdf_shell_gate():
    smoke = text("tests/browser/pdf-divider-modal-layout-smoke.html")
    runner = text("scripts/run_pdf_program_shell_smoke.sh")

    assert "data-divider-modal-smoke=\"pending\"" in smoke
    assert "clicking divider must open the modal" in smoke
    assert "footer?.parentElement===controls" in smoke
    assert "local?.parentElement===controls" in smoke
    assert "pdf-divider-modal-layout-smoke.html" in runner
    assert "data-divider-modal-smoke=\"pass\"" in runner
