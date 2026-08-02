# Hermes 작업지시서 — AI Work Automation OS v0.9.0 적용

## 역할

당신은 Lead Integration Engineer다. 제공된 v0.9.0 패키지를 실제 로컬 저장소에 적용하고, 기존 v0.8.0 SQLite 데이터를 18개 canonical table로 안전하게 변환한 뒤 모든 검증 Gate를 실행한다.

## 프로젝트 정의

- 제품은 **AI Work Automation OS**다.
- 목적은 범용 업무 자동화다.
- AI Council은 복수 관점 의사결정 지원 모듈이다.
- Workflow Runtime은 업무 상태와 실행 경로를 관리한다.
- Verification Runtime은 독립 검증과 완료 조건을 관리한다.
- ProofGraph는 별도의 소프트웨어 개발 에이전트 도구다.
- v0.9.0은 Local-First·단일 사용자·SQLite·Inline이다.
- Supabase는 멀티사용자·멀티테넌트 요구 시점까지 보류한다.

## 절대 조건

1. 44-table Runtime Ledger와 18-table Projection의 이중 DB를 재도입하지 않는다.
2. 운영 DB의 user table은 정확히 18개여야 한다.
3. 기존 DB를 backup하기 전에 변환하거나 삭제하지 않는다.
4. Unknown schema는 변환하지 않는다.
5. ExternalEffect를 자동 실행하지 않는다.
6. Producer와 Independent Verifier를 합치지 않는다.
7. Final Verify·Final Gate를 우회하지 않는다.
8. npm/test/build를 실행하지 않은 상태를 통과로 보고하지 않는다.

## 실행 순서

### 1. 패키지 검증

```bash
sha256sum -c ai-work-automation-os-v0.9.0.zip.sha256
unzip ai-work-automation-os-v0.9.0.zip
cd ai-work-automation-os-v0.9.0
./verify-bundle.sh
```

### 2. Git 상태

```bash
cd /path/to/repository
git status --short
git checkout -b release/v0.9.0-db-rebuild
```

Worktree가 깨끗하지 않으면 commit/stash한다.

### 3. 설치

```bash
/path/to/package/install-local.sh /path/to/repository
```

### 4. DB 확인

```bash
cd /path/to/repository
npm run db:doctor
```

필수 결과:

```text
healthy=true
generation=0.9.0
tableCount=18
missing=[]
unexpected=[]
foreignKeyProblems=[]
integrity=[ok]
```

### 5. 전체 Gate

```bash
npm run check
npm test
npm run build
```

### 6. 수동 E2E

```text
Mission 생성
→ Mission Workspace 이동
→ AI 조직 구성 확인
→ Workflow 실행 확인
→ RED Mission 승인 대기 확인
→ 승인 후 재개
→ AI Council 결과 확인
→ Independent Review 확인
→ Final Artifact 확인
→ EventLog 확인
→ Database Settings 18 tables 확인
```

### 7. 마이그레이션 보존 확인

```text
backups/*.v0.8.0.*.db
data/ai-work-automation.db.v0.8.0
backups/*.v0.9.0-migration.*.json
.aiwa-backups/source-before-v0.9.0-*.tar.gz
```

### 8. Git

```bash
git add -A
git commit -m "release: rebuild local database for v0.9.0"
git diff HEAD~1 --check
```

직접 main에 push하지 말고 feature/release branch와 PR을 사용한다.

## 실패 처리

- `npm install` 실패: DB rebuild 전이면 source만 적용된 상태로 중단하고 원인 보고
- migration 실패: 원본 DB가 변경되지 않았는지 checksum 확인
- DB doctor 실패: 앱 실행 금지
- test/build 실패: 수정 후 처음부터 전체 Gate 재실행
- rollback 필요: `npm run db:rollback:v0.8` 후 source archive 복원

## 제출 보고서

1. 적용 대상 commit과 branch
2. source backup 경로
3. DB backup/sidecar/report 경로
4. DB doctor JSON
5. npm install 결과
6. Prisma generate 결과
7. typecheck/test/build 결과
8. E2E 결과
9. 수정한 추가 파일
10. Known Limitations
11. PR 링크

모든 보고는 실제 실행 로그를 근거로 한다.
