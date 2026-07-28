from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def _read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_backup_workflow_is_manual_and_artifact_only():
    source = _read(".github/workflows/backup-before-unified-print.yml")

    assert "workflow_dispatch" in source
    assert "contents: read" in source
    assert "actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4" in source
    assert "git push" not in source
    assert "git add backups" not in source


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
