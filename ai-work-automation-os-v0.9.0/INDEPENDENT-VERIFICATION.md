# v0.9.0 독립 검증 보고서

독립 검증은 구현 코드와 분리한 fixture·테스트·정적 규칙·schema 비교를 사용했다. 외부 보안 인증기관의 감사 결과를 의미하지 않는다.

## 결과

| 검사 | 결과 |
|---|---:|
| DB schema·migration·rollback Node tests | **7/7 PASS** |
| 제품·정책 pure tests | **11/11 PASS** |
| Prisma ↔ raw SQLite schema parity | **18 tables / 297 columns PASS** |
| 정적 구조·보안 불변식 | **137/137 PASS** |
| TypeScript/TSX 구문 | **45/45 PASS** |
| Stub 기반 strict semantic TypeScript | **PASS** |
| Shell syntax | **PASS** |
| 통합 offline gate | **PASS** |

## 확인한 DB 불변식

- 물리 user table 정확히 18개
- v0.8.0 core record 보존
- legacy row 순서와 무관한 team parent 복원
- manager relation 복원
- dry-run 무변경
- unknown schema source 무변경
- v0.9.0 재실행 no-op
- rollback 후 v0.8.0 복원
- rollback 시 현재 v0.9.0 safety copy 보존
- Prisma와 raw SQLite DDL의 모든 scalar column 일치

## 확인한 Runtime 불변식

- 제품 정의는 범용 업무 자동화
- ProofGraph는 별도 도구
- 업무 유형별 조직 template
- Producer/Verifier 분리
- RED route에는 Human Approval 포함
- 모든 성공 경로에 Independent Verify와 Final Gate 포함
- 승인 scope 변경 시 hash 변경
- MissionRun idempotency
- External Effect 자동 실행 없음
- synthetic 결과는 `simulated`로 기록
- local loopback-only

## 실행 명령

```bash
./verify-offline.sh
```
