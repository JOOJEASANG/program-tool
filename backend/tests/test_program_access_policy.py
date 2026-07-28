from pathlib import Path

from utils.permissions import (
    _has_admin_claim,
    _is_legacy_admin,
    _program_access_from_snapshots,
)


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


def test_admin_claim_requires_exact_boolean_true():
    assert _has_admin_claim({"admin": True}) is True
    assert _has_admin_claim({"admin": "true"}) is False
    assert _has_admin_claim({}) is False


def test_legacy_admin_fallback_uses_normalized_email_list():
    db = FakeDb({"settings": {"admin": {"emails": ["Admin@Example.com"]}}})
    assert _is_legacy_admin(db, "admin@example.com") is True
    assert _is_legacy_admin(db, "other@example.com") is False


def test_public_program_allows_without_user_approval():
    program = FakeSnapshot({"public": {"pdf-editor": True}})
    permission = FakeSnapshot(None)
    assert _program_access_from_snapshots(program, permission, "pdf-editor") is True
    assert _program_access_from_snapshots(program, permission, "preflight") is False


def test_approved_account_can_use_every_managed_program():
    private = FakeSnapshot({"public": {"pdf-editor": False, "preflight": False}})
    approved = FakeSnapshot({
        "status": "approved",
        "programs": {"pdf-editor": True, "preflight": False},
    })
    pending = FakeSnapshot({"status": "pending", "programs": {"pdf-editor": True}})
    suspended = FakeSnapshot({"status": "suspended", "programs": {"preflight": True}})

    assert _program_access_from_snapshots(private, approved, "pdf-editor") is True
    assert _program_access_from_snapshots(private, approved, "preflight") is True
    assert _program_access_from_snapshots(private, pending, "pdf-editor") is False
    assert _program_access_from_snapshots(private, suspended, "preflight") is False


def test_frontend_and_backend_share_account_approval_policy():
    frontend = (ROOT / "js" / "firebase-config.js").read_text(encoding="utf-8")
    backend = (ROOT / "backend" / "utils" / "permissions.py").read_text(encoding="utf-8")
    assert "getIdTokenResult" in frontend
    assert "claims?.admin === true" in frontend
    assert "publicPrograms?.[programId] === true" in frontend
    assert "const assigned = access.status === 'approved'" in frontend
    assert "allowed: access.admin || publicAccess || assigned" in frontend
    assert "this.clearCache(user)" in frontend
    assert "def _has_admin_claim" in backend
    assert "def _is_legacy_admin" in backend
    assert "def _program_access_from_snapshots" in backend
    assert 'return permission_data.get("status") == "approved"' in backend


def test_guard_maps_each_protected_page_to_one_program_id():
    frontend = (ROOT / "js" / "firebase-config.js").read_text(encoding="utf-8")
    assert "return 'pdf-editor'" in frontend
    assert "return 'preflight'" in frontend
    assert "return 'design-studio'" in frontend
    assert "ProgramAccess.guardTool({ programId, timeoutMs: 8000 })" in frontend


def test_new_user_document_rules_reject_privilege_fields_and_true_programs():
    rules = (ROOT / "firestore.rules").read_text(encoding="utf-8")
    assert "request.resource.data.keys().hasOnly" in rules
    assert "request.resource.data.status == 'pending'" in rules
    assert "request.resource.data.plan == 'free'" in rules
    assert "request.resource.data.programs.keys().hasOnly" in rules
    assert "request.resource.data.programs['pdf-editor'] == false" in rules
    assert "request.resource.data.programs.preflight == false" in rules
    assert "request.resource.data.programs['design-studio'] == false" in rules
