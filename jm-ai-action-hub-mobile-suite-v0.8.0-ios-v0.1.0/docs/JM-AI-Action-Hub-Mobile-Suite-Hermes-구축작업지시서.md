# Hermes 구축 작업지시서 — JM-AI Action Hub Mobile Suite

## 절대 원칙

1. 기존 Todoist/Calendar/GitHub 원장을 대체하지 않는다.
2. iOS 앱에 Admin API Key 또는 Provider Token을 넣지 않는다.
3. 운영 전 `dry_run`에서 인수한다.
4. v0.7 DB 백업 없이 Migration하지 않는다.
5. Apple Secret `.p8`를 저장소/ZIP/Image에 넣지 않는다.
6. 자동 Merge/운영 배포는 활성화하지 않는다.

## 입력 패키지

```text
jm-ai-action-hub-server-v0.8.0.zip
jm-ai-action-hub-ios-v0.1.0.zip
SHA256SUMS-jm-ai-action-hub-mobile-suite.txt
```

## Phase A — 무결성

```bash
sha256sum -c SHA256SUMS-jm-ai-action-hub-mobile-suite.txt
```

각 압축 해제 후 `RELEASE_MANIFEST.sha256`을 검증한다.

## Phase B — 서버

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -e '.[dev]'
./scripts/verify.sh
```

v0.7 운영 DB가 있다면:

```bash
./scripts/backup.sh
action-hub migrate
action-hub check --json
```

Production `.env`:

```dotenv
ACTION_HUB_APP_ENV=production
ACTION_HUB_API_KEY=<secure admin key>
ACTION_HUB_MOBILE_ENABLED=true
ACTION_HUB_MOBILE_PUBLIC_BASE_URL=https://<host>
ACTION_HUB_MOBILE_ACCESS_TOKEN_SECRET=<separate secure key>
ACTION_HUB_EXECUTION_MODE=dry_run
ACTION_HUB_WORKER_INLINE=false
```

API/Worker를 분리 기동한다.

## Phase C — HTTPS

- Reverse Proxy
- TLS valid chain
- `/health`
- `/readiness`
- `/api/v1/mobile/capabilities`
- remote HTTP redirect만으로 의존하지 말고 앱에는 HTTPS QR 제공

## Phase D — iOS macOS 인수

```bash
cp Config/Local.xcconfig.example Config/Local.xcconfig
# Team/Bundle/App Group 설정
bash scripts/testflight_preflight.sh
```

실기기 P0 시나리오를 모두 수행한다.

## Phase E — APNs

- `.p8` runtime secret mount
- Team/Key/Bundle
- sandbox push
- generic payload
- production push

## Phase F — Live 전환

Todoist/GitHub/Calendar는 커넥터별 단일 테스트를 통과한 뒤 하나씩 활성화한다.

```text
dry_run
→ Todoist Live
→ GitHub Live
→ Calendar Live
→ AI Worker Dispatch
```

## 완료 보고 형식

```text
Server tests:
Migration:
Readiness:
HTTPS:
Pairing:
Share offline/online:
Revision conflict:
APNs:
TestFlight build:
Physical device:
Known failures:
GO/NO-GO:
```
