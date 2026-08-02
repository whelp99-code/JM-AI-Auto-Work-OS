# JM-AI Action Hub Native iOS — 상세 검증 및 개발계획서

문서 버전: `1.0`  
기준일: `2026-07-31 (Asia/Seoul)`  
대상 릴리스: `Server v0.8.0 + iOS v0.1.0`  
서버 커밋: `b3d718167caed153d87df8dff36c7cc9d7606714`  
iOS 커밋: `9a9db667187adaaeea439a33a32e3a7d7845ee51`

---

## 1. 실행 요약

JM-AI Action Hub iOS는 Todoist, Calendar, GitHub를 다시 만드는 앱이 아니다. 서버 v0.7.0이 보유한 Action Control Loop를 iPhone에서 가장 빠르고 안전하게 호출하는 **Native Companion**이다.

고정 제품 정의는 다음과 같다.

> iPhone의 공유, 붙여넣기, 음성, 단축어로 업무를 수집하고, 서버가 구조화한 일정·Todo·GitHub 작업을 검토·승인하며, 사람·AI·외부 응답의 실제 완료 상태까지 확인하는 모바일 제어 허브

최종 구조:

```text
카카오톡·Mail·Safari·메시지·음성·클립보드
                      │
                      ▼
            Native iOS Capture Layer
       Share / Speech / App Intent / Direct
                      │
             App Group Offline Queue
                      │ HTTPS + Device Bearer
                      ▼
        Action Hub Server v0.8 Mobile Gateway
   Pairing / Scope / Refresh / Revision / Delta / APNs
                      │
                      ▼
          기존 v0.7 Closed-loop Runtime
 Todoist / Calendar / GitHub / AI Worker / Follow-up
```

## 2. 기존 제품·오픈소스 재사용 검증

### 2.1 개발하지 않는 기능

| 영역 | 재사용 대상 | iOS 앱의 역할 |
|---|---|---|
| 개인 할 일 원장 | Todoist | 후보 검토와 원장 앱 열기 |
| 실제 일정 원장 | Google/Outlook/Apple Calendar | 일정 후보 승인과 Deep Link |
| 개발 작업 원장 | GitHub Issues/Projects | Issue·PR·CI 상태 확인 |
| AI 코딩 실행 | Codex, Claude Code, Copilot, Orca, Hermes | Worker 요청과 상태 추적 |
| 회의 전사 | Fireflies | Action Item 검토 |
| 자연어 업무 파싱 | Action Hub Server | 입력과 결과 승인 |
| 푸시 전달 | APNs | 민감 원문 없는 이벤트 알림 |
| 음성 전사 | Apple Speech | 텍스트만 서버 전송 |
| 생체 인증 | LocalAuthentication | 민감 화면 잠금 |
| 앱·확장 데이터 공유 | App Groups | 최소 Offline Queue와 Widget Snapshot |

### 2.2 네이티브 앱 개발이 필요한 이유

기존 Todo·Calendar 앱은 다음 Action Hub 고유 상태를 처리하지 못한다.

- 하나의 메시지에서 추출된 여러 Action의 일괄 검토
- 승인과 실제 실행의 분리
- 사람, AI, Hybrid, 외부 응답 실행자의 구분
- AI Worker, Pull Request, CI, Merge 상태
- Waiting-for와 Follow-up
- 원문–Action–외부 원장–완료 증거의 추적
- 기기별 인증, 원격 해제, 감사 이력

따라서 네이티브 앱은 중복 제품이 아니라 기존 도구 위의 **Capture·Approval·Control Plane**이다.

## 3. Apple 플랫폼 기술 검증과 결정

