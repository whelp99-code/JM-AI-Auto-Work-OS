# JM-AI Action Hub iOS — Xcode·실기기·TestFlight 인수 절차

기준 대상: `Server v0.8.0 + iOS v0.1.0`

## 1. 사전 조건

- 호환되는 macOS와 Xcode
- Apple Developer Program 계정
- App Store Connect 권한
- 실제 iPhone(iOS 18 이상)
- 공개 HTTPS Action Hub Server v0.8.0
- 고유 Bundle Prefix와 App Group
- APNs Provider Key(`.p8`) — Push Live 검증 시

## 2. 프로젝트 설정

```bash
unzip jm-ai-action-hub-ios-v0.1.0.zip
cd jm-ai-action-hub-ios
cp Config/Local.xcconfig.example Config/Local.xcconfig
```

`Config/Local.xcconfig`:

```xcconfig
DEVELOPMENT_TEAM = <APPLE_TEAM_ID>
ACTION_HUB_BUNDLE_PREFIX = com.<organization>.jmactionhub
ACTION_HUB_APP_GROUP = group.com.<organization>.jmactionhub.shared
```

필요 Identifier:

```text
com.<organization>.jmactionhub.ios
com.<organization>.jmactionhub.ios.share
com.<organization>.jmactionhub.ios.widget
group.com.<organization>.jmactionhub.shared
```

Capability:

```text
Main App    App Groups, Push Notifications, Background Fetch
Share       App Groups
Widget      App Groups
```

> v0.1은 일반 Alert Push 구조다. Silent `content-available` 처리를 구현하기 전에는 `Remote notifications` Background Mode를 추가하지 않는다.

## 3. Preflight

```bash
bash scripts/testflight_preflight.sh
```

수동 확인:

```bash
python3 scripts/generate_xcodeproj.py --check
python3 scripts/verify_openapi_contract.py
python3 scripts/validate_ios_project.py
(cd Packages/ActionHubCore && swift test)
xcodebuild -project JM-AI-Action-Hub-iOS.xcodeproj -scheme ActionHubApp -showdestinations
```

## 4. Simulator Build

`-showdestinations`에 표시된 실제 Simulator를 선택한다.

```bash
xcodebuild   -project JM-AI-Action-Hub-iOS.xcodeproj   -scheme ActionHubApp   -configuration Debug   -destination 'platform=iOS Simulator,name=<AVAILABLE_DEVICE>'   clean build
```

Simulator P0:

- Pairing Payload 붙여넣기
- 직접 Capture
- Review/Edit/Approve/Execute
- Today/Activity
- Revision Conflict
- Dark Mode, Dynamic Type, VoiceOver 기본 탐색

## 5. Release Archive

```bash
xcodebuild   -project JM-AI-Action-Hub-iOS.xcodeproj   -scheme ActionHubApp   -configuration Release   -destination 'generic/platform=iOS'   -archivePath build/ActionHubApp.xcarchive   clean archive
```

확인:

- Main App에 Share/Widget Extension Embed
- Main/Share/Widget App Group Entitlement 동일
- Main App Push Entitlement Sandbox/Production 일치
- Privacy Manifest 포함
- `X-Action-Hub-Key`, Provider Token, 개발 Server URL 미포함

## 6. 서버 Production 준비

```dotenv
ACTION_HUB_APP_ENV=production
ACTION_HUB_MOBILE_ENABLED=true
ACTION_HUB_MOBILE_PUBLIC_BASE_URL=https://hub.example.com
ACTION_HUB_MOBILE_ACCESS_TOKEN_SECRET=<32자 이상 별도 비밀키>
ACTION_HUB_API_KEY=<관리자 비밀키>
```

확인:

- HTTPS 인증서
- Reverse Proxy의 Host/Forwarded Header 정책
- Database Backup
- `0004_mobile_foundation` 적용
- API와 Worker 기동
- Pairing QR 생성

## 7. 실제 iPhone P0 시나리오

### 7.1 Pairing

1. 서버에서 5분 Pairing QR 생성
2. 앱에서 카메라 권한 허용
3. QR 스캔
4. Server Version 0.8.0 확인
5. Device 목록 Active 확인
6. QR 재사용과 만료가 거부되는지 확인

### 7.2 Share 무손실

각 Host App에서 Text/URL 공유:

- 카카오톡
- 메시지
- Mail
- Safari
- Notes

검증:

```text
네트워크 OFF → Share 저장 성공
Main App Pending Count 증가
네트워크 ON → Batch Upload
동일 Capture 중복 Plan 없음
```

### 7.3 Review·Conflict

- Action Item 수정
- 다른 Client에서 같은 Item 수정
- iOS 이전 revision 저장
- HTTP 409와 최신 데이터 표시
- 다시 수정·승인·실행

### 7.4 Speech

- 권한 거부와 Settings 안내
- 권한 허용
- 한국어 다중 Action 전사
- 취소/화면 닫기에서 녹음 정지
- 서버에는 Text만 도착

### 7.5 Security

- Face ID/Passcode 잠금
- 외부 `jmactionhub://pair`가 자동 연결하지 않는지 확인
- 서버에서 Device Revoke
- 앱의 다음 동기화가 401 후 Disconnected 처리
- Remote HTTP URL 거부

### 7.6 Widget·App Intents

- Small/Medium Widget
- 잠금화면 Privacy
- 빠른 입력 Deep Link
- Shortcuts Text 입력
- Siri Phrase
- App Group Queue 반영

### 7.7 APNs

- Sandbox Token 등록
- Review, AI status, Follow-up, Connector failure 알림
- Foreground/Background/Terminated 상태 수신
- 알림에 원문·작업 제목·고객명 없음
- Tap 후 해당 화면 이동
- 앱 재설치/Token 변경 재등록

## 8. TestFlight

1. Organizer에서 Validate App
2. App Store Connect Upload
3. Export Compliance와 Privacy 답변
4. Internal Testing Group
5. `What to Test`에 P0 시나리오 기재
6. TestFlight 설치
7. Pairing부터 APNs까지 반복
8. Crash/Console/Server Audit 확인

## 9. 승인 기준

### GO

- 전체 Target Release Archive 성공
- Share Offline 무손실·무중복
- Pairing 만료·재사용·Revoke 정상
- Revision Conflict 정상
- Push Payload 개인정보 최소화
- Face ID, Speech, QR, Widget, Intents 정상
- TestFlight 설치 후 P0 Crash 없음

### NO-GO

- 관리자 키 또는 Provider Token 앱 포함
- Remote HTTP 허용
- Share 데이터 유실
- 동일 입력 중복 Action
- Silent Revision Overwrite
- Push 원문 노출
- Device Revoke 후 계속 접근
- Extension Signing/Embedding 실패

## 10. 인수 완료 후 버전 판정

```text
현재: iOS v0.1.0 Source RC
Xcode/실기기/TestFlight P0 통과 후: iOS v0.1.0 Internal Release
외부 사용자 확대 전: 보안·개인정보·운영 정책 재검토
```
