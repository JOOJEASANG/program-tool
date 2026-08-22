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
- `js/sw-register.js`: 서비스 워커 복구와 화면별 보조 모듈 로딩. 일반 디자인 편집기의 기능 모듈은 `DESIGN_EDITOR_RUNTIME_SCRIPTS` 목록에 의존 순서대로 등록하고 `loadSeries()`가 순차 로드. 각 모듈의 load/error/timeout 결과를 진단 이벤트로 내보내며 실패 모듈을 `loaded`로 오인하지 않음
- `js/app-version.js`: 배포 버전 감지
- `sw.js`: 네트워크 우선 캐시
- `version.json`: 전체 사이트의 단일 배포 버전

서비스 워커 복구는 버전마다 한 번만 수행해 반복 새로고침을 방지합니다. HTML과 버전 파일은 캐시하지 않고 JavaScript/CSS는 항상 재검증합니다.

## 통합 디자인 편집기

- `js/design-editor/app.js`: 기본 프로젝트 상태, 텍스트 요소, 선택·드래그, 자동 저장
- `js/design-editor/runtime-diagnostics.js`: 일반 편집기의 스크립트·리소스 오류, 처리되지 않은 Promise 오류, 런타임 모듈 load/error/timeout을 로컬 `sessionStorage`에 최대 40건 보관. 진단 화면과 복사용 기술 보고서를 제공하되 서버 전송은 하지 않고 이메일·data URL·blob URL을 마스킹하며 프로젝트 글 내용·이름·이미지 데이터는 보고서에서 제외
- `js/design-editor/asset-store.js`: 편집 이미지 Blob을 IndexedDB에 저장하고 프로젝트에는 `assetId` 참조만 남기는 로컬 자산 저장소
- `js/design-editor/phase2.js`: 이미지·도형과 세부 편집 기능. 새 이미지는 WebP Blob으로 최적화한 뒤 자산 저장소에 넣고 기존 data URL 이미지는 자동 마이그레이션
- `js/design-editor/phase5-draft-scope.js`: 규격별 자동 저장. 자산 저장소로 이동한 이미지의 런타임 `blob:` URL은 자동 저장 JSON에서 제외
- `js/design-editor/phase11-project-file.js`: `.design.json` 저장 시 IndexedDB 이미지를 다시 data URL로 포함하고, 불러올 때 다시 자산 저장소로 분리해 다른 PC 이동성을 유지. 같은 직렬화·복원 계약을 클라우드 저장에서도 재사용
- `js/design-editor/phase13-print-quality.js`: 배치 이미지의 유효 DPI를 검사해 현재 면의 인쇄 선명도 위험을 표시
- `js/design-editor/phase14-print-safety.js`: 안전여백·작은 글씨·접지선 충돌을 현재 면 기준으로 검사
- `js/design-editor/phase16-simple-interface.js`: 실제 일반 편집기 `/design-editor/general(.html)`에서 기본 도구를 우선 표시하고 정밀 도구를 고급 영역으로 묶는 문맥형 사이드바. 한 사용자 동작에서 연속 발생하는 click/input/change/pointerup 이벤트는 하나의 이중 animation frame 동기화로 합쳐 중복 DOM 재구성을 줄임
- `js/design-editor/phase17-component-blocks.js`: 제목·일정·문의·기관정보 등 자주 쓰는 인쇄 구성요소를 현재 면에 비파괴 방식으로 추가
- `js/design-editor/phase19-smart-snap.js`: 드래그 정렬·동일 간격 스냅. 고빈도 `pointermove`마다 전체 요소를 다시 계산하지 않고 animation frame당 최대 한 번 계산하며 pointerup 직전 예약된 마지막 계산은 flush해 최종 위치를 보존
- `js/design-editor/phase22-final-print-check.js`: 출력 직전 모든 작업면의 도련·안전여백·접지·이미지 누락·이미지 DPI를 통합 검사하고 치명적 오류가 있으면 출력을 중단
- `js/design-editor/phase23-design-recipes.js`: 공공 안내·행사 포스터·깔끔 전단·따뜻한 안내 스타터 레시피. 기존 내용은 삭제하지 않고 구성요소와 전체 스타일 테마만 조합하며 같은 면의 동일 레시피 중복 적용을 막음
- `js/design-editor/phase24-cloud-projects.js`: 로그인 사용자의 클라우드 작업 최대 8개를 저장·목록·불러오기·삭제. 프로젝트 본문은 30MB 이하 휴대형 `.design.json` revision으로 Storage에 저장하고 Firestore에는 이름·규격·현재 revision 경로 등 메타데이터만 저장
- `js/design-editor/output.js`: 최종 인쇄 검사를 통과한 작업의 300 DPI PNG/PDF 출력. PDF는 표준 JPEG 압축 프로필과 무손실 PNG 페이지 프로필을 선택할 수 있으며 현재 색상 공간은 RGB. 렌더 완료 후 저장 직전에 재단+도련 기준 예상 픽셀 규격을 실제 캔버스와 다시 대조하고, PDF는 실제 페이지 수도 작업면 수와 일치하는지 확인해 불일치 시 저장을 중단
- `js/design-editor/phase3-controls.js` 이후 모듈: 정렬, 스마트 배치, 프로젝트 파일, 회전, 인쇄 품질·안전, 빠른 구성, 퀵툴바, 스마트 스냅, 스타일 테마
- 기능 모듈을 추가하거나 순서를 바꿀 때는 `DESIGN_EDITOR_RUNTIME_SCRIPTS`만 수정하고 순서·중복 회귀 테스트를 함께 갱신합니다.

## 클라우드 디자인 저장

