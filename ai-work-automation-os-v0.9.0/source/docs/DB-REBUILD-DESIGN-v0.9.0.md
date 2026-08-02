# DB 리빌드 설계 v0.9.0

## 목표

v0.8.0에서 누적된 44개 모델을 단일 로컬 SQLite의 18개 canonical physical tables로 직접 재구성한다. 별도의 상세 Runtime Ledger와 파생 Core DB를 동시에 운영하지 않는다.

## 구조

```text
workspace
└─ org_unit
   ├─ role
   └─ agent

mission
└─ mission_run
   ├─ work_item
   ├─ workflow_step
   ├─ workflow_transition
   ├─ review
   ├─ approval
   ├─ council_session
   ├─ decision_record
   ├─ artifact
   ├─ external_effect
   └─ event_log
```

## 18개 테이블

| 영역 | 테이블 | 책임 |
|---|---|---|
| 조직 | `workspace` | 로컬 업무 공간, schema version, owner |
| 조직 | `org_unit` | 회사·부서·팀·미션 조직 계층 |
| 조직 | `role` | 책임·역량·권한·도구 정책 |
| 조직 | `agent` | 실행 역할 인스턴스와 보고 관계 |
| 업무 | `mission` | 자연어 업무 목표, 성공 조건, 위험, 예산 |
| 업무 | `mission_run` | 멱등 실행, 상태, lease, 재개 state |
| 업무 | `work_item` | 팀·Agent에 배정되는 실제 작업 |
| Workflow | `workflow_step` | 조사·계획·실행·검증·승인·종료 단계 |
| Workflow | `workflow_transition` | 실제 선택된 조건부 경로 |
| 품질 | `review` | Evaluation·독립 QA·Failure Packet 통합 |
| 승인 | `approval` | Executive·Workflow·Staffing·Team·Effect 승인 통합 |
| Council | `council_session` | 미션 의사결정 세션 |
| Council | `council_message` | 역할별 분석·비판·종합 메시지 |
| 결정 | `decision_record` | Council·사람·정책 결정 기록 |
| 산출물 | `artifact` | 검증된 문서·명세·결과물 |
| 외부 실행 | `external_effect` | 승인·멱등·상태가 필요한 실제 행동 원장 |
| 운영 | `event_log` | 모든 Runtime의 단일 감사 타임라인 |
| 파일 | `file_asset` | 로컬 첨부·산출물 파일 metadata |

## 단순화 기준

- Company, Department, Team은 `org_unit` 계층으로 통합
- 역할 정의와 실행 주체는 `role`과 `agent`로 분리
- Graph node, dispatch, role invocation은 `workflow_step`으로 통합
- Graph edge와 route event는 `workflow_transition`으로 통합
- Evaluation, independent QA, Failure Packet, shadow result는 `review`로 통합
- 승인 유형별 테이블은 `approval`의 `approval_type`으로 통합
- 여러 이벤트 테이블은 `event_log`로 통합
- 비용은 Float USD 대신 정수 micros로 저장
- Checkpoint는 `mission_run.state_json`, step output, event sequence로 복구

## Local-First 적합성

v0.9.0은 단일 사용자·Inline 실행·SQLite single writer를 전제로 한다. 이 조건에서는 분산 lease·queue 상세 테이블을 별도 물리 모델로 유지하는 것보다 `mission_run`, `workflow_step`, `external_effect`, `event_log`에 필요한 안전 상태를 직접 보존하는 것이 단순하고 충분하다.

## 미래 확장

`schema.supabase.prisma`는 향후 PostgreSQL 전환을 위한 동형 schema 자산일 뿐 현재 Runtime에 사용하지 않는다. 멀티사용자·멀티테넌트가 확정될 때 Tenant, User, Membership, Credential, Queue를 별도 버전에서 추가한다.
