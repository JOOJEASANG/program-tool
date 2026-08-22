# Program Studio 구조

## 운영 화면

- `pdf-editor/index.html`: PDF 편집기
- `pdf-preflight/index.html`: PDF 검사·보안
- `perfect-binding-cover/index.html`: 책표지 제작
- `design-editor/index.html`: 표지·포스터·전단·리플렛 통합 디자인 편집기 셸
- `design-editor/general.html`: 포스터·전단·리플렛·사용자 지정 공통 편집 화면
- `tools/*.html`: 기존 주소를 위한 호환 이동 페이지

## 공통 프런트엔드

- `js/firebase-config.js`: Firebase 초기화, 인증, 권한, 공통 스크립트 진입
- `js/api.js`: 인증 API 호출, Storage 업로드, 임시 결과 다운로드
- `js/sw-register.js`: 서비스 워커 복구와 화면별 보조 모듈 로딩. 일반 디자인 편집기의 기능 모듈은 `DESIGN_EDITOR_RUNTIME_SCRIPTS` 목록에 의존 순서대로 등록하고 `loadSeries()`가 순차 로드
- `js/app-version.js`: 배포 버전 감지
- `sw.js`: 네트워크 우선 캐시
- `version.json`: 전체 사이트의 단일 배포 버전

서비스 워커 복구는 버전마다 한 번만 수행해 반복 새로고침을 방지합니다. HTML과 버전 파일은 캐시하지 않고 JavaScript/CSS는 항상 재검증합니다.

## 통합 디자인 편집기

- `js/design-editor/app.js`: 기본 프로젝트 상태, 텍스트 요소, 선택·드래그, 자동 저장
- `js/design-editor/asset-store.js`: 편집 이미지 Blob을 IndexedDB에 저장하고 프로젝트에는 `assetId` 참조만 남기는 로컬 자산 저장소
- `js/design-editor/phase2.js`: 이미지·도형과 세부 편집 기능. 새 이미지는 WebP Blob으로 최적화한 뒤 자산 저장소에 넣고 기존 data URL 이미지는 자동 마이그레이션
- `js/design-editor/phase5-draft-scope.js`: 규격별 자동 저장. 자산 저장소로 이동한 이미지의 런타임 `blob:` URL은 자동 저장 JSON에서 제외
- `js/design-editor/phase11-project-file.js`: `.design.json` 저장 시 IndexedDB 이미지를 다시 data URL로 포함하고, 불러올 때 다시 자산 저장소로 분리해 다른 PC 이동성을 유지
- `js/design-editor/phase13-print-quality.js`: 배치 이미지의 유효 DPI를 검사해 현재 면의 인쇄 선명도 위험을 표시
- `js/design-editor/phase14-print-safety.js`: 안전여백·작은 글씨·접지선 충돌을 현재 면 기준으로 검사
- `js/design-editor/phase22-final-print-check.js`: 출력 직전 모든 작업면의 도련·안전여백·접지·이미지 누락·이미지 DPI를 통합 검사하고 치명적 오류가 있으면 출력을 중단
- `js/design-editor/output.js`: 최종 인쇄 검사를 통과한 작업의 300 DPI PNG/PDF 출력. PDF는 표준 JPEG 압축 프로필과 무손실 PNG 페이지 프로필을 선택할 수 있으며 현재 색상 공간은 RGB
- `js/design-editor/phase3-controls.js` 이후 모듈: 정렬, 스마트 배치, 프로젝트 파일, 회전, 인쇄 품질·안전, 빠른 구성, 퀵툴바, 스마트 스냅, 스타일 테마
- 기능 모듈을 추가하거나 순서를 바꿀 때는 `DESIGN_EDITOR_RUNTIME_SCRIPTS`만 수정하고 순서·중복 회귀 테스트를 함께 갱신합니다.

## 백엔드

- `backend/main.py`: Flask 앱, HTTPS 함수, 임시 파일 정리 예약 함수
- `backend/routers/`: PDF 편집·도구·검수 API
- `backend/services/pdf_engine.py`: 페이지 배치와 출력
- `backend/services/pdf_text_renderer.py`: 워터마크, 머리말·꼬리말, 페이지 번호
- `backend/services/pdf_print_marks.py`: 재단선·도련 표시
- `backend/services/preflight_svc.py`: 검수
- `backend/utils/storage_delivery.py`: 20 MiB 초과 결과의 Storage 전달

## 변경 규칙

1. 프로그램 기능은 운영 폴더에서 수정하고 `tools/` 호환 페이지에 복제하지 않습니다.
2. 공통 API 계약은 `js/api.js` 한 곳에서 구성합니다.
3. PDF 레이아웃은 중복 구현이나 런타임 monkeypatch 없이 `pdf_engine.py`에서 수정합니다.
4. 통합 디자인 편집기 기능 모듈은 `js/sw-register.js`의 `DESIGN_EDITOR_RUNTIME_SCRIPTS`에서 로딩 순서를 관리하고 개별 `.then()` 체인을 다시 만들지 않습니다.
5. 디자인 이미지의 자동 저장은 `asset-store.js`를 거쳐 IndexedDB에 보관하고 localStorage 프로젝트 JSON에 base64 이미지 데이터를 다시 넣지 않습니다. 휴대용 `.design.json` 내보내기만 이미지 데이터를 포함합니다.
6. PNG/PDF 출력은 `phase22-final-print-check.js`의 전체 면 검사를 우회하지 않습니다. 이미지 원본 누락처럼 치명적인 오류는 출력 전에 해결해야 합니다.
7. `고품질 PDF`는 300DPI RGB 래스터 페이지를 PNG로 무손실 포함하는 프로필입니다. CMYK 또는 PDF/X 변환 기능으로 표시하거나 오인시키지 않습니다.
8. 화면 변경 시 `version.json`, `sw.js`, `js/sw-register.js`, `js/firebase-config.js` 버전을 동기화합니다.
9. 배포 전 Python, JavaScript, 정적 경로, Firebase 규칙 테스트를 모두 통과시킵니다.
