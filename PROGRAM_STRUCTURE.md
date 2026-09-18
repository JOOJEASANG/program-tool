# Program Studio 구조

이 문서는 2026-09-18 기준 운영 `main` 구조를 설명합니다. 과거 디자인/문서/이미지 편집기 실험 구조는 현재 운영 트리에서 제거되어 있으며, 실제 배포 경로와 canonical runtime을 기준으로만 기록합니다.

## 1. 운영 화면

### 기본/계정 화면

- `index.html`: 서비스 홈
- `login.html`: 로그인·회원가입
- `approval-waiting.html`: 승인 대기 상태
- `guide.html`: 이용안내
- `terms.html`, `privacy.html`: 약관·개인정보처리방침

### 승인 회원 운영 프로그램

홈 런처는 다음 6개 프로그램을 운영합니다.

- `print-checker/index.html`: 디자인 검토
- `ai-design-maker/index.html`: AI 디자인 제작
- `smart-print-layout/index.html`: 스마트 인쇄배치
- `pdf-editor/index.html`: PDF배치
- `pdf-editor-advanced/index.html`: PDF편집
- `pdf-suite/index.html`: PDF 유틸리티

`pdf-preflight/index.html`은 PDF 검사·보안·유틸리티 전문 경로로 유지됩니다. 모든 운영 프로그램은 로그인과 관리자 승인 상태를 공통 접근 조건으로 사용합니다.

### 호환 진입점

- `perfect-binding-cover/index.html`
- `tools/pdf-editor.html`
- `tools/perfect-binding-cover.html`
- `dashboard.html`
- `legal/*.html`

호환 진입점은 기능을 복제하지 않고 canonical 화면으로 연결하기 위한 얇은 경로입니다.

## 2. `/apps/**` 라우팅

Firebase Hosting은 `/apps/**`를 `apps/index.html`로 연결합니다.

### 인쇄물 계열

다음 경로는 더 이상 별도 디자인 편집기를 로드하지 않고 `print-checker`로 즉시 이동합니다.

- `/apps/cover` → `/print-checker?product=cover`
- `/apps/poster`, `/apps/flyer` → `/print-checker?product=flyer`
- `/apps/invitation`, `/apps/notice` → `/print-checker?product=invitation`
- `/apps/leaflet` → `/print-checker?product=leaflet`

`design-editor`, `document-editor`, `image-editor`, `simple-editor` 런타임은 운영 트리에 존재하지 않습니다.

### PDF 계열

- `/apps/pdf-layout` → 공통 셸 → `/pdf-editor/?embed=1&app=layout`
- `/apps/booklet` → 공통 셸 → `/pdf-editor/?embed=1&app=booklet`

소유권:

- `apps/index.html`: 공통 화면 셸
- `js/studio-app-shell.js`: PDF 앱 이름·설명·iframe 연결·access/ready 상태 조정
- `js/modular-app-access.js`: PDF 앱의 공통 `ProgramAccess.guardTool` 연결
- `js/pdf-editor/standalone-app-profile.js`: layout/booklet 프로필
- `js/pdf-editor/app-boundary.js`: 앱별 UI 경계
- `js/pdf-editor/route-runtime.js`: PDF route 보조 모듈 로더

PDF 기능 자체는 `/apps/**`에 복제하지 않고 `pdf-editor` canonical runtime이 소유합니다.

## 3. 디자인 검토와 AI 제작 경계

### 디자인 검토

주요 파일:

- `print-checker/index.html`
- `css/print-checker.css`
- `js/print-checker/print-checker.js`
- `js/print-checker/core-api.js`
- `js/print-checker/access.js`
- `js/print-checker/invitation-duplex-fold.js`

현재 정책:

- 완성 인쇄물의 규격·도련·안전영역·책등·접지와 실제 파일을 대조
- 초대장/안내장 2페이지 PDF는 1p 앞면 · 2p 뒷면으로 사용
- 초대장/안내장 접지는 방향과 실제 위치(mm)를 지정 가능
- 리플렛 기존 접지 로직 유지
- 사용횟수 제한 없이 승인 회원 여부만 접근 조건으로 사용

### AI 디자인 제작

주요 파일:

- `ai-design-maker/index.html`
- `css/ai-design-maker.css`
- `js/ai-design-maker.js`
- `backend/routers/preflight_ai_design.py`
- `backend/services/ai_cover_image.py`

현재 정책:

- 표지 전체 펼침 배경은 서버의 `gpt-image-2`로 생성
- OpenAI API 키는 브라우저에 노출하지 않음
- 한글 제목·기관명·책등 문구와 로고는 브라우저 레이어로 합성
- 장시간 생성 요청은 Firebase ID 토큰을 포함해 Functions 직접 URL로 전송
- 300dpi PNG 출력은 브라우저가 실제 mm 규격을 기준으로 합성

관련 회귀검사는 제거된 편집기 자산이 다시 유입되지 않도록 경계를 고정합니다.

## 4. PDF 프런트엔드 소유권

### PDF 편집기

- `pdf-editor/index.html`: canonical 화면
- `js/pdf-editor/core-runtime.js`: 핵심 런타임
- `js/pdf-editor/ui-runtime.js`: UI 런타임
- `js/pdf-editor/route-runtime.js`: route별 보조 모듈
- `js/pdf-editor/app-boundary.js`: layout/booklet 전용 경계
- `js/pdf-editor/standalone-app-profile.js`: 독립 앱 프로필

