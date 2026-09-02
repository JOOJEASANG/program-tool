from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_canvas_viewport_smoke_does_not_block_forever_on_animation_frame():
    fixture = read("tests/browser/design-editor-canvas-viewport-smoke.html")
    assert "await waitFor(()=>viewport.scrollLeft>0&&viewport.scrollTop>0,'center scroll');" in fixture
    assert "await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))" not in fixture
    assert "data-canvas-viewport-status=\"pending\"" in fixture
    assert "data.canvasViewportStatus='pass'" not in fixture  # status is written through body.dataset
    assert "document.body.dataset.canvasViewportStatus='pass'" in fixture


def test_canvas_viewport_smoke_keeps_explicit_virtual_time_budget():
    runner = read("scripts/run_design_editor_canvas_viewport_smoke.sh")
    assert "--virtual-time-budget=12000" in runner
    assert 'data-canvas-viewport-status="pass"' in runner
