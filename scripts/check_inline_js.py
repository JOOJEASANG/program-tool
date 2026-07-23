#!/usr/bin/env python3
"""Extract inline JavaScript from hosted HTML files and validate it with Node.js."""
from __future__ import annotations

import re
import subprocess
import tempfile
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
IGNORED_DIRS = {".git", ".github", "node_modules", "backend", "backups"}
CLASSIC_TYPES = {"", "text/javascript", "application/javascript"}


@dataclass(frozen=True)
class InlineScript:
    source: str
    is_module: bool


class ScriptParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.capture = False
        self.current: list[str] = []
        self.current_is_module = False
        self.scripts: list[InlineScript] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag.lower() != "script":
            return
        values = {str(key).lower(): value for key, value in attrs}
        script_type = str(values.get("type") or "text/javascript").strip().lower()
        self.current_is_module = script_type == "module"
        self.capture = (
            not values.get("src")
            and (self.current_is_module or script_type in CLASSIC_TYPES)
        )
        self.current = []

    def handle_data(self, data: str) -> None:
        if self.capture:
            self.current.append(data)

    def handle_entityref(self, name: str) -> None:
        if self.capture:
            self.current.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        if self.capture:
            self.current.append(f"&#{name};")

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() != "script":
            return
        if self.capture:
            script = "".join(self.current).strip()
            if script:
                self.scripts.append(
                    InlineScript(source=script, is_module=self.current_is_module)
                )
        self.capture = False
        self.current = []
        self.current_is_module = False


def hosted_html_files():
    for path in sorted(ROOT.rglob("*.html")):
        relative = path.relative_to(ROOT)
        if any(part in IGNORED_DIRS or part.startswith(".") for part in relative.parts):
            continue
        yield path


def _safe_stem(path: Path) -> str:
    relative = path.relative_to(ROOT).as_posix()
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", relative)


def main() -> int:
    checked = 0
    with tempfile.TemporaryDirectory() as temp_dir:
        temp = Path(temp_dir)
        for html_path in hosted_html_files():
            parser = ScriptParser()
            parser.feed(html_path.read_text(encoding="utf-8"))
            for index, inline in enumerate(parser.scripts):
                suffix = ".mjs" if inline.is_module else ".js"
                js_path = temp / f"{_safe_stem(html_path)}-{index}{suffix}"
                js_path.write_text(inline.source, encoding="utf-8")
                result = subprocess.run(
                    ["node", "--check", str(js_path)],
                    text=True,
                    capture_output=True,
                    check=False,
                )
                if result.returncode:
                    mode = "module" if inline.is_module else "classic"
                    raise SystemExit(
                        f"Inline JavaScript syntax error in {html_path.relative_to(ROOT)} "
                        f"script #{index + 1} ({mode}):\n"
                        f"{result.stderr or result.stdout}"
                    )
                checked += 1

    print(f"inline JavaScript checks passed: {checked}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
