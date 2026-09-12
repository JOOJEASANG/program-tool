from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
INDEX = ROOT / "print-checker" / "index.html"
CORE = ROOT / "js" / "print-checker" / "print-checker.js"
DUPLEX = ROOT / "js" / "print-checker" / "invitation-duplex-fold.js"


def text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_invitation_notice_supports_front_back_pdf_preview():
    index = text(INDEX)
    core = text(CORE)
    duplex = text(DUPLEX)

    assert "/js/print-checker/invitation-duplex-fold.js?v=20260912-1" in index
    assert index.index("production-guides-v2.js") < index.index("invitation-duplex-fold.js")
    assert 'data-side="front"' in index and "앞면 · PDF 1p" in index
    assert 'data-side="back"' in index and "뒷면 · PDF 2p" in index
    assert "_pdfDoc.numPages >= 2 && _product !== 'booklet'" in core
    assert "앞·뒷면은 2페이지 PDF 권장" in duplex
    assert "1p=앞면, 2p=뒷면" in duplex
    assert "초대장·안내장 앞·뒷면" in duplex
    assert "pdfPageCount" in duplex


def test_invitation_fold_direction_and_position_are_variable():
    source = text(DUPLEX)

    for marker in (
        'id="invitationFoldType"',
        'id="invitationFoldDirection"',
        'id="invitationFoldPosition"',
        'value="auto"',
        'value="vertical"',
        'value="horizontal"',
        "function resolvedFold(current = specs())",
        "position / axis",
        "위치를 비우면 정중앙",
        "왼쪽에서 접는선 위치",
        "위쪽에서 접는선 위치",
        "fold.direction === 'vertical'",
        "v1-duplex-variable-fold",
    ):
        assert marker in source

    # 안전영역 기본값은 현재 정책인 10mm와 일치해야 한다.
    assert "numberValue('safeZone', 10)" in source


def test_invitation_variable_fold_redraws_panel_safe_guides():
    source = text(DUPLEX)

    assert "const split = trim.w * fold.ratio" in source
    assert "const split = trim.h * fold.ratio" in source
    assert "panels.forEach((panel) =>" in source
    assert "panel.w - insetX * 2" in source
    assert "panel.h - insetY * 2" in source
    assert "drawInvitationGuides" in source
    assert "productionGuideLayer" in source


def test_retired_generic_editors_and_stopped_experiment_are_not_in_production_tree():
    retired = (
        "design-editor/index.html",
        "document-editor/index.html",
        "image-editor/index.html",
        "js/design-editor/core-runtime.js",
        "js/document-editor/app.js",
        "js/image-editor/app.js",
        "js/print-checker/simple-editor.js",
        "css/print-checker-simple-editor.css",
    )
    for relative in retired:
        assert not (ROOT / relative).exists(), relative

    index = text(INDEX)
    assert "pcSimpleEditorWorkspace" not in index
    assert "print-checker-simple-editor" not in index
