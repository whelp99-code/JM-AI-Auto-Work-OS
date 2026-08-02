# JM-AI Action Hub Mobile Suite 최종 릴리스 검증 보고서

- 기준일: 2026-07-31 (Asia/Seoul)
- Server: `0.8.0`
- iOS Companion: `0.1.0`
- Server commit: `b3d718167caed153d87df8dff36c7cc9d7606714`
- iOS commit: `9a9db667187adaaeea439a33a32e3a7d7845ee51`
- OpenAPI: 56 operations
- OpenAPI SHA-256: `ac795ac1fdc685cebd0cff041c50773d5156187e8912f838cd313ed65b4a96d8`

## 1. 최종 판정

| 대상 | 판정 |
|---|---|
| Server v0.8.0 소스 릴리스 | **GO** |
| Python Wheel | **GO** |
| iOS v0.1.0 소스 Release Candidate | **GO — macOS/Apple 인수 단계로 진행 가능** |
| 기존 v0.7.0 DB 업그레이드 | **GO** |
| FastAPI–Swift 실제 HTTP 계약 | **GO** |
| Apple 서명·Archive·TestFlight·실기기 | **미실행 — Apple 환경 인수 필요** |
| App Store 배포 완료 | **아님** |

정확한 결론은 다음과 같다.

> 서버와 iOS 앱 소스, 모바일 인증, 오프라인 수집, 검토·승인·실행, 변경분 동기화, APNs Outbox, 마이그레이션, Swift Core 및 실제 HTTP 종단 간 연결은 개발·검증 완료했다. 다만 Linux 환경에서는 Apple iOS SDK Link, Code Signing, App Store Connect, 실제 iPhone 하드웨어 및 APNs Live를 수행할 수 없으므로, iOS 앱은 TestFlight 인수 직전의 Source Release Candidate다.

## 2. 최종 배포 파일과 SHA-256

최종 패키징 직후 생성되는 외부 `SHA256SUMS-jm-ai-action-hub-mobile-suite.txt`를 기준으로 검증한다. 이 보고서 안에는 자체 참조로 인해 패키지 해시가 바뀌는 문제를 피하기 위해 숫자 해시를 고정하지 않는다.

검증 대상:

```text
jm-ai-action-hub-server-v0.8.0.zip
jm-ai-action-hub-ios-v0.1.0.zip
jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0.zip
jm_ai_action_hub-0.8.0-py3-none-any.whl
action-hub.openapi-v0.8.0.json
```

외부 `SHA256SUMS`와 각 압축본 내부 `RELEASE_MANIFEST.sha256`를 모두 검증한다. 통합 Suite에 포함된 Server/iOS 디렉터리는 독립 ZIP의 소스와 바이트 단위로 동일해야 한다.

## 3. 서버 자동 검증

```text
78 passed
statement coverage 81.27%
warnings treated as errors
coverage gate 80% PASS
Python compileall PASS
OpenAPI drift check PASS
JavaScript syntax PASS
```

중요 시나리오:

- 1회용 QR Pairing
- 기기별 Scope
- 짧은 Access Token
- 회전형 Refresh Token
- 정상 네트워크 재시도 유예
- 유예 이후 Token 재사용 시 기기 폐기
- 원격 기기 Revoke
- Offline Capture Idempotency
- 동시 Capture 보호
- Revision Conflict `409`
- HMAC 서명 Delta Cursor와 변조 거부
- APNs Push Outbox·Retry·Stale Lock
- 민감정보 없는 Push Payload
- Todoist/GitHub/Calendar/Worker 기존 Closed-loop 회귀

## 4. Swift·iOS 소스 검증

```text
30 XCTest passed
1 Swift Testing smoke passed
42 Swift files parsed with Swift 6.2.1
swift-format strict PASS
Xcode project deterministic check PASS
OpenAPI contract PASS
Plist PASS
Entitlement PASS
Privacy Manifest PASS
```

검증한 핵심:

- 원격 `http://` 거부, loopback 개발만 허용
- Pairing 전 Capability·최소 앱 버전 확인
- Bearer Token과 401 Refresh/Retry
- Keychain Session 추상화
- Dynamic URL Segment Encoding
- Revision Conflict 매핑
- Process-safe App Group Offline Queue
- 기존 Array Queue 무손실 Migration
- Share Extension Text/URL 범위
- APNs Token 앱 실행 시 재등록 경로
- 관리자 API Key·Provider Token 앱 미포함

## 5. v0.7.0 → v0.8.0 마이그레이션

실제 v0.7.0 패키지로 SQLite DB와 Plan·Action을 생성한 후, 최종 v0.8.0 ZIP의 Alembic Migration을 적용했다.

