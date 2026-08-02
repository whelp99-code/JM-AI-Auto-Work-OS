# v0.9.0 적대적 검증 보고서

## 결과

```text
46 / 46 PASS
```

## 공격 범주

### Approval
- target 변경 후 승인 replay
- action 변경 후 승인 replay
- risk 변경 후 승인 replay
- pending CAS 경쟁
- server-side scope 재계산
- expired approval
- reject 이후 실행 재개

### Workflow
- GREEN/YELLOW/RED에서 Verify 우회
- Final Gate 우회
- RED에서 Human Approval 제거
- Producer의 자기 검증 위장
- 검증 실패 후 완료 상태 위장
- attempt limit 초과

### DB Migration
- unknown schema 변환 시도
- dry-run source 변경
- backup 이전 schema 생성
- 검증 이전 swap
- swap 실패 후 원본 손실
- migration error 후 temp 잔존
- 확인 없는 rollback
- rollback 시 현재 v0.9 DB 손실
- 18개 외 추가 table 삽입
- 이중 Core DB 재도입

### External Effect
- 승인 전 실제 실행
- idempotency 없는 중복 행동
- live 실행을 synthetic 완료로 위장

### Local Security
- 비-loopback Host
- 위조 forwarded host/IP
- real IP 우회
- Local token을 네트워크 인증으로 오용

### UI/API
- Artifact HTML/script injection
- Approval scope hash 미전송
- unknown schema 오류 은폐
- 중복 dynamic route parameter 재도입

## 결론

검사한 공격 모델에서는 DB 원본·승인 경계·검증 경로·Local 경계가 fail-closed로 동작했다. 실제 브라우저·Prisma·Next.js dependency 기반 공격 검증은 대상 환경 Gate에 포함해야 한다.
