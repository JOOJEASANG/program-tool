from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
STORAGE_RULES = ROOT / "storage.rules"
PERMISSIONS = ROOT / "backend" / "utils" / "permissions.py"


def test_storage_rules_keep_program_access_policy_for_persistent_pdf_resources():
    rules = STORAGE_RULES.read_text(encoding="utf-8")
    backend = PERMISSIONS.read_text(encoding="utf-8")

    assert "function isPublicProgram(programId)" in rules
    assert "/documents/settings/programs" in rules
    assert ".data.public[programId] == true" in rules
    assert "function canUseProgram(programId)" in rules
    assert "isApproved() || isPublicProgram(programId)" in rules

    assert 'public.get(program_id) is True' in backend


def test_pdf_utility_temp_storage_is_owner_only_pdf_staging_before_backend_auth():
    rules = STORAGE_RULES.read_text(encoding="utf-8")

    pdf_temp_start = rules.index("match /pdf_temp/{userId}/{sessionId}/{fileName}")
    preflight_temp_start = rules.index("match /preflight_temp/{userId}/{sessionId}/{fileName}")
    pdf_temp_block = rules[pdf_temp_start:preflight_temp_start]

    assert "allow read, delete: if isOwner(userId);" in pdf_temp_block
    assert "allow create, update: if isOwner(userId) && isPdfUpload();" in pdf_temp_block
    assert "canUseProgram(" not in pdf_temp_block
    assert "request.resource.size <= 524288000" in rules
    assert "request.resource.contentType == 'application/pdf'" in rules


def test_preflight_temp_storage_is_owner_only_pdf_staging_before_backend_auth():
    rules = STORAGE_RULES.read_text(encoding="utf-8")

    start = rules.index("match /preflight_temp/{userId}/{sessionId}/{fileName}")
    end = rules.index("match /pdf_sessions/{userId}/{sessionId}/{fileName}")
    block = rules[start:end]

    assert "allow read, delete: if isOwner(userId);" in block
    assert "allow create, update: if isOwner(userId) && isPdfUpload();" in block
    assert "canUseProgram(" not in block


def test_saved_sessions_still_require_pdf_editor_program_access():
    rules = STORAGE_RULES.read_text(encoding="utf-8")
    start = rules.index("match /pdf_sessions/{userId}/{sessionId}/{fileName}")
    end = rules.index("match /pdf_results/{userId}/{resultId}/{fileName}")
    block = rules[start:end]

    assert "isOwner(userId) && canUseProgram('pdf-editor')" in block
    assert "isPdfUpload()" in block


def test_generated_results_can_be_removed_immediately_by_owner():
    rules = STORAGE_RULES.read_text(encoding="utf-8")
    start = rules.index("match /pdf_results/{userId}/{resultId}/{fileName}")
    end = rules.index("match /cover_templates/{templateId}/{fileName}")
    block = rules[start:end]

    assert "allow delete: if isOwner(userId);" in block
    assert "canUseProgram('preflight')" in block
    assert "canUseProgram('pdf-editor')" in block
    assert "allow create, update: if false;" in block
