import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
FIREBASE = ROOT / "firebase.json"
SHELL = ROOT / "design-editor" / "index.html"
SMOKE = ROOT / "scripts" / "smoke_deployment.py"


def global_headers():
    config = json.loads(FIREBASE.read_text(encoding="utf-8"))
    header_rules = config["hosting"]["headers"]
    global_rule = next(rule for rule in header_rules if rule["source"] == "**")
    return {item["key"].lower(): item["value"] for item in global_rule["headers"]}


def test_unified_design_shell_embeds_same_origin_editors_without_legacy_editor_fallback():
    source = SHELL.read_text(encoding="utf-8")
    assert 'id="editorFrame"' in source
    assert '/design-editor/general?embed=1&mode=cover&preset=cover-a4' in source
    assert "return `/design-editor/general?${query.toString()}`" in source
    assert "legacyCoverFallback:" not in source
    assert "single-sidebar-general-engine-shell-no-legacy-fallback" in source


def test_firebase_headers_allow_only_same_origin_embedding():
    headers = global_headers()
    assert headers["x-frame-options"] == "SAMEORIGIN"
    csp = headers["content-security-policy"]
    assert "frame-ancestors 'self'" in csp
    assert "frame-ancestors 'none'" not in csp
    assert "frame-src 'self'" in csp


def test_deployment_smoke_checks_design_editor_shell_unified_cover_and_retired_compatibility_url():
    source = SMOKE.read_text(encoding="utf-8")
    for marker in (
        '"/design-editor"',
        '"/design-editor/general?embed=1&mode=cover&preset=cover-a4"',
        '"디자인 편집기 셸"',
        '"디자인 편집기 통합 표지 모드"',
        '"/perfect-binding-cover/?embed=1&mode=cover"',
        '"레거시 표지 호환 경로"',
        "_require_same_origin_frame_headers",
        '"SAMEORIGIN"',
        '"frame-ancestors \'self\'"',
    ):
        assert marker in source
