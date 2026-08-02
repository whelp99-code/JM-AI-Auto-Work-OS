# v0.8.0 → v0.9.0 DB 마이그레이션 가이드

## 1. 사전 조건

- Node.js 22 이상
- 애플리케이션 및 Worker 종료
- 기존 DB: `data/ai-work-automation.db`
- 소스 저장소는 commit 또는 stash 상태

## 2. Dry-run

```bash
npm run db:rebuild:dry-run
```

Dry-run은 schema generation과 예정 경로만 출력하며 DB를 수정하지 않는다.

## 3. 실행

```bash
npm run db:rebuild
npm run db:seed
npm run db:doctor
```

## 4. 원자적 리빌드 절차

1. 현재 DB를 read-only로 검사한다.
2. v0.8.0 schema가 아니면 중단한다.
3. `backups/`에 checksum 가능한 원본 복사본을 만든다.
4. `<db>.v0.9.0.tmp`에 18개 테이블을 생성한다.
5. 하나의 transaction에서 데이터를 변환한다.
6. exact table set, `foreign_key_check`, `integrity_check`, schema version을 검사한다.
7. 원본 DB를 `<db>.v0.8.0`으로 rename한다.
8. 임시 DB를 현재 DB 경로로 rename한다.
9. migration report JSON을 저장한다.

변환 중 오류가 발생하면 임시 DB를 삭제하고 원본을 그대로 유지한다. Swap 실패 시 sidecar를 원래 경로로 복구한다.

## 5. 대표 데이터 매핑

| v0.8.0 | v0.9.0 |
|---|---|
| Organization | workspace |
| Team / MissionDepartment / MissionTeam | org_unit |
| AgentRole / RoleDefinition | role |
| AgentInstance | agent |
| Mission / MissionRun / WorkItem | 동일 도메인의 canonical table |
| Dispatch / GraphNodeRun / GraphRoleInvocation | workflow_step |
| Graph route/edge | workflow_transition |
| Evaluation / FailurePacket / ShadowAssessment | review |
| DecisionRecord / StaffingRequest / TeamFormationRequest | approval 및 decision_record |
| CouncilRound / ParticipantResponse | council_message |
| Consensus | decision_record |
| Artifact / Deliverable / OrganizationPlanRecord | artifact |
| ExternalEffect | external_effect |
| AuditEvent / MissionEvent / GraphEvent / OrganizationRuntimeEvent | event_log |

## 6. 관계 복원

팀 부모와 Agent 관리자 관계는 레거시 row 순서에 의존하지 않도록 2단계로 처리한다.

```text
1차: 모든 OrgUnit/Agent 생성
2차: parent_id/manager_agent_id 연결
```

존재하지 않는 선택적 참조는 안전하게 `NULL`로 정리하고 migration report에 남긴다.

## 7. 롤백

```bash
npm run db:rollback:v0.8
```

롤백은 `--yes` 확인을 요구하고 현재 v0.9.0 DB를 다음 형태로 별도 보존한다.

```text
data/ai-work-automation.db.v0.9.0.rollback-safety.<timestamp>
```

그 후 `data/ai-work-automation.db.v0.8.0`을 현재 DB 경로로 복원한다.

## 8. 검증

```bash
npm run db:doctor
npm run verify:v0.9.0:offline
npm run check
npm test
npm run build
```

`db:doctor`의 필수 결과:

```text
healthy: true
generation: 0.9.0
tableCount: 18
missing: []
unexpected: []
foreignKeyProblems: []
integrity: ["ok"]
```
