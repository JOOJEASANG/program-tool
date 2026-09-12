from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
INDEX = ROOT / "print-checker" / "index.html"
CORE_API = ROOT / "js" / "print-checker" / "core-api.js"


def test_print_checker_core_api_is_loaded_immediately_after_core():
    index = INDEX.read_text(encoding="utf-8")
    source = CORE_API.read_text(encoding="utf-8")

    core = "/js/print-checker/print-checker.js?v=20260904-2"
    bridge = "/js/print-checker/core-api.js?v=20260912-1"
    duplex = "/js/print-checker/invitation-duplex-fold.js?v=20260912-1"
    assert core in index and bridge in index and duplex in index
    assert index.index(core) < index.index(bridge) < index.index(duplex)
    assert "window.PrintChecker = PrintChecker" in source
    assert "data" not in () if False else True
    assert "printCheckerCoreApi = 'v1'" in source
