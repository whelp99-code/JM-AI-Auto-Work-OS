# Known Limitations — v0.9.0

1. 기본 AI 실행은 synthetic이다. 실제 OpenAI·Anthropic·Gemini 호출은 기본 활성화하지 않는다.
2. ExternalEffect는 원장·승인·멱등 경계만 제공하며 실제 이메일·배포·결제·삭제 adapter는 포함하지 않는다.
3. SQLite 단일 writer와 Inline Runtime을 전제로 한다.
4. 멀티사용자·멀티테넌트·원격 접속은 지원하지 않는다.
5. Supabase schema는 미래 전환 자산이며 현재 Runtime에 연결되지 않는다.
6. Node.js `node:sqlite`는 환경에 따라 experimental warning을 표시할 수 있다.
7. 실제 대용량 v0.8.0 DB의 변환 시간과 디스크 여유 공간은 대상 장비에서 측정해야 한다.
8. 일부 손상된 legacy JSON은 안전한 fallback으로 변환되며 원문은 migration metadata/event에 제한적으로 보존될 수 있다.
9. 실제 dependency 설치, generated Prisma types, 전체 API integration, Next.js build, 브라우저 E2E는 대상 환경에서 최종 검증해야 한다.
10. v0.8.0 이전 schema는 자동 변환하지 않는다. 먼저 유효한 v0.8.0 backup으로 복원해야 한다.
