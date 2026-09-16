from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SESSION_SAVE = ROOT / "js" / "pdf-editor" / "session-save-safety.js"
RULES = ROOT / "firestore.rules"


def test_pdf_session_state_is_utf8_bounded_before_storage_uploads():
    source = SESSION_SAVE.read_text(encoding="utf-8")
    rules = RULES.read_text(encoding="utf-8")

    for marker in (
        "MAX_STATE_BYTES = 780 * 1024",
        "new TextEncoder().encode",
        "const stateBytes = utf8Bytes(stateJson)",
        "stateBytes > MAX_STATE_BYTES",
        "const stateJson = JSON.stringify(state)",
        "snapshotMeta = validateSnapshot(files, state, stateJson)",
        "state: snapshotMeta.stateJson",
        "maxStateBytes: MAX_STATE_BYTES",
        "state-byte-precheck",
    ):
        assert marker in source

    validate_index = source.index("snapshotMeta = validateSnapshot(files, state, stateJson)")
    upload_index = source.index("storage.ref(path).put(file")
    assert validate_index < upload_index
    assert "request.resource.data.state.size() <= 900000" in rules
