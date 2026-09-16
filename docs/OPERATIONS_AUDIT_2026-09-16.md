# Program Studio 운영 전 최종 점검 — 2026-09-16

## 운영 정책 확정

현재 운영 단계에서는 사용자 수 10명 이하를 전제로 다음 정책을 사용한다.

- 프로그램 사용 조건: Firebase 로그인 + 관리자 승인 완료
- 승인 상태: `pending` / `approved` / `suspended`
- FREE/PRO 구분 없음
- 일일·월간·프로그램별 사용횟수 제한 없음
- 향후 구독제가 필요해질 때 별도 서버 권한 모델로 추가

## 이번 PR에서 해결한 항목

### 1. 사용횟수 제한 제거

- 관리자 화면의 프로그램별 횟수 설정 제거
- FREE/PRO 회원 구분 제거
- 일일 무료 사용량 및 프로그램별 카운터 차감·차단 로직 제거
- PDF 결과 생성 시 사용량 차감 가드 제거
- PDF 올인원 통합 quota 훅 제거
- Hosting 빌드에서 quota 스크립트 자동 삽입 제거
- 오래 캐시된 화면 호환을 위해 일부 옛 파일은 동작하지 않는 compatibility shim으로만 유지

### 2. 승인 회원 전용으로 접근 정책 통일

다음 운영 프로그램을 모두 동일한 승인 정책으로 통일했다.

- 인쇄물 사전 검토
- 스마트 인쇄배치
- PDF 올인원
- PDF 편집기
- PDF 고급 편집기
- PDF 검사·유틸리티

승인 대기 또는 이용 중지 계정은 프로그램 화면에서 작업할 수 없고, 서버 API와 사용자 저장소는 기존의 서버 측 승인 검사를 계속 사용한다.

### 3. Firebase 권한 모델 단순화

신규 `user_permissions/{uid}` 문서는 다음 핵심 정보만 사용한다.

- uid
- email
- displayName
- status
- createdAt

기존 `plan`, `programs`, 일일 사용량·프로그램 사용량 문서는 신규 권한 판단에 사용하지 않는다.

### 4. 관리자 화면 단순화

현재 관리자 화면의 회원 운영 기능은 다음만 제공한다.

- 승인 대기 확인
- 승인
- 승인 대기로 변경
- 이용 중지
- 선택 회원 일괄 승인/중지

사용량 설정과 구독 등급 UI는 제거했다.

### 5. 배포·캐시 버전 정리

운영 버전을 `2026.09.16.001`로 갱신했고, 이전 서비스워커/캐시 정리 버전도 함께 맞췄다.

## 운영 전 반드시 확인할 항목

### A. 자동 검사 전부 통과

`main` 병합 전 다음 검사가 모두 성공해야 한다.

- Repository quality gate
- Modular app architecture
- Firebase Rules emulator
- Firebase PR preview
- preview 사용자 경로 smoke

하나라도 실패하면 운영 배포를 진행하지 않는다.

### B. 관리자 Custom Claim 마이그레이션

현재 `admin=true` Firebase Custom Claim을 우선 사용하지만, 마이그레이션 안전성을 위해 `settings/admin` 이메일 목록 fallback이 남아 있다.

`backend/scripts/sync_admin_claims.py --verify`가 성공한 뒤 별도 보안 PR에서 이메일 fallback을 제거한다.

### C. Cloud Storage lifecycle 실제 적용

`storage-lifecycle.json`은 저장소에 있어도 Firebase 배포만으로 실제 GCS lifecycle이 자동 설정되지 않는다.

실제 버킷에서 다음 prefix의 age 1일 삭제 정책을 확인한다.

- `pdf_temp/`
- `preflight_temp/`
- `pdf_results/`

### D. 기존 사용량 데이터 정리

이번 변경은 기존 운영 데이터를 자동 삭제하지 않는다. 안정 배포 확인 후 Firestore를 백업한 다음 더 이상 참조되지 않는 과거 데이터를 정리한다.

정리 후보:

