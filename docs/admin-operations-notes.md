# 관리자 운영 메모

- 프로그램 목록: Firestore `settings/programs.items`
- 사용자 승인: `user_permissions/{uid}`의 `status == "approved"`
- 구독 준비 필드: `plan`, `subscriptionStatus`, `expiresAt`
- 관리자 판정: Firebase custom claim `admin: true` 우선
- 이메일 목록 기반 관리자 판정: 이전 데이터와의 호환 전용
- 표지 템플릿: 관리자가 생성·수정·삭제하고 승인 사용자는 공개 템플릿만 조회

표지 제작의 CMYK 입력값은 미리보기용 RGB로 환산됩니다. 실제 인쇄용 CMYK 납품에는 ICC 프로파일과 별도 서버 변환이 필요합니다.
