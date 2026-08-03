# JM-AI Auto Work OS 통합·폐기 상세 실행계획서 v1

- 작성일: 2026-08-03
- 대상 Git 저장소: `/Volumes/DevSpace/Playground/JM AI-OS Pack/JM-AI Auto Work OS`
- AWOS 패키지: `ai-work-automation-os-v0.9.0/`
- 상위 지시: `/Volumes/DevSpace/Playground/JM AI-OS Pack/ops/MASTER_WORKFLOW_PROTOCOL.md`, `/Volumes/DevSpace/Playground/JM AI-OS Pack/ops/INTEGRATION_PLAN_MW_AWOS_V1.md`
- 문서 상태: `READY_FOR_MASTER_REVIEW`
- 실행 상태: `NOT_APPROVED — 이 문서는 계획 전용이다. Fable5의 APPROVED 전에는 코드 수정, 삭제, 이관, 커밋, 푸시를 금지한다.`

## 1. 사용자 가시적 결과

Auto Work OS(AIWA/AWOS)는 신규 기능 개발을 동결한다. 먼저 Master Worker로 넘길 자산의 신뢰성을 깨뜨리는 Phase 0-B 결함을 고친다. 그다음 우수 자산 3종을 AWOS 내부 의존성이 없는 `jmmw-v1` 공급 키트로 만든다. Master Worker 수신 확인 후 Action Hub v0.8.0 증거를 정본 저장소로 이관하고, 동거 스냅샷·배포 바이너리·로컬 설치 링크를 안전하게 정리한 뒤 모든 AWOS 진입 README에 `SUPERSEDED` 안내를 표시한다.

이 계획의 완료는 AWOS가 실운영 제품으로 계속 개발된다는 뜻이 아니다. 완료 상태는 `frozen/superseded`, 즉 공급 자산과 감사 가능한 복구 경로만 보존된 단계적 폐기 상태다.

## 2. 권한, 범위, 순서

### 2.1 담당 범위

- `CONFIRMED` Phase 0-B: B1 실패 review 증거 보존, B2 실패 run 재시도 복구, B3 오프라인 검증 fail-closed/경로 이식성, B4 잠금 파일을 통한 설치 재현성.
- `CONFIRMED` Phase 2 공급측: Human Approval 게이트, Mission Workspace 8탭 패턴, SQLite 원자 마이그레이션 패턴을 독립 공급 키트로 추출·문서화·검증.
- `CONFIRMED` Phase 3: Action Hub v0.8.0 검증 증거 이관, 스냅샷/zip/whl 정리, 로컬 설치 심링크 정리, AWOS `SUPERSEDED` 안내.
- `CONFIRMED` Phase 2 수신 구현과 Master Worker 코드 변경은 MW 관리자 소유다.

### 2.2 비범위(Non-goals)

- AWOS 신규 기능, UI 재설계, 운영 배포, 인증 체계 확장.
- Master Worker 저장소 내부 구현·리팩터링·승인.
- Action Hub v0.9.0 제품 코드 변경. `evidence/v0.8.0/` 수신은 Action Hub 관리자 확인이 필요한 외부 인수 단계다.
- AWOS 데이터베이스 실데이터 삭제. `data/`, `backups/`, 사용자 `.env*`는 모든 삭제 카드의 금지 대상이다.
- Git 커밋·푸시·태그·PR. 마스터가 각 행위를 별도로 지시한 경우에만 수행한다.

### 2.3 순서 제약

```text
P0B-00 -> P0B-01 -> P0B-02 -> P0B-03 -> P0B-04 -> P0B-05
                                            |
                                            v
P2-01 + P2-02 + P2-03 (파일 소유권이 겹치지 않아 병렬 가능)
             -> P2-04 -> MANUAL-GATE-02(MW 수신 확인)
                         -> P3-00A(Action Hub evidence source manifest)
                         -> MANUAL-GATE-03A(Action Hub pre-copy 승인)
                         -> P3-01 -> MANUAL-GATE-03B(Action Hub 수신 영수증)
                         -> P3-02A(삭제 inventory) -> MANUAL-GATE-04(R4 승인)
                         -> P3-02B(삭제 실행) -> P3-03 -> P3-04 -> P3-05
```

- `CONFIRMED` 통합 원계획은 Phase 3 시작 조건을 Phase 2 공급 완료로 둔다.
- `ASSUMED` 실제 삭제는 공급 완료만으로 부족하므로 MW 수신 확인과 Action Hub 증거 수신 영수증을 추가 안전 게이트로 둔다. 영향: 삭제가 늦어질 수 있으나 복구 불가능한 선행 삭제를 막는다. 롤백: 마스터가 영수증 형식을 변경하면 게이트 문구와 검증 명령만 바꾼다.

## 3. 조사 및 Baseline

### 3.1 저장소 상태

| 항목 | 상태 | 근거 |
|---|---|---|
| Git root | `CONFIRMED` | `/Volumes/DevSpace/Playground/JM AI-OS Pack/JM-AI Auto Work OS` |
| HEAD | `CONFIRMED` | `51253b4` (`Merge import: JM-AI Auto Work OS packages`) |
| 브랜치 | `CONFIRMED` | `main...origin/main` |
| 기존 변경 | `CONFIRMED` (2026-08-03 계획 작성 시점) | `?? .serena/`, `?? ai-work-automation-os-v0.9.0/docs/`. `.serena/`와 승인 전 작성된 본 계획 문서는 보존하고 전 카드에서 광범위 staging 금지 |
| 저장소 지침 | `CONFIRMED` | 저장소 하위 `AGENTS.md` 없음. 사용자 제공 Personal Codex Operating Charter 적용 |
| 런타임 | `CONFIRMED` | `.nvmrc=22`, 관측 Node `v22.23.1`, npm `10.9.8` |
| 잠금 파일 | `CONFIRMED` | `source/package-lock.json` 없음 |
| 코드 그래프 | `CONFIRMED` | `jm-ai-auto-work-os-v0-9-0`, 2,310 nodes / 3,465 edges; TypeScript 42, Bash 6, CSS 1 |

### 3.2 자산 지도

| 자산/결함 | 정본 및 연결 경로 | 현재 검증 |
|---|---|---|
| Approval gate | `source/src/server/approval-service.ts:14-95`; `event-service.ts:46-48`; API `src/app/api/approvals/[id]/route.ts`; `runtime-v090.test.ts:52-73` | 만료·scope 재계산·`updateMany` CAS·거절 차단은 존재 |
| Mission Workspace | `source/src/components/mission-workspace.tsx:24-116`; `workspace-service.ts:5-42`; API `src/app/api/runs/[id]/workspace/route.ts` | 8탭, 5초 가시성 polling, 승인 POST, 서버 집계 존재 |
| Atomic migration | `source/scripts/db-v090-migrate.mjs:1114-1237`; `tests/v090-migration.test.mjs` | backup, read-only source, temp transaction, validation-before-swap, swap rollback 존재 |
| B1 | `workflow-service.ts:155-195,227-233` | failed review를 만든 트랜잭션에서 즉시 throw하여 review/step/event가 rollback됨 |
| B2 | `workflow-service.ts:73`, `mission-service.ts:61-66` | `retryMissionRun(failed)`가 `executeMissionRun`의 terminal early return에 막힘 |
| B3 | `verify-offline.sh:11-21`; `v090_pure_tests.mjs:6,8`; `v090_ts_syntax.mjs:6-14`; `v090-migration.test.mjs:11` | 고정 `/opt/nvm/.../22.16.0`, tsc 미존재 시 SKIP 뒤 PASS, URL pathname 공백 경로 오류 |
| B4 | `source/package.json`; `apply.sh:81-100` | `apply.sh`는 lock을 관리 대상으로 선언하지만 payload에 lock 없음 |
| Action Hub snapshot | `jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0/` | tracked 248 files; evidence 10 files; `RELEASE_COMMITS.txt`, OpenAPI 존재 |
| Action Hub local caches | snapshot 하위 `server/.venv`, `server/.pytest_cache`, `**/__pycache__`, `ios/Packages/ActionHubCore/.build` | `CONFIRMED` Git ignored 생성물; tracked 삭제만으로 directory가 남으므로 exact snapshot cleanup 필요 |
| 제거 대상 binary | repository root zip 2개, Action Hub `dist/*.whl` 1개 | 세 파일 모두 Git tracked |
| 설치 링크 | `ai-work-automation-os-v0.9.0-installed` | Git ignored symlink; 외부 `/Volumes/DevSpace/Playground/JMAI-OS-Pack/...`를 가리킴 |

### 3.3 실행한 Baseline과 판정

| 명령 | 종료코드 | 관측 결과 | 판정 |
|---|---:|---|---|
| `cd source && npm run verify:v0.9.0:offline` | 1 | schema 2 pass, migration 5 fail. 공백 포함 경로가 `%20`로 전달되어 child status가 `null` | `FAIL — P0B-02 선행 필요` |
| `cd source && npm run test:v0.9.0:pure` | 1 | `/opt/nvm/versions/node/v22.16.0/.../typescript.js` 없음 | `FAIL — P0B-02 선행 필요` |
| `cd source && node verification/scripts/v090_ts_syntax.mjs` | 1 | 같은 고정 TypeScript 경로 실패 | `FAIL — P0B-02 선행 필요` |
| `cd source && python3 verification/scripts/v090_static_verification.py` | 0 | `137/137 passed` | `PASS — 정적 패턴 검사일 뿐 runtime 대체 불가` |
| `cd source && python3 verification/scripts/v090_adversarial_verification.py` | 0 | `46/46 passed` | `PASS — B1/B2 실제 실패 경로 대체 불가` |

`CONFIRMED` 현재 `node_modules/.bin/tsc`와 전역 `tsc`가 모두 없다. 따라서 기존 로그의 PASS를 현재 상태에 재사용하지 않는다.

## 4. 원자 요구사항과 수용 기준

| REQ | 우선순위 | 요구 결과 |
|---|---|---|
| REQ-P0B-001 | P0 MUST | `npm ci`가 잠금 파일만으로 동일 dependency tree를 설치한다. |
| REQ-P0B-002 | P0 MUST | 오프라인 verifier가 프로젝트 로컬 TypeScript/compiler를 사용하고 미존재 시 non-zero로 중단한다. |
| REQ-P0B-003 | P0 MUST | 저장소 절대경로에 공백이 있어도 migration/pure/syntax 검증이 실행된다. |
| REQ-P0B-004 | P0 MUST | verification 실패 후 failed review, failureJson, failed verification step/event가 main transaction rollback 뒤에도 남는다. |
| REQ-P0B-005 | P0 MUST | failed run은 `attemptCount < maxAttempts`일 때 다시 실행할 수 있고 성공 경로로 전이한다. |
| REQ-P0B-006 | P0 MUST | maxAttempts 도달, blocked/cancelled/waiting_approval 상태는 fail-closed하며 실행 횟수를 늘리지 않는다. |
| REQ-P2-001 | P0 MUST | Approval 자산 키트가 scope 재계산, 만료, single-winner CAS, 승인/거절 후속효과 계약과 executable test를 제공한다. |
| REQ-P2-002 | P1 MUST | Workspace 자산 키트가 8탭, 상태, polling, 승인 payload, 접근성 규칙을 framework-neutral 계약으로 제공한다. |
| REQ-P2-003 | P0 MUST | Migration 자산 키트가 backup-before-write, read-only source, temp transaction, validate-before-swap, restore-on-swap-failure 계약과 fault test를 제공한다. |
| REQ-P2-004 | P0 MUST | 공급 manifest가 source commit·source hash·extracted hash·검증 명령을 결박하고 AWOS 내부 import가 0개임을 증명한다. |
| REQ-P3-001 | P0 MUST | Action Hub v0.8 evidence 10개와 `RELEASE_COMMITS.txt`, OpenAPI가 수신 저장소 `evidence/v0.8.0/`에서 hash 검증된다. |
| REQ-P3-002 | P0 MUST | 수신 영수증 전에는 snapshot/zip/whl을 삭제하지 않는다. |
| REQ-P3-003 | P1 MUST | 영수증 후 동거 snapshot 248 tracked files, root zip 2개, wheel 1개가 현재 tree에서 제거되고 Git history 복구 좌표가 남는다. |
| REQ-P3-004 | P1 MUST | ignored install symlink는 정확한 target 확인 후 링크만 제거하며 target directory는 삭제하지 않는다. |
| REQ-P3-005 | P0 MUST | repository/package/source README 첫 화면이 `SUPERSEDED`, JMMW 이관, 신규개발 동결, 복구/증거 위치를 알린다. |

