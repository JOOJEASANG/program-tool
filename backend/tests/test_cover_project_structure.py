from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_cover_project_v2_persists_extended_editor_state():
    source = _read("js/cover-editor-preflight-project.js")

    assert "const PROJECT_VERSION = 2;" in source
    assert "extended: bridge()?.snapshot?.() || null" in source
    assert "bridge()?.restore?.(data.extended || data.projectState || null)" in source


def test_cover_state_bridge_covers_text_and_image_modules():
    source = _read("js/cover-project-state-bridge.js")

    assert "textZones: getTextZones()" in source
    assert "imageEffects: getImageEffects()" in source
    assert "setTextZones(data.textZones)" in source
    assert "setImageEffects(data.imageEffects)" in source


def test_cover_helper_loading_is_ordered_and_bridge_is_last():
    source = _read("js/sw-register.js")

    assert "s.async=false" in source
    text_index = source.index("coverTextZonesScriptV3")
    preview_index = source.index("coverPreviewWorkspaceScriptV2")
    bridge_index = source.index("coverProjectStateBridgeScriptV1")
    assert text_index < preview_index < bridge_index


def test_cover_text_module_has_no_infinite_interval():
    source = _read("js/cover-editor-text-zones-v2.js")

    assert "setInterval(" not in source
    assert "attempt < 20" in source
