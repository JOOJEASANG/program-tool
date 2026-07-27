from dataclasses import dataclass

from utils.permissions import _program_access_from_snapshots


@dataclass
class _Snapshot:
    data: dict
    exists: bool = True

    def to_dict(self):
        return self.data


def test_approved_all_false_programs_grants_access():
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


def test_approved_explicit_program_map_cannot_hide_other_programs():
    permission = _Snapshot({
        "status": "approved",
        "programs": {
            "pdf-editor": True,
            "preflight": False,
        },
    })

    assert _program_access_from_snapshots(None, permission, "pdf-editor") is True
    assert _program_access_from_snapshots(None, permission, "preflight") is True


def test_non_approved_accounts_are_denied():
    for status in ("pending", "suspended", ""):
        permission = _Snapshot({
            "status": status,
            "programs": {"pdf-editor": True},
        })
        assert _program_access_from_snapshots(None, permission, "pdf-editor") is False
