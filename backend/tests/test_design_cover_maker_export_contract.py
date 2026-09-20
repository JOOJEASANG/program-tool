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
    assert "spineTitle" in source

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
    assert "/js/ai-design-maker.js?v=20260920-4" in maker


def test_ai_design_maker_has_easy_cover_workflow_and_diagnostics():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")

    for label in ("인쇄 규격", "표지 문구", "AI 디자인", "전체 펼침 미리보기", "AI 배경 생성", "300dpi 다운로드"):
        assert label in page
    for field_id in ("trimW", "trimH", "spine", "bleed", "safeZone", "wingEnabled", "wingW"):
        assert f'id="{field_id}"' in page
    assert "localStorage.setItem(STORAGE_KEY" in source
    assert "STORAGE_KEY_PREFIX = 'program-studio:ai-design-maker:cover:v2'" in source
    assert "LEGACY_STORAGE_KEY = 'program-studio:ai-design-maker:cover:v1'" in source
    assert "STORAGE_KEY=STORAGE_KEY_PREFIX+':'+user.uid" in source
    assert "localStorage.removeItem(LEGACY_STORAGE_KEY)" in source
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
    assert ".canvas-scroll{height:auto;min-height:0;flex:1 1 auto" in style
    assert ".workspace{min-width:0;height:100vh;padding:8px 12px 0" in style


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



def test_ai_design_maker_uses_category_presets_and_exact_spine_guidance():
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")

    for label in ("보고서", "행정", "공공기관", "제안서", "행사", "문제집", "교육자료집"):
        assert f"name: '{label}'" in source
    assert "preset: 'report'" in source
    assert "Do not create a visible center spine strip" in source
    assert "책등 '+spec.spine.toFixed(1)+'mm" in source
    assert "spineInset=Math.min(sw*.18,1.5*scale)" in source
    assert "책등 8mm 이상: 상·중·하 문구를 각각 자동정렬하거나 자유배치할 수 있습니다." in source

def test_ai_design_manual_button_sits_next_to_program_title():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    style = (ROOT / "css/ai-design-maker.css").read_text(encoding="utf-8")

    assert 'class="program-title-row"' in page
    assert '<strong>AI 디자인 제작</strong>' in page
    assert 'id="manualBtn"' in page
    assert page.index('<strong>AI 디자인 제작</strong>') < page.index('id="productPickerTitle"')
    assert '.program-title-row{' in style
    assert '.program-title-copy strong{' in style




def test_ai_design_maker_supports_bilingual_requests_and_per_side_extra_copy():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")

    for field_id in ("title", "backText", "frontExtraFields", "backExtraFields", "addFrontTextBtn", "addBackTextBtn", "spineTop", "spineMiddle", "spineBottom", "spineTopPlacement", "spineMiddlePlacement", "spineBottomPlacement"):
        assert f'id="{field_id}"' in page
    assert 'id="customFields"' not in page
    assert 'id="addCustomFieldBtn"' not in page
    for removed_id in ("subtitle", "dateText", "department", "organization", "eventDate", "eventPlace", "hostText", "organizerText", "contact", "spineDate", "spineCompany"):
        assert f'id="{removed_id}"' not in page
    assert 'name="promptLanguage" value="ko"' in page
    assert 'name="promptLanguage" value="en"' in page
    assert "function renderCustomFields()" in source
    assert "function addCustomField(surface='front')" in source
    assert "추가 문구는 최대 12개" in source
    assert "addCustomField('front')" in source
    assert "addCustomField('back')" in source
    assert "label.type = 'text'" not in source

def test_ai_design_maker_all_text_is_mouse_editable_and_persisted():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")

    assert 'id="textEditBar"' in page
    assert 'id="selectedTextLabel"' in page
    assert 'id="textStylePanel"' in page
    assert 'class="text-inspector"' in page
    for align in ("left", "center", "right"):
        assert f'data-text-align="{align}"' in page
    assert 'id="resetTextLayout"' in page
    assert 'class="inspector-preview-actions"' in page
    assert page.index('id="guideToggle"') > page.index('id="textStylePanel"')
    assert page.index('id="galleryBtn"') > page.index('id="textStylePanel"')
    assert page.index('id="exportFormat"') > page.index('id="textStylePanel"')
    assert page.index('id="exportBtn"') > page.index('id="textStylePanel"')
    assert page.index('id="exportFormat"') < page.index('class="text-inspector-head"')
    assert 'class="inspector-export-row"' in page
    assert "grid-template-columns:96px minmax(0,1fr)" in style
    assert ".inspector-export-button{min-width:0;padding:7px 4px!important" in style
    assert 'class="workspace-info-line" id="textEditBar"' in page
    assert "앞·뒤 안전영역 스냅 · 책등 자유배치" in page
    assert "textLayouts:" in source
    assert "selectedTextId:" in source
    assert "function bindTextCanvasEditing()" in source
    assert "function textVisualBounds(" in source
    assert "function findTextAtPoint(" in source
    assert "canvas.addEventListener('pointerdown'" in source
    assert "canvas.addEventListener('pointermove'" in source
    assert "widthScale" in source
    assert "fontScale" in source
    for field_id in ("title", "backText", "spineTop", "spineMiddle", "spineBottom"):
        assert f"id:'{field_id}'" in source
    assert "const SPINE_TEXT_IDS = new Set(['spineTop','spineMiddle','spineBottom'])" in source
    assert "setSpinePlacementMode(drag.textId,'free')" in source
    assert "id:'custom:'+entry.id" in source

