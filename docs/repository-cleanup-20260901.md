# Repository cleanup — 2026-09-01

이번 정리는 현재 런타임과 저장소 검색에서 참조가 확인되지 않는 파일만 제거한다.

## Removed

- `.github/workflows/backup-before-unified-print.yml`
- `js/design-editor/essential-workspace.js`
- `js/design-editor/workflow-v2.js`
- `js/design-editor/preview-guide-enhancement.js`
- `js/design-editor/print-production-stage2.js`
- `js/design-editor/cover-preview-cleanup.js`
- `js/design-editor/shape-inspector-ux.js`
- `js/design-editor/shape-border-controls.js`
- `js/design-editor/text-auto-fit.js`
- `js/design-editor/typography-pro.js`

## Safety rule

활성 `core-runtime.js`, `shell-runtime.js`, HTML 또는 다른 모듈에서 경로 참조가 있는 파일은 이번 정리에서 제거하지 않는다.

전체 CI와 디자인 편집기 브라우저 스모크, Firebase 미리보기 검증을 통과한 뒤 병합한다.
