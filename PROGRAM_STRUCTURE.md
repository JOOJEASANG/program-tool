# Program Studio 구조

## 운영 화면

- `apps/index.html`: 독립 작업 앱 공통 셸. `/apps/cover`, `/apps/poster`, `/apps/flyer`, `/apps/invitation`, `/apps/notice`, `/apps/leaflet`, `/apps/pdf-layout`, `/apps/booklet` 경로를 하나의 얇은 셸에서 라우팅합니다.
- `pdf-editor/index.html`: 기존 PDF 통합 편집기 및 독립 PDF 앱의 공통 편집 엔진
- `pdf-preflight/index.html`: PDF 검사·유틸리티
- `perfect-binding-cover/index.html`: 책표지 제작 레거시 호환 진입점
- `design-editor/index.html`: 기존 통합 디자인 편집기 셸 및 호환 진입점
- `design-editor/general.html`: 디자인 독립 앱이 공유하는 공통 편집 엔진
- `document-editor/`, `image-editor/`: 문서·이미지 편집기
- `tools/*.html`: 기존 주소 호환용 진입 페이지

## 독립 작업 앱 구조

사용자에게는 작업 목적별 프로그램을 분리해서 보여주되, 글씨·도형·정렬·저장·출력 같은 공통 기능은 하나의 편집 엔진에서 공유합니다. 저장소는 하나의 monorepo로 유지합니다.

### 디자인 앱

- `/apps/cover`: 표지 제작
- `/apps/poster`: 포스터 제작
- `/apps/flyer`: 전단지 제작
- `/apps/invitation`: 초대장 제작
- `/apps/notice`: 안내장 제작
- `/apps/leaflet`: 리플렛 제작

`js/studio-app-shell.js`는 앱 URL을 실제 편집 엔진으로 연결합니다. 디자인 앱은 `design-editor/general.html`을 공유하되 `app=` 경계를 전달합니다.

`js/design-editor/core-runtime.js`는 독립 앱의 `app` 값을 읽어 제품 전용 모듈을 조건부로 로드합니다. 예를 들어 표지 모델·표지 설정·책등·표지 미리보기 모듈은 `cover` 앱에서만 로드합니다. 기존 `/design-editor` 통합 화면에서는 호환성을 위해 전체 모듈을 계속 사용할 수 있습니다.

`js/design-editor/product-boundary-ui.js`는 독립 디자인 앱 내부에서 다른 제작 종류로 전환하는 메뉴를 숨기고 현재 앱의 작업 목적을 고정합니다. `js/design-editor/shell-runtime.js`도 접지 기능 등 보조 모듈을 현재 앱에 필요한 경우에만 로드합니다.

### PDF 앱

- `/apps/pdf-layout`: PDF N-up·인쇄 배치
- `/apps/booklet`: 소책자 제작

두 앱은 `pdf-editor/index.html`의 PDF 업로드·페이지 상태·렌더링·저장 엔진을 공유합니다. `js/pdf-editor/app-boundary.js`가 앱별 UI와 기본 동작을 분리합니다. PDF 배치에서는 소책자 옵션을 숨기고, 소책자 앱에서는 소책자 배치를 기본 작업으로 활성화합니다.

### 앱 셸 UX

- `apps/index.html`: 공통 헤더와 전체 작업영역 iframe만 소유합니다.
- `css/studio-app-shell.css`: 독립 앱 공통 시각 체계와 반응형 레이아웃
- `js/studio-app-shell.js`: 앱 이름·설명·엔진 URL·오류 재시도 상태 관리
- 앱 셸은 자체 편집 기능을 소유하지 않습니다. 실제 편집 기능은 디자인/PDF canonical runtime이 소유합니다.
- `/apps/**`는 Firebase rewrite로 `apps/index.html`에 연결하고 기존 승인 사용자 접근 제어를 그대로 적용합니다.

## 공통 프런트엔드와 런타임 소유권

- `js/firebase-config.js`: Firebase 초기화, 인증, 공통 접근 제어 진입
- `js/api.js`: 인증 API 호출, Storage 업로드, 임시 결과 다운로드/삭제
- `js/sw-register.js`: 이름은 과거 호환을 위해 유지하지만 현재 서비스 워커를 등록하지 않습니다. 화면 경로에 따라 canonical runtime loader를 선택하고 과거 Program Studio 캐시/서비스 워커를 정리합니다.
- `js/app-version.js`: 배포 버전 감지와 **자기 소유 보조 기능만** 로드합니다. PDF·디자인·홈·관리자 canonical 모듈을 중복 로드하지 않습니다.
- `sw.js`: 과거 클라이언트가 요청할 수 있어 남겨 둔 호환/복구 파일입니다. 활성화되면 Program Studio 캐시를 제거하고 자신을 unregister합니다. 네트워크 캐시 기능을 소유하지 않습니다.
- `version.json`: 전체 사이트 배포 버전의 기준 파일입니다.

