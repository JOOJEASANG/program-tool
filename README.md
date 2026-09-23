# Program Studio

Firebase Hosting과 Python Cloud Functions로 운영하는 PDF·인쇄 실무 도구입니다.

- 운영 주소: <https://program-tool.web.app>
- Firebase 프로젝트: `program-tool`
- 프런트엔드: HTML, CSS, JavaScript
- 백엔드: Flask, Firebase Functions, PyMuPDF
- 데이터: Firebase Authentication, Firestore, Cloud Storage

## 현재 운영 프로그램

| 프로그램 | 운영 경로 | 주요 기능 |
| --- | --- | --- |
| 디자인 검토 | `/print-checker` | 표지·전단·리플렛·초대장·안내장 등 완성 인쇄물의 규격, 재단선, 도련, 안전영역, 책등, 접지선 검토 |
| AI 디자인 제작 | `/ai-design-maker` | 실제 인쇄 규격 기반 AI 표지 배경 생성, 문구·도형 편집, CMYK 기준 색상 선택, 300dpi PNG/PDF 출력 |
| 스마트 인쇄배치 | `/smart-print-layout` | PDF·이미지 실제 크기를 읽어 용지를 자동 배치하고 양면 위치를 맞춘 출력용 PDF 생성 |
| PDF 올인원 | `/pdf-suite` | PDF 페이지 구성·변환·편집·보안·인쇄·OCR 확장·최적화·검사 기능 허브 |
| PDF 문서 편집기 | `/pdf-editor` | 페이지 편집, N-up 배치, 소책자 배열, 출력 설정을 담당하는 canonical PDF 편집 엔진 |
| PDF 고급 편집 | `/pdf-editor-advanced` | 확대/축소·이동·삭제·잘라내기·여백·머리말/꼬리말·페이지 번호 등 독립 고급 편집 |
| PDF 검사 | `/pdf-preflight` | PDF 인쇄 전 검사와 암호 설정·해제 등 보안·유틸리티 |
| 표지 검토 호환 진입점 | `/perfect-binding-cover` | 기존 무선제본 표지 주소를 현재 디자인 검토 흐름으로 연결 |
| PDF 편집 호환 진입점 | `/tools/pdf-editor.html` | 기존 PDF 편집 URL을 canonical PDF 편집기로 연결 |
| 표지 검토 호환 진입점 | `/tools/perfect-binding-cover.html` | 기존 표지 검토 URL을 현재 디자인 검토 흐름으로 연결 |

### 디자인 검토

`/print-checker`는 완성된 인쇄물 파일을 제작 규격과 대조하는 검토 도구입니다.

- 재단선·도련·안전영역 확인
- 표지 책등 검토
- 리플렛 접지선 확인
- 초대장/안내장 1p 앞면 · 2p 뒷면 확인과 가변 접지 위치 검토
- PDF/이미지 원본의 실제 규격과 설정값 비교
- `/apps/cover`, `/apps/poster`, `/apps/flyer`, `/apps/invitation`, `/apps/notice`, `/apps/leaflet` 호환 주소 지원

### AI 디자인 제작

`/ai-design-maker`는 승인 회원용 인쇄 표지 제작 도구입니다.

- 앞표지 단독, 뒷표지 단독, 앞·뒤표지 동시, 뒤표지 + 책등 + 앞표지 전체 펼침 배경을 `gpt-image-2`로 생성
- 정확한 한글 문구를 브라우저 편집 레이어로 합성
- 작업 모드별 앞·뒤 안전영역 스냅, 전체 펼침 책등 자유배치, 0.2mm 단위 정밀 이동
- 선·박스·둥근박스·원 및 별·반짝임·다이아몬드·작은원 포인트 아이콘
- 선을 제외한 새 도형은 기본 테두리 없음, 필요 시 테두리 활성화 가능
- 박스·둥근박스 모서리 둥글기(mm) 조절, 도형 투명도·채움/선 색상 편집
- 대표색 팔레트와 색상바 선택값을 내부 CMYK 값으로 변환해 편집 상태에 저장
- Shift+클릭 문구·도형 다중선택, 선택 묶음 왼쪽·가운데·오른쪽 정렬, 그룹 드래그
- Ctrl+G 묶기 / Ctrl+Shift+G 묶음풀기, 그룹 단위 이동·정렬·삭제
- 다중선택·그룹은 개별 점선을 숨기고 전체 외곽선 하나만 표시해 재단선·안전영역과 시각적 충돌 최소화
- 선택한 문구·선·도형·포인트 아이콘을 Del/Backspace로 단일 또는 일괄 삭제
- 디자인 보관함 저장과 300dpi PNG/PDF 완성 파일 출력
- 드래그 중에는 화면 렌더만 갱신하고 종료 시 저장하여 편집 반응성을 유지

