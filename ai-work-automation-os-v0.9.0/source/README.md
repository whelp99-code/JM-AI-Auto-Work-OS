# AI Work Automation OS v0.9.0

Local-First 단일 사용자 업무 자동화 운영체제입니다.

사용자가 자연어 업무 목표를 입력하면 시스템이 업무 유형·위험도·예산을 해석하고, 필요한 AI 조직과 역할을 구성한 뒤 상태 기반 Workflow로 조사·계획·실행·독립 검증·승인·합성·최종 게이트를 수행합니다.

> ProofGraph는 별도의 소프트웨어 개발 에이전트 도구이며 이 저장소의 제품명이나 Verification Runtime 명칭이 아닙니다.

## v0.9.0 핵심 변화

- v0.8.0의 44개 Prisma 모델을 **18개 canonical physical tables**로 직접 리빌드
- 별도 Runtime Ledger나 Projection DB 없이 **단일 SQLite DB** 사용
- 조직은 `workspace → org_unit → role → agent` 구조로 통합
- Workflow는 `workflow_step + workflow_transition`으로 단순화
- 검증은 `review`, 승인은 `approval`, 감사는 `event_log`로 통합
- v0.8.0 DB 자동 백업·변환·원자 교체·롤백 지원
- Command Center와 Mission Workspace를 새 DB 모델에 직접 연결
- Local-First, 단일 사용자, Inline Runtime 유지
- Supabase는 멀티사용자·멀티테넌트 요구 시점까지 보류

## 실행

요구사항: Node.js 22 이상

```bash
cp .env.example .env
cp .env.local.example .env.local
npm install
npm run db:rebuild
npm run db:seed
npm run db:doctor
npm run dev
```

접속: `http://127.0.0.1:3000`

## v0.8.0 업그레이드

애플리케이션을 종료한 뒤 실행합니다.

```bash
npm run db:rebuild:dry-run
npm run db:rebuild
npm run db:doctor
```

리빌드 과정에서 다음이 자동 생성됩니다.

```text
backups/<database>.v0.8.0.<timestamp>.db
data/ai-work-automation.db.v0.8.0
backups/<database>.v0.9.0-migration.<timestamp>.json
```

롤백:

```bash
npm run db:rollback:v0.8
```

## 검증

Dependency 없이 가능한 안전 검증:

```bash
npm run verify:v0.9.0:offline
```

전체 Gate:

```bash
npm run verify:v0.9.0
```

## 18개 canonical tables

```text
Organization : workspace, org_unit, role, agent
Mission      : mission, mission_run, work_item
Workflow     : workflow_step, workflow_transition
Quality      : review, approval
AI Council   : council_session, council_message, decision_record
Delivery     : artifact, external_effect
Operations   : event_log, file_asset
```

## 주요 화면

```text
/                         Command Center
/missions/:runId          통합 Mission Workspace
/approvals                통합 승인함
/council                  AI Council
/settings/database        로컬 DB 상태
/workflow                 Workflow 안내
/organization             Mission 조직 안내
```

## 보안 경계

- `127.0.0.1` loopback 전용
- Local single-owner principal
- External Effect는 승인 원장에만 기록하며 실제 adapter 없이 자동 실행하지 않음
- Independent Verifier와 Producer 역할 분리
- Final Verify와 Final Gate 이전에는 최종 Artifact 승격 금지
- Unknown DB schema는 변환하지 않고 원본을 유지

상세 문서는 `docs/`와 릴리스 패키지의 설치·마이그레이션·검증 보고서를 참고하십시오.
