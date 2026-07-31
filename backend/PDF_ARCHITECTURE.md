# PDF architecture

PDF 백엔드는 런타임 monkeypatch 없이 명시적인 서비스 호출만 사용합니다.

## 백엔드 처리 흐름

- `routers/pdf.py`: 여러 입력 PDF를 검증하고 직접 또는 Storage 기반 처리를 선택
- `services/pdf_disk_ops.py`: Storage에서 받은 경로 기반 처리
- `services/pdf_engine.py`: 메모리·디스크 경로가 함께 사용하는 단일 레이아웃 엔진
- `utils/storage_delivery.py`: 20 MiB를 넘는 결과를 사용자별 임시 Storage 경로로 전달

## 백엔드 렌더링

- `services/pdf_divider_renderer.py`: 간지 페이지
- `services/pdf_text_renderer.py`: 한글 워터마크, 머리말·꼬리말, 페이지 번호
- `services/pdf_print_marks.py`: 인쇄 표시

원본 페이지는 가능한 한 `show_pdf_page()`로 배치해 벡터와 텍스트를 보존합니다. 표지 편집기의 PNG 출력은 이 PDF 벡터 출력 계약과 별개입니다.

## 프런트엔드 운영 런타임

PDF 편집기는 2026년 7월 20일 정상본을 기준으로 한 8개 루트 모듈만 `loader.js`에서 순서대로 불러옵니다.

1. `font-render-fix.js`
2. `upload-fix.js`
3. `live-preview.js`
4. `layout-export.js`
5. `page-count-hint.js`
6. `nup-helper.js`
7. `preview-row-default.js`
8. `divider-helper.js`

`crop-marks.js`는 PDF 편집기 경로에서 `sw-register.js`가 한 번만 별도로 불러옵니다. `divider-studio.js`는 소유 모듈인 `divider-helper.js`가 준비 완료 후 한 번만 불러옵니다. 두 파일은 루트 모듈 수에 포함하지 않습니다.

다음 과거 루트 래퍼는 파일이 남아 있어도 운영 로더에서 활성화하지 않습니다.

- `booklet-print-guide.js`
- `dock-width-align.js`
- `operation-progress-summary.js`
- `output-contract.js`
- `preview-controller.js`
- `print-marks-bleed.js`
- `runtime-integrity.js`
- `thumbnail-integrity.js`
- `ux-repair.js`

필요한 기능을 복원할 때는 위 래퍼를 통째로 다시 켜지 않고, 현재 소유 모듈이나 명시적 백엔드 서비스에 필요한 로직만 직접 통합합니다. 활성 목록, 별도 로드와 비활성 목록은 `test_pdf_editor_july20_runtime.py`가 고정합니다.

## 검수와 수정

- `services/preflight_svc.py`: 문서 구조, 크기, RGB/CMYK 연산자, 투명도 위험 검사
- `services/preflight_reliability.py`: 표본 검사 결과를 부분 경고로 표시
- `services/preflight_repair.py`: 원본 페이지 크기를 보존해 문서를 재구성

자동 수정은 모든 페이지를 처리하지 못하면 성공으로 응답하지 않습니다. 검수는 RIP 기반 인쇄소 프리플라이트나 ICC 색상 변환을 대체하지 않습니다.

## 유지보수 원칙

- 백엔드에 `*_patch.py`, 중복 레이아웃 모듈, 시작 시점 함수 교체를 추가하지 않습니다.
- 프런트엔드 루트 모듈을 추가하기 전에 기존 소유 모듈에 직접 통합할 수 있는지 먼저 확인합니다.
- 과거 비활성 래퍼를 다시 활성화하려면 별도 PR에서 소유권 충돌, 중복 함수 래핑, 제한 없는 감시가 없는지 검증합니다.
- 기능 변경은 미리보기와 최종 PDF를 함께 검사하는 회귀 테스트로 계약을 고정합니다.
