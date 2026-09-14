# Repository guidance

이 저장소의 운영·검증 기준은 [README.md](README.md)를 따릅니다.

## 변경 원칙

- PDF 렌더링은 `backend/services/pdf_engine.py` 등 명시적인 엔진 코드에서 구현합니다.
- 런타임 monkeypatch, `*_patch.py`, 중복 레이아웃 엔진을 추가하지 않습니다.
- 원본 PDF 페이지는 가능한 한 벡터와 텍스트를 보존합니다.
- API 라우트는 Firebase ID 토큰과 프로그램 권한을 확인해야 합니다.
- 대용량 입력은 Firebase Storage를 사용하고 생성 결과도 응답 한도를 넘으면 Storage 전달 정책을 따릅니다.
- 사용자 UI와 오류 메시지는 한국어로 유지합니다.
- 사용자에게 보이는 변경은 저장소의 버전 동기화 규칙을 따릅니다.
- 사용자에게 보이는 기능, 기본값, 제한, 작업 순서를 변경하면 같은 변경에서 해당 프로그램 사용설명서도 갱신합니다.
- 제거된 `design-editor`, `document-editor`, `image-editor`, `simple-editor` 런타임을 다시 추가하지 않습니다.
- 인쇄물 디자인 계열은 `print-checker`, PDF layout/booklet 계열은 canonical `pdf-editor`를 사용합니다.

## 프로그램별 설명서

- `js/program-manuals/print-checker.js` — 인쇄물 사전 검토
- `js/program-manuals/smart-print-layout.js` — 스마트 인쇄배치
- `js/program-manuals/pdf-editor.js` — PDF배치
- `js/program-manuals/pdf-editor-advanced.js` — PDF편집
- `js/program-manuals/pdf-suite.js` — PDF 유틸리티
- `js/program-manuals/catalog.js` — 설명서 카탈로그

사용자 동작에 영향이 없는 내부 리팩터링, 테스트, 주석 정리는 설명서 변경 대상이 아닙니다.

## 필수 검증

```bash
cd backend && PYTHONPATH=. python -m pytest -q && cd ..
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

Firebase Rules 변경 시에는 `npm run test:rules`도 실행합니다. Pull Request에서는 `.github/workflows/quality-gate.yml`과 관련 브라우저 smoke가 최종 회귀검증을 담당합니다.

`main` 푸시는 품질 게이트 성공 후 Firebase 자동 배포로 이어질 수 있으므로, 운영 영향이 있는 변경은 PR 검증 후 병합합니다.
