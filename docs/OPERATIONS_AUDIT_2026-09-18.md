# Program Studio 최종 운영 감사 — 2026-09-18

## 감사 기준

- 기준 저장소: `JOOJEASANG/program-tool`
- 감사 시작 기준 `main`: `4408b969ba9f2cb77f25fbdc9e81871c11cbdc2e`
- 최신 운영 배포: GitHub Actions run `35306546786` 성공
- 최신 `production-smoke`: 성공
- 같은 기준 커밋 CodeQL: JavaScript/TypeScript + Python 성공
- 저장소 규모: 621 files / 34 directories

이 문서는 코드, Firebase 배포 설정, GitHub Actions, 권한 경계, 저장소 구조를 함께 본 운영 시점 스냅샷입니다. 실제 Cloud/GitHub 계정 설정 중 저장소 API에서 확인할 수 없는 항목은 별도 미완료로 분리합니다.

## 코드·배포 상태

현재 운영 프로그램은 홈 런처 기준 6개입니다.

1. 디자인 검토 — `/print-checker`
2. AI 디자인 제작 — `/ai-design-maker`
3. 스마트 인쇄배치 — `/smart-print-layout`
4. PDF배치 — `/pdf-editor`
5. PDF편집 — `/pdf-editor-advanced`
6. PDF 유틸리티 — `/pdf-suite`

서버 API는 Firebase ID 토큰을 확인하고, 관리자 또는 `user_permissions/{uid}.status == "approved"`인 사용자만 관리 API를 사용할 수 있습니다. Firestore와 Storage Rules도 동일한 승인 정책을 사용하며 나머지 경로는 default deny입니다.

Firebase Hosting은 저장소 루트를 직접 배포하지 않고 `scripts/prepare_hosting_dist.py`가 만든 allowlist 디렉터리만 배포합니다. 운영 배포는 reusable quality gate를 통과한 뒤 Hosting + Functions + Rules를 배포하고 production smoke를 실행합니다.

대용량 PDF는 Storage staging을 사용하며 direct multipart 요청은 25MiB로 제한합니다. Functions는 현재 4GB memory, 600초 timeout, max instances 2입니다. 임시 PDF/result cleanup은 매시간 실행되고, 저장 세션/프로젝트 quota 및 orphan cleanup은 하루 한 번 실행됩니다.

AI 디자인 제작의 OpenAI API 키는 서버 환경변수에서만 읽습니다. 클라이언트는 Firebase ID 토큰을 포함해 서버 endpoint를 호출하며, 모델 오류·rate limit·moderation 오류는 제한된 공개 오류 메시지로 변환됩니다.

## 이번 정리에서 수정한 항목

- 더 이상 운영 런타임에서 참조되지 않는 `js/program-registry.js` 제거
- 퇴역한 표지 PDF lazy loader `js/cover-jspdf-loader.js`와 전용 Node 테스트 제거
- 제거된 런타임이 다시 들어오지 않도록 회귀테스트 교체/추가
- README와 구조 문서를 6개 운영 프로그램 및 독립 `/ai-design-maker` 기준으로 동기화
- 배포 버전을 `2026.09.18.001`로 갱신
- Dependabot minor/patch 업데이트를 생태계별 그룹 PR로 묶고 동시 open 수를 3개로 제한
- 최종 운영 체크리스트의 임시 Storage cleanup 주기를 실제 코드와 동일하게 수정

## 저장소 밖에서 아직 완료해야 하는 항목

### 1. GitHub main 보호

감사 시점의 `main`은 `protected: false`입니다.

운영 배포 workflow 자체에는 직접 push를 배포하지 않는 source guard가 있지만, 저장소 변경 자체를 막는 Branch Protection/Ruleset을 대신하지는 못합니다. PR 경유 강제, force push/delete 금지, 필수 품질검사를 GitHub 설정에서 적용해야 합니다.

### 2. WIF 전환

최신 운영 배포 run `35306546786`에서 `Google Cloud WIF 인증` 단계는 `skipped`였습니다. 배포는 성공했으므로 현재 구성된 fallback 경로가 사용 가능한 상태이지만, 최종 목표인 WIF 전환은 아직 완료되지 않았습니다.

`GCP_WORKLOAD_IDENTITY_PROVIDER`와 `GCP_SERVICE_ACCOUNT`을 구성하고 preview/production 양쪽에서 WIF step 실행을 확인한 뒤 기존 `FIREBASE_TOKEN`을 제거합니다.

### 3. 관리자 Custom Claim

코드는 `admin=true` custom claim을 우선 사용하지만 `settings/admin` 이메일 fallback이 아직 남아 있습니다. 실제 관리자 계정의 claim 마이그레이션 완료 여부는 저장소만으로 검증할 수 없습니다.

