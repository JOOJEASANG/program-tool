import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "js" / "desktop-tool-mobile-notice.js"
REGISTER = ROOT / "js" / "sw-register.js"
BEHAVIOR = ROOT / "backend" / "tests" / "test_desktop_tool_mobile_notice_behavior.cjs"


def test_desktop_tool_mobile_notice_loads_for_both_desktop_tools_once():
    source = REGISTER.read_text(encoding="utf-8")
    marker = "desktopToolMobileNoticeScriptV1"
    assert source.count(marker) == 1
    assert source.count("/js/desktop-tool-mobile-notice.js") == 1
    notice = source.index(marker)
    assert notice < source.index("pdfEditorModuleLoaderScript")
    assert notice < source.index("perfectBindingFineControlsScript")
    for path in (
        "/tools/pdf-editor.html",
        "/pdf-editor",
        "/pdf-editor/index.html",
        "/tools/perfect-binding-cover.html",
        "/perfect-binding-cover",
        "/perfect-binding-cover/index.html",
    ):
        assert path in source


def test_desktop_tool_mobile_notice_is_nonblocking_and_does_not_touch_editors():
    source = MODULE.read_text(encoding="utf-8")
    for marker in (
        "PC에서 이용해 주세요",
        "오늘 하루 다시 보지 않기",
        "그래도 계속 보기",
        "도구 목록으로",
        "isMobileEnvironment",
        "userAgentData?.mobile",
        "(pointer: coarse)",
        "(max-width: 900px)",
        "role', 'dialog'",
        "aria-modal",
        "nonblocking-mobile-pc-recommendation",
    ):
        assert marker in source
    for forbidden in (
        "location.replace(",
        "location.href =",
        "setInterval(",
        "window.state",
        "state.layout",
        "renderCover",
        "buildAllPages",
        "PDFDocument",
    ):
        assert forbidden not in source


def test_desktop_tool_mobile_notice_behavior_executes():
    result = subprocess.run(
        ["node", str(BEHAVIOR)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    assert "desktop-tool-mobile-notice behavior passed" in result.stdout
