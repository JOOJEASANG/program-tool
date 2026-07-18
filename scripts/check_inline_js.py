"""Extract inline JavaScript from HTML files and validate it with Node.js."""
from __future__ import annotations

import subprocess
import tempfile
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class ScriptParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.capture = False
        self.current: list[str] = []
        self.scripts: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag.lower() != "script":
            return
        values = {key.lower(): value for key, value in attrs}
        script_type = (values.get("type") or "text/javascript").lower()
        self.capture = not values.get("src") and script_type in {
            "text/javascript", "application/javascript", "module", ""
        }
        self.current = []

    def handle_data(self, data: str) -> None:
        if self.capture:
            self.current.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "script" and self.capture:
            script = "".join(self.current).strip()
            if script:
                self.scripts.append(script)
            self.capture = False
            self.current = []


def main() -> None:
    checked = 0
    with tempfile.TemporaryDirectory() as temp_dir:
        temp = Path(temp_dir)
        for html_path in sorted(ROOT.rglob("*.html")):
            if any(part in {".git", "node_modules", "backups"} for part in html_path.parts):
                continue
            parser = ScriptParser()
            parser.feed(html_path.read_text(encoding="utf-8"))
            for index, script in enumerate(parser.scripts):
                suffix = ".mjs" if script.lstrip().startswith(("import ", "export ")) else ".js"
                js_path = temp / f"{html_path.stem}-{index}{suffix}"
                js_path.write_text(script, encoding="utf-8")
                result = subprocess.run(
                    ["node", "--check", str(js_path)],
                    text=True,
                    capture_output=True,
                )
                if result.returncode:
                    raise SystemExit(
                        f"Inline JavaScript syntax error in {html_path.relative_to(ROOT)} script #{index + 1}:\n"
                        f"{result.stderr or result.stdout}"
                    )
                checked += 1
    print(f"Inline JavaScript checks passed: {checked} scripts")


if __name__ == "__main__":
    main()