def test_ai_design_maker_exports_png_pdf_and_crop_marks():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")

    assert 'id="cropMarkToggle"' in page
    assert '<option value="png">PNG</option>' in page
    assert '<option value="pdf">PDF</option>' in page
    assert "function drawCropMarks(" in source
    assert "if($('cropMarkToggle')?.checked)drawCropMarks" in source
    assert "async function exportPng()" in source
    assert "async function exportPdf()" in source
    assert "function pdfFromJpeg(" in source
    assert "application/pdf" in source
    assert "exportDesign()" in source


def test_ai_design_maker_can_place_custom_full_spread_background_and_removes_bottom_help():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")
    style = (ROOT / "css/ai-design-maker.css").read_text(encoding="utf-8")
    ui = (ROOT / "js/program-studio-ui-v2.js").read_text(encoding="utf-8")

    assert 'id="backgroundInput"' in page
    assert 'id="backgroundName"' in page
    assert 'id="clearBackground"' in page
    assert "async function loadBackground(file)" in source
    assert "function drawBackgroundImage(" in source
    assert "state.backgroundSource='upload'" in source
    assert "바깥 적색선 전체 영역" in source
    assert '#psSimpleHelpTrigger{display:none!important}' in style
    assert "if(path==='/ai-design-maker'||path.endsWith('/ai-design-maker/index.html'))return '';" in ui
    assert 'class="canvas-help"' not in page



def test_event_and_default_generation_use_richer_color_and_full_bleed():
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")
    backend = (ROOT / "backend/services/ai_cover_image.py").read_text(encoding="utf-8")

    assert "행사·포럼·컨퍼런스용 표지" in source
    assert "refined medium saturation" in source
    assert "washed-out pastel" in source
    assert "VISUAL_MODE_PROMPTS" in source
    assert "COLOR_INTENSITY_PROMPTS" in source
    assert "COMPOSITION_VARIANTS" in source
    assert "OUTER BLEED BOUNDARY" in source
    assert "OUTER BLEED BOUNDARY" in backend
    assert "Fill the entire canvas edge-to-edge" in backend
    assert "cover-background-v7-category-visual-diversity" in backend

def test_ai_design_selected_text_supports_line_breaks_and_typography_controls():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")
    style = (ROOT / "css/ai-design-maker.css").read_text(encoding="utf-8")

    assert '<textarea class="cover-copy-input" id="title"' in page
    assert 'Enter로 줄바꿈할 수 있습니다.' in page
    for field_id in (
        "textStylePanel",
        "selectedTextValue",
        "selectedFontFamily",
        "selectedFontSize",
        "selectedFontWeight",
        "selectedLineHeight",
        "selectedTextColor",
        "textInspectorFields",
    ):
        assert f'id="{field_id}"' in page

    assert "function setSelectedTextContent(value)" in source
    assert "layout.text=String(value||'').slice(0,700)" in source
    assert "fontFamily:" in source
    assert "fontSizePt:" in source
    assert "fontWeight:" in source
    assert "lineHeight:" in source
    assert "color:" in source
    assert "fontStack(item.fontFamily)" in source
    assert "item.color||color" in source
    assert "selectedTextValue" in source
    assert "selectedFontFamily" in source
    assert "selectedFontSize" in source
    assert "selectedFontWeight" in source
    assert "selectedLineHeight" in source
    assert "selectedTextColor" in source
    assert ".text-inspector{" in style
    assert ".text-style-controls{display:grid;grid-template-columns:1fr" in style

