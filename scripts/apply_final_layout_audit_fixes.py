from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OLD_VERSION = "2026.07.30.001"
NEW_VERSION = "2026.07.30.002"


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "index.html",
    ".grid{grid-template-columns:1fr}.footer-inner",
    ".grid{grid-template-columns:1fr}.programs-head{display:block}.programs h2{word-break:keep-all}.count{margin-top:8px}.footer-inner",
)

replace_once(
    "admin.html",
    "@media(max-width:760px){.app{display:block}.side{position:relative;height:auto;display:block}.navbtn{display:inline-block;width:auto;font-size:10px}.navbtn span{font-size:13px}.sidefoot{display:inline}.grid{grid-template-columns:1fr}.wide{grid-column:auto}.formgrid,.legal-links{grid-template-columns:1fr}.top{position:relative}.content{padding:14px}}",
    "@media(max-width:760px){.app{display:block}.side{position:sticky;top:0;z-index:30;height:auto;display:grid;grid-template-columns:auto repeat(4,minmax(0,1fr));align-items:center;gap:4px;padding:8px}.brand{padding:0 4px}.brand-mark,.brand-mark svg{width:34px;height:34px}.navbtn{display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;min-width:0;font-size:9px;line-height:1.15;padding:6px 2px;margin:0;text-align:center}.navbtn span{font-size:14px;width:auto;margin-bottom:2px}.sidefoot{display:contents}.grid{grid-template-columns:1fr}.wide{grid-column:auto}.formgrid,.legal-links{grid-template-columns:1fr}.top{position:relative}.content{padding:14px}}",
)

test_path = ROOT / "backend/tests/test_current_system_audit.py"
test_text = test_path.read_text(encoding="utf-8")
addition = '''\n\ndef test_home_and_admin_mobile_layout_remain_readable():\n    home = read("index.html")\n    assert ".programs-head{display:block}" in home\n    assert ".programs h2{word-break:keep-all}" in home\n    admin = read("admin.html")\n    assert "grid-template-columns:auto repeat(4,minmax(0,1fr))" in admin\n    assert ".sidefoot{display:contents}" in admin\n'''
if "test_home_and_admin_mobile_layout_remain_readable" in test_text:
    raise RuntimeError("mobile layout regression test already exists")
test_path.write_text(test_text.rstrip() + addition + "\n", encoding="utf-8")

for path in ("js/firebase-config.js", "js/sw-register.js", "sw.js"):
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    if OLD_VERSION not in text:
        raise RuntimeError(f"{path}: old version not found")
    target.write_text(text.replace(OLD_VERSION, NEW_VERSION), encoding="utf-8")

version_path = ROOT / "version.json"
version = json.loads(version_path.read_text(encoding="utf-8"))
if version.get("version") != OLD_VERSION:
    raise RuntimeError("version.json: unexpected current version")
version.update(
    version=NEW_VERSION,
    label="전체 시스템 구성·반응형 점검",
    updatedAt="2026-07-30T14:05:00+09:00",
)
version_path.write_text(json.dumps(version, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
