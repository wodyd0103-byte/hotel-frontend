# 호텔 프로젝트 배포 이미지
# json-server 0.17.4 하나로 ① 정적 파일(HTML/CSS/JS/이미지) + ② REST API(db.json) 동시 서빙.
# 복잡한 멀티 컨테이너 구성 없이 단일 프로세스로 동작해 학습/데모용으로 가장 단순합니다.
FROM node:18-alpine

WORKDIR /app

# json-server 글로벌 설치 (package.json 의존성/버전과 일치)
RUN npm install -g json-server@0.17.4

# 정적 파일 복사 → json-server의 --static 디렉토리(public)로 사용.
# src 디렉토리 구조(html/ css/ js/ images/)를 그대로 두면 HTML 안의 상대경로(../css/ 등)가 깨지지 않습니다.
COPY src ./public

# 에디터 상태 파일(.omc) 등 불필요 파일 제거
RUN rm -rf ./public/.omc ./public/html/.omc ./public/*/.omc 2>/dev/null || true

# 3000 = json-server 포트
EXPOSE 3000

# 정적 서빙: ./public
# API 데이터:  /data/db.json  (initContainer가 ConfigMap에서 복사해 옴 — 데이터는 이미지와 분리)
CMD ["json-server", "--host", "0.0.0.0", "--port", "3000", "--static", "./public", "/data/db.json"]
