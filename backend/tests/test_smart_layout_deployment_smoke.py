"""Keep production smoke expectations aligned with the assets being deployed."""
import importlib.util
from pathlib import Path
from urllib.parse import urlparse

import pytest


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "smart_layout_deployment_smoke", ROOT / "scripts/smoke_smart_layout_deployment.py"
)
smoke = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(smoke)


@pytest.fixture
def deployed_assets(monkeypatch):
    assets = {
        "/smart-print-layout": (ROOT / "smart-print-layout/index.html").read_text(encoding="utf-8"),
        "/js/pdf-suite-home-launcher.js": (ROOT / "js/pdf-suite-home-launcher.js").read_text(encoding="utf-8"),
    }

    def fetch_text(base_url, path, timeout):
        return base_url + urlparse(path).path, assets[urlparse(path).path]

    monkeypatch.setattr(smoke, "fetch_text", fetch_text)
    return assets


def test_production_smoke_accepts_current_deployment_assets(deployed_assets):
    smoke.verify("https://example.test", 1)


@pytest.mark.parametrize(
    ("current", "stale"),
    [
        ("pdf-home-six-programs-v10", "pdf-home-six-programs-v9"),
        ("name:'인쇄파일 검토'", "name:'디자인 검토'"),
        ("url:'smart-print-layout/'", "url:'missing-layout/'"),
    ],
)
def test_production_smoke_rejects_stale_or_broken_launcher(deployed_assets, current, stale):
    path = "/js/pdf-suite-home-launcher.js"
    deployed_assets[path] = deployed_assets[path].replace(current, stale)
    with pytest.raises(RuntimeError, match="운영 홈 런처에서 필수 항목"):
        smoke.verify("https://example.test", 1)
