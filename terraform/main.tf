provider "supabase" {
  access_token = var.access_token
}

/**
 * 운영 Supabase 프로젝트 설정.
 *
 * 이 리소스는 프로젝트 "설정"만 다룬다 — 테이블·인덱스·RLS 같은 스키마는
 * supabase/migrations/ 가 담당한다 (`npx supabase db push`).
 *
 * ⚠ 중요: api/auth/database/network/storage 는 직렬화된 JSON 문자열이고,
 * 프로바이더는 부분 업데이트를 수행한다. 즉 여기 적은 키만 덮어쓴다.
 * 실제 운영값을 확인하지 않은 채 키를 적으면 그 값으로 바뀐다.
 *
 * 그래서 아래 블록들은 주석 처리해 두었다. 순서는:
 *   1) terraform import supabase_settings.production <project_ref>
 *   2) terraform show          — 현재 운영값 확인
 *   3) 관리하고 싶은 키만 실제 값으로 채워 주석 해제
 *   4) terraform plan          — "No changes" 가 나와야 정상
 * 자세한 절차는 README.md 참고.
 */
resource "supabase_settings" "production" {
  project_ref = var.project_ref

  # database = jsonencode({
  #   statement_timeout = "10s"
  # })

  # api = jsonencode({
  #   db_schema = "public,storage,graphql_public"
  #   max_rows  = 1000
  # })

  # storage = jsonencode({
  #   fileSizeLimit = 52428800 # 50MB — 그림 PNG 업로드 상한과 함께 검토할 것
  # })
}
