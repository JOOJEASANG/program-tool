# 책표지 제작 프로그램 런타임 점검 기준

기준일: 2026-08-06

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
7. `cover-template-surface-cleanup.js`
8. `cover-floating-action-dock.js`
9. `cover-ui-runtime-normalizer.js`
10. `cover-output-performance-safety.js`
11. `cover-runtime-safety.js`
12. `cover-render-pipeline-contract.js`

`cover-template-project-safety.js`는 프로젝트 파일의 크기·버전·필드·배치·글자 레이어·이미지 효과를 검증한다. 관리자 이미지 템플릿은 권한을 다시 확인한 뒤 저장하며 Firestore 확정 전 실패한 Storage 경로를 정리한다. 삭제 시 원본 Storage 정리가 끝난 뒤에만 Firestore 문서를 삭제한다.

`cover-template-surface-cleanup.js`는 기본 스타일 프리셋과 개인 작업 템플릿 화면을 운영 UI에서 제거하고, 기존 관리자 제공 이미지 템플릿 DOM과 이벤트 연결은 그대로 유지한다.

`cover-floating-action-dock.js`는 300DPI PDF 버튼을 첫 줄 전체에 두고, 가이드 PDF·미리보기 PNG·초기화 아이콘을 둘째 줄 3칸에 배치한다. 설명 문구와 빈 상태 영역은 고정 메뉴에서 숨겨 세로 공간을 줄인다.

`cover-ui-runtime-normalizer.js`는 정적 색상 입력에 중복 생성된 두 팔레트 중 기존 상세 팔레트 하나만 남기고, 동적 글자 색상 입력은 해당 글자 팔레트를 유지한다. 모바일 가상 키보드가 실제로 화면 높이를 줄이고 입력 요소가 활성화된 동안에는 고정 출력 메뉴를 문서 흐름으로 돌려 입력란을 가리지 않게 한다. 출력 상태 영역에는 실시간 상태 접근성 속성을 부여한다.

`cover-output-performance-safety.js`는 완성 가로·세로와 실제 출력 DPI로 캔버스 픽셀 수와 예상 작업 메모리를 계산한다. 기존 절대 한도 5,200만 픽셀 안에서 기기 메모리별 안전 한도를 적용하며, 캔버스 한 변 16,384px 초과도 사전에 차단한다. PDF 출력 시 기존 jsPDF CDN 연결이 실패했으면 대체 CDN을 한 번 로드하고 12초 안에 성공 또는 명확한 실패 상태로 종료한다.

`cover-runtime-safety.js`는 현재 여러 보조 파일이 설치를 마친 뒤 최종 렌더 상태 안전 경계로 동작한다. 렌더러 호출 전후의 구형 글자 입력값을 보존하고, 인쇄 전 점검 오류가 남아 있으면 PDF·PNG 출력 이벤트를 차단하며, 현재 화면의 앞표지 글자를 다운로드 파일명에 사용한다.

`cover-render-pipeline-contract.js`는 모든 기존 렌더 보조 모듈의 설치가 끝난 뒤 현재 합성 렌더러를 한 번 캡처하고 `window.renderCover`의 최종 소유자를 하나로 고정한다. 이후 전역 렌더 함수가 다시 바뀌면 자동 재포장하지 않고 소유권 이탈만 경고해 재귀 래퍼 위험을 피한다. 기능이 없는 호환 스크립트 두 개는 설치 완료 후 활성 DOM에서 제거한다.

## 1차 점검에서 정리한 항목

- 인쇄 전 점검 오류가 남아 있어도 PDF·PNG 생성이 실행되던 문제를 차단했다.
- 하위 렌더러 예외 시 임시로 비운 구형 글자 입력값이 복구되지 않을 수 있던 문제를 `finally` 복원으로 고정했다.
- 다운로드 파일명이 숨겨진 구형 제목을 사용할 수 있던 문제를 현재 앞표지 글자 기준으로 수정했다.

## 2차 점검에서 정리한 항목

- 프로젝트 파일은 2MB 이하, 버전 1~2, 배치 요소 300개 이하, 글자 레이어 60개 이하로 제한한다.
- 가져온 글자·색상·위치·크기와 이미지 회전·반전·밝기·대비·채도를 허용 범위로 정규화한다.
- 관리자 템플릿 저장 전 관리자 권한과 이미지 MIME·15MB 제한을 확인한다.
- Firestore 문서 확정 전 저장 실패 시 시도한 Storage 경로를 정리하며, 문서 확정 후에는 원본을 잘못 삭제하지 않는다.
- 관리자 템플릿 삭제 시 Storage 원본 정리가 실패하면 Firestore 문서를 남겨 다음 정리 기회를 유지한다.

## 3차 점검에서 정리한 항목

