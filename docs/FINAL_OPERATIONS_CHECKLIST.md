# Program Studio 최종 운영 체크리스트

최종 운영 배포 전에 코드 품질 검사와 별도로 확인해야 하는 계정·인프라 설정을 정리한 문서입니다. 이 항목은 저장소 코드만으로 강제할 수 없는 운영 경계입니다.

## 1. GitHub main 보호

현재 `main`은 자동 Firebase 운영 배포의 기준 브랜치입니다. GitHub 저장소 설정에서 다음을 적용합니다.

- `main` 직접 push 제한
- pull request를 통한 변경만 허용
- force push 및 branch delete 금지
- 최신 품질 검사 통과를 병합 조건으로 지정
- 최소 필수 검사: `Repository quality gate`, `Modular app architecture`
- 운영 정책에 따라 PR preview 검사도 필수 검사로 추가

보호 규칙 적용 후 테스트 PR에서 실패한 검사를 가진 변경이 병합되지 않는지 확인합니다.

## 2. Firebase CI 인증을 WIF로 전환

워크플로는 Workload Identity Federation(WIF)을 우선 사용하고 기존 `FIREBASE_TOKEN`은 전환기 fallback으로만 사용합니다.

GitHub Actions secrets에 아래 두 값을 함께 구성합니다.

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`

검증 순서:

1. PR preview에서 `Google Cloud WIF 인증` 단계가 실행되는지 확인합니다.
2. 운영 배포에서도 같은 단계가 실행되고 Firebase 배포가 성공하는지 확인합니다.
3. 두 경로가 성공한 뒤에만 기존 `FIREBASE_TOKEN` secret을 제거합니다.
4. WIF 두 값 중 하나만 설정된 상태로 두지 않습니다. `scripts/firebase_ci.sh`는 불완전한 설정을 의도적으로 실패 처리합니다.

## 3. 관리자 Custom Claim 마이그레이션 완료

최종 목표는 Firebase Auth의 `admin=true` Custom Claim을 유일한 관리자 권한 원천으로 사용하는 것입니다. 기존 `settings/admin` 이메일 fallback은 마이그레이션 완료 전까지만 유지합니다.

백엔드 가상환경에서 먼저 dry-run을 실행합니다.

```bash
cd backend
venv/bin/python scripts/sync_admin_claims.py
```

대상이 맞는지 확인한 뒤 적용합니다.

```bash
venv/bin/python scripts/sync_admin_claims.py --apply --revoke-missing
```

관리자는 적용 후 로그아웃/로그인 또는 토큰 갱신이 필요합니다. 마지막으로 검증합니다.

```bash
venv/bin/python scripts/sync_admin_claims.py --verify
```

`--verify`가 성공하기 전에는 Firestore/Storage/Backend의 legacy admin fallback을 제거하지 않습니다. 검증이 완료되면 fallback 제거는 별도 보안 PR로 진행합니다.

## 4. Storage lifecycle 실제 버킷 적용 확인

애플리케이션은 매시간 `pdf_temp/`, `preflight_temp/`, `pdf_results/`를 정리하는 scheduled function을 운영합니다. 별도의 장애 안전망으로 `storage-lifecycle.json`도 실제 Cloud Storage 버킷에 적용되어 있어야 합니다.

확인할 정책:

- `pdf_temp/`: age 1일 삭제
- `preflight_temp/`: age 1일 삭제
- `pdf_results/`: age 1일 삭제

Firebase 배포만으로 Cloud Storage lifecycle 파일이 자동 적용된다고 가정하지 않습니다. Google Cloud Console 또는 권한이 있는 GCS 관리 도구에서 실제 버킷 정책을 조회하여 확인합니다.

## 5. 현재 회원 운영 정책

현재 운영 정책은 **로그인 + 관리자 승인 완료**만을 사용 조건으로 합니다.

- FREE/PRO 구분 없음
- 일일/월간/프로그램별 사용횟수 제한 없음
- 승인 대기 또는 이용 중지 계정은 프로그램 진입 차단
- 승인 완료 계정은 운영 프로그램을 횟수 제한 없이 사용
- 기존 Firestore의 과거 `plan`, `programs`, 사용량 카운터 데이터는 접근 판단에 사용하지 않음

기존 운영 데이터에 남아 있는 과거 사용량 컬렉션과 `plan`/`programs` 필드는 배포가 안정된 뒤 별도 백업 후 삭제합니다. 현재 코드가 참조하지 않는지 먼저 확인하고 정리합니다.

향후 구독제로 전환할 때는 현재 승인 상태와 결제를 섞지 않고 서버 권한 모델로 별도 설계합니다.

- 결제 상태/구독 만료일은 서버 검증 결과를 권한 원천으로 사용
- 사용자 작업 단위 `action_id` 발급
- 필요할 경우 서버 transaction으로 quota 예약/커밋
- 동일 `action_id` idempotency 보장
- 작업 실패 시 차감 취소 또는 미커밋
- 클라이언트 localStorage/직접 Firestore 쓰기를 과금 기준으로 사용하지 않음

## 6. 대용량 PDF 부하 테스트

운영 Function은 의도적으로 비용 상한을 두기 위해 `max_instances=2`, 2GB 메모리, 300초 timeout을 사용합니다. 승인 회원 수나 동시 사용량을 늘리기 전에 다음 시나리오를 측정합니다.

- 100MB PDF 3개 동시 처리
- 200MB PDF 3개 동시 처리
- 중간 크기 작업 5~10개 동시 요청
- 암호화/복호화와 일반 PDF 작업 혼합
- 배경 이미지 처리 포함 작업

측정 항목은 대기시간, 429/5xx, timeout, Function 메모리, Storage egress입니다. 측정 결과 없이 `max_instances`를 올리지 않습니다.

## 7. 보안 헤더 후속 강화

현재 CSP/HSTS/nosniff/frame 제한 등 기본 보안 헤더는 적용되어 있습니다. 다음은 호환성 영향이 커서 단계적으로 진행합니다.

- inline script/style 제거 후 CSP의 `unsafe-inline` 축소
- 외부 jsPDF 등 핵심 런타임 라이브러리 자체 Hosting 또는 무결성 검증
- CSP 변경 시 모든 주요 브라우저 smoke 재실행

운영 기능을 깨면서 한 번에 CSP를 강화하지 않습니다.

## 8. 운영 모니터링

최소 알림/관찰 항목:

- Cloud Functions 5xx와 timeout 증가
- scheduled cleanup function 실패
- Storage 사용량 및 egress 급증
- `pdf_temp/`, `preflight_temp/`, `pdf_results/`의 오래된 객체 잔존
- Firebase Auth/권한 401·403 급증
- GitHub production deployment 실패

## 최종 배포 승인 기준

아래 조건을 모두 만족한 커밋만 `main`으로 병합합니다.

- Repository quality gate 성공
- Modular app architecture 성공
- Firebase Rules emulator 성공
- Firebase PR preview 및 실제 사용자 경로 smoke 성공
- 운영 외부 설정 체크리스트에서 미완료 항목을 명확히 기록
- 치명적/높음 등급의 알려진 코드 오류 없음

`main` 병합 후 자동 운영 배포 결과와 production smoke 상태까지 확인하여 배포를 종료합니다.
