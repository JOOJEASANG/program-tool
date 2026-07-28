from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_legacy_pdf_editor_bridge_is_scoped_and_avoids_sdk_prototype_mutation():
    source = (ROOT / "js" / "firebase-config.js").read_text(encoding="utf-8")

    assert "__programStudioLegacyPdfEditorBridge" in source
    assert "db.collection = function(collectionName)" in source
    assert "DocumentSnapshot?.prototype" not in source
    assert "DocumentReference?.prototype" not in source


def test_approved_account_is_normalized_only_for_legacy_editor_reads():
    source = (ROOT / "js" / "firebase-config.js").read_text(encoding="utf-8")

    assert "collectionName !== 'user_permissions'" in source
    assert "data.status !== 'approved'" in source
    assert "'pdf-editor': true" in source
    assert "preflight: true" in source
    assert "'design-studio': true" in source


def test_optional_settings_permission_denial_is_scoped_to_legacy_editor():
    source = (ROOT / "js" / "firebase-config.js").read_text(encoding="utf-8")

    assert "optionalSettingsRead" in source
    assert "['admin', 'programs'].includes(documentId)" in source
    assert "permission-denied" in source
    assert "return { exists: false" in source


def test_pdf_editor_legacy_check_can_continue_to_user_permission_document():
    source = (ROOT / "pdf-editor" / "index.html").read_text(encoding="utf-8")

    assert "Promise.all" in source
    assert "db.collection('user_permissions').doc(user.uid).get()" in source
    assert "permDoc.data().programs?.['pdf-editor'] === true" in source
    assert "../js/firebase-config.js" in source
