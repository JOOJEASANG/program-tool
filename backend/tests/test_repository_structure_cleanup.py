from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_obsolete_manual_backup_workflow_is_removed():
    assert not (ROOT / ".github/workflows/backup-before-unified-print.yml").exists()


def test_hosting_excludes_internal_repository_files():
    source = _read("firebase.json")

    for ignored in [
        '".github/**"',
        '"scripts/**"',
        '"docs/**"',
        '"**/*.md"',
        '"**/*.py"',
    ]:
        assert ignored in source


def test_business_information_uses_text_nodes_and_legacy_fallback():
    source = _read("js/business-info-loader.js")

    assert "collection('settings').doc('business')" in source
    assert "collection('site_settings').doc('business')" in source
    assert "document.createTextNode(value)" in source
    assert "target.appendChild(image)" in source

    for page in ["privacy.html", "terms.html"]:
        html = _read(page)
        assert 'src="js/business-info-loader.js"' in html
        assert "ProgramBusinessInfo.render(" in html
        assert "bizText').innerHTML" not in html


def test_legacy_legal_pages_redirect_to_canonical_pages():
    assert "../privacy.html" in _read("legal/privacy.html")
    assert "../terms.html" in _read("legal/terms.html")


def test_obsolete_cover_editor_pages_are_removed():
    removed = [
        "tool-access.html",
        "tools/cover-editor-phase1.html",
        "tools/cover-editor-phase2.html",
        "tools/cover-editor-phase3.html",
        "tools/cover-editor-phase4.html",
    ]
    for path in removed:
        assert not (ROOT / path).exists(), path


def test_removed_editor_residual_assets_are_not_reintroduced():
    removed = [
        "css/document-editor-comments.css",
        "css/document-editor-forms.css",
        "css/document-editor-outline.css",
        "css/document-editor-print-layout.css",
        "css/document-editor-table-tools.css",
        "css/document-editor-usability.css",
        "css/document-editor-workflow.css",
        "css/document-editor.css",
        "css/image-editor-headerless.css",
        "css/image-editor-pdf-layout.css",
        "css/image-editor-pro.css",
        "css/image-editor-workflow.css",
        "css/image-editor.css",
        "docs/design-editor-cover-integration.md",
        "docs/image-editor-stage3.md",
        "js/editor-tool-rail-v1.js",
        "js/pdf-utility-background-margin-labels.js",
        "scripts/run_phase12_browser_smoke.sh",
        "tests/browser/editor-tool-rail-v6-smoke.html",
        "tests/browser/design-direct-real-dom-smoke.html",
    ]
    removed.extend(
        f"scripts/{name}"
        for name in [
            "run_design_editor_browser_smoke.sh",
            "run_design_editor_canvas_viewport_smoke.sh",
            "run_design_editor_cover_mode_menu_smoke.sh",
            "run_design_editor_cover_project_smoke.sh",
            "run_design_editor_cover_smoke.sh",
            "run_design_editor_essential_workspace_smoke.sh",
            "run_design_editor_fold_runtime_smoke.sh",
            "run_design_editor_full_preview_smoke.sh",
            "run_design_editor_leaflet2_layout_smoke.sh",
            "run_design_editor_local_fonts_smoke.sh",
            "run_design_editor_mode_shape_smoke.sh",
            "run_design_editor_pdf_lossless_smoke.sh",
            "run_design_editor_pdf_smoke.sh",
            "run_design_editor_print_production_stage2_smoke.sh",
            "run_design_editor_print_products_smoke.sh",
            "run_design_editor_reset_all_menus_smoke.sh",
            "run_design_editor_shape_border_smoke.sh",
            "run_design_editor_shape_inspector_ux_smoke.sh",
            "run_design_editor_stability_audit_smoke.sh",
            "run_design_editor_text_auto_fit_smoke.sh",
            "run_design_editor_typography_pro_smoke.sh",
            "run_design_editor_user_flow_smoke.sh",
            "run_design_editor_workflow_v2_smoke.sh",
            "run_document_editor_browser_smoke.sh",
            "run_document_editor_comments_smoke.sh",
            "run_document_editor_outline_smoke.sh",
            "run_document_editor_print_layout_smoke.sh",
            "run_document_editor_table_tools_smoke.sh",
            "run_document_editor_usability_smoke.sh",
            "run_document_editor_workflow_smoke.sh",
            "run_image_editor_background_smoke.sh",
            "run_image_editor_browser_smoke.sh",
            "run_image_editor_layout_smoke.sh",
            "run_image_editor_pro_smoke.sh",
            "run_image_editor_workflow_smoke.sh",
        ]
    )
    for path in removed:
        assert not (ROOT / path).exists(), path
