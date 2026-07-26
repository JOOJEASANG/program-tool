from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
MAIN_PATH = BACKEND_ROOT / "main.py"
SERVICES_ROOT = BACKEND_ROOT / "services"


def test_services_contains_no_runtime_patch_modules():
    patch_modules = sorted(
        path.relative_to(BACKEND_ROOT).as_posix()
        for path in SERVICES_ROOT.rglob("*_patch.py")
    )
    assert patch_modules == []


def test_startup_does_not_import_patch_modules():
    source = MAIN_PATH.read_text(encoding="utf-8")
    assert "_patch" not in source
    assert "monkeypatch" not in source.lower()


def test_services_do_not_install_runtime_function_replacements():
    forbidden_markers = (
        "_patch_v",
        "sys.modules[",
        "setattr(pdf_ops",
        "pdf_ops.process_pdf =",
        "preflight_svc.run_all_checks =",
        "preflight_router._fix_pdf_response =",
    )

    findings: list[str] = []
    for path in SERVICES_ROOT.rglob("*.py"):
        source = path.read_text(encoding="utf-8")
        for marker in forbidden_markers:
            if marker in source:
                findings.append(f"{path.relative_to(BACKEND_ROOT)}: {marker}")

    assert findings == []
