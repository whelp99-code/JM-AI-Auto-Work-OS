# AI Work Automation OS — 프로젝트 고정 정의

## 제품 정의

> **AI Work Automation OS**는 자연어 업무 목표를 받아 필요한 AI 관리자·부서·팀·전문 역할을 구성하고, AI Council의 의사결정 지원과 상태 기반 Workflow를 통해 업무를 계획·배정·실행·독립 검증·승인하며, 검증된 산출물과 통제된 실제 업무 행동까지 연결하는 업무 자동화 운영체제다.

## v0.9.0 운영 기준

```text
Version       v0.9.0
Deployment    Local-First
User Model    단일 사용자
Database      SQLite
Runtime       Inline
Network       127.0.0.1 전용
AI Mode       Synthetic 기본
Supabase      멀티사용자·멀티테넌트 도입 시점까지 보류
```

## 모듈 경계

| 모듈 | 책임 |
|---|---|
| Company Runtime | Mission과 전체 실행 상태 관리 |
| Organization Runtime | Department·Team·Role·Agent 구성 |
| AI Council | 복수 관점 분석·비판·대안 비교·의사결정 지원 |
| Workflow Runtime | 업무 상태·조건부 경로·재시도·승인 대기·종료 제어 |
| Verification Runtime | 독립 검증·증거·실패·완료 조건 관리 |
| Artifact Runtime | 보고서·기획·디자인·기술 명세 등 결과물 생성 |
| Delivery Runtime | 승인된 외부 업무 행동과 시스템 연동 |

## ProofGraph와의 구분

ProofGraph는 **별도의 그래프 기반 소프트웨어 개발 에이전트 도구**다. 이 프로젝트 전체의 이름도 아니고 Verification Runtime의 이름도 아니다. 향후 개발 업무가 필요할 때 외부 전문 도구로 연결할 수 있다.
