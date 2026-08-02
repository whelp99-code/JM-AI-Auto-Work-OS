# v0.9.0 보안 모델

## 1. 로컬 경계

- `next dev/start`는 `127.0.0.1`에만 bind
- Host, `x-forwarded-host`, `x-forwarded-for`, `x-real-ip` 검사
- Local single-owner principal: `local:owner`
- Local mode는 인터넷 또는 LAN 공개용 인증이 아님

## 2. DB 마이그레이션

- Unknown schema는 fail-closed
- Dry-run은 source DB를 수정하지 않음
- Source DB read-only open
- 변환 전 backup
- 임시 DB transaction
- exact 18 table set 검사
- FK/integrity/schema version 검사
- 검증 후 atomic rename
- swap 오류 시 원본 복구
- 명시적 rollback과 v0.9 safety copy

## 3. Workflow·Verification

- Producer와 Independent Verifier 분리
- Verifier는 결과를 평가하며 외부 행동 권한 없음
- Independent Review 실패 시 Finalize 금지
- Final Verify·Final Gate 이후에만 최종 Artifact 승격
- 반복 횟수는 bounded
- 완료 상태는 synthetic evidence를 실제 live 실행으로 위장하지 않고 `simulated`로 기록

## 4. Approval

- 서버에서 approval scope hash 재계산
- `status=pending` compare-and-set으로 한 번만 결정
- 대상·행동·위험·인자가 변경되면 기존 승인 재사용 불가
- 만료된 승인 거부
- 거절 시 MissionRun 차단

## 5. External Effect

- 외부 게시·발송·배포·결제·삭제는 `external_effect`에 기록
- stable idempotency key와 scope hash 사용
- 승인 전 `approval_required`
- 승인 후에도 실제 adapter가 없으므로 자동 실행하지 않음
- 실제 adapter 추가 시 provider idempotency·reconciliation·rollback을 별도 검증해야 함

## 6. UI

- `dangerouslySetInnerHTML` 미사용
- Artifact는 text/JSON으로 안전 렌더링
- 승인 endpoint와 대상은 서버에서 검증
- 민감한 multiuser token UI 없음
