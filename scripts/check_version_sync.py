#!/usr/bin/env python3
"""Fail when the deployment version is not synchronized across runtime files."""
from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VERSION_FILE = ROOT / "version.json"
TARGETS = {
    ROOT / "js" / "sw-register.js": r"const\s+VERSION=['\"]([^'\"]+)",
    ROOT / "sw.js": r"const\s+APP_VERSION=['\"]([^'\"]+)",
    ROOT / "js" / "firebase-config.js": r"/js/sw-register\.js\?v=([0-9.]+)",
}


def main() -> int:
    version_data = json.loads(VERSION_FILE.read_text(encoding="utf-8"))
    expected = str(version_data.get("version") or "").strip()
    if not expected:
        raise SystemExit("version.json에 version 값이 없습니다.")

    failures: list[str] = []
    for path, pattern in TARGETS.items():
        text = path.read_text(encoding="utf-8")
        match = re.search(pattern, text)
        actual = match.group(1) if match else None
        if actual != expected:
            failures.append(f"{path.relative_to(ROOT)}: {actual!r} != {expected!r}")

    if failures:
        raise SystemExit("배포 버전 불일치:\n- " + "\n- ".join(failures))

    print(f"deployment version synchronized: {expected}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
