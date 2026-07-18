"""Small repository safety checks that do not require a deployed Firebase project."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def main() -> None:
    firebase = json.loads((ROOT / "firebase.json").read_text(encoding="utf-8"))
    ignored = set(firebase["hosting"]["ignore"])
    require("backups/**" in ignored, "Firebase Hosting must ignore backups/**")
    require("**/*.zip" in ignored, "Firebase Hosting must ignore ZIP archives")
    require("backend/**" in ignored, "Firebase Hosting must ignore backend source")

    version = json.loads((ROOT / "version.json").read_text(encoding="utf-8"))["version"]
    service_worker = (ROOT / "sw.js").read_text(encoding="utf-8")
    match = re.search(r"const APP_VERSION = '([^']+)'", service_worker)
    require(match is not None, "sw.js APP_VERSION was not found")
    require(match.group(1) == version, "sw.js and version.json versions differ")

    register = (ROOT / "js" / "sw-register.js").read_text(encoding="utf-8")
    require("/sw.js?ts=" not in register, "Service worker must not be registered with a timestamp on every load")
    require("clearOldCaches" not in register, "Page bootstrap must not delete all browser caches")

    rules = (ROOT / "firestore.rules").read_text(encoding="utf-8")
    admin_block = rules.split("match /settings/admin", 1)[1].split("match /settings/programs", 1)[0]
    require("allow write: if false" in admin_block or "allow read, write: if false" in admin_block,
            "settings/admin client writes must be disabled")

    main_py = (ROOT / "backend" / "main.py").read_text(encoding="utf-8")
    require("admin_bp" in main_py and "access_bp" in main_py, "Secure admin/access routes must be registered")

    zip_files = list((ROOT / "backups").glob("*.zip")) if (ROOT / "backups").exists() else []
    require(not zip_files, "Repository backups must not be committed under backups/")

    print("Static safety checks passed")


if __name__ == "__main__":
    main()
