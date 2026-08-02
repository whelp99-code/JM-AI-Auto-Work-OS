# AI Work Automation OS v0.9.0 로컬 설치 지시서

## 요구사항

- macOS 또는 Linux
- Node.js 22 이상
- npm
- 최소 여유 공간: 현재 DB 크기의 3배 이상 권장
- 애플리케이션을 `127.0.0.1`에서만 사용할 것

## 1. 패키지 검증

```bash
sha256sum -c ai-work-automation-os-v0.9.0.zip.sha256
unzip ai-work-automation-os-v0.9.0.zip
cd ai-work-automation-os-v0.9.0
./verify-bundle.sh
```

macOS에서 `sha256sum`이 없으면:

```bash
shasum -a 256 -c ai-work-automation-os-v0.9.0.zip.sha256
```

## 2. 신규 설치

```bash
mkdir -p ~/ai-work-automation-os
./install-local.sh ~/ai-work-automation-os
```

## 3. v0.8.0 업그레이드

### 사전 준비

```bash
cd /path/to/v0.8.0-repository
git status
```

변경 사항이 있으면 commit 또는 stash합니다. 앱을 종료합니다.

### 설치

```bash
/path/to/package/install-local.sh /path/to/v0.8.0-repository
```

설치기는 다음 순서로 실행합니다.

```text
패키지 검증
→ 기존 소스 backup
→ v0.9.0 소스 적용
→ DB dry-run
→ npm install
→ DB atomic rebuild
→ Prisma generate
→ workspace seed
→ offline verification
→ DB doctor
→ typecheck
→ full test
→ production build
```

## 4. 실행

```bash
npm run dev
```

브라우저:

```text
http://127.0.0.1:3000
```

## 5. 상태 확인

```bash
npm run db:doctor
npm run local:verify
```

UI:

```text
http://127.0.0.1:3000/settings/database
```

## 6. 백업

v0.9.0 운영 중 수동 backup:

```bash
npm run db:backup
```

## 7. v0.8.0 롤백

```bash
npm run db:rollback:v0.8
```

롤백 후 v0.8.0 소스도 `.aiwa-backups/source-before-v0.9.0-*.tar.gz`에서 복구합니다.

## 8. 전체 재검증

```bash
/path/to/package/verify-target.sh /path/to/repository
```

## 9. 주요 환경값

```dotenv
APP_VERSION="0.9.0"
APP_DEPLOYMENT_MODE="local"
NEXT_PUBLIC_APP_DEPLOYMENT_MODE="local"
DATABASE_URL="file:../data/ai-work-automation.db"
COMPANY_LOCAL_PRINCIPAL_ID="local:owner"
COMPANY_LOCAL_ORGANIZATION_SLUG="ai-company"
RUNTIME_EXECUTION_MODE="inline"
AI_EXECUTION_MODE="synthetic"
```

기존 `.env`와 `.env.local`은 자동 덮어쓰지 않습니다. 값이 다르면 예제 파일과 비교하여 Local-First 기준으로 정리하십시오.
