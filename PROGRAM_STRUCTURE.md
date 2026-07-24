# Program Studio 구조 안내

## 운영 프로그램

각 프로그램은 저장소 루트의 독립 폴더에서 관리합니다.

- `pdf-editor/index.html` — PDF 편집기
- `pdf-preflight/index.html` — PDF 인쇄 검수
- `perfect-binding-cover/index.html` — 책표지제작

기존 `tools/*.html` 주소는 사용자의 북마크와 이전 링크를 위해 새 폴더로 이동시키는 호환 페이지로만 유지합니다. 실제 기능 수정은 반드시 위 프로그램 폴더의 `index.html`에서 진행합니다.

## 공통 코드

- `js/firebase-config.js` — Firebase 초기화, 로그인 및 권한 공통 처리
- `js/sw-register.js` — 서비스워커 등록과 프로그램별 보조 모듈 로딩
- `js/app-version.js` — 배포 버전 표시와 캐시 갱신
- `sw.js` — 네트워크 우선 캐시 정책
- `version.json` — 전체 사이트 단일 배포 버전

## 배포 규칙

1. 기능 수정 후 `version.json`의 `version`과 `updatedAt`을 변경합니다.
2. `js/sw-register.js`, `js/firebase-config.js`, `sw.js`의 버전을 같은 값으로 맞춥니다.
3. 프로그램 내부 전용 코드는 해당 프로그램 폴더에서만 수정합니다.
4. 공통 기능만 `js/` 아래에 둡니다.
5. 기존 `tools/*.html` 호환 페이지에는 기능 코드를 다시 넣지 않습니다.

## 캐시 정책

온라인 상태에서는 항상 서버의 최신 파일을 먼저 사용합니다. 새 버전이 감지되면 기존 Cache Storage를 삭제하고 한 번만 자동 새로고침합니다. 화면 오른쪽 아래에 현재 배포 버전이 표시됩니다.
