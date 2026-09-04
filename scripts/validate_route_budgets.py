#!/usr/bin/env python3
"""Keep selected route bootstrap helper manifests within deterministic local budgets."""
from __future__ import annotations
import re,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];SW=ROOT/"js/sw-register.js";UI=ROOT/"js/program-studio-ui-v2.js";PDF_RUNTIME=ROOT/"js/pdf-editor/route-runtime.js";PREFLIGHT_RUNTIME=ROOT/"js/pdf-preflight/route-runtime.js"
ASSET_RE=re.compile(r"[\'\"`](/js/[^\'\"`\s]+)[\'\"`]");MANIFEST_RE=re.compile(r"\{\s*id\s*:\s*[\'\"][^\'\"]+[\'\"]\s*,\s*src\s*:\s*[\'\"](?P<src>/js/[^\'\"]+)")
ROUTE_BUDGETS={"home":(6,88_000),"admin":(6,100_000),"pdf-editor":(24,950_000)};PREFLIGHT_ROUTE_BUDGET=(22,1_100_000);UI_ENHANCEMENTS={"admin":"adminWorkflowV2Script"}
def normalize(raw):return raw.split("?",1)[0].split("#",1)[0]
def assets(text):return {normalize(m.group(1)) for m in ASSET_RE.finditer(text)}
def manifest_assets(path):
 text=path.read_text(encoding="utf-8");found={normalize(m.group("src")) for m in MANIFEST_RE.finditer(text)}
 if not found:raise AssertionError(f"Could not resolve canonical runtime manifest: {path.relative_to(ROOT).as_posix()}")
 return found
def segment(text,start,end):
 left=text.find(start);right=text.find(end,left+len(start)) if left>=0 else -1
 if left<0 or right<0:raise AssertionError(f"Could not isolate runtime segment: {start!r} -> {end!r}")
 return text[left:right]
def ui_asset(text,script_id):
 m=re.search(rf"loadEnhancement\(\s*[\'\"]{re.escape(script_id)}[\'\"]\s*,\s*[\'\"](?P<src>/js/[^\'\"]+)",text)
 if not m:raise AssertionError(f"Could not resolve UI enhancement: {script_id}")
 return normalize(m.group("src"))
def collect_routes(sw_text,ui_text):
 pdf_marker="if(isPath('/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html'))"
 common=assets(segment(sw_text,"async function helpers(){",pdf_marker))
 routes={"home":set(common),"admin":set(common),"pdf-editor":common|manifest_assets(PDF_RUNTIME)}
 for route,script_id in UI_ENHANCEMENTS.items():routes[route].add(ui_asset(ui_text,script_id))
 return routes
def _check_budget(route,route_assets,budget,errors):
 count_budget,byte_budget=budget;missing=[a for a in sorted(route_assets) if not (ROOT/a.lstrip('/')).is_file()]
 if missing:errors.append(f"{route}: missing bootstrap assets {missing}");return f"{route}=missing"
 byte_count=sum((ROOT/a.lstrip('/')).stat().st_size for a in route_assets)
 if len(route_assets)>count_budget:errors.append(f"{route}: {len(route_assets)} assets exceed count budget {count_budget}")
 if byte_count>byte_budget:errors.append(f"{route}: {byte_count:,} bytes exceed budget {byte_budget:,}")
 return f"{route}={len(route_assets)}/{count_budget} assets, {byte_count:,}/{byte_budget:,} bytes"
def validate():
 errors=[];sw_text=SW.read_text(encoding="utf-8");ui_text=UI.read_text(encoding="utf-8")
 try:routes=collect_routes(sw_text,ui_text);preflight_assets=manifest_assets(PREFLIGHT_RUNTIME)
 except AssertionError as error:print(f"Route budget validation failed: {error}",file=sys.stderr);raise SystemExit(1)
 summaries=[_check_budget(route,a,ROUTE_BUDGETS[route],errors) for route,a in routes.items()];summaries.append(_check_budget("pdf-preflight",preflight_assets,PREFLIGHT_ROUTE_BUDGET,errors))
 if errors:
  print("Route budget validation failed:",file=sys.stderr)
  for error in errors:print(f" - {error}",file=sys.stderr)
  raise SystemExit(1)
 print("Route bootstrap budgets OK: "+"; ".join(summaries))
if __name__=="__main__":validate()
