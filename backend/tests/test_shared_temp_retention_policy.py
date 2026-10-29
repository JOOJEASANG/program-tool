"""Unsaved uploads expire after 24 hours without touching saved projects."""
import importlib.util
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "ensure_temp_storage_lifecycle.py"


def load_script():
    spec = importlib.util.spec_from_file_location("ensure_temp_storage_lifecycle", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FakeBucket:
    def __init__(self, rules):
        self.lifecycle_rules = list(rules)
        self.metageneration = 9
        self.patches = 0
        self.reloads = 0

    def reload(self):
        self.reloads += 1

    def add_lifecycle_delete_rule(self, *, age, matches_prefix):
        self.lifecycle_rules.append({
            "action": {"type": "Delete"},
            "condition": {"age": age, "matchesPrefix": matches_prefix},
        })

    def patch(self, *, if_metageneration_match):
        assert if_metageneration_match == self.metageneration
        self.patches += 1


def test_policy_is_exactly_scoped_to_unsaved_prefixes():
    script = load_script()
    assert set(script.required_prefixes()) == {
        "pdf_temp/", "preflight_temp/", "pdf_results/",
    }
    text = (ROOT / "storage-lifecycle.json").read_text(encoding="utf-8")
    assert "pdf_sessions/" not in text
    assert "print_checker_sessions/" not in text
    assert "design_projects/" not in text
    assert "ai_design_gallery/" not in text


def test_policy_adds_rule_without_overwriting_other_retention():
    script = load_script()
    other = {"action": {"type": "Delete"}, "condition": {"age": 60, "matchesPrefix": ["logs/"]}}
    bucket = FakeBucket([other])
    assert script.ensure_temporary_retention(bucket, script.TEMP_PREFIXES) is True
    assert bucket.patches == 1
    assert other in bucket.lifecycle_rules
    assert script.ensure_temporary_retention(bucket, script.TEMP_PREFIXES) is False
    assert bucket.patches == 1


def test_policy_refuses_bucket_wide_or_early_temp_deletion():
    script = load_script()
    for rule in [
        {"action": {"type": "Delete"}, "condition": {"age": 1}},
        {"action": {"type": "Delete"}, "condition": {"age": 0, "matchesPrefix": ["pdf_temp/"]}},
    ]:
        bucket = FakeBucket([rule])
        try:
            script.ensure_temporary_retention(bucket, script.TEMP_PREFIXES)
        except ValueError:
            pass
        else:
            raise AssertionError("Unsafe lifecycle must be rejected")
        assert bucket.patches == 0


def test_saved_prefixes_never_swept_by_hourly_cleanup():
    main = (ROOT / "backend/main.py").read_text(encoding="utf-8")
    start = main.index("def cleanup_temporary_pdfs(")
    end = main.index("@scheduler_fn.on_schedule", start)
    routine = main[start:end]
    assert "TEMP_OBJECT_RETENTION_HOURS = 24" in main
    assert "timedelta(hours=TEMP_OBJECT_RETENTION_HOURS)" in routine
    assert "for prefix in TEMP_OBJECT_PREFIXES" in routine
    assert "pdf_sessions/" not in routine
    assert "design_projects/" not in routine
    assert "print_checker_sessions/" not in routine


def test_lifecycle_is_24_hour_rule():
    payload = json.loads((ROOT / "storage-lifecycle.json").read_text(encoding="utf-8"))
    assert payload["rule"][0]["condition"]["age"] == 1
