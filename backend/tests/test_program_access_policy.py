from pathlib import Path

from utils.permissions import _has_program_access, _is_admin, _is_program_public


ROOT = Path(__file__).resolve().parents[2]


class FakeSnapshot:
    def __init__(self, data=None):
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return self._data


class FakeDocument:
    def __init__(self, snapshot):
        self.snapshot = snapshot

    def get(self):
        return self.snapshot


class FakeCollection:
    def __init__(self, documents):
        self.documents = documents

    def document(self, document_id):
        return FakeDocument(FakeSnapshot(self.documents.get(document_id)))


class FakeDb:
    def __init__(self, collections):
        self.collections = collections

    def collection(self, name):
        return FakeCollection(self.collections.get(name, {}))


def test_admin_source_is_settings_admin_email_list_only():
    db = FakeDb({"settings": {"admin": {"emails": ["Admin@Example.com"]}}})
    assert _is_admin(db, "admin@example.com") is True
    assert _is_admin(db, "other@example.com") is False


def test_public_program_allows_signed_in_users_without_assignment():
    db = FakeDb({"settings": {"programs": {"public": {"pdf-editor": True}}}})
    assert _is_program_public(db, "pdf-editor") is True
    assert _is_program_public(db, "preflight") is False


def test_private_program_requires_approved_status_and_exact_flag():
    db = FakeDb(
        {
            "user_permissions": {
                "approved": {"status": "approved", "programs": {"pdf-editor": True}},
                "pending": {"status": "pending", "programs": {"pdf-editor": True}},
                "missing": {"status": "approved", "programs": {"pdf-editor": False}},
            }
        }
    )
    assert _has_program_access(db, "approved", "pdf-editor") is True
    assert _has_program_access(db, "pending", "pdf-editor") is False
    assert _has_program_access(db, "missing", "pdf-editor") is False


def test_frontend_and_backend_share_public_approved_and_program_rules():
    frontend = (ROOT / "js" / "firebase-config.js").read_text(encoding="utf-8")
    backend = (ROOT / "backend" / "utils" / "permissions.py").read_text(encoding="utf-8")

    assert "async canUseProgram(user,programId)" in frontend
    assert "publicPrograms?.[programId]===true" in frontend
    assert "access.status==='approved'&&assigned" in frontend
    assert "profileData.role==='admin'" not in frontend
    assert "db.collection('admins')" not in frontend

    assert "def _is_program_public" in backend
    assert "_is_program_public(db, program_id)" in backend
    assert 'data.get("status") != "approved"' in backend


def test_guard_maps_each_protected_page_to_one_program_id():
    frontend = (ROOT / "js" / "firebase-config.js").read_text(encoding="utf-8")
    assert "return'pdf-editor'" in frontend
    assert "return'preflight'" in frontend
    assert "return'design-studio'" in frontend
    assert "ProgramAccess.guardTool({programId})" in frontend


def test_new_user_document_rules_reject_privilege_fields_and_true_programs():
    rules = (ROOT / "firestore.rules").read_text(encoding="utf-8")
    assert "request.resource.data.keys().hasOnly" in rules
    assert "request.resource.data.status == 'pending'" in rules
    assert "request.resource.data.plan == 'free'" in rules
    assert "request.resource.data.programs.keys().hasOnly" in rules
    assert "request.resource.data.programs['pdf-editor'] == false" in rules
    assert "request.resource.data.programs.preflight == false" in rules
    assert "request.resource.data.programs['design-studio'] == false" in rules