### 4.1 Given–When–Then

- `AC-P0B-001` Given clean checkout와 Node 22 / When `npm ci`를 실행 / Then exit 0, `npm ls --depth=0` exit 0, lock diff 없음.
- `AC-P0B-001-F` Given `package.json`과 lock 불일치 / When `npm ci` / Then non-zero이고 lock을 자동 수정하지 않음.
- `AC-P0B-002` Given local `node_modules/.bin/tsc` / When offline verifier 실행 / Then 실제 semantic typecheck 후 PASS.
- `AC-P0B-002-F` Given `AIWA_TSC_BIN`이 미존재 경로 / When verifier 실행 / Then non-zero, `TypeScript compiler unavailable` 출력, 최종 PASS 미출력.
- `AC-P0B-003` Given 현재 공백 포함 workspace / When DB/pure/syntax 검증 / Then 각 exit 0.
- `AC-P0B-004` Given RED mission 승인 전 work item을 `completed`+빈 output으로 조성 / When 승인하여 verification 실패 유발 / Then 호출은 실패하고 run/mission은 failed, failed review/step/event는 조회 가능.
- `AC-P0B-005` Given 1회 실패하고 `attemptCount < maxAttempts`인 run / When 원인을 제거하고 retry / Then attemptCount가 정확히 1 증가하고 `simulated` 완료.
- `AC-P0B-006` Given maxAttempts 도달 또는 blocked/cancelled/waiting_approval / When retry 요청 / Then `invalid_run_state` 또는 `max_attempts_exceeded`, 상태·attemptCount 불변.
- `AC-P2-001` Given 인메모리 adapter와 동일 scope / When approval reference test / Then 한 요청만 CAS 성공, 변조·만료·재사용은 거부.
- `AC-P2-002` Given workspace pattern JSON / When schema/contract test / Then 8개 tab의 순서·필수 state·approval scopeHash payload가 모두 존재.
- `AC-P2-002-F` Given tab 누락·중복, polling stop 누락 또는 approval scopeHash 누락 / When contract test / Then non-zero.
- `AC-P2-003` Given 임시 legacy DB와 각 fault point / When migration reference test / Then 성공 시 atomic replacement, 실패 시 source hash 불변, backup 존재.
- `AC-P2-004` Given handoff tree / When verifier / Then manifest hash 일치, `@/`, Prisma, Next, React, AWOS source relative import 0개.
- `AC-P2-004-F` Given extracted file 1 byte 변조 또는 forbidden import / When verifier / Then non-zero이고 수신 가능 상태를 출력하지 않음.
- `AC-P3-001` Given Action Hub v0.9 repo path와 비어 있는 destination / When evidence copy+hash / Then 12개 정본 입력(10 evidence + commits + OpenAPI)과 SHA256SUMS가 수신측에서 검증됨.
- `AC-P3-001-F` Given destination 기존 파일 또는 hash mismatch / When 이관 / Then non-zero, 원본/기존 destination 삭제 없음.
- `AC-P3-002` Given 수신 receipt 없음 / When 삭제 preflight / Then BLOCKED, tracked 파일 0개 삭제.
- `AC-P3-003` Given receipt와 source commit `51253b4` 확인 / When archive cleanup / Then 지정 snapshot/binaries만 삭제, `git show 51253b4:<path>` 복구 가능.
- `AC-P3-004` Given 설치 path가 실제 directory거나 예상 밖 target을 가리키는 link / When cleanup / Then BLOCKED. 정확히 확인된 symlink일 때 링크만 제거.
- `AC-P3-005` Given 사용자가 세 README 중 하나를 열음 / When 첫 20줄 확인 / Then SUPERSEDED, JMMW, 동결, 지원 종료 범위가 보임.
- `AC-P3-005-F` Given 세 README 중 하나의 배너나 JMMW 안내 누락 / When 문서 gate / Then non-zero이고 `PASS_SUPERSEDED` 금지.

## 5. 규모, 준비도, 고정 결정

- 티어: `XL`.
- 근거: MUST 15개, 계획 카드상 내부 CREATE 33개·고유 MODIFY 약 16개·manual authority artifact 최대 11개(5 JSON+5 signatures+allowed_signers), 외부 evidence CREATE 15개(12 payload+SHA256SUMS+receipt+signature), tracked DELETE 250개(snapshot 248+root zip 2), ignored cache root/pattern 4종 이상, local symlink 1개 제거이며 R4 데이터 손실 위험이 존재한다. 실행 전 P3-02A가 exact 수치로 다시 고정한다.
- 문서 형태: 사용자 지정 경로 우선으로 전체 XL 내용을 이 단일 파일에 통합한다.
- 준비도: `READY_WITH_MANUAL_GATES`. 코드 계획은 실행 가능하다. 외부 destination 절대경로와 수신 승인은 삭제 단계 전까지 필수다.

### ADR-001 — Phase 0-B만 AWOS 코드 수정

- Status: `PROPOSED`; Decision: 이식 자산과 그 검증 경계만 고친다. 신규 제품 기능과 전면 구조 개선은 금지한다.
- Reason: 원 통합 결정은 AWOS 폐기이며 수리 목적은 공급 자산 품질 보증이다.
- Consequence: 인증 등 AWOS 전체 실운영 결함은 이 계획으로 종결 주장하지 않는다.
- Rollback: 각 P0B 카드의 파일별 revert. DB migration 없음.

### ADR-002 — 공급 키트는 reference+contract+test

- Status: `PROPOSED`; Decision: `handoff/jmmw-v1/` 아래에 Node 22 built-in 기반 reference, framework-neutral contract, executable test를 둔다.
- Reason: MW 저장소 기술 선택을 AWOS가 침범하지 않으면서 동작 불변조건을 전달한다.
- Consequence: MW 수신측은 그대로 복사하지 않고 자사 adapter에 포팅한 뒤 자기 테스트를 추가해야 한다.
- Rollback: handoff directory만 제거. AWOS runtime 변화 없음.

### ADR-003 — 삭제 전 이중 영수증

- Status: `PROPOSED`; Decision: P2 수신 확인과 Action Hub evidence receipt 없이는 P3 삭제 금지.
- Reason: `git rm` 대상이 248 tracked files와 배포 binary를 포함한다.
- Consequence: 외부 관리자가 지연되면 AWOS는 `BLOCKED_DEPRECATION`, 소스/바이너리 보존 상태를 유지한다.
- Rollback: 삭제 전에는 N/A; 삭제 후에는 `git restore --source=51253b4 -- <exact paths>`를 사용하되 마스터 승인 필요.

## 6. 공급 계약

### 6.1 Approval Gate 계약

- 입력: `{ approvalId, decision: "approved"|"rejected", comment?, presentedScopeHash? }`.
- 저장소 adapter: `load(id)`, `commitDecisionAtomically({id, expectedStatus, expectedScopeHash, decision, actor, decidedAt, decisionRecord, auditEvent, effectIntent}) -> {count, approval, effectIntent}`, `claimEffect({effectId,idempotencyKey})`, `completeEffect`, `failEffect`.
- transaction 불변조건: approval CAS, decision record, audit event, durable effect intent를 같은 adapter transaction에서 모두 commit하거나 모두 rollback한다. request JSON 서버 재해석 후 hash 재계산; stored hash와 불일치 거부; presented hash가 있으면 stored hash와 불일치 거부; expiresAt `<= now` 거부; commit count는 정확히 1.
- 후속효과 불변조건: 승인/거절 hook은 committed effect intent를 idempotency key로 claim한 consumer만 실행한다. hook 실패는 intent를 retryable failed로 남기고 같은 decision 재호출이 미완료 effect를 재개한다. approval만 결정되고 audit/effect가 유실되는 상태를 허용하지 않는다.
- 오류: `not_found`, `approval_conflict`, `approval_expired`, `approval_scope_mismatch`; raw stack/secret 없음.
- 멱등성: 이미 같은 decision이면 현재 record와 미완료 effect를 반환하여 drain을 재개하고, 모든 effect completed일 때만 단순 반환한다. 다른 decision이면 conflict.

### 6.2 Mission Workspace 계약

- 탭 순서: `overview`, `organization`, `workflow`, `approvals`, `council`, `evidence`, `artifacts`, `audit`.
- 데이터 schema: `mission-workspace.v0.9.0`의 mission/run/organization/overview와 각 tab collection.
- 상태: `INITIAL`, `LOADING`, `SUCCESS`, `EMPTY`, `ERROR`, `RETRYING`, terminal status.
- polling: non-terminal + document visible에서 5초, unmount/terminal에서 clear.
- 승인: POST에 `decision`과 `scopeHash`; busy 중 중복 클릭 금지; 오류 시 기존 snapshot 유지.
- 접근성: tab button에 선택 상태, keyboard focus, pending count의 텍스트 대체, 오류와 retry control.

### 6.3 Atomic Migration 계약

- 입력: database path, backup directory, expected source generation, target generation, callbacks(create/migrate/validate).
- 성공 순서: detect read-only -> backup -> temp remove -> temp create -> `BEGIN IMMEDIATE` -> migrate -> COMMIT -> validate -> checkpoint/close -> source to sidecar rename -> temp to source rename -> report.
- 실패: migrate/validate 실패 시 temp 제거와 source hash 불변; swap 2단계 실패 시 sidecar를 source로 즉시 복원.
- 산출: backup, rollback sidecar, report with source/target tables, counts, validation.
- 금지: source DB에서 in-place DDL, validation 전 swap, catch 후 성공 exit.

### 6.4 해당 없는 계약

- 네트워크 API 신규 계약: `N/A — 공급 키트는 로컬 reference이며 MW API는 수신 관리자 소유`.
- 신규 DB schema/migration: `N/A — P0B와 handoff에 AWOS Prisma migration을 추가하지 않음`.
- 신규 event transport: `N/A — appendAudit adapter 계약만 제공`.

### 6.5 Release manifest 단일 계약

