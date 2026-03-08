# Family News Hub — Phase 1 패키지

## 파일 구조
```
family-news-hub-phase1/
├── supabase/
│   ├── docker-compose.yml    # Supabase 전체 스택
│   ├── .env                  # 환경변수 템플릿 (키 교체 필요)
│   ├── generate_keys.sh      # JWT/PG 키 자동 생성 스크립트
│   └── 01_schema.sql         # DB 스키마 마이그레이션
├── n8n-workflows/
│   ├── WF-04_weather.json    # 기상청 초단기실황 (1시간 간격)
│   ├── WF-05_dust.json       # 에어코리아 미세먼지 (1시간 간격)
│   └── WF-06_fuel.json       # 오피넷 유가 (매일 10:00)
└── docs/
    └── PHASE1_SETUP_GUIDE.md # 단계별 설치 가이드
```

## 빠른 시작
1. `docs/PHASE1_SETUP_GUIDE.md` 읽기
2. Proxmox CT 생성 → Docker 설치
3. `supabase/generate_keys.sh` 실행 → Supabase 기동
4. `01_schema.sql` Studio에서 실행
5. n8n에 WF-04/05/06 import → 테스트 실행
