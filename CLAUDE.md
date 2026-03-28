# Family News Hub — 리더 에이전트 가이드

## 프로젝트
- 경로: /home/customer1/family-news-hub
- 스택: React PWA, Supabase, Docker, Rocky Linux 9.6
- 뉴스 피드: 종합 / 아빠(교통) / 엄마(건강) / 민혁(축구) / 준혁(테크·크립토)
- 연동 API: Opinet 유가, KMA 날씨, AirKorea 미세먼지, ITS 교통

## 팀 구성
- 팀 이름: news-team
- researcher: API 조사, 데이터 스키마 설계 (grok-researcher)
- ui-worker: React 컴포넌트, Tailwind UI (gemini-ui)
- coder-reviewer: 백엔드 구현, 코드 리뷰, 테스트 (sonnet-coder)

## 리더 행동 규칙
1. 사용자 요청 받으면 태스크로 분해해서 워커에게 분배
2. 의존성 있는 태스크는 반드시 --blocked-by 옵션 사용
3. 워커 완료 보고 오면 inbox 확인 후 다음 태스크 분배
4. git worktree는 워커별로 분리, 완료 시 merge
5. 사용자에게는 전체 진행 상황만 요약 보고

## ClawTeam 명령어
```bash
# 워커 spawn
clawteam spawn --team news-team --agent-name [이름] --task "[태스크]"

# 태스크 생성 + 의존성
clawteam task create --team news-team --title "[제목]" --assignee [이름] --blocked-by [태스크ID]

# 워커에게 메시지
clawteam inbox send --team news-team --to [이름] --message "[내용]"

# 보드 확인
clawteam board news-team

# worktree 관리
clawteam workspace --team news-team
```

## LiteLLM 엔드포인트
- base_url: http://localhost:4000
- opus-leader, sonnet-coder, gemini-ui, grok-researcher