- Firestore: `users/{uid}/design_projects/{projectId}`에 소유자 전용 메타데이터만 보관합니다.
- Storage: `design_projects/{uid}/{projectId}/{revision}.design.json`에 소유자 전용 프로젝트 본문을 보관합니다.
- 저장은 새 revision 업로드 → Firestore 메타데이터 전환 → 이전 revision 삭제 순서입니다. 중간 저장 실패 시 새 revision만 정리하고 기존 revision을 유지합니다.
- Firestore/Storage Rules는 UID 소유권, 허용 필드, JSON MIME, 30MB 제한, 소유자 메타데이터를 검증합니다.

## 관리자·배포 보안

- `backend/scripts/sync_admin_claims.py`: `settings/admin` 기준으로 `admin: true` custom claim을 dry-run/적용하며 `--verify`는 모든 관리자 claim이 준비되지 않으면 실패 종료합니다.
- Firestore/Storage/client의 legacy 관리자 이메일 fallback은 실제 운영 `--verify` 성공 전까지 제거하지 않습니다.
- `.github/workflows/firebase-deploy.yml`, `.github/workflows/firebase-preview.yml`: WIF secrets가 있으면 `google-github-actions/auth`로 short-lived ADC를 생성합니다.
- `scripts/firebase_ci.sh`: `GOOGLE_APPLICATION_CREDENTIALS`가 있으면 `FIREBASE_TOKEN`을 제거하고 ADC를 우선 사용합니다. WIF가 아직 없는 운영에서는 token fallback을 유지합니다.
- `ADMIN_SECURITY_MIGRATION.md`: claim-only 관리자 권한과 WIF 배포의 실제 cutover 완료 조건을 정의합니다.

## 백엔드

- `backend/main.py`: Flask 앱, HTTPS 함수, 임시 파일 정리 예약 함수
- `backend/routers/`: PDF 편집·도구·검수 API
- `backend/services/pdf_engine.py`: PDF 레이아웃 렌더링의 단일 구현
- `backend/services/pdf_text_renderer.py`: 워터마크, 머리말·꼬리말, 페이지 번호
- `backend/services/pdf_print_marks.py`: 재단선·도련 표시
- `backend/services/preflight_svc.py`: 검수
- `backend/utils/storage_delivery.py`: 20 MiB 초과 결과의 Storage 전달

## 변경 규칙

1. 프로그램 기능은 운영 폴더에서 수정하고 `tools/` 호환 페이지에 복제하지 않습니다.
2. 공통 API 계약은 `js/api.js` 한 곳에서 구성합니다.
3. PDF 레이아웃은 중복 구현이나 런타임 monkeypatch 없이 `pdf_engine.py`에서 수정합니다.
4. 통합 디자인 편집기 기능 모듈은 `js/sw-register.js`의 `DESIGN_EDITOR_RUNTIME_SCRIPTS`에서 로딩 순서를 관리하고 개별 `.then()` 체인을 다시 만들지 않습니다.
5. 일반 디자인 편집기에 로드되는 기능 모듈의 경로 가드는 실제 `/design-editor/general` 및 `/design-editor/general.html` 경로를 허용해야 합니다.
6. 런타임 진단은 로컬 전용으로 유지하며 네트워크 전송을 추가하지 않습니다. 복사 보고서에는 프로젝트 글 내용·이름·이미지 원본 데이터나 사용자 이메일을 포함하지 않습니다.
7. 고빈도 `pointermove`나 한 동작에서 연속 발생하는 DOM 이벤트는 기능 정확성을 해치지 않는 범위에서 animation frame 단위로 병합하고, pointerup/cancel 시 대기 중인 마지막 상태를 잃지 않아야 합니다.
8. 디자인 이미지의 자동 저장은 `asset-store.js`를 거쳐 IndexedDB에 보관하고 localStorage 프로젝트 JSON에 base64 이미지 데이터를 다시 넣지 않습니다. 휴대용 `.design.json` 내보내기만 이미지 데이터를 포함합니다.
9. 스타터 디자인 레시피는 기존 글자·사진·도형을 삭제하거나 위치를 초기화하지 않습니다. 이미 존재하는 작업을 보존한 채 필요한 구성요소와 스타일만 추가합니다.
10. 클라우드 프로젝트는 고정 파일을 바로 덮어쓰지 않고 revision 단위로 저장합니다. Firestore 메타데이터 전환이 성공하기 전에는 기존 revision을 삭제하지 않습니다.
11. 관리자 legacy 이메일 fallback은 실제 운영 관리자 claim 검증이 성공하기 전에 제거하지 않습니다.
12. Firebase CI는 WIF/ADC를 우선하고, WIF 실제 운영 검증 전까지만 `FIREBASE_TOKEN` fallback을 유지합니다.
13. PNG/PDF 출력은 `phase22-final-print-check.js`의 전체 면 검사를 우회하지 않습니다. 이미지 원본 누락처럼 치명적인 오류는 출력 전에 해결해야 합니다.
14. `고품질 PDF`는 300DPI RGB 래스터 페이지를 PNG로 무손실 포함하는 프로필입니다. CMYK 또는 PDF/X 변환 기능으로 표시하거나 오인시키지 않습니다.
15. PNG/PDF는 렌더 완료 후 저장 직전에 300DPI 픽셀 규격을 다시 검증합니다. PDF는 작업면 수와 실제 페이지 수도 일치해야 하며 검증 실패 시 파일 저장을 진행하지 않습니다.
16. 화면 변경 시 `version.json`, `sw.js`, `js/sw-register.js`, `js/firebase-config.js` 버전을 동기화합니다.
17. 배포 전 Python, JavaScript, 정적 경로, Firebase 규칙 테스트를 모두 통과시킵니다.
