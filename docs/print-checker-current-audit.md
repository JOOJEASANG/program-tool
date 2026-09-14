# Print Checker current-state audit

2026-09-14 기준 운영 구조와 인쇄물 사전 검토 프로그램의 실제 사용 경로를 다시 점검했다.

## 현재 경계

- 일반 디자인 편집기, 문서 편집기, 이미지 편집기 런타임은 현재 운영 트리에 존재하지 않는다.
- 중단한 `simple-editor` 실험 자산은 운영 트리에 포함하지 않는다.
- `/apps/cover`, `/apps/poster`, `/apps/flyer`, `/apps/invitation`, `/apps/notice`, `/apps/leaflet`은 `apps/index.html`에서 `/print-checker?product=...`으로 즉시 전환한다.
- `js/studio-app-shell.js`와 `js/modular-app-access.js`는 이제 `/apps/pdf-layout`, `/apps/booklet`만 소유하며 삭제된 `design-editor` 런타임을 참조하지 않는다.
- 기존 PDF 2페이지 면 전환 로직은 유지하며 초대장·안내장에서도 1p 앞면 / 2p 뒷면으로 사용한다.
- 기존 리플렛 접지 로직은 변경하지 않는다.
- 초대장·안내장 접지는 중앙 고정이 아니라 방향과 실제 위치(mm)를 지정할 수 있도록 별도 모듈로 보완한다.
- 안전영역 기본 정책은 10mm를 유지한다.

## 2026-09-14 저장소 정리

- Hosting allowlist와 실제 라우팅 어디에도 포함되지 않던 `reset-cache.html`을 제거했다.
- `/apps/booklet`이 canonical `pdf-editor`를 사용하므로 별도 미배포 프로토타입 `booklet/index.html`을 제거했다.
- 모듈 앱 셸에서 삭제된 디자인 편집기용 앱 정의, preload, quick action, frame probe 코드를 제거했다.
- 모듈 접근 어댑터에서 사용되지 않는 `design-studio` 분기를 제거했다.
- `README.md`와 `PROGRAM_STRUCTURE.md`를 현재 운영 구조에 맞춰 갱신했다.

삭제 자체가 위험한 레거시 호환 라우트나 현재 배포 검증에서 사용하는 자산은 임의 삭제하지 않는다. 정리는 실제 미사용이 확인된 항목만 제거하고 회귀검사로 경계를 고정한다.
