from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_pdf_runtime_script_pins_dependencies_and_rewrites_all_urls():
    script = read("scripts/prepare_pdf_runtime.mjs")

    assert "process.platform === 'win32' ? 'npm.cmd' : 'npm'" in script
    assert "pdfjs-dist@3.11.174" in script
    assert "jspdf@2.5.1" in script
    assert "'/vendor/pdf.min.js'" in script
    assert "'/vendor/pdf.worker.min.js'" in script
    assert "'/vendor/jspdf.umd.min.js'" in script
    assert "Remote PDF runtime path remains" in script


def test_firebase_hosting_predeploy_prepares_pdf_runtime_for_manual_deploys():
    config = json.loads(read("firebase.json"))
    predeploy = config["hosting"]["predeploy"]

    assert predeploy == ["node scripts/prepare_pdf_runtime.mjs"]


def test_actions_prepare_pdf_runtime_before_validation_and_deployment():
    command = "node scripts/prepare_pdf_runtime.mjs"
    deploy = read(".github/workflows/firebase-deploy.yml")
    preview = read(".github/workflows/firebase-preview.yml")
    quality = read(".github/workflows/quality-gate.yml")

    assert deploy.index(command) < deploy.index("firebase deploy")
    assert preview.index(command) < preview.index("firebase hosting:channel:deploy")
    assert quality.index(command) < quality.index("Validate static asset paths")
    assert "prepare_pdf_vendor.sh" not in deploy + preview + quality
    assert "prepare_pdf_editor_runtime.py" not in deploy + preview + quality


def test_service_worker_precaches_local_pdf_runtime():
    service_worker = read("sw.js")

    assert "'/pdf-editor/index.html'" in service_worker
    assert "'/vendor/pdf.min.js'" in service_worker
    assert "'/vendor/pdf.worker.min.js'" in service_worker
    assert "'/vendor/jspdf.umd.min.js'" in service_worker


def test_pdf_editor_source_contains_transformable_dependency_versions():
    source = read("pdf-editor/index.html")

    assert "pdfjs-dist@3.11.174/build/pdf.min.js" in source
    assert "pdfjs-dist@3.11.174/build/pdf.worker.min.js" in source
    assert "jspdf@2.5.1/dist/jspdf.umd.min.js" in source