```text
before: 0003_operational_hardening
after : 0004_mobile_foundation
plans : 1 → 1
items : 2 → 2
revision: 1
```

보존 확인:

- Plan ID
- Action Item ID
- 제목
- 기존 상태와 데이터

추가 확인:

```text
mobile_devices
mobile_pairing_sessions
mobile_refresh_tokens
mobile_captures
push_notifications
action_plans.revision
action_items.revision
```

## 6. 실제 FastAPI–Swift 종단 간 검증

최종 압축본 서버를 실제 Uvicorn으로 기동하고, 최종 iOS ZIP의 Swift 실행 클라이언트를 연결했다.

```text
Capabilities
→ QR Pairing
→ Capture Upload
→ Plan 조회
→ Item 수정
→ Approve
→ Execute
→ Activity
→ Delta Changes
```

Swift 결과:

```json
{
  "server_version": "0.8.0",
  "capture_status": "processed",
  "execution_completed": 2,
  "execution_failed": 0
}
```

추가 HTTP Smoke:

```text
Revision stale update → 409
Push outbox processed → 1
Push dry-run state → simulated
Device revoke 후 Access → 401
Device revoke 후 Refresh → 401
```

Refresh 응답 유실·재사용 방어:

```text
최초 회전                 200
이전 Token 즉시 재전송    200
동일 후속 Token 반환      true
유예 이후 이전 Token 재사용 401
재사용 탐지 후 Access     401
```

## 7. 상세 검증 중 발견·수정한 결함

1. Refresh 응답 유실을 Token 탈취로 오판하여 정상 기기를 폐기하던 문제
2. APNs Device Token을 최초 Pairing 때만 등록해 변경된 Token을 놓칠 수 있던 문제
3. Share Extension의 선언 범위와 파일 fallback 코드가 불일치하던 문제
4. OpenAPI Drift 검증이 `.git` 존재에 의존해 ZIP 배포본에서 재현되지 않던 문제
5. Delta Sync Cursor가 Base64만 사용해 클라이언트 변조를 탐지하지 못하던 문제
6. QR 스캔 직후 문서와 달리 자동 Claim을 수행하던 문제
7. 범용 Custom URL Scheme 충돌 가능성과 중복 Query Item 크래시 경로
8. Wheel 빌드 부산물이 통합 Suite Source Tree에 유입되던 패키징 오염

수정 결과:

- Refresh lost-response grace와 결정적 후속 Token 재구성
- 앱 복원·실행 시 APNs 재등록
- v0.1 Share 범위를 Text/URL로 고정
- 독립 `--check` OpenAPI 비교
- HMAC 서명 Cursor와 변조 `400` 처리
- QR 스캔·외부 링크 모두 서버 주소 표시 후 명시적 연결 버튼 요구
- `jmactionhub://` 전용 앱 등록 및 legacy Scheme 수동 파서 호환
- 중복·알 수 없는 Query Item의 명시적 거부
- Wheel 전용 임시 Source Copy와 독립 ZIP↔Suite 파일별 SHA-256 동일성 Gate

## 8. 실행환경상 미검증 항목

다음 항목은 코드 미완성이 아니라 Apple 계정·macOS·실기기 또는 외부 운영 자격증명이 필요한 인수 항목이다.

- Xcode iOS SDK Simulator Build
- Release Archive와 Code Signing
- App Group Provisioning 실기기 확인
- 카카오톡·메일·메시지 Share Sheet 실기기 확인
- Camera QR, Speech, Face ID
- Widget, Siri, Shortcuts, Background Refresh
- APNs Sandbox·Production Live Delivery
- TestFlight Upload·Install
- 실제 Todoist·GitHub·Google·Fireflies 운영 계정
- Docker daemon·실제 PostgreSQL 동시 Worker

현재 환경의 Python 패키지 인덱스에 Ruff 바이너리가 없어 로컬 Ruff 실행은 하지 못했다. 저장소 CI와 `scripts/verify.sh`에는 Ruff Gate가 포함돼 있으며, 나머지 Python 테스트·Compile·OpenAPI·JS 검증은 최종 압축본에서 수행했다.

## 9. 다음 운영 순서

```text
1. SHA-256 확인
2. Server v0.8.0 dry-run 설치
3. v0.7 DB 백업 후 Migration
4. HTTPS와 Mobile Secret 설정
5. macOS에서 Xcode Preflight
6. 실제 iPhone P0 인수
7. APNs Sandbox
8. TestFlight Internal
9. Todoist/GitHub/Calendar 순차 Live
```

TestFlight GO 조건은 P0 시나리오 100% 통과, 데이터 유실·중복·무단 실행·Secret 노출·Silent Conflict가 모두 0건인 경우다.
