from dataclasses import dataclass

from utils.permissions import _program_access_from_snapshots


@dataclass
class _Snapshot:
    data: dict
    exists: bool = True

    def to_dict(self):
        return self.data


def test_approved_legacy_all_false_programs_grants_access():
    permission = _Snapshot({
        "status": "approved",
        "programs": {
            "pdf-editor": False,
            "preflight": False,
            "design-studio": False,
        },
    })

    assert _program_access_from_snapshots(None, permission, "pdf-editor") is True
    assert _program_access_from_snapshots(None, permission, "preflight") is True


def test_approved_missing_program_map_grants_access():
    permission = _Snapshot({"status": "approved"})

    assert _program_access_from_snapshots(None, permission, "pdf-editor") is True


def test_explicit_program_selection_is_still_enforced():
    permission = _Snapshot({
        "status": "approved",
        "programs": {
            "pdf-editor": True,
            "preflight": False,
        },
    })

    assert _program_access_from_snapshots(None, permission, "pdf-editor") is True
    assert _program_access_from_snapshots(None, permission, "preflight") is False


def test_non_approved_account_is_denied():
    permission = _Snapshot({
        "status": "pending",
        "programs": {"pdf-editor": True},
    })

    assert _program_access_from_snapshots(None, permission, "pdf-editor") is False
