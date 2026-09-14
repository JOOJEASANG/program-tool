# GitHub Copilot instructions for Program Studio

When you change a user-visible Program Studio feature, update the matching user manual in the same change. Documentation is part of the feature change, not optional follow-up work.

Manual source files:

- `js/program-manuals/print-checker.js` for 인쇄물 사전 검토
- `js/program-manuals/smart-print-layout.js` for 스마트 인쇄배치
- `js/program-manuals/pdf-editor.js` for PDF배치
- `js/program-manuals/pdf-editor-advanced.js` for PDF편집
- `js/program-manuals/pdf-suite.js` for PDF 유틸리티
- `js/program-manuals/catalog.js` for the manual catalog

For a user-visible change, update the affected usage steps, feature descriptions, defaults/limits, warnings, troubleshooting, glossary, and the manual's `updated` date where applicable.

Do not document planned behavior as implemented. Do not leave removed controls or old defaults in a manual. Pure internal refactors, comments, tests, and dead-code cleanup that do not alter user behavior do not require a manual edit.

Repository architecture rules:

- Do not reintroduce the retired `design-editor`, `document-editor`, `image-editor`, or `simple-editor` runtimes.
- Print-design routes use `print-checker`.
- `/apps/pdf-layout` and `/apps/booklet` reuse the canonical `pdf-editor` engine rather than duplicating it.
- Compatibility routes should remain thin entry points to canonical runtimes.

Before completing a change, follow the current validation commands in `README.md` and the GitHub Actions quality gates under `.github/workflows/`.
