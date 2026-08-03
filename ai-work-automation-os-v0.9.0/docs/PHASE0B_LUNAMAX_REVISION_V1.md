# Phase 0B LunaMax 재검증 보정 제안 V1

## 판정

본 문서는 **수정 제안**이며 구현 승인 또는 코드 변경을 의미하지 않는다. LunaMax headless 요구에 따라 전역 `/opt/homebrew/bin/codex`를 먼저 확인했으나 ENOENT로 실행 불가했다. 대신 번들 CLI `/Applications/ChatGPT.app/Contents/Resources/codex exec --help`를 검증하여 사용했다. CLI 헤더가 보고서 본문의 “metadata unavailable”보다 권위 있는 근거이며, 실제 메타데이터는 model `gpt-5.6-luna`, reasoning effort `max`, Codex `0.146.0-alpha.9.2`였다.

- 최초 workspace-write 세션: `019fc38b-9976-7071-8650-c09a32cbc8db`
- closure danger-full-access 세션: `019fc39b-0fb0-7ea0-9a1b-13dda7b189d1`
- 근거 출력: `/tmp/AWOS-lunamax-review.md`, `/tmp/AWOS-lunamax-closure.md`

최종 Luna closure는 **FAIL**이다. runtime environmental BLOCKED는 해소되었으나, 보정이 필요한 결함이 남아 있으므로 defect zero로 표현해서는 안 된다.

| 심각도 | 건수 |
| --- | ---: |
| CRITICAL | 0 |
| HIGH | 2 |
| MEDIUM | 3 |
| LOW | 0 |

## 확인된 재현·통과 근거

신규 `$TMPDIR` DB에서 `prisma generate` 0, `db:rebuild` 0(18 tables / FK0 / workspace1), `npm test` 0(21/21), `npm run verify:v0.9.0` 0(offline static 137/137, adversarial 57/57, TS 45/45, runtime 21/21, build PASS)을 확인했다. 정상 환경 lock test는 0(3/3), gate test는 0(9/9), `git diff --check`는 0이었다. 시작/종료 상태는 31 paths로 동일했고 HEAD는 `51253b4d630af0c94b56825e664ba78594d9f964`, status 및 SHA hash도 동일했다. commit/push는 0건이다.

| 카드 | 판정 | 근거 |
| --- | --- | --- |
| P0B-00 | REVISION_REQUIRED | CLI main guard가 macOS 논리 `/var` 경로에서 무음 성공 가능 |
| P0B-01 | REVISION_REQUIRED (test only) | lock 내용/재생성은 통과했으나 mismatch fixture가 네트워크 의존 |
| P0B-02 | VERIFIED_PASS | 동적 구현 검증 통과 |
| P0B-03 | VERIFIED_PASS | 동적 구현 검증 통과 |
| P0B-04 | VERIFIED_PASS | 동적 구현 검증 통과 |
| P0B-05 | REVISION_REQUIRED | manifest generator가 실제 비밀 후보 파일을 포함 |

## 보정 카드

### REV-00A — CLI guard의 논리/물리 경로 정규화

- **TASK:** CLI main guard가 macOS의 `/var`와 `/private/var` 별칭 차이로 no-op하지 않도록 `process.argv[1]`과 `fileURLToPath(import.meta.url)` 양쪽을 realpath 정규화하여 비교한다.
- **DELIVERABLE:** 대상 CLI와 해당 테스트에 논리 경로 및 물리 경로 alias 시나리오를 추가한다.
- **SCOPE:** P0B-00의 CLI guard 및 직접 테스트 파일만. Phase 2/3 및 명명된 파일 밖의 코드 변경은 금지한다.
- **VERIFY:** 임시 복사본을 no-arg로 논리 `/var` 경로와 물리 `/private/var` 경로에서 각각 실행한다. 둘 다 Usage를 출력하고 exit `64`여야 한다. 모든 invalid CLI invocation은 nonzero이며 무음 exit `0`이 절대 없어야 한다.

### REV-00B — SSH 서명·시간 유효성 실검증

- **TASK:** `verify-gate-receipt.test.mjs:41-51`가 실제 valid SSH, wrong key, allowlist drift를 검증하도록 보강하고, `verify-gate-receipt.mjs:60-62`가 미래 `issuedAt` 및 `expiresAt <= issuedAt`를 거절하도록 한다.
- **DELIVERABLE:** ephemeral key, `allowed_signers`, 실제 서명을 사용하는 테스트 fixture와 freshness/order validator 규칙을 추가한다. Gate00의 file-only 선택적 SSH 특성은 유지한다.
- **SCOPE:** named gate validator와 직접 테스트만. Phase 2/3 및 명명된 파일 밖의 코드 변경은 금지한다.
- **VERIFY:** 임시 fixture에서 valid signature exit `0`, wrong key exit `1`, allowlist drift exit `1`; future `issuedAt` exit `1`; `expiresAt <= issuedAt` exit `1`이어야 한다. 기존 Gate00 file-only 경로는 성공을 유지한다.

### REV-01 — lock mismatch fixture 결정성 확보

- **TASK:** package-lock mismatch의 양성 재현성 검증과 mismatch 실패 검증을 분리한다. 현재 `left-pad` 추가 fixture는 registry/cache에 의존하며 blocked registry `127.0.0.1:1`에서 ECONNREFUSED로 test exit `1`(2 pass/1 fail), 최초 Luna sandbox에서는 ENOTFOUND가 발생했다.
- **DELIVERABLE:** 결정적 local fixture를 사용하거나 환경적 resolution error를 명시적으로 분류하는 테스트로 교체한다. canonical package-vs-lock equality assertion은 약화하지 않는다.
- **SCOPE:** P0B-01 test only. Phase 2/3 및 명명된 파일 밖의 코드 변경은 금지한다.
- **VERIFY:** 네트워크 비의존 조건에서 positive lock reproducibility는 exit `0`; mismatch는 nonzero; fixture lock hash는 실행 전후 동일해야 한다. 정상 및 `NPM_CONFIG_OFFLINE` 실행도 3/3을 유지한다.

### REV-05 — manifest 비밀 파일 제외

- **TASK:** `scripts/integration/regenerate-manifests.sh:11-15`가 injected root/source `.env.development`, `.env.production`, `.npmrc`를 manifest에 포함하면서 exit `0`하는 문제를 수정한다.
- **DELIVERABLE:** 모든 depth에서 실제 env variant와 `.npmrc`를 제외하되 안전한 `.env.example`, `.env.local.example`는 유지한다. package root와 source에 temp-copy fixture를 둔 테스트를 추가하고, 테스트 통과 후에만 manifests를 regenerate한다.
- **SCOPE:** manifest generator와 직접 테스트/생성 manifest만. Phase 2/3 및 명명된 파일 밖의 코드 변경은 금지한다.
- **VERIFY:** root/source의 injected `.env.development`, `.env.production`, `.npmrc`는 manifest에 0건이고 `.env.example`, `.env.local.example`는 남아야 한다. test exit `0` 후 regenerate; 생성 결과는 `git diff --check` exit `0`이어야 한다.

## 제안 재실행 사다리

1. 각 REV 카드의 focused test를 먼저 실행하고 기대 exit를 확인한다.
2. 신규 `$TMPDIR` DB에서 `prisma generate`, `db:rebuild`, `npm test`를 재실행한다.
3. `npm run verify:v0.9.0`, normal/offline lock test, gate test, `git diff --check`를 실행한다.
4. 시작/종료 git status, HEAD, SHA hash, 변경 경로 수를 비교하고 commit/push가 없음을 확인한다.

**Implementation status: NOT STARTED — awaiting master approval**
