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


def test_public_program_cannot_bypass_user_approval():
    program = FakeSnapshot({"public": {"pdf-editor": True, "preflight": True}})
    pending = FakeSnapshot({"status": "pending"})
    missing = FakeSnapshot(None)

    assert _program_access_from_snapshots(program, pending, "pdf-editor") is False
    assert _program_access_from_snapshots(program, pending, "preflight") is False
    assert _program_access_from_snapshots(program, missing, "pdf-editor") is False


def test_approved_account_can_use_every_managed_program():
    catalog = FakeSnapshot({"public": {"pdf-editor": False, "preflight": False}})
    approved = FakeSnapshot({
        "status": "approved",
        "programs": {"pdf-editor": True, "preflight": False},
    })
    pending = FakeSnapshot({"status": "pending", "programs": {"pdf-editor": True}})
    suspended = FakeSnapshot({"status": "suspended", "programs": {"preflight": True}})

    assert _program_access_from_snapshots(catalog, approved, "pdf-editor") is True
    assert _program_access_from_snapshots(catalog, approved, "preflight") is True
    assert _program_access_from_snapshots(catalog, pending, "pdf-editor") is False
    assert _program_access_from_snapshots(catalog, suspended, "preflight") is False


def test_frontend_and_backend_share_account_approval_policy():
    frontend = (ROOT / "js" / "firebase-config.js").read_text(encoding="utf-8")
    backend = (ROOT / "backend" / "utils" / "permissions.py").read_text(encoding="utf-8")
    assert "getIdTokenResult" in frontend
    assert "claims?.admin === true" in frontend
    assert "allowed: access.approved" in frontend
    assert "public: false" in frontend
    assert "allowed: access.admin || publicAccess || assigned" not in frontend
    assert "this.clearCache(user)" in frontend
    assert "def _has_admin_claim" in backend
    assert "def _is_legacy_admin" in backend
    assert "def _program_access_from_snapshots" in backend
    assert 'return permission_data.get("status") == "approved"' in backend
    assert '.get("public")' not in backend


def test_guard_maps_every_program_shell_to_approval_policy():
    frontend = (ROOT / "js" / "firebase-config.js").read_text(encoding="utf-8")
    for program_id in (
        "return 'pdf-editor'",
        "return 'preflight'",
        "return 'design-studio'",
        "return 'document-editor'",
        "return 'image-editor'",
    ):
        assert program_id in frontend
    for route in (
        "/design-editor/index.html",
        "/design-editor/general.html",
        "/document-editor/index.html",
        "/image-editor/index.html",
        "/pdf-editor/index.html",
        "/pdf-preflight/index.html",
    ):
        assert route in frontend
    assert "ProgramAccess.guardTool({ programId, timeoutMs: 8000 })" in frontend


def test_deploy_injector_bootstraps_auth_for_tool_shells_without_firebase():
    injector = (ROOT / "scripts" / "inject_boot_guard.py").read_text(encoding="utf-8")
    for path in (
        '"design-editor/index.html"',
        '"document-editor/index.html"',
        '"image-editor/index.html"',
        '"pdf-editor/index.html"',
        '"pdf-preflight/index.html"',
    ):
        assert path in injector
    assert "FIREBASE_APPROVAL_BOOTSTRAP" in injector
    assert 'src="/js/firebase-config.js"' in injector
    assert 'approval_required=requires_approval(path)' in injector


def test_new_user_document_rules_reject_privilege_fields_and_true_programs():
    rules = (ROOT / "firestore.rules").read_text(encoding="utf-8")
    assert "request.resource.data.keys().hasOnly" in rules
    assert "request.resource.data.status == 'pending'" in rules
    assert "request.resource.data.plan == 'free'" in rules
    assert "request.resource.data.programs.keys().hasOnly" in rules
    assert "request.resource.data.programs['pdf-editor'] == false" in rules
    assert "request.resource.data.programs.preflight == false" in rules
    assert "request.resource.data.programs['design-studio'] == false" in rules
