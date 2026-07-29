from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOADER = ROOT / 'js' / 'pdf-editor' / 'loader.js'
TOOL = ROOT / 'tools' / 'pdf-editor.html'
ROUTE = ROOT / 'pdf-editor' / 'index.html'

JULY20_MODULES = [
    '/js/pdf-editor/font-render-fix.js',
    '/js/pdf-editor/upload-fix.js',
    '/js/pdf-editor/live-preview.js',
    '/js/pdf-editor/layout-export.js',
    '/js/pdf-editor/page-count-hint.js',
    '/js/pdf-editor/nup-helper.js',
    '/js/pdf-editor/preview-row-default.js',
    '/js/pdf-editor/divider-helper.js',
    '/js/pdf-editor/storage-cleanup.js',
    '/js/pdf-editor/history-policy.js',
]

def test_loader_is_exact_july20_runtime():
    text = LOADER.read_text(encoding='utf-8')
    assert '__pdfEditorModuleLoaderV13' in text
    for module in JULY20_MODULES:
        assert module in text
    assert text.count("'/js/pdf-editor/") == len(JULY20_MODULES)
    assert 'preview-controller.js' not in text
    assert 'runtime-integrity.js' not in text
    assert 'ux-repair.js' not in text
    assert 'dock-width-align.js' not in text

def test_both_public_entrypoints_use_the_same_restored_editor():
    assert TOOL.read_bytes() == ROUTE.read_bytes()
