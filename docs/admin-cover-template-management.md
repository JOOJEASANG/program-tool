# 관리자 표지 템플릿 관리

## 목적

책표지 제작기에 제공하는 이미지 템플릿의 등록·수정·삭제를 책표지 편집 화면이 아니라 관리자 콘솔에서 처리합니다.

## 관리자 페이지

관리자 사이드 메뉴에 `표지 템플릿` 메뉴가 추가됩니다.

지원 기능:

- 템플릿 이름
- 분류
- 회원 공개 / 관리자 전용
- 앞표지 이미지 업로드 또는 교체
- 뒤표지 이미지 업로드 또는 교체
- 기존 템플릿 검색 및 공개 상태 필터
- 템플릿 삭제
- 이미지 미리보기

이미지는 한 장당 15MB 이하 JPG, PNG, WEBP만 허용합니다.

## 저장 구조

Firestore `cover_templates` 문서를 기존 스키마 그대로 사용합니다.

- `name`
- `category`
- `isPublic`
- `frontUrl`, `backUrl`
- `frontPath`, `backPath`
- `createdBy`, `createdByEmail`
- `createdAt`, `updatedAt`

원본 이미지는 Firebase Storage `cover_templates/{templateId}/` 아래에 저장합니다.

## 오류 방지

- 업로드 전 MIME 형식과 15MB 크기 제한 확인
- Firestore 저장 실패 시 해당 작업에서 새로 업로드한 Storage 파일 롤백
- 이미지 교체는 Firestore 반영 후 이전 Storage 파일 정리
- 삭제는 Storage 원본 정리를 확인한 뒤 Firestore 문서 삭제
- Storage 파일이 이미 없는 경우 정상 정리로 처리
- 관리자 권한을 다시 확인한 뒤 관리 UI 설치

## 책표지 제작기

사용자 화면에는 관리자 제공 이미지의 목록, 새로고침, 적용 기능을 유지합니다.

관리자 계정으로 책표지 제작기를 열더라도 등록·수정·삭제 영역은 숨기고 다음 안내를 표시합니다.

`제공 이미지 등록·수정·삭제는 관리자 페이지의 “표지 템플릿” 메뉴에서 관리합니다.`