- source manifest 절대 대상: `ai-work-automation-os-v0.9.0/source/MANIFEST.sha256`.
- package manifest 절대 대상: `ai-work-automation-os-v0.9.0/MANIFEST.sha256`.
- 유일한 재생성 진입점: `ai-work-automation-os-v0.9.0/scripts/integration/regenerate-manifests.sh`.
- script는 package root를 자기 위치로 resolve하고 `.env`, `.env.local`, `node_modules/`, `.next/`, `data/`, `backups/`, `artifacts/`, 대상 manifest 자기 자신을 제외한다. source manifest를 먼저 `.tmp`+atomic rename으로 만들고, package manifest는 새 source manifest를 포함해 같은 방식으로 만든다. locale은 `LC_ALL=C`, hash는 `shasum -a 256`, 경로는 package/source 기준 `./...`다.
- P0B-05, P2-04, P3-04는 이 script만 실행한다. 카드마다 별도 manifest 알고리즘을 작성하지 않는다.
- 최종 검증 결과를 기록하는 repository-root `deprecation-receipts/AIWA_DEPRECATION_VERIFICATION_V1.md`는 package 밖 post-build receipt이므로 두 package manifest의 대상이 아니다. package 내부 verifier/test는 P3-04에서 먼저 생성한 뒤 manifest에 포함한다.

## 7. 작업 카드

모든 카드는 OMP 수행자에게 그대로 전달 가능하다. 수행자는 카드 시작 전 `git status --short`를 기록하고 `../.serena/`를 수정·stage하지 않는다.

### P0B-00 — 즉시 freeze 배너와 gate validator

**TASK**

- 마스터 승인 직후 외부 이관을 기다리지 않고 AWOS 신규개발 동결을 사용자 진입점에 표시하고 이후 manual receipt를 검증할 공통 validator를 만든다.

**DELIVERABLE**

- MODIFY repository `README.md`.
- MODIFY `ai-work-automation-os-v0.9.0/README-FIRST.md`.
- MODIFY `ai-work-automation-os-v0.9.0/source/README.md`.
- CREATE `ai-work-automation-os-v0.9.0/docs/DEPRECATION_POLICY_V1.md`.
- CREATE `ai-work-automation-os-v0.9.0/scripts/integration/verify-gate-receipt.mjs`.
- CREATE `ai-work-automation-os-v0.9.0/scripts/integration/verify-gate-receipt.test.mjs`.

**SCOPE**

- MASTER OVERRIDE (2026-08-03, source: `/Volumes/DevSpace/Playground/JM AI-OS Pack/ops/MASTER_REVIEW_ROUND1.md`): 로컬 단일 사용자 환경의 MANUAL-GATE-00에 한해 §9.1의 SSH signature/allowed_signers 요구를 적용하지 않는다. 다른 gate의 §9.1 계약은 변경하지 않는다.
- GATE-00 `PLAN_APPROVAL.json`은 `schemaVersion`, `gateId=MANUAL-GATE-00`, `decision=APPROVED`, `issuedAt=2026-08-03`, 위 승인 정본 절대경로와 SHA-256, 현재 계획서 경로와 SHA-256을 기록한다. validator는 승인 정본 파일 존재, 본문 `APPROVED`, 승인일 `2026-08-03`, receipt의 source/plan SHA와 현재 파일 SHA 일치를 검사한다. signature가 없다는 이유로 실패하거나 성공을 우회하지 않는다.
- GATE-00의 SSH signature/allowed_signers 입력은 선택적이다. 제공되면 §9.1 방식으로 추가 검증하고, 없으면 위 file-based 검증만으로 통과한다. 승인 정본 누락·문구/날짜 불일치·source/plan SHA 불일치는 반드시 non-zero다.
- MANUAL-GATE-00의 Fable5 승인 메시지를 관리자가 `PLAN_APPROVAL.json` schema로 정규화한 후 이 카드를 시작한다.
- 세 README 첫 20줄에 `SUPERSEDED`, replacement=JM-AI Master Worker, freeze date=2026-08-03, 신규 설치/기능 개발 금지를 표시한다. 수신 완료나 삭제 완료는 주장하지 않는다.
- validator는 §9.1 schema, gate별 signed issuer allowlist, detached SSH signature, provenance sourceId/messageId/contentSha256, 현재 plan SHA, repo realpath/HEAD, issuedAt/expiresAt를 검증한다. JSON 검사는 Node built-ins, signature 검사는 system `ssh-keygen -Y verify`를 사용한다.
- tests는 wrong plan hash, expired, wrong issuer/key, missing/forged signature, allowed_signers drift, missing provenance, malformed timestamp를 모두 거부한다.
- FORBIDDEN: runtime source 변경, 수신/폐기 완료 주장, 외부 repo write, 커밋/푸시.

**VERIFY**

```bash
node --test ai-work-automation-os-v0.9.0/scripts/integration/verify-gate-receipt.test.mjs
node ai-work-automation-os-v0.9.0/scripts/integration/verify-gate-receipt.mjs MANUAL-GATE-00 ai-work-automation-os-v0.9.0/docs/integration-receipts/PLAN_APPROVAL.json
for f in README.md ai-work-automation-os-v0.9.0/README-FIRST.md ai-work-automation-os-v0.9.0/source/README.md; do sed -n '1,20p' "$f" | grep -q 'SUPERSEDED'; done
```

- 기대 종료코드: 모두 0.
- 기대 결과: 정상 receipt PASS, negative fixtures 전부 reject, 세 진입점에 freeze 배너 존재.

### P0B-01 — 재현 가능한 dependency lock (B4)

**TASK**

- `source/package.json`의 현재 dependency 범위를 npm 10.9.8/Node 22로 resolve하여 npm lockfile v3을 생성한다. dependency version 자체를 임의 업그레이드하지 않는다.

**DELIVERABLE**

- CREATE `ai-work-automation-os-v0.9.0/source/package-lock.json`.
- CREATE `ai-work-automation-os-v0.9.0/source/tests/package-lock-v090.test.mjs`.
- lockfileVersion 3, root name/version `ai-work-automation-os@0.9.0`, direct dependency/devDependency 11종이 package.json과 일치.
- 설치/검증 출력과 종료코드.

**SCOPE**

- READ_ONLY: `source/package.json`, `source/.nvmrc`, `apply.sh:81-100`.
- CREATE: `ai-work-automation-os-v0.9.0/source/package-lock.json`, `ai-work-automation-os-v0.9.0/source/tests/package-lock-v090.test.mjs`만.
- FORBIDDEN: dependency range 변경, application code, `../.serena/`, data/backups, root zip.
- 구현: `npm install --package-lock-only --ignore-scripts`; 생성 후 현재 `source/`의 `node_modules`를 `npm ci --ignore-scripts`로 처음부터 재구성한다.
- lock test는 package.json+lock만 임시 directory에 복사하여 정상 `npm ci --ignore-scripts`와 dependency spec 불일치 fixture의 non-zero/EUSAGE 및 lock hash 불변을 검증한다.
- 실패: registry/network 실패면 lock을 추측 생성하지 말고 `BLOCKED` 보고.

**VERIFY**

```bash
cd ai-work-automation-os-v0.9.0/source
npm ci --ignore-scripts
npm ls --depth=0
node --test tests/package-lock-v090.test.mjs
lock_before="$(shasum -a 256 package-lock.json | awk '{print $1}')"
npm install --package-lock-only --ignore-scripts
lock_after="$(shasum -a 256 package-lock.json | awk '{print $1}')"
test "$lock_before" = "$lock_after"
```

- 기대 종료코드: 각 0.
- 기대 결과: package-lock 자동 수정 없음, missing/invalid dependency 0.

### P0B-02 — fail-closed·공백 경로 검증 하네스 (B3 + baseline blocker)

**TASK**

- TypeScript 절대경로와 tsc SKIP을 제거하고 URL path를 `fileURLToPath`로 변환한다. compiler가 없으면 PASS를 출력하지 않고 실패한다.

**DELIVERABLE**

- MODIFY `source/verify-offline.sh`.
- MODIFY `source/verification/scripts/v090_pure_tests.mjs`.
- MODIFY `source/verification/scripts/v090_ts_syntax.mjs`.
- MODIFY `source/tests/v090-migration.test.mjs`.
- CREATE `source/tests/verification-harness-v090.test.mjs`.
- CREATE `source/scripts/run-runtime-tests-v090.sh`.
- MODIFY `source/package.json`의 `test` script가 위 runner를 호출하도록 변경.
- MODIFY `source/verification/scripts/v090_adversarial_verification.py`에 `/opt/nvm`/SKIP 금지와 local compiler fail-closed 정적 assertion.

**SCOPE**

- `v090_pure_tests.mjs`: `import ts from "typescript"`; root는 `fileURLToPath(new URL("../..", import.meta.url))`.
- `v090_ts_syntax.mjs`: fallback absolute path 삭제; package import 실패는 그대로 non-zero; root는 `fileURLToPath`.
- migration test: URL `.pathname` 삭제, `fileURLToPath` 사용.
- `verify-offline.sh`: `TSC_BIN="${AIWA_TSC_BIN:-$ROOT/node_modules/.bin/tsc}"`; executable 아니면 명시 오류 후 exit 1; 최종 PASS는 모든 명령 후에만 출력. `--check-toolchain`은 compiler 존재 확인만 수행하고 종료하여 negative test가 전체 verifier를 재귀 호출하지 않게 한다.
- 테스트는 `AIWA_TSC_BIN`을 미존재 path로 주입하고 `--check-toolchain`을 실행해 non-zero와 명시 오류를 검사한다.
- runtime runner는 `AIWA_TEST_DATABASE_URL`만 test DB override로 허용하고 기본은 기존 `file:../data/test-v0.9.0.db`다. 값이 `file:` scheme이 아니거나 빈 path이면 reset 전에 실패한다. package script 내부의 하드코딩 `DATABASE_URL=...` 반복을 제거하여 full gate가 임시 DB를 주입할 수 있게 한다.
- FORBIDDEN: test skip, assertion 약화, `/opt/nvm`, 전역 tsc fallback, source code 변경.

**VERIFY**

```bash
cd ai-work-automation-os-v0.9.0/source
npm run test:v0.9.0:db
npm run test:v0.9.0:pure
node verification/scripts/v090_ts_syntax.mjs
node --test tests/verification-harness-v090.test.mjs
verify_dir="$(mktemp -d)"
test -n "$verify_dir" && test -d "$verify_dir"
trap 'rm -rf "$verify_dir"' EXIT
AIWA_TEST_DATABASE_URL="file:$verify_dir/runtime.db" npm test
npm run verify:v0.9.0:offline
```

- 기대 종료코드: 모두 0.
- 기대 결과: DB test 7/7 이상 PASS, 공백 경로 오류 0, `/opt/nvm` 문자열 0, compiler 미존재 fixture가 fail-closed임을 테스트가 증명.

### P0B-03 — 실패 review 증거의 rollback 분리 (B1)

**TASK**

- main execution transaction이 verification 실패로 rollback되어도 failed review/step/event와 run failure 상태를 별도 recovery transaction에서 기록한다.

**DELIVERABLE**

- MODIFY `source/src/server/workflow-service.ts`.
- MODIFY `source/tests/runtime-v090.test.ts`.
- MODIFY `source/verification/scripts/v090_adversarial_verification.py`에 별도 recovery transaction 정적 assertion.
- 동적 test: failed review `verdict=failed`, non-empty `failureJson`, failed verification step/event, run/mission failed.

**SCOPE**

