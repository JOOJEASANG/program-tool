from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TYPOGRAPHY = ROOT / "js" / "design-editor" / "typography-pro.js"
OUTPUT = ROOT / "js" / "design-editor" / "output.js"
BOOT = ROOT / "js" / "app-boot-guard.js"
FIREBASE = ROOT / "firebase.json"
BROWSER_SUITE = ROOT / "scripts" / "run_design_editor_browser_smoke.sh"


def test_stage68_open_font_catalog_is_explicitly_separated_from_system_fonts():
    source = TYPOGRAPHY.read_text(encoding="utf-8")
    assert "무료 · 상업적 사용 허용 오픈소스" in source
    assert "SIL OFL 1.1" in source
    assert "Noto Sans KR" in source
    assert "Noto Serif KR" in source
    assert "Nanum Gothic" in source
    assert "Nanum Myeongjo" in source
    assert "Black Han Sans" in source
    assert "PC 설치 글꼴" in source
    assert "사진·로고·외부 이미지의 권리는 별도" in source


def test_stage68_google_font_hosts_are_allowed_by_hosting_csp():
    source = FIREBASE.read_text(encoding="utf-8")
    assert "https://fonts.googleapis.com" in source
    assert "https://fonts.gstatic.com" in source


def test_stage68_detailed_typography_only_exposes_values_supported_by_print_output():
    typography = TYPOGRAPHY.read_text(encoding="utf-8")
    output = OUTPUT.read_text(encoding="utf-8")
    for token in ("letterSpacing", "lineHeight", "titleStyle", "titleAccent"):
        assert token in typography
        assert token in output
    assert "drawTitleDecoration" in output
    assert "Number(item.letterSpacing)" in output
    assert "Number(item.lineHeight)" in output
    assert "bleedPx+Number(item.x||0)*PX_PER_MM" in output
    assert "bleedPx+Number(item.y||0)*PX_PER_MM" in output


def test_stage68_typography_runtime_is_deployed_and_browser_tested():
    boot = BOOT.read_text(encoding="utf-8")
    suite = BROWSER_SUITE.read_text(encoding="utf-8")
    assert "designTypographyProScriptV1" in boot
    assert "/js/design-editor/typography-pro.js?v=20260903-1" in boot
    assert "run_design_editor_typography_pro_smoke.sh" in suite
