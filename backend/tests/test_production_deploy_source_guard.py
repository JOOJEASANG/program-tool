from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / ".github" / "workflows" / "firebase-deploy.yml"


def test_production_deploy_blocks_direct_main_pushes_but_keeps_manual_redeploy():
    source = WORKFLOW.read_text(encoding="utf-8")

    for marker in (
        "pull-requests: read",
        "source-guard:",
        "운영 배포 소스 확인",
        "github.event_name == 'push'",
        "listPullRequestsAssociatedWithCommit",
        "Boolean(pr.merged_at)",
        "pr.base?.ref === 'main'",
        "pr.merge_commit_sha === sha",
        "needs: source-guard",
        "github.event_name == 'workflow_dispatch'",
        "needs: [source-guard, quality, deploy]",
    ):
        assert marker in source

    assert "for (let attempt = 1; attempt <= 6; attempt += 1)" in source
    assert "core.setFailed(`운영 배포 차단:" in source
