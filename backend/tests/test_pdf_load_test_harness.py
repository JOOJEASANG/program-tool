import base64
import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[2]


def _load(path: str, name: str):
    source = ROOT / path
    spec = importlib.util.spec_from_file_location(name, source)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _jwt(payload: dict) -> str:
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    encoded = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    return f"e30.{encoded}.signature"


def test_pdf_load_fixture_is_exact_size_and_stays_openable(tmp_path):
    generator = _load("scripts/generate_pdf_load_fixture.py", "load_fixture_generator")
    output = tmp_path / "fixture.pdf"

    result = generator.create_fixture(output, size_mb=1, pages=2)

    assert result == {"bytes": 1024 * 1024, "pages": 2}
    assert output.stat().st_size == 1024 * 1024
    document = fitz.open(str(output))
    try:
        assert document.page_count == 2
    finally:
        document.close()


def test_pdf_load_runner_builds_storage_job_contract_without_trusting_token():
    runner = _load("scripts/run_pdf_storage_load_test.py", "pdf_load_runner")

    assert runner.decode_uid(_jwt({"sub": "load-test-user"})) == "load-test-user"
    assert runner.build_settings(2, "basic") == {
        "pages": [
            {"file_index": 0, "page_index": 0},
            {"file_index": 1, "page_index": 0},
        ],
        "nup_default": 1,
    }
    assert runner.build_settings(1, "advanced") == {
        "pages": [{"file_index": 0, "page_index": 0}]
    }


def test_pdf_load_runner_is_inert_without_explicit_confirmation(tmp_path):
    generator = _load("scripts/generate_pdf_load_fixture.py", "load_fixture_generator_dry")
    output = tmp_path / "fixture.pdf"
    generator.create_fixture(output, size_mb=1, pages=1)

    env = dict(os.environ)
    env.pop("FIREBASE_ID_TOKEN", None)
    result = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts" / "run_pdf_storage_load_test.py"),
            str(output),
            "--jobs",
            "3",
        ],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )

    assert result.returncode == 0
    assert "DRY RUN ONLY" in result.stdout
    assert "total_staged_bytes=3145728" in result.stdout
    assert "FIREBASE_ID_TOKEN" not in result.stderr


def test_pdf_load_runner_rejects_unsafe_job_count(tmp_path):
    runner = _load("scripts/run_pdf_storage_load_test.py", "pdf_load_runner_limits")
    output = tmp_path / "tiny.pdf"
    output.write_bytes(b"%PDF-1.4\n%%EOF\n")

    try:
        runner.validate_inputs([output], 11)
    except ValueError as exc:
        assert "jobs must be between 1 and 10" in str(exc)
    else:
        raise AssertionError("expected unsafe job count rejection")
