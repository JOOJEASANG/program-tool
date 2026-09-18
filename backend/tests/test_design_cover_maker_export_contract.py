from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_standalone_ai_design_maker_uses_300dpi_png_metadata_contract():
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")
    assert "const EXPORT_DPI = 300" in source
    assert "type!=='pHYs'" in source
    assert "type==='IHDR'" in source
    assert "parts.push(phys)" in source
    assert "Math.round(dpi/0.0254)" in source
    assert "MAX_EXPORT_PIXELS" in source


def test_standalone_cover_export_keeps_print_typography_and_spine_rotation():
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")
    assert "item.fontPt*EXPORT_DPI/72" in source
    assert "ctx.rotate(item.rotate*Math.PI/180)" in source
    assert "function vertical(" in source
    assert "spec.spine>=4" in source
    assert "spec.spine>=8" in source
    assert "spec.spine>=16" in source


def test_design_review_no_longer_loads_ai_maker_runtime():
    review = (ROOT / "print-checker/index.html").read_text(encoding="utf-8")
    maker = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")

    assert "design-cover-maker.js" not in review
    assert "design-cover-maker.css" not in review
    assert "디자인 검토/제작" not in review
    assert "<title>디자인 검토 · Program Studio</title>" in review

    assert 'data-ai-design-maker="cover-v1"' in maker
    assert 'id="previewCanvas"' in maker
    assert 'id="generateBtn"' in maker
    assert 'id="exportBtn"' in maker
    assert "/js/ai-design-maker.js?v=20260918-8" in maker


def test_ai_design_maker_has_easy_cover_workflow_and_diagnostics():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")

    for label in ("인쇄 규격", "표지 문구", "AI 디자인", "전체 펼침 미리보기", "AI 배경 생성", "300dpi 다운로드"):
        assert label in page
    for field_id in ("trimW", "trimH", "spine", "bleed", "safeZone", "wingEnabled", "wingW"):
        assert f'id="{field_id}"' in page
    assert "localStorage.setItem(STORAGE_KEY" in source
    assert "request_id:" in source
    assert "AI 배경 생성 실패" in source
    assert "state.generatedSpecKey!==specKey(spec)" in source


def test_ai_design_preview_starts_transparent_and_fills_workspace():
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")
    style = (ROOT / "css/ai-design-maker.css").read_text(encoding="utf-8")

    assert "ctx.clearRect(0,0,fit.width,fit.height)" in source
    assert "drawEmpty(" not in source
    assert "clientWidth || 1000) - 20" in source
    assert "clientHeight || 700) - 20" in source
    assert "background:transparent" in style
    assert "height:calc(100vh - 120px)" in style
    assert "padding:10px" in style


def test_ai_design_maker_uses_sidebar_only_layout_and_bottom_actions():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    style = (ROOT / "css/ai-design-maker.css").read_text(encoding="utf-8")
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")

    assert '<header class="maker-header">' not in page
    assert 'id="productPickerTitle">디자인 종류' in page
    assert 'id="manualBtn"' in page
    assert 'program-manual-home-modal.css' in page
    assert 'program-manuals/home-modal.js' in page
    assert 'program-sidebar-actions.js?v=20260918-2' in page
    assert "position:static" in style
    assert "color:#fff!important" in style
    assert "generate-button span{color:#fff!important}" in style
    assert "ProgramManualHomeModal?.open('ai-design-maker'" in source


def test_ai_design_maker_uses_editorial_presets_and_exact_spine_guidance():
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")

    for label in ("프리미엄 미니멀", "업무·행정", "포럼·행사", "교육·사례집", "공공·정책"):
        assert label in source
    assert "preset: 'premium'" in source
    assert "Do not create a visible center spine strip" in source
    assert "책등 '+spec.spine.toFixed(1)+'mm" in source
    assert "spineInset=Math.min(sw*.18,1.5*scale)" in source
    assert "책등 12~15.9mm" in source
    assert "책등 16mm 이상" in source


def test_ai_design_manual_button_sits_next_to_program_title():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    style = (ROOT / "css/ai-design-maker.css").read_text(encoding="utf-8")

    assert 'class="program-title-row"' in page
    assert '<strong>AI 디자인 제작</strong>' in page
    assert 'id="manualBtn"' in page
    assert page.index('<strong>AI 디자인 제작</strong>') < page.index('id="productPickerTitle"')
    assert '.program-title-row{' in style
    assert '.program-title-copy strong{' in style


def test_ai_design_maker_supports_bilingual_requests_and_event_copy_fields():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")

    for field_id in ("eventDate", "eventPlace", "hostText", "organizerText", "customFields", "addCustomFieldBtn"):
        assert f'id="{field_id}"' in page
    assert 'name="promptLanguage" value="ko"' in page
    assert 'name="promptLanguage" value="en"' in page
    assert "PRESET_PROMPTS_KO" in source
    assert "promptLanguage: 'ko'" in source
    assert "function renderCustomFields()" in source
    assert "function addCustomField()" in source
    assert "추가 항목은 최대 12개" in source
    assert "eventLines.join('\\n')" in source


def test_ai_design_maker_title_is_mouse_editable_and_persisted():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")

    assert 'id="titleEditBar"' in page
    for align in ("left", "center", "right"):
        assert f'data-title-align="{align}"' in page
    assert 'id="resetTitleLayout"' in page
    assert "titleLayout:" in source
    assert "bindTitleCanvasEditing()" in source
    assert "canvas.addEventListener('pointerdown'" in source
    assert "canvas.addEventListener('pointermove'" in source
    assert "widthScale" in source
    assert "fontScale" in source
    assert "syncTitleAlignButtons()" in source


def test_ai_design_maker_exports_png_pdf_and_crop_marks():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")

    assert 'id="cropMarkToggle"' in page
    assert '<option value="png">이미지 · PNG</option>' in page
    assert '<option value="pdf">PDF</option>' in page
    assert "function drawCropMarks(" in source
    assert "if($('cropMarkToggle')?.checked)drawCropMarks" in source
    assert "async function exportPng()" in source
    assert "async function exportPdf()" in source
    assert "function pdfFromJpeg(" in source
    assert "application/pdf" in source
    assert "exportDesign()" in source
