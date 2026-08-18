from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
STORAGE_RULES = ROOT / "storage.rules"
PERMISSIONS = ROOT / "backend" / "utils" / "permissions.py"


def test_storage_rules_follow_public_program_access_policy_for_pdf_utility():
    rules = STORAGE_RULES.read_text(encoding="utf-8")
    backend = PERMISSIONS.read_text(encoding="utf-8")

    assert "function isPublicProgram(programId)" in rules
    assert "/documents/settings/programs" in rules
    assert ".data.public[programId] == true" in rules
    assert "function canUseProgram(programId)" in rules
    assert "isApproved() || isPublicProgram(programId)" in rules

    assert 'public.get(program_id) is True' in backend


def test_pdf_utility_temp_storage_allows_public_preflight_but_keeps_owner_and_pdf_guards():
    rules = STORAGE_RULES.read_text(encoding="utf-8")

    pdf_temp_start = rules.index("match /pdf_temp/{userId}/{sessionId}/{fileName}")
    preflight_temp_start = rules.index("match /preflight_temp/{userId}/{sessionId}/{fileName}")
    pdf_temp_block = rules[pdf_temp_start:preflight_temp_start]

    assert "isOwner(userId)" in pdf_temp_block
    assert "canUseProgram('preflight')" in pdf_temp_block
    assert "canUseProgram('pdf-editor')" in pdf_temp_block
    assert "isPdfUpload()" in pdf_temp_block
    assert "request.resource.size <= 209715200" in rules
    assert "request.resource.contentType == 'application/pdf'" in rules


def test_preflight_temp_storage_uses_same_program_policy():
    rules = STORAGE_RULES.read_text(encoding="utf-8")

    start = rules.index("match /preflight_temp/{userId}/{sessionId}/{fileName}")
    end = rules.index("match /pdf_sessions/{userId}/{sessionId}/{fileName}")
    block = rules[start:end]

    assert "isOwner(userId) && canUseProgram('preflight')" in block
    assert "isPdfUpload()" in block
