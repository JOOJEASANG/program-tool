from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ADMIN_WORKFLOW = ROOT / "js" / "admin-workflow-v2.js"
RULES = ROOT / "firestore.rules"


def test_business_stamp_uses_admin_only_document_and_migrates_legacy_public_value():
    workflow = ADMIN_WORKFLOW.read_text(encoding="utf-8")
    rules = RULES.read_text(encoding="utf-8")

    for marker in (
        "MAX_STAMP_BYTES=300*1024",
        "MAX_STAMP_EDGE=4096",
        "MAX_STAMP_PIXELS=16*1024*1024",
        "STAMP_TYPES=new Set(['image/png','image/jpeg','image/webp'])",
        "doc('business_private')",
        "migrateLegacyPublicStamp",
        "removeLegacyPublicStamp",
        "scrubLegacyStampCache",
        "input.onchange=onStampChange",
        "remove.onclick=onRemoveStamp",
        "관리자 전용 저장",
    ):
        assert marker in workflow

    assert "match /settings/business_private" in rules
    assert "allow read: if isAdmin();" in rules
    assert "allow write: if isAdmin() && validBusinessPrivate();" in rules
    assert "!request.resource.data.keys().hasAny(['stampData'])" in rules
    assert "request.resource.data.stampData.size() <= 420000" in rules
