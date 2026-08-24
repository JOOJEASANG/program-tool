# 관리자 권한·배포 인증 전환 절차

이 문서는 기존 운영을 중단하지 않고 관리자 권한을 Firebase custom claim으로, GitHub Actions 배포 인증을 Workload Identity Federation(WIF)으로 전환하기 위한 체크리스트입니다.

## 1. 관리자 custom claim 전환

현재 `settings/admin` 이메일 목록은 마이그레이션 기준 목록입니다. 최종 목표는 모든 운영 관리자가 Firebase Authentication ID token의 `admin: true` custom claim으로만 권한을 얻는 것입니다.

운영 자격증명(Application Default Credentials)을 사용할 수 있는 환경에서 `backend` 디렉터리 기준으로 실행합니다.

```bash
python -m scripts.sync_admin_claims
python -m scripts.sync_admin_claims --apply
python -m scripts.sync_admin_claims --verify
```

- 첫 번째 명령은 변경 예정 내역만 표시합니다.
- `--apply`는 `settings/admin`에 등록된 Firebase Auth 사용자에게 `admin: true`를 적용합니다.
- `--verify`는 등록된 모든 관리자 계정이 실제로 `admin: true`인지 검사합니다. 한 계정이라도 누락되거나 Auth 사용자가 없으면 0이 아닌 종료 코드로 실패합니다.
- claim이 변경된 사용자는 로그아웃·로그인 또는 ID token 갱신 후 새 권한을 사용합니다.

`--verify`가 성공하기 전에는 Firestore Rules, Storage Rules, 브라우저 권한 코드의 legacy 이메일 fallback을 제거하지 않습니다.

필요한 경우 stale `admin: true` claim을 제거하기 전에 반드시 dry-run 결과를 검토합니다.

```bash
python -m scripts.sync_admin_claims --revoke-missing
python -m scripts.sync_admin_claims --apply --revoke-missing
python -m scripts.sync_admin_claims --verify
```

## 2. GitHub Actions WIF 전환

워크플로는 다음 두 GitHub Actions secret이 모두 존재하면 WIF를 사용합니다.

- `GCP_WORKLOAD_IDENTITY_PROVIDER`: Google Cloud Workload Identity Provider 전체 리소스 이름
- `GCP_SERVICE_ACCOUNT`: Firebase 배포용 Google Cloud 서비스 계정 이메일

WIF 인증이 성공하면 `google-github-actions/auth`가 생성한 Application Default Credentials를 `scripts/firebase_ci.sh`가 우선 사용하며, `FIREBASE_TOKEN`은 해당 명령에서 제거됩니다.

두 WIF secret이 아직 없으면 기존 `FIREBASE_TOKEN`으로 자동 fallback하므로 현재 운영 배포와 PR 미리보기는 계속 동작합니다.

## 3. WIF 실제 전환 완료 기준

다음 조건을 모두 확인한 뒤에만 GitHub의 `FIREBASE_TOKEN` secret을 삭제합니다.

1. `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`를 production과 PR workflow에서 사용할 수 있게 설정
2. PR 미리보기에서 `Google Cloud WIF 인증` 단계가 실행되고 Firebase Hosting preview 성공
3. `main` 배포에서 `Google Cloud WIF 인증` 단계가 실행되고 Hosting + Functions + Firestore/Storage Rules 배포 성공
4. `production-smoke` 상태가 success
5. 배포 로그에 `Using legacy FIREBASE_TOKEN fallback` 경고가 없음

WIF 권한은 Firebase 전체 배포에 필요한 최소 Google Cloud IAM 역할만 부여하고 정기적으로 검토합니다.

## 4. legacy 관리자 이메일 fallback 제거 기준

다음 조건을 모두 충족한 별도 변경에서만 제거합니다.

1. `python -m scripts.sync_admin_claims --verify` 성공
2. 실제 관리자 계정으로 관리자 화면 진입 확인
3. 관리자 계정의 새 ID token에 `admin: true` 확인
4. Firestore/Storage Rules 에뮬레이터에서 claim 기반 관리자 허용 및 일반 사용자 거부 확인
5. 브라우저 `ProgramAccess.isAdmin()`에서도 claim 기반 권한 확인

그 후 `firestore.rules`, `storage.rules`, `js/firebase-config.js`의 legacy 이메일 fallback을 동시에 제거하고 전체 품질 게이트와 운영 smoke를 다시 통과시킵니다.