- main transaction 내부에서는 구조화된 `WorkflowVerificationError`에 mission/run/work item/verifier/criteria/evidence/failure 정보를 담아 throw한다.
- outer catch는 해당 error일 때 별도 `prisma.$transaction`으로 verify step을 ensure하고 review find/update-or-create, failed step/event, missionRun/mission failed를 한 번 기록한다.
- 일반 error도 기존 run/mission failed 전이를 보존한다.
- 동일 retry에 duplicate review를 만들지 않도록 현재 `(missionRunId, workItemId, reviewType)` 조회 규칙을 유지한다. Prisma schema 변경은 금지한다.
- test fixture는 RED mission이 approval에서 대기할 때 기존 work item을 completed+빈 output으로 바꾼 뒤 승인하여 실제 실패 경로를 만든다. test-only runtime flag를 추가하지 않는다.
- FORBIDDEN: `prisma/schema*.prisma`, approval CAS 코드, 성공 artifact/final gate, test skip.

**VERIFY**

```bash
cd ai-work-automation-os-v0.9.0/source
DATABASE_URL="file:../data/test-v0.9.0.db" node scripts/db-v090-reset.mjs --yes
DATABASE_URL="file:../data/test-v0.9.0.db" ./node_modules/.bin/prisma generate
DATABASE_URL="file:../data/test-v0.9.0.db" ./node_modules/.bin/prisma db push --skip-generate
DATABASE_URL="file:../data/test-v0.9.0.db" node --import tsx --test --test-concurrency=1 tests/runtime-v090.test.ts
```

- 기대 종료코드: 모두 0.
- 기대 결과: 기존 3 tests + 새 실패 증거 test PASS; transaction rollback 뒤 failed review 1개가 남음.

### P0B-04 — failed run 제한 재시도 (B2)

**TASK**

- terminal early-return에서 retry 가능한 `failed`를 분리하고, retry 상태 전이와 maxAttempts를 fail-closed로 고정한다.

**DELIVERABLE**

- MODIFY `source/src/server/workflow-service.ts`.
- MODIFY `source/src/server/mission-service.ts`.
- MODIFY `source/tests/runtime-v090.test.ts`.
- MODIFY `source/verification/scripts/v090_adversarial_verification.py`에 failed retry reachable/max bound assertion.

**SCOPE**

- `executeMissionRun`: `failed`를 unconditional terminal 목록에서 제거. retry 시작 시 이전 `errorCode/errorMessage/completedAt`을 clear하고 attemptCount를 한 번만 increment.
- `retryMissionRun`: 최초 read에서 `failed && attemptCount < maxAttempts`를 확인한 뒤 `updateMany({ where: { id, status: "failed", attemptCount: observedAttemptCount }, data: { status: "queued" } })`로 single-winner claim한다. `count===1`인 요청만 `executeMissionRun`을 호출한다. `executeMissionRun`이 queued run의 attemptCount를 정확히 한 번 increment한다. claim loser는 최신 run을 재조회해 이미 completed/simulated면 idempotent return, 그 외 `retry_conflict`다.
- completed/simulated는 idempotent return. waiting_approval은 승인 흐름만 사용하며 retry로 실행하지 않는다. blocked/cancelled/queued/running 및 max 도달은 명시 오류로 거부하고 attemptCount 불변.
- API 오류는 기존 `apiError` 매핑과 호환되는 `invalid_run_state:*` 또는 `max_attempts_exceeded`를 사용한다.
- test는 P0B-03 실패 fixture를 재사용하고 원인을 제거한 뒤 success retry, maxAttempts/blocked/waiting_approval 거부를 검증한다. 동일 failed run에 `Promise.allSettled` 동시 retry 2개를 보내 실제 실행 event와 attemptCount 증가가 각각 1회뿐임을 assert한다.
- FORBIDDEN: maxAttempts default 변경, 승인 우회, 새 run 생성, 외부 effect 실행.

**VERIFY**

```bash
cd ai-work-automation-os-v0.9.0/source
npm test
python3 verification/scripts/v090_adversarial_verification.py
```

- 기대 종료코드: 모두 0.
- 기대 결과: failed run 재시도 후 simulated, 동시 요청에서도 attemptCount와 실행 event 정확히 +1; 금지 상태에서 실행 0회.

### P0B-05 — Phase 0-B release integrity gate

**TASK**

- P0B 변경을 release payload manifest와 문서에 반영하고 전체 gate를 한 번 실행한다.

**DELIVERABLE**

- MODIFY `ai-work-automation-os-v0.9.0/source/MANIFEST.sha256`, `ai-work-automation-os-v0.9.0/MANIFEST.sha256`.
- MODIFY `source/README.md`의 설치 명령을 `npm ci`, 검증 설명을 dependency-required/fail-closed로 정정.
- MODIFY `README-FIRST.md`의 설치 명령도 `npm ci`로 정정.
- MODIFY `verify-bundle.sh` required 목록에 `source/package-lock.json`을 추가하고, 개발용 ignored `node_modules/` 존재 여부가 아니라 manifest에 `node_modules/` 파일이 0개인지 검사한다.
- CREATE `ai-work-automation-os-v0.9.0/scripts/integration/regenerate-manifests.sh`와 `ai-work-automation-os-v0.9.0/scripts/integration/regenerate-manifests.test.sh`.
- 검증 로그는 Git에 새로 넣지 않고 수행 보고에 원문/exit code를 첨부.

**SCOPE**

- manifest는 §6.5의 단일 script로만 재생성한다.
- `ai-work-automation-os-v0.9.0/verify-bundle.sh`가 source lock 존재를 required 목록에 확인하도록 MODIFY한다. `node_modules must not be packaged` gate는 `ai-work-automation-os-v0.9.0/source/MANIFEST.sha256`과 `ai-work-automation-os-v0.9.0/MANIFEST.sha256`에 `/node_modules/` entry가 없음을 검사한다. 이 변경은 현재 worktree의 `npm ci` 산출물 때문에 bundle gate가 거짓 실패하는 것을 막되, manifest payload에 dependency tree가 들어가면 반드시 실패하게 한다.
- manifest test는 경로 정렬, 자기 제외, source manifest 포함, node_modules/data secret 제외, 두 번 실행 hash 동일을 검사한다.
- FORBIDDEN: version bump, zip 재생성, release claim 확대, 과거 verification log 수정.

**VERIFY**

```bash
cd ai-work-automation-os-v0.9.0 && bash scripts/integration/regenerate-manifests.test.sh && bash scripts/integration/regenerate-manifests.sh
cd ai-work-automation-os-v0.9.0/source
verify_dir="$(mktemp -d)"
test -n "$verify_dir" && test -d "$verify_dir"
trap 'rm -rf "$verify_dir"' EXIT
./node_modules/.bin/prisma generate
DATABASE_URL="file:$verify_dir/aiwa.db" npm run db:rebuild
DATABASE_URL="file:$verify_dir/aiwa.db" AIWA_TEST_DATABASE_URL="file:$verify_dir/runtime-test.db" npm run verify:v0.9.0
cd .. && ./verify-bundle.sh
git diff --check
```

- 기대 종료코드: 모두 0.
- 기대 결과: check/offline/runtime/build/manifest gate 모두 PASS. 실패하면 Phase 2 시작 금지.

### P2-01 — Human Approval 독립 공급 자산

**TASK**

- AWOS approval gate의 동작 불변조건을 AWOS/Prisma/Next import 없는 Node 22 reference로 추출한다.

**DELIVERABLE**

- CREATE `handoff/jmmw-v1/approval-gate/approval-gate.reference.mjs`.
- CREATE `handoff/jmmw-v1/approval-gate/CONTRACT.md`.
- CREATE `handoff/jmmw-v1/approval-gate/approval-gate.test.mjs`.

**SCOPE**

- READ_ONLY source: `source/src/server/approval-service.ts`, `source/src/server/event-service.ts`, `source/src/lib/ids.ts`, approval Prisma model, runtime/security tests.
- reference는 adapter injection만 사용하고 database/network/UI import를 하지 않는다. decision CAS+decision record+audit+effect intent는 `commitDecisionAtomically` 한 번으로 위임하며, hook은 durable effect intent consumer가 idempotency key로 실행한다.
- test matrix: not-found, same-decision idempotence와 pending effect resume, conflicting reuse, expiry boundary, stored/request hash mismatch, presented hash mismatch, two concurrent commit 중 exactly one, transaction fault after CAS/decision/audit의 full rollback, approved/rejected hook fault와 재개, duplicate effect claim 방지.
- FORBIDDEN: source runtime 수정, JMMW 코드 추측, approval actor를 하드코딩한 권한 모델로 확대.

**VERIFY**

```bash
node --test ai-work-automation-os-v0.9.0/handoff/jmmw-v1/approval-gate/approval-gate.test.mjs
! rg -n '(@/|@prisma|next/|react|require\s*\(|import\s*\()' ai-work-automation-os-v0.9.0/handoff/jmmw-v1/approval-gate
```

- 기대 종료코드: 둘 다 0.
- 기대 결과: matrix 전체 PASS, atomic decision/audit/outbox와 retryable effect 증명, 허용 목록 밖 import 0.

### P2-02 — Mission Workspace 8탭 패턴 공급 자산

**TASK**

- 8탭 정보구조, 데이터/state/polling/approval/accessibility 계약을 framework-neutral JSON+문서로 추출한다.

**DELIVERABLE**

- CREATE `handoff/jmmw-v1/mission-workspace/mission-workspace.pattern.json`.
- CREATE `handoff/jmmw-v1/mission-workspace/CONTRACT.md`.
- CREATE `handoff/jmmw-v1/mission-workspace/mission-workspace.test.mjs`.

**SCOPE**

- READ_ONLY: `source/src/components/mission-workspace.tsx`, `source/src/server/workspace-service.ts`, workspace API route, `source/src/app/globals.css`, runtime test.
- JSON은 `schemaVersion=mission-workspace-pattern.v1`, 8 tab ordered list, per-tab required data, states, polling conditions, approval command, a11y acceptance를 가진다.
- 구현 JSX/CSS를 복제하지 않고 source pointers와 interaction semantics를 제공한다.
- FORBIDDEN: React component 생성, 시각 디자인 재판단, MW route 이름 가정.

**VERIFY**

```bash
node --test ai-work-automation-os-v0.9.0/handoff/jmmw-v1/mission-workspace/mission-workspace.test.mjs
```

- 기대 종료코드: 0.
- 기대 결과: 탭 정확히 8개/중복 0, 필수 state와 approval scopeHash, polling stop 조건, a11y 규칙 존재.

### P2-03 — Atomic SQLite migration 공급 자산

**TASK**

- AWOS의 backup/transaction/validation/swap/restore 순서를 Node 22 built-in 기반 reference와 fault tests로 추출한다.

**DELIVERABLE**

- CREATE `handoff/jmmw-v1/atomic-migration/atomic-migration.reference.mjs`.
- CREATE `handoff/jmmw-v1/atomic-migration/CONTRACT.md`.
- CREATE `handoff/jmmw-v1/atomic-migration/atomic-migration.test.mjs`.

**SCOPE**

- READ_ONLY: `source/scripts/db-v090-migrate.mjs:1114-1237`, migration/schema tests, rollback script.
- reference는 Node built-ins와 injected DB callbacks만 사용한다. source를 read-only로 열 책임, backup-before-temp, transaction, validate-before-swap, restore-on-rename-error를 명시한다.
- fault points: migration callback, validation, source->sidecar rename, temp->source rename. 각 실패에서 source hash/backup/temp/sidecar 상태를 assert.
- FORBIDDEN: actual AWOS DB 접근, Prisma import, in-place migration, test fixture를 repository data에 생성.

**VERIFY**

```bash
node --test ai-work-automation-os-v0.9.0/handoff/jmmw-v1/atomic-migration/atomic-migration.test.mjs
```