### 스마트 인쇄배치

`/smart-print-layout`은 PDF와 이미지의 실제 크기를 기준으로 출력 용지를 자동 구성합니다.

- 출력 방향과 파일 크기에 따른 자동 배치
- 앞면·뒷면 양면 위치 보정
- 출력용 PDF 생성

### PDF 도구

- `/pdf-suite`: PDF 올인원 허브
- `/pdf-editor`: canonical PDF 문서 편집 엔진
- `/pdf-editor-advanced`: 독립 고급 PDF 편집기
- `/pdf-preflight`: PDF 검사·보안·유틸리티
- `/apps/pdf-layout`, `/apps/booklet`: `/apps/**` 호환 셸을 통한 PDF 작업 진입
- `/perfect-binding-cover`, `/tools/*.html`: 기존 공개 URL 호환 진입점

PDF 검수 결과는 인쇄소의 RIP/프리플라이트 결과를 대체하지 않습니다.

과거 `design-editor`, `document-editor`, `image-editor`, `simple-editor` 런타임은 운영 트리에서 제거된 상태를 유지합니다. 기능은 현재 canonical runtime에서 관리하고 호환 URL은 얇은 진입점으로 유지합니다.

## 저장소 구조

- `apps/`: PDF 배치/소책자용 공통 앱 셸과 디자인 검토 호환 리다이렉트
- `print-checker/`, `js/print-checker/`, `css/print-checker.css`: 디자인 검토
- `ai-design-maker/`, `js/ai-design-maker.js`, `css/ai-design-maker.css`: AI 디자인 제작
- `pdf-editor/`, `js/pdf-editor/`: canonical PDF 편집 엔진
- `pdf-editor-advanced/`, `js/pdf-editor-advanced/`: 독립 고급 PDF 편집기
- `pdf-preflight/`, `js/pdf-preflight/`: PDF 검사·유틸리티
- `pdf-suite/`, `js/pdf-suite/`: PDF 통합 도구 보조 런타임
- `smart-print-layout/`, `js/smart-print-layout/`: 인쇄 배치 도구
- `backend/`: Firebase Functions / Flask API
- `scripts/`: 배포 준비·정적 검사·브라우저 smoke 실행기
- `tests/`, `backend/tests/`: 프런트·백엔드·Firebase 규칙 회귀검사
- `docs/`: 운영·보안·구조 문서

실제 Firebase Hosting 배포물은 저장소 전체가 아니라 `scripts/prepare_hosting_dist.py`가 생성하는 `.firebase-hosting/` allowlist 디렉터리입니다.

## 로컬 개발

CI 기준 런타임은 Python 3.11, Node.js 24입니다.

```bash
python3.11 -m venv .venv
. .venv/bin/activate
python -m pip install -r backend/requirements-dev.txt
npm ci
```

백엔드와 저장소 정적 검사를 실행합니다.

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
python scripts/validate_runtime_assets.py
python scripts/validate_route_budgets.py
python scripts/validate_modular_apps.py
python scripts/validate_release_hygiene.py
```

Firebase Rules 검사는 CI와 동일하게 Firebase CLI 15.28.1을 사용할 수 있습니다.

```bash
npx firebase-tools@15.28.1 emulators:exec \
  --only firestore,storage \
  --project demo-program-tool \
  "npm run test:rules"
