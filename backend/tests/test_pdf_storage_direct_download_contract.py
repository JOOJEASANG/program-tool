from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_direct_save_bridge_does_not_replace_final_check_blob_path():
    recovery_js = (ROOT / "js" / "pdf-editor" / "output-save-recovery.js").read_text(
        encoding="utf-8"
    )

    assert "#downloadBtn,#pdfEditorFinalCheckBtn" in recovery_js
    assert "if(target.id==='downloadBtn')armDirectSave()" in recovery_js
    assert "else clearDirectSave('final-check')" in recovery_js
    assert "if(!directSaveArmed())return nativeRead.call(this,resp,options)" in recovery_js
