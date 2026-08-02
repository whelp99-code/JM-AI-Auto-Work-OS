# 프로젝트 고정 정의

**AI Work Automation OS**는 자연어 업무 목표를 받아 필요한 AI 관리자·부서·팀·전문 역할을 구성하고, AI Council의 의사결정 지원과 상태 기반 Workflow를 통해 업무를 계획·배정·실행·독립 검증·승인하며, 검증된 산출물과 통제된 실제 업무 행동까지 연결하는 업무 자동화 운영체제다.

## 모듈 경계

- **AI Council**: 복수 관점 분석, 비판, 대안 비교, 의사결정 지원
- **Organization Runtime**: Department, Team, Role, Agent 구성
- **Workflow Runtime**: 상태, 경로, 재시도, 승인 대기, 종료 제어
- **Verification Runtime**: 독립 검증, 증거, Failure, 완료 조건
- **Artifact Runtime**: 보고서·기획·디자인·기술 명세 등 산출물
- **Delivery Runtime**: 승인된 외부 행동과 시스템 연동

ProofGraph는 별도의 그래프 기반 소프트웨어 개발 에이전트 도구다. 이 제품의 전체 정의 또는 Verification Runtime 명칭으로 사용하지 않는다.
