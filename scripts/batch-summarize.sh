#!/bin/bash
# 배치 기사 요약 스크립트
# 사용: bash scripts/batch-summarize.sh [반복횟수] [배치크기]
# 예: bash scripts/batch-summarize.sh 50 5  → 50회 × 5개 = 최대 250개 요약

ROUNDS=${1:-10}
BATCH=${2:-5}
API_URL="http://localhost:3020/api/summarize"

echo "=== 배치 기사 요약 시작 ==="
echo "반복: ${ROUNDS}회, 배치: ${BATCH}개씩"

SUCCESS=0
FAILED=0

for i in $(seq 1 $ROUNDS); do
  echo -n "[$i/$ROUNDS] "
  RESULT=$(curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d '{}' 2>/dev/null)

  PROCESSED=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('processed',0))" 2>/dev/null)
  S=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success',0))" 2>/dev/null)

  if [ "$PROCESSED" = "0" ]; then
    echo "완료 — 더 이상 요약할 기사 없음"
    break
  fi

  SUCCESS=$((SUCCESS + S))
  echo "처리: ${PROCESSED}개, 성공: ${S}개"
  sleep 2
done

echo "=== 완료: 총 ${SUCCESS}개 요약 생성 ==="