def test_ai_design_maker_supports_front_cover_only_mode():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")
    style = (ROOT / "css/ai-design-maker.css").read_text(encoding="utf-8")
    backend = (ROOT / "backend/services/ai_cover_image.py").read_text(encoding="utf-8")

    assert 'name="coverMode" value="spread"' in page
    assert 'name="coverMode" value="front"' in page
    assert 'id="coverModeHeading"' in page
    assert 'id="previewModeTitle"' in page
    assert 'id="backCoverFields"' in page
    assert 'id="spineFields"' in page
    assert "coverMode: 'spread'" in source
    assert "coverMode==='front'" in source
    assert "coverMode==='front' ? trimW + bleed * 2" in source
    assert "cover_mode:spec.coverMode" in source
    assert "front-cover-" in source
    assert 'html[data-cover-mode="front"] #spineField' in style
    assert 'cover_mode: str' in backend
    assert 'if self.cover_mode == "front"' in backend
    assert 'FRONT COVER ONLY' in backend



def test_ai_design_reference_direction_supports_multiple_visual_languages():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")
    backend = (ROOT / "backend/services/ai_cover_image.py").read_text(encoding="utf-8")

    for field_id in ("visualMode", "colorIntensity", "designMood"):
        assert f'id="{field_id}"' in page
    for mode in ("editorial", "geometry", "infographic", "photo", "illustration", "hybrid"):
        assert f'value="{mode}"' in page
    assert "editorial illustration, symbolic scenes, iconographic or infographic structures" in backend
    assert "washed-out, foggy, low-contrast or weak" in backend
    assert "Repeating the same thin-line, circle, wave or geometric-network formula" in backend
    assert "selectedDesignDirection()" in source

def test_ai_design_maker_supports_standard_300dpi_and_high_quality_generation_modes():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")
    backend = (ROOT / "backend/services/ai_cover_image.py").read_text(encoding="utf-8")

    assert 'name="generationQuality" value="standard"' in page
    assert 'name="generationQuality" value="high"' in page
    assert "기본 300dpi" in page
    assert "고품질" in page
    assert "generationQuality: 'standard'" in source
    assert "quality_mode:state.generationQuality" in source
    assert "state.generationQuality=input.value==='high'?'high':'standard'" in source
    assert 'quality_mode = "high" if quality_mode == "high" else "standard"' in backend
    assert 'quality = "high" if req.quality_mode == "high" else "medium"' in backend
    assert "const EXPORT_DPI = 300" in source


def test_ai_design_status_panel_is_flush_to_bottom_and_generation_has_progress_bar():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    style = (ROOT / "css/ai-design-maker.css").read_text(encoding="utf-8")
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")

    assert 'id="generationProgress"' in page
    assert 'id="generationProgressBar"' in page
    assert 'id="generationProgressText"' in page
    assert ".workspace{min-width:0;height:100vh;padding:8px 12px 0" in style
    assert ".status-panel{margin:5px 0 0" in style
    assert "border-bottom:0" in style
    assert "function startGenerationProgress()" in source
    assert "function setGenerationProgress(value)" in source
    assert "function finishGenerationProgress(success=true)" in source
    assert "setGenerationProgress(100)" in source
    assert "startGenerationProgress();" in source


def test_front_cover_mode_is_prominent_at_top_of_sidebar():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    style = (ROOT / "css/ai-design-maker.css").read_text(encoding="utf-8")

    assert 'class="cover-scope-card"' in page
    assert 'id="coverScopeTitle">제작 범위' in page
    assert page.count('name="coverMode" value="front"') == 1
    assert page.count('name="coverMode" value="spread"') == 1
    assert "앞표지만 디자인" in page
    assert "전체 펼침 디자인" in page
    assert ".cover-scope-card{" in style
    assert ".cover-mode-picker-prominent" in style


def test_ai_design_print_sizes_are_a4_b5_a5_and_custom():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")

    assert 'data-size-id="a4" data-size="210,297"' in page
    assert 'data-size-id="b5" data-size="182,257"' in page
    assert 'data-size-id="a5" data-size="148,210"' in page
    assert 'data-size-id="custom"' in page
    assert "176×248" not in page
    assert "sizeMode: 'a4'" in source
    assert "function syncSizeMode()" in source
    assert "state.sizeMode='custom'" in source




def test_ai_design_copy_fields_are_front_back_first_and_additive():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")

    assert "앞표지 문구" in page
    assert "뒤표지 문구" in page
    assert page.count(">+ 추가</button>") == 2
    assert 'id="addFrontTextBtn"' in page
    assert 'id="addBackTextBtn"' in page
    assert 'id="frontExtraFields"' in page
    assert 'id="backExtraFields"' in page
    assert "항목명" not in page
    for removed_label in ("일시", "장소", "주최", "주관", "발행일·연도", "발행 부서", "기관·회사명", "뒤표지 하단 정보"):
        assert removed_label not in page

    assert "let pt=trimW<140?36:50" in source
    assert "fontPt:titlePt(v.title,spec.trimW)" in source
    assert "fontPt:14,weight:650" in source
    assert "fontPt:12,weight:700" in source
    assert "const text=String(entry.value||'').trim();" in source

