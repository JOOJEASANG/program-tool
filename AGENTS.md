# Program Studio agent instructions

## 사용자 기능과 사용설명서는 한 작업으로 취급

Program Studio의 사용자에게 보이는 기능을 추가, 삭제, 변경하거나 기본값·제한·작업 순서를 바꾸는 경우에는 **같은 변경에서 해당 프로그램 사용설명서도 반드시 수정한다.**

설명서 원본:

- `js/program-manuals/print-checker.js` — 인쇄물 사전 검토
- `js/program-manuals/smart-print-layout.js` — 스마트 인쇄배치
- `js/program-manuals/pdf-editor.js` — PDF배치
- `js/program-manuals/pdf-editor-advanced.js` — PDF편집
- `js/program-manuals/pdf-suite.js` — PDF 유틸리티

상세 기준은 `docs/manuals/README.md`를 따른다.

기능 변경 시 확인할 항목:

1. 빠른 시작 순서가 현재 UI와 맞는지 확인한다.
2. 상세 기능에서 추가·삭제·변경된 옵션을 반영한다.
3. 기본값과 파일/용량/페이지 제한이 달라졌으면 설명도 바꾼다.
4. 사용자가 실수하기 쉬운 변경이면 문제 해결 항목을 추가한다.
5. 작업 흐름이 바뀌면 `demo` 자동 시연 단계도 함께 수정한다.
6. 해당 설명서의 `updated` 날짜를 실제 변경 날짜로 갱신한다.
7. 새 프로그램을 추가하면 설명서 파일, `js/program-manuals/catalog.js`, `scripts/check_manual_sync.py` 매핑을 함께 추가한다.

사용자 동작에 영향을 주지 않는 순수 내부 리팩터링, 테스트만의 변경, 주석 정리는 설명서 변경 대상이 아니다.

## 기존 저장소 원칙

- PDF 렌더링은 명시적인 엔진 코드에서 구현하고 런타임 monkeypatch나 중복 레이아웃 엔진을 추가하지 않는다.
- 가능한 경우 원본 PDF 벡터와 텍스트를 보존한다.
- API는 인증과 프로그램 권한을 확인한다.
- 사용자 UI와 오류 메시지는 한국어로 유지한다.
- 사용자에게 보이는 변경은 저장소의 버전 동기화 규칙을 따른다.
- PR 전 저장소 품질 검사와 `Manual sync guard`를 통과시킨다.
