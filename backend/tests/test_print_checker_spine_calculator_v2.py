from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SPINE = ROOT / "js" / "print-checker" / "spine-calculator-v2.js"
INDEX = ROOT / "print-checker" / "index.html"
SMOKE = ROOT / "tests" / "browser" / "print-checker-spine-calculator-smoke.html"
RUNNER = ROOT / "scripts" / "run_phase5_browser_smoke.sh"


def text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_print_checker_uses_paper_option_only_automatic_spine_calculator():
    index = text(INDEX)
    source = text(SPINE)

    assert "/js/print-checker/spine-calculator-v2.js?v=20260910-1" in index
    assert "BINDING_ALLOWANCE_MM = 0.5" in source
    assert "PAPER_PROFILES" in source
    assert "mojo80" in source and "caliper: 0.090" in source
    assert "mojo100" in source and "caliper: 0.114" in source
    assert "art100" in source and "caliper: 0.081" in source
    assert "snow100" in source and "caliper: 0.081" in source
    assert "Math.ceil(pages / 2)" in source
    assert "spine.readOnly = true" in source
    assert "v2-automatic-paper-profile" in source

    for retired_manual_input in (
        "paperGsmV2",
        "paperCaliperV2",
        "spineAllowanceV2",
        "직접 입력 중",
    ):
        assert retired_manual_input not in source


def test_spine_browser_smoke_covers_published_paper_profiles_and_read_only_result():
    smoke = text(SMOKE)
    runner = text(RUNNER)

    assert "spine.value==='9.5'" in smoke
    assert "spine.value==='11.9'" in smoke
    assert "spine.value==='8.6'" in smoke
    assert "spine.value==='15.1'" in smoke
    assert "spine.readOnly===true" in smoke
    assert "option[value=\"custom\"]" in smoke
    assert "print-checker-spine-calculator-smoke.html" in runner
    assert "retrying once with a fresh profile" in runner
    assert "did not reach its completion marker" in runner
