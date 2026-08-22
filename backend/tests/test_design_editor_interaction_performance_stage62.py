from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SIMPLE = ROOT / "js" / "design-editor" / "phase16-simple-interface.js"
SNAP = ROOT / "js" / "design-editor" / "phase19-smart-snap.js"
REGISTER = ROOT / "js" / "sw-register.js"


def test_interaction_modules_use_fresh_runtime_cache_versions():
    source = REGISTER.read_text(encoding="utf-8")
    assert "/js/design-editor/phase16-simple-interface.js?v=20260823-2" in source
    assert "/js/design-editor/phase19-smart-snap.js?v=20260823-2" in source


def test_simple_sidebar_coalesces_multiple_dom_events_into_one_pending_frame_chain():
    source = SIMPLE.read_text(encoding="utf-8")
    for marker in (
        "let syncFrame=0",
        "if(syncFrame)return",
        "syncFrame=requestAnimationFrame",
        "syncFrame=0;",
        "sync();",
    ):
        assert marker in source
    assert "function queueSync(){requestAnimationFrame(()=>requestAnimationFrame(sync));}" not in source


def test_smart_snap_runs_at_most_once_per_animation_frame_and_flushes_last_move():
    source = SNAP.read_text(encoding="utf-8")
    for marker in (
        "let moveFrame=0",
        "if(!moving||!event.buttons||moveFrame)return",
        "moveFrame=requestAnimationFrame",
        "function flushPendingSnap()",
        "cancelAnimationFrame(moveFrame)",
        "if(moving)smartSnap()",
        "flushPendingSnap();",
    ):
        assert marker in source
    finish = source[source.index("function finishPointer()") : source.index("function bindEvents()")]
    assert finish.index("flushPendingSnap();") < finish.index("moving=false")


def test_interaction_performance_changes_remain_event_driven():
    for path in (SIMPLE, SNAP):
        source = path.read_text(encoding="utf-8")
        assert "MutationObserver" not in source
        assert "setInterval(" not in source
        assert "eval(" not in source