| 요구 | 선택 | 판단 |
|---|---|---|
| UI | SwiftUI | iPhone 우선, Extension·Widget과 동일 언어 |
| 공유 수집 | Share Extension | 호스트 앱에서 Text/URL 수집 |
| 오프라인 전달 | App Group + 파일 Queue | 앱·Share·Intent 간 Process-safe 공유 |
| 인증정보 | Keychain | 다른 기기/백업 이동 제한 속성 사용 |
| QR | AVFoundation | 1회용 Pairing Payload 스캔 |
| 음성 | Speech + AVAudioSession | 원본 오디오 서버 미보관 |
| 빠른 실행 | App Intents | Shortcuts, Siri, Action Button 진입점 |
| 홈 화면 | WidgetKit | Today/Review/AI Count 조회와 앱 열기 |
| 백그라운드 | BGTaskScheduler | 기회형 Queue Flush, 즉시성 보장 수단 아님 |
| 푸시 | UserNotifications/APNs | 일반 Alert Push, Payload 최소화 |
| 화면 잠금 | LocalAuthentication | Face ID 또는 Device Passcode |
| API 계약 | OpenAPI Snapshot + Contract Check | v0.1 안정화 후 Generator 전환 가능 |

Apple 공식 문서 기준으로 App Groups는 App과 Extension의 공유 컨테이너를 제공하고, App Intents는 앱 기능을 Siri·Shortcuts·Widget 등 시스템 경험에 노출한다. BGTaskScheduler는 시스템이 실행 기회를 결정하므로 정확한 시각의 동기화를 보장하는 장치로 사용하지 않는다. APNs는 앱 설치별 Device Token을 서버에 등록하는 구조이며, LocalAuthentication은 생체정보를 앱이 직접 취급하지 않고 시스템 인증을 요청하는 방식이다.

## 4. 제품 범위

### 4.1 iOS v0.1.0 포함

- QR Pairing과 Server Capability 확인
- 기기별 Access/Refresh Token
- Today, Review, Activity, Settings
- 직접 입력, 명시적 Clipboard, 한국어 Speech
- Share Extension Text/URL 수집
- Offline Capture Queue
- Action 수정·제외·승인·실행
- Revision 409 충돌 처리
- APNs 등록·Deep Link
- App Intents와 Today Widget
- Face ID/Device Authentication 잠금
- Foreground Sync와 BGAppRefresh

### 4.2 제외

- 자체 Todo/Calendar/Kanban
- 이미지 OCR, PDF 본문 추출
- Live Activity
- Apple Watch
- Apple Intelligence 온디바이스 분류
- 자동 PR Merge·운영 배포
- Silent Push 기반 지속 실행
- 다중 Tenant/RBAC

## 5. 서버 v0.8.0 상세 설계

### 5.1 Pairing

```text
관리자 인증
→ 5분 만료 Pairing Session 생성
→ QR에는 server_url, pairing_id, 1회용 code
→ 앱이 Capability와 최소 버전 확인
→ Device 정보와 Claim
→ Access/Refresh Token 발급
→ Session 원자적 consumed 처리
```

보안 기준:

- Pairing Code 원문 DB 저장 금지
- 최대 실패 횟수
- 1회 Claim
- Production에서 Request Host로 QR URL 유추 금지
- 명시적 공개 HTTPS URL 또는 서버 구성값 필수

### 5.2 모바일 토큰

```text
Access Token       단기, HMAC 서명, device/scope 포함
Refresh Token      Random Secret, DB에는 Hash만 저장
Rotation           사용할 때마다 새 Token 발급
Lost-response      짧은 유예기간 안의 동일 요청은 같은 후속 Token 반환
Reuse Detection    유예기간 밖 이전 Token 재사용 시 Family와 Device 폐기
```

### 5.3 Offline Capture

- `client_capture_id`로 기기별 Idempotency
- 같은 ID·다른 Content Hash는 Conflict
- Capture별 처리 상태와 Lock 시각
- 서버 중단 후 Stale Lock 재회수
- 처리 성공 시 Plan ID 반환
- Batch Size 제한

### 5.4 Revision·Delta

- Plan과 Action Item에 Optimistic `revision`
- 이전 revision으로 수정 시 HTTP 409
- Delta Cursor는 서버 HMAC-SHA256 서명 불투명 값
- Cursor 변조 시 HTTP 400
- 앱은 페이지 반복과 최대 페이지 제한

### 5.5 APNs

