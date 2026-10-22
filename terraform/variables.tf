variable "access_token" {
  description = <<-EOT
    Supabase 개인 액세스 토큰.
    대시보드 → Account → Access Tokens 에서 발급한다.
    코드나 tfvars에 적지 말고 환경변수로 넘긴다:
      export TF_VAR_access_token=sbp_...
  EOT
  type        = string
  sensitive   = true
}

variable "project_ref" {
  description = "Supabase 프로젝트 ref (대시보드 URL 또는 Project Settings에서 확인)"
  type        = string
  default     = "ttbtnsieifktrckcsgky"
}
