from __future__ import annotations

import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def load_prepare_module():
    script_path = ROOT / "scripts" / "prepare_pdf_editor_runtime.py"
    spec = importlib.util.spec_from_file_location("prepare_pdf_editor_runtime", script_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_pdf_editor_runtime_rewrites_remote_dependencies(tmp_path, monkeypatch):
    module = load_prepare_module()
    editor = tmp_path / "index.html"
    editor.write_text(
        "\n".join(
            [
                '<script src="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js"></script>',
                '<script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>',
                "pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';",
            ]
        ),
        encoding="utf-8",
    )
    vendor = []
    for name in ("pdf.min.js", "pdf.worker.min.js", "jspdf.umd.min.js"):
        path = tmp_path / name
        path.write_text("runtime", encoding="utf-8")
        vendor.append(path)

    monkeypatch.setattr(module, "EDITOR_HTML", editor)
    monkeypatch.setattr(module, "VENDOR_FILES", tuple(vendor))

    assert module.prepare() is True
    rewritten = editor.read_text(encoding="utf-8")
    assert "/vendor/pdf.min.js" in rewritten
    assert "/vendor/pdf.worker.min.js" in rewritten
    assert "/vendor/jspdf.umd.min.js" in rewritten
    assert "cdn.jsdelivr.net/npm/pdfjs-dist" not in rewritten
    assert "cdn.jsdelivr.net/npm/jspdf" not in rewritten
    assert module.prepare() is False


def test_pdf_runtime_is_prepared_before_every_firebase_deploy():
    command = "bash scripts/prepare_pdf_vendor.sh"
    rewrite = "python3 scripts/prepare_pdf_editor_runtime.py"
    deploy = (ROOT / ".github" / "workflows" / "firebase-deploy.yml").read_text(encoding="utf-8")
    preview = (ROOT / ".github" / "workflows" / "firebase-preview.yml").read_text(encoding="utf-8")
    quality = (ROOT / ".github" / "workflows" / "quality-gate.yml").read_text(encoding="utf-8")

    assert deploy.index(command) < deploy.index("firebase deploy")
    assert deploy.index(rewrite) < deploy.index("firebase deploy")
    assert preview.index(command) < preview.index("firebase hosting:channel:deploy")
    assert preview.index(rewrite) < preview.index("firebase hosting:channel:deploy")
    assert quality.index(command) < quality.index("Validate static asset paths")


def test_service_worker_precaches_local_pdf_runtime():
    service_worker = (ROOT / "sw.js").read_text(encoding="utf-8")
    assert "'/pdf-editor/index.html'" in service_worker
    assert "'/vendor/pdf.min.js'" in service_worker
    assert "'/vendor/pdf.worker.min.js'" in service_worker
    assert "'/vendor/jspdf.umd.min.js'" in service_worker


def test_pdf_editor_source_contains_transformable_dependency_versions():
    source = (ROOT / "pdf-editor" / "index.html").read_text(encoding="utf-8")
    assert "pdfjs-dist@3.11.174/build/pdf.min.js" in source
    assert "pdfjs-dist@3.11.174/build/pdf.worker.min.js" in source
    assert "jspdf@2.5.1/dist/jspdf.umd.min.js" in source
