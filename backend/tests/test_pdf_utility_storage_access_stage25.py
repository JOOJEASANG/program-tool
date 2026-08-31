from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
STORAGE_RULES = ROOT / "storage.rules"
PERMISSIONS = ROOT / "backend" / "utils" / "permissions.py"


def test_storage_rules_require_account_approval_for_program_resources():
    rules = STORAGE_RULES.read_text(encoding="utf-8")
    backend = PERMISSIONS.read_text(encoding="utf-8")

    assert "function canUseProgram(programId)" in rules
    assert "return isApproved();" in rules
    assert "function isPublicProgram(programId)" not in rules
    assert ".data.public[programId] == true" not in rules

    assert 'return permission_data.get("status") == "approved"' in backend
    assert '.get("public")' not in backend


def test_pdf_utility_temp_storage_requires_matching_program_access_before_staging():
    rules = STORAGE_RULES.read_text(encoding="utf-8")

    pdf_temp_start = rules.index("match /pdf_temp/{userId}/{sessionId}/{fileName}")
    preflight_temp_start = rules.index("match /preflight_temp/{userId}/{sessionId}/{fileName}")
    pdf_temp_block = rules[pdf_temp_start:preflight_temp_start]

    assert "allow read: if isOwner(userId) && canUseProgram('pdf-editor');" in pdf_temp_block
    assert "allow delete: if isOwner(userId);" in pdf_temp_block
    assert "allow create: if isOwner(userId)" in pdf_temp_block
    assert "canUseProgram('pdf-editor')" in pdf_temp_block
    assert "validStagePath(sessionId, fileName)" in pdf_temp_block
    assert "validPdfUpload(209715200)" in pdf_temp_block
    assert "allow update: if false;" in pdf_temp_block
    assert "request.resource.contentType == 'application/pdf'" in rules


def test_preflight_temp_storage_requires_matching_program_access_before_staging():
    rules = STORAGE_RULES.read_text(encoding="utf-8")

    start = rules.index("match /preflight_temp/{userId}/{sessionId}/{fileName}")
    end = rules.index("match /pdf_sessions/{userId}/{sessionId}/{fileName}")
    block = rules[start:end]

    assert "allow read: if isOwner(userId) && canUseProgram('preflight');" in block
    assert "allow delete: if isOwner(userId);" in block
    assert "allow create: if isOwner(userId)" in block
    assert "canUseProgram('preflight')" in block
    assert "validStagePath(sessionId, fileName)" in block
    assert "validPdfUpload(209715200)" in block
    assert "allow update: if false;" in block


def test_saved_sessions_still_require_pdf_editor_program_access():
    rules = STORAGE_RULES.read_text(encoding="utf-8")
    start = rules.index("match /pdf_sessions/{userId}/{sessionId}/{fileName}")
    end = rules.index("match /pdf_results/{userId}/{resultId}/{fileName}")
    block = rules[start:end]

    assert "isOwner(userId) && canUseProgram('pdf-editor')" in block
    assert "validSessionUpload(userId, sessionId, fileName)" in block
    assert "allow update: if false;" in block


def test_generated_results_can_be_removed_immediately_by_owner():
    rules = STORAGE_RULES.read_text(encoding="utf-8")
    start = rules.index("match /pdf_results/{userId}/{resultId}/{fileName}")
    end = rules.index("match /design_projects/{userId}/{projectId}/{fileName}")
    block = rules[start:end]

    assert "allow delete: if isOwner(userId);" in block
    assert "canUseProgram('preflight')" in block
    assert "canUseProgram('pdf-editor')" in block
    assert "allow create, update: if false;" in block
