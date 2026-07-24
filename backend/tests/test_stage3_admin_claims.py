from types import SimpleNamespace
from unittest.mock import Mock

from utils import permissions


class Snapshot:
    def __init__(self, path, data=None, exists=True):
        self.reference = SimpleNamespace(path=path)
        self.exists = exists
        self._data = data or {}

    def to_dict(self):
        return self._data


def test_admin_claim_is_strict_boolean_true():
    assert permissions._has_admin_claim({"admin": True}) is True
    assert permissions._has_admin_claim({"admin": "true"}) is False
    assert permissions._has_admin_claim({}) is False


def test_claimed_admin_skips_legacy_admin_document(monkeypatch):
    db = Mock()
    monkeypatch.setattr(permissions, "verify_bearer_token", lambda: {
        "uid": "admin-user", "email": "admin@example.com", "admin": True,
    })
    monkeypatch.setattr(permissions.firestore, "client", lambda: db)
    app = __import__("flask").Flask(__name__)
    with app.test_request_context("/api/pdf/process", headers={"Authorization": "Bearer token"}):
        decoded = permissions.require_program_access_for_request()
        assert decoded["admin"] is True
        assert permissions.g.is_admin is True
    db.collection.assert_not_called()


def test_program_access_uses_one_batched_get_all_call():
    program_ref = SimpleNamespace(path="settings/programs")
    permission_ref = SimpleNamespace(path="user_permissions/user-1")
    settings_collection = Mock()
    users_collection = Mock()
    settings_collection.document.return_value = program_ref
    users_collection.document.return_value = permission_ref
    db = Mock()
    db.collection.side_effect = lambda name: settings_collection if name == "settings" else users_collection
    db.get_all.return_value = [
        Snapshot("settings/programs", {"public": {"pdf-editor": False}}),
        Snapshot("user_permissions/user-1", {"status": "approved", "programs": {"pdf-editor": True}}),
    ]
    assert permissions._has_program_access(db, "user-1", "pdf-editor") is True
    db.get_all.assert_called_once_with([program_ref, permission_ref])


def test_public_program_allows_access_without_user_approval():
    public_snapshot = Snapshot("settings/programs", {"public": {"pdf-editor": True}})
    missing_permission = Snapshot("user_permissions/user-1", exists=False)
    assert permissions._program_access_from_snapshots(public_snapshot, missing_permission, "pdf-editor") is True


def test_missing_snapshots_fail_closed():
    assert permissions._program_access_from_snapshots(None, None, "pdf-editor") is False
