# JM-AI Action Hub Mobile Suite — 단계별 개발 완료 보고서

기준일: `2026-07-31`  
서버: `v0.8.0` / `b3d718167caed153d87df8dff36c7cc9d7606714`  
iOS: `v0.1.0` / `9a9db667187adaaeea439a33a32e3a7d7845ee51`

## 1. 최종 결과

```text
JM-AI Action Hub Server v0.8.0
+ JM-AI Action Hub iOS v0.1.0
+ PWA fallback
= Mobile Capture / Approval / Control Suite
```

## 2. 개발 완료 현황

| 단계 | 주요 구현 | 결과 |
|---|---|---|
| 1. 기준선 재검증 | v0.7.0 API, DB, 보안 경계 | 완료 |
| 2. 서버 Schema | Mobile Device/Pairing/Refresh/Capture/Push, Revision | 완료 |
| 3. 모바일 인증 | QR, Scope, Access, Rotation, Reuse Detection, Revoke | 완료 |
| 4. Offline/Sync | Batch Idempotency, Stale Lock, Dashboard, Activity, Signed Delta | 완료 |
| 5. APNs 기반 | Token, Outbox, Retry, Generic Payload | 완료 |
| 6. Swift Core | API, Session, Keychain contract, Queue, Pairing, Version | 완료 |
| 7. SwiftUI 앱 | Today, Review, Plan Edit, Activity, Capture, Settings | 소스 완료 |
| 8. iOS Extensions | Share, Widget, App Intents, Background Refresh | 소스 완료 |
| 9. 보안 강화 | HTTPS, URL 확인, Keychain 삭제, Widget Privacy | 완료 |
| 10. 자동 검증 | Python/Swift/OpenAPI/Migration/E2E | 완료 |
| 11. Apple Binary | Xcode Signing, Simulator, 실제 iPhone, TestFlight | 인수 대기 |

## 3. 상세 검증 중 실제로 발견해 수정한 문제

### 3.1 기기 해제 실패 시 로컬 인증정보 잔존

이전 흐름은 서버 Revoke 요청이 네트워크 오류로 실패하면 Keychain 세션이 남을 수 있었다.

수정:

```text
Remote Revoke 시도
→ 성공/실패와 무관하게 Local Credential 삭제
→ 서버 잔여 기기는 관리자 화면에서 별도 폐기
```

회귀 테스트: `testDisconnectAlwaysDeletesLocalCredentialsWhenServerRevokeFails`.

### 3.2 외부 Custom URL의 자동 Pairing

다른 앱이나 웹페이지가 Custom Scheme을 열었을 때 사용자 확인 없이 Claim할 수 있는 UX 경로를 차단했다.

수정:

```text
QR Scanner: 페어링 정보를 화면에 채우고 서버 주소를 표시
External URL: Pairing 화면에 값만 채움
공통: 사용자가 `확인한 서버에 연결`을 눌러야 Claim 전송
```

### 3.3 Offline Capture 영구 Processing

서버가 Capture를 선점한 직후 중단되면 `processing`에 영구 잔류할 수 있었다.

수정:

- `locked_at` 추가
- Timeout 이후 재선점
- Fresh Lock은 보호
- Stale Lock만 회수

### 3.4 Delta Cursor 변조

Base64 Cursor만으로는 사용자가 임의 Timestamp/ID를 만들 수 있었다.

수정:

- HMAC-SHA256 서명
- 정상 Cursor 페이지 이동
- 변조 Cursor HTTP 400

### 3.5 Production QR Host Header Injection

Production Pairing URL이 Request Host를 신뢰하면 프록시 설정 오류나 조작된 Host가 QR에 들어갈 수 있었다.

수정:

- 명시적 `public_base_url` 또는 서버 구성값만 허용
- 둘 다 없으면 실패
- Development loopback만 편의 fallback

### 3.6 iOS 권한·Privacy Hardening

- Camera authorization 상태 분리
- Speech AudioSession과 Tap 모든 종료 경로 정리
- Widget 상세 제목·카운트 Privacy Sensitive
- Silent Push 미구현 상태에서 `remote-notification` Background Mode 제거

### 3.7 Wheel 빌드 산출물의 Suite 오염

초기 패키징 검증에서 Wheel 생성 과정의 `build/`와 `*.egg-info/`가 통합 Suite의 Server 디렉터리에 섞여, 독립 Server ZIP과 바이트 동일성이 깨지는 문제가 발견됐다.

수정:

- Wheel은 별도 임시 Source Copy에서 생성
- 배포 Source Tree에 빌드 부산물 유입 금지
- ZIP 내 `.git`, `.build`, `build/`, `egg-info`, `__pycache__`, `.env` 차단
- 독립 Server/iOS ZIP과 Suite 내 사본의 파일별 SHA-256 동일성 검사

## 4. 구현된 주요 사용자 흐름

### 공유 입력

```text
카카오톡/Mail/Safari/Notes
→ Share Extension
→ App Group Queue
→ 네트워크 복구
→ Batch Upload
→ Plan 생성
→ Review Push/Badge
```

### 직접·음성 입력

```text
텍스트/Clipboard/Speech
→ Offline Queue
→ 서버 Parser
→ 일정/Todo/GitHub 후보
→ 수정·제외·승인
→ 실행
```

### AI 실행 확인

```text
GitHub Issue
→ 기존 AI Worker Workflow
→ PR/CI 상태
→ iOS Activity
→ Human Review
→ Merge 증거
→ 완료
```

### 기기 보안

```text
관리자 QR 발급
→ iPhone Claim
→ Keychain Session
→ Token Rotation
→ 원격 Revoke
→ Access/Refresh 401
```

## 5. 검증 결과

```text
Server tests                         78 passed
Server statement coverage            81.27%
OpenAPI                              56 operations, v0.8.0
OpenAPI SHA-256                      ac795ac1fdc685cebd0cff041c50773d5156187e8912f838cd313ed65b4a96d8
Swift XCTest                         30 passed
Swift Testing                        1 passed
Swift source parse                   42 files
Swift release build                  passed
swift-format strict                  passed
Static Project/Privacy/Entitlement   passed
Migration v0.7 → v0.8               data preserved
Python live mobile E2E               passed
Swift → FastAPI E2E                  passed
Cursor tamper                        HTTP 400
Stale revision                       HTTP 409
Revoked Access/Refresh               HTTP 401 / 401
```

## 6. 정확한 완료 경계

### 완료

- 서버 실제 실행 가능한 코드
- Alembic 업그레이드
- 모바일 인증·동기화·Push Outbox
- Swift Core와 자동 테스트
- SwiftUI/Share/Widget/App Intents 소스
- 실제 Swift Client ↔ FastAPI 계약
- 배포·인수 문서

### 운영 인수 필요

- Xcode 전체 Target Build
- Apple Developer Signing
- App Group/Push Provisioning
- 실제 iPhone 카메라·음성·Face ID
- 카카오톡/Mail/Safari Share Sheet
- Siri/Shortcuts/Widget 시스템 등록
- APNs Sandbox/Production
- TestFlight 설치

## 7. 최종 판정

> **서버 v0.8.0과 네이티브 iOS v0.1.0의 소스 개발 및 비-Apple SDK 검증 완료.**

> **Signed IPA와 TestFlight 배포는 Xcode·Apple 계정·실제 iPhone이 필요한 운영 인수 항목이며 아직 완료로 표시하지 않는다.**