### Canonical runtime manifest

- 디자인 편집기 기능 순서와 소유권: `js/design-editor/core-runtime.js`의 `MODULES`
- 디자인 앱별 보조 기능: `js/design-editor/shell-runtime.js`
- PDF 편집기 route 보조 기능 소유권: `js/pdf-editor/route-runtime.js`의 `MODULES`
- PDF 독립 앱 UI 경계: `js/pdf-editor/app-boundary.js`
- PDF 핵심/화면 모듈: `js/pdf-editor/core-runtime.js`, `js/pdf-editor/ui-runtime.js`
- 최상위 `sw-register.js`는 nested manifest 내부 기능을 다시 소유하지 않습니다.

`scripts/validate_runtime_assets.py`는 실제 실행 코드만 검사하고 block comment의 레거시 metadata는 제외합니다. 특히 `app-version.js`가 canonical runtime과 같은 DOM script id를 다시 소유하면 품질 검사를 실패시킵니다.

`scripts/smoke_deployment.py`는 주석에 남아 있는 옛 manifest가 아니라 `design-editor/core-runtime.js`와 `pdf-editor/route-runtime.js`의 실제 `MODULES`를 읽어 배포된 JavaScript 자산을 검증합니다.

## 디자인 편집기

- `js/design-editor/app.js`: 기본 프로젝트 상태, 요소 선택·드래그, 자동 저장
- `js/design-editor/asset-store.js`: 편집 이미지 Blob을 IndexedDB에 저장
- `js/design-editor/phase11-project-file.js`: 휴대용 `.design.json` 직렬화/복원
- `js/design-editor/phase13-print-quality.js`: 이미지 유효 DPI 검사
- `js/design-editor/phase14-print-safety.js`: 안전여백·작은 글씨·접지선 검사
- `js/design-editor/phase22-final-print-check.js`: 출력 직전 전체 작업면 최종 검사
- `js/design-editor/phase24-cloud-projects.js`: 사용자별 클라우드 디자인 저장
- `js/design-editor/output.js`: 300 DPI PNG/PDF 출력 및 결과 규격 재검증

### 디자인 클라우드 저장

- Firestore: `users/{uid}/design_projects/{projectId}`
- Storage: `design_projects/{uid}/{projectId}/{revision}.design.json`
- 새 revision 업로드 → Firestore metadata 전환 → 이전 revision 삭제 순서로 저장합니다.
- Firestore Rules는 `storagePath`가 현재 UID와 현재 `projectId`를 정확히 가리키는지 검증합니다.
- Storage revision은 immutable입니다. 같은 revision 파일을 덮어쓰지 않고 새 revision을 생성합니다.
- 정상 UI는 최대 8개 프로젝트를 유지하며, 일일 서버 정리 작업도 사용자별 최신 8개 상한을 재확인합니다.
- Firestore에서 참조되지 않는 Storage revision은 24시간 유예 후 정리됩니다.

## PDF 편집기

- `js/pdf-editor/route-runtime.js`: route 보조 모듈의 단일 manifest
- `js/pdf-editor/app-boundary.js`: PDF 배치/소책자 독립 앱의 UI·기본 모드 경계
- `js/pdf-editor/transfer-limit-guard.js`: 업로드 전 브라우저 비용/메모리 상한 검사
- `js/pdf-editor/session-save-safety.js`: 다중 원본을 포함한 저장 세션의 snapshot 저장과 실패 정리
- `backend/services/pdf_engine.py`: PDF 레이아웃 렌더링의 단일 서버 구현
- `backend/services/pdf_text_renderer.py`: 워터마크·머리말·꼬리말·페이지 번호
- `backend/services/pdf_print_marks.py`: 재단선·도련 표시

### PDF 비용·용량 상한

공통 상한은 다음과 같이 맞춥니다.

- Storage 원본 PDF 한 파일: **200 MiB**
- PDF 편집 작업 원본 합계: **300 MiB**
- 저장 세션 원본 한 파일: **200 MiB**
- 저장 세션 전체: **300 MiB**, 최대 50개 원본
- 정상 UI 저장 세션: 최대 10개
- 생성 결과 Storage 전달: 최대 **300 MiB**
- Functions API: `min_instances=0`, `max_instances=2`

`pdf_temp/`, `preflight_temp/`, `pdf_results/`는 임시 데이터입니다. 서버 정리 함수가 1시간이 지난 객체를 매시간 삭제하고, Cloud Storage lifecycle의 1일 삭제 규칙이 추가 안전망으로 남습니다.

`pdf_sessions/`는 사용자 저장 데이터이므로 단순 lifecycle로 일괄 삭제하지 않습니다. 대신 일일 quota reconciliation이 최신 10개 세션을 유지하고, Firestore에서 참조되지 않는 파일만 24시간 유예 후 삭제합니다.

