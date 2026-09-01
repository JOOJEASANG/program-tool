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