- `cmyk-color-control.js`와 `cover-text-ui-refine.js`가 같은 정적 색상 입력에 팔레트를 각각 생성하는 중복을 제거한다.
- 정적 입력은 기존 상세 팔레트를 유지하고, 나중에 생성되는 동적 글자 색상 입력은 글자 전용 팔레트를 유지한다.
- 모바일에서 가상 키보드가 열린 동안 `#coverSidebarActions`와 고정 출력 메뉴를 문서 흐름으로 돌려 입력 영역을 가리지 않는다.
- 키보드가 닫히면 기존 고정 작업 메뉴 정책으로 자동 복귀한다.
- 출력 진행·성공·실패 상태를 보조기기가 읽을 수 있도록 `role=status`, `aria-live=polite`를 적용한다.
- 렌더러 래퍼 순서와 글자·책등 포인터 캡처 순서를 회귀 검사로 고정했다.
- `cover-editor-multiselect.js`와 `cover-editor-layer-style.js`는 현재 기능을 제공하지 않는 비활성 호환 정리 파일이며 반복 감시나 상태 변경을 하지 않음을 확인했다.

## 4차 점검에서 정리한 항목

- A4·B5·A5와 최대 사용자 규격을 실제 300DPI·180DPI 픽셀 공식으로 실행 검사한다.
- 2GB·4GB·8GB·고메모리 기기별 PDF 픽셀 한도를 각각 2,400만·3,400만·4,600만·5,200만으로 적용한다.
- 출력 차단 시 예상 픽셀 크기와 렌더·변환 과정의 추정 작업 메모리를 표시한다.
- PNG는 실제 180DPI 픽셀 수로 별도 판단해 PDF 기준을 잘못 적용하지 않는다.
- PDF 페이지 크기가 완성 가로·세로 밀리미터와 일치하고 래스터가 페이지 전체에 배치되는 기존 계약을 고정한다.
- jsPDF 최초 CDN 실패 시 출력 시점에 대체 CDN으로 복구하고, 중복 로드와 무한 대기를 막는다.
- 자세한 사례는 `docs/cover-output-test-matrix.md`에 기록한다.

## 5차 점검에서 정리한 항목

- 하단 고정 작업 메뉴의 여백과 버튼 높이를 줄였다.
- 300DPI PDF는 첫 줄 전체 버튼으로 유지한다.
- 가이드 PDF·미리보기 PNG·초기화 아이콘은 둘째 줄에 나란히 배치한다.
- 초기화는 `↻` 아이콘으로 표시하고 접근성 이름과 설명을 유지한다.
- 고정 메뉴의 반복 설명 문구와 비어 있는 상태 영역은 숨긴다.
- 기본 스타일 프리셋과 개인 작업 템플릿 UI를 제거한다.
- 공개 관리자 이미지 템플릿의 조회·적용과 관리자 저장·삭제 기능은 유지한다.

## 6차 점검에서 정리한 항목

- 기존 렌더러 래퍼 설치가 끝난 뒤 최종 렌더 함수의 전역 소유자를 하나로 고정한다.
- 최종 소유자는 캡처한 기존 합성 렌더러에 인수와 `this`를 그대로 전달하므로 출력·미리보기 결과를 변경하지 않는다.
- 최종 설치 후 다른 코드가 `window.renderCover`를 다시 바꾸면 재포장하지 않고 소유권 이탈 상태만 기록한다.
- 비활성 호환 스크립트 두 개는 실행 완료 후 활성 DOM에서 제거한다.
- 설치는 3.2초·3.8초·4.6초의 제한된 시도만 사용하며 반복 감시를 추가하지 않는다.

## 확인 완료 후 남은 구조 개선 사항

다음 항목은 현재 사용자 오류를 일으키는 기능 결함으로 확인되지는 않았으나 장기 유지보수를 위해 별도 대형 리팩터링이 필요하다.

- 비활성 호환 파일 두 개의 `<script>` 태그를 본체 HTML 소스에서 완전히 제거해 네트워크 요청 자체를 없앤다.
- 개별 보조 파일 내부의 렌더 래퍼 구현을 단계 등록 방식으로 재작성한다. 현재는 최종 전역 진입점만 단일화됐다.
- 본체 HTML에 동기 선언된 jsPDF 기본 CDN을 완전한 지연 로드로 전환한다. 현재는 초기 CDN 실패 후 출력 시점 복구 경로가 추가돼 있다.
- 실제 브라우저에서 생성된 PDF 내부 이미지의 색공간·압축률·인쇄소 RIP 호환성은 별도 인쇄 샘플 검수가 필요하다. 현재 프로그램은 기존과 동일한 RGB PNG 기반 PDF를 생성한다.

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

위 조건이 모두 충족된 경우에만 점검 완료로 판정한다.
