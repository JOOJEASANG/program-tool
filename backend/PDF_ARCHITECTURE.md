# PDF backend architecture

PDF 백엔드는 런타임 monkeypatch 없이 명시적인 서비스 호출만 사용합니다.

## 처리 흐름

- `routers/pdf.py`: 여러 입력 PDF를 검증하고 직접 또는 Storage 기반 처리를 선택
- `services/pdf_disk_ops.py`: Storage에서 받은 경로 기반 처리
- `services/pdf_engine.py`: 메모리·디스크 경로가 함께 사용하는 단일 레이아웃 엔진
- `utils/storage_delivery.py`: 20 MiB를 넘는 결과를 사용자별 임시 Storage 경로로 전달

## 렌더링

- `services/pdf_divider_renderer.py`: 간지 페이지
- `services/pdf_text_renderer.py`: 한글 워터마크, 머리말·꼬리말, 페이지 번호
- `services/pdf_print_marks.py`: 인쇄 표시

원본 페이지는 가능한 한 `show_pdf_page()`로 배치해 벡터와 텍스트를 보존합니다. 표지 편집기의 PNG 출력은 이 PDF 벡터 출력 계약과 별개입니다.

## 검수와 수정

- `services/preflight_svc.py`: 문서 구조, 크기, RGB/CMYK 연산자, 투명도 위험 검사
- `services/preflight_reliability.py`: 표본 검사 결과를 부분 경고로 표시
- `services/preflight_repair.py`: 원본 페이지 크기를 보존해 문서를 재구성

자동 수정은 모든 페이지를 처리하지 못하면 성공으로 응답하지 않습니다. 검수는 RIP 기반 인쇄소 프리플라이트나 ICC 색상 변환을 대체하지 않습니다.

## 유지보수

`*_patch.py`, 중복 레이아웃 모듈, 시작 시점 함수 교체를 추가하지 않습니다. 소유 서비스에서 직접 수정하고 회귀 테스트로 계약을 고정합니다.
