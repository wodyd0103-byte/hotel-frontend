# 호텔 프로젝트 — ArgoCD + CI 배포 가이드

`git push` 한 번이면 **빌드 → 이미지 푸시 → 자동 배포**까지 모두 끝나는 구성입니다.
이 문서는 처음 보는 사람도 흐름을 이해할 수 있도록 단계별로 설명합니다.

---

## 1. 전체 구조

```
HOTELPROJECT/
├── src/                     # 정적 파일 (HTML/CSS/JS/이미지) → 컨테이너가 서빙
├── db.json                  # REST API 데이터 → ConfigMap 으로 분리
├── Dockerfile               # 컨테이너 이미지 정의 (json-server 하나로 정적+API 서빙)
├── .dockerignore
├── k8s/                     # Kubernetes 배포 매니페스트 (ArgoCD 가 감시)
│   ├── kustomization.yaml   # Kustomize 진입점 + 이미지 태그(CI가 갱신)
│   ├── namespace.yaml
│   ├── deployment.yaml      # Pod 정의 (initContainer 가 db.json 복사)
│   ├── service.yaml
│   └── ingress.yaml         # 외부 도메인 연결
├── argocd/
│   └── app.yaml             # ArgoCD Application (Git 연동)
└── .github/workflows/ci.yml # GitHub Actions: 빌드 → 푸시 → 태그 갱신 커밋
```

## 2. 배포가 어떻게 동작하나요? (GitOps 흐름)

```
[1] git push (main)
        │
        ▼
[2] GitHub Actions(CI) 가 실행
     ├─ Dockerfile 로 컨테이너 빌드
     ├─ ghcr.io/<owner>/hotel-frontend:<sha> 이미지 푸시
     └─ k8s/kustomization.yaml 의 이미지 태그를 새 SHA 로 갱신 → 자동 커밋/푸시
        │
        ▼
[3] ArgoCD 가 Git(k8s/) 의 변경을 감지
        │
        ▼
[4] 클러스터에 자동 배포(Sync) → Pod 2개로 무중단 롤아웃
```

> 핵심: **사람이 직접 kubectl 을 치지 않습니다.** 모든 배포 상태가 Git 에 기록됩니다(GitOps).

## 3. 컨테이너 안에서는?

단일 컨테이너에 **json-server 하나**가 두 가지 일을 합니다:
- **정적 파일 서빙**: `src/` 의 HTML/CSS/JS/이미지
- **REST API**: `db.json` 기반 (`/rooms`, `/price`, `/reservation` ...)

> `db.json` 은 컨테이너 이미지에 넣지 않고 **ConfigMap** 으로 분리했습니다.
> Pod 시작 시 `initContainer` 가 ConfigMap(db.json)을 쓰기 가능한 영역(emptyDir)으로 복사해서
> json-server 가 예약 저장 등 데이터를 변경할 수 있게 합니다.

## 4. 시작 전에 바꿔야 할 값 (TODO)

| 파일 | 항목 | 설명 |
|------|------|------|
| `k8s/kustomization.yaml` | `newName` | `ghcr.io/<본인owner>/hotel-frontend` |
| `argocd/app.yaml` | `repoURL` | 본인 Git 저장소 주소 |
| `k8s/ingress.yaml` | `host` | 실제 도메인 (예: `hotel.mydomain.com`) |
| `k8s/ingress.yaml` | `ingressClassName` | 클러스터의 Ingress 컨트롤러 (nginx/traefik 등) |

## 5. 최초 1회 설정

### (1) GHCR 패키지 공개 설정
GitHub Actions 가 푸시한 이미지는 기본 **비공개**입니다.
`GitHub → 본인 프로필 → Packages → hotel-frontend → Package settings` 에서
visibility 를 Public 으로 바꾸거나, 클러스터에 imagePullSecret 을 설정하세요.

### (2) ArgoCD 설치 (클러스터에 이미 있으면 생략)
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

### (3) ArgoCD 에 Git 저장소 연결
`argocd/app.yaml` 의 `repoURL` 을 본인 저장소로 바꾼 뒤 적용:
```bash
kubectl apply -f argocd/app.yaml
```
ArgoCD UI(http://localhost:8080 등) 에서 `hotel-frontend` 앱이 `Synced` 가 되면 배포 완료입니다.

## 6. 이후 배포는?

코드를 고치고 **그냥 push** 하세요. 나머지는 자동입니다.
```bash
git add .
git commit -m "예약 페이지 수정"
git push
```

## 7. 로컬에서 이미지 테스트 (선택)
```bash
docker build -t hotel-frontend .
docker run --rm -p 3000:3000 -v "$(pwd)/db.json:/data/db.json" hotel-frontend
# 브라우저: http://localhost:3000/HOME.html
```