- Device Token은 앱 설치별 저장
- Push Outbox와 재시도
- ES256 Provider Token과 HTTP/2 Adapter
- Push에는 Event Type과 Entity ID만 포함
- 원문, 작업 제목, 고객명, 회의 내용은 포함하지 않음
- v0.1은 Alert Push이며 Silent `content-available` 미사용

## 6. iOS 앱 아키텍처

```text
JM-AI-Action-Hub-iOS.xcodeproj
├── ActionHubApp
│   ├── App / Root / AppModel
│   ├── Today
│   ├── Review / Plan Detail / Item Editor
│   ├── Activity
│   ├── Capture
│   ├── Pairing
│   ├── Settings
│   └── Infrastructure
│       ├── QR Scanner
│       ├── Speech
│       ├── Keychain
│       ├── Biometric Lock
│       ├── Notification
│       ├── Background Sync
│       └── App Group Store
├── ActionHubShareExtension
├── ActionHubWidgetExtension
└── Packages/ActionHubCore
    ├── Typed Models/API Client
    ├── MobileSession
    ├── OfflineCaptureQueue
    ├── PairingPayload
    ├── SemanticVersion
    └── Tests + Live Smoke
```

로컬 저장은 원장이 아니다.

```text
Keychain
└── Server URL, Device ID, Access/Refresh Token, Expiry

App Group
├── captures/<uuid>.json
├── widget/dashboard.json
└── sync/cursor.txt
```

## 7. 위협 모델

| 위협 | 대응 |
|---|---|
| 앱에 관리자 키 포함 | 모바일 API는 Bearer만 사용, 정적 검사 |
| Pairing QR 재사용 | 만료, 1회 Claim, 원자적 상태 전이 |
| 악성 Host Header | Production Public URL 명시 강제 |
| Refresh Token 탈취·재사용 | Hash 저장, Rotation, Reuse Detection |
| 네트워크 오류 후 로컬 세션 잔존 | Disconnect에서 Local Keychain 항상 삭제 |
| 외부 앱의 Custom URL 강제 Pairing | 화면 채움 후 사용자 확인 필수 |
| 중복 Share 업로드 | UUID Idempotency와 Content Hash |
| Share/Main App 동시 Queue 쓰기 | Capture별 Atomic File |
| 서버 처리 중단 후 영구 대기 | Stale Capture Lock Recovery |
| 오래된 화면의 덮어쓰기 | Revision 409 |
| Cursor 조작 | HMAC 서명과 400 거부 |
| 잠금화면 정보 노출 | Widget `privacySensitive`, 상세 실행 금지 |
| Push 원문 노출 | Generic Event Payload |
| 백그라운드 실행 과신 | BGTask는 보조, Foreground/APNs를 주 경로로 사용 |

## 8. 순차 개발 계획과 완료 기준

### Phase S1 — Mobile Foundation

- Schema와 `0004_mobile_foundation`
- Pairing, Device, Scope
- Access/Refresh Token
- Revoke

완료 기준: Pairing 1회성, 최소 버전 검증, 폐기 Token 401.

### Phase S2 — Mobile Data Plane

- Dashboard/Review/Activity
- Capture Batch
- Revision
- Signed Delta Cursor

완료 기준: Offline 재전송 무중복, stale revision 409, Cursor 변조 400.

### Phase S3 — Push

- APNs Token
- Push Outbox
- Retry와 개인정보 최소 Payload

완료 기준: Dry-run Outbox 처리와 Live 인수 절차 분리.

### Phase I1 — Swift Core

- URL 정책, API Client, Session, Queue, Pairing

완료 기준: Linux/macOS에서 독립 Build/Test, 실제 서버 계약 Smoke.

### Phase I2 — Native App

- Today/Review/Activity/Capture/Settings
- QR/Speech/Clipboard/Biometric

완료 기준: App Source 정적검증, Xcode 인수 시 전체 Build.

### Phase I3 — Extensions

- Share, Widget, App Intents, BG Refresh

완료 기준: App Group 일치, Queue 무손실, 민감 정보 노출 금지.

### Phase I4 — Apple 운영 인수

- Xcode Build/Archive
- Simulator
- 실제 iPhone
- APNs Sandbox/Production
- TestFlight

