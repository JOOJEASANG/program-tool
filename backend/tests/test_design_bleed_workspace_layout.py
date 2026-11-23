"""Workspace UI follows PDF editing and Smart Layout without affecting bleed output."""
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[2]


def read(path):
    return (ROOT/path).read_text(encoding="utf-8")


def test_editor_sidebar_and_preview_workspace_replace_landing_page():
    html=read("ai-design-maker/index.html")
    assert 'class="studio layout-app"' in html
    assert 'class="sidebar controls"' in html
    assert 'class="sidebar-top"' in html
    assert 'class="top-actions"' in html
    assert 'id="enhancerHomeBtn"' in html
    assert 'id="logoutBtn"' in html
    assert 'class="workspace"' in html
    assert 'class="preview-panel"' in html
    assert 'class="workspace-head"' in html
    assert 'id="previewGrid"' in html
    assert 'class="view-switch"' in html
    assert 'class="sidebar-output"' in html
    assert "class=\"page-intro\"" not in html
    assert "class=\"steps\"" not in html
    assert 'data-preview-mode="compare"' in html
    assert 'data-preview-mode="original"' in html
    assert 'data-preview-mode="result"' in html


def test_all_workflow_ids_are_unique_and_files_stay_upload_first():
    page=read("ai-design-maker/index.html")
    ids=re.findall(r'\bid="([^"]+)"',page)
    assert len(ids)==len(set(ids))
    for required in ("authGate","studio","fileInput","uploadZone","trimWidth",
                     "trimHeight","bleedMm","edgeMode","fitMode","outputSize",
                     "processBtn","beforeCanvas","afterCanvas","confirmCheck",
                     "saveBtn","pageSelect","helpBtn","resetBtn","helpGuide"):
        assert required in ids
    assert 'id="generateBtn"' not in page
    assert '/js/design-bleed-enhancer.js?v=20261123-3' in page
    assert '/css/design-bleed-enhancer.css?v=20261123-3' in page


def test_shared_editor_visual_language_is_responsive_and_not_fake_controls():
    css=read("css/design-bleed-enhancer.css")
    js=read("js/design-bleed-enhancer.js")
    assert "Print Studio workbench parity" in css
    assert "grid-template-columns:370px minmax(0,1fr)" in css
    assert "@media(max-width:900px)" in css
    assert "@media(max-width:620px)" in css
    assert ".sidebar-output" in css
    assert ".preview-grid[data-preview-mode" in css
    assert "function setPreviewMode(mode)" in js
    assert "button.setAttribute('aria-pressed',String(active))" in js
    assert "window.auth.signOut()" in js
    assert "function processFile()" in js
    assert "function savePdf()" in js
    assert "function drawPreviews()" in js
    manual=read("js/program-manuals/ai-design-maker.js")
    assert "화면 구성 · 다른 PDF 편집·배치 도구와 공통" in manual
    assert "나란히 / 원본 / 보완 결과" in manual
    assert "출력용 PDF 저장" in manual



def test_larger_zoomable_canvas_and_real_bleed_proof_are_accessible():
    html=read("ai-design-maker/index.html")
    css=read("css/design-bleed-enhancer.css")
    js=read("js/design-bleed-enhancer.js")
    manual=read("js/program-manuals/ai-design-maker.js")
    for control in ('previewZoom','expandPreviewBtn','edgeJumpBtn','guideToggle',
                    'bleedInspector','edgeInspectCanvas','edgeInspectStatus','edgeInspectEmpty',
                    'edgeBleedSize'):
        assert f'id="{control}"' in html
    for edge in ("top","bottom","left","right"):
        assert f'data-edge="{edge}"' in html
    for zoom in ('value="1.5"','value="2"','value="3"'):
        assert zoom in html
    assert "function edgeSampleRect(settings,side)" in js
    assert "transform:[1,0,0,1,-left,-top]" in js
    assert "function drawEdgeInspector(doc,pageNumber,side,token)" in js
    assert "function setEdgeSide(side)" in js
    assert "function toggleWidePreview()" in js
    assert "ctx.lineWidth=0.7" in js
    assert "if(!state.resultSettings||!canvas.width||!$('guideToggle').checked)return;" in js
    assert ".preview-card .canvas-frame" in css
    assert "overflow:auto;overscroll-behavior:contain" in css
    assert "max-width:none!important;max-height:none!important" in css
    assert "실제 결과 PDF" in manual
    assert "150%" in manual
    assert "300%" in manual
    assert "안내선 표시" in manual
    assert "90도" in manual
