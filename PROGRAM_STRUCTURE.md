# Program Studio 현재 구조

이 문서는 현재 `main` 운영 구조만 기록합니다. 제거된 디자인 편집기나 과거 실험 구조는 운영 구조로 취급하지 않습니다.

## 메인 프로그램 5개

홈의 기준 목록은 `js/pdf-suite-home-launcher.js`가 소유합니다.

1. `print-checker/` — 인쇄물 사전 검토
2. `smart-print-layout/` — 스마트 인쇄배치
3. `pdf-editor/` — PDF배치
4. `pdf-editor-advanced/` — PDF편집
5. `pdf-suite/` — PDF 유틸리티

홈 카드의 `?` 버튼은 `js/program-manuals/home-modal.js`와 프로그램별 설명서 자산을 사용해 레이어 설명서를 표시합니다.

## 인쇄물 사전 검토

- 화면: `print-checker/index.html`
- 핵심: `js/print-checker/print-checker.js`
- 역할: 표지·리플렛·전단지·초대장·소책자의 규격, 도련, 안전영역, 책등, 날개, 접지, 페이지 구성과 업로드 파일을 대조합니다.
- 보조 런타임: `js/print-checker/` 아래의 제품 전환, 파일 상대 미리보기, 생산 안내선, 내용 검사, 확대/축소 모듈
- 접근 정책: 공개 일일 무료 사용량 정책을 적용하며 승인 전용 도구가 아닙니다.

과거 디자인 앱 주소(`/apps/cover`, `/apps/poster`, `/apps/flyer`, `/apps/invitation`, `/apps/notice`, `/apps/leaflet`)는 `apps/index.html`에서 해당 인쇄물 검토 제품으로 이동시키는 호환 경로입니다. 별도 `design-editor` 런타임은 존재하지 않습니다.

## PDF 프로그램

### PDF배치

- 화면: `pdf-editor/index.html`
- route runtime: `js/pdf-editor/route-runtime.js`
- 핵심/화면 runtime: `js/pdf-editor/core-runtime.js`, `js/pdf-editor/ui-runtime.js`
- 독립 앱 프로필: `js/pdf-editor/standalone-app-profile.js`
- 경계 제어: `js/pdf-editor/app-boundary.js`

`/apps/pdf-layout`과 `/apps/booklet`은 `apps/index.html`의 얇은 셸을 통해 각각 다음 canonical 화면을 사용합니다.

- `/pdf-editor/?embed=1&app=layout`
- `/pdf-editor/?embed=1&app=booklet`

`js/studio-app-shell.js`는 이 두 PDF 경로만 소유합니다. 디자인 편집기 프리로드나 디자인 전용 빠른 작업 코드는 소유하지 않습니다.

### PDF편집

- 화면: `pdf-editor-advanced/index.html`
- 모듈: `js/pdf-editor-advanced/`
- PDF배치/N-up/소책자 상태를 섞지 않는 독립 정밀 편집 화면입니다.

### PDF 유틸리티

- 화면: `pdf-suite/index.html`
- 모듈: `js/pdf-suite/`
- 합치기·분할·변환·OCR·압축·암호·검사 등 PDF 유틸리티를 한 화면에서 제공합니다.
- `pdf-preflight/`는 기존 검사 기능과 내부/호환 흐름을 위해 유지되며 홈의 별도 프로그램 카드는 아닙니다.

## 스마트 인쇄배치

- 화면: `smart-print-layout/index.html`
- 모듈: `js/smart-print-layout/`
- PDF 실제 크기와 수량을 기준으로 용지 배치와 양면 위치를 계산합니다.

## 호환 진입점

기존 공개 URL을 깨지 않기 위해 일부 얇은 이동 페이지를 유지합니다. 파일이 작거나 기능이 없어 보여도 아래 경로는 임의 삭제하지 않습니다.

- `perfect-binding-cover/index.html`
- `tools/pdf-editor.html`
- `tools/perfect-binding-cover.html`
- `pdf-preflight/index.html`
- `/apps/**` → `apps/index.html` Firebase rewrite

호환 페이지 목록과 Hosting 공개 범위는 `scripts/inject_boot_guard.py`, `scripts/prepare_hosting_dist.py`, `scripts/validate_release_hygiene.py`의 계약으로 검증합니다.

## 공통 프런트엔드

- `js/firebase-config.js` — Firebase 초기화와 인증 기반 공통 상태
- `js/api.js` — 인증 API 호출, 업로드, 결과 전달
- `js/app-version.js` — 배포 버전 확인과 자기 소유 보조 기능
- `js/sw-register.js` — 과거 서비스 워커/캐시 정리와 현재 route runtime 연결
- `sw.js` — 과거 클라이언트 복구용 비활성화 호환 파일
- `version.json` — 배포 버전 기준

기능 모듈은 하나의 runtime owner만 가져야 하며 상위 로더가 nested manifest의 모듈을 중복 소유하지 않습니다.

## 백엔드

- `backend/routers/` — Flask API 진입점
- `backend/services/pdf_engine.py` — PDF 레이아웃 처리 핵심
- `backend/services/preflight_svc.py` — PDF 검사
- `backend/services/pdf_text_renderer.py` — 워터마크·머리말·꼬리말·페이지 번호
- `backend/services/pdf_print_marks.py` — 재단선·도련 표시
- `backend/utils/storage_delivery.py` — 대용량 결과의 비공개 임시 전달

임시 입력·결과와 사용자 저장 데이터는 Storage Rules, Firestore schema, 서버 정리 작업, lifecycle 정책을 겹쳐 보호합니다.

## 관리자·배포

- 관리자 권한의 목표 기준은 Firebase Auth custom claim `admin=true`입니다.
- `.github/workflows/firebase-deploy.yml`은 `main` 병합 후 품질 게이트를 통과하면 Hosting, Functions, Firestore/Storage Rules를 배포합니다.
- `scripts/firebase_ci.sh`는 WIF/ADC를 우선하고 설정이 없는 환경에서만 허용된 fallback을 사용합니다.
- Hosting은 저장소 전체가 아니라 `scripts/prepare_hosting_dist.py`의 allowlist 결과만 배포합니다.

## 품질 게이트

PR과 운영 배포 전 다음을 검증합니다.

- Python compile 및 pytest 회귀 테스트
- JavaScript와 inline JavaScript 문법
- JSON, 정적 자산, route/runtime manifest
- 독립 앱 경계와 PDF shell Chrome smoke
- 인쇄물 검토 제품 전환 및 실제 브라우저 smoke
- PDF 프로그램별 Chrome smoke
- Firebase Firestore/Storage Rules
- 공개 first-paint와 runtime asset 검사
- 운영 배포 후 실제 사용자 경로 검증

## 변경 원칙

1. 현재 메인 5개 프로그램의 사용자 경로를 우선 보존합니다.
2. 제거된 시스템의 런타임 참조를 새 코드에 다시 추가하지 않습니다.
3. 호환 진입점은 테스트와 Hosting 계약을 확인한 뒤에만 제거합니다.
4. 기능 모듈은 하나의 canonical owner만 둡니다.
5. UI 정리는 기능 변경과 분리하고, 기존 사용자 동작을 회귀검사로 보호합니다.
6. 문서는 현재 운영 구조와 일치하도록 유지하며 이미 제거된 기능을 현행 기능처럼 기술하지 않습니다.
