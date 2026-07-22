# Program Tool 운영 확장 메모

- 관리자 콘솔: 회원, 프로그램, 표지 템플릿, 구독 상태, 관리자 계정
- 프로그램 목록: Firestore `settings/programs.items`
- 권장 규모: 20개 이상 프로그램 등록 가능
- 구독 준비 필드: `plan`, `subscriptionStatus`, `expiresAt`
- 색상 입력: CMYK 입력값을 브라우저 미리보기용 RGB로 변환
- 실제 인쇄용 CMYK PDF는 ICC 프로파일 및 서버 변환 단계가 추가로 필요
