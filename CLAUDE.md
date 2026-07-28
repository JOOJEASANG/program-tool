# Repository guidance

이 저장소의 운영·검증 기준은 [README.md](README.md)를 따릅니다.

## 변경 원칙

- PDF 렌더링은 `backend/services/pdf_engine.py`에서 명시적으로 구현합니다.
- 런타임 monkeypatch, `*_patch.py`, 중복 레이아웃 엔진을 추가하지 않습니다.
- 원본 PDF 페이지는 가능한 한 `show_pdf_page()`로 배치해 벡터와 텍스트를 보존합니다.
- API 라우트는 Firebase ID 토큰과 프로그램 권한을 확인해야 합니다.
- 대용량 입력은 Firebase Storage를 사용하고 생성 결과도 응답 한도를 넘으면 `pdf_results/`로 전달합니다.
- 사용자 UI와 오류 메시지는 한국어로 유지합니다.
- 사용자에게 보이는 변경은 네 곳의 버전을 함께 갱신합니다.

## 필수 검증

```bash
cd backend && PYTHONPATH=. python -m pytest -q && cd ..
python -m compileall -q backend scripts
find js -type f -name '*.js' -print0 | xargs -0 -n1 node --check
node --check sw.js
python scripts/check_inline_js.py
python scripts/check_version_sync.py
python scripts/validate_static_references.py
npm run test:rules
```

`main` 푸시는 품질 게이트 성공 후 Firebase 전체 자동 배포를 실행합니다.
