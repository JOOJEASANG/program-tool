# Program Tool 안전 배포 안내

## 1. 초기 관리자 확인

기존 Firestore `settings/admin` 문서에 관리자 이메일이 있으면 서버가 그대로 인식합니다.
새 Firebase 프로젝트이거나 관리자 문서가 없는 경우에는 다음 중 한 가지를 먼저 설정해야 합니다.

### 권장: Firebase Auth custom claim

Google Application Default Credentials 또는 서비스 계정이 설정된 환경에서 실행합니다.

```bash
python scripts/set_admin_claim.py admin@example.com
```

관리자 권한을 제거할 때는 다음과 같이 실행합니다.

```bash
python scripts/set_admin_claim.py admin@example.com --remove
```

Custom claim 변경 후 해당 사용자는 로그아웃 후 다시 로그인해야 새 토큰을 받습니다.

### 비상용: Functions 환경변수

`backend/.env` 파일을 로컬에 만들고 저장소에는 커밋하지 않습니다.

```dotenv
INITIAL_ADMIN_EMAILS=admin@example.com,second@example.com
FIREBASE_STORAGE_BUCKET=program-tool.firebasestorage.app
```

`INITIAL_ADMIN_EMAILS`는 최초 관리자 복구용으로만 사용하고, 운영이 안정되면 custom claim을 권장합니다.

## 2. 전체 구성 함께 배포

권한 판정은 Hosting, Functions, Firestore Rules가 함께 바뀌므로 일부만 배포하지 않습니다.

```bash
firebase deploy --only functions,firestore:rules,storage,hosting
```

배포 후 다음 항목을 확인합니다.

1. 일반 계정으로 비공개 PDF 편집기 접근이 차단되는지 확인
2. 관리자 계정에서 `/admin` 화면이 열리는지 확인
3. 프로그램 전체 공개 설정 변경이 반영되는지 확인
4. 회원별 프로그램 승인 후 해당 회원이 접근할 수 있는지 확인
5. PDF 검수·복구 후 `preflight_temp/` 파일이 남지 않는지 확인

## 3. 기존 임시파일 정리

기본 실행은 삭제하지 않고 대상만 출력합니다.

```bash
python scripts/cleanup_temp_storage.py --older-hours 24
```

확인 후 실제 삭제합니다.

```bash
python scripts/cleanup_temp_storage.py --older-hours 24 --execute
```

## 4. Storage 자동 만료 정책

서버 `finally` 삭제가 실패하거나 작업이 강제 종료되는 경우를 대비해 1일 자동 만료 정책도 적용하는 것을 권장합니다.

```bash
gcloud storage buckets update gs://program-tool.firebasestorage.app \
  --lifecycle-file=scripts/storage-lifecycle.json
```

정책은 `pdf_temp/`와 `preflight_temp/` 경로만 삭제하며, 사용자가 저장한 PDF 파일함과 편집 세션에는 적용하지 않습니다.

## 5. 배포 후 캐시 확인

새 버전 배포 후 화면 오른쪽 아래에 업데이트 안내가 나타납니다. 문제가 있는 브라우저에서는 개발자 도구에서 기존 서비스워커를 한 번 해제한 후 새로고침합니다. 정상 배포 이후에는 페이지 방문 때마다 캐시가 삭제되지 않습니다.

## 6. 롤백

PR 병합 전에는 Firebase 미리보기 채널에서 정적 화면을 확인합니다. 운영 배포 후 문제가 발생하면 GitHub에서 직전 정상 커밋으로 되돌린 뒤 Functions, Rules, Hosting을 함께 다시 배포합니다.
