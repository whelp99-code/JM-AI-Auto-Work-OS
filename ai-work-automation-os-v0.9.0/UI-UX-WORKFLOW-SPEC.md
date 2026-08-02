# v0.9.0 UI/UX·Workflow 명세

## 1. 사용자 여정

```text
업무 목표 입력
→ Mission 생성
→ MissionRun 즉시 생성
→ 업무 유형별 AI 조직 구성
→ Workflow 실행
→ 위험 시 통합 승인함 대기
→ AI Council 의사결정 지원
→ 독립 검증
→ Final Gate
→ 산출물·감사 기록 확인
```

## 2. 화면 구조

| 경로 | 화면 | 목적 |
|---|---|---|
| `/` | Command Center | 목표·예산·성공 조건 입력, Mission 목록 |
| `/missions/:runId` | Mission Workspace | 조직·Workflow·승인·Council·검증·산출물·감사 통합 |
| `/approvals` | Approval Center | 모든 pending approval 처리 |
| `/council` | AI Council Center | 미션별 Council 조회·소집 |
| `/settings/database` | Database Settings | schema version, 18 tables, row count, DB health |
| `/workflow` | Workflow 설명 | 상태 기반 실행 구조 안내 |
| `/organization` | Organization 설명 | 미션별 AI 조직 모델 안내 |

## 3. Mission Workspace 탭

```text
Overview
AI 조직
Workflow
승인
AI Council
검증·증거
산출물
감사 기록
```

### Overview
- Mission/Run 상태
- 위험·예산
- 진행 WorkItem 수
- pending Approval·blocking Review
- 다음 사용자 행동

### AI 조직
- Executive Manager
- Department/Team 계층
- Lead/Specialist/Independent Verifier
- WorkItem 배정

### Workflow
- 실제 `workflow_step` 상태
- 선택된 `workflow_transition`
- waiting approval, failed, completed 상태

### 승인
- 서버가 계산한 `scope_hash`
- approve/reject
- Viewer/미허용 상태에서는 action 비활성화

### AI Council
- 분석·비판·종합 message
- DecisionRecord
- Council은 실행 권한이 없는 의사결정 지원 모듈

### 검증·증거
- Review verdict·score·confidence
- criteria/evidence/failure
- Producer 자기 설명과 Verifier 판정 분리

### 산출물
- Artifact title/type/version/status
- Markdown/text 안전 렌더링
- JSON/파일 metadata

### 감사 기록
- EventLog sequence 기반 시간순 타임라인

## 4. DB 화면

Database Settings는 다음을 명시한다.

```text
Version: v0.9.0
Engine: SQLite
Mode: Local-First / Single User / Inline
Physical table count: 18
Database path
Integrity / FK status
Table별 row count
Backup / rollback 명령
```

## 5. 반응형·접근성

- Desktop sidebar, 모바일 가로 tab/stack 전환
- 상태는 색상뿐 아니라 text badge로 제공
- 승인 버튼에 명확한 action label
- artifact는 HTML 실행 없이 `<pre>` 형태로 렌더링
- error/empty/loading 상태 제공
- 외부 네트워크 로그인 UI 제거
