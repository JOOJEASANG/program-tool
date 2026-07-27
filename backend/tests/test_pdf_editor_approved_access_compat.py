from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_shared_firebase_layer_normalizes_approved_legacy_program_flags():
    source = (ROOT / "js" / "firebase-config.js").read_text(encoding="utf-8")

    assert "DocumentSnapshot?.prototype" in source
    assert "this.ref?.parent?.id!=='user_permissions'" in source
    assert "data.status!=='approved'" in source
    assert "'pdf-editor':true" in source


def test_pdf_editor_still_uses_legacy_direct_program_flag_until_migrated():
    source = (ROOT / "pdf-editor" / "index.html").read_text(encoding="utf-8")

    assert "permDoc.data().programs?.['pdf-editor'] === true" in source
    assert "../js/firebase-config.js" in source
