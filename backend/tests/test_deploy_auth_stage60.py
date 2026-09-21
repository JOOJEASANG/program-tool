from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEPLOY = ROOT / ".github" / "workflows" / "firebase-deploy.yml"
PREVIEW = ROOT / ".github" / "workflows" / "firebase-preview.yml"
WRAPPER = ROOT / "scripts" / "firebase_ci.sh"
GITIGNORE = ROOT / ".gitignore"
AUTH_SHA = "google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093"


def test_firebase_workflows_require_short_lived_wif_adc_credentials():
    for path in (DEPLOY, PREVIEW):
        source = path.read_text(encoding="utf-8")
        assert "id-token: write" in source
        assert "GCP_WORKLOAD_IDENTITY_PROVIDER" in source
        assert "GCP_SERVICE_ACCOUNT" in source
        assert AUTH_SHA in source
        assert "create_credentials_file: true" in source
        assert "export_environment_variables: true" in source
        assert "scripts/firebase_ci.sh" in source
        assert "FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}" not in source
        assert '--token "$FIREBASE_TOKEN"' not in source


def test_firebase_ci_wrapper_uses_adc_and_has_no_legacy_token_fallback():
    source = WRAPPER.read_text(encoding="utf-8")
    assert "GOOGLE_APPLICATION_CREDENTIALS" in source
    assert "unset FIREBASE_TOKEN" in source
    assert 'exec firebase "$@"' in source
    assert 'exec firebase "$@" --token "$FIREBASE_TOKEN"' not in source
    assert "Using legacy FIREBASE_TOKEN fallback" not in source
    assert "Workload Identity Federation is required" in source
    assert "exit 2" in source


def test_production_and_preview_do_not_inject_legacy_firebase_credentials():
    for path in (DEPLOY, PREVIEW):
        source = path.read_text(encoding="utf-8")
        assert "FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}" not in source
        assert "if: env.WIF_PROVIDER != '' && env.WIF_SERVICE_ACCOUNT != ''" in source


def test_generated_wif_credential_files_cannot_be_committed_accidentally():
    assert "gha-creds-*.json" in GITIGNORE.read_text(encoding="utf-8")
