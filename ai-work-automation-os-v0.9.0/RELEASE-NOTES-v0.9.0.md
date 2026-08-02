# Release Notes — AI Work Automation OS v0.9.0

## DB Core Rebuild

- 44개 Prisma 모델 → **18개 canonical physical tables**
- 단일 SQLite DB 직접 운영
- 이중 Runtime Ledger/Core Projection 설계 폐기
- OrgUnit 기반 회사·부서·팀 계층
- Review/Approval/EventLog 공통 모델
- 비용 integer micros 표준화

## 안전한 업그레이드

- v0.8.0 schema 자동 감지
- Dry-run
- 자동 원본 backup
- read-only source
- 임시 DB transaction 변환
- FK/integrity/schema 검증
- atomic swap
- v0.8.0 sidecar
- migration report
- 명시적 rollback

## Runtime

- MissionRun idempotency
- Local Inline Workflow
- 업무 유형별 AI 조직
- Producer/Independent Verifier 분리
- RED Human Approval
- AI Council 의사결정 지원
- Final Verify/Final Gate
- ExternalEffect 승인 원장
- 단일 EventLog

## UI/UX

- 새 Command Center
- 통합 Mission Workspace
- 조직·Workflow·승인·Council·검증·산출물·감사 탭
- Database Settings에서 18개 테이블과 health 표시

## 호환성

v0.8.0 물리 schema와 직접 호환되지 않는다. 제공된 `db-v090-migrate.mjs`를 반드시 사용해야 한다. 원본 DB는 자동 보존된다.