def test_ai_design_gallery_saves_finished_cover_and_prompt_to_user_storage():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")
    style = (ROOT / "css/ai-design-maker.css").read_text(encoding="utf-8")
    firebase_config = (ROOT / "js/firebase-config.js").read_text(encoding="utf-8")
    firestore_rules = (ROOT / "firestore.rules").read_text(encoding="utf-8")
    storage_rules = (ROOT / "storage.rules").read_text(encoding="utf-8")

    assert "firebase-storage-compat.js" in page
    for field_id in ("galleryBtn", "saveGalleryBtn", "galleryRefreshBtn", "galleryModal", "gallerySearch", "galleryGrid", "galleryDetailModal"):
        assert f'id="{field_id}"' in page
    assert "async function saveCurrentDesignToGallery()" in source
    assert "async function buildGalleryPreviewBlob()" in source
    assert "async function loadGallery()" in source
    assert "function renderGallery(query='')" in source
    assert "firebase.firestore.Timestamp.now()" in source
    assert "galleryErrorDebug(error,stage)" in source
    assert "if(!user||!window.db)throw new Error('디자인 보관함 데이터 연결을 사용할 수 없습니다.')" in source
    assert "if(window.storage&&item.imagePath)" in source
    assert "galleryRefreshBtn" in source
    assert "state.lastGeneratedPrompt=prompt" in source
    assert "ai_design_gallery/" in source
    assert ".orderBy('createdAt','desc').limit(100)" in source
    assert ".gallery-grid{" in style
    assert "window.storage = storage" in firebase_config
    assert "match /users/{uid}/ai_design_gallery/{designId}" in firestore_rules
    assert "validAiDesignGalleryMetadata" in firestore_rules
    assert "match /ai_design_gallery/{userId}/{designId}/{fileName}" in storage_rules
    assert "validAiDesignGalleryUpload" in storage_rules



def test_ai_design_preview_font_size_migration_does_not_force_default_text_to_4pt():
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")

    assert "const TEXT_LAYOUT_SCHEMA_VERSION = 5" in source
    assert "textLayoutSchemaVersion: TEXT_LAYOUT_SCHEMA_VERSION" in source
    assert "legacyTextLayout" in source
    assert "rawFontSize <= 4" in source
    assert "fontSizePt: hasCustomFontSize ? clamp(rawFontSize,4,160,0) : 0" in source
    assert "Number.isFinite(rawFontSize)&&rawFontSize>0?clamp(rawFontSize,4,160,0):0" in source
    assert "let pt=trimW<140?36:50" in source


def test_ai_design_maker_has_no_fixed_event_fields_and_custom_copy_renders_only_when_present():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")

    for removed_id in ("eventDate", "eventPlace", "hostText", "organizerText"):
        assert f'id="{removed_id}"' not in page
        assert f"id:'{removed_id}'" not in source
    assert "const text=String(entry.value||'').trim();" in source
    assert "if(!String(item.text||'').trim())return;" in source


def test_ai_design_maker_uses_safe_area_snap_and_dual_alignment():
    page = (ROOT / "ai-design-maker/index.html").read_text(encoding="utf-8")
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")

    assert "안전영역 가로·세로 중심" in page
    assert "const SNAP_PX=9" in source
    assert "function coverSurfaceRect(" in source
    assert "const safe=Math.min(spec.safe" in source
    assert "Math.abs(xCandidates[0].delta)<=SNAP_PX" in source
    assert "Math.abs(candidateCenterY-zoneCenterY)<=SNAP_PX" in source
    for align in ("left", "center", "right"):
        assert f'data-box-align="{align}"' in page
        assert f'data-text-align="{align}"' in page
    assert "function alignSelectedTextBox(mode)" in source
    assert "layout.boxAlign=mode" in source
    assert "textLayoutState(state.selectedTextId).align=button.dataset.textAlign" in source

def test_ai_design_prompt_context_includes_all_cover_copy_and_theme_keywords():
    source = (ROOT / "js/ai-design-maker.js").read_text(encoding="utf-8")
    backend = (ROOT / "backend/services/ai_cover_image.py").read_text(encoding="utf-8")

    assert "앞표지 문구의 의미 참고:" in source
    assert "뒤표지 문구의 의미 참고:" in source
    assert "추가 문구:" in source
    assert "주제·키워드:" in source
    assert "theme_context:themeContext()" in source
    assert "SEMANTIC CONTEXT ONLY" in backend
    assert "never render it as text" in backend
