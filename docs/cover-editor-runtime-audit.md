# 책표지 제작 프로그램 런타임 점검 기준

기준일: 2026-08-05

## 점검 범위

책표지 제작 프로그램의 진입·인증, 규격·책등 계산, 이미지 업로드와 편집, 표지 글자, 미리보기 상호작용, 템플릿, 자동 저장·실행 취소, 프로젝트 파일, 인쇄 전 점검, PDF·PNG 출력, 모바일 배치와 Firebase 배포 구조를 점검한다.

## 현재 활성 런타임

### 본체

`perfect-binding-cover/index.html`은 기본 상태와 렌더러, 이미지 업로드, 책등 계산, 미리보기, PDF·PNG 출력을 소유한다.

### HTML에서 직접 로드하는 파일

1. `common-context-menu.js`
2. `editor-enhancements.js`
3. `cover-template-manager.js`
4. `cmyk-color-control.js`
5. `cover-editor-ux-upgrade.js`
6. `cover-editor-multiselect.js`
7. `cover-editor-layer-style.js`
8. `cover-editor-preflight-project.js`
9. `cover-editor-image-tools.js`

### 표지 경로 전용 보조 파일

`js/sw-register.js`는 다음 파일을 순서대로 한 번씩 불러온다.

1. `perfect-binding-cover-fine-controls.js`
2. `cover-editor-text-zones-v2.js`
3. `cover-text-ui-refine.js`
4. `cover-preview-workspace.js`
5. `cover-project-state-bridge.js`
6. `cover-template-project-safety.js`
7. `cover-floating-action-dock.js`
8. `cover-runtime-safety.js`

`cover-template-project-safety.js`는 현재 글자 레이어와 이미지 효과를 내 작업 템플릿에 포함하고, 프로젝트 파일의 크기·버전·필드·배치·글자 레이어·이미지 효과를 검증한다. 관리자 이미지 템플릿은 권한을 다시 확인한 뒤 저장하며 Firestore 확정 전 실패한 Storage 경로를 정리한다. 삭제 시 원본 Storage 정리가 끝난 뒤에만 Firestore 문서를 삭제한다.

`cover-runtime-safety.js`는 현재 여러 보조 파일이 설치를 마친 뒤 최종 안전 경계로 동작한다. 렌더러 호출 전후의 구형 글자 입력값을 보존하고, 인쇄 전 점검 오류가 남아 있으면 PDF·PNG 출력 이벤트를 차단하며, 현재 화면의 앞표지 글자를 다운로드 파일명에 사용한다.

## 1차 점검에서 확인한 문제

### 즉시 차단한 항목

- 인쇄 전 점검에서 오류가 확인돼도 기존 출력 클릭 이벤트가 계속 실행됐다.
- 일부 렌더러 래퍼가 임시로 글자 입력값을 비운 뒤 원본 렌더러에서 예외가 발생하면 값 복원이 보장되지 않았다.
- PDF·PNG 파일명이 현재 표지 글자 레이어가 아니라 숨겨진 구형 앞표지 제목을 기준으로 결정될 수 있었다.

## 2차 점검에서 정리한 항목

- 내 작업 템플릿에 현재 `CoverTextZones` 글자 레이어와 앞·뒤표지 이미지 효과를 함께 저장하고 복원한다.
- 과거 템플릿은 확장 상태가 없으면 기존 규격·색상·배치만 복원해 현재 글자 레이어를 임의로 비우지 않는다.
- 프로젝트 파일은 2MB 이하, 버전 1~2, 배치 요소 300개 이하, 글자 레이어 60개 이하로 제한한다.
- 가져온 글자·색상·위치·크기와 이미지 회전·반전·밝기·대비·채도를 허용 범위로 정규화한다.
- 관리자 템플릿 저장 전 관리자 권한과 이미지 MIME·15MB 제한을 확인한다.
- Firestore 문서 확정 전 저장 실패 시 시도한 Storage 경로를 정리하며, 문서 확정 후에는 원본을 잘못 삭제하지 않는다.
- 관리자 템플릿 삭제 시 Storage 원본 정리가 실패하면 Firestore 문서를 남겨 다음 정리 기회를 유지한다.

## 다음 단계에서 정리할 항목

- 정적 색상 팔레트가 두 모듈에서 중복 생성되는 구조를 한 소유자로 통합한다.
- 기능이 비활성인 `cover-editor-multiselect.js`와 `cover-editor-layer-style.js`의 운영 로드를 제거할지 검증한다.
- 미리보기 작업 메뉴를 sticky와 fixed 방식으로 연속 변경하는 두 모듈을 하나의 반응형 정책으로 통합한다.
- 표지 렌더러와 캔버스 포인터 이벤트를 여러 파일이 연속 감싸는 구조를 명시적 단일 진입점으로 축소한다.
- 출력 시 최대 약 5,200만 픽셀 캔버스의 메모리 사용과 저사양·모바일 환경의 실패 복구를 보강한다.
- 출력에만 필요한 jsPDF 외부 CDN이 초기 화면과 인증 실행을 막지 않도록 지연 로드 또는 동일 출처 런타임을 검토한다.

## 단계별 정리 순서

1. **런타임 기준과 출력 안전 경계**
   - 활성 파일·순서 고정
   - 점검 오류 출력 차단
   - 렌더 예외 상태 복구
   - 현재 화면 제목 기반 파일명
2. **템플릿·프로젝트·Storage 안전성**
   - 현재 글자·이미지 효과 저장 계약
   - 업로드 실패 롤백과 삭제 실패 처리
   - 프로젝트 입력값 검증
3. **렌더러·상호작용 소유권 정리**
   - 중복 전역 함수 래퍼 축소
   - 포인터·휠·키보드 이벤트 충돌 검사
   - 비활성 호환 파일 운영 로드 제거
4. **화면·모바일·색상 UI 정리**
   - 중복 팔레트 제거
   - 작업 메뉴 고정 정책 통합
   - 작은 화면·가상 키보드·확대 상태 확인
5. **출력·성능·실제 파일 매트릭스**
   - A4/B5/A5/사용자 규격
   - 자동·수동 책등, 좁은·넓은 책등
   - 이미지 없음/한쪽/양쪽, contain/cover, 회전·반전·색감
   - 가이드/완성 PDF와 PNG
   - 300DPI 픽셀·메모리 경계
   - 다운로드 파일 규격·페이지 크기·가이드 포함 여부

## 단계 통과 조건

각 단계는 별도 PR로 진행한다.

1. JavaScript와 인라인 스크립트 문법 검사 성공
2. 백엔드 전체 회귀 검사 성공
3. Firebase 규칙 검사 성공
4. 표지 전용 정적·실행 회귀 검사 성공
5. Firebase PR 미리보기와 사용자 경로 검사 성공
6. 미해결 자동 리뷰 지적사항 없음
7. 병합 후 Hosting·Functions·Rules 배포 성공
8. 운영 `production-smoke` 성공

위 조건이 모두 충족된 경우에만 다음 단계로 진행한다.