### PDF 고급 편집기

`pdf-editor-advanced`는 기존 N-up/소책자 UI를 끌어오지 않는 독립 편집기입니다.

- `pdf-editor-advanced/index.html`
- `css/pdf-editor-advanced.css`
- `js/pdf-editor-advanced/app.js`
- `js/pdf-editor-advanced/state.js`
- `js/pdf-editor-advanced/preview.js`
- `js/pdf-editor-advanced/api.js`

### PDF 검사·유틸리티

- `pdf-preflight/index.html`
- `js/pdf-preflight/`
- `js/pdf-utility.js`, `js/pdf-utility/`
- `js/pdf-suite/`

## 5. 백엔드

Firebase Functions 진입점은 `backend/main.py`이며 Flask router와 PDF 서비스를 연결합니다.

주요 router:

- `backend/routers/pdf.py`
- `backend/routers/pdf_advanced.py`
- `backend/routers/pdf_tools.py`
- `backend/routers/pdf_utility.py`
- `backend/routers/preflight.py`

주요 service:

- `backend/services/pdf_engine.py`: PDF 배치/렌더링 핵심
- `backend/services/pdf_advanced_engine.py`: 고급 PDF 편집 처리
- `backend/services/pdf_ops.py`: 공통 PDF 연산
- `backend/services/pdf_text_renderer.py`: 워터마크·머리말·꼬리말·페이지 번호
- `backend/services/pdf_print_marks.py`: 인쇄 표시
- `backend/services/pdf_tiling.py`: 대형 출력 타일링
- `backend/services/preflight_svc.py`: PDF 검사
- `backend/services/preflight_auto_fix.py`, `preflight_repair.py`: 제한적 자동 수정/복구
- `backend/services/smart_print_layout.py`: 스마트 인쇄 배치

## 6. 공통 프런트엔드

- `js/firebase-config.js`: Firebase 초기화, 인증, 공통 접근 제어
- `js/api.js`: 인증 API 호출과 결과 전달
- `js/app-boot-guard.js`: 화면 초기 부팅 가드
- `js/app-version.js`: 배포 버전 보조 처리
- `js/sw-register.js`: 과거 서비스워커/캐시 호환 정리와 런타임 연결
- `sw.js`: 과거 클라이언트 호환·복구용 서비스워커 파일
- `version.json`: 사이트 배포 버전 기준

## 7. Hosting 배포 구조

Firebase Hosting의 `public`은 저장소 루트가 아니라 `.firebase-hosting`입니다.

`scripts/prepare_hosting_dist.py`가 다음 원칙으로 배포 디렉터리를 생성합니다.

- 필수 root HTML/정적 파일만 복사
- `apps`, `css`, `js`, `print-checker`, `ai-design-maker`, `smart-print-layout`, `pdf-editor`, `pdf-preflight`, `perfect-binding-cover`, `tools`, `legal` 등 허용된 정적 디렉터리만 복사
- `backend`, `docs`, `tests`, `.github`, Markdown, Python 소스는 Hosting에서 제외
- 배포 단계에서 필요한 PDF 보조 런타임을 명시적으로 주입
- 금지 파일이 `.firebase-hosting`으로 누출되면 실패

독립 개발용 HTML을 저장소에 두더라도 allowlist에 없으면 운영 Hosting에는 배포되지 않습니다. 다만 유지 가치가 없는 미배포 런타임 파일은 저장소 자체에서도 제거합니다.

## 8. 품질 게이트

`.github/workflows/quality-gate.yml`은 다음을 검사합니다.

- Python 3.11 compile + pytest
- Node.js 24 JavaScript 문법 검사
- inline JavaScript 검사
- JSON 유효성
- 배포 버전 동기화
- 정적 자산 경로
- runtime asset manifest
- route bootstrap budget
- 브라우저 smoke
- modular app 경계
- Firebase Rules emulator
- Hosting allowlist·보안 헤더·캐시 정책

주요 검증 스크립트:

- `scripts/validate_release_hygiene.py`
- `scripts/validate_hosting_delivery.py`
- `scripts/validate_static_references.py`
- `scripts/validate_runtime_assets.py`
- `scripts/validate_route_budgets.py`
- `scripts/validate_modular_apps.py`

## 9. 변경 규칙

1. 기능 모듈은 하나의 canonical runtime만 소유합니다.
2. 호환 URL은 기능을 복제하지 않고 canonical 화면으로 연결합니다.
3. 디자인 검토는 `print-checker`, AI 표지 제작은 `ai-design-maker`가 소유하며 제거된 편집기 런타임을 다시 추가하지 않습니다.
4. PDF layout/booklet 독립 앱은 `pdf-editor` 엔진을 재사용합니다.
5. 독립 고급 PDF 편집기는 N-up/소책자 runtime과 분리합니다.
6. 배포 가능 여부는 Firebase Hosting allowlist를 기준으로 판단합니다.
7. 삭제 전에는 실제 라우팅, Hosting 포함 여부, 회귀검사 의존성을 확인합니다.
