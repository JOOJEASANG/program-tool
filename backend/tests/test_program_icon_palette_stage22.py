from pathlib import Path
import json
import re


ROOT = Path(__file__).resolve().parents[2]
PALETTE = ROOT / "js" / "admin-program-icon-palette.js"
SW_REGISTER = ROOT / "js" / "sw-register.js"
MANAGER = ROOT / "js" / "admin-program-catalog-manager.js"
VERSION_JSON = ROOT / "version.json"


def test_program_icon_palette_has_rich_grouped_selection():
    source = PALETTE.read_text(encoding="utf-8")
    assert "categorized-program-icon-picker" in source
    for label in [
        "문서·PDF",
        "인쇄·출판",
        "이미지·디자인",
        "사무·파일",
        "교육·행사",
        "AI·기술",
        "도구·설정",
        "업무·소통",
        "기타·추천",
    ]:
        assert label in source

    icon_pairs = re.findall(r"\['([^']+)'\s*,\s*'([^']+)'\]", source)
    assert len(icon_pairs) >= 100
    icons = {icon for icon, _ in icon_pairs}
    assert len(icons) >= 95
    for icon in ["📄", "🖨️", "📚", "🖼️", "🏆", "🤖", "⚙️", "💼", "🚀"]:
        assert icon in icons


def test_icon_picker_preserves_direct_input_and_catalog_change_events():
    palette = PALETTE.read_text(encoding="utf-8")
    manager = MANAGER.read_text(encoding="utf-8")
    assert 'input[data-prog-field="icon"]' in palette
    assert "dispatchEvent(new Event('input'" in palette
    assert "dispatchEvent(new Event('change'" in palette
    assert "목록에서 고르거나 위 입력칸에 원하는 이모지를 직접 입력" in palette
    assert 'data-prog-field="icon"' in manager
    assert 'maxlength="12"' in manager


def test_admin_loaders_include_icon_palette_and_runtime_cache_bump():
    sw_register = SW_REGISTER.read_text(encoding="utf-8")
    release = json.loads(VERSION_JSON.read_text(encoding="utf-8"))
    expected_version = str(release["version"]).strip()
    expected = "/js/admin-program-icon-palette.js?v=20260808-1"
    assert expected in sw_register
    assert "adminProgramIconPaletteScriptV1" in sw_register
    assert f"const VERSION='{expected_version}'" in sw_register
    assert "load('appVersionHelperScript','/js/app-version.js?v='+VERSION)" in sw_register
