"""Saved paper sizes must be shared by all genuine output-paper controls."""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]


def read(path):
    return (ROOT/path).read_text(encoding="utf-8")


def test_all_print_paper_workbenches_load_shared_favorites():
    for page in ("smart-print-layout/index.html","pdf-editor/index.html",
                 "pdf-editor-advanced/index.html","ai-design-maker/index.html"):
        html=read(page)
        assert "shared-paper-favorites.js?v=20261124-1" in html, page


def test_schema_migrates_existing_smart_layout_presets_without_copying():
    shared=read("js/shared-paper-favorites.js")
    smart=read("js/smart-print-layout/paper-presets.js")
    key="program-studio.smart-print.paper-presets.v1"
    assert key in shared
    assert key in smart
    assert "function load()" in shared
    assert "function save(name,width,height)" in shared
    assert "function remove(id)" in shared
    assert "function apply(a,item)" in shared
    assert "savedPaper" in smart or "data-saved-paper" in smart
    assert "MAX=30" in shared and "MAX_PRESETS = 30" in smart


def test_saved_size_applies_through_each_editors_own_change_events():
    shared=read("js/shared-paper-favorites.js")
    for marker in ("'paperSize'","'advancedPaperSize'","'sizePreset'"):
        assert marker in shared
    assert "a.target.value='custom'" in shared
    assert "trigger(a.target,'change')" in shared
    assert "trigger(a.w,'change');trigger(a.h,'change')" in shared
    assert "window.addEventListener('storage'" in shared
    assert "SharedPaperFavorites={load,save,remove" in shared
    assert "localStorage.setItem(KEY" in shared
    assert "same browser" not in shared.lower() or "같은 브라우저" in shared


def test_manuals_disclose_shared_local_browser_storage():
    for path in ("js/program-manuals/ai-design-maker.js",
                 "js/program-manuals/smart-print-layout.js",
                 "js/program-manuals/pdf-editor.js",
                 "js/program-manuals/pdf-editor-advanced.js"):
        manual=read(path)
        assert "updated: '2026-11-24'" in manual, path
        assert "브라우저" in manual and ("저장" in manual or "공유" in manual),path


def test_ai_bleed_opt_in_is_separate_from_free_modes():
    html=read("ai-design-maker/index.html")
    js=read("js/design-bleed-enhancer.js")
    for token in ('value="ai"','id="aiQuality"','id="aiSide"','id="aiConsent"',
                  'id="aiBleedOptions" hidden','id="aiDirection"'):
        assert token in html
    assert "params.edge_mode==='ai'" in js
    assert "window.confirm(" in js
    assert "state.pages<=2" in js
    assert "ai_quality:$('aiQuality').value" in js
    assert "ai_side:$('aiSide').value" in js
    assert "ai_direction:$('aiDirection').value.trim()" in js
    assert "$('aiConsent').checked" in js
    service=read("backend/services/design_bleed_extension.py")
    assert 'MODES = {"mirror", "edge", "ai"}' in service
    assert 'if edge_mode == "ai"' in service
    assert '_insert_ai_border(page, generated, trim, bpt, ai_side)' in service
    router=read("backend/routers/design_bleed.py")
    assert 'with guard_ai_usage(uid, "image"):' in router
    assert 'outpaint_bleed(' in router
