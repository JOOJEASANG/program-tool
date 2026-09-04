#!/usr/bin/env python3
"""Validate local runtime assets and canonical ownership contracts."""
from __future__ import annotations
import re, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PREFLIGHT_RUNTIME=Path("js/pdf-preflight/route-runtime.js")
RUNTIME_SOURCES=(Path("js/sw-register.js"),Path("js/app-version.js"),Path("js/firebase-config.js"),Path("js/program-studio-ui-v2.js"),Path("js/pdf-editor/route-runtime.js"),Path("js/pdf-editor/core-runtime.js"),Path("js/pdf-editor/ui-runtime.js"),Path("js/pdf-editor/loader.js"),PREFLIGHT_RUNTIME)
CANONICAL_RUNTIME_OWNERS=(Path("js/sw-register.js"),Path("js/pdf-editor/route-runtime.js"),Path("js/pdf-editor/core-runtime.js"),Path("js/pdf-editor/ui-runtime.js"),PREFLIGHT_RUNTIME)
PREFLIGHT_NON_OWNERS=(Path("js/sw-register.js"),Path("js/app-version.js"),Path("js/program-studio-ui-v2.js"))
RETIRED_RUNTIME_ASSETS=(Path("js/home-premium-ui.js"),Path("js/home-hero-console-v2.js"),Path("js/home-dashboard-v2.js"),Path("js/home-header-footer-refine.js"),Path("js/home-hero-upgrade.js"),Path("js/home-pdf-utility-name-sync.js"),Path("js/home-print-workflow.js"),Path("js/home-professional-suite.js"),Path("js/home-program-catalog.js"),Path("js/ai-design-feature-gate.js"),Path("js/pdf-utility-first-paint.js"),Path("js/pdf-utility-cost-policy-hardening.js"))
RETIRED_COMPAT_FILES=(Path("tools/preflight.html"),Path("tools/pdf-Checker.html"))
ASSET_LITERAL_RE=re.compile(r"[\'\"`](/(?:js|css)/[^\'\"`\s]+)[\'\"`]")
LOAD_RE=re.compile(r"load\(\s*[\'\"](?P<id>[^\'\"]+)[\'\"]\s*,\s*[\'\"](?P<src>/js/[^\'\"]+)[\'\"]")
SCOPED_LOAD_RE=re.compile(r"loadScopedScript\(\s*[\'\"](?P<id>[^\'\"]+)[\'\"]\s*,\s*[\'\"](?P<src>/js/[^\'\"]+)[\'\"]")
MANIFEST_ENTRY_RE=re.compile(r"\{\s*id\s*:\s*[\'\"](?P<id>[^\'\"]+)[\'\"]\s*,\s*src\s*:\s*[\'\"](?P<src>/js/[^\'\"]+)[\'\"]")
BLOCK_COMMENT_RE=re.compile(r"/\*.*?\*/",re.S)
def read(relative):
 p=ROOT/relative
 if not p.is_file(): raise AssertionError(f"Required runtime source is missing: {relative.as_posix()}")
 return p.read_text(encoding="utf-8")
def active_js(text): return BLOCK_COMMENT_RE.sub("",text)
def normalize_asset(raw): return raw.split("?",1)[0].split("#",1)[0]
def filesystem_path(asset): return ROOT/asset.lstrip("/")
def collect_literal_assets(text): return {normalize_asset(m.group(1)) for m in ASSET_LITERAL_RE.finditer(text)}
def collect_script_entries(text):
 text=active_js(text); out=[]
 for pattern in (LOAD_RE,SCOPED_LOAD_RE,MANIFEST_ENTRY_RE): out.extend((m.group("id"),m.group("src")) for m in pattern.finditer(text))
 return out
