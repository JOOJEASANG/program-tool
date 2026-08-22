# Program Studio

Firebase Hosting과 Python Cloud Functions로 운영하는 PDF 제작·검수 도구입니다.

- 운영 주소: <https://program-tool.web.app>
- Firebase 프로젝트: `program-tool`
- 프런트엔드: HTML, CSS, JavaScript
- 백엔드: Flask, Firebase Functions, PyMuPDF
- 데이터: Firebase Authentication, Firestore, Cloud Storage

## 주요 기능

- PDF 편집기: 여러 PDF 병합, N-up 배치, 소책자 배열, 여백·페이지 번호·인쇄 표시
- PDF 검사: 문서 정보, 크기, 색상·투명도 위험 신호, 보안 설정 검사와 제한적인 자동 수정
- 책표지 제작: 판형·쪽수·종이에 따른 표지 크기 계산 및 300 DPI RGB PNG 출력

PDF 검수 결과는 인쇄소의 RIP/프리플라이트 결과를 대체하지 않습니다. 브라우저 표지 출력도 RGB 래스터 이미지이며, 실제 CMYK 납품물에는 인쇄소 ICC 프로파일을 적용한 별도 변환 단계가 필요합니다.

## 로컬 개발

Python 3.11과 Node.js 20을 기준으로 합니다.

```bash
python3.11 -m venv .venv
. .venv/bin/activate
python -m pip install -r backend/requirements-dev.txt
npm ci
```

백엔드 테스트와 정적 검사를 실행합니다.

```bash
cd backend
PYTHONPATH=. python -m pytest -q
cd ..

python -m compileall -q backend scripts
find js -type f -name '*.js' -print0 | xargs -0 -n1 node --check
node --check sw.js
python scripts/check_inline_js.py
python scripts/check_version_sync.py
python scripts/validate_static_references.py
```

Firebase 규칙은 에뮬레이터로 실제 허용·거부 동작을 검사합니다.

```bash
npx firebase-tools@14.27.0 emulators:exec \
  --only firestore,storage \
  --project demo-program-tool \
  "npm run test:rules"
```

## 처리 한도와 결과 전달

- 직접 multipart 업로드: 합계 20 MiB 이하
- PDF 편집기·검수용 Storage 입력: 파일당 최대 500 MiB
- 표지 입력 이미지: 최대 15 MiB, 5천만 픽셀
- 20 MiB를 넘는 생성 결과: `pdf_results/{uid}/{resultId}/{filename}`에 저장한 뒤 임시 다운로드 URL 반환
- 임시 입력과 결과: 예약 함수가 6시간이 지난 객체를 6시간마다 정리

Cloud Storage 버킷에도 방어적인 수명 주기 정책을 적용할 수 있습니다.

```bash
gcloud storage buckets update gs://program-tool.firebasestorage.app \
  --lifecycle-file=storage-lifecycle.json
```

## 배포

`main` 브랜치에 푸시하면 `.github/workflows/firebase-deploy.yml`이 품질 검사를 통과한 뒤 Hosting, Functions, Firestore 규칙·인덱스, Storage 규칙을 배포합니다. 저장소의 `FIREBASE_TOKEN` 비밀 값이 필요합니다.

수동 배포:

```bash
firebase deploy --project program-tool --force --non-interactive
```

화면 동작이 바뀌면 `version.json`, `sw.js`, `js/sw-register.js`, `js/firebase-config.js`의 버전을 함께 갱신해야 합니다. `scripts/check_version_sync.py`가 불일치를 차단합니다.

## 구조

- `pdf-editor/`, `pdf-preflight/`, `perfect-binding-cover/`: 운영 프로그램 화면
- `design-editor/`: 표지·포스터·전단·리플렛 통합 디자인 편집기 셸과 일반 편집 화면
- `tools/`: 이전 URL을 보존하는 호환 이동 페이지
- `js/api.js`: 인증, 직접/Storage 업로드, 결과 다운로드 공통 API
- `js/sw-register.js`: 화면별 런타임 모듈 로더. 일반 디자인 편집기는 `DESIGN_EDITOR_RUNTIME_SCRIPTS` 순서 목록으로 기능 의존성을 관리
- `backend/routers/`: Flask API 진입점
- `backend/services/pdf_engine.py`: PDF 레이아웃 렌더링의 단일 구현
- `backend/services/preflight_svc.py`: PDF 검수
- `backend/utils/storage_delivery.py`: 대용량 결과의 비공개 임시 전달
- `firestore.rules`, `storage.rules`, `tests/firebase-rules.test.mjs`: 접근 제어와 회귀 테스트

## 운영 보안

API는 Firebase ID 토큰과 프로그램 승인 상태를 모두 확인합니다. 관리자 권한은 가능하면 Firebase custom claim의 `admin: true`를 사용하고, Firestore 이메일 목록 방식은 이전 운영 환경과의 호환 용도로만 유지합니다.

Cloud 배포는 장기 토큰보다 Workload Identity Federation을 권장합니다. 현재 워크플로를 WIF로 전환하기 전까지 `FIREBASE_TOKEN`은 최소 권한과 정기 교체 정책으로 관리해야 합니다.
