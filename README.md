# Program Studio

Firebase Hosting과 Python Cloud Functions로 운영하는 PDF·인쇄 실무 도구입니다.

- 운영 주소: <https://program-tool.web.app>
- Firebase 프로젝트: `program-tool`
- 프런트엔드: HTML, CSS, JavaScript
- 백엔드: Flask, Firebase Functions, PyMuPDF
- 데이터: Firebase Authentication, Firestore, Cloud Storage

## 현재 운영 기능

### 디자인 검토/제작

`/print-checker`는 표지·전단·리플렛·초대장/안내장 등 인쇄물의 규격과 안전영역을 검토하고, 같은 화면에서 AI 표지 제작으로 전환할 수 있는 도구입니다.

- 재단선·도련·안전영역 확인
- 표지 책등 검토
- 리플렛 접지선 확인
- 초대장/안내장 1p 앞면 · 2p 뒷면 확인과 가변 접지 위치 검토
- 완성 규격 기본 A4 210×297mm 및 입력 치수 기억
- AI 제작은 표지 전용이며 뒤표지 + 책등 + 앞표지 전체 펼침 배경을 `gpt-image-2`로 생성
- 정확한 한글 제목·날짜·회사명·책등 글자는 편집 가능한 브라우저 레이어로 처리
- 책등 세로글씨 및 90도 양방향 회전 지원

과거 `design-editor`, `document-editor`, `image-editor`, `simple-editor` 런타임은 운영 트리에서 제거된 상태를 유지합니다. `/apps/cover`, `/apps/poster`, `/apps/flyer`, `/apps/invitation`, `/apps/notice`, `/apps/leaflet`은 디자인 검토/제작 화면으로 연결됩니다.

### PDF 도구

- `/pdf-editor`: PDF 페이지 편집, N-up 배치, 소책자 배열, 출력 설정
- `/apps/pdf-layout`: PDF 배치 전용 셸 → canonical `/pdf-editor` 엔진 사용
- `/apps/booklet`: 소책자 제작 전용 셸 → canonical `/pdf-editor` 엔진 사용
- `/pdf-editor-advanced`: 확대/축소·이동·여백·머리말/꼬리말·페이지 번호 등 독립 고급 편집
- `/pdf-preflight`: PDF 검사·보안·유틸리티
- `/smart-print-layout`: 인쇄 배치 보조 도구
- `/perfect-binding-cover`, `/tools/*.html`: 기존 공개 URL 호환 진입점

PDF 검수 결과는 인쇄소의 RIP/프리플라이트 결과를 대체하지 않습니다.

## 저장소 구조

- `apps/`: PDF 배치/소책자용 공통 앱 셸과 디자인 검토/제작 리다이렉트
- `print-checker/`, `js/print-checker/`, `css/print-checker.css`: 디자인 검토/제작
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

AI 표지 제작은 서버의 OpenAI 키를 사용하며 브라우저에 키를 노출하지 않습니다.

```env
OPENAI_API_KEY=
OPENAI_AI_IMAGE_MODEL=gpt-image-2
OPENAI_AI_IMAGE_QUALITY=high
```

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
4. 제거된 독립 디자인 편집기 계열은 되살리지 않고, 디자인 검토와 AI 표지 제작은 `/print-checker`의 통합 런타임에서 제공합니다.
5. 배포 대상 여부는 파일 위치가 아니라 Hosting allowlist를 기준으로 판단합니다.