def validate_observer_runtime_ownership(source_text):
 errors=[]; observer_by_id={}; canonical_by_id={}
 for sid,src in collect_script_entries(source_text[Path("js/app-version.js")]): observer_by_id.setdefault(sid,set()).add(src)
 for relative in CANONICAL_RUNTIME_OWNERS:
  for sid,src in collect_script_entries(source_text[relative]): canonical_by_id.setdefault(sid,[]).append((relative,src))
 for sid,sources in sorted(observer_by_id.items()):
  owners=canonical_by_id.get(sid,[])
  if owners: errors.append(f"app-version.js duplicates canonical runtime script id {sid!r}; owned by "+", ".join(f"{p.as_posix()} -> {s}" for p,s in owners))
  if len(sources)>1: errors.append(f"app-version.js maps script id {sid!r} to conflicting sources: {sorted(sources)!r}")
 return errors
def validate_preflight_runtime_ownership(source_text):
 errors=[]; entries=collect_script_entries(source_text[PREFLIGHT_RUNTIME]); ids=[i for i,_ in entries]; paths=[normalize_asset(s) for _,s in entries]
 if not entries: return ["PDF preflight canonical runtime manifest is empty"]
 if len(ids)!=len(set(ids)): errors.append(f"PDF preflight runtime has duplicate script ids: {ids}")
 if len(paths)!=len(set(paths)): errors.append(f"PDF preflight runtime has duplicate asset requests: {paths}")
 owned_ids=set(ids); owned_paths=set(paths)
 for relative in PREFLIGHT_NON_OWNERS:
  for sid,src in collect_script_entries(source_text[relative]):
   normalized=normalize_asset(src)
   if sid in owned_ids or normalized in owned_paths: errors.append(f"PDF preflight runtime asset is also owned by {relative.as_posix()}: {sid} -> {normalized}")
 if "pdfPreflightPanelBalanceScriptV1" not in ids: errors.append("PDF preflight final clean-workspace UI module is missing from canonical runtime")
 elif ids[-1]!="pdfPreflightPanelBalanceScriptV1": errors.append("PDF preflight clean-workspace UI must load last to prevent old-screen overwrite")
 return errors
def validate():
 source_text={r:read(r) for r in RUNTIME_SOURCES}; errors=[]; dynamic_assets=set()
 for relative,text in source_text.items():
  for asset in collect_literal_assets(active_js(text)):
   dynamic_assets.add(asset)
   if not filesystem_path(asset).is_file(): errors.append(f"Missing dynamic asset: {asset} (referenced by {relative.as_posix()})")
 errors.extend(validate_observer_runtime_ownership(source_text)); errors.extend(validate_preflight_runtime_ownership(source_text))
 sw=active_js(source_text[Path("js/sw-register.js")]); ui=active_js(source_text[Path("js/program-studio-ui-v2.js")])
 if "navigator.serviceWorker.register" in sw or "serviceWorker.register(" in sw: errors.append("js/sw-register.js must clean up retired workers, not register a new service worker")
 if not (ROOT/"sw.js").is_file(): errors.append("sw.js compatibility artifact is missing; keep it while old clients may still request it")
 for retired in RETIRED_RUNTIME_ASSETS:
  if retired.name in sw or retired.name in ui: errors.append(f"Retired runtime asset is still referenced by shared runtime: {retired.name}")
  if (ROOT/retired).exists(): errors.append(f"Retired legacy asset was reintroduced: {retired.as_posix()}")
 for retired in RETIRED_COMPAT_FILES:
  if (ROOT/retired).exists(): errors.append(f"Retired compatibility file was reintroduced: {retired.as_posix()}")
 if "if(isHome())" in sw: errors.append("Static home must not regain a dynamic home-overlay loader")
 if errors:
  print("Runtime asset validation failed:",file=sys.stderr)
  for error in errors: print(f" - {error}",file=sys.stderr)
  raise SystemExit(1)
 print(f"Runtime assets OK: {len(dynamic_assets)} local dynamic asset(s) exist; preflight canonical modules {len(collect_script_entries(source_text[PREFLIGHT_RUNTIME]))}; static home has no overlay helpers; retired runtime assets absent: {len(RETIRED_RUNTIME_ASSETS)}")
if __name__=="__main__": validate()
