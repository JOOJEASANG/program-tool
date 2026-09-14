from dataclasses import dataclass

import pytest

from utils.permissions import AccessError, _program_access_from_snapshots, program_for_path


@dataclass
class _Snapshot:
    data: dict
    exists: bool = True

    def to_dict(self):
        return self.data


def test_api_families_resolve_new_program_ids():
    assert program_for_path("/api/pdf-tools/extract") == "pdf-preflight"
    assert program_for_path("/api/preflight/check") == "pdf-preflight"
    assert program_for_path("/api/pdf/process") == "pdf-editor"
    assert program_for_path("/api/pdf/process", "pdf-editor-advanced") == "pdf-editor-advanced"
    assert program_for_path("/api/pdf/process", "smart-print-layout") == "smart-print-layout"
    assert program_for_path("/api/preflight/check", "print-checker") == "print-checker"


def test_api_family_rejects_spoofed_program_id():
    with pytest.raises(AccessError):
        program_for_path("/api/pdf/process", "print-checker")
    with pytest.raises(AccessError):
        program_for_path("/api/preflight/check", "pdf-editor")


def test_legacy_approved_account_keeps_all_program_access_until_policy_saved():
    permission = _Snapshot({"status": "approved", "programs": {"pdf-editor": False}})
    assert _program_access_from_snapshots(None, permission, "pdf-editor") is True
    assert _program_access_from_snapshots(None, permission, "pdf-preflight") is True


def test_programs_all_grants_every_program_after_member_approval():
    permission = _Snapshot({"status": "approved", "programsAll": True, "programs": {}})
    assert _program_access_from_snapshots(None, permission, "pdf-editor") is True
    assert _program_access_from_snapshots(None, permission, "print-checker") is True


def test_explicit_program_policy_only_grants_selected_programs():
    permission = _Snapshot({
        "status": "approved",
        "programsAll": False,
        "programs": {
            "pdf-editor": True,
            "pdf-preflight": False,
            "print-checker": False,
        },
    })
    assert _program_access_from_snapshots(None, permission, "pdf-editor") is True
    assert _program_access_from_snapshots(None, permission, "pdf-preflight") is False
    assert _program_access_from_snapshots(None, permission, "print-checker") is False


def test_non_approved_accounts_are_denied_even_with_program_flag():
    for status in ("pending", "suspended", ""):
        permission = _Snapshot({
            "status": status,
            "programsAll": True,
            "programs": {"pdf-editor": True},
        })
        assert _program_access_from_snapshots(None, permission, "pdf-editor") is False
