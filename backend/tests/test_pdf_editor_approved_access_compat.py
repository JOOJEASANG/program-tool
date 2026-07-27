from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_shared_firebase_layer_normalizes_approved_legacy_program_flags():
    source = (ROOT / "js" / "firebase-config.js").read_text(encoding="utf-8")

    assert "DocumentSnapshot?.prototype" in source
    assert "this.ref?.parent?.id!=='user_permissions'" in source
    assert "data.status!=='approved'" in source
    assert "'pdf-editor':true" in source


def test_pdf_editor_optional_settings_permission_denial_does_not_abort_access_check():
    source = (ROOT / "js" / "firebase-config.js").read_text(encoding="utf-8")

    assert "DocumentReference?.prototype" in source
    assert "this.parent?.id==='settings'" in source
    assert "['admin','programs'].includes(this.id)" in source
    assert "permission-denied" in source
    assert "return{exists:false,id:this.id,ref:this,data:()=>undefined}" in source


def test_pdf_editor_legacy_check_can_continue_to_user_permission_document():
    source = (ROOT / "pdf-editor" / "index.html").read_text(encoding="utf-8")

    assert "Promise.all" in source
    assert "db.collection('user_permissions').doc(user.uid).get()" in source
    assert "permDoc.data().programs?.['pdf-editor'] === true" in source
    assert "../js/firebase-config.js" in source
