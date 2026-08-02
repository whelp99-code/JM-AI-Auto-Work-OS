# JM-AI Action Hub iOS TestFlight 인수 작업지시서

## 목적

Linux에서 완료한 소스·계약 검증을 macOS/Xcode/실제 iPhone/Apple 계정 환경에서 최종 운영 인수한다.

## 1. 준비

```text
Mac with Xcode
Apple Developer Program
App Store Connect access
Physical iPhone
HTTPS Server v0.8.0
unique Bundle IDs
App Group
optional APNs .p8
```

## 2. 소스

```bash
unzip jm-ai-action-hub-ios-v0.1.0.zip
cd jm-ai-action-hub-ios
cp Config/Local.xcconfig.example Config/Local.xcconfig
```

`Local.xcconfig`:

```xcconfig
DEVELOPMENT_TEAM = <TEAM_ID>
ACTION_HUB_BUNDLE_PREFIX = com.<org>.jmactionhub
ACTION_HUB_APP_GROUP = group.com.<org>.jmactionhub.shared
```

## 3. Apple Identifier

```text
com.<org>.jmactionhub.ios
com.<org>.jmactionhub.ios.share
com.<org>.jmactionhub.ios.widget
group.com.<org>.jmactionhub.shared
```

## 4. Preflight

```bash
bash scripts/testflight_preflight.sh
```

성공 결과:

```text
OpenAPI PASS
Static PASS
Core Tests PASS
Release Archive PASS
```

## 5. Server

```dotenv
ACTION_HUB_APP_ENV=production
ACTION_HUB_MOBILE_PUBLIC_BASE_URL=https://<host>
ACTION_HUB_MOBILE_ACCESS_TOKEN_SECRET=<secure separate secret>
```

```bash
action-hub check --json
action-hub mobile-pairing --base-url https://<host> --print-qr
```

## 6. P0 실기기 인수

- QR scan
- text capture
- offline share from KakaoTalk/Messages/Mail/Safari
- reconnect upload
- no duplicate
- plan edit
- conflict
- approve
- execute
- remote revoke
- Face ID/passcode

## 7. P1

- speech
- widget
- Siri/Shortcuts
- APNs all event types
- background/foreground sync
- dark mode/dynamic type/VoiceOver

## 8. TestFlight

- Archive Validate
- Upload to App Store Connect
- Internal group
- What to Test
- install on iPhone
- P0/P1 repeat
- crash/session/feedback review

## 9. GO

```text
P0 100% pass
no secret exposure
no data loss
no duplicate
no silent overwrite
remote revoke effective
release archive valid
```
