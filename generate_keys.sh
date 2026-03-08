#!/bin/bash
# ============================================
# Supabase 키 자동 생성 스크립트
# 실행: chmod +x generate_keys.sh && ./generate_keys.sh
# ============================================

echo "=== Supabase 키 생성 중 ==="

# PostgreSQL 패스워드
PG_PASS=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)

# JWT Secret (최소 32자)
JWT_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 48)

# Secret Key Base
SECRET_KEY_BASE=$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 64)

# JWT 토큰 생성 함수 (Python 사용)
generate_jwt() {
  local role=$1
  python3 -c "
import json, base64, hmac, hashlib, time

secret = '${JWT_SECRET}'
now = int(time.time())

header = base64.urlsafe_b64encode(json.dumps({'alg':'HS256','typ':'JWT'}).encode()).rstrip(b'=').decode()
payload_data = {'role': '${1}', 'iss': 'supabase', 'iat': now, 'exp': now + 315360000}
payload = base64.urlsafe_b64encode(json.dumps(payload_data).encode()).rstrip(b'=').decode()

sig_input = f'{header}.{payload}'.encode()
sig = hmac.new(secret.encode(), sig_input, hashlib.sha256).digest()
sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b'=').decode()

print(f'{header}.{payload}.{sig_b64}')
"
}

ANON_KEY=$(python3 -c "
import json, base64, hmac, hashlib, time

secret = '${JWT_SECRET}'
now = int(time.time())
header = base64.urlsafe_b64encode(json.dumps({'alg':'HS256','typ':'JWT'}).encode()).rstrip(b'=').decode()
payload_data = {'role': 'anon', 'iss': 'supabase', 'iat': now, 'exp': now + 315360000}
payload = base64.urlsafe_b64encode(json.dumps(payload_data).encode()).rstrip(b'=').decode()
sig_input = f'{header}.{payload}'.encode()
sig = hmac.new(secret.encode(), sig_input, hashlib.sha256).digest()
print(f'{header}.{payload}.{base64.urlsafe_b64encode(sig).rstrip(b\"=\").decode()}')
")

SERVICE_KEY=$(python3 -c "
import json, base64, hmac, hashlib, time

secret = '${JWT_SECRET}'
now = int(time.time())
header = base64.urlsafe_b64encode(json.dumps({'alg':'HS256','typ':'JWT'}).encode()).rstrip(b'=').decode()
payload_data = {'role': 'service_role', 'iss': 'supabase', 'iat': now, 'exp': now + 315360000}
payload = base64.urlsafe_b64encode(json.dumps(payload_data).encode()).rstrip(b'=').decode()
sig_input = f'{header}.{payload}'.encode()
sig = hmac.new(secret.encode(), sig_input, hashlib.sha256).digest()
print(f'{header}.{payload}.{base64.urlsafe_b64encode(sig).rstrip(b\"=\").decode()}')
")

# .env 파일 업데이트
sed -i "s|your-super-secret-postgres-password|${PG_PASS}|g" .env
sed -i "s|your-super-secret-jwt-token-at-least-32-characters|${JWT_SECRET}|g" .env
sed -i "s|<generate-with-script>.*ANON.*|${ANON_KEY}|g" .env
sed -i "s|ANON_KEY=<generate-with-script>|ANON_KEY=${ANON_KEY}|g" .env
sed -i "s|SERVICE_ROLE_KEY=<generate-with-script>|SERVICE_ROLE_KEY=${SERVICE_KEY}|g" .env
sed -i "s|SECRET_KEY_BASE=<generate-with-script>|SECRET_KEY_BASE=${SECRET_KEY_BASE}|g" .env

echo ""
echo "✅ 생성 완료! .env 파일이 업데이트되었습니다."
echo ""
echo "─────────────────────────────────────────"
echo "POSTGRES_PASSWORD : ${PG_PASS}"
echo "JWT_SECRET        : ${JWT_SECRET}"
echo "ANON_KEY          : ${ANON_KEY}"
echo "SERVICE_ROLE_KEY  : ${SERVICE_KEY}"
echo "SECRET_KEY_BASE   : ${SECRET_KEY_BASE}"
echo "─────────────────────────────────────────"
echo ""
echo "📋 Next.js .env.local 에 아래 값을 복사하세요:"
echo "NEXT_PUBLIC_SUPABASE_URL=http://YOUR_PROXMOX_IP:8000"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}"
echo "SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}"
