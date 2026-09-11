from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LAUNCHER = ROOT / "js" / "pdf-suite-home-launcher.js"


def test_home_cards_keep_only_icon_title_help_and_description():
    source = LAUNCHER.read_text(encoding="utf-8")

    for token in [
        "card.dataset.homeCardLayout='title-manual'",
        "card.querySelector('.card-cat')?.remove()",
        "card.querySelector('.card-tags')?.remove()",
        "card.querySelector('.card-footer')?.remove()",
        "titleRow.className='card-title-row'",
        "titleRow.appendChild(name)",
        "button.textContent='?'",
        "titleRow.appendChild(button)",
        "openManual(program.id,button)",
        "programHomeCardTitleManualStyle",
    ]:
        assert token in source

    assert "사용설명서 열기" in source
    assert "card-manual-btn" in source


def test_home_manual_layer_assets_exist_for_all_current_programs():
    paths = [
        "css/program-manual-home-modal.css",
        "js/program-manuals/catalog.js",
        "js/program-manuals/home-modal.js",
        "js/program-manuals/print-checker.js",
        "js/program-manuals/smart-print-layout.js",
        "js/program-manuals/pdf-editor.js",
        "js/program-manuals/pdf-editor-advanced.js",
        "js/program-manuals/pdf-suite.js",
    ]
    for path in paths:
        assert (ROOT / path).is_file(), path

    modal = (ROOT / "js/program-manuals/home-modal.js").read_text(encoding="utf-8")
    assert "ps-manual-layer" in modal
    assert "window.ProgramManualHomeModal" in modal
    assert "event.key === 'Escape'" in modal
    assert "event.target === layer" in modal
