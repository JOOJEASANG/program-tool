from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_phase18_design_manifest_loads_simple_result_runtime():
    shell = (ROOT / "design-editor" / "index.html").read_text(encoding="utf-8")
    runtime = (ROOT / "js" / "design-editor" / "shell-runtime.js").read_text(encoding="utf-8")
    assert "designSimpleResultWorkflowScriptV1" in runtime
    assert "/js/design-editor/shared/simple-result-workflow.js?v=20260828-1" in runtime
    assert not (ROOT / "js" / "design-editor" / "simple-result-workflow.js").exists()
    assert "const ensureSimpleResultRuntime=ensurePrintRuntimes" in shell
    assert "simpleResultStage:'simple-result-background-logo-text-output-v1'" in shell
    assert "runtimeManifestStage:'design-shell-runtime-manifest-v1'" in shell


def test_phase18_simple_result_keeps_default_workflow_small_and_result_focused():
    source = (ROOT / "js" / "design-editor" / "shared" / "simple-result-workflow.js").read_text(encoding="utf-8")
    for token in (
        "빠른 제작",
        "배경 이미지",
        "로고·사진",
        "제목",
        "본문",
        "날짜·장소",
        "PNG 만들기",
        "PDF 만들기",
        "고급 편집 보기",
        "simpleRole='background'",
        "item.x=-bleed",
        "item.y=-bleed",
        "item.w=Number(p.width)+bleed*2",
        "item.h=Number(p.height)+bleed*2",
        "item.fit='contain'",
        "window.DesignEditorPhase2?.sync?.()",
        "stage:'simple-result-background-logo-text-output-v1'",
    ):
        assert token in source
    assert "marquee" not in source.lower()


def test_phase18_background_aware_output_draws_background_before_content():
    source = (ROOT / "js" / "design-editor" / "shared" / "simple-result-workflow.js").read_text(encoding="utf-8")
    background_draw = "for(const item of extras.filter(item=>item.simpleRole==='background'))"
    text_draw = ".filter(item=>item.visible!==false&&item.type==='text').forEach"
    foreground_draw = "for(const item of extras.filter(item=>item.simpleRole!=='background'))"
    assert background_draw in source
    assert text_draw in source
    assert foreground_draw in source
    assert source.index(background_draw) < source.index(text_draw) < source.index(foreground_draw)
    assert "const DPI=300" in source
    assert "window.DesignEditorFinalPrintCheck?.confirmBeforeOutput" in source


def test_phase18_browser_smoke_covers_basic_result_flow():
    smoke = ROOT / "tests" / "browser" / "design-editor-simple-result-smoke.html"
    runner = (ROOT / "scripts" / "run_design_editor_print_products_smoke.sh").read_text(encoding="utf-8")
    assert smoke.is_file()
    for marker in (
        'data-design-simple-result-status="pass"',
        'data-design-simple-result-flow="background-logo-text-output"',
        'data-design-simple-result-basic="advanced-hidden"',
        'data-design-simple-result-background="bleed-cover-locked"',
        'data-design-simple-result-logo="contain-safe"',
        'data-design-simple-result-output="png-pdf"',
    ):
        assert marker in runner
    source = smoke.read_text(encoding="utf-8")
    assert "simple result workflow" in source.lower()
    assert "background does not cover bleed" in source
    assert "/js/design-editor/shared/simple-result-workflow.js?v=20260828-1" in source
