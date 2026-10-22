# 배포 (Cloudflare Workers + Cloud Run)

## 왜 둘로 나뉘어 있나

Cloudflare Workers 무료 플랜은 **요청당 CPU 10ms**다. 이 앱의 이미지 작업은 실측으로 그 예산을 넘는다.

| 작업 | 비용 (로컬 Node 기준) |
|---|---|
| 업로드 처리 (패드 900px) | 18ms |
| 업로드 처리 (패드 1200px) | 30ms |
| 썸네일 생성 (그림 900px) | 25ms |
| 타일 재합성 (업로드 1건, 4~8장) | 80~160ms |

이 한도는 fetch 핸들러·Durable Object·Cron 트리거가 모두 공유한다 — Durable Objects는 Worker 스크립트라 같은 per-invocation CPU 한도를 상속한다. 그래서 Worker 안에서는 어떤 방식으로도 이미지를 처리할 수 없다.

- **Worker** — 라우팅, DB, 인증, 레이트리밋, 타일·썸네일 **스트리밍**. 전부 I/O라 CPU를 거의 쓰지 않는다. fetch 대기 시간은 CPU 시간으로 계산되지 않는다.
- **compositor** (`compositor/`) — 디코드가 필요한 모든 작업. Cloud Run에서 sharp로 돌린다.

트래픽 대부분인 타일 서빙은 엣지에 남아 무료 대역폭을 그대로 쓴다.

## 요청 흐름에서 주의할 점

Cloud Run은 **응답을 보낸 뒤 CPU를 거의 0으로 조절한다.** 그래서 compositor는 "응답 먼저, 작업은 나중" 패턴을 쓰지 않는다. 재합성은 항상 `/recomposite` 요청 **안에서** 끝난다.

사용자 응답을 막지 않는 건 Worker 쪽이 담당한다 — 저장·발견 응답을 먼저 내보내고 `after()`로 `/recomposite`를 띄운다. Worker는 fetch를 기다리지만 그건 CPU 시간이 아니다.

버전 범프(`bump_canvas_version`)는 재합성이 끝난 뒤에만 일어난다. 클라이언트가 새 버전을 보면 새 타일도 준비돼 있다는 뜻이다.

## 1. compositor → Cloud Run

한 번만 하는 설정:

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
gcloud artifacts repositories create drawandseek \
  --repository-format=docker --location=asia-northeast3
```

빌드와 배포:

```bash
gcloud builds submit --config cloudbuild.yaml

gcloud run deploy drawandseek-compositor \
  --image asia-northeast3-docker.pkg.dev/YOUR_PROJECT_ID/drawandseek/compositor \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --max-instances 1 \
  --memory 1Gi \
  --set-env-vars "SUPABASE_URL=...,SUPABASE_SERVICE_ROLE_KEY=...,COMPOSITOR_SECRET=..."
```

플래그마다 이유가 있다.

- **`--max-instances 1`** — 재합성은 base 타일에서 "현재 미발견 그림 전체"를 다시 얹는 read-then-write다. 동시에 돌면 나중에 끝난 쪽이 옛 목록으로 덮어쓸 수 있다. compositor는 단일 프로세스 안에서 재합성을 직렬화하는데(`serialize()`), 인스턴스가 여러 개면 그 보장이 깨진다. 업로드가 시간당 몇 건인 규모라 처리량은 문제되지 않는다.
- **`--allow-unauthenticated`** — GCP IAM 대신 자체 Bearer 토큰(`COMPOSITOR_SECRET`)으로 인증한다. Worker가 GCP 자격증명 없이 부를 수 있어야 한다.
- **`--memory 1Gi`** — sharp가 미발견 그림 전체를 메모리에 올린다.
- **리전** — 사용자가 한국이면 `asia-northeast3`(서울)가 지연이 가장 낮다.

> 시크릿을 서비스 설정에 평문으로 두는 게 걸리면 Secret Manager를 쓴다:
> ```bash
> echo -n "$KEY" | gcloud secrets create supabase-service-role --data-file=-
> gcloud run deploy ... --set-secrets "SUPABASE_SERVICE_ROLE_KEY=supabase-service-role:latest"
> ```

### 콜드스타트

`--min-instances 0`(기본)이면 유휴 시 인스턴스가 내려가고 다음 요청에 **약 2초** 걸린다. 업로드 경로만 이걸 겪고, 유휴 후 첫 요청에만 발생한다. 재합성은 응답 뒤 백그라운드라 영향이 없다.

상시 가동(`--min-instances 1`)은 무료 한도를 벗어난다. 2초가 거슬리면 무료 업타임 모니터로 `/health`를 5분마다 치면 된다 (`/health`는 인증 없이 200을 준다).

Cloud Run 무료 한도: 월 200만 요청, 360,000 GB-초, 180,000 vCPU-초.

## 2. Worker → Cloudflare

```bash
npx wrangler login

npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put ADMIN_SLUG
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put COMPOSITOR_URL      # Cloud Run이 준 https://... 주소
npx wrangler secret put COMPOSITOR_SECRET   # compositor와 같은 값

npm run deploy
```

Node 22 이상이 필요하다 (wrangler 요구사항). Homebrew로 설치했다면 keg-only라 PATH가 필요하다:

```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
```

`NEXT_PUBLIC_GA_ID`는 시크릿이 아니다 — 빌드 시점에 코드로 인라인되므로 **빌드하는 머신의 `.env.local`**에 있어야 한다.

## 3. 기존 데이터 마이그레이션

썸네일은 원래 요청마다 즉석 생성했지만 지금은 업로드 시점에 만들어 Storage에 둔다. 이전에 올라온 그림들은 썸네일이 없으므로 한 번 채워야 한다.

```bash
npm run backfill-thumbs
```

Storage 버킷(`canvas`)과 DB 스키마는 그대로 쓴다. 바꿀 것이 없다.

## 로컬 개발

터미널 둘로 나눠 띄운다.

```bash
npm run compositor   # :8787
npm run dev          # :3000
```

`.env.local` 하나로 양쪽이 다 뜬다 (`.env.example` 참고).

Workers 런타임 그대로 확인하려면:

```bash
cp .dev.vars.example .dev.vars   # 값 채우기
npm run preview
```

## 무료 한도 대비 현황

| 항목 | 한도 | 현재 |
|---|---|---|
| Worker 번들 (gzip) | 3 MB | 1.79 MB |
| Worker 요청당 CPU | 10 ms | 이미지 작업 없음 (I/O만) |
| Worker 요청당 서브요청 | 50 | 업로드·발견 시 5 미만 |
| Worker 일 요청 수 | 100,000 | — |
| Cloud Run 월 요청 | 2,000,000 | — |
