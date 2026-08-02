# AI Work Automation OS v0.9.0 구현 보고서

## 구현 판정

**코드 구현 및 dependency-free/offline 검증 완료.**

**실제 dependency 설치·Prisma Client 생성·전체 테스트·Next.js production build는 대상 로컬 장비의 최종 Gate로 남아 있다.** 제작 컨테이너의 내부 npm registry가 Next.js·Prisma·Zod 패키지를 제공하지 않아 실행하지 못했다.

## 1. DB 직접 리빌드

```text
v0.8.0: 44 Prisma models
v0.9.0: 18 canonical physical tables
```

새 Runtime은 이 18개 테이블을 직접 읽고 쓴다. 별도의 44-table Runtime Ledger나 Core Projection DB는 존재하지 않는다.

## 2. 18개 테이블

| 영역 | 테이블 |
|---|---|
| 조직 | workspace, org_unit, role, agent |
| 업무 | mission, mission_run, work_item |
| Workflow | workflow_step, workflow_transition |
| 검증·승인 | review, approval |
| AI Council | council_session, council_message, decision_record |
| 산출물·실행 | artifact, external_effect |
| 공통 운영 | event_log, file_asset |

## 3. 안전한 v0.8.0 이관

구현 파일:

```text
scripts/db-v090-schema.mjs
scripts/db-v090-migrate.mjs
scripts/db-v090-rollback.mjs
scripts/db-v090-doctor.mjs
scripts/local-backup-v090.mjs
```

지원 기능:

- v0.8.0/v0.9.0/empty/unknown schema 감지
- dry-run
- 변환 전 backup
- read-only source
- 임시 v0.9.0 DB
- transaction 변환
- 팀 parent와 Agent manager 2단계 관계 복원
- exact 18 tables, FK, integrity, schema version 검증
- atomic swap
- swap 실패 원상 복구
- JSON migration report
- 명시적 rollback
- 재실행 no-op

## 4. Backend Runtime 재구성

Canonical 서비스:

```text
mission-service.ts
organization-service.ts
workflow-service.ts
approval-service.ts
council-service.ts
workspace-service.ts
database-service.ts
event-service.ts
local-security.ts
```

제거한 중복 세대:

```text
runtime-service.ts
read-model.ts
local-auth.ts
database-health.ts
api.ts
중복 mission/run/approval dynamic route trees
```

Canonical API:

```text
GET/POST /api/missions
POST     /api/missions/:id/runs
GET      /api/runs/:id/workspace
POST     /api/runs/:id/execute
POST     /api/runs/:id/council
GET      /api/approvals
POST     /api/approvals/:id
GET      /api/system/database
```

## 5. Mission·Organization·Workflow

- 업무 유형: general, research, design, marketing, development, operations, finance, customer_support
- 자연어 기반 업무 유형·위험도 추론
- 예산 상한과 요청 작업 수 제한
- MissionRun idempotency
- Local Inline 실행
- Executive Manager와 업무 유형별 Department/Team
- Producer와 Independent Verifier 분리
- 상태 기반 WorkflowStep/Transition
- RED 업무 Human Approval 대기·재개
- bounded retry
- synthetic 결과를 `simulated`로 명시

## 6. 검증·승인·외부 행동

### Review

Evaluation, 독립 QA, Failure Packet을 하나의 `review` 모델로 통합했다.

### Approval

Executive, Workflow, Staffing, Team Formation, External Effect 승인을 `approval` 모델로 통합했다.

- scope hash
- pending CAS
- expiry
- reject → blocked
- approve → explicit resume

### External Effect

외부 행동 요구는 `external_effect` 원장에 저장하고 승인 전 실행하지 않는다. v0.9.0에는 실제 외부 adapter가 없으므로 승인 후에도 `prepared` 상태까지만 이동한다.

## 7. AI Council

AI Council은 전체 제품이 아니라 의사결정 지원 모듈이다.

- Architect, Critic, Strategist 관점
- 분석·비판·종합 message
- DecisionRecord 저장
- Workflow의 Council step과 연결
- 외부 행동 권한 없음

## 8. UI/UX

- Command Center
- 통합 Mission Workspace
- AI 조직 계층
- Workflow timeline
- 통합 승인
- AI Council
- 검증·증거
- 산출물
- 단일 감사 타임라인
- Database Settings: v0.9.0, 18 tables, row counts, integrity

## 9. Local-First

```text
DB: data/ai-work-automation.db
Network: 127.0.0.1
Principal: local:owner
Runtime: inline
AI mode: synthetic
Supabase: inactive/deferred
```

## 10. 코드 규모

v0.9.0 canonical source는 중복 세대를 제거한 소형 구조로 재작성했다. 릴리스 source manifest가 모든 포함 파일의 SHA-256을 고정한다.