## 생성 PDF 전달

20 MiB 이하 결과는 HTTP 응답으로 바로 전달할 수 있고 큰 결과는 `pdf_results/{uid}/...`에 임시 저장됩니다. 클라이언트는 다운로드 성공 후 해당 객체 삭제를 시도합니다.

Firebase download-token URL은 signed URL처럼 암호학적 만료 시간이 있는 URL이 아닙니다. API의 `expires_at`은 **서버 정리 목표 시각**이며 `expiration_mode=scheduled-delete`로 이를 명시합니다. 키 파일을 저장소나 Functions에 두지 않는 현재 keyless 운영 원칙을 유지하면서 노출 시간을 줄이기 위해 결과 retention을 1시간으로 제한합니다.

## Firebase 권한과 비용 방어

- Firestore/Storage는 명시적으로 허용한 경로 외에는 default deny입니다.
- PDF staging은 승인 사용자·본인 UID 경로·PDF MIME·경로 형식·200 MiB 상한을 모두 만족해야 합니다.
- staging object는 덮어쓰기를 금지해 의도치 않은 반복 전송 비용을 줄입니다.
- PDF 저장 세션 Storage는 `ownerUid`, `purpose=pdf-session-source`, `sessionId` custom metadata가 일치해야 합니다.
- 디자인 Storage revision은 UID/프로젝트 경로, JSON MIME, 30 MiB, owner metadata를 검증하며 overwrite를 허용하지 않습니다.
- 일일 서버 정리 작업은 Firestore 기준 PDF 세션 10개·디자인 프로젝트 8개를 초과한 오래된 항목과 24시간 이상 된 고아 Storage 객체를 정리합니다.

Firebase Security Rules만으로 한 사용자 prefix의 전체 객체 수를 실시간 집계할 수는 없습니다. 따라서 Rules의 객체별 상한 + UI 상한 + Firestore schema + 서버 reconciliation + lifecycle을 겹쳐 적용합니다.

## 관리자·배포 보안

- 관리자 권한의 목표 source of truth는 Firebase Auth custom claim `admin=true`입니다.
- `settings/admin.emails` fallback은 기존 관리자 claim 전환이 운영에서 검증되기 전까지만 유지합니다.
- `.github/workflows/firebase-deploy.yml`은 WIF/ADC를 우선하도록 구성되어 있습니다.
- `scripts/firebase_ci.sh`는 ADC가 있으면 legacy `FIREBASE_TOKEN`을 제거하고 WIF 자격증명을 사용합니다.
- GitHub의 WIF secrets가 실제로 설정되기 전에는 legacy token fallback이 남아 있으므로, 운영 WIF 성공 확인 후 token secret을 제거해야 합니다.

## 품질 게이트

PR과 배포 전에는 다음을 검사합니다.

- Python compile + pytest 회귀 테스트
- JavaScript 문법·inline JavaScript 검사
- JSON/정적 자산/route bootstrap 검증
- canonical runtime 자산 및 중복 소유권 검사
- Firebase Firestore/Storage Rules emulator 테스트
- 별도 Firebase hardening Rules 테스트
- 디자인·이미지·문서·PDF Headless Chrome smoke
- Firebase 운영 배포 후 사용자 HTTP 경로, 보안 헤더, canonical 디자인/PDF runtime 자산, 버전, Functions health 검사

## 변경 규칙

1. 기능 모듈은 한 runtime owner만 가져야 합니다. 같은 DOM script id를 여러 loader에서 로드하지 않습니다.
2. 디자인 기능 순서는 `js/design-editor/core-runtime.js`에서 관리합니다. 제품 전용 모듈은 `products` 경계로 조건부 로드할 수 있습니다.
3. 독립 앱은 편집 기능을 복제하지 않고 `apps/index.html` + canonical editor runtime 조합을 사용합니다.
4. PDF route 기능 순서는 `js/pdf-editor/route-runtime.js`에서 관리합니다.
5. `js/app-version.js`에 canonical PDF/디자인/home/admin loader를 다시 추가하지 않습니다.
6. PDF 서버 처리 용량을 올릴 때는 Storage Rules, 브라우저 transfer guard, 세션 guard, backend 상한을 함께 검토합니다.
7. persistent Storage 경로를 추가할 때는 사용자별 quota와 orphan cleanup 전략을 함께 추가합니다.
8. 임시 Storage 결과의 보관 시간을 늘리지 않습니다. 장시간 보관이 필요한 데이터는 별도 영구 저장 모델을 사용합니다.
9. 관리자 legacy email fallback과 Firebase token fallback은 각각 custom claim/WIF 운영 검증 완료 후 제거합니다.
10. 운영 runtime 구조가 바뀌면 이 문서와 canonical smoke 검사를 같은 변경에서 갱신합니다.