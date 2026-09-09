from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SPINE = ROOT / "js" / "print-checker" / "spine-calculator-v2.js"
INDEX = ROOT / "print-checker" / "index.html"
SMOKE = ROOT / "tests" / "browser" / "print-checker-spine-calculator-smoke.html"
RUNNER = ROOT / "scripts" / "run_phase5_browser_smoke.sh"


def text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_print_checker_loads_gsm_and_allowance_spine_calculator():
    index = text(INDEX)
    source = text(SPINE)

    assert "/js/print-checker/spine-calculator-v2.js?v=20260909-1" in index
    assert "DEFAULT_ALLOWANCE_MM = 0.5" in source
    assert "paperGsmV2" in source
    assert "spineAllowanceV2" in source
    assert "paperCaliperV2" in source
    assert "Math.ceil(pages / 2)" in source
    assert "gsm * profile.bulk / 1000" in source
    assert "body + allowance" in source
    assert "평량·장수·제본 여유 반영" in source
    assert "v2-gsm-allowance" in source


def test_spine_browser_smoke_covers_standard_and_custom_paper_paths():
    smoke = text(SMOKE)
    runner = text(RUNNER)

    assert "spine.value==='4.5'" in smoke
    assert "spine.value==='5.5'" in smoke
    assert "spine.value==='6.0'" in smoke
    assert "spine.value==='6.5'" in smoke
    assert "100p = 50장" in smoke
    assert "print-checker-spine-calculator-smoke.html" in runner
    assert "retrying once with a fresh profile" in runner
    assert "did not reach its completion marker" in runner