`backend/scripts/sync_admin_claims.py --verify` 성공 후 별도 보안 PR에서 fallback을 제거합니다.

### 4. Cloud Storage lifecycle

저장소의 `storage-lifecycle.json`은 다음 1일 삭제 정책을 갖고 있습니다.

- `pdf_temp/`
- `preflight_temp/`
- `pdf_results/`

이 파일이 실제 GCS bucket lifecycle에 적용되어 있는지는 저장소만으로 확인할 수 없습니다. Cloud Storage 실제 bucket 정책을 조회해 확인해야 합니다.

### 5. 부하·관찰성

최종 운영 전 다음은 실제 환경에서 확인해야 합니다.

- 100MB PDF 3개 동시 처리
- 200MB PDF 3개 동시 처리
- 중간 작업 5~10개 동시 처리
- Functions 5xx/timeout 알림
- scheduled cleanup 실패 알림
- Storage 사용량/egress 급증 감시
- AI 이미지 생성 비용 급증 감시

현재 정책은 승인 회원에게 일일 상품 사용량 quota를 두지 않습니다. 대신 비용이 발생하는 AI endpoint에는 Firestore transaction 기반 단기 남용 방어를 적용해 이미지 생성은 사용자별 10분 5회, 레이아웃 생성은 10분 15회, 유형별 동시 실행은 1개로 제한합니다. 사용자 수가 늘거나 유료 정책을 도입할 경우에는 이 운영 안전장치와 별도로 사용자 작업 단위 action-id 기반 상품 quota를 설계해야 합니다.

## 후속 하드닝

- 관리자 claim 전환 완료 후 legacy email fallback 제거
- inline script/style 정리 후 CSP `unsafe-inline` 단계적 축소
- 핵심 외부 JS 라이브러리 자체 Hosting 또는 무결성 검증
- 대용량 PDF 부하 측정 후 memory/timeout/max instances 재조정
- AI 생성 및 Functions 비용 알림 임계치 설정

## 운영 판단

감사 시점의 `main`은 최신 production smoke, backend tests, browser smoke, Firebase Rules emulator, Hosting 검증, CodeQL을 통과한 상태입니다. 이번 정리 PR은 운영 기능을 늘리지 않고 죽은 코드·낡은 문서·릴리스 추적 정보를 정리합니다.

코드/배포 파이프라인에서 새로 발견된 치명적 또는 높음 등급 결함은 없었습니다. 다만 최종 운영 설정 완료로 표시하려면 GitHub main 보호, WIF, 관리자 claim, 실제 Storage lifecycle 확인과 부하/알림 검증을 별도로 마감해야 합니다.


## 2026-09-18 최종 재점검 — AI 디자인 변경 반영

PR #581 운영 감사 이후 `main`은 `e3a8983fdc9786a700f3803d4a09d44b58aaa53e`까지 9개 커밋이 추가되었고, 변경 범위는 주로 AI 디자인 제작 UI·OpenAI 표지 생성·디자인 보관함 및 관련 Firestore/Storage Rules입니다.

재점검한 최신 운영 배포 run `35322958997`은 backend tests, Firebase Rules emulator, frontend/repository checks, standalone app browser smoke, PDF shell smoke, CodeQL, Firebase deploy, production smoke까지 모두 성공했습니다.

추가로 확인된 운영 리스크는 AI 디자인 보관함의 지속 저장량입니다. 프런트는 최근 100개만 조회하지만 서버 정리에는 `ai_design_gallery`가 포함되지 않아 승인 사용자가 계속 저장할 경우 오래된 미리보기 객체가 계속 누적될 수 있었습니다. 최종 운영 정리 브랜치에서는 다음 방어를 추가합니다.

- 사용자별 최근 100개 보관
- 초과한 오래된 Firestore 메타데이터와 미리보기 이미지 동시 정리
- Firestore 문서가 사라진 고아 이미지는 24시간 유예 후 정리
- Admin SDK cleanup이 클라이언트 기록 경로를 임의로 삭제하지 못하도록 `uid/designId/preview.jpg` 정확 경로만 허용
- 경로 변조 회귀 테스트와 보관 상한 회귀 테스트 추가

기존 외부 미완료 항목은 그대로 유효합니다. 특히 `main` Branch Protection, WIF 전환, 관리자 Custom Claim 검증, 실제 Storage lifecycle 적용, 대용량 부하 테스트, Functions/Storage/AI 비용 알림을 완료해야 최종 운영 마감으로 볼 수 있습니다.

추가로 재해복구 설정은 저장소 코드만으로 확인할 수 없습니다. Firestore PITR/백업과 Storage 복구 정책(soft delete 또는 별도 백업)을 실제 프로젝트 설정에서 확인하고, 운영 데이터 복원 절차를 한 번 이상 검증하는 것이 필요합니다.