- 기대 종료코드: 0.
- 기대 결과: 정상, dry-run/no-op, 4 fault cases 모두 계약대로 PASS.

### P2-04 — 공급 manifest와 MW 인수 패키지

**TASK**

- 3개 자산을 source commit/hash와 결박한 단일 handoff manifest로 묶고 독립 verifier를 제공한다.

**DELIVERABLE**

- CREATE `handoff/jmmw-v1/README.md`.
- CREATE `handoff/jmmw-v1/manifest.json` (`schemaVersion=awos-jmmw-handoff.v1`).
- CREATE `handoff/jmmw-v1/verification/verify-handoff.mjs`.
- CREATE `handoff/jmmw-v1/verification/verify-handoff.test.mjs`.
- MODIFY `ai-work-automation-os-v0.9.0/source/MANIFEST.sha256`, `ai-work-automation-os-v0.9.0/MANIFEST.sha256` via §6.5 script.

**SCOPE**

- manifest 각 asset: source path, source SHA-256, extracted paths+hash, invariants, test command, source commit.
- verifier: JSON schema 필드, 파일 존재/hash, 세 test 실행, dirty source mismatch를 non-zero로 처리. 모든 `.mjs`의 static import, dynamic `import()`, `require()`를 검사하며 허용 import는 `node:*`와 handoff root 안에서 resolve되는 상대경로뿐이다. bare npm specifier, absolute path, root 밖 상대경로를 거부한다.
- verifier는 handoff tree만 repository 밖 `mkdtemp`로 복사하고 `NODE_PATH`를 unset한 상태에서 explicit test 3개를 실행한다. 따라서 parent repository `node_modules`가 없어도 통과해야 한다.
- verifier test는 byte mutation, bare npm import, dynamic import, `../../source` escape, missing hash를 각각 주입해 non-zero를 확인한다.
- README: MW 수신자가 포팅해야 할 adapter와 그대로 복사하면 안 되는 AWOS local-owner 가정 명시.
- FORBIDDEN: JMMW repository write, 수신 완료 주장, generated zip.

**VERIFY**

```bash
node ai-work-automation-os-v0.9.0/handoff/jmmw-v1/verification/verify-handoff.mjs
node --test ai-work-automation-os-v0.9.0/handoff/jmmw-v1/verification/verify-handoff.test.mjs
git diff --check
```

- 기대 종료코드: 모두 0.
- 기대 결과: asset 3/3, clean temp test PASS, hash mismatch 0, allowlist 밖 static/dynamic import 0, negative fixtures 전부 reject.

### P3-00A — Action Hub evidence source manifest와 atomic transfer 도구

**TASK**

- import commit `51253b4`의 Git blob을 신뢰 원본으로 사용하여 evidence exact allowlist/hash를 고정하고, partial destination을 남기지 않는 atomic transfer 도구를 만든다.

**DELIVERABLE**

- CREATE `ai-work-automation-os-v0.9.0/docs/ACTION_HUB_EVIDENCE_SOURCE_MANIFEST_V1.json`.
- CREATE `ai-work-automation-os-v0.9.0/scripts/integration/transfer-action-hub-evidence.mjs`.
- CREATE `ai-work-automation-os-v0.9.0/scripts/integration/transfer-action-hub-evidence.test.mjs`.

**SCOPE**

- manifest exact payload는 다음 repository-relative path 12개다.

```text
jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0/verification/environment-boundary.txt
jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0/verification/ios-swift-release-build.txt
jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0/verification/ios-verify.txt
jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0/verification/migration-v070-pre.json
jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0/verification/migration-v080-post.json
jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0/verification/mobile-http-smoke.json
jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0/verification/pairing-contract-summary.json
jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0/verification/server-coverage.json
jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0/verification/server-pytest.txt
jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0/verification/swift-mobile-smoke.json
jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0/RELEASE_COMMITS.txt
jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0/action-hub.openapi-v0.8.0.json
```
- 각 entry는 repository-relative source path, Git blob id, `git show 51253b4:<path>` byte SHA-256, size를 가진다. worktree byte가 Git blob과 다르면 manifest 생성/transfer를 거부한다.
- transfer tool은 GATE-03A receipt에서 destination realpath/HEAD/remote identity와 clean status를 확인한다. `.git` directory 존재를 가정하지 않고 `git -C <repo> rev-parse --is-inside-work-tree`, `--show-toplevel`, `HEAD`, `remote get-url`을 사용하여 linked worktree도 허용한다.
- destination parent와 같은 filesystem의 sibling temp directory에 12개를 쓰고 hash/count 검증 후 `SHA256SUMS`를 생성한다. final `evidence/v0.8.0`이 미존재일 때만 atomic rename한다. 어떤 실패든 exact temp path만 제거하고 final destination/원본은 건드리지 않는다.
- tests는 linked-worktree fixture, wrong repo/head/remote, dirty destination, 7번째 copy fault, hash mismatch, pre-existing final destination을 검증한다.
- FORBIDDEN: 실제 destination write, current worktree content를 trusted hash로 채택, source snapshot 삭제.

**VERIFY**

```bash
node --test ai-work-automation-os-v0.9.0/scripts/integration/transfer-action-hub-evidence.test.mjs
node ai-work-automation-os-v0.9.0/scripts/integration/transfer-action-hub-evidence.mjs --verify-source-only
```

- 기대 종료코드: 모두 0.
- 기대 결과: exact 12/12 Git blob hash PASS, partial final directory 0, 모든 negative fixture reject.

### P3-01 — Action Hub v0.8.0 증거 이관

**TASK**

- Action Hub 관리자가 제공한 v0.9 repository 절대경로의 `evidence/v0.8.0/`에 검증 증거만 복사하고 수신측 hash를 확인한다.

**DELIVERABLE**

- destination `evidence/v0.8.0/verification/*` 10 files.
- destination `evidence/v0.8.0/RELEASE_COMMITS.txt`.
- destination `evidence/v0.8.0/action-hub.openapi-v0.8.0.json`.
- destination `evidence/v0.8.0/SHA256SUMS`.
- Action Hub 관리자 발행 `RECEIPT.json`과 `RECEIPT.sig`는 MANUAL-GATE-03B 산출물.

**SCOPE**

- MANUAL 선행: GATE-03A receipt가 canonical destination realpath/remote/head, clean worktree, destination 미존재, write 승인, source manifest SHA-256을 모두 결박해야 한다.
- P3-00A transfer tool로 source manifest의 12 Git blobs만 sibling temp에 copy하고 검증 후 atomic rename한다. symlink follow와 destination overwrite를 금지한다.
- 실패 시 tool이 temp를 제거했는지 확인하고 final destination 미존재를 유지한다. 재시도는 새 nonce temp로 시작한다.
- FORBIDDEN: Action Hub v0.8 source copy, wheel/zip copy, AWOS snapshot 삭제, destination commit/push(수신 관리자 소유).

**VERIFY**

```bash
node ai-work-automation-os-v0.9.0/scripts/integration/verify-gate-receipt.mjs MANUAL-GATE-03A ai-work-automation-os-v0.9.0/docs/integration-receipts/ACTION_HUB_PRECOPY_APPROVAL.json
git -C "$ACTION_HUB_V090_REPO" rev-parse --is-inside-work-tree
test -z "$(git -C "$ACTION_HUB_V090_REPO" status --porcelain)"
node ai-work-automation-os-v0.9.0/scripts/integration/transfer-action-hub-evidence.mjs --execute --receipt ai-work-automation-os-v0.9.0/docs/integration-receipts/ACTION_HUB_PRECOPY_APPROVAL.json
test -d "$ACTION_HUB_V090_REPO/evidence/v0.8.0/verification"
cd "$ACTION_HUB_V090_REPO/evidence/v0.8.0" && shasum -a 256 -c SHA256SUMS
test "$(find verification -type f | wc -l | tr -d ' ')" = 10
```

- 기대 종료코드: 모두 0.
- 기대 결과: 12 source payload files+SHA256SUMS, hash mismatch 0, temp directory 0. GATE-03B receipt 전에는 다음 카드 BLOCKED.

### P3-02A — 삭제 inventory 고정과 R4 승인 입력 준비

**TASK**

- 실제 삭제 없이 tracked/ignored 대상 전체를 path·type·mode·blob/hash·size로 고정하고, 실행·rollback 도구를 fault fixture로 검증한다.

**DELIVERABLE**

- CREATE `ai-work-automation-os-v0.9.0/docs/DELETION_INVENTORY_V1.json`.
- CREATE `ai-work-automation-os-v0.9.0/scripts/integration/prepare-deprecation-inventory.mjs`.
- CREATE `ai-work-automation-os-v0.9.0/scripts/integration/execute-deprecation.mjs`.
- CREATE `ai-work-automation-os-v0.9.0/scripts/integration/execute-deprecation.test.mjs`.

**SCOPE**

- GATE-02와 GATE-03B receipt를 먼저 검증한다. inventory는 source commit `51253b4`, current repository realpath/HEAD, plan hash, receipt hashes를 기록한다.
- tracked allowlist는 snapshot 248개와 root zip 2개, 총 250개를 exact entry로 기록한다. 각 entry는 path, Git mode, blob id, `git show 51253b4:<path>` SHA-256, size를 가진다.
- inventory 생성 직전 250개 target 모두에서 staged/unstaged diff가 0인지 확인하고, current worktree의 `lstat` type/mode/byte SHA-256이 `51253b4` blob과 일치해야 한다. 하나라도 수정·누락·type drift면 사용자 변경으로 간주해 BLOCKED하고 inventory를 발행하지 않는다.
- ignored allowlist는 `git ls-files --others -i --exclude-standard`로 snapshot 하위 generated cache의 모든 file/symlink를 열거하고 path, type, SHA-256 또는 symlink target, size를 기록한다. 허용 root는 `server/.venv`, `server/.pytest_cache`, 모든 실제 `__pycache__`, `ios/Packages/ActionHubCore/.build`뿐이다. unignored untracked entry가 하나라도 있으면 BLOCKED.
- execute tool은 inventory와 GATE-04 hash가 일치할 때만 exact entries를 worktree에서 unlink한다. 모든 entry는 `lstat`으로 검사하고 symlink를 follow하지 않는다. `git rm`이나 index 수정은 하지 않는다. 삭제 전 diff snapshot과 삭제 후 diff를 비교해 새 `D` path 집합이 tracked allowlist와 정확히 같아야 한다.
- 모든 tracked entry의 blob을 `git cat-file -e`와 SHA-256으로 미리 검증한다. partial failure fixture는 `git restore --worktree --source=51253b4`로 tracked entries를 복구하고 index가 불변임을 검사한다. ignored caches는 재생성 가능한 local artifact로 명시하며 rollback 대상 데이터로 취급하지 않는다.
- FORBIDDEN: 실제 삭제 실행, index/staging 변경, inventory 밖 path, user data/data/backups.

**VERIFY**

```bash
node ai-work-automation-os-v0.9.0/scripts/integration/verify-gate-receipt.mjs MANUAL-GATE-03B "$ACTION_HUB_V090_REPO/evidence/v0.8.0/RECEIPT.json"
node ai-work-automation-os-v0.9.0/scripts/integration/prepare-deprecation-inventory.mjs
node --test ai-work-automation-os-v0.9.0/scripts/integration/execute-deprecation.test.mjs
node -e 'const x=require("./ai-work-automation-os-v0.9.0/docs/DELETION_INVENTORY_V1.json"); if(x.tracked.length!==250)process.exit(1)'
```

