# Program Studio

인쇄·PDF 실무를 브라우저에서 처리하는 웹 도구 모음입니다. 현재 홈에서는 다섯 개의 프로그램만 사용자 프로그램으로 노출합니다.

## 현재 프로그램

| 프로그램 | 경로 | 역할 |
| --- | --- | --- |
| 인쇄물 사전 검토 | `/print-checker/` | 표지·리플렛·전단지·초대장·소책자의 규격, 도련, 안전영역, 책등, 날개, 접지, 파일 내용을 검토 |
| 스마트 인쇄배치 | `/smart-print-layout/` | PDF 실제 크기와 수량을 읽어 용지 배치 및 양면 위치 계산 |
| PDF배치 | `/pdf-editor/` | 페이지 정리, N-UP, 소책자, 간지, 여백 등 출력용 PDF 배치 |
| PDF편집 | `/pdf-editor-advanced/` | 페이지 이동·크기·자르기·회전 등 정밀 편집 |
| PDF 유틸리티 | `/pdf-suite/` | 합치기·분할·변환·OCR·압축·암호·검사 등 PDF 유틸리티 |

홈의 canonical 프로그램 목록은 `js/pdf-suite-home-launcher.js`가 소유합니다. 홈 카드의 `?` 버튼은 `js/program-manuals/`의 프로그램별 설명서를 레이어로 표시합니다.

## 주요 디렉터리

```text
print-checker/            인쇄물 사전 검토 화면
smart-print-layout/       스마트 인쇄배치 화면
pdf-editor/               PDF배치 화면
pdf-editor-advanced/      PDF편집 화면
pdf-suite/                PDF 유틸리티 화면
js/print-checker/         인쇄 검토 런타임
js/smart-print-layout/    스마트 인쇄배치 런타임
js/pdf-editor/            PDF배치 런타임
js/pdf-editor-advanced/   PDF편집 런타임
js/pdf-suite/             PDF 유틸리티 런타임
backend/                  Firebase Functions용 Python API와 PDF 처리 엔진
scripts/                  배포·검증·브라우저 smoke 도구
tests/                    브라우저 및 Firebase Rules 테스트
```

상세한 runtime 소유권과 호환 경로는 `PROGRAM_STRUCTURE.md`를 참고합니다.

## 로컬 검증

Python 테스트:

```bash
python -m pytest backend/tests
```

JavaScript 및 정적 자산 검증은 CI와 동일한 `scripts/` 검증기를 사용합니다. 주요 브라우저 smoke는 Headless Chrome/Chromium이 필요합니다.

```bash
python scripts/validate_static_references.py
python scripts/validate_runtime_assets.py
python scripts/validate_release_hygiene.py
bash scripts/run_phase5_browser_smoke.sh
bash scripts/run_modular_app_shell_smoke.sh
```

Firebase Rules 테스트는 `package.json`에 정의된 npm 스크립트를 사용합니다.

## 호환 경로 정책

현재 홈에 보이지 않는 작은 HTML 파일 중 일부는 예전 URL을 깨뜨리지 않기 위한 호환 진입점입니다. 파일 크기만 보고 삭제하지 않습니다. 대표적으로 다음을 유지합니다.

- `perfect-binding-cover/index.html`
- `tools/pdf-editor.html`
- `tools/perfect-binding-cover.html`
- `pdf-preflight/index.html`
- `/apps/**` → `apps/index.html`

예전 디자인 앱 URL(`/apps/cover`, `/apps/poster`, `/apps/flyer`, `/apps/invitation`, `/apps/notice`, `/apps/leaflet`)은 별도 디자인 편집기를 실행하지 않고 인쇄물 사전 검토의 해당 제품으로 이동합니다. 제거된 `design-editor` 런타임을 다시 의존하지 않습니다.

## 배포

`main`에 병합되면 `.github/workflows/firebase-deploy.yml`이 품질 검사를 다시 수행한 뒤 Firebase Hosting, Functions, Firestore Rules, Storage Rules를 배포합니다.

배포 전·후 검증에는 다음이 포함됩니다.

- Python compile 및 회귀 테스트
- JavaScript / inline JavaScript / JSON 검사
- 정적 자산 및 runtime manifest 검사
- 인쇄물 검토와 PDF 프로그램 Headless Chrome smoke
- 독립 앱 경계 검사
- Firebase Firestore/Storage Rules 검사
- 공개 first-paint/runtime asset 검사
- 운영 사용자 경로 smoke

## 정리 원칙

- 사용자에게 노출되는 현재 5개 프로그램의 동작을 우선 보존합니다.
- 제거된 기능의 죽은 runtime 참조는 남기지 않습니다.
- 호환 진입점은 배포 계약과 회귀 테스트를 확인한 뒤에만 제거합니다.
- 같은 기능을 여러 loader가 동시에 소유하지 않도록 canonical runtime을 유지합니다.
- 임시 파일, 빌드 산출물, 로컬 캐시와 진단 결과는 저장소에 커밋하지 않습니다.