```

## 배포

`main` 브랜치 배포 전 품질 게이트에서 다음을 확인합니다.

- Python compile + pytest
- JavaScript 및 inline JavaScript 문법
- JSON 형식
- 정적 자산 경로와 runtime asset manifest
- route bootstrap budget
- 브라우저 smoke
- 독립 앱 경계
- Firebase Firestore/Storage Rules
- Hosting allowlist, 보안 헤더, 캐시 정책

수동 검증·배포:

```bash
python scripts/inject_boot_guard.py
python scripts/validate_hosting_delivery.py
firebase deploy --project program-tool --force --non-interactive
```

Hosting 배포 직전 `scripts/prepare_hosting_dist.py`가 `.firebase-hosting/`을 새로 만들기 때문에 저장소에 남아 있는 개발 문서·테스트·백엔드 소스는 정적 Hosting으로 공개되지 않습니다.

화면 동작이 바뀌는 릴리스에서는 `version.json`, `sw.js`, `js/sw-register.js`, `js/firebase-config.js`의 버전 계약을 함께 확인해야 하며 `scripts/check_version_sync.py`가 불일치를 차단합니다.

## AI 표지 제작 서버 설정

AI 표지 제작은 서버의 OpenAI 키를 사용하며 브라우저에 키를 노출하지 않습니다. 기본 이미지 모델은 `gpt-image-2`, 기본 품질은 `high`이며 품질은 `low`, `medium`, `high`, `auto` 중에서 설정할 수 있습니다.

비용이 발생하는 AI endpoint는 Firestore transaction 기반 사용자별 보호를 적용합니다. 이미지 생성은 10분에 5회, 레이아웃 생성은 10분에 15회까지 시작할 수 있으며 유형별 동시 실행은 1개로 제한합니다. 이는 승인 회원의 일일 사용량을 제한하는 상품 quota가 아니라 자동화된 과다 호출과 중복 실행을 차단하는 운영 안전장치입니다.

```env
OPENAI_API_KEY=
OPENAI_ADMIN_KEY=
OPENAI_PROJECT_ID=
OPENAI_AI_IMAGE_MODEL=gpt-image-2
OPENAI_AI_IMAGE_QUALITY=high
```

관리자 화면의 **AI 비용** 메뉴는 OpenAI의 `/organization/costs`와 `/organization/usage/images` 관리자 API를 서버에서 조회합니다. 실제 청구 집계는 USD로 표시하며, 브라우저에는 OpenAI 키를 노출하지 않습니다.

- `OPENAI_ADMIN_KEY`: 실제 비용·조직 사용량 조회에 필요한 OpenAI Admin API 키입니다. 일반 프로젝트 API 키와 별도이며 서버 환경에만 설정합니다.
- 운영 환경은 Firebase Secret Manager의 `OPENAI_ADMIN_KEY`를 함수에 바인딩합니다. Secret을 등록한 뒤 다음 운영 배포부터 관리자 실제 비용 조회가 활성화됩니다.
- `OPENAI_PROJECT_ID`: Program Studio가 사용하는 OpenAI 프로젝트 ID입니다. 설정하면 비용과 이미지 사용량을 해당 프로젝트로 제한합니다.
- `OPENAI_PROJECT_ID`를 설정하지 않으면 화면에 **OpenAI 조직 전체 비용**이라고 명확히 표시합니다.
- OpenAI 비용 집계에는 짧은 반영 지연이 있을 수 있습니다.
- Program Studio는 성공한 AI 표지 배경 생성 횟수를 Firestore의 서버 전용 일별 집계로 별도 기록합니다. 내부 생성 횟수는 이 기능이 배포되는 2026-09-22 이후 성공 생성부터 누적되며, 운영 분석용으로 OpenAI의 실제 청구 금액을 대체하지 않습니다.

## 운영 보안

- API는 Firebase ID 토큰과 프로그램 접근 상태를 확인합니다.
- 관리자 권한의 목표 source of truth는 Firebase custom claim `admin: true`입니다.
- Firestore와 Storage는 허용한 경로 외 default deny 원칙을 사용합니다.
- Hosting은 allowlist staging과 보안 헤더 검사를 통과한 파일만 배포합니다.
- GitHub Actions 배포 인증은 WIF/ADC를 우선하며, 구성 상태에 따라 기존 `FIREBASE_TOKEN` fallback을 사용할 수 있습니다.

관리자 claim 전환 절차는 `docs/admin-security-migration.md`를 참고합니다.

## 정리 원칙

1. 실제 운영 경로에서 사용하지 않는 독립 화면·실험 파일은 운영 트리에 남기지 않습니다.
2. 기능은 canonical runtime 한 곳에서 소유하고 호환 URL은 얇은 진입점으로 유지합니다.
3. `/apps/pdf-layout`과 `/apps/booklet`은 PDF 엔진을 복제하지 않습니다.
4. 제거된 독립 디자인 편집기 계열은 되살리지 않고, 디자인 검토는 `/print-checker`, AI 표지 제작은 `/ai-design-maker`가 각각 한 곳에서 소유합니다.
5. 배포 대상 여부는 파일 위치가 아니라 Hosting allowlist를 기준으로 판단합니다.