- 기대 종료코드: 모두 0.
- 기대 결과: tracked exact 250, unapproved untracked 0, blob/hash mismatch 0, partial failure rollback fixture PASS. 이 inventory SHA-256을 GATE-04가 승인하기 전 실제 삭제 금지.

### P3-02B — Action Hub 동거 snapshot과 배포 binary 제거

**TASK**

- 수신 receipt와 Git 복구 좌표를 검증한 뒤 Action Hub v0.8 snapshot과 tracked binary 3개를 current tree에서 제거한다.

**DELIVERABLE**

- DELETE `jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0/` 전체 tracked 248 files.
- DELETE 같은 exact snapshot 경로에 남은 ignored generated caches: `server/.venv`, `server/.pytest_cache`, `**/__pycache__`, `ios/Packages/ActionHubCore/.build`.
- DELETE `jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0(1).zip`.
- DELETE `ai-work-automation-os-v0.9.0.zip`.
- wheel은 snapshot tree 삭제에 포함됨.
- CREATE `ai-work-automation-os-v0.9.0/docs/DEPRECATION_ASSET_MANIFEST_V1.md`에 inventory SHA-256, source commit, 삭제 path/count/hash, evidence receipt, restore 명령.

**SCOPE**

- MANUAL-GATE-02/03B가 유효하고 Fable5의 GATE-04 receipt가 현재 plan hash와 `DELETION_INVENTORY_V1.json` SHA-256을 승인해야 한다.
- 실행 직전 inventory의 250 tracked entry를 다시 `lstat`하고 current mode/byte SHA-256을 승인 inventory와 대조한다. staged/unstaged target diff, 누락, byte/mode drift가 하나라도 있으면 삭제 없이 BLOCKED한다.
- `execute-deprecation.mjs`만 사용하며 inventory exact entries를 worktree-only로 삭제한다. index/staging은 변경하지 않는다. 삭제 전후 diff delta와 tracked allowlist 250개가 exact set equality여야 한다.
- ignored entries도 inventory에 열거된 exact path만 unlink하고 빈 exact snapshot directory를 제거한다. 변수·glob·상위 workspace root 재귀 삭제 금지.
- tracked 250-file batch 삭제는 XL 기계 작업 예외다. 논리 수정은 deprecation manifest 1개뿐이다.
- FORBIDDEN: `.git`, `.serena`, `ai-work-automation-os-v0.9.0/source`, data/backups, destination evidence.
- partial 실패 복구: execute tool이 inventory의 tracked pathspec으로 `git restore --worktree --source=51253b4`를 실행하고 index 불변을 확인한다. 만약 운영자가 승인 범위 밖에서 `git rm`을 사용했다면 즉시 중단하고 `git restore --staged --worktree --source=51253b4 -- <inventory pathspec>`로 복구한 뒤 사건을 보고한다.

**VERIFY**

```bash
node ai-work-automation-os-v0.9.0/scripts/integration/verify-gate-receipt.mjs MANUAL-GATE-04 ai-work-automation-os-v0.9.0/docs/integration-receipts/DELETION_APPROVAL.json
node ai-work-automation-os-v0.9.0/scripts/integration/execute-deprecation.mjs --inventory ai-work-automation-os-v0.9.0/docs/DELETION_INVENTORY_V1.json --approval ai-work-automation-os-v0.9.0/docs/integration-receipts/DELETION_APPROVAL.json
git ls-files --error-unmatch ai-work-automation-os-v0.9.0/source/package.json
test ! -e jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0
test ! -e ai-work-automation-os-v0.9.0.zip
test ! -e 'jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0(1).zip'
test "$(git diff --name-only --diff-filter=D -- jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0 ai-work-automation-os-v0.9.0.zip 'jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0(1).zip' | wc -l | tr -d ' ')" = 250
git diff --cached --quiet -- jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0 ai-work-automation-os-v0.9.0.zip 'jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0(1).zip'
node ai-work-automation-os-v0.9.0/scripts/integration/execute-deprecation.mjs --verify-only --inventory ai-work-automation-os-v0.9.0/docs/DELETION_INVENTORY_V1.json
```

- 기대 종료코드: 모두 0.
- 기대 결과: current tree 대상 0, diff delta가 exact tracked 250개, 모든 source blob 복구 가능, index 불변, AWOS source 유지.

### P3-03 — 로컬 설치 심링크 정리

**TASK**

- ignored `ai-work-automation-os-v0.9.0-installed`가 정확한 symlink인지 확인하고 링크 inode만 제거한다.

**DELIVERABLE**

- local symlink 제거 관측 기록. Git 변경 없음.
- 실제 target path와 target 보존 여부 보고.

**SCOPE**

- preflight: `test -L`, `readlink` literal 기록, target directory와 symlink가 다른 inode임을 확인.
- expected target: `/Volumes/DevSpace/Playground/JMAI-OS-Pack/ai-work-automation-os-v0.9.0-installed`.
- expected와 다르거나 directory이면 BLOCKED. target contents는 삭제·수정하지 않는다.
- FORBIDDEN: recursive delete, target deletion, `$HOME`/`~`/workspace root 사용.

**VERIFY**

```bash
node ai-work-automation-os-v0.9.0/scripts/integration/verify-gate-receipt.mjs MANUAL-GATE-05 ai-work-automation-os-v0.9.0/docs/integration-receipts/INSTALL_LINK_APPROVAL.json
test ! -e ai-work-automation-os-v0.9.0-installed
test ! -L ai-work-automation-os-v0.9.0-installed
test -d /Volumes/DevSpace/Playground/JMAI-OS-Pack/ai-work-automation-os-v0.9.0-installed
git status --short -- ai-work-automation-os-v0.9.0-installed
```

- 기대 종료코드: 모두 0.
- 기대 결과: 링크 없음, target directory 유지, Git diff 0.

### P3-04 — SUPERSEDED 배너 최종 인수·복구 링크

**TASK**

- P0B-00에서 즉시 표시한 freeze 배너에 실제 handoff/evidence receipt, 삭제 inventory, 복구 문서 링크를 추가한다.

**DELIVERABLE**

- MODIFY repository `README.md`.
- MODIFY `ai-work-automation-os-v0.9.0/README-FIRST.md`.
- MODIFY `ai-work-automation-os-v0.9.0/source/README.md`.
- MODIFY `ai-work-automation-os-v0.9.0/docs/DEPRECATION_POLICY_V1.md`.
- CREATE `ai-work-automation-os-v0.9.0/scripts/integration/verify-deprecation.mjs`.
- CREATE `ai-work-automation-os-v0.9.0/scripts/integration/verify-deprecation.test.mjs`.
- MODIFY `ai-work-automation-os-v0.9.0/source/MANIFEST.sha256`, `ai-work-automation-os-v0.9.0/MANIFEST.sha256` via §6.5 script.

**SCOPE**

- P0B-00 배너의 `SUPERSEDED`, replacement, freeze date, 신규 설치/기능 금지를 보존하고 3개 공급 asset manifest hash, MW receipt, Action Hub receipt, deletion inventory, Git 복구 좌표 링크를 추가한다.
- deprecation verifier는 GATE-00/02/03A/03B/04/05 signature/provenance, destination identity/hash/commit, exact deletion, symlink target preservation, 세 README positive/negative acceptance를 검사한다. unit test는 각 receipt/hash/path/banner 결함을 주입해 false green을 거부한다.
- 기존 설치/rollback 문서는 역사적 복구 참고로 유지하되 신규 설치 권장처럼 보이는 문구는 `ARCHIVED REFERENCE`로 표시.
- FORBIDDEN: JMMW 기능 완료 주장, 실제 운영 지원 약속, 과거 검증 로그 삭제.

**VERIFY**

```bash
node --test ai-work-automation-os-v0.9.0/scripts/integration/verify-deprecation.test.mjs
node ai-work-automation-os-v0.9.0/scripts/integration/verify-deprecation.mjs --action-hub-repo "$ACTION_HUB_V090_REPO"
for f in README.md ai-work-automation-os-v0.9.0/README-FIRST.md ai-work-automation-os-v0.9.0/source/README.md; do sed -n '1,20p' "$f" | grep -q 'SUPERSEDED'; done
rg -n 'JM-AI Master Worker|신규 개발.*동결|frozen' README.md ai-work-automation-os-v0.9.0/README-FIRST.md ai-work-automation-os-v0.9.0/source/README.md
rg -n 'MW_HANDOFF_RECEIPT|ACTION_HUB.*RECEIPT|DELETION_INVENTORY|51253b4' ai-work-automation-os-v0.9.0/docs/DEPRECATION_POLICY_V1.md
bash ai-work-automation-os-v0.9.0/scripts/integration/regenerate-manifests.sh
```

- 기대 종료코드: 모두 0.
- 기대 결과: 세 진입점 첫 20줄에서 배너 확인.

### P3-05 — 폐기 완료 gate와 운영 판정 경계

**TASK**

- handoff 무결성, evidence receipt, 삭제 범위, README 안내, Git 복구 가능성을 하나의 최종 보고로 검증한다.

**DELIVERABLE**

- CREATE repository-root `deprecation-receipts/AIWA_DEPRECATION_VERIFICATION_V1.md` as post-build receipt.
- 문서에 명령, raw exit code, handoff hash, receipt source_id/path, 삭제 전 commit, 최종 `git status --short`를 기록.

**SCOPE**

- AWOS를 production-ready로 판정하지 않는다. 최종 verdict는 `PASS_SUPERSEDED`, `BLOCKED_DEPRECATION`, `FAIL` 중 하나.
- READ_ONLY: P3-04에서 manifest에 결박한 `verify-deprecation.mjs`와 test. report는 package 밖이라 package manifest를 갱신하지 않는다.
- verifier는 GATE-00/02/03A/03B/04/05 schema와 plan/input digest, Action Hub destination realpath/remote/head/commit 및 SHA256SUMS 12 payload, deletion inventory의 tracked 250개 exact worktree absence와 blob 복구, ignored path absence, symlink absence+target directory 보존, 세 README positive/negative acceptance를 모두 검사한다.
- static/focused/full 순으로 검증하고 full gate는 이 마지막 카드에서 한 번만 실행한다.
- FORBIDDEN: failing check 무시, receipt 없이 PASS, 커밋/푸시.

**VERIFY**

```bash
node --test ai-work-automation-os-v0.9.0/scripts/integration/verify-deprecation.test.mjs
node ai-work-automation-os-v0.9.0/scripts/integration/verify-deprecation.mjs --action-hub-repo "$ACTION_HUB_V090_REPO"
node ai-work-automation-os-v0.9.0/handoff/jmmw-v1/verification/verify-handoff.mjs
cd ai-work-automation-os-v0.9.0/source
verify_dir="$(mktemp -d)"
test -n "$verify_dir" && test -d "$verify_dir"
trap 'rm -rf "$verify_dir"' EXIT
./node_modules/.bin/prisma generate
DATABASE_URL="file:$verify_dir/aiwa.db" npm run db:rebuild
DATABASE_URL="file:$verify_dir/aiwa.db" AIWA_TEST_DATABASE_URL="file:$verify_dir/runtime-test.db" npm run verify:v0.9.0
cd .. && ./verify-bundle.sh
cd .. && git diff --check && git status --short
```

- 기대 종료코드: verifier/full gate/bundle/diff-check 모두 0.
- 기대 결과: 모든 P3 machine condition과 full gates가 PASS하고 마스터 또는 독립 검증자가 status scope를 확인한 뒤에만 `PASS_SUPERSEDED`.