완료 기준은 별도 인수 문서에 정의한다.

## 9. 품질 게이트

| Gate | 기준 |
|---|---|
| Server Unit/Integration | 78 tests, warning 0 |
| Server Coverage | 80% 이상, 실제 81.27% |
| OpenAPI | v0.8.0, 56 operations, 양 저장소 SHA 일치 |
| Migration | v0.7 데이터 ID·제목·개수 보존 |
| Swift Core | 30 XCTest + 1 Swift Testing |
| Swift Syntax | 42 app/core source·test files parse |
| Formatting | swift-format strict |
| 배포 무결성 | ZIP CRC, 내부 Manifest, 빌드 부산물 차단, 독립 ZIP↔Suite SHA 동일성 |
| Static Xcode Project | Source, Resource, Plist, Entitlement, Privacy 검사 |
| Live Contract | Swift Pairing→Capture→Edit→Approve→Execute→Sync |
| Security | 409, 400 cursor tamper, 401 revoked token |
| Apple Binary | macOS Xcode/실기기/TestFlight에서 별도 확정 |

## 10. 향후 기능 도입 기준

| 기능 | 도입 조건 |
|---|---|
| OCR/PDF | 이미지·문서에서 Action 생성이 주 5회 이상 |
| Live Activity | 10분 이상 AI 실행 확인이 반복 |
| Apple Watch | iPhone을 꺼내지 못해 Capture 누락 발생 |
| Offline Review/Edit | 네트워크 단절 중 검토 요구가 반복 |
| App Attest | 외부 사용자·다중 Tenant 도입 |
| Universal Links | 외부 배포 후 Custom Scheme 위조 위험 증가 |
| Swift OpenAPI Generator | API 변경 빈도 또는 Model Drift 비용 증가 |
| Silent Push | Background 즉시 동기화가 실제 필수 요건이 됨 |

## 11. 최종 판정

- 서버 v0.8.0: 구현 및 실제 런타임 검증 완료
- iOS v0.1.0: 소스, Swift Core, 계약, 정적 보안 검증 완료
- App Store/TestFlight 배포 완료 여부: **아님**
- 남은 작업: Apple SDK·Signing·실기기·APNs Live·TestFlight 운영 인수

즉, 제품 개발은 Apple 환경 밖에서 가능한 범위까지 완료됐고, 다음 단계는 기능 개발이 아니라 **macOS/Xcode와 실제 iPhone에서의 Binary Acceptance**다.

## 12. 공식 근거 문서

- Apple Developer Documentation — Configuring app groups
- Apple Developer Documentation — App Intents
- Apple Developer Documentation — WidgetKit
- Apple Developer Documentation — User Notifications / APNs registration
- Apple Developer Documentation — BGTaskScheduler
- Apple Developer Documentation — Local Authentication
- Apple Developer Documentation — Recognizing speech in live audio
- Apple Open Source — Swift OpenAPI Generator


## 13. 최종 적대적 검증 보강

초기 완료본을 다시 코드 대조한 결과, 문서는 QR 스캔 후 사용자 확인을 요구한다고 명시했지만 실제 스캐너 콜백은 즉시 Claim을 수행하고 있었다. 최종 릴리스에서는 다음과 같이 수정했다.

```text
QR/Custom URL 수신
→ Payload 형식·버전·서버 HTTPS·코드 검증
→ 연결 서버 주소와 Pairing ID 표시
→ 사용자 `확인한 서버에 연결` 선택
→ 네트워크 Claim
```

추가 보강:

- 앱 등록 Scheme과 서버 발급 URI를 프로젝트 전용 `jmactionhub://`로 변경
- legacy `actionhub://`는 수동 붙여넣기 파서 호환만 유지
- 중복 Query Item, 알 수 없는 Query Item, 잘못된 Host/Type/Version/Code를 명시적으로 거부
- Swift Dictionary 중복 키 Precondition Failure 경로 제거
- 서버가 발급한 `jmactionhub://pair`를 실제 Swift Client가 파싱하고 FastAPI에 연결하는 E2E 재검증
