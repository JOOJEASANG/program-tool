# GitHub Copilot instructions for Program Studio

When you change any user-visible Program Studio feature, update the matching user manual in the same change. Do not treat documentation as optional follow-up work.

Manual source files:

- `js/program-manuals/print-checker.js` for 인쇄물 사전 검토
- `js/program-manuals/smart-print-layout.js` for 스마트 인쇄배치
- `js/program-manuals/pdf-editor.js` for PDF배치
- `js/program-manuals/pdf-editor-advanced.js` for PDF편집
- `js/program-manuals/pdf-suite.js` for PDF 유틸리티

For a user-visible change, update all manual parts affected by the change: quick-start steps, detailed feature descriptions, defaults/limits, warnings, troubleshooting, glossary, and the animated `demo` flow. Update the manual's `updated` date.

Read `docs/manuals/README.md` for the full documentation contract. The `Manual sync guard` GitHub Action checks that program source changes include the matching manual file.

Do not document planned behavior as if it is implemented. Do not leave removed controls or old defaults in the manual. Pure internal refactors, comments, and test-only changes that do not alter user behavior do not require a manual edit.
