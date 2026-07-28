#!/usr/bin/env python3
"""Validate hosted HTML assets, local links, form actions, and anchors."""
from __future__ import annotations

from functools import lru_cache
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
IGNORED_DIRS = {".git", ".github", "node_modules", "backend", "backups"}


class ReferenceParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.references: list[tuple[str, str]] = []
        self.ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs) -> None:
        values = dict(attrs)
        if values.get("id"):
            self.ids.add(values["id"])
        rel = values.get("rel")
        rel_values = rel.split() if isinstance(rel, str) else []
        if tag == "script" and values.get("src"):
            self.references.append(("asset", values["src"]))
        elif tag == "link" and "stylesheet" in rel_values and values.get("href"):
            self.references.append(("asset", values["href"]))
        elif tag == "a" and values.get("href"):
            self.references.append(("link", values["href"]))
        elif tag == "form" and values.get("action"):
            self.references.append(("form", values["action"]))


def hosted_html_files():
    for path in ROOT.rglob("*.html"):
        relative = path.relative_to(ROOT)
        if any(
            part in IGNORED_DIRS or part.startswith(".")
            for part in relative.parts
        ):
            continue
        yield path


def resolve_reference(html_path: Path, value: str) -> tuple[Path | None, str]:
    parsed = urlsplit(value)
    if parsed.scheme in {"http", "https", "mailto", "tel"} or parsed.netloc:
        return None, ""
    if value.startswith(("//", "data:", "javascript:")):
        return None, ""
    clean = unquote(parsed.path)
    if not clean:
        target = html_path
    elif clean.startswith("/"):
        target = ROOT / clean.lstrip("/")
    else:
        target = html_path.parent / clean
    return target, unquote(parsed.fragment)


def clean_url_target(target: Path) -> Path | None:
    if target.is_file():
        return target
    if target.is_dir() and (target / "index.html").is_file():
        return target / "index.html"
    if not target.suffix and target.with_suffix(".html").is_file():
        return target.with_suffix(".html")
    return None


@lru_cache(maxsize=None)
def html_ids(path: Path) -> set[str]:
    parser = ReferenceParser()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser.ids


def main() -> int:
    failures: list[str] = []
    checked = 0
    root_resolved = ROOT.resolve()

    for html_path in hosted_html_files():
        parser = ReferenceParser()
        parser.feed(html_path.read_text(encoding="utf-8"))
        for kind, value in parser.references:
            target, fragment = resolve_reference(html_path, value)
            if target is None:
                continue
            checked += 1
            target_resolved = target.resolve()
            if not target_resolved.is_relative_to(root_resolved):
                failures.append(
                    f"{html_path.relative_to(ROOT)} -> 저장소 밖 경로: {value}"
                )
                continue
            resolved = clean_url_target(target)
            if resolved is None:
                failures.append(
                    f"{html_path.relative_to(ROOT)} -> 누락된 {kind}: {value}"
                )
                continue
            if fragment and resolved.suffix.lower() == ".html":
                if fragment not in html_ids(resolved):
                    failures.append(
                        f"{html_path.relative_to(ROOT)} -> 누락된 앵커: {value}"
                    )

    if failures:
        raise SystemExit("정적 참조 오류:\n- " + "\n- ".join(failures))
    print(f"static references valid: {checked}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
