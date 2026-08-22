from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DEPLOY = ROOT / ".github" / "workflows" / "firebase-deploy.yml"
PREVIEW = ROOT / ".github" / "workflows" / "firebase-preview.yml"
WRAPPER = ROOT / "scripts" / "firebase_ci.sh"
AUTH_SHA = "google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093"


def test_firebase_workflows_support_short_lived_wif_adc_credentials():
    for path in (DEPLOY, PREVIEW):
        source = path.read_text(encoding="utf-8")
        assert "id-token: write" in source
        assert "GCP_WORKLOAD_IDENTITY_PROVIDER" in source
        assert "GCP_SERVICE_ACCOUNT" in source
        assert AUTH_SHA in source
        assert "create_credentials_file: true" in source
        assert "export_environment_variables: true" in source
        assert "scripts/firebase_ci.sh" in source
        assert '--token "$FIREBASE_TOKEN"' not in source


def test_firebase_ci_wrapper_prefers_adc_and_keeps_legacy_token_fallback():
    source = WRAPPER.read_text(encoding="utf-8")
    adc = source.index('GOOGLE_APPLICATION_CREDENTIALS')
    legacy = source.index('FIREBASE_TOKEN')
    assert adc < legacy
    assert "unset FIREBASE_TOKEN" in source
    assert 'exec firebase "$@"' in source
    assert 'exec firebase "$@" --token "$FIREBASE_TOKEN"' in source
    assert "Using legacy FIREBASE_TOKEN fallback" in source
    assert "exit 2" in source


def test_production_and_preview_do_not_silently_drop_legacy_credentials_before_wif_cutover():
    for path in (DEPLOY, PREVIEW):
        source = path.read_text(encoding="utf-8")
        assert "FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}" in source
        assert "if: env.WIF_PROVIDER != '' && env.WIF_SERVICE_ACCOUNT != ''" in source
