#!/usr/bin/env python3
"""Validate local script and stylesheet references used by hosted HTML pages."""
from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
IGNORED_DIRS = {".git", ".github", "node_modules", "backend", "backups"}


class AssetParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.assets: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        values = dict(attrs)
        rel = values.get("rel")
        rel_values = rel.split() if isinstance(rel, str) else []
        if tag == "script" and values.get("src"):
            self.assets.append(values["src"])
        elif tag == "link" and "stylesheet" in rel_values and values.get("href"):
            self.assets.append(values["href"])


def hosted_html_files():
    for path in ROOT.rglob("*.html"):
        relative = path.relative_to(ROOT)
        if any(part in IGNORED_DIRS or part.startswith(".") for part in relative.parts):
            continue
        yield path


def resolve_asset(html_path: Path, value: str) -> Path | None:
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc or value.startswith(("//", "data:", "javascript:")):
        return None
    clean = unquote(parsed.path)
    if not clean:
        return None
    if clean.startswith("/"):
        return ROOT / clean.lstrip("/")
    return html_path.parent / clean


def main() -> int:
    failures: list[str] = []
    checked = 0
    root_resolved = ROOT.resolve()
    for html_path in hosted_html_files():
        parser = AssetParser()
        parser.feed(html_path.read_text(encoding="utf-8"))
        for value in parser.assets:
            target = resolve_asset(html_path, value)
            if target is None:
                continue
            checked += 1
            target_resolved = target.resolve()
            if not target_resolved.is_relative_to(root_resolved):
                failures.append(f"{html_path.relative_to(ROOT)} -> 저장소 밖 경로: {value}")
            elif not target.exists():
                failures.append(f"{html_path.relative_to(ROOT)} -> 누락된 파일: {value}")

    if failures:
        raise SystemExit("정적 파일 참조 오류:\n- " + "\n- ".join(failures))

    print(f"static references valid: {checked}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
