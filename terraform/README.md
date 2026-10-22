# Supabase 운영 설정 (Terraform)

프로젝트 **설정**만 코드로 관리한다. 스키마(테이블·인덱스·RLS)는 여기가 아니라
`supabase/migrations/`가 담당한다 — `npx supabase db push`.

| 대상 | 도구 |
|---|---|
| 프로젝트 설정 (API·auth·DB 타임아웃·네트워크·Storage) | Terraform (이 디렉터리) |
| 스키마 | supabase CLI 마이그레이션 |
| 로컬 개발 스택 | `npm run db:start` (Docker) |

## 준비

Supabase 대시보드 → Account → Access Tokens 에서 토큰을 발급한다.

```bash
export TF_VAR_access_token=sbp_...
cd terraform
terraform init
```

## 최초 1회: 기존 프로젝트 가져오기

프로젝트는 이미 존재하므로 **생성이 아니라 import**다. 이 순서를 지켜야 운영 설정이
의도치 않게 바뀌지 않는다.

```bash
terraform import supabase_settings.production ttbtnsieifktrckcsgky
terraform show                 # 현재 운영값 확인
```

`terraform show` 출력에서 관리하고 싶은 키만 골라 `main.tf`의 주석을 해제하고
**실제 값 그대로** 채운다. 그런 다음:

```bash
terraform plan                 # "No changes" 여야 정상
```

`plan`에 변경이 뜨면 선언값이 운영값과 다르다는 뜻이다. 의도한 변경이 아니면
선언을 운영값에 맞춘다.

## 일상 사용

```bash
terraform plan                 # 드리프트 확인 (대시보드에서 수동 변경했는지)
terraform apply                # 변경 적용 — auto-approve 쓰지 말 것
```

## 주의

- **부분 업데이트**: `api`/`auth`/`database`/`network`/`storage`는 직렬화된 JSON이고
  프로바이더는 여기 적은 키만 덮어쓴다. 적지 않은 키는 건드리지 않는다.
- **상태 파일**: 로컬 `terraform.tfstate`에 저장되며 gitignore 대상이다.
  설정값이 평문으로 들어가므로 공유하지 말 것. 잃어도 위 import로 복구 가능하다.
- **여러 기기/CI**: 로컬 상태는 잠금이 없다. 동시 apply가 생길 상황이면 원격 백엔드로 옮긴다.