## 8. File Ownership과 Wave

| Wave | Cards | 병렬성 | 전용 파일/경계 |
|---|---|---|---|
| 0 | P0B-00 | EXCLUSIVE | README 3개, deprecation policy, gate validator |
| 1 | P0B-01 | SEQUENTIAL | `source/package-lock.json`, lock test |
| 2 | P0B-02 | SEQUENTIAL | package test script, verifier scripts, migration/runtime harness, shared adversarial verifier |
| 3 | P0B-03 | SEQUENTIAL | `workflow-service.ts`, runtime test, shared adversarial verifier |
| 4 | P0B-04 | SEQUENTIAL | workflow/mission service, runtime test, shared adversarial verifier |
| 5 | P0B-05 | EXCLUSIVE | manifest generator, 두 manifest, README, `verify-bundle.sh`, full gate |
| 6 | P2-01/02/03 | PARALLEL_SAFE | 서로 다른 handoff subdirectory |
| 7 | P2-04 | EXCLUSIVE | handoff manifest/verifier, §6.5 manifests |
| 8 | P3-00A | EXCLUSIVE_PREP | evidence source manifest/transfer tool |
| 9 | P3-01 | EXCLUSIVE_EXTERNAL | Action Hub destination evidence |
| 10 | P3-02A | EXCLUSIVE_PREP | deletion inventory/execute tool; 삭제 없음 |
| 11 | P3-02B | EXCLUSIVE_DESTRUCTIVE | inventory에 결박된 snapshot/binary exact paths |
| 12 | P3-03 | EXCLUSIVE_LOCAL | ignored symlink inode만 |
| 13 | P3-04 | EXCLUSIVE | README/deprecation policy, deprecation verifier/test, §6.5 manifests |
| 14 | P3-05 | EXCLUSIVE_VERIFY | package 밖 post-build verification receipt |

같은 파일을 쓰는 P0B-02/03/04의 `v090_adversarial_verification.py`와 runtime test, P0B-00/05/P3-04의 README, P0B-05/P2-04/P3-04의 manifests는 병렬 실행하지 않는다.

## 9. AUTONOMOUS / MANUAL 게이트

### AUTONOMOUS

- 마스터의 카드 승인 후 P0B-00~05, P2-01~04의 코드·테스트·문서 작성과 로컬 검증.
- P3-04 문서 변경과 P3-05 검증은 선행 게이트 충족 후 자율 수행 가능.

### MANUAL

| Gate | canonical record / issuer | 시점 | 없을 때 |
|---|---|---|---|
| MANUAL-GATE-00 | `ai-work-automation-os-v0.9.0/docs/integration-receipts/PLAN_APPROVAL.json` / Fable5 | 모든 구현 전 | 전 카드 실행 금지 |
| MANUAL-GATE-01 | npm registry 접근 또는 승인된 dependency cache / 수행 환경 관리자 | P0B-01 | lock 생성 BLOCKED |
| MANUAL-GATE-02 | `ai-work-automation-os-v0.9.0/docs/integration-receipts/MW_HANDOFF_RECEIPT.json` / MW 관리자 | P2-04 후 | P3 공급 후속 BLOCKED |
| MANUAL-GATE-03A | `ai-work-automation-os-v0.9.0/docs/integration-receipts/ACTION_HUB_PRECOPY_APPROVAL.json` / Action Hub 관리자 | P3-01 전 | destination write 금지 |
| MANUAL-GATE-03B | `$ACTION_HUB_V090_REPO/evidence/v0.8.0/RECEIPT.json` / Action Hub 관리자 | P3-01 후 | P3-02A/02B BLOCKED |
| MANUAL-GATE-04 | `ai-work-automation-os-v0.9.0/docs/integration-receipts/DELETION_APPROVAL.json` / Fable5 | P3-02A 후, P3-02B 전 | snapshot/binary 보존 |
| MANUAL-GATE-05 | `ai-work-automation-os-v0.9.0/docs/integration-receipts/INSTALL_LINK_APPROVAL.json` / 외부 installed target 책임자 | P3-03 전 | symlink 보존 |

### 9.1 Receipt 공통 schema와 freshness

모든 JSON receipt는 다음 필드를 가진다. `scripts/integration/verify-gate-receipt.mjs <gate-id> <receipt-path>`가 필드, digest, issuer role, freshness를 검증하며 하나라도 다르면 non-zero다.

```json
{
  "schemaVersion": "jm-ai-integration-gate.v1",
  "gateId": "MANUAL-GATE-00",
  "decision": "APPROVED",
  "issuer": { "role": "Fable5", "id": "non-empty-stable-id" },
  "provenance": { "provider": "master-channel", "sourceId": "provider-stable-id", "messageId": "provider-stable-id", "contentSha256": "64 hex" },
  "issuedAt": "RFC3339 timestamp",
  "expiresAt": "RFC3339 timestamp or null",
  "plan": { "path": "ai-work-automation-os-v0.9.0/docs/INTEGRATION_EXEC_PLAN_V1.md", "sha256": "64 hex" },
  "repository": { "realpath": "absolute path", "head": "40 hex" },
  "inputs": { "allowedSignersSha256": "64 hex" },
  "notes": "optional non-sensitive text"
}
```

- 각 receipt는 같은 basename의 `.sig` detached SSH signature를 동반한다. canonical signer allowlist는 `ai-work-automation-os-v0.9.0/docs/integration-receipts/allowed_signers`이며 identity는 `fable5`, `mw-admin`, `action-hub-admin`, `installed-target-owner` 네 값만 허용한다. gate별 허용 identity는 GATE-00/04=`fable5`, GATE-02=`mw-admin`, GATE-03A/03B=`action-hub-admin`, GATE-05=`installed-target-owner`다.
- signature namespace는 `jm-ai-integration`으로 고정하고 validator는 `ssh-keygen -Y verify -f allowed_signers -I <expected-identity> -n jm-ai-integration -s <receipt.sig> < <receipt.json>`을 실행한다. receipt의 `allowedSignersSha256`와 실제 file hash가 달라지면 실패한다.
- trust bootstrap은 Fable5가 직접 master channel로 전달한 root signing-key fingerprint와 GATE-00 `provenance.sourceId/messageId/contentSha256`를 관리자가 별도 확인하는 MANUAL 절차다. 이 fingerprint 또는 detached signature가 없으면 GATE-00은 BLOCKED다. OMP는 receipt, signature, allowed_signers를 생성·수정할 권한이 없다.
- 모든 gate는 현재 plan SHA-256과 repository realpath에 결박한다. plan 내용이 바뀌면 기존 receipt는 무효다.
- GATE-00은 plan hash가 유지되는 동안 유효하고 `expiresAt=null`이다.
- GATE-02는 `inputs.handoffManifestSha256`, MW 수신 repo HEAD/commit, verifier identity를 포함하며 발행 후 7일 이내여야 한다.
- GATE-03A는 Action Hub canonical repo `realpath`, `remoteUrl` 또는 `no-remote` 사유, clean `head`, destination parent, write 승인, `inputs.evidenceSourceManifestSha256`를 포함하며 발행 후 24시간 이내여야 한다.
- GATE-03B는 destination commit, `SHA256SUMS` hash, 12 payload hash, 수신 verifier를 포함하며 만료하지 않되 destination commit에서 재검증 가능해야 한다.
- GATE-04는 P3-02A가 만든 `inputs.deletionInventorySha256`, exact tracked count/hash, ignored allowlist hash, source commit `51253b4`를 포함하며 발행 후 24시간 이내여야 한다.
- GATE-05는 observed symlink realpath/target, `unlink-only=true`, target preservation owner를 포함하며 발행 후 24시간 이내여야 한다.
- 채팅의 단순 `APPROVED`, self-authored JSON, signature/provenance 누락, 허용 목록 밖 issuer, 오래된 receipt, 다른 plan hash는 실행 권한이 아니다. 관리자는 원 발행자가 생성한 canonical JSON+signature를 보존하고 독립 검증자가 provider sourceId/occurred-at-equivalent issuedAt/content hash와 signing fingerprint를 확인하게 한다.

## 10. 알려진 조정 지점

| # | 계획 값 | 달라질 수 있는 이유 | 실행자 확인 방법 |
|---|---|---|---|
| 1 | Node 22/npm 10.9.8 lock | 수행 시 patch version drift | `.nvmrc`, `node --version`, `npm --version`; major가 다르면 BLOCKED |
| 2 | Action Hub evidence 10 files | 수신 전 source 변경 가능 | `git status`, `git ls-files .../verification/** | wc -l`, manifest hash 재계산 |
| 3 | snapshot tracked 248 files | P3 전 다른 승인 작업이 바꿀 수 있음 | `git ls-files '<snapshot>/**' | wc -l`; 248 아니면 삭제 목록 재검토 후 마스터 승인 |
| 4 | source commit `51253b4` | P0/P2 커밋 정책에 따라 HEAD 변경 | archive 원본은 import commit `51253b4` 유지; `git cat-file -e`로 확인 |
| 5 | Action Hub v0.9 destination | 현재 계획 입력에 절대경로 없음 | MANUAL-GATE-03A에서 canonical path/remote/HEAD 제공; 추측 금지 |
| 6 | Review 중복 방지 | schema에 unique constraint 없음 | 현재 `findFirst` query와 retry concurrency 확인; migration 필요 판단 시 본 카드 중단·재승인 |
| 7 | MW adapter signatures | 수신 저장소를 이 계획에서 열지 않음 | handoff contract만 고정; 수신 관리자가 실제 symbols에 맞춰 포팅 |

위 지점에서 실제 코드가 계획과 다르면 질문하지 말고 실제 코드에 맞춰 조정하고, 조정 내용을 결과 보고에 포함하라. 단, 범위·보안 계약·삭제 대상·외부 destination이 달라지면 즉시 `BLOCKED`로 마스터 재승인을 요청한다.

## 11. 위험과 롤백

| Risk | 위험 | P | I | D | 점수/등급 | 예방 | 복구 |
|---|---|---:|---:|---:|---|---|---|
| R-01 | failed evidence가 다시 transaction과 함께 rollback | 3 | 5 | 4 | 60/R3 | 실제 failure fixture, transaction 밖 조회 | P0B-03 revert, run 상태 수동 변경 금지 |
| R-02 | retry가 approval/maxAttempts 우회 | 3 | 5 | 4 | 60/R3 | 상태 matrix+attempt invariant tests | P0B-04 revert, affected run BLOCKED 유지 |
| R-03 | lock이 현재 range의 비의도 최신 버전을 고정 | 3 | 4 | 3 | 36/R3 | direct version diff 검토, full build | lock revert 후 승인 버전 정책 재결정 |
| R-04 | verifier가 compiler 미실행인데 PASS | 4 | 5 | 4 | 80/R4 | local compiler required, negative fixture | P0B-02 revert 금지; BLOCKED 유지 후 수정 |
| R-05 | reference가 AWOS 내부 dependency를 숨김 | 3 | 4 | 3 | 36/R3 | forbidden import scan+in-memory tests | 해당 handoff asset 폐기/재추출 |
| R-06 | evidence 이관 누락/변조 | 2 | 5 | 4 | 40/R3 | source/destination SHA256, receipt | source snapshot 보존, 재이관 |
| R-07 | snapshot/binary 조기 삭제 | 2 | 5 | 5 | 50/R3 | 이중 receipt+R4 별도 승인 | `git restore --source=51253b4 -- exact paths` |
| R-08 | broad recursive delete가 사용자 데이터 손상 | 2 | 5 | 5 | 50/R3 | literal targets, preflight, no glob/root var | 작업 중단, Git tracked restore; 비tracked는 삭제 금지 |
| R-09 | symlink target까지 삭제 | 2 | 5 | 5 | 50/R3 | `test -L`, readlink, unlink-only | target은 미삭제가 원칙; 불일치 시 BLOCKED |
| R-10 | SUPERSEDED가 전체 실운영 완료로 오해됨 | 3 | 4 | 3 | 36/R3 | verdict `PASS_SUPERSEDED`, non-goals 명시 | 문서 정정, 완료 주장 철회 |

