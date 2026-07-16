#!/bin/bash
# kopolab-auto-server : labport 웹 서버 실행
# 이 프로젝트는 json-server 하나로 ① 정적 파일(src/) + ② REST API(db.json) 동시 서빙.
cd "$(dirname "$0")"

# 이미 실행 중이면 종료
if [ -f server.pid ] && kill -0 "$(cat server.pid)" 2>/dev/null && [ -f server.port ]; then
  echo "이미 실행 중 (포트 $(cat server.port))"; exit 0
fi
rm -f server.pid

# 10000~19999 중 빈 포트 찾기
PORT=$(python3 -c "import socket,random
def free(p):
 s=socket.socket();r=s.connect_ex(('127.0.0.1',p));s.close();return r!=0
for p in random.sample(range(10000,20000),100):
 if free(p): print(p); break")

# json-server 실행: --static ./src (정적) + db.json (REST API), 0.0.0.0 바인드 필수
setsid npx json-server --host 0.0.0.0 --port "$PORT" --static ./src db.json > server.log 2>&1 &
echo $! > server.pid; echo "$PORT" > server.port; sleep 2

# 정상 기동 확인
if kill -0 "$(cat server.pid)" 2>/dev/null; then
  echo "서버 실행됨 (포트 $PORT)."
else
  echo "서버 실행 실패 — server.log 확인:"; tail -20 server.log
  exit 1
fi