- 사용자 문서의 과거 `plan`
- 사용자 문서의 과거 `programs`
- `program_usage_limits`
- 사용자별 `daily_pdf_usage`
- 사용자별 `program_usage`
- 과거 사용량 설정 문서

삭제 전 반드시 실제 코드 참조가 없는지 최종 확인한다.

## 남은 위험 및 후속 개선

### 중요 1. 이미 열려 있는 클라이언트 전용 도구의 이용중지 반영

서버 API는 요청마다 승인 상태를 검사하지만, 이미 브라우저에서 열린 순수 클라이언트 작업은 이용중지 후에도 현재 탭에서 일부 로컬 기능을 계속 사용할 수 있다.

현재 소규모 승인 사용자 운영에서는 치명적이지 않지만, 즉시 차단이 필요해지면 `user_permissions/{uid}` 실시간 감시 또는 주요 작업 직전 재승인 검사를 추가한다.

### 중요 2. Firebase Hosting의 정적 JS 자체는 비공개 자산이 아님

화면 진입을 승인제로 막더라도 Hosting에 배포된 JavaScript 파일 자체는 정적 공개 자산이다. 서버 API, Firestore, Storage 데이터 접근은 승인 정책으로 보호되지만 클라이언트 코드 자체를 비밀로 만들 수는 없다.

강한 라이선스/복제 방지가 필요하다면 핵심 처리 로직을 서버 측으로 이동해야 한다.

### 중요 3. 대용량 PDF 비용·부하

현재 Function 설정:

- memory: 4GB
- timeout: 600초
- max_instances: 2
- 직접 HTTP 요청 한도: 25MiB
- 임시 대용량 PDF: 파일당 최대 500MiB

사용자 수를 늘리기 전에 100MB·200MB 동시 처리와 5~10개 중간 작업 동시 요청을 실제로 측정한다. `max_instances`는 측정 결과 없이 올리지 않는다.

### 보통 1. CSP `unsafe-inline`

현재 CSP는 기본 보안 헤더를 적용하지만 기존 인라인 스크립트·스타일 호환 때문에 `unsafe-inline`이 남아 있다. 기능 안정화 후 인라인 코드를 외부 파일로 옮기고 CSP를 단계적으로 강화한다.

### 보통 2. 사업자 직인 Base64 저장

관리자 화면은 최대 500KB 직인 이미지를 Base64 data URL 형태로 Firestore 사업자 문서에 저장한다. Base64 변환 시 용량이 늘기 때문에 Firestore 문서 크기 한도에 여유가 크지 않다.

직인을 계속 사용할 경우 Storage에 이미지 파일을 저장하고 Firestore에는 경로만 보관하는 구조로 옮기는 것이 안전하다.

### 보통 3. 관리자 권한 원천 중복

Custom Claim, Firestore 이메일 fallback이 프런트엔드·Firestore Rules·Storage Rules·백엔드에 동시에 존재한다. 마이그레이션 완료 후 Custom Claim 하나로 통일하면 권한 정책 드리프트 위험이 줄어든다.

## 운영 직전 수동 사용자 테스트

최소 네 계정 상태로 실제 브라우저에서 확인한다.

1. 미로그인: 프로그램 접근 시 로그인 화면으로 이동
2. 승인 대기: 프로그램 접근 차단 및 승인 대기 안내
3. 승인 완료: 모든 운영 프로그램 정상 진입 및 저장/다운로드
4. 이용 중지: 새 프로그램 진입과 서버 작업 차단
5. 관리자: 회원 승인/중지, 사업자 정보 수정 정상 동작

추가로 2개 브라우저 또는 시크릿 창을 사용해 승인 상태 변경 후 캐시·재로그인 동작을 확인한다.

## 병합 기준

- 자동 검사 전부 성공
- 미로그인/대기/승인/중지/관리자 경로 수동 확인
- 관리자 claim 및 Storage lifecycle 운영 설정 상태 기록
- 치명적 또는 높음 등급의 알려진 코드 오류 없음

위 조건을 만족한 뒤 `main`에 병합한다. `main` 병합은 Firebase 운영 배포를 자동 실행하므로, 테스트 실패 상태에서는 병합하지 않는다.