R3/R4 failure mode:

- Trigger: 관련 VERIFY non-zero, hash/count drift, receipt 누락, 예상 밖 path/status.
- Failure: 코드/증거/복구 경계가 계약과 다름.
- Detection: 카드별 exact command와 독립 검증자 재실행.
- Recovery: 후속 wave를 시작하지 않고 변경 파일만 revert 또는 Git history에서 exact path restore; 데이터/외부 target에는 추측 조치 금지.

## 12. 실 운영 판정 기준과 매핑

| 마스터 프로토콜 기준 | 이 계획의 처리 | 경계 |
|---|---|---|
| 인증 활성화/fail-closed | Approval supply는 scope/CAS fail-closed, verifier는 compiler fail-closed | AWOS 전체 인증 실운영은 비범위; JMMW가 최종 충족 |
| 문서대로 설치 재현 | package-lock+npm ci+bundle gate | AWOS 신규 설치 권장은 Phase 3에서 종료 |
| 실데이터 smoke | migration temp/fault tests와 runtime DB tests | 생산 실데이터 smoke는 폐기 제품에 대해 완료 주장하지 않음 |
| 백업/복구 실증 | migration backup/swap rollback tests, Git restore proof | 외부 Action Hub destination restore는 수신 관리자 소유 |
| 운영 문서 최신화 | SUPERSEDED/deprecation policy/verification report | AWOS 운영 대신 승계·복구 문서 최신화 |

## 13. 요구사항 추적표

| REQ | Acceptance | Card | fixture/관측 | 검증 명령 |
|---|---|---|---|---|
| REQ-P0B-001 | AC-P0B-001 | P0B-01 | clean package+lock temp | `npm ci`, `npm ls`, `package-lock-v090.test.mjs` |
| REQ-P0B-001 | AC-P0B-001-F | P0B-01 | dependency spec mismatch temp | `node --test tests/package-lock-v090.test.mjs` |
| REQ-P0B-002 | AC-P0B-002 | P0B-02 | local tsc present | `npm run verify:v0.9.0:offline` |
| REQ-P0B-002 | AC-P0B-002-F | P0B-02 | missing `AIWA_TSC_BIN` | `verification-harness-v090.test.mjs` |
| REQ-P0B-003 | AC-P0B-003 | P0B-02 | current path contains spaces | DB/pure/syntax commands in P0B-02 |
| REQ-P0B-004 | AC-P0B-004 | P0B-03 | approved RED mission+empty output | focused `runtime-v090.test.ts` |
| REQ-P0B-005 | AC-P0B-005 | P0B-04 | failed run cause removed | `npm test` retry success case |
| REQ-P0B-006 | AC-P0B-006 | P0B-04 | concurrent/max/blocked/waiting cases | `npm test`, adversarial verifier |
| REQ-P2-001 | AC-P2-001 | P2-01 | CAS/transaction/effect fault matrix | approval reference test |
| REQ-P2-002 | AC-P2-002 | P2-02 | valid 8-tab JSON | workspace pattern test |
| REQ-P2-002 | AC-P2-002-F | P2-02 | missing/duplicate tab/state/scopeHash | workspace pattern negative fixtures |
| REQ-P2-003 | AC-P2-003 | P2-03 | normal+4 fault points | atomic migration reference test |
| REQ-P2-004 | AC-P2-004 | P2-04 | clean handoff copied outside repo | `verify-handoff.mjs` |
| REQ-P2-004 | AC-P2-004-F | P2-04 | byte/import/path/hash mutations | `verify-handoff.test.mjs` |
| REQ-P3-001 | AC-P3-001 | P3-00A/P3-01 | trusted 12 Git blobs+atomic staging | transfer source/tool test+SHA256SUMS |
| REQ-P3-001 | AC-P3-001-F | P3-00A/P3-01 | wrong identity/partial copy/hash | `transfer-action-hub-evidence.test.mjs` |
| REQ-P3-002 | AC-P3-002 | P3-02A | receipt missing/invalid inventory | gate validator+execute negative fixture |
| REQ-P3-003 | AC-P3-003 | P3-02A/P3-02B | exact 250 tracked+ignored inventory | prepare/execute `--verify-only` |
| REQ-P3-004 | AC-P3-004 | P3-03/P3-05 | wrong/dangling link and target preservation | gate validator+deprecation test |
| REQ-P3-005 | AC-P3-005 | P0B-00/P3-04/P3-05 | three valid entry banners+receipt links | grep+deprecation verifier |
| REQ-P3-005 | AC-P3-005-F | P0B-00/P3-05 | one missing banner/link | `verify-deprecation.test.mjs` |

## 14. OMP 디스패치 프롬프트

각 카드 실행 시 아래 공통 프롬프트에 카드 ID와 해당 섹션을 대입한다. P3-02B는 MANUAL-GATE-04 승인 문구 없이는 전달하지 않는다.

```text
TASK: {CARD-ID} — INTEGRATION_EXEC_PLAN_V1.md의 동일 제목 한 줄 목표

DELIVERABLE:
- 카드의 DELIVERABLE 파일 diff 또는 외부 이관 결과
- 카드 VERIFY의 원문 출력과 각 종료코드
- 계획과 다르게 조정한 지점 목록(없으면 "없음")
- 최종 git status --short에서 카드 범위와 무관한 항목을 별도 표시

SCOPE:
- 먼저 읽기: ai-work-automation-os-v0.9.0/docs/INTEGRATION_EXEC_PLAN_V1.md의 해당 카드, §2 권한/순서, §6 계약(특히 manifest를 쓰면 §6.5), §9 MANUAL, §10 조정 지점
- 수정 허용/금지는 카드 SCOPE와 정확히 동일하다.
- 계획서와 실제 코드가 다르면 grep/read 또는 code graph로 실제를 확인해 맞추고 보고한다. 계약·삭제 대상·외부 path가 모순이면 중단하고 BLOCKED 보고한다.
- 테스트 skip/삭제/assertion 약화/ts-ignore/빈 catch/exit-code masking으로 통과시키지 않는다.
- 커밋, push, PR, tag는 별도 지시 없이는 금지한다.

VERIFY: 해당 카드의 명령 전부 -> 기대 종료코드 0, 기대 결과 충족.
보고: WORKING: {현재 단계}; 실패 시 BLOCKED: {명령, exit code, 필요한 것}.
```

## 15. 독립 검증 인계

각 wave 구현 후 관리자는 작성자와 다른 검증자에게 다음만 전달한다.

1. 이 계획서와 해당 카드 ID.
2. 실제 diff와 `git status --short`.
3. VERIFY raw output/exit codes.
4. P3이면 receipt, source/destination hash, exact deletion list.

검증자는 카드의 수용 기준을 재실행하고 `PASS`, `FAIL`, `BLOCKED`만 판정한다. 수행자의 green 보고는 승인으로 간주하지 않는다. CRITICAL/HIGH가 있으면 관리자는 `REVISION READY: <path>` 루프로 돌아간다.

## 16. ASSUMED / UNKNOWN / 배치 질문

### ASSUMED

1. 삭제 전 이중 수신 영수증을 요구한다. 근거/영향/롤백은 ADR-003에 기록했다.
2. `dependency-free`는 모든 static/dynamic import가 `node:*` 또는 handoff asset root 안에서 resolve되는 상대경로인 상태를 뜻한다. bare npm specifier, absolute path, asset root 밖 상대경로, `require()`는 0개이며 repository 밖 temp에서 `NODE_PATH`와 `node_modules` 없이 tests가 통과해야 한다. 영향: MW는 adapter 포팅 필요. 롤백: 수신자가 다른 형식을 요구하면 P2 키트만 재생성.
3. imported source commit `51253b4`를 Action Hub snapshot 복구 좌표로 사용한다. 영향: current tree 삭제 후에도 Git 복구 가능. 롤백: 더 정확한 release commit이 receipt에서 확인되면 deprecation manifest의 좌표를 교체.

### UNKNOWN — 실행 전 MANUAL로 해소

- Action Hub v0.9 canonical repository 절대경로와 수신 담당자.
- Master Worker가 선호하는 포팅 언어/API. 이 계획은 reference contract까지만 고정한다.
- 외부 installed target의 운영 종료 여부. 따라서 link만 제거하고 target은 보존한다.

### 배치 질문

- Q-001: Action Hub v0.9 canonical path와 수신 담당자는 누구인가? 권장: 수신 관리자가 clean repo 절대경로와 receipt schema를 제공. 안전 기본값: 미제공 시 P3-00A까지만 수행하고 GATE-03A/P3-01 이후를 BLOCKED.
- Q-002: MW 수신 확인 형식은 무엇인가? 권장: handoff manifest SHA-256, 수신 commit, 검증자, timestamp를 포함한 서면 receipt. 안전 기본값: 확인 없으면 P3 삭제 금지.

## 17. REVIEW LOG

- 독립 reviewer: fresh `gpt-5.6-sol xhigh`, 파일 수정 없이 적대적 검토.
- 1차 판정: CRITICAL 1 / HIGH 9 / MEDIUM 4. gate 순환, receipt provenance, atomic copy, 삭제 inventory/rollback, final false-green, dependency isolation, approval effect 원자성, retry race, temp DB, freeze 순서, baseline/규모/추적/manifest ownership을 지적.
- 1차 조치: gate 03A/03B 분리, signed receipt schema, trusted Git-blob atomic transfer, P3-02A/P3-02B 분리, deprecation verifier, clean-temp handoff, approval outbox/effect resume, retry CAS, test DB runner, P0B-00 freeze, 21-row 추적표, §6.5 manifest 계약 반영.
- 2차 판정: CRITICAL 3 / HIGH 1. issuer 인증, worktree/index 삭제 검증, lock-test SCOPE, manifest/report 자기참조를 지적.
- 2차 조치: SSH detached signature+issuer allowlist+provenance, current byte/mode 재검증+diff `D` exact 250+index 불변, lock-test CREATE 정합, verifier/test P3-04 선행 및 report package 밖 이동.
- 최종 reviewer 판정: `PASS — CRITICAL 0 / HIGH 0`; reviewed snapshot 1027 lines, SHA-256 `256f726e70a7ed88ed5f8b46d32e4c2458267f3099229b441faa904491d1e872`.
- 최종 reviewer 기계 검사: 카드/TASK/DELIVERABLE/SCOPE/VERIFY/기대 종료코드/기대 결과 각각 17, MUST 15, Acceptance 21, 추적표 21, 모호어 0, 미완료 표식 0(본 REVIEW LOG 갱신 후), 시스템 명령 15종 실존, `ssh-keygen -Y` 지원, nonexistent VERIFY 0.
- 납품 조건: CRITICAL=0, HIGH=0, 금지어=0, 미완료 표식=0, 실존하지 않는 현재 검증 명령=0 — 충족.
