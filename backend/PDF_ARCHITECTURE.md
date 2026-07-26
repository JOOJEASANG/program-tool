# PDF backend architecture

The PDF backend uses explicit service calls. Runtime monkeypatch modules are not part of the supported architecture.

## Processing entrypoints

- `routers/pdf.py` receives API requests and calls `services.pdf_engine.process_pdf_bytes`.
- `services/pdf_disk_ops.py` handles path-based processing.
- `services/pdf_layout_engine.py` invokes the advanced independent-margin and booklet implementation.

## Rendering services

- `services/pdf_divider_renderer.py` renders divider pages.
- `services/pdf_text_renderer.py` renders Korean text overlays, watermarks, headers, footers, and page numbers.
- `services/pdf_print_marks.py` applies print marks when enabled.

## Preflight services

- `services/preflight_svc.py` performs the individual checks.
- `services/preflight_reliability.py` marks sampled pass results as partial warnings.
- `services/preflight_repair.py` rebuilds PDFs while preserving each source page size.

## Maintenance rule

Do not add `*_patch.py` service modules or startup imports that replace functions at runtime. Extend the owning service or introduce an explicitly imported implementation instead. `tests/test_no_runtime_patch_modules.py` enforces this rule.
