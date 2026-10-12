from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
LAUNCHER = ROOT / "js" / "pdf-suite-home-launcher.js"


def test_home_cards_keep_icon_title_description_and_no_manual_button():
    source = LAUNCHER.read_text(encoding="utf-8")

    for token in [
        "card.dataset.homeCardLayout='title-card'",
        "card.querySelector('.card-cat')?.remove()",
        "card.querySelector('.card-tags')?.remove()",
        "card.querySelector('.card-footer')?.remove()",
        "titleRow.className='card-title-row'",
        "titleRow.appendChild(name)",
        "installCardStyles()",
        "installCardLayout()",
        "programHomeCardTitleStyle",
        "color:#26372e!important",
        "padding:18px 56px 14px 22px!important",
    ]:
        assert token in source

    for retired in [
        "button.textContent='?'",
        "사용설명서 열기",
        "ProgramManualHomeModal",
        "programManualHomeModalScript",
        "installCardManualButtons",
        "openManual(",
        "manualUrl:",
    ]:
        assert retired not in source


def test_program_manual_assets_remain_available_outside_home_cards():
    paths = [
        "css/program-manual-home-modal.css",
        "js/program-manuals/catalog.js",
        "js/program-manuals/home-modal.js",
        "js/program-manuals/print-checker.js",
        "js/program-manuals/ai-design-maker.js",
        "js/program-manuals/smart-print-layout.js",
        "js/program-manuals/pdf-editor.js",
        "js/program-manuals/pdf-editor-advanced.js",
        "js/program-manuals/pdf-suite.js",
    ]
    for path in paths:
        assert (ROOT / path).is_file(), path
