from pathlib import Path

from utils.permissions import _has_admin_claim, _is_legacy_admin, _program_access_from_snapshots

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


def test_only_approved_accounts_can_use_managed_programs():
    approved = FakeSnapshot({"status": "approved"})
    pending = FakeSnapshot({"status": "pending"})
    suspended = FakeSnapshot({"status": "suspended"})
    missing = FakeSnapshot(None)
    for program_id in ("print-checker", "smart-print-layout", "pdf-suite", "pdf-editor", "preflight"):
        assert _program_access_from_snapshots(None, approved, program_id) is True
        assert _program_access_from_snapshots(None, pending, program_id) is False
        assert _program_access_from_snapshots(None, suspended, program_id) is False
        assert _program_access_from_snapshots(None, missing, program_id) is False


def test_frontend_and_backend_share_account_approval_policy():
    frontend = (ROOT / "js" / "firebase-config.js").read_text(encoding="utf-8")
    backend = (ROOT / "backend" / "utils" / "permissions.py").read_text(encoding="utf-8")
    for marker in (
        "getIdTokenResult",
        "claims?.admin === true",
        "allowed: access.approved",
        "public: false",
        "this.clearCache(user)",
    ):
        assert marker in frontend
    for marker in (
        "def _has_admin_claim",
        "def _is_legacy_admin",
        "def _program_access_from_snapshots",
        'return permission_data.get("status") == "approved"',
    ):
        assert marker in backend


def test_all_primary_tool_routes_are_protected():
    frontend = (ROOT / "js" / "firebase-config.js").read_text(encoding="utf-8")
    injector = (ROOT / "scripts" / "inject_boot_guard.py").read_text(encoding="utf-8")
    boot = (ROOT / "js" / "app-boot-guard.js").read_text(encoding="utf-8")
    protected_block = injector.split("PROTECTED_HTML = {", 1)[1].split("PUBLIC_HTML = {", 1)[0]
    for path in (
        '"print-checker/index.html"',
        '"smart-print-layout/index.html"',
        '"pdf-suite/index.html"',
        '"pdf-editor/index.html"',
        '"pdf-editor-advanced/index.html"',
        '"pdf-preflight/index.html"',
    ):
        assert path in protected_block
    for route in ("/print-checker", "/smart-print-layout", "/pdf-suite", "/pdf-editor", "/pdf-preflight"):
        assert route in frontend
        assert route in boot
    assert "FIREBASE_APPROVAL_BOOTSTRAP" in injector
    assert 'src="/js/firebase-config.js"' in injector
    assert 'approval_required=requires_approval(path)' in injector


def test_open_protected_tools_revoke_access_live_when_member_loses_approval():
    boot = (ROOT / "js" / "app-boot-guard.js").read_text(encoding="utf-8")
    for marker in (
        "function installApprovalRevocationWatch(access)",
        "access?.admin",
        "collection('user_permissions').doc(user.uid)",
        "onSnapshot({includeMetadataChanges:true}",
        "snapshot.metadata?.fromCache",
        "status==='approved'",
        "window.ProgramAccess?.clearCache?.(user)",
        "root.dataset.approvalLive='revoked'",
        "new URL('/approval-waiting.html',location.origin)",
        "installApprovalRevocationWatch(access)",
    ):
        assert marker in boot
    assert "setInterval(" not in boot
    assert "@media(prefers-reduced-motion:reduce){html.app-booting::after{animation-duration:1.4s}}" in boot


def test_print_checker_no_longer_uses_daily_free_access():
    checker = (ROOT / "js" / "print-checker" / "access.js").read_text(encoding="utf-8")
    assert "mode:'approved-only'" in checker
    assert "ProgramAccessReady" in checker
    assert "daily-free" not in checker
    assert "ProgramPdfDailyFree" not in checker


def test_new_user_document_rules_use_status_only():
    rules = (ROOT / "firestore.rules").read_text(encoding="utf-8")
    assert "request.resource.data.keys().hasOnly(['uid','email','displayName','status','createdAt'])" in rules
    assert "request.resource.data.status == 'pending'" in rules
    assert "request.resource.data.plan" not in rules
    assert "request.resource.data.programs" not in rules
    assert "program_usage_limits" not in rules
    assert "daily_pdf_usage" not in rules
    assert "/program_usage/" not in rules


def test_quota_runtime_is_retired_and_not_injected_into_hosting():
    quota = (ROOT / "js" / "pdf-daily-free.js").read_text(encoding="utf-8")
    output_guard = (ROOT / "js" / "program-usage-output-guard.js").read_text(encoding="utf-8")
    builder = (ROOT / "scripts" / "prepare_hosting_dist.py").read_text(encoding="utf-8")
    assert "approved-members-only-no-usage-quota" in quota
    assert "program-usage-output-guard-retired" in output_guard
    assert "PDF_SUITE_DAILY_FREE_MARKER" not in builder
    assert "PDF_SUITE_UNIFIED_QUOTA_MARKER" not in builder
    assert "ADMIN_PDF_USAGE_MARKER" not in builder
