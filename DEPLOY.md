# 무료 배포: Cloudflare Workers + Supabase Edge Functions

## 운영 원칙

Cloudflare **Workers Free**와 Supabase **Free**만 사용한다. Cloud Run, 유료 Workers,
Cloudflare Images, R2, KV, Queues는 배포하지 않는다. 한도가 부족해도 유료 플랜으로
자동 전환하는 구성을 추가하지 않는다. 계정 자체도 양쪽 모두 Free인지 확인해야 한다.
무료 한도를 넘기면 기능이나 프로젝트가 제한될 수 있다. 배포 스크립트가 계정의
요금제를 변경하지는 않는다.

- Workers Free는 요청당 CPU 10ms 제한이 있다. 네트워크 대기는 CPU 시간에 포함되지 않는다.
- Supabase Edge Functions는 CPU 2초/요청, 메모리 256MB 제한이 있다.
- 로컬 테스트 결과만으로 호스팅 환경의 CPU 한도 통과를 보장할 수 없다.
  실제 업로드와 타일 갱신을 검증한 다음 도메인을 전환한다.

공식 문서: [Workers 제한](https://developers.cloudflare.com/workers/platform/limits/),
[Supabase 함수 제한](https://supabase.com/docs/guides/functions/limits),
[Supabase 무료 한도](https://supabase.com/docs/guides/platform/manage-your-usage/edge-function-invocations).

## 구성

```text
브라우저 → Cloudflare Workers (Next.js / OpenNext)
                     ├─ Supabase DB / Storage
                     └─ Supabase Edge Function: image-service (ImageMagick WASM)
```

Workers는 입력 검증, 인증, DB 판정, 타일/이미지 서빙을 담당한다.
언어별 게임·히스토리의 초기 HTML은 빌드 시 생성하고 Workers Static Assets의
읽기 전용 캐시로 제공한다. R2/KV/Queues는 추가하지 않는다. 실제 그림·랭킹은
클라이언트가 기존 API에서 조회하므로 정적 HTML을 제공해도 최신 데이터를 표시한다.
PNG 디코딩/잉크 측정/투명 여백 제거/썸네일/타일 합성은 `image-service`가 담당한다.
타일마다 별도 함수 요청을 사용하고 동시에 최대 4개만 호출한다.
`sharp`는 로컬 시드 생성과 테스트 픽스처에만 사용하며 Worker에는 포함하지 않는다.

DB 스키마와 기존 `canvas` 비공개 Storage 버킷은 유지한다. 별도 데이터 이사는 없다.
추가되는 파일은 `thumbnails/{id}.webp`(96px), `composites/{id}.png`(최대 128px)뿐이다.
새 업로드는 저장 시 생성하고 기존 그림은 최초 요청/합성 시 생성한다.

공개 썸네일 API는 기존과 같이 관리자 제재 여부를 먼저 확인한다.
원본 파일이나 좌표를 공개 API에 추가하지 않는다. 타일 캐시는 버전 쿼리를 포함한
전체 URL을 키로 Cloudflare Cache API에 저장한다.

## 준비와 로컬 검증

Node 버전은 `.node-version`을 따른다. Wrangler는 Node 22.12 이상이 필요하다.
Homebrew의 Node 22를 사용한다면 먼저 아래 PATH를 적용한다.

```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
npm ci
npm test
npm run functions:check
npm run cf:build
npm run cf:check
npm run cf:smoke
```

`functions:prepare`는 npm 패키지에서 WASM 파일을 복사하고 `lib/`의 잉크 판정 코드를
함수의 `shared/` 디렉터리로 복사한다. 생성 파일은 git에서 제외하며 테스트·배포 전에
자동 생성한다. Deno import에는 확장자를 붙이지만 판정 로직의 원본은 `lib/` 하나다.
`cf:smoke`는 가짜 자격증명만 사용해 로컬 Workers 런타임의 화면·라우팅·관리자
로그인을 확인한다. 운영 Supabase 데이터에는 접근하지 않는다.

로컬 Supabase와 함수 실행(Docker 필요):

```bash
npm run db:start
npm run functions:serve
```

별도 터미널에서 Next.js 개발 서버를 실행한다. `.env.local`의 Supabase URL/키는
이때 로컬 프로젝트를 가리켜야 한다.

```bash
npm run dev
```

Workers 실행 환경에서 보려면 `.dev.vars.example`을 `.dev.vars`로 복사한 뒤
Supabase URL/키와 관리자 설정을 채운다. 비밀 값은 git에 올리지 않는다.

```bash
cp .dev.vars.example .dev.vars
npm run cf:build
npm run preview
```

`NEXT_PUBLIC_GA_ID`는 비밀 값이 아니며 빌드 시점의 `.env.local` 또는 CI 빌드 환경에서 읽는다.
GA4와 AdSense 스크립트는 유지하며 Vercel Analytics는 사용하지 않는다.
빌드 마지막 단계에서 OpenNext가 복사한 서버 환경변수 기본값을 제거한다.
운영 자격증명은 Worker secrets로만 주입하며 개발용 `.env.local`을 배포물에 넣지 않는다.

## 1. Supabase 이미지 함수 배포

기존 Supabase 프로젝트와 조직이 **Free**인지 먼저 확인한다.
CLI 로그인 후 기존 프로젝트 ref로 연결하고 이미지를 처리할 함수만 배포한다.
DB 초기화나 마이그레이션 적용은 필요 없다.

```bash
npx supabase login
npx supabase link --project-ref YOUR_EXISTING_PROJECT_REF
npm run functions:deploy
```

WASM 정적 파일이 포함되므로 로컬 CLI/Docker 번들링을 사용한다.
대시보드/API 번들링은 크기 제한이 더 작으므로 사용하지 않는다.

함수는 런타임에 자동 제공되는 `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`를 사용한다.
JWT 게이트웨이 검증을 끄는 대신 핸들러가 서비스 롤 키를 직접 검사한다.
익명 키나 브라우저에서는 이 함수를 호출할 수 없다. CORS 허용도 추가하지 않는다.

로그인을 완료했는데 `Access token not provided`가 나오면 저장된 인증 프로필을
명시한다. 이 프로젝트의 `supabase` 프로필은 다음 명령으로 확인하고 배포할 수 있다.

```bash
npx supabase projects list --profile supabase
npm run functions:deploy -- --project-ref ttbtnsieifktrckcsgky --profile supabase
```

배포가 아무 출력 없이 대기하면 `docker ps`가 응답하는지 확인한다. WASM 정적 파일은
Docker 번들링이 필요하므로 Docker Desktop이 응답하지 않으면 먼저 복구한다.

## 2. Cloudflare Worker 배포

대상 계정의 Workers 요금제가 **Free**인지 확인한다.
유료 플랜 가입이나 결제 계정 등록은 이 구성에 필요하지 않다.

```bash
npx wrangler login
npx wrangler whoami
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put ADMIN_SLUG
npx wrangler secret put ADMIN_PASSWORD
npm run deploy
```

Worker 이름은 `wrangler.jsonc`의 `drawandseek`이다. 처음에는 `workers.dev` 주소에서
확인한다. `WORKER_SELF_REFERENCE`는 자기 자신을 가리키는 바인딩이며 별도 유료
Worker나 리소스를 생성하지 않는다.

Supabase URL과 서비스 롤 키는 1단계에 배포한 동일 프로젝트의 값이어야 한다.
개발용 로컬 키를 운영 Worker에 넣지 않는다.

## 3. 검증 후 도메인 전환

Workers 주소에서 아래 동작을 확인한다.

1. 캔버스 타일, 숨은 그림 목록, 히스토리가 표시된다.
2. 작은 점/가는 선/빈 그림 검증이 기존과 동일하게 작동한다.
3. 정상 그림 업로드 후 목록과 타일이 갱신된다.
4. 그림 발견 판정이 즉시 응답하고 타일에서 그림이 사라진다.
5. 관리자 로그인, 삭제, 복구, 신고 목록이 동작한다.
6. 직접 `/admin-console`, `/api/admin-console/...` 접근은 404다.
7. Worker 로그에 CPU 제한 오류가 없고 Supabase 함수가 CPU 제한으로 종료되지 않는다.
8. 타일 URL의 버전 변경 이후 새 타일이 보이며 재요청은 캐시된다.

검증이 끝나면 Cloudflare 대시보드에서 Worker → Settings → Domains & Routes에
기존 도메인을 Custom Domain으로 연결한다. 도메인 DNS가 아직 다른 곳에 있다면
해당 도메인의 DNS 이전 절차가 먼저 필요하다. 메일 등 다른 DNS 레코드는 유지한다.

기존 Vercel 배포는 전환 검증이 끝날 때까지 남겨 둔다. 문제가 있으면 도메인을
기존 Vercel 대상으로 되돌린다. Git 연동 자동 배포를 사용 중이면 이 코드의
Vercel 배포보다 Supabase 이미지 함수 배포를 먼저 끝내야 한다.

## 실행 한계

`after()`의 응답 후 작업에는 Workers 실행 시간 제한이 적용된다. 타일 합성 실패 시
캔버스 버전을 올리지 않고 서버 로그에 기록한다. 영구 큐나 자동 복구는 포함하지 않는다.
동시 업로드/발견의 타일 재합성 경합은 기존 구조와 동일하게 남아 있으므로 운영 전
동시 요청도 확인한다. 무료 한도 안에서 감당할 수 없는 규모가 되면 업로드 제한이나
작업 분할을 조정하며 유료 서비스로 자동 전환하지 않는다.
