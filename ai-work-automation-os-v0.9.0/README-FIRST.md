# AI Work Automation OS v0.9.0 — 먼저 읽기

## 릴리스 목적

v0.9.0은 v0.8.0에서 누적된 44개 DB 모델을 **단일 SQLite의 18개 canonical physical tables**로 직접 리빌드한 Local-First 릴리스입니다.

> 자연어 업무 목표를 받아 필요한 AI 조직을 구성하고, 상태 기반 Workflow로 업무를 실행·독립 검증·승인하며, 검증된 산출물과 통제된 실제 업무 행동까지 연결하는 AI Work Automation OS입니다.

ProofGraph는 별도의 소프트웨어 개발 에이전트 도구이며 이 프로젝트나 Verification Runtime의 이름이 아닙니다.

## 핵심 구조

```text
단일 Local SQLite DB
└─ 18 canonical tables
   ├─ 조직 4
   ├─ 업무 3
   ├─ Workflow 2
   ├─ 검증·승인 2
   ├─ AI Council·결정 3
   ├─ 산출물·외부 실행 2
   └─ 감사·파일 2
```

v0.9.0에는 별도의 44-table Runtime Ledger 또는 Projection DB가 없습니다.

## 가장 빠른 설치

### 신규 설치

```bash
unzip ai-work-automation-os-v0.9.0.zip
cd ai-work-automation-os-v0.9.0
./verify-bundle.sh
mkdir -p ~/ai-work-automation-os
./install-local.sh ~/ai-work-automation-os
```

### v0.8.0 업그레이드

```bash
unzip ai-work-automation-os-v0.9.0.zip
cd ai-work-automation-os-v0.9.0
./verify-bundle.sh
./install-local.sh /path/to/existing-v0.8.0-repository
```

설치 후:

```bash
cd /path/to/repository
npm run dev
```

접속: `http://127.0.0.1:3000`

## 설치기가 보존하는 것

```text
.git/
.env
.env.local
data/
backups/
artifacts/
```

기존 관리 소스는 다음에 저장됩니다.

```text
.aiwa-backups/source-before-v0.9.0-<timestamp>.tar.gz
```

v0.8.0 DB는 다음 두 위치에 보존됩니다.

```text
backups/ai-work-automation.db.v0.8.0.<timestamp>.db
data/ai-work-automation.db.v0.8.0
```

## 수동 적용

소스만 적용하고 DB는 건드리지 않으려면:

```bash
./apply-on-v0.8.0.sh /path/to/v0.8.0-repository
```

신규/빈 디렉터리 또는 일반 적용:

```bash
./apply.sh /path/to/target
```

그 후 대상 저장소에서:

```bash
npm install
npm run db:rebuild:dry-run
npm run db:rebuild
npm exec prisma generate
npm run db:seed
npm run db:doctor
npm run check
npm test
npm run build
```

## 롤백

애플리케이션을 중지한 뒤:

```bash
npm run db:rollback:v0.8
```

소스 롤백은 `.aiwa-backups/`의 tar.gz를 사용하십시오.

## 현재 검증 판정

```text
DB tests                     7/7 PASS
Pure tests                   11/11 PASS
Schema parity                18 tables / 297 columns PASS
Static invariants            137/137 PASS
Adversarial                  46/46 PASS
TS/TSX syntax                45/45 PASS
Offline integrated gate      PASS
```

실제 npm dependency 설치·Prisma Client·전체 테스트·Next.js build는 대상 장비에서 설치기가 실행합니다.
