"""The former cover studio is an upload-first design bleed finisher."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def run_node(path):
    result = subprocess.run(
        ['node', str(ROOT / path)], cwd=ROOT,
        text=True, capture_output=True, check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    return result.stdout


def test_cover_studio_replaced_by_existing_file_print_finisher():
    html=read('ai-design-maker/index.html')
    home=read('index.html')
    launcher=read('js/pdf-suite-home-launcher.js')
    manual=read('js/program-manuals/ai-design-maker.js')
    for marker in ('<title>인쇄 디자인 보완 · Program Studio</title>',
                   'id="fileInput"', 'id="bleedMm"', 'id="processBtn"',
                   'value="leaflet2"', 'value="leaflet3"'):
        assert marker in html
    assert 'id="generateBtn"' not in html
    assert 'src="/js/ai-design-maker.js' not in html
    assert "name:'인쇄 디자인 보완'" in home
    assert "name:'인쇄 디자인 보완'" in launcher
    assert '거울 확장' in manual


def test_legacy_cover_engine_is_archived_but_not_loaded_by_finisher():
    editor=read('js/ai-design-maker.js')
    modes=read('js/design-workshop-modes.js')
    page=read('ai-design-maker/index.html')
    assert "const WORKSHOP = 'cover'" in editor
    assert "const LEGACY_STORAGE_KEY = 'program-studio:ai-design-maker:cover:v1'" in editor
    assert "const normalizeMode=(_studio,mode)=>COVER_MODES.has(mode)?mode:'spread'" in modes
    assert '/js/ai-design-maker.js?v=20261028-5' not in page
    assert '/js/design-workshop-modes.js?v=20261028-3' not in page
    assert '/js/design-bleed-enhancer.js?v=20261123-3' in page


def test_legacy_spine_math_and_cover_preview_helpers_remain_consistent():
    assert 'calculator behavior passed' in run_node('backend/tests/design_workshop_calculator.cjs')
    assert 'cover-only design studio behavior passed' in run_node('backend/tests/design_workshop_preview_behavior.cjs')


def test_new_name_and_help_are_consistent_and_original_route_survives():
    index=read('index.html');launcher=read('js/pdf-suite-home-launcher.js')
    page=read('ai-design-maker/index.html')
    catalog=read('js/program-manuals/catalog.js')
    manual=read('js/program-manuals/ai-design-maker.js')
    for content in (index,launcher):
        assert "name:'인쇄 디자인 보완'" in content
        assert "url:'ai-design-maker/'" in content
    assert '<h1>인쇄 디자인 보완</h1>' in page
    assert "name:'인쇄 디자인 보완'" in manual
    assert '홈에서는 인쇄 디자인 보완, 문서 편집, PDF 유틸리티' in catalog
