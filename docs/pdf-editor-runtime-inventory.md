# PDF 편집기 활성 런타임 기준

기준일: 2026-09-18

## 운영 원칙

PDF 편집기는 하나의 canonical 엔진을 사용하고, 경로별 보조 기능은 명시적인 runtime manifest에서만 로드합니다. 전역 함수를 반복 감싸는 monkeypatch, `setInterval` 기반 DOM 보정, 중복 loader는 다시 도입하지 않습니다.

## 로딩 책임

- `js/sw-register.js`: 경로를 판별하고 `js/pdf-editor/route-runtime.js`만 진입점으로 로드
- `js/pdf-editor/route-runtime.js`: PDF 편집기 경로 전용 보조 모듈의 canonical owner
- `js/pdf-editor/loader.js`: 편집기 UI 보조 초기화 후 `core-runtime.js`를 로드
- `js/pdf-editor/core-runtime.js`: 기본 편집기의 핵심 8개 모듈을 소유
- `js/pdf-editor/advanced-runtime.js`: 고급 편집기 전용 정밀 편집 모듈을 소유

`sw-register.js` 안의 과거 PDF module 목록은 source-contract 호환용 주석일 뿐 실행되지 않습니다.

## 기본 편집기 핵심 모듈 8개

`core-runtime.js`가 다음 모듈을 한 번씩 로드합니다.

1. `font-render-fix.js`
2. `upload-fix.js`
3. `live-preview.js`
4. `layout-export.js`
5. `page-count-hint.js`
6. `nup-helper.js`
7. `preview-row-default.js`
8. `divider-helper.js`

고급 편집기에서는 일반 N-up/간지용 일부 모듈을 제외하고 고급 전용 runtime을 사용합니다.

## 경로 전용 보조 모듈

`route-runtime.js`는 현재 다음 범주의 기능을 소유합니다.

- 공통 셸·모바일 안내
- 저장 용량 가드
- 재단선·도련
- 저장 실패 복구
- 세션 저장 안전성
- 파일 단위 컨텍스트 작업
- import transaction 안전성
- viewport lazy preview 및 guard
- 파일 탐색
- 부드러운 레이아웃 미리보기
- 미리보기 삽입 상태 보존
- 간지 이미지/모달 보조
- 펼침면 분리
- 소책자 sheet preview
- standalone layout/booklet 경계
- 이미지 입력 bridge
- 사이드바 액션 통일

각 스크립트 ID와 경로는 중복 없이 manifest에서 한 곳만 소유해야 합니다.

## 비활성 호환 파일

다음 파일은 현재 executable runtime에서 직접 로드하지 않지만 회귀 계약 때문에 저장소에 남아 있습니다.

- `page-number-auto-reserve.js`
- `page-number-auto-reserve-layout-v2.js`
- `page-number-preview-parity.js`
- `operation-progress-summary.js`

필요 기능은 현재 runtime에 통합돼 있으므로 이 파일을 다시 직접 로드하지 않습니다. 삭제 여부는 별도 참조 0건 확인과 회귀검사를 거쳐 결정합니다.

## 회귀 방지 기준

- 기본 core manifest는 승인된 8개 모듈 유지
- route runtime에서 동일 script id/path 중복 금지
- `sw-register.js`가 PDF 세부 모듈을 직접 소유하지 않음
- 퇴역 patch/monkeypatch 모듈 재도입 금지
- 기본 편집기와 고급 편집기 runtime 경계 유지
- Firebase PR preview와 브라우저 smoke 통과
- 저장 성공·취소·실패·복구 경로 회귀 없음
