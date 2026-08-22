from types import SimpleNamespace

import pytest

from scripts import sync_admin_claims as claims


def _stub_admins(monkeypatch, mapping):
    monkeypatch.setattr(claims, "_initialize_firebase", lambda: None)
    monkeypatch.setattr(claims, "_admin_emails", lambda: set(mapping))

    def get_user(email):
        custom_claims = mapping[email]
        return SimpleNamespace(uid=f"uid-{email}", email=email, custom_claims=custom_claims)

    monkeypatch.setattr(claims.auth, "get_user_by_email", get_user)


def test_verify_admin_claims_passes_only_when_every_admin_has_claim(monkeypatch):
    _stub_admins(
        monkeypatch,
        {
            "admin1@example.com": {"admin": True},
            "admin2@example.com": {"admin": True, "other": "preserved"},
        },
    )
    assert claims.verify_admin_claims() == 0


def test_verify_admin_claims_fails_for_missing_claim(monkeypatch):
    _stub_admins(
        monkeypatch,
        {
            "admin1@example.com": {"admin": True},
            "admin2@example.com": {},
        },
    )
    assert claims.verify_admin_claims() == 1


def test_verify_admin_claims_fails_closed_when_admin_list_is_empty(monkeypatch):
    monkeypatch.setattr(claims, "_initialize_firebase", lambda: None)
    monkeypatch.setattr(claims, "_admin_emails", lambda: set())
    assert claims.verify_admin_claims() == 1


def test_verify_cli_returns_verification_exit_code(monkeypatch):
    monkeypatch.setattr(claims, "verify_admin_claims", lambda: 3)
    assert claims.main(["--verify"]) == 3


def test_verify_mode_cannot_mutate_claims():
    with pytest.raises(SystemExit):
        claims.main(["--verify", "--apply"])
    with pytest.raises(SystemExit):
        claims.main(["--verify", "--revoke-missing"])
